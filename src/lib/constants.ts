export type VoiceEffectId =
  | 'normal'
  | 'deep'
  | 'high_pitch'
  | 'robot'
  | 'echo'
  | 'child'
  | 'old_man'
  | 'alien';

export interface VoiceEffectOption {
  id: VoiceEffectId;
  label: string;
  shortLabel: string;
  description: string;
}

export const MAX_FILE_SIZE_MB = 90;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; // 94,371,840 bytes
export const UPLOAD_CHUNK_SIZE_BYTES = 1024 * 1024; // 1 MB chunks
export const FILE_TOO_LARGE_ERROR = 'File too large. Maximum size is 90 MB.';

export const VOICE_NOTE_MIN_SEC = 1;
export const VOICE_NOTE_MAX_SEC = 300; // 5 minutes
export const VOICE_NOTE_MIN_HINT = 'Hold longer to record (minimum 1 second).';
export const VOICE_NOTE_MAX_HINT = 'Reached 5:00 limit. Preview or send your voice note.';

export const PLAYBACK_SPEEDS = [1, 1.5, 2] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export const PHOTO_THUMBNAIL_MAX_PX = 480;
export const PHOTO_THUMBNAIL_QUALITY = 0.72;

export const VOICE_EFFECTS: VoiceEffectOption[] = [
  {
    id: 'normal',
    label: 'Normal / Off',
    shortLabel: 'Normal',
    description: 'Natural unprocessed voice',
  },
  {
    id: 'deep',
    label: 'Deep',
    shortLabel: 'Deep',
    description: 'Lower pitch with warm bass',
  },
  {
    id: 'high_pitch',
    label: 'High-pitch',
    shortLabel: 'Chipmunk',
    description: 'Bright elevated pitch',
  },
  {
    id: 'robot',
    label: 'Robot',
    shortLabel: 'Robot',
    description: 'Metallic ring-modulated synth',
  },
  {
    id: 'echo',
    label: 'Echo',
    shortLabel: 'Echo',
    description: 'Spacious hall delay feedback',
  },
  {
    id: 'child',
    label: 'Child',
    shortLabel: 'Child',
    description: 'Light youthful pitch and timbre',
  },
  {
    id: 'old_man',
    label: 'Old Man',
    shortLabel: 'Old Man',
    description: 'Gravelly low formant with tremor',
  },
  {
    id: 'alien',
    label: 'Alien',
    shortLabel: 'Alien',
    description: 'Warped extraterrestrial modulation',
  },
];

export const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.msi',
  '.scr',
  '.com',
  '.dll',
  '.vbs',
  '.ps1',
  '.app',
  '.dmg',
]);

export const ALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'text/',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/x-tar',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-',
  'application/octet-stream',
];

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
  '.avif',
  '.bmp',
  '.svg',
]);

export function validateFileClient(
  file: Pick<File, 'name' | 'size' | 'type'>,
  expectImageOnly = false
): { ok: true } | { ok: false; error: string } {
  if (file.size <= 0) {
    return { ok: false, error: 'Selected file is empty.' };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: FILE_TOO_LARGE_ERROR };
  }
  const lowerName = file.name.toLowerCase();
  const dotIdx = lowerName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? lowerName.slice(dotIdx) : '';
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, error: `Executable files (${ext}) are not permitted.` };
  }
  if (expectImageOnly) {
    const isImageMime = file.type.toLowerCase().startsWith('image/');
    const isImageExt = Boolean(ext && IMAGE_EXTENSIONS.has(ext));
    if (!isImageMime && !isImageExt) {
      return { ok: false, error: 'Please choose an image file (JPG, PNG, WebP, GIF, or HEIC).' };
    }
  }
  if (
    file.type &&
    !ALLOWED_MIME_PREFIXES.some((prefix) => file.type.toLowerCase().startsWith(prefix))
  ) {
    return { ok: false, error: `Unsupported file type (${file.type}).` };
  }
  return { ok: true };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getVoiceEffectLabel(effect?: VoiceEffectId | string): string {
  const found = VOICE_EFFECTS.find((item) => item.id === effect);
  return found ? found.shortLabel : 'Normal';
}

export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  const turnUrl = (import.meta.env.VITE_TURN_URL as string | undefined)?.trim();
  const turnUsername = (import.meta.env.VITE_TURN_USERNAME as string | undefined)?.trim();
  const turnCredential = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined)?.trim();

  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      ...(turnUsername ? { username: turnUsername } : {}),
      ...(turnCredential ? { credential: turnCredential } : {}),
    });
  }

  return servers;
}
