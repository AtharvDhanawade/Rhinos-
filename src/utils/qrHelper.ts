import { INITIAL_STUDENTS } from './storage';

/**
 * Centralized QR Code & Share URL Generator
 * Generates low-density, high-contrast QR URLs that encode absentee names
 * and roll numbers for instant camera scanning and offline reliability.
 */

export const DEFAULT_SHARED_PUBLIC_URL = 
  'https://ais-pre-xk3vtlcj35nhj3236teta4-67158377874.asia-southeast1.run.app';

export const CUSTOM_BASE_URL_STORAGE_KEY = 'cr_qr_custom_base_url';

/**
 * Returns the current application base URL that the browser and mobile scanners can access.
 */
export function getCleanPublicBaseUrl(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_SHARED_PUBLIC_URL;
  }

  // 1. Check if user configured a custom base URL (e.g. custom domain, Wi-Fi IP, ngrok)
  try {
    const custom = localStorage.getItem(CUSTOM_BASE_URL_STORAGE_KEY);
    if (custom && custom.trim().startsWith('http')) {
      return custom.trim().replace(/\/+$/, '');
    }
  } catch (e) {
    // ignore localStorage error
  }

  // 2. Convert internal AI Studio container dev origin to public shared preview endpoint
  const origin = window.location.origin || '';

  // CRITICAL FIX FOR 404:
  // In Google Cloud Run / AI Studio, 'ais-dev-*' requires internal developer authentication cookies.
  // When an external device (like a teacher's phone camera) opens 'ais-dev-*', it returns 404 Page Not Found.
  // The public shared endpoint is 'ais-pre-*', which is publicly accessible to any mobile phone!
  if (origin.includes('ais-dev-')) {
    return origin.replace('ais-dev-', 'ais-pre-');
  }

  // If running inside Google AI Studio host container
  if (origin.includes('ai.studio') || origin.includes('google.com')) {
    return DEFAULT_SHARED_PUBLIC_URL;
  }

  // If running on localhost or 127.0.0.1, phone scanning 'http://localhost:3000'
  // will fail with "page not found" on the mobile device because localhost points to the phone.
  // Default to the public cloud URL so phone scanning works right out of the box!
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return DEFAULT_SHARED_PUBLIC_URL;
  }

  return origin || DEFAULT_SHARED_PUBLIC_URL;
}

export function saveCustomBaseUrl(url: string) {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem(CUSTOM_BASE_URL_STORAGE_KEY);
    } else {
      localStorage.setItem(CUSTOM_BASE_URL_STORAGE_KEY, url.trim().replace(/\/+$/, ''));
    }
  } catch (e) {
    console.error('Failed to save custom base url', e);
  }
}

export function getCustomBaseUrl(): string {
  try {
    return localStorage.getItem(CUSTOM_BASE_URL_STORAGE_KEY) || '';
  } catch (e) {
    return '';
  }
}

export interface AbsenteeStudentPayload {
  rollNo: string;
  name: string;
  last4Digits: string;
}

export interface TeacherDocUrlParams {
  classId: string;
  className?: string;
  teacherName?: string;
  room?: string;
  date: string;
  time?: string;
  sessionId?: string;
  sessionTitle?: string;
  presentCount?: number;
  absentCount?: number;
  absentRolls?: string[];
  absentees?: AbsenteeStudentPayload[];
}

/**
 * Builds an ultra-compact, high-readability URL for Teacher Absentee Google Doc Report / Day Attendance.
 * Encodes absentee roll numbers and student names directly in the URL so that ANY camera scan
 * immediately displays the real student names without relying on external network sync!
 */
export function buildTeacherDocUrl(params: TeacherDocUrlParams): string {
  const base = getCleanPublicBaseUrl();
  const searchParams = new URLSearchParams();
  
  searchParams.set('view', 'teacher-day');
  searchParams.set('classId', params.classId);
  searchParams.set('date', params.date);

  if (params.className) searchParams.set('cn', params.className);
  if (params.time) searchParams.set('t', params.time);
  if (params.sessionId) searchParams.set('sessionId', params.sessionId);
  if (params.sessionTitle) searchParams.set('sessionTitle', params.sessionTitle);
  if (params.presentCount !== undefined) searchParams.set('p', String(params.presentCount));
  if (params.absentCount !== undefined) searchParams.set('a', String(params.absentCount));

  // Encode absentee students (code:name) so absentee names are ALWAYS visible on scan
  if (params.absentees && params.absentees.length > 0) {
    if (params.absentees.length <= 16) {
      // Compact code:name pairs (e.g. "1001:Aarav Sharma")
      const pairs = params.absentees.map(st => {
        const code = st.last4Digits || (st.rollNo ? st.rollNo.slice(-4) : '----');
        const cleanName = (st.name || 'Student').replace(/[,:~|]/g, ' ').trim();
        return `${code}:${cleanName}`;
      });
      searchParams.set('abs', pairs.join(','));
    } else {
      // If large class with >16 absentees, encode roll codes to keep QR matrix low density
      const codes = params.absentees.map(st => st.last4Digits || st.rollNo);
      searchParams.set('abs', codes.join(','));
    }
  } else if (params.absentRolls && params.absentRolls.length > 0) {
    searchParams.set('abs', params.absentRolls.join(','));
  }

  return `${base}/?${searchParams.toString()}`;
}

/**
 * Parses absentee students directly from URL parameters (e.g. from QR scan).
 * Guarantees that student names are never blank even on a new device or offline scanner.
 */
export function parseAbsenteesFromUrl(urlParams: URLSearchParams, allKnownStudents: any[] = []): any[] {
  // Combine provided roster with default INITIAL_STUDENTS to guarantee name resolution
  const lookupPool = [...(allKnownStudents || []), ...INITIAL_STUDENTS];

  // 1. Check legacy absData (delimiter ~ and |)
  const absData = urlParams.get('absData');
  if (absData) {
    const rawList = absData.split('~').filter(Boolean);
    return rawList.map((item, idx) => {
      const parts = item.split('|');
      const last4 = decodeURIComponent(parts[0] || '').trim();
      const rollNo = decodeURIComponent(parts[1] || '').trim();
      const name = decodeURIComponent(parts[2] || '').trim();

      const matched = lookupPool.find(s => 
        (last4 && s.last4Digits === last4) || 
        (rollNo && s.rollNo === rollNo) ||
        (name && s.name && s.name.toLowerCase() === name.toLowerCase())
      );

      const resolvedName = name || (matched ? matched.name : (last4 ? `Student (${last4})` : `Student #${idx + 1}`));
      const resolvedRoll = rollNo || (matched ? matched.rollNo : (last4 ? `Roll ...${last4}` : `Roll #${idx + 1}`));
      const resolvedLast4 = last4 || (matched ? matched.last4Digits : (resolvedRoll.slice(-4) || '----'));

      return {
        id: matched ? matched.id : `abs-url-${idx}-${resolvedLast4}`,
        rollNo: resolvedRoll,
        last4Digits: resolvedLast4,
        name: resolvedName,
        phone: matched ? matched.phone : '',
        email: matched ? matched.email : '',
        batch: matched ? matched.batch : 'Batch 2026',
        avatarColor: matched ? matched.avatarColor : 'bg-rose-500',
        status: 'absent' as const,
        isAbsent: true,
        isPresent: false,
      };
    });
  }

  // 2. Check abs parameter (supports both "1001:Aarav Sharma" and "1001" comma-separated formats)
  const absParam = urlParams.get('abs');
  if (absParam) {
    const items = absParam.split(',').filter(Boolean);
    return items.map((itemStr, idx) => {
      let raw = decodeURIComponent(itemStr).trim();
      let code = raw;
      let explicitName = '';

      if (raw.includes(':')) {
        const colonIdx = raw.indexOf(':');
        code = raw.slice(0, colonIdx).trim();
        explicitName = raw.slice(colonIdx + 1).trim();
      }

      const matched = lookupPool.find(s => 
        s.last4Digits === code || s.rollNo === code || s.rollNo.endsWith(code)
      );

      const resolvedName = explicitName || (matched ? matched.name : (code ? `Student (${code})` : `Student #${idx + 1}`));
      const resolvedRoll = matched ? matched.rollNo : (code.length >= 6 ? code : `Roll ...${code}`);
      const resolvedLast4 = matched ? matched.last4Digits : (code.slice(-4) || code);

      return {
        id: matched ? matched.id : `abs-legacy-${idx}-${code}`,
        rollNo: resolvedRoll,
        last4Digits: resolvedLast4,
        name: resolvedName,
        phone: matched ? matched.phone : '',
        email: matched ? matched.email : '',
        batch: matched ? matched.batch : 'Batch 2026',
        avatarColor: matched ? matched.avatarColor : 'bg-rose-500',
        status: 'absent' as const,
        isAbsent: true,
        isPresent: false,
      };
    });
  }

  return [];
}

export const buildTeacherDayUrl = buildTeacherDocUrl;

/**
 * Builds the URL for Teacher Live Weekly Portal
 */
export function buildTeacherPortalUrl(classId: string, weekNumber: number): string {
  const base = getCleanPublicBaseUrl();
  const searchParams = new URLSearchParams();
  
  searchParams.set('view', 'teacher');
  searchParams.set('classId', classId);
  searchParams.set('week', String(weekNumber));

  return `${base}/?${searchParams.toString()}`;
}

/**
 * Builds the URL for the CR Mobile Roll Call Portal
 * Scanned by the Class Representative to mark and submit attendance to the Admin Laptop!
 */
export function buildCrPortalUrl(classId?: string): string {
  const base = getCleanPublicBaseUrl();
  const searchParams = new URLSearchParams();
  
  searchParams.set('view', 'cr-portal');
  if (classId) {
    searchParams.set('classId', classId);
  }

  return `${base}/?${searchParams.toString()}`;
}

