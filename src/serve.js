const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

let roomMembers = [];

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/easyRTC.js', (req, res) => {
  res.sendFile(__dirname + '/easyRTC.js');
});

io.on('connection', (socket) => {
  socket.on('iceCandidate', iceCandidate => {
    socket.broadcast.emit('iceCandidate', {
      clientId: socket.id,
      iceCandidate,
    });
  });

  socket.on('offer', offer => {
    socket.broadcast.emit('offer', {
      clientId: socket.id,
      offer,
    });
  });

  socket.on('answer', answer => {
    socket.broadcast.emit('answer', {
      clientId: socket.io,
      answer,
    });
  })
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});
