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

const redisSubcriber = redisPublisher.duplicate();

(async () => {
  try {
    await redisPublisher.connect();
    await redisSubcriber.connect();

    await redisSubcriber.subscribe(process.env.REDIS_CHANNEL, (message) => {
      io.emit("new_message", message);
    });
    console.log("Redis connected and subscribed");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
  }
})();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("send_message", async (data) => {
    console.log(`Message received: ${data}`);
    await redisPublisher.publish(process.env.REDIS_CHANNEL, data);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
