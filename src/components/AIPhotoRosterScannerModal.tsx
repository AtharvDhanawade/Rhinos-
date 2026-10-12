import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  Camera, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Edit3, 
  Trash2, 
  Users, 
  Hash, 
  RefreshCw,
  Eye,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { Student } from '../types';

interface AIPhotoRosterScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStudents: (students: Student[]) => void;
  existingStudents: Student[];
}

interface ScannedStudentRow {
  id: string;
  name: string;
  rollNo: string;
  last4Digits: string;
  phone: string;
  email: string;
  batch: string;
  selected: boolean;
  isDuplicate?: boolean;
}

export const AIPhotoRosterScannerModal: React.FC<AIPhotoRosterScannerModalProps> = ({
  isOpen,
  onClose,
  onImportStudents,
  existingStudents,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [fileName, setFileName] = useState<string>('');
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedResults, setScannedResults] = useState<ScannedStudentRow[]>([]);
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    setScanError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      setImagePreview(rawDataUrl);

      // Downscale large camera photos to ensure snappy upload and crisp OCR
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setImageBase64(optimizedDataUrl);
          setImageMime('image/jpeg');
        } else {
          setImageBase64(rawDataUrl);
          setImageMime(file.type || 'image/jpeg');
        }
      };
      img.onerror = () => {
        setImageBase64(rawDataUrl);
        setImageMime(file.type || 'image/jpeg');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleScanWithAI = async () => {
    if (!imageBase64) {
      setScanError('Please select or capture a photo of the student roster first.');
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const response = await fetch('/api/scan-roster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64,
          mimeType: imageMime,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze attendance document.');
      }

      const existingRollSet = new Set(existingStudents.map(s => s.rollNo.toUpperCase().trim()));

      const rows: ScannedStudentRow[] = (data.students || []).map((s: any, idx: number) => {
        const roll = (s.rollNo || '').trim();
        const isDup = existingRollSet.has(roll.toUpperCase());
        return {
          id: `scan-${Date.now()}-${idx}`,
          name: s.name || `Student ${idx + 1}`,
          rollNo: roll,
          last4Digits: s.last4Digits || (roll.replace(/\D/g, '').slice(-4).padStart(4, '0')),
          phone: s.phone || '',
          email: s.email || '',
          batch: s.batch || 'Batch 2026',
          selected: !isDup,
          isDuplicate: isDup,
        };
      });

      if (rows.length === 0) {
        setScanError('No student names or roll numbers were detected in this image. Please try a clearer photo or higher lighting.');
        setIsScanning(false);
        return;
      }

      setScannedResults(rows);
      setStep('review');
    } catch (err: any) {
      console.error('Scan error:', err);
      setScanError(err.message || 'Error communicating with AI scanner service. Please check your image.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleToggleSelectAll = (select: boolean) => {
    setScannedResults(prev => prev.map(r => ({ ...r, selected: select })));
  };

  const handleToggleSelect = (id: string) => {
    setScannedResults(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const handleUpdateField = (id: string, field: keyof ScannedStudentRow, value: string) => {
    setScannedResults(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === 'rollNo') {
        const digits = value.replace(/\D/g, '');
        updated.last4Digits = digits.length >= 4 ? digits.slice(-4) : digits.padStart(4, '0');
      }
      return updated;
    }));
  };

  const handleRemoveRow = (id: string) => {
    setScannedResults(prev => prev.filter(r => r.id !== id));
  };

  const handleConfirmImport = () => {
    const selectedRows = scannedResults.filter(r => r.selected);
    if (selectedRows.length === 0) {
      setScanError('Please select at least one student to import.');
      return;
    }

    const studentsToAdd: Student[] = selectedRows.map((r, idx) => ({
      id: `std-ai-${Date.now()}-${idx}`,
      name: r.name.trim(),
      rollNo: r.rollNo.trim(),
      last4Digits: r.last4Digits.trim(),
      phone: r.phone.trim(),
      email: r.email.trim(),
      batch: r.batch.trim() || 'Batch 2026',
    }));

    onImportStudents(studentsToAdd);
    handleResetAndClose();
  };

  const handleResetAndClose = () => {
    setImagePreview(null);
    setImageBase64(null);
    setScannedResults([]);
    setStep('upload');
    setScanError(null);
    onClose();
  };

  const selectedCount = scannedResults.filter(r => r.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">AI Photo Roster Scanner</h3>
                <span className="bg-amber-400 text-slate-950 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Gemini OCR
                </span>
              </div>
              <p className="text-xs text-blue-100">
                Snap or upload a printed or handwritten attendance list • AI reads names and extracts 4-digit keypad codes
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          
          {scanError && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{scanError}</div>
            </div>
          )}

          {step === 'upload' ? (
            <div className="space-y-6">
              
              {/* Dropzone / Upload Box */}
              {!imagePreview ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-3xl p-8 text-center bg-slate-50/50 hover:bg-blue-50/30 transition cursor-pointer flex flex-col items-center justify-center min-h-[260px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3 shadow-xs">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-base">
                    Drop your attendance sheet photo here
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Supports photographs of college register books, printed spreadsheets, PDF screenshots, or WhatsApp class lists.
                  </p>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Browse Image File</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        cameraInputRef.current?.click();
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Use Phone Camera</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 max-h-[340px] flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Uploaded Roster"
                      className="max-h-[340px] w-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setImageBase64(null);
                      }}
                      className="absolute top-3 right-3 bg-slate-900/80 hover:bg-rose-600 text-white p-2 rounded-xl backdrop-blur-xs transition shadow-lg text-xs flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      <span>Change Photo</span>
                    </button>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between text-xs text-blue-900">
                    <span className="truncate font-medium">Ready to scan: {fileName || 'Captured photo'}</span>
                    <span className="text-blue-600 font-semibold shrink-0 ml-2">Click Scan to Extract</span>
                  </div>
                </div>
              )}

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!imageBase64 || isScanning}
                  onClick={handleScanWithAI}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-2"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Gemini AI Reading Sheet...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Extract Students with AI</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          ) : (
            /* Review Step */
            <div className="space-y-4">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Review Detected Students ({scannedResults.length} found)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Verify names and roll numbers. The 4-digit keypad code is automatically extracted from each roll number.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(true)}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(false)}
                    className="text-xs font-semibold text-slate-500 hover:underline"
                  >
                    Deselect All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Rescan</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Verification Table */}
              <div className="max-h-[380px] overflow-y-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCount === scannedResults.length && scannedResults.length > 0}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Full Roll No</th>
                      <th className="py-2.5 px-3">4-Digit Keypad Code</th>
                      <th className="py-2.5 px-3">Batch / Section</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scannedResults.map((row) => (
                      <tr 
                        key={row.id} 
                        className={`transition ${row.selected ? 'bg-white' : 'bg-slate-50/60 opacity-60'} hover:bg-blue-50/30`}
                      >
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => handleToggleSelect(row.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleUpdateField(row.id, 'name', e.target.value)}
                            className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded font-medium text-slate-900 focus:outline-none"
                          />
                          {row.isDuplicate && (
                            <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                              ⚠️ Roll already exists in roster
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.rollNo}
                            onChange={(e) => handleUpdateField(row.id, 'rollNo', e.target.value)}
                            className="w-full px-2 py-1 font-mono uppercase bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded text-slate-800 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-mono font-bold rounded-md text-xs border border-emerald-300">
                              {row.last4Digits}
                            </span>
                            <span className="text-[10px] text-slate-400">keypad</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.batch}
                            onChange={(e) => handleUpdateField(row.id, 'batch', e.target.value)}
                            className="w-full px-2 py-1 text-slate-600 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer Confirm */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-600">
                  Selected <strong className="text-slate-900">{selectedCount}</strong> of {scannedResults.length} students to add
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
                  >
                    Back to Photo
                  </button>
                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={handleConfirmImport}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Add {selectedCount} Students to Roster</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
