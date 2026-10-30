import React, { useState, useMemo, useRef } from 'react';
import { Student, ClassSubject, AssignmentGroup, SubjectMaterial } from '../types';
import { sortStudentsByLast4Digits, getTodayDateString } from '../utils/storage';
import { storePdfBlob, getPdfBlob, deletePdfBlob, createPdfDownloadUrl } from '../utils/pdfStorage';
import { 
  Users, 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Check, 
  Download, 
  Eye, 
  UploadCloud, 
  Sparkles, 
  Share2, 
  Calendar, 
  Search, 
  AlertCircle, 
  X, 
  Clock, 
  CheckCircle2, 
  Star,
  BookOpen,
  Filter,
  GraduationCap,
  ChevronRight,
  Mail
} from 'lucide-react';

interface GroupsPageProps {
  students: Student[];
  classes: ClassSubject[];
  activeClassId: string;
  groups: AssignmentGroup[];
  materials: SubjectMaterial[];
  onSaveGroup: (group: AssignmentGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onSaveMaterial: (material: SubjectMaterial) => void;
  onDeleteMaterial: (materialId: string) => void;
  onBulkSaveGroups?: (groups: AssignmentGroup[]) => void;
}

export const GroupsPage: React.FC<GroupsPageProps> = ({
  students,
  classes,
  activeClassId,
  groups,
  materials,
  onSaveGroup,
  onDeleteGroup,
  onSaveMaterial,
  onDeleteMaterial,
}) => {
  // Always sort students in ascending order based on last 4 digits
  const sortedStudents = useMemo(() => sortStudentsByLast4Digits(students), [students]);

  // Selected subject
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(activeClassId || (classes[0]?.id || ''));
  const activeSubject = classes.find(c => c.id === selectedSubjectId) || classes[0] || {
    id: 'cls-default',
    name: 'Class Subject',
    code: 'CS101',
    teacherName: 'Faculty Incharge',
    color: '#2563eb',
    room: 'Main Hall'
  };

  // Groups for current subject
  const subjectGroups = useMemo(() => {
    return groups
      .filter(g => g.subjectId === activeSubject.id)
      .sort((a, b) => a.groupNumber - b.groupNumber);
  }, [groups, activeSubject.id]);

  // Materials / PDFs for current subject
  const subjectMaterials = useMemo(() => {
    return materials
      .filter(m => m.subjectId === activeSubject.id)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }, [materials, activeSubject.id]);

  // Assigned student IDs for this subject
  const assignedStudentIds = useMemo(() => {
    const set = new Set<string>();
    subjectGroups.forEach(g => {
      g.memberStudentIds.forEach(id => set.add(id));
    });
    return set;
  }, [subjectGroups]);

  const unassignedStudents = useMemo(() => {
    return sortedStudents.filter(s => !assignedStudentIds.has(s.id));
  }, [sortedStudents, assignedStudentIds]);

  // Active section tab: 'groups' or 'materials'
  const [activeSection, setActiveSection] = useState<'groups' | 'materials'>('groups');

  // Search filter
  const [groupSearchQuery, setGroupSearchQuery] = useState('');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AssignmentGroup | null>(null);
  const [isAutoGenerateOpen, setIsAutoGenerateOpen] = useState(false);
  const [isUploadPdfOpen, setIsUploadPdfOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState<string>('');

  // Group Form State
  const [groupNumber, setGroupNumber] = useState<number>(1);
  const [groupName, setGroupName] = useState<string>('');
  const [groupTopic, setGroupTopic] = useState<string>('');
  const [groupLeaderId, setGroupLeaderId] = useState<string>('');
  const [groupSemester, setGroupSemester] = useState<string>('Full Semester / Academic Year');
  const [groupTargetDate, setGroupTargetDate] = useState<string>('');
  const [groupNotes, setGroupNotes] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');

  // Auto-generate state
  const [autoGroupSize, setAutoGroupSize] = useState<number>(4);
  const [autoGenerationMode, setAutoGenerationMode] = useState<'all' | 'unassigned'>('all');
  const [autoShuffleOrder, setAutoShuffleOrder] = useState<'roll-order' | 'random'>('roll-order');

  // PDF Upload State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfTitle, setPdfTitle] = useState<string>('');
  const [pdfNotes, setPdfNotes] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy feedbacks
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
  const [copiedMaterialId, setCopiedMaterialId] = useState<string | null>(null);

  // Open Create Group Modal
  const handleOpenCreateModal = () => {
    setEditingGroup(null);
    const nextGroupNum = subjectGroups.length > 0 
      ? Math.max(...subjectGroups.map(g => g.groupNumber)) + 1 
      : 1;
    setGroupNumber(nextGroupNum);
    setGroupName(`Group ${nextGroupNum}`);
    setGroupTopic('');
    setGroupLeaderId('');
    setGroupSemester('Full Semester / Academic Year');
    setGroupTargetDate('');
    setGroupNotes('');
    setSelectedMemberIds([]);
    setMemberSearchQuery('');
    setIsCreateModalOpen(true);
  };

  // Open Edit Group Modal
  const handleOpenEditModal = (group: AssignmentGroup) => {
    setEditingGroup(group);
    setGroupNumber(group.groupNumber);
    setGroupName(group.groupName);
    setGroupTopic(group.topic || '');
    setGroupLeaderId(group.leaderStudentId || '');
    setGroupSemester(group.semester || 'Full Semester / Academic Year');
    setGroupTargetDate(group.targetDate || '');
    setGroupNotes(group.notes || '');
    setSelectedMemberIds([...group.memberStudentIds]);
    setMemberSearchQuery('');
    setIsCreateModalOpen(true);
  };

  // Toggle member selection in create/edit modal
  const handleToggleMember = (studentId: string) => {
    setSelectedMemberIds(prev => {
      if (prev.includes(studentId)) {
        const next = prev.filter(id => id !== studentId);
        if (groupLeaderId === studentId) setGroupLeaderId('');
        return next;
      } else {
        return [...prev, studentId];
      }
    });
  };

  // Save Group (Create or Edit)
  const handleSaveGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    // Sort member student IDs ascending by last 4 digits
    const sortedMemberIds = [...selectedMemberIds].sort((aId, bId) => {
      const stA = sortedStudents.find(s => s.id === aId);
      const stB = sortedStudents.find(s => s.id === bId);
      if (!stA || !stB) return 0;
      const numA = parseInt(stA.last4Digits || '0', 10);
      const numB = parseInt(stB.last4Digits || '0', 10);
      return numA - numB;
    });

    const groupToSave: AssignmentGroup = {
      id: editingGroup ? editingGroup.id : `grp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      subjectId: activeSubject.id,
      groupNumber: Number(groupNumber) || 1,
      groupName: groupName.trim(),
      topic: groupTopic.trim(),
      leaderStudentId: groupLeaderId || undefined,
      semester: groupSemester.trim() || 'Full Semester / Academic Year',
      memberStudentIds: sortedMemberIds,
      targetDate: groupTargetDate || undefined,
      presentationStatus: editingGroup?.presentationStatus || 'pending',
      rescheduledDate: editingGroup?.rescheduledDate,
      notes: groupNotes.trim(),
      createdAt: editingGroup ? editingGroup.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveGroup(groupToSave);
    setIsCreateModalOpen(false);
  };

  // Auto Generate Semester Groups
  const handleExecuteAutoGenerate = () => {
    const pool = autoGenerationMode === 'unassigned' ? [...unassignedStudents] : [...sortedStudents];
    if (pool.length === 0) {
      alert('No students available in the selected pool.');
      return;
    }

    let workingPool = [...pool];
    if (autoShuffleOrder === 'random') {
      workingPool = workingPool.sort(() => Math.random() - 0.5);
    } else {
      workingPool = sortStudentsByLast4Digits(workingPool);
    }

    const size = Math.max(1, autoGroupSize);
    const startGroupNum = autoGenerationMode === 'unassigned' && subjectGroups.length > 0
      ? Math.max(...subjectGroups.map(g => g.groupNumber)) + 1
      : 1;

    const newGroups: AssignmentGroup[] = [];
    let groupIndex = 0;

    for (let i = 0; i < workingPool.length; i += size) {
      const slice = workingPool.slice(i, i + size);
      const sortedMemberIds = sortStudentsByLast4Digits(slice).map(s => s.id);
      const gNum = startGroupNum + groupIndex;

      newGroups.push({
        id: `grp-${Date.now()}-${groupIndex}-${Math.random().toString(36).substring(2, 6)}`,
        subjectId: activeSubject.id,
        groupNumber: gNum,
        groupName: `Group ${gNum}`,
        topic: '',
        semester: 'Full Semester / Academic Year',
        leaderStudentId: sortedMemberIds[0], // First roll number as default lead
        memberStudentIds: sortedMemberIds,
        presentationStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      groupIndex++;
    }

    if (autoGenerationMode === 'all') {
      subjectGroups.forEach(g => onDeleteGroup(g.id));
      newGroups.forEach(g => onSaveGroup(g));
    } else {
      newGroups.forEach(g => onSaveGroup(g));
    }

    setIsAutoGenerateOpen(false);
  };

  // Copy Group Info for WhatsApp
  const handleCopyGroupWhatsApp = (group: AssignmentGroup) => {
    const memberStudents = group.memberStudentIds
      .map(id => sortedStudents.find(s => s.id === id))
      .filter(Boolean) as Student[];

    const leadStudent = sortedStudents.find(s => s.id === group.leaderStudentId);

    const memberListStr = memberStudents.length > 0
      ? memberStudents.map((s, idx) => {
          const isLead = s.id === group.leaderStudentId;
          return `  ${idx + 1}. [${s.last4Digits}] ${s.name} (${s.rollNo})${isLead ? ' ★ Lead' : ''}`;
        }).join('\n')
      : '  (No members assigned)';

    const text = `📌 *${activeSubject.name} (${activeSubject.code})*\n` +
      `👥 *${group.groupName}* (Semester Standing Group • ${memberStudents.length} Members)\n` +
      (group.topic ? `📖 *Project / Topic:* ${group.topic}\n` : '') +
      (leadStudent ? `👤 *Team Lead:* ${leadStudent.name} (${leadStudent.last4Digits})\n` : '') +
      (group.targetDate ? `📅 *Presentation / Milestone Date:* ${group.targetDate}\n` : '') +
      `\n*Members:*\n${memberListStr}\n\n` +
      (group.notes ? `📝 *Notes:* ${group.notes}\n\n` : '') +
      `_Official Semester Standing Groups • CR Portal_`;

    navigator.clipboard.writeText(text);
    setCopiedGroupId(group.id);
    setTimeout(() => setCopiedGroupId(null), 2500);
  };

  // PDF File Selection
  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFile(file);
      if (!pdfTitle) {
        setPdfTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    }
  };

  // PDF Upload Submit
  const handleUploadPdfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) {
      setUploadError('Please select a PDF document');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const materialId = `mat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await storePdfBlob(materialId, pdfFile);

      const material: SubjectMaterial = {
        id: materialId,
        subjectId: activeSubject.id,
        title: pdfTitle.trim() || pdfFile.name,
        fileName: pdfFile.name,
        fileSize: pdfFile.size,
        fileType: pdfFile.type || 'application/pdf',
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'CR',
        notes: pdfNotes.trim(),
        storageKey: materialId
      };

      onSaveMaterial(material);
      setIsUploadPdfOpen(false);
      setPdfFile(null);
      setPdfTitle('');
      setPdfNotes('');
    } catch (err: any) {
      console.error('PDF upload error:', err);
      setUploadError('Failed to save PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  };

  // View PDF
  const handleViewPdf = async (material: SubjectMaterial) => {
    try {
      const url = await createPdfDownloadUrl(material.id);
      if (url) {
        setPreviewPdfUrl(url);
        setPreviewPdfTitle(material.title || material.fileName);
      } else {
        alert('Could not open PDF file.');
      }
    } catch (err) {
      console.error(err);
      alert('Error opening PDF viewer');
    }
  };

  // Download PDF
  const handleDownloadPdf = async (material: SubjectMaterial) => {
    try {
      const url = await createPdfDownloadUrl(material.id);
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = material.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert('Could not download PDF file.');
      }
    } catch (err) {
      console.error(err);
      alert('Error downloading PDF file');
    }
  };

  // Delete PDF Material
  const handleDeletePdf = async (material: SubjectMaterial) => {
    if (window.confirm(`Delete "${material.title}"?`)) {
      await deletePdfBlob(material.id);
      onDeleteMaterial(material.id);
    }
  };

  // Copy PDF Notice for WhatsApp
  const handleCopyPdfWhatsApp = (material: SubjectMaterial) => {
    const sizeStr = (material.fileSize / (1024 * 1024)).toFixed(2) + ' MB';
    const text = `📚 *${activeSubject.name} (${activeSubject.code})*\n` +
      `📄 *Study Material / PDF from Professor*\n` +
      `*Title:* ${material.title}\n` +
      `*File:* ${material.fileName} (${sizeStr})\n` +
      (activeSubject.teacherName ? `*Faculty:* ${activeSubject.teacherName}\n` : '') +
      (material.notes ? `📝 *Instructions / Notes:* ${material.notes}\n` : '') +
      `\n_Saved in CR Portal. Please check and download the attachment!_`;

    navigator.clipboard.writeText(text);
    setCopiedMaterialId(material.id);
    setTimeout(() => setCopiedMaterialId(null), 2500);
  };

  // Filtered groups by search
  const filteredGroups = useMemo(() => {
    if (!groupSearchQuery.trim()) return subjectGroups;
    const q = groupSearchQuery.toLowerCase().trim();
    return subjectGroups.filter(g => {
      const matchesName = g.groupName.toLowerCase().includes(q);
      const matchesTopic = (g.topic || '').toLowerCase().includes(q);
      const matchesMember = g.memberStudentIds.some(id => {
        const s = sortedStudents.find(st => st.id === id);
        return s && (s.name.toLowerCase().includes(q) || s.last4Digits.includes(q) || s.rollNo.toLowerCase().includes(q));
      });
      return matchesName || matchesTopic || matchesMember;
    });
  }, [subjectGroups, groupSearchQuery, sortedStudents]);

  // Filtered members in student picker
  const filteredStudentsForPicker = useMemo(() => {
    const q = memberSearchQuery.toLowerCase().trim();
    if (!q) return sortedStudents;
    return sortedStudents.filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.last4Digits.includes(q) ||
      s.rollNo.toLowerCase().includes(q)
    );
  }, [sortedStudents, memberSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Subject Selector */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 font-bold">
                <Users className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Semester Groups & Professor PDFs
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Manage standing groups for the entire semester/academic year per subject, and access all professor study PDFs in one place.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            {activeSection === 'groups' ? (
              <>
                <button
                  onClick={() => setIsAutoGenerateOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition border border-indigo-200/60"
                  title="Auto-assign students into semester groups"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Auto-Assign Groups</span>
                </button>
                <button
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm shadow-indigo-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Semester Group</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setPdfFile(null);
                  setPdfTitle('');
                  setPdfNotes('');
                  setUploadError(null);
                  setIsUploadPdfOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Professor PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* Subject Pills (Press Subject Name) */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Select Subject (Standing Semester Groups):
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {classes.length} Subject{classes.length === 1 ? '' : 's'} Configured
            </span>
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
            {classes.map(cls => {
              const isSelected = cls.id === activeSubject.id;
              const grpCount = groups.filter(g => g.subjectId === cls.id).length;
              const matCount = materials.filter(m => m.subjectId === cls.id).length;

              return (
                <button
                  key={cls.id}
                  onClick={() => setSelectedSubjectId(cls.id)}
                  className={`flex items-center space-x-2.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap border shrink-0 ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cls.color || '#6366f1' }}
                  />
                  <span>{cls.name}</span>
                  <span className={`text-[11px] px-1.5 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {cls.code}
                  </span>

                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${
                    isSelected ? 'bg-indigo-500/30 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {grpCount} Groups
                  </span>
                  {matCount > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${
                      isSelected ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {matCount} PDF
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-Header & Switcher between Groups vs PDFs */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-600">
            <span className="font-bold text-slate-900">{activeSubject.name}</span>
            {activeSubject.teacherName && (
              <span className="text-slate-500 ml-2">
                Faculty: <strong className="text-slate-800">{activeSubject.teacherName}</strong>
              </span>
            )}
            <span className="text-indigo-600 font-semibold ml-2">
              (Standing Groups for Entire Semester)
            </span>
          </div>

          {/* Section Switcher Tabs */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveSection('groups')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                activeSection === 'groups'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Semester Groups ({subjectGroups.length})</span>
            </button>
            <button
              onClick={() => setActiveSection('materials')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                activeSection === 'materials'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Sir's Study PDFs ({subjectMaterials.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: SEMESTER GROUPS */}
      {activeSection === 'groups' && (
        <div className="space-y-4">
          {/* Summary Banner & Unassigned Alert */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="text-xs text-slate-600">
                Total Class Strength: <strong className="text-slate-900">{sortedStudents.length}</strong> • Assigned: <strong className="text-indigo-600">{assignedStudentIds.size}</strong>
              </div>
            </div>

            {/* Unassigned Warning */}
            {unassignedStudents.length > 0 ? (
              <div className="flex items-center space-x-2 text-xs text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{unassignedStudents.length}</strong> student{unassignedStudents.length === 1 ? '' : 's'} not in any group for this subject
                </span>
                <button
                  onClick={() => {
                    handleOpenCreateModal();
                    setSelectedMemberIds(unassignedStudents.slice(0, 4).map(s => s.id));
                  }}
                  className="ml-2 font-bold text-indigo-600 hover:underline"
                >
                  Create Group for Them →
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All {sortedStudents.length} students are in assigned semester groups!</span>
              </div>
            )}
          </div>

          {/* Search bar if groups exist */}
          {subjectGroups.length > 0 && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={groupSearchQuery}
                onChange={e => setGroupSearchQuery(e.target.value)}
                placeholder="Search groups by group name, topic, member roll (e.g. 1042), or name..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
            </div>
          )}

          {/* Groups Grid */}
          {filteredGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                No Semester Groups Created for {activeSubject.name}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5">
                Set up your standing groups for the entire semester/year. You can split students automatically or build groups manually.
              </p>
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Group</span>
                </button>
                <button
                  onClick={() => setIsAutoGenerateOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Auto-Assign All</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.map(group => {
                const members = group.memberStudentIds
                  .map(id => sortedStudents.find(s => s.id === id))
                  .filter(Boolean) as Student[];

                const isCopied = copiedGroupId === group.id;

                return (
                  <div
                    key={group.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
                  >
                    {/* Card Content */}
                    <div className="p-4 sm:p-5">
                      {/* Top Row: Group Number & Status */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                            {group.groupNumber}
                          </span>
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                              {group.groupName}
                            </h4>
                            <span className="text-[11px] text-slate-400">
                              {group.semester || 'Full Semester'} • {members.length} Members
                            </span>
                          </div>
                        </div>

                        {/* Status */}
                        <div>
                          {group.presentationStatus === 'completed' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Presented
                            </span>
                          ) : group.presentationStatus === 'rescheduled' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                              Rescheduled
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              Active Sem Group
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Topic */}
                      {group.topic ? (
                        <div className="mt-2.5 bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                            Semester Project / Assignment Topic:
                          </span>
                          <span className="text-xs font-semibold text-slate-800 line-clamp-2">
                            {group.topic}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs italic text-slate-400">
                          (No assigned project topic yet)
                        </div>
                      )}

                      {/* Presentation Date */}
                      {group.targetDate && (
                        <div className="mt-2 flex items-center space-x-1.5 text-xs text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>Presentation / Milestone: <strong>{group.targetDate}</strong></span>
                        </div>
                      )}

                      {/* Members List (Ordered by Last 4 Digits) */}
                      <div className="mt-3.5 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Group Members (Ascending 4-Digit Roll):
                        </span>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {members.map(st => {
                            const isLead = st.id === group.leaderStudentId;
                            return (
                              <div
                                key={st.id}
                                className="flex items-center justify-between text-xs bg-slate-50 px-2 py-1 rounded-lg border border-slate-100"
                              >
                                <div className="flex items-center space-x-1.5 truncate">
                                  <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded text-[11px] shrink-0">
                                    {st.last4Digits}
                                  </span>
                                  <span className="font-semibold text-slate-800 truncate">
                                    {st.name}
                                  </span>
                                  {isLead && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold shrink-0">
                                      ★ Lead
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                                  {st.rollNo}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Notes */}
                      {group.notes && (
                        <div className="mt-2.5 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg italic">
                          "{group.notes}"
                        </div>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1">
                      <button
                        onClick={() => handleCopyGroupWhatsApp(group)}
                        title="Copy formatted group details for WhatsApp"
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition shadow-xs"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            <span>Copy for WhatsApp</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleOpenEditModal(group)}
                          title="Edit semester group details & members"
                          className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete ${group.groupName}?`)) {
                              onDeleteGroup(group.id);
                            }
                          }}
                          title="Delete group"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: PROFESSOR/SIR'S STUDY PDFS & MATERIALS */}
      {activeSection === 'materials' && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {activeSubject.name} — Professor / Sir's Study PDFs & Guidelines
                </h3>
                <p className="text-xs text-slate-500">
                  Store lecture slides, syllabus guidelines, and assignment papers so you don't have to search through folders.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setPdfFile(null);
                setPdfTitle('');
                setPdfNotes('');
                setUploadError(null);
                setIsUploadPdfOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm shrink-0"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload PDF Document</span>
            </button>
          </div>

          {subjectMaterials.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                No PDFs Stored Yet for {activeSubject.name}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-4">
                Upload the presentation guidelines or assignment questions sent by the sir.
              </p>
              <button
                onClick={() => {
                  setPdfFile(null);
                  setPdfTitle('');
                  setPdfNotes('');
                  setUploadError(null);
                  setIsUploadPdfOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload PDF</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectMaterials.map(material => {
                const isCopied = copiedMaterialId === material.id;
                const sizeMb = (material.fileSize / (1024 * 1024)).toFixed(2);

                return (
                  <div
                    key={material.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200/60 flex items-center justify-center text-red-600 font-bold shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-sm leading-tight line-clamp-1">
                              {material.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 truncate font-mono">
                              {material.fileName}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center space-x-2 text-[11px] text-slate-500">
                        <span className="bg-slate-100 px-2 py-0.5 rounded font-mono font-semibold">
                          {sizeMb} MB
                        </span>
                        <span>•</span>
                        <span>{new Date(material.uploadedAt).toLocaleDateString()}</span>
                      </div>

                      {material.notes && (
                        <div className="mt-3 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-700">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                            Professor Notes:
                          </span>
                          {material.notes}
                        </div>
                      )}
                    </div>

                    {/* Actions Footer */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1">
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleViewPdf(material)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>View</span>
                        </button>

                        <button
                          onClick={() => handleDownloadPdf(material)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Save</span>
                        </button>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleCopyPdfWhatsApp(material)}
                          title="Copy notice for WhatsApp"
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Notice</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleDeletePdf(material)}
                          title="Delete PDF"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT SEMESTER GROUP MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingGroup ? `Edit ${editingGroup.groupName}` : `Create Semester Group for ${activeSubject.name}`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Standing group for the semester • Sorted by last 4 digits
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveGroupSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Group Number:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={groupNumber}
                    onChange={e => setGroupNumber(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Group Name / Title:
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="e.g. Group 1 or Team Alpha"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Semester Topic / Project Title:
                </label>
                <input
                  type="text"
                  value={groupTopic}
                  onChange={e => setGroupTopic(e.target.value)}
                  placeholder="e.g. Distributed Systems Lab Project or Final Term Pitch"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Term / Semester:
                  </label>
                  <input
                    type="text"
                    value={groupSemester}
                    onChange={e => setGroupSemester(e.target.value)}
                    placeholder="e.g. Semester 2026 / Academic Year"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Presentation / Due Date:
                  </label>
                  <input
                    type="date"
                    value={groupTargetDate}
                    onChange={e => setGroupTargetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Member Picker */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Select Group Members ({selectedMemberIds.length} Selected):
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Sorted by Last 4 Digits
                  </span>
                </div>

                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={e => setMemberSearchQuery(e.target.value)}
                    placeholder="Search by 4 digits (e.g. 1042) or student name..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="border border-slate-200 rounded-2xl max-h-52 overflow-y-auto divide-y divide-slate-100 p-1">
                  {filteredStudentsForPicker.map(student => {
                    const isSelected = selectedMemberIds.includes(student.id);
                    const isLead = groupLeaderId === student.id;
                    const otherGroup = subjectGroups.find(
                      g => g.id !== editingGroup?.id && g.memberStudentIds.includes(student.id)
                    );

                    return (
                      <div
                        key={student.id}
                        onClick={() => handleToggleMember(student.id)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition select-none ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="font-mono font-black text-indigo-600 bg-indigo-100/60 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                            {student.last4Digits}
                          </span>
                          <span className="truncate">{student.name}</span>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0 ml-2">
                          {isSelected && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGroupLeaderId(isLead ? '' : student.id);
                              }}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition ${
                                isLead
                                  ? 'bg-amber-400 text-slate-900 shadow-xs'
                                  : 'bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-800'
                              }`}
                            >
                              {isLead ? '★ Lead' : 'Set Lead'}
                            </button>
                          )}
                          {otherGroup && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-semibold">
                              In {otherGroup.groupName}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {student.rollNo}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes / Faculty Remarks:
                </label>
                <input
                  type="text"
                  value={groupNotes}
                  onChange={e => setGroupNotes(e.target.value)}
                  placeholder="e.g. Focus on architectural diagrams; slot is 15 minutes."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm"
                >
                  {editingGroup ? 'Save Changes' : 'Save Semester Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUTO GENERATE MODAL */}
      {isAutoGenerateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Auto-Assign Semester Groups
                </h3>
              </div>
              <button
                onClick={() => setIsAutoGenerateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Create standing groups for the semester for <strong className="text-slate-900">{activeSubject.name}</strong>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Students per Group:
                </label>
                <div className="flex items-center space-x-2">
                  {[2, 3, 4, 5, 6].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setAutoGroupSize(num)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                        autoGroupSize === num
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Student Pool:
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="pool"
                      checked={autoGenerationMode === 'all'}
                      onChange={() => setAutoGenerationMode('all')}
                      className="text-indigo-600"
                    />
                    <span>Re-group all {sortedStudents.length} students for the semester</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="pool"
                      checked={autoGenerationMode === 'unassigned'}
                      onChange={() => setAutoGenerationMode('unassigned')}
                      className="text-indigo-600"
                    />
                    <span>Only group unassigned students ({unassignedStudents.length} remaining)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Arrangement Order:
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="order"
                      checked={autoShuffleOrder === 'roll-order'}
                      onChange={() => setAutoShuffleOrder('roll-order')}
                      className="text-indigo-600"
                    />
                    <span>Ascending order by last 4 digits (Sequential)</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="order"
                      checked={autoShuffleOrder === 'random'}
                      onChange={() => setAutoShuffleOrder('random')}
                      className="text-indigo-600"
                    />
                    <span>Random shuffle (Team mixing)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsAutoGenerateOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAutoGenerate}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm"
              >
                Assign Groups
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD PDF MODAL */}
      {isUploadPdfOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Upload Professor PDF
                  </h3>
                  <p className="text-xs text-slate-500">{activeSubject.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadPdfOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadPdfSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select PDF File:
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  ref={fileInputRef}
                  onChange={handlePdfFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  required
                />
                {pdfFile && (
                  <p className="text-[11px] text-emerald-600 font-medium mt-1">
                    Selected: {pdfFile.name} ({(pdfFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Document Title:
                </label>
                <input
                  type="text"
                  value={pdfTitle}
                  onChange={e => setPdfTitle(e.target.value)}
                  placeholder="e.g. Unit 3 Syllabus & Presentation Rubric"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Professor's Message / Notes (Optional):
                </label>
                <textarea
                  value={pdfNotes}
                  onChange={e => setPdfNotes(e.target.value)}
                  placeholder="e.g. Read Pages 10-24 before our next lab."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {uploadError && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  {uploadError}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsUploadPdfOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
                >
                  {isUploading ? 'Saving...' : 'Save PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF VIEWER MODAL */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col p-2 sm:p-6">
          <div className="bg-slate-900 text-white p-3 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center space-x-2 truncate">
              <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-bold text-sm truncate">{previewPdfTitle}</span>
            </div>
            <div className="flex items-center space-x-2">
              <a
                href={previewPdfUrl}
                download={previewPdfTitle.endsWith('.pdf') ? previewPdfTitle : `${previewPdfTitle}.pdf`}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewPdfUrl);
                  setPreviewPdfUrl(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-800 rounded-b-2xl overflow-hidden">
            <iframe
              src={previewPdfUrl}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
};
