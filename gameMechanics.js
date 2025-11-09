function startCountdown(io, roomCode, room) {
  if (room.countdown) {
    console.log(`⚠️ [${roomCode}] Countdown already running.`);
    return;
  }

  console.log(`🕐 [${roomCode}] Countdown started (60 seconds)...`);
  room.countdown = 60;

  room.countdownInterval = setInterval(() => {
    room.countdown--;
    io.to(roomCode).emit('countdownUpdate', room.countdown);

    console.log(`⏳ [${roomCode}] Countdown: ${room.countdown}s remaining`);

    // If everyone locked in, speed it up
    const allLocked = room.players.length > 0 && room.players.every(p => p.locked);
    if (allLocked && room.countdown > 10) {
      console.log(`🔒 [${roomCode}] All players locked! Fast-forwarding to 10 seconds.`);
      room.countdown = 10;
    }

    // When time is up
    if (room.countdown <= 0) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;

      console.log(`🚀 [${roomCode}] Countdown ended. Prompting dice roll...`);

      // Tell clients to show Roll Dice button
      io.to(roomCode).emit('promptDiceRoll');
      console.log(`📢 [${roomCode}] Emitted 'promptDiceRoll' to all players.`);

      // Reset old rolls
      room.playerRolls = {};
    }
  }, 1000);
}

function rollDiceForPlayer(room, playerName, rollValue) {
  console.log(`🎲 [${room.hostId || 'N/A'}] ${playerName} rolled a ${rollValue}.`);
  if (!room.playerRolls) room.playerRolls = {};
  room.playerRolls[playerName] = rollValue;

  const allRolled = Object.keys(room.playerRolls).length === room.players.length;
  console.log(`🧾 [${room.hostId || 'N/A'}] Rolls so far:`, room.playerRolls);

  if (allRolled) console.log(`✅ [${room.hostId || 'N/A'}] All players have rolled!`);
  return allRolled;
}

function finalizePlayerOrder(io, roomCode, room) {
  console.log(`🏁 [${roomCode}] Finalizing player order...`);
  const sorted = Object.entries(room.playerRolls)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  console.log(`🥇 [${roomCode}] Final order: ${sorted.join(' → ')}`);

  io.to(room.hostId).emit('playerOrderFinalized', sorted);
  io.to(roomCode).emit('playerOrderFinalized', sorted);
  console.log(`📢 [${roomCode}] Emitted 'playerOrderFinalized' to all clients.`);
}

module.exports = {
  startCountdown,
  rollDiceForPlayer,
  finalizePlayerOrder
};
