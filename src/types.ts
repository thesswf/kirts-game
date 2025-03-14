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
  isRevived?: boolean;
}

export interface Player {
  id: string;
  username: string;
  isHost: boolean;
  correctPredictions?: number;
  totalPredictions?: number;
  sessionId?: string;
  disconnected?: boolean;
  disconnectedAt?: number | null;
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