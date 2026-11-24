import type { CallMode } from '../types/chat';
import type { VoiceEffectId } from './constants';
import type { ThemeId, WallpaperId } from './themes';

export interface SavedUserPreferences {
  themeId: ThemeId;
  darkMode: boolean;
  wallpaperId: WallpaperId;
  updatedAt: number;
}

export interface CallHistoryRecord {
  callId: string;
  uid: string;
  peerUid: string;
  peerName: string;
  peerPhoto: string;
  mode: CallMode;
  direction: 'outgoing' | 'incoming' | 'check';
  status: 'completed' | 'missed' | 'rejected';
  durationSec: number;
  voiceEffect: VoiceEffectId;
  startedAt: number;
  endedAt: number;
}

export interface BackupSummary {
  roomsCount: number;
  messagesCount: number;
  savedAt: number;
}

export interface BackendBootstrapResponse {
  preferences: SavedUserPreferences | null;
  callHistory: CallHistoryRecord[];
  backupSummary: BackupSummary | null;
  storage: {
    engine: string;
    totalSavedUsers: number;
    totalSavedCalls: number;
  };
}

export async function fetchBackendBootstrap(uid: string): Promise<BackendBootstrapResponse | null> {
  try {
    const res = await fetch(`/api/user/${encodeURIComponent(uid)}/bootstrap`);
    if (!res.ok) return null;
    return (await res.json()) as BackendBootstrapResponse;
  } catch {
    return null;
  }
}

export async function saveBackendPreferences(
  uid: string,
  prefs: { themeId: ThemeId; darkMode: boolean; wallpaperId: WallpaperId }
): Promise<SavedUserPreferences | null> {
  try {
    const res = await fetch(`/api/user/${encodeURIComponent(uid)}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { preferences: SavedUserPreferences };
    return body.preferences;
  } catch {
    return null;
  }
}

export async function recordCallHistory(record: CallHistoryRecord): Promise<CallHistoryRecord | null> {
  try {
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { record: CallHistoryRecord };
    return body.record;
  } catch {
    return null;
  }
}

export async function deleteCallHistoryRecord(uid: string, callId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/calls/${encodeURIComponent(callId)}?uid=${encodeURIComponent(uid)}`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function saveWorkspaceSnapshot(payload: {
  uid: string;
  displayName: string;
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
}): Promise<BackupSummary | null> {
  try {
    const res = await fetch('/api/backup/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { backupSummary: BackupSummary };
    return body.backupSummary;
  } catch {
    return null;
  }
}

export function getBackupExportUrl(uid: string): string {
  return `/api/backup/export?uid=${encodeURIComponent(uid)}`;
}

export interface ReelComment {
  id: string;
  uid: string;
  authorName: string;
  authorPhoto: string;
  text: string;
  createdAt: number;
}

export type ReelSceneTheme = 'aurora' | 'sunset' | 'neon_grid' | 'ocean' | 'midnight';

export interface ReelItem {
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
  sceneTheme?: ReelSceneTheme;
  sceneEmoji?: string;
  sceneHeadline?: string;
  tags: string[];
  likedBy: string[];
  comments: ReelComment[];
  views: number;
  createdAt: number;
}

export async function fetchSongs(params?: {
  category?: 'bollywood' | 'hollywood' | 'famous' | 'punjabi' | 'all';
  q?: string;
}): Promise<
  Array<{
    id: string;
    title: string;
    artist: string;
    movieOrAlbum: string;
    category: 'bollywood' | 'hollywood' | 'famous' | 'punjabi';
    previewUrl: string;
    artworkUrl: string;
    durationSec: number;
    externalUrl?: string;
  }>
> {
  try {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.q?.trim()) query.set('q', params.q.trim());
    const res = await fetch(`/api/songs?${query.toString()}`);
    if (!res.ok) return [];
    const body = (await res.json()) as {
      songs?: Array<{
        id: string;
        title: string;
        artist: string;
        movieOrAlbum: string;
        category: 'bollywood' | 'hollywood' | 'famous' | 'punjabi';
        previewUrl: string;
        artworkUrl: string;
        durationSec: number;
        externalUrl?: string;
      }>;
    };
    return Array.isArray(body.songs) ? body.songs : [];
  } catch {
    return [];
  }
}

export async function fetchReels(): Promise<ReelItem[]> {
  try {
    const res = await fetch('/api/reels');
    if (!res.ok) return [];
    const body = (await res.json()) as { reels?: ReelItem[] };
    return Array.isArray(body.reels) ? body.reels : [];
  } catch {
    return [];
  }
}

export async function createReel(payload: {
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
  sceneTheme?: ReelSceneTheme;
  sceneEmoji?: string;
  sceneHeadline?: string;
  tags: string[];
}): Promise<ReelItem | null> {
  try {
    const res = await fetch('/api/reels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { reel?: ReelItem };
    return body.reel || null;
  } catch {
    return null;
  }
}

export async function toggleReelLike(reelId: string, uid: string): Promise<ReelItem | null> {
  try {
    const res = await fetch(`/api/reels/${encodeURIComponent(reelId)}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { reel?: ReelItem };
    return body.reel || null;
  } catch {
    return null;
  }
}

export async function addReelComment(
  reelId: string,
  payload: { uid: string; authorName: string; authorPhoto: string; text: string }
): Promise<ReelItem | null> {
  try {
    const res = await fetch(`/api/reels/${encodeURIComponent(reelId)}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { reel?: ReelItem };
    return body.reel || null;
  } catch {
    return null;
  }
}

export async function deleteReel(reelId: string, uid: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/reels/${encodeURIComponent(reelId)}?uid=${encodeURIComponent(uid)}`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export interface SpotifyLinkedUser {
  id: string;
  displayName: string;
  avatarUrl: string;
  product: string;
  profileUrl: string;
  connectedAt?: number;
}

export interface SpotifyConnectionStatus {
  configured: boolean;
  connected: boolean;
  redirectUri: string;
  scopes: string[];
  user: SpotifyLinkedUser | null;
}

export type SpotifyLibrarySection = 'liked' | 'top' | 'recent' | 'search';

export interface SpotifyTrackItem {
  id: string;
  title: string;
  artist: string;
  movieOrAlbum: string;
  category: 'spotify';
  previewUrl: string;
  artworkUrl: string;
  durationSec: number;
  externalUrl?: string;
  source: 'spotify';
  spotifyTrackId: string;
  spotifyUrl: string;
}

export async function fetchSpotifyStatus(uid: string): Promise<SpotifyConnectionStatus> {
  try {
    const res = await fetch(`/api/spotify/status?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) {
      return {
        configured: false,
        connected: false,
        redirectUri: `${window.location.origin}/auth/spotify/callback`,
        scopes: [],
        user: null,
      };
    }
    return (await res.json()) as SpotifyConnectionStatus;
  } catch {
    return {
      configured: false,
      connected: false,
      redirectUri: `${window.location.origin}/auth/spotify/callback`,
      scopes: [],
      user: null,
    };
  }
}

export async function fetchSpotifyAuthUrl(uid: string): Promise<{
  url?: string;
  redirectUri?: string;
  error?: string;
  needsSetup?: boolean;
}> {
  try {
    const res = await fetch(`/api/spotify/auth-url?uid=${encodeURIComponent(uid)}`);
    const body = (await res.json()) as {
      url?: string;
      redirectUri?: string;
      error?: string;
      needsSetup?: boolean;
    };
    return body;
  } catch {
    return { error: 'Could not reach server to start Spotify authorization.' };
  }
}

export async function disconnectSpotify(uid: string): Promise<boolean> {
  try {
    const res = await fetch('/api/spotify/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchSpotifyTracks(
  uid: string,
  params: { section?: SpotifyLibrarySection; q?: string }
): Promise<{ songs: SpotifyTrackItem[]; error?: string; needsReconnect?: boolean }> {
  try {
    const query = new URLSearchParams({ uid });
    if (params.section) query.set('section', params.section);
    if (params.q?.trim()) query.set('q', params.q.trim());
    const res = await fetch(`/api/spotify/tracks?${query.toString()}`);
    const body = (await res.json()) as {
      songs?: SpotifyTrackItem[];
      error?: string;
      needsReconnect?: boolean;
    };
    return {
      songs: Array.isArray(body.songs) ? body.songs : [],
      error: body.error,
      needsReconnect: body.needsReconnect,
    };
  } catch {
    return { songs: [], error: 'Failed to load Spotify tracks.' };
  }
}

export async function resolveSpotifyTrackUrl(
  url: string
): Promise<{ song?: SpotifyTrackItem; error?: string }> {
  try {
    const res = await fetch(`/api/spotify/resolve-url?url=${encodeURIComponent(url.trim())}`);
    const body = (await res.json()) as { song?: SpotifyTrackItem; error?: string };
    return body;
  } catch {
    return { error: 'Could not load Spotify song link.' };
  }
}

export interface SocialRelation {
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

export interface SocialGraph {
  friends: SocialRelation[];
  incomingRequests: SocialRelation[];
  outgoingRequests: SocialRelation[];
}

export async function fetchSocialGraph(uid: string): Promise<SocialGraph> {
  try {
    const res = await fetch(`/api/social?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) return { friends: [], incomingRequests: [], outgoingRequests: [] };
    const body = (await res.json()) as Partial<SocialGraph>;
    return {
      friends: Array.isArray(body.friends) ? body.friends : [],
      incomingRequests: Array.isArray(body.incomingRequests) ? body.incomingRequests : [],
      outgoingRequests: Array.isArray(body.outgoingRequests) ? body.outgoingRequests : [],
    };
  } catch {
    return { friends: [], incomingRequests: [], outgoingRequests: [] };
  }
}

export async function sendFriendRequest(payload: {
  fromUid: string;
  fromName: string;
  fromHandle: string;
  fromPhoto: string;
  toUid: string;
  toName: string;
  toHandle: string;
  toPhoto: string;
}): Promise<{ relation?: SocialRelation; autoAccepted?: boolean; graph?: SocialGraph; error?: string }> {
  try {
    const res = await fetch('/api/social/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as {
      relation?: SocialRelation;
      autoAccepted?: boolean;
      graph?: SocialGraph;
      error?: string;
    };
    return body;
  } catch {
    return { error: 'Could not send friend request right now.' };
  }
}

export async function respondFriendRequest(payload: {
  uid: string;
  otherUid: string;
  action: 'accept' | 'decline';
  actorName: string;
}): Promise<{ ok?: boolean; graph?: SocialGraph; error?: string }> {
  try {
    const res = await fetch('/api/social/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as { ok?: boolean; graph?: SocialGraph; error?: string };
    return body;
  } catch {
    return { error: 'Could not update friend request.' };
  }
}

export async function removeFriendRelation(payload: {
  uid: string;
  otherUid: string;
}): Promise<{ ok?: boolean; graph?: SocialGraph; error?: string }> {
  try {
    const res = await fetch('/api/social/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as { ok?: boolean; graph?: SocialGraph; error?: string };
    return body;
  } catch {
    return { error: 'Could not update connection.' };
  }
}

/* =========================================================
 * ACCOUNTS, USERNAME LOOKUP & ADMIN-ONLY REGISTRY
 * ========================================================= */

export interface AccountPublicProfile {
  uid: string;
  displayName: string;
  handle: string;
  bio: string;
  photoUrl: string;
}

export interface AdminAccountRecord extends AccountPublicProfile {
  email: string;
  authMethod: string;
  createdAt: number;
  lastLoginAt: number;
}

export async function registerAccountProfile(payload: {
  uid: string;
  email: string;
  displayName: string;
  handle: string;
  bio: string;
  photoUrl: string;
  authMethod?: string;
}): Promise<{ ok: boolean; isAdmin: boolean }> {
  try {
    const res = await fetch('/api/accounts/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, isAdmin: false };
    const body = (await res.json()) as { ok?: boolean; isAdmin?: boolean };
    return { ok: Boolean(body.ok), isAdmin: Boolean(body.isAdmin) };
  } catch {
    return { ok: false, isAdmin: false };
  }
}

export async function checkUsernameAvailability(
  handle: string,
  excludeUid?: string
): Promise<{ available: boolean; normalized: string; reason?: string }> {
  try {
    const params = new URLSearchParams({ handle });
    if (excludeUid) params.set('excludeUid', excludeUid);
    const res = await fetch(`/api/accounts/check-username?${params.toString()}`);
    if (!res.ok) return { available: true, normalized: handle.trim().toLowerCase() };
    return (await res.json()) as { available: boolean; normalized: string; reason?: string };
  } catch {
    return { available: true, normalized: handle.trim().toLowerCase() };
  }
}

export async function searchAccountsByUsername(
  q: string,
  excludeUid?: string
): Promise<AccountPublicProfile[]> {
  const cleaned = q.trim().replace(/^@/, '');
  if (cleaned.length < 2) return [];
  try {
    const params = new URLSearchParams({ q: cleaned });
    if (excludeUid) params.set('excludeUid', excludeUid);
    const res = await fetch(`/api/accounts/search?${params.toString()}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { accounts?: AccountPublicProfile[] };
    return Array.isArray(body.accounts) ? body.accounts : [];
  } catch {
    return [];
  }
}

export async function fetchAdminStatus(email: string): Promise<boolean> {
  if (!email.trim()) return false;
  try {
    const res = await fetch(`/api/admin/status?email=${encodeURIComponent(email.trim())}`);
    if (!res.ok) return false;
    const body = (await res.json()) as { isAdmin?: boolean };
    return Boolean(body.isAdmin);
  } catch {
    return false;
  }
}

export async function fetchAdminAccounts(email: string): Promise<{
  totalCount: number;
  todayCount: number;
  accounts: AdminAccountRecord[];
  error?: string;
}> {
  try {
    const res = await fetch(`/api/admin/accounts?email=${encodeURIComponent(email.trim())}`);
    const body = (await res.json()) as {
      totalCount?: number;
      todayCount?: number;
      accounts?: AdminAccountRecord[];
      error?: string;
    };
    if (!res.ok) {
      return {
        totalCount: 0,
        todayCount: 0,
        accounts: [],
        error: body.error || 'Admin access required.',
      };
    }
    return {
      totalCount: Number(body.totalCount) || 0,
      todayCount: Number(body.todayCount) || 0,
      accounts: Array.isArray(body.accounts) ? body.accounts : [],
    };
  } catch {
    return { totalCount: 0, todayCount: 0, accounts: [], error: 'Unable to load admin directory.' };
  }
}

/* =========================================================
 * MUTUAL-FOLLOW 24-HOUR STORIES API
 * ========================================================= */

export interface StoryViewer {
  uid: string;
  displayName: string;
  handle: string;
  photoUrl: string;
  viewedAt: number;
}

export interface StoryItem {
  id: string;
  authorUid: string;
  authorName: string;
  authorHandle: string;
  authorPhoto: string;
  mediaType: 'image' | 'video' | 'text';
  mediaUrl: string;
  caption: string;
  backgroundTheme: string;
  viewers: StoryViewer[];
  createdAt: number;
  expiresAt: number;
}

export async function fetchMutualStories(uid: string): Promise<StoryItem[]> {
  try {
    const res = await fetch(`/api/stories?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { stories?: StoryItem[] };
    return Array.isArray(body.stories) ? body.stories : [];
  } catch {
    return [];
  }
}

export async function createStory(payload: {
  authorUid: string;
  authorName: string;
  authorHandle: string;
  authorPhoto: string;
  mediaType: 'image' | 'video' | 'text';
  mediaUrl?: string;
  caption?: string;
  backgroundTheme?: string;
}): Promise<{ story?: StoryItem; error?: string }> {
  try {
    const res = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as { story?: StoryItem; error?: string };
    return body;
  } catch {
    return { error: 'Could not publish story right now.' };
  }
}

export async function markStoryViewed(
  storyId: string,
  viewer: { uid: string; displayName: string; handle: string; photoUrl: string }
): Promise<StoryViewer[] | null> {
  try {
    const res = await fetch(`/api/stories/${encodeURIComponent(storyId)}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(viewer),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { viewers?: StoryViewer[] };
    return Array.isArray(body.viewers) ? body.viewers : null;
  } catch {
    return null;
  }
}

export async function deleteStory(storyId: string, uid: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/stories/${encodeURIComponent(storyId)}?uid=${encodeURIComponent(uid)}`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/* =========================================================
 * DEDICATED FOLLOW / FOLLOWERS API (SEPARATE FROM CHAT REQUESTS)
 * ========================================================= */

export interface FollowUserSummary {
  uid: string;
  displayName: string;
  handle: string;
  photoUrl: string;
  bio: string;
  followedAt: number;
}

export interface ProfileFollowData {
  targetUid: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  followsYou: boolean;
  isMutualFollow: boolean;
  followers: FollowUserSummary[];
  following: FollowUserSummary[];
}

export async function fetchProfileFollowData(
  targetUid: string,
  viewerUid: string
): Promise<ProfileFollowData> {
  try {
    const params = new URLSearchParams({ targetUid, viewerUid });
    const res = await fetch(`/api/follows/profile?${params.toString()}`);
    if (!res.ok) {
      return {
        targetUid,
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
        followsYou: false,
        isMutualFollow: false,
        followers: [],
        following: [],
      };
    }
    const body = (await res.json()) as Partial<ProfileFollowData>;
    return {
      targetUid,
      followersCount: Number(body.followersCount || 0),
      followingCount: Number(body.followingCount || 0),
      isFollowing: Boolean(body.isFollowing),
      followsYou: Boolean(body.followsYou),
      isMutualFollow: Boolean(body.isMutualFollow),
      followers: Array.isArray(body.followers) ? body.followers : [],
      following: Array.isArray(body.following) ? body.following : [],
    };
  } catch {
    return {
      targetUid,
      followersCount: 0,
      followingCount: 0,
      isFollowing: false,
      followsYou: false,
      isMutualFollow: false,
      followers: [],
      following: [],
    };
  }
}

export async function fetchMyFollows(uid: string): Promise<{
  followers: FollowUserSummary[];
  following: FollowUserSummary[];
  followersCount: number;
  followingCount: number;
}> {
  try {
    const res = await fetch(`/api/follows/me?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) {
      return { followers: [], following: [], followersCount: 0, followingCount: 0 };
    }
    const body = (await res.json()) as {
      followers?: FollowUserSummary[];
      following?: FollowUserSummary[];
      followersCount?: number;
      followingCount?: number;
    };
    return {
      followers: Array.isArray(body.followers) ? body.followers : [],
      following: Array.isArray(body.following) ? body.following : [],
      followersCount: Number(body.followersCount || 0),
      followingCount: Number(body.followingCount || 0),
    };
  } catch {
    return { followers: [], following: [], followersCount: 0, followingCount: 0 };
  }
}

export async function toggleFollowUser(payload: {
  followerUid: string;
  followerName: string;
  followerHandle: string;
  followerPhoto: string;
  targetUid: string;
  targetName: string;
  targetHandle: string;
  targetPhoto: string;
  action?: 'follow' | 'unfollow';
}): Promise<{ ok: boolean; isFollowing: boolean; profileData?: ProfileFollowData; error?: string }> {
  try {
    const res = await fetch('/api/follows/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as {
      ok?: boolean;
      isFollowing?: boolean;
      profileData?: ProfileFollowData;
      error?: string;
    };
    return {
      ok: Boolean(body.ok),
      isFollowing: Boolean(body.isFollowing),
      profileData: body.profileData,
      error: body.error,
    };
  } catch {
    return { ok: false, isFollowing: false, error: 'Could not update follow status right now.' };
  }
}

/* =========================================================
 * IN-APP SOCIAL NOTIFICATIONS & PER-CHAT INSTAGRAM THEMES
 * ========================================================= */

export interface SocialAppNotification {
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

export interface RoomChatThemeRecord {
  roomId: string;
  chatThemeId: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: number;
}

export async function fetchSocialNotifications(uid: string): Promise<SocialAppNotification[]> {
  if (!uid) return [];
  try {
    const res = await fetch(`/api/notifications/social?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { notifications?: SocialAppNotification[] };
    return Array.isArray(body.notifications) ? body.notifications : [];
  } catch {
    return [];
  }
}

export async function markSocialNotificationsRead(
  uid: string,
  opts: { id?: string; markAll?: boolean }
): Promise<boolean> {
  if (!uid) return false;
  try {
    const res = await fetch('/api/notifications/social/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, ...opts }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchRoomThemes(): Promise<Record<string, RoomChatThemeRecord>> {
  try {
    const res = await fetch('/api/rooms/themes');
    if (!res.ok) return {};
    const body = (await res.json()) as { themes?: Record<string, RoomChatThemeRecord> };
    return body.themes && typeof body.themes === 'object' ? body.themes : {};
  } catch {
    return {};
  }
}

export async function saveRoomChatTheme(payload: {
  roomId: string;
  chatThemeId: string;
  updatedBy: string;
  updatedByName: string;
}): Promise<RoomChatThemeRecord | null> {
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(payload.roomId)}/theme`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatThemeId: payload.chatThemeId,
        updatedBy: payload.updatedBy,
        updatedByName: payload.updatedByName,
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { theme?: RoomChatThemeRecord };
    return body.theme || null;
  } catch {
    return null;
  }
}

/* =========================================================
 * CUSTOM USER-CREATED STICKERS & GIFS
 * ========================================================= */

export interface CustomStudioMedia {
  id: string;
  uid: string;
  kind: 'sticker' | 'gif';
  label: string;
  dataUrl: string;
  createdAt: number;
}

export async function fetchCustomStudioMedia(uid: string): Promise<CustomStudioMedia[]> {
  if (!uid) return [];
  try {
    const res = await fetch(`/api/custom-media?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: CustomStudioMedia[] };
    return Array.isArray(body.items) ? body.items : [];
  } catch {
    return [];
  }
}

export async function saveCustomStudioMedia(payload: {
  uid: string;
  kind: 'sticker' | 'gif';
  label: string;
  dataUrl: string;
}): Promise<{ ok: boolean; item?: CustomStudioMedia; error?: string }> {
  try {
    const res = await fetch('/api/custom-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as { ok?: boolean; item?: CustomStudioMedia; error?: string };
    return {
      ok: res.ok && Boolean(body.ok),
      item: body.item,
      error: body.error,
    };
  } catch {
    return { ok: false, error: 'Could not save custom sticker or GIF right now.' };
  }
}

export async function deleteCustomStudioMedia(uid: string, id: string): Promise<boolean> {
  if (!uid || !id) return false;
  try {
    const res = await fetch(
      `/api/custom-media/${encodeURIComponent(id)}?uid=${encodeURIComponent(uid)}`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/* =========================================================
 * STANDALONE /ADMIN PORTAL API
 * ========================================================= */

export interface AdminOverviewAccount {
  uid: string;
  email: string;
  displayName: string;
  handle: string;
  bio: string;
  photoUrl: string;
  authMethod: string;
  createdAt: number;
  lastLoginAt: number;
  followersCount: number;
  followingCount: number;
}

export interface AdminOverviewStory {
  id: string;
  authorUid: string;
  authorName: string;
  authorHandle: string;
  caption: string;
  mediaType: 'image' | 'text';
  viewerUids: string[];
  createdAt: number;
  expiresAt: number;
}

export interface AdminOverviewReel {
  id: string;
  authorUid: string;
  authorName: string;
  authorHandle: string;
  caption: string;
  mediaType: string;
  likesCount: number;
  commentsCount: number;
  views: number;
  createdAt: number;
}

export interface AdminOverviewResponse {
  stats: {
    totalAccounts: number;
    todayAccounts: number;
    onlineUsersCount: number;
    activeStoriesCount: number;
    reelsCount: number;
    savedCallsCount: number;
    pushDevicesCount: number;
    roomThemesCount: number;
    customMediaCount: number;
    followsCount: number;
    friendshipsCount: number;
    pendingRequestsCount: number;
  };
  accounts: AdminOverviewAccount[];
  stories: AdminOverviewStory[];
  reels: AdminOverviewReel[];
  roomThemes: RoomChatThemeRecord[];
  recentCalls: CallHistoryRecord[];
  storageEngine: string;
}

export async function fetchAdminOverview(email: string): Promise<{
  ok: boolean;
  status: number;
  data?: AdminOverviewResponse;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/admin/overview?email=${encodeURIComponent(email.trim())}`);
    const body = (await res.json()) as AdminOverviewResponse & { error?: string };
    if (!res.ok) {
      return { ok: false, status: res.status, error: body.error || 'Admin access required.' };
    }
    return { ok: true, status: res.status, data: body };
  } catch {
    return { ok: false, status: 0, error: 'Could not reach admin server.' };
  }
}

export async function adminDeleteAccount(email: string, uid: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/admin/accounts/${encodeURIComponent(uid)}?email=${encodeURIComponent(email.trim())}`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminDeleteStory(email: string, storyId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/admin/stories/${encodeURIComponent(storyId)}?email=${encodeURIComponent(email.trim())}`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminDeleteReel(email: string, reelId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/admin/reels/${encodeURIComponent(reelId)}?email=${encodeURIComponent(email.trim())}`,
      { method: 'DELETE' }
    );
    return res.ok;
  } catch {
    return false;
  }
}
