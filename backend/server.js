const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let broadcaster = null;

io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
    });

    socket.on('broadcaster', () => {
        broadcaster = socket.id;
        socket.broadcast.emit('broadcaster');
    });

    socket.on('watcher', () => {
        if (broadcaster) {
            io.to(broadcaster).emit('watcher', socket.id);
        }
    });

    socket.on('offer', (id, message) => {
        io.to(id).emit('offer', socket.id, message);
    });

    socket.on('answer', (id, message) => {
        io.to(id).emit('answer', socket.id, message);
    });

    socket.on('candidate', (id, message) => {
        io.to(id).emit('candidate', socket.id, message);
    });
});

const PORT = process.env.PORT || 3009;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
