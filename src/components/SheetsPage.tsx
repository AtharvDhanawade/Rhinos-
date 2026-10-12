import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import { Student, ClassSubject, AttendanceRecord, WeeklySyncSettings } from '../types';
import { getWeekNumber, getWeekDateRange, getTodayDateString, sortStudentsByLast4Digits } from '../utils/storage';
import { 
  Table2, 
  QrCode, 
  Share2, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  Calendar, 
  FileSpreadsheet, 
  Sparkles, 
  ChevronRight,
  Eye,
  Settings,
  Link2,
  CheckCircle2,
  Rows,
  Layers,
  GraduationCap,
  Lock,
  X,
  AlertCircle,
  Clock,
  Edit2
} from 'lucide-react';
import { TeacherLiveViewModal } from './TeacherLiveViewModal';
import { GoogleSheetConfigModal } from './GoogleSheetConfigModal';
import { CopyStudentsForSheetsModal } from './CopyStudentsForSheetsModal';
import { WorkspaceConfirmModal } from './WorkspaceConfirmModal';
import { EditSessionAttendanceModal, EditableSessionInfo } from './EditSessionAttendanceModal';
import { buildTeacherPortalUrl, buildTeacherDocUrl, getCleanPublicBaseUrl } from '../utils/qrHelper';
import { 
  buildSheetSessionPayload, 
  appendAttendanceToGoogleSheet, 
  formatSessionRosterWithDateTop,
  formatSessionMatrixForGoogleSheets
} from '../utils/googleSheets';
import { 
  MatrixSessionColumnData, 
  MatrixStudentRowData, 
  syncWeeklyMatrixViaDirectApi, 
  extractSpreadsheetId 
} from '../utils/googleSheetsDirectApi';
import { ensureValidGoogleToken } from '../utils/googleWorkspaceAuth';

interface SheetsPageProps {
  students: Student[];
  classes: ClassSubject[];
  activeClassId: string;
  allRecords: AttendanceRecord[];
  settings: WeeklySyncSettings;
  onUpdateSettings: (settings: WeeklySyncSettings) => void;
  onBatchMarkAttendance?: (records: AttendanceRecord[]) => void;
  onDeleteSessionRecords?: (classId: string, date: string, sessionId?: string, sessionTime?: string) => void;
}

export const SheetsPage: React.FC<SheetsPageProps> = ({
  students,
  classes,
  activeClassId,
  allRecords,
  settings,
  onUpdateSettings,
  onBatchMarkAttendance,
  onDeleteSessionRecords
}) => {
  // Always sort students in ascending order based on last 4 digits
  const sortedStudents = useMemo(() => sortStudentsByLast4Digits(students), [students]);

  const currentWeek = getWeekNumber();
  const todayStr = getTodayDateString();
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [selectedClassId, setSelectedClassId] = useState(activeClassId);
  const [sheetLayoutMode, setSheetLayoutMode] = useState<'matrix' | 'chronological' | 'session-roster'>('chronological');
  const [studentFilter, setStudentFilter] = useState<'all' | 'absent' | 'present'>('all');
  
  // QR View Mode: 'day' (selected day only - strict locked view) vs 'week' (full week matrix)
  const [qrMode, setQrMode] = useState<'day' | 'week'>('day');
  const [selectedDayForQr, setSelectedDayForQr] = useState<string>(getTodayDateString());

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSheetTable, setCopiedSheetTable] = useState(false);
  const [copiedAbsenteesText, setCopiedAbsenteesText] = useState(false);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isCopyRosterOpen, setIsCopyRosterOpen] = useState(false);
  const [isQrZoomed, setIsQrZoomed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [showSyncConfirmModal, setShowSyncConfirmModal] = useState(false);

  // Edit Old Attendance Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSessionInfo, setEditingSessionInfo] = useState<EditableSessionInfo | null>(null);

  const selectedClass = classes.find(c => c.id === selectedClassId) || classes[0] || {
    id: 'cls-tech',
    name: 'Tech Class',
    code: 'CS401',
    teacherName: 'Prof. Sharma',
    room: 'Lab 402',
    color: '#2563eb'
  };

  const { start, end, days } = getWeekDateRange(selectedWeek);

  // Available weeks
  const availableWeeks = [
    Math.max(1, currentWeek - 2),
    Math.max(1, currentWeek - 1),
    currentWeek,
    currentWeek + 1,
    currentWeek + 2
  ];

  // Records for selected class and week (support both weekNumber and date within week days)
  const weekClassRecords = allRecords.filter(
    r => r.classId === selectedClass.id && (r.weekNumber === selectedWeek || days.some(d => d.dateStr === r.date))
  );

  const getRecord = (studentId: string, dateStr: string) => {
    return weekClassRecords.find(r => r.studentId === studentId && r.date === dateStr);
  };

  const handleOpenEditModalForSession = (row: { date: string; sessionId?: string; sessionTitle?: string; sessionTime?: string }) => {
    setEditingSessionInfo({
      classId: selectedClass.id,
      className: selectedClass.name,
      date: row.date,
      sessionId: row.sessionId || 'session-1',
      sessionTitle: row.sessionTitle || '1st Class',
      sessionTime: row.sessionTime || selectedClass.scheduleTime || '10:00 AM - 11:00 AM',
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEditModalForCol = (col: { dateStr: string; sessionId: string; sessionTitle: string; sessionTime: string }) => {
    setEditingSessionInfo({
      classId: selectedClass.id,
      className: selectedClass.name,
      date: col.dateStr,
      sessionId: col.sessionId || 'session-1',
      sessionTitle: col.sessionTitle || '1st Class',
      sessionTime: col.sessionTime || selectedClass.scheduleTime || '10:00 AM - 11:00 AM',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEditedSession = (
    newSessionInfo: EditableSessionInfo,
    updatedRecords: AttendanceRecord[],
    oldSessionInfo: EditableSessionInfo
  ) => {
    // Delete previous session records to ensure no duplicate keys or stale data
    if (onDeleteSessionRecords) {
      onDeleteSessionRecords(oldSessionInfo.classId, oldSessionInfo.date, oldSessionInfo.sessionId, oldSessionInfo.sessionTime);
    }

    if (onBatchMarkAttendance) {
      onBatchMarkAttendance(updatedRecords);
    }

    setSyncSuccessMessage(`✅ Updated attendance for "${newSessionInfo.sessionTitle}" (${newSessionInfo.date} • ${newSessionInfo.sessionTime})!`);
    setTimeout(() => setSyncSuccessMessage(null), 4000);
  };

  const handleDeleteSession = (classId: string, date: string, sessionId: string) => {
    if (onDeleteSessionRecords) {
      onDeleteSessionRecords(classId, date, sessionId);
      setSyncSuccessMessage(`Attendance session removed.`);
      setTimeout(() => setSyncSuccessMessage(null), 3500);
    }
  };

  // Chronological Daily Sessions for this class (grouped by date AND session so multiple classes appear separately)
  const chronologicalRows = useMemo(() => {
    const classAllRecords = allRecords.filter(r => r.classId === selectedClass.id);
    const sessionRecordsMap = new Map<string, {
      date: string;
      dayName: string;
      sessionId: string;
      sessionTitle: string;
      sessionTime: string;
      records: AttendanceRecord[];
    }>();

    classAllRecords.forEach(r => {
      const sId = r.sessionId || (r.sessionTime ? `time-${r.sessionTime}` : 'session-1');
      const key = `${r.date}___${sId}`;
      if (!sessionRecordsMap.has(key)) {
        const dateObj = new Date(r.date + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        sessionRecordsMap.set(key, {
          date: r.date,
          dayName,
          sessionId: sId,
          sessionTitle: r.sessionTitle || (sId === 'session-1' ? '1st Class' : sId === 'session-2' ? '2nd Class' : sId === 'session-3' ? '3rd Class' : 'Class Session'),
          sessionTime: r.sessionTime || r.time || selectedClass.scheduleTime || 'Session',
          records: []
        });
      }
      sessionRecordsMap.get(key)!.records.push(r);
    });

    let sessionEntries = Array.from(sessionRecordsMap.values()).sort((a, b) => {
      // 1. Sort by date descending (newest date first)
      if (a.date !== b.date) return b.date.localeCompare(a.date);

      // 2. On the same date: NEWEST attendance session on top!
      // Compare by latest record timestamp in each session
      const bLatest = Math.max(0, ...b.records.map(r => r.timestamp || 0));
      const aLatest = Math.max(0, ...a.records.map(r => r.timestamp || 0));
      if (bLatest !== aLatest && bLatest > 0 && aLatest > 0) {
        return bLatest - aLatest; // Newest timestamp at top
      }

      // 3. Fallback: Higher session number (e.g. session-3, session-2, session-1) at top
      const numA = parseInt(a.sessionId.replace(/\D/g, '') || '1', 10);
      const numB = parseInt(b.sessionId.replace(/\D/g, '') || '1', 10);
      if (numA !== numB) return numB - numA;

      return b.sessionId.localeCompare(a.sessionId);
    });

    if (sessionEntries.length === 0) {
      const dateObj = new Date(todayStr + 'T00:00:00');
      sessionEntries = [{
        date: todayStr,
        dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        sessionId: 'session-1',
        sessionTitle: '1st Class',
        sessionTime: selectedClass.scheduleTime || '10:00 AM',
        records: []
      }];
    }

    return sessionEntries.map((entry, idx) => {
      const presentRecs = entry.records.filter(r => r.status === 'present');
      const onDutyRecs = entry.records.filter(r => r.status === 'onduty' || r.status === 'late');
      const absentRecs = entry.records.filter(r => r.status === 'absent');
      
      const recordedIds = new Set(entry.records.map(r => r.studentId));
      const unrecordedStudents = students.filter(s => !recordedIds.has(s.id) && entry.records.length > 0);
      
      // If only attendees were marked, unrecorded students are absent. If only absentees or onduty were marked, unrecorded students are present.
      const isPresentOnlySession = presentRecs.length > 0 && absentRecs.length === 0;
      const unrecordedAbsent = isPresentOnlySession ? unrecordedStudents : [];
      const unrecordedPresent = (!isPresentOnlySession && entry.records.length > 0) ? unrecordedStudents : [];

      const totalPresent = presentRecs.length + unrecordedPresent.length;
      const totalOnDuty = onDutyRecs.length;
      const totalAbsent = absentRecs.length + unrecordedAbsent.length;
      const totalEnrolled = students.length;
      const percent = totalEnrolled > 0 ? Math.round(((totalPresent + totalOnDuty) / totalEnrolled) * 100) : 0;

      const allAbsentees = [
        ...absentRecs.map(r => `[${r.studentLast4}] ${r.studentName}`),
        ...unrecordedAbsent.map(s => `[${s.last4Digits}] ${s.name}`)
      ];

      return {
        rowNumber: idx + 3,
        date: entry.date,
        day: entry.dayName,
        sessionId: entry.sessionId,
        sessionTitle: entry.sessionTitle,
        sessionTime: entry.sessionTime,
        isLatest: idx === 0,
        enrolled: totalEnrolled,
        present: totalPresent,
        absent: totalAbsent,
        onDuty: totalOnDuty,
        percent: `${percent}%`,
        absenteesText: allAbsentees.length > 0 ? allAbsentees.join(', ') : 'None (100% Present)'
      };
    });
  }, [allRecords, selectedClass.id, selectedClass.scheduleTime, students, todayStr]);

  // Session columns for the Weekly Matrix (View B)
  // If there are 2, 3, or more classes of the same subject on any day, every single session gets its own separate column!
  const matrixSessionColumns = useMemo(() => {
    const cols: Array<{
      colId: string;
      dateStr: string;
      dayName: string;
      sessionId: string;
      sessionTitle: string;
      sessionTime: string;
      hasRecords: boolean;
    }> = [];

    days.forEach(d => {
      const recordsOnDay = weekClassRecords.filter(r => r.date === d.dateStr);
      const sessionMap = new Map<string, { sessionId: string; sessionTitle: string; sessionTime: string; timestamp: number }>();

      recordsOnDay.forEach(r => {
        let sId = r.sessionId;
        if (!sId || sId === 'session-1') {
          if (r.sessionTime && r.sessionTime !== selectedClass.scheduleTime) {
            sId = `time-${r.sessionTime.replace(/\s+/g, '')}`;
          } else if (r.sessionTitle && r.sessionTitle !== '1st Class') {
            sId = `title-${r.sessionTitle.replace(/\s+/g, '')}`;
          } else {
            sId = r.sessionId || 'session-1';
          }
        }

        if (!sessionMap.has(sId)) {
          sessionMap.set(sId, {
            sessionId: sId,
            sessionTitle: r.sessionTitle || (sId === 'session-1' ? '1st Class' : sId === 'session-2' ? '2nd Class' : sId === 'session-3' ? '3rd Class' : 'Class Session'),
            sessionTime: r.sessionTime || r.time || selectedClass.scheduleTime || 'Session',
            timestamp: r.timestamp || 0
          });
        }
      });

      if (sessionMap.size === 0) {
        cols.push({
          colId: `${d.dateStr}___session-1`,
          dateStr: d.dateStr,
          dayName: d.dayName,
          sessionId: 'session-1',
          sessionTitle: '1st Class',
          sessionTime: selectedClass.scheduleTime || '10:00 AM',
          hasRecords: false,
        });
      } else {
        const sortedSessions = Array.from(sessionMap.values()).sort((a, b) => {
          const numA = parseInt(a.sessionId.replace(/\D/g, '') || (a.sessionTitle.match(/\d+/)?.[0] || '1'), 10);
          const numB = parseInt(b.sessionId.replace(/\D/g, '') || (b.sessionTitle.match(/\d+/)?.[0] || '1'), 10);
          if (numA !== numB) return numA - numB;
          return a.timestamp - b.timestamp;
        });

        sortedSessions.forEach(sess => {
          cols.push({
            colId: `${d.dateStr}___${sess.sessionId}`,
            dateStr: d.dateStr,
            dayName: d.dayName,
            sessionId: sess.sessionId,
            sessionTitle: sess.sessionTitle,
            sessionTime: sess.sessionTime,
            hasRecords: true,
          });
        });
      }
    });

    return cols;
  }, [days, weekClassRecords, selectedClass.scheduleTime]);

  const getStudentColRecord = (studentId: string, col: { dateStr: string; sessionId: string; sessionTime?: string; sessionTitle?: string; hasRecords: boolean }): 'P' | 'A' | 'OD' | '-' => {
    const dayRecords = weekClassRecords.filter(r => r.date === col.dateStr);
    if (dayRecords.length === 0 && !col.hasRecords) return '-';
    const rec = dayRecords.find(r => {
      if (r.studentId !== studentId) return false;
      const rId = r.sessionId || (r.sessionTime ? `time-${r.sessionTime.replace(/\s+/g, '')}` : (r.sessionTitle ? `title-${r.sessionTitle.replace(/\s+/g, '')}` : 'session-1'));
      return rId === col.sessionId || (r.sessionId && r.sessionId === col.sessionId) || (col.sessionTime && r.sessionTime === col.sessionTime);
    });
    if (!rec) {
      const anyRecsForSession = dayRecords.some(r => {
        const rId = r.sessionId || (r.sessionTime ? `time-${r.sessionTime.replace(/\s+/g, '')}` : (r.sessionTitle ? `title-${r.sessionTitle.replace(/\s+/g, '')}` : 'session-1'));
        return rId === col.sessionId || (r.sessionId && r.sessionId === col.sessionId) || (col.sessionTime && r.sessionTime === col.sessionTime);
      });
      return anyRecsForSession ? 'A' : '-';
    }
    if (rec.status === 'present') return 'P';
    if (rec.status === 'onduty' || rec.status === 'late') return 'OD';
    return 'A';
  };

  // Analyze each student for the weekly matrix (multi-session aware)
  const matrixStudentStats = useMemo(() => {
    return sortedStudents.map(student => {
      let presentCount = 0;
      let absentCount = 0;
      let onDutyCount = 0;
      let totalLoggedSessions = 0;

      matrixSessionColumns.forEach(col => {
        const status = getStudentColRecord(student.id, col);
        if (status === 'P') {
          totalLoggedSessions++;
          presentCount++;
        } else if (status === 'OD') {
          totalLoggedSessions++;
          onDutyCount++;
          presentCount++;
        } else if (status === 'A') {
          totalLoggedSessions++;
          absentCount++;
        }
      });

      const isAbsentee = absentCount > 0;
      const isFullPresent = totalLoggedSessions > 0 && absentCount === 0;
      const percent = totalLoggedSessions > 0 ? Math.round((presentCount / totalLoggedSessions) * 100) : 0;

      return {
        student,
        presentCount,
        absentCount,
        onDutyCount,
        totalLoggedSessions,
        percent: `${percent}%`,
        isAbsentee,
        isFullPresent,
      };
    });
  }, [sortedStudents, matrixSessionColumns, weekClassRecords]);

  const studentsWithAbsenceCount = matrixStudentStats.filter(s => s.isAbsentee).length;
  const studentsWithFullAttendanceCount = matrixStudentStats.filter(s => s.isFullPresent).length;

  const filteredMatrixStudents = useMemo(() => {
    if (studentFilter === 'absent') {
      return matrixStudentStats.filter(s => s.isAbsentee).map(s => s.student);
    }
    if (studentFilter === 'present') {
      return matrixStudentStats.filter(s => s.isFullPresent).map(s => s.student);
    }
    return sortedStudents;
  }, [studentFilter, matrixStudentStats, sortedStudents]);

  // Session selector for Day View (View C: Session Roster)
  const [selectedDaySessionId, setSelectedDaySessionId] = useState<string>('session-1');

  // Day records calculation for the selected day QR
  const dayClassRecords = useMemo(() => {
    return allRecords.filter(r => r.classId === selectedClass.id && r.date === selectedDayForQr);
  }, [allRecords, selectedClass.id, selectedDayForQr]);

  // Available sessions on the selected day
  const dayAvailableSessions = useMemo(() => {
    const sessionMap = new Map<string, { id: string; title: string; time: string; count: number }>();
    dayClassRecords.forEach(r => {
      const sId = r.sessionId || (r.sessionTime ? `time-${r.sessionTime}` : 'session-1');
      if (!sessionMap.has(sId)) {
        sessionMap.set(sId, {
          id: sId,
          title: r.sessionTitle || (sId === 'session-1' ? '1st Class' : sId === 'session-2' ? '2nd Class' : sId === 'session-3' ? '3rd Class' : 'Class Session'),
          time: r.sessionTime || r.time || selectedClass.scheduleTime || 'Session',
          count: 0
        });
      }
      sessionMap.get(sId)!.count++;
    });
    return Array.from(sessionMap.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, [dayClassRecords, selectedClass.scheduleTime]);

  const activeDaySession = dayAvailableSessions.find(s => s.id === selectedDaySessionId) || dayAvailableSessions[0] || {
    id: 'session-1',
    title: '1st Class',
    time: selectedClass.scheduleTime || '10:00 AM'
  };

  const activeSessionRecords = useMemo(() => {
    return dayClassRecords.filter(r => (r.sessionId || 'session-1') === activeDaySession.id);
  }, [dayClassRecords, activeDaySession.id]);

  const hasDaySession = activeSessionRecords.length > 0;
  const dayPresentSet = useMemo(() => {
    return new Set(activeSessionRecords.filter(r => r.status === 'present').map(r => r.studentId));
  }, [activeSessionRecords]);
  const dayOnDutySet = useMemo(() => {
    return new Set(activeSessionRecords.filter(r => r.status === 'onduty' || r.status === 'late').map(r => r.studentId));
  }, [activeSessionRecords]);
  const dayExplicitAbsentSet = useMemo(() => {
    return new Set(activeSessionRecords.filter(r => r.status === 'absent').map(r => r.studentId));
  }, [activeSessionRecords]);

  // Full absentee students list including real student names (strictly excluding On-Duty and Present students!)
  const dayAbsenteeStudents = useMemo(() => {
    return sortedStudents
      .filter(s => {
        // 1. NEVER include On-Duty students as Absentees!
        if (dayOnDutySet.has(s.id)) return false;
        // 2. NEVER include Present students as Absentees!
        if (dayPresentSet.has(s.id)) return false;
        // 3. Explicitly recorded absent
        if (dayExplicitAbsentSet.has(s.id)) return true;
        // 4. If session was taken in Present mode, non-attendees are absent
        if (hasDaySession && dayPresentSet.size > 0 && dayExplicitAbsentSet.size === 0) {
          return true;
        }
        return false;
      })
      .map(s => ({
        name: s.name,
        rollNo: s.rollNo,
        last4Digits: s.last4Digits || (s.rollNo.slice(-4) || '----'),
      }));
  }, [sortedStudents, dayExplicitAbsentSet, hasDaySession, dayPresentSet, dayOnDutySet]);

  const dayOnDutyStudents = useMemo(() => {
    return sortedStudents
      .filter(s => dayOnDutySet.has(s.id))
      .map(s => ({
        name: s.name,
        rollNo: s.rollNo,
        last4Digits: s.last4Digits || (s.rollNo.slice(-4) || '----'),
      }));
  }, [sortedStudents, dayOnDutySet]);

  const dayPresentCount = dayPresentSet.size;
  const dayAbsentCount = dayAbsenteeStudents.length;
  const dayLateCount = dayClassRecords.filter(r => r.status === 'late').length;

  const dayAbsentRolls = useMemo(() => {
    return dayAbsenteeStudents.map(s => s.last4Digits || s.rollNo);
  }, [dayAbsenteeStudents]);

  // Generate shareable QR URL safe for external mobile scanners
  // When qrMode is 'day', encodes the specific selected day into the URL.
  // When scanned, App.tsx opens ONLY that single day's attendance sheet in strict locked view.
  const shareableUrl = useMemo(() => {
    if (qrMode === 'day') {
      return buildTeacherDocUrl({
        classId: selectedClass.id,
        className: selectedClass.name,
        teacherName: selectedClass.teacherName,
        room: selectedClass.room,
        date: selectedDayForQr,
        presentCount: dayPresentCount,
        absentCount: dayAbsentCount,
        absentRolls: dayAbsentRolls,
        absentees: dayAbsenteeStudents,
      });
    }
    return buildTeacherPortalUrl(selectedClass.id, selectedWeek);
  }, [qrMode, selectedClass, selectedDayForQr, dayPresentCount, dayAbsentCount, dayAbsentRolls, dayAbsenteeStudents, selectedWeek]);

  // Push live records to server immediately so mobile scanner loads live data with real student names
  useEffect(() => {
    if (!isTeacherModalOpen) return;
    fetch('/api/attendance/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        students,
        records: allRecords,
        classes: [selectedClass],
        activeClassId: selectedClass.id
      })
    }).catch(() => {});
  }, [isTeacherModalOpen, selectedDayForQr, students, allRecords, selectedClass]);

  // Generate QR Code with high contrast and low density
  useEffect(() => {
    if (!isTeacherModalOpen) return;
    QRCode.toDataURL(shareableUrl, {
      width: 400,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }).then(url => {
      setQrDataUrl(url);
    }).catch(err => {
      console.error('QR generation error:', err);
    });
  }, [shareableUrl, isTeacherModalOpen]);

  // Copy share URL
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // Copy formatted TSV for Google Sheets (Matrix with separate columns for multiple classes on same day)
  const handleCopyMatrixForGoogleSheets = () => {
    const studentStatusMap: Record<string, Record<string, 'P' | 'A' | 'OD' | '-'>> = {};
    const totalPresentMap: Record<string, number> = {};
    const attendancePercentMap: Record<string, string> = {};

    matrixStudentStats.forEach(stat => {
      const sId = stat.student.id;
      studentStatusMap[sId] = {};
      matrixSessionColumns.forEach(col => {
        studentStatusMap[sId][col.colId] = getStudentColRecord(sId, col);
      });
      totalPresentMap[sId] = stat.presentCount;
      attendancePercentMap[sId] = stat.percent;
    });

    const fullTsv = formatSessionMatrixForGoogleSheets(
      selectedClass.name,
      matrixSessionColumns,
      students,
      studentStatusMap,
      totalPresentMap,
      attendancePercentMap
    );

    navigator.clipboard.writeText(fullTsv).then(() => {
      setCopiedSheetTable(true);
      setTimeout(() => setCopiedSheetTable(false), 2500);
    });
  };

  // Copy Chronological Daily Rows for Google Sheets (Row 3, Row 4, Row 5... separate rows for Class 1, Class 2)
  const handleCopyChronologicalForGoogleSheets = () => {
    const titleRow = `Official Attendance Register - ${selectedClass.name} (${selectedClass.code})\tFaculty: ${selectedClass.teacherName}\tRoom: ${selectedClass.room}`;
    const headerRow = ['Row #', 'Date', 'Day', 'Session / Time', 'Total Enrolled', 'Present Count', 'Absent Count', 'On Duty (OD)', 'Attendance %', 'Absentee Students (Last 4 & Name)'].join('\t');
    const dataRows = chronologicalRows.map(r => 
      [r.rowNumber, r.date, r.day, `${r.sessionTitle} (${r.sessionTime})`, r.enrolled, r.present, r.absent, r.onDuty, r.percent, r.absenteesText].join('\t')
    );

    const fullTsv = [titleRow, headerRow, ...dataRows].join('\n');
    navigator.clipboard.writeText(fullTsv).then(() => {
      setCopiedSheetTable(true);
      setTimeout(() => setCopiedSheetTable(false), 2500);
    });
  };

  // Copy Session Roster (Date & Time on Top + Names with P or A in front of their name)
  const handleCopySessionRosterForGoogleSheets = () => {
    const todaySessionTime = activeDaySession.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullTsv = formatSessionRosterWithDateTop(
      selectedClass.name,
      selectedDayForQr,
      `${todaySessionTime} (${activeDaySession.title})`,
      students,
      allRecords,
      selectedClass.teacherName,
      selectedClass.room,
      activeDaySession.id
    );

    navigator.clipboard.writeText(fullTsv).then(() => {
      setCopiedSheetTable(true);
      setTimeout(() => setCopiedSheetTable(false), 2500);
    });
  };

  // Export CSV (multi-session aware)
  const handleDownloadCSV = () => {
    if (sheetLayoutMode === 'chronological') {
      const header = ['Row Number', 'Date', 'Day', 'Session / Time', 'Total Enrolled', 'Present Count', 'Absent Count', 'On Duty (OD)', 'Attendance %', 'Absentee Students'];
      const rows = chronologicalRows.map(r => 
        [r.rowNumber, `"${r.date}"`, `"${r.day}"`, `"${r.sessionTitle} (${r.sessionTime})"`, r.enrolled, r.present, r.absent, r.onDuty, `"${r.percent}"`, `"${r.absenteesText.replace(/"/g, '""')}"`].join(',')
      );
      const csvContent = 'data:text/csv;charset=utf-8,' + [header.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Chronological_Attendance_${selectedClass.name.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = [
        'Roll Number', 
        'Last 4 Digits', 
        'Student Name', 
        ...matrixSessionColumns.map(col => `"${col.dayName} ${col.dateStr} (${col.sessionTime} - ${col.sessionTitle})"`), 
        'Total Present', 
        'Attendance %'
      ];
      const rows = sortedStudents.map((student) => {
        let pCount = 0;
        let totalLogged = 0;

        const sessionCols = matrixSessionColumns.map(col => {
          const st = getStudentColRecord(student.id, col);
          if (st === 'P' || st === 'OD') { pCount++; totalLogged++; }
          else if (st === 'A') { totalLogged++; }
          return st;
        });

        const pct = totalLogged > 0 ? `${Math.round((pCount / totalLogged) * 100)}%` : '0%';
        return [`"${student.rollNo}"`, `"${student.last4Digits}"`, `"${student.name}"`, ...sessionCols.map(c => `"${c}"`), pCount, `"${pct}"`].join(',');
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Attendance_Week_${selectedWeek}_${selectedClass.name.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Real / Instant Sync with Connected Google Sheet (Writes multi-column matrix with Date & Time on top and P/A below)
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncSuccessMessage(null);
    setSyncErrorMessage(null);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      const today = getTodayDateString();
      const targetTabName = settings?.classTabNames?.[selectedClass.id] || selectedClass.sheetTabName || selectedClass.name;
      const targetSheetUrl = (settings?.syncStrategy === 'separate_sheets' && settings?.classSheetUrls?.[selectedClass.id])
        ? settings.classSheetUrls[selectedClass.id]
        : settings.googleSheetUrl;

      if (!targetSheetUrl) {
        setIsSyncing(false);
        setSyncErrorMessage('No Google Sheet linked yet! Please click "Give Sheet Link" to paste your Google Sheet URL.');
        setIsConfigModalOpen(true);
        return;
      }

      const sheetId = extractSpreadsheetId(targetSheetUrl);
      if (!sheetId) {
        setIsSyncing(false);
        setSyncErrorMessage('Invalid Google Sheet URL. Please check your sheet link in Sheet Settings.');
        return;
      }

      let token: string | null = null;
      try {
        token = await ensureValidGoogleToken();
      } catch (authErr: any) {
        setIsSyncing(false);
        setSyncErrorMessage(authErr?.message || 'Google Sign-in was cancelled. Permission is required to write to your Google Sheet.');
        return;
      }

      if (!token) {
        setIsSyncing(false);
        setSyncErrorMessage('Google authentication is required to write to your Google Sheet.');
        return;
      }

      // Prepare matrix rows data
      const studentRowsData: MatrixStudentRowData[] = sortedStudents.map(s => {
        const statusByColId: Record<string, 'P' | 'A' | 'OD' | '-'> = {};
        let pCount = 0;
        let totalLogged = 0;

        matrixSessionColumns.forEach(c => {
          const st = getStudentColRecord(s.id, c);
          statusByColId[c.colId] = st;
          if (st === 'P' || st === 'OD') { pCount++; totalLogged++; }
          else if (st === 'A') { totalLogged++; }
        });

        const pct = totalLogged > 0 ? `${Math.round((pCount / totalLogged) * 100)}%` : '0%';
        return {
          rollNo: s.rollNo,
          last4Digits: s.last4Digits || (s.rollNo.slice(-4) || '----'),
          name: s.name,
          statusByColId,
          totalPresent: pCount,
          attendancePercent: pct,
        };
      });

      const matrixColsData: MatrixSessionColumnData[] = matrixSessionColumns.map(c => ({
        colId: c.colId,
        dateStr: c.dateStr,
        dayName: c.dayName,
        sessionId: c.sessionId,
        sessionTitle: c.sessionTitle,
        sessionTime: c.sessionTime,
      }));

      const matrixRes = await syncWeeklyMatrixViaDirectApi(
        sheetId,
        targetTabName,
        matrixColsData,
        studentRowsData,
        token
      );

      setIsSyncing(false);

      if (matrixRes.success) {
        onUpdateSettings({
          ...settings,
          lastSyncedAt: timeStr,
        });
        setSyncSuccessMessage(`✅ Synced "${selectedClass.name}" session columns (${matrixSessionColumns.length} class slots) to Google Sheet tab "${targetTabName}" successfully at ${timeStr}! P/A status recorded.`);
        setSyncErrorMessage(null);
        setTimeout(() => setSyncSuccessMessage(null), 6000);
      } else {
        setSyncErrorMessage(matrixRes.message || 'Could not write to Google Sheet. Please check permissions or sign in via Sheet Settings.');
      }
    } catch (err: any) {
      setIsSyncing(false);
      setSyncErrorMessage(err?.message || 'Unexpected sync error. Please check your Google Sheet link.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-400/30">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Multi-Subject Google Sheets Synchronization</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Live Google Sheets Portal
          </h1>
          <p className="mt-2 text-emerald-100 text-xs sm:text-sm leading-relaxed">
            All your subjects are organized as separate sheet pages inside 1 unified Google Sheets workbook. Attendance is saved chronologically row-by-row (Today in Row 3, Tomorrow in Row 4, and so on).
          </p>
        </div>

        {/* Sync Status & Google Sheet Link Box */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex flex-col gap-2.5 min-w-[280px]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-200 font-medium">Google Sheet Link:</span>
            {settings.googleSheetUrl ? (
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                No Sheet Linked
              </span>
            )}
          </div>

          {settings.googleSheetUrl ? (
            <div className="space-y-1">
              <a
                href={settings.googleSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-200 hover:text-white font-mono truncate block hover:underline flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg border border-white/10"
                title={settings.googleSheetUrl}
              >
                <span className="truncate">{settings.googleSheetUrl}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
              <div className="text-[11px] text-slate-300">
                Last Synced: <strong className="text-white font-mono">{settings.lastSyncedAt || 'Just now'}</strong>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-emerald-100 leading-snug">
              Link your Google Sheet so all attendance entries are stored over there automatically.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              id="configure-sheets-btn"
              onClick={() => setIsConfigModalOpen(true)}
              className="py-2 px-2.5 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 border border-white/20 shadow-xs"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{settings.googleSheetUrl ? 'Sheet Settings' : 'Give Sheet Link'}</span>
            </button>

            <button
              type="button"
              id="sync-now-btn"
              onClick={() => {
                if (!settings.googleSheetUrl) {
                  setSyncErrorMessage('Please paste your Google Sheet link in Sheet Settings first.');
                  setIsConfigModalOpen(true);
                  return;
                }
                setShowSyncConfirmModal(true);
              }}
              disabled={isSyncing}
              className="py-2 px-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync to Sheet'}</span>
            </button>
          </div>
        </div>
      </div>

      {syncSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{syncSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {syncErrorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{syncErrorMessage}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition"
            >
              Sheet Settings
            </button>
            <button
              type="button"
              onClick={() => setSyncErrorMessage(null)}
              className="text-rose-700 hover:text-rose-950 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container: Full Width Google Sheets Workbook */}
      <div className="w-full space-y-4">
          
          {/* Controls Bar: View Mode Switcher + Export Buttons */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            
            {/* View Mode & Filter Toggles */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSheetLayoutMode('chronological')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    sheetLayoutMode === 'chronological'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Rows className="w-3.5 h-3.5" />
                  <span>Daily Chronological Rows</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSheetLayoutMode('session-roster')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    sheetLayoutMode === 'session-roster'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Session Roster (Date & Time on Top)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSheetLayoutMode('matrix')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    sheetLayoutMode === 'matrix'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Weekly Student Matrix</span>
                </button>
              </div>

              {/* Roster Filter: All vs Only Absentees */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setStudentFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    studentFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Students ({students.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStudentFilter('absent')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    studentFilter === 'absent'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-700 hover:text-rose-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span>Only Absentees ({studentsWithAbsenceCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStudentFilter('present')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    studentFilter === 'present'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-800 hover:text-emerald-950'
                  }`}
                >
                  100% Present ({studentsWithFullAttendanceCount})
                </button>
              </div>
            </div>

            {/* Action Buttons: Edit Attendance Session */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="edit-attendance-main-btn"
                onClick={() => {
                  if (chronologicalRows.length > 0) {
                    handleOpenEditModalForSession(chronologicalRows[0]);
                  }
                }}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-amber-500/20 cursor-pointer"
                title="Edit previous attendance records, modify student P/A status, date, or lecture time"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Old / Past Attendance</span>
              </button>
            </div>

          </div>

          {/* Authentic Google Sheets Workbook Container */}
          <div className="bg-white rounded-3xl border-2 border-emerald-600/30 shadow-md overflow-hidden flex flex-col">
            
            {/* Top Ribbon */}
            <div className="bg-emerald-700 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
                <div>
                  <span className="font-bold text-sm block">
                    College_Attendance_Master_Workbook.gsheet
                  </span>
                  <span className="text-[11px] text-emerald-200">
                    Active Page: <strong>{selectedClass.name}</strong> • Subject Code: {selectedClass.code}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-emerald-100 font-mono bg-emerald-800/80 px-2.5 py-1 rounded-md">
                1 Workbook • Multiple Subject Tabs
              </span>
            </div>

            {/* Formula Bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center space-x-2 text-xs font-mono text-slate-600">
              <span className="font-bold text-slate-400">fx</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-700 truncate">
                {sheetLayoutMode === 'chronological'
                  ? `=COUNTIF(E3:E${chronologicalRows.length + 2}, ">0") & " days logged"`
                  : `=COUNTIF(E2:I${students.length + 1}, "P") / (${students.length} * 5)`}
              </span>
            </div>

            {/* View Selection */}
            {sheetLayoutMode === 'session-roster' ? (
              /* View C: Session Roster with Date & Time on Top and Student Names with Present or Absent */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-100 text-slate-400 font-bold border-b border-slate-200 text-[10px] text-center font-sans">
                      <th className="py-1 px-2 border-r border-slate-200 w-12">A</th>
                      <th className="py-1 px-3 border-r border-slate-200 w-32">B</th>
                      <th className="py-1 px-2 border-r border-slate-200 w-24">C</th>
                      <th className="py-1 px-4 border-r border-slate-200">D</th>
                      <th className="py-1 px-3 border-r border-slate-200 w-36">E</th>
                      <th className="py-1 px-3">F</th>
                    </tr>

                    {/* Row 1: Session Top Banner */}
                    <tr className="bg-slate-900 text-white font-bold border-b border-slate-800">
                      <td className="py-2.5 px-2 border-r border-slate-800 text-center font-bold text-slate-500">1</td>
                      <td colSpan={5} className="py-2.5 px-4 font-sans font-extrabold text-sky-300">
                        DATE: {selectedDayForQr} • TIME: {dayClassRecords[0]?.sessionTime || 'Current Lecture Session'} • SUBJECT: {selectedClass.name.toUpperCase()} ({selectedClass.code}) • VENUE: {selectedClass.room}
                      </td>
                    </tr>

                    {/* Row 2: Summary Stats Banner */}
                    <tr className="bg-slate-800 text-emerald-300 font-bold border-b border-slate-700">
                      <td className="py-2 px-2 border-r border-slate-700 text-center font-bold text-slate-500">2</td>
                      <td colSpan={5} className="py-2 px-4 font-sans font-bold text-emerald-400">
                        TOTAL ENROLLED: {students.length} • PRESENT: {dayPresentSet.size} • ABSENT: {students.length - dayPresentSet.size} • FACULTY: {selectedClass.teacherName}
                      </td>
                    </tr>

                    {/* Row 3: Column Headers */}
                    <tr className="bg-emerald-700 text-white font-bold border-b border-emerald-800 font-sans">
                      <th className="py-2 px-2 border-r border-emerald-800 text-center text-emerald-200">3</th>
                      <th className="py-2 px-3 border-r border-emerald-800">Roll Number</th>
                      <th className="py-2 px-2 border-r border-emerald-800 text-center">Last 4</th>
                      <th className="py-2 px-4 border-r border-emerald-800">Student Name</th>
                      <th className="py-2 px-3 border-r border-emerald-800 text-center">Attendance Status</th>
                      <th className="py-2 px-3">Recorded Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredMatrixStudents.map((std, idx) => {
                      const isPresent = dayPresentSet.has(std.id);
                      const rec = dayClassRecords.find(r => r.studentId === std.id);
                      return (
                        <tr key={std.id} className="hover:bg-blue-50/30 transition">
                          <td className="py-2.5 px-2 border-r border-slate-200 text-center font-bold text-slate-400 bg-slate-50/80">
                            {idx + 4}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 font-semibold text-slate-700">
                            {std.rollNo}
                          </td>
                          <td className="py-2.5 px-2 border-r border-slate-200 text-center font-mono font-bold text-blue-700">
                            {std.last4Digits}
                          </td>
                          <td className="py-2.5 px-4 border-r border-slate-200 font-medium text-slate-900 font-sans">
                            {std.name}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                            {isPresent ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
                                PRESENT
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs bg-rose-100 text-rose-800 border border-rose-300">
                                ABSENT
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-xs">
                            {rec?.time || dayClassRecords[0]?.sessionTime || '--'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : sheetLayoutMode === 'chronological' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-100 text-slate-400 font-bold border-b border-slate-200 text-[10px] text-center font-sans">
                      <th className="py-1 px-2 border-r border-slate-200 w-12">A</th>
                      <th className="py-1 px-3 border-r border-slate-200 w-28">B</th>
                      <th className="py-1 px-2 border-r border-slate-200 w-16">C</th>
                      <th className="py-1 px-2 border-r border-slate-200 w-20">D</th>
                      <th className="py-1 px-2 border-r border-slate-200 w-20">E</th>
                      <th className="py-1 px-2 border-r border-slate-200 w-20">F</th>
                      <th className="py-1 px-2 border-r border-slate-200 w-24">G</th>
                      <th className="py-1 px-3">H</th>
                    </tr>

                    {/* Row 1: Title Banner */}
                    <tr className="bg-emerald-50 text-emerald-950 font-bold border-b border-emerald-200">
                      <td className="py-2 px-2 border-r border-emerald-200 text-center font-bold text-slate-500">1</td>
                      <td colSpan={7} className="py-2 px-3 font-sans font-extrabold text-emerald-900">
                        OFFICIAL ATTENDANCE REGISTER: {selectedClass.name.toUpperCase()} ({selectedClass.code}) • Faculty: {selectedClass.teacherName} • Room: {selectedClass.room}
                      </td>
                    </tr>

                    {/* Row 2: Headers */}
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-300">
                      <th className="py-2 px-2 border-r border-slate-200 text-center text-slate-500">2</th>
                      <th className="py-2 px-3 border-r border-slate-200">Session Date & Time</th>
                      <th className="py-2 px-2 border-r border-slate-200 text-center">Day</th>
                      <th className="py-2 px-2 border-r border-slate-200 text-center">Enrolled</th>
                      <th className="py-2 px-2 border-r border-slate-200 text-center text-emerald-700 bg-emerald-50/50">Present</th>
                      <th className="py-2 px-2 border-r border-slate-200 text-center text-rose-700 bg-rose-50/50">Absent</th>
                      <th className="py-2 px-2 border-r border-slate-200 text-center">Attendance %</th>
                      <th className="py-2 px-3 border-r border-slate-200">Absentee Student Names & Roll Numbers</th>
                      <th className="py-2 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {chronologicalRows.map((row) => (
                      <tr key={`${row.date}___${row.sessionId}`} className="hover:bg-blue-50/30 transition">
                        <td className="py-2.5 px-2 border-r border-slate-200 text-center font-bold text-slate-400 bg-slate-50/80">
                          {row.rowNumber}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-200">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">{row.date}</span>
                            {row.isLatest && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider border border-emerald-300">
                                Latest
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-blue-700 font-mono font-bold flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                            <span>{row.sessionTime || 'Time recorded'}</span>
                            {row.sessionTitle && (
                              <span className="text-slate-600 font-sans text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded font-medium">
                                {row.sessionTitle}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-200 text-center text-slate-600">
                          {row.day}
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-200 text-center text-slate-700">
                          {row.enrolled}
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-200 text-center font-bold text-emerald-700 bg-emerald-50/20">
                          {row.present}
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-200 text-center font-bold text-rose-600 bg-rose-50/20">
                          {row.absent}
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-200 text-center font-semibold text-slate-800">
                          {row.percent}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-sans text-xs border-r border-slate-200">
                          {row.absent > 0 ? (
                            <span className="text-rose-700 font-medium">{row.absenteesText}</span>
                          ) : (
                            <span className="text-emerald-700 font-medium">✨ All Present (100%)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModalForSession(row)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer mx-auto"
                            title="Edit attendance, change student P/A status, date, or time"
                          >
                            <Edit2 className="w-3 h-3 text-amber-700" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* View B: Weekly Student Matrix - Supports all extra class columns for the subject */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-100 text-slate-400 font-bold border-b border-slate-300 text-[10px] text-center font-sans">
                      <th className="py-1 px-2 border-r border-slate-200 w-8">A</th>
                      <th className="py-1 px-3 border-r border-slate-200">B</th>
                      <th className="py-1 px-3 border-r border-slate-200">C</th>
                      <th className="py-1 px-3 border-r border-slate-200">D</th>
                      {matrixSessionColumns.map((col, cIdx) => (
                        <th key={col.colId} className="py-1 px-2 border-r border-slate-200 text-center">
                          {String.fromCharCode(69 + (cIdx % 22))}
                        </th>
                      ))}
                      <th className="py-1 px-3 border-r border-slate-200">Σ</th>
                      <th className="py-1 px-3">%</th>
                    </tr>

                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-300">
                      <th className="py-2 px-2 border-r border-slate-200 text-center font-sans">#</th>
                      <th className="py-2 px-3 border-r border-slate-200">Roll No</th>
                      <th className="py-2 px-3 border-r border-slate-200 text-blue-600">Last 4</th>
                      <th className="py-2 px-3 border-r border-slate-200 font-sans">Student Name</th>
                      {matrixSessionColumns.map((col) => (
                        <th 
                          key={col.colId} 
                          onClick={() => handleOpenEditModalForCol(col)}
                          className="py-2 px-2 border-r border-slate-200 text-center font-sans min-w-[75px] hover:bg-blue-50/80 cursor-pointer transition group"
                          title={`Click to edit ${col.dayName} ${col.sessionTitle} (${col.sessionTime}) attendance`}
                        >
                          <div className="font-bold text-slate-800 flex items-center justify-center gap-1">
                            <span>{col.dayName}</span>
                            <span className="text-[10px] text-slate-400 font-normal font-mono">{col.dateStr.slice(5)}</span>
                          </div>
                          <div className="text-[10px] text-blue-700 font-mono font-bold truncate max-w-[95px] mx-auto mt-0.5">
                            {col.sessionTime}
                          </div>
                          {col.sessionTitle && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded font-bold uppercase tracking-wider inline-block mt-0.5 group-hover:bg-blue-200 transition">
                              {col.sessionTitle}
                            </span>
                          )}
                        </th>
                      ))}
                      <th className="py-2 px-3 border-r border-slate-200 text-center bg-emerald-50/50">Total P</th>
                      <th className="py-2 px-3 text-center bg-emerald-50/50">% Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={6 + matrixSessionColumns.length} className="py-8 text-center text-slate-400 font-sans">
                          No students in roster. Add students in the Students page to populate the sheet.
                        </td>
                      </tr>
                    ) : filteredMatrixStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6 + matrixSessionColumns.length} className="py-8 text-center text-emerald-700 font-semibold bg-emerald-50/40">
                          {studentFilter === 'absent'
                            ? '🌟 Perfect Attendance! No absentees found for this class.'
                            : 'No student matches this filter.'}
                        </td>
                      </tr>
                    ) : (
                      filteredMatrixStudents.map((student, idx) => {
                        const stat = matrixStudentStats.find(s => s.student.id === student.id);

                        return (
                          <tr key={student.id} className="hover:bg-slate-50 transition">
                            <td className="py-2 px-2 border-r border-slate-200 text-center text-slate-400 font-sans">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-800">
                              {student.rollNo}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 font-bold text-blue-600">
                              {student.last4Digits}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-200 font-sans font-medium text-slate-900">
                              {student.name}
                            </td>
                            {matrixSessionColumns.map((col) => {
                              const recStatus = getStudentColRecord(student.id, col);
                              return (
                                <td 
                                  key={col.colId} 
                                  onClick={() => handleOpenEditModalForCol(col)}
                                  className="py-2 px-2 border-r border-slate-200 text-center font-bold font-mono cursor-pointer hover:bg-amber-50/50 transition"
                                  title={`Click to edit ${col.sessionTitle} attendance`}
                                >
                                  {recStatus === 'P' ? (
                                    <span className="inline-block w-6 h-6 leading-6 rounded text-xs bg-emerald-100 text-emerald-800 font-bold">
                                      P
                                    </span>
                                  ) : recStatus === 'OD' ? (
                                    <span className="inline-block w-6 h-6 leading-6 rounded text-xs bg-amber-100 text-amber-800 font-bold">
                                      OD
                                    </span>
                                  ) : recStatus === 'A' ? (
                                    <span className="inline-block w-6 h-6 leading-6 rounded text-xs bg-rose-100 text-rose-800 font-bold">
                                      A
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 font-normal">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 border-r border-slate-200 text-center font-bold text-slate-800 bg-emerald-50/20">
                              {stat?.presentCount || 0}
                            </td>
                            <td className="py-2 px-3 text-center font-bold bg-emerald-50/20">
                              <span className={((stat?.presentCount || 0) / Math.max(1, matrixSessionColumns.filter(c => c.hasRecords).length)) >= 0.75 ? 'text-emerald-700' : 'text-rose-600'}>
                                {stat?.percent || '0%'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ========================================================= */}
            {/* GOOGLE SHEETS BOTTOM TAB BAR: MULTI-SUBJECT PAGES (TABS) */}
            {/* ========================================================= */}
            <div className="bg-slate-100 border-t border-slate-300 px-3 py-2 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-2 shrink-0">
                Workbook Tabs:
              </span>

              {classes.map((cls) => {
                const isActive = cls.id === selectedClass.id;

                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`px-4 py-2 rounded-t-lg font-medium text-xs whitespace-nowrap transition flex items-center gap-2 border-t-2 ${
                      isActive
                        ? 'bg-white text-emerald-800 border-emerald-600 shadow-sm font-bold'
                        : 'bg-slate-200/80 hover:bg-slate-200 text-slate-600 border-transparent'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cls.color }} />
                    <span>{cls.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({cls.code})</span>
                  </button>
                );
              })}
            </div>

          </div>

        </div>

      {/* Edit Session Attendance Modal */}
      <EditSessionAttendanceModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        sessionInfo={editingSessionInfo}
        students={students}
        allRecords={allRecords}
        onSaveSession={handleSaveEditedSession}
        onDeleteSession={handleDeleteSession}
        customClassTimes={selectedClass.classTimes}
      />

      {/* Teacher Live View Modal */}
      {isTeacherModalOpen && (
        <TeacherLiveViewModal
          isOpen={isTeacherModalOpen}
          onClose={() => setIsTeacherModalOpen(false)}
          currentClass={selectedClass}
          weekNumber={selectedWeek}
          students={students}
          allRecords={allRecords}
        />
      )}

      {/* Google Sheet Cloud Storage Configuration Modal */}
      <GoogleSheetConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        settings={settings}
        classes={classes}
        onSaveSettings={onUpdateSettings}
        currentClass={selectedClass}
        students={students}
        records={allRecords}
      />

      {/* Copy Roster for Google Sheet Modal */}
      <CopyStudentsForSheetsModal
        isOpen={isCopyRosterOpen}
        onClose={() => setIsCopyRosterOpen(false)}
        students={students}
        className={selectedClass.name}
      />

      {/* Confirmation Modal before writing/syncing to Google Sheets */}
      <WorkspaceConfirmModal
        isOpen={showSyncConfirmModal}
        onClose={() => setShowSyncConfirmModal(false)}
        onConfirm={async () => {
          setShowSyncConfirmModal(false);
          await handleTriggerSync();
        }}
        title="Sync Attendance to Google Sheet"
        description={`Append current attendance session for "${selectedClass.name}" to your connected Google Sheet? Student names with PRESENT or ABSENT status and session date/time will be written.`}
        sheetTitle={settings.googleSheetUrl || 'Connected Google Sheet'}
        tabName={settings?.classTabNames?.[selectedClass.id] || selectedClass.sheetTabName || selectedClass.name}
        rowCount={students.length}
        isLoading={isSyncing}
      />

    </div>
  );
};
