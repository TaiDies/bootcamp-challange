import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Users, 
  Clock, 
  Trophy, 
  RotateCcw, 
  Share2, 
  ChevronRight, 
  Sparkles,
  MessageSquare,
  LogOut,
  HelpCircle,
  Eye
} from 'lucide-react';
import { QuizQuestion, ClientRoomState } from '../types.ts';
import { DEFAULT_QUESTIONS, PRESET_TOPICS } from '../data/defaultQuestions.ts';
import { 
  createRoom, 
  getRoom, 
  startQuiz, 
  nextQuestion, 
  discussQuestion, 
  finishQuiz, 
  resetQuiz, 
  subscribeToRoomStream 
} from '../services/api.ts';

interface AdminDashboardProps {
  adminToken: string;
  onLogout: () => void;
  onSelectRoomForPlaying?: (roomId: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminToken,
  onLogout,
  onSelectRoomForPlaying
}) => {
  // Questions editor state
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => {
    return JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
  });
  const [quizTitle, setQuizTitle] = useState('تحدي المعرفة والسرعة');
  const [questionDuration, setQuestionDuration] = useState<number>(30);

  // Active controlled room
  const [activeRoomId, setActiveRoomId] = useState<string>('HAMMAM');
  const [hostToken, setHostToken] = useState<string>('demo-admin-token');
  const [roomState, setRoomState] = useState<ClientRoomState | null>(null);
  
  // UI states
  const [activeTab, setActiveTab] = useState<'control' | 'questions'>('control');
  const [copiedLink, setCopiedLink] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New question form state
  const [newQText, setNewQText] = useState('');
  const [newOptions, setNewOptions] = useState(['', '', '', '']);
  const [newCorrectIndex, setNewCorrectIndex] = useState(0);
  const [newExplanation, setNewExplanation] = useState('');

  // Fetch or subscribe to current active room
  useEffect(() => {
    if (!activeRoomId) return;

    let isMounted = true;
    getRoom(activeRoomId)
      .then(res => {
        if (isMounted && res.room) {
          setRoomState(res.room);
        }
      })
      .catch(() => {
        // May not exist yet
      });

    const unsubscribe = subscribeToRoomStream(activeRoomId, undefined, (newState) => {
      if (isMounted) {
        setRoomState(newState);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeRoomId]);

  // Handle Create New Room
  const handleCreateNewRoom = async () => {
    if (questions.length === 0) {
      setError('يرجى إضافة سؤال واحد على الأقل قبل إطلاق المسابقة');
      return;
    }
    setError(null);
    setCreatingRoom(true);

    try {
      const res = await createRoom(adminToken, {
        title: quizTitle,
        questions,
        questionDuration
      });
      if (res.success) {
        setActiveRoomId(res.roomId);
        setHostToken(res.hostToken);
        setRoomState(res.room);
        setActiveTab('control');
      }
    } catch (err: any) {
      setError(err.message || 'فشل إنشاء الغرفة');
    } finally {
      setCreatingRoom(false);
    }
  };

  // Add Question to bank
  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQText.trim()) return;
    const filledOptions = newOptions.map(o => o.trim()).filter(Boolean);
    if (filledOptions.length < 2) {
      setError('يجب توفير خيارين على الأقل لكل سؤال');
      return;
    }

    const q: QuizQuestion = {
      id: 'custom_' + Date.now(),
      question: newQText.trim(),
      options: newOptions.map(o => o.trim() || 'خيار'),
      correctIndex: newCorrectIndex,
      explanation: newExplanation.trim() || undefined,
      timeLimit: questionDuration
    };

    setQuestions([...questions, q]);
    setNewQText('');
    setNewOptions(['', '', '', '']);
    setNewCorrectIndex(0);
    setNewExplanation('');
    setError(null);
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleLoadPreset = (presetQuestions: QuizQuestion[], title: string) => {
    setQuestions(JSON.parse(JSON.stringify(presetQuestions)));
    setQuizTitle(title);
  };

  // Host Controls
  const handleStartQuiz = async () => {
    if (!activeRoomId) return;
    try {
      await startQuiz(activeRoomId, hostToken);
    } catch (err: any) {
      setError(err.message || 'فشل بدء المسابقة');
    }
  };

  const handleMoveToDiscussion = async () => {
    if (!activeRoomId) return;
    try {
      await discussQuestion(activeRoomId, hostToken);
    } catch (err: any) {
      setError(err.message || 'فشل الانتقال لمرحلة النقاش');
    }
  };

  const handleNextQuestion = async () => {
    if (!activeRoomId) return;
    try {
      await nextQuestion(activeRoomId, hostToken);
    } catch (err: any) {
      setError(err.message || 'فشل الانتقال للسؤال التالي');
    }
  };

  const handleFinishQuiz = async () => {
    if (!activeRoomId) return;
    try {
      await finishQuiz(activeRoomId, hostToken);
    } catch (err: any) {
      setError(err.message || 'فشل إنهاء المسابقة');
    }
  };

  const handleResetQuiz = async () => {
    if (!activeRoomId) return;
    if (window.confirm('هل أنت متأكد من رغبتك في إعادة ضبط المسابقة وتصفير النتائج؟')) {
      try {
        await resetQuiz(activeRoomId, hostToken);
      } catch (err: any) {
        setError(err.message || 'فشل إعادة الضبط');
      }
    }
  };

  const shareableUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}?room=${activeRoomId}` 
    : `?room=${activeRoomId}`;

  const copyRoomLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const currentQNumber = (roomState?.currentQuestionIndex ?? 0) + 1;
  const totalQCount = roomState?.totalQuestions || questions.length;
  const isLastQuestion = currentQNumber >= totalQCount;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold mb-1">
            <span>لوحة تحكم المضيف (Admin)</span>
            <span>·</span>
            <span>المستخدم: admin</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">إدارة وغرفة تحكم المسابقة</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectRoomForPlaying && onSelectRoomForPlaying(activeRoomId)}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors border border-slate-700 flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>معاينة كلاعب</span>
          </button>

          <button
            onClick={onLogout}
            className="px-4 py-2 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors border border-rose-500/20 flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline hover:text-white">إغلاق</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-8 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('control')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'control' 
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10' 
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Play className="w-4 h-4" />
          <span>غرفة التحكم المباشر</span>
          {roomState && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-black/20 font-mono">
              {roomState.id}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'questions' 
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10' 
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>بنك وتخصيص الأسئلة ({questions.length})</span>
        </button>
      </div>

      {/* TAB 1: LIVE ROOM CONTROLS */}
      {activeTab === 'control' && (
        <div className="space-y-6">
          {/* Room Header & Share Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <span>رمز الغرفة الرسمي:</span>
                  <span className="font-mono text-lg font-bold text-amber-400 px-2.5 py-0.5 bg-slate-950 border border-amber-500/30 rounded-md">
                    {activeRoomId}
                  </span>
                  <span>·</span>
                  <span className="text-emerald-400">
                    {roomState?.status === 'LOBBY' && 'في الانتظار (Lobby)'}
                    {roomState?.status === 'QUESTION' && 'وقت السؤال نشط (30 ثانية)'}
                    {roomState?.status === 'DISCUSSION' && 'مرحلة النقاش مع المضيف 🎙️'}
                    {roomState?.status === 'FINAL_RESULTS' && 'انتهت المسابقة والنتائج معلنة 🏆'}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white">
                  {roomState?.title || quizTitle}
                </h2>
              </div>

              {/* Share link box */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <div className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-300 font-mono select-all truncate max-w-xs sm:max-w-md">
                  {shareableUrl}
                </div>
                <button
                  onClick={copyRoomLink}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'تم نسخ الرابط!' : 'نسخ رابط المشاركة'}</span>
                </button>
                <button
                  onClick={handleCreateNewRoom}
                  disabled={creatingRoom}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors border border-slate-700 flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إنشاء غرفة جديدة بالأسئلة الحالية</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Control Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Play className="w-4 h-4 text-amber-400" />
              <span>أزرار التحكم بالمسابقة ونقل الأسئلة</span>
            </h3>

            {/* In Lobby */}
            {roomState?.status === 'LOBBY' && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-center">
                <p className="text-slate-300 text-sm mb-4">
                  اللاعبون ينضمون الآن. عندما يكتمل حضور المشاركين، اضغط على الزر أدناه لبدء السؤال الأول فوراً.
                </p>
                <button
                  onClick={handleStartQuiz}
                  className="py-3 px-8 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-base rounded-xl transition-transform active:scale-95 shadow-lg shadow-emerald-500/20 inline-flex items-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>بدء المسابقة فوراً (السؤال 1 من {totalQCount})</span>
                </button>
              </div>
            )}

            {/* During Question */}
            {roomState?.status === 'QUESTION' && (
              <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                  <div>
                    <span className="text-xs text-amber-400 font-semibold">
                      السؤال {currentQNumber} من {totalQCount} · المهلة: 30 ثانية
                    </span>
                    <h4 className="text-lg font-bold text-white mt-1">
                      {roomState.currentQuestion?.question}
                    </h4>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleMoveToDiscussion}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>إيقاف المؤقت وبدء النقاش الآن 🎙️</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <div className="flex items-center justify-between mb-2">
                    <span>حالة إجابات اللاعبين:</span>
                    <span className="font-mono text-amber-400 font-bold">
                      {roomState.playersList.filter(p => p.hasAnsweredCurrent).length} / {roomState.playersList.length} لاعبين أجابوا
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-amber-400 h-2.5 transition-all duration-300"
                      style={{ 
                        width: `${roomState.playersList.length ? (roomState.playersList.filter(p => p.hasAnsweredCurrent).length / roomState.playersList.length) * 100 : 0}%` 
                      }}
                    />
                  </div>
                  <p className="mt-2 text-slate-400 text-[11px]">
                    النقاط تبدأ من 100 وتنقص تدريجياً مع مرور الوقت (خلال 30 ثانية).
                  </p>
                </div>
              </div>
            )}

            {/* During Discussion Phase */}
            {roomState?.status === 'DISCUSSION' && (
              <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                      <span>🎙️ مرحلة النقاش والمراجعة</span>
                      <span>·</span>
                      <span>السؤال {currentQNumber} من {totalQCount}</span>
                    </div>
                    <h4 className="text-lg font-bold text-white mt-1">
                      {roomState.currentQuestion?.question}
                    </h4>
                  </div>

                  {/* NEXT QUESTION BUTTON (Core user requirement!) */}
                  <div>
                    <button
                      onClick={handleNextQuestion}
                      className="py-3 px-6 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                    >
                      <span>
                        {isLastQuestion 
                          ? 'إنهاء المسابقة وعرض لوحة النتائج وتتويج الفائزين 🏆' 
                          : `الانتقال إلى السؤال التالي (${currentQNumber + 1} من ${totalQCount}) ⬅️`}
                      </span>
                      <ChevronRight className="w-4 h-4 rotate-180" />
                    </button>
                  </div>
                </div>

                {/* Show correct answer & explanation */}
                <div className="space-y-3 bg-slate-900 p-4 rounded-xl border border-slate-800 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">الإجابة الصحيحة:</span>
                    <span className="font-bold text-emerald-400">
                      {roomState.currentQuestion?.options[roomState.currentQuestion.correctIndex ?? 0]}
                    </span>
                  </div>
                  {roomState.currentQuestion?.explanation && (
                    <div className="text-xs text-slate-300 bg-slate-950/70 p-3 rounded-lg border border-slate-800 leading-relaxed">
                      <span className="font-semibold text-amber-400 block mb-1">ملاحظة ومعلومة للنقاش:</span>
                      {roomState.currentQuestion.explanation}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400">
                    💡 شاشات اللاعبين مجمدة الآن في وضع النقاش، ولن ينتقلوا للسؤال القادم إلا بعد نقرك على الزر الأخضر أعلاه.
                  </p>
                </div>
              </div>
            )}

            {/* During Final Results */}
            {roomState?.status === 'FINAL_RESULTS' && (
              <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Trophy className="w-6 h-6" />
                </div>
                <h4 className="text-xl font-bold text-white mb-2">
                  اكتملت المسابقة! لوحة الصدارة معلنة لجميع اللاعبين
                </h4>
                <p className="text-xs text-slate-400 max-w-lg mx-auto mb-6">
                  تم إعلان الترتيب النهائي وتتويج أصحاب المراكز الثلاثة الأولى على منصة التتويج الخاصة بهم.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={handleResetQuiz}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إعادة ضبط المسابقة لجولة جديدة</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Connected Players & Live Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Connected Players */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>اللاعبون المتصلون ({roomState?.playersList.length || 0})</span>
                </h3>
                <span className="text-xs text-slate-400">تحديث فوري تلقائي</span>
              </div>

              {(!roomState?.playersList || roomState.playersList.length === 0) ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  لا يوجد لاعبون متصلون حالياً. شارك الرابط أعلاه مع اللاعبين للانضمام!
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {roomState.playersList.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{p.avatar}</span>
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {p.isOnline ? (
                              <span className="w-2 h-2 rounded-full bg-emerald-500" title="متصل" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-slate-600" title="غير متصل" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                            {p.score} نقطة
                          </span>
                        </div>
                      </div>

                      {roomState.status === 'QUESTION' && (
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          p.hasAnsweredCurrent 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {p.hasAnsweredCurrent ? 'أجاب ✓' : 'يفكر...'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Current Leaderboard Standings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>لوحة الصدارة والترتيب الحالي</span>
                </h3>
                <span className="text-[11px] text-slate-400">حسب صحة الإجابة والسرعة</span>
              </div>

              {(!roomState?.leaderboard || roomState.leaderboard.length === 0) ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  ستظهر لوحة الصدارة بعد تسجيل أولى الإجابات والنقاط.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {roomState.leaderboard.map((entry) => {
                    const isTop3 = entry.rank <= 3;
                    const badgeEmoji = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
                    return (
                      <div
                        key={entry.id}
                        className={`p-3 rounded-xl border flex items-center justify-between ${
                          isTop3 
                            ? 'bg-slate-950 border-amber-500/30' 
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold min-w-6 text-center">{badgeEmoji}</span>
                          <span className="text-lg">{entry.avatar}</span>
                          <div>
                            <span className="text-sm font-bold text-white block">{entry.name}</span>
                            <span className="text-[11px] text-slate-400">
                              {entry.correctAnswersCount} صحيحة · {entry.totalTimeTaken}ث إجمالي
                            </span>
                          </div>
                        </div>

                        <div className="text-left font-mono font-bold text-amber-400 text-base tabular-nums">
                          {entry.score}
                          <span className="text-xs text-slate-500 font-sans mr-1">ن</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUESTIONS BANK & CUSTOMIZER */}
      {activeTab === 'questions' && (
        <div className="space-y-8">
          {/* Presets Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>تحميل بنوك أسئلة عربية جاهزة ومختارة:</span>
            </h3>
            <div className="flex flex-wrap gap-2.5">
              {PRESET_TOPICS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleLoadPreset(preset.questions, preset.title)}
                  className="px-3.5 py-2 text-xs font-semibold bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800 text-slate-200 rounded-xl transition-all"
                >
                  {preset.title} ({preset.questions.length} أسئلة)
                </button>
              ))}
            </div>
          </div>

          {/* Add New Question Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>إضافة سؤال اختيار من متعدد جديد</span>
            </h3>

            <form onSubmit={handleAddQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  نص السؤال
                </label>
                <input
                  type="text"
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  placeholder="مثال: كم عدد قارات العالم؟"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {newOptions.map((opt, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>الخيار {idx + 1}</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="correctOption"
                          checked={newCorrectIndex === idx}
                          onChange={() => setNewCorrectIndex(idx)}
                          className="accent-amber-500"
                        />
                        <span className={`text-[11px] ${newCorrectIndex === idx ? 'text-emerald-400 font-bold' : ''}`}>
                          الإجابة الصحيحة
                        </span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...newOptions];
                        copy[idx] = e.target.value;
                        setNewOptions(copy);
                      }}
                      placeholder={`نص الخيار رقم ${idx + 1}`}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  شرح توضيحي أو معلومة إضافية للنقاش (تظهر للمشاركين بعد إجابة السؤال)
                </label>
                <input
                  type="text"
                  value={newExplanation}
                  onChange={(e) => setNewExplanation(e.target.value)}
                  placeholder="مثال: يبلغ عدد قارات العالم 7 قارات وهي آسيا، إفريقيا، أوروبا..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>مهلة السؤال:</span>
                  <span className="font-mono text-amber-400 font-bold">30 ثانية</span>
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-md"
                >
                  إضافة السؤال إلى القائمة
                </button>
              </div>
            </form>
          </div>

          {/* Current Questions List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">
                الأسئلة الحالية المجهزة للمسابقة ({questions.length})
              </h3>
              <button
                onClick={handleCreateNewRoom}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-colors"
              >
                تطبيق وحفظ في غرفة جديدة
              </button>
            </div>

            <div className="space-y-3">
              {questions.map((q, qIdx) => (
                <div
                  key={q.id || qIdx}
                  className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono text-amber-400 font-bold ml-2">#{qIdx + 1}</span>
                      <span className="text-sm font-bold text-white">{q.question}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      title="حذف السؤال"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    {q.options.map((opt, optIdx) => (
                      <div
                        key={optIdx}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                          optIdx === q.correctIndex
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {opt} {optIdx === q.correctIndex && '✓'}
                      </div>
                    ))}
                  </div>

                  {q.explanation && (
                    <p className="text-[11px] text-slate-400 pt-1">
                      💡 {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
