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
  }
});

// Game state
let games = {};

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
  
  // Create a new game
  socket.on('createGame', (username) => {
    const gameId = generateGameId();
    games[gameId] = {
      id: gameId,
      players: [{id: socket.id, username, isHost: true}],
      status: 'waiting',
      deck: [],
      piles: [],
      currentPlayerIndex: 0,
      currentPileIndex: null,
      remainingCards: 43, // Track remaining cards (52 - 9 initial cards)
      firstTurnAfterPileDeath: true // Track if it's the first turn after a pile death
    };
    
    socket.join(gameId);
    socket.emit('gameCreated', { gameId, playerId: socket.id });
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
    
    game.players.push({ id: socket.id, username, isHost: false });
    socket.join(gameId);
    socket.emit('gameJoined', { gameId, playerId: socket.id });
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
    
    // Randomly select the first player
    game.currentPlayerIndex = Math.floor(Math.random() * game.players.length);
    
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
        // Remove the player
        game.players.splice(playerIndex, 1);
        
        // If no players left, remove the game
        if (game.players.length === 0) {
          delete games[gameId];
          continue;
        }
        
        // If the host left, assign a new host
        if (!game.players.some(p => p.isHost)) {
          game.players[0].isHost = true;
        }
        
        // If it was this player's turn, move to the next player
        if (game.currentPlayerIndex === playerIndex) {
          game.currentPlayerIndex = game.currentPlayerIndex % game.players.length;
        } else if (game.currentPlayerIndex > playerIndex) {
          game.currentPlayerIndex--;
        }
        
        io.to(gameId).emit('playerLeft', { playerId: socket.id });
        io.to(gameId).emit('updateGame', game);
      }
    }
  });
});

// Generate a random game ID
function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Start the server
const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 