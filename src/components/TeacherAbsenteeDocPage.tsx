import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode, 
  FileText, 
  Copy, 
  Check, 
  Printer, 
  ExternalLink, 
  Users, 
  Calendar, 
  Sparkles, 
  AlertTriangle,
  Clock,
  Share2,
  Download,
  GraduationCap,
  RefreshCw,
  Globe,
  Settings,
  ArrowLeft,
  Lock,
  Send
} from 'lucide-react';
import { Student, ClassSubject, AttendanceRecord } from '../types';
import { getTodayDateString, INITIAL_STUDENTS, INITIAL_CLASSES, sortStudentsByLast4Digits } from '../utils/storage';
import { 
  buildTeacherDocUrl, 
  getCleanPublicBaseUrl, 
  getCustomBaseUrl, 
  saveCustomBaseUrl,
  DEFAULT_SHARED_PUBLIC_URL,
  parseAbsenteesFromUrl
} from '../utils/qrHelper';
import { SendReportToSirModal } from './SendReportToSirModal';

interface TeacherAbsenteeDocPageProps {
  students: Student[];
  classes: ClassSubject[];
  activeClassId: string;
  onSelectClass: (id: string) => void;
  allRecords: AttendanceRecord[];
  isStandalone?: boolean;
  onExitStandalone?: () => void;
}

export const TeacherAbsenteeDocPage: React.FC<TeacherAbsenteeDocPageProps> = ({
  students: propStudents,
  classes: propClasses,
  activeClassId: propActiveClassId,
  onSelectClass,
  allRecords: propAllRecords,
  isStandalone = false,
  onExitStandalone,
}) => {
  const [students, setStudents] = useState<Student[]>(propStudents && propStudents.length > 0 ? propStudents : INITIAL_STUDENTS);
  const [classes, setClasses] = useState<ClassSubject[]>(propClasses && propClasses.length > 0 ? propClasses : INITIAL_CLASSES);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>(propAllRecords || []);
  const [activeClassId, setActiveClassId] = useState<string>(propActiveClassId || (propClasses && propClasses[0]?.id) || 'cls-tech');
  const [isLoadingServerData, setIsLoadingServerData] = useState(false);

  // Sync prop changes
  useEffect(() => {
    if (propStudents && propStudents.length > 0) setStudents(propStudents);
  }, [propStudents]);

  useEffect(() => {
    if (propClasses && propClasses.length > 0) setClasses(propClasses);
  }, [propClasses]);

  useEffect(() => {
    if (propAllRecords && propAllRecords.length > 0) setAllRecords(propAllRecords);
  }, [propAllRecords]);

  useEffect(() => {
    if (propActiveClassId) setActiveClassId(propActiveClassId);
  }, [propActiveClassId]);

  // Read URL params (critical when scanned by teacher's phone camera)
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialDate = urlParams?.get('date') || getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [docFilter, setDocFilter] = useState<'absent' | 'all' | 'present'>('absent');
  const [showUrlSettings, setShowUrlSettings] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(getCustomBaseUrl());
  const [urlSaveSuccess, setUrlSaveSuccess] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  // On mount or in standalone mode, fetch latest data from server
  const fetchLatestServerData = async () => {
    setIsLoadingServerData(true);
    try {
      const res = await fetch('/api/attendance/state');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.students) && data.students.length > 0) {
          setStudents(data.students);
        }
        if (Array.isArray(data.classes) && data.classes.length > 0) {
          setClasses(data.classes);
        }
        if (Array.isArray(data.records) && data.records.length > 0) {
          setAllRecords(data.records);
        }
        if (data.activeClassId && !activeClassId) {
          setActiveClassId(data.activeClassId);
        }
      }
    } catch (e) {
      console.warn('Could not fetch server attendance state:', e);
    } finally {
      setIsLoadingServerData(false);
    }
  };

  useEffect(() => {
    fetchLatestServerData();
  }, []);

  // Parse any absentee data transmitted directly in the QR URL (supports cross-device camera scanning)
  const urlAbsentees = useMemo(() => {
    if (!urlParams) return [];
    return parseAbsenteesFromUrl(urlParams, students);
  }, [urlParams, students]);

  const urlPresentCountParam = urlParams ? urlParams.get('p') : null;
  const urlAbsentCountParam = urlParams ? urlParams.get('a') : null;
  const hasUrlAttendanceData = Boolean(
    urlAbsentees.length > 0 || 
    (urlAbsentCountParam !== null && !isNaN(parseInt(urlAbsentCountParam, 10))) ||
    (urlPresentCountParam !== null && !isNaN(parseInt(urlPresentCountParam, 10)))
  );

  const currentClass = classes.find(c => c.id === activeClassId) || classes[0] || {
    id: urlParams?.get('classId') || 'cls-tech',
    name: urlParams?.get('cn') || urlParams?.get('cls') || 'Tech Class',
    code: 'CS401',
    teacherName: urlParams?.get('prof') || 'Faculty Incharge',
    room: urlParams?.get('room') || 'Main Lab',
    color: '#2563eb',
  };

  // Check for custom session class name or lecture time passed via QR or URL
  const urlCustomClassName = urlParams?.get('cn') || urlParams?.get('cls') || urlParams?.get('className');
  const urlCustomTime = urlParams?.get('t') || urlParams?.get('time');
  const urlSessionId = urlParams?.get('sid') || urlParams?.get('sessionId');
  const urlSessionTitle = urlParams?.get('st') || urlParams?.get('sessionTitle');
  const displayClassName = urlCustomClassName || currentClass.name;
  const displayTime = urlCustomTime || currentClass.scheduleTime || '';

  // Filter records for selected date and class (and session if specified)
  const classRecords = allRecords.filter(
    r => r.date === selectedDate && 
         r.classId === currentClass.id &&
         (!urlSessionId || (r.sessionId || 'session-1') === urlSessionId)
  );

  const recordedDatesForCurrentClass = useMemo(() => {
    return Array.from(new Set(allRecords.filter(r => r.classId === currentClass.id).map(r => r.date))).sort().reverse();
  }, [allRecords, currentClass.id]);

  const recordMap = new Map<string, AttendanceRecord>();
  classRecords.forEach(r => recordMap.set(r.studentId, r));

  // If local/server records exist OR attendance summary was passed via QR URL, attendance was taken!
  const hasTakenAttendanceToday = classRecords.length > 0 || hasUrlAttendanceData;

  // Build classified student list with status
  const { absentStudents, presentStudents, studentsWithStatus, totalCount, presentCount, absentCount } = useMemo(() => {
    // 1. If we have local or synced class records:
    if (classRecords.length > 0) {
      const sortedRoster = sortStudentsByLast4Digits(students);
      const computed = sortedRoster.map(student => {
        const rec = recordMap.get(student.id);
        let status: 'present' | 'absent' | 'onduty' | 'late' | 'pending' = 'pending';
        if (rec) {
          status = rec.status;
        } else if (!hasTakenAttendanceToday) {
          status = 'pending';
        } else {
          // If session occurred but student was not recorded, check if session was absentees-only
          const hasAbsents = classRecords.some(r => r.status === 'absent');
          const hasPresents = classRecords.some(r => r.status === 'present');
          if (hasAbsents && !hasPresents) {
            status = 'present';
          } else {
            status = 'absent';
          }
        }
        return {
          ...student,
          status,
          isAbsent: status === 'absent' || status === 'pending',
          isOnDuty: status === 'onduty' || status === 'late',
          isPresent: status === 'present' || status === 'onduty' || status === 'late',
        };
      });

      const abs = computed.filter(s => s.isAbsent);
      const pres = computed.filter(s => s.isPresent);
      return {
        studentsWithStatus: computed,
        absentStudents: abs,
        presentStudents: pres,
        totalCount: computed.length,
        presentCount: pres.length,
        absentCount: abs.length,
      };
    }

    // 2. If classRecords is empty, but opened via QR Code scan with URL absentee data:
    if (hasUrlAttendanceData) {
      const absentIdSet = new Set(urlAbsentees.map(a => a.id));
      const absentLast4Set = new Set(urlAbsentees.map(a => a.last4Digits).filter(Boolean));
      const absentRollSet = new Set(urlAbsentees.map(a => a.rollNo).filter(Boolean));

      const combinedStudentsMap = new Map<string, any>();

      // Populate from known students roster
      const sortedRoster = sortStudentsByLast4Digits(students);
      sortedRoster.forEach(s => {
        const isAbsent = absentIdSet.has(s.id) || 
                         (s.last4Digits && absentLast4Set.has(s.last4Digits)) || 
                         (s.rollNo && absentRollSet.has(s.rollNo));
        combinedStudentsMap.set(s.id, {
          ...s,
          status: isAbsent ? 'absent' : 'present',
          isAbsent,
          isPresent: !isAbsent,
        });
      });

      // Ensure all URL absentees exist in map with full name
      urlAbsentees.forEach(ua => {
        const existingKey = Array.from(combinedStudentsMap.keys()).find(k => {
          const s = combinedStudentsMap.get(k);
          return (ua.last4Digits && s.last4Digits === ua.last4Digits) || 
                 (ua.rollNo && s.rollNo === ua.rollNo);
        });

        if (existingKey) {
          const existing = combinedStudentsMap.get(existingKey);
          combinedStudentsMap.set(existingKey, {
            ...existing,
            name: ua.name || existing.name,
            rollNo: ua.rollNo || existing.rollNo,
            last4Digits: ua.last4Digits || existing.last4Digits,
            status: 'absent',
            isAbsent: true,
            isPresent: false,
          });
        } else {
          // New student added in this session
          combinedStudentsMap.set(ua.id, ua);
        }
      });

      const fullList = Array.from(combinedStudentsMap.values()).sort((a, b) => {
        const aLast = (a.last4Digits || a.rollNo?.slice(-4) || '').trim();
        const bLast = (b.last4Digits || b.rollNo?.slice(-4) || '').trim();
        const numA = parseInt(aLast, 10);
        const numB = parseInt(bLast, 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
        return aLast.localeCompare(bLast, undefined, { numeric: true });
      });
      const abs = fullList.filter(s => s.isAbsent);
      const pres = fullList.filter(s => s.isPresent);

      const parsedP = urlPresentCountParam !== null ? parseInt(urlPresentCountParam, 10) : null;
      const parsedA = urlAbsentCountParam !== null ? parseInt(urlAbsentCountParam, 10) : null;

      const finalAbsCount = !isNaN(parsedA as number) && parsedA !== null ? parsedA : abs.length;
      const finalPresCount = !isNaN(parsedP as number) && parsedP !== null ? parsedP : pres.length;
      const finalTotal = fullList.length || (finalPresCount + finalAbsCount);

      return {
        studentsWithStatus: fullList,
        absentStudents: abs,
        presentStudents: pres,
        totalCount: finalTotal,
        presentCount: finalPresCount,
        absentCount: finalAbsCount,
      };
    }

    // 3. Neither local records nor URL data
    const pendingList = students.map(s => ({
      ...s,
      status: 'pending' as const,
      isAbsent: true,
      isPresent: false,
    }));
    return {
      studentsWithStatus: pendingList,
      absentStudents: pendingList,
      presentStudents: [],
      totalCount: pendingList.length,
      presentCount: 0,
      absentCount: pendingList.length,
    };
  }, [classRecords, students, recordMap, hasTakenAttendanceToday, hasUrlAttendanceData, urlAbsentees, urlPresentCountParam, urlAbsentCountParam]);

  const attendancePercent = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const displayedList = docFilter === 'all' 
    ? studentsWithStatus 
    : docFilter === 'present' 
    ? presentStudents 
    : absentStudents;

  // Generate robust shareable URL for teacher using qrHelper
  const absentRolls = absentStudents.map(s => s.last4Digits || s.rollNo);
  const absenteePayload = absentStudents.map(s => ({
    name: s.name,
    rollNo: s.rollNo,
    last4Digits: s.last4Digits || (s.rollNo.slice(-4) || '----'),
  }));

  const teacherDocUrl = buildTeacherDocUrl({
    classId: currentClass.id,
    className: currentClass.name,
    teacherName: currentClass.teacherName,
    room: currentClass.room,
    date: selectedDate,
    presentCount,
    absentCount,
    absentRolls,
    absentees: absenteePayload,
  });

  const publicBaseUrl = getCleanPublicBaseUrl();
  const directServerReportUrl = `${publicBaseUrl}/report?classId=${encodeURIComponent(currentClass.id)}&date=${encodeURIComponent(selectedDate)}&p=${presentCount}&a=${absentCount}&abs=${encodeURIComponent(absentRolls.join(','))}`;

  // Generate QR Code with high error correction and crisp contrast
  useEffect(() => {
    QRCode.toDataURL(teacherDocUrl, {
      width: 360,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.error('Error generating Absentee QR Code:', err));
  }, [teacherDocUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(teacherDocUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSaveCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    saveCustomBaseUrl(customUrlInput);
    setUrlSaveSuccess(true);
    setTimeout(() => setUrlSaveSuccess(false), 2000);
  };

  const handleCopyAbsenteeText = () => {
    const targetList = displayedList;
    const label = docFilter === 'all' ? 'FULL ROSTER' : docFilter === 'present' ? 'PRESENT STUDENTS' : 'ABSENTEE LIST';

    const lines = [
      `📋 ${label} - ${displayClassName.toUpperCase()}`,
      `Date: ${selectedDate} | Time: ${displayTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      `Faculty: ${currentClass.teacherName} | Room: ${currentClass.room}`,
      `Total: ${totalCount} | Present: ${presentCount} | Absent: ${absentCount} (${attendancePercent}%)`,
      '',
      `--- ${label} (${targetList.length}) ---`,
      ...targetList.map((s, idx) => `${idx + 1}. [${s.last4Digits}] ${s.rollNo} - ${s.name} [${(s.status || 'ABSENT').toUpperCase()}]${s.phone ? ` (Ph: ${s.phone})` : ''}`),
      '',
      'Generated by CR Attendance Portal'
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  // If viewed as standalone by teacher (e.g. scanned from phone camera):
  if (isStandalone) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 py-4 sm:py-6 px-3 sm:px-6 font-sans">
        
        {/* Mobile-Friendly Teacher Top Bar */}
        <div className="max-w-4xl mx-auto bg-slate-900 text-white rounded-t-2xl px-4 sm:px-6 py-3 shadow-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-white">
                  Teacher Absentee Register
                </span>
                <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold border border-emerald-400/40">
                  Live View
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Official class absentee sheet for faculty verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLatestServerData}
              disabled={isLoadingServerData}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition flex items-center gap-1 border border-slate-700"
              title="Refresh attendance records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingServerData ? 'animate-spin text-blue-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleCopyAbsenteeText}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition flex items-center gap-1.5 border border-slate-700"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            {onExitStandalone && (
              <button
                onClick={onExitStandalone}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition flex items-center gap-1 border border-slate-700 ml-1"
                title="Return to CR Portal"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CR Portal</span>
              </button>
            )}
          </div>
        </div>

        {/* The Clean White Google Doc Paper Sheet */}
        <div 
          ref={printableRef}
          className="max-w-4xl mx-auto bg-white rounded-b-2xl shadow-xl p-6 sm:p-12 border border-slate-200 min-h-[780px]"
        >
          {/* Institution Heading */}
          <div className="text-center border-b-2 border-slate-800 pb-5 mb-6">
            <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-wide uppercase">
              College Department of Computer Science & Engineering
            </h2>
            <p className="text-xs text-slate-600 font-semibold tracking-wider mt-1 uppercase">
              Official Daily Class Attendance & Absentee Report
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-full text-[11px] font-bold mt-2.5 shadow-xs">
              <Lock className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Dedicated Session View for {selectedDate}</span>
            </div>
          </div>

          {/* Metadata Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs mb-6">
            <div>
              <span className="text-slate-400 block font-semibold uppercase text-[10px]">Subject / Class</span>
              <strong className="text-slate-900 text-sm">{displayClassName}</strong>
              <span className="text-slate-500 block text-[11px] font-mono">{currentClass.code}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold uppercase text-[10px]">Faculty Incharge</span>
              <strong className="text-slate-900 text-sm">{currentClass.teacherName}</strong>
              <span className="text-slate-500 block text-[11px]">Room: {currentClass.room}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold uppercase text-[10px]">Date & Time</span>
              <strong className="text-blue-700 text-sm flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{selectedDate}</span>
              </strong>
              <span className="text-slate-600 block text-[11px] font-semibold mt-0.5">
                {displayTime ? `⏰ ${displayTime}` : 'Daily Session'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-semibold uppercase text-[10px]">Attendance Stats</span>
              <strong className="text-emerald-700 text-sm">{presentCount} Present</strong>
              <span className="text-rose-600 block font-bold text-[11px]">{absentCount} Absent ({attendancePercent}%)</span>
            </div>
          </div>

          {/* Section: Students Table with Filter Selector */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full inline-block ${
                  docFilter === 'present' ? 'bg-emerald-600' : docFilter === 'all' ? 'bg-blue-600' : 'bg-rose-600'
                }`} />
                <span>
                  {docFilter === 'all' 
                    ? `All Enrolled Students (${totalCount})` 
                    : docFilter === 'present' 
                    ? `Present Students (${presentCount})` 
                    : `Absent Students (${absentCount})`}
                </span>
              </h3>

              {/* View Switcher Tabs */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setDocFilter('absent')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    docFilter === 'absent'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-700 hover:text-rose-900'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-300" />
                  <span>Only Absentees ({absentCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDocFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    docFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Students ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setDocFilter('present')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    docFilter === 'present'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-800 hover:text-emerald-950'
                  }`}
                >
                  Present Only ({presentCount})
                </button>
              </div>
            </div>

            {!hasTakenAttendanceToday && docFilter === 'absent' && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium flex items-center gap-2">
                <span className="font-bold">ℹ️ Notice:</span>
                <span>Attendance has not been recorded yet for today&apos;s session. Enrolled students are listed below pending roll call.</span>
              </div>
            )}

            {displayedList.length > 0 ? (
              <div className="border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3 w-28 font-mono">Roll No</th>
                      <th className="py-2.5 px-3 w-24 text-center">Last 4 Code</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3 hidden sm:table-cell">Batch</th>
                      <th className="py-2.5 px-3 w-28 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {displayedList.map((student: any, idx) => (
                      <tr key={student.id || idx} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono font-semibold">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                          {student.rollNo}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] border ${
                            student.status === 'present'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : student.status === 'onduty' || student.status === 'late'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {student.last4Digits}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                              student.status === 'present' 
                                ? 'bg-emerald-600' 
                                : student.status === 'onduty' || student.status === 'late'
                                ? 'bg-amber-600'
                                : 'bg-rose-600'
                            }`}>
                              {(student.name || 'S').charAt(0).toUpperCase()}
                            </span>
                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                              {student.name || (student.last4Digits ? `Student (${student.last4Digits})` : student.rollNo || 'Student')}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-500 hidden sm:table-cell">
                          {student.batch || 'Batch 2026'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`font-bold px-2 py-0.5 rounded text-[11px] border ${
                            student.status === 'present'
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : student.status === 'onduty' || student.status === 'late'
                              ? 'text-amber-700 bg-amber-50 border-amber-200'
                              : student.status === 'pending'
                              ? 'text-slate-600 bg-slate-100 border-slate-300'
                              : 'text-rose-700 bg-rose-50 border-rose-200'
                          }`}>
                            {student.status === 'onduty' || student.status === 'late' ? 'ON DUTY' : (student.status || 'ABSENT').toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center bg-emerald-50 border border-emerald-200 rounded-2xl">
                <Sparkles className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <h4 className="font-bold text-emerald-900 text-base">Full Class Attendance!</h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  All {totalCount} students attended today&apos;s lecture. Zero absentees recorded.
                </p>
              </div>
            )}
          </div>

          {/* Signatures Footer */}
          <div className="mt-16 pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <div className="h-10 border-b border-dashed border-slate-400 mb-2" />
              <p className="font-bold text-slate-800">Class Representative (CR) Signature</p>
              <p className="text-[11px] text-slate-500">Attendance Recorded via 4-Digit Keypad Portal</p>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-slate-400 mb-2" />
              <p className="font-bold text-slate-800">Faculty In-Charge / Professor Signature</p>
              <p className="text-[11px] text-slate-500">{currentClass.teacherName}</p>
            </div>
          </div>

          <div className="mt-10 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
            Official Attendance Record Generated via CR Portal • Timestamp: {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    );
  }

  // Regular Page View inside CR App
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3 border border-blue-400/30">
            <QrCode className="w-3.5 h-3.5 text-amber-300" />
            <span>Dedicated Professor / Teacher QR Scanner</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Teacher Absentee QR Portal (G-Docs View)
          </h1>
          <p className="mt-2 text-slate-300 text-xs sm:text-sm leading-relaxed">
            When your teacher asks for attendance, simply display this QR Code. When scanned by any smartphone camera, it opens a clean, official Google-Docs style Absentee Report showing today&apos;s absentees instantly — no login or account required!
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleCopyLink}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
          </button>
          <a
            href={teacherDocUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open G-Doc in New Tab</span>
          </a>
        </div>
      </div>

      {/* Control Bar: Switch Subject & Date */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Select Class / Subject:
            </label>
            <select
              value={currentClass.id}
              onChange={(e) => {
                setActiveClassId(e.target.value);
                onSelectClass(e.target.value);
              }}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code}) - {c.teacherName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Session Date:
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedDate(getTodayDateString())}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition ${
                    selectedDate === getTodayDateString()
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Today
                </button>
              </div>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {recordedDatesForCurrentClass.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className="text-[10px] text-slate-400 font-semibold">Taken on:</span>
                {recordedDatesForCurrentClass.slice(0, 5).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition ${
                      selectedDate === d
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowUrlSettings(!showUrlSettings)}
            className="self-end px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            title="Configure QR Target URL Domain"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>QR URL Settings</span>
          </button>
        </div>

        {/* Fast Counts */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-500 block">Today&apos;s Status:</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-700 text-sm">{presentCount} Present</span>
              <span className="text-slate-300">•</span>
              <span className="font-bold text-rose-600 text-sm">{absentCount} Absent</span>
            </div>
          </div>
        </div>
      </div>

      {/* QR URL Settings Panel (Expandable) */}
      {showUrlSettings && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <h4 className="font-bold text-sm text-white">QR Code Scanner Target Configuration</h4>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
              Auto 404 Prevention Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Private dev domains (<code className="text-amber-300 font-mono">ais-dev-*</code>) require developer login cookies and show a 404 error when scanned by external phones. This QR code automatically routes to the public shared cloud URL (<code className="text-emerald-300 font-mono">ais-pre-*</code>) so all teachers can scan it without login!
          </p>

          <form onSubmit={handleSaveCustomUrl} className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[280px]">
              <input
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder={publicBaseUrl}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition"
            >
              {urlSaveSuccess ? 'Saved!' : 'Save Custom Base URL'}
            </button>
            {customUrlInput && (
              <button
                type="button"
                onClick={() => {
                  setCustomUrlInput('');
                  saveCustomBaseUrl('');
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition"
              >
                Reset to Default Cloud URL
              </button>
            )}
          </form>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2">
            <span>Current Active Base:</span>
            <span className="font-mono text-emerald-400 font-semibold">{publicBaseUrl}</span>
          </div>
        </div>
      )}

      {/* Main 2-Column Layout: QR Code on Left, Live G-Docs Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Giant QR Code Card (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-4 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Public Scanner Ready (No 404)</span>
          </div>

          <h3 className="font-extrabold text-slate-900 text-lg mb-1">
            Show to Professor
          </h3>
          <p className="text-xs text-slate-500 mb-4 max-w-xs">
            Open camera on iPhone/Android and point at this code to view today&apos;s absentee list instantly.
          </p>

          {/* QR Code Container - Pure White High Contrast Card for Instant Camera Detection */}
          <div className="p-4 sm:p-5 bg-white rounded-3xl border-2 border-slate-200 shadow-xl mb-4 inline-block">
            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt="Teacher Absentee QR Code"
                className="w-56 h-56 rounded-xl block mx-auto"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                Generating High-Contrast QR...
              </div>
            )}
          </div>

          {/* Direct verification indicator */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-4 text-left">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span className="font-semibold text-slate-700">Scan Destination:</span>
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Check className="w-3 h-3" /> Public Cloud
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-600 break-all leading-relaxed">
              {teacherDocUrl}
            </p>
          </div>

          <div className="w-full space-y-2">
            <button
              onClick={() => setShowSendModal(true)}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20"
            >
              <Send className="w-4 h-4" />
              <span>Send / Copy Report to Sir</span>
            </button>
            <button
              onClick={handleCopyAbsenteeText}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-xs"
            >
              {copiedText ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedText ? 'Absentee Text Copied!' : 'Copy Absentee List as Text'}</span>
            </button>
            <button
              onClick={handleCopyLink}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition"
            >
              <Share2 className="w-4 h-4" />
              <span>Share QR Web Link</span>
            </button>
            <a
              href={directServerReportUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2 px-3 text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center justify-center gap-1 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Direct Fast HTML Report</span>
            </a>
          </div>
        </div>

        {/* Right Column: Live Google Docs Preview (8 cols) */}
        <div className="lg:col-span-8 bg-slate-200/80 rounded-3xl p-4 sm:p-6 border border-slate-300/80 flex flex-col">
          <div className="flex items-center justify-between mb-3 text-xs text-slate-600 font-semibold px-1">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Interactive Google-Docs Style Document Preview</span>
            </span>
            <span className="text-[11px] text-slate-500">What the teacher sees on their screen</span>
          </div>

          {/* Document Sheet */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-300/60 p-6 sm:p-8 flex-1 overflow-x-auto">
            {/* Institution Heading */}
            <div className="text-center border-b-2 border-slate-900 pb-4 mb-5">
              <h4 className="text-base sm:text-lg font-black text-slate-900 tracking-wide uppercase">
                College Attendance • Absentee Notification
              </h4>
              <p className="text-[11px] text-slate-600 font-semibold uppercase tracking-wider mt-0.5">
                {displayClassName} ({currentClass.code}) • Faculty: {currentClass.teacherName}
              </p>
            </div>

            {/* Summary Row */}
            <div className="flex flex-wrap items-center justify-between text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl mb-5 gap-2">
              <span>Date: <strong>{selectedDate}</strong> {displayTime ? `(${displayTime})` : ''}</span>
              <span>Total: <strong>{totalCount}</strong></span>
              <span className="text-emerald-700 font-bold">Present: {presentCount}</span>
              <span className="text-rose-600 font-bold">Absent: {absentCount} ({attendancePercent}%)</span>
            </div>

            {/* Absentee List Table Header & Tab Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h5 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  docFilter === 'present' ? 'bg-emerald-600' : docFilter === 'all' ? 'bg-blue-600' : 'bg-rose-600'
                }`} />
                <span>
                  {docFilter === 'all' 
                    ? `All Enrolled Students (${totalCount})` 
                    : docFilter === 'present' 
                    ? `Present Students (${presentCount})` 
                    : `Absent Students (${absentCount})`}
                </span>
              </h5>

              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDocFilter('absent')}
                  className={`px-2.5 py-1 rounded-md font-bold transition ${
                    docFilter === 'absent'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-700 hover:text-rose-900'
                  }`}
                >
                  Only Absentees ({absentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setDocFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-bold transition ${
                    docFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setDocFilter('present')}
                  className={`px-2.5 py-1 rounded-md font-bold transition ${
                    docFilter === 'present'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-800 hover:text-emerald-950'
                  }`}
                >
                  Present ({presentCount})
                </button>
              </div>
            </div>

            {displayedList.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3">Roll No</th>
                      <th className="py-2 px-3 text-center">Last 4 Digits</th>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedList.map((s: any, idx) => (
                      <tr key={s.id || idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-3 font-mono font-bold text-slate-800">
                          {s.rollNo}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[11px] ${
                            s.status === 'present' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : s.status === 'late' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {s.last4Digits}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 font-semibold text-slate-900">
                          {s.name || (s.last4Digits ? `Student (${s.last4Digits})` : s.rollNo || 'Student')}
                        </td>
                        <td className="py-1.5 px-3 text-center font-bold text-[10px]">
                          <span className={`px-2 py-0.5 rounded ${
                            s.status === 'present'
                              ? 'text-emerald-700 bg-emerald-50'
                              : s.status === 'late'
                              ? 'text-amber-700 bg-amber-50'
                              : s.status === 'pending'
                              ? 'text-slate-600 bg-slate-100'
                              : 'text-rose-600 bg-rose-50'
                          }`}>
                            {(s.status || 'ABSENT').toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs mb-6">
                <strong>No absentees!</strong> All students marked present.
              </div>
            )}

            {/* Signature row */}
            <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-6 text-[11px] text-slate-600 text-center">
              <div>
                <div className="h-6 border-b border-dashed border-slate-300 mb-1" />
                <span>Class Representative (CR)</span>
              </div>
              <div>
                <div className="h-6 border-b border-dashed border-slate-300 mb-1" />
                <span>Faculty / Professor</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Send Report to Sir Modal */}
      <SendReportToSirModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        currentClass={currentClass}
        date={selectedDate}
        students={students}
        allRecords={allRecords}
        reportUrl={teacherDocUrl}
      />

    </div>
  );
};
