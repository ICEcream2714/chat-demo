require("dotenv").config();

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");
const { MongoClient } = require("mongodb");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;

// Demo users
const users = ["alice", "bro", "charlie"];
const publicChannel = "public";

// Connect to Redis
const redisPublisher = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  socket: { reconnectStrategy: (retries) => Math.min(retries * 50, 500) },
});
const redisSubscriber = redisPublisher.duplicate();

redisPublisher.on("error", (err) =>
  console.error("Redis Publisher Error:", err)
);
redisSubscriber.on("error", (err) =>
  console.error("Redis Subscriber Error:", err)
);

let messagesCollection;

(async () => {
  try {
    await redisPublisher.connect();
    await redisSubscriber.connect();

    const mongoClient = new MongoClient(process.env.MONGO_URI);
    await mongoClient.connect();
    messagesCollection = mongoClient.db("chatdemo").collection("messages");

    await redisSubscriber.subscribe(publicChannel, (message) => {
      io.emit("new_message", { channel: publicChannel, message });
    });

    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const privateChannel = `${users[i]}:${users[j]}`.toLowerCase();
        await redisSubscriber.subscribe(privateChannel, (message) => {
          io.emit("new_message", { channel: privateChannel, message });
        });
      }
    }

    console.log("Redis connected and subscribed");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    process.exit(1);
  }
})();

// Socket.io connection handler for each client connection to the server instance
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.emit("init", {
    users,
    channels: [
      publicChannel,
      ...users.flatMap((user, index) =>
        users
          .slice(index + 1)
          .map((otherUser) => `${user}:${otherUser}`.toLowerCase())
      ),
    ],
  });

  // Send a message to a recipient or public channel based on the sender and recipient
  socket.on("send_message", async ({ sender, recipient, message }) => {
    try {
      if (
        !users.includes(sender) ||
        (!users.includes(recipient) && recipient !== "public")
      ) {
        throw new Error("Invalid sender or recipient");
      }
      console.log(`Message from ${sender} to ${recipient}: ${message}`);
      let channel;

      // Determine the channel based on the recipient
      if (recipient === "public") {
        channel = publicChannel;
      } else {
        const participants = [sender, recipient].sort();
        channel = participants.join(":").toLowerCase();
      }

      // Publish the message to the channel in Redis
      await redisPublisher.publish(channel, `${sender}: ${message}`);

      // Insert the message into MongoDB
      await messagesCollection.insertOne({
        channel,
        text: `${sender}: ${message}`,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("Error sending message:", err.message);
      socket.emit("error", "Failed to send message");
    }
  });

  socket.on("request_history", async ({ channel }) => {
    const history = await messagesCollection
      .find({ channel })
      .sort({ timestamp: 1 })
      .toArray();
    socket.emit("history_response", {
      channel,
      history: history.map((item) => item.text),
    });
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

process.on("SIGINT", async () => {
  const timeout = setTimeout(() => {
    console.error("Shutdown timed out");
    process.exit(1);
  }, 5000);
  await redisPublisher.quit();
  await redisSubscriber.quit();
  httpServer.close(() => {
    clearTimeout(timeout);
    console.log("Server closed");
    process.exit(0);
  });
});
