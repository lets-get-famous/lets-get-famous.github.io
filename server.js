import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";


const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const clients = {}; // { socket.id: "unity-host" | "web-player" }

io.on("connection", (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on("identify", (data) => {
    clients[socket.id] = data.clientType;
    console.log(`Client ${socket.id} identified as ${data.clientType}`);

    if (data.clientType === "unity-host") {
      socket.emit("welcome", "Hello, Unity Host!");
    } else if (data.clientType === "web-player") {
      socket.emit("welcome", "Hello, Web Player!");
    }
  });

  socket.on("disconnect", () => {
    console.log(`Disconnected: ${socket.id} (${clients[socket.id]})`);
    delete clients[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
