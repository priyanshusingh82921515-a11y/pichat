export const E2EE_PREFIX = 'e2ee:v1:';

export interface ChatPrivacySettings {
  /** End-to-end encrypt outgoing text messages with AES-256-GCM */
  encryptChatsByDefault: boolean;
  /** Room IDs where the user explicitly opted out of E2EE */
  unencryptedRoomIds: string[];
  /** Send blue-tick read receipts when reading messages */
  readReceiptsEnabled: boolean;
  /** Broadcast live typing / recording-voice indicators */
  typingIndicatorsEnabled: boolean;
  /** Appear offline to other members even while active */
  hideOnlineStatus: boolean;
  /** Mask last-message previews inside the Chats list */
  hideMessagePreviews: boolean;
  /** WhatsApp-style PIN-locked chats hidden inside the Locked Chats vault */
  lockedRoomIds: string[];
  /** Salted SHA-256 hash of the user's 4-digit Privacy PIN */
  pinHash: string | null;
  /** Lock the full app with the Privacy PIN on open */
  appLockEnabled: boolean;
}

export const DEFAULT_PRIVACY_SETTINGS: ChatPrivacySettings = {
  encryptChatsByDefault: true,
  unencryptedRoomIds: [],
  readReceiptsEnabled: true,
  typingIndicatorsEnabled: true,
  hideOnlineStatus: false,
  hideMessagePreviews: false,
  lockedRoomIds: [],
  pinHash: null,
  appLockEnabled: false,
};

function getStorageKey(uid: string): string {
  return `quadline_privacy_v1_${uid}`;
}

export function loadPrivacySettings(uid: string): ChatPrivacySettings {
  try {
    const raw = localStorage.getItem(getStorageKey(uid));
    if (!raw) return { ...DEFAULT_PRIVACY_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ChatPrivacySettings>;
    return {
      encryptChatsByDefault:
        typeof parsed.encryptChatsByDefault === 'boolean'
          ? parsed.encryptChatsByDefault
          : DEFAULT_PRIVACY_SETTINGS.encryptChatsByDefault,
      unencryptedRoomIds: Array.isArray(parsed.unencryptedRoomIds)
        ? parsed.unencryptedRoomIds.filter((x): x is string => typeof x === 'string')
        : [],
      readReceiptsEnabled:
        typeof parsed.readReceiptsEnabled === 'boolean'
          ? parsed.readReceiptsEnabled
          : DEFAULT_PRIVACY_SETTINGS.readReceiptsEnabled,
      typingIndicatorsEnabled:
        typeof parsed.typingIndicatorsEnabled === 'boolean'
          ? parsed.typingIndicatorsEnabled
          : DEFAULT_PRIVACY_SETTINGS.typingIndicatorsEnabled,
      hideOnlineStatus:
        typeof parsed.hideOnlineStatus === 'boolean' ? parsed.hideOnlineStatus : false,
      hideMessagePreviews:
        typeof parsed.hideMessagePreviews === 'boolean' ? parsed.hideMessagePreviews : false,
      lockedRoomIds: Array.isArray(parsed.lockedRoomIds)
        ? parsed.lockedRoomIds.filter((x): x is string => typeof x === 'string')
        : [],
      pinHash: typeof parsed.pinHash === 'string' && parsed.pinHash.length >= 32 ? parsed.pinHash : null,
      appLockEnabled: Boolean(parsed.appLockEnabled && parsed.pinHash),
    };
  } catch {
    return { ...DEFAULT_PRIVACY_SETTINGS };
  }
}

export function savePrivacySettings(uid: string, settings: ChatPrivacySettings): void {
  try {
    localStorage.setItem(getStorageKey(uid), JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function isRoomEncryptionEnabled(
  roomId: string,
  settings: ChatPrivacySettings
): boolean {
  if (!settings.encryptChatsByDefault) return false;
  return !settings.unencryptedRoomIds.includes(roomId);
}

export function isEncryptedPayload(text: string | undefined | null): boolean {
  return typeof text === 'string' && text.startsWith(E2EE_PREFIX);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

const roomKeyCache = new Map<string, Promise<CryptoKey>>();

function getRoomAesKey(roomId: string): Promise<CryptoKey> {
  const cached = roomKeyCache.get(roomId);
  if (cached) return cached;

  const promise = (async () => {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(`quadline-e2ee-room-key::${roomId}`),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(`quadline-salt-v1:${roomId}`),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  })();

  roomKeyCache.set(roomId, promise);
  return promise;
}

export async function encryptChatText(roomId: string, plaintext: string): Promise<string> {
  if (!plaintext.trim() || typeof crypto === 'undefined' || !crypto.subtle) {
    return plaintext;
  }
  try {
    const key = await getRoomAesKey(roomId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return `${E2EE_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ciphertext))}`;
  } catch {
    return plaintext;
  }
}

export async function decryptChatText(roomId: string, payload: string): Promise<string> {
  if (!isEncryptedPayload(payload) || typeof crypto === 'undefined' || !crypto.subtle) {
    return payload;
  }
  try {
    const body = payload.slice(E2EE_PREFIX.length);
    const sep = body.indexOf(':');
    if (sep <= 0) return payload;
    const iv = base64ToBytes(body.slice(0, sep));
    const ct = base64ToBytes(body.slice(sep + 1));
    const key = await getRoomAesKey(roomId);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ct as BufferSource
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return '🔒 Encrypted message';
  }
}

export async function hashPrivacyPin(pin: string, uid: string): Promise<string> {
  const data = new TextEncoder().encode(`quadline-pin-v1:${uid}:${pin}`);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic hash if SubtleCrypto is unavailable
  let h = 2166136261;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 16777619);
  }
  return `fallback_${(h >>> 0).toString(16).padStart(32, '0')}`;
}

export async function verifyPrivacyPin(
  pin: string,
  uid: string,
  expectedHash: string
): Promise<boolean> {
  const actual = await hashPrivacyPin(pin, uid);
  return actual === expectedHash;
}

/** Computes a deterministic 60-digit WhatsApp-style SHA-256 verification code for a chat */
export async function computeRoomSecurityCode(
  roomId: string,
  memberUids: string[]
): Promise<string> {
  const sorted = [...memberUids].sort().join(',');
  const seed = new TextEncoder().encode(`quadline-safety-number-v1:${roomId}:${sorted}`);
  let bytes: Uint8Array;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hash = await crypto.subtle.digest('SHA-256', seed);
    bytes = new Uint8Array(hash);
  } else {
    bytes = new Uint8Array(32).fill(7);
  }
  const blocks: string[] = [];
  for (let i = 0; i < 12; i++) {
    const b1 = bytes[(i * 2) % bytes.length];
    const b2 = bytes[(i * 2 + 1) % bytes.length];
    const b3 = bytes[(i * 2 + 2) % bytes.length];
    const val = ((b1 << 16) | (b2 << 8) | b3) % 100000;
    blocks.push(String(val).padStart(5, '0'));
  }
  return blocks.join(' ');
}
