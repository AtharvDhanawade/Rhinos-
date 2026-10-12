import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  ExternalLink, 
  Check, 
  Copy, 
  Sparkles, 
  Link2, 
  X, 
  Save, 
  CheckCircle2, 
  HelpCircle,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Send
} from 'lucide-react';
import { WeeklySyncSettings, ClassSubject, Student, AttendanceRecord } from '../types';
import { 
  extractGoogleSheetId, 
  isValidGoogleSheetUrl, 
  normalizeGoogleSheetUrl, 
  generateGoogleAppsScriptCode 
} from '../utils/googleSheets';
import { GoogleSignInButton } from './GoogleSignInButton';
import { WorkspaceConfirmModal } from './WorkspaceConfirmModal';
import { getAccessToken, isAuthenticatedWithGoogle, getCurrentGoogleUser } from '../utils/googleWorkspaceAuth';
import { 
  extractSpreadsheetId, 
  getSpreadsheetDetails, 
  appendAttendanceViaDirectApi 
} from '../utils/googleSheetsDirectApi';

interface GoogleSheetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: WeeklySyncSettings;
  classes?: ClassSubject[];
  onSaveSettings: (settings: WeeklySyncSettings) => void;
  onTriggerSync?: () => void;
  currentClass?: ClassSubject;
  students?: Student[];
  records?: AttendanceRecord[];
}

export const GoogleSheetConfigModal: React.FC<GoogleSheetConfigModalProps> = ({
  isOpen,
  onClose,
  settings,
  classes = [],
  onSaveSettings,
  onTriggerSync,
  currentClass,
  students = [],
  records = [],
}) => {
  const [sheetUrl, setSheetUrl] = useState(settings.googleSheetUrl || '');
  const [webhookUrl, setWebhookUrl] = useState(settings.webhookUrl || '');
  const [autoAppend, setAutoAppend] = useState(settings.autoAppendOnSave ?? true);
  const [includeInReport, setIncludeInReport] = useState(settings.includeSheetInReport ?? true);
  const [syncStrategy, setSyncStrategy] = useState<'per_class_tabs' | 'single_tab' | 'separate_sheets'>(
    settings.syncStrategy || 'per_class_tabs'
  );
  const [classTabNames, setClassTabNames] = useState<Record<string, string>>(
    settings.classTabNames || {}
  );
  const [classSheetUrls, setClassSheetUrls] = useState<Record<string, string>>(
    settings.classSheetUrls || {}
  );

  const [isGoogleAuth, setIsGoogleAuth] = useState(isAuthenticatedWithGoogle());
  const [spreadsheetMetadata, setSpreadsheetMetadata] = useState<{ title: string; sheets: string[] } | null>(null);
  const [isCheckingSheet, setIsCheckingSheet] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isWritingTest, setIsWritingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSheetUrl(settings.googleSheetUrl || '');
      setWebhookUrl(settings.webhookUrl || '');
      setAutoAppend(settings.autoAppendOnSave ?? true);
      setIncludeInReport(settings.includeSheetInReport ?? true);
      setSyncStrategy(settings.syncStrategy || 'per_class_tabs');
      setClassTabNames(settings.classTabNames || {});
      setClassSheetUrls(settings.classSheetUrls || {});
      setTestResult(null);
      setCheckError(null);
    }
  }, [isOpen, settings]);

  // Check spreadsheet metadata whenever Google URL or auth state changes
  useEffect(() => {
    let isCancelled = false;
    const inspectSheet = async () => {
      const id = extractSpreadsheetId(sheetUrl);
      const token = await getAccessToken();

      if (!id || !token) {
        setSpreadsheetMetadata(null);
        setCheckError(null);
        return;
      }

      setIsCheckingSheet(true);
      setCheckError(null);
      try {
        const details = await getSpreadsheetDetails(id, token);
        if (!isCancelled) {
          setSpreadsheetMetadata(details);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('Could not inspect sheet:', err);
          setSpreadsheetMetadata(null);
          setCheckError(err.message || 'Make sure the sheet is shared or created in your Google account.');
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingSheet(false);
        }
      }
    };

    inspectSheet();
    return () => {
      isCancelled = true;
    };
  }, [sheetUrl, isGoogleAuth]);

  if (!isOpen) return null;

  const detectedSheetId = extractSpreadsheetId(sheetUrl);
  const isUrlValid = Boolean(detectedSheetId);
  const cleanSheetUrl = normalizeGoogleSheetUrl(sheetUrl);

  const handleSave = () => {
    const finalSheetUrl = normalizeGoogleSheetUrl(sheetUrl);
    const updated: WeeklySyncSettings = {
      ...settings,
      googleSheetUrl: finalSheetUrl,
      webhookUrl: webhookUrl.trim(),
      sheetId: detectedSheetId || undefined,
      autoAppendOnSave: autoAppend,
      includeSheetInReport: includeInReport,
      syncStrategy,
      classTabNames,
      classSheetUrls,
    };
    onSaveSettings(updated);
    onClose();
  };

  const handleExecuteTestRow = async () => {
    setIsWritingTest(true);
    setTestResult(null);
    try {
      const token = await getAccessToken();
      const id = detectedSheetId;

      if (token && id) {
        // Direct API call
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const targetClass = currentClass || classes[0] || { name: 'Demo Subject', id: 'cls-1', teacherName: 'Faculty', room: 'Hall 1' };
        const tab = (classTabNames[targetClass.id]) || targetClass.name || 'Attendance';

        const sampleRecords = (students.length > 0 ? students.slice(0, 5) : [
          { rollNo: '101', last4Digits: '0101', name: 'Student 1', id: 's1' },
          { rollNo: '102', last4Digits: '0102', name: 'Student 2', id: 's2' },
        ]).map((s, idx) => ({
          rollNo: s.rollNo,
          last4Digits: s.last4Digits || s.rollNo.slice(-4),
          name: s.name,
          status: idx === 1 ? 'ABSENT' : 'PRESENT'
        }));

        const result = await appendAttendanceViaDirectApi(
          id,
          {
            classId: targetClass.id,
            className: targetClass.name,
            tabName: tab,
            sheetTabName: tab,
            date: dateStr,
            time: `${timeStr} (Test Session)`,
            teacherName: targetClass.teacherName || 'Faculty',
            room: targetClass.room || 'Main Hall',
            totalEnrolled: sampleRecords.length,
            presentCount: sampleRecords.filter(s => s.status === 'PRESENT').length,
            absentCount: sampleRecords.filter(s => s.status === 'ABSENT').length,
            lateCount: 0,
            attendancePercent: 50,
            absenteeRolls: ['0102'],
            absenteeNames: ['Student 2'],
            absenteeDetails: 'Student 2',
            studentRecords: sampleRecords,
          },
          token,
          tab
        );

        if (result.success) {
          setTestResult({
            success: true,
            message: `SUCCESS! Test attendance row was appended to your Google Sheet in tab "${tab}". Open your Google Sheet to see it live!`,
          });
        } else {
          setTestResult({
            success: false,
            message: result.error || 'Failed to append row to Google Sheet.',
          });
        }
      } else {
        // Fallback to server webhook test
        const res = await fetch('/api/sheets/append', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleSheetUrl: cleanSheetUrl,
            webhookUrl: webhookUrl.trim(),
            payload: {
              className: 'Test Subject Connection',
              date: new Date().toISOString().split('T')[0],
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              totalEnrolled: 10,
              presentCount: 9,
              absentCount: 1,
              lateCount: 0,
              attendancePercent: 90,
              absenteeDetails: 'Sample Absentee',
              studentRecords: []
            }
          })
        });

        const data = await res.json();
        if (res.ok) {
          setTestResult({
            success: true,
            message: data.message || 'Server received test row.',
          });
        } else {
          setTestResult({
            success: false,
            message: data.error || 'Connection test failed.',
          });
        }
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Error executing test row.',
      });
    } finally {
      setIsWritingTest(false);
      setShowConfirmModal(false);
    }
  };

  const handleCopyAppsScript = () => {
    const code = generateGoogleAppsScriptCode(settings.sheetTitle || 'Attendance');
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl flex items-center gap-2">
                <span>Google Sheet Link & Storage</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Direct API
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Connect your Google account and spreadsheet link so attendance data appears directly inside your Google Sheet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 1: Google Account Connection */}
        <div className="mb-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Step 1: Connect Google Account (Direct Sheet Write Permission)</span>
          </label>
          <GoogleSignInButton 
            onAuthChange={(authenticated) => setIsGoogleAuth(authenticated)} 
          />
        </div>

        {/* Step 2: Google Sheet URL Input */}
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-emerald-700" />
                <span>Step 2: Google Sheet URL or ID</span>
              </label>
              {isUrlValid && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3" /> Valid Sheet Link
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-emerald-300 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            {/* Live Sheet Detection Status */}
            {isCheckingSheet && (
              <div className="flex items-center gap-2 text-xs text-emerald-800 pt-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Connecting to Google Sheet...</span>
              </div>
            )}

            {spreadsheetMetadata && (
              <div className="p-3 bg-white/90 border border-emerald-300 rounded-xl text-xs space-y-1 mt-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-slate-900 truncate">
                    Spreadsheet: "{spreadsheetMetadata.title}"
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 flex flex-wrap gap-1 items-center pt-0.5">
                  <span className="font-medium text-slate-500">Available Tabs:</span>
                  {spreadsheetMetadata.sheets.map((s) => (
                    <span key={s} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-700">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {checkError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] flex items-start gap-1.5 mt-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                <span>{checkError}</span>
              </div>
            )}

            {cleanSheetUrl && isUrlValid && (
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-500 font-mono text-[10px] truncate max-w-[280px]">
                  ID: {detectedSheetId}
                </span>
                <a
                  href={cleanSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 transition"
                >
                  <span>Open in Google Sheets</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Test Write Button */}
          {isUrlValid && (
            <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Verify Live Append</span>
                <p className="text-[11px] text-slate-500">
                  Append a test row now to verify data appears in your sheet
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={isWritingTest}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isWritingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Test Sync to Sheet</span>
              </button>
            </div>
          )}

          {testResult && (
            <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2 ${
              testResult.success 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-snug">{testResult.message}</span>
            </div>
          )}

          {/* Strategy: Per-Class Tabs or Single Tab */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <label className="text-xs font-bold text-slate-900 block">
              Google Sheet Layout Strategy
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSyncStrategy('per_class_tabs')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  syncStrategy === 'per_class_tabs'
                    ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="font-bold text-slate-900">Per-Class Tabs (Pages)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  1st class in 1st sheet tab, 2nd class in 2nd tab
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSyncStrategy('single_tab')}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  syncStrategy === 'single_tab'
                    ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="font-bold text-slate-900">Single Master Tab</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  All classes appended chronologically to one tab
                </div>
              </button>
            </div>

            {/* Custom Tab Names per Subject */}
            {syncStrategy === 'per_class_tabs' && classes.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Sheet Tab / Page Name for each Subject:
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {classes.map((cls) => (
                    <div key={cls.id} className="flex items-center gap-2 text-xs">
                      <span className="w-28 font-medium text-slate-700 truncate" title={cls.name}>
                        {cls.name}:
                      </span>
                      <input
                        type="text"
                        value={classTabNames[cls.id] ?? cls.name}
                        onChange={(e) => {
                          setClassTabNames({
                            ...classTabNames,
                            [cls.id]: e.target.value,
                          });
                        }}
                        placeholder={`Tab for ${cls.name}`}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Optional: Apps Script Webhook (Alternative Method) */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAppsScriptGuide(!showAppsScriptGuide)}
              className="w-full p-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-between transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-slate-500" />
                <span>Alternative: Google Apps Script Webhook URL (Optional)</span>
              </div>
              <span className="text-slate-400 text-xs font-normal">
                {showAppsScriptGuide ? 'Hide' : 'Show Details'}
              </span>
            </button>

            {showAppsScriptGuide && (
              <div className="p-4 space-y-3 bg-white border-t border-slate-200 text-xs">
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  If you prefer an automated webhook instead of OAuth, deploy the script below as a Web App (Access: "Anyone") and paste the Web App URL:
                </p>

                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800"
                />

                <button
                  type="button"
                  onClick={handleCopyAppsScript}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Apps Script Copied!' : 'Copy Apps Script Code'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Google Sheet Link</span>
          </button>
        </div>
      </div>

      {/* Confirmation Dialog before mutating Google Sheet */}
      <WorkspaceConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleExecuteTestRow}
        title="Append Test Attendance to Google Sheet"
        description="Are you sure you want to append a test session row to your linked Google Sheet? This will write a session header and attendance status to the specified sheet tab."
        sheetTitle={spreadsheetMetadata?.title || detectedSheetId || 'Linked Google Sheet'}
        tabName={currentClass ? (classTabNames[currentClass.id] || currentClass.name) : 'Attendance'}
        rowCount={4}
        isLoading={isWritingTest}
      />
    </div>
  );
};
