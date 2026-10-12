import React from 'react';
import { FileSpreadsheet, Check, X, AlertTriangle } from 'lucide-react';

interface WorkspaceConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  sheetTitle?: string;
  tabName?: string;
  rowCount?: number;
  isLoading?: boolean;
}

export const WorkspaceConfirmModal: React.FC<WorkspaceConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  sheetTitle,
  tabName,
  rowCount,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">{title}</h3>
            <p className="text-xs text-slate-500">Google Sheets Confirmation</p>
          </div>
        </div>

        <p className="text-xs text-slate-700 mb-4 leading-relaxed">
          {description}
        </p>

        {(sheetTitle || tabName || rowCount) && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl mb-4 space-y-1 text-xs">
            {sheetTitle && (
              <div className="flex justify-between">
                <span className="text-slate-500">Target Spreadsheet:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[200px]">{sheetTitle}</span>
              </div>
            )}
            {tabName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tab / Sheet Name:</span>
                <span className="font-semibold text-emerald-700">{tabName}</span>
              </div>
            )}
            {rowCount !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-500">Rows to Write:</span>
                <span className="font-bold text-slate-900">{rowCount} rows</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
          >
            {isLoading ? (
              <span>Writing to Sheet...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirm & Append</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
