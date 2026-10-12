import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Share2, 
  MessageSquare, 
  Users, 
  UserCheck, 
  UserX, 
  FileText, 
  ExternalLink,
  Download,
  Send,
  Sparkles,
  Clock,
  Edit3,
  Layers
} from 'lucide-react';
import { Student, ClassSubject, AttendanceRecord } from '../types';
import { sortStudentsByLast4Digits } from '../utils/storage';

export type ReportFormat = 'absentees_only' | 'present_and_absent_4digits' | 'compact_rolls' | 'custom';

interface SendReportToSirModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentClass: ClassSubject;
  date: string;
  students: Student[];
  allRecords: AttendanceRecord[];
  reportUrl?: string;
  googleSheetUrl?: string;
  initialCustomClassName?: string;
  initialTime?: string;
  initialSessionId?: string;
  initialSessionTitle?: string;
  onSaveSessionDetails?: (className: string, time: string) => void;
}

export const SendReportToSirModal: React.FC<SendReportToSirModalProps> = ({
  isOpen,
  onClose,
  currentClass,
  date,
  students,
  allRecords,
  reportUrl,
  googleSheetUrl,
  initialCustomClassName,
  initialTime,
  initialSessionId,
  initialSessionTitle,
  onSaveSessionDetails,
}) => {
  const [format, setFormat] = useState<ReportFormat>('absentees_only');
  const [copied, setCopied] = useState(false);
  const [includeGreeting, setIncludeGreeting] = useState(true);
  const [greetingText, setGreetingText] = useState('Respected Sir,');
  const [includeStats, setIncludeStats] = useState(true);
  const [includeLink, setIncludeLink] = useState(true);
  const [includeSheetLink, setIncludeSheetLink] = useState(true);
  const [include4Digits, setInclude4Digits] = useState(true);

  // Manual Class Name & Time State
  const [customClassName, setCustomClassName] = useState(initialCustomClassName || currentClass.name);
  const [customTime, setCustomTime] = useState(
    initialTime || currentClass.scheduleTime || '10:00 AM - 11:00 AM'
  );

  // Discover available sessions for this class on selected date
  const availableSessions = useMemo(() => {
    const map = new Map<string, { id: string; title: string; time: string }>();
    const classDayRecords = allRecords.filter(r => r.classId === currentClass.id && r.date === date);

    if (initialSessionId) {
      map.set(initialSessionId, {
        id: initialSessionId,
        title: initialSessionTitle || (initialSessionId === 'session-1' ? '1st Class' : '2nd Class'),
        time: initialTime || currentClass.scheduleTime || '10:00 AM - 11:00 AM',
      });
    }

    classDayRecords.forEach(r => {
      const sId = r.sessionId || 'session-1';
      if (!map.has(sId)) {
        map.set(sId, {
          id: sId,
          title: r.sessionTitle || (sId === 'session-1' ? '1st Class' : (sId === 'session-2' ? '2nd Class' : `Session ${sId.replace('session-', '')}`)),
          time: r.sessionTime || r.time || currentClass.scheduleTime || '10:00 AM',
        });
      }
    });

    if (map.size === 0) {
      map.set('session-1', {
        id: 'session-1',
        title: '1st Class',
        time: initialTime || currentClass.scheduleTime || '10:00 AM - 11:00 AM',
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, '') || '1', 10);
      const numB = parseInt(b.id.replace(/\D/g, '') || '1', 10);
      return numB - numA; // Newest session on top
    });
  }, [allRecords, currentClass.id, currentClass.scheduleTime, date, initialSessionId, initialSessionTitle, initialTime]);

  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId || 'session-1');

  useEffect(() => {
    if (initialSessionId) {
      setSelectedSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  const selectedSession = availableSessions.find(s => s.id === selectedSessionId) || availableSessions[0];

  // Synchronize when opening or when props change
  useEffect(() => {
    if (isOpen) {
      if (initialCustomClassName) setCustomClassName(initialCustomClassName);
      else setCustomClassName(currentClass.name);

      if (initialTime) setCustomTime(initialTime);
      else if (selectedSession?.time) setCustomTime(selectedSession.time);
      else if (currentClass.scheduleTime) setCustomTime(currentClass.scheduleTime);
    }
  }, [isOpen, initialCustomClassName, initialTime, selectedSession?.time, currentClass.name, currentClass.scheduleTime]);

  // Compute records for selected date, class and session
  const classRecords = useMemo(() => {
    return allRecords.filter(r => 
      r.classId === currentClass.id && 
      r.date === date &&
      (!selectedSessionId || (r.sessionId || 'session-1') === selectedSessionId)
    );
  }, [allRecords, currentClass.id, date, selectedSessionId]);

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    classRecords.forEach(r => map.set(r.studentId, r));
    return map;
  }, [classRecords]);

  // Compute student lists
  const { presentStudents, absentStudents, onDutyStudents, lateStudents, unmarkedStudents } = useMemo(() => {
    const present: Student[] = [];
    const absent: Student[] = [];
    const onDuty: Student[] = [];
    const unmarked: Student[] = [];

    students.forEach(s => {
      const rec = recordMap.get(s.id);
      if (!rec) {
        unmarked.push(s);
      } else if (rec.status === 'present') {
        present.push(s);
      } else if (rec.status === 'absent') {
        absent.push(s);
      } else if (rec.status === 'onduty' || rec.status === 'late') {
        onDuty.push(s);
      }
    });

    return {
      presentStudents: sortStudentsByLast4Digits(present),
      absentStudents: sortStudentsByLast4Digits(absent),
      onDutyStudents: sortStudentsByLast4Digits(onDuty),
      lateStudents: sortStudentsByLast4Digits(onDuty),
      unmarkedStudents: sortStudentsByLast4Digits(unmarked),
    };
  }, [students, recordMap]);

  const totalStrength = students.length;
  const presentCount = presentStudents.length;
  const absentCount = absentStudents.length;
  const onDutyCount = onDutyStudents.length;
  const presentPercent = totalStrength > 0 ? Math.round(((presentCount + onDutyCount) / totalStrength) * 100) : 0;

  // Format date nicely (e.g. 17 Sep 2026)
  const formattedDate = useMemo(() => {
    try {
      const d = new Date(date + 'T00:00:00');
      return d.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  }, [date]);

  // Generate the formatted text based on selected template
  const generatedText = useMemo(() => {
    const lines: string[] = [];

    // Optional Greeting
    if (includeGreeting && greetingText.trim()) {
      lines.push(greetingText.trim());
      lines.push(`Here is today's attendance report for *${customClassName || currentClass.name}*:`);
      lines.push('');
    }

    // Header info
    lines.push(`📋 *ATTENDANCE REPORT*`);
    lines.push(`*Class:* ${customClassName || currentClass.name} (${currentClass.code || 'Regular'})`);
    if (selectedSession?.title) {
      lines.push(`*Session / Lecture:* ${selectedSession.title}`);
    }
    if (customTime || selectedSession?.time || currentClass.scheduleTime) {
      lines.push(`*Time / Period:* ${customTime || selectedSession?.time || currentClass.scheduleTime}`);
    }
    if (currentClass.teacherName) {
      lines.push(`*Faculty:* ${currentClass.teacherName}`);
    }
    lines.push(`*Date:* ${formattedDate}`);
    if (currentClass.room) {
      lines.push(`*Room / Lab:* ${currentClass.room}`);
    }
    lines.push('');

    // Summary Statistics - Order: Present, Absent, On Duty
    if (includeStats) {
      lines.push(`📊 *STRENGTH SUMMARY:*`);
      lines.push(`• *Total Strength:* ${totalStrength}`);
      lines.push(`• *Present:* ${presentCount} (${presentPercent}%)`);
      lines.push(`• *Absent:* ${absentCount} (${totalStrength > 0 ? Math.round((absentCount / totalStrength) * 100) : 0}%)`);
      if (onDutyStudents.length > 0) {
        lines.push(`• *On Duty (OD):* ${onDutyStudents.length}`);
      }
      if (unmarkedStudents.length > 0) {
        lines.push(`• *Unmarked:* ${unmarkedStudents.length}`);
      }
      lines.push('');
    }

    // FORMAT 1: Absentee and On-Duty Names to Sir
    if (format === 'absentees_only') {
      if (absentStudents.length === 0) {
        lines.push(`🎉 *NO ABSENTEES TODAY!* (Full Present)`);
      } else {
        lines.push(`❌ *ABSENT STUDENTS (${absentStudents.length}):*`);
        absentStudents.forEach((st, idx) => {
          const code = include4Digits ? `[${st.last4Digits || (st.rollNo.slice(-4) || '----')}] ` : '';
          lines.push(`${idx + 1}. ${code}${st.name}`);
        });
      }
      lines.push('');

      // Also include On Duty names right below absent names
      if (onDutyStudents.length > 0) {
        lines.push(`🎖️ *ON DUTY (OD) STUDENTS (${onDutyStudents.length}):*`);
        onDutyStudents.forEach((st, idx) => {
          const code = include4Digits ? `[${st.last4Digits || (st.rollNo.slice(-4) || '----')}] ` : '';
          lines.push(`${idx + 1}. ${code}${st.name}`);
        });
        lines.push('');
      }
    }

    // FORMAT 2: All Present, Absent, and On Duty with 4 Digits
    else if (format === 'present_and_absent_4digits') {
      lines.push(`✅ *PRESENT STUDENTS (${presentStudents.length}):*`);
      if (presentStudents.length === 0) {
        lines.push(`_No students marked present yet._`);
      } else {
        presentStudents.forEach((st, idx) => {
          const code = st.last4Digits || (st.rollNo.slice(-4) || '----');
          lines.push(`${idx + 1}. [${code}] ${st.name}`);
        });
      }
      lines.push('');

      lines.push(`❌ *ABSENT STUDENTS (${absentStudents.length}):*`);
      if (absentStudents.length === 0) {
        lines.push(`_None (0 Absentees)_`);
      } else {
        absentStudents.forEach((st, idx) => {
          const code = st.last4Digits || (st.rollNo.slice(-4) || '----');
          lines.push(`${idx + 1}. [${code}] ${st.name}`);
        });
      }
      lines.push('');

      if (onDutyStudents.length > 0) {
        lines.push(`🎖️ *ON DUTY (OD) STUDENTS (${onDutyStudents.length}):*`);
        onDutyStudents.forEach((st, idx) => {
          const code = st.last4Digits || (st.rollNo.slice(-4) || '----');
          lines.push(`${idx + 1}. [${code}] ${st.name}`);
        });
        lines.push('');
      }
    }

    // FORMAT 3: Compact Roll Numbers only
    else if (format === 'compact_rolls') {
      const presentCodes = presentStudents.map(s => s.last4Digits || s.rollNo.slice(-4) || s.rollNo);
      const absentCodes = absentStudents.map(s => s.last4Digits || s.rollNo.slice(-4) || s.rollNo);
      const onDutyCodes = onDutyStudents.map(s => s.last4Digits || s.rollNo.slice(-4) || s.rollNo);

      lines.push(`✅ *PRESENT (${presentCodes.length}):*`);
      lines.push(presentCodes.length > 0 ? presentCodes.join(', ') : 'None');
      lines.push('');

      lines.push(`❌ *ABSENT (${absentCodes.length}):*`);
      lines.push(absentCodes.length > 0 ? absentCodes.join(', ') : 'None');
      lines.push('');

      if (onDutyCodes.length > 0) {
        lines.push(`🎖️ *ON DUTY (${onDutyCodes.length}):*`);
        lines.push(onDutyCodes.join(', '));
        lines.push('');
      }
    }

    // FORMAT 4: Custom combination
    else if (format === 'custom') {
      if (presentStudents.length > 0) {
        lines.push(`✅ *PRESENT (${presentStudents.length}):*`);
        lines.push(presentStudents.map(s => include4Digits ? `${s.last4Digits || s.rollNo.slice(-4)} (${s.name})` : s.name).join(', '));
        lines.push('');
      }

      if (absentStudents.length > 0) {
        lines.push(`❌ *ABSENTEES (${absentStudents.length}):*`);
        absentStudents.forEach((st, idx) => {
          const code = include4Digits ? `[${st.last4Digits || st.rollNo.slice(-4)}] ` : '';
          lines.push(`${idx + 1}. ${code}${st.name}`);
        });
        lines.push('');
      } else {
        lines.push(`🎉 *Full Attendance: No Absentees!*`);
        lines.push('');
      }

      if (onDutyStudents.length > 0) {
        lines.push(`🎖️ *ON DUTY (${onDutyStudents.length}):*`);
        onDutyStudents.forEach((st, idx) => {
          const code = include4Digits ? `[${st.last4Digits || st.rollNo.slice(-4)}] ` : '';
          lines.push(`${idx + 1}. ${code}${st.name}`);
        });
        lines.push('');
      }
    }

    // Optional link
    if (includeLink && reportUrl) {
      lines.push(`🔗 *Live Verification Document:*`);
      lines.push(reportUrl);
      lines.push('');
    }

    // Optional Google Sheet register link
    if (includeSheetLink && googleSheetUrl) {
      lines.push(`📊 *Official Google Sheet Register:*`);
      lines.push(googleSheetUrl);
      lines.push('');
    }

    lines.push(`_Submitted by Class Representative (CR)_`);

    return lines.join('\n');
  }, [
    format,
    includeGreeting,
    greetingText,
    includeStats,
    includeLink,
    includeSheetLink,
    include4Digits,
    currentClass,
    customClassName,
    customTime,
    formattedDate,
    totalStrength,
    presentCount,
    absentCount,
    presentPercent,
    absentStudents,
    presentStudents,
    onDutyStudents,
    lateStudents,
    unmarkedStudents,
    reportUrl,
    googleSheetUrl,
  ]);

  // Copy handler
  const handleCopy = async () => {
    onSaveSessionDetails?.(customClassName, customTime);
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard write failed, falling back:', e);
      const textarea = document.createElement('textarea');
      textarea.value = generatedText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // WhatsApp share link
  const whatsappUrl = useMemo(() => {
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(generatedText)}`;
  }, [generatedText]);

  // Web Share API on mobile
  const handleNativeShare = async () => {
    onSaveSessionDetails?.(customClassName, customTime);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Attendance Report - ${customClassName || currentClass.name}`,
          text: generatedText,
        });
      } catch {
        // User cancelled or not supported
      }
    } else {
      window.open(whatsappUrl, '_blank');
    }
  };

  // Download .txt file
  const handleDownloadTxt = () => {
    onSaveSessionDetails?.(customClassName, customTime);
    const blob = new Blob([generatedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_${(customClassName || currentClass.name).replace(/\s+/g, '_')}_${date}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                <span>Send Attendance Report to Sir</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  WhatsApp & Copy
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                {currentClass.name} • {formattedDate} • {absentCount} Absent / {presentCount} Present
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">

          {/* Session Switcher if multiple sessions exist today for this class */}
          {availableSessions.length > 1 && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Select Class Session / Slot to Report:</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {availableSessions.map(sess => {
                  const isSelected = selectedSessionId === sess.id;
                  return (
                    <button
                      key={sess.id}
                      type="button"
                      onClick={() => {
                        setSelectedSessionId(sess.id);
                        if (sess.time) setCustomTime(sess.time);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs font-bold'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isSelected ? '#ffffff' : '#3b82f6' }} />
                      <span>{sess.title}</span>
                      <span className="text-[10px] opacity-80 font-mono">({sess.time})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Format Selector Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Select Message Format to Send:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              
              {/* Option 1: Only Absentees (Sir Favorite) */}
              <button
                type="button"
                onClick={() => setFormat('absentees_only')}
                className={`p-3 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                  format === 'absentees_only'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-400/30'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-black">
                    <UserX className="w-3.5 h-3.5 text-rose-600" />
                    <span>1. Only Absentee Names</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-emerald-200/80 text-emerald-900 rounded">
                    Popular
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Total strength + present/absent count + list of absentee names with 4 digits.
                </p>
              </button>

              {/* Option 2: Full Present & Absent */}
              <button
                type="button"
                onClick={() => setFormat('present_and_absent_4digits')}
                className={`p-3 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                  format === 'present_and_absent_4digits'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-950 ring-2 ring-blue-400/30'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black mb-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>2. Full Roll Call</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Both all Present (with 4 digits) and all Absent lists for complete audit.
                </p>
              </button>

              {/* Option 3: Compact Roll Numbers */}
              <button
                type="button"
                onClick={() => setFormat('compact_rolls')}
                className={`p-3 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                  format === 'compact_rolls'
                    ? 'border-indigo-500 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-400/30'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-black mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>3. Compact Roll Numbers</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Shortest format: summary + comma-separated 4-digit codes for SMS/notices.
                </p>
              </button>

            </div>
          </div>

          {/* Editable Session Details: Manual Class Name & Lecture Time */}
          <div className="p-3.5 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 border border-blue-200/90 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Class Name & Lecture Time (Customizable)</span>
              </span>
              <span className="text-[10px] text-blue-700 bg-blue-100/90 px-2 py-0.5 rounded-full font-bold">
                Updates Report Instantly
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Edit3 className="w-3 h-3 text-slate-500" />
                  <span>Manual Class Name:</span>
                </label>
                <input
                  type="text"
                  value={customClassName}
                  onChange={(e) => setCustomClassName(e.target.value)}
                  placeholder="e.g. Maths Lecture, Lab Batch B"
                  className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>Lecture / Session Time:</span>
                </label>
                <input
                  type="text"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  placeholder="e.g. 10:00 AM - 11:00 AM"
                  className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Quick Preset Time Pills */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] font-bold text-slate-500">Quick Presets:</span>
              {[
                '09:00 AM - 10:00 AM',
                '10:00 AM - 11:00 AM',
                '11:15 AM - 12:15 PM',
                '01:00 PM - 02:00 PM',
                '02:00 PM - 03:00 PM',
              ].map((timePreset) => (
                <button
                  key={timePreset}
                  type="button"
                  onClick={() => setCustomTime(timePreset)}
                  className={`text-[10px] px-2 py-0.5 rounded-lg font-medium transition ${
                    customTime === timePreset
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-blue-50'
                  }`}
                >
                  {timePreset}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
                className="text-[10px] px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold transition"
              >
                Now ({new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </button>
            </div>
          </div>

          {/* Quick Customization Toggles */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeGreeting}
                  onChange={(e) => setIncludeGreeting(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Greeting to Sir</span>
              </label>

              <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStats}
                  onChange={(e) => setIncludeStats(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Strength / Present / Absent stats</span>
              </label>

              <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={include4Digits}
                  onChange={(e) => setInclude4Digits(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Include Last 4 Digits</span>
              </label>

              {reportUrl && (
                <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeLink}
                    onChange={(e) => setIncludeLink(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Include Live Verification Link</span>
                </label>
              )}

              {googleSheetUrl && (
                <label className="flex items-center gap-1.5 font-semibold text-emerald-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSheetLink}
                    onChange={(e) => setIncludeSheetLink(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Include Google Sheet Link</span>
                </label>
              )}
            </div>

            {includeGreeting && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Greeting:</span>
                <input
                  type="text"
                  value={greetingText}
                  onChange={(e) => setGreetingText(e.target.value)}
                  placeholder="Respected Sir,"
                  className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Live Message Preview (Styled like WhatsApp / Chat Bubble) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live WhatsApp Message Preview:</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {generatedText.length} characters • {generatedText.split('\n').length} lines
              </span>
            </div>

            <div className="relative bg-slate-900 rounded-2xl p-4 text-emerald-300 font-mono text-xs shadow-inner overflow-x-auto border border-slate-800 max-h-64">
              <pre className="whitespace-pre-wrap font-sans text-slate-100 text-xs sm:text-[13px] leading-relaxed select-all">
                {generatedText}
              </pre>
            </div>
          </div>

          {/* Quick Metrics Badge Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50/60 border border-blue-100 rounded-2xl text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-600">
                Total Strength: <strong className="text-slate-900">{totalStrength}</strong>
              </span>
              <span className="text-emerald-700">
                Present: <strong className="text-emerald-800">{presentCount}</strong> ({presentPercent}%)
              </span>
              <span className="text-rose-700">
                Absent: <strong className="text-rose-800">{absentCount}</strong>
              </span>
            </div>
            <div className="text-[11px] text-blue-700 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ready for one-click copy or WhatsApp</span>
            </div>
          </div>

        </div>

        {/* Modal Footer with Primary Copy & Share Action Buttons */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
              title="Download text file"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Save as .txt</span>
            </button>
            <button
              type="button"
              onClick={handleNativeShare}
              className="py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
              title="Share"
            >
              <Share2 className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Primary Copy to Clipboard Button */}
            <button
              type="button"
              id="copy-report-text-btn"
              onClick={handleCopy}
              className={`flex-1 sm:flex-none py-2.5 px-5 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md active:scale-95 ${
                copied
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-slate-300" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Report Text'}</span>
            </button>

            {/* Primary WhatsApp Direct Button */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              id="whatsapp-share-report-btn"
              className="flex-1 sm:flex-none py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/25"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Send to Sir on WhatsApp</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
