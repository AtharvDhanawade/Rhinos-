import { SheetSessionPayload } from './googleSheets';

export interface DirectSheetSyncResult {
  success: boolean;
  message: string;
  spreadsheetTitle?: string;
  tabName?: string;
  updatedRange?: string;
  error?: string;
}

/**
 * Extracts spreadsheet ID from various formats of Google Sheets URL or raw ID
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
  if (!urlOrOrTrim(urlOrId)) return null;
  const str = urlOrId.trim();

  // Match /spreadsheets/d/([a-zA-Z0-9-_]+)
  const match = str.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // Raw ID check (alphanumeric, dashes, underscores, typically 30-60 chars)
  if (/^[a-zA-Z0-9-_]{20,}$/.test(str)) {
    return str;
  }

  return null;
}

function urlOrOrTrim(str?: string): boolean {
  return Boolean(str && str.trim().length > 0);
}

/**
 * Fetches basic spreadsheet metadata (Title and sheet tab names)
 */
export async function getSpreadsheetDetails(
  spreadsheetId: string,
  accessToken: string
): Promise<{ title: string; sheets: string[] }> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || `Failed to access spreadsheet (HTTP ${res.status})`;
    throw new Error(errorMsg);
  }

  const data = await res.json();
  const title = data.properties?.title || 'Google Sheet';
  const sheets = (data.sheets || []).map((s: any) => s.properties?.title || 'Sheet1');

  return { title, sheets };
}

/**
 * Ensures a tab exists inside the spreadsheet; creates it if missing
 */
export async function ensureSheetTabExists(
  spreadsheetId: string,
  tabName: string,
  accessToken: string
): Promise<void> {
  const details = await getSpreadsheetDetails(spreadsheetId, accessToken);
  const exists = details.sheets.some(s => s.toLowerCase() === tabName.toLowerCase());
  
  if (exists) return;

  // Create new tab/sheet
  const addRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName,
              },
            },
          },
        ],
      }),
    }
  );

  if (!addRes.ok) {
    const errorData = await addRes.json().catch(() => ({}));
    console.warn('Could not create tab:', errorData?.error?.message);
  }
}

/**
 * Appends attendance session rows directly to the Google Sheet using Google Sheets v4 API
 */
export async function appendAttendanceViaDirectApi(
  spreadsheetId: string,
  payload: SheetSessionPayload,
  accessToken: string,
  customTabName?: string
): Promise<DirectSheetSyncResult> {
  try {
    const targetTab = customTabName?.trim() || payload.tabName || payload.className || 'Attendance';

    // 1. Ensure tab exists
    try {
      await ensureSheetTabExists(spreadsheetId, targetTab, accessToken);
    } catch (e) {
      console.warn('Tab check error (will attempt fallback):', e);
    }

    // 2. Build row values to append
    const rows: (string | number)[][] = [];

    // Header 1: Date & Time Banner
    rows.push([
      `DATE: ${payload.date || new Date().toISOString().split('T')[0]}`,
      `TIME: ${payload.time || 'Class Session'}`,
      `SUBJECT: ${payload.className || 'Class'}`,
      `FACULTY: ${payload.teacherName || 'Faculty Incharge'}`
    ]);

    // Header 2: Attendance Summary Banner
    rows.push([
      `TOTAL ENROLLED: ${payload.totalEnrolled}`,
      `PRESENT: ${payload.presentCount}`,
      `ABSENT: ${payload.absentCount}`,
      `ON DUTY (OD): ${(payload as any).onDutyCount || (payload as any).lateCount || 0}`,
      `ATTENDANCE: ${payload.attendancePercent}%`
    ]);

    // Header 3: Columns
    rows.push([
      'Roll Number',
      'Last 4',
      'Student Name',
      'Status (P / A)',
      'Time'
    ]);

    // Student Rows: Name with P or A clearly in front!
    if (payload.studentRecords && payload.studentRecords.length > 0) {
      payload.studentRecords.forEach(s => {
        const rawStatus = (s.status || '').toUpperCase();
        let displayStatus = 'A';
        if (rawStatus === 'PRESENT' || rawStatus === 'P') {
          displayStatus = 'P';
        } else if (rawStatus === 'ONDUTY' || rawStatus === 'ON DUTY' || rawStatus === 'ON_DUTY' || rawStatus === 'OD' || rawStatus === 'LATE' || rawStatus === 'L') {
          displayStatus = 'OD';
        } else {
          displayStatus = 'A';
        }

        rows.push([
          s.rollNo,
          s.last4Digits || '',
          s.name,
          displayStatus,
          payload.time || ''
        ]);
      });
    }

    // Empty separator row
    rows.push(['', '', '', '', '']);

    // Range to append - safely escape quotes in tab name
    const cleanTab = targetTab.replace(/'/g, "''");
    const range = `'${cleanTab}'!A1`;

    let appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          majorDimension: 'ROWS',
          values: rows,
        }),
      }
    );

    // If append failed because tab name range format had an issue, retry with tab name directly or default A1
    if (!appendRes.ok && (appendRes.status === 400 || appendRes.status === 404)) {
      console.warn('First append failed, retrying with raw tab range...');
      appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetTab)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            majorDimension: 'ROWS',
            values: rows,
          }),
        }
      );
    }

    if (!appendRes.ok) {
      const errJson = await appendRes.json().catch(() => ({}));
      const msg = errJson?.error?.message || `Google Sheets API Error (HTTP ${appendRes.status})`;
      return {
        success: false,
        message: msg,
        error: msg,
      };
    }

    const resJson = await appendRes.json();
    const updatedRange = resJson?.updates?.updatedRange || `${targetTab}`;

    return {
      success: true,
      message: `Successfully added ${rows.length - 1} rows to "${targetTab}" in your Google Sheet!`,
      tabName: targetTab,
      updatedRange,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Failed to communicate with Google Sheets API',
      error: String(error),
    };
  }
}

export interface MatrixSessionColumnData {
  colId: string;
  dateStr: string;
  dayName: string;
  sessionId: string;
  sessionTitle: string;
  sessionTime: string;
}

export interface MatrixStudentRowData {
  rollNo: string;
  last4Digits: string;
  name: string;
  statusByColId: Record<string, 'P' | 'A' | 'OD' | '-'>;
  totalPresent: number;
  attendancePercent: string;
}

/**
 * Syncs the entire multi-session matrix to the Google Sheet tab:
 * Header: Date and Time for each class session (separate columns for Class 1, Class 2, etc.)
 * Rows: Roll No, Last 4, Student Name, followed by just P, A, or OD!
 */
export async function syncWeeklyMatrixViaDirectApi(
  spreadsheetId: string,
  tabName: string,
  sessionColumns: MatrixSessionColumnData[],
  studentRows: MatrixStudentRowData[],
  accessToken: string
): Promise<DirectSheetSyncResult> {
  try {
    const targetTab = tabName.trim() || 'Attendance Matrix';
    try {
      await ensureSheetTabExists(spreadsheetId, targetTab, accessToken);
    } catch (e) {
      console.warn('Tab check error:', e);
    }

    const rows: (string | number)[][] = [];

    // Header 1: Column Headers with Date & Time for each session!
    const headerRow: (string | number)[] = [
      'Roll Number',
      'Last 4',
      'Student Name',
    ];

    sessionColumns.forEach(col => {
      // e.g. "Thu 09-24 [10:00 AM - Class 1]"
      headerRow.push(`${col.dayName} ${col.dateStr} (${col.sessionTime} - ${col.sessionTitle})`);
    });

    headerRow.push('Total Present', '% Attendance');
    rows.push(headerRow);

    // Student Rows: Roll No, Last 4, Name, followed by just P, A, or OD!
    studentRows.forEach(student => {
      const studentCols: (string | number)[] = [
        student.rollNo,
        student.last4Digits,
        student.name,
      ];

      sessionColumns.forEach(col => {
        studentCols.push(student.statusByColId[col.colId] || '-');
      });

      studentCols.push(student.totalPresent, student.attendancePercent);
      rows.push(studentCols);
    });

    const cleanTab = targetTab.replace(/'/g, "''");
    const range = `'${cleanTab}'!A1`;

    const putRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          majorDimension: 'ROWS',
          values: rows,
        }),
      }
    );

    if (!putRes.ok) {
      const errJson = await putRes.json().catch(() => ({}));
      const msg = errJson?.error?.message || `Google Sheets API Error (HTTP ${putRes.status})`;
      return {
        success: false,
        message: msg,
        error: msg,
      };
    }

    return {
      success: true,
      message: `Successfully synchronized ${rows.length - 1} student matrix rows with ${sessionColumns.length} session columns to Google Sheet tab "${targetTab}"!`,
      tabName: targetTab,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Failed to sync matrix with Google Sheets',
      error: String(error),
    };
  }
}
