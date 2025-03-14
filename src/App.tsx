import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Stack,
  FormControl,
  FormLabel, 
  useToast, 
  Badge,
  Spacer,
  IconButton,
  useColorMode,
  useColorModeValue,
  Tooltip
} from '@chakra-ui/react';
import { io, Socket } from 'socket.io-client';
import { SunIcon, MoonIcon } from '@chakra-ui/icons';
import './App.css';
import GameRoom from './components/GameRoom';
import Home from './components/Home';
import PlayerList from './components/PlayerList';
import { GameState, Card as CardType, Pile as PileType, Player as PlayerType } from './types';
import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';

// Extend the base interfaces with additional properties needed for our app
interface ExtendedPile extends PileType {
  isDead?: boolean; // Add this property to fix linter error
}

interface ExtendedGameState extends GameState {
  winner?: PlayerType; // Add this optional property to fix linter error
  piles: ExtendedPile[]; // Override piles with our extended version
}

// Connect to the Socket.io server
const SOCKET_SERVER_URL = process.env.REACT_APP_SOCKET_SERVER || 'https://kirts-game.onrender.com';

// Home component
interface HomeScreenProps {
  createGame: (username: string) => void;
  joinGame: (gameId: string, username: string) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ createGame, joinGame }) => {
  const [username, setUsername] = useState('');
  const [gameId, setGameId] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && !isSubmitting) {
      setIsSubmitting(true);
      console.log('Creating game with username:', username.trim());
      createGame(username.trim());
      
      // Reset submission state after a delay
      setTimeout(() => {
        setIsSubmitting(false);
      }, 2000);
    }
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && gameId.trim() && !isSubmitting) {
      setIsSubmitting(true);
      console.log('Joining game:', gameId.trim().toUpperCase(), 'with username:', username.trim());
      joinGame(gameId.trim().toUpperCase(), username.trim());
      
      // Reset submission state after a delay
      setTimeout(() => {
        setIsSubmitting(false);
      }, 2000);
    }
  };
  
  // Direct button handler for iOS compatibility
  const handleCreateGameButton = () => {
    if (username.trim() && !isSubmitting) {
      setIsSubmitting(true);
      console.log('Creating game with username (button):', username.trim());
      createGame(username.trim());
      
      // Reset submission state after a delay
      setTimeout(() => {
        setIsSubmitting(false);
      }, 2000);
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
                  disabled={!username.trim() || isSubmitting}
                  isLoading={isSubmitting}
                  loadingText="Creating..."
                  onClick={handleCreateGameButton} // Add direct click handler for iOS
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
                  disabled={!username.trim() || !gameId.trim() || isSubmitting}
                  isLoading={isSubmitting}
                  loadingText="Joining..."
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
  
  // Generate the appropriate number of suit symbols based on card value
  const getCardCenterContent = () => {
    // For face cards (J, Q, K) and Ace, show a single large symbol
    if (['J', 'Q', 'K', 'A'].includes(value)) {
      return (
        <Text fontSize="xl" color={cardColor}>
          {value === 'A' ? suitSymbol : value}
        </Text>
      );
    }
    
    // For number cards, show the appropriate number of suit symbols
    const count = value === '10' ? 10 : parseInt(value);
    
    // Use a more compact layout with traditional playing card arrangements
    return (
      <Box position="relative" width="100%" height="100%">
        {/* Render suit symbols based on card value */}
        {Array.from({ length: count }).map((_, i) => {
          // Calculate positions based on traditional playing card layouts
          let top, left;
          
          switch (count) {
            case 2:
              // Two symbols: top and bottom
              top = i === 0 ? '15%' : '75%';
              left = '50%';
              break;
            case 3:
              // Three symbols: top, middle, bottom
              top = i === 0 ? '15%' : i === 1 ? '50%' : '75%';
              left = '50%';
              break;
            case 4:
              // Four symbols: corners
              top = i < 2 ? '15%' : '75%';
              left = i % 2 === 0 ? '30%' : '70%';
              break;
            case 5:
              // Five symbols: corners + center
              if (i === 4) {
                top = '50%';
                left = '50%';
              } else {
                top = i < 2 ? '15%' : '75%';
                left = i % 2 === 0 ? '30%' : '70%';
              }
              break;
            case 6:
              // Six symbols: 2 columns of 3
              top = i < 2 ? '15%' : i < 4 ? '50%' : '75%';
              left = i % 2 === 0 ? '30%' : '70%';
              break;
            case 7:
              // Seven symbols: 2 columns of 3 + 1 in middle
              if (i === 6) {
                top = '50%';
                left = '50%';
              } else {
                top = i < 2 ? '15%' : i < 4 ? '40%' : '65%';
                left = i % 2 === 0 ? '30%' : '70%';
              }
              break;
            case 8:
              // Eight symbols: 2 columns of 4
              top = i < 2 ? '15%' : i < 4 ? '38%' : i < 6 ? '62%' : '85%';
              left = i % 2 === 0 ? '30%' : '70%';
              break;
            case 9:
              // Nine symbols: 3 columns of 3
              top = i < 3 ? '15%' : i < 6 ? '50%' : '85%';
              left = i % 3 === 0 ? '25%' : i % 3 === 1 ? '50%' : '75%';
              break;
            case 10:
              // Ten symbols: 3 columns of 4 (with middle row offset)
              if (i < 4) {
                // Top row
                top = '15%';
                left = i === 0 ? '25%' : i === 1 ? '50%' : i === 2 ? '75%' : '50%';
              } else if (i < 8) {
                // Middle rows (offset)
                top = i < 6 ? '38%' : '62%';
                left = i % 2 === 0 ? '30%' : '70%';
              } else {
                // Bottom row
                top = '85%';
                left = i === 8 ? '25%' : '75%';
              }
              break;
            default:
              top = '50%';
              left = '50%';
          }
          
          return (
            <Box
              key={i}
              position="absolute"
              top={top}
              left={left}
              transform="translate(-50%, -50%)"
              fontSize={count > 7 ? '2xs' : 'xs'}
            >
              <Text color={cardColor}>
                {suitSymbol}
              </Text>
            </Box>
          );
        })}
      </Box>
    );
  };
  
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
              {getCardCenterContent()}
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
  players: PlayerType[];
  currentPlayerId: string | null;
  currentTurnIndex?: number;
}

const PlayerListSection: React.FC<PlayerListSectionProps> = ({ 
  players, 
  currentPlayerId,
  currentTurnIndex 
}) => {
  // Sort players to put the current player at the top
  const sortedPlayers = [...players].sort((a, b) => {
    // If player a is the current turn player, they should come first
    if (players.indexOf(a) === currentTurnIndex) return -1;
    // If player b is the current turn player, they should come first
    if (players.indexOf(b) === currentTurnIndex) return 1;
    // Otherwise maintain original order
    return players.indexOf(a) - players.indexOf(b);
  });

  return (
    <Stack direction="column" align="stretch" style={{ gap: '0.5rem' }}>
      {sortedPlayers.map((player: PlayerType, index: number) => {
        const isCurrentUser = player.id === currentPlayerId;
        const isCurrentTurn = players.indexOf(player) === currentTurnIndex;
        
        // Calculate accuracy percentage
        const accuracyPercentage = player.totalPredictions && player.totalPredictions > 0
          ? Math.round((player.correctPredictions || 0) / player.totalPredictions * 100)
          : 0;
        
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
                {/* Accuracy percentage */}
                {player.totalPredictions && player.totalPredictions > 0 && (
                  <Box 
                    bg="blue.100" 
                    color="blue.800" 
                    px={2} 
                    py={1} 
                    borderRadius="md" 
                    fontSize="xs"
                    mr={2}
                  >
                    {accuracyPercentage}% Accuracy
                  </Box>
                )}
                
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
  gameState: ExtendedGameState;
  playerId: string | null;
  username: string;
  isMyTurn: boolean;
  startGame: () => void;
  endGame: () => void;
  exitToLobby: () => void;
  selectPile: (pileIndex: number) => void;
  makePrediction: (prediction: Prediction) => void;
  currentPlayer?: PlayerType;
  showDeathAnimation: boolean;
}

const GameRoomSection: React.FC<GameRoomSectionProps> = ({
  gameState,
  playerId,
  username,
  isMyTurn,
  startGame,
  endGame,
  exitToLobby,
  selectPile,
  makePrediction,
  currentPlayer,
  showDeathAnimation
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
        
        {/* Always show game code for easy sharing */}
        <Box textAlign="center" mb={2}>
          <Text fontSize="sm" color="gray.500">Game Code:</Text>
          <Heading size="md" color="teal.500" className="game-code">{gameState.id}</Heading>
        </Box>
        
        <Flex gap={2}>
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
          
          <Button 
            size="sm" 
            colorScheme="gray" 
            onClick={exitToLobby}
            mt={1}
          >
            Exit to Lobby
          </Button>
        </Flex>
      </Flex>
      
      <Box textAlign="right">
        <Text fontSize="sm" color="gray.500">Current Turn</Text>
        <Text fontWeight="bold">
          {currentPlayerName} {currentPlayerName === username ? '(You)' : ''}
        </Text>
      </Box>
    </Flex>
  );

  // Render waiting room
  const renderWaitingRoom = () => (
    <Stack direction="column" align="stretch" style={{ gap: '1.5rem' }}>
      {/* Game code is now shown in the status bar, so we don't need it here */}
      
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
      {/* Game Code Display is now in the status bar */}
      
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
          onClick={() => handlePrediction('lower')}
          disabled={!isMyTurn || selectedPileIndex === null}
          className="prediction-button"
        >
          Lower
        </Button>
        <Button 
          colorScheme="gray" 
          onClick={() => handlePrediction('same')}
          disabled={!isMyTurn || selectedPileIndex === null}
          className="prediction-button"
        >
          Same
        </Button>
        <Button 
          colorScheme="green" 
          onClick={() => handlePrediction('higher')}
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
      {gameState.remainingCards === 0 ? (
        <>
          <Heading size="lg" color="teal.500">Game Over!</Heading>
          <Text>Congratulations! You've successfully played through all cards!</Text>
        </>
      ) : (
        <>
          <Heading size="lg" color="red.500" fontSize="4xl" textAlign="center">LOSER! LOCK IN!</Heading>
          <Text textAlign="center" fontSize="lg" fontWeight="bold">
            Remaining Cards: {gameState.remainingCards}
          </Text>
        </>
      )}
      
      {/* Player Stats */}
      <Box mt={4}>
        <Heading size="md" mb={2}>Player Stats</Heading>
        <PlayerListSection 
          players={gameState.players} 
          currentPlayerId={playerId}
          currentTurnIndex={gameState.currentPlayerIndex}
        />
      </Box>
      
      {isHost && (
        <Button colorScheme="teal" onClick={startGame} mt={4}>
          Play Again
        </Button>
      )}
    </Stack>
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

type Prediction = 'higher' | 'lower' | 'same';

interface NotificationState {
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
}

function App() {
  const [username, setUsername] = useState('');
  const [gameId, setGameId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [gameState, setGameState] = useState<ExtendedGameState | null>(null);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDeathAnimation, setShowDeathAnimation] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();
  const { colorMode, toggleColorMode } = useColorMode();
  const toast = useToast();

  // Initialize socket connection
  const socket = useMemo(() => {
    const newSocket = io(SOCKET_SERVER_URL, {
      reconnectionAttempts: 10,
      timeout: 20000,
      transports: ['websocket', 'polling']
    });
    
    // Save the socket instance for cleanup
    return newSocket;
  }, []);

  // Handle socket connection and reconnection
  useEffect(() => {
    // Check for saved session on connection
    const handleConnect = () => {
      console.log('Connected to server');
      
      // Check if we have a saved session
      const savedSession = localStorage.getItem('cardGameSession');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          if (session.username && session.sessionId && session.gameId) {
            console.log('Found saved session, attempting to reconnect:', session);
            setNotification({
              message: `Reconnecting to game as ${session.username}...`,
              type: 'info'
            });
            
            // Attempt to reconnect with the saved session
            socket.emit('reconnect', {
              username: session.username,
              sessionId: session.sessionId
            });
          }
        } catch (error) {
          console.error('Error parsing saved session:', error);
          localStorage.removeItem('cardGameSession');
        }
      }
    };

    // Handle successful reconnection
    const handleGameJoined = (data: any) => {
      console.log('Game joined:', data);
      setGameId(data.gameId);
      setPlayerId(data.playerId);
      setSessionId(data.sessionId);
      
      // Save session data to localStorage
      const sessionData = {
        username: username,
        sessionId: data.sessionId,
        gameId: data.gameId
      };
      localStorage.setItem('cardGameSession', JSON.stringify(sessionData));
      
      if (data.reconnected) {
        setNotification({
          message: `Successfully reconnected to game!`,
          type: 'success'
        });
      }
    };
    
    // Handle reconnection failure
    const handleReconnectFailed = () => {
      console.log('Reconnection failed');
      setNotification({
        message: 'Failed to reconnect to game. Please join again.',
        type: 'error'
      });
      localStorage.removeItem('cardGameSession');
      setGameId('');
      setPlayerId('');
      setSessionId('');
      setGameState(null);
    };

    // Set up event listeners
    socket.on('connect', handleConnect);
    socket.on('gameJoined', handleGameJoined);
    socket.on('gameCreated', handleGameJoined);
    socket.on('reconnectFailed', handleReconnectFailed);
    
    // Handle errors
    socket.on('error', (error: string) => {
      console.error('Socket error:', error);
      setNotification({
        message: error,
        type: 'error'
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setNotification({
        message: 'Disconnected from server. Attempting to reconnect...',
        type: 'warning'
      });
    });

    // Cleanup function
    return () => {
      socket.off('connect', handleConnect);
      socket.off('gameJoined', handleGameJoined);
      socket.off('gameCreated', handleGameJoined);
      socket.off('reconnectFailed', handleReconnectFailed);
      socket.off('error');
      socket.off('disconnect');
    };
  }, [socket, username]);

  // Handle game updates
  useEffect(() => {
    const handleUpdateGame = (game: ExtendedGameState) => {
      console.log('Game updated:', game);
      setGameState(game);
      
      // Check if all piles are dead
      const allPilesDead = game.piles.length > 0 && 
        game.piles.every(pile => pile.isDead);
      
      if (allPilesDead && !showDeathAnimation) {
        setShowDeathAnimation(true);
        setTimeout(() => setShowDeathAnimation(false), 2000);
      }
      
      // Check if game is won
      if (game.status === 'finished' && game.winner) {
        setShowConfetti(true);
      }
    };
    
    const handlePlayerJoined = (data: { playerId: string, username: string }) => {
      setNotification({
        message: `${data.username} joined the game`,
        type: 'info'
      });
    };
    
    const handlePlayerLeft = (data: { playerId: string, username: string }) => {
      setNotification({
        message: `${data.username} left the game`,
        type: 'info'
      });
    };
    
    const handlePlayerReconnected = (data: { playerId: string, username: string }) => {
      setNotification({
        message: `${data.username} reconnected to the game`,
        type: 'success'
      });
    };

    socket.on('updateGame', handleUpdateGame);
    socket.on('playerJoined', handlePlayerJoined);
    socket.on('playerLeft', handlePlayerLeft);
    socket.on('playerReconnected', handlePlayerReconnected);
    
    return () => {
      socket.off('updateGame', handleUpdateGame);
      socket.off('playerJoined', handlePlayerJoined);
      socket.off('playerLeft', handlePlayerLeft);
      socket.off('playerReconnected', handlePlayerReconnected);
    };
  }, [socket, gameId, showDeathAnimation]);

  // Display notifications
  useEffect(() => {
    if (notification) {
      toast({
        title: notification.message,
        status: notification.type,
        duration: 3000,
        isClosable: true,
        position: 'top'
      });
      
      // Clear notification after it's displayed
      setTimeout(() => setNotification(null), 3000);
    }
  }, [notification, toast]);

  // Create a new game
  const createGame = (username: string) => {
    setUsername(username);
    socket.emit('createGame', username);
  };

  // Join an existing game
  const joinGame = (gameId: string, username: string) => {
    setUsername(username);
    socket.emit('joinGame', { gameId, username });
  };

  // Handle leaving the game
  const handleExitToLobby = () => {
    if (gameId) {
      socket.emit('leaveGame', { gameId });
      localStorage.removeItem('cardGameSession');
      setGameId('');
      setPlayerId('');
      setSessionId('');
      setUsername('');
      setGameState(null);
    }
  };

  // Check if it's the current user's turn
  const isMyTurn = (): boolean => {
    if (!gameState || !playerId) return false;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    return currentPlayer?.id === playerId;
  };

  // Get current player
  const getCurrentPlayer = (): PlayerType | undefined => {
    if (!gameState || !playerId) return undefined;
    return gameState.players.find((player: PlayerType) => player.id === playerId);
  };

  // Start the game
  const startGame = () => {
    if (!gameId) return;
    socket.emit('startGame', gameId);
  };

  // End the game
  const endGame = () => {
    if (!gameId) return;
    socket.emit('endGame', gameId);
  };

  // Select a pile
  const selectPile = (pileIndex: number) => {
    if (!gameId) return;
    socket.emit('selectPile', { gameId, pileIndex });
  };

  // Make a prediction
  const makePrediction = (prediction: Prediction) => {
    if (!gameId) return;
    socket.emit('makePrediction', { gameId, prediction });
  };

  return (
    <Container maxW="container.lg" centerContent py={4}>
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
      
      <Flex w="100%" justifyContent="space-between" alignItems="center" mb={4}>
        <Heading as="h1" size="xl" color={useColorModeValue('blue.600', 'blue.300')}>
          Kirt's Card Game
        </Heading>
        <IconButton
          aria-label="Toggle color mode"
          icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
          onClick={toggleColorMode}
          variant="ghost"
        />
      </Flex>
      
      {errorMessage && (
        <Box w="100%" p={3} mb={4} bg="red.100" color="red.800" borderRadius="md">
          {errorMessage}
        </Box>
      )}
      
      <Box w="100%">
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
            exitToLobby={handleExitToLobby}
            selectPile={selectPile}
            makePrediction={makePrediction}
            currentPlayer={getCurrentPlayer()}
            showDeathAnimation={showDeathAnimation}
          />
        )}
      </Box>
    </Container>
  );
}

export default App;
