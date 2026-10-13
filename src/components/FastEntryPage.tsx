import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Student, ClassSubject, AttendanceRecord, AttendanceStatus, WeeklySyncSettings } from '../types';
import { 
  Zap, 
  CheckCircle, 
  AlertTriangle, 
  UserCheck, 
  Clock, 
  RotateCcw, 
  Search, 
  Users, 
  Sparkles,
  Check, 
  X, 
  Volume2, 
  VolumeX, 
  Keyboard, 
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  UserX,
  Table2,
  CheckCircle2,
  Save,
  FileSpreadsheet,
  QrCode,
  Calendar,
  Lock,
  ExternalLink,
  Share2,
  Send,
  Edit3,
  Plus,
  Layers,
  Award
} from 'lucide-react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { playSuccessBeep, playDuplicateWarning, playErrorBuzz } from '../utils/audio';
import { getTodayDateString, getWeekNumber, loadGlobalClassTimes, saveGlobalClassTimes, DEFAULT_CLASS_TIMES, sortStudentsByLast4Digits } from '../utils/storage';
import { buildTeacherDocUrl } from '../utils/qrHelper';
import { SendReportToSirModal } from './SendReportToSirModal';
import { GoogleSheetConfigModal } from './GoogleSheetConfigModal';
import { NewSessionModal } from './NewSessionModal';
import { AbsenteeSummaryModal } from './AbsenteeSummaryModal';
import { CopyStudentsForSheetsModal } from './CopyStudentsForSheetsModal';
import { buildSheetSessionPayload, appendAttendanceToGoogleSheet, extractGoogleSheetId } from '../utils/googleSheets';

interface FastEntryPageProps {
  students: Student[];
  currentClass: ClassSubject;
  allClasses?: ClassSubject[];
  onSelectClass?: (classId: string) => void;
  allRecords: AttendanceRecord[];
  onMarkAttendance: (record: AttendanceRecord) => void;
  onBatchMarkAttendance?: (records: AttendanceRecord[]) => void;
  onUpdateRecordStatus: (recordId: string, newStatus: AttendanceStatus) => void;
  onDeleteRecord: (recordId: string) => void;
  onSwitchToClasses: () => void;
  onSwitchToStudents?: () => void;
  onSwitchToSheets?: () => void;
  onSwitchToHowToUse?: () => void;
  onUpdateClass?: (cls: ClassSubject) => void;
  onUpdateSessionDetails?: (classId: string, customClassName: string, sessionTime: string, updateClassSubject: boolean, sessionId?: string) => void;
  settings?: WeeklySyncSettings;
  onUpdateSettings?: (settings: WeeklySyncSettings) => void;
}

export const FastEntryPage: React.FC<FastEntryPageProps> = ({
  students,
  currentClass,
  allClasses = [],
  onSelectClass,
  allRecords,
  onMarkAttendance,
  onBatchMarkAttendance,
  onUpdateRecordStatus,
  onDeleteRecord,
  onSwitchToClasses,
  onSwitchToStudents,
  onSwitchToSheets,
  onSwitchToHowToUse,
  onUpdateClass,
  onUpdateSessionDetails,
  settings,
  onUpdateSettings
}) => {
  // Students roster always sorted in ascending order based on last 4 digits
  const sortedStudents = useMemo(() => sortStudentsByLast4Digits(students), [students]);

  // Attendance Mode Selector: 1. 4-Digit Keypad, 2. Interactive Roll Call, 3. Grid Call-Out
  const [attendanceMode, setAttendanceMode] = useState<'4digit' | 'roll-call' | 'grid'>('4digit');

  // Google Sheet Link and Auto-Store States
  const [showSheetConfigModal, setShowSheetConfigModal] = useState<boolean>(false);
  const [syncToGoogleSheetOnSave, setSyncToGoogleSheetOnSave] = useState<boolean>(
    settings?.autoAppendOnSave ?? true
  );
  const [quickSheetInput, setQuickSheetInput] = useState<string>('');

  // Multi-Session Attendance States (Take attendance for same class multiple times a day: 1st class at xx time, 2nd class at yy time)
  const [activeSessionId, setActiveSessionId] = useState<string>('session-1');
  const [activeSessionTitle, setActiveSessionTitle] = useState<string>('1st Class');
  const [showNewSessionModal, setShowNewSessionModal] = useState<boolean>(false);

  // Manual Class Name & Time States (Customizable after or during taking attendance)
  const [sessionClassName, setSessionClassName] = useState<string>(currentClass.name);
  const [sessionTime, setSessionTime] = useState<string>(
    currentClass.scheduleTime || '10:00 AM - 11:00 AM'
  );
  const [markUnmarkedAsAbsent, setMarkUnmarkedAsAbsent] = useState<boolean>(true);
  const [updateMasterClass, setUpdateMasterClass] = useState<boolean>(false);
  const [applyToTodayRecords, setApplyToTodayRecords] = useState<boolean>(true);

  // Sync state if active currentClass changes
  useEffect(() => {
    setSessionClassName(currentClass.name);
    const today = getTodayDateString();
    const classTodayRecs = allRecords.filter(r => r.date === today && r.classId === currentClass.id);
    const existingIds = Array.from(new Set(classTodayRecs.map(r => r.sessionId || 'session-1')));

    if (existingIds.includes(activeSessionId)) {
      const rec = classTodayRecs.find(r => (r.sessionId || 'session-1') === activeSessionId);
      if (rec?.sessionTime) setSessionTime(rec.sessionTime);
      if (rec?.sessionTitle) setActiveSessionTitle(rec.sessionTitle);
    } else if (existingIds.length > 0) {
      const firstId = existingIds[0];
      setActiveSessionId(firstId);
      const rec = classTodayRecs.find(r => (r.sessionId || 'session-1') === firstId);
      setActiveSessionTitle(rec?.sessionTitle || (firstId === 'session-1' ? '1st Class' : '2nd Class'));
      setSessionTime(rec?.sessionTime || currentClass.scheduleTime || '10:00 AM - 11:00 AM');
    } else {
      setActiveSessionId('session-1');
      setActiveSessionTitle('1st Class');
      setSessionTime(currentClass.scheduleTime || '10:00 AM - 11:00 AM');
    }
  }, [currentClass.id, currentClass.name, currentClass.scheduleTime]);

  // Custom Class Times State & Handlers
  const [newClassTimeInput, setNewClassTimeInput] = useState('');
  const [isAddingClassTime, setIsAddingClassTime] = useState(false);

  const handleAddClassTime = (timeToAdd?: string) => {
    const time = (timeToAdd || newClassTimeInput).trim();
    if (!time) return;
    const existingTimes = currentClass.classTimes && currentClass.classTimes.length > 0 
      ? currentClass.classTimes 
      : DEFAULT_CLASS_TIMES;
    if (existingTimes.includes(time)) {
      setSessionTime(time);
      setNewClassTimeInput('');
      setIsAddingClassTime(false);
      return;
    }
    const updatedTimes = [...existingTimes, time];
    if (onUpdateClass) {
      onUpdateClass({
        ...currentClass,
        classTimes: updatedTimes,
      });
    }
    setSessionTime(time);
    setNewClassTimeInput('');
    setIsAddingClassTime(false);
  };

  const handleRemoveClassTime = (timeToRemove: string) => {
    const existingTimes = currentClass.classTimes && currentClass.classTimes.length > 0 
      ? currentClass.classTimes 
      : DEFAULT_CLASS_TIMES;
    const updatedTimes = existingTimes.filter(t => t !== timeToRemove);
    if (onUpdateClass) {
      onUpdateClass({
        ...currentClass,
        classTimes: updatedTimes,
      });
    }
  };

  // 4-Digit Keypad States
  const [digits, setDigits] = useState('');
  const [lastMarkedStudent, setLastMarkedStudent] = useState<{
    student: Student;
    status: AttendanceStatus;
    time: string;
    isDuplicate?: boolean;
    alreadyMarkedTime?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSubmit4Digits, setAutoSubmit4Digits] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [showRemainingModal, setShowRemainingModal] = useState(false);

  // Rapid 4-digit entry mark mode: 'present' | 'absent' | 'onduty'
  // When absent: numbers entered are ABSENT, unentered students become PRESENT
  // When present: numbers entered are PRESENT, unentered students become ABSENT
  // When onduty: numbers entered are ON DUTY, unentered students become PRESENT
  const [rapidMarkMode, setRapidMarkMode] = useState<'present' | 'absent' | 'onduty'>('absent');
  const [unmarkedTargetStatus, setUnmarkedTargetStatus] = useState<AttendanceStatus>('present');
  const [latestFinalizedRecords, setLatestFinalizedRecords] = useState<AttendanceRecord[] | null>(null);
  const [showAbsenteeSummaryModal, setShowAbsenteeSummaryModal] = useState(false);
  const [showCopyStudentsModal, setShowCopyStudentsModal] = useState(false);

  // Roll Call Mode States
  const [rollCallIndex, setRollCallIndex] = useState(0);

  // Save Modal States
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSuccessNotification, setSaveSuccessNotification] = useState<string | null>(null);

  // Day Attendance QR Modal States
  const [showDayQrModal, setShowDayQrModal] = useState(false);
  const [showSendReportModal, setShowSendReportModal] = useState(false);
  const [qrDate, setQrDate] = useState(getTodayDateString());
  const [dayQrDataUrl, setDayQrDataUrl] = useState<string>('');
  const [copiedDayQrLink, setCopiedDayQrLink] = useState(false);
  const [isQrZoomed, setIsQrZoomed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const todayStr = getTodayDateString();

  // All records for active class today across all sessions
  const todayAllClassRecords = allRecords.filter(
    r => r.date === todayStr && r.classId === currentClass.id
  );

  // Active session records
  const todayClassRecords = todayAllClassRecords.filter(
    r => (r.sessionId || 'session-1') === activeSessionId
  );

  // Compute existing sessions for this class today
  const existingSessions = React.useMemo(() => {
    const sessionMap = new Map<string, {
      id: string;
      title: string;
      time: string;
      className?: string;
      markedCount: number;
      presentCount: number;
      absentCount: number;
    }>();

    // 1. Always ensure active session is in the map
    sessionMap.set(activeSessionId, {
      id: activeSessionId,
      title: activeSessionTitle,
      time: sessionTime,
      className: sessionClassName || currentClass.name,
      markedCount: 0,
      presentCount: 0,
      absentCount: 0,
    });

    // 2. Also ensure session-1 is always present
    if (!sessionMap.has('session-1')) {
      sessionMap.set('session-1', {
        id: 'session-1',
        title: '1st Class',
        time: currentClass.scheduleTime || '10:00 AM - 11:00 AM',
        className: currentClass.name,
        markedCount: 0,
        presentCount: 0,
        absentCount: 0,
      });
    }

    // 3. Populate from actual records
    todayAllClassRecords.forEach(r => {
      const sId = r.sessionId || 'session-1';
      const existing = sessionMap.get(sId);
      if (existing) {
        existing.markedCount += 1;
        if (r.status === 'present' || r.status === 'late') existing.presentCount += 1;
        if (r.status === 'absent') existing.absentCount += 1;
        if (r.sessionTitle && sId !== activeSessionId) existing.title = r.sessionTitle;
        if (r.sessionTime && sId !== activeSessionId) existing.time = r.sessionTime;
      } else {
        sessionMap.set(sId, {
          id: sId,
          title: r.sessionTitle || (sId === 'session-2' ? '2nd Class' : `Session ${sId.replace('session-', '')}`),
          time: r.sessionTime || r.time || currentClass.scheduleTime || '10:00 AM',
          className: r.className || currentClass.name,
          markedCount: 1,
          presentCount: r.status === 'present' || r.status === 'late' ? 1 : 0,
          absentCount: r.status === 'absent' ? 1 : 0,
        });
      }
    });

    return Array.from(sessionMap.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [todayAllClassRecords, currentClass.id, currentClass.name, currentClass.scheduleTime, activeSessionId, activeSessionTitle, sessionTime, sessionClassName]);

  // Session switching & creation helpers
  const handleStartNewSession = (title: string, time: string) => {
    let nextNum = existingSessions.length + 1;
    let nextId = `session-${nextNum}`;
    while (existingSessions.some(s => s.id === nextId)) {
      nextNum += 1;
      nextId = `session-${nextNum}`;
    }

    setActiveSessionId(nextId);
    setActiveSessionTitle(title);
    setSessionTime(time);
    setShowNewSessionModal(false);
    setDigits('');
    setErrorMessage(null);
    setLastMarkedStudent(null);
    setSaveSuccessNotification(`Switched to "${title}" (${time}). All students ready for attendance!`);
  };

  const handleSelectSession = (sess: { id: string; title: string; time: string; className?: string }) => {
    setActiveSessionId(sess.id);
    setActiveSessionTitle(sess.title);
    setSessionTime(sess.time);
    if (sess.className) setSessionClassName(sess.className);
    setDigits('');
    setErrorMessage(null);
    setLastMarkedStudent(null);
  };

  const markedMap = new Map<string, AttendanceRecord>();
  todayClassRecords.forEach(r => markedMap.set(r.studentId, r));

  const markedStudentIds = new Set(todayClassRecords.map(r => r.studentId));
  const remainingStudents = sortedStudents.filter(s => !markedStudentIds.has(s.id));
  const presentCount = todayClassRecords.filter(r => r.status === 'present').length;
  const onDutyCount = todayClassRecords.filter(r => r.status === 'onduty' || r.status === 'late').length;
  const absentCount = todayClassRecords.filter(r => r.status === 'absent').length;
  const markedCount = todayClassRecords.length;
  const totalStudents = sortedStudents.length;

  // QR target URL for selected day & session
  const qrTargetDateRecords = allRecords.filter(
    r => r.classId === currentClass.id && 
         r.date === qrDate && 
         (r.sessionId || 'session-1') === activeSessionId
  );
  const qrTargetPresentSet = new Set(
    qrTargetDateRecords.filter(r => r.status === 'present').map(r => r.studentId)
  );
  const qrTargetOnDutySet = new Set(
    qrTargetDateRecords.filter(r => r.status === 'onduty' || r.status === 'late').map(r => r.studentId)
  );
  const qrTargetExplicitAbsentSet = new Set(
    qrTargetDateRecords.filter(r => r.status === 'absent').map(r => r.studentId)
  );
  const hasQrSession = qrTargetDateRecords.length > 0;

  // Build complete list of absentee students with actual names (never include On-Duty or Present students!)
  const qrTargetAbsenteeList = sortedStudents
    .filter(s => {
      if (qrTargetOnDutySet.has(s.id)) return false;
      if (qrTargetPresentSet.has(s.id)) return false;
      if (qrTargetExplicitAbsentSet.has(s.id)) return true;
      if (hasQrSession && qrTargetPresentSet.size > 0 && qrTargetExplicitAbsentSet.size === 0) {
        return true;
      }
      return false;
    })
    .map(s => ({
      name: s.name,
      rollNo: s.rollNo,
      last4Digits: s.last4Digits || (s.rollNo.slice(-4) || '----'),
    }));

  const qrTargetPresent = qrTargetPresentSet.size;
  const qrTargetAbsent = qrTargetAbsenteeList.length;

  const dayTeacherDocUrl = buildTeacherDocUrl({
    classId: currentClass.id,
    className: `${sessionClassName || currentClass.name}${activeSessionTitle ? ` (${activeSessionTitle})` : ''}`,
    time: sessionTime,
    sessionId: activeSessionId,
    sessionTitle: activeSessionTitle,
    teacherName: currentClass.teacherName,
    room: currentClass.room,
    date: qrDate,
    presentCount: qrTargetPresent,
    absentCount: qrTargetAbsent,
    absentRolls: qrTargetAbsenteeList.map(s => s.last4Digits || s.rollNo),
    absentees: qrTargetAbsenteeList,
  });

  // Push live records to server immediately so mobile scanner loads live data with real student names
  useEffect(() => {
    if (!showDayQrModal) return;
    fetch('/api/attendance/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        students,
        records: allRecords,
        classes: [currentClass],
        activeClassId: currentClass.id
      })
    }).catch(() => {});
  }, [showDayQrModal, qrDate, students, allRecords, currentClass]);

  // Generate crisp, high-contrast, low-density QR code with ISO 4-module quiet zone
  useEffect(() => {
    if (!showDayQrModal) return;
    QRCode.toDataURL(dayTeacherDocUrl, {
      width: 400,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }).then(url => {
      setDayQrDataUrl(url);
    }).catch(err => {
      console.error('Day QR generation error:', err);
    });
  }, [dayTeacherDocUrl, showDayQrModal]);

  const handleCopyDayQrLink = () => {
    navigator.clipboard.writeText(dayTeacherDocUrl).then(() => {
      setCopiedDayQrLink(true);
      setTimeout(() => setCopiedDayQrLink(false), 2000);
    });
  };

  // Auto focus input on mount & interactions
  useEffect(() => {
    if (attendanceMode === '4digit') {
      inputRef.current?.focus();
    }
  }, [currentClass.id, attendanceMode]);

  const keepFocus = () => {
    if (attendanceMode === '4digit') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  };

  // Keyboard shortcut listener for Roll Call mode
  useEffect(() => {
    if (attendanceMode !== 'roll-call') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'p' || key === 'enter') {
        e.preventDefault();
        handleRollCallMark('present');
      } else if (key === 'a') {
        e.preventDefault();
        handleRollCallMark('absent');
      } else if (key === 'o' || key === 'd' || key === 'l') {
        e.preventDefault();
        handleRollCallMark('onduty');
      } else if (key === 'arrowright') {
        e.preventDefault();
        if (rollCallIndex < sortedStudents.length - 1) setRollCallIndex(prev => prev + 1);
      } else if (key === 'arrowleft') {
        e.preventDefault();
        if (rollCallIndex > 0) setRollCallIndex(prev => prev - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attendanceMode, rollCallIndex, sortedStudents, currentClass.id]);

  // Mode 1: 4-Digit Rapid Keypad Process
  const handleProcessDigits = (inputDigits: string) => {
    const cleanDigits = inputDigits.trim();
    if (!cleanDigits) return;

    const matched = sortedStudents.find(s => 
      s.last4Digits === cleanDigits || s.rollNo.endsWith(cleanDigits)
    );

    if (!matched) {
      if (soundEnabled) playErrorBuzz();
      setErrorMessage(`No student found with last 4 digits "${cleanDigits}". Check roster in Students page.`);
      setDigits('');
      keepFocus();
      return;
    }

    const existingRecord = todayClassRecords.find(r => r.studentId === matched.id);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const targetStatus: AttendanceStatus = rapidMarkMode; // 'present' | 'absent' | 'onduty'

    if (existingRecord) {
      // If student was already marked, but user is now in a different mode:
      // Instantly switch and update their status (e.g. from Absent to On Duty or Present)!
      if (existingRecord.status !== targetStatus) {
        onUpdateRecordStatus(existingRecord.id, targetStatus);
        if (soundEnabled) playSuccessBeep();
        setLastMarkedStudent({
          student: matched,
          status: targetStatus,
          time: timeStr,
          isDuplicate: false,
        });
        setErrorMessage(null);
        const prettyTarget = targetStatus === 'onduty' ? 'ON DUTY (OD)' : targetStatus.toUpperCase();
        setSaveSuccessNotification(`Updated ${matched.name} (${cleanDigits}) from ${existingRecord.status.toUpperCase()} to ${prettyTarget}!`);
        setTimeout(() => setSaveSuccessNotification(null), 3500);
        setDigits('');
        keepFocus();
        return;
      }

      if (soundEnabled) playDuplicateWarning();
      setLastMarkedStudent({
        student: matched,
        status: existingRecord.status,
        time: existingRecord.time,
        isDuplicate: true,
        alreadyMarkedTime: existingRecord.time,
      });
      setErrorMessage(`⚠️ Student ${matched.name} (${cleanDigits}) was ALREADY marked ${existingRecord.status.toUpperCase()} at ${existingRecord.time}!`);
      setDigits('');
      keepFocus();
      return;
    }

    const newRecord: AttendanceRecord = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      studentId: matched.id,
      studentRollNo: matched.rollNo,
      studentName: matched.name,
      studentLast4: matched.last4Digits,
      classId: currentClass.id,
      className: sessionClassName || currentClass.name,
      date: todayStr,
      time: timeStr,
      status: targetStatus,
      weekNumber: getWeekNumber(),
      dayOfWeek: new Date().getDay(),
      markedVia: 'fast_4digit',
      timestamp: Date.now(),
      sessionId: activeSessionId,
      sessionTime: sessionTime,
      sessionTitle: activeSessionTitle,
    };

    onMarkAttendance(newRecord);
    if (soundEnabled) {
      if (targetStatus === 'absent') {
        playErrorBuzz();
      } else {
        playSuccessBeep();
      }
    }

    setErrorMessage(null);
    setLastMarkedStudent({
      student: matched,
      status: targetStatus,
      time: timeStr,
      isDuplicate: false,
    });
    setDigits('');

    if (markedCount + 1 >= totalStudents && totalStudents > 0) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    keepFocus();
  };

  // Mode 2: Roll Call Single Mark
  const currentRollStudent = sortedStudents[rollCallIndex];
  const currentRollRecord = currentRollStudent ? markedMap.get(currentRollStudent.id) : undefined;

  const handleRollCallMark = (status: AttendanceStatus) => {
    if (!currentRollStudent) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (currentRollRecord) {
      onUpdateRecordStatus(currentRollRecord.id, status);
    } else {
      const newRecord: AttendanceRecord = {
        id: `rec-rc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: currentRollStudent.id,
        studentRollNo: currentRollStudent.rollNo,
        studentName: currentRollStudent.name,
        studentLast4: currentRollStudent.last4Digits,
        classId: currentClass.id,
        className: sessionClassName || currentClass.name,
        date: todayStr,
        time: timeStr,
        status,
        weekNumber: getWeekNumber(),
        dayOfWeek: new Date().getDay(),
        markedVia: 'roll_call',
        timestamp: Date.now(),
        sessionId: activeSessionId,
        sessionTime: sessionTime,
        sessionTitle: activeSessionTitle,
      };
      onMarkAttendance(newRecord);
    }

    if (soundEnabled) {
      if (status === 'present') playSuccessBeep();
      else if (status === 'absent') playErrorBuzz();
      else playDuplicateWarning();
    }

    // Auto step to next student
    if (rollCallIndex < sortedStudents.length - 1) {
      setRollCallIndex(prev => prev + 1);
    } else {
      confetti({ particleCount: 80, spread: 60 });
    }
  };

  // Mode 3: Quick Mark Single from Grid
  const handleGridQuickMark = (student: Student, status: AttendanceStatus) => {
    const existing = markedMap.get(student.id);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (existing) {
      onUpdateRecordStatus(existing.id, status);
    } else {
      const newRecord: AttendanceRecord = {
        id: `rec-grid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: student.id,
        studentRollNo: student.rollNo,
        studentName: student.name,
        studentLast4: student.last4Digits,
        classId: currentClass.id,
        className: sessionClassName || currentClass.name,
        date: todayStr,
        time: timeStr,
        status,
        weekNumber: getWeekNumber(),
        dayOfWeek: new Date().getDay(),
        markedVia: 'manual',
        timestamp: Date.now(),
        sessionId: activeSessionId,
        sessionTime: sessionTime,
        sessionTitle: activeSessionTitle,
      };
      onMarkAttendance(newRecord);
    }

    if (soundEnabled) {
      if (status === 'present') playSuccessBeep();
      else if (status === 'absent') playErrorBuzz();
      else playDuplicateWarning();
    }
  };

  // Batch mark all remaining as present or absent
  const handleMarkAllRemaining = (status: AttendanceStatus) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newRecords: AttendanceRecord[] = remainingStudents.map((student, idx) => ({
      id: `rec-batch-${Date.now()}-${idx}`,
      studentId: student.id,
      studentRollNo: student.rollNo,
      studentName: student.name,
      studentLast4: student.last4Digits,
      classId: currentClass.id,
      className: sessionClassName || currentClass.name,
      date: todayStr,
      time: timeStr,
      status,
      weekNumber: getWeekNumber(),
      dayOfWeek: new Date().getDay(),
      markedVia: 'manual',
      timestamp: Date.now() + idx,
      sessionId: activeSessionId,
      sessionTime: sessionTime,
      sessionTitle: activeSessionTitle,
    }));

    if (onBatchMarkAttendance) {
      onBatchMarkAttendance(newRecords);
    } else {
      newRecords.forEach(r => onMarkAttendance(r));
    }

    if (soundEnabled) playSuccessBeep();
    confetti({ particleCount: 70, spread: 60 });
  };

  // Finalize & Save Attendance
  const handleSaveAttendance = () => {
    // Open the finalize modal so CR can optionally customize the class name & time
    setShowSaveModal(true);
  };

  const executeSaveFinalize = (
    markRemainingAbsentOption?: boolean,
    customName?: string,
    timeVal?: string,
    updateMaster?: boolean,
    openSendToSirAfter?: boolean,
    openDayQrAfter?: boolean
  ) => {
    const finalClassName = (customName !== undefined ? customName : sessionClassName).trim() || currentClass.name;
    const finalTime = (timeVal !== undefined ? timeVal : sessionTime).trim() || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const shouldMarkRemaining = markRemainingAbsentOption !== undefined ? markRemainingAbsentOption : markUnmarkedAsAbsent;
    const shouldUpdateMaster = updateMaster !== undefined ? updateMaster : updateMasterClass;

    // 1. Determine target status for unentered students
    // When marking absentees or onduty: unentered are PRESENT
    // When marking attendees (present): unentered are ABSENT
    const targetStatusForUnmarked: AttendanceStatus = 
      rapidMarkMode === 'present' ? 'absent' : unmarkedTargetStatus || 'present';

    let finalBatchRecords: AttendanceRecord[] = [];
    if (shouldMarkRemaining && remainingStudents.length > 0) {
      finalBatchRecords = remainingStudents.map((student, idx) => ({
        id: `rec-batch-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: student.id,
        studentRollNo: student.rollNo,
        studentName: student.name,
        studentLast4: student.last4Digits || (student.rollNo.slice(-4) || '----'),
        classId: currentClass.id,
        className: finalClassName,
        date: todayStr,
        time: finalTime,
        status: targetStatusForUnmarked,
        weekNumber: getWeekNumber(),
        dayOfWeek: new Date().getDay(),
        markedVia: 'manual',
        timestamp: Date.now() + idx,
        sessionId: activeSessionId,
        sessionTime: finalTime,
        sessionTitle: activeSessionTitle,
      }));
    }

    // 2. Synchronize already marked records for this session with final class name and session time
    const updatedExistingSessionRecords: AttendanceRecord[] = todayClassRecords.map(r => ({
      ...r,
      className: finalClassName,
      time: finalTime,
      sessionId: activeSessionId,
      sessionTime: finalTime,
      sessionTitle: activeSessionTitle,
    }));

    // 3. COMPLETE ATOMIC SESSION RECORDS (both already marked + newly marked unentered students)
    const completeSessionRecords = [...updatedExistingSessionRecords, ...finalBatchRecords];

    if (onBatchMarkAttendance) {
      onBatchMarkAttendance(completeSessionRecords);
    } else {
      completeSessionRecords.forEach(r => onMarkAttendance(r));
    }

    if (shouldUpdateMaster && onUpdateClass) {
      onUpdateClass({
        ...currentClass,
        name: finalClassName,
        scheduleTime: finalTime,
      });
    }

    // Cache latest finalized records for immediate consumption by modals
    setLatestFinalizedRecords(completeSessionRecords);

    setSessionClassName(finalClassName);
    setSessionTime(finalTime);
    setShowSaveModal(false);

    // 4. Append to connected Google Sheet if enabled (honoring per-class tabs / separate sheets)
    setSaveSuccessNotification(`Attendance finalized for "${finalClassName}" (${finalTime})! Saving...`);

    if (syncToGoogleSheetOnSave && settings?.googleSheetUrl) {
      try {
        const targetTabName = settings?.classTabNames?.[currentClass.id] || currentClass.sheetTabName || currentClass.name;
        const targetSheetUrl = (settings?.syncStrategy === 'separate_sheets' && settings?.classSheetUrls?.[currentClass.id])
          ? settings.classSheetUrls[currentClass.id]
          : settings.googleSheetUrl;

        const payload = buildSheetSessionPayload(
          currentClass,
          todayStr,
          finalTime,
          students,
          completeSessionRecords,
          finalClassName,
          targetTabName
        );
        appendAttendanceToGoogleSheet(payload, { ...settings, googleSheetUrl: targetSheetUrl }).then(res => {
          if (res.success) {
            setSaveSuccessNotification(`Attendance finalized for "${finalClassName}" (${finalTime})! Synced to Google Sheet ("${targetTabName}").`);
          } else if (res.needsGoogleAuth) {
            setSaveSuccessNotification(`Attendance saved! Note: Click "Google Sheets" tab to Sign in with Google so data writes to your sheet.`);
          } else {
            setSaveSuccessNotification(`Attendance saved! (Sheet note: ${res.message || 'Check link'})`);
          }
        }).catch(err => {
          console.warn('Google Sheet append error:', err);
          setSaveSuccessNotification(`Attendance saved locally for "${finalClassName}" (${finalTime})!`);
        });
      } catch (e) {
        console.warn('Failed to build Google Sheet payload:', e);
      }
    } else {
      setSaveSuccessNotification(`Attendance finalized for "${finalClassName}" (${finalTime})! Records saved.`);
    }

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 }
    });

    setTimeout(() => setSaveSuccessNotification(null), 6000);

    // Immediately open Absentee pop-up so user can copy absentees with last 4 digits before their name
    setShowAbsenteeSummaryModal(true);

    if (openSendToSirAfter) {
      setShowSendReportModal(true);
    } else if (openDayQrAfter) {
      setShowDayQrModal(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleProcessDigits(digits);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setDigits(val);
    setErrorMessage(null);

    if (autoSubmit4Digits && val.length === 4) {
      handleProcessDigits(val);
    }
  };

  const handleNumpadClick = (num: string) => {
    if (num === 'CLEAR') {
      setDigits('');
      setErrorMessage(null);
      keepFocus();
      return;
    }
    if (num === 'ENTER') {
      handleProcessDigits(digits);
      return;
    }
    if (digits.length < 4) {
      const next = digits + num;
      setDigits(next);
      if (autoSubmit4Digits && next.length === 4) {
        handleProcessDigits(next);
      } else {
        keepFocus();
      }
    }
  };

  // Filtered marked list
  const filteredRecords = todayClassRecords
    .filter(r => {
      if (!filterQuery) return true;
      const q = filterQuery.toLowerCase();
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.studentRollNo.toLowerCase().includes(q) ||
        r.studentLast4.includes(q)
      );
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Save Success Banner Notification */}
      {saveSuccessNotification && (
        <div className="mb-6 p-4 bg-emerald-600 text-white rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">Attendance Saved & Synced Successfully</h4>
              <p className="text-xs text-emerald-100">{saveSuccessNotification}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onSwitchToSheets && (
              <button
                onClick={onSwitchToSheets}
                className="px-3 py-1.5 bg-emerald-800 text-white rounded-xl text-xs font-semibold hover:bg-emerald-900 transition shadow-xs flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>View Sheet</span>
              </button>
            )}
            <button
              onClick={() => setSaveSuccessNotification(null)}
              className="p-1 text-white/80 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Banner with Active Class Details & Switcher */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-5 sm:p-7 text-white shadow-xl mb-6 border border-slate-700/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                CR Attendance Hub
              </span>
              <span className="text-xs text-amber-300 font-mono font-bold">Date: {todayStr} • Time: {sessionTime}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 rounded-full inline-block shrink-0 shadow-xs" style={{ backgroundColor: currentClass.color }} />
                <span>{sessionClassName || currentClass.name}</span>
              </h1>

              {/* Subject Dropdown Switcher if multiple classes exist */}
              {allClasses.length > 1 && onSelectClass && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Switch:</span>
                  <select
                    value={currentClass.id}
                    onChange={(e) => onSelectClass(e.target.value)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {allClasses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 flex flex-wrap items-center gap-2">
              <span>Teacher: <strong className="text-white">{currentClass.teacherName}</strong></span>
              <span>•</span>
              <span>Room: {currentClass.room}</span>
              <span>•</span>
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/35 text-blue-200 border border-blue-400/40 text-xs font-semibold transition cursor-pointer"
                title="Click to edit class name or put lecture time"
              >
                <Clock className="w-3.5 h-3.5 text-blue-300" />
                <span>{sessionTime || 'Set Time'}</span>
                <Edit3 className="w-3 h-3 text-blue-300 ml-0.5" />
              </button>
            </p>
          </div>

          {/* Quick Real-Time Metrics (Order: Present, Absent, On Duty, Unmarked) */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-center min-w-[85px] shadow-sm">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">Present</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">{presentCount}</span>
            </div>

            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-center min-w-[85px] shadow-sm">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">Absent</span>
              <span className="text-xl sm:text-2xl font-black text-rose-400">{absentCount}</span>
            </div>

            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-center min-w-[85px] shadow-sm">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">On Duty (OD)</span>
              <span className="text-xl sm:text-2xl font-black text-amber-400">{onDutyCount}</span>
            </div>

            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-center min-w-[85px] shadow-sm">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">Unmarked</span>
              <span className="text-xl sm:text-2xl font-black text-blue-400">{remainingStudents.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SAME CLASS ATTENDANCE SLOTS (1st Class, 2nd Class, etc.) */}
      {/* ========================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-lg mb-6 border border-indigo-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-200">
                Lecture / Class Slot
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                Take Attendance Twice
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Active Session: <strong className="text-white font-extrabold">{activeSessionTitle}</strong> at <strong className="text-amber-300 font-mono">{sessionTime}</strong>
              <span className="mx-2 text-slate-500">•</span>
              <span className="text-emerald-300 font-bold">{presentCount} Present</span> / <span className="text-rose-300 font-bold">{absentCount} Absent</span> in this slot
            </p>
          </div>
        </div>

        {/* Sessions list & New Session Button */}
        <div className="flex items-center gap-2 flex-wrap">
          {existingSessions.map(sess => {
            const isSelected = activeSessionId === sess.id;
            return (
              <button
                key={sess.id}
                type="button"
                id={`session-tab-${sess.id}`}
                onClick={() => handleSelectSession(sess)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-slate-400'}`} />
                <span>{sess.title}</span>
                <span className="text-[10px] font-mono opacity-80">({sess.time})</span>
                {sess.markedCount > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {sess.markedCount}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            id="start-new-session-btn"
            onClick={() => setShowNewSessionModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold rounded-2xl text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            title="Add a new session/lecture for this class today (e.g. 2nd class, 3rd class at new time)"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add New Session For The Day</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CLASS TIMES / LECTURE SCHEDULES BAR (Option of adding class times below) */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 mb-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-800">
              Class Times for {currentClass.name}:
            </span>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              (Preset slots for roll call & attendance sessions)
            </span>
          </div>

          {!isAddingClassTime ? (
            <button
              type="button"
              id="add-class-time-btn"
              onClick={() => setIsAddingClassTime(true)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Class Time</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newClassTimeInput}
                onChange={(e) => setNewClassTimeInput(e.target.value)}
                placeholder="e.g. 02:00 PM - 03:00 PM"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddClassTime();
                  }
                }}
                className="px-2.5 py-1 bg-white border border-blue-400 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 font-mono"
                autoFocus
              />
              <button
                type="button"
                onClick={() => handleAddClassTime()}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingClassTime(false);
                  setNewClassTimeInput('');
                }}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* List of custom class time pills like Pic 3 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(currentClass.classTimes && currentClass.classTimes.length > 0
            ? currentClass.classTimes
            : DEFAULT_CLASS_TIMES
          ).map((slot) => {
            const isSelectedTime = sessionTime === slot;
            return (
              <span
                key={slot}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition border ${
                  isSelectedTime
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50/60 hover:border-blue-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSessionTime(slot)}
                  className="cursor-pointer font-mono"
                  title={`Click to set "${slot}" as active session time`}
                >
                  {slot}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveClassTime(slot)}
                  className={`cursor-pointer rounded-full p-0.5 hover:bg-rose-500 hover:text-white transition ${
                    isSelectedTime ? 'text-blue-200' : 'text-slate-400'
                  }`}
                  title="Remove this time slot"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3 ATTENDANCE MODES PROMINENT SELECTOR BAR + SAVE BUTTON */}
      {/* ========================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 p-2.5 sm:p-3 shadow-xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* The 3 Mode Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl">
          
          {/* Mode 1: 4-Digit Keypad */}
          <button
            type="button"
            id="mode-tab-4digit"
            onClick={() => setAttendanceMode('4digit')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
              attendanceMode === '4digit'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
            }`}
          >
            <Zap className="w-4 h-4 shrink-0" />
            <span className="truncate">1. 4-Digit Keypad</span>
          </button>

          {/* Mode 2: Interactive Roll Call */}
          <button
            type="button"
            id="mode-tab-roll-call"
            onClick={() => setAttendanceMode('roll-call')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
              attendanceMode === 'roll-call'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
            }`}
          >
            <Volume2 className="w-4 h-4 shrink-0" />
            <span className="truncate">2. Roll Call Mode</span>
          </button>

          {/* Mode 3: Grid Call-Out */}
          <button
            type="button"
            id="mode-tab-grid"
            onClick={() => setAttendanceMode('grid')}
            className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
              attendanceMode === 'grid'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
            }`}
          >
            <Table2 className="w-4 h-4 shrink-0" />
            <span className="truncate">3. Grid Call-Out</span>
          </button>

        </div>

        {/* Right: Sound Toggle & SAVE ATTENDANCE Button */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            title={soundEnabled ? 'Mute audio' : 'Enable audio'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>

          <button
            type="button"
            id="send-report-to-sir-btn"
            onClick={() => setShowSendReportModal(true)}
            className="px-3.5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
            title="Copy Attendance Summary / Send Absentee list to Sir via WhatsApp"
          >
            <Send className="w-4 h-4 text-emerald-300" />
            <span className="hidden sm:inline">Send to Sir</span>
            <span className="sm:hidden">Report</span>
          </button>

          <button
            type="button"
            id="fast-entry-day-qr-btn"
            onClick={() => setShowDayQrModal(true)}
            className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center gap-1.5"
            title="Show Faculty QR for this day's attendance only"
          >
            <QrCode className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">Day QR</span>
          </button>

          <button
            type="button"
            id="absentee-summary-popup-btn"
            onClick={() => setShowAbsenteeSummaryModal(true)}
            className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 active:scale-95 font-bold rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 shadow-2xs"
            title="View Absentee Names & Last 4 Digits popup to copy"
          >
            <Users className="w-4 h-4 text-rose-600" />
            <span className="hidden sm:inline">Absentees</span>
          </button>

          <button
            type="button"
            id="copy-for-sheets-btn"
            onClick={() => setShowCopyStudentsModal(true)}
            className="px-3 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 active:scale-95 font-bold rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 shadow-2xs"
            title="Copy all names with roll numbers to put in Google Sheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-600" />
            <span className="hidden md:inline">Copy for Sheets</span>
            <span className="md:hidden">Roster</span>
          </button>

          <button
            type="button"
            id="google-sheet-config-btn"
            onClick={() => setShowSheetConfigModal(true)}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 active:scale-95 font-bold rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 shadow-2xs"
            title="Configure Google Sheet link so all data is stored over there also"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden md:inline">Google Sheet</span>
            {settings?.googleSheetUrl ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" title="Connected" />
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-950 font-bold">Link</span>
            )}
          </button>

          <button
            type="button"
            id="save-attendance-btn"
            onClick={handleSaveAttendance}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-600/25 transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Attendance</span>
          </button>
        </div>

      </div>

      {/* ========================================================= */}
      {/* MODE 1: 4-DIGIT RAPID KEYPAD ENTRY */}
      {/* ========================================================= */}
      {attendanceMode === '4digit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-150">
          
          {/* Left Column: Keypad & Input Card (6 cols) */}
          <div className="lg:col-span-6 space-y-5">
            
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-7 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                    rapidMarkMode === 'absent' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {rapidMarkMode === 'absent' ? <UserX className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-base sm:text-lg">Rapid 4-Digit Roll Entry</h2>
                    <p className="text-xs text-slate-500">
                      {rapidMarkMode === 'absent'
                        ? 'Type 4-digits to mark ABSENT • Rest will be PRESENT'
                        : 'Type 4-digits to mark PRESENT • Rest will be ABSENT'}
                    </p>
                  </div>
                </div>

                <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer select-none bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                  <input
                    type="checkbox"
                    checked={autoSubmit4Digits}
                    onChange={(e) => setAutoSubmit4Digits(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Auto-submit on 4th digit</span>
                </label>
              </div>

              {/* Mode Option: Mark Absent vs Mark Present */}
              <div className="mb-4 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between px-2 py-1 text-xs mb-1">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    4-Digit Marking Logic:
                  </span>
                  <span className={`text-[11px] font-bold ${
                    rapidMarkMode === 'absent' ? 'text-rose-600' : rapidMarkMode === 'onduty' ? 'text-amber-600' : 'text-emerald-700'
                  }`}>
                    {rapidMarkMode === 'absent' ? '🔴 Marking Absentees' : rapidMarkMode === 'onduty' ? '🎖️ Marking On Duty' : '🟢 Marking Attendees'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    id="rapid-mode-mark-present-btn"
                    onClick={() => {
                      setRapidMarkMode('present');
                      setUnmarkedTargetStatus('absent');
                      keepFocus();
                    }}
                    className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                      rapidMarkMode === 'present'
                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                        : 'bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Present</span>
                  </button>

                  <button
                    type="button"
                    id="rapid-mode-mark-absent-btn"
                    onClick={() => {
                      setRapidMarkMode('absent');
                      setUnmarkedTargetStatus('present');
                      keepFocus();
                    }}
                    className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                      rapidMarkMode === 'absent'
                        ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400'
                        : 'bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <UserX className="w-4 h-4" />
                    <span>Absent</span>
                  </button>

                  <button
                    type="button"
                    id="rapid-mode-mark-onduty-btn"
                    onClick={() => {
                      setRapidMarkMode('onduty');
                      setUnmarkedTargetStatus('present');
                      keepFocus();
                    }}
                    className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                      rapidMarkMode === 'onduty'
                        ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                        : 'bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    <span>On Duty</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 px-1">
                  {rapidMarkMode === 'absent'
                    ? '💡 Absentees Mode: When you submit, all students whose numbers you did NOT enter are automatically marked Present!'
                    : rapidMarkMode === 'onduty'
                    ? '💡 On Duty Mode: Enter 4 digits to mark On Duty (OD). Unentered students default to Present!'
                    : '💡 Attendees Mode: When you submit, all students whose numbers you did NOT enter are automatically marked Absent!'}
                </p>
              </div>

              {/* The Big 4-Digit Input */}
              <div className="relative mb-5">
                <input
                  ref={inputRef}
                  id="four-digit-attendance-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={digits}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={rapidMarkMode === 'absent' ? 'ABSENT' : rapidMarkMode === 'onduty' ? 'ON DUTY' : 'PRESENT'}
                  className={`w-full text-center font-mono text-5xl sm:text-6xl tracking-widest font-black py-5 px-4 rounded-2xl border-2 transition-all shadow-inner focus:outline-none ${
                    rapidMarkMode === 'absent'
                      ? 'bg-rose-50/30 border-rose-300 focus:border-rose-600 text-rose-950 focus:bg-white focus:ring-4 focus:ring-rose-500/10'
                      : rapidMarkMode === 'onduty'
                      ? 'bg-amber-50/30 border-amber-300 focus:border-amber-600 text-amber-950 focus:bg-white focus:ring-4 focus:ring-amber-500/10'
                      : 'bg-emerald-50/30 border-emerald-300 focus:border-emerald-600 text-emerald-950 focus:bg-white focus:ring-4 focus:ring-emerald-500/10'
                  }`}
                />

                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                  {digits.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setDigits('');
                        setErrorMessage(null);
                        keepFocus();
                      }}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleProcessDigits(digits)}
                    disabled={digits.length === 0}
                    className={`px-4 py-3 disabled:opacity-40 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center space-x-1.5 ${
                      rapidMarkMode === 'absent'
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                    }`}
                  >
                    <span>Enter</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status or Error Notifications */}
              {errorMessage && (
                <div className="p-3.5 mb-5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start space-x-2.5 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMessage}</div>
                </div>
              )}

              {/* Last Marked Student Card */}
              {lastMarkedStudent && !errorMessage && (
                <div className={`p-4 mb-5 rounded-2xl border transition-all ${
                  lastMarkedStudent.isDuplicate
                    ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                    : lastMarkedStudent.status === 'absent'
                    ? 'bg-rose-50/80 border-rose-300 text-rose-950'
                    : 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono text-base font-bold shadow-xs ${
                        lastMarkedStudent.isDuplicate 
                          ? 'bg-amber-500 text-white' 
                          : lastMarkedStudent.status === 'absent'
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}>
                        {lastMarkedStudent.student.last4Digits}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base">{lastMarkedStudent.student.name}</span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            lastMarkedStudent.isDuplicate 
                              ? 'bg-amber-200 text-amber-900' 
                              : lastMarkedStudent.status === 'absent'
                              ? 'bg-rose-200 text-rose-900'
                              : 'bg-emerald-200 text-emerald-900'
                          }`}>
                            {lastMarkedStudent.isDuplicate 
                              ? 'Already Marked' 
                              : lastMarkedStudent.status === 'absent'
                              ? 'Marked Absent'
                              : 'Marked Present'}
                          </span>
                        </div>
                        <p className="text-xs opacity-75 font-mono">
                          {lastMarkedStudent.student.rollNo} • {lastMarkedStudent.student.batch || 'Batch 2026'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs opacity-75 font-mono">
                      <span>{lastMarkedStudent.time}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Touch Numpad Grid */}
              <div className="pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2 text-center">
                  Quick Touch Numpad
                </span>
                <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0', 'ENTER'].map((key) => {
                    const isClear = key === 'CLEAR';
                    const isEnter = key === 'ENTER';

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleNumpadClick(key)}
                        className={`h-12 rounded-xl font-mono text-base font-bold transition active:scale-95 shadow-xs border ${
                          isEnter
                            ? rapidMarkMode === 'absent'
                              ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                              : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                            : isClear
                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 text-xs'
                            : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>

                {/* Submit & Pop-up Trigger Bar */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2.5">
                  <button
                    type="button"
                    id="rapid-finalize-submit-btn"
                    onClick={() => executeSaveFinalize(true)}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 hover:from-black hover:to-rose-900 active:scale-98 text-white font-black rounded-2xl text-sm shadow-lg shadow-rose-950/20 transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5 text-amber-300" />
                    <span>
                      {rapidMarkMode === 'absent'
                        ? 'Submit (Mark Rest as Present & Show Absentees)'
                        : 'Submit (Mark Rest as Absent & Show Absentees)'}
                    </span>
                  </button>

                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span>
                      {rapidMarkMode === 'absent'
                        ? `⚡ Unentered: ${remainingStudents.length} will be Present`
                        : `⚡ Unentered: ${remainingStudents.length} will be Absent`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAbsenteeSummaryModal(true)}
                      className="font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
                    >
                      <span>Absentee Pop-up</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Right Column: Live Feed & Unmarked Roster (6 cols) */}
          <div className="lg:col-span-6 flex flex-col gap-5">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-full min-h-[520px]">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-900 text-base">Today&apos;s Attendance Feed</h2>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {todayClassRecords.length} Marked
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Live attendance for {currentClass.name}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRemainingModal(true)}
                    className="px-3 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Unmarked ({remainingStudents.length})</span>
                  </button>
                </div>
              </div>

              {/* Filter Search Input */}
              <div className="relative my-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Search marked students by name, roll, or 4-digits..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>

              {/* Marked Records Scrollable List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[440px]">
                {filteredRecords.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <h4 className="font-semibold text-slate-700 text-sm">No Attendance Logged Yet</h4>
                    <p className="text-xs text-slate-500 max-w-xs mt-1">
                      Enter the last 4 digits of any student&apos;s roll number on the left and hit Enter to mark them present.
                    </p>
                  </div>
                ) : (
                  filteredRecords.map((record) => {
                    return (
                      <div
                        key={record.id}
                        className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70 transition flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center space-x-3 truncate">
                          <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                            {record.studentLast4}
                          </span>
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 truncate">{record.studentName}</span>
                              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                                {record.studentRollNo}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                              <Clock className="w-3 h-3" />
                              {record.time} • Marked via {record.markedVia}
                            </span>
                          </div>
                        </div>

                        {/* Status Toggle & Undo */}
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <select
                            value={record.status}
                            onChange={(e) => onUpdateRecordStatus(record.id, e.target.value as AttendanceStatus)}
                            className={`text-xs font-semibold px-2 py-1 rounded-lg border focus:outline-none ${
                              record.status === 'present'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : (record.status === 'onduty' || record.status === 'late')
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-rose-50 text-rose-700 border-rose-300'
                            }`}
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="onduty">On Duty (OD)</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => onDeleteRecord(record.id)}
                            title="Undo / Delete this entry"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 2: INTERACTIVE ROLL CALL MODE */}
      {/* ========================================================= */}
      {attendanceMode === 'roll-call' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 animate-in fade-in duration-150">
          
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Interactive Roll Call Active
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Use keys <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[11px]">P</kbd> (Present), <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[11px]">A</kbd> (Absent), <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[11px]">L</kbd> (Late)
                </span>
              </div>
              <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl mt-1.5">
                Read the 4-Digit Code & Mark Attendance
              </h3>
            </div>

            {/* Stepper Position & Navigation */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-slate-500">
                Student {sortedStudents.length > 0 ? rollCallIndex + 1 : 0} of {sortedStudents.length}
              </span>
              
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setRollCallIndex(prev => Math.max(0, prev - 1))}
                  disabled={rollCallIndex === 0}
                  className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition"
                  title="Previous Student (Left Arrow)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRollCallIndex(prev => Math.min(sortedStudents.length - 1, prev + 1))}
                  disabled={rollCallIndex >= sortedStudents.length - 1}
                  className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition"
                  title="Next Student (Right Arrow)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Calling Card */}
          {currentRollStudent ? (
            <div className="py-10 max-w-xl mx-auto text-center flex flex-col items-center">
              
              {/* Highlighted 4-Digit Code Display */}
              <div className="inline-block bg-slate-900 text-emerald-400 px-10 py-5 rounded-3xl font-mono text-6xl sm:text-7xl font-black tracking-widest shadow-2xl border-4 border-emerald-500/40 mb-4">
                {currentRollStudent.last4Digits}
              </div>
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">
                Last 4 Digits to Announce
              </span>

              {/* Student Details */}
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1">
                {currentRollStudent.name}
              </h2>
              <p className="text-sm font-mono text-slate-500">
                Full Roll No: <strong className="text-slate-800">{currentRollStudent.rollNo}</strong> • {currentRollStudent.batch || 'Batch 2026'}
              </p>

              {/* Current Marked Status Tag */}
              <div className="mt-4">
                {currentRollRecord ? (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    currentRollRecord.status === 'present' 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : currentRollRecord.status === 'onduty' || currentRollRecord.status === 'late'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    Currently Marked: {currentRollRecord.status === 'onduty' || currentRollRecord.status === 'late' ? 'ON DUTY' : currentRollRecord.status.toUpperCase()} ({currentRollRecord.time})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                    Not Marked Yet
                  </span>
                )}
              </div>

              {/* Giant Decision Buttons: Present, Absent, On Duty */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full mt-8">
                
                {/* Present Button */}
                <button
                  type="button"
                  id="rollcall-mark-present-btn"
                  onClick={() => handleRollCallMark('present')}
                  className="py-5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                >
                  <UserCheck className="w-7 h-7" />
                  <span className="text-base sm:text-lg">Present</span>
                  <span className="text-[11px] opacity-80 font-mono">(Key: P or Enter)</span>
                </button>

                {/* Absent Button */}
                <button
                  type="button"
                  id="rollcall-mark-absent-btn"
                  onClick={() => handleRollCallMark('absent')}
                  className="py-5 px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-rose-600/30 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                >
                  <UserX className="w-7 h-7" />
                  <span className="text-base sm:text-lg">Absent</span>
                  <span className="text-[11px] opacity-80 font-mono">(Key: A)</span>
                </button>

                {/* On Duty (OD) Button */}
                <button
                  type="button"
                  id="rollcall-mark-onduty-btn"
                  onClick={() => handleRollCallMark('onduty')}
                  className="py-5 px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/30 flex flex-col items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Award className="w-7 h-7" />
                  <span className="text-base sm:text-lg">On Duty (OD)</span>
                  <span className="text-[11px] opacity-80 font-mono">(Key: O, D, or L)</span>
                </button>

              </div>

            </div>
          ) : (
            <div className="py-16 text-center text-slate-400">
              <p>No students enrolled. Add students to the roster first.</p>
            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 3: GRID ROSTER CALL-OUT */}
      {/* ========================================================= */}
      {attendanceMode === 'grid' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 animate-in fade-in duration-150 space-y-6">
          
          {/* Header Bar with Batch Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl">
                Class Roster Grid Call-Out ({sortedStudents.length} Students)
              </h3>
              <p className="text-xs text-slate-500">
                Click any student&apos;s status pill to mark them instantly. Use batch actions to quickly mark remaining students.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleMarkAllRemaining('present')}
                disabled={remainingStudents.length === 0}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark All Uncalled as Present</span>
              </button>

              <button
                type="button"
                onClick={() => handleMarkAllRemaining('absent')}
                disabled={remainingStudents.length === 0}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Mark Remaining as Absent</span>
              </button>
            </div>
          </div>

          {/* Roster Grid Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 w-28 font-mono">Roll No</th>
                  <th className="py-2.5 px-3 w-24 text-center">Last 4 Digits</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Batch</th>
                  <th className="py-2.5 px-3 text-center w-64">Status Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedStudents.map((student, idx) => {
                  const record = markedMap.get(student.id);

                  return (
                    <tr key={student.id} className="hover:bg-blue-50/20 transition">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">
                        {student.rollNo}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-700 text-xs border border-blue-200">
                          {student.last4Digits}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {student.name}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {student.batch || 'Batch 2026'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="inline-flex rounded-xl p-0.5 bg-slate-100 border border-slate-200">
                          <button
                            type="button"
                            onClick={() => handleGridQuickMark(student, 'present')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              record?.status === 'present'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGridQuickMark(student, 'absent')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              record?.status === 'absent'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-rose-700'
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGridQuickMark(student, 'onduty')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              record?.status === 'onduty' || record?.status === 'late'
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'text-slate-600 hover:text-amber-700'
                            }`}
                          >
                            On Duty
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* FINALIZE ATTENDANCE SESSION MODAL (MANUAL CLASS NAME & TIME) */}
      {/* ========================================================= */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 shrink-0 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">
                    Finalize Attendance Session
                  </h3>
                  <p className="text-xs text-slate-500">
                    Optionally change class name and put the session time before saving
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {/* Editable Class Name & Lecture Time */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 mb-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Class / Subject Name:</span>
                  </label>
                  {allClasses.length > 1 && (
                    <span className="text-[11px] text-slate-400">
                      Default: {currentClass.name}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={sessionClassName}
                  onChange={(e) => setSessionClassName(e.target.value)}
                  placeholder="e.g. Maths Lecture, Lab Batch B"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Session / Lecture Time (Enter Manually):</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSessionTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    Set Current Time
                  </button>
                </div>
                <input
                  type="text"
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                  placeholder="e.g. 10:00 AM - 11:00 AM (or enter any time manually)"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono shadow-2xs"
                />
                
                {/* Time preset pills like Pic 3 - Custom ones entered by user */}
                <div className="mt-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      <span>Custom Class Times (Presets):</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Click any preset to apply</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(currentClass.classTimes && currentClass.classTimes.length > 0
                      ? currentClass.classTimes
                      : DEFAULT_CLASS_TIMES
                    ).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSessionTime(preset)}
                        className={`text-xs px-3 py-1.5 rounded-xl font-medium transition cursor-pointer flex items-center gap-1.5 ${
                          sessionTime === preset
                            ? 'bg-blue-600 text-white font-bold shadow-2xs border border-blue-600'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-400'
                        }`}
                      >
                        <Clock className="w-3 h-3 opacity-60" />
                        <span className="font-mono">{preset}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Current Attendance Breakdown Stats (Order: Present, Absent, On Duty, Unmarked) */}
            <div className="grid grid-cols-4 gap-2 mb-4 text-center">
              <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Present</span>
                <span className="text-base font-black text-emerald-800">{presentCount}</span>
              </div>
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-rose-700 block">Absent</span>
                <span className="text-base font-black text-rose-800">{absentCount}</span>
              </div>
              <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">On Duty (OD)</span>
                <span className="text-base font-black text-amber-800">{onDutyCount}</span>
              </div>
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-600 block">Unmarked</span>
                <span className="text-base font-black text-slate-800">{remainingStudents.length}</span>
              </div>
            </div>

            {/* Unmarked Students Prompt */}
            {remainingStudents.length > 0 && (
              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs mb-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>{remainingStudents.length} Unmarked Students Remaining</span>
                  </span>
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-amber-300 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-600">Mark as:</span>
                    <select
                      value={unmarkedTargetStatus}
                      onChange={(e) => setUnmarkedTargetStatus(e.target.value as AttendanceStatus)}
                      className="text-xs font-bold text-blue-700 bg-transparent focus:outline-none cursor-pointer"
                    >
                      <option value="present">Present (P)</option>
                      <option value="absent">Absent (A)</option>
                      <option value="onduty">On Duty (OD)</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-amber-800 mb-2 leading-relaxed">
                  {rapidMarkMode === 'absent' 
                    ? `You entered ${todayClassRecords.length} absentees. All other unentered students will be marked as ${unmarkedTargetStatus === 'present' ? 'Present' : unmarkedTargetStatus === 'onduty' ? 'On Duty' : 'Absent'}.`
                    : rapidMarkMode === 'onduty'
                    ? `You entered ${todayClassRecords.length} on-duty students. All other unentered students will be marked as ${unmarkedTargetStatus === 'present' ? 'Present' : unmarkedTargetStatus === 'onduty' ? 'On Duty' : 'Absent'}.`
                    : `You entered ${todayClassRecords.length} attendees. All other unentered students will be marked as ${unmarkedTargetStatus === 'absent' ? 'Absent' : unmarkedTargetStatus === 'onduty' ? 'On Duty' : 'Present'}.`}
                </p>
                <label className="flex items-center gap-2 p-2 bg-white/90 border border-amber-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markUnmarkedAsAbsent}
                    onChange={(e) => setMarkUnmarkedAsAbsent(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="font-bold text-slate-800 text-[11px]">
                    Automatically record all {remainingStudents.length} remaining students as {unmarkedTargetStatus === 'present' ? 'Present (P)' : unmarkedTargetStatus === 'onduty' ? 'On Duty (OD)' : 'Absent (A)'}
                  </span>
                </label>
              </div>
            )}

            {/* Google Sheet Cloud Storage Option */}
            <div className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-2xl mb-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Google Sheet Cloud Storage</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowSheetConfigModal(true)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                >
                  {settings?.googleSheetUrl ? 'Change Sheet Link' : 'Set Google Sheet Link'}
                </button>
              </div>

              {settings?.googleSheetUrl ? (
                <div>
                  <div className="text-[11px] text-emerald-800 font-mono truncate bg-emerald-100/60 px-2 py-1 rounded-lg border border-emerald-200">
                    {settings.googleSheetUrl}
                  </div>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs font-semibold text-emerald-900">
                    <input
                      type="checkbox"
                      checked={syncToGoogleSheetOnSave}
                      onChange={(e) => setSyncToGoogleSheetOnSave(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Also store this attendance session into Google Sheet</span>
                  </label>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Optionally provide your Google Sheet link so all the data is stored over there also:
                  </p>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Paste Google Sheet URL..."
                      value={quickSheetInput}
                      onChange={(e) => setQuickSheetInput(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (quickSheetInput.trim() && onUpdateSettings && settings) {
                          const sheetId = extractGoogleSheetId(quickSheetInput.trim()) || undefined;
                          onUpdateSettings({
                            ...settings,
                            googleSheetUrl: quickSheetInput.trim(),
                            sheetId,
                            autoAppendOnSave: true,
                          });
                          setSyncToGoogleSheetOnSave(true);
                          setQuickSheetInput('');
                        }
                      }}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shrink-0"
                    >
                      Connect
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Configuration Checkboxes */}
            <div className="space-y-2 mb-5 text-xs text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToTodayRecords}
                  onChange={(e) => setApplyToTodayRecords(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Apply this class name & time to all today&apos;s recorded entries</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateMasterClass}
                  onChange={(e) => setUpdateMasterClass(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Also save this name & time as the default for this class</span>
              </label>
            </div>
            </div>

            {/* Sticky Action Buttons Footer - Always visible so save option is never hidden */}
            <div className="sticky bottom-0 bg-white pt-3 pb-1 border-t border-slate-200 shrink-0 mt-3 flex flex-col gap-2">
              <button
                type="button"
                id="modal-confirm-save-btn"
                onClick={() => executeSaveFinalize(markUnmarkedAsAbsent, sessionClassName, sessionTime, updateMasterClass, false, false)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Attendance Now</span>
              </button>

              <button
                type="button"
                onClick={() => executeSaveFinalize(markUnmarkedAsAbsent, sessionClassName, sessionTime, updateMasterClass, true, false)}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-98 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4 text-emerald-300" />
                <span>Save & Send to Sir (WhatsApp / Copy)</span>
              </button>

              <button
                type="button"
                onClick={() => executeSaveFinalize(markUnmarkedAsAbsent, sessionClassName, sessionTime, updateMasterClass, false, true)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4 text-amber-300" />
                <span>Save & Open Day QR</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="w-full py-1.5 text-slate-500 hover:text-slate-800 text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unmarked Students Drawer / Modal */}
      {showRemainingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Unmarked Students ({remainingStudents.length})</h3>
                <p className="text-xs text-slate-500">Students who haven&apos;t had attendance logged today</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRemainingModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 my-3">
              {remainingStudents.length === 0 ? (
                <div className="py-8 text-center text-emerald-600 font-semibold text-xs">
                  🎉 Fantastic! 100% of students have been marked for this class today.
                </div>
              ) : (
                remainingStudents.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500 font-mono">
                        {s.rollNo} • Last 4: <span className="font-bold text-blue-600">{s.last4Digits}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleProcessDigits(s.last4Digits);
                        setShowRemainingModal(false);
                      }}
                      className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-semibold transition font-mono"
                    >
                      Mark #{s.last4Digits}
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRemainingModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DAY ATTENDANCE QR CODE MODAL (LOCKED SINGLE-DAY VIEW) */}
      {/* ========================================================= */}
      {showDayQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center relative">
            <button
              type="button"
              onClick={() => setShowDayQrModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Faculty Day Attendance QR
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Scanned code opens strictly this day&apos;s attendance sheet in a locked view
            </p>

            {/* Day Selector */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Select Day:
                </label>
                <button
                  type="button"
                  onClick={() => setQrDate(getTodayDateString())}
                  className={`text-[10px] px-2 py-0.5 rounded font-bold transition ${
                    qrDate === getTodayDateString()
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Today
                </button>
              </div>

              <input
                type="date"
                value={qrDate}
                onChange={(e) => setQrDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">{currentClass.name}</span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-emerald-700">{qrTargetPresent} Present</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-rose-600">{qrTargetAbsent} Absent</span>
                </div>
              </div>

              {/* Absentee Student Names Preview */}
              {qrTargetAbsenteeList.length > 0 ? (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block mb-1">
                    Absentees encoded in QR ({qrTargetAbsenteeList.length}):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {qrTargetAbsenteeList.map((st, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 font-medium">
                        <span className="font-bold text-rose-900">{st.name}</span>
                        <span className="font-mono text-[10px] text-rose-600">({st.last4Digits})</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-200 text-[11px] text-emerald-700 font-medium">
                  ✨ Full attendance! 0 absentees for this session.
                </div>
              )}
            </div>

            {/* QR Code Container - Pure White High Contrast Card for Instant Camera Detection */}
            <div className="text-center mb-3">
              <div className="p-4 sm:p-5 bg-white rounded-3xl border-2 border-slate-200 shadow-xl inline-block transition-all">
                {dayQrDataUrl ? (
                  <img 
                    src={dayQrDataUrl} 
                    alt="Day Attendance QR Code" 
                    className={`${isQrZoomed ? 'w-72 h-72 sm:w-80 sm:h-80' : 'w-56 h-56 sm:w-60 sm:h-60'} rounded-xl block mx-auto transition-all`} 
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                    Generating High-Contrast QR...
                  </div>
                )}
              </div>

              {/* Quick Size Toggle */}
              <div className="mt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsQrZoomed(!isQrZoomed)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 py-1 px-3 bg-blue-50 hover:bg-blue-100 rounded-full transition"
                >
                  {isQrZoomed ? '🔍 Standard Size' : '🔍 Enlarge QR for Distance Scan'}
                </button>
              </div>
            </div>

            {/* Live Camera Ready Status Badge */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 font-semibold mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Ultra-Low Density • Scans in &lt;0.1s on Any Camera</span>
            </div>

            {/* Lockdown Notice */}
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl mb-4 flex items-start gap-2 text-left">
              <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-900 leading-tight">
                <strong>Strict Lockdown:</strong> Anyone scanning this QR can only view this single day&apos;s record with full student names. All navigation out of this page is disabled.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <a
                href={dayTeacherDocUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-xs"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open / Test Day Page Directly</span>
              </a>

              <button
                type="button"
                onClick={handleCopyDayQrLink}
                className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                {copiedDayQrLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedDayQrLink ? 'Link Copied to Clipboard!' : 'Copy Day QR Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDayQrModal(false);
                  setShowSendReportModal(true);
                }}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send to Sir (Absentees / 4-Digits Copy)</span>
              </button>

              <a
                href={`/report?classId=${encodeURIComponent(currentClass.id)}&date=${encodeURIComponent(qrDate)}&cn=${encodeURIComponent(sessionClassName || currentClass.name)}&t=${encodeURIComponent(sessionTime)}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-slate-500 hover:text-slate-800 underline block pt-1"
              >
                Or view Direct Printable Faculty Report (0-bundle HTML)
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Send Report to Sir Modal */}
      <SendReportToSirModal
        isOpen={showSendReportModal}
        onClose={() => setShowSendReportModal(false)}
        currentClass={currentClass}
        date={todayStr}
        students={sortedStudents}
        allRecords={latestFinalizedRecords ? allRecords.filter(r => !(r.date === todayStr && r.classId === currentClass.id && (r.sessionId || 'session-1') === activeSessionId)).concat(latestFinalizedRecords) : allRecords}
        reportUrl={dayTeacherDocUrl}
        googleSheetUrl={settings?.googleSheetUrl}
        initialCustomClassName={sessionClassName}
        initialTime={sessionTime}
        initialSessionId={activeSessionId}
        initialSessionTitle={activeSessionTitle}
        onSaveSessionDetails={(cName, cTime) => {
          setSessionClassName(cName);
          setSessionTime(cTime);
          onUpdateSessionDetails?.(currentClass.id, cName, cTime, false, activeSessionId);
        }}
      />

      {/* Take Attendance of Same Class Twice / New Session Modal */}
      <NewSessionModal
        isOpen={showNewSessionModal}
        onClose={() => setShowNewSessionModal(false)}
        currentClass={currentClass}
        existingSessions={existingSessions}
        onStartSession={handleStartNewSession}
      />

      {/* Google Sheet Cloud Storage Configuration Modal */}
      {settings && onUpdateSettings && (
        <GoogleSheetConfigModal
          isOpen={showSheetConfigModal}
          onClose={() => setShowSheetConfigModal(false)}
          settings={settings}
          classes={allClasses || [currentClass]}
          onSaveSettings={onUpdateSettings}
          currentClass={currentClass}
          students={sortedStudents}
          records={allRecords}
        />
      )}

      {/* Pop-up showing absentee names and their last 4 digits before their name to copy */}
      <AbsenteeSummaryModal
        isOpen={showAbsenteeSummaryModal}
        onClose={() => setShowAbsenteeSummaryModal(false)}
        currentClass={currentClass}
        date={todayStr}
        time={sessionTime}
        sessionId={activeSessionId}
        sessionTitle={activeSessionTitle}
        customClassName={sessionClassName}
        allStudents={sortedStudents}
        records={latestFinalizedRecords || todayClassRecords}
        defaultUnmarkedStatus={rapidMarkMode === 'present' ? 'absent' : 'present'}
        onOpenSendToSir={() => setShowSendReportModal(true)}
        onOpenGoogleSheet={() => {
          if (settings?.googleSheetUrl) {
            window.open(settings.googleSheetUrl, '_blank');
          } else {
            setShowSheetConfigModal(true);
          }
        }}
      />

      {/* Modal to Copy All Names with Roll Number to Put in Google Sheets */}
      <CopyStudentsForSheetsModal
        isOpen={showCopyStudentsModal}
        onClose={() => setShowCopyStudentsModal(false)}
        students={sortedStudents}
        className={currentClass.name}
      />

    </div>
  );
};
