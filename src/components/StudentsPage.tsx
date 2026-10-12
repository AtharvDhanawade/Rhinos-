import React, { useState } from 'react';
import { Student } from '../types';
import { 
  UserPlus, 
  Search, 
  Trash2, 
  Edit3, 
  UploadCloud, 
  Download, 
  Phone, 
  Mail, 
  Hash, 
  Check, 
  X, 
  AlertCircle,
  FileSpreadsheet,
  Users,
  Upload,
  Sparkles,
  Camera,
  Copy
} from 'lucide-react';
import { extractLast4Digits, sortStudentsByLast4Digits } from '../utils/storage';
import { AIPhotoRosterScannerModal } from './AIPhotoRosterScannerModal';
import { CopyStudentsForSheetsModal } from './CopyStudentsForSheetsModal';

interface StudentsPageProps {
  students: Student[];
  onAddStudent: (student: Student) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onBulkImport: (students: Student[]) => void;
}

const AVATAR_PALETTE = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-cyan-500', 'bg-fuchsia-500'
];

export const StudentsPage: React.FC<StudentsPageProps> = ({
  students,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onBulkImport
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState('ALL');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isPhotoScanModalOpen, setIsPhotoScanModalOpen] = useState(false);
  const [isCopySheetModalOpen, setIsCopySheetModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    rollNo: string;
    phone: string;
    email: string;
    batch: string;
    notes: string;
  }>({
    name: '',
    rollNo: '',
    phone: '',
    email: '',
    batch: 'Section A - CS',
    notes: '',
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Batches list for filter
  const batches = Array.from(new Set(students.map(s => s.batch || 'General'))).filter(Boolean);

  const resetForm = () => {
    setFormData({
      name: '',
      rollNo: '',
      phone: '',
      email: '',
      batch: 'Section A - CS',
      notes: '',
    });
    setFormError(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      rollNo: student.rollNo,
      phone: student.phone || '',
      email: student.email || '',
      batch: student.batch || 'Section A - CS',
      notes: student.notes || '',
    });
    setFormError(null);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.rollNo.trim()) {
      setFormError('Student Name and Roll Number are required.');
      return;
    }

    const last4 = extractLast4Digits(formData.rollNo);

    // Check duplicate roll number (except self when editing)
    const existing = students.find(s => 
      s.rollNo.toLowerCase() === formData.rollNo.toLowerCase() && 
      (!editingStudent || s.id !== editingStudent.id)
    );

    if (existing) {
      setFormError(`A student with Roll Number ${formData.rollNo} already exists (${existing.name}).`);
      return;
    }

    if (editingStudent) {
      const updated: Student = {
        ...editingStudent,
        name: formData.name.trim(),
        rollNo: formData.rollNo.trim().toUpperCase(),
        last4Digits: last4,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        batch: formData.batch.trim(),
        notes: formData.notes.trim(),
      };
      onUpdateStudent(updated);
      setEditingStudent(null);
    } else {
      const newStudent: Student = {
        id: `std-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: formData.name.trim(),
        rollNo: formData.rollNo.trim().toUpperCase(),
        last4Digits: last4,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        batch: formData.batch.trim(),
        notes: formData.notes.trim(),
        avatarColor: AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)],
      };
      onAddStudent(newStudent);
      setIsAddModalOpen(false);
      setBatchFilter('ALL');
      setSearchQuery('');
    }

    resetForm();
  };

  const handleProcessBulkImport = () => {
    if (!bulkText.trim()) {
      setBulkError('Please paste student data.');
      return;
    }

    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const newStudents: Student[] = [];
    const rollSet = new Set(students.map(s => s.rollNo.toUpperCase()));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip header if line looks like header
      if (i === 0 && (line.toLowerCase().includes('roll') || line.toLowerCase().includes('name'))) {
        continue;
      }

      // Supports CSV, Tab, or Semicolon separated: RollNo, Name, Phone, Email, Batch
      const parts = line.split(/[,;\t]+/).map(p => p.trim());
      if (parts.length >= 2) {
        const rollNo = parts[0].toUpperCase();
        const name = parts[1];
        const phone = parts[2] || '';
        const email = parts[3] || '';
        const batch = parts[4] || 'Batch 2026';

        if (rollNo && name && !rollSet.has(rollNo)) {
          rollSet.add(rollNo);
          newStudents.push({
            id: `std-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
            name,
            rollNo,
            last4Digits: extractLast4Digits(rollNo),
            phone,
            email,
            batch,
            avatarColor: AVATAR_PALETTE[(i + students.length) % AVATAR_PALETTE.length],
          });
        }
      }
    }

    if (newStudents.length === 0) {
      setBulkError('No new valid student records found. Format: RollNumber, Student Name, Phone, Email');
      return;
    }

    onBulkImport(newStudents);
    setIsBulkImportModalOpen(false);
    setBulkText('');
    setBulkError(null);
    setBatchFilter('ALL');
    setSearchQuery('');
  };

  const handleExportCSV = () => {
    const sortedStudents = sortStudentsByLast4Digits(students);
    const headers = ['Roll Number', 'Last 4 Digits', 'Full Name', 'Phone', 'Email', 'Batch'];
    const rows = sortedStudents.map(s => [
      `"${s.rollNo}"`,
      `"${s.last4Digits}"`,
      `"${s.name}"`,
      `"${s.phone || ''}"`,
      `"${s.email || ''}"`,
      `"${s.batch || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `student_roster_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered students sorted in ascending order based on last 4 digits
  const filteredStudents = sortStudentsByLast4Digits(
    students.filter(s => {
      const matchesSearch = 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.last4Digits.includes(searchQuery) ||
        (s.phone && s.phone.includes(searchQuery)) ||
        (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesBatch = batchFilter === 'ALL' || (s.batch || 'General') === batchFilter;

      return matchesSearch && matchesBatch;
    })
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-sky-500/20 text-sky-700 border border-sky-300">
              Page 2 • Student Roster
            </span>
            <span className="text-xs text-slate-500">{students.length} Total Registered</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Student Directory & Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Add, update phone/email/roll numbers, or delete students. Last 4 digits are automatically extracted for high-speed keypad attendance.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="ai-photo-scan-btn"
            onClick={() => setIsPhotoScanModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-indigo-500/25 transition flex items-center gap-2 active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>AI Scan Roster Pic</span>
          </button>

          <button
            id="bulk-import-btn"
            onClick={() => { setBulkError(null); setIsBulkImportModalOpen(true); }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 border border-slate-200"
          >
            <UploadCloud className="w-4 h-4 text-slate-600" />
            <span>Bulk Import</span>
          </button>

          <button
            id="export-roster-csv-btn"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition flex items-center gap-1.5 border border-slate-200"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            id="copy-roster-for-sheets-btn"
            onClick={() => setIsCopySheetModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 active:scale-95"
            title="Copy all student names with roll numbers to put in Google Sheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Copy for Google Sheet</span>
          </button>

          <button
            id="add-student-btn"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-md shadow-blue-500/20 transition flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Student</span>
          </button>
        </div>
      </div>

      {/* Controls Bar: Search & Batch Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Name, Roll No (e.g. 2024CS1004), or 4-digit code (e.g. 1004), Phone, Email..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Batch Selector */}
          {batches.length > 1 && (
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Batch:</span>
              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Batches ({students.length})</option>
                {batches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}

        </div>
      </div>

      {/* Students Table / Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Full Roll No</th>
                <th className="py-3.5 px-4">Keypad Code (Last 4)</th>
                <th className="py-3.5 px-4 hidden md:table-cell">Phone Number</th>
                <th className="py-3.5 px-4 hidden lg:table-cell">Email Address</th>
                <th className="py-3.5 px-4 hidden sm:table-cell">Batch</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-3 shadow-xs">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-bold text-slate-800">Your Student Roster is Empty</h4>
                      <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                        Add your students individually or use Bulk Import to paste your class list from Excel or Google Sheets in one go.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleOpenAdd}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>Add First Student</span>
                        </button>
                        <button
                          onClick={() => setIsBulkImportModalOpen(true)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 border border-slate-200"
                        >
                          <Upload className="w-4 h-4" />
                          <span>Bulk Import / Paste</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600">No students matched your search criteria.</p>
                    <p className="text-xs text-slate-400 mt-1">Try clearing filters or adding a new student.</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition group">
                      
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl ${student.avatarColor || 'bg-blue-500'} text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0`}>
                            {student.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{student.name}</span>
                            <span className="text-xs text-slate-400 block sm:hidden">{student.batch}</span>
                          </div>
                        </div>
                      </td>

                      {/* Full Roll No */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {student.rollNo}
                      </td>

                      {/* Last 4 Digits Pill */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg text-xs">
                          <Hash className="w-3 h-3 text-blue-500" />
                          {student.last4Digits}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 hidden md:table-cell text-slate-600 font-mono text-xs">
                        {student.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{student.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">Not set</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 hidden lg:table-cell text-slate-600 text-xs truncate max-w-xs">
                        {student.email ? (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{student.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">Not set</span>
                        )}
                      </td>

                      {/* Batch */}
                      <td className="py-3.5 px-4 hidden sm:table-cell text-slate-600 text-xs">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md font-medium text-slate-700">
                          {student.batch || 'General'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            id={`edit-student-${student.id}`}
                            onClick={() => handleOpenEdit(student)}
                            title="Edit Student Info"
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          
                          <button
                            id={`delete-student-${student.id}`}
                            onClick={() => setDeleteConfirmId(student.id)}
                            title="Delete Student"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <span>Showing {filteredStudents.length} of {students.length} students</span>
          <span className="text-[11px] text-slate-400">All data persists locally in your browser</span>
        </div>
      </div>

      {/* Add / Edit Student Modal */}
      {(isAddModalOpen || editingStudent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    {editingStudent ? 'Edit Student Details' : 'Add New Student'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingStudent ? 'Update roll number, contact information, or section.' : 'Create a new student entry in your class roster.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setIsAddModalOpen(false); setEditingStudent(null); }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 my-4">
              
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>

              {/* Roll Number & Extracted Last 4 Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Full Roll Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.rollNo}
                    onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                    placeholder="e.g. 2024CS1042"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Extracted 4-Digit Code
                  </label>
                  <div className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-blue-50/70 border border-blue-200 font-mono font-bold text-blue-700 flex items-center justify-between">
                    <span>{extractLast4Digits(formData.rollNo) || '----'}</span>
                    <span className="text-[10px] text-blue-500 font-sans font-normal">Auto-generated</span>
                  </div>
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="student@college.edu"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Batch / Section */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Batch / Section
                </label>
                <input
                  type="text"
                  value={formData.batch}
                  onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                  placeholder="e.g. Section A - CS, Tech Batch 2026"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setEditingStudent(null); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingStudent ? 'Save Changes' : 'Create Student'}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Delete Student?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Are you sure you want to remove this student from your active roster? Their past attendance records will remain preserved in historical logs.
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
                  onDeleteStudent(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-md shadow-rose-500/20"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {isBulkImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-lg">Bulk Import Student List</h3>
              </div>
              <button
                onClick={() => setIsBulkImportModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4">
              <p className="text-xs text-slate-600 mb-2">
                Paste student records below (comma-separated, tab-separated, or from Excel/Google Sheets). One student per line:
              </p>
              <div className="bg-slate-100 p-2.5 rounded-lg text-[11px] font-mono text-slate-700 mb-3">
                <strong>Format:</strong> RollNumber, Full Name, Phone (optional), Email (optional)<br/>
                <em>Example:</em><br/>
                2026CS1001, Student Name, 9876543210, student@college.edu<br/>
                2026CS1002, Another Student, 9876543211, student2@college.edu
              </div>

              {bulkError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{bulkError}</span>
                </div>
              )}

              <textarea
                rows={7}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="2026CS1001, Student Name, 9876543210, student@college.edu&#10;2026CS1002, Another Student, 9876543211, student2@college.edu"
                className="w-full p-3 text-xs font-mono rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsBulkImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessBulkImport}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Import Students</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* AI Photo Roster Scanner Modal */}
      {isPhotoScanModalOpen && (
        <AIPhotoRosterScannerModal
          isOpen={isPhotoScanModalOpen}
          onClose={() => setIsPhotoScanModalOpen(false)}
          onImportStudents={(scannedStudents) => {
            onBulkImport(scannedStudents);
            setBatchFilter('ALL');
            setSearchQuery('');
          }}
          existingStudents={students}
        />
      )}

      {/* Copy All Names with Roll Number for Google Sheet Modal */}
      <CopyStudentsForSheetsModal
        isOpen={isCopySheetModalOpen}
        onClose={() => setIsCopySheetModalOpen(false)}
        students={filteredStudents.length > 0 ? filteredStudents : students}
        className={batchFilter !== 'ALL' ? batchFilter : 'All Students'}
      />

    </div>
  );
};
