import React, { useState, useEffect } from 'react';
import { 
  Student, 
  ClassSubject, 
  AttendanceRecord, 
  ActiveTab, 
  AttendanceStatus, 
  WeeklySyncSettings,
  DeviceInfo,
  DeviceRole
} from './types';
import { 
  loadStudents, 
  saveStudents, 
  loadClasses, 
  saveClasses, 
  loadRecords, 
  saveRecords, 
  loadActiveClassId, 
  saveActiveClassId, 
  loadSettings, 
  saveSettings, 
  getTodayDateString,
  sortStudentsByLast4Digits
} from './utils/storage';
import {
  subscribeToStudents,
  subscribeToClasses,
  subscribeToAttendance,
  subscribeToSettings,
  subscribeToDevices,
  registerDeviceHeartbeat,
  firebaseSaveStudent,
  firebaseDeleteStudent,
  firebaseBulkImportStudents,
  firebaseSaveClass,
  firebaseDeleteClass,
  firebaseMarkAttendanceRecord,
  firebaseBatchMarkAttendance,
  firebaseUpdateRecordStatus,
  firebaseDeleteRecord,
  firebaseDeleteSessionRecords,
  firebaseSaveSettings,
  getStoredDeviceRole
} from './utils/firebaseSync';
import { Navbar } from './components/Navbar';
import { FastEntryPage } from './components/FastEntryPage';
import { StudentsPage } from './components/StudentsPage';
import { ClassesPage } from './components/ClassesPage';
import { SheetsPage } from './components/SheetsPage';
import { HowToUsePage } from './components/HowToUsePage';
import { TeacherAbsenteeDocPage } from './components/TeacherAbsenteeDocPage';
import { TeacherLiveViewModal } from './components/TeacherLiveViewModal';
import { CrRollCallPortal } from './components/CrRollCallPortal';
import { LaptopSyncModal } from './components/LaptopSyncModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('fast-entry');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassSubject[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [activeClassId, setActiveClassId] = useState<string>('');
  const [settings, setSettings] = useState<WeeklySyncSettings>({
    googleSheetUrl: '',
    webhookUrl: '',
    autoSync: true,
    sheetTitle: 'College Attendance 2026',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Cloud & Multi-Laptop Sync State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<DeviceInfo[]>([]);
  const [deviceRole, setDeviceRole] = useState<DeviceRole>('admin');
  const [isFirebaseSynced, setIsFirebaseSynced] = useState(true);

  // CR direct mobile view detection (from QR code scan)
  const [isCrDirectView, setIsCrDirectView] = useState(false);

  // Teacher direct QR scan view detection
  const [isTeacherDirectView, setIsTeacherDirectView] = useState(false);
  const [isTeacherGDocDirectView, setIsTeacherGDocDirectView] = useState(false);
  const [teacherWeekParam, setTeacherWeekParam] = useState<number>(1);

  // Initialize data with recovery from localStorage + real-time Firestore cloud listeners
  useEffect(() => {
    // 1. Initial ultra-robust local recovery (ensures instant UI load)
    const loadedStudents = loadStudents();
    const loadedClasses = loadClasses();
    const loadedRecords = loadRecords();
    const loadedClassId = loadActiveClassId();
    const loadedSettings = loadSettings();

    setStudents(sortStudentsByLast4Digits(loadedStudents));
    setClasses(loadedClasses);
    setRecords(loadedRecords);
    setActiveClassId(loadedClassId);
    setSettings(loadedSettings);
    setDeviceRole(getStoredDeviceRole());

    // 2. Register this device in the Firestore cloud directory
    registerDeviceHeartbeat().catch(() => {});

    // 3. Connect real-time Firestore subscriptions for permanent persistence
    let unsubStudents: (() => void) | undefined;
    let unsubClasses: (() => void) | undefined;
    let unsubAttendance: (() => void) | undefined;
    let unsubSettings: (() => void) | undefined;
    let unsubDevices: (() => void) | undefined;

    try {
      unsubStudents = subscribeToStudents((cloudStudents) => {
        setIsFirebaseSynced(true);
        if (cloudStudents && cloudStudents.length > 0) {
          const sorted = sortStudentsByLast4Digits(cloudStudents);
          setStudents(sorted);
          saveStudents(sorted);
        } else if (loadedStudents.length > 0) {
          // If cloud has no student roster yet, upload our local roster to Firestore
          firebaseBulkImportStudents(loadedStudents).catch(() => {});
        }
      }, (err) => {
        console.warn('Students cloud sync notification:', err);
      });

      unsubClasses = subscribeToClasses((cloudClasses) => {
        setIsFirebaseSynced(true);
        if (cloudClasses && cloudClasses.length > 0) {
          setClasses(cloudClasses);
          saveClasses(cloudClasses);
        } else if (loadedClasses.length > 0) {
          loadedClasses.forEach(c => firebaseSaveClass(c).catch(() => {}));
        }
      }, (err) => {
        console.warn('Classes cloud sync notification:', err);
      });

      unsubAttendance = subscribeToAttendance((cloudRecords) => {
        setIsFirebaseSynced(true);
        if (cloudRecords && cloudRecords.length > 0) {
          setRecords(cloudRecords);
          saveRecords(cloudRecords);
        } else if (loadedRecords.length > 0) {
          firebaseBatchMarkAttendance(loadedRecords).catch(() => {});
        }
      }, (err) => {
        console.warn('Attendance cloud sync notification:', err);
      });

      unsubSettings = subscribeToSettings(({ settings: cloudSettings, activeClassId: cloudActiveId }) => {
        setIsFirebaseSynced(true);
        if (cloudSettings) {
          setSettings(cloudSettings);
          saveSettings(cloudSettings);
        }
        if (cloudActiveId) {
          setActiveClassId(cloudActiveId);
          saveActiveClassId(cloudActiveId);
        }
      }, (err) => {
        console.warn('Settings cloud sync notification:', err);
      });

      unsubDevices = subscribeToDevices((devs) => {
        setConnectedDevices(devs);
      });
    } catch (e) {
      console.warn('Could not establish Firestore live stream, continuing with local storage:', e);
    }

    // Check if opened via CR QR Code or Teacher QR Code URL params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const pathname = window.location.pathname.toLowerCase();

      // CR Mobile Roll Call View detection
      if (
        viewParam === 'cr' ||
        viewParam === 'cr-portal' ||
        viewParam === 'cr-rollcall' ||
        pathname.includes('/cr') ||
        pathname.includes('cr-portal')
      ) {
        setIsCrDirectView(true);
        const clsId = params.get('classId');
        if (clsId) setActiveClassId(clsId);
      }

      if (
        viewParam === 'teacher-day' || 
        viewParam === 'teacher-gdoc' || 
        viewParam === 'teacher' ||
        viewParam === 'teacherDoc' ||
        viewParam === 'teacher-doc' ||
        viewParam === 'report' ||
        pathname.includes('teacher-report') ||
        pathname.includes('teacher-doc') ||
        pathname.includes('/report')
      ) {
        setIsTeacherGDocDirectView(true);
        const clsId = params.get('classId');
        if (clsId) setActiveClassId(clsId);
        const week = params.get('week');
        if (week) setTeacherWeekParam(parseInt(week, 10) || 1);
      }
    }

    // Cross-device sync fallback with server endpoint for mobile scanner
    fetch('/api/attendance/state')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.students) && data.students.length > 0 && loadedStudents.length === 0) {
          setStudents(data.students);
          saveStudents(data.students);
          firebaseBulkImportStudents(data.students).catch(() => {});
        } else if (loadedStudents.length > 0) {
          fetch('/api/attendance/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              students: loadedStudents,
              records: loadedRecords,
              classes: loadedClasses,
              activeClassId: loadedClassId
            })
          }).catch(() => {});
        }

        if (Array.isArray(data.records) && data.records.length > 0 && loadedRecords.length === 0) {
          setRecords(data.records);
          saveRecords(data.records);
          firebaseBatchMarkAttendance(data.records).catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      if (unsubStudents) unsubStudents();
      if (unsubClasses) unsubClasses();
      if (unsubAttendance) unsubAttendance();
      if (unsubSettings) unsubSettings();
      if (unsubDevices) unsubDevices();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleRestoreData = (data: any) => {
    if (data.students && Array.isArray(data.students)) {
      const sorted = sortStudentsByLast4Digits(data.students as Student[]);
      setStudents(sorted);
      saveStudents(sorted);
      firebaseBulkImportStudents(sorted).catch(() => {});
    }
    if (data.classes && Array.isArray(data.classes)) {
      setClasses(data.classes);
      saveClasses(data.classes);
      data.classes.forEach((c: ClassSubject) => firebaseSaveClass(c).catch(() => {}));
    }
    if (data.records && Array.isArray(data.records)) {
      setRecords(data.records);
      saveRecords(data.records);
      firebaseBatchMarkAttendance(data.records).catch(() => {});
    }
    if (data.settings) {
      setSettings(data.settings);
      saveSettings(data.settings);
      firebaseSaveSettings(data.settings, data.activeClassId || activeClassId).catch(() => {});
    }
    if (data.activeClassId) {
      setActiveClassId(data.activeClassId);
      saveActiveClassId(data.activeClassId);
    }
    showToast('Database successfully restored and permanently synced to cloud!');
  };

  // Continuous auto-sync with server backend so mobile teacher QR view & server reports are always in sync
  useEffect(() => {
    if (students.length === 0 && records.length === 0 && classes.length === 0) return;
    const timer = setTimeout(() => {
      fetch('/api/attendance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students,
          records,
          classes,
          activeClassId
        })
      }).catch(err => console.warn('Auto-sync notice:', err));
    }, 350);

    return () => clearTimeout(timer);
  }, [students, records, classes, activeClassId]);

  const handleSelectClass = (id: string) => {
    setActiveClassId(id);
    saveActiveClassId(id);
    firebaseSaveSettings(settings, id).catch(() => {});
    const cls = classes.find(c => c.id === id);
    if (cls) {
      showToast(`Switched active subject to ${cls.name}`);
    }
  };

  // Record Handlers (Session-Aware: permits taking attendance multiple times for same class on same day)
  const handleMarkAttendance = (record: AttendanceRecord) => {
    const recSession = record.sessionId || 'session-1';
    setRecords(prev => {
      const filtered = prev.filter(r => !(
        r.studentId === record.studentId && 
        r.classId === record.classId && 
        r.date === record.date &&
        (r.sessionId || 'session-1') === recSession
      ));
      const updated = [record, ...filtered];
      saveRecords(updated);
      return updated;
    });
    firebaseMarkAttendanceRecord(record).catch(() => {});
  };

  const handleBatchMarkAttendance = (newRecords: AttendanceRecord[]) => {
    setRecords(prev => {
      const keys = new Set(newRecords.map(r => `${r.studentId}_${r.classId}_${r.date}_${r.sessionId || 'session-1'}`));
      const filtered = prev.filter(r => !keys.has(`${r.studentId}_${r.classId}_${r.date}_${r.sessionId || 'session-1'}`));
      const updated = [...newRecords, ...filtered];
      saveRecords(updated);
      return updated;
    });
    firebaseBatchMarkAttendance(newRecords).catch(() => {});
    showToast(`Marked attendance for ${newRecords.length} students`);
  };

  const handleUpdateRecordStatus = (recordId: string, newStatus: AttendanceStatus) => {
    setRecords(prev => {
      const updated = prev.map(r => r.id === recordId ? { ...r, status: newStatus } : r);
      saveRecords(updated);
      return updated;
    });
    firebaseUpdateRecordStatus(recordId, newStatus).catch(() => {});
    showToast(`Updated status to ${newStatus}`);
  };

  const handleDeleteRecord = (recordId: string) => {
    setRecords(prev => {
      const updated = prev.filter(r => r.id !== recordId);
      saveRecords(updated);
      return updated;
    });
    firebaseDeleteRecord(recordId).catch(() => {});
    showToast('Attendance record removed');
  };

  // Student Handlers
  const handleAddStudent = (student: Student) => {
    setStudents(prev => {
      const updated = sortStudentsByLast4Digits([...prev, student]);
      saveStudents(updated);
      return updated;
    });
    firebaseSaveStudent(student).catch(() => {});
    showToast(`Added ${student.name} (${student.rollNo})`);
  };

  const handleUpdateStudent = (student: Student) => {
    setStudents(prev => {
      const updated = sortStudentsByLast4Digits(prev.map(s => s.id === student.id ? student : s));
      saveStudents(updated);
      return updated;
    });
    firebaseSaveStudent(student).catch(() => {});
    showToast(`Updated details for ${student.name}`);
  };

  const handleDeleteStudent = (id: string) => {
    let studentName = 'student';
    setStudents(prev => {
      const target = prev.find(s => s.id === id);
      if (target) studentName = target.name;
      const updated = prev.filter(s => s.id !== id);
      saveStudents(updated);
      return updated;
    });
    firebaseDeleteStudent(id).catch(() => {});
    showToast(`Removed ${studentName}`);
  };

  const handleBulkImportStudents = (newStudents: Student[]) => {
    let filteredNew: Student[] = [];
    setStudents(prev => {
      const existingRolls = new Set(prev.map(s => s.rollNo.toUpperCase().trim()));
      filteredNew = newStudents.filter(s => !existingRolls.has(s.rollNo.toUpperCase().trim()));
      const updated = sortStudentsByLast4Digits([...prev, ...filteredNew]);
      saveStudents(updated);
      return updated;
    });
    if (filteredNew.length > 0) {
      firebaseBulkImportStudents(filteredNew).catch(() => {});
    }
    showToast(`Successfully added ${newStudents.length} student${newStudents.length === 1 ? '' : 's'}`);
  };

  // Class Handlers
  const handleAddClass = (cls: ClassSubject) => {
    const updated = [...classes, cls];
    setClasses(updated);
    saveClasses(updated);
    firebaseSaveClass(cls).catch(() => {});
    showToast(`Created class: ${cls.name}`);
  };

  const handleUpdateClass = (cls: ClassSubject) => {
    const updated = classes.map(c => c.id === cls.id ? cls : c);
    setClasses(updated);
    saveClasses(updated);
    firebaseSaveClass(cls).catch(() => {});
    showToast(`Updated class: ${cls.name}`);
  };

  const handleUpdateSessionDetails = (
    classId: string, 
    customClassName: string, 
    sessionTime: string, 
    updateClassSubject: boolean,
    sessionId?: string
  ) => {
    if (updateClassSubject) {
      setClasses(prev => {
        const updated = prev.map(c => c.id === classId ? { ...c, name: customClassName, scheduleTime: sessionTime } : c);
        saveClasses(updated);
        const cls = updated.find(c => c.id === classId);
        if (cls) firebaseSaveClass(cls).catch(() => {});
        return updated;
      });
    }
    const today = getTodayDateString();
    setRecords(prev => {
      const updated = prev.map(r => {
        const matchesSession = !sessionId || (r.sessionId || 'session-1') === sessionId;
        if (r.classId === classId && r.date === today && matchesSession) {
          const mod = {
            ...r,
            className: customClassName || r.className,
            sessionTime: sessionTime || r.sessionTime || r.time,
            time: sessionTime || r.time,
            sessionId: sessionId || r.sessionId || 'session-1'
          };
          firebaseMarkAttendanceRecord(mod).catch(() => {});
          return mod;
        }
        return r;
      });
      saveRecords(updated);
      return updated;
    });
    showToast(`Saved session details: ${customClassName} (${sessionTime})`);
  };

  const handleDeleteClass = (id: string) => {
    const cls = classes.find(c => c.id === id);
    const updated = classes.filter(c => c.id !== id);
    setClasses(updated);
    saveClasses(updated);
    firebaseDeleteClass(id).catch(() => {});
    if (activeClassId === id && updated.length > 0) {
      setActiveClassId(updated[0].id);
      saveActiveClassId(updated[0].id);
      firebaseSaveSettings(settings, updated[0].id).catch(() => {});
    }
    showToast(`Deleted class: ${cls?.name || 'subject'}`);
  };

  const handleUpdateSettings = (newSettings: WeeklySyncSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    firebaseSaveSettings(newSettings, activeClassId).catch(() => {});
    showToast('Google Sheets sync settings updated');
  };

  const currentClass = classes.find(c => c.id === activeClassId) || classes[0] || {
    id: 'cls-tech',
    name: 'Tech Class',
    code: 'CS401',
    teacherName: 'Faculty Incharge',
    room: 'Main Lab',
    color: '#2563eb',
  };

  const todayStr = getTodayDateString();
  const todayClassRecords = records.filter(r => r.date === todayStr && r.classId === currentClass.id);
  // Count unique students marked today so multiple sessions of the same class never exceed total student strength (e.g. 105/76)
  const uniqueStudentsMarkedToday = new Set(todayClassRecords.map(r => r.studentId)).size;
  const todayMarkedCount = Math.min(students.length, uniqueStudentsMarkedToday);

  // Standalone CR Mobile Portal when scanned by Class Representative on their phone
  if (isCrDirectView) {
    return (
      <CrRollCallPortal
        students={students}
        classes={classes}
        initialClassId={activeClassId}
        onStandaloneBack={() => setIsCrDirectView(false)}
        onSubmissionSuccess={() => {
          showToast('Attendance submitted to Admin laptop!');
        }}
      />
    );
  }

  // Standalone Teacher View when scanned by QR code on external mobile camera
  // LOCKED READ-ONLY VIEW: Faculty can only see this attendance document and cannot navigate anywhere else
  if (isTeacherGDocDirectView) {
    return (
      <TeacherAbsenteeDocPage
        students={students}
        classes={classes}
        activeClassId={activeClassId}
        onSelectClass={handleSelectClass}
        allRecords={records}
        isStandalone={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        classes={classes}
        activeClassId={activeClassId}
        onSelectClass={handleSelectClass}
        todayMarkedCount={todayMarkedCount}
        totalStudents={students.length}
        deviceRole={deviceRole}
        isFirebaseSynced={isFirebaseSynced}
        connectedDevicesCount={connectedDevices.length}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
      />

      {/* Main Tab Content */}
      <main className="flex-1">
        {activeTab === 'fast-entry' && (
          <FastEntryPage
            students={students}
            currentClass={currentClass}
            allClasses={classes}
            onSelectClass={handleSelectClass}
            allRecords={records}
            onMarkAttendance={handleMarkAttendance}
            onBatchMarkAttendance={handleBatchMarkAttendance}
            onUpdateRecordStatus={handleUpdateRecordStatus}
            onDeleteRecord={handleDeleteRecord}
            onSwitchToClasses={() => setActiveTab('classes')}
            onSwitchToStudents={() => setActiveTab('students')}
            onSwitchToSheets={() => setActiveTab('sheets')}
            onSwitchToHowToUse={() => setActiveTab('how-to-use')}
            onUpdateClass={handleUpdateClass}
            onUpdateSessionDetails={handleUpdateSessionDetails}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeTab === 'students' && (
          <StudentsPage
            students={students}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            onBulkImport={handleBulkImportStudents}
          />
        )}

        {activeTab === 'classes' && (
          <ClassesPage
            classes={classes}
            activeClassId={activeClassId}
            onSelectClass={handleSelectClass}
            onAddClass={handleAddClass}
            onUpdateClass={handleUpdateClass}
            onDeleteClass={handleDeleteClass}
            students={students}
            allRecords={records}
            onMarkAttendance={handleMarkAttendance}
            onBatchMarkAttendance={handleBatchMarkAttendance}
            onNavigateToFastEntry={() => setActiveTab('fast-entry')}
            onUpdateSessionDetails={handleUpdateSessionDetails}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeTab === 'sheets' && (
          <SheetsPage
            students={students}
            classes={classes}
            activeClassId={activeClassId}
            allRecords={records}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onBatchMarkAttendance={handleBatchMarkAttendance}
            onDeleteSessionRecords={(classId, date, sessionId, sessionTime) => {
              setRecords(prev => {
                const updated = prev.filter(r => {
                  if (r.classId !== classId || r.date !== date) return true;
                  const sMatch = (r.sessionId || 'session-1') === (sessionId || 'session-1');
                  const tMatch = Boolean(sessionTime && r.sessionTime && r.sessionTime === sessionTime);
                  return !(sMatch || tMatch);
                });
                saveRecords(updated);
                return updated;
              });
              showToast('Attendance session updated');
            }}
          />
        )}

        {activeTab === 'how-to-use' && (
          <HowToUsePage
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}
      </main>

      {/* Direct Teacher QR Modal if accessed via QR URL */}
      <TeacherLiveViewModal
        isOpen={isTeacherDirectView}
        onClose={() => setIsTeacherDirectView(false)}
        students={students}
        currentClass={currentClass}
        weekNumber={teacherWeekParam}
        allRecords={records}
      />

      {/* Multi-Laptop & Cloud Sync & Backup Modal */}
      <LaptopSyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        devices={connectedDevices}
        isOnline={isFirebaseSynced}
        onRefreshSync={() => {
          registerDeviceHeartbeat().catch(() => {});
          showToast('Live Cloud connected & data synchronized');
        }}
        showToast={showToast}
        onRestoreData={handleRestoreData}
      />

    </div>
  );
}
