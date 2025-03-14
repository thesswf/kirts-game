import React from 'react';
import { Box, Text, Flex } from '@chakra-ui/react';
import { Card } from '../types';

interface CardComponentProps {
  card: Card;
  faceUp: boolean;
  isSelected?: boolean;
  stackSize?: number;
  onClick?: () => void;
  showLastCard?: boolean;
}

const CardComponent: React.FC<CardComponentProps> = ({ 
  card, 
  faceUp, 
  isSelected = false,
  stackSize = 1,
  onClick,
  showLastCard = false
}) => {
  const { value, suit } = card;
  
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
  
  // Card back design
  const renderCardBack = () => (
    <Flex 
      justify="center" 
      align="center" 
      h="100%" 
      bg="blue.700" 
      color="white"
      backgroundImage="repeating-linear-gradient(45deg, rgba(255,255,255,0.1), rgba(255,255,255,0.1) 10px, transparent 10px, transparent 20px)"
    >
      <Text fontSize="xl" fontWeight="bold">
        LOCK IN!
      </Text>
    </Flex>
  );
  
  // Card front design
  const renderCardFront = () => (
    <Box p={2} h="100%">
      <Flex justify="space-between" direction="column" h="100%">
        <Box>
          <Text fontSize="xl" fontWeight="bold" color={cardColor}>
            {value}
          </Text>
          <Text fontSize="xl" color={cardColor}>
            {suitSymbol}
          </Text>
        </Box>
        
        <Flex justify="center" align="center" flex="1">
          <Text fontSize="4xl" color={cardColor}>
            {suitSymbol}
          </Text>
        </Flex>
        
        <Box transform="rotate(180deg)">
          <Text fontSize="xl" fontWeight="bold" color={cardColor}>
            {value}
          </Text>
          <Text fontSize="xl" color={cardColor}>
            {suitSymbol}
          </Text>
        </Box>
      </Flex>
    </Box>
  );
  
  // Render stacked cards effect
  const renderStackedCards = () => {
    const stackEffects = [];
    
    // Only show stack effect if there are multiple cards
    if (stackSize > 1) {
      // Add shadow cards for stack effect (max 3 visible in stack)
      const visibleStackSize = Math.min(stackSize, 3);
      
      for (let i = 1; i < visibleStackSize; i++) {
        stackEffects.push(
          <Box
            key={`stack-${i}`}
            position="absolute"
            top={`${-3 * i}px`}
            left={`${-3 * i}px`}
            width="100%"
            height="100%"
            bg="white"
            borderWidth="1px"
            borderColor="gray.300"
            borderRadius="md"
            zIndex={-i}
          />
        );
      }
    }
    
    return stackEffects;
  };
  
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
      overflow="hidden"
      transition="all 0.2s"
      onClick={onClick}
      cursor={onClick ? 'pointer' : 'default'}
      className={`card-flip ${faceUp || showLastCard ? '' : 'flipped'}`}
    >
      {renderStackedCards()}
      
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
            <Box>
              <Text fontSize="xl" fontWeight="bold" color={cardColor}>
                {value}
              </Text>
              <Text fontSize="xl" color={cardColor}>
                {suitSymbol}
              </Text>
            </Box>
            
            <Flex justifyContent="center" alignItems="center" flex="1">
              <Text fontSize="4xl" color={cardColor}>
                {suitSymbol}
              </Text>
            </Flex>
            
            <Box transform="rotate(180deg)">
              <Text fontSize="xl" fontWeight="bold" color={cardColor}>
                {value}
              </Text>
              <Text fontSize="xl" color={cardColor}>
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
    </Box>
  );
};

export default CardComponent; 