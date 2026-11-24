/**
 * Phase 0 Security Specification Test Suite (Dirty Dozen Adversarial Payloads)
 * Verifies that every attack vector documented in security_spec.md is rejected by firestore.rules.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
  enforcedBy: string;
}

export const dirtyDozenPayloads: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'PII Snooping on userPrivate',
    operation: 'get',
    path: '/userPrivate/victimUid',
    auth: { uid: 'attackerUid', email: 'attacker@campus.edu', email_verified: true },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'userPrivate get requires isOwner(userId) || isAdmin()',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Profile Create',
    operation: 'create',
    path: '/profiles/attackerUid',
    auth: { uid: 'attackerUid', email: 'attacker@campus.edu', email_verified: true },
    payload: {
      uid: 'attackerUid',
      displayName: 'Mallory',
      handle: 'mallory',
      bio: '',
      photoUrl: '',
      majorOrClub: '',
      status: 'online',
      statusMessage: '',
      discoverable: true,
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidProfile enforces keys().hasOnly(...) rejecting isAdmin',
  },
  {
    id: 3,
    name: 'Identity Spoofing on Message Create',
    operation: 'create',
    path: '/rooms/general-quad/messages/msg_spoof_1',
    auth: { uid: 'attackerUid', email: 'attacker@campus.edu', email_verified: true },
    payload: {
      roomId: 'general-quad',
      authorId: 'victimUid',
      authorName: 'Victim',
      kind: 'text',
      text: 'Spoofed message',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'messages create enforces incoming().authorId == request.auth.uid',
  },
  {
    id: 4,
    name: 'Self-Role Escalation to Owner',
    operation: 'create',
    path: '/rooms/robotics-lab/members/attackerUid',
    auth: { uid: 'attackerUid', email: 'attacker@campus.edu', email_verified: true },
    payload: {
      uid: 'attackerUid',
      roomId: 'robotics-lab',
      role: 'owner',
      displayName: 'Mallory',
      handle: 'mallory',
      photoUrl: '',
      inviteCodeUsed: '',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'members create requires room.ownerId == request.auth.uid for role == owner',
  },
  {
    id: 5,
    name: 'Private Room Invite Bypass',
    operation: 'create',
    path: '/rooms/private-council/members/attackerUid',
    auth: { uid: 'attackerUid', email: 'attacker@campus.edu', email_verified: true },
    payload: {
      uid: 'attackerUid',
      roomId: 'private-council',
      role: 'member',
      displayName: 'Mallory',
      handle: 'mallory',
      photoUrl: '',
      inviteCodeUsed: 'FAKE-CODE',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'members create validates /invites/{code} exists, is active, and matches roomId',
  },
  {
    id: 6,
    name: 'ID Poisoning with Oversized/Invalid Document ID',
    operation: 'create',
    path: '/rooms/' + 'x'.repeat(200),
    auth: { uid: 'attackerUid', email: 'attacker@campus.edu', email_verified: true },
    payload: { name: 'Poison' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidId(roomId) caps length at 128 and enforces ^[a-zA-Z0-9_\\-]+$',
  },
  {
    id: 7,
    name: 'Timestamp Forgery on Message Create',
    operation: 'create',
    path: '/rooms/general-quad/messages/msg_backdated',
    auth: { uid: 'attackerUid', email: 'attacker@campus.edu', email_verified: true },
    payload: {
      roomId: 'general-quad',
      authorId: 'attackerUid',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'messages create enforces incoming().createdAt == request.time',
  },
  {
    id: 8,
    name: 'Message Text Edit by Non-Author Member',
    operation: 'update',
    path: '/rooms/general-quad/messages/msg_victim_1',
    auth: { uid: 'otherMemberUid', email: 'other@campus.edu', email_verified: true },
    payload: { text: 'Altered text', edited: true },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'messages edit action requires existing().authorId == request.auth.uid',
  },
  {
    id: 9,
    name: 'Terminal State Re-Opening on Rejected Join Request',
    operation: 'update',
    path: '/rooms/private-council/joinRequests/applicantUid',
    auth: { uid: 'modUid', email: 'mod@campus.edu', email_verified: true },
    payload: { status: 'pending', reviewedBy: 'modUid' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'joinRequests update enforces existing().status == pending and incoming().status in [approved, rejected]',
  },
  {
    id: 10,
    name: 'Value Poisoning Setting Pinned to String',
    operation: 'update',
    path: '/rooms/general-quad/messages/msg_1',
    auth: { uid: 'modUid', email: 'mod@campus.edu', email_verified: true },
    payload: { pinned: 'yes', pinnedBy: 'modUid' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidMessage(incoming(), roomId) wraps entire update block and enforces data.pinned is bool',
  },
  {
    id: 11,
    name: 'Notification List Scraping Across Users',
    operation: 'list',
    path: '/notifications',
    auth: { uid: 'attackerUid', email: 'attacker@campus.edu', email_verified: true },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'notifications allow list enforces resource.data.recipientId == request.auth.uid',
  },
  {
    id: 12,
    name: 'Unverified Email Admin Spoof',
    operation: 'update',
    path: '/rooms/general-quad',
    auth: { uid: 'spoofUid', email: 'himanshu9199205385@gmail.com', email_verified: false },
    payload: { name: 'Hijacked' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isVerified() and isAdmin() both require request.auth.token.email_verified == true',
  },
];
