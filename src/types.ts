// Game types for High-Low Card Game

export type GameStatus = 'waiting' | 'playing' | 'finished';
export type Prediction = 'high' | 'low' | 'equal';

export interface Card {
  value: string;
  suit: string;
}

export interface Pile {
  cards: Card[];
  active: boolean;
  isNewlyDealt: boolean;
  lastPredictionCorrect?: boolean;
}

export interface Player {
  id: string;
  username: string;
  isHost: boolean;
}

export interface GameState {
  id: string;
  players: Player[];
  status: GameStatus;
  deck: Card[];
  piles: Pile[];
  currentPlayerIndex: number;
  currentPileIndex: number | null;
  remainingCards: number;
  firstTurnAfterPileDeath: boolean;
} 