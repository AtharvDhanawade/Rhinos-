export type AttendanceStatus = 'present' | 'absent' | 'onduty' | 'late';

export interface Student {
  id: string;
  name: string;
  rollNo: string;        // Full roll number, e.g. "2024CS1042"
  last4Digits: string;   // Last 4 digits, e.g. "1042"
  phone: string;
  email: string;
  batch?: string;
  avatarColor?: string;
  notes?: string;
}

export interface ClassSubject {
  id: string;
  name: string;          // e.g. "Tech Class", "Communication Class"
  code: string;          // e.g. "CS301", "HS102"
  teacherName: string;   // e.g. "Prof. Rajesh Sharma"
  teacherEmail?: string;
  room: string;          // e.g. "Lab 402", "LH-10"
  color: string;         // Hex or Tailwind color class
  scheduleTime?: string; // e.g. "09:00 AM - 10:30 AM"
  classTimes?: string[]; // Custom time slots for this class, e.g. ["09:00 AM - 10:00 AM", "11:15 AM - 12:15 PM"]
  sheetTabName?: string; // Custom tab/page name in Google Sheets, e.g. "Tech Class (CS401)"
  customGoogleSheetUrl?: string; // Optional dedicated Google Sheet URL for this specific class
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentRollNo: string;
  studentName: string;
  studentLast4: string;
  classId: string;
  className: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:mm:ss
  status: AttendanceStatus;
  weekNumber: number;    // Week 1, Week 2, etc.
  dayOfWeek: number;     // 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat, 0 = Sun
  markedVia: 'fast_4digit' | 'roll_call' | 'manual';
  timestamp: number;
  sessionId?: string;    // e.g. "session-1", "session-2", or slot identifier
  sessionTime?: string;  // e.g. "10:00 AM - 11:00 AM", "02:00 PM - 03:00 PM"
  sessionTitle?: string; // e.g. "1st Class", "2nd Class", "Lab Session"
}

export interface ClassSessionMeta {
  id: string;
  classId: string;
  title: string;
  time: string;
  customClassName?: string;
  date?: string;
}

export interface WeeklySyncSettings {
  googleSheetUrl: string;
  webhookUrl: string;
  autoSync: boolean;
  sheetTitle: string;
  lastSyncedAt?: string;
  sheetId?: string;
  autoAppendOnSave?: boolean;
  includeSheetInReport?: boolean;
  syncStrategy?: 'per_class_tabs' | 'single_tab' | 'separate_sheets'; // option to sync each class to a page/tab in a sheet or separate sheets
  classTabNames?: Record<string, string>; // classId -> Tab Name (page in sheet) e.g. { "cls-tech": "Tech Class", "cls-comm": "Communication Class" }
  classSheetUrls?: Record<string, string>; // classId -> custom Google Sheet URL if separate sheets desired
}

export interface CrSubmission {
  id: string;
  classId: string;
  className: string;
  date: string;
  time: string;
  records: AttendanceRecord[];
  presentCount: number;
  absentCount: number;
  onDutyCount?: number;
  lateCount: number;
  total: number;
  submittedBy: string;
  timestamp: number;
  isoTime: string;
}

export type DeviceRole = 'admin' | 'editor';

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  role: DeviceRole;
  lastSeen: string;
  userEmail?: string;
  isCurrentDevice?: boolean;
}

export interface AssignmentGroup {
  id: string;
  subjectId: string;
  groupNumber: number;
  groupName: string; // e.g. "Group 1", "Team Alpha"
  topic?: string;
  leaderStudentId?: string; // Optional team lead / POC
  semester?: string; // Semester or Academic Year (e.g. "Full Semester 2026")
  memberStudentIds: string[]; // student ids in ascending roll order
  targetDate?: string; // presentation or submission date YYYY-MM-DD
  presentationStatus?: 'pending' | 'completed' | 'rescheduled';
  rescheduledDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GmailConfig {
  email: string;
  appPassword?: string;
  senderName?: string;
  isConnected?: boolean;
}

export interface SubjectMaterial {
  id: string;
  subjectId: string;
  title: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  uploadedBy?: string;
  notes?: string;
  storageKey?: string;
  fileDataUrl?: string; // fallback preview data
}

export interface ClassReminder {
  id: string;
  subjectId: string; // classId or 'all'
  title: string;
  type: 'presentation' | 'assignment' | 'project' | 'exam' | 'quiz' | 'general';
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // e.g. "11:59 PM" or "10:00 AM"
  informDate?: string; // YYYY-MM-DD (when CR should alert the class)
  description?: string;
  completedGroupIds?: string[]; // group IDs that completed
  rescheduledGroupDates?: Record<string, string>; // groupId -> new date
  isCompleted?: boolean;
  createdAt: string;
}

export type ActiveTab = 
  | 'fast-entry' 
  | 'students' 
  | 'classes' 
  | 'sheets' 
  | 'groups' 
  | 'reminders' 
  | 'broadcast' 
  | 'how-to-use';

