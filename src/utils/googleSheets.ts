import { AttendanceRecord, ClassSubject, Student, WeeklySyncSettings } from '../types';
import { sortStudentsByLast4Digits } from './storage';

/**
 * Extracts the spreadsheet ID from any Google Sheets URL or raw ID string.
 * Supports:
 * - https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * - https://docs.google.com/spreadsheets/d/e/2PACX-.../pubhtml
 * - 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
 */
export function extractGoogleSheetId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const clean = urlOrId.trim();

  // Pattern: /spreadsheets/d/([a-zA-Z0-9-_]+)
  const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // If already looks like a bare Google Sheet ID (alphanumeric, 20+ chars)
  if (/^[a-zA-Z0-9-_]{20,}$/.test(clean)) {
    return clean;
  }

  return null;
}

export function isValidGoogleSheetUrl(urlOrId: string): boolean {
  if (!urlOrId) return false;
  const clean = urlOrId.trim();
  if (clean.includes('docs.google.com/spreadsheets')) return true;
  return extractGoogleSheetId(clean) !== null;
}

export function normalizeGoogleSheetUrl(urlOrId: string): string {
  const clean = urlOrId.trim();
  const sheetId = extractGoogleSheetId(clean);
  if (sheetId && !clean.includes('http')) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  }
  return clean;
}

export interface SheetSessionPayload {
  classId: string;
  className: string;
  sheetTabName?: string; // Target page/tab in the Google Sheet, e.g. "Tech Class" or "CS401"
  tabName?: string; // Target tab alias
  date: string;
  time: string;
  sessionId?: string;
  sessionTitle?: string;
  teacherName?: string;
  room?: string;
  totalEnrolled: number;
  presentCount: number;
  absentCount: number;
  onDutyCount?: number;
  lateCount?: number;
  attendancePercent: number;
  absenteeRolls: string[];
  absenteeNames: string[];
  absenteeDetails: string;
  onDutyRolls?: string[];
  onDutyNames?: string[];
  onDutyDetails?: string;
  studentRecords: Array<{
    rollNo: string;
    last4Digits: string;
    name: string;
    status: string;
  }>;
}

export interface BuildSessionPayloadOptions {
  currentClass: ClassSubject;
  date?: string;
  todayDateStr?: string;
  time?: string;
  currentSessionTime?: string;
  students: Student[];
  records?: AttendanceRecord[];
  todayRecords?: AttendanceRecord[];
  customClassName?: string;
  customTabName?: string;
  settings?: WeeklySyncSettings;
}

/**
 * Builds the session payload ready for Google Sheet appending
 */
export function buildSheetSessionPayload(
  arg1: ClassSubject | BuildSessionPayloadOptions,
  arg2?: string,
  arg3?: string,
  arg4?: Student[],
  arg5?: AttendanceRecord[],
  arg6?: string,
  arg7?: string
): SheetSessionPayload {
  let currentClass: ClassSubject;
  let date: string;
  let time: string;
  let students: Student[];
  let todayRecords: AttendanceRecord[];
  let customClassName: string | undefined;
  let customTabName: string | undefined;

  if (typeof arg1 === 'object' && 'students' in arg1 && ('records' in arg1 || 'todayRecords' in arg1 || 'currentSessionTime' in arg1 || 'todayDateStr' in arg1)) {
    const opts = arg1 as BuildSessionPayloadOptions;
    currentClass = opts.currentClass;
    date = opts.date || opts.todayDateStr || new Date().toISOString().split('T')[0];
    time = opts.time || opts.currentSessionTime || '10:00 AM - 11:00 AM';
    students = opts.students;
    todayRecords = opts.records || opts.todayRecords || [];
    customClassName = opts.customClassName;
    customTabName = opts.customTabName;
  } else {
    currentClass = arg1 as ClassSubject;
    date = arg2 || new Date().toISOString().split('T')[0];
    time = arg3 || '10:00 AM - 11:00 AM';
    students = arg4 || [];
    todayRecords = arg5 || [];
    customClassName = arg6;
    customTabName = arg7;
  }

  const recordMap = new Map<string, AttendanceRecord>();
  todayRecords.forEach(r => recordMap.set(r.studentId, r));

  const finalClassName = customClassName?.trim() || currentClass.name;
  const finalTabName = (customTabName || currentClass.sheetTabName || currentClass.name).trim();

  let presentCount = 0;
  let absentCount = 0;
  let onDutyCount = 0;

  const sortedStudents = sortStudentsByLast4Digits(students);
  const studentRecords = sortedStudents.map(s => {
    const rec = recordMap.get(s.id);
    let status = 'absent';
    if (rec) {
      status = rec.status;
    }
    if (status === 'present') presentCount++;
    else if (status === 'onduty' || status === 'late') onDutyCount++;
    else absentCount++;

    const displayStatus = status === 'present' ? 'PRESENT' : (status === 'onduty' || status === 'late') ? 'ON DUTY' : 'ABSENT';

    return {
      rollNo: s.rollNo,
      last4Digits: s.last4Digits || (s.rollNo.slice(-4) || '----'),
      name: s.name,
      status: displayStatus,
    };
  });

  const absentees = studentRecords.filter(s => s.status === 'ABSENT');
  const absenteeRolls = absentees.map(s => s.last4Digits || s.rollNo);
  const absenteeNames = absentees.map(s => `[${s.last4Digits}] ${s.name}`);
  const absenteeDetails = absenteeNames.length > 0 ? absenteeNames.join(', ') : 'None (100% Present)';

  const onDutyList = studentRecords.filter(s => s.status === 'ON DUTY');
  const onDutyRolls = onDutyList.map(s => s.last4Digits || s.rollNo);
  const onDutyNames = onDutyList.map(s => `[${s.last4Digits}] ${s.name}`);
  const onDutyDetails = onDutyNames.length > 0 ? onDutyNames.join(', ') : 'None';

  const totalEnrolled = students.length;
  const attendancePercent = totalEnrolled > 0 ? Math.round(((presentCount + onDutyCount) / totalEnrolled) * 100) : 0;

  return {
    classId: currentClass.id,
    className: finalClassName,
    sheetTabName: finalTabName,
    tabName: finalTabName,
    date,
    time: time || '10:00 AM - 11:00 AM',
    teacherName: currentClass.teacherName,
    room: currentClass.room,
    totalEnrolled,
    presentCount,
    absentCount,
    onDutyCount,
    lateCount: onDutyCount,
    attendancePercent,
    absenteeRolls,
    absenteeNames,
    absenteeDetails,
    onDutyRolls,
    onDutyNames,
    onDutyDetails,
    studentRecords,
  };
}

import { getAccessToken, ensureValidGoogleToken } from './googleWorkspaceAuth';
import { extractSpreadsheetId, appendAttendanceViaDirectApi } from './googleSheetsDirectApi';

/**
 * Sends attendance data to Google Sheets via Direct Google Sheets API (OAuth) or Apps Script Webhook
 */
export async function appendAttendanceToGoogleSheet(
  payload: SheetSessionPayload,
  settings: WeeklySyncSettings,
  promptAuthIfNeeded: boolean = false
): Promise<{ success: boolean; message: string; directApi?: boolean; needsGoogleAuth?: boolean }> {
  try {
    const sheetId = extractSpreadsheetId(settings.googleSheetUrl || settings.sheetId || '');
    if (!sheetId) {
      return {
        success: false,
        message: 'No valid Google Sheet URL provided. Please paste your Google Sheet link in Sheet Settings first.',
      };
    }

    // 1. Direct Google Sheets API sync (Highest priority & official OAuth method)
    let token = await getAccessToken();

    // If user explicitly prompted or no token yet, attempt token acquisition
    if (!token && promptAuthIfNeeded) {
      try {
        token = await ensureValidGoogleToken();
      } catch (authErr: any) {
        return {
          success: false,
          needsGoogleAuth: true,
          message: authErr?.message || 'Google Sign-in was cancelled. Permission is required to write to your Google Sheet.',
        };
      }
    }

    if (token) {
      // Determine tab name based on sync strategy (prioritize canonical sheetTabName to prevent duplicate pages)
      let customTab = payload.sheetTabName || payload.tabName || payload.className || 'Attendance';
      if (settings.syncStrategy === 'per_class_tabs' && settings.classTabNames && payload.classId) {
        customTab = settings.classTabNames[payload.classId] || customTab;
      }

      const directRes = await appendAttendanceViaDirectApi(sheetId, payload, token, customTab);
      if (directRes.success) {
        // Also fire background notify to server logs
        fetch('/api/sheets/append', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleSheetUrl: settings.googleSheetUrl,
            webhookUrl: settings.webhookUrl,
            payload,
          }),
        }).catch(() => {});

        return {
          success: true,
          message: directRes.message,
          directApi: true,
        };
      } else {
        console.warn('Direct API sync returned error:', directRes.error);
        // If 401 unauthorized, notify user to reconnect Google account
        if (directRes.error?.includes('401') || directRes.error?.includes('UNAUTHENTICATED') || directRes.error?.includes('invalid_token')) {
          return {
            success: false,
            needsGoogleAuth: true,
            message: 'Google login token expired. Please click "Sheet Settings" and Sign In with Google again.',
          };
        }
        return {
          success: false,
          message: directRes.message || directRes.error || 'Failed to write to Google Sheet.',
        };
      }
    }

    // If no OAuth token is available, return clear actionable notification
    return {
      success: false,
      needsGoogleAuth: true,
      message: 'Google account not linked: Please click "Sheet Settings" and "Sign in with Google" to allow the app to write to your private Google Sheet.',
    };
  } catch (err: any) {
    console.error('Error appending to Google Sheet:', err);
    return {
      success: false,
      message: err.message || 'Could not sync with Google Sheets',
    };
  }
}

/**
 * Generates the clean Google Apps Script code that users can paste into their Google Sheet
 * (Extensions -> Apps Script) to enable automatic, cloud-synchronized row appends.
 */
export function generateGoogleAppsScriptCode(sheetTitle: string = 'Attendance Register'): string {
  return `/**
 * Google Apps Script for CR Attendance Portal Auto-Sync
 * ----------------------------------------------------
 * Setup Instructions:
 * 1. In your Google Sheet, click on "Extensions" > "Apps Script".
 * 2. Delete any existing code in the editor, and paste this entire file.
 * 3. Click "Deploy" (top right) > "New deployment".
 * 4. Click the gear icon next to "Select type" > select "Web app".
 * 5. Configuration:
 *    - Description: "CR Attendance Auto-Sync"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone" (crucial so the portal can send data without OAuth errors)
 * 6. Click "Deploy", copy the "Web app URL", and paste it into the "Apps Script Webhook URL" field in your CR Portal!
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    var payload = data.payload || data;

    // Use tab matching the class/session tab name, or default sheet
    var sheetName = payload.sheetTabName || payload.className || "${sheetTitle}";
    var sheet = doc.getSheetByName(sheetName);

    if (!sheet) {
      sheet = doc.insertSheet(sheetName);
      // Initialize Header formatting
      sheet.appendRow([
        "Timestamp",
        "Class / Subject",
        "Date",
        "Time",
        "Faculty In-Charge",
        "Room",
        "Total Enrolled",
        "Present Count",
        "Absent Count",
        "Late Count",
        "Attendance %",
        "Absentee Students (Last 4 & Name)"
      ]);
      sheet.getRange(1, 1, 1, 12).setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    // Append session row
    var now = new Date();
    sheet.appendRow([
      now.toISOString(),
      payload.className || "Class",
      payload.date || "",
      payload.time || "",
      payload.teacherName || "",
      payload.room || "",
      payload.totalEnrolled || 0,
      payload.presentCount || 0,
      payload.absentCount || 0,
      payload.lateCount || 0,
      (payload.attendancePercent || 0) + "%",
      payload.absenteeDetails || "None"
    ]);

    // 2. Student Roster Tab (Date & Time on top with All Names + Present/Absent in front of their name)
    var rosterSheetName = sheetName;
    if (payload.studentRecords && payload.studentRecords.length > 0) {
      var rosterSheet = doc.getSheetByName(rosterSheetName);
      if (!rosterSheet) {
        rosterSheet = doc.insertSheet(rosterSheetName);
      }

      // Add clean session block with Date & Time on top!
      rosterSheet.appendRow(["DATE: " + (payload.date || "Today"), "TIME: " + (payload.time || "Class Time"), "CLASS: " + (payload.className || ""), "FACULTY: " + (payload.teacherName || "")]);
      var topRow = rosterSheet.getLastRow();
      rosterSheet.getRange(topRow, 1, 1, 4).setBackground("#0f172a").setFontColor("#38bdf8").setFontWeight("bold");

      rosterSheet.appendRow([
        "TOTAL: " + (payload.totalEnrolled || payload.studentRecords.length),
        "PRESENT: " + (payload.presentCount || 0),
        "ABSENT: " + (payload.absentCount || 0),
        "ATTENDANCE: " + (payload.attendancePercent || 0) + "%"
      ]);
      var statRow = rosterSheet.getLastRow();
      rosterSheet.getRange(statRow, 1, 1, 4).setBackground("#1e293b").setFontColor("#4ade80").setFontWeight("bold");

      // Column Headers
      rosterSheet.appendRow(["Roll Number", "Last 4", "Student Name", "Attendance Status (P / A)"]);
      var headerRow = rosterSheet.getLastRow();
      rosterSheet.getRange(headerRow, 1, 1, 4).setBackground("#047857").setFontColor("#ffffff").setFontWeight("bold");

      // Populate all student names with Present / Absent in front of their name
      payload.studentRecords.forEach(function(s) {
        var statusColor = s.status === "PRESENT" ? "#dcfce7" : "#ffe4e6";
        var textColor = s.status === "PRESENT" ? "#166534" : "#9f1239";
        rosterSheet.appendRow([s.rollNo, s.last4Digits, s.name, s.status]);
        var currentRow = rosterSheet.getLastRow();
        rosterSheet.getRange(currentRow, 4, 1, 1).setBackground(statusColor).setFontColor(textColor).setFontWeight("bold");
      });

      // Blank separator row for next session
      rosterSheet.appendRow(["", "", "", ""]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ "result": "success", "sheet": sheetName, "row": sheet ? sheet.getLastRow() : 1 }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ "result": "error", "error": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ "status": "active", "service": "CR Attendance Google Sheet Sync" }))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
}

export type StudentsTsvFormat = 
  | 'roll_name'        // Col A: Roll No, Col B: Full Name
  | 'last4_name'       // Col A: Last 4, Col B: Full Name
  | 'roll_last4_name'  // Col A: Roll No, Col B: Last 4, Col C: Full Name
  | 'full_columns';    // Col A: Roll No, Col B: Last 4, Col C: Full Name, Col D: Phone, Col E: Email, Col F: Batch

/**
 * Formats students list as Tab-Separated Values (TSV)
 * When copied to clipboard and pasted in Google Sheets, it cleanly splits into separate columns!
 */
export function formatStudentsForGoogleSheets(
  students: Student[],
  format: StudentsTsvFormat = 'roll_name',
  includeHeader: boolean = true
): string {
  const lines: string[] = [];
  const sortedStudents = sortStudentsByLast4Digits(students);

  if (includeHeader) {
    switch (format) {
      case 'roll_name':
        lines.push('Roll Number\tStudent Name');
        break;
      case 'last4_name':
        lines.push('Last 4 Digits\tStudent Name');
        break;
      case 'roll_last4_name':
        lines.push('Roll Number\tLast 4 Digits\tStudent Name');
        break;
      case 'full_columns':
        lines.push('Roll Number\tLast 4 Digits\tStudent Name\tPhone\tEmail\tBatch');
        break;
    }
  }

  sortedStudents.forEach(s => {
    const roll = s.rollNo || '';
    const last4 = s.last4Digits || (roll.slice(-4) || '----');
    const name = s.name || '';
    const phone = s.phone || '';
    const email = s.email || '';
    const batch = s.batch || '';

    switch (format) {
      case 'roll_name':
        lines.push(`${roll}\t${name}`);
        break;
      case 'last4_name':
        lines.push(`${last4}\t${name}`);
        break;
      case 'roll_last4_name':
        lines.push(`${roll}\t${last4}\t${name}`);
        break;
      case 'full_columns':
        lines.push(`${roll}\t${last4}\t${name}\t${phone}\t${email}\t${batch}`);
        break;
    }
  });

  return lines.join('\n');
}

/**
 * Formats absentee and on-duty lists specifically with Last 4 digits before their name
 * Order: Absent, then On Duty (if any)
 * Example:
 * ABSENT (2):
 * 1005 - Vikram Malhotra
 * 1008 - Sneha Nair
 * 
 * ON DUTY (1):
 * 1002 - Ananya Patel
 */
export function formatAbsenteesWithLast4Prefix(
  absenteeStudents: Array<{ name: string; rollNo?: string; last4Digits?: string }>,
  formatStyle: 'dash' | 'brackets' | 'space' | 'full_roll' = 'dash',
  onDutyStudents: Array<{ name: string; rollNo?: string; last4Digits?: string }> = []
): string {
  const formatStudent = (s: { name: string; rollNo?: string; last4Digits?: string }) => {
    const last4 = s.last4Digits || (s.rollNo ? s.rollNo.slice(-4) : '----');
    switch (formatStyle) {
      case 'dash':
        return `${last4} - ${s.name}`;
      case 'brackets':
        return `[${last4}] ${s.name}`;
      case 'space':
        return `${last4} ${s.name}`;
      case 'full_roll':
        return `${s.rollNo || last4} - ${s.name}`;
      default:
        return `${last4} - ${s.name}`;
    }
  };

  const sections: string[] = [];

  if (absenteeStudents.length === 0) {
    sections.push('ABSENT: None (0)');
  } else {
    sections.push(`ABSENT (${absenteeStudents.length}):\n` + absenteeStudents.map(formatStudent).join('\n'));
  }

  if (onDutyStudents && onDutyStudents.length > 0) {
    sections.push(`ON DUTY (${onDutyStudents.length}):\n` + onDutyStudents.map(formatStudent).join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * Formats a complete session roster ready for Google Sheets paste:
 * - Date and Time on the very top
 * - List of all student names
 * - In front of their name: P or A (or OD)!
 */
export function formatSessionRosterWithDateTop(
  className: string,
  date: string,
  time: string,
  students: Student[],
  records: AttendanceRecord[],
  teacherName?: string,
  room?: string,
  sessionId?: string
): string {
  const recordMap = new Map<string, AttendanceRecord>();
  records.forEach(r => {
    if (r.date === date && (!sessionId || (r.sessionId || 'session-1') === sessionId)) {
      recordMap.set(r.studentId, r);
    }
  });

  let presentCount = 0;
  let absentCount = 0;
  let onDutyCount = 0;

  const sortedStudents = sortStudentsByLast4Digits(students);
  const rows = sortedStudents.map(s => {
    const rec = recordMap.get(s.id);
    const status = rec ? rec.status : 'absent';
    let displayStatus = 'A';
    if (status === 'present') {
      presentCount++;
      displayStatus = 'P';
    } else if (status === 'onduty' || status === 'late') {
      onDutyCount++;
      displayStatus = 'OD';
    } else {
      absentCount++;
      displayStatus = 'A';
    }

    return {
      rollNo: s.rollNo,
      last4: s.last4Digits || s.rollNo.slice(-4),
      name: s.name,
      status: displayStatus,
      time: rec?.time || time || ''
    };
  });

  const total = students.length;
  const percent = total > 0 ? Math.round(((presentCount + onDutyCount) / total) * 100) : 0;

  const lines: string[] = [
    `DATE: ${date}\tTIME: ${time}\tSUBJECT: ${className}\tVENUE: ${room || 'Hall'}`,
    `FACULTY: ${teacherName || 'Faculty Incharge'}\tTOTAL ENROLLED: ${total}\tATTENDANCE: ${percent}%\tSTATUS: COMPLETED`,
    `SUMMARY: ${presentCount} Present\t${absentCount} Absent\t${onDutyCount} On Duty`,
    ``,
    `Roll Number\tLast 4\tStudent Name\tStatus (P / A)\tLogged Time`,
  ];

  rows.forEach(r => {
    lines.push(`${r.rollNo}\t${r.last4}\t${r.name}\t${r.status}\t${r.time}`);
  });

  return lines.join('\n');
}

/**
 * Formats the entire weekly matrix ready for Google Sheets paste:
 * Header: Date & Time for each class session (separate columns for 1st Class, 2nd Class, etc.)
 * Rows: Roll Number, Last 4, Student Name, followed by just P, A, or OD!
 */
export function formatSessionMatrixForGoogleSheets(
  className: string,
  columns: Array<{ colId: string; dateStr: string; dayName: string; sessionTitle: string; sessionTime: string }>,
  students: Student[],
  studentStatusMap: Record<string, Record<string, 'P' | 'A' | 'OD' | '-'>>,
  totalPresentMap: Record<string, number>,
  attendancePercentMap: Record<string, string>
): string {
  const headerCols = [
    'Roll Number',
    'Last 4',
    'Student Name',
    ...columns.map(c => `${c.dayName} ${c.dateStr} (${c.sessionTime} - ${c.sessionTitle})`),
    'Total Present',
    '% Attendance'
  ];

  const lines: string[] = [
    `Official Attendance Matrix: ${className}`,
    headerCols.join('\t')
  ];

  const sortedStudents = sortStudentsByLast4Digits(students);
  sortedStudents.forEach(s => {
    const studentStatus = studentStatusMap[s.id] || {};
    const row = [
      s.rollNo,
      s.last4Digits || (s.rollNo.slice(-4) || '----'),
      s.name,
      ...columns.map(c => studentStatus[c.colId] || '-'),
      totalPresentMap[s.id] || 0,
      attendancePercentMap[s.id] || '0%'
    ];
    lines.push(row.join('\t'));
  });

  return lines.join('\n');
}

