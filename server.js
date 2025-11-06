// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Wait for identify event from client
  socket.on('identify', (data) => {
    const clientType = data?.clientType || 'unknown';
    console.log(`Client identified as: ${clientType} (${socket.id})`);
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
