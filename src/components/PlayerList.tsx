import React from 'react';
import { Box, VStack, Flex, Text, Badge } from '@chakra-ui/react';
import { Player } from '../types';

interface PlayerListProps {
  players: Player[];
  currentPlayerId: string | null;
  currentTurnIndex?: number;
}

const PlayerList: React.FC<PlayerListProps> = ({ 
  players, 
  currentPlayerId,
  currentTurnIndex 
}) => {
  // Reorder players to show current player at the top, followed by upcoming players
  const getOrderedPlayers = () => {
    if (currentTurnIndex === undefined || players.length === 0) {
      return players;
    }
    
    // Create a new array with players in turn order, starting with current player
    const orderedPlayers = [];
    for (let i = 0; i < players.length; i++) {
      const index = (currentTurnIndex + i) % players.length;
      orderedPlayers.push(players[index]);
    }
    
    return orderedPlayers;
  };
  
  // Calculate success rate percentage
  const getSuccessRate = (player: Player) => {
    if (!player.totalPredictions || player.totalPredictions === 0) {
      return 'N/A';
    }
    
    const rate = (player.correctPredictions || 0) / player.totalPredictions * 100;
    return `${Math.round(rate)}%`;
  };
  
  const orderedPlayers = getOrderedPlayers();
  
  return (
    <VStack spacing={2} align="stretch">
      {orderedPlayers.map((player, index) => {
        const isCurrentUser = player.id === currentPlayerId;
        const isCurrentTurn = index === 0 && currentTurnIndex !== undefined;
        const successRate = getSuccessRate(player);
        
        return (
          <Box 
            key={player.id}
            p={2}
            borderRadius="md"
            bg={isCurrentTurn ? 'teal.50' : 'white'}
            borderWidth="1px"
            borderColor={isCurrentTurn ? 'teal.200' : 'gray.200'}
          >
            <Flex justify="space-between" align="center">
              <Flex align="center">
                <Text fontWeight={isCurrentUser ? 'bold' : 'normal'}>
                  {player.username} {isCurrentUser && '(You)'}
                </Text>
                
                <Badge ml={2} colorScheme="blue">
                  {successRate}
                </Badge>
              </Flex>
              
              <Flex>
                {player.isHost && (
                  <Badge colorScheme="purple" mr={2}>
                    Host
                  </Badge>
                )}
                
                {isCurrentTurn && (
                  <Badge colorScheme="green">
                    Current Turn
                  </Badge>
                )}
              </Flex>
            </Flex>
          </Box>
        );
      })}
    </VStack>
  );
};

export default PlayerList; 