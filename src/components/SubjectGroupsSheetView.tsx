import React, { useState, useMemo } from 'react';
import { Student, ClassSubject, AssignmentGroup, WeeklySyncSettings } from '../types';
import { sortStudentsByLast4Digits } from '../utils/storage';
import { 
  Table2, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Users, 
  BookOpen, 
  Sparkles, 
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface SubjectGroupsSheetViewProps {
  students: Student[];
  classes: ClassSubject[];
  activeClassId: string;
  groups: AssignmentGroup[];
  settings: WeeklySyncSettings;
}

export const SubjectGroupsSheetView: React.FC<SubjectGroupsSheetViewProps> = ({
  students,
  classes,
  activeClassId,
  groups,
  settings
}) => {
  const sortedStudents = useMemo(() => sortStudentsByLast4Digits(students), [students]);

  // Selected subject for the group sheet view
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(activeClassId || (classes[0]?.id || ''));
  const [copiedTsv, setCopiedTsv] = useState(false);

  const activeSubject = classes.find(c => c.id === selectedSubjectId) || classes[0] || {
    id: 'cls-default',
    name: 'Class Subject',
    code: 'CS101',
    teacherName: 'Faculty',
    color: '#2563eb'
  };

  // Groups for selected subject sorted by group number
  const subjectGroups = useMemo(() => {
    return groups
      .filter(g => g.subjectId === activeSubject.id)
      .sort((a, b) => a.groupNumber - b.groupNumber);
  }, [groups, activeSubject.id]);

  // Unassigned students in this subject
  const assignedIds = useMemo(() => {
    const set = new Set<string>();
    subjectGroups.forEach(g => g.memberStudentIds.forEach(id => set.add(id)));
    return set;
  }, [subjectGroups]);

  const unassignedCount = sortedStudents.length - assignedIds.size;

  // Format TSV for direct Google Sheets paste
  const generateGoogleSheetsTsv = () => {
    const headers = ['Group #', 'Group Name', 'Assignment Topic', 'Members Count', 'Roll Numbers', 'Student Names', 'Status', 'Date', 'Notes'];
    const rows = subjectGroups.map(grp => {
      const members = grp.memberStudentIds
        .map(id => sortedStudents.find(s => s.id === id))
        .filter(Boolean) as Student[];

      const rollNumsStr = members.map(m => `${m.last4Digits} (${m.rollNo})`).join(', ');
      const namesStr = members.map(m => m.name).join(', ');
      const statusStr = grp.presentationStatus === 'completed'
        ? 'Completed'
        : grp.presentationStatus === 'rescheduled'
        ? `Rescheduled (${grp.rescheduledDate || 'Next Class'})`
        : 'Pending';

      return [
        grp.groupNumber,
        grp.groupName,
        grp.topic || '-',
        members.length,
        rollNumsStr,
        namesStr,
        statusStr,
        grp.targetDate || '-',
        grp.notes || '-'
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join('\t');
    });

    return [headers.join('\t'), ...rows].join('\n');
  };

  const handleCopyForSheets = () => {
    const tsv = generateGoogleSheetsTsv();
    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedTsv(true);
      setTimeout(() => setCopiedTsv(false), 2500);
    });
  };

  const handleDownloadCsv = () => {
    const headers = ['Group #', 'Group Name', 'Assignment Topic', 'Members Count', 'Roll Numbers', 'Student Names', 'Status', 'Date', 'Notes'];
    const rows = subjectGroups.map(grp => {
      const members = grp.memberStudentIds
        .map(id => sortedStudents.find(s => s.id === id))
        .filter(Boolean) as Student[];

      const rollNumsStr = members.map(m => `${m.last4Digits} (${m.rollNo})`).join(', ');
      const namesStr = members.map(m => m.name).join(', ');
      const statusStr = grp.presentationStatus === 'completed'
        ? 'Completed'
        : grp.presentationStatus === 'rescheduled'
        ? `Rescheduled (${grp.rescheduledDate || 'Next Class'})`
        : 'Pending';

      return [
        grp.groupNumber,
        grp.groupName,
        grp.topic || '-',
        members.length,
        rollNumsStr,
        namesStr,
        statusStr,
        grp.targetDate || '-',
        grp.notes || '-'
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeSubject.name.replace(/\s+/g, '_')}_Groups_Sheet.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Subject-Wise Separate Tabs Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 block">
              G-Sheet Groups Matrix
            </span>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Subject-Wise Assignment Groups Sheet
            </h3>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyForSheets}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm shadow-emerald-500/20"
              title="Copy table formatted for Google Sheets (paste into cell A1)"
            >
              {copiedTsv ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied for Sheets!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy for Google Sheets</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadCsv}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Download CSV spreadsheet file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            {settings.googleSheetUrl && (
              <a
                href={settings.googleSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-200"
              >
                <span>Open G-Sheet</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Subject Separate Pages Tabs (Press subject to view its group sheet) */}
        <div className="mt-3 flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
          {classes.map(cls => {
            const isSelected = cls.id === activeSubject.id;
            const count = groups.filter(g => g.subjectId === cls.id).length;

            return (
              <button
                key={cls.id}
                onClick={() => setSelectedSubjectId(cls.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border shrink-0 ${
                  isSelected
                    ? 'bg-emerald-950 text-white border-emerald-950 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: cls.color || '#10b981' }}
                />
                <span>{cls.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${
                  isSelected ? 'bg-emerald-800 text-emerald-200' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count} Groups
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick summary stats */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Subject Sheet Tab: <strong className="text-slate-900 font-mono">[{activeSubject.name} - Groups]</strong>
          </div>
          <div className="flex items-center space-x-3">
            <span>Total Groups: <strong className="text-slate-900">{subjectGroups.length}</strong></span>
            <span>•</span>
            <span>Assigned Students: <strong className="text-emerald-700 font-bold">{assignedIds.size}</strong></span>
            {unassignedCount > 0 && (
              <>
                <span>•</span>
                <span className="text-amber-700 font-semibold">{unassignedCount} Unassigned</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Spreadsheet View */}
      {subjectGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            No Groups Created Yet for {activeSubject.name}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            Create groups for this subject in the Groups page. They will automatically format here into a clean Google Sheet table ready to export.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          {/* Google Sheets Simulated Header Bar */}
          <div className="bg-emerald-800 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>Google Sheets View: {activeSubject.name} (Groups Matrix)</span>
            </div>
            <span className="text-[11px] text-emerald-200 font-mono">
              Columns: A to I • {subjectGroups.length} Rows
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-mono text-[11px]">
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-12 text-slate-400">#</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-bold">A: Group #</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-bold">B: Group Name</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-bold">C: Assignment Topic</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-bold text-center">D: Size</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-bold">E: Roll Numbers (Last 4)</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-bold">F: Student Names</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 font-bold">G: Status</th>
                  <th className="py-2.5 px-3 font-bold">H: Presentation Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjectGroups.map((group, idx) => {
                  const members = group.memberStudentIds
                    .map(id => sortedStudents.find(s => s.id === id))
                    .filter(Boolean) as Student[];

                  const isDone = group.presentationStatus === 'completed';
                  const isRescheduled = group.presentationStatus === 'rescheduled';

                  return (
                    <tr
                      key={group.id}
                      className={`hover:bg-slate-50/80 transition font-sans ${
                        idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                      }`}
                    >
                      {/* Row index */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono text-slate-400 text-[10px]">
                        {idx + 2}
                      </td>

                      {/* Group number */}
                      <td className="py-2.5 px-3 border-r border-slate-200 font-mono font-bold text-slate-900">
                        {group.groupNumber}
                      </td>

                      {/* Group Name */}
                      <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900 whitespace-nowrap">
                        {group.groupName}
                      </td>

                      {/* Topic */}
                      <td className="py-2.5 px-3 border-r border-slate-200 font-medium text-slate-800 max-w-xs">
                        {group.topic || <span className="text-slate-400 italic">-</span>}
                      </td>

                      {/* Member count */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-bold text-slate-700">
                        {members.length}
                      </td>

                      {/* Roll numbers (Last 4 prominent) */}
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="flex flex-wrap gap-1">
                          {members.map(m => (
                            <span
                              key={m.id}
                              className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded text-[10px] border border-blue-100"
                              title={m.rollNo}
                            >
                              {m.last4Digits}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Names */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-slate-800 font-medium max-w-sm">
                        {members.map(m => m.name).join(', ') || <span className="text-slate-400 italic">No members</span>}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Presented
                          </span>
                        ) : isRescheduled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Rescheduled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Target date */}
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {isRescheduled && group.rescheduledDate ? (
                          <span className="text-amber-700 font-bold">{group.rescheduledDate}</span>
                        ) : (
                          group.targetDate || '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
