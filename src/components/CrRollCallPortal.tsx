import React, { useState, useEffect } from 'react';
import { Student, ClassSubject, AttendanceRecord, AttendanceStatus } from '../types';
import { 
  CheckCircle2, 
  XCircle, 
  Send, 
  Clock, 
  Search, 
  RotateCcw, 
  CheckCheck, 
  UserX, 
  Sparkles, 
  Calendar,
  Smartphone,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSuccessBeep } from '../utils/audio';
import { firebaseBatchMarkAttendance } from '../utils/firebaseSync';
import { sortStudentsByLast4Digits } from '../utils/storage';

interface CrRollCallPortalProps {
  students: Student[];
  classes: ClassSubject[];
  initialClassId?: string;
  onStandaloneBack?: () => void;
  onSubmissionSuccess?: (submission: any) => void;
}

export const CrRollCallPortal: React.FC<CrRollCallPortalProps> = ({
  students,
  classes,
  initialClassId,
  onStandaloneBack,
  onSubmissionSuccess
}) => {
  const [selectedClassId, setSelectedClassId] = useState(
    initialClassId && classes.some(c => c.id === initialClassId)
      ? initialClassId
      : classes[0]?.id || 'cls-tech'
  );

  const selectedClass = classes.find(c => c.id === selectedClassId) || classes[0] || {
    id: 'cls-tech',
    name: 'Tech Class',
    code: 'CS401',
    teacherName: 'Faculty Incharge',
    room: 'Lab 402',
    color: '#2563eb'
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const [sessionDate, setSessionDate] = useState(todayStr);
  const [sessionTime, setSessionTime] = useState(() => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Lecture';
  });

  // Roll call status map: studentId -> 'present' | 'absent' | null (unmarked)
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>(() => {
    // Default: initialize all as 'present' so CR only needs to tap the absentees!
    const init: Record<string, AttendanceStatus> = {};
    students.forEach(s => {
      init[s.id] = 'present';
    });
    return init;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'absent' | 'present'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    message: string;
    presentCount: number;
    absentCount: number;
    time: string;
  } | null>(null);

  // Filter students based on search and mode, sorted in ascending order of last 4 digits
  const filteredStudents = sortStudentsByLast4Digits(
    students.filter(s => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        s.name.toLowerCase().includes(q) || 
        s.rollNo.toLowerCase().includes(q) || 
        s.last4Digits.includes(q);

      if (!matchesSearch) return false;

      const status = statusMap[s.id];
      if (filterMode === 'absent') return status === 'absent';
      if (filterMode === 'present') return status === 'present';
      return true;
    })
  );

  const presentCount = students.filter(s => statusMap[s.id] === 'present').length;
  const absentCount = students.filter(s => statusMap[s.id] === 'absent').length;
  const unmarkedCount = students.length - (presentCount + absentCount);

  const toggleStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setStatusMap(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach(s => {
      next[s.id] = status;
    });
    setStatusMap(next);
  };

  const handleSubmitAttendance = async () => {
    setIsSubmitting(true);
    setSubmissionResult(null);

    const records: AttendanceRecord[] = students.map(s => {
      const st = statusMap[s.id] || 'present';
      return {
        id: `cr-rec-${s.id}-${selectedClass.id}-${sessionDate}-${Date.now()}`,
        studentId: s.id,
        studentRollNo: s.rollNo,
        studentName: s.name,
        studentLast4: s.last4Digits,
        classId: selectedClass.id,
        className: selectedClass.name,
        date: sessionDate,
        time: new Date().toTimeString().split(' ')[0],
        status: st,
        weekNumber: 1,
        dayOfWeek: new Date(sessionDate).getDay(),
        markedVia: 'roll_call',
        timestamp: Date.now(),
        sessionId: 'session-1',
        sessionTime: sessionTime.trim(),
        sessionTitle: `${selectedClass.name} Session`
      };
    });

    try {
      const res = await fetch('/api/attendance/cr-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selectedClass.id,
          className: selectedClass.name,
          date: sessionDate,
          time: sessionTime.trim(),
          records,
          submittedBy: 'Class Representative (CR Mobile)'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Also sync directly to Firebase Firestore
        firebaseBatchMarkAttendance(records).catch(() => {});

        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        playSuccessBeep();

        const resultInfo = {
          success: true,
          message: `Attendance received on Admin Laptop!`,
          presentCount,
          absentCount,
          time: sessionTime.trim()
        };
        setSubmissionResult(resultInfo);
        if (onSubmissionSuccess) {
          onSubmissionSuccess(data.submission);
        }
      } else {
        alert(data.error || 'Could not submit attendance to Admin laptop.');
      }
    } catch (err: any) {
      alert(`Network error: ${err.message || 'Could not reach server'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-32">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onStandaloneBack && (
              <button
                type="button"
                onClick={onStandaloneBack}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                  CR Mobile Roll Call
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h1 className="font-extrabold text-base sm:text-lg text-white truncate max-w-[200px] sm:max-w-xs">
                {selectedClass.name}
              </h1>
            </div>
          </div>

          {/* Class Switcher */}
          {classes.length > 1 && (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Date & Time Settings Strip */}
        <div className="max-w-2xl mx-auto mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-slate-300">{sessionDate}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <input
              type="text"
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
              placeholder="e.g. 10:00 AM"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-semibold text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36"
              title="Enter session / lecture time"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto w-full px-4 pt-4 flex-1">
        {/* Success Banner if just submitted */}
        {submissionResult && (
          <div className="mb-4 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500 text-emerald-100 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  Attendance Sent to Admin Laptop!
                </h3>
                <p className="text-xs text-emerald-300 mt-0.5">
                  Class: <strong>{selectedClass.name}</strong> • Time: <strong>{submissionResult.time}</strong>
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs font-bold">
                  <span className="bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-700">
                    🟢 {submissionResult.presentCount} Present
                  </span>
                  <span className="bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800 text-rose-300">
                    🔴 {submissionResult.absentCount} Absent
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Counters */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
            <strong className="text-lg font-black text-white">{students.length}</strong>
          </div>
          <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-2xl p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block">Present (P)</span>
            <strong className="text-lg font-black text-emerald-400">{presentCount}</strong>
          </div>
          <div className="bg-rose-950/40 border border-rose-800/50 rounded-2xl p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-rose-400 block">Absent (A)</span>
            <strong className="text-lg font-black text-rose-400">{absentCount}</strong>
          </div>
        </div>

        {/* Quick Batch Controls & Search */}
        <div className="space-y-2 mb-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by last 4 digits, roll, or student name..."
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {/* Quick Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleMarkAll('present')}
                className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-700/60 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>All P</span>
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll('absent')}
                className="px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-700/60 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>All A</span>
              </button>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2 py-1 rounded-md font-bold transition cursor-pointer ${
                  filterMode === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({students.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('absent')}
                className={`px-2 py-1 rounded-md font-bold transition cursor-pointer ${
                  filterMode === 'absent' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:text-rose-200'
                }`}
              >
                Absentees ({absentCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('present')}
                className={`px-2 py-1 rounded-md font-bold transition cursor-pointer ${
                  filterMode === 'present' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-emerald-200'
                }`}
              >
                Present ({presentCount})
              </button>
            </div>
          </div>
        </div>

        {/* Student Roll Call List ("the roll call way: all numbers with p or a pops up") */}
        <div className="space-y-2">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center bg-slate-800/40 rounded-2xl border border-slate-800 text-slate-400 text-sm">
              No students found matching your search.
            </div>
          ) : (
            filteredStudents.map((std, idx) => {
              const currentStatus = statusMap[std.id] || 'present';
              const isPresent = currentStatus === 'present';
              const isAbsent = currentStatus === 'absent';

              return (
                <div
                  key={std.id}
                  className={`p-3 rounded-2xl border transition-all duration-150 flex items-center justify-between gap-3 ${
                    isAbsent
                      ? 'bg-rose-950/20 border-rose-800/70 shadow-xs'
                      : 'bg-slate-800/70 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {/* Left: Roll Number Badge & Name */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Big 4-Digit Roll Badge */}
                    <div
                      className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-mono font-black shrink-0 transition ${
                        isAbsent
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-700 text-emerald-400 border border-slate-600'
                      }`}
                    >
                      <span className="text-[9px] uppercase tracking-tighter opacity-80 leading-none">ROLL</span>
                      <span className="text-sm font-black leading-none mt-0.5">{std.last4Digits}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm text-white truncate">{std.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded">
                          {std.rollNo}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>#{idx + 1}</span>
                        <span>•</span>
                        <span className={isAbsent ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                          {isAbsent ? '🔴 ABSENT' : '🟢 PRESENT'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Big [ P ] and [ A ] Toggle Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* [ P ] Button */}
                    <button
                      type="button"
                      onClick={() => toggleStudentStatus(std.id, 'present')}
                      className={`w-12 h-11 rounded-xl font-black text-sm transition-all duration-100 flex flex-col items-center justify-center cursor-pointer ${
                        isPresent
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400 scale-105'
                          : 'bg-slate-700/70 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                      title={`Mark ${std.name} Present`}
                    >
                      <span className="text-base leading-none">P</span>
                      <span className="text-[8px] font-semibold leading-none mt-0.5">Present</span>
                    </button>

                    {/* [ A ] Button */}
                    <button
                      type="button"
                      onClick={() => toggleStudentStatus(std.id, 'absent')}
                      className={`w-12 h-11 rounded-xl font-black text-sm transition-all duration-100 flex flex-col items-center justify-center cursor-pointer ${
                        isAbsent
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400 scale-105'
                          : 'bg-slate-700/70 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                      title={`Mark ${std.name} Absent`}
                    >
                      <span className="text-base leading-none">A</span>
                      <span className="text-[8px] font-semibold leading-none mt-0.5">Absent</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Sticky Bottom Submission Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 p-3 sm:p-4 shadow-2xl">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center justify-between w-full sm:w-auto gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Class Representative Action</span>
              <span className="font-bold text-white text-sm">
                {presentCount} Present • {absentCount} Absent
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono bg-slate-800 px-2 py-1 rounded-md">
              {sessionTime}
            </span>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmitAttendance}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Sending to Laptop...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Attendance to Admin Laptop 🚀</span>
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};
