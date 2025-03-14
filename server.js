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

// Store disconnected players temporarily to allow for quick reconnection
let disconnectedPlayers = {};

// Increase timeout for disconnected players to 2 minutes (120 seconds)
const DISCONNECTED_PLAYER_TIMEOUT = 120000;

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
  
  if (prediction === 'higher') {
    return value2 > value1;
  } else if (prediction === 'lower') {
    return value2 < value1;
  } else { // same
    return value2 === value1;
  }
}

// Move to the next active (non-disconnected) player
function moveToNextActivePlayer(game) {
  // Don't reset the current pile anymore
  // game.currentPileIndex = null;
  
  // If there are no players, return
  if (game.players.length === 0) return;
  
  // Start from the next player
  let nextPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  const startIndex = nextPlayerIndex; // Remember where we started
  
  // Find the next non-disconnected player
  while (game.players[nextPlayerIndex].disconnected) {
    // Move to the next player
    nextPlayerIndex = (nextPlayerIndex + 1) % game.players.length;
    
    // If we've checked all players and they're all disconnected, break the loop
    if (nextPlayerIndex === startIndex) {
      console.log(`All players in game ${game.id} are disconnected`);
      break;
    }
  }
  
  // Update the current player index
  game.currentPlayerIndex = nextPlayerIndex;
  
  // Log the player change
  console.log(`Moving to next player: ${game.players[nextPlayerIndex].username} (index: ${nextPlayerIndex})`);
}

// Move to the next active (non-disconnected) player without resetting the current pile
function moveToNextActivePlayerPreservingPile(game) {
  // If there are no players, return
  if (game.players.length === 0) return;
  
  // Start from the next player
  let nextPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
  const startIndex = nextPlayerIndex; // Remember where we started
  
  // Find the next non-disconnected player
  while (game.players[nextPlayerIndex].disconnected) {
    // Move to the next player
    nextPlayerIndex = (nextPlayerIndex + 1) % game.players.length;
    
    // If we've checked all players and they're all disconnected, break the loop
    if (nextPlayerIndex === startIndex) {
      console.log(`All players in game ${game.id} are disconnected`);
      break;
    }
  }
  
  // Update the current player index
  game.currentPlayerIndex = nextPlayerIndex;
  
  // Log the player change
  console.log(`Moving to next player: ${game.players[nextPlayerIndex].username} (index: ${nextPlayerIndex}), preserving pile selection`);
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Check if this is a reconnection
  socket.on('reconnect', ({ username, sessionId }) => {
    console.log(`Reconnection attempt for session ${sessionId} by ${username} with socket ${socket.id}`);
    
    if (!sessionId) {
      console.log(`No session ID provided for reconnection attempt by ${username}`);
      socket.emit('reconnectFailed');
      return;
    }
    
    // Check if this is a recently disconnected player
    if (disconnectedPlayers[sessionId]) {
      console.log(`Found recently disconnected player ${username} with session ${sessionId}`);
      
      const { player, gameId, disconnectedAt } = disconnectedPlayers[sessionId];
      
      // Check if the game still exists
      if (!games[gameId]) {
        console.log(`Game ${gameId} no longer exists for session ${sessionId}`);
        socket.emit('reconnectFailed');
        delete disconnectedPlayers[sessionId];
        return;
      }
      
      // Update the session with the new socket ID
      if (playerSessions[sessionId]) {
        playerSessions[sessionId].socketId = socket.id;
        playerSessions[sessionId].lastActive = Date.now();
      } else {
        // Recreate the session if it was somehow lost
        playerSessions[sessionId] = {
          socketId: socket.id,
          username,
          gameId,
          lastActive: Date.now()
        };
      }
      
      // Add the player back to the game
      const updatedPlayer = {
        ...player,
        id: socket.id, // Update with new socket ID
      };
      
      // Add the player back to the game
      games[gameId].players.push(updatedPlayer);
      
      // Special handling for solo games - make sure the player is host
      if (games[gameId].players.length === 1) {
        console.log(`Solo game detected for ${username}, ensuring player is host`);
        games[gameId].players[0].isHost = true;
        
        // Make sure the current player index is 0
        games[gameId].currentPlayerIndex = 0;
      }
      
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
      
      // Notify other players about the reconnection (not needed for solo games but kept for consistency)
      socket.to(gameId).emit('playerReconnected', { 
        playerId: socket.id,
        username: player.username
      });
      
      // Update the game state for all players
      io.to(gameId).emit('updateGame', games[gameId]);
      
      // Remove from disconnected players since they've reconnected
      delete disconnectedPlayers[sessionId];
      
      console.log(`Player ${username} successfully reconnected to game ${gameId}`);
      return;
    }
    
    // If not in disconnectedPlayers, check regular sessions
    if (!playerSessions[sessionId]) {
      console.log(`Session ${sessionId} not found for ${username}`);
      
      // Try to find the game by username as a last resort
      let foundGame = null;
      let foundGameId = null;
      
      for (const gid in games) {
        const game = games[gid];
        
        // Check if this is an empty game (solo player who disconnected)
        if (game.players.length === 0) {
          // Check if this game was created by this player
          const sessionKeys = Object.keys(playerSessions);
          for (const sid of sessionKeys) {
            if (playerSessions[sid].gameId === gid && playerSessions[sid].username === username) {
              foundGame = game;
              foundGameId = gid;
              break;
            }
          }
          if (foundGame) break;
        }
        
        // Otherwise check for player with same name
        const playerWithSameName = game.players.find(p => p.username === username);
        if (playerWithSameName) {
          foundGame = game;
          foundGameId = gid;
          break;
        }
      }
      
      if (foundGame) {
        console.log(`Found game ${foundGameId} with player ${username}, creating new session`);
        
        // Create a new session
        const newSessionId = generateSessionId();
        playerSessions[newSessionId] = {
          socketId: socket.id,
          username,
          gameId: foundGameId,
          lastActive: Date.now()
        };
        
        // Add player back to the game
        const newPlayer = {
          id: socket.id,
          username,
          isHost: foundGame.players.length === 0, // Make them host if they're the only player
          correctPredictions: 0,
          totalPredictions: 0,
          sessionId: newSessionId
        };
        
        foundGame.players.push(newPlayer);
        
        // If this is a solo game, make sure the current player index is 0
        if (foundGame.players.length === 1) {
          console.log(`Solo game detected for ${username}, ensuring player is host and current player`);
          foundGame.currentPlayerIndex = 0;
        }
        
        // Join the game room
        socket.join(foundGameId);
        
        // Send the updated game state to the reconnected player
        socket.emit('gameJoined', { 
          gameId: foundGameId, 
          playerId: socket.id, 
          sessionId: newSessionId,
          reconnected: true
        });
        
        // Make sure to send the full game state
        socket.emit('updateGame', foundGame);
        
        // Notify other players about the reconnection
        socket.to(foundGameId).emit('playerJoined', { 
          playerId: socket.id,
          username
        });
        
        // Update the game state for all players
        io.to(foundGameId).emit('updateGame', foundGame);
        
        console.log(`Player ${username} added to game ${foundGameId} with new session ${newSessionId}`);
        return;
      }
      
      socket.emit('reconnectFailed');
      return;
    }
    
    const session = playerSessions[sessionId];
    const gameId = session.gameId;
    const oldSocketId = session.socketId;
    
    console.log(`Found session for ${username} in game ${gameId}, old socket: ${oldSocketId}`);
    
    // Update the session with the new socket ID
    playerSessions[sessionId].socketId = socket.id;
    playerSessions[sessionId].lastActive = Date.now();
    
    // If the game exists, try to add the player back
    if (!games[gameId]) {
      console.log(`Game ${gameId} not found for session ${sessionId}`);
      socket.emit('reconnectFailed');
      return;
    }
    
    // First try to find by old socket ID (unlikely since we now remove players on disconnect)
    let playerIndex = games[gameId].players.findIndex(p => p.id === oldSocketId);
    
    // If not found by old socket ID, try to find by session ID
    if (playerIndex === -1) {
      playerIndex = games[gameId].players.findIndex(p => p.sessionId === sessionId);
    }
    
    // If not found by session ID, try to find by username
    if (playerIndex === -1) {
      playerIndex = games[gameId].players.findIndex(p => p.username === username);
    }
    
    if (playerIndex !== -1) {
      // Player still exists in the game (rare case)
      const player = games[gameId].players[playerIndex];
      
      // Update the player's socket ID
      games[gameId].players[playerIndex].id = socket.id;
      
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
      console.log(`Player not found in game ${gameId}, adding them back as a new player`);
      
      // If the player wasn't found but the game exists, they were removed
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
          sessionId
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
      } else {
        console.log(`Game ${gameId} is finished, cannot add player back`);
        socket.emit('reconnectFailed');
        return;
      }
    }
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
      
      // Store the player's session ID before removing them
      const playerSessionId = player.sessionId;
      
      // Store the player data temporarily to allow for quick reconnection
      if (playerSessionId) {
        disconnectedPlayers[playerSessionId] = {
          player: { ...player },
          gameId,
          disconnectedAt: Date.now(),
          playerIndex
        };
        
        console.log(`Stored player ${player.username} data for quick reconnection with timeout ${DISCONNECTED_PLAYER_TIMEOUT}ms`);
        
        // Don't delete the session immediately, let it exist for reconnection
        // We'll clean it up after a timeout if they don't reconnect
        setTimeout(() => {
          // If the player hasn't reconnected after the timeout, clean up their session
          if (disconnectedPlayers[playerSessionId]) {
            console.log(`Player ${player.username} did not reconnect within timeout, cleaning up session`);
            delete disconnectedPlayers[playerSessionId];
            
            // Now delete the session
            Object.keys(playerSessions).forEach(sid => {
              if (sid === playerSessionId) {
                console.log(`Removing session ${sid} for player ${player.username} after timeout`);
                delete playerSessions[sid];
              }
            });
            
            // If this was a solo game and the game still exists but has no players, remove it
            if (games[gameId] && games[gameId].players.length === 0) {
              console.log(`Removing empty game ${gameId} after session timeout`);
              delete games[gameId];
            }
          }
        }, DISCONNECTED_PLAYER_TIMEOUT); // Use the longer timeout
      }
      
      // Remove the player from the game immediately
      game.players.splice(playerIndex, 1);
      
      // If no players left, don't remove the game immediately
      // Instead, keep it around for a while to allow for reconnection
      if (game.players.length === 0) {
        console.log(`No players left in game ${gameId}, but keeping it for potential reconnection`);
        
        // Set a timeout to remove the game if no one reconnects
        setTimeout(() => {
          // Check if the game still exists and still has no players
          if (games[gameId] && games[gameId].players.length === 0) {
            console.log(`No players reconnected to game ${gameId}, removing it`);
            delete games[gameId];
          }
        }, DISCONNECTED_PLAYER_TIMEOUT);
        
        // Leave the socket room
        socket.leave(gameId);
        
        // Return early since there's nothing else to update
        return;
      }
      
      // If the host left, assign a new host
      if (!game.players.some(p => p.isHost)) {
        game.players[0].isHost = true;
        console.log(`Assigned new host in game ${gameId}: ${game.players[0].username}`);
      }
      
      // If it was this player's turn, move to the next player
      if (game.currentPlayerIndex === playerIndex) {
        if (game.status === 'playing') {
          // Use the new function to preserve pile selection
          // Adjust the current player index first since we removed a player
          if (game.currentPlayerIndex >= game.players.length) {
            game.currentPlayerIndex = 0;
          }
        } else {
          game.currentPlayerIndex = 0; // Reset to first player if not playing
        }
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
  
  // Handle disconnections
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Find all games this player is in
    for (const gameId in games) {
      const game = games[gameId];
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        const player = game.players[playerIndex];
        console.log(`Player ${player.username} disconnected from game ${gameId}`);
        
        // Store the player's session ID before removing them
        const playerSessionId = player.sessionId;
        
        // Store the player data temporarily to allow for quick reconnection
        if (playerSessionId) {
          disconnectedPlayers[playerSessionId] = {
            player: { ...player },
            gameId,
            disconnectedAt: Date.now(),
            playerIndex
          };
          
          console.log(`Stored player ${player.username} data for quick reconnection with timeout ${DISCONNECTED_PLAYER_TIMEOUT}ms`);
          
          // Don't delete the session immediately, let it exist for reconnection
          // We'll clean it up after a timeout if they don't reconnect
          setTimeout(() => {
            // If the player hasn't reconnected after the timeout, clean up their session
            if (disconnectedPlayers[playerSessionId]) {
              console.log(`Player ${player.username} did not reconnect within timeout, cleaning up session`);
              delete disconnectedPlayers[playerSessionId];
              
              // Now delete the session
              Object.keys(playerSessions).forEach(sid => {
                if (sid === playerSessionId) {
                  console.log(`Removing session ${sid} for player ${player.username} after timeout`);
                  delete playerSessions[sid];
                }
              });
              
              // If this was a solo game and the game still exists but has no players, remove it
              if (games[gameId] && games[gameId].players.length === 0) {
                console.log(`Removing empty game ${gameId} after session timeout`);
                delete games[gameId];
              }
            }
          }, DISCONNECTED_PLAYER_TIMEOUT); // Use the longer timeout
        }
        
        // Remove the player from the game immediately
        game.players.splice(playerIndex, 1);
        
        // If no players left, don't remove the game immediately
        // Instead, keep it around for a while to allow for reconnection
        if (game.players.length === 0) {
          console.log(`No players left in game ${gameId}, but keeping it for potential reconnection`);
          
          // Set a timeout to remove the game if no one reconnects
          setTimeout(() => {
            // Check if the game still exists and still has no players
            if (games[gameId] && games[gameId].players.length === 0) {
              console.log(`No players reconnected to game ${gameId}, removing it`);
              delete games[gameId];
            }
          }, DISCONNECTED_PLAYER_TIMEOUT);
          
          // Continue to the next game since there's nothing else to update
          continue;
        }
        
        // If the host left, assign a new host
        if (!game.players.some(p => p.isHost)) {
          game.players[0].isHost = true;
          console.log(`Assigned new host in game ${gameId}: ${game.players[0].username}`);
        }
        
        // If it was this player's turn, move to the next player
        if (game.status === 'playing' && game.currentPlayerIndex === playerIndex) {
          console.log(`It was ${player.username}'s turn, moving to next player`);
          // Since we removed the player, adjust the current player index
          if (game.currentPlayerIndex >= game.players.length) {
            game.currentPlayerIndex = 0;
          }
          // Don't reset the current pile
        } else if (game.currentPlayerIndex > playerIndex) {
          // If the current player index is after the removed player, decrement it
          game.currentPlayerIndex--;
        }
        
        // Notify other players about the disconnection
        io.to(gameId).emit('playerLeft', {
          playerId: socket.id,
          username: player.username
        });
        
        // Update the game state for other players
        io.to(gameId).emit('updateGame', game);
      }
    }
  });
  
  // Start the game
  socket.on('startGame', (gameId) => {
    console.log(`Starting game ${gameId}`);
    const game = games[gameId];
    
    if (!game) {
      console.log(`Game ${gameId} not found`);
      socket.emit('error', 'Game not found');
      return;
    }
    
    // Check if the player is the host
    const player = game.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) {
      console.log(`Player ${socket.id} is not the host of game ${gameId}`);
      socket.emit('error', 'Only the host can start the game');
      return;
    }
    
    // Initialize the game
    game.status = 'playing';
    game.deck = shuffleDeck(createDeck());
    game.piles = [];
    game.currentPlayerIndex = 0;
    game.currentPileIndex = null;
    game.remainingCards = 43; // 52 - 9 initial cards
    
    // Create a 3x3 grid of piles (9 piles with 1 card each)
    for (let i = 0; i < 9; i++) {
      const card = game.deck.pop();
      game.piles.push({
        cards: [{
          ...card,
          id: `card-${i}-0`
        }],
        active: true,
        isDead: false
      });
    }
    
    // Notify all players that the game has started
    io.to(gameId).emit('updateGame', game);
    console.log(`Game ${gameId} started with ${game.players.length} players`);
  });
  
  // End the game
  socket.on('endGame', (gameId) => {
    console.log(`Ending game ${gameId}`);
    const game = games[gameId];
    
    if (!game) {
      console.log(`Game ${gameId} not found`);
      socket.emit('error', 'Game not found');
      return;
    }
    
    // Check if the player is the host
    const player = game.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) {
      console.log(`Player ${socket.id} is not the host of game ${gameId}`);
      socket.emit('error', 'Only the host can end the game');
      return;
    }
    
    // End the game
    game.status = 'finished';
    
    // Notify all players that the game has ended
    io.to(gameId).emit('updateGame', game);
    console.log(`Game ${gameId} ended by host`);
  });
  
  // Select a pile
  socket.on('selectPile', ({ gameId, pileIndex }) => {
    const game = games[gameId];
    
    if (!game || game.status !== 'playing') {
      return;
    }
    
    // Check if it's the player's turn
    if (game.players[game.currentPlayerIndex].id !== socket.id) {
      return;
    }
    
    // Check if the pile is active
    if (!game.piles[pileIndex].active) {
      return;
    }
    
    // Set the current pile
    game.currentPileIndex = pileIndex;
    
    // Update the game state
    io.to(gameId).emit('updateGame', game);
  });
  
  // Make a prediction
  socket.on('makePrediction', ({ gameId, prediction }) => {
    const game = games[gameId];
    
    if (!game || game.status !== 'playing') {
      return;
    }
    
    // Check if it's the player's turn
    if (game.players[game.currentPlayerIndex].id !== socket.id) {
      return;
    }
    
    // Check if a pile is selected
    if (game.currentPileIndex === null) {
      return;
    }
    
    const pile = game.piles[game.currentPileIndex];
    const currentCard = pile.cards[pile.cards.length - 1];
    const newCard = {
      ...game.deck.pop(),
      id: `card-${game.currentPileIndex}-${pile.cards.length}`
    };
    
    // Add the new card to the pile
    pile.cards.push(newCard);
    
    // Check if the prediction was correct
    const isCorrect = compareCards(currentCard, newCard, prediction);
    
    // Update player stats
    const playerIndex = game.currentPlayerIndex;
    game.players[playerIndex].totalPredictions++;
    if (isCorrect) {
      game.players[playerIndex].correctPredictions++;
    }
    
    // Mark the pile as newly dealt for animation
    pile.isNewlyDealt = true;
    pile.lastPredictionCorrect = isCorrect;
    
    // If prediction was wrong, mark the pile as inactive
    if (!isCorrect) {
      pile.active = false;
      pile.isDead = true;
    }
    
    // Decrement remaining cards
    game.remainingCards--;
    
    // Check if all piles are inactive
    const allPilesInactive = game.piles.every(p => !p.active);
    
    // Check if the game is over (all piles inactive or deck empty)
    if (allPilesInactive || game.remainingCards === 0) {
      game.status = 'finished';
      
      // Find the player with the highest accuracy
      let highestAccuracy = -1;
      let winner = null;
      
      for (const player of game.players) {
        if (player.totalPredictions > 0) {
          const accuracy = player.correctPredictions / player.totalPredictions;
          if (accuracy > highestAccuracy) {
            highestAccuracy = accuracy;
            winner = player;
          }
        }
      }
      
      game.winner = winner ? winner.username : null;
    } else {
      // Move to the next player, preserving the current pile selection
      moveToNextActivePlayerPreservingPile(game);
    }
    
    // Update the game state
    io.to(gameId).emit('updateGame', game);
    
    // Clear the newly dealt flag after a short delay
    setTimeout(() => {
      if (games[gameId]) {
        games[gameId].piles.forEach(p => {
          p.isNewlyDealt = false;
          p.lastPredictionCorrect = undefined;
        });
        io.to(gameId).emit('updateGame', games[gameId]);
      }
    }, 2000);
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
  
  // Clean up stale disconnected players
  for (const sessionId in disconnectedPlayers) {
    const disconnectedPlayer = disconnectedPlayers[sessionId];
    if (now - disconnectedPlayer.disconnectedAt > DISCONNECTED_PLAYER_TIMEOUT) {
      console.log(`Cleaning up stale disconnected player ${disconnectedPlayer.player.username} with session ${sessionId}`);
      delete disconnectedPlayers[sessionId];
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