import { Student, ClassSubject, AttendanceRecord, WeeklySyncSettings } from '../types';

export function extractLast4Digits(rollNo: string): string {
  if (!rollNo) return '';
  // Extract all digits first if available
  const digitsOnly = rollNo.replace(/\D/g, '');
  if (digitsOnly.length >= 4) {
    return digitsOnly.slice(-4);
  }
  // If fewer digits, pad or take raw string slice
  const cleanStr = rollNo.trim();
  return cleanStr.length >= 4 ? cleanStr.slice(-4) : cleanStr.padStart(4, '0');
}

/**
 * Sorts students in ascending order based on the last 4 digits of their roll numbers.
 * Handles numeric values naturally (e.g. 1001 < 1002 < 1010) as well as alphanumeric suffixes.
 */
export function sortStudentsByLast4Digits(students: Student[]): Student[] {
  if (!Array.isArray(students)) return [];
  return [...students].sort((a, b) => {
    const aLast = (a.last4Digits || extractLast4Digits(a.rollNo) || '').trim();
    const bLast = (b.last4Digits || extractLast4Digits(b.rollNo) || '').trim();

    const numA = parseInt(aLast, 10);
    const numB = parseInt(bLast, 10);

    // If both are numbers, compare numerically in ascending order
    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA !== numB) {
        return numA - numB;
      }
    }

    // Natural alphanumeric comparison as fallback
    const cmp = aLast.localeCompare(bLast, undefined, { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;

    // Full roll number secondary sort
    return (a.rollNo || '').localeCompare(b.rollNo || '', undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function getWeekNumber(d: Date = new Date()): number {
  // ISO week calculation
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekDateRange(weekNum: number, year: number = new Date().getFullYear()): { start: string; end: string; days: { dateStr: string; dayName: string; dayNum: number }[] } {
  // Simple calculation of Monday-Friday dates for a given ISO week
  const simple = new Date(year, 0, 1 + (weekNum - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }

  const days: { dateStr: string; dayName: string; dayNum: number }[] = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  for (let i = 0; i < 5; i++) {
    const current = new Date(ISOweekStart);
    current.setDate(ISOweekStart.getDate() + i);
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    days.push({
      dateStr,
      dayName: dayNames[i],
      dayNum: i + 1, // 1 for Monday to 5 for Friday
    });
  }

  return {
    start: days[0].dateStr,
    end: days[4].dateStr,
    days,
  };
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 
  'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-cyan-500', 'bg-fuchsia-500'
];

export const FAKE_STUDENT_IDS = new Set([
  'std-1001', 'std-1002', 'std-1003', 'std-1004', 'std-1005', 
  'std-1006', 'std-1007', 'std-1008', 'std-1009', 'std-1010'
]);

export const FAKE_STUDENT_NAMES = new Set([
  'aarav sharma', 'ananya patel', 'rohan verma', 'ishita gupta', 'vikram malhotra',
  'pooja reddy', 'kabir mehta', 'sneha nair', 'aditya joshi', 'priya rao'
]);

export function isFakeStudent(s: any): boolean {
  if (!s) return false;
  if (s.id && FAKE_STUDENT_IDS.has(s.id)) return true;
  if (s.name && FAKE_STUDENT_NAMES.has(String(s.name).trim().toLowerCase()) && String(s.email || '').includes('@college.edu')) return true;
  if (s.rollNo && /^2026CS10(0[1-9]|10)$/i.test(String(s.rollNo).trim()) && String(s.email || '').includes('@college.edu')) return true;
  return false;
}

// Initial roster is completely empty so user starts with a clean slate
export const INITIAL_STUDENTS: Student[] = [];

export const DEFAULT_CLASS_TIMES = [
  '09:00 AM - 10:00 AM',
  '10:00 AM - 11:00 AM',
  '11:15 AM - 12:15 PM',
  '01:00 PM - 02:00 PM',
  '02:00 PM - 03:00 PM',
];

export const INITIAL_CLASSES: ClassSubject[] = [
  {
    id: 'cls-tech',
    name: 'Tech Class',
    code: 'CS401',
    teacherName: 'Prof. Rajesh Sharma',
    teacherEmail: 'sharma.faculty@college.edu',
    room: 'Lab 304',
    color: '#2563eb', // Blue
    scheduleTime: '09:30 AM - 11:00 AM',
    classTimes: ['09:30 AM - 11:00 AM', '11:15 AM - 12:45 PM', '02:00 PM - 03:30 PM']
  },
  {
    id: 'cls-comm',
    name: 'Communication Class',
    code: 'HS201',
    teacherName: 'Prof. Sunita Rao',
    teacherEmail: 's.rao@college.edu',
    room: 'Seminar Hall B',
    color: '#059669', // Emerald
    scheduleTime: '11:15 AM - 12:45 PM',
    classTimes: ['10:00 AM - 11:00 AM', '11:15 AM - 12:45 PM', '01:30 PM - 02:30 PM']
  }
];

const STORAGE_KEYS = {
  STUDENTS: 'cr_attendance_students_clean_v2',
  CLASSES: 'cr_attendance_classes_clean_v2',
  RECORDS: 'cr_attendance_records_clean_v2',
  ACTIVE_CLASS: 'cr_attendance_active_class_clean_v2',
  SETTINGS: 'cr_attendance_settings_clean_v2',
  GLOBAL_CLASS_TIMES: 'cr_custom_class_times_v1',
};

export function loadStudents(): Student[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) {
      // Check legacy key if user had real students
      const legacyRaw = localStorage.getItem('cr_attendance_students_v1');
      if (legacyRaw) {
        try {
          const legParsed = JSON.parse(legacyRaw);
          if (Array.isArray(legParsed)) {
            const real = legParsed.filter(s => !isFakeStudent(s));
            if (real.length > 0) {
              const sorted = sortStudentsByLast4Digits(real);
              localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(sorted));
              return sorted;
            }
          }
        } catch {}
      }
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Strictly filter out any fake demo students and sort by ascending last 4 digits
      const real = parsed.filter(s => !isFakeStudent(s));
      const sorted = sortStudentsByLast4Digits(real);
      if (real.length !== parsed.length || JSON.stringify(sorted) !== raw) {
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(sorted));
      }
      return sorted;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveStudents(students: Student[]) {
  const sorted = sortStudentsByLast4Digits(students);
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(sorted));
}

export function loadClasses(): ClassSubject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLASSES);
    if (!raw) {
      localStorage.removeItem('cr_attendance_classes_v1');
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(INITIAL_CLASSES));
      return INITIAL_CLASSES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_CLASSES;
  }
}

export function saveClasses(classes: ClassSubject[]) {
  localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
}

export function loadRecords(): AttendanceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (!raw) {
      localStorage.removeItem('cr_attendance_records_v1');
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Filter out any legacy demo records
      const clean = parsed.filter((r: AttendanceRecord) => !r.studentId?.match(/^std-(1[0-5]|[1-9])$/));
      return clean;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveRecords(records: AttendanceRecord[]) {
  localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
}

export function loadActiveClassId(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_CLASS);
    return raw || INITIAL_CLASSES[0].id;
  } catch {
    return INITIAL_CLASSES[0].id;
  }
}

export function saveActiveClassId(classId: string) {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_CLASS, classId);
}

export function loadSettings(): WeeklySyncSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) {
      const def: WeeklySyncSettings = {
        googleSheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
        webhookUrl: '',
        autoSync: true,
        sheetTitle: 'College Attendance 2026 - CS Branch',
        lastSyncedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(def));
      return def;
    }
    return JSON.parse(raw);
  } catch {
    return {
      googleSheetUrl: '',
      webhookUrl: '',
      autoSync: true,
      sheetTitle: 'College Attendance 2026',
    };
  }
}

export function saveSettings(settings: WeeklySyncSettings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function loadGlobalClassTimes(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GLOBAL_CLASS_TIMES);
    if (!raw) return DEFAULT_CLASS_TIMES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CLASS_TIMES;
  } catch {
    return DEFAULT_CLASS_TIMES;
  }
}

export function saveGlobalClassTimes(times: string[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.GLOBAL_CLASS_TIMES, JSON.stringify(times));
  } catch {
    // ignore
  }
}

export function exportFullDatabaseBackup(): string {
  try {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      students: loadStudents(),
      classes: loadClasses(),
      records: loadRecords(),
      activeClassId: loadActiveClassId(),
      settings: loadSettings(),
      globalClassTimes: loadGlobalClassTimes(),
    };
    return JSON.stringify(backup, null, 2);
  } catch (e) {
    console.error('Failed to export full database backup:', e);
    return '{}';
  }
}

export function downloadBackupFile(): void {
  try {
    const jsonStr = exportFullDatabaseBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rhino_attendance_backup_${getTodayDateString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to download backup:', err);
  }
}

export function restoreFullDatabaseBackup(jsonString: string): boolean {
  try {
    const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    if (!parsed || typeof parsed !== 'object') return false;

    if (Array.isArray(parsed.students)) {
      saveStudents(parsed.students);
    }
    if (Array.isArray(parsed.classes)) {
      saveClasses(parsed.classes);
    }
    if (Array.isArray(parsed.records)) {
      saveRecords(parsed.records);
    }
    if (parsed.activeClassId) {
      saveActiveClassId(parsed.activeClassId);
    }
    if (parsed.settings) {
      saveSettings(parsed.settings);
    }
    if (Array.isArray(parsed.globalClassTimes)) {
      saveGlobalClassTimes(parsed.globalClassTimes);
    }
    return true;
  } catch (e) {
    console.error('Failed to restore backup:', e);
    return false;
  }
}
