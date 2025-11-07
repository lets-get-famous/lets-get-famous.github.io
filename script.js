const socket = io("https://lets-get-famous-github-io.onrender.com");

socket.on("connect", () => {
  socket.emit("identify", { clientType: "web-player" });
});

function joinRoom() {
  const code = document.getElementById("code").value.toUpperCase();
  const name = document.getElementById("name").value;
  socket.emit("joinRoom", { roomCode: code, playerName: name });
}

socket.on("joinedRoom", (roomCode) => {
  document.body.innerHTML = `<h3>Joined room ${roomCode}</h3>`;
});

socket.on("joinFailed", (msg) => {
  alert(msg);
});

socket.on("updateRoom", (data) => {
  console.log("Room update:", data);
});

socket.on("roomClosed", (msg) => {
  alert(msg);
});
