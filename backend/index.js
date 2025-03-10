require("dotenv").config();

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

const redisPublisher = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});

const redisSubscriber = redisPublisher.duplicate();
const redisStorage = redisPublisher.duplicate();

const topicSubscriptions = new Map(); // topic -> Set of socket IDs
const userTopics = new Map(); // socket ID -> Set of topics

(async () => {
  try {
    await redisPublisher.connect();
    await redisSubscriber.connect();
    await redisStorage.connect();
    console.log("Redis connected successfully");
    const pong = await redisPublisher.ping();
    console.log("Redis PING response:", pong);
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
  }
})();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  userTopics.set(socket.id, new Set());

  socket.on("subscribe", async (topic) => {
    console.log(
      `Received subscribe request for topic: ${topic} from ${socket.id}`
    );
    try {
      const userTopicSet = userTopics.get(socket.id);
      if (!userTopicSet.has(topic)) {
        userTopicSet.add(topic);

        if (!topicSubscriptions.has(topic)) {
          topicSubscriptions.set(topic, new Set());
          await redisSubscriber.subscribe(topic, (message) => {
            console.log(`Received message on topic ${topic}: ${message}`);
            const subscribers = topicSubscriptions.get(topic);
            if (subscribers) {
              subscribers.forEach((socketId) => {
                console.log(
                  `Emitting to ${socketId} for topic ${topic}: ${message}`
                );
                io.to(socketId).emit("new_message", { topic, message });
              });
            } else {
              console.log(`No subscribers found for topic ${topic}`);
            }
          });
          console.log(`Redis subscribed to topic: ${topic}`);
        }
        topicSubscriptions.get(topic).add(socket.id);

        socket.emit("subscribed", topic);
        socket.emit("topics", Array.from(userTopicSet));

        const history = await redisStorage.lRange(`history:${topic}`, 0, -1);
        socket.emit("topic_history", { topic, messages: history.reverse() });
        console.log(`${socket.id} successfully subscribed to ${topic}`);
      }
    } catch (error) {
      console.error(`Subscription error for topic ${topic}:`, error);
      socket.emit("error", `Failed to subscribe to ${topic}`);
    }
  });

  socket.on("unsubscribe", async (topic) => {
    const userTopicSet = userTopics.get(socket.id);
    if (userTopicSet?.has(topic)) {
      userTopicSet.delete(topic);
      const subscribers = topicSubscriptions.get(topic);

      if (subscribers) {
        subscribers.delete(socket.id);
        console.log(`${socket.id} unsubscribed from ${topic}`);

        // If no more subscribers, remove topic subscription from Redis
        if (subscribers.size === 0) {
          await redisSubscriber.unsubscribe(topic);
          topicSubscriptions.delete(topic);
          console.log(
            `Redis unsubscribed from topic: ${topic} (no subscribers left)`
          );
        }
      }

      socket.emit("unsubscribed", topic);
      socket.emit("topics", Array.from(userTopicSet));
    }
  });

  socket.on("send_message", async ({ topic, message }) => {
    if (!topic || !message) {
      console.log("Invalid message data:", { topic, message });
      return;
    }

    // Check if the user is subscribed before allowing them to send messages
    const userTopicSet = userTopics.get(socket.id);
    if (!userTopicSet || !userTopicSet.has(topic)) {
      console.log(
        `User ${socket.id} attempted to send message to unsubscribed topic: ${topic}`
      );
      socket.emit(
        "error",
        `You are not subscribed to ${topic} and cannot send messages.`
      );
      return;
    }

    try {
      console.log(
        `Publishing message to ${topic}: ${message} from ${socket.id}`
      );
      await redisPublisher.publish(topic, message);
      await redisStorage.lPush(`history:${topic}`, message);
      await redisStorage.lTrim(`history:${topic}`, 0, 99);
    } catch (error) {
      console.error("Failed to publish or store message:", error);
      socket.emit("error", "Failed to send message");
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    const topics = userTopics.get(socket.id);
    if (topics) {
      topics.forEach((topic) => {
        const subscribers = topicSubscriptions.get(topic);
        if (subscribers) {
          subscribers.delete(socket.id);
          if (subscribers.size === 0) {
            redisSubscriber.unsubscribe(topic).then(() => {
              console.log(
                `Redis unsubscribed from topic: ${topic} (no subscribers left)`
              );
            });
            topicSubscriptions.delete(topic);
          }
        }
      });
    }
    userTopics.delete(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
