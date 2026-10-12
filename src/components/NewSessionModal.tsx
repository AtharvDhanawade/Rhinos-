import React, { useState, useEffect } from 'react';
import { Clock, Plus, X, Layers, Calendar, Check, AlertCircle, Save } from 'lucide-react';
import { ClassSubject } from '../types';

interface ExistingSessionSummary {
  id: string;
  title: string;
  time: string;
  markedCount: number;
}

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentClass: ClassSubject;
  existingSessions: ExistingSessionSummary[];
  onStartSession: (sessionTitle: string, sessionTime: string) => void;
}

export const NewSessionModal: React.FC<NewSessionModalProps> = ({
  isOpen,
  onClose,
  currentClass,
  existingSessions,
  onStartSession,
}) => {
  const getOrdinalTitle = (num: number) => {
    if (num === 1) return '1st Class';
    if (num === 2) return '2nd Class';
    if (num === 3) return '3rd Class';
    if (num === 4) return '4th Class';
    if (num === 5) return '5th Class';
    return `${num}th Class`;
  };

  const nextSessionNumber = existingSessions.length + 1;
  const defaultTitle = getOrdinalTitle(nextSessionNumber);

  // Compute a default time 2 hours after existing or afternoon default
  const getDefaultTime = () => {
    const d = new Date();
    const currentHour = d.getHours();
    if (currentHour < 12) {
      return '02:00 PM - 03:00 PM';
    } else if (currentHour < 15) {
      return '03:30 PM - 04:30 PM';
    }
    const endHour = (currentHour + 1) % 24;
    const formatH = (h: number) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, '0')}:00 ${ampm}`;
    };
    return `${formatH(currentHour)} - ${formatH(endHour)}`;
  };

  const [sessionTitle, setSessionTitle] = useState(defaultTitle);
  const [sessionTime, setSessionTime] = useState(getDefaultTime());

  useEffect(() => {
    if (isOpen) {
      setSessionTitle(getOrdinalTitle(nextSessionNumber));
      setSessionTime(getDefaultTime());
    }
  }, [isOpen, nextSessionNumber]);

  if (!isOpen) return null;

  const titlePresets = ['2nd Class', '3rd Class', '4th Class', 'Lecture 2', 'Lecture 3', 'Lab Session', 'Tutorial', 'Extra Class', 'Remedial'];
  const timePresets = (currentClass.classTimes && currentClass.classTimes.length > 0)
    ? currentClass.classTimes
    : [
        '09:00 AM - 10:00 AM',
        '10:00 AM - 11:00 AM',
        '11:15 AM - 12:15 PM',
        '01:00 PM - 02:00 PM',
        '02:00 PM - 03:00 PM',
        '03:00 PM - 04:00 PM',
      ];

  const handleNowTime = () => {
    const d = new Date();
    const startStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    d.setHours(d.getHours() + 1);
    const endStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSessionTime(`${startStr} - ${endStr}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionTitle.trim()) return;
    onStartSession(sessionTitle.trim(), sessionTime.trim() || getDefaultTime());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />

      <div className="relative bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 z-10 flex flex-col max-h-[90vh]">
        {/* Top Decorative Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
                Add New Session For The Day
              </h3>
              <p className="text-xs text-slate-500">
                Multiple sessions per day (1st class at xx time, 2nd class at yy time, 3rd class...)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
          {/* Existing Sessions Overview */}
          {existingSessions.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Existing Sessions for {currentClass.name} Today ({existingSessions.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {existingSessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center gap-1.5 shadow-2xs"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <strong className="font-semibold text-slate-900">{sess.title}</strong>
                    <span className="text-[10px] text-slate-500 font-mono">({sess.time})</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-md font-mono">
                      {sess.markedCount} marked
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Class indicator */}
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Selected Class:</span>
            <span className="font-bold text-blue-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentClass.color }} />
              <span>{currentClass.name}</span>
              <span className="font-mono text-slate-500">({currentClass.code})</span>
            </span>
          </div>

          {/* Session Title Input */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Session / Lecture Name
            </label>
            <input
              type="text"
              id="new-session-title-input"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="e.g. 2nd Class, 3rd Class, Lecture 3, Lab Session"
              required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
            {/* Quick Title Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {titlePresets.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSessionTitle(preset)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition ${
                    sessionTitle === preset
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Session Time Input (Manual Entry Above & Presets Below) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Session Time (Enter Manually):</span>
              </label>
              <button
                type="button"
                onClick={handleNowTime}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
              >
                Set Current Hour
              </button>
            </div>
            <input
              type="text"
              id="new-session-time-input"
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
              placeholder="e.g. 02:00 PM - 03:00 PM (or enter manually)"
              required
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-2xs"
            />
            {/* Custom Class Time Chips (Presents the custom ones entered) */}
            <div className="mt-2.5">
              <div className="text-[11px] font-bold text-slate-500 mb-1">
                Custom Class Times (Presets):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {timePresets.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSessionTime(preset)}
                    className={`text-xs px-2.5 py-1 rounded-xl font-mono transition cursor-pointer flex items-center gap-1 ${
                      sessionTime === preset
                        ? 'bg-blue-600 text-white font-bold shadow-2xs border border-blue-600'
                        : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-900 border border-slate-200'
                    }`}
                  >
                    <Clock className="w-3 h-3 opacity-60" />
                    <span>{preset}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Explanatory note */}
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Clean Slate for {sessionTitle}:</strong> All students will be ready to be marked for this session. Your earlier attendance records from earlier classes today remain safely stored and untouched.
            </p>
          </div>

          {/* Sticky Action buttons Footer - Always visible so save option is never hidden */}
          <div className="sticky bottom-0 bg-white pt-3 pb-1 border-t border-slate-200 flex items-center justify-end gap-3 z-10 shrink-0 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="confirm-start-session-btn"
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-500/25 flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save & Start {sessionTitle} Attendance</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
