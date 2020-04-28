const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/easyRTC.js', (req, res) => {
  res.sendFile(__dirname + '/easyRTC.js');
});

io.on('connection', (socket) => {
  socket.broadcast.emit('userJoinedRoom', {
    clientId: socket.id,
  });

  socket.on('iceCandidate', iceCandidate => {
    socket.broadcast.emit('iceCandidate', {
      clientId: socket.id,
      iceCandidate,
    });
  });

  socket.on('offer', ({ offerTo, offer }) => {
    io.to(offerTo).emit('offer', {
      clientId: socket.id,
      offer,
    });
  });

  socket.on('answer', ({ answerTo, answer }) => {
    io.to(answerTo).emit('answer', {
      clientId: socket.id,
      answer,
    });
  });

  socket.on('disconnect', () => {
    socket.broadcast.emit('userLeftRoom', {
      clientId: socket.id,
    });
  });
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});
