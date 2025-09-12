const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const rooms = {};
app.use(express.static('public'));

function tirageCascade(players) {
  const remaining = [...players];
  const result = [];
  while (remaining.length > 0) {
    const payerIndex = Math.floor(Math.random() * remaining.length);
    const payer = remaining.splice(payerIndex, 1)[0];
    const othersLeft = remaining.length;
    const mode = Math.random();
    let payFor = [];
    if (othersLeft === 0 || mode < 0.3) {
      payFor = [payer];
    } else if (mode < 0.6 && othersLeft >= 1) {
      const count = Math.ceil(Math.random() * Math.min(othersLeft, 3));
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * remaining.length);
        payFor.push(remaining.splice(idx, 1)[0]);
      }
      payFor.push(payer);
    } else {
      payFor = [...remaining];
      remaining.length = 0;
      payFor.unshift(payer);
    }
    result.push({ payer, payFor });
  }
  return result;
}

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, name }) => {
    if (!rooms[roomId]) rooms[roomId] = { players: [], reason: "le repas" };
    const room = rooms[roomId];
    if (!room.players.find(p => p.id === socket.id)) {
      room.players.push({ id: socket.id, name });
    }
    socket.join(roomId);
    io.to(roomId).emit('updatePlayers', room.players.map(p => p.name));
  });

  socket.on('setReason', ({ roomId, reason }) => {
    if (rooms[roomId]) rooms[roomId].reason = reason;
  });

  socket.on('draw', (roomId) => {
    const room = rooms[roomId];
    if (room && room.players.length > 0) {
      const playerNames = room.players.filter(p => p.name).map(p => p.name);
      const results = tirageCascade(playerNames);
      io.to(roomId).emit('result', results);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
      io.to(roomId).emit('updatePlayers', rooms[roomId].players.map(p => p.name));
    }
  });
});

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: "opérationnel",
    uptime: process.uptime(),
    rooms: Object.keys(rooms).length,
    players: Object.values(rooms).reduce((acc, r) => acc + r.players.length, 0)
  });
});


server.listen(3000, () => console.log('🚀 Serveur lancé sur http://localhost:3000'));