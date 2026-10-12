import React, { useState, useRef } from 'react';
import { DeviceInfo, DeviceRole } from '../types';
import { 
  X, 
  Laptop, 
  Crown, 
  CheckCircle2, 
  RefreshCw, 
  Download, 
  Upload, 
  HardDrive, 
  ShieldCheck, 
  Wifi, 
  FileJson,
  Check
} from 'lucide-react';
import { exportFullDatabaseBackup, downloadBackupFile } from '../utils/storage';
import { setStoredDeviceRole, getStoredDeviceRole } from '../utils/firebaseSync';

interface LaptopSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: DeviceInfo[];
  isOnline: boolean;
  onRefreshSync: () => void;
  showToast: (msg: string) => void;
  onRestoreData: (data: any) => void;
}

export const LaptopSyncModal: React.FC<LaptopSyncModalProps> = ({
  isOpen,
  onClose,
  devices,
  isOnline,
  onRefreshSync,
  showToast,
  onRestoreData
}) => {
  const [currentRole, setCurrentRole] = useState<DeviceRole>(getStoredDeviceRole());
  const [isCopied, setIsCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleRoleChange = (role: DeviceRole) => {
    setCurrentRole(role);
    setStoredDeviceRole(role);
    onRefreshSync();
    showToast(`Laptop role updated to: ${role === 'admin' ? 'Primary Admin Laptop' : 'Secondary Laptop'}`);
  };

  const handleDownloadBackup = () => {
    downloadBackupFile();
    showToast('Complete Database Backup (.json) downloaded successfully!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && (parsed.students || parsed.classes || parsed.records)) {
          onRestoreData(parsed);
          showToast('Database successfully restored from backup file!');
        } else {
          showToast('Invalid backup file structure.');
        }
      } catch (err) {
        showToast('Error parsing backup JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const copyAppUrl = () => {
    navigator.clipboard.writeText(window.location.origin).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      showToast('App link copied! Open on another laptop to sync.');
    }).catch(() => {
      showToast('Unable to copy link.');
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl text-slate-100 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Multi-Laptop Sync & Database Backup</h3>
              <p className="text-xs text-slate-400">Live peer synchronizing, cross-device access, and offline data safety</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Status Banner */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Cloud & Local Storage Engine</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold uppercase">
                    Active & Safe
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  All student lists, subject configurations, and marked attendance records are auto-saved.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                onRefreshSync();
                showToast('Synchronized with cloud and peer laptops!');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Device Role Selector */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              This Device Configuration
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleRoleChange('admin')}
                className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
                  currentRole === 'admin'
                    ? 'bg-amber-950/30 border-amber-500/50 shadow-lg shadow-amber-950/20'
                    : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                <div className={`p-2 rounded-lg ${currentRole === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>
                  <Crown className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">Primary Admin Laptop</span>
                    {currentRole === 'admin' && <Check className="w-4 h-4 text-amber-400" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Main control device. Has full rights to edit student rosters, subject schedules, and manage sync.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange('editor')}
                className={`p-4 rounded-xl border text-left transition flex items-start gap-3 ${
                  currentRole === 'editor'
                    ? 'bg-blue-950/30 border-blue-500/50 shadow-lg shadow-blue-950/20'
                    : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800'
                }`}
              >
                <div className={`p-2 rounded-lg ${currentRole === 'editor' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'}`}>
                  <Laptop className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">Secondary Laptop</span>
                    {currentRole === 'editor' && <Check className="w-4 h-4 text-blue-400" />}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Companion device for fast 4-digit attendance marking or classroom assistance.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Database Backup & Restore */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-indigo-400" />
              <span>Full Database Backup & Restore</span>
            </h4>
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-4">
              <p className="text-xs text-slate-300">
                You can download an instant snapshot of all students, class subjects, timetable slots, and marked attendance records as a portable JSON file.
              </p>
              
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Backup (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition border border-slate-600"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Restore from Backup</span>
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json,application/json"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={copyAppUrl}
                  className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition border border-slate-700 ml-auto"
                >
                  <Wifi className="w-3.5 h-3.5 text-sky-400" />
                  <span>{isCopied ? 'Link Copied!' : 'Copy Link for 2nd Laptop'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Devices */}
          {devices && devices.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Connected Laptops & Devices ({devices.length})
              </h4>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                {devices.map((d) => (
                  <div key={d.deviceId} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{d.deviceName}</span>
                          {d.isCurrentDevice && (
                            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-semibold border border-blue-500/30">
                              This Device
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">Last active: {d.lastSeen}</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {d.role === 'admin' ? 'Primary Admin' : 'Secondary'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Encrypted and resilient sync with local recovery</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
