import React, { useState, useEffect } from 'react';
import { ClassSubject, Student, AttendanceRecord, AttendanceStatus, WeeklySyncSettings } from '../types';
import { 
  BookOpen, 
  Plus, 
  CheckCircle2, 
  Zap, 
  ListChecks, 
  UserCheck, 
  UserX, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Save,
  FileSpreadsheet
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSuccessBeep, playDuplicateWarning } from '../utils/audio';
import { getTodayDateString, getWeekNumber } from '../utils/storage';
import { buildSheetSessionPayload, appendAttendanceToGoogleSheet } from '../utils/googleSheets';

interface ClassesPageProps {
  classes: ClassSubject[];
  activeClassId: string;
  onSelectClass: (id: string) => void;
  onAddClass: (cls: ClassSubject) => void;
  onUpdateClass: (cls: ClassSubject) => void;
  onDeleteClass: (id: string) => void;
  students: Student[];
  allRecords: AttendanceRecord[];
  onMarkAttendance: (record: AttendanceRecord) => void;
  onBatchMarkAttendance: (records: AttendanceRecord[]) => void;
  onNavigateToFastEntry: () => void;
  onUpdateSessionDetails?: (
    classId: string, 
    customClassName: string, 
    sessionTime: string, 
    updateClassSubject: boolean
  ) => void;
  settings?: WeeklySyncSettings;
  onUpdateSettings?: (settings: WeeklySyncSettings) => void;
}

const COLOR_OPTIONS = [
  '#2563eb', // Blue
  '#059669', // Emerald
  '#7c3aed', // Purple
  '#d97706', // Amber
  '#dc2626', // Red
  '#0891b2', // Cyan
  '#db2777', // Pink
  '#4f46e5', // Indigo
];

export const ClassesPage: React.FC<ClassesPageProps> = ({
  classes,
  activeClassId,
  onSelectClass,
  onAddClass,
  onUpdateClass,
  onDeleteClass,
  students,
  allRecords,
  onMarkAttendance,
  onBatchMarkAttendance,
  onNavigateToFastEntry,
  onUpdateSessionDetails,
  settings,
  onUpdateSettings
}) => {
  const currentClass = classes.find(c => c.id === activeClassId) || classes[0];

  // View state: 'overview' | 'roll-call' | 'grid-roll'
  const [viewMode, setViewMode] = useState<'overview' | 'roll-call' | 'grid-roll'>('overview');
  
  // Roll call stepper index
  const [rollIndex, setRollIndex] = useState(0);

  // Add / Edit class modal
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSubject | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Save Attendance Modal with Manual Time input
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [manualSessionTime, setManualSessionTime] = useState('');
  const [manualClassName, setManualClassName] = useState('');
  const [markRemainingAsAbsent, setMarkRemainingAsAbsent] = useState(true);
  const [syncToGoogleSheet, setSyncToGoogleSheet] = useState(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Active Session tracking (Session 1, Session 2, etc. for same subject)
  const [activeSessionId, setActiveSessionId] = useState<string>('session-1');
  const [activeSessionTitle, setActiveSessionTitle] = useState<string>('1st Class');

  const [classForm, setClassForm] = useState<{
    name: string;
    code: string;
    teacherName: string;
    room: string;
    color: string;
    classTimes: string[];
  }>({
    name: '',
    code: '',
    teacherName: '',
    room: '',
    color: COLOR_OPTIONS[0],
    classTimes: ['09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:15 AM - 12:15 PM'],
  });
  const [newTimeInput, setNewTimeInput] = useState('');
  const [activeClassNewTimeInput, setActiveClassNewTimeInput] = useState('');
  const [isAddingClassTimeInline, setIsAddingClassTimeInline] = useState(false);

  const handleAddInlineClassTime = (cls: ClassSubject, timeToAdd: string) => {
    const time = timeToAdd.trim();
    if (!time) return;
    const existing = cls.classTimes && cls.classTimes.length > 0 
      ? cls.classTimes 
      : ['09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:15 AM - 12:15 PM'];
    if (existing.includes(time)) {
      setActiveClassNewTimeInput('');
      setIsAddingClassTimeInline(false);
      return;
    }
    const updatedTimes = [...existing, time];
    onUpdateClass({
      ...cls,
      classTimes: updatedTimes,
    });
    setActiveClassNewTimeInput('');
    setIsAddingClassTimeInline(false);
  };

  const handleRemoveInlineClassTime = (cls: ClassSubject, timeToRemove: string) => {
    const existing = cls.classTimes && cls.classTimes.length > 0 
      ? cls.classTimes 
      : ['09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:15 AM - 12:15 PM'];
    const updatedTimes = existing.filter(t => t !== timeToRemove);
    onUpdateClass({
      ...cls,
      classTimes: updatedTimes,
    });
  };

  const todayStr = getTodayDateString();
  const currentWeek = getWeekNumber();

  // Current class records for today in the active session
  const todayClassRecords = allRecords.filter(
    r => r.date === todayStr && r.classId === currentClass.id && (r.sessionId || 'session-1') === activeSessionId
  );

  const recordMap = new Map<string, AttendanceRecord>();
  todayClassRecords.forEach(r => recordMap.set(r.studentId, r));

  const presentCount = todayClassRecords.filter(r => r.status === 'present').length;
  const absentCount = todayClassRecords.filter(r => r.status === 'absent').length;
  const onDutyCount = todayClassRecords.filter(r => r.status === 'onduty' || r.status === 'late').length;

  const currentStudent = students[rollIndex] || students[0];
  const currentRecord = currentStudent ? recordMap.get(currentStudent.id) : null;

  // Keyboard shortcut listener for Roll Call Mode
  useEffect(() => {
    if (viewMode !== 'roll-call') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'p' || e.key === 'P' || e.key === 'Enter') {
        e.preventDefault();
        handleMarkCurrent('present');
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handleMarkCurrent('absent');
      } else if (e.key === 'o' || e.key === 'O' || e.key === 'd' || e.key === 'D' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleMarkCurrent('onduty');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextStudent();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevStudent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, rollIndex, currentClass.id, students, activeSessionId, activeSessionTitle]);

  const handleMarkStudent = (student: Student, status: AttendanceStatus) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const finalStatus = status === 'late' ? 'onduty' : status;

    const newRecord: AttendanceRecord = {
      id: `rec-${currentClass.id}-${student.id}-${todayStr}-${activeSessionId}`,
      studentId: student.id,
      studentRollNo: student.rollNo,
      studentName: student.name,
      studentLast4: student.last4Digits,
      classId: currentClass.id,
      className: currentClass.name,
      date: todayStr,
      time: timeStr,
      status: finalStatus,
      weekNumber: currentWeek,
      dayOfWeek: now.getDay() || 7,
      markedVia: 'roll_call',
      timestamp: Date.now(),
      sessionId: activeSessionId,
      sessionTime: manualSessionTime || currentClass.scheduleTime || timeStr,
      sessionTitle: activeSessionTitle,
    };

    onMarkAttendance(newRecord);
    playSuccessBeep();
  };

  const handleMarkCurrent = (status: AttendanceStatus) => {
    if (!currentStudent) return;
    handleMarkStudent(currentStudent, status);

    // Auto advance to next student if not at end
    if (rollIndex < students.length - 1) {
      setRollIndex(prev => prev + 1);
    } else {
      confetti({
        particleCount: 80,
        spread: 60,
      });
    }
  };

  const handleNextStudent = () => {
    if (rollIndex < students.length - 1) {
      setRollIndex(prev => prev + 1);
    }
  };

  const handlePrevStudent = () => {
    if (rollIndex > 0) {
      setRollIndex(prev => prev - 1);
    }
  };

  const handleMarkAllRemaining = (status: AttendanceStatus) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newRecords: AttendanceRecord[] = [];
    const finalStatus = status === 'late' ? 'onduty' : status;

    students.forEach((s) => {
      if (!recordMap.has(s.id)) {
        newRecords.push({
          id: `rec-${currentClass.id}-${s.id}-${todayStr}-${activeSessionId}`,
          studentId: s.id,
          studentRollNo: s.rollNo,
          studentName: s.name,
          studentLast4: s.last4Digits,
          classId: currentClass.id,
          className: currentClass.name,
          date: todayStr,
          time: timeStr,
          status: finalStatus,
          weekNumber: currentWeek,
          dayOfWeek: now.getDay() || 7,
          markedVia: 'roll_call',
          timestamp: Date.now(),
          sessionId: activeSessionId,
          sessionTime: manualSessionTime || currentClass.scheduleTime || timeStr,
          sessionTitle: activeSessionTitle,
        });
      }
    });

    if (newRecords.length > 0) {
      onBatchMarkAttendance(newRecords);
      playSuccessBeep();
    }
  };

  const handleOpenAddClass = () => {
    setClassForm({
      name: '',
      code: '',
      teacherName: '',
      room: '',
      color: COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)],
      classTimes: ['09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:15 AM - 12:15 PM'],
    });
    setEditingClass(null);
    setNewTimeInput('');
    setIsAddClassModalOpen(true);
  };

  const handleOpenEditClass = (cls: ClassSubject) => {
    setEditingClass(cls);
    setClassForm({
      name: cls.name,
      code: cls.code,
      teacherName: cls.teacherName,
      room: cls.room,
      color: cls.color,
      classTimes: cls.classTimes && cls.classTimes.length > 0 ? cls.classTimes : ['09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:15 AM - 12:15 PM'],
    });
    setNewTimeInput('');
    setIsAddClassModalOpen(true);
  };

  const handleSaveClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name.trim()) return;

    if (editingClass) {
      onUpdateClass({
        ...editingClass,
        name: classForm.name.trim(),
        code: classForm.code.trim() || 'CLASS',
        teacherName: classForm.teacherName.trim() || 'Faculty Incharge',
        room: classForm.room.trim() || 'Main Hall',
        color: classForm.color,
        classTimes: classForm.classTimes,
      });
    } else {
      const newCls: ClassSubject = {
        id: `cls-${Date.now()}`,
        name: classForm.name.trim(),
        code: classForm.code.trim() || 'CLASS',
        teacherName: classForm.teacherName.trim() || 'Faculty Incharge',
        room: classForm.room.trim() || 'Main Hall',
        color: classForm.color,
        classTimes: classForm.classTimes,
      };
      onAddClass(newCls);
      onSelectClass(newCls.id);
    }

    setIsAddClassModalOpen(false);
  };

  const handleOpenSaveModal = () => {
    setManualClassName(currentClass.name);
    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setManualSessionTime(`${timeFormatted} Session`);
    setIsSaveModalOpen(true);
  };

  const handleSaveAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTime = manualSessionTime.trim() || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const finalClassName = manualClassName.trim() || currentClass.name;

    const updatedRecords: AttendanceRecord[] = [];
    const timestamp = Date.now();
    const nowTimeStr = new Date().toTimeString().split(' ')[0];

    students.forEach(std => {
      const existing = recordMap.get(std.id);
      if (existing) {
        updatedRecords.push({
          ...existing,
          className: finalClassName,
          sessionTime: finalTime,
          sessionId: activeSessionId,
          sessionTitle: activeSessionTitle,
        });
      } else if (markRemainingAsAbsent) {
        updatedRecords.push({
          id: `rec-${std.id}-${currentClass.id}-${todayStr}-${activeSessionId}`,
          studentId: std.id,
          studentRollNo: std.rollNo,
          studentName: std.name,
          studentLast4: std.last4Digits,
          classId: currentClass.id,
          className: finalClassName,
          date: todayStr,
          time: nowTimeStr,
          status: 'absent',
          weekNumber: currentWeek,
          dayOfWeek: new Date().getDay(),
          markedVia: 'roll_call',
          timestamp: timestamp,
          sessionId: activeSessionId,
          sessionTime: finalTime,
          sessionTitle: activeSessionTitle,
        });
      }
    });

    if (updatedRecords.length > 0) {
      onBatchMarkAttendance(updatedRecords);
    }

    if (onUpdateSessionDetails) {
      onUpdateSessionDetails(currentClass.id, finalClassName, finalTime, true, activeSessionId);
    }

    // Google Sheets Auto Append if enabled
    let sheetSyncMsg = '';
    if (syncToGoogleSheet && settings && settings.googleSheetUrl) {
      try {
        const targetTabName = settings?.classTabNames?.[currentClass.id] || currentClass.sheetTabName || currentClass.name;
        const targetSheetUrl = (settings?.syncStrategy === 'separate_sheets' && settings?.classSheetUrls?.[currentClass.id])
          ? settings.classSheetUrls[currentClass.id]
          : settings.googleSheetUrl;

        const payload = buildSheetSessionPayload({
          currentClass: { ...currentClass, name: finalClassName },
          currentSessionTime: finalTime,
          todayDateStr: todayStr,
          students,
          records: updatedRecords,
          settings,
          customTabName: targetTabName,
        });
        const syncRes = await appendAttendanceToGoogleSheet(payload, { ...settings, googleSheetUrl: targetSheetUrl });
        if (syncRes.success) {
          sheetSyncMsg = ` • Synced to Google Sheet!`;
        } else if (syncRes.needsGoogleAuth) {
          sheetSyncMsg = ` • (Sign In with Google in Sheet Settings to auto-write rows)`;
        }
      } catch (err) {
        console.warn('Google Sheet auto-sync error in ClassesPage:', err);
      }
    }

    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 }
    });
    playSuccessBeep();

    setSaveSuccessMsg(`Attendance saved for ${activeSessionTitle} at "${finalTime}"!${sheetSyncMsg}`);
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setIsSaveModalOpen(false);
    }, 2000);
  };


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-800 border border-emerald-300">
              Page 3 • Subject & Class Control
            </span>
            <span className="text-xs text-slate-500">{classes.length} Classes Configured</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Select Class & Roll Call Mode
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Click any class to select it (e.g. <strong>Tech Class</strong> or <strong>Communication Class</strong>), then launch rapid 4-digit entry or read aloud in sequential Roll-Call mode.
          </p>
        </div>

        <button
          id="add-new-class-btn"
          onClick={handleOpenAddClass}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md shadow-blue-500/20 transition flex items-center gap-2 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add New Class / Subject</span>
        </button>
      </div>

      {/* Class Cards Grid (Click to Select Active Class) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {classes.map((cls) => {
          const isSelected = cls.id === activeClassId;
          const clsRecordsToday = allRecords.filter(r => r.date === todayStr && r.classId === cls.id);

          // Group records by session so multiple classes of the same subject show separately
          const sessionMap = new Map<string, { id: string; title: string; time: string; records: AttendanceRecord[] }>();
          clsRecordsToday.forEach(r => {
            const sId = r.sessionId || (r.sessionTime ? `time-${r.sessionTime}` : 'session-1');
            if (!sessionMap.has(sId)) {
              sessionMap.set(sId, {
                id: sId,
                title: r.sessionTitle || (sId === 'session-1' ? '1st Class' : sId === 'session-2' ? '2nd Class' : 'Class Session'),
                time: r.sessionTime || r.time || cls.scheduleTime || 'Session',
                records: []
              });
            }
            sessionMap.get(sId)!.records.push(r);
          });
          const sessionsList = Array.from(sessionMap.values());

          return (
            <div
              key={cls.id}
              onClick={() => onSelectClass(cls.id)}
              className={`rounded-2xl p-5 border-2 cursor-pointer transition-all duration-200 relative group flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-b from-white to-blue-50/50 border-blue-600 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
              }`}
            >
              {/* Top Accent Strip */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span 
                    className="w-3.5 h-3.5 rounded-full ring-4 ring-white shadow-xs"
                    style={{ backgroundColor: cls.color }} 
                  />
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase">
                    {cls.code}
                  </span>
                </div>

                {isSelected ? (
                  <span className="bg-blue-600 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                    <Check className="w-3 h-3" />
                    Selected
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 group-hover:text-blue-600 font-medium">
                    Click to select
                  </span>
                )}
              </div>

              {/* Class Title & Details */}
              <div className="mb-4">
                <h3 className="font-bold text-slate-900 text-lg leading-snug group-hover:text-blue-600 transition">
                  {cls.name}
                </h3>
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  {cls.teacherName}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {cls.room} • {cls.code}
                </p>
                {/* Custom class times badges */}
                {cls.classTimes && cls.classTimes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {cls.classTimes.slice(0, 3).map((ct, i) => (
                      <span key={i} className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {ct}
                      </span>
                    ))}
                    {cls.classTimes.length > 3 && (
                      <span className="text-[10px] font-bold text-slate-400 self-center">
                        +{cls.classTimes.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Quick Stats & Actions (Separate sessions shown distinctly!) */}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs flex-1">
                    {sessionsList.length === 0 ? (
                      <div className="text-slate-400">
                        <span>Today: </span>
                        <span className="font-semibold text-slate-500">Not taken yet</span>
                        <span className="text-slate-400 ml-1">({students.length} Total)</span>
                      </div>
                    ) : sessionsList.length === 1 ? (
                      <div className="text-slate-600">
                        <span className="text-slate-500 font-semibold">{sessionsList[0].title}: </span>
                        <strong className="text-emerald-700 font-black text-sm">
                          {sessionsList[0].records.filter(r => r.status === 'present').length}
                        </strong>
                        <span className="text-slate-500 font-bold">/{students.length} P</span>
                        {sessionsList[0].records.filter(r => r.status === 'onduty' || r.status === 'late').length > 0 && (
                          <span className="ml-1 text-[11px] font-bold text-amber-600">
                            ({sessionsList[0].records.filter(r => r.status === 'onduty' || r.status === 'late').length} OD)
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{sessionsList[0].time}</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 w-full">
                        <div className="text-[10px] font-black text-indigo-700 uppercase tracking-wider flex items-center justify-between">
                          <span>{sessionsList.length} Classes Taken Today:</span>
                          <span className="text-[9px] text-slate-400 font-normal">Separate Slots</span>
                        </div>
                        {sessionsList.map((sess, idx) => {
                          const pCount = sess.records.filter(r => r.status === 'present').length;
                          const odCount = sess.records.filter(r => r.status === 'onduty' || r.status === 'late').length;
                          return (
                            <div key={sess.id} className="text-xs bg-slate-50 border border-slate-200/90 rounded-lg px-2 py-1 flex items-center justify-between">
                              <span className="font-semibold text-slate-700 text-[11px] truncate max-w-[120px]">
                                {sess.title || `Class ${idx + 1}`} ({sess.time})
                              </span>
                              <span className="font-black text-emerald-700 shrink-0">
                                {pCount}/{students.length} P {odCount > 0 ? <span className="text-amber-600 text-[10px]">({odCount} OD)</span> : null}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenEditClass(cls)}
                      title="Edit Class"
                      className="p-1 text-slate-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {classes.length > 1 && (
                      <button
                        onClick={() => setDeleteConfirmId(cls.id)}
                        title="Delete Class"
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Mode Switcher for the Active Class */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl mb-6 border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: currentClass.color }} />
              <span className="text-xs text-blue-300 font-semibold uppercase tracking-wider">Active Subject</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Taking Attendance for: {currentClass.name}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Faculty: <span className="text-white font-medium">{currentClass.teacherName}</span> • Venue: {currentClass.room} • {activeSessionTitle}: <strong className="text-emerald-400 font-semibold">{presentCount} Present</strong>, <strong className="text-rose-400 font-semibold">{absentCount} Absent</strong>, <strong className="text-amber-400 font-semibold">{onDutyCount} On Duty</strong>
            </p>

            {/* Same Subject Multiple Class Sessions Selector */}
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-slate-800">
              <span className="text-xs text-indigo-300 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Class Slot:</span>
              </span>
              {[
                { id: 'session-1', title: '1st Class' },
                { id: 'session-2', title: '2nd Class' },
                { id: 'session-3', title: '3rd Class' },
              ].map(sess => (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => {
                    setActiveSessionId(sess.id);
                    setActiveSessionTitle(sess.title);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeSessionId === sess.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-400'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{sess.title}</span>
                  {activeSessionId === sess.id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </button>
              ))}
            </div>

            {/* Custom Class Times for Active Subject with + Add Class Time option */}
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-800/80">
              <span className="text-xs text-blue-300 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Class Times:</span>
              </span>

              {(currentClass.classTimes && currentClass.classTimes.length > 0 
                ? currentClass.classTimes 
                : ['09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:15 AM - 12:15 PM']
              ).map(slot => (
                <span 
                  key={slot}
                  className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 flex items-center gap-1.5"
                >
                  <span>{slot}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveInlineClassTime(currentClass, slot)}
                    className="text-slate-400 hover:text-rose-400 cursor-pointer"
                    title="Remove this time slot"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {!isAddingClassTimeInline ? (
                <button
                  type="button"
                  onClick={() => setIsAddingClassTimeInline(true)}
                  className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Time Slot</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={activeClassNewTimeInput}
                    onChange={(e) => setActiveClassNewTimeInput(e.target.value)}
                    placeholder="e.g. 02:00 PM - 03:00 PM"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddInlineClassTime(currentClass, activeClassNewTimeInput);
                      }
                    }}
                    className="px-2 py-0.5 bg-slate-800 border border-blue-500 rounded text-xs text-white focus:outline-none w-44 font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleAddInlineClassTime(currentClass, activeClassNewTimeInput)}
                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingClassTimeInline(false);
                      setActiveClassNewTimeInput('');
                    }}
                    className="p-0.5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Pathways */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="goto-fast-entry-from-classes"
              onClick={onNavigateToFastEntry}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-500/20 transition flex items-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Option 1: Quick 4-Digit Entry</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="switch-roll-call-mode-btn"
              onClick={() => setViewMode(viewMode === 'roll-call' ? 'overview' : 'roll-call')}
              className={`px-4 py-2.5 font-semibold rounded-xl text-sm transition flex items-center gap-2 border ${
                viewMode === 'roll-call'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <ListChecks className="w-4 h-4 text-emerald-300" />
              <span>Option 2: Interactive Roll Call Mode</span>
            </button>

            <button
              onClick={() => setViewMode(viewMode === 'grid-roll' ? 'overview' : 'grid-roll')}
              className={`px-4 py-2.5 font-semibold rounded-xl text-sm transition flex items-center gap-2 border ${
                viewMode === 'grid-roll'
                  ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <span>Grid Call-Out</span>
            </button>

            <button
              id="save-attendance-btn-classes"
              onClick={handleOpenSaveModal}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-500/20 transition flex items-center gap-2"
            >
              <Save className="w-4 h-4 text-emerald-200" />
              <span>Save Attendance (Enter Time)</span>
            </button>
          </div>
        </div>
      </div>

      {/* OPTION 2: Interactive Roll-Call Mode (Step-by-Step Card) */}
      {viewMode === 'roll-call' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 mb-8 animate-in fade-in zoom-in duration-150">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Roll Call Mode Active
              </span>
              <h3 className="font-bold text-slate-900 text-lg mt-1.5">
                Read the 4-Digit Code & Press Present / Absent
              </h3>
            </div>

            {/* Stepper position & Batch Actions */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-slate-500">
                Student {rollIndex + 1} of {students.length}
              </span>
              
              <div className="flex items-center space-x-1">
                <button
                  onClick={handlePrevStudent}
                  disabled={rollIndex === 0}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition"
                  title="Previous (Left Arrow)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextStudent}
                  disabled={rollIndex === students.length - 1}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition"
                  title="Next (Right Arrow)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Big Interactive Calling Card */}
          {currentStudent ? (
            <div className="py-8 max-w-xl mx-auto text-center flex flex-col items-center">
              
              {/* Highlighted 4-Digit Display */}
              <div className="inline-block bg-slate-900 text-emerald-400 px-8 py-4 rounded-3xl font-mono text-5xl sm:text-6xl font-black tracking-widest shadow-xl border-4 border-emerald-500/40 mb-4">
                {currentStudent.last4Digits}
              </div>
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">
                Last 4 Digits to Announce
              </span>

              {/* Student Details */}
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1">
                {currentStudent.name}
              </h2>
              <p className="text-sm font-mono text-slate-500">
                Full Roll No: <strong className="text-slate-800">{currentStudent.rollNo}</strong> • {currentStudent.batch}
              </p>

              {/* Current Marked Status Tag */}
              <div className="mt-4">
                {currentRecord ? (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    currentRecord.status === 'present' 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : currentRecord.status === 'onduty' || currentRecord.status === 'late'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    Currently Marked: {currentRecord.status === 'onduty' || currentRecord.status === 'late' ? 'ON DUTY' : currentRecord.status.toUpperCase()} ({currentRecord.time})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                    Not Marked Yet
                  </span>
                )}
              </div>

              {/* Giant Decision Buttons - Order: Present, Absent, On Duty */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full mt-8">
                
                {/* Present Button */}
                <button
                  id="rollcall-mark-present-btn"
                  onClick={() => handleMarkCurrent('present')}
                  className="py-4 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                >
                  <UserCheck className="w-7 h-7" />
                  <span className="text-base sm:text-lg">Present</span>
                  <span className="text-[11px] opacity-80 font-mono">(Key: P or Enter)</span>
                </button>

                {/* Absent Button */}
                <button
                  id="rollcall-mark-absent-btn"
                  onClick={() => handleMarkCurrent('absent')}
                  className="py-4 px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-rose-600/30 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                >
                  <UserX className="w-7 h-7" />
                  <span className="text-base sm:text-lg">Absent</span>
                  <span className="text-[11px] opacity-80 font-mono">(Key: A)</span>
                </button>

                {/* On Duty Button */}
                <button
                  id="rollcall-mark-onduty-btn"
                  onClick={() => handleMarkCurrent('onduty')}
                  className="py-4 px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/30 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Clock className="w-7 h-7" />
                  <span className="text-base sm:text-lg">On Duty (OD)</span>
                  <span className="text-[11px] opacity-80 font-mono">(Key: O or D)</span>
                </button>

              </div>

              {/* Keyboard helper hints */}
              <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-400">
                <span>Keyboard Shortcuts:</span>
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">P / Enter</span> = Present
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">A</span> = Absent
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">O / D</span> = On Duty
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">← / →</span> = Prev / Next
              </div>

            </div>
          ) : (
            <div className="py-12 text-center text-slate-500">
              <p className="font-semibold text-slate-700">No students found in your class roster.</p>
              <p className="text-xs text-slate-400 mt-1">Add students on Page 2 (Student Roster) to begin calling attendance.</p>
            </div>
          )}

          {/* Stepper Progress Bar */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Progress: {rollIndex + 1} / {students.length}</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleMarkAllRemaining('absent')}
                className="text-rose-600 hover:underline font-medium"
              >
                Mark all uncalled as Absent
              </button>
              <span>•</span>
              <button
                onClick={() => setViewMode('overview')}
                className="text-blue-600 hover:underline font-medium"
              >
                Exit Roll Call Mode
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Grid Call-Out Mode */}
      {viewMode === 'grid-roll' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Grid Roster Call-Out for {currentClass.name}</h3>
              <p className="text-xs text-slate-500">Click P, L, or A on any student row</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMarkAllRemaining('present')}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold"
              >
                Mark All Present
              </button>
              <button
                onClick={() => handleMarkAllRemaining('absent')}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold"
              >
                Mark All Absent
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {students.map((s) => {
              const rec = recordMap.get(s.id);
              const status = rec?.status;

              return (
                <div
                  key={s.id}
                  className={`p-3 rounded-xl border transition flex items-center justify-between ${
                    status === 'present'
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : status === 'late'
                      ? 'bg-amber-50/60 border-amber-200'
                      : status === 'absent'
                      ? 'bg-rose-50/60 border-rose-200'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <span className="w-10 h-8 rounded-lg bg-slate-900 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {s.last4Digits}
                    </span>
                    <div className="truncate">
                      <p className="font-bold text-xs text-slate-900 truncate">{s.name}</p>
                      <p className="text-[11px] font-mono text-slate-400">{s.rollNo}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => handleMarkStudent(s, 'present')}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                        status === 'present' 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'
                      }`}
                      title="Present"
                    >
                      P
                    </button>
                    <button
                      onClick={() => handleMarkStudent(s, 'late')}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                        status === 'late' 
                          ? 'bg-amber-500 text-white shadow-xs' 
                          : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700'
                      }`}
                      title="Late"
                    >
                      L
                    </button>
                    <button
                      onClick={() => handleMarkStudent(s, 'absent')}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                        status === 'absent' 
                          ? 'bg-rose-600 text-white shadow-xs' 
                          : 'bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700'
                      }`}
                      title="Absent"
                    >
                      A
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Class Modal */}
      {isAddClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingClass ? 'Edit Subject / Class' : 'Add New Subject / Class'}
              </h3>
              <button
                onClick={() => setIsAddClassModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClass} className="space-y-4 my-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Class / Subject Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  placeholder="e.g. Tech Class, Communication Class, Web Dev"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Course Code
                  </label>
                  <input
                    type="text"
                    value={classForm.code}
                    onChange={(e) => setClassForm({ ...classForm, code: e.target.value })}
                    placeholder="e.g. CS401"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 uppercase font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Room / Lab
                  </label>
                  <input
                    type="text"
                    value={classForm.room}
                    onChange={(e) => setClassForm({ ...classForm, room: e.target.value })}
                    placeholder="e.g. Lab 402, LH-3"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Teacher / Professor Name
                </label>
                <input
                  type="text"
                  value={classForm.teacherName}
                  onChange={(e) => setClassForm({ ...classForm, teacherName: e.target.value })}
                  placeholder="e.g. Prof. / Faculty Incharge"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Class Lecture Times / Presets Section */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Class Lecture Times / Slots</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Shown in presets when taking attendance</span>
                </label>

                {/* Chips of existing times */}
                <div className="flex flex-wrap gap-1.5">
                  {classForm.classTimes.map((t, idx) => (
                    <span 
                      key={idx}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = classForm.classTimes.filter((_, i) => i !== idx);
                          setClassForm({ ...classForm, classTimes: updated });
                        }}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add new slot input */}
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newTimeInput}
                    onChange={(e) => setNewTimeInput(e.target.value)}
                    placeholder="e.g. 02:00 PM - 03:00 PM"
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newTimeInput.trim()) {
                          setClassForm({ ...classForm, classTimes: Array.from(new Set([...classForm.classTimes, newTimeInput.trim()])) });
                          setNewTimeInput('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newTimeInput.trim()) {
                        setClassForm({ ...classForm, classTimes: Array.from(new Set([...classForm.classTimes, newTimeInput.trim()])) });
                        setNewTimeInput('');
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    + Add Time
                  </button>
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Theme Color Badge
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setClassForm({ ...classForm, color })}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        classForm.color === color ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddClassModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20"
                >
                  {editingClass ? 'Save Changes' : 'Create Class'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Delete Class Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Delete Class?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Are you sure you want to remove this subject? Historical attendance records will remain saved.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteClass(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-md shadow-rose-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Attendance Modal (Manual Time Entry + Class Name + Google Sheet Sync) */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Save Attendance Session</h3>
                  <p className="text-xs text-slate-500">Manually set session time and finalize records</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveSuccessMsg ? (
              <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
                <h4 className="font-bold text-emerald-950 text-base">Session Saved!</h4>
                <p className="text-xs text-emerald-800">{saveSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSaveAttendanceSubmit} className="space-y-4">
                {/* Manual Session Time (Core user requirement!) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Lecture / Session Time (Manual Entry)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={manualSessionTime}
                    onChange={(e) => setManualSessionTime(e.target.value)}
                    placeholder="e.g. 09:30 AM - 10:30 AM or 11:15 AM - 12:45 PM"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(currentClass.classTimes && currentClass.classTimes.length > 0 
                      ? currentClass.classTimes 
                      : ['09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:15 AM - 12:15 PM', '01:00 PM - 02:00 PM', '02:00 PM - 03:00 PM']
                    ).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setManualSessionTime(slot)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                          manualSessionTime === slot
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setManualSessionTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' Session');
                      }}
                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                    >
                      Current Time
                    </button>
                  </div>
                </div>

                {/* Subject / Class Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Subject / Class Name
                  </label>
                  <input
                    type="text"
                    value={manualClassName}
                    onChange={(e) => setManualClassName(e.target.value)}
                    placeholder={currentClass.name}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Session Stats Tally */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                  <div className="text-center flex-1">
                    <span className="block text-slate-400 text-[10px] uppercase font-bold">Present</span>
                    <strong className="text-emerald-600 text-base">{presentCount}</strong>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div className="text-center flex-1">
                    <span className="block text-slate-400 text-[10px] uppercase font-bold">Absent</span>
                    <strong className="text-rose-600 text-base">{absentCount}</strong>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div className="text-center flex-1">
                    <span className="block text-slate-400 text-[10px] uppercase font-bold">On Duty</span>
                    <strong className="text-amber-600 text-base">{onDutyCount}</strong>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div className="text-center flex-1">
                    <span className="block text-slate-400 text-[10px] uppercase font-bold">Unmarked</span>
                    <strong className="text-slate-600 text-base">{Math.max(0, students.length - (presentCount + absentCount + onDutyCount))}</strong>
                  </div>
                </div>

                {/* Checkbox Options */}
                <div className="space-y-2 pt-1 text-xs text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markRemainingAsAbsent}
                      onChange={(e) => setMarkRemainingAsAbsent(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Mark all remaining unmarked students as <strong>Absent</strong></span>
                  </label>

                  {settings?.googleSheetUrl && (
                    <label className="flex items-center gap-2 cursor-pointer text-emerald-800 font-medium">
                      <input
                        type="checkbox"
                        checked={syncToGoogleSheet}
                        onChange={(e) => setSyncToGoogleSheet(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="flex items-center gap-1">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Sync attendance to Google Sheet immediately</span>
                      </span>
                    </label>
                  )}
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSaveModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Confirm & Save Attendance</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
