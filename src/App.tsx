import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Button, 
  Container, 
  Flex, 
  Grid, 
  Heading, 
  Input, 
  Text, 
  VStack, 
  HStack, 
  useToast, 
  Badge
} from '@chakra-ui/react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import GameRoom from './components/GameRoom';
import Home from './components/Home';
import PlayerList from './components/PlayerList';
import { GameState, Card as CardType, Pile, Player, Prediction } from './types';
import Confetti from 'react-confetti';

// Connect to the Socket.io server
const SOCKET_SERVER_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3006';

// Home component
interface HomeScreenProps {
  createGame: (username: string) => void;
  joinGame: (gameId: string, username: string) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ createGame, joinGame }) => {
  const [username, setUsername] = useState('');
  const [gameId, setGameId] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      createGame(username.trim());
    }
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && gameId.trim()) {
      joinGame(gameId.trim().toUpperCase(), username.trim());
    }
  };

  return (
    <Box 
      w="100%" 
      maxW="500px" 
      p={6} 
      borderRadius="lg" 
      boxShadow="md" 
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
    >
      <Stack direction="column" align="stretch" style={{ gap: '1.5rem' }}>
        <Heading as="h2" size="lg" textAlign="center" color="teal.500">
          Welcome to High-Low Card Game
        </Heading>
        
        <Text textAlign="center">
          Play with friends on any device with a browser!
        </Text>
        
        <Box>
          <Flex mb={4}>
            <Button 
              flex={1} 
              onClick={() => setActiveTab('create')}
              colorScheme={activeTab === 'create' ? 'teal' : 'gray'}
              mr={2}
            >
              Create Game
            </Button>
            <Button 
              flex={1} 
              onClick={() => setActiveTab('join')}
              colorScheme={activeTab === 'join' ? 'teal' : 'gray'}
            >
              Join Game
            </Button>
          </Flex>
          
          {activeTab === 'create' ? (
            <form onSubmit={handleCreateGame}>
              <Stack direction="column" style={{ gap: '1rem' }}>
                <FormControl isRequired>
                  <FormLabel>Your Name</FormLabel>
                  <Input 
                    placeholder="Enter your name" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                  />
                </FormControl>
                
                <Button 
                  type="submit" 
                  colorScheme="teal" 
                  size="lg" 
                  width="full"
                  disabled={!username.trim()}
                >
                  Create New Game
                </Button>
              </Stack>
            </form>
          ) : (
            <form onSubmit={handleJoinGame}>
              <Stack direction="column" style={{ gap: '1rem' }}>
                <FormControl isRequired>
                  <FormLabel>Your Name</FormLabel>
                  <Input 
                    placeholder="Enter your name" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                  />
                </FormControl>
                
                <FormControl isRequired>
                  <FormLabel>Game Code</FormLabel>
                  <Input 
                    placeholder="Enter game code" 
                    value={gameId} 
                    onChange={(e) => setGameId(e.target.value.toUpperCase())} 
                  />
                </FormControl>
                
                <Button 
                  type="submit" 
                  colorScheme="teal" 
                  size="lg" 
                  width="full"
                  disabled={!username.trim() || !gameId.trim()}
                >
                  Join Game
                </Button>
              </Stack>
            </form>
          )}
        </Box>
      </Stack>
    </Box>
  );
};

// Card component
interface CardProps {
  value: string;
  suit: string;
  faceUp: boolean;
  isSelected?: boolean;
  stackSize?: number;
  onClick?: () => void;
  showLastCard?: boolean;
  isNewlyDealt?: boolean;
  lastPredictionCorrect?: boolean;
  cards?: Array<{value: string, suit: string}>;
  isRevived?: boolean;
}

const Card: React.FC<CardProps> = ({ 
  value, 
  suit, 
  faceUp, 
  isSelected = false,
  stackSize = 1,
  onClick,
  showLastCard = false,
  isNewlyDealt = false,
  lastPredictionCorrect,
  cards = [],
  isRevived = false
}) => {
  // Determine card color based on suit
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const cardColor = isRed ? 'red.500' : 'black';
  
  // Get suit symbol
  const getSuitSymbol = (suit: string) => {
    switch (suit) {
      case 'hearts': return '♥';
      case 'diamonds': return '♦';
      case 'clubs': return '♣';
      case 'spades': return '♠';
      default: return '';
    }
  };
  
  const suitSymbol = getSuitSymbol(suit);
  
  // Determine animation class based on prediction result or revival
  let animationClass = '';
  if (isNewlyDealt) {
    if (lastPredictionCorrect === true) {
      animationClass = 'correct-prediction-animation';
    } else if (lastPredictionCorrect === false) {
      animationClass = 'incorrect-prediction-animation';
    }
  } else if (isRevived) {
    animationClass = 'revived-pile-animation';
  }
  
  return (
    <Box 
      position="relative"
      width="100%"
      paddingTop="140%" // Aspect ratio for cards
      borderRadius="md"
      boxShadow={isSelected ? 'outline' : 'md'}
      borderWidth="1px"
      borderColor={isSelected ? 'teal.500' : 'gray.300'}
      bg="white"
      overflow="visible" // Changed from hidden to visible to allow stacked cards to show
      transition="all 0.2s"
      onClick={onClick}
      cursor={onClick ? 'pointer' : 'default'}
      className={`card-flip ${faceUp || showLastCard ? '' : 'flipped'} ${animationClass}`}
    >
      {/* Stack effect with offset cards - solitaire style (down and to the right) */}
      {cards && cards.length > 1 && (
        <>
          {/* Card outline shadows to indicate stack depth */}
          {Array.from({ length: Math.min(cards.length - 1, 5) }).map((_, i) => (
            <Box
              key={`stack-outline-${i}`}
              position="absolute"
              top={`${(i + 1) * 2}px`}
              left={`${(i + 1) * 2}px`}
              width="100%"
              height="100%"
              borderWidth="1px"
              borderColor="gray.300"
              borderRadius="md"
              zIndex={-2 - i}
              pointerEvents="none"
              bg="white"
              opacity={0.8}
            />
          ))}
        </>
      )}
      
      <Box 
        position="absolute"
        top="0"
        left="0"
        right="0"
        bottom="0"
        className="card-flip-inner"
      >
        {/* Card Front */}
        <Box className="card-front" p={2}>
          <Flex flexDirection="column" justifyContent="space-between" height="100%">
            <Box className="card-corner">
              <Text fontWeight="bold" color={cardColor}>
                {value}
              </Text>
              <Text color={cardColor}>
                {suitSymbol}
              </Text>
            </Box>
            
            <Flex justifyContent="center" alignItems="center" flex="1" className="card-center">
              <Text color={cardColor}>
                {suitSymbol}
              </Text>
            </Flex>
            
            <Box transform="rotate(180deg)" className="card-corner">
              <Text fontWeight="bold" color={cardColor}>
                {value}
              </Text>
              <Text color={cardColor}>
                {suitSymbol}
              </Text>
            </Box>
          </Flex>
        </Box>
        
        {/* Card Back */}
        <Box 
          className="card-back"
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="100%"
          bg="blue.700"
          color="white"
          backgroundImage="repeating-linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.1) 10px, transparent 10px, transparent 20px)"
        >
          <Text fontSize="xl" fontWeight="bold">
            LOCK IN!
          </Text>
        </Box>
      </Box>
      
      {/* Animation overlays for predictions */}
      {isNewlyDealt && (
        <>
          {/* Green halo for correct predictions */}
          {lastPredictionCorrect === true && (
            <Box
              position="absolute"
              top="0"
              left="0"
              right="0"
              bottom="0"
              borderRadius="md"
              className="green-halo"
              zIndex="15"
            />
          )}
          
          {/* Red halo and X for incorrect predictions */}
          {lastPredictionCorrect === false && (
            <>
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                bottom="0"
                borderRadius="md"
                className="red-halo"
                zIndex="15"
              />
              
              {/* LOCK IN text */}
              <Box className="lock-in-text">
                LOCK IN!
              </Box>
              
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                bottom="0"
                display="flex"
                justifyContent="center"
                alignItems="center"
                pointerEvents="none"
                zIndex="16"
              >
                <Box
                  position="relative"
                  width="80%"
                  height="80%"
                >
                  <Box
                    position="absolute"
                    top="50%"
                    left="50%"
                    width="100%"
                    height="5px"
                    bg="red.500"
                    borderRadius="full"
                    transform="translate(-50%, -50%) rotate(45deg)"
                    boxShadow="0 0 10px #e53e3e"
                    className="red-x-line-1"
                  />
                  <Box
                    position="absolute"
                    top="50%"
                    left="50%"
                    width="100%"
                    height="5px"
                    bg="red.500"
                    borderRadius="full"
                    transform="translate(-50%, -50%) rotate(-45deg)"
                    boxShadow="0 0 10px #e53e3e"
                    className="red-x-line-2"
                  />
                </Box>
              </Box>
            </>
          )}
        </>
      )}
      
      {/* Card count indicator */}
      {cards && cards.length > 2 && (
        <Box
          position="absolute"
          bottom="-8px"
          right="-8px"
          borderRadius="full"
          bg="blue.500"
          color="white"
          boxShadow="md"
          px={2}
          py={1}
          fontSize="xs"
          fontWeight="bold"
          zIndex={1}
        >
          +{cards.length - 2}
        </Box>
      )}
    </Box>
  );
};

// Player list component
interface PlayerListSectionProps {
  players: Player[];
  currentPlayerId: string | null;
  currentTurnIndex?: number;
}

const PlayerListSection: React.FC<PlayerListSectionProps> = ({ 
  players, 
  currentPlayerId,
  currentTurnIndex 
}) => {
  return (
    <Stack direction="column" align="stretch" style={{ gap: '0.5rem' }}>
      {players.map((player: Player, index: number) => {
        const isCurrentUser = player.id === currentPlayerId;
        const isCurrentTurn = currentTurnIndex !== undefined && index === currentTurnIndex;
        
        return (
          <Box 
            key={player.id}
            p={2}
            borderRadius="md"
            bg={isCurrentTurn ? 'teal.50' : 'white'}
            borderWidth="1px"
            borderColor={isCurrentTurn ? 'teal.200' : 'gray.200'}
            className={isCurrentTurn ? 'current-turn' : ''}
          >
            <Flex justifyContent="space-between" alignItems="center">
              <Text fontWeight={isCurrentUser ? 'bold' : 'normal'}>
                {player.username} {isCurrentUser && '(You)'}
              </Text>
              
              <Flex>
                {player.isHost && (
                  <Box 
                    bg="purple.100" 
                    color="purple.800" 
                    px={2} 
                    py={1} 
                    borderRadius="md" 
                    fontSize="xs"
                    mr={2}
                  >
                    Host
                  </Box>
                )}
                
                {isCurrentTurn && (
                  <Box 
                    bg="green.100" 
                    color="green.800" 
                    px={2} 
                    py={1} 
                    borderRadius="md" 
                    fontSize="xs"
                  >
                    Current Turn
                  </Box>
                )}
              </Flex>
            </Flex>
          </Box>
        );
      })}
    </Stack>
  );
};

// Game room component
interface GameRoomSectionProps {
  gameState: GameState;
  playerId: string | null;
  username: string;
  isMyTurn: boolean;
  startGame: () => void;
  endGame: () => void;
  selectPile: (pileIndex: number) => void;
  makePrediction: (prediction: Prediction) => void;
  currentPlayer?: Player;
}

const GameRoomSection: React.FC<GameRoomSectionProps> = ({
  gameState,
  playerId,
  username,
  isMyTurn,
  startGame,
  endGame,
  selectPile,
  makePrediction,
  currentPlayer,
}) => {
  const isHost = currentPlayer?.isHost || false;
  const isWaiting = gameState.status === 'waiting';
  const isPlaying = gameState.status === 'playing';
  const isFinished = gameState.status === 'finished';
  const currentPlayerName = gameState.players[gameState.currentPlayerIndex]?.username || '';
  const selectedPileIndex = gameState.currentPileIndex;

  // Handle pile selection
  const handlePileSelect = (index: number) => {
    // If it's not the player's turn or game is not in playing state, do nothing
    if (!isMyTurn || !isPlaying) return;
    
    // If the pile is not active, alert the user
    if (!gameState.piles[index].active) {
      alert('This pile is no longer active.');
      return;
    }
    
    // Allow freely selecting any active pile - no restrictions
    // This enables exploration before committing to a prediction
    
    // Select the pile
    selectPile(index);
  };

  // Handle prediction
  const handlePrediction = (prediction: Prediction) => {
    if (!isMyTurn || !isPlaying || selectedPileIndex === null) return;
    makePrediction(prediction);
  };

  // Render game code for sharing
  const renderGameCode = () => (
    <Box textAlign="center" mb={4}>
      <Text fontSize="sm" color="gray.500">Game Code:</Text>
      <Heading size="md" color="teal.500" className="game-code">{gameState.id}</Heading>
      <Text fontSize="xs" mt={1}>Share this code with friends to join</Text>
    </Box>
  );

  // Render waiting room
  const renderWaitingRoom = () => (
    <Stack direction="column" align="stretch" style={{ gap: '1.5rem' }}>
      {renderGameCode()}
      
      <Box>
        <Heading size="md" mb={2}>Players ({gameState.players.length})</Heading>
        <PlayerListSection players={gameState.players} currentPlayerId={playerId} />
      </Box>
      
      {isHost && (
        <Button 
          colorScheme="teal" 
          size="lg" 
          onClick={startGame}
          disabled={gameState.players.length < 1}
        >
          Start Game
        </Button>
      )}
      
      {!isHost && (
        <Text textAlign="center" color="gray.500">
          Waiting for host to start the game...
        </Text>
      )}
    </Stack>
  );

  // Render card grid
  const renderCardGrid = () => (
    <Box 
      display="grid" 
      gridTemplateColumns="repeat(3, 1fr)" 
      gap={4} 
      mb={6}
      className="card-grid"
    >
      {/* Remaining Cards Counter */}
      <Box 
        gridColumn="1 / -1" 
        textAlign="center" 
        mb={4} 
        p={3} 
        bg="blue.50" 
        borderRadius="md"
        boxShadow="sm"
      >
        <Flex justifyContent="center" alignItems="center">
          <Box 
            bg="blue.700" 
            color="white" 
            borderRadius="md" 
            px={3} 
            py={2} 
            mr={3}
            boxShadow="md"
          >
            <Text fontWeight="bold">Remaining Cards</Text>
          </Box>
          <Text fontSize="2xl" fontWeight="bold" color="blue.700">
            {gameState.remainingCards}
          </Text>
        </Flex>
      </Box>
      
      {gameState.piles.map((pile: any, index: number) => {
        const isPileSelected = selectedPileIndex === index;
        
        return (
          <Box 
            key={index}
            opacity={pile.active ? 1 : 0.7}
            transform={isPileSelected ? 'scale(1.05)' : 'scale(1)'}
            transition="all 0.2s"
            position="relative"
          >
            <Card 
              value={pile.cards[pile.cards.length - 1].value}
              suit={pile.cards[pile.cards.length - 1].suit}
              faceUp={pile.active}
              showLastCard={!pile.active}
              isSelected={isPileSelected}
              stackSize={pile.cards.length}
              onClick={() => handlePileSelect(index)}
              isNewlyDealt={pile.isNewlyDealt}
              lastPredictionCorrect={pile.lastPredictionCorrect}
              cards={pile.cards}
              isRevived={pile.isRevived}
            />
            
            {/* Add red slash for inactive piles */}
            {!pile.active && (
              <Box className="inactive-pile-slash" />
            )}
            
            {/* Add a "Current Pile" indicator when it's selected but not the player's turn */}
            {isPileSelected && pile.active && (
              <Box
                position="absolute"
                top="-10px"
                left="50%"
                transform="translateX(-50%)"
                bg="teal.500"
                color="white"
                px={2}
                py={1}
                borderRadius="md"
                fontSize="xs"
                fontWeight="bold"
                boxShadow="md"
                zIndex={5}
              >
                Current
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );

  // Render prediction controls
  const renderPredictionControls = () => (
    <Box mt={4}>
      <Text mb={2} textAlign="center">Predict the next card:</Text>
      <Flex justifyContent="center" gap={4}>
        <Button 
          colorScheme="red" 
          onClick={() => handlePrediction('low')}
          disabled={!isMyTurn || selectedPileIndex === null}
          className="prediction-button"
        >
          Lower
        </Button>
        <Button 
          colorScheme="gray" 
          onClick={() => handlePrediction('equal')}
          disabled={!isMyTurn || selectedPileIndex === null}
          className="prediction-button"
        >
          Equal
        </Button>
        <Button 
          colorScheme="green" 
          onClick={() => handlePrediction('high')}
          disabled={!isMyTurn || selectedPileIndex === null}
          className="prediction-button"
        >
          Higher
        </Button>
      </Flex>
    </Box>
  );

  // Render game over
  const renderGameOver = () => (
    <Stack direction="column" style={{ gap: '1rem' }}>
      <Heading size="lg" color="teal.500">Game Over!</Heading>
      <Text>
        {gameState.remainingCards === 0 
          ? "Congratulations! You've successfully played through all cards!" 
          : "All piles have been completed."}
      </Text>
      {isHost && (
        <Button colorScheme="teal" onClick={startGame}>
          Play Again
        </Button>
      )}
    </Stack>
  );

  // Render game status bar with End Game button for host
  const renderGameStatusBar = () => (
    <Flex justifyContent="space-between" alignItems="center" mb={6}>
      <Box>
        <Text fontSize="sm" color="gray.500">Playing as</Text>
        <Text fontWeight="bold">{username}</Text>
      </Box>
      
      <Flex direction="column" alignItems="center">
        <Badge 
          colorScheme={isWaiting ? 'yellow' : isPlaying ? 'green' : 'purple'} 
          p={2} 
          borderRadius="md"
          mb={2}
        >
          {isWaiting ? 'Waiting for Players' : isPlaying ? 'Game in Progress' : 'Game Over'}
        </Badge>
        
        {isHost && isPlaying && (
          <Button 
            size="sm" 
            colorScheme="red" 
            onClick={endGame}
            mt={1}
          >
            End Game
          </Button>
        )}
      </Flex>
      
      <Box textAlign="right">
        <Text fontSize="sm" color="gray.500">Current Turn</Text>
        <Text fontWeight="bold">
          {currentPlayerName} {currentPlayerName === username ? '(You)' : ''}
        </Text>
      </Box>
    </Flex>
  );

  return (
    <Box 
      w="100%" 
      maxW="800px" 
      p={6} 
      borderRadius="lg" 
      boxShadow="md" 
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
    >
      {/* Game Status Bar with End Game button */}
      {renderGameStatusBar()}

      {/* Game Content */}
      {isWaiting && renderWaitingRoom()}
      
      {isPlaying && (
        <>
          {renderCardGrid()}
          {renderPredictionControls()}
          
          <Box mt={6}>
            <Heading size="sm" mb={2}>Players</Heading>
            <PlayerListSection 
              players={gameState.players} 
              currentPlayerId={playerId}
              currentTurnIndex={gameState.currentPlayerIndex}
            />
          </Box>
        </>
      )}
      
      {isFinished && renderGameOver()}
    </Box>
  );
};

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [gameId, setGameId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showGameLost, setShowGameLost] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const toast = useToast();

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);

    // Clean up on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Game state updates
    socket.on('updateGame', (updatedGame: GameState) => {
      setGameState(updatedGame);
    });

    // Game created event
    socket.on('gameCreated', ({ gameId, playerId }) => {
      setGameId(gameId);
      setPlayerId(playerId);
    });

    // Game joined event
    socket.on('gameJoined', ({ gameId, playerId }) => {
      setGameId(gameId);
      setPlayerId(playerId);
    });

    // Pile revived event
    socket.on('pileRevived', ({ pileIndex }) => {
      // Show a notification or animation when a pile is revived
      if (gameState && gameState.piles[pileIndex]) {
        // Create a temporary copy of the game state
        const updatedGameState = { ...gameState };
        
        // Add a special flag to the revived pile to trigger animation
        updatedGameState.piles[pileIndex] = {
          ...updatedGameState.piles[pileIndex],
          isRevived: true
        };
        
        // Update the game state to show the revival animation
        setGameState(updatedGameState);
        
        // Remove the revival flag after animation completes
        setTimeout(() => {
          if (gameState) {
            const resetGameState = { ...gameState };
            if (resetGameState.piles[pileIndex]) {
              resetGameState.piles[pileIndex].isRevived = false;
              setGameState(resetGameState);
            }
          }
        }, 2500); // 2.5 seconds for animation
      }
    });

    socket.on('gameOver', (data) => {
      setGameState(data.gameState);
      
      // Check if game was won (no more cards) or lost (all piles dead)
      if (data.gameState.remainingCards === 0) {
        setShowConfetti(true);
        toast({
          title: "CONGRATULATIONS!",
          description: "YOU WERE LOCKED IN!",
          status: "success",
          duration: 5000,
          isClosable: true,
          position: "top"
        });
        
        // Hide confetti after 8 seconds
        setTimeout(() => {
          setShowConfetti(false);
        }, 8000);
      } else if (data.gameState.piles.every(pile => !pile.active)) {
        setShowGameLost(true);
        toast({
          title: "LOSER!",
          description: "LOCK IN!",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "top"
        });
        
        // Hide game lost animation after 5 seconds
        setTimeout(() => {
          setShowGameLost(false);
        }, 5000);
      }
    });

    // Error handling
    socket.on('error', (errorMessage: string) => {
      alert(`Error: ${errorMessage}`);
    });

    return () => {
      socket.off('updateGame');
      socket.off('gameCreated');
      socket.off('gameJoined');
      socket.off('pileRevived');
      socket.off('gameOver');
      socket.off('error');
    };
  }, [socket, gameState, toast]);

  // Create a new game
  const createGame = (username: string) => {
    if (!socket) return;
    setUsername(username);
    socket.emit('createGame', username);
  };

  // Join an existing game
  const joinGame = (gameId: string, username: string) => {
    if (!socket) return;
    setUsername(username);
    socket.emit('joinGame', { gameId, username });
  };

  // Start the game
  const startGame = () => {
    if (!socket || !gameId) return;
    socket.emit('startGame', gameId);
  };

  // End the game
  const endGame = () => {
    if (!socket || !gameId) return;
    socket.emit('endGame', gameId);
    
    // Reset local state to return to landing page
    setGameState(null);
    setPlayerId(null);
    setGameId(null);
  };

  // Select a pile
  const selectPile = (pileIndex: number) => {
    if (!socket || !gameId) return;
    socket.emit('selectPile', { gameId, pileIndex });
  };

  // Make a prediction
  const makePrediction = (prediction: Prediction) => {
    if (!socket || !gameId) return;
    socket.emit('makePrediction', { gameId, prediction });
  };

  // Get current player
  const getCurrentPlayer = (): Player | undefined => {
    if (!gameState || !playerId) return undefined;
    return gameState.players.find((player: Player) => player.id === playerId);
  };

  // Check if it's the current user's turn
  const isMyTurn = (): boolean => {
    if (!gameState || !playerId) return false;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer?.id === playerId;
  };

  return (
    <Box minH="100vh" bg="gray.50" p={3}>
      {showConfetti && (
        <Confetti
          width={windowDimensions.width}
          height={windowDimensions.height}
          recycle={true}
          numberOfPieces={200}
        />
      )}
      
      {showGameLost && (
        <Box 
          position="fixed"
          top="0"
          left="0"
          right="0"
          bottom="0"
          bg="rgba(255, 0, 0, 0.3)"
          zIndex="10"
          pointerEvents="none"
          className="game-lost-animation"
        >
          <Flex 
            height="100%" 
            justifyContent="center" 
            alignItems="center"
          >
            <Text 
              fontSize="6xl" 
              fontWeight="bold" 
              color="white" 
              textShadow="2px 2px 4px rgba(0,0,0,0.5)"
              className="game-lost-text"
            >
              LOSER! LOCK IN!
            </Text>
          </Flex>
        </Box>
      )}
      
      <Stack direction="column" align="center" style={{ gap: '1.5rem' }}>
        <Heading as="h1" size="xl" color="teal.500">
          Kirt's Game
        </Heading>
        
        {!gameState && (
          <HomeScreen 
            createGame={createGame} 
            joinGame={joinGame} 
          />
        )}
        
        {gameState && (
          <GameRoomSection 
            gameState={gameState}
            playerId={playerId}
            username={username}
            isMyTurn={isMyTurn()}
            startGame={startGame}
            endGame={endGame}
            selectPile={selectPile}
            makePrediction={makePrediction}
            currentPlayer={getCurrentPlayer()}
          />
        )}
      </Stack>
    </Box>
  );
}

export default App;
