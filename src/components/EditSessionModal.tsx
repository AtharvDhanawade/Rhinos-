import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Calendar, 
  Clock, 
  UserCheck, 
  UserX, 
  Trash2, 
  Search, 
  Check, 
  AlertCircle, 
  Layers,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { Student, AttendanceRecord, AttendanceStatus } from '../types';
import { DEFAULT_CLASS_TIMES } from '../utils/storage';

export interface EditModalSessionData {
  originalDate: string;
  originalSessionId: string;
  date: string;
  sessionId: string;
  title: string;
  time: string;
  records: AttendanceRecord[];
}

interface EditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionData: EditModalSessionData | null;
  students: Student[];
  classTimes?: string[];
  className: string;
  classId: string;
  onSave?: (
    originalDate: string,
    originalSessionId: string,
    classId: string,
    newDate: string,
    newSessionId: string,
    newTitle: string,
    newTime: string,
    studentStatuses: Record<string, AttendanceStatus>
  ) => void;
  onDelete?: (date: string, sessionId: string, classId: string) => void;
}

export const EditSessionModal: React.FC<EditSessionModalProps> = ({
  isOpen,
  onClose,
  sessionData,
  students,
  classTimes = [],
  className,
  classId,
  onSave,
  onDelete,
}) => {
  if (!isOpen || !sessionData) return null;

  const activeClassTimes = classTimes.length > 0 ? classTimes : DEFAULT_CLASS_TIMES;

  const [date, setDate] = useState(sessionData.date);
  const [title, setTitle] = useState(sessionData.title || '1st Class');
  const [time, setTime] = useState(sessionData.time || '10:00 AM');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'absent' | 'present' | 'onduty'>('all');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Initialize status map for all students
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() => {
    const map: Record<string, AttendanceStatus> = {};
    const recMap = new Map<string, AttendanceRecord>();
    sessionData.records.forEach(r => recMap.set(r.studentId, r));

    students.forEach(s => {
      const rec = recMap.get(s.id);
      if (rec) {
        map[s.id] = rec.status;
      } else {
        // If not found in records, default to absent if session had records, or present if empty
        map[s.id] = sessionData.records.length > 0 ? 'absent' : 'present';
      }
    });
    return map;
  });

  // Re-sync if sessionData changes
  useEffect(() => {
    if (sessionData) {
      setDate(sessionData.date);
      setTitle(sessionData.title || '1st Class');
      setTime(sessionData.time || '10:00 AM');
      setConfirmDelete(false);

      const map: Record<string, AttendanceStatus> = {};
      const recMap = new Map<string, AttendanceRecord>();
      sessionData.records.forEach(r => recMap.set(r.studentId, r));

      students.forEach(s => {
        const rec = recMap.get(s.id);
        if (rec) {
          map[s.id] = rec.status;
        } else {
          map[s.id] = sessionData.records.length > 0 ? 'absent' : 'present';
        }
      });
      setStatuses(map);
    }
  }, [sessionData, students]);

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setStatuses(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const markAll = (status: AttendanceStatus) => {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach(s => {
      next[s.id] = status;
    });
    setStatuses(next);
  };

  const invertStatuses = () => {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach(s => {
      const curr = statuses[s.id] || 'absent';
      next[s.id] = curr === 'present' ? 'absent' : 'present';
    });
    setStatuses(next);
  };

  // Stats calculation
  const presentCount = students.filter(s => statuses[s.id] === 'present').length;
  const absentCount = students.filter(s => statuses[s.id] === 'absent').length;
  const onDutyCount = students.filter(s => statuses[s.id] === 'onduty' || statuses[s.id] === 'late').length;

  // Filter students based on search and status
  const filteredStudents = students.filter(s => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      s.name.toLowerCase().includes(q) || 
      s.rollNo.toLowerCase().includes(q) || 
      s.last4Digits.includes(q);

    if (!matchesSearch) return false;

    const st = statuses[s.id] || 'absent';
    if (filterMode === 'present') return st === 'present';
    if (filterMode === 'absent') return st === 'absent';
    if (filterMode === 'onduty') return st === 'onduty' || st === 'late';
    return true;
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date.trim() || !time.trim()) return;

    onSave?.(
      sessionData.originalDate,
      sessionData.originalSessionId,
      classId,
      date.trim(),
      sessionData.sessionId,
      title.trim() || 'Class Session',
      time.trim(),
      statuses
    );
    onClose();
  };

  const handleDelete = () => {
    onDelete?.(sessionData.originalDate, sessionData.originalSessionId, classId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 z-10 flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg leading-tight flex items-center gap-2">
                <span>Edit Past Attendance Session</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                  {className}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Modify date, lecture time, title, and individual student attendance statuses
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

        {/* Scrollable Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          
          {/* Section 1: Session Date, Title & Time */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Date Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Session Date</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Session Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Session Title / Slot</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 1st Class, 2nd Class, Lab Session"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

            </div>

            {/* Session Time (Manual entry above + Custom presets below, fulfilling user requirement) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Lecture / Session Time (Manual Entry)</span>
                </label>
                <span className="text-[10px] text-slate-400">Type any time manually</span>
              </div>
              <input
                type="text"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 09:30 AM - 10:30 AM or 11:15 AM - 12:45 PM"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
              />

              {/* Custom Presets Below */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Click Custom Class Time to Pick:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeClassTimes.map((slot) => {
                    const isSelected = time === slot.time;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setTime(slot.time)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400'
                            : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200'
                        }`}
                      >
                        <Clock className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-blue-500'}`} />
                        <span className="font-mono">{slot.time}</span>
                        {slot.label && (
                          <span className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                            isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {slot.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>

          {/* Section 2: Student Attendance Roster Editor */}
          <div className="space-y-3">
            
            {/* Top Toolbar: Search + Quick Batch Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student name, roll number, or last 4..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Batch Actions */}
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => markAll('present')}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <UserCheck className="w-3 h-3 text-emerald-600" />
                  <span>Mark All Present</span>
                </button>
                <button
                  type="button"
                  onClick={() => markAll('absent')}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <UserX className="w-3 h-3 text-rose-600" />
                  <span>Mark All Absent</span>
                </button>
                <button
                  type="button"
                  onClick={invertStatuses}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition cursor-pointer"
                  title="Invert present and absent statuses"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>

            </div>

            {/* Filter Chips & Stats */}
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-1">
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    filterMode === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({students.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('present')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    filterMode === 'present' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-800 hover:text-emerald-950'
                  }`}
                >
                  Present ({presentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('absent')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    filterMode === 'absent' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:text-rose-950'
                  }`}
                >
                  Absent ({absentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('onduty')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    filterMode === 'onduty' ? 'bg-amber-500 text-white shadow-2xs' : 'text-amber-800 hover:text-amber-950'
                  }`}
                >
                  On Duty ({onDutyCount})
                </button>
              </div>

              <div className="text-[11px] font-mono font-bold text-slate-500">
                Showing {filteredStudents.length} students
              </div>
            </div>

            {/* Students List */}
            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-72 overflow-y-auto bg-white">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No students found matching your search.
                </div>
              ) : (
                filteredStudents.map((std, idx) => {
                  const currStatus = statuses[std.id] || 'absent';
                  return (
                    <div
                      key={std.id}
                      className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                    >
                      {/* Left: Student Identity */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 text-center text-[10px] font-mono text-slate-400 font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <div className="w-7 h-7 rounded-full bg-slate-900 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                          {std.last4Digits}
                        </div>
                        <div className="truncate">
                          <h4 className="font-bold text-slate-900 text-xs truncate">
                            {std.name}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-500 block truncate">
                            {std.rollNo}
                          </span>
                        </div>
                      </div>

                      {/* Right: 3 Instant Toggle Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setStudentStatus(std.id, 'present')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                            currStatus === 'present'
                              ? 'bg-emerald-600 text-white shadow-2xs ring-2 ring-emerald-400'
                              : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>P</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setStudentStatus(std.id, 'absent')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                            currStatus === 'absent'
                              ? 'bg-rose-600 text-white shadow-2xs ring-2 ring-rose-400'
                              : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                          }`}
                        >
                          <X className="w-3 h-3" />
                          <span>A</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setStudentStatus(std.id, 'onduty')}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            currStatus === 'onduty' || currStatus === 'late'
                              ? 'bg-amber-500 text-white shadow-2xs ring-2 ring-amber-300'
                              : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                          }`}
                        >
                          <span>OD</span>
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* Delete Session Warning */}
          {confirmDelete && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs animate-in fade-in">
              <div className="flex items-center gap-2 text-rose-800 font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Permanently delete this attendance session and all its records?</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition"
                >
                  Yes, Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </form>

        {/* Modal Bottom Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div>
            {!confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Session</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Attendance Changes</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
