const socket = io("https://lets-get-famous-github-io.onrender.com");

  socket.on("connect", () => {
    console.log("Connected! Sending identify...");
    socket.emit("identify", { clientType: "web-player" });
  });

  socket.on("connect_error", (err) => {
    console.log("Connect error:", err);
  });

  function joinRoom() {
    const code = document.getElementById("code").value;
    const name = document.getElementById("name").value;
    socket.emit("joinRoom", { roomCode: code, playerName: name });
  }

  socket.on("joinedRoom", (code) => {
    document.body.innerHTML = `<h3>Joined room ${code}</h3>`;
  });