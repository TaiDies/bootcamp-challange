import React from 'react';
import { Clock, Zap, MessageSquare, Trophy, ShieldCheck } from 'lucide-react';

interface HowToPlayProps {
  onStartPlaying: () => void;
}

export const HowToPlay: React.FC<HowToPlayProps> = ({ onStartPlaying }) => {
  return (
    <div className="max-w-3xl mx-auto my-8 px-4 space-y-6">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          طريقة اللعب ونظام احتساب النقاط والسرعة
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          دليل إرشادي لقواعد المسابقة التفاعلية وكيفية تأكيد فوز المراكز الثلاثة الأولى
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rule 1 */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <div className="w-10 h-10 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">1. مهلة 30 ثانية لكل سؤال</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            يمنح النظام 30 ثانية بالضبط لكل سؤال اختيار من متعدد. تظهر شاشة تفاعلية بمؤقت زمني تنازلي مع تنبيهات صوتية عند اقتراب انتهاء الوقت.
          </p>
        </div>

        {/* Rule 2 */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center font-bold">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">2. النقاط تنقص مع مرور الوقت</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            يبدأ السؤال بقيمة 100 نقطة، وتنقص القيمة تدريجياً مع كل ثانية تمضي. اللاعب الأسرع في تقديم الإجابة الصحيحة يحصد أعلى قدر من النقاط (حتى 100 نقطة). الإجابة الخاطئة = 0 نقطة.
          </p>
        </div>

        {/* Rule 3 */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center font-bold">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">3. مرحلة النقاش بين الأسئلة</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            بعد انتهاء وقت السؤال، تكشف المنصة الإجابة الصحيحة والشرح. وتبقى الشاشة في وضع النقاش حتى يضغط المضيف على زر "السؤال التالي" ليتيح فرصة النقاش والتحليل بين المشاركين.
          </p>
        </div>

        {/* Rule 4 */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
          <div className="w-10 h-10 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center font-bold">
            <Trophy className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">4. منصة التتويج للمراكز الثلاثة الأولى</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            في ختام المسابقة، يتم إعلان الترتيب الكامل وتخصيص صفحة احتفالية استثنائية لأصحاب المراكز الثلاثة الأولى (🥇🥈🥉) مع لوحة صدارة تفصيلية لجميع المشاركين.
          </p>
        </div>
      </div>

      {/* Admin credentials note */}
      <div className="p-5 bg-slate-900/60 border border-amber-500/30 rounded-2xl flex items-start gap-4">
        <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <span className="font-bold text-white block">معلومات الدخول للمضيف:</span>
          <p className="text-slate-300">
            اسم المستخدم: <code className="bg-slate-950 px-2 py-0.5 rounded text-amber-400 font-mono">admin</code> · 
            كلمة المرور: <code className="bg-slate-950 px-2 py-0.5 rounded text-amber-400 font-mono">Hammam55%</code>
          </p>
          <p className="text-slate-400">
            يمكن للمضيف إنشاء غرف مخصصة، إضافة أسئلة من بنوك الأسئلة الجاهزة، ومشاركة الرابط المباشر مع اللاعبين.
          </p>
        </div>
      </div>

      <div className="text-center pt-4">
        <button
          onClick={onStartPlaying}
          className="py-3 px-8 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg"
        >
          الانتقال إلى ساحة اللعب والانضمام
        </button>
      </div>
    </div>
  );
};
