import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Student, ClassSubject, AttendanceRecord, WeeklySyncSettings, DeviceInfo, DeviceRole, AttendanceStatus } from '../types';

let firestoreDb: Firestore | null = null;

try {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  if (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)') {
    firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } else {
    firestoreDb = getFirestore(app);
  }
} catch (err) {
  console.warn('Firebase initialization warning:', err);
}

const LOCAL_DEVICE_KEY = 'rhino_device_info_v1';

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem('rhino_device_id_v1');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('rhino_device_id_v1', id);
    }
    return id;
  } catch {
    return 'dev-default';
  }
}

export function getStoredDeviceRole(): DeviceRole {
  try {
    const raw = localStorage.getItem(LOCAL_DEVICE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.role) return parsed.role;
    }
  } catch {}
  return 'admin';
}

export function setStoredDeviceRole(role: DeviceRole): void {
  try {
    const id = getDeviceId();
    const info: DeviceInfo = {
      deviceId: id,
      deviceName: role === 'admin' ? 'Primary Admin Laptop' : 'Secondary Laptop',
      role,
      lastSeen: new Date().toLocaleTimeString(),
      isCurrentDevice: true
    };
    localStorage.setItem(LOCAL_DEVICE_KEY, JSON.stringify(info));
    registerDeviceHeartbeat(role).catch(() => {});
  } catch {}
}

export async function registerDeviceHeartbeat(overrideRole?: DeviceRole): Promise<void> {
  const role = overrideRole || getStoredDeviceRole();
  const id = getDeviceId();
  const info: DeviceInfo = {
    deviceId: id,
    deviceName: role === 'admin' ? 'Primary Admin Laptop' : 'Secondary Laptop',
    role,
    lastSeen: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    isCurrentDevice: true
  };

  try {
    localStorage.setItem(LOCAL_DEVICE_KEY, JSON.stringify(info));
  } catch {}

  if (!firestoreDb) return;
  try {
    const deviceRef = doc(firestoreDb, 'connected_devices', id);
    await setDoc(deviceRef, {
      ...info,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    // Offline or permissions notice
  }
}

export function subscribeToStudents(
  onUpdate: (students: Student[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!firestoreDb) return () => {};
  try {
    const colRef = collection(firestoreDb, 'students');
    return onSnapshot(colRef, (snapshot) => {
      const list: Student[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as Student);
      });
      if (list.length > 0) {
        onUpdate(list);
      }
    }, (err) => {
      if (onError) onError(err);
    });
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

export function subscribeToClasses(
  onUpdate: (classes: ClassSubject[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!firestoreDb) return () => {};
  try {
    const colRef = collection(firestoreDb, 'classes');
    return onSnapshot(colRef, (snapshot) => {
      const list: ClassSubject[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as ClassSubject);
      });
      if (list.length > 0) {
        onUpdate(list);
      }
    }, (err) => {
      if (onError) onError(err);
    });
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

export function subscribeToAttendance(
  onUpdate: (records: AttendanceRecord[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!firestoreDb) return () => {};
  try {
    const colRef = collection(firestoreDb, 'attendance_records');
    return onSnapshot(colRef, (snapshot) => {
      const list: AttendanceRecord[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as AttendanceRecord);
      });
      if (list.length > 0) {
        onUpdate(list);
      }
    }, (err) => {
      if (onError) onError(err);
    });
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

export function subscribeToSettings(
  onUpdate: (payload: { settings?: WeeklySyncSettings; activeClassId?: string }) => void,
  onError?: (err: any) => void
): () => void {
  if (!firestoreDb) return () => {};
  try {
    const docRef = doc(firestoreDb, 'system_config', 'global_settings');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        onUpdate({
          settings: data.settings as WeeklySyncSettings,
          activeClassId: data.activeClassId as string
        });
      }
    }, (err) => {
      if (onError) onError(err);
    });
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

export function subscribeToDevices(
  onUpdate: (devices: DeviceInfo[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!firestoreDb) return () => {};
  try {
    const colRef = collection(firestoreDb, 'connected_devices');
    const myId = getDeviceId();
    return onSnapshot(colRef, (snapshot) => {
      const list: DeviceInfo[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data() as DeviceInfo;
        list.push({
          ...d,
          isCurrentDevice: d.deviceId === myId
        });
      });
      onUpdate(list);
    }, (err) => {
      if (onError) onError(err);
    });
  } catch (err) {
    if (onError) onError(err);
    return () => {};
  }
}

export async function firebaseSaveStudent(student: Student): Promise<void> {
  if (!firestoreDb || !student.id) return;
  try {
    const docRef = doc(firestoreDb, 'students', student.id);
    await setDoc(docRef, student, { merge: true });
  } catch (e) {
    console.warn('Firebase student save notice:', e);
  }
}

export async function firebaseDeleteStudent(studentId: string): Promise<void> {
  if (!firestoreDb || !studentId) return;
  try {
    const docRef = doc(firestoreDb, 'students', studentId);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn('Firebase student delete notice:', e);
  }
}

export async function firebaseBulkImportStudents(students: Student[]): Promise<void> {
  if (!firestoreDb || !Array.isArray(students) || students.length === 0) return;
  try {
    const batch = writeBatch(firestoreDb);
    for (const student of students) {
      if (!student.id) continue;
      const ref = doc(firestoreDb, 'students', student.id);
      batch.set(ref, student, { merge: true });
    }
    await batch.commit();
  } catch (e) {
    console.warn('Firebase bulk import notice:', e);
  }
}

export async function firebaseSaveClass(cls: ClassSubject): Promise<void> {
  if (!firestoreDb || !cls.id) return;
  try {
    const docRef = doc(firestoreDb, 'classes', cls.id);
    await setDoc(docRef, cls, { merge: true });
  } catch (e) {
    console.warn('Firebase class save notice:', e);
  }
}

export async function firebaseDeleteClass(classId: string): Promise<void> {
  if (!firestoreDb || !classId) return;
  try {
    const docRef = doc(firestoreDb, 'classes', classId);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn('Firebase class delete notice:', e);
  }
}

export async function firebaseMarkAttendanceRecord(record: AttendanceRecord): Promise<void> {
  if (!firestoreDb || !record.id) return;
  try {
    const docRef = doc(firestoreDb, 'attendance_records', record.id);
    await setDoc(docRef, record, { merge: true });
  } catch (e) {
    console.warn('Firebase record save notice:', e);
  }
}

export async function firebaseBatchMarkAttendance(records: AttendanceRecord[]): Promise<void> {
  if (!firestoreDb || !Array.isArray(records) || records.length === 0) return;
  try {
    const batch = writeBatch(firestoreDb);
    for (const r of records) {
      if (!r.id) continue;
      const ref = doc(firestoreDb, 'attendance_records', r.id);
      batch.set(ref, r, { merge: true });
    }
    await batch.commit();
  } catch (e) {
    console.warn('Firebase batch attendance notice:', e);
  }
}

export async function firebaseUpdateRecordStatus(recordId: string, status: AttendanceStatus): Promise<void> {
  if (!firestoreDb || !recordId) return;
  try {
    const docRef = doc(firestoreDb, 'attendance_records', recordId);
    await setDoc(docRef, { status }, { merge: true });
  } catch (e) {
    console.warn('Firebase update status notice:', e);
  }
}

export async function firebaseDeleteRecord(recordId: string): Promise<void> {
  if (!firestoreDb || !recordId) return;
  try {
    const docRef = doc(firestoreDb, 'attendance_records', recordId);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn('Firebase record delete notice:', e);
  }
}

export async function firebaseDeleteSessionRecords(sessionId: string, _date: string): Promise<void> {
  if (!firestoreDb || !sessionId) return;
  // Session cleanup if needed
}

export async function firebaseSaveSettings(settings: WeeklySyncSettings, activeClassId?: string): Promise<void> {
  if (!firestoreDb) return;
  try {
    const docRef = doc(firestoreDb, 'system_config', 'global_settings');
    await setDoc(docRef, {
      settings,
      activeClassId: activeClassId || '',
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('Firebase save settings notice:', e);
  }
}
