import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { QuizQuestion, Room, Player, ClientRoomState, LeaderboardEntry } from './src/types.ts';
import { DEFAULT_QUESTIONS } from './src/data/defaultQuestions.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));

// In-memory data structures
const rooms = new Map<string, Room>();
const sseClients = new Map<string, Set<Response>>();
const roomTimers = new Map<string, NodeJS.Timeout>();

// Admin Credentials
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'Hammam55%';
const ADMIN_TOKENS = new Set<string>();

// Helper to generate a room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Compute dynamic leaderboard
function computeLeaderboard(room: Room): LeaderboardEntry[] {
  const players = Object.values(room.players);
  
  const entries: LeaderboardEntry[] = players.map(player => {
    const answersList = Object.values(player.answers);
    const correctCount = answersList.filter(a => a.isCorrect).length;
    const totalTime = answersList.reduce((acc, curr) => acc + (curr.timeTaken || 0), 0);
    
    // Last question points
    let lastPoints = 0;
    if (room.currentQuestionIndex >= 0 && room.questions[room.currentQuestionIndex]) {
      const currentQId = room.questions[room.currentQuestionIndex].id;
      if (player.answers[currentQId]) {
        lastPoints = player.answers[currentQId].pointsEarned;
      }
    }

    return {
      rank: 0,
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      score: player.score,
      correctAnswersCount: correctCount,
      totalTimeTaken: Number(totalTime.toFixed(2)),
      lastPointsEarned: lastPoints
    };
  });

  // Sort by:
  // 1. score DESC (which already embodies correctness + time-decayed points)
  // 2. correctAnswersCount DESC
  // 3. totalTimeTaken ASC (faster overall response)
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correctAnswersCount !== a.correctAnswersCount) return b.correctAnswersCount - a.correctAnswersCount;
    return a.totalTimeTaken - b.totalTimeTaken;
  });

  // Assign 1-indexed ranks (handles ties cleanly)
  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return entries;
}

// Prepare client-safe state
function getClientRoomState(room: Room, playerId?: string): ClientRoomState {
  const currentQ = room.questions[room.currentQuestionIndex];
  
  let currentQuestionView = null;
  if (currentQ && (room.status === 'QUESTION' || room.status === 'DISCUSSION')) {
    const isDiscussion = room.status === 'DISCUSSION';
    currentQuestionView = {
      id: currentQ.id,
      question: currentQ.question,
      options: currentQ.options,
      timeLimit: currentQ.timeLimit || room.questionDuration || 30,
      // Reveal correct answer and explanation ONLY during discussion or final results
      correctIndex: isDiscussion ? currentQ.correctIndex : undefined,
      explanation: isDiscussion ? currentQ.explanation : undefined,
    };
  }

  const currentQId = currentQ?.id;

  const playersList = Object.values(room.players).map(p => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    score: p.score,
    hasAnsweredCurrent: Boolean(currentQId && p.answers[currentQId]),
    isOnline: p.isOnline,
  }));

  const leaderboard = computeLeaderboard(room).map(entry => ({
    ...entry,
    isCurrentUser: entry.id === playerId
  }));

  return {
    id: room.id,
    title: room.title,
    status: room.status,
    currentQuestionIndex: room.currentQuestionIndex,
    totalQuestions: room.questions.length,
    currentQuestion: currentQuestionView,
    questionStartedAt: room.questionStartedAt,
    questionDuration: room.questionDuration,
    playersCount: Object.keys(room.players).length,
    playersList,
    leaderboard
  };
}

// Broadcast room state to all connected SSE clients
function broadcastRoomUpdate(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  const clients = sseClients.get(roomId);
  if (!clients || clients.size === 0) return;

  clients.forEach(clientRes => {
    try {
      // Find playerId attached to response if any
      const playerId = (clientRes as any).__playerId;
      const state = getClientRoomState(room, playerId);
      clientRes.write(`event: room_update\ndata: ${JSON.stringify(state)}\n\n`);
    } catch {
      clients.delete(clientRes);
    }
  });
}

// Auto transition question -> discussion after timer expires
function startQuestionTimer(room: Room) {
  const roomId = room.id;
  if (roomTimers.has(roomId)) {
    clearTimeout(roomTimers.get(roomId)!);
  }

  const durationMs = (room.questionDuration || 30) * 1000;
  
  const timer = setTimeout(() => {
    const current = rooms.get(roomId);
    if (current && current.status === 'QUESTION') {
      current.status = 'DISCUSSION';
      broadcastRoomUpdate(roomId);
    }
  }, durationMs + 200); // 200ms grace for network latency

  roomTimers.set(roomId, timer);
}

// Initialize seed room for testing and instant play
const demoCode = 'HAMMAM';
rooms.set(demoCode, {
  id: demoCode,
  title: 'مسابقة التحدي الكبرى',
  status: 'LOBBY',
  questions: JSON.parse(JSON.stringify(DEFAULT_QUESTIONS)),
  currentQuestionIndex: 0,
  questionStartedAt: null,
  questionDuration: 30,
  players: {},
  createdAt: Date.now(),
  hostToken: 'demo-admin-token'
});

// ================= API ROUTES =================

// Admin Login
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = crypto.randomBytes(32).toString('hex');
    ADMIN_TOKENS.add(token);
    return res.json({ success: true, token, username: ADMIN_USER });
  }
  return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
});

// Admin verify token middleware helper
function checkAdminAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  if (!token || (!ADMIN_TOKENS.has(token) && token !== 'demo-admin-token')) {
    return res.status(403).json({ success: false, message: 'غير مصرح لك بالدخول، يرجى تسجيل الدخول كمسؤول' });
  }
  next();
}

// Admin Create Room
app.post('/api/admin/rooms', checkAdminAuth, (req: Request, res: Response) => {
  const { title, questions, questionDuration = 30 } = req.body;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'يجب توفير قائمة أسئلة صحيحة' });
  }

  const roomId = generateRoomCode();
  const hostToken = crypto.randomBytes(24).toString('hex');

  const newRoom: Room = {
    id: roomId,
    title: title?.trim() || `مسابقة ${roomId}`,
    status: 'LOBBY',
    questions,
    currentQuestionIndex: 0,
    questionStartedAt: null,
    questionDuration: Number(questionDuration) || 30,
    players: {},
    createdAt: Date.now(),
    hostToken
  };

  rooms.set(roomId, newRoom);
  return res.json({ success: true, roomId, hostToken, room: getClientRoomState(newRoom) });
});

// Admin List Rooms
app.get('/api/admin/rooms', checkAdminAuth, (_req: Request, res: Response) => {
  const list = Array.from(rooms.values()).map(r => ({
    id: r.id,
    title: r.title,
    status: r.status,
    questionsCount: r.questions.length,
    playersCount: Object.keys(r.players).length,
    createdAt: r.createdAt
  }));
  return res.json({ success: true, rooms: list });
});

// Get Room State
app.get('/api/rooms/:roomId', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { playerId } = req.query;
  const room = rooms.get(roomId.toUpperCase());

  if (!room) {
    return res.status(404).json({ error: 'الغرفة غير موجودة' });
  }

  return res.json({ success: true, room: getClientRoomState(room, playerId as string) });
});

// Join Room
app.post('/api/rooms/:roomId/join', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { name, avatar } = req.body;
  const room = rooms.get(roomId.toUpperCase());

  if (!room) {
    return res.status(404).json({ error: 'رمز المسابقة غير صحيح أو الغرفة غير موجودة' });
  }

  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    return res.status(400).json({ error: 'يرجى كتابة اسم اللاعب' });
  }

  const playerId = 'p_' + crypto.randomBytes(8).toString('hex');
  const newPlayer: Player = {
    id: playerId,
    name: trimmedName,
    avatar: avatar || '🎮',
    score: 0,
    answers: {},
    isOnline: true,
    joinedAt: Date.now()
  };

  room.players[playerId] = newPlayer;
  broadcastRoomUpdate(room.id);

  return res.json({
    success: true,
    playerId,
    room: getClientRoomState(room, playerId)
  });
});

// SSE Live Stream for Room
app.get('/api/rooms/:roomId/stream', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { playerId } = req.query;
  const room = rooms.get(roomId.toUpperCase());

  if (!room) {
    return res.status(404).end('Room not found');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  (res as any).__playerId = playerId;

  if (!sseClients.has(room.id)) {
    sseClients.set(room.id, new Set());
  }
  sseClients.get(room.id)!.add(res);

  // Mark player online
  if (playerId && room.players[playerId as string]) {
    room.players[playerId as string].isOnline = true;
    broadcastRoomUpdate(room.id);
  }

  // Send initial state
  res.write(`event: room_update\ndata: ${JSON.stringify(getClientRoomState(room, playerId as string))}\n\n`);

  // Keep-alive ping every 15s
  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    sseClients.get(room.id)?.delete(res);
    if (playerId && room.players[playerId as string]) {
      room.players[playerId as string].isOnline = false;
      broadcastRoomUpdate(room.id);
    }
  });
});

// Start Quiz (Host Only)
app.post('/api/rooms/:roomId/start', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { hostToken } = req.body;
  const room = rooms.get(roomId.toUpperCase());

  if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة' });
  if (room.hostToken !== hostToken && !ADMIN_TOKENS.has(hostToken)) {
    return res.status(403).json({ error: 'تصريح غير صالح لبدء المسابقة' });
  }

  room.status = 'QUESTION';
  room.currentQuestionIndex = 0;
  room.questionStartedAt = Date.now();

  startQuestionTimer(room);
  broadcastRoomUpdate(room.id);

  return res.json({ success: true, room: getClientRoomState(room) });
});

// Player Submit Answer
app.post('/api/rooms/:roomId/answer', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { playerId, selectedOption } = req.body;
  const room = rooms.get(roomId.toUpperCase());

  if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة' });
  if (room.status !== 'QUESTION') {
    return res.status(400).json({ error: 'لم تبدأ مرحلة الإجابة بعد أو انتهى الوقت' });
  }

  const player = room.players[playerId];
  if (!player) return res.status(404).json({ error: 'اللاعب غير مسجل في هذه الغرفة' });

  const currentQ = room.questions[room.currentQuestionIndex];
  if (!currentQ) return res.status(400).json({ error: 'لا يوجد سؤال نشط حالياً' });

  // Guard against duplicate answer
  if (player.answers[currentQ.id]) {
    return res.json({ success: true, answer: player.answers[currentQ.id], alreadyAnswered: true });
  }

  const now = Date.now();
  const startedAt = room.questionStartedAt || now;
  const timeTaken = Math.max(0.1, (now - startedAt) / 1000);
  const maxDuration = room.questionDuration || 30;

  const isWithinTime = timeTaken <= (maxDuration + 1.0); // 1s grace period for client/server jitter
  const isCorrect = isWithinTime && Number(selectedOption) === currentQ.correctIndex;

  // Formula: 100 base score that decreases linearly with time over 30s
  // If correct within 30s: min 10 points, max 100 points
  // If wrong or past 30s: 0 points
  let pointsEarned = 0;
  if (isCorrect) {
    const speedRatio = Math.max(0, (maxDuration - timeTaken) / maxDuration);
    pointsEarned = Math.max(10, Math.round(100 * speedRatio));
  }

  const answerRecord = {
    selectedOption: Number(selectedOption),
    timeTaken: Number(timeTaken.toFixed(2)),
    pointsEarned,
    isCorrect,
    answeredAt: now
  };

  player.answers[currentQ.id] = answerRecord;
  player.score += pointsEarned;

  // Check if all connected players have answered -> if so, move to discussion automatically!
  const connectedPlayers = Object.values(room.players).filter(p => p.isOnline);
  const allAnswered = connectedPlayers.length > 0 && connectedPlayers.every(p => Boolean(p.answers[currentQ.id]));
  if (allAnswered) {
    if (roomTimers.has(room.id)) {
      clearTimeout(roomTimers.get(room.id)!);
    }
    room.status = 'DISCUSSION';
  }

  broadcastRoomUpdate(room.id);

  return res.json({
    success: true,
    answer: answerRecord,
    currentScore: player.score
  });
});

// Move to Discussion manually (Host)
app.post('/api/rooms/:roomId/discuss', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { hostToken } = req.body;
  const room = rooms.get(roomId.toUpperCase());

  if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة' });
  if (room.hostToken !== hostToken && !ADMIN_TOKENS.has(hostToken)) {
    return res.status(403).json({ error: 'غير مصرح' });
  }

  if (roomTimers.has(room.id)) {
    clearTimeout(roomTimers.get(room.id)!);
  }

  room.status = 'DISCUSSION';
  broadcastRoomUpdate(room.id);
  return res.json({ success: true, room: getClientRoomState(room) });
});

// Next Question (Host Only - Requirement: "to go to the next question the host has to click a button so we can discuss between questions")
app.post('/api/rooms/:roomId/next', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { hostToken } = req.body;
  const room = rooms.get(roomId.toUpperCase());

  if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة' });
  if (room.hostToken !== hostToken && !ADMIN_TOKENS.has(hostToken)) {
    return res.status(403).json({ error: 'غير مصرح لك بنقل السؤال' });
  }

  if (roomTimers.has(room.id)) {
    clearTimeout(roomTimers.get(room.id)!);
  }

  if (room.currentQuestionIndex + 1 < room.questions.length) {
    room.currentQuestionIndex += 1;
    room.status = 'QUESTION';
    room.questionStartedAt = Date.now();
    startQuestionTimer(room);
  } else {
    // Finished all questions -> FINAL_RESULTS
    room.status = 'FINAL_RESULTS';
  }

  broadcastRoomUpdate(room.id);
  return res.json({ success: true, room: getClientRoomState(room) });
});

// End Quiz (Host Only)
app.post('/api/rooms/:roomId/finish', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { hostToken } = req.body;
  const room = rooms.get(roomId.toUpperCase());

  if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة' });
  if (room.hostToken !== hostToken && !ADMIN_TOKENS.has(hostToken)) {
    return res.status(403).json({ error: 'غير مصرح' });
  }

  if (roomTimers.has(room.id)) {
    clearTimeout(roomTimers.get(room.id)!);
  }

  room.status = 'FINAL_RESULTS';
  broadcastRoomUpdate(room.id);
  return res.json({ success: true, room: getClientRoomState(room) });
});

// Reset Quiz to Lobby (Host Only)
app.post('/api/rooms/:roomId/reset', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { hostToken } = req.body;
  const room = rooms.get(roomId.toUpperCase());

  if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة' });
  if (room.hostToken !== hostToken && !ADMIN_TOKENS.has(hostToken)) {
    return res.status(403).json({ error: 'غير مصرح' });
  }

  if (roomTimers.has(room.id)) {
    clearTimeout(roomTimers.get(room.id)!);
  }

  room.status = 'LOBBY';
  room.currentQuestionIndex = 0;
  room.questionStartedAt = null;
  // Reset player scores & answers
  Object.values(room.players).forEach(p => {
    p.score = 0;
    p.answers = {};
  });

  broadcastRoomUpdate(room.id);
  return res.json({ success: true, room: getClientRoomState(room) });
});

// Serve frontend in production or connect Vite dev server
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on http://0.0.0.0:${PORT}`);
});
