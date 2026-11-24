import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { isEncryptedPayload } from './chatPrivacy';
import {
  getCleanLastMessagePreview,
  REEL_MESSAGE_MIME,
  SONG_MESSAGE_MIME,
} from './songsAndReels';
import {
  MAX_FILE_SIZE_BYTES,
  VOICE_NOTE_MAX_SEC,
  type VoiceEffectId,
} from './constants';
import {
  CAMPUS_IMAGES,
  extractFirstUrl,
  generateId,
  generateInviteCode,
  LIMITS,
  makeDmRoomId,
  sanitizeHandle,
  slugifyRoomName,
} from './validation';
import type {
  JoinRequest,
  LinkPreview,
  MemberRole,
  Message,
  MessageKind,
  NotificationPref,
  NotificationType,
  OnlineStatus,
  PollData,
  Profile,
  Room,
  RoomActivityAction,
  RoomCategory,
  RoomEvent,
  RoomInvite,
  RoomVisibility,
  ThemeMode,
  UserPrivate,
} from '../types/chat';

export async function fetchLinkPreview(url: string): Promise<LinkPreview | undefined> {
  try {
    const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
    if (!res.ok) return undefined;
    const data = (await res.json()) as Partial<LinkPreview>;
    if (!data.url || !data.domain) return undefined;
    return {
      url: String(data.url).slice(0, 400),
      title: String(data.title || data.domain).slice(0, 140),
      description: String(data.description || '').slice(0, 220),
      domain: String(data.domain).slice(0, 100),
    };
  } catch {
    return undefined;
  }
}

export async function ensureUserProfileAndPrivate(
  user: User,
  authMethod: 'google' | 'campus_sso' | 'email' = 'google',
  initialProfile?: {
    displayName?: string;
    handle?: string;
    bio?: string;
    photoUrl?: string;
  }
): Promise<{ profile: Profile; userPrivate: UserPrivate; isNewProfile: boolean }> {
  const profileRef = doc(db, 'profiles', user.uid);
  const privateRef = doc(db, 'userPrivate', user.uid);

  let profileSnap;
  try {
    profileSnap = await getDoc(profileRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `profiles/${user.uid}`);
  }

  const displayName = (
    initialProfile?.displayName?.trim() ||
    user.displayName ||
    user.email?.split('@')[0] ||
    'Campus Member'
  ).slice(0, LIMITS.DISPLAY_NAME_MAX);
  const baseHandle = sanitizeHandle(
    initialProfile?.handle?.trim() ||
      (user.email?.split('@')[0] || displayName).replace(/\s+/g, '.'),
    user.uid
  );
  const bio = (
    initialProfile?.bio !== undefined
      ? initialProfile.bio.trim()
      : ''
  ).slice(0, LIMITS.BIO_MAX);
  const photoUrl = (
    initialProfile?.photoUrl !== undefined ? initialProfile.photoUrl : user.photoURL || ''
  ).slice(0, LIMITS.PHOTO_URL_MAX);

  const isNewProfile = !profileSnap.exists();

  if (isNewProfile) {
    const newProfile = {
      uid: user.uid,
      displayName,
      handle: baseHandle,
      bio,
      photoUrl,
      majorOrClub: '',
      status: 'online' as OnlineStatus,
      statusMessage: '',
      discoverable: true,
      lastSeenAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(profileRef, newProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `profiles/${user.uid}`);
    }
  } else {
    try {
      await updateDoc(profileRef, {
        status: 'online',
        lastSeenAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `profiles/${user.uid}`);
    }
  }

  let privateSnap;
  try {
    privateSnap = await getDoc(privateRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `userPrivate/${user.uid}`);
  }

  if (!privateSnap.exists()) {
    const newPrivate = {
      uid: user.uid,
      email: (user.email || `${user.uid}@campus.edu`).slice(0, 254),
      authMethod,
      blockedUserIds: [] as string[],
      mutedRoomIds: [] as string[],
      roomNotificationPrefs: {} as Record<string, NotificationPref>,
      pushEnabled: false,
      readReceiptsEnabled: true,
      theme: 'light' as ThemeMode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(privateRef, newPrivate);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `userPrivate/${user.uid}`);
    }
  }

  const [freshProfile, freshPrivate] = await Promise.all([
    getDoc(profileRef).catch((e) => handleFirestoreError(e, OperationType.GET, `profiles/${user.uid}`)),
    getDoc(privateRef).catch((e) => handleFirestoreError(e, OperationType.GET, `userPrivate/${user.uid}`)),
  ]);

  return {
    profile: freshProfile.data() as Profile,
    userPrivate: freshPrivate.data() as UserPrivate,
    isNewProfile,
  };
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<Profile, 'displayName' | 'handle' | 'bio' | 'photoUrl' | 'majorOrClub' | 'status' | 'statusMessage'>>
): Promise<void> {
  const payload: Record<string, unknown> = {
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (updates.displayName !== undefined) {
    payload.displayName = updates.displayName.trim().slice(0, LIMITS.DISPLAY_NAME_MAX) || 'Member';
  }
  if (updates.handle !== undefined) {
    payload.handle = sanitizeHandle(updates.handle, uid);
  }
  if (updates.bio !== undefined) {
    payload.bio = updates.bio.trim().slice(0, LIMITS.BIO_MAX);
  }
  if (updates.photoUrl !== undefined) {
    payload.photoUrl = updates.photoUrl.slice(0, LIMITS.PHOTO_URL_MAX);
  }
  if (updates.majorOrClub !== undefined) {
    payload.majorOrClub = updates.majorOrClub.trim().slice(0, LIMITS.MAJOR_MAX);
  }
  if (updates.status !== undefined) {
    payload.status = updates.status;
  }
  if (updates.statusMessage !== undefined) {
    payload.statusMessage = updates.statusMessage.trim().slice(0, LIMITS.STATUS_MSG_MAX);
  }

  try {
    await updateDoc(doc(db, 'profiles', uid), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `profiles/${uid}`);
  }
}

export async function updateUserPrivateSettings(
  uid: string,
  updates: Partial<
    Pick<
      UserPrivate,
      | 'blockedUserIds'
      | 'mutedRoomIds'
      | 'roomNotificationPrefs'
      | 'pushEnabled'
      | 'readReceiptsEnabled'
      | 'theme'
    >
  >
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.blockedUserIds !== undefined) {
    payload.blockedUserIds = updates.blockedUserIds.slice(0, 100);
  }
  if (updates.mutedRoomIds !== undefined) {
    payload.mutedRoomIds = updates.mutedRoomIds.slice(0, 200);
  }
  if (updates.roomNotificationPrefs !== undefined) {
    payload.roomNotificationPrefs = updates.roomNotificationPrefs;
  }
  if (updates.pushEnabled !== undefined) {
    payload.pushEnabled = updates.pushEnabled;
  }
  if (updates.readReceiptsEnabled !== undefined) {
    payload.readReceiptsEnabled = Boolean(updates.readReceiptsEnabled);
  }
  if (updates.theme !== undefined) {
    payload.theme = updates.theme;
  }

  try {
    await updateDoc(doc(db, 'userPrivate', uid), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `userPrivate/${uid}`);
  }
}

export async function createRoom(params: {
  name: string;
  description: string;
  category: RoomCategory;
  visibility: 'public' | 'private';
  coverImage?: string;
  creator: Profile;
}): Promise<string> {
  const slug = slugifyRoomName(params.name);
  const roomId = `${slug.slice(0, 32)}_${generateId('rm').slice(3, 11)}`;
  const batch = writeBatch(db);

  const roomRef = doc(db, 'rooms', roomId);
  const memberRef = doc(db, 'rooms', roomId, 'members', params.creator.uid);
  const userMembershipRef = doc(db, 'userMemberships', params.creator.uid, 'rooms', roomId);
  const activityRef = doc(db, 'rooms', roomId, 'activity', generateId('act'));

  batch.set(roomRef, {
    id: roomId,
    name: params.name.trim().slice(0, LIMITS.ROOM_NAME_MAX),
    slug,
    description: params.description.trim().slice(0, LIMITS.ROOM_DESC_MAX),
    category: params.category,
    visibility: params.visibility,
    coverImage: (params.coverImage || '').slice(0, 500),
    ownerId: params.creator.uid,
    dmParticipantIds: [],
    memberCount: 1,
    lastMessageText: 'Room created',
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(memberRef, {
    uid: params.creator.uid,
    roomId,
    role: 'owner' as MemberRole,
    displayName: params.creator.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    handle: params.creator.handle.slice(0, LIMITS.HANDLE_MAX),
    photoUrl: params.creator.photoUrl.slice(0, LIMITS.PHOTO_URL_MAX),
    inviteCodeUsed: '',
    lastReadAt: serverTimestamp(),
    joinedAt: serverTimestamp(),
  });

  batch.set(userMembershipRef, {
    uid: params.creator.uid,
    roomId,
    role: 'owner' as MemberRole,
    joinedAt: serverTimestamp(),
  });

  batch.set(activityRef, {
    roomId,
    actorId: params.creator.uid,
    actorName: params.creator.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    action: 'room_created' as RoomActivityAction,
    summary: `Created ${params.visibility} ${params.category} room "${params.name.trim().slice(0, 60)}"`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return roomId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${roomId}`);
  }
}

export async function bootstrapStarterRoomsIfEmpty(creator: Profile): Promise<string | null> {
  const roomsQuery = query(collection(db, 'rooms'), where('visibility', 'in', ['public', 'private']), limit(1));
  let existingRooms;
  try {
    existingRooms = await getDocs(roomsQuery);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'rooms');
  }

  if (!existingRooms.empty) {
    return existingRooms.docs[0].id;
  }

  const starterDefs: Array<{
    name: string;
    description: string;
    category: RoomCategory;
    visibility: 'public' | 'private';
    coverImage: string;
    welcomeText: string;
  }> = [
    {
      name: 'General Quad',
      description: 'Campus-wide lounge for introductions, announcements, and finding study partners.',
      category: 'topic',
      visibility: 'public',
      coverImage: CAMPUS_IMAGES.welcomeQuad,
      welcomeText:
        'Welcome to General Quad! Drop a quick hello, share what club or class you are in this semester, or browse rooms in Discover.',
    },
    {
      name: 'Robotics & Makers Lab',
      description: 'Weekly rover build nights, PCB reviews, 3D printer queue, and competition prep.',
      category: 'club',
      visibility: 'public',
      coverImage: CAMPUS_IMAGES.roboticsLab,
      welcomeText:
        'Makerspace benches are open M-F 2 PM–9 PM. Share build photos, pin parts lists, or vote on this week’s build night focus below.',
    },
    {
      name: 'Library Study Commons',
      description: 'Quiet study check-ins, CS & engineering problem set threads, and coffee runs.',
      category: 'class',
      visibility: 'public',
      coverImage: CAMPUS_IMAGES.studyLounge,
      welcomeText:
        'Use threads to keep problem set solutions organized without flooding the main feed.',
    },
    {
      name: 'Fall Showcase Crew',
      description: 'Private coordination room for student union showcase volunteers & acoustic night organizers.',
      category: 'event',
      visibility: 'private',
      coverImage: CAMPUS_IMAGES.amphitheaterEvent,
      welcomeText:
        'Welcome to the Fall Showcase Crew private room. Share an invite code or review join requests from the Moderation panel.',
    },
  ];

  let firstRoomId: string | null = null;

  for (let i = 0; i < starterDefs.length; i++) {
    const def = starterDefs[i];
    const roomId = await createRoom({
      name: def.name,
      description: def.description,
      category: def.category,
      visibility: def.visibility,
      coverImage: def.coverImage,
      creator,
    });
    if (i === 0) firstRoomId = roomId;

    await sendMessage({
      roomId,
      roomName: def.name,
      author: creator,
      kind: 'text',
      text: def.welcomeText,
    });

    if (i === 0) {
      // Starter poll in General Quad
      await sendMessage({
        roomId,
        roomName: def.name,
        author: creator,
        kind: 'poll',
        text: 'Quick campus poll',
        poll: {
          question: 'Where should we host Friday’s open club coffee mixer?',
          options: [
            { id: 'opt_1', label: 'Student Union Courtyard Steps', voterIds: [creator.uid] },
            { id: 'opt_2', label: 'Library 2nd Floor Commons', voterIds: [] },
            { id: 'opt_3', label: 'Engineering Makerspace Atrium', voterIds: [] },
          ],
          allowMultiple: false,
          closed: false,
        },
      });

      // Starter campus event in General Quad
      const eventDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      eventDate.setHours(18, 30, 0, 0);
      await createRoomEvent({
        roomId,
        roomName: def.name,
        creator,
        title: 'Fall Student Club Showcase & Acoustic Night',
        description:
          'Meet 25+ campus clubs, grab warm cider, and catch live acoustic sets at the stone amphitheater.',
        location: 'Campus Stone Amphitheater',
        startAt: eventDate.toISOString().slice(0, 16),
        endAt: '',
        coverImage: CAMPUS_IMAGES.amphitheaterEvent,
        reminderMinutes: 30,
      });
    }
  }

  return firstRoomId;
}

export async function joinPublicRoom(room: Room, profile: Profile): Promise<void> {
  const memberRef = doc(db, 'rooms', room.id, 'members', profile.uid);
  const existingMember = await getDoc(memberRef).catch((e) =>
    handleFirestoreError(e, OperationType.GET, `rooms/${room.id}/members/${profile.uid}`)
  );

  if (existingMember.exists()) {
    // Ensure userMemberships index exists
    await setDoc(doc(db, 'userMemberships', profile.uid, 'rooms', room.id), {
      uid: profile.uid,
      roomId: room.id,
      role: (existingMember.data().role as MemberRole) || 'member',
      joinedAt: serverTimestamp(),
    }).catch((e) => handleFirestoreError(e, OperationType.WRITE, `userMemberships/${profile.uid}/rooms/${room.id}`));
    return;
  }

  const batch = writeBatch(db);
  batch.set(memberRef, {
    uid: profile.uid,
    roomId: room.id,
    role: 'member' as MemberRole,
    displayName: profile.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    handle: profile.handle.slice(0, LIMITS.HANDLE_MAX),
    photoUrl: profile.photoUrl.slice(0, LIMITS.PHOTO_URL_MAX),
    inviteCodeUsed: '',
    lastReadAt: serverTimestamp(),
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'userMemberships', profile.uid, 'rooms', room.id), {
    uid: profile.uid,
    roomId: room.id,
    role: 'member' as MemberRole,
    joinedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'rooms', room.id), {
    memberCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'rooms', room.id, 'activity', generateId('act')), {
    roomId: room.id,
    actorId: profile.uid,
    actorName: profile.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    action: 'member_joined' as RoomActivityAction,
    summary: `${profile.displayName} joined #${room.slug}`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${room.id}/members/${profile.uid}`);
  }
}

export async function joinRoomById(
  rawRoomId: string,
  profile: Profile
): Promise<{ room: Room; outcome: 'joined' | 'already_member' | 'requested' }> {
  const roomId = rawRoomId.trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(roomId)) {
    throw new Error('This group link format looks invalid.');
  }

  let roomSnap;
  try {
    roomSnap = await getDoc(doc(db, 'rooms', roomId));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `rooms/${roomId}`);
  }

  if (!roomSnap.exists()) {
    throw new Error('This group link is invalid or the group no longer exists.');
  }

  const room = roomSnap.data() as Room;
  if (room.visibility === 'dm') {
    throw new Error('Direct message chats cannot be joined with a group link.');
  }

  const memberRef = doc(db, 'rooms', room.id, 'members', profile.uid);
  const memberSnap = await getDoc(memberRef).catch((e) =>
    handleFirestoreError(e, OperationType.GET, `rooms/${room.id}/members/${profile.uid}`)
  );

  if (memberSnap.exists()) {
    await setDoc(doc(db, 'userMemberships', profile.uid, 'rooms', room.id), {
      uid: profile.uid,
      roomId: room.id,
      role: (memberSnap.data().role as MemberRole) || 'member',
      joinedAt: serverTimestamp(),
    }).catch((e) =>
      handleFirestoreError(e, OperationType.WRITE, `userMemberships/${profile.uid}/rooms/${room.id}`)
    );
    return { room, outcome: 'already_member' };
  }

  if (room.visibility === 'public') {
    await joinPublicRoom(room, profile);
    return { room, outcome: 'joined' };
  }

  await requestToJoinRoom(room, profile, 'Opened via shared group link');
  return { room, outcome: 'requested' };
}

export async function joinPrivateRoomWithCode(rawCode: string, profile: Profile): Promise<Room> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,24}$/.test(code)) {
    throw new Error('Invite code format looks invalid. Example: QUAD-7K9P2M');
  }

  let inviteSnap;
  try {
    inviteSnap = await getDoc(doc(db, 'invites', code));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `invites/${code}`);
  }

  if (!inviteSnap.exists() || !inviteSnap.data().active) {
    throw new Error('This invite code is invalid or has been revoked.');
  }

  const invite = inviteSnap.data() as RoomInvite;
  const roomSnap = await getDoc(doc(db, 'rooms', invite.roomId)).catch((e) =>
    handleFirestoreError(e, OperationType.GET, `rooms/${invite.roomId}`)
  );
  if (!roomSnap.exists()) {
    throw new Error('The room linked to this invite no longer exists.');
  }
  const room = roomSnap.data() as Room;

  const memberRef = doc(db, 'rooms', room.id, 'members', profile.uid);
  const memberSnap = await getDoc(memberRef).catch((e) =>
    handleFirestoreError(e, OperationType.GET, `rooms/${room.id}/members/${profile.uid}`)
  );

  if (memberSnap.exists()) {
    await setDoc(doc(db, 'userMemberships', profile.uid, 'rooms', room.id), {
      uid: profile.uid,
      roomId: room.id,
      role: (memberSnap.data().role as MemberRole) || 'member',
      joinedAt: serverTimestamp(),
    }).catch((e) => handleFirestoreError(e, OperationType.WRITE, `userMemberships/${profile.uid}/rooms/${room.id}`));
    return room;
  }

  const batch = writeBatch(db);
  batch.set(memberRef, {
    uid: profile.uid,
    roomId: room.id,
    role: 'member' as MemberRole,
    displayName: profile.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    handle: profile.handle.slice(0, LIMITS.HANDLE_MAX),
    photoUrl: profile.photoUrl.slice(0, LIMITS.PHOTO_URL_MAX),
    inviteCodeUsed: code,
    lastReadAt: serverTimestamp(),
    joinedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'userMemberships', profile.uid, 'rooms', room.id), {
    uid: profile.uid,
    roomId: room.id,
    role: 'member' as MemberRole,
    joinedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'rooms', room.id), {
    memberCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'rooms', room.id, 'activity', generateId('act')), {
    roomId: room.id,
    actorId: profile.uid,
    actorName: profile.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    action: 'member_joined' as RoomActivityAction,
    summary: `${profile.displayName} joined via invite code ${code}`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return room;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${room.id}/members/${profile.uid}`);
  }
}

export async function leaveRoom(roomId: string, uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'rooms', roomId, 'members', uid));
  batch.delete(doc(db, 'userMemberships', uid, 'rooms', roomId));
  batch.update(doc(db, 'rooms', roomId), {
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `rooms/${roomId}/members/${uid}`);
  }
}

export async function requestToJoinRoom(room: Room, profile: Profile, note: string): Promise<void> {
  const reqRef = doc(db, 'rooms', room.id, 'joinRequests', profile.uid);
  const batch = writeBatch(db);

  batch.set(reqRef, {
    uid: profile.uid,
    roomId: room.id,
    displayName: profile.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    handle: profile.handle.slice(0, LIMITS.HANDLE_MAX),
    photoUrl: profile.photoUrl.slice(0, LIMITS.PHOTO_URL_MAX),
    note: note.trim().slice(0, LIMITS.JOIN_NOTE_MAX),
    status: 'pending',
    reviewedBy: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (room.ownerId && room.ownerId !== profile.uid) {
    batch.set(doc(db, 'notifications', generateId('ntf')), {
      recipientId: room.ownerId,
      senderId: profile.uid,
      senderName: profile.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
      roomId: room.id,
      roomName: room.name.slice(0, LIMITS.ROOM_NAME_MAX),
      messageId: '',
      type: 'join_request' as NotificationType,
      title: `Join request for ${room.name}`,
      body: note.trim() ? `${profile.displayName}: ${note.trim().slice(0, 140)}` : `${profile.displayName} requested access.`,
      read: false,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${room.id}/joinRequests/${profile.uid}`);
  }
}

export async function reviewJoinRequest(params: {
  room: Room;
  request: JoinRequest;
  decision: 'approved' | 'rejected';
  reviewer: Profile;
}): Promise<void> {
  const { room, request, decision, reviewer } = params;
  const batch = writeBatch(db);

  batch.update(doc(db, 'rooms', room.id, 'joinRequests', request.uid), {
    status: decision,
    reviewedBy: reviewer.uid,
    updatedAt: serverTimestamp(),
  });

  if (decision === 'approved') {
    batch.set(doc(db, 'rooms', room.id, 'members', request.uid), {
      uid: request.uid,
      roomId: room.id,
      role: 'member' as MemberRole,
      displayName: request.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
      handle: request.handle.slice(0, LIMITS.HANDLE_MAX),
      photoUrl: request.photoUrl.slice(0, LIMITS.PHOTO_URL_MAX),
      inviteCodeUsed: '',
      lastReadAt: serverTimestamp(),
      joinedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'rooms', room.id), {
      memberCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'notifications', generateId('ntf')), {
      recipientId: request.uid,
      senderId: reviewer.uid,
      senderName: reviewer.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
      roomId: room.id,
      roomName: room.name.slice(0, LIMITS.ROOM_NAME_MAX),
      messageId: '',
      type: 'join_approved' as NotificationType,
      title: `Approved to join ${room.name}`,
      body: `${reviewer.displayName} approved your join request. Jump in and say hi!`,
      read: false,
      createdAt: serverTimestamp(),
    });
  }

  batch.set(doc(db, 'rooms', room.id, 'activity', generateId('act')), {
    roomId: room.id,
    actorId: reviewer.uid,
    actorName: reviewer.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    action: (decision === 'approved' ? 'join_approved' : 'join_rejected') as RoomActivityAction,
    summary: `${decision === 'approved' ? 'Approved' : 'Declined'} ${request.displayName}'s join request`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${room.id}/joinRequests/${request.uid}`);
  }
}

export async function createInviteCode(room: Room, actor: Profile): Promise<RoomInvite> {
  const code = generateInviteCode(room.slug.slice(0, 5));
  const payload = {
    code,
    roomId: room.id,
    roomName: room.name.slice(0, LIMITS.ROOM_NAME_MAX),
    createdBy: actor.uid,
    active: true,
    createdAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(doc(db, 'invites', code), payload);
  batch.set(doc(db, 'rooms', room.id, 'activity', generateId('act')), {
    roomId: room.id,
    actorId: actor.uid,
    actorName: actor.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    action: 'invite_created' as RoomActivityAction,
    summary: `Generated invite code ${code}`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return {
      code,
      roomId: room.id,
      roomName: room.name,
      createdBy: actor.uid,
      active: true,
      createdAt: null,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `invites/${code}`);
  }
}

export async function revokeInviteCode(code: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'invites', code), { active: false });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `invites/${code}`);
  }
}

export async function startOrOpenDM(currentUser: Profile, targetUser: Profile): Promise<string> {
  const dmRoomId = makeDmRoomId(currentUser.uid, targetUser.uid);
  const roomRef = doc(db, 'rooms', dmRoomId);

  let existing;
  try {
    existing = await getDoc(roomRef);
  } catch {
    // Non-existing DM docs are denied by get when resource doesn't exist; proceed to create
    existing = null;
  }

  if (existing && existing.exists()) {
    return dmRoomId;
  }

  const participants = [currentUser.uid, targetUser.uid].sort();
  const batch = writeBatch(db);

  batch.set(roomRef, {
    id: dmRoomId,
    name: `${currentUser.displayName} & ${targetUser.displayName}`.slice(0, LIMITS.ROOM_NAME_MAX),
    slug: slugifyRoomName(dmRoomId),
    description: 'Direct conversation',
    category: 'direct' as RoomCategory,
    visibility: 'dm' as RoomVisibility,
    coverImage: '',
    ownerId: currentUser.uid,
    dmParticipantIds: participants,
    memberCount: 2,
    lastMessageText: 'Started direct message',
    lastMessageAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'rooms', dmRoomId, 'members', currentUser.uid), {
    uid: currentUser.uid,
    roomId: dmRoomId,
    role: 'owner' as MemberRole,
    displayName: currentUser.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    handle: currentUser.handle.slice(0, LIMITS.HANDLE_MAX),
    photoUrl: currentUser.photoUrl.slice(0, LIMITS.PHOTO_URL_MAX),
    inviteCodeUsed: '',
    lastReadAt: serverTimestamp(),
    joinedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'rooms', dmRoomId, 'members', targetUser.uid), {
    uid: targetUser.uid,
    roomId: dmRoomId,
    role: 'member' as MemberRole,
    displayName: targetUser.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    handle: targetUser.handle.slice(0, LIMITS.HANDLE_MAX),
    photoUrl: targetUser.photoUrl.slice(0, LIMITS.PHOTO_URL_MAX),
    inviteCodeUsed: '',
    lastReadAt: serverTimestamp(),
    joinedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'userMemberships', currentUser.uid, 'rooms', dmRoomId), {
    uid: currentUser.uid,
    roomId: dmRoomId,
    role: 'owner' as MemberRole,
    joinedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return dmRoomId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${dmRoomId}`);
  }
}

export async function sendMessage(params: {
  roomId: string;
  roomName: string;
  author: Profile;
  kind: MessageKind;
  text: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  mediaName?: string;
  mediaMime?: string;
  mediaSize?: number;
  voiceDurationSec?: number;
  voiceEffect?: VoiceEffectId;
  waveform?: number[];
  poll?: PollData;
  eventId?: string;
  replyTo?: { id: string; authorName: string; authorId: string; snippet: string } | null;
  threadRootId?: string;
  mentionedUids?: string[];
  notifyAllMemberUids?: string[];
  isBroadcastMention?: boolean;
  dmRecipientId?: string;
  onNotifyPing?: (recipientId: string, title: string, body: string) => void;
}): Promise<string> {
  const messageId = generateId('msg');
  const trimmedText = params.text.trim().slice(0, LIMITS.MESSAGE_TEXT_MAX);
  const encrypted = isEncryptedPayload(trimmedText);

  let linkPreview: LinkPreview | undefined;
  if (params.kind === 'text' && trimmedText && !encrypted) {
    const firstUrl = extractFirstUrl(trimmedText);
    if (firstUrl) {
      linkPreview = await fetchLinkPreview(firstUrl);
    }
  }

  const msgData: Record<string, unknown> = {
    roomId: params.roomId,
    authorId: params.author.uid,
    authorName: params.author.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    authorPhoto: params.author.photoUrl.slice(0, LIMITS.PHOTO_URL_MAX),
    kind: params.kind,
    text: trimmedText,
    mediaUrl: (params.mediaUrl || '').slice(0, LIMITS.MEDIA_URL_MAX),
    mediaName: (params.mediaName || '').slice(0, LIMITS.MEDIA_NAME_MAX),
    mediaMime: (params.mediaMime || '').slice(0, 100),
    mediaSize: Math.max(0, Math.min(MAX_FILE_SIZE_BYTES, params.mediaSize || 0)),
    voiceDurationSec: Math.max(0, Math.min(VOICE_NOTE_MAX_SEC, Math.round(params.voiceDurationSec || 0))),
    eventId: (params.eventId || '').slice(0, 128),
    replyToId: (params.replyTo?.id || '').slice(0, 128),
    replyToAuthor: (params.replyTo?.authorName || '').slice(0, LIMITS.DISPLAY_NAME_MAX),
    replyToSnippet: (params.replyTo?.snippet || '').slice(0, LIMITS.REPLY_SNIPPET_MAX),
    threadRootId: (params.threadRootId || '').slice(0, 128),
    threadReplyCount: 0,
    mentionedUids: (params.mentionedUids || []).slice(0, LIMITS.MENTIONS_MAX),
    reactions: {},
    deliveredTo: [params.author.uid],
    readBy: [params.author.uid],
    pinned: false,
    pinnedBy: '',
    edited: false,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (params.thumbnailUrl) {
    msgData.thumbnailUrl = params.thumbnailUrl.slice(0, 180000);
  }
  if (params.voiceEffect) {
    msgData.voiceEffect = params.voiceEffect;
  }
  if (params.waveform && params.waveform.length > 0) {
    msgData.waveform = params.waveform
      .slice(0, 64)
      .map((n) => Math.max(0.05, Math.min(1, Number(n.toFixed(3)))));
  }
  if (linkPreview) {
    msgData.linkPreview = linkPreview;
  }
  if (params.poll) {
    msgData.poll = params.poll;
  }

  const previewSummary =
    params.mediaMime === SONG_MESSAGE_MIME || params.mediaMime === REEL_MESSAGE_MIME
      ? getCleanLastMessagePreview(trimmedText, params.mediaMime, params.mediaName)
      : params.kind === 'image'
        ? `Photo${trimmedText && !encrypted ? `: ${trimmedText}` : ''}`
        : params.kind === 'voice'
          ? `Voice note (${Math.round(params.voiceDurationSec || 0)}s)`
          : params.kind === 'file'
            ? `File: ${params.mediaName || 'attachment'}`
            : params.kind === 'poll'
              ? `Poll: ${params.poll?.question || 'Quick poll'}`
              : params.kind === 'event'
                ? `Event: ${trimmedText}`
                : encrypted
                  ? 'Encrypted message'
                : trimmedText;

  const batch = writeBatch(db);
  batch.set(doc(db, 'rooms', params.roomId, 'messages', messageId), msgData);
  batch.update(doc(db, 'rooms', params.roomId), {
    lastMessageText: previewSummary.slice(0, 240),
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (params.threadRootId) {
    batch.update(doc(db, 'rooms', params.roomId, 'messages', params.threadRootId), {
      threadReplyCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  }

  const notifiedRecipients = new Set<string>();
  const addNotif = (recipientId: string, type: NotificationType, title: string, body: string) => {
    if (!recipientId || recipientId === params.author.uid || notifiedRecipients.has(recipientId)) return;
    notifiedRecipients.add(recipientId);
    batch.set(doc(db, 'notifications', generateId('ntf')), {
      recipientId,
      senderId: params.author.uid,
      senderName: params.author.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
      roomId: params.roomId,
      roomName: params.roomName.slice(0, LIMITS.ROOM_NAME_MAX),
      messageId,
      type,
      title: title.slice(0, 120),
      body: body.slice(0, 240),
      read: false,
      createdAt: serverTimestamp(),
    });
    params.onNotifyPing?.(recipientId, title, body);
  };

  if (params.isBroadcastMention && params.notifyAllMemberUids && params.notifyAllMemberUids.length > 0) {
    for (const memberUid of params.notifyAllMemberUids.slice(0, 450)) {
      addNotif(
        memberUid,
        'mention',
        `${params.author.displayName} mentioned @everyone in ${params.roomName}`,
        previewSummary
      );
    }
  } else {
    for (const mentionedUid of params.mentionedUids || []) {
      addNotif(
        mentionedUid,
        'mention',
        `${params.author.displayName} mentioned you in ${params.roomName}`,
        previewSummary
      );
    }
  }

  if (params.replyTo?.authorId) {
    addNotif(
      params.replyTo.authorId,
      'reply',
      `${params.author.displayName} replied to your message`,
      previewSummary
    );
  }

  if (params.dmRecipientId) {
    addNotif(
      params.dmRecipientId,
      'dm',
      `Direct message from ${params.author.displayName}`,
      previewSummary
    );
  }

  try {
    await batch.commit();
    return messageId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${params.roomId}/messages/${messageId}`);
  }
}

export async function editMessage(
  roomId: string,
  messageId: string,
  nextText: string,
  mentionedUids: string[],
  options?: { isLatestMessage?: boolean; previewText?: string }
): Promise<void> {
  const cleaned = nextText.trim().slice(0, LIMITS.MESSAGE_TEXT_MAX);
  const encrypted = isEncryptedPayload(cleaned);
  const url = encrypted ? null : extractFirstUrl(cleaned);
  const linkPreview = url ? await fetchLinkPreview(url) : undefined;

  const updates: Record<string, unknown> = {
    text: cleaned,
    edited: true,
    mentionedUids: mentionedUids.slice(0, LIMITS.MENTIONS_MAX),
    updatedAt: serverTimestamp(),
  };
  if (linkPreview) {
    updates.linkPreview = linkPreview;
  }

  const batch = writeBatch(db);
  batch.update(doc(db, 'rooms', roomId, 'messages', messageId), updates);

  if (options?.isLatestMessage) {
    const preview = encrypted
      ? 'Encrypted message (edited)'
      : (options.previewText || cleaned || 'Message edited').slice(0, 240);
    batch.update(doc(db, 'rooms', roomId), {
      lastMessageText: preview,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}/messages/${messageId}`);
  }
}

export async function softDeleteMessage(
  roomId: string,
  messageId: string,
  actor: Profile,
  isModAction: boolean,
  options?: { isLatestMessage?: boolean }
): Promise<void> {
  const batch = writeBatch(db);
  const deletedLabel = isModAction
    ? 'Removed by room moderator'
    : 'This message was deleted for everyone';
  batch.update(doc(db, 'rooms', roomId, 'messages', messageId), {
    deleted: true,
    text: deletedLabel,
    mediaUrl: '',
    thumbnailUrl: '',
    mediaName: '',
    updatedAt: serverTimestamp(),
  });
  if (options?.isLatestMessage) {
    batch.update(doc(db, 'rooms', roomId), {
      lastMessageText: deletedLabel,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  if (isModAction) {
    batch.set(doc(db, 'rooms', roomId, 'activity', generateId('act')), {
      roomId,
      actorId: actor.uid,
      actorName: actor.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
      action: 'message_deleted' as RoomActivityAction,
      summary: `${actor.displayName} moderated and removed a message`,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}/messages/${messageId}`);
  }
}

export async function toggleReaction(
  roomId: string,
  message: Message,
  emoji: string,
  uid: string
): Promise<void> {
  const nextReactions: Record<string, string[]> = {};
  for (const [key, list] of Object.entries(message.reactions || {})) {
    nextReactions[key] = [...list];
  }
  const current = nextReactions[emoji] || [];
  if (current.includes(uid)) {
    const filtered = current.filter((id) => id !== uid);
    if (filtered.length === 0) {
      delete nextReactions[emoji];
    } else {
      nextReactions[emoji] = filtered;
    }
  } else {
    if (Object.keys(nextReactions).length >= 30 && !nextReactions[emoji]) return;
    nextReactions[emoji] = [...current, uid].slice(0, 100);
  }

  try {
    await updateDoc(doc(db, 'rooms', roomId, 'messages', message.id), {
      reactions: nextReactions,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}/messages/${message.id}`);
  }
}

export async function togglePinMessage(roomId: string, message: Message, actor: Profile): Promise<void> {
  const nextPinned = !message.pinned;
  const batch = writeBatch(db);
  batch.update(doc(db, 'rooms', roomId, 'messages', message.id), {
    pinned: nextPinned,
    pinnedBy: nextPinned ? actor.uid : '',
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'rooms', roomId, 'activity', generateId('act')), {
    roomId,
    actorId: actor.uid,
    actorName: actor.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    action: 'message_pinned' as RoomActivityAction,
    summary: `${nextPinned ? 'Pinned' : 'Unpinned'} a message by ${message.authorName}`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}/messages/${message.id}`);
  }
}

export async function voteOnPoll(
  roomId: string,
  message: Message,
  optionId: string,
  uid: string
): Promise<void> {
  if (!message.poll || message.poll.closed) return;
  const nextOptions = message.poll.options.map((opt) => {
    const hasVoted = opt.voterIds.includes(uid);
    if (opt.id === optionId) {
      return {
        ...opt,
        voterIds: hasVoted
          ? opt.voterIds.filter((id) => id !== uid)
          : [...opt.voterIds, uid].slice(0, 200),
      };
    }
    if (!message.poll!.allowMultiple && hasVoted) {
      return { ...opt, voterIds: opt.voterIds.filter((id) => id !== uid) };
    }
    return opt;
  });

  try {
    await updateDoc(doc(db, 'rooms', roomId, 'messages', message.id), {
      poll: {
        ...message.poll,
        options: nextOptions,
      },
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}/messages/${message.id}`);
  }
}

export async function markMessagesDelivered(
  roomId: string,
  messages: Message[],
  uid: string
): Promise<void> {
  const targets = messages.filter((m) => {
    if (m.authorId === uid) return false;
    const delivered = m.deliveredTo || [];
    return !delivered.includes(uid) && delivered.length < LIMITS.READ_BY_MAX;
  });
  if (targets.length === 0) return;

  const batch = writeBatch(db);
  for (const msg of targets.slice(-10)) {
    const delivered = msg.deliveredTo || [msg.authorId];
    batch.update(doc(db, 'rooms', roomId, 'messages', msg.id), {
      deliveredTo: Array.from(new Set([...delivered, uid])).slice(0, LIMITS.READ_BY_MAX),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch {
    // Non-fatal if membership changed simultaneously
  }
}

export async function markMessagesRead(
  roomId: string,
  unreadMessages: Message[],
  uid: string
): Promise<void> {
  const targets = unreadMessages.filter(
    (m) => m.authorId !== uid && !m.readBy.includes(uid) && m.readBy.length < LIMITS.READ_BY_MAX
  );
  if (targets.length === 0) return;

  const batch = writeBatch(db);
  for (const msg of targets.slice(-8)) {
    const delivered = msg.deliveredTo || [msg.authorId];
    batch.update(doc(db, 'rooms', roomId, 'messages', msg.id), {
      readBy: Array.from(new Set([...msg.readBy, uid])).slice(0, LIMITS.READ_BY_MAX),
      deliveredTo: Array.from(new Set([...delivered, uid])).slice(0, LIMITS.READ_BY_MAX),
      updatedAt: serverTimestamp(),
    });
  }
  batch.update(doc(db, 'rooms', roomId, 'members', uid), {
    lastReadAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch {
    // Non-fatal if membership changed simultaneously
  }
}

export async function createRoomEvent(params: {
  roomId: string;
  roomName: string;
  creator: Profile;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  coverImage?: string;
  reminderMinutes: number;
}): Promise<string> {
  const eventId = generateId('evt');
  const eventRef = doc(db, 'rooms', params.roomId, 'events', eventId);

  try {
    await setDoc(eventRef, {
      roomId: params.roomId,
      title: params.title.trim().slice(0, LIMITS.EVENT_TITLE_MAX),
      description: params.description.trim().slice(0, LIMITS.EVENT_DESC_MAX),
      location: params.location.trim().slice(0, LIMITS.EVENT_LOCATION_MAX),
      startAt: params.startAt.slice(0, 40),
      endAt: params.endAt.slice(0, 40),
      coverImage: (params.coverImage || '').slice(0, 500),
      creatorId: params.creator.uid,
      creatorName: params.creator.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
      rsvpGoing: [params.creator.uid],
      rsvpMaybe: [],
      reminderMinutes: Math.max(0, Math.min(1440, params.reminderMinutes)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${params.roomId}/events/${eventId}`);
  }

  await sendMessage({
    roomId: params.roomId,
    roomName: params.roomName,
    author: params.creator,
    kind: 'event',
    text: params.title.trim(),
    eventId,
  });

  return eventId;
}

export async function updateEventRsvp(
  roomId: string,
  event: RoomEvent,
  uid: string,
  choice: 'going' | 'maybe' | 'none'
): Promise<void> {
  const nextGoing = event.rsvpGoing.filter((id) => id !== uid);
  const nextMaybe = event.rsvpMaybe.filter((id) => id !== uid);
  if (choice === 'going') nextGoing.push(uid);
  if (choice === 'maybe') nextMaybe.push(uid);

  try {
    await updateDoc(doc(db, 'rooms', roomId, 'events', event.id), {
      rsvpGoing: nextGoing.slice(0, 200),
      rsvpMaybe: nextMaybe.slice(0, 200),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}/events/${event.id}`);
  }
}

export async function updateMemberRole(params: {
  room: Room;
  targetUid: string;
  targetName: string;
  newRole: 'moderator' | 'member';
  actor: Profile;
}): Promise<void> {
  const { room, targetUid, targetName, newRole, actor } = params;
  const batch = writeBatch(db);
  batch.update(doc(db, 'rooms', room.id, 'members', targetUid), { role: newRole });
  batch.set(doc(db, 'rooms', room.id, 'activity', generateId('act')), {
    roomId: room.id,
    actorId: actor.uid,
    actorName: actor.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    action: 'role_updated' as RoomActivityAction,
    summary: `Changed ${targetName}'s role to ${newRole}`,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'notifications', generateId('ntf')), {
    recipientId: targetUid,
    senderId: actor.uid,
    senderName: actor.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    roomId: room.id,
    roomName: room.name.slice(0, LIMITS.ROOM_NAME_MAX),
    messageId: '',
    type: 'role_change' as NotificationType,
    title: `Role updated in ${room.name}`,
    body: `${actor.displayName} updated your role to ${newRole}.`,
    read: false,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${room.id}/members/${targetUid}`);
  }
}

export async function removeRoomMember(params: {
  roomId: string;
  targetUid: string;
  targetName: string;
  actor: Profile;
}): Promise<void> {
  const { roomId, targetUid, targetName, actor } = params;
  const batch = writeBatch(db);
  batch.delete(doc(db, 'rooms', roomId, 'members', targetUid));
  batch.update(doc(db, 'rooms', roomId), {
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'rooms', roomId, 'activity', generateId('act')), {
    roomId,
    actorId: actor.uid,
    actorName: actor.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    action: 'member_removed' as RoomActivityAction,
    summary: `${actor.displayName} removed ${targetName} from the room`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `rooms/${roomId}/members/${targetUid}`);
  }
}

export async function submitReport(params: {
  roomId: string;
  reporter: Profile;
  targetUserId: string;
  targetUserName: string;
  targetMessageId?: string;
  targetSnippet?: string;
  reason: string;
}): Promise<void> {
  const reportId = generateId('rep');
  try {
    await setDoc(doc(db, 'rooms', params.roomId, 'reports', reportId), {
      roomId: params.roomId,
      reporterId: params.reporter.uid,
      reporterName: params.reporter.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
      targetUserId: params.targetUserId,
      targetUserName: params.targetUserName.slice(0, LIMITS.DISPLAY_NAME_MAX),
      targetMessageId: (params.targetMessageId || '').slice(0, 128),
      targetSnippet: (params.targetSnippet || '').slice(0, 240),
      reason: params.reason.trim().slice(0, LIMITS.REPORT_REASON_MAX),
      status: 'open',
      resolvedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${params.roomId}/reports/${reportId}`);
  }
}

export async function resolveReport(params: {
  roomId: string;
  reportId: string;
  decision: 'resolved' | 'dismissed';
  actor: Profile;
}): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'rooms', params.roomId, 'reports', params.reportId), {
    status: params.decision,
    resolvedBy: params.actor.uid,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'rooms', params.roomId, 'activity', generateId('act')), {
    roomId: params.roomId,
    actorId: params.actor.uid,
    actorName: params.actor.displayName.slice(0, LIMITS.DISPLAY_NAME_MAX),
    action: 'report_resolved' as RoomActivityAction,
    summary: `Marked moderation report as ${params.decision}`,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${params.roomId}/reports/${params.reportId}`);
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  for (const id of ids.slice(0, 50)) {
    batch.update(doc(db, 'notifications', id), { read: true });
  }
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'notifications');
  }
}

export async function deleteUserMembershipIndex(uid: string, roomId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'userMemberships', uid, 'rooms', roomId));
  } catch {
    // Ignore if already deleted
  }
}

export async function updateRoomMetadata(
  roomId: string,
  updates: { name: string; description?: string }
): Promise<void> {
  const cleanName = updates.name.trim().slice(0, LIMITS.ROOM_NAME_MAX);
  if (!cleanName) {
    throw new Error('Group name cannot be empty.');
  }
  const payload: Record<string, unknown> = {
    name: cleanName,
    updatedAt: serverTimestamp(),
  };
  if (updates.description !== undefined) {
    payload.description = updates.description.trim().slice(0, LIMITS.ROOM_DESC_MAX);
  }
  try {
    await updateDoc(doc(db, 'rooms', roomId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

