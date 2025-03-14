# High-Low Card Game

A multiplayer card game where players predict if the next card will be higher, lower, or equal to the current card.

## Game Rules

1. The game starts with a 3x3 grid of random cards face up.
2. Players take turns selecting a pile and predicting whether the next card will be higher, lower, or equal to the top card.
3. If the prediction is correct, the card is added to the pile and the next player takes their turn.
4. If the prediction is incorrect, the pile is flipped over (becomes inactive) and the next player must choose a different pile.
5. The game continues until all piles are inactive.

## Features

- Real-time multiplayer gameplay
- Mobile-friendly design
- Game lobby with shareable game codes
- Turn-based gameplay with visual indicators
- Card animations and visual feedback

## Technologies Used

- React with TypeScript
- Socket.io for real-time communication
- Chakra UI for styling
- Express.js for the server

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
cd card-game
npm install
```

### Running Locally

To run the game locally:

```bash
npm run dev
```

This will start both the client and server:
- Client: http://localhost:3000
- Server: http://localhost:3001

## Deployment

### Deploying to Render.com (Free Tier)

1. Create a new account on [Render](https://render.com/) if you don't have one.

2. Create a new Web Service:
   - Connect your GitHub repository
   - Set the build command: `npm install && npm run build`
   - Set the start command: `node server.js`
   - Choose the free plan

3. Set environment variables:
   - `NODE_ENV=production`

4. Deploy the service

### Deploying to Heroku

1. Create a new account on [Heroku](https://heroku.com/) if you don't have one.

2. Install the Heroku CLI and login:
```bash
npm install -g heroku
heroku login
```

3. Create a new Heroku app:
```bash
heroku create your-card-game-name
```

4. Add a Procfile to the root directory:
```
web: node server.js
```

5. Deploy to Heroku:
```bash
git push heroku main
```

## Playing the Game

1. Open the deployed URL or localhost:3000 in your browser
2. Create a new game and share the game code with friends
3. Wait for players to join
4. Start the game when everyone is ready
5. Take turns making predictions and enjoy!

## License

MIT
