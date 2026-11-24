import type { Timestamp } from 'firebase/firestore';
import type { VoiceEffectId } from '../lib/constants';

export type OnlineStatus = 'online' | 'away' | 'busy' | 'offline';
export type RoomCategory = 'club' | 'class' | 'event' | 'topic' | 'direct';
export type RoomVisibility = 'public' | 'private' | 'dm';
export type MemberRole = 'owner' | 'moderator' | 'member';
export type NotificationPref = 'all' | 'mentions' | 'mute';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface Profile {
  uid: string;
  displayName: string;
  handle: string;
  bio: string;
  photoUrl: string;
  majorOrClub: string;
  status: OnlineStatus;
  statusMessage: string;
  discoverable: boolean;
  lastSeenAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UserPrivate {
  uid: string;
  email: string;
  authMethod: 'google' | 'campus_sso' | 'email';
  blockedUserIds: string[];
  mutedRoomIds: string[];
  roomNotificationPrefs: Record<string, NotificationPref>;
  pushEnabled: boolean;
  readReceiptsEnabled?: boolean;
  theme: ThemeMode;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface UserRoomMembership {
  uid: string;
  roomId: string;
  role: MemberRole;
  joinedAt: Timestamp | null;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: RoomCategory;
  visibility: RoomVisibility;
  coverImage: string;
  ownerId: string;
  dmParticipantIds: string[];
  memberCount: number;
  lastMessageText: string;
  lastMessageAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface RoomInvite {
  code: string;
  roomId: string;
  roomName: string;
  createdBy: string;
  active: boolean;
  createdAt: Timestamp | null;
}

export interface RoomMember {
  uid: string;
  roomId: string;
  role: MemberRole;
  displayName: string;
  handle: string;
  photoUrl: string;
  inviteCodeUsed: string;
  lastReadAt: Timestamp | null;
  joinedAt: Timestamp | null;
}

export interface JoinRequest {
  uid: string;
  roomId: string;
  displayName: string;
  handle: string;
  photoUrl: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  domain: string;
}

export interface PollOption {
  id: string;
  label: string;
  voterIds: string[];
}

export interface PollData {
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  closed: boolean;
}

export type MessageKind = 'text' | 'image' | 'file' | 'poll' | 'voice' | 'event' | 'system';

export interface Message {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  kind: MessageKind;
  text: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  mediaName: string;
  mediaMime: string;
  mediaSize: number;
  voiceDurationSec: number;
  voiceEffect?: VoiceEffectId;
  waveform?: number[];
  linkPreview?: LinkPreview;
  poll?: PollData;
  eventId: string;
  replyToId: string;
  replyToAuthor: string;
  replyToSnippet: string;
  threadRootId: string;
  threadReplyCount: number;
  mentionedUids: string[];
  reactions: Record<string, string[]>;
  deliveredTo?: string[];
  readBy: string[];
  pinned: boolean;
  pinnedBy: string;
  edited: boolean;
  deleted: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface RoomEvent {
  id: string;
  roomId: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  coverImage: string;
  creatorId: string;
  creatorName: string;
  rsvpGoing: string[];
  rsvpMaybe: string[];
  reminderMinutes: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ModerationReport {
  id: string;
  roomId: string;
  reporterId: string;
  reporterName: string;
  targetUserId: string;
  targetUserName: string;
  targetMessageId: string;
  targetSnippet: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  resolvedBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type RoomActivityAction =
  | 'room_created'
  | 'member_joined'
  | 'member_removed'
  | 'role_updated'
  | 'message_deleted'
  | 'message_pinned'
  | 'join_approved'
  | 'join_rejected'
  | 'report_resolved'
  | 'invite_created';

export interface RoomActivity {
  id: string;
  roomId: string;
  actorId: string;
  actorName: string;
  action: RoomActivityAction;
  summary: string;
  createdAt: Timestamp | null;
}

export type NotificationType =
  | 'mention'
  | 'reply'
  | 'dm'
  | 'join_request'
  | 'join_approved'
  | 'event_reminder'
  | 'role_change';

export interface NotificationItem {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  roomId: string;
  roomName: string;
  messageId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: Timestamp | null;
}

export interface LivePresenceEntry {
  uid: string;
  displayName: string;
  status: OnlineStatus;
  activeRoomId: string | null;
  updatedAt: number;
}

export type LiveActivityKind = 'typing' | 'recording_voice' | 'sending_voice';

export interface TypingUser {
  uid: string;
  displayName: string;
  activity?: LiveActivityKind;
}

export type RightPanelTab = 'members' | 'events' | 'pinned' | 'search' | 'moderation' | 'thread';

export type CallMode = 'audio' | 'video';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'reconnecting';
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export interface CallPeerInfo {
  uid: string;
  displayName: string;
  photoUrl?: string;
}

export interface CallSignalPayload {
  type: string;
  callId?: string;
  targetUid?: string;
  fromUid?: string;
  fromName?: string;
  fromPhoto?: string;
  mode?: CallMode;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  isSharingScreen?: boolean;
  voiceEffect?: VoiceEffectId;
  reason?: string;
  [key: string]: unknown;
}

