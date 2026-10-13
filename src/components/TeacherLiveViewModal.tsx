import React, { useState, useMemo } from 'react';
import { Student, ClassSubject, AttendanceRecord } from '../types';
import { getWeekDateRange, sortStudentsByLast4Digits } from '../utils/storage';
import { 
  X, 
  ExternalLink, 
  CheckCircle2, 
  Table2, 
  Download, 
  Printer, 
  Share2, 
  Sparkles,
  GraduationCap
} from 'lucide-react';

interface TeacherLiveViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  currentClass: ClassSubject;
  weekNumber: number;
  allRecords: AttendanceRecord[];
}

export const TeacherLiveViewModal: React.FC<TeacherLiveViewModalProps> = ({
  isOpen,
  onClose,
  students,
  currentClass,
  weekNumber,
  allRecords
}) => {
  const { start, end, days } = getWeekDateRange(weekNumber);

  // Filter records for this class & this week
  const weekRecords = allRecords.filter(
    r => r.classId === currentClass.id && r.weekNumber === weekNumber
  );

  const [filterMode, setFilterMode] = useState<'all' | 'absent' | 'present'>('absent');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all'); // 'all' or specific dateStr
  const [copiedAbsentees, setCopiedAbsentees] = useState(false);

  const getDayRecord = (studentId: string, dateStr: string) => {
    return weekRecords.find(r => r.studentId === studentId && r.date === dateStr);
  };

  // Determine which days have records
  const daysWithRecords = days.filter(d => weekRecords.some(r => r.date === d.dateStr));
  const hasAnyRecords = weekRecords.length > 0;

  // Student classification
  const studentStatusList = useMemo(() => {
    const sorted = sortStudentsByLast4Digits(students);
    return sorted.map(student => {
      // Evaluate attendance based on selected day or whole week
      const targetDays = selectedDayFilter === 'all' 
        ? (daysWithRecords.length > 0 ? daysWithRecords : days)
        : days.filter(d => d.dateStr === selectedDayFilter);

      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;
      let unrecordedDays = 0;

      targetDays.forEach(d => {
        const rec = getDayRecord(student.id, d.dateStr);
        if (rec) {
          if (rec.status === 'present') presentDays++;
          else if (rec.status === 'late') lateDays++;
          else absentDays++;
        } else {
          // If other students have records for this day, student is absent; else unrecorded
          const dayHasAny = weekRecords.some(r => r.date === d.dateStr);
          if (dayHasAny) absentDays++;
          else unrecordedDays++;
        }
      });

      const isAbsent = absentDays > 0 || (!hasAnyRecords);
      const isPresent = presentDays > 0 || lateDays > 0;

      return {
        ...student,
        presentDays,
        absentDays,
        lateDays,
        unrecordedDays,
        isAbsent,
        isPresent,
      };
    });
  }, [students, weekRecords, selectedDayFilter, days, daysWithRecords, hasAnyRecords]);

  // Filter students based on filterMode
  const displayedStudents = useMemo(() => {
    let list = studentStatusList;
    if (filterMode === 'absent') {
      list = studentStatusList.filter(s => s.isAbsent);
    } else if (filterMode === 'present') {
      list = studentStatusList.filter(s => s.isPresent);
    }
    return list;
  }, [filterMode, studentStatusList]);

  const absentStudentsList = useMemo(() => studentStatusList.filter(s => s.isAbsent), [studentStatusList]);
  const presentStudentsList = useMemo(() => studentStatusList.filter(s => s.isPresent), [studentStatusList]);

  const handleCopyAbsenteeList = () => {
    const targetDayLabel = selectedDayFilter === 'all' ? 'Week ' + weekNumber : selectedDayFilter;
    const lines = [
      `Absentee List for ${currentClass.name} - ${targetDayLabel}`,
      `Total Enrolled: ${students.length} | Absentees: ${absentStudentsList.length}`,
      '',
      ...absentStudentsList.map((s, idx) => `${idx + 1}. [${s.last4Digits}] ${s.rollNo} - ${s.name}`)
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedAbsentees(true);
    setTimeout(() => setCopiedAbsentees(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Modal Top Header (Teacher Portal Branding) */}
        <div className="bg-emerald-800 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white text-emerald-800 flex items-center justify-center font-bold shadow-md">
              <Table2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded">
                  Teacher Attendance Portal (QR View)
                </span>
                <span className="text-xs text-emerald-200 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Synced
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold mt-0.5">
                {currentClass.name} — Week {weekNumber} Attendance Sheet
              </h2>
              <p className="text-xs text-emerald-200">
                Teacher: {currentClass.teacherName} • Dates: {start} to {end}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 text-white transition text-xs font-semibold flex items-center gap-1.5"
              title="Print Sheet"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Google Sheet Style Table */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50">
          
          <div className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden mb-4">
            
            {/* Sheet Sub-Header & Absentee View Switcher */}
            <div className="p-3 bg-emerald-50 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-700 gap-3 font-medium">
              <div className="flex items-center gap-2 flex-wrap">
                <GraduationCap className="w-4 h-4 text-emerald-700" />
                <span>Subject: <strong>{currentClass.name} ({currentClass.code})</strong></span>
                <span>•</span>
                <span>Room: <strong>{currentClass.room}</strong></span>
                
                <div className="ml-2 flex items-center gap-1.5 bg-white border border-emerald-300 rounded-lg px-2 py-0.5 text-[11px]">
                  <span className="text-slate-500 font-semibold">Scope:</span>
                  <select
                    value={selectedDayFilter}
                    onChange={(e) => setSelectedDayFilter(e.target.value)}
                    className="bg-transparent font-bold text-emerald-900 outline-none cursor-pointer"
                  >
                    <option value="all">Whole Week (Mon - Fri)</option>
                    {days.map(d => (
                      <option key={d.dateStr} value={d.dateStr}>
                        {d.dayName} ({d.dateStr})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Absentee Toggle Bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex rounded-lg bg-emerald-100/80 p-0.5 border border-emerald-300">
                  <button
                    type="button"
                    onClick={() => setFilterMode('absent')}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1.5 ${
                      filterMode === 'absent' 
                        ? 'bg-rose-600 text-white shadow-xs' 
                        : 'text-rose-700 hover:text-rose-900'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>Only Absentees ({absentStudentsList.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                      filterMode === 'all' 
                        ? 'bg-white text-emerald-950 shadow-xs' 
                        : 'text-emerald-800 hover:text-emerald-950'
                    }`}
                  >
                    All Students ({students.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('present')}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                      filterMode === 'present' 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'text-emerald-800 hover:text-emerald-950'
                    }`}
                  >
                    Present Only ({presentStudentsList.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyAbsenteeList}
                  className="px-2.5 py-1 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-[11px] font-bold rounded-lg transition"
                >
                  {copiedAbsentees ? '✓ Copied' : 'Copy Absentees'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="py-2.5 px-3 border-r border-slate-200 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">Roll Number</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 font-mono">Last 4</th>
                    <th className="py-2.5 px-3 border-r border-slate-200">Student Name</th>
                    {days.map((d) => (
                      <th key={d.dateStr} className="py-2.5 px-3 border-r border-slate-200 text-center min-w-[70px]">
                        <div>{d.dayName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{d.dateStr.slice(5)}</div>
                      </th>
                    ))}
                    <th className="py-2.5 px-3 border-r border-slate-200 text-center bg-emerald-50/50">Total P</th>
                    <th className="py-2.5 px-3 text-center bg-emerald-50/50">% Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-slate-400 font-sans">
                        No students enrolled yet. Add students in the app roster.
                      </td>
                    </tr>
                  ) : displayedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-10 text-center text-emerald-700 font-semibold bg-emerald-50/40">
                        {filterMode === 'absent' 
                          ? '🌟 100% Attendance! Zero absentees recorded for this selection.'
                          : 'No matching records found for this view.'}
                      </td>
                    </tr>
                  ) : (
                    displayedStudents.map((student, idx) => {
                    let totalPresent = 0;
                    let totalDaysWithRecord = 0;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50 transition font-mono">
                        <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-400 font-sans">
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

                        {/* Mon-Fri attendance cells */}
                        {days.map((d) => {
                          const record = getDayRecord(student.id, d.dateStr);
                          if (record) {
                            totalDaysWithRecord++;
                            if (record.status === 'present') totalPresent++;
                            if (record.status === 'onduty' || record.status === 'late') totalPresent += 1;
                          }

                          return (
                            <td key={d.dateStr} className="py-2 px-2 border-r border-slate-200 text-center">
                              {record ? (
                                <span className={`inline-block px-1.5 h-6 rounded font-bold text-xs leading-6 ${
                                  record.status === 'present'
                                    ? 'bg-emerald-600 text-white'
                                    : record.status === 'onduty' || record.status === 'late'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-rose-600 text-white'
                                }`}>
                                  {record.status === 'present' ? 'P' : (record.status === 'onduty' || record.status === 'late') ? 'OD' : 'A'}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="py-2 px-3 border-r border-slate-200 text-center font-bold text-slate-800 bg-emerald-50/30">
                          {totalPresent}
                        </td>
                        <td className="py-2 px-3 text-center font-bold bg-emerald-50/30">
                          {totalDaysWithRecord > 0 ? (
                            <span className={totalPresent / totalDaysWithRecord >= 0.75 ? 'text-emerald-700' : 'text-rose-600'}>
                              {Math.round((totalPresent / totalDaysWithRecord) * 100)}%
                            </span>
                          ) : (
                            <span className="text-slate-400">-%</span>
                          )}
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 p-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-4 h-4 bg-emerald-600 rounded text-white text-[9px] flex items-center justify-center font-bold">P</span> = Present</span>
              <span className="flex items-center gap-1"><span className="w-4 h-4 bg-rose-600 rounded text-white text-[9px] flex items-center justify-center font-bold">A</span> = Absent</span>
              <span className="flex items-center gap-1"><span className="px-1 h-4 bg-amber-500 rounded text-white text-[9px] flex items-center justify-center font-bold">OD</span> = On Duty</span>
            </div>
            <span>Auto-updates whenever CR marks attendance from the app.</span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
          >
            Close Preview
          </button>
        </div>

      </div>
    </div>
  );
};
