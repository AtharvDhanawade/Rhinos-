import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Save, 
  Trash2, 
  Check, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Search, 
  UserCheck, 
  UserX, 
  ShieldCheck, 
  Layers,
  Sparkles
} from 'lucide-react';
import { Student, AttendanceRecord, AttendanceStatus } from '../types';
import { getWeekNumber } from '../utils/storage';

export interface EditableSessionInfo {
  classId: string;
  className: string;
  date: string;
  sessionId: string;
  sessionTitle: string;
  sessionTime: string;
}

interface EditSessionAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionInfo: EditableSessionInfo | null;
  students: Student[];
  allRecords: AttendanceRecord[];
  onSaveSession: (
    newSessionInfo: EditableSessionInfo,
    updatedRecords: AttendanceRecord[],
    oldSessionInfo: EditableSessionInfo
  ) => void;
  onDeleteSession?: (classId: string, date: string, sessionId: string) => void;
  customClassTimes?: string[];
}

export const EditSessionAttendanceModal: React.FC<EditSessionAttendanceModalProps> = ({
  isOpen,
  onClose,
  sessionInfo,
  students,
  allRecords,
  onSaveSession,
  onDeleteSession,
  customClassTimes = []
}) => {
  const [date, setDate] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [studentStatusMap, setStudentStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent' | 'onduty'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Initialize data when modal opens
  useEffect(() => {
    if (isOpen && sessionInfo) {
      setDate(sessionInfo.date);
      setSessionTitle(sessionInfo.sessionTitle || '1st Class');
      setSessionTime(sessionInfo.sessionTime || '10:00 AM - 11:00 AM');
      setShowDeleteConfirm(false);
      setSearchQuery('');
      setFilterStatus('all');

      // Find existing records for this specific session robustly
      const targetRecords = allRecords.filter(r => {
        if (r.classId !== sessionInfo.classId || r.date !== sessionInfo.date) return false;
        const matchSession = (r.sessionId || 'session-1') === (sessionInfo.sessionId || 'session-1');
        const matchTime = Boolean(sessionInfo.sessionTime && r.sessionTime && r.sessionTime.trim().toLowerCase() === sessionInfo.sessionTime.trim().toLowerCase());
        const matchTitle = Boolean(sessionInfo.sessionTitle && r.sessionTitle && r.sessionTitle.trim().toLowerCase() === sessionInfo.sessionTitle.trim().toLowerCase());
        return matchSession || matchTime || matchTitle;
      });

      const statusMap: Record<string, AttendanceStatus> = {};
      const hasAbsents = targetRecords.some(r => r.status === 'absent');
      const hasPresents = targetRecords.some(r => r.status === 'present');
      
      students.forEach(s => {
        const found = targetRecords.find(r => r.studentId === s.id);
        if (found) {
          statusMap[s.id] = found.status;
        } else {
          // If only absentees were recorded in the session, unrecorded students were present
          if (hasAbsents && !hasPresents) {
            statusMap[s.id] = 'present';
          } else {
            statusMap[s.id] = targetRecords.length > 0 ? 'absent' : 'present';
          }
        }
      });

      setStudentStatusMap(statusMap);
    }
  }, [isOpen, sessionInfo, allRecords, students]);

  if (!isOpen || !sessionInfo) return null;

  const titlePresets = ['1st Class', '2nd Class', '3rd Class', '4th Class', 'Lecture 1', 'Lecture 2', 'Lab Session', 'Tutorial', 'Remedial'];

  const timePresets = Array.from(new Set([
    ...(customClassTimes.length > 0 ? customClassTimes : []),
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:15 AM - 12:15 PM',
    '01:00 PM - 02:00 PM',
    '02:00 PM - 03:00 PM',
    '03:15 PM - 04:15 PM',
  ]));

  const handleToggleStatus = (studentId: string, targetStatus: AttendanceStatus) => {
    setStudentStatusMap(prev => ({
      ...prev,
      [studentId]: targetStatus
    }));
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = {};
    students.forEach(s => {
      updated[s.id] = status;
    });
    setStudentStatusMap(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionInfo) return;

    const finalDate = date.trim() || sessionInfo.date;
    const finalTime = sessionTime.trim() || sessionInfo.sessionTime;
    const finalTitle = sessionTitle.trim() || sessionInfo.sessionTitle;

    const dateObj = new Date(finalDate + 'T00:00:00');
    const weekNum = getWeekNumber(dateObj);
    const dayOfWeek = dateObj.getDay();

    // Build updated AttendanceRecord array for this session
    const updatedRecords: AttendanceRecord[] = students.map((student, idx) => {
      const status = studentStatusMap[student.id] || 'present';
      return {
        id: `rec-${student.id}-${finalDate}-${sessionInfo.sessionId || 'session-1'}`,
        studentId: student.id,
        studentRollNo: student.rollNo,
        studentName: student.name,
        studentLast4: student.last4Digits || student.rollNo.slice(-4),
        classId: sessionInfo.classId,
        className: sessionInfo.className,
        date: finalDate,
        time: finalTime,
        status,
        weekNumber: weekNum,
        dayOfWeek,
        markedVia: 'manual',
        timestamp: Date.now() + idx,
        sessionId: sessionInfo.sessionId || 'session-1',
        sessionTime: finalTime,
        sessionTitle: finalTitle
      };
    });

    onSaveSession(
      {
        ...sessionInfo,
        date: finalDate,
        sessionTime: finalTime,
        sessionTitle: finalTitle
      },
      updatedRecords,
      sessionInfo
    );

    onClose();
  };

  const handleDelete = () => {
    if (onDeleteSession && sessionInfo) {
      onDeleteSession(sessionInfo.classId, sessionInfo.date, sessionInfo.sessionId);
      onClose();
    }
  };

  // Stats calculation
  const totalEnrolled = students.length;
  const presentCount = students.filter(s => studentStatusMap[s.id] === 'present').length;
  const onDutyCount = students.filter(s => studentStatusMap[s.id] === 'onduty' || studentStatusMap[s.id] === 'late').length;
  const absentCount = students.filter(s => studentStatusMap[s.id] === 'absent').length;
  const attendancePercent = totalEnrolled > 0 ? Math.round(((presentCount + onDutyCount) / totalEnrolled) * 100) : 0;

  // Filtered students
  const filteredStudents = students.filter(s => {
    const status = studentStatusMap[s.id] || 'absent';
    if (filterStatus === 'present' && status !== 'present') return false;
    if (filterStatus === 'absent' && status !== 'absent') return false;
    if (filterStatus === 'onduty' && status !== 'onduty' && status !== 'late') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = s.name.toLowerCase().includes(q);
      const rollMatch = s.rollNo.toLowerCase().includes(q);
      const last4Match = s.last4Digits?.toLowerCase().includes(q);
      return nameMatch || rollMatch || last4Match;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 z-10 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-lg">
                  Edit Attendance Session
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                  {sessionTitle}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Modify student attendance status (P/A/OD), date, or lecture time for <strong>{sessionInfo.className}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
          {/* Top Session Config Panel */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Session Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Attendance Date</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Session Title */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Session Title</span>
              </label>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="e.g. 1st Class, 2nd Class, 3rd Class"
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Session Time */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Lecture Time</span>
              </label>
              <input
                type="text"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
                placeholder="e.g. 10:00 AM - 11:00 AM"
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Quick Presets for Time & Title */}
            <div className="col-span-1 sm:col-span-3 pt-1 border-t border-slate-200/80 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-500">Time Presets:</span>
                {timePresets.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSessionTime(preset)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                      sessionTime === preset
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-500">Title Presets:</span>
                {titlePresets.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSessionTitle(preset)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                      sessionTitle === preset
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Summary Bar */}
          <div className="bg-slate-900 text-white rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="text-emerald-400 flex items-center gap-1">
                <UserCheck className="w-4 h-4" />
                <span>{presentCount} Present</span>
              </span>
              <span className="text-rose-400 flex items-center gap-1">
                <UserX className="w-4 h-4" />
                <span>{absentCount} Absent</span>
              </span>
              {onDutyCount > 0 && (
                <span className="text-amber-300 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{onDutyCount} On Duty</span>
                </span>
              )}
              <span className="text-slate-400">Total: {totalEnrolled}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300">Attendance:</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 rounded-lg text-xs font-mono font-bold">
                {attendancePercent}%
              </span>
            </div>
          </div>

          {/* Filter & Batch Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name or roll..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quick Status Filters */}
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  filterStatus === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({students.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('present')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  filterStatus === 'present'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                Present ({presentCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('absent')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  filterStatus === 'absent'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                }`}
              >
                Absent ({absentCount})
              </button>
            </div>

            {/* Bulk Toggle Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleMarkAll('present')}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition"
              >
                All Present
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll('absent')}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold transition"
              >
                All Absent
              </button>
            </div>
          </div>

          {/* Student Roster Table with Direct P/A/OD Toggles */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2 px-3 w-12 text-center">#</th>
                    <th className="py-2 px-3 w-28">Roll No</th>
                    <th className="py-2 px-3 w-20 text-blue-600">Last 4</th>
                    <th className="py-2 px-3">Student Name</th>
                    <th className="py-2 px-4 text-center w-48">Status Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No students match the search/filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((std, idx) => {
                      const curStatus = studentStatusMap[std.id] || 'absent';
                      return (
                        <tr 
                          key={std.id}
                          className={`transition ${
                            curStatus === 'present'
                              ? 'hover:bg-emerald-50/40'
                              : curStatus === 'absent'
                              ? 'bg-rose-50/20 hover:bg-rose-50/40'
                              : 'bg-amber-50/20 hover:bg-amber-50/40'
                          }`}
                        >
                          <td className="py-2 px-3 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-slate-700">
                            {std.rollNo}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-blue-600">
                            {std.last4Digits}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-900">
                            {std.name}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(std.id, 'present')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                                  curStatus === 'present'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-emerald-700'
                                }`}
                              >
                                P
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(std.id, 'absent')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                                  curStatus === 'absent'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-rose-700'
                                }`}
                              >
                                A
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(std.id, 'onduty')}
                                className={`px-2 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                                  curStatus === 'onduty' || curStatus === 'late'
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'text-slate-500 hover:text-amber-700'
                                }`}
                              >
                                OD
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delete Confirmation Box */}
          {showDeleteConfirm && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-900 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Are you sure you want to permanently delete this attendance session?</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1 text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-xs"
                >
                  Yes, Delete Session
                </button>
              </div>
            </div>
          )}

          {/* Sticky Bottom Actions Footer */}
          <div className="sticky bottom-0 bg-white pt-3 pb-1 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3 z-10">
            <div>
              {onDeleteSession && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Session</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="save-edited-session-btn"
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-500/25 flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes & Update Sheet</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
