import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Share2, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  FileSpreadsheet, 
  Send,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { Student, ClassSubject, AttendanceRecord } from '../types';
import { formatAbsenteesWithLast4Prefix } from '../utils/googleSheets';
import { sortStudentsByLast4Digits } from '../utils/storage';

interface AbsenteeSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentClass: ClassSubject;
  date: string;
  time: string;
  sessionId?: string;
  sessionTitle?: string;
  customClassName?: string;
  allStudents: Student[];
  records: AttendanceRecord[];
  defaultUnmarkedStatus?: 'present' | 'absent';
  onOpenSendToSir?: () => void;
  onOpenGoogleSheet?: () => void;
}

export const AbsenteeSummaryModal: React.FC<AbsenteeSummaryModalProps> = ({
  isOpen,
  onClose,
  currentClass,
  date,
  time,
  sessionId,
  sessionTitle,
  customClassName,
  allStudents,
  records,
  defaultUnmarkedStatus = 'present',
  onOpenSendToSir,
  onOpenGoogleSheet,
}) => {
  const [copied, setCopied] = useState(false);
  const [formatStyle, setFormatStyle] = useState<'dash' | 'brackets' | 'space' | 'full_roll'>('dash');

  if (!isOpen) return null;

  // Filter records for this class, date and session
  const relevantRecords = records.filter(r => 
    r.classId === currentClass.id && 
    r.date === date && 
    (!sessionId || (r.sessionId || 'session-1') === sessionId)
  );

  const recordMap = new Map<string, AttendanceRecord>();
  relevantRecords.forEach(r => recordMap.set(r.studentId, r));

  const hasRecordedPresents = relevantRecords.some(r => r.status === 'present');
  const hasRecordedAbsents = relevantRecords.some(r => r.status === 'absent');

  // Determine present, absentees, and on duty students
  const absenteeStudents: Array<{ id: string; name: string; rollNo: string; last4Digits: string }> = [];
  const presentStudents: Array<{ id: string; name: string; rollNo: string; last4Digits: string }> = [];
  const onDutyStudents: Array<{ id: string; name: string; rollNo: string; last4Digits: string }> = [];

  const sortedAllStudents = sortStudentsByLast4Digits(allStudents);
  sortedAllStudents.forEach(s => {
    const rec = recordMap.get(s.id);
    const last4 = s.last4Digits || (s.rollNo.slice(-4) || '----');
    if (rec) {
      if (rec.status === 'present') {
        presentStudents.push({ id: s.id, name: s.name, rollNo: s.rollNo, last4Digits: last4 });
      } else if (rec.status === 'onduty' || rec.status === 'late') {
        onDutyStudents.push({ id: s.id, name: s.name, rollNo: s.rollNo, last4Digits: last4 });
      } else {
        absenteeStudents.push({ id: s.id, name: s.name, rollNo: s.rollNo, last4Digits: last4 });
      }
    } else {
      // If student was not explicitly recorded, check whether attendees were being recorded
      const unrecordedIsAbsent = defaultUnmarkedStatus ? defaultUnmarkedStatus === 'absent' : (hasRecordedPresents && !hasRecordedAbsents);
      if (unrecordedIsAbsent) {
        absenteeStudents.push({ id: s.id, name: s.name, rollNo: s.rollNo, last4Digits: last4 });
      } else {
        presentStudents.push({ id: s.id, name: s.name, rollNo: s.rollNo, last4Digits: last4 });
      }
    }
  });

  const totalEnrolled = allStudents.length;
  const presentCount = presentStudents.length;
  const absentCount = absenteeStudents.length;
  const onDutyCount = onDutyStudents.length;
  const attendancePercent = totalEnrolled > 0 ? Math.round(((presentCount + onDutyCount) / totalEnrolled) * 100) : 0;

  // Generate text with last 4 digits BEFORE student name, with on-duty included under on duty header
  const formattedText = formatAbsenteesWithLast4Prefix(absenteeStudents, formatStyle, onDutyStudents);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleShareWhatsApp = () => {
    const title = `*ATTENDANCE REPORT* - ${customClassName || currentClass.name}\n${sessionTitle ? `Session: ${sessionTitle}\n` : ''}Date: ${date} (${time})\nPresent: ${presentCount}/${totalEnrolled}\nAbsent: ${absentCount}\nOn Duty: ${onDutyCount}\n\n`;
    const message = encodeURIComponent(title + formattedText);
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white relative">
          <button 
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <span className="p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-rose-400">
                Attendance Submitted
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                Absentee Names & Last 4 Digits
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mt-2">
            <span className="font-bold text-white">{customClassName || currentClass.name}</span>
            {sessionTitle && (
              <span className="px-2 py-0.5 rounded-md bg-white/15 text-white font-medium">
                {sessionTitle}
              </span>
            )}
            <span className="text-slate-400">•</span>
            <span className="font-mono text-amber-300">{date}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-300">{time}</span>
          </div>

          {/* Key Stats Bar - Order: Present, Absent, On Duty */}
          <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-white/10">
            <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Present</span>
              <span className="text-lg sm:text-xl font-black text-emerald-400">{presentCount}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Absent</span>
              <span className="text-lg sm:text-xl font-black text-rose-400">{absentCount}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">On Duty (OD)</span>
              <span className="text-lg sm:text-xl font-black text-amber-300">{onDutyCount}</span>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Turnout</span>
              <span className="text-lg sm:text-xl font-black text-sky-300">{attendancePercent}%</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Format Selector Pills */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Display Format (Last 4 Digits Before Name):
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {absentCount} students absent
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setFormatStyle('dash')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition text-center ${
                  formatStyle === 'dash'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1005 - Name
              </button>
              <button
                type="button"
                onClick={() => setFormatStyle('brackets')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition text-center ${
                  formatStyle === 'brackets'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                [1005] Name
              </button>
              <button
                type="button"
                onClick={() => setFormatStyle('space')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition text-center ${
                  formatStyle === 'space'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1005 Name
              </button>
              <button
                type="button"
                onClick={() => setFormatStyle('full_roll')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition text-center col-span-3 sm:col-span-1 ${
                  formatStyle === 'full_roll'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Roll - Name
              </button>
            </div>
          </div>

          {/* Copyable Absentees Text Box */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-600">
                Ready to Copy & Paste:
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy List'}</span>
              </button>
            </div>

            <div className="relative bg-slate-900 rounded-2xl p-4 text-slate-100 font-mono text-sm leading-relaxed max-h-60 overflow-y-auto border border-slate-800 shadow-inner">
              {absentCount === 0 ? (
                <div className="text-center py-6 text-emerald-400 font-sans">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <p className="font-bold text-base">All Students Present! 🎉</p>
                  <p className="text-xs text-slate-400 mt-1">There are no absentees for this session.</p>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm text-rose-200">
                  {formattedText}
                </pre>
              )}
            </div>
          </div>

          {/* Quick Copy & Share Actions */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              id="copy-absentees-btn"
              onClick={handleCopy}
              className={`flex-1 py-3 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-md ${
                copied
                  ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Absentee List</span>
                </>
              )}
            </button>

            {absentCount > 0 && (
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-emerald-600/20"
                title="Share absentees directly to WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
            )}
          </div>

          {/* Secondary Action Links */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            {onOpenSendToSir && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSendToSir();
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-blue-50 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Official Report to Sir</span>
              </button>
            )}

            {onOpenGoogleSheet && (
              <button
                type="button"
                onClick={onOpenGoogleSheet}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-emerald-50 transition ml-auto"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>View Google Sheet Sync</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition active:scale-95"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
