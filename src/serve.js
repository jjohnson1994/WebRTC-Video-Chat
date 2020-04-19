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
  socket.on('iceCandidate', candidate => {
    socket.broadcast.emit('iceCandidate', candidate);
  });

  socket.on('offer', offer => {
    socket.broadcast.emit('offer', offer);
  });

  socket.on('answer', answer => {
    socket.broadcast.emit('answer', answer);
  })
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});
