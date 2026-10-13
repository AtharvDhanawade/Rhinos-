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

export interface SheetTabInfo {
  sheetId: number;
  title: string;
}

/**
 * Fetches basic spreadsheet metadata (Title, sheet tab names, and sheetId numbers)
 */
export async function getSpreadsheetDetails(
  spreadsheetId: string,
  accessToken: string
): Promise<{ title: string; sheets: string[]; sheetDetails: SheetTabInfo[] }> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title)`,
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
  const sheetDetails: SheetTabInfo[] = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties?.sheetId ?? 0,
    title: s.properties?.title || 'Sheet1',
  }));
  const sheets = sheetDetails.map(s => s.title);

  return { title, sheets, sheetDetails };
}

/**
 * Normalizes tab titles for robust, typo-tolerant comparisons
 */
export function normalizeTabTitle(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Checks if two sheet tab titles refer to the same subject (e.g. handles singular vs plural "Foundations" vs "Foundation", case variations, session tags like "(1st Class)", etc.)
 */
export function isSimilarTabTitle(a: string, b: string): boolean {
  const normA = normalizeTabTitle(a);
  const normB = normalizeTabTitle(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Strip session / class round indicators like "(1st Class)", "(2nd Class)", "(session 1)", "class session", etc.
  const cleanA = normA.replace(/\b(1st|2nd|3rd|\d+th|session|class)\b/g, '').replace(/\s+/g, ' ').trim();
  const cleanB = normB.replace(/\b(1st|2nd|3rd|\d+th|session|class)\b/g, '').replace(/\s+/g, ' ').trim();
  if (cleanA && cleanB && cleanA === cleanB) return true;

  // Compare singular/plural stems (e.g. "foundations of identity and communication" vs "foundation of identity and communication")
  const wordsA = normA.split(' ').map(w => (w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w));
  const wordsB = normB.split(' ').map(w => (w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w));
  if (wordsA.join(' ') === wordsB.join(' ')) return true;

  // Substring matching for long titles (prevents branching tabs on small typos or code suffixes)
  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length);
    const maxLen = Math.max(normA.length, normB.length);
    if (minLen >= 4 && minLen / maxLen >= 0.5) return true;
  }

  return false;
}

/**
 * Finds an existing sheet tab that matches requested title (exact or similar)
 */
export function findMatchingSheetTab(requestedTabName: string, availableTabs: string[]): string | null {
  if (!requestedTabName || !availableTabs || availableTabs.length === 0) return null;

  // 1. Exact match
  const exact = availableTabs.find(t => t.trim() === requestedTabName.trim());
  if (exact) return exact;

  // 2. Case-insensitive exact match
  const caseInsensitive = availableTabs.find(t => t.trim().toLowerCase() === requestedTabName.trim().toLowerCase());
  if (caseInsensitive) return caseInsensitive;

  // 3. Similar match (e.g. "Tech Class (1st Class)" matches "Tech Class", "CS401" matches "Tech Class (CS401)")
  const similar = availableTabs.find(t => isSimilarTabTitle(t, requestedTabName));
  if (similar) return similar;

  return null;
}

/**
 * Deletes a tab from a Google Sheet by sheetId (used to clean up accidental duplicate tabs)
 */
export async function deleteSheetTab(
  spreadsheetId: string,
  sheetIdNumber: number,
  accessToken: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(
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
              deleteSheet: {
                sheetId: sheetIdNumber,
              },
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, message: err?.error?.message || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to delete tab' };
  }
}

/**
 * Ensures a tab exists inside the spreadsheet; reuses existing similar tabs to prevent duplicate pages, or creates if missing.
 * If the spreadsheet only contains a single default blank tab named "Sheet1", renames it instead of creating a 2nd page!
 * Returns the resolved tab name.
 */
export async function ensureSheetTabExists(
  spreadsheetId: string,
  tabName: string,
  accessToken: string
): Promise<string> {
  const details = await getSpreadsheetDetails(spreadsheetId, accessToken);
  
  // 1. Re-use existing matching or similar tab (e.g. "Tech Class" vs "Tech Class (1st Class)")
  const matched = findMatchingSheetTab(tabName, details.sheets);
  if (matched) {
    return matched;
  }

  // 2. If spreadsheet has ONLY 1 tab, and that tab is the default blank "Sheet1" / "Sheet 1":
  // Rename "Sheet1" to the requested tabName so the user doesn't get 2 pages of the same subject!
  const defaultSheet = details.sheetDetails.find(
    s => details.sheets.length === 1 && /^sheet\s*1$/i.test(s.title.trim())
  );
  if (defaultSheet) {
    try {
      const renameRes = await fetch(
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
                updateSheetProperties: {
                  properties: {
                    sheetId: defaultSheet.sheetId,
                    title: tabName,
                  },
                  fields: 'title',
                },
              },
            ],
          }),
        }
      );
      if (renameRes.ok) {
        return tabName;
      }
    } catch (e) {
      console.warn('Could not rename default Sheet1:', e);
    }
  }

  // 3. Only create a new tab/sheet if genuinely missing
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

  return tabName;
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
    let targetTab = customTabName?.trim() || payload.sheetTabName || payload.tabName || payload.className || 'Attendance';

    // 1. Ensure tab exists and reuse existing similar tab
    try {
      targetTab = await ensureSheetTabExists(spreadsheetId, targetTab, accessToken);
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
    let targetTab = tabName.trim() || 'Attendance Register';
    try {
      targetTab = await ensureSheetTabExists(spreadsheetId, targetTab, accessToken);
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
      const isMultiOnDay = sessionColumns.filter(c => c.dateStr === col.dateStr).length > 1;
      const headerTitle = isMultiOnDay
        ? `${col.dayName} ${col.dateStr} (${col.sessionTitle})`
        : `${col.dayName} ${col.dateStr}`;
      headerRow.push(headerTitle);
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
