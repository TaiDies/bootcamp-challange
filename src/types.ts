export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  timeLimit?: number; // default 30s
}

export interface PlayerAnswer {
  selectedOption: number;
  timeTaken: number; // in seconds (e.g., 4.25)
  pointsEarned: number;
  isCorrect: boolean;
  answeredAt: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  answers: Record<string, PlayerAnswer>;
  isOnline: boolean;
  joinedAt: number;
}

export type RoomStatus = 'LOBBY' | 'QUESTION' | 'DISCUSSION' | 'FINAL_RESULTS';

export interface Room {
  id: string;
  title: string;
  status: RoomStatus;
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  questionStartedAt: number | null;
  questionDuration: number; // default 30
  players: Record<string, Player>;
  createdAt: number;
  hostToken: string;
}

export interface ClientQuestionView {
  id: string;
  question: string;
  options: string[];
  timeLimit: number;
  correctIndex?: number; // Only present in DISCUSSION or FINAL_RESULTS
  explanation?: string; // Only present in DISCUSSION or FINAL_RESULTS
}

export interface ClientRoomState {
  id: string;
  title: string;
  status: RoomStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: ClientQuestionView | null;
  questionStartedAt: number | null;
  questionDuration: number;
  playersCount: number;
  playersList: {
    id: string;
    name: string;
    avatar: string;
    score: number;
    hasAnsweredCurrent: boolean;
    isOnline: boolean;
  }[];
  leaderboard?: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatar: string;
  score: number;
  correctAnswersCount: number;
  totalTimeTaken: number; // sum of response times in seconds
  lastPointsEarned?: number;
  isCurrentUser?: boolean;
}
