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
  return (
    <VStack align="stretch" style={{ gap: '0.5rem' }}>
      {players.map((player, index) => {
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
          >
            <Flex justify="space-between" align="center">
              <Text fontWeight={isCurrentUser ? 'bold' : 'normal'}>
                {player.username} {isCurrentUser && '(You)'}
              </Text>
              
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