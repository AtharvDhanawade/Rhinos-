import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  FileSpreadsheet, 
  ExternalLink, 
  CheckCircle2, 
  Sparkles,
  Info,
  Table
} from 'lucide-react';
import { Student } from '../types';
import { formatStudentsForGoogleSheets, StudentsTsvFormat } from '../utils/googleSheets';

interface CopyStudentsForSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  className?: string;
}

export const CopyStudentsForSheetsModal: React.FC<CopyStudentsForSheetsModalProps> = ({
  isOpen,
  onClose,
  students,
  className
}) => {
  const [format, setFormat] = useState<StudentsTsvFormat>('roll_name');
  const [includeHeader, setIncludeHeader] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const tsvText = formatStudentsForGoogleSheets(students, format, includeHeader);
  const rowCount = students.length;

  const handleCopy = () => {
    navigator.clipboard.writeText(tsvText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleOpenBlankSheet = () => {
    window.open('https://sheet.new', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white relative">
          <button 
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
              <FileSpreadsheet className="w-6 h-6" />
            </span>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Google Sheets Export Ready
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white">
                Copy All Names with Roll Numbers
              </h2>
            </div>
          </div>
          <p className="text-xs text-emerald-100/80 mt-2">
            Copies formatted Tab-Separated columns. Paste (<kbd className="bg-black/30 px-1 py-0.5 rounded font-mono text-[10px]">Ctrl+V</kbd>) directly into Google Sheets to populate separate columns instantly!
          </p>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-slate-800">

          {/* Options */}
          <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Column Format:
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeHeader}
                  onChange={(e) => setIncludeHeader(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span>Include Header Row</span>
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFormat('roll_name')}
                className={`p-2 rounded-xl text-xs font-bold transition text-left border ${
                  format === 'roll_name'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div>Roll No + Name</div>
                <div className="text-[10px] font-normal opacity-80 mt-0.5">2 Columns (Standard)</div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('last4_name')}
                className={`p-2 rounded-xl text-xs font-bold transition text-left border ${
                  format === 'last4_name'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div>Last 4 + Name</div>
                <div className="text-[10px] font-normal opacity-80 mt-0.5">2 Columns (Short)</div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('roll_last4_name')}
                className={`p-2 rounded-xl text-xs font-bold transition text-left border ${
                  format === 'roll_last4_name'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div>Roll + 4-Dig + Name</div>
                <div className="text-[10px] font-normal opacity-80 mt-0.5">3 Columns</div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('full_columns')}
                className={`p-2 rounded-xl text-xs font-bold transition text-left border ${
                  format === 'full_columns'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div>Full Roster</div>
                <div className="text-[10px] font-normal opacity-80 mt-0.5">With Phone & Batch</div>
              </button>
            </div>
          </div>

          {/* Quick Paste Guide */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900">
            <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">How to paste in Google Sheets:</span>
              <ol className="list-decimal list-inside space-y-0.5 text-emerald-800 mt-0.5">
                <li>Click <strong>"Copy for Google Sheet"</strong> below.</li>
                <li>Open Google Sheets and click on cell <strong>A1</strong>.</li>
                <li>Press <kbd className="bg-emerald-100 border border-emerald-300 px-1 py-0.5 rounded font-mono text-[10px]">Ctrl+V</kbd> (or <kbd className="bg-emerald-100 border border-emerald-300 px-1 py-0.5 rounded font-mono text-[10px]">Cmd+V</kbd> on Mac).</li>
              </ol>
            </div>
          </div>

          {/* Data Preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Preview ({rowCount} students):
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Tab-Separated Output
              </span>
            </div>
            <div className="bg-slate-900 text-emerald-300 p-3.5 rounded-2xl font-mono text-xs max-h-48 overflow-y-auto border border-slate-800">
              <pre className="whitespace-pre overflow-x-auto leading-relaxed">
                {tsvText}
              </pre>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              id="copy-students-sheets-btn"
              onClick={handleCopy}
              className={`flex-1 py-3 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-md ${
                copied
                  ? 'bg-emerald-700 text-white shadow-emerald-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied {rowCount} Students for Google Sheets!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy for Google Sheet ({rowCount} Students)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenBlankSheet}
              className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition border border-slate-200"
              title="Open a blank Google Sheet in a new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Open Sheet.new</span>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition active:scale-95"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
