import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import fsp from 'fs/promises';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import * as webpush from 'web-push';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 90);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024; // 94,371,840 bytes
const UPLOAD_CHUNK_SIZE_BYTES = 1024 * 1024; // 1 MB
const FILE_TOO_LARGE_ERROR = `File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`;

const UPLOADS_DIR = path.resolve(__dirname, '.uploads');
const UPLOADS_TMP_DIR = path.resolve(__dirname, '.uploads_tmp');
const DATA_DIR = path.resolve(__dirname, '.data');
const DATA_STORE_PATH = path.join(DATA_DIR, 'quadline_store.json');

const BLOCKED_EXTENSIONS = new Set([
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

const ALLOWED_MIME_PREFIXES = [
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

interface UploadSession {
  uploadId: string;
  fileName: string;
  mimeType: string;
  totalSize: number;
  totalChunks: number;
  uploaderUid: string;
  receivedChunks: Map<number, number>;
  createdAt: number;
}

interface StoredMediaMeta {
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploaderUid: string;
  createdAt: number;
}

interface PresenceEntry {
  uid: string;
  displayName: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  activeRoomId: string | null;
  updatedAt: number;
}

interface ClientMeta {
  uid: string;
  displayName: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  activeRoomId: string | null;
}

type LiveActivityKind = 'typing' | 'recording_voice' | 'sending_voice';

interface TypingEntry {
  uid: string;
  displayName: string;
  roomId: string;
  activity: LiveActivityKind;
  expiresAt: number;
}

interface SavedUserPreferences {
  themeId: string;
  darkMode: boolean;
  wallpaperId: string;
  updatedAt: number;
}

interface SavedCallRecord {
  callId: string;
  uid: string;
  peerUid: string;
  peerName: string;
  peerPhoto: string;
  mode: 'audio' | 'video';
  direction: 'outgoing' | 'incoming' | 'check';
  status: 'completed' | 'missed' | 'rejected';
  durationSec: number;
  voiceEffect: string;
  startedAt: number;
  endedAt: number;
}

interface SavedWorkspaceBackup {
  uid: string;
  displayName: string;
  roomsCount: number;
  messagesCount: number;
  rooms: Array<{
    id: string;
    name: string;
    visibility: string;
    category: string;
    memberCount: number;
    lastMessageText: string;
  }>;
  recentMessages: Array<{
    id: string;
    roomId: string;
    authorName: string;
    kind: string;
    text: string;
    createdAtMs: number;
  }>;
  savedAt: number;
}

interface SavedReelComment {
  id: string;
  uid: string;
  authorName: string;
  authorPhoto: string;
  text: string;
  createdAt: number;
}

interface SavedReel {
  id: string;
  authorUid: string;
  authorName: string;
  authorHandle: string;
  authorPhoto: string;
  caption: string;
  audioTitle: string;
  audioArtist?: string;
  audioPreviewUrl?: string;
  audioArtwork?: string;
  mediaType: 'video' | 'image' | 'scene' | 'instagram';
  mediaUrl: string;
  instagramUrl?: string;
  instagramCode?: string;
  sceneTheme?: 'aurora' | 'sunset' | 'neon_grid' | 'ocean' | 'midnight';
  sceneEmoji?: string;
  sceneHeadline?: string;
  tags: string[];
  likedBy: string[];
  comments: SavedReelComment[];
  views: number;
  createdAt: number;
}

interface SavedSpotifyConnection {
  uid: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  spotifyUserId: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  product: string;
  profileUrl: string;
  connectedAt: number;
}

interface SavedSocialRelation {
  id: string;
  requesterUid: string;
  requesterName: string;
  requesterHandle: string;
  requesterPhoto: string;
  targetUid: string;
  targetName: string;
  targetHandle: string;
  targetPhoto: string;
  status: 'pending' | 'accepted';
  createdAt: number;
  updatedAt: number;
}

interface SavedAccountRecord {
  uid: string;
  email: string;
  displayName: string;
  handle: string;
  bio: string;
  photoUrl: string;
  authMethod: string;
  createdAt: number;
  lastLoginAt: number;
}

interface SavedStoryViewer {
  uid: string;
  displayName: string;
  handle: string;
  photoUrl: string;
  viewedAt: number;
}

interface SavedStory {
  id: string;
  authorUid: string;
  authorName: string;
  authorHandle: string;
  authorPhoto: string;
  mediaType: 'image' | 'video' | 'text';
  mediaUrl: string;
  caption: string;
  backgroundTheme: string;
  viewers: SavedStoryViewer[];
  createdAt: number;
  expiresAt: number;
}

interface SavedPushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  deviceLabel: string;
  userAgent: string;
  createdAt: number;
  updatedAt: number;
}

interface StoredVapidKeys {
  publicKey: string;
  privateKey: string;
}

interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
  roomId?: string;
  tab?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  category?: 'message' | 'call' | 'social' | 'story' | 'system';
  requireInteraction?: boolean;
  vibrate?: number[];
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
}

interface SavedFollowEdge {
  id: string;
  followerUid: string;
  followerName: string;
  followerHandle: string;
  followerPhoto: string;
  followingUid: string;
  followingName: string;
  followingHandle: string;
  followingPhoto: string;
  createdAt: number;
}

interface SavedSocialNotification {
  id: string;
  recipientUid: string;
  actorUid: string;
  actorName: string;
  actorHandle: string;
  actorPhoto: string;
  kind: 'follow_request' | 'request_accepted' | 'new_follower';
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}

interface SavedRoomChatTheme {
  roomId: string;
  chatThemeId: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: number;
}

interface SavedCustomMedia {
  id: string;
  uid: string;
  kind: 'sticker' | 'gif';
  label: string;
  dataUrl: string;
  createdAt: number;
}

interface PersistentBackendStore {
  userPreferences: Record<string, SavedUserPreferences>;
  callHistory: Record<string, SavedCallRecord[]>;
  backups: Record<string, SavedWorkspaceBackup>;
  reels: SavedReel[];
  spotifyTokens: Record<string, SavedSpotifyConnection>;
  socialRelations: SavedSocialRelation[];
  follows: SavedFollowEdge[];
  socialNotifications: SavedSocialNotification[];
  roomThemes: Record<string, SavedRoomChatTheme>;
  customMedia: SavedCustomMedia[];
  accounts: SavedAccountRecord[];
  stories: SavedStory[];
  vapidKeys?: StoredVapidKeys;
  pushSubscriptions: Record<string, SavedPushSubscription[]>;
}

const VALID_THEMES = new Set(['emerald', 'whatsapp', 'ocean', 'iris', 'sunset', 'rose']);
const VALID_WALLPAPERS = new Set(['none', 'dots', 'grid', 'aurora']);
const VALID_CHAT_THEMES = new Set([
  'classic',
  'bmw_m',
  'audi_rs',
  'midnight_gt',
  'sunset_gt',
  'turbo_drift',
  'cloudy_peaks',
  'rainy_glass',
  'misty_forest',
  'aurora_sky',
  'minecraft_world',
  'cyber_quest',
  'retro_arcade',
  'sakura',
  'velvet_roses',
  'sunflower',
  'lavender_bloom',
  'ig_berry',
  'ocean_wave',
  'obsidian',
]);

function createStarterReels(): SavedReel[] {
  const now = Date.now();
  return [
    {
      id: 'reel_starter_campus_vibes',
      authorUid: 'quadline_studio',
      authorName: 'Aarav Spark',
      authorHandle: 'aarav.reels',
      authorPhoto: '',
      caption: 'Late-night hackathon sprint at the library — shipping new features with lo-fi beats and iced coffee.',
      audioTitle: 'Midnight Lo-Fi · Campus Mix',
      mediaType: 'scene',
      mediaUrl: '',
      sceneTheme: 'aurora',
      sceneEmoji: '🚀',
      sceneHeadline: 'Hackathon Night Sprint',
      tags: ['campus', 'coding', 'vibes'],
      likedBy: ['demo_1', 'demo_2', 'demo_3'],
      comments: [
        {
          id: 'rc_1',
          uid: 'demo_2',
          authorName: 'Riya Nova',
          authorPhoto: '',
          text: 'The energy at 2 AM hits different!',
          createdAt: now - 3600_000,
        },
      ],
      views: 148,
      createdAt: now - 4 * 3600_000,
    },
    {
      id: 'reel_starter_golden_hour',
      authorUid: 'quadline_studio',
      authorName: 'Meera Craft',
      authorHandle: 'meera.films',
      authorPhoto: '',
      caption: 'Golden hour walk across the main quad before the weekend music jam starts. Drop your favorite track below!',
      audioTitle: 'Sunset Acoustic · Original Audio',
      mediaType: 'scene',
      mediaUrl: '',
      sceneTheme: 'sunset',
      sceneEmoji: '🌅',
      sceneHeadline: 'Golden Hour Quad Walk',
      tags: ['sunset', 'music', 'quad'],
      likedBy: ['demo_1', 'demo_4'],
      comments: [],
      views: 214,
      createdAt: now - 9 * 3600_000,
    },
    {
      id: 'reel_starter_voice_fx',
      authorUid: 'quadline_studio',
      authorName: 'Kabir Pulse',
      authorHandle: 'kabir.beats',
      authorPhoto: '',
      caption: 'Testing the Robot & Alien voice changer on a group call — nobody could stop laughing for 10 minutes straight.',
      audioTitle: 'Studio FX · Voice Jam',
      mediaType: 'scene',
      mediaUrl: '',
      sceneTheme: 'neon_grid',
      sceneEmoji: '🎧',
      sceneHeadline: 'Live Voice FX Challenge',
      tags: ['calls', 'voicefx', 'funny'],
      likedBy: ['demo_1', 'demo_2', 'demo_3', 'demo_5'],
      comments: [
        {
          id: 'rc_2',
          uid: 'demo_3',
          authorName: 'Dev Orbit',
          authorPhoto: '',
          text: 'Try the Alien effect with echo next time!',
          createdAt: now - 7200_000,
        },
      ],
      views: 312,
      createdAt: now - 16 * 3600_000,
    },
    {
      id: 'reel_starter_chai_crew',
      authorUid: 'quadline_studio',
      authorName: 'Zoya Wave',
      authorHandle: 'zoya.vibes',
      authorPhoto: '',
      caption: 'Post-lecture chai break with the squad. Upload your own video or photo Reel using the + Create button!',
      audioTitle: 'Chai & Chill · Ambient',
      mediaType: 'scene',
      mediaUrl: '',
      sceneTheme: 'ocean',
      sceneEmoji: '☕',
      sceneHeadline: 'Campus Chai Crew',
      tags: ['friends', 'chai', 'daily'],
      likedBy: ['demo_2'],
      comments: [],
      views: 189,
      createdAt: now - 24 * 3600_000,
    },
    {
      id: 'reel_starter_esports',
      authorUid: 'quadline_studio',
      authorName: 'Arjun Pixel',
      authorHandle: 'arjun.gg',
      authorPhoto: '',
      caption: 'Final round clutch moment from Friday Esports night. Tap heart twice if you watched it live!',
      audioTitle: 'Arena Hype · Beat Loop',
      mediaType: 'scene',
      mediaUrl: '',
      sceneTheme: 'midnight',
      sceneEmoji: '🎮',
      sceneHeadline: 'Friday Esports Clutch',
      tags: ['gaming', 'esports', 'highlights'],
      likedBy: ['demo_1', 'demo_3', 'demo_4', 'demo_5', 'demo_6'],
      comments: [],
      views: 420,
      createdAt: now - 36 * 3600_000,
    },
  ];
}

let backendStore: PersistentBackendStore = {
  userPreferences: {},
  callHistory: {},
  backups: {},
  reels: createStarterReels(),
  spotifyTokens: {},
  socialRelations: [],
  follows: [],
  socialNotifications: [],
  roomThemes: {},
  customMedia: [],
  accounts: [],
  stories: [],
  pushSubscriptions: {},
};
let storeWriteQueue: Promise<void> = Promise.resolve();
let activeVapidPublicKey = '';

function persistBackendStore(): Promise<void> {
  storeWriteQueue = storeWriteQueue
    .then(async () => {
      const tmpPath = `${DATA_STORE_PATH}.${Date.now()}.tmp`;
      await fsp.writeFile(tmpPath, JSON.stringify(backendStore, null, 2), 'utf8');
      await fsp.rename(tmpPath, DATA_STORE_PATH);
    })
    .catch((err) => {
      console.error('Failed to persist backend store:', err);
    });
  return storeWriteQueue;
}

async function loadBackendStore(): Promise<void> {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fsp.readFile(DATA_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistentBackendStore>;
    const existingReels = Array.isArray(parsed.reels) && parsed.reels.length > 0 ? parsed.reels : createStarterReels();
    backendStore = {
      userPreferences: parsed.userPreferences || {},
      callHistory: parsed.callHistory || {},
      backups: parsed.backups || {},
      reels: existingReels,
      spotifyTokens: parsed.spotifyTokens || {},
      socialRelations: Array.isArray(parsed.socialRelations) ? parsed.socialRelations : [],
      follows: Array.isArray(parsed.follows) ? parsed.follows : [],
      socialNotifications: Array.isArray(parsed.socialNotifications)
        ? parsed.socialNotifications
        : [],
      roomThemes:
        parsed.roomThemes && typeof parsed.roomThemes === 'object' ? parsed.roomThemes : {},
      customMedia: Array.isArray(parsed.customMedia) ? parsed.customMedia : [],
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      stories: Array.isArray(parsed.stories) ? parsed.stories : [],
      vapidKeys: parsed.vapidKeys,
      pushSubscriptions:
        parsed.pushSubscriptions && typeof parsed.pushSubscriptions === 'object'
          ? parsed.pushSubscriptions
          : {},
    };
    if (!Array.isArray(parsed.reels) || parsed.reels.length === 0) {
      await persistBackendStore();
    }
  } catch {
    backendStore = {
      userPreferences: {},
      callHistory: {},
      backups: {},
      reels: createStarterReels(),
      spotifyTokens: {},
      socialRelations: [],
      follows: [],
      socialNotifications: [],
      roomThemes: {},
      customMedia: [],
      accounts: [],
      stories: [],
      pushSubscriptions: {},
    };
    await persistBackendStore();
  }
}

async function initWebPushVapid(): Promise<void> {
  const envPublic = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || 'mailto:notifications@quadline.app').trim();

  let keys: StoredVapidKeys | undefined;
  if (envPublic && envPrivate) {
    keys = { publicKey: envPublic, privateKey: envPrivate };
  } else if (backendStore.vapidKeys?.publicKey && backendStore.vapidKeys?.privateKey) {
    keys = backendStore.vapidKeys;
  } else {
    const generated = webpush.generateVAPIDKeys();
    keys = { publicKey: generated.publicKey, privateKey: generated.privateKey };
    backendStore.vapidKeys = keys;
    await persistBackendStore();
  }

  try {
    webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
    activeVapidPublicKey = keys.publicKey;
  } catch (err) {
    console.error('Failed to configure Web Push VAPID keys:', err);
    activeVapidPublicKey = '';
  }
}

async function sendWebPushToUser(
  targetUid: string,
  payload: WebPushPayload
): Promise<{ sent: number; failed: number; deviceCount: number }> {
  if (!activeVapidPublicKey || !targetUid) {
    return { sent: 0, failed: 0, deviceCount: 0 };
  }
  const subs = backendStore.pushSubscriptions[targetUid];
  if (!Array.isArray(subs) || subs.length === 0) {
    return { sent: 0, failed: 0, deviceCount: 0 };
  }

  const notificationJson = JSON.stringify({
    title: (payload.title || 'Quadline').slice(0, 120),
    body: (payload.body || 'New activity on Quadline').slice(0, 240),
    url: payload.url || (payload.roomId ? `/?room=${encodeURIComponent(payload.roomId)}` : '/'),
    roomId: payload.roomId || '',
    tab: payload.tab || '',
    tag: payload.tag || (payload.roomId ? `room-${payload.roomId}` : 'quadline-notification'),
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    category: payload.category || 'message',
    requireInteraction: Boolean(payload.requireInteraction),
    vibrate: payload.vibrate,
  });

  const expiredEndpoints = new Set<string>();
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            expirationTime: sub.expirationTime,
            keys: sub.keys,
          },
          notificationJson,
          {
            TTL: payload.category === 'call' ? 60 : 60 * 60 * 12,
            urgency: payload.urgency || 'high',
          }
        );
        sent += 1;
      } catch (err: unknown) {
        failed += 1;
        const statusCode =
          typeof err === 'object' && err !== null && 'statusCode' in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.add(sub.endpoint);
        }
      }
    })
  );

  if (expiredEndpoints.size > 0) {
    const remaining = subs.filter((s) => !expiredEndpoints.has(s.endpoint));
    if (remaining.length > 0) {
      backendStore.pushSubscriptions[targetUid] = remaining;
    } else {
      delete backendStore.pushSubscriptions[targetUid];
    }
    void persistBackendStore();
  }

  return {
    sent,
    failed,
    deviceCount: (backendStore.pushSubscriptions[targetUid] || []).length,
  };
}

const uploadSessions = new Map<string, UploadSession>();
const clientMeta = new Map<WebSocket, ClientMeta>();
const userSockets = new Map<string, Set<WebSocket>>();
const userPresence = new Map<string, PresenceEntry>();
const typingByRoom = new Map<string, Map<string, TypingEntry>>();
const activeCallPeers = new Map<string, { peerUid: string; callId: string }>();

function sanitizeFileName(raw: string): string {
  const base = path.basename(raw || 'attachment').replace(/[^\w.\- ()]/g, '_');
  return base.slice(0, 140) || 'attachment';
}

function validateServerUpload(fileName: string, mimeType: string, totalSize: number): string | null {
  if (!Number.isFinite(totalSize) || totalSize <= 0) {
    return 'File is empty or has an invalid size.';
  }
  if (totalSize > MAX_FILE_SIZE_BYTES) {
    return FILE_TOO_LARGE_ERROR;
  }
  const lower = fileName.toLowerCase();
  const dotIdx = lower.lastIndexOf('.');
  const ext = dotIdx >= 0 ? lower.slice(dotIdx) : '';
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return `Executable files (${ext}) are blocked for security.`;
  }
  const safeMime = (mimeType || 'application/octet-stream').toLowerCase();
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => safeMime.startsWith(prefix))) {
    return `Unsupported file type (${safeMime}).`;
  }
  return null;
}

function isSafeExternalUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.startsWith('169.254.')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMeta(html: string, key: string): string {
  const propRegex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const revRegex = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
    'i'
  );
  const m = html.match(propRegex) || html.match(revRegex);
  return m ? decodeHtmlEntities(m[1]).slice(0, 220) : '';
}

async function ensureUploadDirs() {
  await fsp.mkdir(UPLOADS_DIR, { recursive: true });
  await fsp.mkdir(UPLOADS_TMP_DIR, { recursive: true });
  await loadBackendStore();
  await initWebPushVapid();
}

async function startServer() {
  await ensureUploadDirs();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // =========================================================
  // MOBILE & DESKTOP WEB PUSH (VAPID) NOTIFICATION API
  // =========================================================

  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({
      supported: Boolean(activeVapidPublicKey),
      publicKey: activeVapidPublicKey,
    });
  });

  app.get('/api/push/status', (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'UID is required.' });
      return;
    }
    const list = backendStore.pushSubscriptions[uid] || [];
    res.json({
      supported: Boolean(activeVapidPublicKey),
      subscribed: list.length > 0,
      deviceCount: list.length,
      devices: list.map((d) => ({
        deviceLabel: d.deviceLabel,
        updatedAt: d.updatedAt,
      })),
    });
  });

  app.post('/api/push/subscribe', async (req, res) => {
    const body = req.body || {};
    const uid = typeof body.uid === 'string' ? body.uid.trim().slice(0, 128) : '';
    const sub = body.subscription;
    if (
      !uid ||
      !sub ||
      typeof sub.endpoint !== 'string' ||
      !sub.endpoint.startsWith('https://') ||
      !sub.keys ||
      typeof sub.keys.p256dh !== 'string' ||
      typeof sub.keys.auth !== 'string'
    ) {
      res.status(400).json({ error: 'Valid UID and Web Push subscription object are required.' });
      return;
    }

    const now = Date.now();
    const deviceLabel =
      typeof body.deviceLabel === 'string' && body.deviceLabel.trim()
        ? body.deviceLabel.trim().slice(0, 60)
        : 'Mobile Device';
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 180);

    const existingList = backendStore.pushSubscriptions[uid] || [];
    const idx = existingList.findIndex((item) => item.endpoint === sub.endpoint);
    const nextEntry: SavedPushSubscription = {
      endpoint: sub.endpoint.slice(0, 1024),
      expirationTime: typeof sub.expirationTime === 'number' ? sub.expirationTime : null,
      keys: {
        p256dh: sub.keys.p256dh.slice(0, 256),
        auth: sub.keys.auth.slice(0, 256),
      },
      deviceLabel,
      userAgent,
      createdAt: idx >= 0 ? existingList[idx].createdAt : now,
      updatedAt: now,
    };

    if (idx >= 0) {
      existingList[idx] = nextEntry;
    } else {
      existingList.unshift(nextEntry);
    }

    backendStore.pushSubscriptions[uid] = existingList.slice(0, 8);
    await persistBackendStore();

    res.json({
      ok: true,
      subscribed: true,
      deviceCount: backendStore.pushSubscriptions[uid].length,
    });
  });

  app.post('/api/push/unsubscribe', async (req, res) => {
    const body = req.body || {};
    const uid = typeof body.uid === 'string' ? body.uid.trim().slice(0, 128) : '';
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    const removeAll = Boolean(body.all);

    if (!uid) {
      res.status(400).json({ error: 'UID is required.' });
      return;
    }

    const existingList = backendStore.pushSubscriptions[uid] || [];
    if (removeAll || !endpoint) {
      delete backendStore.pushSubscriptions[uid];
    } else {
      const remaining = existingList.filter((item) => item.endpoint !== endpoint);
      if (remaining.length > 0) {
        backendStore.pushSubscriptions[uid] = remaining;
      } else {
        delete backendStore.pushSubscriptions[uid];
      }
    }

    await persistBackendStore();
    const count = (backendStore.pushSubscriptions[uid] || []).length;
    res.json({ ok: true, subscribed: count > 0, deviceCount: count });
  });

  app.post('/api/push/test', async (req, res) => {
    const body = req.body || {};
    const uid = typeof body.uid === 'string' ? body.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'UID is required.' });
      return;
    }
    const result = await sendWebPushToUser(uid, {
      title: 'Quadline Phone Alerts Active',
      body: 'Messages, calls, friend requests, and friend stories will notify your phone!',
      url: '/',
      tag: 'quadline-test',
      category: 'system',
      vibrate: [200, 100, 200],
      urgency: 'high',
    });
    res.json({
      ok: result.sent > 0,
      ...result,
    });
  });

  app.post('/api/push/notify', async (req, res) => {
    const body = req.body || {};
    const senderUid = typeof body.senderUid === 'string' ? body.senderUid.trim().slice(0, 128) : '';
    const rawRecipients: unknown[] = Array.isArray(body.recipientIds) ? body.recipientIds : [];
    const recipientIds: string[] = Array.from(
      new Set<string>(
        rawRecipients
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          .map((id) => id.trim().slice(0, 128))
          .filter((id) => id !== senderUid)
      )
    ).slice(0, 80);

    if (recipientIds.length === 0) {
      res.json({ ok: true, sent: 0 });
      return;
    }

    const roomId = typeof body.roomId === 'string' ? body.roomId.trim().slice(0, 128) : '';
    const title =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim().slice(0, 120)
        : 'New message on Quadline';
    const textBody = typeof body.body === 'string' ? body.body.trim().slice(0, 220) : '';
    const url =
      typeof body.url === 'string' && body.url.startsWith('/')
        ? body.url.slice(0, 240)
        : roomId
          ? `/?room=${encodeURIComponent(roomId)}`
          : '/';
    const category =
      body.category === 'call' ||
      body.category === 'social' ||
      body.category === 'story' ||
      body.category === 'system'
        ? body.category
        : 'message';

    let totalSent = 0;
    await Promise.allSettled(
      recipientIds.map(async (targetUid) => {
        const result = await sendWebPushToUser(targetUid, {
          title,
          body: textBody || 'Open Quadline to read.',
          url,
          roomId,
          tag: roomId ? `room-${roomId}` : `quadline-${category}`,
          category,
          urgency: 'high',
        });
        totalSent += result.sent;
      })
    );

    res.json({ ok: true, sent: totalSent });
  });

  app.get('/api/health', (_req, res) => {
    const totalSavedCalls = Object.values(backendStore.callHistory).reduce(
      (sum, list) => sum + list.length,
      0
    );
    res.json({
      ok: true,
      timestamp: Date.now(),
      storage: {
        engine: 'quadline-disk-json',
        savedUsers: Object.keys(backendStore.userPreferences).length,
        savedCalls: totalSavedCalls,
        savedBackups: Object.keys(backendStore.backups).length,
      },
      limits: {
        maxFileSizeMB: MAX_FILE_SIZE_MB,
        maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
        chunkSizeBytes: UPLOAD_CHUNK_SIZE_BYTES,
        voiceNoteMinSec: 1,
        voiceNoteMaxSec: 300,
      },
    });
  });

  // =========================================================
  // PERSISTENT BACKEND DATA API (PREFERENCES, CALLS, BACKUPS)
  // =========================================================

  app.get('/api/user/:uid/bootstrap', (req, res) => {
    const uid = String(req.params.uid || '').trim().slice(0, 128);
    if (!uid) {
      res.status(400).json({ error: 'User ID required.' });
      return;
    }
    const preferences = backendStore.userPreferences[uid] || null;
    const callHistory = backendStore.callHistory[uid] || [];
    const backup = backendStore.backups[uid] || null;
    const totalSavedCalls = Object.values(backendStore.callHistory).reduce(
      (sum, list) => sum + list.length,
      0
    );
    res.json({
      preferences,
      callHistory,
      backupSummary: backup
        ? {
            roomsCount: backup.roomsCount,
            messagesCount: backup.messagesCount,
            savedAt: backup.savedAt,
          }
        : null,
      storage: {
        engine: 'Quadline Persistent Backend',
        totalSavedUsers: Object.keys(backendStore.userPreferences).length,
        totalSavedCalls,
      },
    });
  });

  app.put('/api/user/:uid/preferences', async (req, res) => {
    const uid = String(req.params.uid || '').trim().slice(0, 128);
    if (!uid) {
      res.status(400).json({ error: 'User ID required.' });
      return;
    }
    const { themeId, darkMode, wallpaperId } = req.body || {};
    const existing = backendStore.userPreferences[uid];
    const nextPrefs: SavedUserPreferences = {
      themeId: VALID_THEMES.has(themeId) ? themeId : existing?.themeId || 'whatsapp',
      darkMode: typeof darkMode === 'boolean' ? darkMode : existing?.darkMode || false,
      wallpaperId: VALID_WALLPAPERS.has(wallpaperId)
        ? wallpaperId
        : existing?.wallpaperId || 'dots',
      updatedAt: Date.now(),
    };
    backendStore.userPreferences[uid] = nextPrefs;
    await persistBackendStore();
    res.json({ ok: true, preferences: nextPrefs });
  });

  app.get('/api/calls', (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'User ID required.' });
      return;
    }
    res.json({ calls: backendStore.callHistory[uid] || [] });
  });

  app.post('/api/calls', async (req, res) => {
    const body = req.body || {};
    const uid = typeof body.uid === 'string' ? body.uid.trim().slice(0, 128) : '';
    const callId = typeof body.callId === 'string' ? body.callId.trim().slice(0, 128) : '';
    if (!uid || !callId) {
      res.status(400).json({ error: 'uid and callId are required.' });
      return;
    }

    const record: SavedCallRecord = {
      callId,
      uid,
      peerUid: typeof body.peerUid === 'string' ? body.peerUid.slice(0, 128) : 'self-test',
      peerName: typeof body.peerName === 'string' ? body.peerName.slice(0, 80) : 'Campus Member',
      peerPhoto: typeof body.peerPhoto === 'string' ? body.peerPhoto.slice(0, 500) : '',
      mode: body.mode === 'video' ? 'video' : 'audio',
      direction:
        body.direction === 'incoming' || body.direction === 'check' ? body.direction : 'outgoing',
      status:
        body.status === 'missed' || body.status === 'rejected' ? body.status : 'completed',
      durationSec: Math.max(0, Math.min(86400, Math.round(Number(body.durationSec) || 0))),
      voiceEffect: typeof body.voiceEffect === 'string' ? body.voiceEffect.slice(0, 32) : 'normal',
      startedAt: Number(body.startedAt) || Date.now(),
      endedAt: Number(body.endedAt) || Date.now(),
    };

    const existingList = backendStore.callHistory[uid] || [];
    const filtered = existingList.filter((item) => item.callId !== callId);
    backendStore.callHistory[uid] = [record, ...filtered].slice(0, 100);
    await persistBackendStore();
    res.json({ ok: true, record });
  });

  app.delete('/api/calls/:callId', async (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    const callId = String(req.params.callId || '').trim().slice(0, 128);
    if (!uid || !callId) {
      res.status(400).json({ error: 'uid and callId are required.' });
      return;
    }
    const existingList = backendStore.callHistory[uid] || [];
    backendStore.callHistory[uid] = existingList.filter((item) => item.callId !== callId);
    await persistBackendStore();
    res.json({ ok: true });
  });

  app.post('/api/backup/snapshot', async (req, res) => {
    const body = req.body || {};
    const uid = typeof body.uid === 'string' ? body.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'User ID required.' });
      return;
    }
    const rawRooms = Array.isArray(body.rooms) ? body.rooms.slice(0, 200) : [];
    const rawMessages = Array.isArray(body.recentMessages) ? body.recentMessages.slice(0, 400) : [];

    const snapshot: SavedWorkspaceBackup = {
      uid,
      displayName: typeof body.displayName === 'string' ? body.displayName.slice(0, 80) : 'Member',
      roomsCount: rawRooms.length,
      messagesCount: rawMessages.length,
      rooms: rawRooms.map((r: Record<string, unknown>) => ({
        id: String(r.id || '').slice(0, 128),
        name: String(r.name || '').slice(0, 80),
        visibility: String(r.visibility || 'public').slice(0, 20),
        category: String(r.category || 'club').slice(0, 20),
        memberCount: Number(r.memberCount) || 0,
        lastMessageText: String(r.lastMessageText || '').slice(0, 200),
      })),
      recentMessages: rawMessages.map((m: Record<string, unknown>) => ({
        id: String(m.id || '').slice(0, 128),
        roomId: String(m.roomId || '').slice(0, 128),
        authorName: String(m.authorName || '').slice(0, 80),
        kind: String(m.kind || 'text').slice(0, 24),
        text: String(m.text || '').slice(0, 500),
        createdAtMs: Number(m.createdAtMs) || Date.now(),
      })),
      savedAt: Date.now(),
    };

    backendStore.backups[uid] = snapshot;
    await persistBackendStore();
    res.json({
      ok: true,
      backupSummary: {
        roomsCount: snapshot.roomsCount,
        messagesCount: snapshot.messagesCount,
        savedAt: snapshot.savedAt,
      },
    });
  });

  app.get('/api/backup/export', (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'User ID required.' });
      return;
    }
    const exportPayload = {
      app: 'Quadline',
      exportedAt: new Date().toISOString(),
      uid,
      preferences: backendStore.userPreferences[uid] || null,
      callHistory: backendStore.callHistory[uid] || [],
      workspaceBackup: backendStore.backups[uid] || null,
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="quadline-backup.json"');
    res.send(JSON.stringify(exportPayload, null, 2));
  });

  // =========================================================
  // MOVIES & FAMOUS SONGS API (OFFICIAL 30s PREVIEWS VIA ITUNES)
  // =========================================================

  interface ApiSongTrack {
    id: string;
    title: string;
    artist: string;
    movieOrAlbum: string;
    category: 'bollywood' | 'hollywood' | 'famous' | 'punjabi';
    previewUrl: string;
    artworkUrl: string;
    durationSec: number;
    externalUrl?: string;
  }

  const songCache = new Map<string, { expiresAt: number; songs: ApiSongTrack[] }>();

  const CATEGORY_SEED_QUERIES: Record<'bollywood' | 'hollywood' | 'famous' | 'punjabi', string[]> = {
    bollywood: [
      'Kesariya Brahmastra Arijit Singh',
      'Chaleya Jawan Arijit Singh',
      'Tum Hi Ho Aashiqui 2',
      'Raataan Lambiyan Shershaah',
      'Naatu Naatu RRR',
      'Apna Bana Le Bhediya',
      'Tera Ban Jaunga Kabir Singh',
      'Kal Ho Naa Ho Sonu Nigam',
      'Chaiyya Chaiyya Dil Se',
      'Shayad Love Aaj Kal Arijit Singh',
    ],
    hollywood: [
      'My Heart Will Go On Titanic Celine Dion',
      'See You Again Wiz Khalifa Furious 7',
      'Sunflower Post Malone Spider-Man',
      'Shallow Lady Gaga A Star Is Born',
      'Interstellar Hans Zimmer Cornfield Chase',
      'Skyfall Adele',
      'Let It Go Frozen Idina Menzel',
      'Lose Yourself Eminem 8 Mile',
      'City of Stars La La Land',
      'Time Hans Zimmer Inception',
    ],
    famous: [
      'Blinding Lights The Weeknd',
      'Shape of You Ed Sheeran',
      'Levitating Dua Lipa',
      'Perfect Ed Sheeran',
      'Believer Imagine Dragons',
      'Heat Waves Glass Animals',
      'Starboy The Weeknd',
      'Cruel Summer Taylor Swift',
      'Night Changes One Direction',
      'Counting Stars OneRepublic',
    ],
    punjabi: [
      'Excuses AP Dhillon',
      'Brown Munde AP Dhillon',
      'Lover Diljit Dosanjh',
      'Softly Karan Aujla',
      '295 Sidhu Moose Wala',
      'Kala Chashma Baar Baar Dekho',
      'Pasoori Ali Sethi',
      'Tauba Tauba Karan Aujla',
      'With You AP Dhillon',
      'Hass Hass Diljit Dosanjh',
    ],
  };

  async function queryItunesSongs(
    term: string,
    category: 'bollywood' | 'hollywood' | 'famous' | 'punjabi',
    limit = 4
  ): Promise<ApiSongTrack[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const url = `https://itunes.apple.com/search?media=music&entity=song&limit=${limit}&term=${encodeURIComponent(term)}`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'QuadlineMusic/1.0' },
      });
      if (!response.ok) return [];
      const data = (await response.json()) as {
        results?: Array<{
          trackId?: number;
          trackName?: string;
          artistName?: string;
          collectionName?: string;
          previewUrl?: string;
          artworkUrl100?: string;
          trackTimeMillis?: number;
          trackViewUrl?: string;
        }>;
      };
      const items = Array.isArray(data.results) ? data.results : [];
      return items
        .filter((item) => Boolean(item.previewUrl && item.trackName))
        .map((item) => ({
          id: `itunes_${item.trackId || Math.random().toString(36).slice(2, 9)}`,
          title: String(item.trackName || 'Untitled').slice(0, 80),
          artist: String(item.artistName || 'Unknown Artist').slice(0, 80),
          movieOrAlbum: String(item.collectionName || 'Featured Soundtrack').slice(0, 80),
          category,
          previewUrl: String(item.previewUrl || ''),
          artworkUrl: String(item.artworkUrl100 || '').replace('100x100bb', '300x300bb'),
          durationSec: 30,
          externalUrl: item.trackViewUrl ? String(item.trackViewUrl) : undefined,
        }));
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  app.get('/api/songs', async (req, res) => {
    const rawCat = typeof req.query.category === 'string' ? req.query.category.toLowerCase() : 'bollywood';
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    const validCat: 'bollywood' | 'hollywood' | 'famous' | 'punjabi' | 'all' =
      rawCat === 'hollywood' || rawCat === 'famous' || rawCat === 'punjabi' || rawCat === 'all'
        ? rawCat
        : 'bollywood';

    const cacheKey = `${validCat}::${rawQ.toLowerCase()}`;
    const cached = songCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ songs: cached.songs });
      return;
    }

    try {
      let songs: ApiSongTrack[] = [];

      if (rawQ) {
        const targetCat = validCat === 'all' ? 'famous' : validCat;
        songs = await queryItunesSongs(rawQ, targetCat, 18);
      } else if (validCat === 'all') {
        const picks: Array<{ term: string; cat: 'bollywood' | 'hollywood' | 'famous' | 'punjabi' }> = [
          { term: CATEGORY_SEED_QUERIES.bollywood[0], cat: 'bollywood' },
          { term: CATEGORY_SEED_QUERIES.bollywood[1], cat: 'bollywood' },
          { term: CATEGORY_SEED_QUERIES.bollywood[2], cat: 'bollywood' },
          { term: CATEGORY_SEED_QUERIES.hollywood[0], cat: 'hollywood' },
          { term: CATEGORY_SEED_QUERIES.hollywood[1], cat: 'hollywood' },
          { term: CATEGORY_SEED_QUERIES.hollywood[2], cat: 'hollywood' },
          { term: CATEGORY_SEED_QUERIES.famous[0], cat: 'famous' },
          { term: CATEGORY_SEED_QUERIES.famous[1], cat: 'famous' },
          { term: CATEGORY_SEED_QUERIES.punjabi[0], cat: 'punjabi' },
          { term: CATEGORY_SEED_QUERIES.punjabi[1], cat: 'punjabi' },
        ];
        const batches = await Promise.all(picks.map((p) => queryItunesSongs(p.term, p.cat, 1)));
        songs = batches.flat();
      } else {
        const queries = CATEGORY_SEED_QUERIES[validCat];
        const batches = await Promise.all(queries.map((term) => queryItunesSongs(term, validCat, 1)));
        songs = batches.flat();
      }

      // Deduplicate by track ID
      const seen = new Set<string>();
      const uniqueSongs = songs.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      if (uniqueSongs.length > 0) {
        songCache.set(cacheKey, {
          expiresAt: Date.now() + 10 * 60 * 1000,
          songs: uniqueSongs,
        });
      }

      res.json({ songs: uniqueSongs });
    } catch {
      res.json({ songs: [] });
    }
  });

  // =========================================================
  // SPOTIFY OAUTH 2.0 & SPOTIFY SONGS INTEGRATION
  // =========================================================

  const SPOTIFY_SCOPES = [
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'user-top-read',
    'user-read-recently-played',
    'playlist-read-private',
    'playlist-read-collaborative',
    'user-read-currently-playing',
  ].join(' ');

  const spotifyOAuthStates = new Map<string, { uid: string; expiresAt: number }>();

  function getSpotifyCredentials(): { clientId: string; clientSecret: string } {
    return {
      clientId: (process.env.SPOTIFY_CLIENT_ID || '').trim(),
      clientSecret: (process.env.SPOTIFY_CLIENT_SECRET || '').trim(),
    };
  }

  function getSpotifyRedirectUri(): string {
    const base = (process.env.APP_URL || `http://localhost:${PORT}`).trim().replace(/\/+$/, '');
    return `${base}/auth/spotify/callback`;
  }

  async function getValidSpotifyToken(uid: string): Promise<SavedSpotifyConnection | null> {
    const conn = backendStore.spotifyTokens[uid];
    if (!conn) return null;

    // Still valid with 60s buffer
    if (conn.expiresAt > Date.now() + 60_000) {
      return conn;
    }

    const { clientId, clientSecret } = getSpotifyCredentials();
    if (!clientId || !clientSecret || !conn.refreshToken) {
      return null;
    }

    try {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: conn.refreshToken,
        }),
      });
      if (!tokenRes.ok) return null;

      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
      };
      if (!tokenJson.access_token) return null;

      conn.accessToken = tokenJson.access_token;
      if (tokenJson.refresh_token) conn.refreshToken = tokenJson.refresh_token;
      if (tokenJson.scope) conn.scope = tokenJson.scope;
      conn.expiresAt = Date.now() + Number(tokenJson.expires_in || 3600) * 1000;
      backendStore.spotifyTokens[uid] = conn;
      await persistBackendStore();
      return conn;
    } catch {
      return null;
    }
  }

  function normalizeSpotifyTrack(raw: Record<string, unknown>) {
    const trackId = typeof raw.id === 'string' ? raw.id : '';
    const title = typeof raw.name === 'string' ? raw.name.slice(0, 80) : 'Untitled Track';
    const artistsArr = Array.isArray(raw.artists)
      ? (raw.artists as Array<Record<string, unknown>>)
          .map((a) => (typeof a.name === 'string' ? a.name : ''))
          .filter(Boolean)
      : [];
    const artist = (artistsArr.join(', ') || 'Spotify Artist').slice(0, 80);
    const album = (raw.album || {}) as Record<string, unknown>;
    const movieOrAlbum = (typeof album.name === 'string' ? album.name : 'Spotify').slice(0, 80);
    const images = Array.isArray(album.images) ? (album.images as Array<Record<string, unknown>>) : [];
    const artworkUrl =
      (images[1] && typeof images[1].url === 'string' ? images[1].url : '') ||
      (images[0] && typeof images[0].url === 'string' ? images[0].url : '');
    const previewUrl = typeof raw.preview_url === 'string' ? raw.preview_url : '';
    const durationMs = typeof raw.duration_ms === 'number' ? raw.duration_ms : 30000;
    const externalUrls = (raw.external_urls || {}) as Record<string, unknown>;
    const spotifyUrl =
      typeof externalUrls.spotify === 'string'
        ? externalUrls.spotify
        : trackId
          ? `https://open.spotify.com/track/${trackId}`
          : '';

    return {
      id: `spotify_${trackId || crypto.randomBytes(4).toString('hex')}`,
      title,
      artist,
      movieOrAlbum,
      category: 'spotify' as const,
      previewUrl,
      artworkUrl,
      durationSec: Math.max(15, Math.round(durationMs / 1000)),
      externalUrl: spotifyUrl,
      source: 'spotify' as const,
      spotifyTrackId: trackId,
      spotifyUrl,
    };
  }

  app.get('/api/spotify/status', (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    const { clientId, clientSecret } = getSpotifyCredentials();
    const configured = Boolean(clientId && clientSecret);
    const redirectUri = getSpotifyRedirectUri();
    const conn = uid ? backendStore.spotifyTokens[uid] : undefined;

    res.json({
      configured,
      connected: Boolean(conn && conn.accessToken),
      redirectUri,
      scopes: SPOTIFY_SCOPES.split(' '),
      user: conn
        ? {
            id: conn.spotifyUserId,
            displayName: conn.displayName,
            avatarUrl: conn.avatarUrl,
            product: conn.product,
            profileUrl: conn.profileUrl,
            connectedAt: conn.connectedAt,
          }
        : null,
    });
  });

  app.get('/api/spotify/auth-url', (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'User UID is required to link Spotify.' });
      return;
    }

    const { clientId, clientSecret } = getSpotifyCredentials();
    const redirectUri = getSpotifyRedirectUri();
    if (!clientId || !clientSecret) {
      res.status(503).json({
        error: 'Spotify OAuth credentials are not configured yet.',
        needsSetup: true,
        redirectUri,
      });
      return;
    }

    // Prune expired OAuth states
    const now = Date.now();
    for (const [k, v] of spotifyOAuthStates.entries()) {
      if (v.expiresAt <= now) spotifyOAuthStates.delete(k);
    }

    const state = crypto.randomBytes(24).toString('hex');
    spotifyOAuthStates.set(state, { uid, expiresAt: now + 10 * 60 * 1000 });

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SPOTIFY_SCOPES,
      state,
      show_dialog: 'true',
    });

    res.json({
      url: `https://accounts.spotify.com/authorize?${params.toString()}`,
      redirectUri,
    });
  });

  const handleSpotifyCallback = async (req: express.Request, res: express.Response) => {
    const renderPopupResult = (payload: Record<string, unknown>, message: string) => {
      const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Spotify Authorization</title></head>
<body style="font-family:system-ui,sans-serif;background:#0D1117;color:#F8FAFC;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center;">
  <div>
    <p style="font-size:15px;font-weight:600;margin:0 0 8px;">${message}</p>
    <p style="font-size:12px;color:#94A3B8;margin:0;">This window will close automatically.</p>
  </div>
  <script>
    (function() {
      var payload = ${safeJson};
      if (window.opener) {
        window.opener.postMessage(payload, '*');
        window.close();
      } else {
        window.location.href = '/';
      }
    })();
  </script>
</body>
</html>`);
    };

    const errorParam = typeof req.query.error === 'string' ? req.query.error : '';
    if (errorParam) {
      renderPopupResult(
        { type: 'SPOTIFY_OAUTH_ERROR', error: errorParam === 'access_denied' ? 'Spotify permission was declined.' : errorParam },
        'Spotify permission was cancelled.'
      );
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const stateEntry = state ? spotifyOAuthStates.get(state) : undefined;
    if (state) spotifyOAuthStates.delete(state);

    if (!code || !stateEntry || stateEntry.expiresAt <= Date.now()) {
      renderPopupResult(
        { type: 'SPOTIFY_OAUTH_ERROR', error: 'Invalid or expired Spotify authorization session. Please try again.' },
        'Authorization session expired.'
      );
      return;
    }

    const { clientId, clientSecret } = getSpotifyCredentials();
    if (!clientId || !clientSecret) {
      renderPopupResult(
        { type: 'SPOTIFY_OAUTH_ERROR', error: 'Spotify credentials are not configured on the server.' },
        'Spotify is not configured.'
      );
      return;
    }

    try {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: getSpotifyRedirectUri(),
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text().catch(() => '');
        renderPopupResult(
          { type: 'SPOTIFY_OAUTH_ERROR', error: `Spotify token exchange failed (${tokenRes.status}). ${errText.slice(0, 120)}` },
          'Could not complete Spotify login.'
        );
        return;
      }

      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
      };
      if (!tokenJson.access_token) {
        renderPopupResult(
          { type: 'SPOTIFY_OAUTH_ERROR', error: 'Spotify did not return an access token.' },
          'Spotify login failed.'
        );
        return;
      }

      // Fetch connected Spotify user's profile
      const meRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      const me = meRes.ok ? ((await meRes.json()) as Record<string, unknown>) : {};
      const meImages = Array.isArray(me.images) ? (me.images as Array<Record<string, unknown>>) : [];
      const meExt = (me.external_urls || {}) as Record<string, unknown>;

      const connection: SavedSpotifyConnection = {
        uid: stateEntry.uid,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token || '',
        expiresAt: Date.now() + Number(tokenJson.expires_in || 3600) * 1000,
        scope: tokenJson.scope || SPOTIFY_SCOPES,
        spotifyUserId: typeof me.id === 'string' ? me.id : 'spotify_user',
        displayName:
          typeof me.display_name === 'string' && me.display_name.trim()
            ? me.display_name.trim().slice(0, 60)
            : 'Spotify Listener',
        email: typeof me.email === 'string' ? me.email.slice(0, 100) : '',
        avatarUrl: meImages[0] && typeof meImages[0].url === 'string' ? meImages[0].url : '',
        product: typeof me.product === 'string' ? me.product : 'free',
        profileUrl: typeof meExt.spotify === 'string' ? meExt.spotify : 'https://open.spotify.com',
        connectedAt: Date.now(),
      };

      backendStore.spotifyTokens[stateEntry.uid] = connection;
      await persistBackendStore();

      renderPopupResult(
        {
          type: 'SPOTIFY_OAUTH_SUCCESS',
          user: {
            id: connection.spotifyUserId,
            displayName: connection.displayName,
            avatarUrl: connection.avatarUrl,
            product: connection.product,
            profileUrl: connection.profileUrl,
          },
        },
        `Connected to Spotify as ${connection.displayName}!`
      );
    } catch {
      renderPopupResult(
        { type: 'SPOTIFY_OAUTH_ERROR', error: 'Network error while connecting to Spotify.' },
        'Connection failed.'
      );
    }
  };

  app.get(['/auth/spotify/callback', '/auth/spotify/callback/'], handleSpotifyCallback);

  app.post('/api/spotify/disconnect', async (req, res) => {
    const uid = typeof req.body?.uid === 'string' ? req.body.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'UID required.' });
      return;
    }
    delete backendStore.spotifyTokens[uid];
    await persistBackendStore();
    res.json({ ok: true });
  });

  app.get('/api/spotify/tracks', async (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    const section = typeof req.query.section === 'string' ? req.query.section.toLowerCase() : 'liked';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';

    if (!uid) {
      res.status(400).json({ error: 'UID required.' });
      return;
    }

    const conn = await getValidSpotifyToken(uid);
    if (!conn) {
      res.status(401).json({ error: 'Spotify account not connected or session expired.', needsReconnect: true });
      return;
    }

    try {
      let endpoint = 'https://api.spotify.com/v1/me/tracks?limit=20';
      if (q) {
        endpoint = `https://api.spotify.com/v1/search?type=track&limit=20&q=${encodeURIComponent(q)}`;
      } else if (section === 'top') {
        endpoint = 'https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=short_term';
      } else if (section === 'recent') {
        endpoint = 'https://api.spotify.com/v1/me/player/recently-played?limit=20';
      } else if (section === 'search') {
        endpoint = 'https://api.spotify.com/v1/search?type=track&limit=20&q=bollywood%20hits';
      }

      const spRes = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${conn.accessToken}` },
      });

      if (spRes.status === 401) {
        res.status(401).json({ error: 'Spotify token expired. Please reconnect Spotify.', needsReconnect: true });
        return;
      }
      if (!spRes.ok) {
        res.status(spRes.status).json({ error: 'Unable to fetch Spotify tracks right now.', songs: [] });
        return;
      }

      const data = (await spRes.json()) as Record<string, unknown>;
      let rawTracks: Array<Record<string, unknown>> = [];

      if (q || section === 'search') {
        const tracksObj = (data.tracks || {}) as Record<string, unknown>;
        rawTracks = Array.isArray(tracksObj.items)
          ? (tracksObj.items as Array<Record<string, unknown>>)
          : [];
      } else if (section === 'top') {
        rawTracks = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
      } else {
        // liked & recently-played wrap each item in { track: {...} }
        const items = Array.isArray(data.items) ? (data.items as Array<Record<string, unknown>>) : [];
        rawTracks = items
          .map((item) => item.track as Record<string, unknown> | undefined)
          .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'));
      }

      const seen = new Set<string>();
      const songs = rawTracks
        .map((t) => normalizeSpotifyTrack(t))
        .filter((s) => {
          if (!s.spotifyTrackId || seen.has(s.spotifyTrackId)) return false;
          seen.add(s.spotifyTrackId);
          return true;
        });

      res.json({ songs });
    } catch {
      res.status(500).json({ error: 'Failed to reach Spotify API.', songs: [] });
    }
  });

  // Resolve any pasted open.spotify.com/track/... link via Spotify's official oEmbed API
  app.get('/api/spotify/resolve-url', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const uriMatch = rawUrl.match(/^spotify:track:([A-Za-z0-9]{22})$/i);
    const urlMatch = rawUrl.match(
      /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{10,32})/i
    );
    const trackId = uriMatch?.[1] || urlMatch?.[1];
    if (!trackId) {
      res.status(400).json({ error: 'Please paste a valid Spotify song link (open.spotify.com/track/...).' });
      return;
    }

    const canonicalUrl = `https://open.spotify.com/track/${trackId}`;
    try {
      const oembedRes = await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(canonicalUrl)}`
      );
      if (!oembedRes.ok) {
        res.json({
          song: {
            id: `spotify_${trackId}`,
            title: 'Spotify Track',
            artist: 'Spotify',
            movieOrAlbum: 'Spotify',
            category: 'spotify',
            previewUrl: '',
            artworkUrl: '',
            durationSec: 30,
            externalUrl: canonicalUrl,
            source: 'spotify',
            spotifyTrackId: trackId,
            spotifyUrl: canonicalUrl,
          },
        });
        return;
      }

      const meta = (await oembedRes.json()) as {
        title?: string;
        thumbnail_url?: string;
      };
      const rawTitle = typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : 'Spotify Track';

      res.json({
        song: {
          id: `spotify_${trackId}`,
          title: rawTitle.slice(0, 80),
          artist: 'Spotify Song',
          movieOrAlbum: 'Spotify',
          category: 'spotify',
          previewUrl: '',
          artworkUrl: typeof meta.thumbnail_url === 'string' ? meta.thumbnail_url : '',
          durationSec: 30,
          externalUrl: canonicalUrl,
          source: 'spotify',
          spotifyTrackId: trackId,
          spotifyUrl: canonicalUrl,
        },
      });
    } catch {
      res.status(500).json({ error: 'Unable to resolve Spotify link right now.' });
    }
  });

  // =========================================================
  // FRIEND REQUEST / FOLLOW SYSTEM (REQUIRED FOR 1-TO-1 CHAT & CALLS)
  // =========================================================

  let pushSocialEvent: (targetUid: string, payload: Record<string, unknown>) => void = () => {};
  let broadcastRoomThemeEvent: (payload: Record<string, unknown>) => void = () => {};

  function recordSocialNotification(input: {
    recipientUid: string;
    actorUid: string;
    actorName: string;
    actorHandle: string;
    actorPhoto: string;
    kind: SavedSocialNotification['kind'];
    title: string;
    body: string;
  }) {
    if (!input.recipientUid || input.recipientUid === input.actorUid) return;
    // Dedupe identical unread notification from same actor + kind
    backendStore.socialNotifications = backendStore.socialNotifications.filter(
      (n) =>
        !(
          n.recipientUid === input.recipientUid &&
          n.actorUid === input.actorUid &&
          n.kind === input.kind &&
          !n.read
        )
    );
    const notif: SavedSocialNotification = {
      id: `sntf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      recipientUid: input.recipientUid,
      actorUid: input.actorUid,
      actorName: input.actorName.slice(0, 60),
      actorHandle: input.actorHandle.slice(0, 32),
      actorPhoto: input.actorPhoto.slice(0, 45000),
      kind: input.kind,
      title: input.title.slice(0, 120),
      body: input.body.slice(0, 240),
      read: false,
      createdAt: Date.now(),
    };
    backendStore.socialNotifications = [notif, ...backendStore.socialNotifications].slice(0, 4000);
  }

  function markFollowRequestNotificationsRead(recipientUid: string, actorUid: string) {
    for (const n of backendStore.socialNotifications) {
      if (n.recipientUid === recipientUid && n.actorUid === actorUid && n.kind === 'follow_request') {
        n.read = true;
      }
    }
  }

  function getSocialPairId(uidA: string, uidB: string): string {
    return uidA < uidB ? `${uidA}__${uidB}` : `${uidB}__${uidA}`;
  }

  function buildSocialGraphForUser(uid: string) {
    const friends: SavedSocialRelation[] = [];
    const incomingRequests: SavedSocialRelation[] = [];
    const outgoingRequests: SavedSocialRelation[] = [];

    for (const rel of backendStore.socialRelations) {
      if (rel.requesterUid !== uid && rel.targetUid !== uid) continue;
      if (rel.status === 'accepted') {
        friends.push(rel);
      } else if (rel.targetUid === uid) {
        incomingRequests.push(rel);
      } else if (rel.requesterUid === uid) {
        outgoingRequests.push(rel);
      }
    }

    friends.sort((a, b) => b.updatedAt - a.updatedAt);
    incomingRequests.sort((a, b) => b.updatedAt - a.updatedAt);
    outgoingRequests.sort((a, b) => b.updatedAt - a.updatedAt);

    return { friends, incomingRequests, outgoingRequests };
  }

  app.get('/api/social', (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'UID is required.' });
      return;
    }
    res.json(buildSocialGraphForUser(uid));
  });

  app.post('/api/social/request', async (req, res) => {
    const body = req.body || {};
    const fromUid = typeof body.fromUid === 'string' ? body.fromUid.trim().slice(0, 128) : '';
    const toUid = typeof body.toUid === 'string' ? body.toUid.trim().slice(0, 128) : '';
    if (!fromUid || !toUid || fromUid === toUid) {
      res.status(400).json({ error: 'Valid requester and recipient UIDs are required.' });
      return;
    }

    const fromName =
      typeof body.fromName === 'string' && body.fromName.trim()
        ? body.fromName.trim().slice(0, 60)
        : 'Member';
    const fromHandle =
      typeof body.fromHandle === 'string' ? body.fromHandle.trim().slice(0, 32) : 'member';
    const fromPhoto = typeof body.fromPhoto === 'string' ? body.fromPhoto.slice(0, 45000) : '';

    const toName =
      typeof body.toName === 'string' && body.toName.trim()
        ? body.toName.trim().slice(0, 60)
        : 'Member';
    const toHandle =
      typeof body.toHandle === 'string' ? body.toHandle.trim().slice(0, 32) : 'member';
    const toPhoto = typeof body.toPhoto === 'string' ? body.toPhoto.slice(0, 45000) : '';

    const pairId = getSocialPairId(fromUid, toUid);
    const now = Date.now();
    const existing = backendStore.socialRelations.find((r) => r.id === pairId);

    if (existing) {
      if (existing.status === 'accepted') {
        res.json({ relation: existing, autoAccepted: false, graph: buildSocialGraphForUser(fromUid) });
        return;
      }
      // If the other user already requested us, sending a request back accepts automatically!
      if (existing.requesterUid === toUid && existing.targetUid === fromUid) {
        existing.status = 'accepted';
        existing.updatedAt = now;
        markFollowRequestNotificationsRead(fromUid, toUid);
        recordSocialNotification({
          recipientUid: toUid,
          actorUid: fromUid,
          actorName: fromName,
          actorHandle: fromHandle,
          actorPhoto: fromPhoto,
          kind: 'request_accepted',
          title: 'Follow & Chat Request Accepted',
          body: `${fromName} (@${fromHandle}) accepted your request — you can now chat & call 1-to-1!`,
        });
        await persistBackendStore();
        pushSocialEvent(toUid, {
          type: 'social:update',
          action: 'accepted',
          actorUid: fromUid,
          actorName: fromName,
        });
        pushSocialEvent(fromUid, {
          type: 'social:update',
          action: 'accepted',
          actorUid: fromUid,
          actorName: fromName,
        });
        void sendWebPushToUser(toUid, {
          title: 'Follow & Chat Request Accepted',
          body: `You and ${fromName} (@${fromHandle}) are now connected on Quadline!`,
          url: '/?tab=dms',
          tab: 'dms',
          tag: `social-${fromUid}`,
          category: 'social',
        });
        res.json({ relation: existing, autoAccepted: true, graph: buildSocialGraphForUser(fromUid) });
        return;
      }
      // Already pending outgoing request
      res.json({ relation: existing, autoAccepted: false, graph: buildSocialGraphForUser(fromUid) });
      return;
    }

    const relation: SavedSocialRelation = {
      id: pairId,
      requesterUid: fromUid,
      requesterName: fromName,
      requesterHandle: fromHandle,
      requesterPhoto: fromPhoto,
      targetUid: toUid,
      targetName: toName,
      targetHandle: toHandle,
      targetPhoto: toPhoto,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    backendStore.socialRelations = [relation, ...backendStore.socialRelations].slice(0, 2000);
    recordSocialNotification({
      recipientUid: toUid,
      actorUid: fromUid,
      actorName: fromName,
      actorHandle: fromHandle,
      actorPhoto: fromPhoto,
      kind: 'follow_request',
      title: 'New Follow & Chat Request',
      body: `${fromName} (@${fromHandle}) sent you a request to chat & call on Quadline.`,
    });
    await persistBackendStore();

    pushSocialEvent(toUid, {
      type: 'social:update',
      action: 'request',
      actorUid: fromUid,
      actorName: fromName,
    });
    pushSocialEvent(fromUid, {
      type: 'social:update',
      action: 'sent',
      actorUid: fromUid,
      actorName: fromName,
    });
    void sendWebPushToUser(toUid, {
      title: 'New Follow & Chat Request',
      body: `${fromName} (@${fromHandle}) sent you a follow request to chat on Quadline.`,
      url: '/?tab=dms',
      tab: 'dms',
      tag: `social-req-${fromUid}`,
      category: 'social',
    });

    res.json({ relation, autoAccepted: false, graph: buildSocialGraphForUser(fromUid) });
  });

  app.post('/api/social/respond', async (req, res) => {
    const body = req.body || {};
    const uid = typeof body.uid === 'string' ? body.uid.trim().slice(0, 128) : '';
    const otherUid = typeof body.otherUid === 'string' ? body.otherUid.trim().slice(0, 128) : '';
    const action = body.action === 'accept' ? 'accept' : body.action === 'decline' ? 'decline' : '';
    const actorName =
      typeof body.actorName === 'string' && body.actorName.trim()
        ? body.actorName.trim().slice(0, 60)
        : 'Friend';

    if (!uid || !otherUid || !action) {
      res.status(400).json({ error: 'UID, otherUid, and action (accept/decline) are required.' });
      return;
    }

    const pairId = getSocialPairId(uid, otherUid);
    const existing = backendStore.socialRelations.find((r) => r.id === pairId);
    if (!existing || existing.status !== 'pending' || existing.targetUid !== uid) {
      res.status(404).json({ error: 'Pending friend request not found.' });
      return;
    }

    markFollowRequestNotificationsRead(uid, otherUid);
    const actorAcc = backendStore.accounts.find((a) => a.uid === uid);

    if (action === 'accept') {
      existing.status = 'accepted';
      existing.updatedAt = Date.now();
      recordSocialNotification({
        recipientUid: otherUid,
        actorUid: uid,
        actorName: actorAcc?.displayName || actorName,
        actorHandle: actorAcc?.handle || existing.targetHandle || 'friend',
        actorPhoto: actorAcc?.photoUrl || existing.targetPhoto || '',
        kind: 'request_accepted',
        title: 'Follow & Chat Request Accepted',
        body: `${actorAcc?.displayName || actorName} accepted your request — you can now chat, call & view Stories!`,
      });
      await persistBackendStore();
      pushSocialEvent(otherUid, {
        type: 'social:update',
        action: 'accepted',
        actorUid: uid,
        actorName,
      });
      pushSocialEvent(uid, {
        type: 'social:update',
        action: 'accepted',
        actorUid: uid,
        actorName,
      });
      void sendWebPushToUser(otherUid, {
        title: 'Follow & Chat Request Accepted',
        body: `${actorName} accepted your follow request — you can now chat, call & view Stories!`,
        url: '/?tab=dms',
        tab: 'dms',
        tag: `social-acc-${uid}`,
        category: 'social',
      });
    } else {
      backendStore.socialRelations = backendStore.socialRelations.filter((r) => r.id !== pairId);
      await persistBackendStore();
      pushSocialEvent(otherUid, {
        type: 'social:update',
        action: 'declined',
        actorUid: uid,
        actorName,
      });
      pushSocialEvent(uid, {
        type: 'social:update',
        action: 'declined',
        actorUid: uid,
        actorName,
      });
    }

    res.json({ ok: true, graph: buildSocialGraphForUser(uid) });
  });

  app.post('/api/social/remove', async (req, res) => {
    const body = req.body || {};
    const uid = typeof body.uid === 'string' ? body.uid.trim().slice(0, 128) : '';
    const otherUid = typeof body.otherUid === 'string' ? body.otherUid.trim().slice(0, 128) : '';
    if (!uid || !otherUid) {
      res.status(400).json({ error: 'UID and otherUid are required.' });
      return;
    }

    const pairId = getSocialPairId(uid, otherUid);
    backendStore.socialRelations = backendStore.socialRelations.filter((r) => r.id !== pairId);
    markFollowRequestNotificationsRead(otherUid, uid);
    markFollowRequestNotificationsRead(uid, otherUid);
    await persistBackendStore();

    pushSocialEvent(otherUid, {
      type: 'social:update',
      action: 'removed',
      actorUid: uid,
    });
    pushSocialEvent(uid, {
      type: 'social:update',
      action: 'removed',
      actorUid: uid,
    });

    res.json({ ok: true, graph: buildSocialGraphForUser(uid) });
  });

  // =========================================================
  // DEDICATED FOLLOW / FOLLOWERS SYSTEM (SEPARATE FROM CHAT REQUESTS)
  // =========================================================

  function enrichFollowUser(
    uid: string,
    fallbackName: string,
    fallbackHandle: string,
    fallbackPhoto: string,
    followedAt: number
  ) {
    const acc = backendStore.accounts.find((a) => a.uid === uid);
    return {
      uid,
      displayName: acc?.displayName || fallbackName || 'Member',
      handle: acc?.handle || fallbackHandle || 'member',
      photoUrl: acc?.photoUrl ?? fallbackPhoto ?? '',
      bio: acc?.bio || '',
      followedAt,
    };
  }

  function buildProfileFollowData(targetUid: string, viewerUid: string) {
    const followerEdges = backendStore.follows
      .filter((f) => f.followingUid === targetUid)
      .sort((a, b) => b.createdAt - a.createdAt);
    const followingEdges = backendStore.follows
      .filter((f) => f.followerUid === targetUid)
      .sort((a, b) => b.createdAt - a.createdAt);

    const followers = followerEdges.map((e) =>
      enrichFollowUser(e.followerUid, e.followerName, e.followerHandle, e.followerPhoto, e.createdAt)
    );
    const following = followingEdges.map((e) =>
      enrichFollowUser(
        e.followingUid,
        e.followingName,
        e.followingHandle,
        e.followingPhoto,
        e.createdAt
      )
    );

    const isFollowing = Boolean(
      viewerUid && followerEdges.some((e) => e.followerUid === viewerUid)
    );
    const followsYou = Boolean(
      viewerUid && followingEdges.some((e) => e.followingUid === viewerUid)
    );

    return {
      targetUid,
      followersCount: followers.length,
      followingCount: following.length,
      isFollowing,
      followsYou,
      isMutualFollow: isFollowing && followsYou,
      followers,
      following,
    };
  }

  app.get('/api/follows/profile', (req, res) => {
    const targetUid = typeof req.query.targetUid === 'string' ? req.query.targetUid.trim().slice(0, 128) : '';
    const viewerUid = typeof req.query.viewerUid === 'string' ? req.query.viewerUid.trim().slice(0, 128) : '';
    if (!targetUid) {
      res.status(400).json({ error: 'targetUid is required.' });
      return;
    }
    res.json(buildProfileFollowData(targetUid, viewerUid));
  });

  app.get('/api/follows/me', (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'UID is required.' });
      return;
    }
    const data = buildProfileFollowData(uid, uid);
    res.json({
      followers: data.followers,
      following: data.following,
      followersCount: data.followersCount,
      followingCount: data.followingCount,
    });
  });

  app.post('/api/follows/toggle', async (req, res) => {
    const body = req.body || {};
    const followerUid =
      typeof body.followerUid === 'string' ? body.followerUid.trim().slice(0, 128) : '';
    const targetUid =
      typeof body.targetUid === 'string' ? body.targetUid.trim().slice(0, 128) : '';
    if (!followerUid || !targetUid || followerUid === targetUid) {
      res.status(400).json({ error: 'Valid followerUid and targetUid are required.' });
      return;
    }

    const followerName =
      typeof body.followerName === 'string' && body.followerName.trim()
        ? body.followerName.trim().slice(0, 60)
        : 'Member';
    const followerHandle =
      typeof body.followerHandle === 'string' ? body.followerHandle.trim().slice(0, 32) : 'member';
    const followerPhoto =
      typeof body.followerPhoto === 'string' ? body.followerPhoto.slice(0, 45000) : '';

    const targetName =
      typeof body.targetName === 'string' && body.targetName.trim()
        ? body.targetName.trim().slice(0, 60)
        : 'Member';
    const targetHandle =
      typeof body.targetHandle === 'string' ? body.targetHandle.trim().slice(0, 32) : 'member';
    const targetPhoto =
      typeof body.targetPhoto === 'string' ? body.targetPhoto.slice(0, 45000) : '';

    const edgeId = `${followerUid}__${targetUid}`;
    const existingIdx = backendStore.follows.findIndex((f) => f.id === edgeId);
    const requestedAction =
      body.action === 'follow' || body.action === 'unfollow' ? body.action : null;

    let nowFollowing = false;
    if (requestedAction === 'unfollow' || (requestedAction === null && existingIdx >= 0)) {
      if (existingIdx >= 0) {
        backendStore.follows.splice(existingIdx, 1);
        await persistBackendStore();
      }
      nowFollowing = false;
      pushSocialEvent(targetUid, {
        type: 'social:update',
        action: 'unfollowed',
        actorUid: followerUid,
        actorName: followerName,
      });
      pushSocialEvent(followerUid, {
        type: 'social:update',
        action: 'unfollowed',
        actorUid: followerUid,
        actorName: followerName,
      });
    } else {
      if (existingIdx < 0) {
        const edge: SavedFollowEdge = {
          id: edgeId,
          followerUid,
          followerName,
          followerHandle,
          followerPhoto,
          followingUid: targetUid,
          followingName: targetName,
          followingHandle: targetHandle,
          followingPhoto: targetPhoto,
          createdAt: Date.now(),
        };
        backendStore.follows = [edge, ...backendStore.follows].slice(0, 8000);
        recordSocialNotification({
          recipientUid: targetUid,
          actorUid: followerUid,
          actorName: followerName,
          actorHandle: followerHandle,
          actorPhoto: followerPhoto,
          kind: 'new_follower',
          title: 'New Follower',
          body: `${followerName} (@${followerHandle}) started following you.`,
        });
        await persistBackendStore();
      }
      nowFollowing = true;
      pushSocialEvent(targetUid, {
        type: 'social:update',
        action: 'followed',
        actorUid: followerUid,
        actorName: followerName,
      });
      pushSocialEvent(followerUid, {
        type: 'social:update',
        action: 'followed',
        actorUid: followerUid,
        actorName: followerName,
      });
      void sendWebPushToUser(targetUid, {
        title: 'New Follower',
        body: `${followerName} (@${followerHandle}) started following you on Quadline.`,
        url: '/',
        tag: `follow-${followerUid}`,
        category: 'social',
      });
    }

    res.json({
      ok: true,
      isFollowing: nowFollowing,
      profileData: buildProfileFollowData(targetUid, followerUid),
    });
  });

  // =========================================================
  // IN-APP SOCIAL NOTIFICATIONS & PER-CHAT INSTAGRAM THEMES
  // =========================================================

  app.get('/api/notifications/social', (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'UID is required.' });
      return;
    }
    const items = backendStore.socialNotifications
      .filter((n) => n.recipientUid === uid)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 60);
    res.json({ notifications: items });
  });

  app.post('/api/notifications/social/read', async (req, res) => {
    const body = req.body || {};
    const uid = typeof body.uid === 'string' ? body.uid.trim().slice(0, 128) : '';
    const id = typeof body.id === 'string' ? body.id.trim().slice(0, 128) : '';
    const markAll = Boolean(body.markAll);
    if (!uid) {
      res.status(400).json({ error: 'UID is required.' });
      return;
    }
    let changed = false;
    for (const n of backendStore.socialNotifications) {
      if (n.recipientUid !== uid) continue;
      if (markAll || (id && n.id === id)) {
        if (!n.read) {
          n.read = true;
          changed = true;
        }
      }
    }
    if (changed) {
      await persistBackendStore();
    }
    res.json({ ok: true });
  });

  app.get('/api/rooms/themes', (_req, res) => {
    res.json({ themes: backendStore.roomThemes });
  });

  app.put('/api/rooms/:roomId/theme', async (req, res) => {
    const roomId = String(req.params.roomId || '').trim().slice(0, 128);
    const body = req.body || {};
    const chatThemeId =
      typeof body.chatThemeId === 'string' && VALID_CHAT_THEMES.has(body.chatThemeId)
        ? body.chatThemeId
        : '';
    const updatedBy =
      typeof body.updatedBy === 'string' ? body.updatedBy.trim().slice(0, 128) : '';
    const updatedByName =
      typeof body.updatedByName === 'string' && body.updatedByName.trim()
        ? body.updatedByName.trim().slice(0, 60)
        : 'Member';

    if (!roomId || !chatThemeId) {
      res.status(400).json({ error: 'Valid roomId and chatThemeId are required.' });
      return;
    }

    const record: SavedRoomChatTheme = {
      roomId,
      chatThemeId,
      updatedBy,
      updatedByName,
      updatedAt: Date.now(),
    };
    backendStore.roomThemes[roomId] = record;
    await persistBackendStore();

    broadcastRoomThemeEvent({
      type: 'room:theme',
      roomId,
      chatThemeId,
      updatedBy,
      updatedByName,
      updatedAt: record.updatedAt,
    });

    res.json({ ok: true, theme: record });
  });

  // =========================================================
  // ACCOUNTS, USERNAME LOOKUP & ADMIN-ONLY DIRECTORY
  // =========================================================

  const ADMIN_EMAILS = new Set(
    [
      'himanshu9199205385@gmail.com',
      ...(process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ].map((e) => e.toLowerCase())
  );

  function isAdminEmail(rawEmail: string): boolean {
    const clean = rawEmail.trim().toLowerCase();
    return Boolean(clean && ADMIN_EMAILS.has(clean));
  }

  function normalizeUsername(raw: string): string {
    return raw
      .trim()
      .replace(/^@/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '')
      .slice(0, 32);
  }

  function getAcceptedFriendUids(uid: string): Set<string> {
    const set = new Set<string>();
    for (const rel of backendStore.socialRelations) {
      if (rel.status !== 'accepted') continue;
      if (rel.requesterUid === uid) set.add(rel.targetUid);
      else if (rel.targetUid === uid) set.add(rel.requesterUid);
    }
    // Mutual followers (both follow each other) also unlock each other's 24h Stories
    const myFollowing = new Set(
      backendStore.follows.filter((f) => f.followerUid === uid).map((f) => f.followingUid)
    );
    for (const f of backendStore.follows) {
      if (f.followingUid === uid && myFollowing.has(f.followerUid)) {
        set.add(f.followerUid);
      }
    }
    return set;
  }

  app.post('/api/accounts/register', async (req, res) => {
    const body = req.body || {};
    const uid = typeof body.uid === 'string' ? body.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'UID is required.' });
      return;
    }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const displayName =
      typeof body.displayName === 'string' && body.displayName.trim()
        ? body.displayName.trim().slice(0, 60)
        : 'Member';
    const handle = normalizeUsername(typeof body.handle === 'string' ? body.handle : '') || `user_${uid.slice(0, 6).toLowerCase()}`;
    const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 240) : '';
    const photoUrl = typeof body.photoUrl === 'string' ? body.photoUrl.slice(0, 45000) : '';
    const authMethod = typeof body.authMethod === 'string' ? body.authMethod.slice(0, 24) : 'email';
    const now = Date.now();

    const existing = backendStore.accounts.find((a) => a.uid === uid);
    if (existing) {
      if (email) existing.email = email;
      existing.displayName = displayName;
      existing.handle = handle;
      existing.bio = bio;
      existing.photoUrl = photoUrl;
      if (authMethod) existing.authMethod = authMethod;
      existing.lastLoginAt = now;
    } else {
      backendStore.accounts.unshift({
        uid,
        email,
        displayName,
        handle,
        bio,
        photoUrl,
        authMethod,
        createdAt: now,
        lastLoginAt: now,
      });
      backendStore.accounts = backendStore.accounts.slice(0, 5000);
    }

    // Keep cached avatar/handle fresh in social relations & active stories too
    for (const rel of backendStore.socialRelations) {
      if (rel.requesterUid === uid) {
        rel.requesterName = displayName;
        rel.requesterHandle = handle;
        rel.requesterPhoto = photoUrl;
      } else if (rel.targetUid === uid) {
        rel.targetName = displayName;
        rel.targetHandle = handle;
        rel.targetPhoto = photoUrl;
      }
    }
    for (const st of backendStore.stories) {
      if (st.authorUid === uid) {
        st.authorName = displayName;
        st.authorHandle = handle;
        st.authorPhoto = photoUrl;
      }
    }
    for (const edge of backendStore.follows) {
      if (edge.followerUid === uid) {
        edge.followerName = displayName;
        edge.followerHandle = handle;
        edge.followerPhoto = photoUrl;
      } else if (edge.followingUid === uid) {
        edge.followingName = displayName;
        edge.followingHandle = handle;
        edge.followingPhoto = photoUrl;
      }
    }

    await persistBackendStore();
    res.json({ ok: true, isAdmin: isAdminEmail(email) });
  });

  app.get('/api/accounts/check-username', (req, res) => {
    const rawHandle = typeof req.query.handle === 'string' ? req.query.handle : '';
    const excludeUid = typeof req.query.excludeUid === 'string' ? req.query.excludeUid.trim() : '';
    const normalized = normalizeUsername(rawHandle);
    if (normalized.length < 2) {
      res.json({ available: false, normalized, reason: 'Username must be at least 2 characters.' });
      return;
    }
    const taken = backendStore.accounts.some(
      (acc) => acc.handle.toLowerCase() === normalized && acc.uid !== excludeUid
    );
    res.json({
      available: !taken,
      normalized,
      reason: taken ? 'That username is already taken.' : undefined,
    });
  });

  // Search accounts by @username (strictly requires 2+ characters, never leaks email or total app user count)
  app.get('/api/accounts/search', (req, res) => {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const excludeUid = typeof req.query.excludeUid === 'string' ? req.query.excludeUid.trim() : '';
    const cleaned = rawQ.replace(/^@/, '').toLowerCase();
    if (cleaned.length < 2) {
      res.json({ accounts: [] });
      return;
    }
    const matches = backendStore.accounts
      .filter((a) => a.uid !== excludeUid)
      .filter(
        (a) =>
          a.handle.toLowerCase().includes(cleaned) ||
          a.displayName.toLowerCase().includes(cleaned)
      )
      .sort((a, b) => {
        const aExact = a.handle.toLowerCase() === cleaned ? 1 : 0;
        const bExact = b.handle.toLowerCase() === cleaned ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        const aStarts = a.handle.toLowerCase().startsWith(cleaned) ? 1 : 0;
        const bStarts = b.handle.toLowerCase().startsWith(cleaned) ? 1 : 0;
        return bStarts - aStarts;
      })
      .slice(0, 10)
      .map((a) => ({
        uid: a.uid,
        displayName: a.displayName,
        handle: a.handle,
        bio: a.bio,
        photoUrl: a.photoUrl,
      }));
    res.json({ accounts: matches });
  });

  app.get('/api/admin/status', (req, res) => {
    const email = typeof req.query.email === 'string' ? req.query.email : '';
    res.json({ isAdmin: isAdminEmail(email) });
  });

  app.get('/api/admin/accounts', (req, res) => {
    const email = typeof req.query.email === 'string' ? req.query.email : '';
    if (!isAdminEmail(email)) {
      res.status(403).json({ error: 'Admin access required.' });
      return;
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const sorted = [...backendStore.accounts].sort((a, b) => b.createdAt - a.createdAt);
    const todayCount = sorted.filter((a) => a.createdAt >= todayMs).length;
    res.json({
      totalCount: sorted.length,
      todayCount,
      accounts: sorted,
    });
  });

  // Full Admin Portal Overview (strictly accessible to ADMIN_EMAILS)
  app.get('/api/admin/overview', (req, res) => {
    const email = typeof req.query.email === 'string' ? req.query.email : '';
    if (!isAdminEmail(email)) {
      res.status(403).json({ error: 'Admin access required.' });
      return;
    }
    if (pruneExpiredStories()) {
      void persistBackendStore();
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    const followerCounts = new Map<string, number>();
    const followingCounts = new Map<string, number>();
    for (const edge of backendStore.follows) {
      followerCounts.set(edge.followingUid, (followerCounts.get(edge.followingUid) || 0) + 1);
      followingCounts.set(edge.followerUid, (followingCounts.get(edge.followerUid) || 0) + 1);
    }

    const accounts = [...backendStore.accounts]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((acc) => ({
        ...acc,
        followersCount: followerCounts.get(acc.uid) || 0,
        followingCount: followingCounts.get(acc.uid) || 0,
      }));

    const todayAccounts = accounts.filter((a) => a.createdAt >= todayMs).length;
    const allCalls = Object.values(backendStore.callHistory)
      .flat()
      .sort((a, b) => b.startedAt - a.startedAt);
    const pushDevicesCount = Object.values(backendStore.pushSubscriptions).reduce(
      (sum, list) => sum + (Array.isArray(list) ? list.length : 0),
      0
    );
    const roomThemesList = Object.values(backendStore.roomThemes)
      .filter((t) => t.chatThemeId !== 'classic')
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const activeStories = [...backendStore.stories].sort((a, b) => b.createdAt - a.createdAt);
    const reels = [...backendStore.reels].sort((a, b) => b.createdAt - a.createdAt);

    res.json({
      stats: {
        totalAccounts: accounts.length,
        todayAccounts,
        onlineUsersCount: userSockets.size,
        activeStoriesCount: activeStories.length,
        reelsCount: reels.length,
        savedCallsCount: allCalls.length,
        pushDevicesCount,
        roomThemesCount: roomThemesList.length,
        customMediaCount: backendStore.customMedia.length,
        followsCount: backendStore.follows.length,
        friendshipsCount: backendStore.socialRelations.filter((r) => r.status === 'accepted').length,
        pendingRequestsCount: backendStore.socialRelations.filter((r) => r.status === 'pending').length,
      },
      accounts,
      stories: activeStories.slice(0, 60),
      reels: reels.slice(0, 60).map((r) => ({
        id: r.id,
        authorUid: r.authorUid,
        authorName: r.authorName,
        authorHandle: r.authorHandle,
        caption: r.caption,
        mediaType: r.mediaType,
        likesCount: r.likedBy.length,
        commentsCount: r.comments.length,
        views: r.views,
        createdAt: r.createdAt,
      })),
      roomThemes: roomThemesList.slice(0, 80),
      recentCalls: allCalls.slice(0, 40),
      storageEngine: 'Quadline Persistent File Store',
    });
  });

  app.delete('/api/admin/accounts/:uid', async (req, res) => {
    const email = typeof req.query.email === 'string' ? req.query.email : '';
    if (!isAdminEmail(email)) {
      res.status(403).json({ error: 'Admin access required.' });
      return;
    }
    const targetUid = String(req.params.uid || '').trim();
    if (!targetUid) {
      res.status(400).json({ error: 'UID is required.' });
      return;
    }
    const before = backendStore.accounts.length;
    backendStore.accounts = backendStore.accounts.filter((a) => a.uid !== targetUid);
    backendStore.follows = backendStore.follows.filter(
      (f) => f.followerUid !== targetUid && f.followingUid !== targetUid
    );
    backendStore.socialRelations = backendStore.socialRelations.filter(
      (r) => r.requesterUid !== targetUid && r.targetUid !== targetUid
    );
    backendStore.stories = backendStore.stories.filter((s) => s.authorUid !== targetUid);
    await persistBackendStore();
    res.json({ ok: true, removed: before !== backendStore.accounts.length });
  });

  app.delete('/api/admin/stories/:id', async (req, res) => {
    const email = typeof req.query.email === 'string' ? req.query.email : '';
    if (!isAdminEmail(email)) {
      res.status(403).json({ error: 'Admin access required.' });
      return;
    }
    const id = String(req.params.id || '').trim();
    const before = backendStore.stories.length;
    backendStore.stories = backendStore.stories.filter((s) => s.id !== id);
    await persistBackendStore();
    res.json({ ok: true, removed: before !== backendStore.stories.length });
  });

  app.delete('/api/admin/reels/:id', async (req, res) => {
    const email = typeof req.query.email === 'string' ? req.query.email : '';
    if (!isAdminEmail(email)) {
      res.status(403).json({ error: 'Admin access required.' });
      return;
    }
    const id = String(req.params.id || '').trim();
    const before = backendStore.reels.length;
    backendStore.reels = backendStore.reels.filter((r) => r.id !== id);
    await persistBackendStore();
    res.json({ ok: true, removed: before !== backendStore.reels.length });
  });

  // =========================================================
  // IN-APP CUSTOM STICKER & ANIMATED GIF MAKER PERSISTENCE
  // =========================================================

  app.get('/api/custom-media', (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'UID is required.' });
      return;
    }
    const items = backendStore.customMedia
      .filter((m) => m.uid === uid)
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json({ items });
  });

  app.post('/api/custom-media', async (req, res) => {
    const body = req.body || {};
    const uid = typeof body.uid === 'string' ? body.uid.trim().slice(0, 128) : '';
    const kind = body.kind === 'gif' ? 'gif' : body.kind === 'sticker' ? 'sticker' : null;
    const label =
      typeof body.label === 'string' && body.label.trim()
        ? body.label.trim().slice(0, 48)
        : kind === 'gif'
          ? 'Custom GIF'
          : 'Custom Sticker';
    const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl.trim() : '';
    if (!uid || !kind || !dataUrl.startsWith('data:image/')) {
      res.status(400).json({ error: 'Invalid custom sticker or GIF payload.' });
      return;
    }
    if (dataUrl.length > 480_000) {
      res.status(413).json({ error: 'Custom sticker or GIF is too large. Try a smaller photo.' });
      return;
    }
    const item: SavedCustomMedia = {
      id: `cm_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      uid,
      kind,
      label,
      dataUrl,
      createdAt: Date.now(),
    };
    const userItems = backendStore.customMedia.filter((m) => m.uid === uid);
    const otherItems = backendStore.customMedia.filter((m) => m.uid !== uid);
    backendStore.customMedia = [item, ...userItems.slice(0, 47), ...otherItems].slice(0, 1500);
    await persistBackendStore();
    res.json({ ok: true, item });
  });

  app.delete('/api/custom-media/:id', async (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    const id = String(req.params.id || '').trim();
    if (!uid || !id) {
      res.status(400).json({ error: 'UID and ID are required.' });
      return;
    }
    const before = backendStore.customMedia.length;
    backendStore.customMedia = backendStore.customMedia.filter(
      (m) => !(m.id === id && m.uid === uid)
    );
    await persistBackendStore();
    res.json({ ok: true, removed: before !== backendStore.customMedia.length });
  });

  // =========================================================
  // MUTUAL-FOLLOW 24-HOUR STORIES API (STRICTLY FRIENDS-ONLY)
  // =========================================================

  const STORY_TTL_MS = 24 * 60 * 60 * 1000;

  function pruneExpiredStories(): boolean {
    const now = Date.now();
    const before = backendStore.stories.length;
    backendStore.stories = backendStore.stories.filter((s) => s.expiresAt > now);
    return backendStore.stories.length !== before;
  }

  app.get('/api/stories', (req, res) => {
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'UID is required.' });
      return;
    }
    if (pruneExpiredStories()) {
      void persistBackendStore();
    }
    const friendUids = getAcceptedFriendUids(uid);
    const visible = backendStore.stories
      .filter((s) => s.authorUid === uid || friendUids.has(s.authorUid))
      .sort((a, b) => a.createdAt - b.createdAt);
    res.json({ stories: visible });
  });

  app.post('/api/stories', async (req, res) => {
    const body = req.body || {};
    const authorUid = typeof body.authorUid === 'string' ? body.authorUid.trim().slice(0, 128) : '';
    if (!authorUid) {
      res.status(400).json({ error: 'Author UID is required.' });
      return;
    }
    const mediaType: 'image' | 'video' | 'text' =
      body.mediaType === 'image' || body.mediaType === 'video' ? body.mediaType : 'text';
    const mediaUrl = typeof body.mediaUrl === 'string' ? body.mediaUrl.trim().slice(0, 350000) : '';
    const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 280) : '';
    const backgroundTheme =
      typeof body.backgroundTheme === 'string' && body.backgroundTheme.trim()
        ? body.backgroundTheme.trim().slice(0, 32)
        : 'sunset';

    if (mediaType === 'text' && !caption) {
      res.status(400).json({ error: 'Story text is required.' });
      return;
    }
    if ((mediaType === 'image' || mediaType === 'video') && !mediaUrl) {
      res.status(400).json({ error: 'Story photo or video is required.' });
      return;
    }

    const now = Date.now();
    const story: SavedStory = {
      id: `story_${now.toString(36)}_${crypto.randomBytes(4).toString('hex')}`,
      authorUid,
      authorName:
        typeof body.authorName === 'string' && body.authorName.trim()
          ? body.authorName.trim().slice(0, 60)
          : 'Member',
      authorHandle:
        typeof body.authorHandle === 'string' && body.authorHandle.trim()
          ? body.authorHandle.trim().slice(0, 32)
          : 'member',
      authorPhoto: typeof body.authorPhoto === 'string' ? body.authorPhoto.slice(0, 45000) : '',
      mediaType,
      mediaUrl,
      caption,
      backgroundTheme,
      viewers: [],
      createdAt: now,
      expiresAt: now + STORY_TTL_MS,
    };

    pruneExpiredStories();
    backendStore.stories.push(story);
    backendStore.stories = backendStore.stories.slice(-400);
    await persistBackendStore();

    // Notify ONLY the author and their accepted mutual friends in real time + phone push
    const friendUids = getAcceptedFriendUids(authorUid);
    const recipients = new Set<string>([authorUid, ...friendUids]);
    for (const targetUid of recipients) {
      pushSocialEvent(targetUid, {
        type: 'story:update',
        action: 'created',
        authorUid,
        authorName: story.authorName,
      });
      if (targetUid !== authorUid) {
        void sendWebPushToUser(targetUid, {
          title: `New Story from ${story.authorName}`,
          body: story.caption || `${story.authorName} added to their 24h Story on Quadline.`,
          url: '/',
          tag: `story-${authorUid}`,
          category: 'story',
        });
      }
    }

    res.json({ story });
  });

  app.post('/api/stories/:storyId/view', async (req, res) => {
    const storyId = req.params.storyId;
    const body = req.body || {};
    const uid = typeof body.uid === 'string' ? body.uid.trim().slice(0, 128) : '';
    if (!uid) {
      res.status(400).json({ error: 'Viewer UID is required.' });
      return;
    }
    const story = backendStore.stories.find((s) => s.id === storyId);
    if (!story) {
      res.status(404).json({ error: 'Story not found or expired.' });
      return;
    }
    const friendUids = getAcceptedFriendUids(story.authorUid);
    if (story.authorUid !== uid && !friendUids.has(uid)) {
      res.status(403).json({ error: 'Only mutual friends can view this story.' });
      return;
    }
    if (story.authorUid !== uid && !story.viewers.some((v) => v.uid === uid)) {
      story.viewers.push({
        uid,
        displayName:
          typeof body.displayName === 'string' && body.displayName.trim()
            ? body.displayName.trim().slice(0, 60)
            : 'Friend',
        handle: typeof body.handle === 'string' ? body.handle.trim().slice(0, 32) : 'friend',
        photoUrl: typeof body.photoUrl === 'string' ? body.photoUrl.slice(0, 45000) : '',
        viewedAt: Date.now(),
      });
      await persistBackendStore();
      pushSocialEvent(story.authorUid, {
        type: 'story:update',
        action: 'viewed',
        authorUid: story.authorUid,
      });
    }
    res.json({ ok: true, viewers: story.viewers });
  });

  app.delete('/api/stories/:storyId', async (req, res) => {
    const storyId = req.params.storyId;
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim() : '';
    const idx = backendStore.stories.findIndex((s) => s.id === storyId);
    if (idx === -1) {
      res.status(404).json({ error: 'Story not found.' });
      return;
    }
    if (backendStore.stories[idx].authorUid !== uid) {
      res.status(403).json({ error: 'Only the story author can delete this story.' });
      return;
    }
    const authorUid = backendStore.stories[idx].authorUid;
    backendStore.stories.splice(idx, 1);
    await persistBackendStore();
    const recipients = new Set<string>([authorUid, ...getAcceptedFriendUids(authorUid)]);
    for (const targetUid of recipients) {
      pushSocialEvent(targetUid, {
        type: 'story:update',
        action: 'deleted',
        authorUid,
      });
    }
    res.json({ ok: true });
  });

  // =========================================================
  // INSTAGRAM-JOINED REELS FEED API (PERSISTED TO DISK)
  // =========================================================

  app.get('/api/reels', (_req, res) => {
    const sorted = [...backendStore.reels].sort((a, b) => b.createdAt - a.createdAt);
    res.json({ reels: sorted });
  });

  app.post('/api/reels', async (req, res) => {
    const body = req.body || {};
    const authorUid = typeof body.authorUid === 'string' ? body.authorUid.trim().slice(0, 128) : '';
    if (!authorUid) {
      res.status(400).json({ error: 'Author UID required.' });
      return;
    }

    const mediaType =
      body.mediaType === 'video' ||
      body.mediaType === 'image' ||
      body.mediaType === 'scene' ||
      body.mediaType === 'instagram'
        ? body.mediaType
        : 'scene';
    const sceneTheme =
      body.sceneTheme === 'sunset' ||
      body.sceneTheme === 'neon_grid' ||
      body.sceneTheme === 'ocean' ||
      body.sceneTheme === 'midnight'
        ? body.sceneTheme
        : 'aurora';

    const tags = Array.isArray(body.tags)
      ? body.tags
          .filter((t: unknown): t is string => typeof t === 'string')
          .map((t: string) => t.replace(/^#/, '').trim().slice(0, 24))
          .filter(Boolean)
          .slice(0, 6)
      : [];

    const rawIgUrl = typeof body.instagramUrl === 'string' ? body.instagramUrl.trim().slice(0, 300) : '';
    const igMatch = rawIgUrl.match(
      /(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]{5,32})/i
    );
    const instagramCode =
      typeof body.instagramCode === 'string' && /^[A-Za-z0-9_-]{5,32}$/.test(body.instagramCode.trim())
        ? body.instagramCode.trim()
        : igMatch
          ? igMatch[1]
          : undefined;
    const instagramUrl = instagramCode ? `https://www.instagram.com/reel/${instagramCode}/` : undefined;

    const reel: SavedReel = {
      id: `reel_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      authorUid,
      authorName:
        typeof body.authorName === 'string' && body.authorName.trim()
          ? body.authorName.trim().slice(0, 60)
          : 'Campus Creator',
      authorHandle:
        typeof body.authorHandle === 'string' && body.authorHandle.trim()
          ? body.authorHandle.trim().slice(0, 32)
          : 'creator',
      authorPhoto:
        typeof body.authorPhoto === 'string' ? body.authorPhoto.slice(0, 45000) : '',
      caption:
        typeof body.caption === 'string' ? body.caption.trim().slice(0, 300) : '',
      audioTitle:
        typeof body.audioTitle === 'string' && body.audioTitle.trim()
          ? body.audioTitle.trim().slice(0, 80)
          : 'Original Audio',
      audioArtist:
        typeof body.audioArtist === 'string' && body.audioArtist.trim()
          ? body.audioArtist.trim().slice(0, 80)
          : undefined,
      audioPreviewUrl:
        typeof body.audioPreviewUrl === 'string' && body.audioPreviewUrl.startsWith('https://')
          ? body.audioPreviewUrl.slice(0, 500)
          : undefined,
      audioArtwork:
        typeof body.audioArtwork === 'string' && body.audioArtwork.startsWith('https://')
          ? body.audioArtwork.slice(0, 500)
          : undefined,
      mediaType,
      mediaUrl: typeof body.mediaUrl === 'string' ? body.mediaUrl.slice(0, 350000) : '',
      instagramUrl,
      instagramCode,
      sceneTheme,
      sceneEmoji:
        typeof body.sceneEmoji === 'string' && body.sceneEmoji.trim()
          ? body.sceneEmoji.trim().slice(0, 8)
          : '✨',
      sceneHeadline:
        typeof body.sceneHeadline === 'string' && body.sceneHeadline.trim()
          ? body.sceneHeadline.trim().slice(0, 60)
          : 'Campus Reel',
      tags,
      likedBy: [],
      comments: [],
      views: 1,
      createdAt: Date.now(),
    };

    backendStore.reels = [reel, ...backendStore.reels].slice(0, 80);
    await persistBackendStore();
    res.json({ reel });
  });

  app.post('/api/reels/:reelId/like', async (req, res) => {
    const reelId = String(req.params.reelId || '').trim();
    const uid = typeof req.body?.uid === 'string' ? req.body.uid.trim().slice(0, 128) : '';
    if (!reelId || !uid) {
      res.status(400).json({ error: 'Reel ID and UID required.' });
      return;
    }
    const reel = backendStore.reels.find((r) => r.id === reelId);
    if (!reel) {
      res.status(404).json({ error: 'Reel not found.' });
      return;
    }
    if (reel.likedBy.includes(uid)) {
      reel.likedBy = reel.likedBy.filter((id) => id !== uid);
    } else {
      reel.likedBy = [...reel.likedBy, uid];
    }
    await persistBackendStore();
    res.json({ reel });
  });

  app.post('/api/reels/:reelId/comment', async (req, res) => {
    const reelId = String(req.params.reelId || '').trim();
    const uid = typeof req.body?.uid === 'string' ? req.body.uid.trim().slice(0, 128) : '';
    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 240) : '';
    if (!reelId || !uid || !text) {
      res.status(400).json({ error: 'Reel ID, UID, and comment text required.' });
      return;
    }
    const reel = backendStore.reels.find((r) => r.id === reelId);
    if (!reel) {
      res.status(404).json({ error: 'Reel not found.' });
      return;
    }
    const comment: SavedReelComment = {
      id: `rc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      uid,
      authorName:
        typeof req.body?.authorName === 'string' && req.body.authorName.trim()
          ? req.body.authorName.trim().slice(0, 60)
          : 'Member',
      authorPhoto:
        typeof req.body?.authorPhoto === 'string' ? req.body.authorPhoto.slice(0, 45000) : '',
      text,
      createdAt: Date.now(),
    };
    reel.comments = [...reel.comments, comment].slice(-80);
    await persistBackendStore();
    res.json({ reel, comment });
  });

  app.delete('/api/reels/:reelId', async (req, res) => {
    const reelId = String(req.params.reelId || '').trim();
    const uid = typeof req.query.uid === 'string' ? req.query.uid.trim().slice(0, 128) : '';
    const reel = backendStore.reels.find((r) => r.id === reelId);
    if (!reel) {
      res.status(404).json({ error: 'Reel not found.' });
      return;
    }
    if (reel.authorUid !== uid) {
      res.status(403).json({ error: 'Only the reel creator can delete this reel.' });
      return;
    }
    backendStore.reels = backendStore.reels.filter((r) => r.id !== reelId);
    await persistBackendStore();
    res.json({ ok: true });
  });

  // =========================================================
  // CHUNKED MEDIA UPLOAD API (UP TO 90 MB)
  // =========================================================

  app.post('/api/uploads/init', async (req, res) => {
    try {
      const { fileName, mimeType, totalSize, totalChunks, uploaderUid } = req.body || {};
      if (typeof uploaderUid !== 'string' || uploaderUid.trim().length === 0) {
        res.status(401).json({ error: 'Authentication required to upload files.' });
        return;
      }

      const cleanName = sanitizeFileName(typeof fileName === 'string' ? fileName : 'file');
      const cleanMime =
        typeof mimeType === 'string' && mimeType.trim().length > 0
          ? mimeType.trim().slice(0, 100)
          : 'application/octet-stream';
      const numericSize = Number(totalSize);
      const numericChunks = Number(totalChunks);

      const validationError = validateServerUpload(cleanName, cleanMime, numericSize);
      if (validationError) {
        const status = numericSize > MAX_FILE_SIZE_BYTES ? 413 : 400;
        res.status(status).json({ error: validationError });
        return;
      }

      const expectedMaxChunks = Math.ceil(MAX_FILE_SIZE_BYTES / UPLOAD_CHUNK_SIZE_BYTES) + 2;
      if (
        !Number.isInteger(numericChunks) ||
        numericChunks < 1 ||
        numericChunks > expectedMaxChunks
      ) {
        res.status(400).json({ error: 'Invalid chunk count.' });
        return;
      }

      const uploadId = crypto.randomBytes(16).toString('hex');
      const sessionDir = path.join(UPLOADS_TMP_DIR, uploadId);
      await fsp.mkdir(sessionDir, { recursive: true });

      uploadSessions.set(uploadId, {
        uploadId,
        fileName: cleanName,
        mimeType: cleanMime,
        totalSize: numericSize,
        totalChunks: numericChunks,
        uploaderUid: uploaderUid.slice(0, 128),
        receivedChunks: new Map<number, number>(),
        createdAt: Date.now(),
      });

      res.json({
        uploadId,
        chunkSize: UPLOAD_CHUNK_SIZE_BYTES,
        maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
      });
    } catch {
      res.status(500).json({ error: 'Unable to initialize upload session.' });
    }
  });

  app.put(
    '/api/uploads/:uploadId/chunk/:index',
    express.raw({ type: () => true, limit: '3mb' }),
    async (req, res) => {
      try {
        const uploadId = req.params.uploadId;
        const index = Number(req.params.index);
        const session = uploadSessions.get(uploadId);
        if (!session) {
          res.status(404).json({ error: 'Upload session not found or expired.' });
          return;
        }
        if (!Number.isInteger(index) || index < 0 || index >= session.totalChunks) {
          res.status(400).json({ error: 'Invalid chunk index.' });
          return;
        }
        const chunkBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (chunkBuffer.length === 0) {
          res.status(400).json({ error: 'Empty chunk payload.' });
          return;
        }

        // Verify cumulative uploaded size never exceeds 90 MB
        let totalReceived = 0;
        for (const [idx, size] of session.receivedChunks.entries()) {
          if (idx !== index) totalReceived += size;
        }
        if (totalReceived + chunkBuffer.length > MAX_FILE_SIZE_BYTES) {
          res.status(413).json({ error: FILE_TOO_LARGE_ERROR });
          return;
        }

        const chunkPath = path.join(UPLOADS_TMP_DIR, uploadId, `chunk_${index}`);
        await fsp.writeFile(chunkPath, chunkBuffer);
        session.receivedChunks.set(index, chunkBuffer.length);

        res.json({
          ok: true,
          chunkIndex: index,
          receivedChunks: session.receivedChunks.size,
          totalChunks: session.totalChunks,
        });
      } catch {
        res.status(500).json({ error: 'Failed to store upload chunk.' });
      }
    }
  );

  app.post('/api/uploads/:uploadId/complete', async (req, res) => {
    const uploadId = req.params.uploadId;
    const session = uploadSessions.get(uploadId);
    if (!session) {
      res.status(404).json({ error: 'Upload session not found or expired.' });
      return;
    }

    try {
      for (let i = 0; i < session.totalChunks; i++) {
        if (!session.receivedChunks.has(i)) {
          res.status(400).json({ error: `Missing chunk ${i + 1} of ${session.totalChunks}.` });
          return;
        }
      }

      const fileId = crypto.randomBytes(14).toString('hex');
      const finalBinPath = path.join(UPLOADS_DIR, `${fileId}.bin`);
      const finalMetaPath = path.join(UPLOADS_DIR, `${fileId}.meta.json`);
      const sessionDir = path.join(UPLOADS_TMP_DIR, uploadId);

      const writeStream = fs.createWriteStream(finalBinPath);
      let assembledBytes = 0;

      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(sessionDir, `chunk_${i}`);
        const chunkData = await fsp.readFile(chunkPath);
        assembledBytes += chunkData.length;
        if (assembledBytes > MAX_FILE_SIZE_BYTES) {
          writeStream.destroy();
          await fsp.rm(finalBinPath, { force: true });
          res.status(413).json({ error: FILE_TOO_LARGE_ERROR });
          return;
        }
        await new Promise<void>((resolve, reject) => {
          writeStream.write(chunkData, (err) => (err ? reject(err) : resolve()));
        });
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.end(() => resolve());
        writeStream.on('error', reject);
      });

      const meta: StoredMediaMeta = {
        fileId,
        fileName: session.fileName,
        mimeType: session.mimeType,
        size: assembledBytes,
        uploaderUid: session.uploaderUid,
        createdAt: Date.now(),
      };
      await fsp.writeFile(finalMetaPath, JSON.stringify(meta), 'utf8');

      uploadSessions.delete(uploadId);
      await fsp.rm(sessionDir, { recursive: true, force: true });

      res.json({
        fileId,
        url: `/api/media/${fileId}`,
        downloadUrl: `/api/media/${fileId}?download=1`,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        size: meta.size,
      });
    } catch {
      res.status(500).json({ error: 'Failed to finalize uploaded file.' });
    }
  });

  app.delete('/api/uploads/:uploadId', async (req, res) => {
    const uploadId = req.params.uploadId;
    uploadSessions.delete(uploadId);
    const sessionDir = path.join(UPLOADS_TMP_DIR, uploadId);
    await fsp.rm(sessionDir, { recursive: true, force: true }).catch(() => {});
    res.json({ ok: true });
  });

  // Stream stored media with HTTP Range support & original download option
  app.get('/api/media/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(fileId)) {
      res.status(400).json({ error: 'Invalid media ID.' });
      return;
    }

    const binPath = path.join(UPLOADS_DIR, `${fileId}.bin`);
    const metaPath = path.join(UPLOADS_DIR, `${fileId}.meta.json`);

    try {
      const [stat, metaRaw] = await Promise.all([
        fsp.stat(binPath),
        fsp.readFile(metaPath, 'utf8'),
      ]);
      const meta = JSON.parse(metaRaw) as StoredMediaMeta;
      const totalSize = stat.size;
      const forceDownload = req.query.download === '1';
      const safeHeaderName = meta.fileName.replace(/["\r\n]/g, '_');

      res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      res.setHeader(
        'Content-Disposition',
        `${forceDownload ? 'attachment' : 'inline'}; filename="${safeHeaderName}"`
      );

      const range = req.headers.range;
      if (range && !forceDownload) {
        const match = range.match(/bytes=(\d*)-(\d*)/);
        if (match) {
          const start = match[1] ? parseInt(match[1], 10) : 0;
          const end = match[2] ? Math.min(parseInt(match[2], 10), totalSize - 1) : totalSize - 1;
          if (start >= totalSize || end >= totalSize || start > end) {
            res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
            return;
          }
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
          res.setHeader('Content-Length', String(end - start + 1));
          fs.createReadStream(binPath, { start, end }).pipe(res);
          return;
        }
      }

      res.setHeader('Content-Length', String(totalSize));
      fs.createReadStream(binPath).pipe(res);
    } catch {
      res.status(404).json({ error: 'Media file not found.' });
    }
  });

  // =========================================================
  // LINK PREVIEW ENDPOINT
  // =========================================================

  app.get('/api/link-preview', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const parsed = isSafeExternalUrl(rawUrl);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid or unsupported URL' });
      return;
    }

    const fallback = {
      url: parsed.toString(),
      domain: parsed.hostname.replace(/^www\./, ''),
      title: parsed.hostname.replace(/^www\./, ''),
      description:
        parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(0, 120) : 'External link',
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3200);
      const response = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'QuadlineLinkPreview/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('text/html')) {
        res.json(fallback);
        return;
      }

      const html = (await response.text()).slice(0, 80000);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title =
        extractMeta(html, 'og:title') ||
        extractMeta(html, 'twitter:title') ||
        (titleMatch ? decodeHtmlEntities(titleMatch[1]).slice(0, 140) : '') ||
        fallback.title;
      const description =
        extractMeta(html, 'og:description') ||
        extractMeta(html, 'description') ||
        fallback.description;

      res.json({
        url: parsed.toString(),
        domain: parsed.hostname.replace(/^www\./, ''),
        title: title.slice(0, 140),
        description: description.slice(0, 220),
      });
    } catch {
      res.json(fallback);
    }
  });

  // Clean up abandoned chunked upload sessions older than 2 hours
  const uploadSweepInterval = setInterval(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [uploadId, session] of uploadSessions.entries()) {
      if (session.createdAt < cutoff) {
        uploadSessions.delete(uploadId);
        fsp.rm(path.join(UPLOADS_TMP_DIR, uploadId), { recursive: true, force: true }).catch(() => {});
      }
    }
  }, 15 * 60 * 1000);

  // =========================================================
  // REAL-TIME WEBSOCKET HUB (PRESENCE, TYPING, WEBRTC SIGNALING)
  // =========================================================

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  function broadcastAll(payload: Record<string, unknown>) {
    const encoded = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(encoded);
      }
    }
  }

  function sendToUser(targetUid: string, payload: Record<string, unknown>): boolean {
    const targets = userSockets.get(targetUid);
    if (!targets || targets.size === 0) return false;
    const encoded = JSON.stringify(payload);
    let sent = false;
    for (const targetWs of targets) {
      if (targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(encoded);
        sent = true;
      }
    }
    return sent;
  }

  pushSocialEvent = (targetUid, payload) => {
    sendToUser(targetUid, payload);
  };

  broadcastRoomThemeEvent = (payload) => {
    broadcastAll(payload);
  };

  function broadcastTyping(roomId: string) {
    const roomMap = typingByRoom.get(roomId);
    const now = Date.now();
    const active: Array<{ uid: string; displayName: string; activity: LiveActivityKind }> = [];
    if (roomMap) {
      for (const [uid, entry] of roomMap.entries()) {
        if (entry.expiresAt <= now) {
          roomMap.delete(uid);
        } else {
          active.push({
            uid: entry.uid,
            displayName: entry.displayName,
            activity: entry.activity,
          });
        }
      }
    }
    broadcastAll({ type: 'typing:update', roomId, users: active });
  }

  const typingSweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [roomId, roomMap] of typingByRoom.entries()) {
      let changed = false;
      for (const [uid, entry] of roomMap.entries()) {
        if (entry.expiresAt <= now) {
          roomMap.delete(uid);
          changed = true;
        }
      }
      if (changed) {
        broadcastTyping(roomId);
      }
    }
  }, 2500);

  const socketAliveMap = new WeakMap<WebSocket, boolean>();
  const wsHeartbeatInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (socketAliveMap.get(client) === false) {
        client.terminate();
        continue;
      }
      socketAliveMap.set(client, false);
      try {
        client.ping();
      } catch {
        // Ignore closed socket
      }
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(typingSweepInterval);
    clearInterval(uploadSweepInterval);
    clearInterval(wsHeartbeatInterval);
  });

  const CALL_SIGNAL_TYPES = new Set([
    'call:invite',
    'call:accept',
    'call:reject',
    'call:busy',
    'call:offer',
    'call:answer',
    'call:ice',
    'call:hangup',
    'call:screen_state',
    'call:effect_state',
    'call:reaction',
    'call:hand_raise',
    'call:chat',
    'call:sound_fx',
  ]);

  wss.on('connection', (ws) => {
    socketAliveMap.set(ws, true);
    ws.on('pong', () => {
      socketAliveMap.set(ws, true);
    });

    ws.send(
      JSON.stringify({
        type: 'presence:sync',
        users: Array.from(userPresence.values()),
      })
    );

    ws.on('message', (raw) => {
      socketAliveMap.set(ws, true);
      try {
        const msg = JSON.parse(String(raw));
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          }
          return;
        }

        if (msg.type === 'auth:identify' && typeof msg.uid === 'string' && msg.uid.length > 0) {
          const uid = msg.uid.slice(0, 128);
          const displayName =
            typeof msg.displayName === 'string' ? msg.displayName.slice(0, 60) : 'Member';
          const status =
            msg.status === 'away' || msg.status === 'busy' || msg.status === 'offline'
              ? msg.status
              : 'online';
          const activeRoomId =
            typeof msg.activeRoomId === 'string' ? msg.activeRoomId.slice(0, 128) : null;

          clientMeta.set(ws, { uid, displayName, status, activeRoomId });
          if (!userSockets.has(uid)) userSockets.set(uid, new Set());
          userSockets.get(uid)!.add(ws);

          const entry: PresenceEntry = {
            uid,
            displayName,
            status,
            activeRoomId,
            updatedAt: Date.now(),
          };
          userPresence.set(uid, entry);
          broadcastAll({ type: 'presence:update', user: entry });

          // If reconnecting mid-call, immediately alert peer so WebRTC ICE restart can resume
          const activeCall = activeCallPeers.get(uid);
          if (activeCall) {
            sendToUser(activeCall.peerUid, {
              type: 'call:peer_reconnected',
              callId: activeCall.callId,
              fromUid: uid,
            });
          }
          return;
        }

        const meta = clientMeta.get(ws);
        if (!meta) return;

        if (msg.type === 'presence:set') {
          const nextStatus =
            msg.status === 'away' || msg.status === 'busy' || msg.status === 'offline'
              ? msg.status
              : 'online';
          meta.status = nextStatus;
          if (typeof msg.displayName === 'string') meta.displayName = msg.displayName.slice(0, 60);
          if (typeof msg.activeRoomId === 'string' || msg.activeRoomId === null) {
            meta.activeRoomId = msg.activeRoomId;
          }
          const entry: PresenceEntry = {
            uid: meta.uid,
            displayName: meta.displayName,
            status: meta.status,
            activeRoomId: meta.activeRoomId,
            updatedAt: Date.now(),
          };
          userPresence.set(meta.uid, entry);
          broadcastAll({ type: 'presence:update', user: entry });
          return;
        }

        if (msg.type === 'room:focus') {
          meta.activeRoomId = typeof msg.roomId === 'string' ? msg.roomId.slice(0, 128) : null;
          const entry = userPresence.get(meta.uid);
          if (entry) {
            entry.activeRoomId = meta.activeRoomId;
            entry.updatedAt = Date.now();
          }
          return;
        }

        if (msg.type === 'typing:start' && typeof msg.roomId === 'string') {
          const roomId = msg.roomId.slice(0, 128);
          const activity: LiveActivityKind =
            msg.activity === 'recording_voice' || msg.activity === 'sending_voice'
              ? msg.activity
              : 'typing';
          if (!typingByRoom.has(roomId)) typingByRoom.set(roomId, new Map());
          typingByRoom.get(roomId)!.set(meta.uid, {
            uid: meta.uid,
            displayName: meta.displayName,
            roomId,
            activity,
            expiresAt: Date.now() + 6000,
          });
          broadcastTyping(roomId);
          return;
        }

        if (msg.type === 'typing:stop' && typeof msg.roomId === 'string') {
          const roomId = msg.roomId.slice(0, 128);
          const roomMap = typingByRoom.get(roomId);
          if (roomMap && roomMap.delete(meta.uid)) {
            broadcastTyping(roomId);
          }
          return;
        }

        if (msg.type === 'notify:ping' && typeof msg.recipientId === 'string') {
          const roomId = typeof msg.roomId === 'string' ? msg.roomId.slice(0, 128) : '';
          const title =
            typeof msg.title === 'string' && msg.title.trim()
              ? msg.title.slice(0, 120)
              : 'New notification';
          const body = typeof msg.body === 'string' ? msg.body.slice(0, 200) : '';
          sendToUser(msg.recipientId, {
            type: 'notify:incoming',
            roomId,
            title,
            body,
          });
          // Also push directly to the recipient's mobile phone via Web Push (works when app is minimized/closed)
          void sendWebPushToUser(msg.recipientId, {
            title,
            body: body || 'Open Quadline to read.',
            url: roomId ? `/?room=${encodeURIComponent(roomId)}` : '/',
            roomId,
            tag: roomId ? `room-${roomId}` : 'quadline-message',
            category: 'message',
            urgency: 'high',
          });
          return;
        }

        // WebRTC 1-to-1 Call Signaling Relay
        if (CALL_SIGNAL_TYPES.has(msg.type) && typeof msg.targetUid === 'string') {
          const targetUid = msg.targetUid.slice(0, 128);
          const callId = typeof msg.callId === 'string' ? msg.callId.slice(0, 128) : '';

          if (msg.type === 'call:invite') {
            const callMode = msg.mode === 'video' ? 'video' : 'audio';
            const delivered = sendToUser(targetUid, {
              ...msg,
              fromUid: meta.uid,
              fromName: meta.displayName,
            });
            // Send high-priority mobile phone push alert so backgrounded phones ring/vibrate immediately
            void sendWebPushToUser(targetUid, {
              title: callMode === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call',
              body: `${meta.displayName} is calling you on Quadline`,
              url: '/?tab=calls',
              tab: 'calls',
              tag: `call-${callId || meta.uid}`,
              category: 'call',
              requireInteraction: true,
              vibrate: [400, 200, 400, 200, 400],
              urgency: 'high',
            });
            if (!delivered) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: 'call:offline',
                    callId,
                    targetUid,
                  })
                );
              }
            } else if (callId) {
              activeCallPeers.set(meta.uid, { peerUid: targetUid, callId });
            }
            return;
          }

          if (msg.type === 'call:accept' && callId) {
            activeCallPeers.set(meta.uid, { peerUid: targetUid, callId });
            activeCallPeers.set(targetUid, { peerUid: meta.uid, callId });
          }

          if (msg.type === 'call:hangup' || msg.type === 'call:reject' || msg.type === 'call:busy') {
            const myActive = activeCallPeers.get(meta.uid);
            if (myActive && myActive.callId === callId) {
              activeCallPeers.delete(meta.uid);
            }
            const peerActive = activeCallPeers.get(targetUid);
            if (peerActive && peerActive.callId === callId) {
              activeCallPeers.delete(targetUid);
            }
          }

          sendToUser(targetUid, {
            ...msg,
            fromUid: meta.uid,
            fromName: meta.displayName,
          });
        }
      } catch {
        // Ignore malformed WebSocket frames
      }
    });

    ws.on('close', () => {
      const meta = clientMeta.get(ws);
      clientMeta.delete(ws);
      if (!meta) return;

      const sockets = userSockets.get(meta.uid);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          userSockets.delete(meta.uid);
          const offlineEntry: PresenceEntry = {
            uid: meta.uid,
            displayName: meta.displayName,
            status: 'offline',
            activeRoomId: null,
            updatedAt: Date.now(),
          };
          userPresence.set(meta.uid, offlineEntry);
          broadcastAll({ type: 'presence:update', user: offlineEntry });

          for (const [roomId, roomMap] of typingByRoom.entries()) {
            if (roomMap.delete(meta.uid)) {
              broadcastTyping(roomId);
            }
          }

          const activeCall = activeCallPeers.get(meta.uid);
          if (activeCall) {
            sendToUser(activeCall.peerUid, {
              type: 'call:peer_disconnected',
              callId: activeCall.callId,
              fromUid: meta.uid,
            });
          }
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Quadline server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Quadline server:', err);
  process.exit(1);
});
