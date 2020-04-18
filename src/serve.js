const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

let roomMembers = [];

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  socket.on('user_join', ({ scp }) => {
    roomMembers.push({ clientId: socket.id, scp });
    io.emit('room_members_updated', roomMembers);
  });

  socket.on('user_leave', () => {
    roomMembers = roomMembers.filter(({ clientId }) => clientId !== socket.id);
    io.emit('room_members_updated', roomMembers);
  });

  socket.on('disconnect', () => {
    roomMembers = roomMembers.filter(({ clientId }) => clientId !== socket.id);
    io.emit('room_members_updated', roomMembers);
  });

  socket.on('candidate', candidate => {
    io.emit('candidate', { clientId: socket.id, candidate }); 
  });
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});
