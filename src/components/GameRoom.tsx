import React from 'react';
import {
  Box,
  Button,
  Grid,
  HStack,
  VStack,
  Text,
  Heading,
  Badge,
  Flex,
} from '@chakra-ui/react';
import { GameState, Player, Prediction, Card } from '../types';
import CardComponent from './CardComponent';
import PlayerList from './PlayerList';

interface GameRoomProps {
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

const GameRoom: React.FC<GameRoomProps> = ({
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
    if (!isMyTurn || !isPlaying || selectedPileIndex !== null) return;
    if (!gameState.piles[index].active) {
      alert('This pile is no longer active.');
      return;
    }
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
      <Heading size="md" color="teal.500">{gameState.id}</Heading>
      <Text fontSize="xs" mt={1}>Share this code with friends to join</Text>
    </Box>
  );

  // Render waiting room
  const renderWaitingRoom = () => (
    <VStack align="stretch" style={{ gap: '1.5rem' }}>
      {renderGameCode()}
      
      <Box>
        <Text fontWeight="bold" mb={2}>Players:</Text>
        <PlayerList 
          players={gameState.players} 
          currentPlayerId={playerId || ''} 
          currentTurnIndex={isPlaying ? gameState.currentPlayerIndex : undefined} 
        />
      </Box>
      
      {isHost && (
        <Button 
          colorScheme="teal" 
          size="lg" 
          onClick={startGame}
          isDisabled={gameState.players.length < 1}
        >
          Start Game
        </Button>
      )}
    </VStack>
  );

  // Render card grid
  const renderCardGrid = () => (
    <Grid templateColumns="repeat(3, 1fr)" gap={4} mb={6}>
      {gameState.piles.map((pile, index) => (
        <Box 
          key={index}
          onClick={() => handlePileSelect(index)}
          cursor={isMyTurn && isPlaying && pile.active && selectedPileIndex === null ? 'pointer' : 'default'}
          opacity={pile.active ? 1 : 0.5}
          transform={selectedPileIndex === index ? 'scale(1.05)' : 'scale(1)'}
          transition="all 0.2s"
          position="relative"
        >
          <CardComponent 
            card={pile.cards[pile.cards.length - 1]} 
            faceUp={pile.active} 
            isSelected={selectedPileIndex === index}
            stackSize={pile.cards.length}
          />
          
          {pile.cards.length > 1 && (
            <Badge 
              position="absolute" 
              top="-8px" 
              right="-8px" 
              borderRadius="full" 
              bg="teal.500" 
              color="white"
              boxShadow="md"
            >
              {pile.cards.length}
            </Badge>
          )}
        </Box>
      ))}
    </Grid>
  );

  // Render prediction controls
  const renderPredictionControls = () => (
    <Box mt={4}>
      <Text mb={2} textAlign="center">Predict the next card:</Text>
      <HStack justify="center" style={{ gap: '1rem' }}>
        <Button 
          colorScheme="red" 
          onClick={() => handlePrediction('low')}
          isDisabled={!isMyTurn || selectedPileIndex === null}
        >
          Lower
        </Button>
        <Button 
          colorScheme="gray" 
          onClick={() => handlePrediction('equal')}
          isDisabled={!isMyTurn || selectedPileIndex === null}
        >
          Equal
        </Button>
        <Button 
          colorScheme="green" 
          onClick={() => handlePrediction('high')}
          isDisabled={!isMyTurn || selectedPileIndex === null}
        >
          Higher
        </Button>
      </HStack>
    </Box>
  );

  // Render game over
  const renderGameOver = () => (
    <VStack style={{ gap: '1rem' }}>
      <Heading size="lg" color="teal.500">Game Over!</Heading>
      <Text>All piles have been completed.</Text>
      {isHost && (
        <Button 
          colorScheme="teal" 
          onClick={endGame}
        >
          Return to Lobby
        </Button>
      )}
    </VStack>
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
      {/* Game Status */}
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Text fontSize="sm" color="gray.500">Playing as</Text>
          <Text fontWeight="bold">{username}</Text>
        </Box>
        
        <Badge 
          colorScheme={isWaiting ? 'yellow' : isPlaying ? 'green' : 'purple'} 
          p={2} 
          borderRadius="md"
        >
          {isWaiting ? 'Waiting for Players' : isPlaying ? 'Game in Progress' : 'Game Over'}
        </Badge>
        
        <Box textAlign="right">
          <Text fontSize="sm" color="gray.500">Current Turn</Text>
          <Text fontWeight="bold">
            {currentPlayerName} {currentPlayerName === username ? '(You)' : ''}
          </Text>
        </Box>
      </Flex>

      {/* Game Content */}
      {isWaiting && renderWaitingRoom()}
      
      {isPlaying && (
        <>
          {renderCardGrid()}
          {renderPredictionControls()}
          
          <Box mt={6}>
            <Heading size="sm" mb={2}>Players</Heading>
            <PlayerList 
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

export default GameRoom; 