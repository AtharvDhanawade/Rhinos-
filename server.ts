import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Attendance Store File Path
const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "attendance_state.json");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");

interface ServerAttendanceState {
  students: any[];
  classes: any[];
  records: any[];
  activeClassId: string;
  lastUpdated: string;
}

const DEFAULT_STUDENTS_LIST: any[] = [];

const DEFAULT_CLASSES_LIST = [
  {
    id: 'cls-tech',
    name: 'Tech Class',
    code: 'CS401',
    teacherName: 'Prof. Rajesh Sharma',
    teacherEmail: 'sharma.faculty@college.edu',
    room: 'Lab 304',
    color: '#2563eb',
    scheduleTime: '09:30 AM - 11:00 AM'
  },
  {
    id: 'cls-comm',
    name: 'Communication Class',
    code: 'HS201',
    teacherName: 'Prof. Sunita Rao',
    teacherEmail: 's.rao@college.edu',
    room: 'Seminar Hall B',
    color: '#059669',
    scheduleTime: '11:15 AM - 12:45 PM'
  }
];

let serverState: ServerAttendanceState = {
  students: [],
  classes: DEFAULT_CLASSES_LIST,
  records: [],
  activeClassId: "cls-tech",
  lastUpdated: new Date().toISOString(),
};

function isDemoStudent(s: any): boolean {
  if (!s) return false;
  const name = String(s.name || '').trim().toLowerCase();
  const id = String(s.id || '').trim();
  const demoIds = ['std-1001', 'std-1002', 'std-1003', 'std-1004', 'std-1005', 'std-1006', 'std-1007', 'std-1008', 'std-1009', 'std-1010'];
  const demoNames = ['aarav sharma', 'ananya patel', 'rohan verma', 'ishita gupta', 'vikram malhotra', 'pooja reddy', 'kabir mehta', 'sneha nair', 'aditya joshi', 'priya rao'];
  return demoIds.includes(id) && demoNames.includes(name);
}

// Try to load persisted state from disk
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
  if (fs.existsSync(STORE_FILE)) {
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const filteredStudents = Array.isArray(parsed.students) 
        ? parsed.students.filter((s: any) => !isDemoStudent(s)) 
        : [];
      serverState = {
        students: filteredStudents,
        classes: Array.isArray(parsed.classes) && parsed.classes.length > 0 ? parsed.classes : DEFAULT_CLASSES_LIST,
        records: Array.isArray(parsed.records) ? parsed.records : [],
        activeClassId: parsed.activeClassId || "cls-tech",
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      };
      // Overwrite STORE_FILE cleanly without demo students
      fs.writeFileSync(STORE_FILE, JSON.stringify(serverState, null, 2), "utf-8");
    }
  }
} catch (e) {
  console.warn("Could not initialize file store for attendance:", e);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Increase payload limit to allow mobile camera / document photos
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Attendance sync endpoints (cross-device sync for QR code scanning)
  app.get("/api/attendance/state", (_req, res) => {
    res.json(serverState);
  });

  app.post("/api/attendance/sync", (req, res) => {
    try {
      const { students, classes, records, activeClassId } = req.body;
      if (Array.isArray(students) && students.length > 0) {
        serverState.students = students.filter((s: any) => !isDemoStudent(s));
      }
      if (Array.isArray(classes) && classes.length > 0) serverState.classes = classes;
      if (Array.isArray(records) && (records.length > 0 || (serverState.records.length === 0))) serverState.records = records;
      if (typeof activeClassId === "string" && activeClassId) serverState.activeClassId = activeClassId;
      serverState.lastUpdated = new Date().toISOString();

      // Persist to disk and rolling backup
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        if (!fs.existsSync(BACKUPS_DIR)) {
          fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        }
        fs.writeFileSync(STORE_FILE, JSON.stringify(serverState, null, 2), "utf-8");

        // Rolling timestamped backup if state contains students or records
        if (serverState.students.length > 0 || serverState.records.length > 0) {
          const backupFileName = `backup_${Date.now()}_students_${serverState.students.length}.json`;
          fs.writeFileSync(path.join(BACKUPS_DIR, backupFileName), JSON.stringify(serverState, null, 2), "utf-8");
          
          // Keep up to 20 most recent backups
          const existing = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith("backup_")).sort();
          if (existing.length > 20) {
            existing.slice(0, existing.length - 20).forEach(f => {
              try { fs.unlinkSync(path.join(BACKUPS_DIR, f)); } catch {}
            });
          }
        }
      } catch (writeErr) {
        console.warn("Failed to write attendance file on server:", writeErr);
      }

      res.json({ success: true, count: serverState.records.length, studentsCount: serverState.students.length, lastUpdated: serverState.lastUpdated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to sync attendance" });
    }
  });

  // Backup & Recovery endpoints
  app.get("/api/attendance/backups", (_req, res) => {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        return res.json({ backups: [] });
      }
      const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith("backup_") && f.endsWith(".json"));
      const list = files.map(f => {
        const full = path.join(BACKUPS_DIR, f);
        const stats = fs.statSync(full);
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.birthtime || stats.mtime,
        };
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json({ backups: list });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/attendance/restore-backup", (req, res) => {
    try {
      const { filename } = req.body;
      if (!filename || typeof filename !== "string") {
        return res.status(400).json({ error: "Filename is required" });
      }
      const safePath = path.join(BACKUPS_DIR, path.basename(filename));
      if (!fs.existsSync(safePath)) {
        return res.status(404).json({ error: "Backup file not found" });
      }
      const raw = fs.readFileSync(safePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed) {
        serverState = {
          students: Array.isArray(parsed.students) ? parsed.students : serverState.students,
          classes: Array.isArray(parsed.classes) ? parsed.classes : serverState.classes,
          records: Array.isArray(parsed.records) ? parsed.records : serverState.records,
          activeClassId: parsed.activeClassId || serverState.activeClassId,
          lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(STORE_FILE, JSON.stringify(serverState, null, 2), "utf-8");
        return res.json({ success: true, restored: serverState });
      }
      res.status(400).json({ error: "Invalid backup content" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // CR Submissions in-memory store
  let crSubmissions: any[] = [];

  // CR Mobile App Submission Endpoint
  app.post("/api/attendance/cr-submit", (req, res) => {
    try {
      const { classId, className, date, time, records, submittedBy } = req.body;
      if (!Array.isArray(records)) {
        return res.status(400).json({ error: "Invalid records format" });
      }

      // Merge records into serverState
      const keys = new Set(records.map((r: any) => `${r.studentId}_${r.classId}_${r.date}_${r.sessionId || 'session-1'}`));
      serverState.records = [
        ...records,
        ...serverState.records.filter((r: any) => !keys.has(`${r.studentId}_${r.classId}_${r.date}_${r.sessionId || 'session-1'}`))
      ];
      serverState.lastUpdated = new Date().toISOString();

      const presentCount = records.filter((r: any) => r.status === 'present').length;
      const absentCount = records.filter((r: any) => r.status === 'absent').length;
      const lateCount = records.filter((r: any) => r.status === 'late').length;

      const submission = {
        id: `cr-sub-${Date.now()}`,
        classId,
        className: className || 'Subject Attendance',
        date: date || new Date().toISOString().split('T')[0],
        time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        records,
        presentCount,
        absentCount,
        lateCount,
        total: records.length,
        submittedBy: submittedBy || 'Class Representative (CR Mobile)',
        timestamp: Date.now(),
        isoTime: new Date().toISOString()
      };

      crSubmissions.unshift(submission);
      crSubmissions = crSubmissions.slice(0, 50);

      // Persist to disk
      try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(STORE_FILE, JSON.stringify(serverState, null, 2), "utf-8");
      } catch (e) {}

      res.json({
        success: true,
        submission,
        message: `Attendance received for ${className || 'Class'}! ${presentCount} Present, ${absentCount} Absent.`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to process CR submission" });
    }
  });

  // CR Latest Submissions Query Endpoint
  app.get("/api/attendance/cr-submissions", (req, res) => {
    const since = Number(req.query.since) || 0;
    const filtered = since > 0 ? crSubmissions.filter((s: any) => s.timestamp > since) : crSubmissions;
    res.json({
      submissions: filtered,
      latest: crSubmissions[0] || null,
      totalRecords: serverState.records.length,
      lastUpdated: serverState.lastUpdated
    });
  });

  // Google Sheets auto-append & cloud sync endpoint
  app.post("/api/sheets/append", async (req, res) => {
    try {
      const { googleSheetUrl, webhookUrl, payload } = req.body;

      // If user provided a webhook / Google Apps Script Web App URL, forward it to Google Sheets
      if (webhookUrl && typeof webhookUrl === "string" && webhookUrl.trim().startsWith("http")) {
        try {
          const sheetRes = await fetch(webhookUrl.trim(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload }),
          });
          const text = await sheetRes.text();
          let jsonResult;
          try { jsonResult = JSON.parse(text); } catch { jsonResult = { raw: text }; }
          return res.json({
            success: true,
            syncedToCloudSheet: true,
            message: `Successfully appended session to Google Sheet (${payload?.className || "Class"})!`,
            details: jsonResult,
          });
        } catch (webhookErr: any) {
          console.warn("Google Apps Script webhook call error:", webhookErr);
          // Fall back gracefully to local recording
        }
      }

      // Store in serverState log of sheet rows
      if (!(serverState as any).sheetLogs) {
        (serverState as any).sheetLogs = [];
      }
      (serverState as any).sheetLogs.unshift({
        timestamp: new Date().toISOString(),
        googleSheetUrl: googleSheetUrl || "",
        payload,
      });

      // Keep last 100 rows
      (serverState as any).sheetLogs = (serverState as any).sheetLogs.slice(0, 100);

      // Persist to disk
      try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(STORE_FILE, JSON.stringify(serverState, null, 2), "utf-8");
      } catch (writeErr) {
        console.warn("Failed to write attendance file on server:", writeErr);
      }

      res.json({
        success: true,
        syncedToCloudSheet: false,
        message: webhookUrl 
          ? "Session saved. Apps Script webhook was unreachable." 
          : "Session formatted and saved ready for Google Sheets sync!",
        payloadSummary: {
          className: payload?.className,
          date: payload?.date,
          present: payload?.presentCount,
          absent: payload?.absentCount,
        },
      });
    } catch (err: any) {
      console.error("Error in /api/sheets/append:", err);
      res.status(500).json({ error: err.message || "Failed to append to Google Sheet" });
    }
  });

  app.get("/api/sheets/logs", (_req, res) => {
    res.json({
      logs: (serverState as any).sheetLogs || [],
    });
  });

  // Direct Standalone Teacher Report Endpoint (0-bundle, instant load for any phone browser)
  app.get(["/teacher-report", "/teacher-report/", "/report", "/report/", "/teacher-doc", "/teacherDoc", "/teacher-day"], (req, res) => {
    const classId = (req.query.classId as string) || serverState.activeClassId || "";
    const dateParam = (req.query.date as string) || new Date().toISOString().split("T")[0];
    
    // Find class
    const cls = serverState.classes.find((c: any) => c.id === classId) || serverState.classes[0] || {
      name: (req.query.cls as string) || "College Class",
      code: "CS401",
      teacherName: (req.query.prof as string) || "Faculty Incharge",
      room: (req.query.room as string) || "Main Lab",
    };

    // Calculate records
    const classRecords = serverState.records.filter(
      (r: any) => r.classId === cls.id && r.date === dateParam
    );
    const recordMap = new Map();
    classRecords.forEach((r: any) => recordMap.set(r.studentId, r));

    const filterMode = (req.query.filter as string) || "absent"; // 'absent' | 'all' | 'present'

    let absentList: any[] = [];
    let presentList: any[] = [];
    let allStudentStatusList: any[] = [];
    let presentCount = 0;
    let absentCount = 0;

    // Check if absentee details were passed directly in query params (via QR code scan)
    const rawAbsData = req.query.absData as string | undefined;
    let urlAbsentees: any[] = [];
    if (rawAbsData) {
      const items = rawAbsData.split("~").filter(Boolean);
      urlAbsentees = items.map((item, idx) => {
        const parts = item.split("|");
        const last4 = decodeURIComponent(parts[0] || "");
        const rollNo = decodeURIComponent(parts[1] || "");
        const name = decodeURIComponent(parts[2] || "");
        const matched = serverState.students.find((s: any) => 
          (last4 && s.last4Digits === last4) || 
          (rollNo && s.rollNo === rollNo) ||
          (name && s.name && s.name.toLowerCase() === name.toLowerCase())
        );

        return {
          rollNo: rollNo || (matched ? matched.rollNo : (last4 ? `Roll ...${last4}` : `Roll #${idx + 1}`)),
          last4Digits: last4 || (matched ? matched.last4Digits : "----"),
          name: name || (matched ? matched.name : `Student (${last4})`),
          batch: matched ? matched.batch : "Batch 2026",
          status: "ABSENT",
          statusColor: "#dc2626",
        };
      });
    } else if (req.query.abs) {
      const rawAbs = (req.query.abs as string).split(",").filter(Boolean);
      urlAbsentees = rawAbs.map((itemStr, idx) => {
        let cleanCode = decodeURIComponent(itemStr).trim();
        let explicitName = "";
        if (cleanCode.includes(":")) {
          const colonIdx = cleanCode.indexOf(":");
          explicitName = cleanCode.slice(colonIdx + 1).trim();
          cleanCode = cleanCode.slice(0, colonIdx).trim();
        }

        const matched = serverState.students.find((s: any) => 
          s.last4Digits === cleanCode || s.rollNo === cleanCode || s.rollNo.endsWith(cleanCode)
        );

        const studentName = explicitName || (matched ? matched.name : (cleanCode ? `Student (${cleanCode})` : `Student #${idx + 1}`));
        const studentRoll = matched ? matched.rollNo : (cleanCode.length >= 6 ? cleanCode : `Roll ...${cleanCode}`);
        const studentLast4 = matched ? matched.last4Digits : (cleanCode.slice(-4) || cleanCode);

        return {
          rollNo: studentRoll,
          last4Digits: studentLast4,
          name: studentName,
          batch: matched ? matched.batch : "Batch 2026",
          status: "ABSENT",
          statusColor: "#dc2626",
        };
      });
    }

    if (classRecords.length > 0 && serverState.students.length > 0) {
      serverState.students.forEach((s: any) => {
        const rec = recordMap.get(s.id);
        const isPresent = rec && (rec.status === "present" || rec.status === "late");
        const isExplicitAbsent = rec && rec.status === "absent";

        const studentWithStatus = {
          ...s,
          status: isPresent ? (rec.status === "late" ? "LATE" : "PRESENT") : "ABSENT",
          statusColor: isPresent ? "#16a34a" : "#dc2626",
        };

        allStudentStatusList.push(studentWithStatus);

        if (isPresent) {
          presentList.push(studentWithStatus);
          presentCount++;
        } else {
          absentList.push(studentWithStatus);
          absentCount++;
        }
      });
    } else if (urlAbsentees.length > 0 || req.query.p || req.query.a) {
      // Use QR URL parameters for standalone report
      absentList = urlAbsentees;
      absentCount = req.query.a ? parseInt(req.query.a as string, 10) : absentList.length;
      presentCount = req.query.p ? parseInt(req.query.p as string, 10) : 0;

      const absentLast4Set = new Set(absentList.map(a => a.last4Digits).filter(Boolean));
      const absentRollSet = new Set(absentList.map(a => a.rollNo).filter(Boolean));

      // Build status list from roster
      serverState.students.forEach((s: any) => {
        const isAbs = absentLast4Set.has(s.last4Digits) || absentRollSet.has(s.rollNo);
        const item = {
          ...s,
          status: isAbs ? "ABSENT" : "PRESENT",
          statusColor: isAbs ? "#dc2626" : "#16a34a",
        };
        allStudentStatusList.push(item);
        if (!isAbs) presentList.push(item);
      });

      // Add any absentees from URL not in serverState
      urlAbsentees.forEach(ua => {
        const exists = allStudentStatusList.some((s: any) => s.last4Digits === ua.last4Digits || s.rollNo === ua.rollNo);
        if (!exists) {
          allStudentStatusList.push(ua);
        }
      });
    } else if (serverState.students.length > 0) {
      // Unmarked roster
      serverState.students.forEach((s: any) => {
        const item = {
          ...s,
          status: "NOT MARKED",
          statusColor: "#64748b",
        };
        allStudentStatusList.push(item);
        absentList.push(item);
      });
      absentCount = absentList.length;
    }

    const totalStudents = serverState.students.length || (presentCount + absentCount);
    const percent = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

    const displayList = filterMode === "all" 
      ? allStudentStatusList 
      : filterMode === "present" 
      ? presentList 
      : absentList;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Attendance Report - ${cls.name} (${dateParam})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f1f5f9; color: #0f172a; padding: 16px; }
    .container { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #e2e8f0; }
    .header-bar { background: #0f172a; color: #ffffff; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
    .badge { background: #2563eb; color: #ffffff; font-size: 11px; padding: 4px 10px; border-radius: 999px; font-weight: bold; text-transform: uppercase; }
    .paper { padding: 28px 24px; }
    .doc-title { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
    .doc-title h1 { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
    .doc-title p { font-size: 12px; color: #475569; font-weight: 600; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 12px; margin-bottom: 20px; font-size: 12px; }
    .meta-item span { display: block; color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .meta-item strong { display: block; font-size: 14px; color: #0f172a; margin-top: 2px; }
    .tabs-nav { display: flex; gap: 8px; margin-bottom: 16px; background: #f1f5f9; padding: 4px; border-radius: 10px; }
    .tab-link { flex: 1; text-align: center; text-decoration: none; padding: 8px 12px; font-size: 12px; font-weight: 700; border-radius: 8px; color: #475569; }
    .tab-link.active { background: #ffffff; color: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .table-card { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
    th { background: #f1f5f9; padding: 10px 14px; font-weight: 700; border-bottom: 1px solid #cbd5e1; color: #334155; }
    td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) { background: #f8fafc; }
    .code-badge { background: #eff6ff; color: #1e40af; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-weight: bold; border: 1px solid #bfdbfe; font-size: 11px; }
    .status-badge { font-weight: 800; font-size: 10px; padding: 2px 8px; border-radius: 6px; display: inline-block; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: bold; border: none; cursor: pointer; }
    .btn:hover { background: #1d4ed8; }
    .actions { display: flex; gap: 8px; align-items: center; }
    .footer-signs { margin-top: 36px; padding-top: 24px; border-top: 1px solid #cbd5e1; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; text-align: center; font-size: 12px; }
    .sign-line { height: 32px; border-bottom: 1px dashed #94a3b8; margin-bottom: 6px; }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; border: none; }
      .header-bar, .actions, .tabs-nav { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <div>
        <strong>Official Class Attendance Register (Teacher View)</strong>
        <p style="font-size: 11px; opacity: 0.8;">Live attendance verified by Class Representative</p>
      </div>
      <div class="actions">
        <button class="btn" onclick="window.print()">Print / PDF</button>
        <a class="btn" style="background: #334155;" href="/?view=teacher-gdoc&classId=${encodeURIComponent(cls.id)}&date=${encodeURIComponent(dateParam)}">Interactive App</a>
      </div>
    </div>
    <div class="paper">
      <div class="doc-title">
        <h1>College Department of Computer Science & Engineering</h1>
        <p>DAILY CLASS ATTENDANCE & ABSENTEE REPORT</p>
      </div>
      <div class="meta-grid">
        <div class="meta-item">
          <span>Subject</span>
          <strong>${cls.name}</strong>
          <small style="color: #64748b;">${cls.code}</small>
        </div>
        <div class="meta-item">
          <span>Faculty</span>
          <strong>${cls.teacherName}</strong>
          <small style="color: #64748b;">Room: ${cls.room}</small>
        </div>
        <div class="meta-item">
          <span>Date</span>
          <strong>${dateParam}</strong>
          <small style="color: #64748b;">Daily Session</small>
        </div>
        <div class="meta-item">
          <span>Attendance Rate</span>
          <strong style="color: #16a34a;">${presentCount} Present</strong>
          <small style="color: #dc2626; font-weight: bold;">${absentCount} Absent (${percent}%)</small>
        </div>
      </div>

      <div class="tabs-nav">
        <a href="?classId=${encodeURIComponent(cls.id)}&date=${encodeURIComponent(dateParam)}&filter=absent" class="tab-link ${filterMode === 'absent' ? 'active' : ''}">
          🔴 Only Absentees (${absentCount})
        </a>
        <a href="?classId=${encodeURIComponent(cls.id)}&date=${encodeURIComponent(dateParam)}&filter=all" class="tab-link ${filterMode === 'all' ? 'active' : ''}">
          📋 All Students (${totalStudents})
        </a>
        <a href="?classId=${encodeURIComponent(cls.id)}&date=${encodeURIComponent(dateParam)}&filter=present" class="tab-link ${filterMode === 'present' ? 'active' : ''}">
          🟢 Present Only (${presentCount})
        </a>
      </div>

      <h3 style="font-size: 15px; font-weight: 800; margin-bottom: 12px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
        <span style="display:inline-block; width: 10px; height: 10px; background: ${filterMode === 'present' ? '#16a34a' : (filterMode === 'all' ? '#2563eb' : '#dc2626')}; border-radius: 50%;"></span>
        ${filterMode === 'all' ? `All Registered Students (${totalStudents})` : (filterMode === 'present' ? `List of Present Students (${presentCount})` : `List of Absent Students (${absentCount})`)}
      </h3>

      ${displayList.length > 0 ? `
      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>Roll Number</th>
              <th style="text-align: center;">Code</th>
              <th>Student Name</th>
              <th>Batch</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${displayList.map((s, idx) => `
              <tr>
                <td style="text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
                <td style="font-family: monospace; font-weight: bold;">${s.rollNo}</td>
                <td style="text-align: center;"><span class="code-badge">${s.last4Digits}</span></td>
                <td style="font-weight: 700; color: #0f172a;">${s.name}</td>
                <td style="color: #64748b;">${s.batch || "Batch 2026"}</td>
                <td style="text-align: center;">
                  <span class="status-badge" style="background: ${s.status === 'ABSENT' ? '#fee2e2' : (s.status === 'PRESENT' ? '#dcfce7' : '#f1f5f9')}; color: ${s.statusColor || (s.status === 'ABSENT' ? '#dc2626' : '#16a34a')}; border: 1px solid ${s.status === 'ABSENT' ? '#fca5a5' : '#86efac'};">
                    ${s.status || (filterMode === 'present' ? 'PRESENT' : 'ABSENT')}
                  </span>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ` : `
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 24px; text-align: center; color: #065f46; margin-bottom: 24px;">
        <strong style="font-size: 16px;">${filterMode === 'absent' ? '100% Full Attendance!' : 'No students found.'}</strong>
        <p style="font-size: 12px; margin-top: 4px;">${filterMode === 'absent' ? 'All registered students are marked present for this session.' : 'No records match this filter.'}</p>
      </div>
      `}

      <div class="footer-signs">
        <div>
          <div class="sign-line"></div>
          <strong>Class Representative (CR) Signature</strong>
          <p style="font-size: 11px; color: #64748b;">Recorded via 4-Digit Fast Keypad</p>
        </div>
        <div>
          <div class="sign-line"></div>
          <strong>Faculty Incharge Signature</strong>
          <p style="font-size: 11px; color: #64748b;">${cls.teacherName}</p>
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px; font-size: 10px; color: #94a3b8;">
        Official College CR Attendance Portal • Generated: ${new Date().toLocaleString()}
      </div>
    </div>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });

  // AI Document / Photo Roster Scanner Endpoint
  app.post("/api/scan-roster", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;

      if (!imageBase64) {
        res.status(400).json({ error: "No image provided. Please upload an image or take a photo." });
        return;
      }

      // Check for Gemini API key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ 
          error: "GEMINI_API_KEY is not configured on the server. Please ensure the API key is set in Settings." 
        });
        return;
      }

      // Clean base64 data if it includes a data URL prefix
      let cleanBase64 = imageBase64;
      let detectedMime = mimeType;
      if (imageBase64.includes(";base64,")) {
        const parts = imageBase64.split(";base64,");
        cleanBase64 = parts[1];
        const prefix = parts[0];
        if (prefix.includes(":")) {
          detectedMime = prefix.split(":")[1];
        }
      }

      // Initialize Google GenAI lazily with User-Agent
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `You are an expert college attendance sheet and student roster scanner.
Analyze this photo of a college student list, attendance sheet, or roster (which may be printed or handwritten).
Extract all student entries found on the sheet.

For EACH student, extract:
1. rollNo: The full official university roll number, registration ID, or student number (e.g. "2026CS1042", "CS4021", or "1042"). If no roll number is found, synthesize a sequential code like "2026CS1001".
2. name: The student's full name, formatted in clean Title Case (e.g. "Rahul Sharma").
3. phone: Phone number if visible, otherwise empty string "".
4. email: Email address if visible, otherwise empty string "".
5. batch: Section, department, or batch if indicated (e.g. "CS-A", "Tech 2026"), otherwise "Batch 2026".
6. last4Digits: EXACTLY the last 4 numeric digits of their roll number. If the roll number has fewer than 4 digits, pad with leading zeros to make 4 digits (e.g. "42" -> "0042", "142" -> "0142", "2026CS1042" -> "1042").

CRITICAL: Return a valid JSON object ONLY.
Schema:
{
  "students": [
    {
      "rollNo": "2026CS1001",
      "last4Digits": "1001",
      "name": "Student Full Name",
      "phone": "",
      "email": "",
      "batch": "Batch 2026"
    }
  ]
}
Do not wrap in markdown quotes if possible, return strictly parseable JSON.`;

      let responseText = "";
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: detectedMime,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
          },
        });
        responseText = response.text || "";
      } catch (primaryErr: any) {
        console.warn("Primary model gemini-3.1-flash-lite error, attempting fallback gemini-flash-latest:", primaryErr.message);
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: detectedMime,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
          },
        });
        responseText = fallbackResponse.text || "";
      }

      // Parse JSON safely from output (handling potential markdown code blocks or conversational prefixes)
      let cleanedJsonText = responseText.trim();
      const firstBrace = cleanedJsonText.indexOf("{");
      const lastBrace = cleanedJsonText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanedJsonText = cleanedJsonText.substring(firstBrace, lastBrace + 1);
      } else if (cleanedJsonText.startsWith("```")) {
        cleanedJsonText = cleanedJsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      try {
        const parsedData = JSON.parse(cleanedJsonText);
        const studentsList = Array.isArray(parsedData.students) ? parsedData.students : [];

        // Normalize last4Digits for all students
        const normalizedStudents = studentsList.map((s: any, idx: number) => {
          let roll = (s.rollNo || "").toString().trim() || `2026CS${1001 + idx}`;
          let digits = roll.replace(/\D/g, "");
          let last4 = digits.length >= 4 ? digits.slice(-4) : digits.padStart(4, "0");
          if (last4.length === 0) last4 = String(1001 + idx).padStart(4, "0");

          return {
            rollNo: roll,
            last4Digits: last4,
            name: (s.name || `Student ${idx + 1}`).toString().trim(),
            phone: (s.phone || "").toString().trim(),
            email: (s.email || "").toString().trim(),
            batch: (s.batch || "Batch 2026").toString().trim(),
          };
        });

        res.json({ success: true, count: normalizedStudents.length, students: normalizedStudents });
      } catch (parseErr) {
        console.error("JSON parsing error from Gemini output:", parseErr, responseText);
        res.status(500).json({ 
          error: "Could not parse students from the document. Please ensure the image is clear and well-lit.",
          rawOutput: responseText 
        });
      }

    } catch (err: any) {
      console.error("Error in /api/scan-roster:", err);
      res.status(500).json({ error: err.message || "Failed to scan roster image." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CR Attendance Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
