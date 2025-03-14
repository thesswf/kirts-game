const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'build')));

// Catch-all route to serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Increase ping timeout and interval settings for better connection stability
  pingTimeout: 120000, // 2 minutes
  pingInterval: 20000, // 20 seconds
});

// Game state
let games = {};
// Player session mapping to handle reconnections
let playerSessions = {};
// Set a longer timeout for inactive sessions (24 hours in milliseconds)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

// Card values from lowest to highest
const cardValues = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const cardSuits = ['hearts', 'diamonds', 'clubs', 'spades'];

// Create a deck of cards
function createDeck() {
  const deck = [];
  for (const suit of cardSuits) {
    for (const value of cardValues) {
      deck.push({ value, suit });
    }
  }
  return deck;
}

// Shuffle deck
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Compare card values
function compareCards(card1, card2, prediction) {
  const value1 = cardValues.indexOf(card1.value);
  const value2 = cardValues.indexOf(card2.value);
  
  if (prediction === 'high') {
    return value2 > value1;
  } else if (prediction === 'low') {
    return value2 < value1;
  } else { // equal
    return value2 === value1;
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Check if this is a reconnection
  socket.on('reconnect', ({ username, sessionId }) => {
    console.log(`Reconnection attempt for session ${sessionId} by ${username}`);
    
    if (sessionId && playerSessions[sessionId]) {
      const session = playerSessions[sessionId];
      const gameId = session.gameId;
      const oldSocketId = session.socketId;
      
      console.log(`Found session for ${username} in game ${gameId}, old socket: ${oldSocketId}`);
      
      // Update the session with the new socket ID
      playerSessions[sessionId].socketId = socket.id;
      playerSessions[sessionId].lastActive = Date.now();
      
      // If the game exists, update the player's socket ID
      if (games[gameId]) {
        // First try to find by old socket ID
        let playerIndex = games[gameId].players.findIndex(p => p.id === oldSocketId);
        
        // If not found by old socket ID, try to find by session ID
        if (playerIndex === -1) {
          playerIndex = games[gameId].players.findIndex(p => p.sessionId === sessionId);
        }
        
        if (playerIndex !== -1) {
          const player = games[gameId].players[playerIndex];
          
          // Update the player's socket ID
          games[gameId].players[playerIndex].id = socket.id;
          
          // If player was marked as disconnected, mark them as reconnected
          if (player.disconnected) {
            games[gameId].players[playerIndex].disconnected = false;
            games[gameId].players[playerIndex].disconnectedAt = null;
          }
          
          // Join the game room
          socket.join(gameId);
          
          // Send the updated game state to the reconnected player
          socket.emit('gameJoined', { 
            gameId, 
            playerId: socket.id, 
            sessionId,
            reconnected: true // Flag to indicate this was a reconnection
          });
          
          // Make sure to send the full game state
          socket.emit('updateGame', games[gameId]);
          
          // Notify other players about the reconnection
          socket.to(gameId).emit('playerReconnected', { 
            playerId: socket.id,
            username: player.username
          });
          
          console.log(`Player ${username} successfully reconnected to game ${gameId}`);
          return;
        } else {
          console.log(`Player not found in game ${gameId} with session ${sessionId}`);
          
          // If the player wasn't found but the game exists, they might have been removed
          // Let's add them back to the game as a new player
          if (games[gameId].status !== 'finished') {
            console.log(`Adding ${username} back to game ${gameId} as a new player`);
            
            // Add the player back to the game
            games[gameId].players.push({
              id: socket.id,
              username,
              isHost: games[gameId].players.length === 0, // Make them host if no players left
              correctPredictions: 0,
              totalPredictions: 0,
              sessionId,
              disconnected: false,
              disconnectedAt: null
            });
            
            // Join the game room
            socket.join(gameId);
            
            // Send the updated game state to the reconnected player
            socket.emit('gameJoined', { 
              gameId, 
              playerId: socket.id, 
              sessionId,
              reconnected: true
            });
            
            // Make sure to send the full game state
            socket.emit('updateGame', games[gameId]);
            
            // Notify other players about the new player
            socket.to(gameId).emit('playerJoined', { 
              playerId: socket.id,
              username
            });
            
            io.to(gameId).emit('updateGame', games[gameId]);
            
            console.log(`Player ${username} added back to game ${gameId}`);
            return;
          }
        }
      } else {
        console.log(`Game ${gameId} not found for session ${sessionId}`);
      }
    }
    
    // If reconnection failed, inform the client
    console.log(`Reconnection failed for session ${sessionId}`);
    socket.emit('reconnectFailed');
  });
  
  // Create a new game
  socket.on('createGame', (username) => {
    const gameId = generateGameId();
    const sessionId = generateSessionId();
    
    games[gameId] = {
      id: gameId,
      players: [{
        id: socket.id, 
        username, 
        isHost: true,
        correctPredictions: 0,
        totalPredictions: 0,
        sessionId, // Store the session ID with the player
        disconnected: false,
        disconnectedAt: null
      }],
      status: 'waiting',
      deck: [],
      piles: [],
      currentPlayerIndex: 0,
      currentPileIndex: null,
      remainingCards: 43, // Track remaining cards (52 - 9 initial cards)
      firstTurnAfterPileDeath: true, // Track if it's the first turn after a pile death
      createdAt: Date.now() // Track when the game was created
    };
    
    // Store the session information
    playerSessions[sessionId] = {
      socketId: socket.id,
      username,
      gameId,
      lastActive: Date.now()
    };
    
    socket.join(gameId);
    socket.emit('gameCreated', { gameId, playerId: socket.id, sessionId });
    io.to(gameId).emit('updateGame', games[gameId]);
  });
  
  // Join an existing game
  socket.on('joinGame', ({ gameId, username }) => {
    const game = games[gameId];
    
    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }
    
    // Allow joining games in progress
    // Only restrict joining finished games
    if (game.status === 'finished') {
      socket.emit('error', 'Game has ended');
      return;
    }
    
    const sessionId = generateSessionId();
    
    game.players.push({ 
      id: socket.id, 
      username, 
      isHost: false,
      correctPredictions: 0,
      totalPredictions: 0,
      sessionId, // Store the session ID with the player
      disconnected: false,
      disconnectedAt: null
    });
    
    // Store the session information
    playerSessions[sessionId] = {
      socketId: socket.id,
      username,
      gameId,
      lastActive: Date.now()
    };
    
    socket.join(gameId);
    socket.emit('gameJoined', { gameId, playerId: socket.id, sessionId });
    
    // Notify other players that someone has joined
    socket.to(gameId).emit('playerJoined', { 
      playerId: socket.id,
      username: username
    });
    
    io.to(gameId).emit('updateGame', game);
  });
  
  // Handle player explicitly leaving a game
  socket.on('leaveGame', ({ gameId }) => {
    const game = games[gameId];
    
    if (!game) {
      return;
    }
    
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    
    if (playerIndex !== -1) {
      const player = game.players[playerIndex];
      console.log(`Player ${player.username} is leaving game ${gameId}`);
      
      // Remove the player from the game immediately
      game.players.splice(playerIndex, 1);
      
      // Clean up the player's session
      Object.keys(playerSessions).forEach(sid => {
        if (playerSessions[sid].socketId === socket.id) {
          console.log(`Removing session ${sid} for player ${player.username}`);
          delete playerSessions[sid];
        }
      });
      
      // If no players left, remove the game
      if (game.players.length === 0) {
        console.log(`No players left in game ${gameId}, removing game`);
        delete games[gameId];
        return;
      }
      
      // If the host left, assign a new host
      if (!game.players.some(p => p.isHost)) {
        game.players[0].isHost = true;
        console.log(`Assigned new host in game ${gameId}: ${game.players[0].username}`);
      }
      
      // If it was this player's turn, move to the next player
      if (game.currentPlayerIndex === playerIndex) {
        game.currentPlayerIndex = game.currentPlayerIndex % game.players.length;
      } else if (game.currentPlayerIndex > playerIndex) {
        game.currentPlayerIndex--;
      }
      
      // Notify other players that this player has left
      io.to(gameId).emit('playerLeft', { 
        playerId: socket.id,
        username: player.username
      });
      io.to(gameId).emit('updateGame', game);
      
      // Leave the socket room
      socket.leave(gameId);
    }
  });
  
  // Rest of the socket event handlers...
});

// Generate a random game ID (3 characters instead of 6)
function generateGameId() {
  // Use uppercase letters and numbers for better readability
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters (I, O, 0, 1)
  let result = '';
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate a random session ID (3 characters instead of 6)
function generateSessionId() {
  // Use uppercase letters and numbers for better readability
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters (I, O, 0, 1)
  let result = '';
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Clean up inactive sessions and games periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean up inactive sessions
  for (const sessionId in playerSessions) {
    const session = playerSessions[sessionId];
    if (now - session.lastActive > SESSION_TIMEOUT) {
      console.log(`Removing inactive session ${sessionId} for ${session.username}`);
      delete playerSessions[sessionId];
    }
  }
  
  // Clean up inactive games (games with no activity for 24 hours)
  for (const gameId in games) {
    const game = games[gameId];
    // Check if all players are disconnected
    const allDisconnected = game.players.every(p => p.disconnected);
    
    if (allDisconnected) {
      // Check if the game has been inactive for too long
      const oldestDisconnect = Math.min(...game.players.map(p => p.disconnectedAt || Infinity));
      if (now - oldestDisconnect > SESSION_TIMEOUT) {
        console.log(`Removing inactive game ${gameId}`);
        delete games[gameId];
        
        // Clean up any sessions associated with this game
        for (const sessionId in playerSessions) {
          if (playerSessions[sessionId].gameId === gameId) {
            delete playerSessions[sessionId];
          }
        }
      }
    }
  }
}, 60 * 60 * 1000); // Run cleanup every hour

// Start the server
const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 