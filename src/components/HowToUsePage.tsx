import React, { useState } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  Keyboard, 
  Users, 
  GraduationCap, 
  Table2, 
  QrCode, 
  CheckCircle2, 
  ArrowRight, 
  AlertTriangle, 
  Volume2, 
  FileSpreadsheet, 
  Layers, 
  Hash, 
  Zap, 
  ShieldCheck, 
  Copy, 
  Smartphone,
  ExternalLink,
  Play,
  RotateCcw,
  Clock,
  UserCheck
} from 'lucide-react';
import { playSuccessBeep, playDuplicateWarning, playErrorBuzz } from '../utils/audio';

interface HowToUsePageProps {
  onNavigate: (tab: 'fast-entry' | 'students' | 'classes' | 'sheets') => void;
}

export const HowToUsePage: React.FC<HowToUsePageProps> = ({ onNavigate }) => {
  // Interactive Sandbox Simulator State (Demo Playground)
  const [demoInput, setDemoInput] = useState('');
  const [demoLogs, setDemoLogs] = useState<Array<{
    code: string;
    name: string;
    roll: string;
    time: string;
    status: 'present' | 'duplicate' | 'error';
    message: string;
  }>>([
    {
      code: '1042',
      name: 'Sample Student A',
      roll: '2026CS1042',
      time: '10:02 AM',
      status: 'present',
      message: 'Marked Present ✓ (Sound chimed)'
    }
  ]);
  const [demoFeedback, setDemoFeedback] = useState<string | null>(null);

  // Handle Demo Simulator submission
  const handleSimulateSubmit = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (trimmed === '1042') {
      // Duplicate test
      playDuplicateWarning();
      setDemoFeedback('⚠️ Duplicate Warning: 1042 is already marked! Buzzer played.');
      setDemoLogs(prev => [
        {
          code: '1042',
          name: 'Sample Student A',
          roll: '2026CS1042',
          time: nowStr,
          status: 'duplicate',
          message: 'Duplicate attempt blocked! Warning sound played.'
        },
        ...prev
      ]);
    } else if (trimmed === '1005' || trimmed === '2048' || trimmed.length === 4) {
      // Success test
      playSuccessBeep();
      setDemoFeedback(`✓ Success! Marked attendance for Last 4: ${trimmed}. Success chime played.`);
      setDemoLogs(prev => [
        {
          code: trimmed,
          name: `Student (${trimmed})`,
          roll: `2026CS${trimmed}`,
          time: nowStr,
          status: 'present',
          message: 'Marked Present ✓'
        },
        ...prev
      ]);
    } else {
      // Error test
      playErrorBuzz();
      setDemoFeedback('❌ Invalid code: Must be 4 digits. Error buzz played.');
    }

    setDemoInput('');
  };

  const handleResetSimulator = () => {
    setDemoLogs([]);
    setDemoFeedback(null);
    setDemoInput('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* Header Hero Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-blue-100 text-xs font-semibold mb-3 border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span>Class Representative (CR) Guide & Live Interactive Demo</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            How to Use the CR Attendance System
          </h1>
          <p className="mt-2.5 text-blue-100 text-sm sm:text-base leading-relaxed">
            Designed specifically for college Class Representatives. Mark attendance for a class of 60+ students in under 60 seconds using 4-digit rapid keypad entry, organize by class (Tech, Communication, etc.), and provide teachers with a live QR-synced Google Sheets portal.
          </p>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <button
              onClick={() => onNavigate('fast-entry')}
              className="px-4 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Go to Fast 4-Digit Entry</span>
            </button>
            <button
              onClick={() => onNavigate('students')}
              className="px-4 py-2.5 bg-blue-600/60 hover:bg-blue-600 text-white font-semibold rounded-xl text-xs sm:text-sm border border-white/20 transition flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              <span>Manage Student Roster</span>
            </button>
            <button
              onClick={() => onNavigate('sheets')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Google Sheets Sync</span>
            </button>
          </div>
        </div>

        {/* Decorative corner visual */}
        <div className="hidden lg:block absolute -right-6 -bottom-10 opacity-15 pointer-events-none">
          <BookOpen className="w-80 h-80 text-white" />
        </div>
      </div>

      {/* Quick Visual Flow Diagram (4 Core Pages) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1 */}
        <div 
          onClick={() => onNavigate('fast-entry')}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
              <Keyboard className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Page 1</span>
            <h3 className="font-bold text-slate-900 text-base mt-0.5 group-hover:text-blue-600 transition">
              Fast 4-Digit Keypad
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Students call out their last 4 digits. You type <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-bold">1042</code> + <kbd className="bg-slate-100 border px-1 rounded">Enter</kbd>. Chime plays and attendance is marked!
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-blue-600 gap-1">
            <span>Open Fast Entry</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 2 */}
        <div 
          onClick={() => onNavigate('students')}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-violet-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-violet-600 uppercase tracking-wider">Page 2</span>
            <h3 className="font-bold text-slate-900 text-base mt-0.5 group-hover:text-violet-600 transition">
              Roster & Bulk Import
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Add your students with full roll numbers, phones, and emails. The app auto-extracts the last 4 digits. Supports 1-click bulk paste from Excel/Sheets.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-violet-600 gap-1">
            <span>Open Student Roster</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 3 */}
        <div 
          onClick={() => onNavigate('classes')}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-amber-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Page 3</span>
            <h3 className="font-bold text-slate-900 text-base mt-0.5 group-hover:text-amber-600 transition">
              Class & Roll-Call Modes
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Select <strong>Tech Class</strong> or <strong>Communication Class</strong>. Switch to full-screen Roll Call mode to announce 4-digit codes sequentially.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-amber-600 gap-1">
            <span>Open Class Hub</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Card 4 */}
        <div 
          onClick={() => onNavigate('sheets')}
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Page 4</span>
            <h3 className="font-bold text-slate-900 text-base mt-0.5 group-hover:text-emerald-600 transition">
              Sheets & Teacher QR
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              1 Week = 1 Sheet architecture with live formulas. Professors scan the on-screen QR with their phone to view the weekly attendance sheet in real-time.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-emerald-600 gap-1">
            <span>Open Google Sheets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

      </div>

      {/* SECTION 1: Interactive Sandbox Playground */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Live Interactive Sandbox
              </span>
              <span className="text-xs text-slate-400">Test the sounds and flow without modifying real data</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Try It Right Here: 4-Digit Entry Demo
            </h2>
          </div>
          <button
            onClick={handleResetSimulator}
            className="self-start md:self-auto px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Logs</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          
          {/* Simulator Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Simulate 4-Digit Input:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={4}
                  value={demoInput}
                  onChange={(e) => setDemoInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSimulateSubmit(demoInput);
                  }}
                  placeholder="e.g. 1042"
                  className="px-4 py-3 bg-slate-800 text-white font-mono text-xl tracking-widest rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                />
                <button
                  onClick={() => handleSimulateSubmit(demoInput)}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition shadow-md shrink-0 flex items-center gap-1.5"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Enter</span>
                </button>
              </div>
            </div>

            {/* Quick Test Triggers */}
            <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Click a Sample Test Case:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSimulateSubmit('2048')}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-emerald-700/80 text-xs font-semibold rounded-lg transition flex items-center gap-1 border border-slate-600"
                >
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Test Success (Chime)</span>
                </button>
                <button
                  onClick={() => handleSimulateSubmit('1042')}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-amber-700/80 text-xs font-semibold rounded-lg transition flex items-center gap-1 border border-slate-600"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Test Duplicate (Warning)</span>
                </button>
                <button
                  onClick={() => handleSimulateSubmit('12')}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-rose-700/80 text-xs font-semibold rounded-lg transition flex items-center gap-1 border border-slate-600"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Test Short Error (Buzz)</span>
                </button>
              </div>
            </div>

            {demoFeedback && (
              <div className={`p-3 rounded-xl text-xs font-medium border ${
                demoFeedback.includes('✓') 
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
                  : demoFeedback.includes('⚠️')
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}>
                {demoFeedback}
              </div>
            )}
          </div>

          {/* Simulator Live Feed (7 cols) */}
          <div className="lg:col-span-7 bg-slate-950 rounded-2xl p-4 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Simulator Terminal
                </span>
                <span>{demoLogs.length} Events Logged</span>
              </div>

              <div className="space-y-2 mt-3 max-h-56 overflow-y-auto pr-1">
                {demoLogs.map((log, idx) => (
                  <div 
                    key={idx}
                    className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                      log.status === 'present'
                        ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-200'
                        : log.status === 'duplicate'
                        ? 'bg-amber-900/20 border-amber-500/30 text-amber-200'
                        : 'bg-rose-900/20 border-rose-500/30 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold bg-white/10 px-1.5 py-0.5 rounded text-white">
                        {log.code}
                      </span>
                      <span className="font-medium text-white">{log.name}</span>
                      <span className="text-[11px] opacity-75">({log.roll})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold">{log.message}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{log.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 pt-3 border-t border-slate-900 mt-2">
              Note: This is a sandbox preview to demonstrate the instant speed and audio cues.
            </p>
          </div>

        </div>
      </div>

      {/* SECTION 2: In-Depth Breakdown of Each Page */}
      <div className="space-y-8">
        
        {/* Step 1 */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
              1
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Page 1 • Speed Mode
                </span>
                <span className="text-xs text-slate-400">Primary CR Screen</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Fast 4-Digit Roll Number Attendance
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                This is the main screen you will use during class lectures or lab sessions.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    How It Works in Class
                  </h4>
                  <ul className="text-xs text-slate-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">1.</span>
                      <span>The student calls out their 4-digit code (e.g. <strong>1042</strong>).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">2.</span>
                      <span>You type <code className="bg-white border px-1 rounded font-mono font-bold text-slate-800">1042</code> and hit <kbd className="bg-white border px-1 rounded font-mono">Enter</kbd> (or enable the <em>Auto-submit on 4th digit</em> switch).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">3.</span>
                      <span>A pleasant audio chime plays, student name & roll no appear in green, and the record is instantly saved.</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Built-in Safeguards
                  </h4>
                  <ul className="text-xs text-slate-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-amber-600">Anti-Duplicate:</span>
                      <span>If someone tries to mark the same roll number twice, a loud warning sound plays and shows the exact time they already marked.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-rose-600">Unregistered Roll Alert:</span>
                      <span>If a code does not match any registered student, an error buzzer sounds.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">Remaining Drawer:</span>
                      <span>Click <em>&quot;Unmarked (X)&quot;</em> in the top-right to see exactly which students haven&apos;t responded yet.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">Supports physical keyboard numpad, touch screens, and on-screen buttons.</span>
                <button
                  onClick={() => onNavigate('fast-entry')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>Open Fast Entry</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md shadow-violet-500/20">
              2
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                  Page 2 • Roster Setup
                </span>
                <span className="text-xs text-slate-400">Student Directory</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Adding, Editing & Bulk Importing Students
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Add your real class members. All data stays saved in your browser storage.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-2">
                    <UserCheck className="w-4 h-4 text-violet-600" />
                    Individual Add & Auto-Extract
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed mb-2">
                    When adding a student, enter their official university roll number (e.g., <code className="bg-white px-1 border rounded text-slate-800 font-bold">2026CS1042</code>).
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The app <strong>automatically extracts the last 4 numeric digits</strong> (<code className="bg-blue-100 text-blue-700 font-bold px-1 rounded">1042</code>) for instant fast entry on Page 1! You can also edit their phone number, email, and section at any time.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-2">
                    <FileSpreadsheet className="w-4 h-4 text-violet-600" />
                    1-Second Bulk Import (From Excel / Sheets)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed mb-2">
                    Have an Excel sheet or WhatsApp class list? Click <strong>Bulk Import / Paste</strong>.
                  </p>
                  <div className="bg-slate-100 p-2 rounded-lg font-mono text-[11px] text-slate-700">
                    2026CS1001, Student Name, 9876543210, email@college.edu<br/>
                    2026CS1002, Second Student, 9876543211, email2@college.edu
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Paste 60+ rows, click Import, and your whole class roster is ready immediately.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">Export roster anytime via CSV for offline backup.</span>
                <button
                  onClick={() => onNavigate('students')}
                  className="text-xs font-bold text-violet-600 hover:text-violet-700 flex items-center gap-1"
                >
                  <span>Open Student Roster</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
              3
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  Page 3 • Multi-Subject Hub
                </span>
                <span className="text-xs text-slate-400">Tech & Communication Classes</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Switching Classes & Alternate Roll-Call Mode
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Take separate attendance for different subjects. Each subject maintains its own weekly sheets.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-2">
                    <Layers className="w-4 h-4 text-amber-600" />
                    Selecting Your Active Class
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    By default you have <strong>Tech Class</strong> and <strong>Communication Class</strong> pre-configured. Simply tap a class card to switch subjects. You can also add more subjects or modify room details anytime.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-2">
                    <Volume2 className="w-4 h-4 text-amber-600" />
                    Option 2: Big-Screen Roll Call
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed mb-1.5">
                    If you prefer calling out roll numbers yourself, click <strong>Launch Roll Call Mode</strong> on Page 3.
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    A giant card displays each student&apos;s 4 digits in high contrast. Use keyboard keys: <kbd className="bg-white border px-1 rounded font-mono font-bold">P</kbd> or <kbd className="bg-white border px-1 rounded font-mono">Enter</kbd> for Present, <kbd className="bg-white border px-1 rounded font-mono font-bold">A</kbd> for Absent, and arrow keys to step through.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">Switch classes easily from the top navigation bar at any time.</span>
                <button
                  onClick={() => onNavigate('classes')}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  <span>Open Classes Hub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
              4
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Page 4 • Real-Time Google Sheets
                </span>
                <span className="text-xs text-slate-400">Teacher QR Scanner</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                1 Week 1 Sheet & Teacher QR Code Portal
              </h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Whenever you mark attendance on Page 1 or Page 3, it automatically populates the weekly Google Sheet format.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 font-bold">
                    <Table2 className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">1 Week = 1 Sheet Tab</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Organized just like a multi-tab Google Spreadsheet. Week 1, Week 2, Week 3... Each tab shows Mon to Fri attendance with live percentage formulas.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 font-bold">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">Teacher QR Code</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    When your teacher wants to see the attendance, show them the QR Code on Page 4. When they scan it with their camera, it opens their live sheet instantly!
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 font-bold">
                    <Copy className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">1-Click Paste to Real Sheets</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Click <strong>Copy Formatted for Google Sheets</strong>, open any blank spreadsheet at <a href="https://docs.google.com/spreadsheets" target="_blank" rel="noreferrer" className="text-blue-600 underline">docs.google.com</a>, and press <kbd className="bg-white border px-1 rounded font-mono">Ctrl+V</kbd>.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">Supports direct CSV downloads and printing.</span>
                <button
                  onClick={() => onNavigate('sheets')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <span>Open Google Sheets Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Frequently Asked Questions (FAQ) for CRs */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <h3 className="font-bold text-slate-900 text-lg mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <span>Frequently Asked Questions & Pro Tips</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <h5 className="font-bold text-slate-900 mb-1">Can I use this on my mobile phone?</h5>
            <p className="text-slate-600 leading-relaxed">
              Yes! The app is 100% responsive. On phone screens, an on-screen numpad appears so you can tap 4 digits with your thumb easily while walking around the classroom.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <h5 className="font-bold text-slate-900 mb-1">Does this work offline without Wi-Fi?</h5>
            <p className="text-slate-600 leading-relaxed">
              Yes! All records, student rosters, and class settings are stored in local browser persistence. You don&apos;t need an active internet connection to mark attendance.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <h5 className="font-bold text-slate-900 mb-1">What if a student is late or absent?</h5>
            <p className="text-slate-600 leading-relaxed">
              In Page 1, marked students appear in the live feed on the right. You can click <strong>&quot;Mark Late (L)&quot;</strong> or <strong>&quot;Mark Absent (A)&quot;</strong> at any time to update their status.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <h5 className="font-bold text-slate-900 mb-1">How do I back up my attendance?</h5>
            <p className="text-slate-600 leading-relaxed">
              On Page 4, you can click <strong>&quot;Download CSV&quot;</strong> to export an Excel-ready spreadsheet, or click <strong>&quot;Copy Formatted for Google Sheets&quot;</strong> to paste directly into your college Google Drive.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
