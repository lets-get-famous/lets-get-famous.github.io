function startCountdown(io, roomCode, room) {
  if (room.countdown) return;

  room.countdown = 60;
  room.countdownInterval = setInterval(() => {
    room.countdown--;

    io.to(roomCode).emit('countdownUpdate', room.countdown);

    const allLocked = room.players.every(p => p.locked);
    if (allLocked && room.countdown > 10) room.countdown = 10;

    if (room.countdown <= 0) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;

      // Tell all players to show a dice roll button
      io.to(roomCode).emit('promptDiceRoll');

      // Reset old rolls
      room.playerRolls = {};
    }
  }, 1000);
}

function rollDiceForPlayer(room, playerName, rollValue) {
  room.playerRolls[playerName] = rollValue;

  const allRolled = Object.keys(room.playerRolls).length === room.players.length;
  return allRolled;
}

function finalizePlayerOrder(io, roomCode, room) {
  const sorted = Object.entries(room.playerRolls)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  io.to(room.hostId).emit('playerOrderFinalized', sorted);
  io.to(roomCode).emit('playerOrderFinalized', sorted);
}

module.exports = {
  startCountdown,
  rollDiceForPlayer,
  finalizePlayerOrder
};
