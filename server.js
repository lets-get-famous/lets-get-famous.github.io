import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("A client connected:", socket.id);

  // Listen for your custom message from Unity
  socket.on("hostConnected", (message) => {
    console.log(message);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(3000, () => console.log("Server running on port 3000"));
