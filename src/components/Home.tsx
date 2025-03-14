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
  Flex
} from '@chakra-ui/react';

interface HomeProps {
  createGame: (username: string) => void;
  joinGame: (gameId: string, username: string) => void;
}

const Home: React.FC<HomeProps> = ({ createGame, joinGame }) => {
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
      <VStack align="stretch" style={{ gap: '1.5rem' }}>
        <Heading as="h2" size="lg" textAlign="center" color="teal.500">
          Welcome to Kirt's Favorite Game
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
              <VStack style={{ gap: '1rem' }}>
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
                  isDisabled={!username.trim()}
                >
                  Create New Game
                </Button>
              </VStack>
            </form>
          ) : (
            <form onSubmit={handleJoinGame}>
              <VStack style={{ gap: '1rem' }}>
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
                  isDisabled={!username.trim() || !gameId.trim()}
                >
                  Join Game
                </Button>
              </VStack>
            </form>
          )}
        </Box>
      </VStack>
    </Box>
  );
};

export default Home; 