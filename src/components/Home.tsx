import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  Flex,
  SimpleGrid,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter
} from '@chakra-ui/react';

interface HomeProps {
  createGame: (username: string) => void;
  joinGame: (gameId: string, username: string) => void;
}

const Home: React.FC<HomeProps> = ({ createGame, joinGame }) => {
  const [username, setUsername] = useState('');
  const [gameId, setGameId] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [showJoinGame, setShowJoinGame] = useState(false);
  const [gameCode, setGameCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setIsCreating(true);
      createGame(username.trim());
    }
  };

  const handleJoinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && gameId.trim()) {
      setIsJoining(true);
      joinGame(gameId.trim().toUpperCase(), username.trim());
    }
  };

  return (
    <Box 
      w="100%" 
      maxW="500px" 
      p={3} 
      borderRadius="lg" 
      boxShadow="md" 
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
    >
      <VStack spacing={3} align="stretch">
        <Heading textAlign="center" size="lg" mb={1}>Kirt's Game</Heading>
        
        <Text textAlign="center" fontSize="sm">
          Play with friends on any device with a browser!
        </Text>
        
        <FormControl isRequired>
          <FormLabel htmlFor="username" fontSize="sm">Your Name</FormLabel>
          <Input 
            id="username" 
            placeholder="Enter your name" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)}
            size="sm"
          />
        </FormControl>
        
        <SimpleGrid columns={2} spacing={2}>
          <Button 
            colorScheme="blue" 
            onClick={handleCreateGame}
            isLoading={isCreating}
            size="sm"
          >
            Create Game
          </Button>
          <Button 
            colorScheme="green" 
            onClick={() => setShowJoinGame(true)}
            size="sm"
          >
            Join Game
          </Button>
        </SimpleGrid>
        
        <Modal isOpen={showJoinGame} onClose={() => setShowJoinGame(false)}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Join Game</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={4}>
              <FormControl>
                <FormLabel fontSize="sm">Game Code</FormLabel>
                <Input 
                  placeholder="Enter game code" 
                  value={gameCode} 
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  size="sm"
                />
              </FormControl>
            </ModalBody>
            <ModalFooter>
              <Button 
                colorScheme="blue" 
                mr={3} 
                onClick={handleJoinGame}
                isLoading={isJoining}
                size="sm"
              >
                Join
              </Button>
              <Button onClick={() => setShowJoinGame(false)} size="sm">Cancel</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </VStack>
    </Box>
  );
};

export default Home; 