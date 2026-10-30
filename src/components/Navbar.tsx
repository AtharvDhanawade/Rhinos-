import React from 'react';
import { ActiveTab, ClassSubject, DeviceRole } from '../types';
import { 
  Zap, 
  Users, 
  BookOpen, 
  Table2, 
  GraduationCap, 
  Clock, 
  Crown,
  Laptop,
  Radio,
  Bell,
  MessageSquare,
  Mail,
  FileText
} from 'lucide-react';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  classes: ClassSubject[];
  activeClassId: string;
  onSelectClass: (id: string) => void;
  todayMarkedCount: number;
  totalStudents: number;
  deviceRole?: DeviceRole;
  isFirebaseSynced?: boolean;
  connectedDevicesCount?: number;
  groupsCount?: number;
  pendingRemindersCount?: number;
  onOpenSyncModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  classes: _classes,
  activeClassId: _activeClassId,
  onSelectClass: _onSelectClass,
  todayMarkedCount,
  totalStudents,
  deviceRole = 'admin',
  isFirebaseSynced = true,
  connectedDevicesCount = 1,
  groupsCount = 0,
  pendingRemindersCount = 0,
  onOpenSyncModal
}) => {
  const percent = totalStudents > 0 ? Math.round((todayMarkedCount / totalStudents) * 100) : 0;

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-13 py-1">
          
          {/* Logo & Brand (Attendance removed from app name) */}
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20 text-white shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  RHINO <span className="text-blue-400 font-bold">( CR PORTAL )</span>
                </span>
              </div>
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                WOXEN UNI • CLASS REPRESENTATIVE
              </p>
            </div>
          </div>

          {/* Right Header Status Area */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Multi-Laptop Firebase Cloud Sync Badge */}
            <button
              onClick={onOpenSyncModal}
              title="Click to manage multi-laptop sync & device role"
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                deviceRole === 'admin'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/50 hover:border-amber-400'
                  : 'bg-blue-950/40 border-blue-500/40 text-blue-300 hover:bg-blue-900/50 hover:border-blue-400'
              }`}
            >
              {deviceRole === 'admin' ? (
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : (
                <Laptop className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              )}
              <span className="font-bold hidden sm:inline">
                {deviceRole === 'admin' ? 'Admin Laptop' : 'Secondary Laptop'}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync
              </span>
            </button>

            {/* Today's Status Meter */}
            <div className="flex items-center space-x-2 bg-slate-800/80 border border-slate-700/60 px-2.5 sm:px-3 py-1 rounded-lg text-xs">
              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-slate-400 text-[11px] hidden xs:inline">Today: </span>
                <span className="font-semibold text-white">{todayMarkedCount}/{totalStudents}</span>
                <span className="text-emerald-400 ml-1 font-bold">({percent}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 sm:space-x-1.5 border-t border-slate-800/80 pt-1.5 pb-1.5 overflow-x-auto no-scrollbar">
          <button
            id="tab-fast-entry"
            onClick={() => setActiveTab('fast-entry')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'fast-entry'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>1. Quick 4-Digit</span>
          </button>

          <button
            id="tab-students"
            onClick={() => setActiveTab('students')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'students'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-sky-300" />
            <span>2. Students</span>
          </button>

          <button
            id="tab-classes"
            onClick={() => setActiveTab('classes')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'classes'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-300" />
            <span>3. Classes</span>
          </button>

          <button
            id="tab-sheets"
            onClick={() => setActiveTab('sheets')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'sheets'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Table2 className="w-4 h-4 text-emerald-300" />
            <span>4. G-Sheet</span>
          </button>

          {/* New Tab 5: Subject Assignment Groups & Study PDFs */}
          <button
            id="tab-groups"
            onClick={() => setActiveTab('groups')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'groups'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-indigo-300" />
            <span>5. Groups & PDFs</span>
            {groupsCount > 0 && (
              <span className="ml-1 bg-indigo-500/30 text-indigo-200 text-[10px] px-1.5 py-0.2 rounded font-bold">
                {groupsCount}
              </span>
            )}
          </button>

          {/* Tab 6: Reminders */}
          <button
            id="tab-reminders"
            onClick={() => setActiveTab('reminders')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'reminders'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-300" />
            <span>6. Reminders</span>
            {pendingRemindersCount > 0 && (
              <span className="ml-1 bg-amber-500/30 text-amber-200 text-[10px] px-1.5 py-0.2 rounded font-bold">
                {pendingRemindersCount}
              </span>
            )}
          </button>

          {/* Tab 7: GMail */}
          <button
            id="tab-broadcast"
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'broadcast'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Mail className="w-4 h-4 text-rose-300" />
            <span>7. GMail</span>
          </button>

          <button
            id="tab-how-to-use"
            onClick={() => setActiveTab('how-to-use')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
              activeTab === 'how-to-use'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4 text-purple-300" />
            <span>Guide</span>
          </button>
        </nav>

      </div>
    </header>
  );
};
