// Validation limits & helpers synchronized verbatim with firebase-blueprint.json
import type { LiveActivityKind, TypingUser } from '../types/chat';

export const LIMITS = {
  DISPLAY_NAME_MAX: 60,
  HANDLE_MIN: 2,
  HANDLE_MAX: 32,
  BIO_MAX: 240,
  PHOTO_URL_MAX: 45000,
  MAJOR_MAX: 80,
  STATUS_MSG_MAX: 80,
  ROOM_NAME_MAX: 80,
  ROOM_SLUG_MAX: 64,
  ROOM_DESC_MAX: 300,
  MESSAGE_TEXT_MAX: 4000,
  MEDIA_URL_MAX: 350000,
  MEDIA_NAME_MAX: 160,
  REPLY_SNIPPET_MAX: 180,
  EVENT_TITLE_MAX: 120,
  EVENT_DESC_MAX: 600,
  EVENT_LOCATION_MAX: 160,
  REPORT_REASON_MAX: 400,
  JOIN_NOTE_MAX: 240,
  MENTIONS_MAX: 20,
  READ_BY_MAX: 100,
} as const;

export const CAMPUS_IMAGES = {
  welcomeQuad: '/src/assets/images/campus_welcome_quad_1795281690193.jpg',
  roboticsLab: '/src/assets/images/club_robotics_banner_1795281690340.jpg',
  studyLounge: '/src/assets/images/club_coffee_study_1795281689499.jpg',
  amphitheaterEvent: '/src/assets/images/campus_amphitheater_event_1795281690586.jpg',
} as const;

export function sanitizeHandle(raw: string, fallbackUid: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, LIMITS.HANDLE_MAX);
  if (cleaned.length >= LIMITS.HANDLE_MIN) return cleaned;
  return `member_${fallbackUid.slice(0, 6).toLowerCase()}`;
}

export function slugifyRoomName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.ROOM_SLUG_MAX);
  return base || 'campus-room';
}

export function generateId(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  return `${prefix}_${randomPart}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

export function generateInviteCode(prefix = 'QUAD'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part = '';
  for (let i = 0; i < 6; i++) {
    part += chars[Math.floor(Math.random() * chars.length)];
  }
  const cleanPrefix = prefix
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'QUAD';
  return `${cleanPrefix}-${part}`.slice(0, 24);
}

export function makeDmRoomId(uidA: string, uidB: string): string {
  const sorted = [uidA, uidB].sort();
  const safeA = sorted[0].replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 56);
  const safeB = sorted[1].replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 56);
  return `dm_${safeA}_${safeB}`.slice(0, 128);
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>()]+/i);
  if (!match) return null;
  return match[0].replace(/[.,!?;:]+$/, '');
}

export function hasGroupBroadcastMention(text: string): boolean {
  return /(?:^|\s)@(?:everyone|all)(?=$|[\s.,!?;:])/i.test(text);
}

export function extractMentionedUids(
  text: string,
  members: Array<{ uid: string; handle: string; displayName: string }>,
  excludeUid?: string
): string[] {
  const found = new Set<string>();
  const regex = /@([a-zA-Z0-9_.-]{2,32})/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const token = match[1].toLowerCase();
    if (token === 'everyone' || token === 'all') {
      for (const m of members) {
        if (excludeUid && m.uid === excludeUid) continue;
        found.add(m.uid);
        if (found.size >= LIMITS.MENTIONS_MAX) break;
      }
      if (found.size >= LIMITS.MENTIONS_MAX) break;
      continue;
    }
    const member = members.find(
      (m) => m.handle.toLowerCase() === token || m.displayName.toLowerCase().replace(/\s+/g, '') === token
    );
    if (member && member.uid !== excludeUid) found.add(member.uid);
    if (found.size >= LIMITS.MENTIONS_MAX) break;
  }
  return Array.from(found);
}

export function formatLiveActivity(
  users: TypingUser[],
  compact = false
): { text: string; kind: LiveActivityKind } | null {
  if (!users || users.length === 0) return null;

  const sendingVoice = users.filter((u) => u.activity === 'sending_voice');
  const recordingVoice = users.filter((u) => u.activity === 'recording_voice');
  const typing = users.filter((u) => !u.activity || u.activity === 'typing');

  if (sendingVoice.length > 0) {
    const first = sendingVoice[0].displayName;
    return {
      kind: 'sending_voice',
      text:
        sendingVoice.length === 1
          ? compact
            ? `${first} sending voice note...`
            : `${first} is sending a voice note...`
          : `${first} and ${sendingVoice.length - 1} other${sendingVoice.length - 1 === 1 ? '' : 's'} sending voice notes...`,
    };
  }

  if (recordingVoice.length > 0) {
    const first = recordingVoice[0].displayName;
    if (recordingVoice.length === 1 && typing.length === 0) {
      return {
        kind: 'recording_voice',
        text: compact ? `${first} recording voice note...` : `${first} is recording a voice note...`,
      };
    }
    if (recordingVoice.length === 1 && typing.length > 0) {
      return {
        kind: 'recording_voice',
        text: `${first} is recording a voice note & ${typing[0].displayName} is typing...`,
      };
    }
    return {
      kind: 'recording_voice',
      text: `${first} and ${recordingVoice.length - 1} other${recordingVoice.length - 1 === 1 ? '' : 's'} are recording voice notes...`,
    };
  }

  if (typing.length === 1) {
    return {
      kind: 'typing',
      text: compact ? `${typing[0].displayName} is typing...` : `${typing[0].displayName} is typing`,
    };
  }
  if (typing.length === 2) {
    return {
      kind: 'typing',
      text: `${typing[0].displayName} and ${typing[1].displayName} are typing`,
    };
  }
  return {
    kind: 'typing',
    text: `${typing[0].displayName} and ${typing.length - 1} others are typing`,
  };
}

export async function compressImageToDataUrl(
  file: File,
  maxDimension: number,
  maxChars: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > maxChars && quality > 0.25) {
          quality -= 0.12;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length > maxChars) {
          reject(new Error('Image is too large even after compression. Try a smaller photo.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function readFileAsDataUrl(file: File, maxChars: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 240 * 1024) {
      reject(new Error('Files must be 240 KB or smaller for instant room sharing.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const result = String(reader.result || '');
      if (result.length > maxChars) {
        reject(new Error('File exceeds maximum encoded size limit.'));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTimestamp(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts) return 'Sending...';
  const date = ts.toDate();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateDivider(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts) return 'Today';
  const date = ts.toDate();
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
