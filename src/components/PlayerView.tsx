import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Check, 
  Sparkles, 
  Users, 
  Share2, 
  Award,
  Zap,
  HelpCircle,
  AlertTriangle,
  Medal,
  Flame
} from 'lucide-react';
import { ClientRoomState, LeaderboardEntry } from '../types.ts';
import { 
  getRoom, 
  joinRoom, 
  submitAnswer, 
  subscribeToRoomStream 
} from '../services/api.ts';
import { 
  playCorrectSound, 
  playIncorrectSound, 
  playTickSound, 
  playFanfareSound 
} from '../services/sound.ts';

const AVATARS = ['🦁', '🦅', '🚀', '👑', '⚡', '🌟', '🎯', '💡', '🏆', '🔥', '🦊', '🐬'];

interface PlayerViewProps {
  initialRoomId?: string;
  onGoToAdmin: () => void;
}

export const PlayerView: React.FC<PlayerViewProps> = ({ initialRoomId, onGoToAdmin }) => {
  // Join form state
  const [roomIdInput, setRoomIdInput] = useState(initialRoomId || '');
  const [playerName, setPlayerName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [isJoined, setIsJoined] = useState(false);
  const [playerId, setPlayerId] = useState<string>('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Live room state
  const [roomState, setRoomState] = useState<ClientRoomState | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [myAnswerResult, setMyAnswerResult] = useState<{
    timeTaken: number;
    pointsEarned: number;
    isCorrect: boolean;
  } | null>(null);

  // Timer & Decreasing score state
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [liveDecreasingScore, setLiveDecreasingScore] = useState<number>(100);

  // Sound & confetti trigger refs
  const prevStatusRef = useRef<string | null>(null);
  const confettiFiredRef = useRef(false);

  // Update room input if prop changes
  useEffect(() => {
    if (initialRoomId) {
      setRoomIdInput(initialRoomId);
    }
  }, [initialRoomId]);

  // Subscribe to room updates when joined
  useEffect(() => {
    if (!isJoined || !roomIdInput || !playerId) return;

    let isMounted = true;

    // Initial fetch
    getRoom(roomIdInput, playerId)
      .then(res => {
        if (isMounted && res.room) {
          setRoomState(res.room);
        }
      })
      .catch(err => console.error(err));

    // SSE Stream
    const unsubscribe = subscribeToRoomStream(roomIdInput, playerId, (state) => {
      if (!isMounted) return;
      setRoomState(state);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isJoined, roomIdInput, playerId]);

  // Handle question phase timer and score decay
  useEffect(() => {
    if (!roomState || roomState.status !== 'QUESTION' || !roomState.questionStartedAt) {
      return;
    }

    const duration = roomState.questionDuration || 30;
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - roomState.questionStartedAt!) / 1000;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(Math.ceil(remaining));

      // Calculate decreasing score (starts at 100, min 10 points)
      const ratio = Math.max(0, remaining / duration);
      const currentScorePotential = Math.max(10, Math.round(100 * ratio));
      setLiveDecreasingScore(currentScorePotential);

      // Play soft tick during final 5 seconds if not yet answered
      if (remaining <= 5 && remaining > 0 && selectedOption === null) {
        playTickSound();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [roomState?.status, roomState?.questionStartedAt, roomState?.questionDuration, selectedOption]);

  // Reset selected option when moving to next question
  useEffect(() => {
    if (roomState?.status === 'QUESTION') {
      setSelectedOption(null);
      setMyAnswerResult(null);
    }
  }, [roomState?.currentQuestionIndex, roomState?.status]);

  // Detect state transitions for sounds and confetti
  useEffect(() => {
    if (!roomState) return;

    // Transition to DISCUSSION
    if (prevStatusRef.current === 'QUESTION' && roomState.status === 'DISCUSSION') {
      // Find my answer in the leaderboard / results
      const myEntry = roomState.leaderboard?.find(e => e.id === playerId);
      if (myEntry && myEntry.lastPointsEarned !== undefined) {
        if (myEntry.lastPointsEarned > 0) {
          playCorrectSound();
        } else {
          playIncorrectSound();
        }
      }
    }

    // Transition to FINAL_RESULTS
    if (roomState.status === 'FINAL_RESULTS' && !confettiFiredRef.current) {
      const myEntry = roomState.leaderboard?.find(e => e.id === playerId);
      if (myEntry && myEntry.rank <= 3) {
        confettiFiredRef.current = true;
        playFanfareSound();
        try {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 }
          });
        } catch {
          // Ignore
        }
      }
    }

    prevStatusRef.current = roomState.status;
  }, [roomState?.status, playerId]);

  // Join Room Handler
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomIdInput.trim() || !playerName.trim()) return;

    setJoinError(null);
    setJoining(true);

    try {
      const res = await joinRoom(roomIdInput.trim(), playerName.trim(), selectedAvatar);
      if (res.success) {
        setPlayerId(res.playerId);
        setRoomState(res.room);
        setIsJoined(true);
      }
    } catch (err: any) {
      setJoinError(err.message || 'فشل الانضمام للغرفة، تأكد من صحة رمز المسابقة');
    } finally {
      setJoining(false);
    }
  };

  // Submit Answer
  const handleSelectOption = async (optionIndex: number) => {
    if (selectedOption !== null || submittingAnswer || !roomState || roomState.status !== 'QUESTION') {
      return;
    }

    setSelectedOption(optionIndex);
    setSubmittingAnswer(true);

    try {
      const res = await submitAnswer(roomState.id, playerId, optionIndex);
      if (res.success && res.answer) {
        setMyAnswerResult(res.answer);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setSubmittingAnswer(false);
    }
  };

  // My ranking in leaderboard
  const myLeaderboardEntry = roomState?.leaderboard?.find(e => e.id === playerId);
  const myRank = myLeaderboardEntry?.rank || 0;
  const isTop3 = myRank >= 1 && myRank <= 3;

  // ================= 1. JOIN SCREEN =================
  if (!isJoined) {
    return (
      <div className="max-w-md mx-auto my-10 px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/5">
              <Zap className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
              مسابقة التحدي التفاعلية
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              تنافس مع أصدقائك مباشرة بالسرعة وصحة الإجابات وتصدر لائحة الشرف!
            </p>
          </div>

          {joinError && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{joinError}</span>
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رمز الغرفة أو المسابقة (PIN)
              </label>
              <input
                type="text"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                placeholder="مثال: HAMMAM"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-center font-mono font-bold tracking-widest text-amber-400 placeholder-slate-600 text-lg uppercase focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                اسم اللاعب
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="اكتب اسمك أو لقبك هنا"
                maxLength={25}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-4 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                اختر الأيقونة الرمزية:
              </label>
              <div className="grid grid-cols-6 gap-2">
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setSelectedAvatar(av)}
                    className={`h-11 text-xl flex items-center justify-center rounded-xl transition-all ${
                      selectedAvatar === av
                        ? 'bg-amber-500/20 border-2 border-amber-400 scale-105 shadow-md'
                        : 'bg-slate-950 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={joining}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 active:scale-98 text-slate-950 font-extrabold text-base rounded-xl transition-all shadow-xl shadow-amber-500/15 flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
            >
              {joining ? 'جارٍ الانضمام...' : 'الدخول إلى المسابقة الآن 🎮'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
            <button
              type="button"
              onClick={onGoToAdmin}
              className="text-xs text-slate-400 hover:text-amber-400 transition-colors inline-flex items-center gap-1.5"
            >
              <span>أنت المضيف وتريد إدارة المسابقة؟ اضغط هنا لتسجيل الدخول</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= 2. LOBBY SCREEN =================
  if (roomState?.status === 'LOBBY') {
    return (
      <div className="max-w-2xl mx-auto my-10 px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-semibold">
            <span>رمز الغرفة:</span>
            <span className="font-mono font-bold tracking-wider">{roomState.id}</span>
          </div>

          <div>
            <div className="w-16 h-16 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
              {selectedAvatar}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              أهلاً بك يا <span className="text-amber-400">{playerName}</span>!
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              تم انضمامك بنجاح، بانتظار إشارة المضيف لبدء التحدي...
            </p>
          </div>

          {/* Quick Instructions */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 text-right space-y-2">
            <div className="font-bold text-amber-400 text-sm mb-1">قواعد المسابقة السريعة:</div>
            <p>⏱️ لكل سؤال <span className="font-bold text-white">30 ثانية</span> فقط للإجابة.</p>
            <p>💯 يبدأ السؤال بـ <span className="font-bold text-white">100 نقطة</span> وتنقص تدريجياً مع كل ثانية تأخير!</p>
            <p>🎙️ بعد انتهاء وقت السؤال، يدخل الجميع في <span className="font-bold text-white">مرحلة النقاش والمراجعة</span> حتى ينتقل المضيف للسؤال التالي.</p>
            <p>📸 <span className="font-bold text-amber-400">أصحاب المراكز الثلاثة الأولى</span> سيُطلب منهم إرسال لقطة شاشة لصفحة الفوز لتأكيد فوزهم!</p>
          </div>

          {/* Connected players roster */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
              <span className="flex items-center gap-1.5 font-bold text-white">
                <Users className="w-4 h-4 text-amber-400" />
                <span>المشاركون في الغرفة ({roomState.playersList.length})</span>
              </span>
              <span>في انتظار البدء...</span>
            </div>

            <div className="flex flex-wrap gap-2 justify-center max-h-48 overflow-y-auto p-1">
              {roomState.playersList.map((p) => (
                <div
                  key={p.id}
                  className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 ${
                    p.id === playerId
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <span>{p.avatar}</span>
                  <span>{p.name}</span>
                  {p.id === playerId && <span className="text-[10px] text-slate-400">(أنت)</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= 3. ACTIVE QUESTION SCREEN =================
  if (roomState?.status === 'QUESTION' && roomState.currentQuestion) {
    const currentQ = roomState.currentQuestion;
    const currentIdx = roomState.currentQuestionIndex + 1;
    const totalQ = roomState.totalQuestions;

    const optionColors = [
      'hover:border-blue-500 hover:bg-blue-500/10 active:bg-blue-500/20',
      'hover:border-emerald-500 hover:bg-emerald-500/10 active:bg-emerald-500/20',
      'hover:border-amber-500 hover:bg-amber-500/10 active:bg-amber-500/20',
      'hover:border-purple-500 hover:bg-purple-500/10 active:bg-purple-500/20'
    ];

    const optionBadges = ['أ', 'ب', 'ج', 'د'];

    return (
      <div className="max-w-3xl mx-auto my-6 px-4 space-y-6">
        {/* Top HUD: Question index, Decreasing score, and 30s Countdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-amber-400 font-mono">
              سؤال {currentIdx} من {totalQ}
            </span>
            <span className="text-xs text-slate-400">
              نقاطك الحالية: <span className="font-mono font-bold text-white text-sm">{myLeaderboardEntry?.score || 0}</span>
            </span>
          </div>

          {/* Real-time Decreasing Score Gauge */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">النقاط المتاحة الآن:</span>
              <span className="text-xl sm:text-2xl font-black font-mono text-amber-400 tabular-nums">
                {liveDecreasingScore}
                <span className="text-xs font-sans text-slate-500 mr-1">ن</span>
              </span>
            </div>

            {/* Circular or Compact Timer */}
            <div className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center font-mono font-black text-lg tabular-nums shadow-md transition-colors ${
              timeLeft <= 5 
                ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse' 
                : 'bg-slate-950 border-amber-500/40 text-amber-400'
            }`}>
              <span>{timeLeft}</span>
              <span className="text-[9px] -mt-1 font-sans text-slate-400">ثانية</span>
            </div>
          </div>
        </div>

        {/* 30s Countdown visual bar */}
        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
          <div 
            className={`h-full transition-all duration-100 linear ${
              timeLeft <= 5 ? 'bg-rose-500' : 'bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500'
            }`}
            style={{ width: `${(timeLeft / (roomState.questionDuration || 30)) * 100}%` }}
          />
        </div>

        {/* The Question Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white text-center leading-relaxed mb-8">
            {currentQ.question}
          </h2>

          {/* 4 Choices */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {currentQ.options.map((opt, idx) => {
              const isChosen = selectedOption === idx;
              const hasAnswered = selectedOption !== null;

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={hasAnswered || timeLeft === 0}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-right transition-all flex items-center justify-between text-base font-bold ${
                    isChosen
                      ? 'bg-amber-500/20 border-amber-400 text-white scale-[1.02] shadow-lg shadow-amber-500/10'
                      : hasAnswered
                      ? 'opacity-50 border-slate-800 bg-slate-950 text-slate-400 cursor-not-allowed'
                      : `bg-slate-950 border-slate-800 text-slate-200 ${optionColors[idx % 4]}`
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-mono shrink-0 ${
                      isChosen ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {optionBadges[idx]}
                    </span>
                    <span>{opt}</span>
                  </div>

                  {isChosen && (
                    <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Response status notification */}
          {selectedOption !== null && (
            <div className="mt-6 p-4 bg-slate-950 border border-emerald-500/30 rounded-2xl text-center">
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-bold mb-1">
                <CheckCircle2 className="w-5 h-5" />
                <span>تم تسجيل إجابتك بنجاح!</span>
              </div>
              <p className="text-xs text-slate-400">
                {myAnswerResult?.timeTaken 
                  ? `زمن استجابتك: ${myAnswerResult.timeTaken} ثانية · ` 
                  : ''}
                النتيجة وصحة الإجابة ستُعلن فور انتهاء وقت السؤال وبدء مرحلة النقاش.
              </p>
            </div>
          )}

          {timeLeft === 0 && selectedOption === null && (
            <div className="mt-6 p-4 bg-slate-950 border border-rose-500/30 rounded-2xl text-center text-rose-400 text-sm font-bold">
              انتهى وقت الـ 30 ثانية! جاري الانتقال لمرحلة النقاش مع المضيف...
            </div>
          )}
        </div>
      </div>
    );
  }

  // ================= 4. DISCUSSION PHASE SCREEN =================
  if (roomState?.status === 'DISCUSSION' && roomState.currentQuestion) {
    const currentQ = roomState.currentQuestion;
    const currentIdx = roomState.currentQuestionIndex + 1;
    const totalQ = roomState.totalQuestions;

    // Check my answer
    const myEntry = roomState.leaderboard?.find(e => e.id === playerId);
    const lastEarned = myEntry?.lastPointsEarned || 0;
    const didIAnswerCorrect = lastEarned > 0;

    return (
      <div className="max-w-3xl mx-auto my-6 px-4 space-y-6">
        {/* Discussion Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-amber-500/30 rounded-2xl p-5 text-center shadow-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-semibold mb-2">
            <span>🎙️ مرحلة النقاش والمراجعة</span>
            <span>·</span>
            <span>سؤال {currentIdx} من {totalQ}</span>
          </div>
          <h3 className="text-lg font-bold text-white">
            المضيف يناقش السؤال الحالي مع الجميع الآن
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            انتظر إشارة المضيف للانتقال للسؤال التالي (سيضغط المضيف على زر الانتقال للمتابعة).
          </p>
        </div>

        {/* Question & Revealed Answer Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white text-center leading-relaxed">
            {currentQ.question}
          </h2>

          {/* Options with Correct Answer Revealed */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQ.options.map((opt, idx) => {
              const isCorrectOption = idx === currentQ.correctIndex;
              const wasMyChoice = selectedOption === idx;

              let style = 'bg-slate-950 border-slate-800 text-slate-400 opacity-60';
              if (isCorrectOption) {
                style = 'bg-emerald-500/15 border-2 border-emerald-400 text-white font-bold opacity-100 shadow-md shadow-emerald-500/10';
              } else if (wasMyChoice) {
                style = 'bg-rose-500/15 border-2 border-rose-500 text-rose-300 font-bold opacity-100';
              }

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border flex items-center justify-between text-sm ${style}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs">{['أ', 'ب', 'ج', 'د'][idx]}</span>
                    <span>{opt}</span>
                  </div>

                  {isCorrectOption ? (
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>صحيحة ✓</span>
                    </span>
                  ) : wasMyChoice ? (
                    <span className="text-xs text-rose-400 font-bold flex items-center gap-1">
                      <XCircle className="w-4 h-4" />
                      <span>إجابتك ✗</span>
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* My Score Result Card for this round */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            didIAnswerCorrect 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center gap-3">
              {didIAnswerCorrect ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-400" />
              )}
              <div>
                <span className="font-bold text-sm text-white block">
                  {didIAnswerCorrect ? 'أحسنت! إجابة صحيحة وسريعة 🎉' : 'للأسف لم توفق في هذا السؤال'}
                </span>
                <span className="text-xs text-slate-400">
                  {didIAnswerCorrect 
                    ? `حصلت على ${lastEarned} نقطة من 100 بناءً على سرعة إجابتك.` 
                    : '0 نقطة لهذا السؤال.'}
                </span>
              </div>
            </div>

            <div className="text-left font-mono font-black text-xl text-amber-400 tabular-nums">
              +{lastEarned}
            </div>
          </div>

          {/* Explanation if available */}
          {currentQ.explanation && (
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs text-slate-300 leading-relaxed">
              <span className="font-bold text-amber-400 block mb-1">💡 معلومة وشرح السؤال:</span>
              {currentQ.explanation}
            </div>
          )}
        </div>

        {/* Current Standing preview */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>ترتيبك الحالي: المركز #{myRank}</span>
            </span>
            <span className="font-mono text-amber-400 font-bold">{myLeaderboardEntry?.score || 0} نقطة</span>
          </div>

          <div className="w-full bg-slate-950 rounded-xl p-2.5 text-xs text-slate-400 text-center font-medium">
            المضيف سيضغط على "السؤال التالي" للانتقال للجولة القادمة ⏳
          </div>
        </div>
      </div>
    );
  }

  // ================= 5. FINAL RESULTS & WINNING PODIUM =================
  // (Core User Requirement: "the app will be multiplayer and will show a page asking the first 3 players to send a picture to the host of the winning page. then the leaderboard will show the entire player's scores after the quiz.")
  if (roomState?.status === 'FINAL_RESULTS') {
    return (
      <div className="max-w-4xl mx-auto my-8 px-4 space-y-8">
        {/* Top Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>انتهت المسابقة وتم تتويج الفائزين</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            لوحة الصدارة والنتائج النهائية 🏆
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            تم ترتيب جميع المتسابقين بناءً على صحة الإجابات وسرعة الاستجابة.
          </p>
        </div>

        {/* ============ SPECIAL PODIUM PAGE FOR TOP 3 PLAYERS ============ */}
        {isTop3 && (
          <div className="relative bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-950 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="text-center space-y-3 relative z-10">
              <span className="text-6xl sm:text-7xl animate-bounce inline-block">
                {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : '🥉'}
              </span>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500 text-slate-950 font-black rounded-full text-xs sm:text-sm tracking-wide shadow-md">
                <Trophy className="w-4 h-4 fill-current" />
                <span>
                  {myRank === 1 
                    ? 'المركز الأول · بطل التحدي الأكبر' 
                    : myRank === 2 
                    ? 'المركز الثاني · وصيف البطل' 
                    : 'المركز الثالث · منصة التتويج'}
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-white">
                تهانينا يا <span className="text-amber-400">{playerName}</span>! أنت من الفائزين الثلاثة الأوائل!
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
                لقد تميزت بسرعة بديهتك ودقة إجاباتك طوال جولات المسابقة واستحققت مكانك بجدارة على منصة الشرف.
              </p>
            </div>

            {/* Performance Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10 pt-2">
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">المركز النهائي</span>
                <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                  {myRank === 1 ? 'الأول 🥇' : myRank === 2 ? 'الثاني 🥈' : 'الثالث 🥉'}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">مجموع النقاط</span>
                <span className="text-xl sm:text-2xl font-black text-white font-mono tabular-nums">
                  {myLeaderboardEntry?.score}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">الإجابات الصحيحة</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tabular-nums">
                  {myLeaderboardEntry?.correctAnswersCount} / {roomState.totalQuestions}
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">إجمالي زمن الاستجابة</span>
                <span className="text-xl sm:text-2xl font-black text-slate-200 font-mono tabular-nums">
                  {myLeaderboardEntry?.totalTimeTaken}ث
                </span>
              </div>
            </div>

            {/* Visual Top-3 Podium */}
            {roomState.leaderboard && roomState.leaderboard.length >= 2 && (
              <div className="pt-4 border-t border-slate-800/80">
                <h4 className="text-xs font-bold text-slate-400 text-center mb-4">منصة التتويج للمراكز الثلاثة الأولى</h4>
                <div className="flex items-end justify-center gap-3 sm:gap-6 pt-6 pb-2">
                  {/* Rank 2 (Silver) */}
                  {roomState.leaderboard[1] && (
                    <div className="flex flex-col items-center">
                      <span className="text-2xl sm:text-3xl mb-1">{roomState.leaderboard[1].avatar}</span>
                      <span className="text-xs font-bold text-slate-300 max-w-[80px] truncate text-center">
                        {roomState.leaderboard[1].name}
                      </span>
                      <span className="text-[11px] text-amber-400 font-mono font-bold">
                        {roomState.leaderboard[1].score}ن
                      </span>
                      <div className="w-20 sm:w-24 h-24 bg-gradient-to-t from-slate-800 to-slate-700/80 rounded-t-xl border-t-2 border-slate-400 flex flex-col items-center justify-center text-slate-200 mt-2 shadow-lg">
                        <span className="text-2xl">🥈</span>
                        <span className="text-xs font-bold mt-1">المركز 2</span>
                      </div>
                    </div>
                  )}

                  {/* Rank 1 (Gold) */}
                  {roomState.leaderboard[0] && (
                    <div className="flex flex-col items-center">
                      <span className="text-3xl sm:text-4xl mb-1">{roomState.leaderboard[0].avatar}</span>
                      <span className="text-xs font-bold text-white max-w-[90px] truncate text-center">
                        {roomState.leaderboard[0].name}
                      </span>
                      <span className="text-[11px] text-amber-400 font-mono font-bold">
                        {roomState.leaderboard[0].score}ن
                      </span>
                      <div className="w-24 sm:w-28 h-32 bg-gradient-to-t from-amber-600/90 to-amber-500 rounded-t-xl border-t-2 border-amber-300 flex flex-col items-center justify-center text-slate-950 font-black mt-2 shadow-xl shadow-amber-500/20">
                        <span className="text-3xl">🥇</span>
                        <span className="text-xs font-extrabold mt-1">المركز 1</span>
                      </div>
                    </div>
                  )}

                  {/* Rank 3 (Bronze) */}
                  {roomState.leaderboard[2] && (
                    <div className="flex flex-col items-center">
                      <span className="text-2xl sm:text-3xl mb-1">{roomState.leaderboard[2].avatar}</span>
                      <span className="text-xs font-bold text-slate-300 max-w-[80px] truncate text-center">
                        {roomState.leaderboard[2].name}
                      </span>
                      <span className="text-[11px] text-amber-400 font-mono font-bold">
                        {roomState.leaderboard[2].score}ن
                      </span>
                      <div className="w-20 sm:w-24 h-18 bg-gradient-to-t from-amber-950 to-amber-900/80 rounded-t-xl border-t-2 border-amber-700 flex flex-col items-center justify-center text-amber-400 mt-2 shadow-lg">
                        <span className="text-2xl">🥉</span>
                        <span className="text-xs font-bold mt-1">المركز 3</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* If Rank 4+ Notification Card */}
        {!isTop3 && myLeaderboardEntry && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
              {myLeaderboardEntry.avatar}
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                أداء رائع يا <span className="text-amber-400">{playerName}</span>!
              </h3>
              <p className="text-sm text-slate-300 mt-1">
                ترتيبك النهائي في هذه المسابقة هو <span className="font-bold text-amber-400">المركز #{myRank}</span> من بين {roomState.playersCount} مشاركاً.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-400 pt-2">
              <span className="bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800">
                مجموع النقاط: <strong className="text-amber-400 font-mono tabular-nums">{myLeaderboardEntry.score}</strong>
              </span>
              <span className="bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800">
                الإجابات الصحيحة: <strong className="text-emerald-400 font-mono tabular-nums">{myLeaderboardEntry.correctAnswersCount} / {roomState.totalQuestions}</strong>
              </span>
              <span className="bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800">
                زمن الإجابة: <strong className="text-slate-200 font-mono tabular-nums">{myLeaderboardEntry.totalTimeTaken}ث</strong>
              </span>
            </div>
          </div>
        )}

        {/* ============ COMPLETE LEADERBOARD FOR ENTIRE PLAYERS ============ */}
        {/* (Requirement: "then the leaderboard will show the entire player's scores after the quiz") */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>الترتيب النهائي لجميع اللاعبين ({roomState.leaderboard?.length || 0})</span>
            </h3>
            <span className="text-xs text-slate-400">
              معيار الترتيب: النقاط الإجمالية ثم عدد الإجابات الصحيحة ثم سرعة الإجابة
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 font-semibold">
                  <th className="pb-3 pr-4">الترتيب</th>
                  <th className="pb-3">اللاعب</th>
                  <th className="pb-3">الإجابات الصحيحة</th>
                  <th className="pb-3">مجموع زمن الإجابة</th>
                  <th className="pb-3 pl-4 text-left">مجموع النقاط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {roomState.leaderboard?.map((entry) => {
                  const isCurrent = entry.id === playerId;
                  const medal = entry.rank === 1 ? '🥇 الأول' : entry.rank === 2 ? '🥈 الثاني' : entry.rank === 3 ? '🥉 الثالث' : `#${entry.rank}`;

                  return (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        isCurrent 
                          ? 'bg-amber-500/10 font-bold' 
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3.5 pr-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                          entry.rank === 1 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                            : entry.rank === 2 
                            ? 'bg-slate-300/20 text-slate-200 border border-slate-400/30' 
                            : entry.rank === 3 
                            ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30' 
                            : 'text-slate-400'
                        }`}>
                          {medal}
                        </span>
                      </td>

                      <td className="py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{entry.avatar}</span>
                          <span className="text-white">
                            {entry.name}
                            {isCurrent && (
                              <span className="mr-2 text-xs text-amber-400 font-bold">(أنت)</span>
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 whitespace-nowrap text-slate-300">
                        {entry.correctAnswersCount} من {roomState.totalQuestions}
                      </td>

                      <td className="py-3.5 whitespace-nowrap text-slate-400 font-mono tabular-nums">
                        {entry.totalTimeTaken} ثانية
                      </td>

                      <td className="py-3.5 pl-4 whitespace-nowrap text-left font-mono font-extrabold text-amber-400 text-base tabular-nums">
                        {entry.score}
                        <span className="text-xs font-sans text-slate-500 mr-1">ن</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
