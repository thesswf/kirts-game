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
  // Add ping timeout and interval settings to handle disconnections better
  pingTimeout: 60000, // 1 minute
  pingInterval: 25000, // 25 seconds
});

// Game state
let games = {};
// Player session mapping to handle reconnections
let playerSessions = {};

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
    if (sessionId && playerSessions[sessionId]) {
      const session = playerSessions[sessionId];
      const gameId = session.gameId;
      const oldSocketId = session.socketId;
      
      // Update the session with the new socket ID
      playerSessions[sessionId].socketId = socket.id;
      
      // If the game exists, update the player's socket ID
      if (games[gameId]) {
        const playerIndex = games[gameId].players.findIndex(p => p.id === oldSocketId);
        if (playerIndex !== -1) {
          // Update the player's socket ID
          games[gameId].players[playerIndex].id = socket.id;
          
          // Join the game room
          socket.join(gameId);
          
          // Send the updated game state to the reconnected player
          socket.emit('gameJoined', { gameId, playerId: socket.id });
          socket.emit('updateGame', games[gameId]);
          
          console.log(`Player ${username} reconnected to game ${gameId}`);
          return;
        }
      }
    }
    
    // If reconnection failed, inform the client
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
        sessionId // Store the session ID with the player
      }],
      status: 'waiting',
      deck: [],
      piles: [],
      currentPlayerIndex: 0,
      currentPileIndex: null,
      remainingCards: 43, // Track remaining cards (52 - 9 initial cards)
      firstTurnAfterPileDeath: true // Track if it's the first turn after a pile death
    };
    
    // Store the session information
    playerSessions[sessionId] = {
      socketId: socket.id,
      username,
      gameId
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
    
    if (game.status !== 'waiting') {
      socket.emit('error', 'Game already started');
      return;
    }
    
    const sessionId = generateSessionId();
    
    game.players.push({ 
      id: socket.id, 
      username, 
      isHost: false,
      correctPredictions: 0,
      totalPredictions: 0,
      sessionId // Store the session ID with the player
    });
    
    // Store the session information
    playerSessions[sessionId] = {
      socketId: socket.id,
      username,
      gameId
    };
    
    socket.join(gameId);
    socket.emit('gameJoined', { gameId, playerId: socket.id, sessionId });
    io.to(gameId).emit('updateGame', game);
  });
  
  // Start the game
  socket.on('startGame', (gameId) => {
    const game = games[gameId];
    
    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }
    
    // Check if the requester is the host
    const player = game.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) {
      socket.emit('error', 'Only the host can start the game');
      return;
    }
    
    // Initialize the game
    game.status = 'playing';
    game.deck = shuffleDeck(createDeck());
    game.piles = [];
    game.firstTurnAfterPileDeath = true;
    
    // Create 9 initial piles with one card each
    for (let i = 0; i < 9; i++) {
      game.piles.push({
        cards: [game.deck.pop()],
        active: true,
        isNewlyDealt: false,
        lastPredictionCorrect: undefined
      });
    }
    
    // Set remaining cards to 43 (52 total cards - 9 initial pile cards)
    game.remainingCards = 43;
    console.log(`Game ${gameId} started with ${game.remainingCards} remaining cards`);
    
    // Randomly select the first player
    game.currentPlayerIndex = Math.floor(Math.random() * game.players.length);
    
    // Reset player prediction stats when starting a new game
    game.players.forEach(player => {
      player.correctPredictions = 0;
      player.totalPredictions = 0;
    });
    
    io.to(gameId).emit('updateGame', game);
    io.to(gameId).emit('gameStarted', game);
  });
  
  // Select a pile to play
  socket.on('selectPile', ({ gameId, pileIndex }) => {
    const game = games[gameId];
    
    if (!game || game.status !== 'playing') {
      socket.emit('error', 'Invalid game state');
      return;
    }
    
    // Check if it's the player's turn
    if (game.players[game.currentPlayerIndex].id !== socket.id) {
      socket.emit('error', 'Not your turn');
      return;
    }
    
    // Check if the pile is active
    if (!game.piles[pileIndex].active) {
      socket.emit('error', 'Pile is not active');
      return;
    }
    
    // Allow changing selection by simply updating the currentPileIndex
    game.currentPileIndex = pileIndex;
    io.to(gameId).emit('pileSelected', { pileIndex });
    io.to(gameId).emit('updateGame', game);
  });
  
  // Make a prediction (high, equal, low)
  socket.on('makePrediction', ({ gameId, prediction }) => {
    const game = games[gameId];
    
    if (!game || game.status !== 'playing' || game.currentPileIndex === null) {
      socket.emit('error', 'Invalid game state');
      return;
    }
    
    // Check if it's the player's turn
    if (game.players[game.currentPlayerIndex].id !== socket.id) {
      socket.emit('error', 'Not your turn');
      return;
    }
    
    const currentPile = game.piles[game.currentPileIndex];
    const topCard = currentPile.cards[currentPile.cards.length - 1];
    const newCard = game.deck.pop();
    
    // Decrement remaining cards count
    game.remainingCards = Math.max(0, game.remainingCards - 1);
    
    // Check if the prediction is correct
    const isCorrect = compareCards(topCard, newCard, prediction);
    
    // Update player's prediction stats
    const currentPlayer = game.players[game.currentPlayerIndex];
    currentPlayer.totalPredictions = (currentPlayer.totalPredictions || 0) + 1;
    if (isCorrect) {
      currentPlayer.correctPredictions = (currentPlayer.correctPredictions || 0) + 1;
    }
    
    // Always add the new card to the pile first so it's visible
    currentPile.cards.push(newCard);
    
    // Mark the pile as having a newly dealt card and set prediction result immediately
    currentPile.isNewlyDealt = true;
    currentPile.lastPredictionCorrect = isCorrect;
    
    // First emit the prediction result so clients can see the new card
    io.to(gameId).emit('predictionResult', { 
      prediction, 
      newCard, 
      isCorrect, 
      pileIndex: game.currentPileIndex,
      remainingCards: game.remainingCards
    });
    
    // Update game state
    io.to(gameId).emit('updateGame', game);
    
    // Remove the newly dealt flag after a short animation delay
    setTimeout(() => {
      currentPile.isNewlyDealt = false;
      io.to(gameId).emit('updateGame', game);
    }, 2500); // 2.5 second delay for the animation
    
    // If prediction was incorrect, mark the pile as inactive after a short delay
    if (!isCorrect) {
      setTimeout(() => {
        // Mark the pile as inactive
        currentPile.active = false;
        
        // Move to the next player
        game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
        
        // Set firstTurnAfterPileDeath to true since we need to select a new pile
        game.firstTurnAfterPileDeath = true;
        
        // Reset currentPileIndex since this pile is now inactive
        game.currentPileIndex = null;
        
        // Check if the game is over (all piles inactive)
        if (game.piles.every(pile => !pile.active)) {
          game.status = 'finished';
        }
        
        // Update game state again after the delay
        io.to(gameId).emit('updateGame', game);
      }, 2000); // 2 second delay to show the card
    } else {
      // If prediction was correct, move to the next player immediately
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      
      // Since the prediction was correct, we're not in the first turn after a pile death
      game.firstTurnAfterPileDeath = false;
      
      // If prediction was "equal" and correct, revive a dead pile if available
      if (prediction === 'equal') {
        const deadPiles = game.piles.filter(pile => !pile.active);
        if (deadPiles.length > 0) {
          // Revive the first dead pile
          const deadPileIndex = game.piles.findIndex(pile => !pile.active);
          game.piles[deadPileIndex].active = true;
          
          // Emit a special event for the revived pile
          io.to(gameId).emit('pileRevived', { pileIndex: deadPileIndex });
        }
      }
      
      // Note: We're NOT resetting currentPileIndex here, so it stays selected for the next player
      
      // Check if the game is over (all piles inactive)
      if (game.piles.every(pile => !pile.active)) {
        game.status = 'finished';
      }
      
      // Update game state again
      io.to(gameId).emit('updateGame', game);
    }
  });
  
  // End the game and reset to waiting state
  socket.on('endGame', (gameId) => {
    const game = games[gameId];
    
    if (!game) {
      socket.emit('error', 'Game not found');
      return;
    }
    
    // Check if the requester is the host
    const player = game.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) {
      socket.emit('error', 'Only the host can end the game');
      return;
    }
    
    // Reset the game to waiting state
    game.status = 'waiting';
    game.deck = [];
    game.piles = [];
    game.currentPileIndex = null;
    game.remainingCards = 43;
    game.firstTurnAfterPileDeath = true;
    
    console.log(`Game ${gameId} ended and reset with ${game.remainingCards} remaining cards`);
    
    io.to(gameId).emit('gameEnded');
    io.to(gameId).emit('updateGame', game);
  });
  
  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Find games where this player is participating
    for (const gameId in games) {
      const game = games[gameId];
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        const player = game.players[playerIndex];
        
        // Don't immediately remove the player, just mark them as disconnected
        // This allows them to reconnect later
        player.disconnected = true;
        player.disconnectedAt = Date.now();
        
        // After a timeout (5 minutes), remove the player if they haven't reconnected
        setTimeout(() => {
          // Check if the player is still in the game and still disconnected
          const currentGame = games[gameId];
          if (currentGame) {
            const currentPlayerIndex = currentGame.players.findIndex(p => 
              p.sessionId === player.sessionId && p.disconnected);
            
            if (currentPlayerIndex !== -1) {
              console.log(`Removing player ${player.username} from game ${gameId} after timeout`);
              
              // Remove the player
              currentGame.players.splice(currentPlayerIndex, 1);
              
              // If no players left, remove the game
              if (currentGame.players.length === 0) {
                delete games[gameId];
                // Clean up any sessions associated with this game
                for (const sid in playerSessions) {
                  if (playerSessions[sid].gameId === gameId) {
                    delete playerSessions[sid];
                  }
                }
                return;
              }
              
              // If the host left, assign a new host
              if (!currentGame.players.some(p => p.isHost)) {
                currentGame.players[0].isHost = true;
              }
              
              // If it was this player's turn, move to the next player
              if (currentGame.currentPlayerIndex === currentPlayerIndex) {
                currentGame.currentPlayerIndex = currentGame.currentPlayerIndex % currentGame.players.length;
              } else if (currentGame.currentPlayerIndex > currentPlayerIndex) {
                currentGame.currentPlayerIndex--;
              }
              
              io.to(gameId).emit('playerLeft', { playerId: player.id });
              io.to(gameId).emit('updateGame', currentGame);
            }
          }
        }, 5 * 60 * 1000); // 5 minutes
        
        // Notify other players that this player has disconnected
        io.to(gameId).emit('playerDisconnected', { 
          playerId: socket.id,
          username: player.username
        });
        io.to(gameId).emit('updateGame', game);
      }
    }
  });
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

// Start the server
const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 