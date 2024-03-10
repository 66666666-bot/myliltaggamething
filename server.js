const express = require('express');
const http = require('http');
const socketIo = require('socket.io'); // Make sure to include this line for Socket.io
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server); // Create a socket.io server instance

const PORT = process.env.PORT || 80; // Define the port number

let players = {};
let itPlayerId = null; // Variable to keep track of the player who is "it"

// Function to select a random player as the "it" player
function selectNewItPlayer() {
    const playerIds = Object.keys(players);
    if (playerIds.length > 0) {
        itPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
        players[itPlayerId].it = true;
        io.emit('newItPlayer', itPlayerId);
    } else {
        itPlayerId = null; // No players left, reset itPlayerId
    }
}

// Periodically check if the "it" player is still connected
setInterval(() => {
    if (itPlayerId && !players[itPlayerId]) {
        selectNewItPlayer();
    }
}, 10000); // Check every 10 seconds (adjust as needed)

// Handle new connections
io.on('connection', socket => {
    console.log('New player connected');

    // Add new player
    players[socket.id] = {
        x: Math.random() * 800, // Random x position within canvas
        y: Math.random() * 600, // Random y position within canvas
        it: false // Initially not "it"
    };

    // Emit player list to the new client
    socket.emit('playerList', players);

    // If there's no "it" player, select a random player to be "it"
    if (!itPlayerId) {
        itPlayerId = socket.id;
        players[socket.id].it = true;
    }

    // Emit the new "it" player to all clients
    io.emit('newItPlayer', itPlayerId);

    // Handle player movement
    socket.on('move', data => {
        players[socket.id].x = data.x;
        players[socket.id].y = data.y;
        io.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected');
        delete players[socket.id];
        // If the disconnected player was "it", choose a new "it" player
        if (socket.id === itPlayerId) {
            const playerIds = Object.keys(players);
            if (playerIds.length > 0) {
                itPlayerId = playerIds[Math.floor(Math.random() * playerIds.length)];
                players[itPlayerId].it = true;
                io.emit('newItPlayer', itPlayerId);
            } else {
                itPlayerId = null; // No players left, reset itPlayerId
            }
        }
        io.emit('playerDisconnected', socket.id);
    });

    // Handle tagging
    socket.on('tag', taggedPlayerId => {
        if (players[taggedPlayerId] && !players[taggedPlayerId].it) {
            let previousItPlayerId = null;
            for (const id in players) {
                if (players[id].it) {
                    previousItPlayerId = id;
                    break;
                }
            }
            if (previousItPlayerId) {
                players[previousItPlayerId].it = false; // Previous "it" player loses "it" status
                players[taggedPlayerId].it = true; // Tagged player becomes the new "it" player
                itPlayerId = taggedPlayerId; // Update the "it" player ID
                io.emit('playerTagged', { itPlayerId, taggedPlayerId });
            }
        }
    });
});

// Serve index.html file from root directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
