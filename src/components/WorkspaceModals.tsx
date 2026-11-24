import React, { useEffect, useMemo, useState } from 'react';
import {
  AtSign,
  Bell,
  BellRing,
  Camera,
  Check,
  Copy,
  Hash,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Share2,
  Shuffle,
  Smartphone,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import type { PushPermissionState } from '../lib/mobilePush';
import { Avatar } from './Avatar';
import {
  AVATAR_PRESETS,
  generateRandomAvatarUrl,
  generateRandomProfileCombo,
} from '../lib/avatarCatalog';
import {
  checkUsernameAvailability,
  searchAccountsByUsername,
  type SocialAppNotification,
  type SocialRelation,
} from '../lib/backendApi';
import { CAMPUS_IMAGES, compressImageToDataUrl, LIMITS } from '../lib/validation';
import type {
  LivePresenceEntry,
  NotificationItem,
  OnlineStatus,
  PollData,
  Profile,
  Room,
  RoomCategory,
  RoomInvite,
  UserPrivate,
} from '../types/chat';

interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  maxWidth?: string;
  children: React.ReactNode;
}

export function ModalShell({
  title,
  subtitle,
  onClose,
  maxWidth = 'max-w-lg',
  children,
}: ModalShellProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className={`relative z-10 w-full ${maxWidth} max-h-[88vh] bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden`}
      >
        <div className="px-5 py-4 border-b border-stone-200 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-stone-900 dark:text-white">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-stone-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-stone-500 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* =========================================================
 * 1. DISCOVER & BROWSE ROOMS MODAL
 * ========================================================= */
export function DiscoverRoomsModal({
  rooms,
  joinedRoomIds,
  onClose,
  onJoinPublic,
  onOpenRoom,
  onRequestPrivate,
  onCreateRoom,
}: {
  rooms: Room[];
  joinedRoomIds: Set<string>;
  onClose: () => void;
  onJoinPublic: (room: Room) => Promise<void>;
  onOpenRoom: (roomId: string) => void;
  onRequestPrivate: (room: Room, note: string) => Promise<void>;
  onCreateRoom: () => void;
}) {
  const [queryText, setQueryText] = useState('');
  const [category, setCategory] = useState<'all' | RoomCategory>('all');
  const [requestingRoom, setRequestingRoom] = useState<Room | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return rooms.filter((r) => {
      if (r.visibility === 'dm') return false;
      if (category !== 'all' && r.category !== category) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [rooms, queryText, category]);

  return (
    <ModalShell
      title="Discover Campus Rooms"
      subtitle="Join public clubs, classes, and events or request access to private spaces."
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search clubs, classes, topics..."
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onCreateRoom();
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Room</span>
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-slate-900 rounded-lg overflow-x-auto">
          {(
            [
              { id: 'all', label: 'All Rooms' },
              { id: 'club', label: 'Clubs' },
              { id: 'class', label: 'Classes' },
              { id: 'event', label: 'Events' },
              { id: 'topic', label: 'Interests' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                category === tab.id
                  ? 'bg-white dark:bg-slate-800 text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {feedback && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-200">
            {feedback}
          </div>
        )}

        {requestingRoom && (
          <div className="p-4 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-900/70 space-y-3">
            <p className="text-xs font-semibold text-stone-900 dark:text-white">
              Request to join {requestingRoom.name}
            </p>
            <input
              type="text"
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              maxLength={LIMITS.JOIN_NOTE_MAX}
              placeholder="Optional note for room moderators (e.g., Robotics sophomore, student ID verified)"
              className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRequestingRoom(null);
                  setRequestNote('');
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-stone-600 dark:text-slate-300 hover:bg-stone-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === requestingRoom.id}
                onClick={async () => {
                  setBusyId(requestingRoom.id);
                  try {
                    await onRequestPrivate(requestingRoom, requestNote);
                    setFeedback(`Join request sent to ${requestingRoom.name} moderators.`);
                    setRequestingRoom(null);
                    setRequestNote('');
                  } finally {
                    setBusyId(null);
                  }
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
              >
                Send Request
              </button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-slate-400 text-center py-8">
            No campus rooms match your filter yet. Create one to get started!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((room) => {
              const joined = joinedRoomIds.has(room.id);
              return (
                <div
                  key={room.id}
                  className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-[#1C2128] overflow-hidden flex flex-col"
                >
                  {room.coverImage && (
                    <img
                      src={room.coverImage}
                      alt={room.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-24 object-cover"
                    />
                  )}
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[11px] text-stone-500 dark:text-slate-400 capitalize">
                        {room.category === 'topic' ? 'Interest' : room.category} ·{' '}
                        {room.visibility === 'private' ? 'Private' : 'Public'} ·{' '}
                        <span className="tabular-nums">{room.memberCount}</span>{' '}
                        {room.memberCount === 1 ? 'member' : 'members'}
                      </p>
                      <h3 className="font-display text-sm font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                        {room.visibility === 'private' ? (
                          <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        ) : (
                          <Hash className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        )}
                        <span className="truncate">{room.name}</span>
                      </h3>
                      <p className="text-xs text-stone-600 dark:text-slate-400 line-clamp-2">
                        {room.description || 'Campus conversation room'}
                      </p>
                    </div>

                    {joined ? (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenRoom(room.id);
                          onClose();
                        }}
                        className="w-full py-2 rounded-lg text-xs font-medium bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-900 dark:text-white transition-colors cursor-pointer"
                      >
                        Open Room
                      </button>
                    ) : room.visibility === 'public' ? (
                      <button
                        type="button"
                        disabled={busyId === room.id}
                        onClick={async () => {
                          setBusyId(room.id);
                          try {
                            await onJoinPublic(room);
                            onClose();
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        className="w-full py-2 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white transition-colors cursor-pointer"
                      >
                        {busyId === room.id ? 'Joining...' : 'Join Room'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRequestingRoom(room)}
                        className="w-full py-2 rounded-lg text-xs font-medium border border-stone-300 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-stone-800 dark:text-slate-200 transition-colors cursor-pointer"
                      >
                        Request to Join
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/* =========================================================
 * 2. CREATE ROOM MODAL
 * ========================================================= */
export function CreateRoomModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    category: RoomCategory;
    visibility: 'public' | 'private';
    coverImage: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RoomCategory>('club');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [coverImage, setCoverImage] = useState<string>(CAMPUS_IMAGES.welcomeQuad);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), category, visibility, coverImage });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Create a Campus Room"
      subtitle="Set up a public or private channel for your club, class, event, or topic."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Room name</label>
          <input
            type="text"
            required
            maxLength={LIMITS.ROOM_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CS 201 Algorithms, Campus Photography Club"
            className="w-full px-3.5 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Description</label>
          <textarea
            rows={2}
            maxLength={LIMITS.ROOM_DESC_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this room for? Share meeting times or guidelines."
            className="w-full px-3.5 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as RoomCategory)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="club">Club</option>
              <option value="class">Class</option>
              <option value="event">Event</option>
              <option value="topic">Interest</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Visibility</label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 dark:bg-slate-900 rounded-lg">
              {(['public', 'private'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer ${
                    visibility === v
                      ? 'bg-white dark:bg-slate-800 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-600 dark:text-slate-400'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Room banner</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Quad', url: CAMPUS_IMAGES.welcomeQuad },
              { label: 'Makerspace', url: CAMPUS_IMAGES.roboticsLab },
              { label: 'Library', url: CAMPUS_IMAGES.studyLounge },
              { label: 'Events', url: CAMPUS_IMAGES.amphitheaterEvent },
            ].map((img) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setCoverImage(img.url)}
                className={`rounded-lg overflow-hidden border-2 transition-colors cursor-pointer ${
                  coverImage === img.url
                    ? 'border-emerald-600'
                    : 'border-transparent opacity-75 hover:opacity-100'
                }`}
              >
                <img
                  src={img.url}
                  alt={img.label}
                  referrerPolicy="no-referrer"
                  className="w-full h-14 object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white cursor-pointer"
          >
            {busy ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* =========================================================
 * 3. JOIN BY GROUP LINK OR INVITE CODE MODAL
 * ========================================================= */
export function JoinByCodeModal({
  onClose,
  onJoinCode,
  onJoinRoomLink,
}: {
  onClose: () => void;
  onJoinCode: (code: string) => Promise<void>;
  onJoinRoomLink?: (roomId: string) => Promise<void>;
}) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = input.trim();
    if (!cleaned) return;

    const joinRoomMatch = cleaned.match(/[?&]join=([A-Za-z0-9_-]+)/);
    const inviteMatch = cleaned.match(/[?&]invite=([A-Za-z0-9-]+)/);

    setBusy(true);
    try {
      if (joinRoomMatch && onJoinRoomLink) {
        await onJoinRoomLink(joinRoomMatch[1]);
        onClose();
        return;
      }
      const codeToJoin = inviteMatch ? inviteMatch[1] : cleaned;
      await onJoinCode(codeToJoin.toUpperCase());
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to join with that group link or invite code.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Join Group via Link or Code"
      subtitle="Paste any shared group join link or private invite code to join right away."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">
            Group link or invite code
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://.../?join=group-id or QUAD-7K9P2M"
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-lg text-sm font-mono-tabular bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-accent disabled:opacity-50 text-white cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{busy ? 'Joining...' : 'Join Group'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* =========================================================
 * 4. GROUP JOIN LINK & INVITE MEMBERS MODAL
 * ========================================================= */
export function InviteMembersModal({
  room,
  canGenerate,
  invites,
  onClose,
  onGenerateCode,
  onRevokeCode,
}: {
  room: Room;
  canGenerate: boolean;
  invites: RoomInvite[];
  onClose: () => void;
  onGenerateCode: () => Promise<void>;
  onRevokeCode: (code: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const directGroupLink = `${window.location.origin}/?join=${encodeURIComponent(room.id)}`;
  const activeInvites = invites.filter((i) => i.active);
  const primaryShareLink =
    room.visibility === 'private' && activeInvites[0]
      ? `${window.location.origin}/?invite=${activeInvites[0].code}`
      : directGroupLink;

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      const tmp = document.createElement('textarea');
      tmp.value = text;
      tmp.style.position = 'fixed';
      tmp.style.opacity = '0';
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
    }
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  const shareLinkNative = async (url: string, key: string) => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Join ${room.name} on Quadline`,
          text: `Tap this link to join our group "${room.name}" on Quadline:`,
          url,
        });
        return;
      } catch {
        // User dismissed native share sheet or unsupported — fallback to copy
      }
    }
    await copyText(url, key);
  };

  return (
    <ModalShell
      title={`Group Link · ${room.name}`}
      subtitle={
        room.visibility === 'private'
          ? 'Share an invite link so people join this private group instantly, or share the direct link to request approval.'
          : 'Anyone with this group link can tap it to join immediately.'
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Direct Shareable Group Join Link Card */}
        <div className="p-3.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-accent-soft/60 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-white">
            <Link2 className="w-4 h-4 text-accent shrink-0" />
            <span>
              {room.visibility === 'private' && activeInvites[0]
                ? 'Instant Private Group Link'
                : 'Group Join Link'}
            </span>
          </div>
          <div className="px-3 py-2 rounded-lg bg-white dark:bg-[#0D1117] border border-stone-200 dark:border-slate-800 text-xs font-mono-tabular text-stone-800 dark:text-slate-200 break-all select-all">
            {primaryShareLink}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void copyText(primaryShareLink, 'direct-link')}
              className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-accent text-white flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedKey === 'direct-link' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Group Link</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void shareLinkNative(primaryShareLink, 'direct-link')}
              className="py-2 px-3.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-800 dark:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Optional Private Invite Code Generator */}
        {canGenerate ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onGenerateCode();
              } finally {
                setBusy(false);
              }
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200/80 dark:hover:bg-slate-700 disabled:opacity-50 text-stone-800 dark:text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>
              {busy
                ? 'Generating...'
                : room.visibility === 'private'
                  ? 'Generate New Instant Invite Link & Code'
                  : 'Create Revocable Invite Code'}
            </span>
          </button>
        ) : (
          room.visibility === 'private' && (
            <p className="text-xs text-stone-500 dark:text-slate-400">
              People using the link above will automatically send a join request for room moderators to approve.
            </p>
          )
        )}

        {activeInvites.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-stone-600 dark:text-slate-300">
              Active revocable invite links &amp; codes
            </p>
            {activeInvites.map((inv) => {
              const shareUrl = `${window.location.origin}/?invite=${inv.code}`;
              return (
                <div
                  key={inv.code}
                  className="p-3 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-900/70 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono-tabular text-sm font-bold text-stone-900 dark:text-white">
                      {inv.code}
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                      {shareUrl}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void copyText(inv.code, `c-${inv.code}`)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === `c-${inv.code}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Code</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyText(shareUrl, `l-${inv.code}`)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      {copiedKey === `l-${inv.code}` ? 'Copied' : 'Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onRevokeCode(inv.code)}
                      aria-label={`Revoke ${inv.code}`}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/* =========================================================
 * 5. FRIENDS & FOLLOW REQUESTS MODAL (NO GLOBAL USER COUNT)
 * ========================================================= */
export function NewDirectMessageModal({
  profiles,
  friendProfiles,
  incomingRequests,
  outgoingRequests,
  friendUids,
  incomingRequestUids,
  outgoingRequestUids,
  myFollowingUids,
  currentUid,
  presenceMap,
  onClose,
  onStartDM,
  onStartCall,
  onViewProfile,
  onToggleFollow,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onRemoveFriendRelation,
}: {
  profiles: Profile[];
  friendProfiles: Profile[];
  incomingRequests: SocialRelation[];
  outgoingRequests: SocialRelation[];
  friendUids: Set<string>;
  incomingRequestUids: Set<string>;
  outgoingRequestUids: Set<string>;
  myFollowingUids?: Set<string>;
  currentUid: string;
  presenceMap: Record<string, LivePresenceEntry>;
  onClose: () => void;
  onStartDM: (target: Profile) => Promise<void>;
  onStartCall?: (target: Profile, mode: 'audio' | 'video') => void;
  onViewProfile?: (target: Profile) => void;
  onToggleFollow?: (
    target: { uid: string; displayName: string; handle: string; photoUrl: string },
    action?: 'follow' | 'unfollow'
  ) => Promise<unknown>;
  onSendFriendRequest: (target: Profile) => Promise<void>;
  onAcceptFriendRequest: (otherUid: string) => Promise<void>;
  onDeclineFriendRequest: (otherUid: string) => Promise<void>;
  onRemoveFriendRelation: (otherUid: string) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'find'>(
    incomingRequests.length > 0 ? 'requests' : 'friends'
  );
  const [queryText, setQueryText] = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [remoteMatches, setRemoteMatches] = useState<Profile[]>([]);

  const normalized = queryText.trim().replace(/^@/, '').toLowerCase();

  useEffect(() => {
    if (activeTab !== 'find' || normalized.length < 2) {
      setRemoteMatches([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const found = await searchAccountsByUsername(normalized, currentUid);
      if (cancelled) return;
      setRemoteMatches(
        found.map((acc) => ({
          uid: acc.uid,
          displayName: acc.displayName,
          handle: acc.handle,
          bio: acc.bio || '',
          photoUrl: acc.photoUrl || '',
          majorOrClub: '',
          status: 'offline',
          statusMessage: '',
          discoverable: true,
          lastSeenAt: null,
          createdAt: null,
          updatedAt: null,
        }))
      );
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeTab, normalized, currentUid]);

  // Privacy guard: NEVER list all app users or reveal total app user count.
  // Only return exact/partial matches when the user actively searches 2+ chars.
  const searchResults = useMemo(() => {
    if (normalized.length < 2) return [];
    const byUid = new Map<string, Profile>();
    for (const p of profiles) {
      if (p.uid === currentUid) continue;
      if (
        p.handle.toLowerCase().includes(normalized) ||
        p.displayName.toLowerCase().includes(normalized)
      ) {
        byUid.set(p.uid, p);
      }
    }
    for (const acc of remoteMatches) {
      if (acc.uid === currentUid) continue;
      if (!byUid.has(acc.uid)) {
        byUid.set(acc.uid, acc);
      }
    }
    return Array.from(byUid.values())
      .sort((a, b) => {
        const aExact = a.handle.toLowerCase() === normalized ? 1 : 0;
        const bExact = b.handle.toLowerCase() === normalized ? 1 : 0;
        return bExact - aExact;
      })
      .slice(0, 10);
  }, [profiles, remoteMatches, currentUid, normalized]);

  const totalRequests = incomingRequests.length + outgoingRequests.length;

  return (
    <ModalShell
      title="App Chat Requests & People"
      subtitle="Follow profiles separately, or send an App Chat Request to unlock 1-to-1 messaging and calls."
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* 3-Tab Switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('friends')}
            className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'friends'
                ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-slate-400'
            }`}
          >
            Friends ({friendProfiles.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'requests'
                ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-slate-400'
            }`}
          >
            Requests{totalRequests > 0 ? ` (${totalRequests})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('find')}
            className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'find'
                ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-slate-400'
            }`}
          >
            Add Friend
          </button>
        </div>

        {/* TAB 1: ACCEPTED FRIENDS */}
        {activeTab === 'friends' && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {friendProfiles.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <UserPlus className="w-8 h-8 mx-auto text-stone-400" />
                <p className="text-xs font-semibold text-stone-700 dark:text-slate-200">
                  No friends connected yet
                </p>
                <p className="text-xs text-stone-500 dark:text-slate-400 max-w-xs mx-auto">
                  Send a friend request from a group member list or search someone&apos;s @handle in Add Friend.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('find')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Friend by @handle</span>
                </button>
              </div>
            ) : (
              friendProfiles.map((member) => {
                const liveStatus = presenceMap[member.uid]?.status || member.status;
                return (
                  <div
                    key={member.uid}
                    className="px-3 py-2.5 rounded-xl bg-stone-50/70 dark:bg-slate-900/70 border border-stone-200/70 dark:border-slate-800 flex items-center gap-3"
                  >
                    <Avatar
                      name={member.displayName}
                      src={member.photoUrl}
                      size="md"
                      status={liveStatus}
                      showStatus
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                        {member.displayName}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-slate-400 truncate">
                        @{member.handle}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          await onStartDM(member);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        Chat
                      </button>
                      {onStartCall && (
                        <button
                          type="button"
                          onClick={() => {
                            onStartCall(member, 'audio');
                            onClose();
                          }}
                          aria-label={`Call ${member.displayName}`}
                          className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyUid === member.uid}
                        onClick={async () => {
                          setBusyUid(member.uid);
                          try {
                            await onRemoveFriendRelation(member.uid);
                          } finally {
                            setBusyUid(null);
                          }
                        }}
                        title="Unfriend / Unfollow"
                        aria-label={`Unfriend ${member.displayName}`}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: INCOMING & OUTGOING REQUESTS */}
        {activeTab === 'requests' && (
          <div className="space-y-4 max-h-80 overflow-y-auto">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-stone-500 dark:text-slate-400">
                Incoming Requests ({incomingRequests.length})
              </p>
              {incomingRequests.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-slate-400 py-2">
                  No pending incoming friend requests.
                </p>
              ) : (
                incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl bg-stone-50 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={req.requesterName} src={req.requesterPhoto} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                          {req.requesterName}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                          @{req.requesterHandle}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={busyUid === req.requesterUid}
                        onClick={async () => {
                          setBusyUid(req.requesterUid);
                          try {
                            await onAcceptFriendRequest(req.requesterUid);
                          } finally {
                            setBusyUid(null);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busyUid === req.requesterUid}
                        onClick={async () => {
                          setBusyUid(req.requesterUid);
                          try {
                            await onDeclineFriendRequest(req.requesterUid);
                          } finally {
                            setBusyUid(null);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-stone-500 dark:text-slate-400">
                Sent Requests ({outgoingRequests.length})
              </p>
              {outgoingRequests.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-slate-400 py-2">
                  No pending outgoing requests.
                </p>
              ) : (
                outgoingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={req.targetName} src={req.targetPhoto} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                          {req.targetName}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                          @{req.targetHandle} · Waiting for approval
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busyUid === req.targetUid}
                      onClick={async () => {
                        setBusyUid(req.targetUid);
                        try {
                          await onRemoveFriendRelation(req.targetUid);
                        } finally {
                          setBusyUid(null);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-slate-300 text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ADD FRIEND BY @HANDLE (STRICTLY SEARCH-ONLY, NEVER SHOWS TOTAL APP USERS) */}
        {activeTab === 'find' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Enter exact @handle or friend's name..."
                autoFocus
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {normalized.length < 2 ? (
              <p className="text-xs text-stone-500 dark:text-slate-400 text-center py-8 px-4">
                Type at least 2 characters of someone&apos;s @handle or name to view their profile, follow them, or send a separate app chat request.
              </p>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-slate-400 text-center py-8">
                No matching user found for &ldquo;{queryText.trim()}&rdquo;.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {searchResults.map((member) => {
                  const isFriend = friendUids.has(member.uid);
                  const isIncoming = incomingRequestUids.has(member.uid);
                  const isOutgoing = outgoingRequestUids.has(member.uid);
                  const isFollowing = Boolean(myFollowingUids?.has(member.uid));
                  return (
                    <div
                      key={member.uid}
                      className="px-3 py-2.5 rounded-xl bg-stone-50/70 dark:bg-slate-900/70 border border-stone-200/70 dark:border-slate-800 flex items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (onViewProfile) {
                            onClose();
                            onViewProfile(member);
                          }
                        }}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <Avatar name={member.displayName} src={member.photoUrl} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                            {member.displayName}
                          </p>
                          <p className="text-xs font-mono-tabular text-emerald-700 dark:text-emerald-400 truncate">
                            @{member.handle}
                          </p>
                          {member.bio && (
                            <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate mt-0.5">
                              {member.bio}
                            </p>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {onToggleFollow && (
                          <button
                            type="button"
                            disabled={busyUid === `follow_${member.uid}`}
                            onClick={async () => {
                              setBusyUid(`follow_${member.uid}`);
                              try {
                                await onToggleFollow(
                                  {
                                    uid: member.uid,
                                    displayName: member.displayName,
                                    handle: member.handle,
                                    photoUrl: member.photoUrl,
                                  },
                                  isFollowing ? 'unfollow' : 'follow'
                                );
                              } finally {
                                setBusyUid(null);
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                              isFollowing
                                ? 'bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-slate-200'
                                : 'bg-accent text-white hover:opacity-90'
                            }`}
                          >
                            {isFollowing ? 'Following' : 'Follow'}
                          </button>
                        )}

                        {isFriend ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await onStartDM(member);
                              onClose();
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Chat
                          </button>
                        ) : isIncoming ? (
                          <button
                            type="button"
                            disabled={busyUid === member.uid}
                            onClick={async () => {
                              setBusyUid(member.uid);
                              try {
                                await onAcceptFriendRequest(member.uid);
                              } finally {
                                setBusyUid(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Accept</span>
                          </button>
                        ) : isOutgoing ? (
                          <button
                            type="button"
                            disabled={busyUid === member.uid}
                            onClick={async () => {
                              setBusyUid(member.uid);
                              try {
                                await onRemoveFriendRelation(member.uid);
                              } finally {
                                setBusyUid(null);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                          >
                            Requested
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyUid === member.uid}
                            onClick={async () => {
                              setBusyUid(member.uid);
                              try {
                                await onSendFriendRequest(member);
                              } finally {
                                setBusyUid(null);
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-[#1C2128] text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold cursor-pointer"
                          >
                            Request Chat
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/* =========================================================
 * 6. PROFILE & ACCOUNT SETTINGS MODAL
 * ========================================================= */
export function ProfileSettingsModal({
  profile,
  userPrivate,
  profilesByUid,
  pushPermission = 'default',
  pushDeviceCount = 0,
  pushBusy = false,
  iosNeedsHomeScreen = false,
  onClose,
  onSaveProfile,
  onTogglePush,
  onSendTestPush,
  onUnblockUser,
  onSignOut,
}: {
  profile: Profile;
  userPrivate: UserPrivate;
  profilesByUid: Record<string, Profile>;
  pushPermission?: PushPermissionState;
  pushDeviceCount?: number;
  pushBusy?: boolean;
  iosNeedsHomeScreen?: boolean;
  onClose: () => void;
  onSaveProfile: (updates: {
    displayName: string;
    handle: string;
    bio: string;
    majorOrClub: string;
    photoUrl: string;
    status: OnlineStatus;
    statusMessage: string;
  }) => Promise<void>;
  onTogglePush: (enabled: boolean) => Promise<void>;
  onSendTestPush?: () => Promise<void>;
  onUnblockUser: (uid: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const [settingsSection, setSettingsSection] = useState<'photo' | 'account'>('photo');
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio);
  const [majorOrClub, setMajorOrClub] = useState(profile.majorOrClub);
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl);
  const [status, setStatus] = useState<OnlineStatus>(profile.status);
  const [statusMessage, setStatusMessage] = useState(profile.statusMessage);
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean;
    reason?: string;
  }>({ checking: false, available: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cleaned = handle.trim().replace(/^@/, '').toLowerCase();
    if (cleaned === profile.handle.toLowerCase()) {
      setUsernameStatus({ checking: false, available: true });
      return;
    }
    if (cleaned.length < 2) {
      setUsernameStatus({ checking: false, available: false, reason: 'At least 2 characters' });
      return;
    }
    let cancelled = false;
    setUsernameStatus({ checking: true, available: true });
    const timer = window.setTimeout(async () => {
      const res = await checkUsernameAvailability(cleaned, profile.uid);
      if (!cancelled) {
        setUsernameStatus({
          checking: false,
          available: res.available,
          reason: res.reason,
        });
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [handle, profile.handle, profile.uid]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImageToDataUrl(file, 320, LIMITS.PHOTO_URL_MAX);
      setPhotoUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process profile picture.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameStatus.available) {
      setSettingsSection('account');
      setError(usernameStatus.reason || 'Choose an available username.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSaveProfile({
        displayName,
        handle,
        bio,
        majorOrClub,
        photoUrl,
        status,
        statusMessage,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Profile & Account Settings"
      subtitle={`@${profile.handle} · ${userPrivate.email}`}
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Clearly Separated Tabs: Profile Picture vs Account Name/@username/Bio */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setSettingsSection('photo')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              settingsSection === 'photo'
                ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-slate-400'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Profile Picture</span>
          </button>
          <button
            type="button"
            onClick={() => setSettingsSection('account')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              settingsSection === 'account'
                ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                : 'text-stone-600 dark:text-slate-400'
            }`}
          >
            <AtSign className="w-3.5 h-3.5" />
            <span>Name, @Username &amp; Bio</span>
          </button>
        </div>

        {/* SECTION 1: SEPARATE PROFILE PICTURE STUDIO */}
        {settingsSection === 'photo' && (
          <div className="space-y-4 p-4 rounded-2xl bg-stone-50/80 dark:bg-slate-900/60 border border-stone-200/80 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={displayName} src={photoUrl} size="xl" status={status} showStatus />
              <div className="space-y-2 flex-1 min-w-[200px]">
                <p className="text-xs font-bold text-stone-900 dark:text-white">
                  Your Separate Profile Picture
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 cursor-pointer">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(generateRandomAvatarUrl(photoUrl))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-soft text-accent-soft hover:opacity-85 transition-opacity cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Random Avatar</span>
                  </button>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 dark:text-slate-400">
                  Upload your own photo from gallery or pick a unique avatar below.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-stone-200/70 dark:border-slate-800">
              <p className="text-[11px] font-semibold text-stone-600 dark:text-slate-400">
                Choose Avatar Preset
              </p>
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
                {AVATAR_PRESETS.map((preset) => {
                  const selected = photoUrl === preset.dataUrl;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPhotoUrl(preset.dataUrl)}
                      title={preset.label}
                      aria-label={`Choose ${preset.label} avatar`}
                      className={`relative aspect-square rounded-full overflow-hidden border-2 transition-transform hover:scale-105 cursor-pointer ${
                        selected
                          ? 'border-emerald-600 dark:border-emerald-400 ring-2 ring-emerald-500/35 scale-105'
                          : 'border-stone-200 dark:border-slate-700'
                      }`}
                    >
                      <img
                        src={preset.dataUrl}
                        alt={preset.label}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: INSTAGRAM-STYLE NAME, @USERNAME & BIO */}
        {settingsSection === 'account' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                Account Identity
              </p>
              <button
                type="button"
                onClick={() => {
                  const combo = generateRandomProfileCombo(photoUrl);
                  setDisplayName(combo.displayName);
                  setHandle(combo.handle);
                  setMajorOrClub(combo.majorOrClub);
                  setBio(combo.bio);
                  setStatusMessage(combo.statusMessage);
                  setPhotoUrl(combo.photoUrl);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-accent-soft text-accent-soft cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Randomize Profile</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.DISPLAY_NAME_MAX}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">
                  Username (@handle)
                </label>
                <div className="relative">
                  <AtSign className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={LIMITS.HANDLE_MAX}
                    value={handle}
                    onChange={(e) =>
                      setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))
                    }
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-sm font-mono-tabular bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <p
                  className={`text-[10px] ${
                    usernameStatus.checking
                      ? 'text-stone-400'
                      : usernameStatus.available
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {usernameStatus.checking
                    ? 'Checking availability...'
                    : usernameStatus.available
                      ? `People can search @${handle} to view your account`
                      : usernameStatus.reason || 'Username already taken'}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">
                  Bio
                </label>
                <span className="text-[10px] text-stone-400 tabular-nums">
                  {bio.length}/{LIMITS.BIO_MAX}
                </span>
              </div>
              <textarea
                rows={3}
                maxLength={LIMITS.BIO_MAX}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write a short bio like Instagram..."
                className="w-full px-3 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">
                  Major or Primary Club
                </label>
                <input
                  type="text"
                  maxLength={LIMITS.MAJOR_MAX}
                  value={majorOrClub}
                  onChange={(e) => setMajorOrClub(e.target.value)}
                  placeholder="Computer Science · Robotics"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">
                  Online Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OnlineStatus)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="online">Online</option>
                  <option value="away">Away</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Appear Offline</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">
                Status note
              </label>
              <input
                type="text"
                maxLength={LIMITS.STATUS_MSG_MAX}
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder="In the library 3rd floor until 7 PM"
                className="w-full px-3 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        )}

        {/* Mobile Phone & App Push Notifications */}
        <div className="pt-3 border-t border-stone-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-900 dark:text-white flex items-center gap-1.5">
                  <span>Mobile Phone &amp; App Notifications</span>
                  {userPrivate.pushEnabled && pushPermission === 'granted' && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                      Active{pushDeviceCount > 0 ? ` · ${pushDeviceCount} device${pushDeviceCount === 1 ? '' : 's'}` : ''}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5">
                  Receive messages, calls, friend requests, and friend stories directly in your phone&apos;s notification tray — even when the app is minimized.
                </p>
                {iosNeedsHomeScreen && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                    iPhone/iPad: Tap Share → Add to Home Screen, then open Quadline from your Home Screen to enable phone notifications.
                  </p>
                )}
                {pushPermission === 'denied' && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                    Notifications are blocked in your phone browser. Tap the lock icon in the address bar → Permissions → Allow Notifications.
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={pushBusy}
              onClick={() => void onTogglePush(!(userPrivate.pushEnabled && pushPermission === 'granted'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer disabled:opacity-50 ${
                userPrivate.pushEnabled && pushPermission === 'granted'
                  ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                  : 'bg-accent text-white hover:opacity-90'
              }`}
            >
              {pushBusy
                ? 'Setting up...'
                : userPrivate.pushEnabled && pushPermission === 'granted'
                  ? 'Enabled'
                  : 'Enable on Phone'}
            </button>
          </div>

          {userPrivate.pushEnabled && pushPermission === 'granted' && onSendTestPush && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={pushBusy}
                onClick={() => void onSendTestPush()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-stone-200 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>Send Test Notification to Phone</span>
              </button>
            </div>
          )}
        </div>

        {/* Blocked Users */}
        {userPrivate.blockedUserIds.length > 0 && (
          <div className="pt-3 border-t border-stone-200 dark:border-slate-800 space-y-2">
            <p className="text-xs font-semibold text-stone-900 dark:text-white">
              Blocked Users ({userPrivate.blockedUserIds.length})
            </p>
            <div className="space-y-1.5">
              {userPrivate.blockedUserIds.map((uid) => (
                <div
                  key={uid}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-stone-50 dark:bg-slate-900"
                >
                  <span>{profilesByUid[uid]?.displayName || uid}</span>
                  <button
                    type="button"
                    onClick={() => void onUnblockUser(uid)}
                    className="text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-stone-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white cursor-pointer"
            >
              {busy ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

/* =========================================================
 * 6B. EDIT GROUP NAME & DESCRIPTION MODAL
 * ========================================================= */
export function EditGroupModal({
  room,
  onClose,
  onSave,
}: {
  room: Room;
  onClose: () => void;
  onSave: (updates: { name: string; description: string }) => Promise<void>;
}) {
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a group name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), description: description.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update group name.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Edit Group Details"
      subtitle="Update the group name and description — changes sync instantly for everyone."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">
            Group Name
          </label>
          <input
            type="text"
            required
            autoFocus
            maxLength={LIMITS.ROOM_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter new group name"
            className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <p className="text-[11px] text-stone-500 dark:text-slate-400 font-mono-tabular">
            {name.length} / {LIMITS.ROOM_NAME_MAX} characters
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">
            Description (optional)
          </label>
          <textarea
            rows={3}
            maxLength={LIMITS.ROOM_DESC_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this group about?"
            className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-white disabled:opacity-50 cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{busy ? 'Saving...' : 'Save Group Name'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* =========================================================
 * 7. CREATE POLL MODAL
 * ========================================================= */
export function CreatePollModal({
  onClose,
  onCreatePoll,
}: {
  onClose: () => void;
  onCreatePoll: (poll: PollData) => Promise<void>;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options
      .map((o) => o.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (!question.trim() || validOptions.length < 2 || busy) return;
    setBusy(true);
    try {
      await onCreatePoll({
        question: question.trim().slice(0, 180),
        options: validOptions.map((label, idx) => ({
          id: `opt_${idx + 1}`,
          label: label.slice(0, 90),
          voterIds: [],
        })),
        allowMultiple,
        closed: false,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Create a Quick Poll"
      subtitle="Gather fast club or study group decisions directly in chat."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Question</label>
          <input
            type="text"
            required
            maxLength={180}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Which day works best for review session?"
            className="w-full px-3.5 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Options</label>
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                required={idx < 2}
                maxLength={90}
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[idx] = e.target.value;
                  setOptions(next);
                }}
                placeholder={`Option ${idx + 1}`}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                  className="p-2 text-stone-400 hover:text-red-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {options.length < 5 && (
            <button
              type="button"
              onClick={() => setOptions([...options, ''])}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              + Add option
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-stone-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => setAllowMultiple(e.target.checked)}
            className="rounded border-stone-300 accent-emerald-700"
          />
          <span>Allow members to vote for multiple options</span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white cursor-pointer"
          >
            {busy ? 'Posting...' : 'Post Poll'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* =========================================================
 * 8. CREATE EVENT MODAL
 * ========================================================= */
export function CreateEventModal({
  onClose,
  onCreateEvent,
}: {
  onClose: () => void;
  onCreateEvent: (data: {
    title: string;
    description: string;
    location: string;
    startAt: string;
    endAt: string;
    coverImage: string;
    reminderMinutes: number;
  }) => Promise<void>;
}) {
  const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  defaultDate.setMinutes(0, 0, 0);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState(defaultDate.toISOString().slice(0, 16));
  const [description, setDescription] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [coverImage, setCoverImage] = useState<string>(CAMPUS_IMAGES.amphitheaterEvent);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !location.trim() || !startAt || busy) return;
    setBusy(true);
    try {
      await onCreateEvent({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        startAt,
        endAt: '',
        coverImage,
        reminderMinutes,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Schedule a Campus Event"
      subtitle="Post an RSVP card to this room and track attendance."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Event title</label>
          <input
            type="text"
            required
            maxLength={LIMITS.EVENT_TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Midterm Review & Pizza Night"
            className="w-full px-3.5 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Date & time</label>
            <input
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm font-mono-tabular bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Reminder</label>
            <select
              value={reminderMinutes}
              onChange={(e) => setReminderMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value={15}>15 minutes before</option>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={1440}>1 day before</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Location</label>
          <input
            type="text"
            required
            maxLength={LIMITS.EVENT_LOCATION_MAX}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Student Union Room 204 or North Quad Lawn"
            className="w-full px-3.5 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Details</label>
          <textarea
            rows={2}
            maxLength={LIMITS.EVENT_DESC_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Bring your laptop, agenda items, or questions."
            className="w-full px-3.5 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">Cover photo</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              CAMPUS_IMAGES.amphitheaterEvent,
              CAMPUS_IMAGES.welcomeQuad,
              CAMPUS_IMAGES.roboticsLab,
              CAMPUS_IMAGES.studyLounge,
            ].map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => setCoverImage(url)}
                className={`rounded-lg overflow-hidden border-2 cursor-pointer ${
                  coverImage === url ? 'border-emerald-600' : 'border-transparent opacity-75 hover:opacity-100'
                }`}
              >
                <img src={url} alt="Event cover option" referrerPolicy="no-referrer" className="w-full h-14 object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white cursor-pointer"
          >
            {busy ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* =========================================================
 * 9. REPORT MODAL
 * ========================================================= */
export function ReportModal({
  targetName,
  snippet,
  onClose,
  onSubmitReport,
}: {
  targetName: string;
  snippet?: string;
  onClose: () => void;
  onSubmitReport: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3 || busy) return;
    setBusy(true);
    try {
      await onSubmitReport(reason.trim());
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={`Report ${targetName}`}
      subtitle="Reports are reviewed confidentially by room moderators."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {snippet && (
          <div className="p-3 rounded-lg bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-xs text-stone-600 dark:text-slate-300">
            "{snippet}"
          </div>
        )}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">
            Why are you reporting this?
          </label>
          <textarea
            rows={3}
            required
            minLength={3}
            maxLength={LIMITS.REPORT_REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe harassment, spam, off-topic disruption, or campus policy violations."
            className="w-full px-3.5 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={reason.trim().length < 3 || busy}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white cursor-pointer"
          >
            {busy ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* =========================================================
 * 10. NOTIFICATIONS MODAL
 * ========================================================= */
export function NotificationsModal({
  notifications,
  incomingRequests = [],
  socialNotifications = [],
  myFollowingUids,
  pushEnabled = false,
  pushPermission = 'default',
  pushDeviceCount = 0,
  pushBusy = false,
  iosNeedsHomeScreen = false,
  onEnablePhonePush,
  onSendTestPush,
  onClose,
  onSelectNotification,
  onMarkAllRead,
  onAcceptRequest,
  onDeclineRequest,
  onFollowBack,
  onViewActorProfile,
  onMarkSocialNotificationRead,
}: {
  notifications: NotificationItem[];
  incomingRequests?: SocialRelation[];
  socialNotifications?: SocialAppNotification[];
  myFollowingUids?: Set<string>;
  pushEnabled?: boolean;
  pushPermission?: PushPermissionState;
  pushDeviceCount?: number;
  pushBusy?: boolean;
  iosNeedsHomeScreen?: boolean;
  onEnablePhonePush?: () => Promise<void>;
  onSendTestPush?: () => Promise<void>;
  onClose: () => void;
  onSelectNotification: (item: NotificationItem) => void;
  onMarkAllRead: () => void;
  onAcceptRequest?: (otherUid: string) => void;
  onDeclineRequest?: (otherUid: string) => void;
  onFollowBack?: (actor: {
    uid: string;
    displayName: string;
    handle: string;
    photoUrl: string;
  }) => void;
  onViewActorProfile?: (actor: {
    uid: string;
    displayName: string;
    handle: string;
    photoUrl: string;
  }) => void;
  onMarkSocialNotificationRead?: (id: string) => void;
}) {
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const unreadFirestore = notifications.filter((n) => !n.read);
  const unreadSocial = socialNotifications.filter((n) => !n.read);
  const totalUnreadMarkable = unreadFirestore.length + unreadSocial.length;
  const phoneAlertsActive = pushEnabled && pushPermission === 'granted';

  // Filter out socialNotifications of kind 'follow_request' that are ALREADY shown in the interactive Pending Requests section above
  const pendingRequesterUids = useMemo(
    () => new Set(incomingRequests.map((r) => r.requesterUid)),
    [incomingRequests]
  );

  const activitySocialItems = useMemo(
    () =>
      socialNotifications.filter(
        (sn) => !(sn.kind === 'follow_request' && !sn.read && pendingRequesterUids.has(sn.actorUid))
      ),
    [socialNotifications, pendingRequesterUids]
  );

  const hasAnyItems =
    incomingRequests.length > 0 || activitySocialItems.length > 0 || notifications.length > 0;

  const formatTimeAgo = (ts?: number | string) => {
    if (!ts) return '';
    const ms = typeof ts === 'number' ? ts : new Date(ts).getTime();
    const diffMs = Date.now() - ms;
    if (!Number.isFinite(diffMs) || diffMs < 60_000) return 'Just now';
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <ModalShell
      title="Notifications"
      subtitle="Follow requests, new followers, mentions, replies, and mobile phone alerts."
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Mobile Phone Push Notification Control Card */}
        <div className="p-3 rounded-xl border border-stone-200 dark:border-slate-800 bg-stone-50/90 dark:bg-slate-900/70 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  phoneAlertsActive
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                    : 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300'
                }`}
              >
                {phoneAlertsActive ? (
                  <BellRing className="w-4 h-4" />
                ) : (
                  <Smartphone className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-stone-900 dark:text-white">
                  {phoneAlertsActive
                    ? `Phone Notifications Active${pushDeviceCount > 0 ? ` (${pushDeviceCount} device${pushDeviceCount === 1 ? '' : 's'})` : ''}`
                    : 'Send Notifications to Your Phone'}
                </p>
                <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5">
                  {phoneAlertsActive
                    ? 'Chats, calls, follow requests & stories will pop up in your phone notification tray.'
                    : iosNeedsHomeScreen
                      ? 'On iPhone: tap Share → Add to Home Screen, then open Quadline to turn on phone notifications.'
                      : pushPermission === 'denied'
                        ? 'Blocked in phone browser settings. Allow notifications for this site to receive phone alerts.'
                        : 'Get real mobile phone notifications with sound & vibration even when Quadline is in the background.'}
                </p>
              </div>
            </div>

            {!phoneAlertsActive && onEnablePhonePush && pushPermission !== 'denied' && (
              <button
                type="button"
                disabled={pushBusy}
                onClick={() => void onEnablePhonePush()}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {pushBusy ? 'Enabling...' : 'Enable'}
              </button>
            )}
          </div>

          {phoneAlertsActive && onSendTestPush && (
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={pushBusy}
                onClick={() => void onSendTestPush()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-[#1C2128] border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>Send Test to Phone</span>
              </button>
            </div>
          )}
        </div>

        {/* Pending Follow & Chat Requests (Interactive Accept / Decline / View Profile) */}
        {incomingRequests.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-accent" />
                <span>Follow &amp; Chat Requests ({incomingRequests.length})</span>
              </h3>
              <span className="text-[11px] font-medium text-accent">Action needed</span>
            </div>

            <div className="space-y-2">
              {incomingRequests.map((req) => {
                const isBusy = busyUid === req.requesterUid;
                return (
                  <div
                    key={req.id || req.requesterUid}
                    className="p-3 rounded-xl border border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50/55 dark:bg-emerald-950/25 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (onViewActorProfile) {
                            onClose();
                            onViewActorProfile({
                              uid: req.requesterUid,
                              displayName: req.requesterName,
                              handle: req.requesterHandle,
                              photoUrl: req.requesterPhoto,
                            });
                          }
                        }}
                        className="shrink-0 cursor-pointer"
                        aria-label={`View ${req.requesterName}'s profile`}
                      >
                        <Avatar name={req.requesterName} src={req.requesterPhoto} size="sm" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (onViewActorProfile) {
                              onClose();
                              onViewActorProfile({
                                uid: req.requesterUid,
                                displayName: req.requesterName,
                                handle: req.requesterHandle,
                                photoUrl: req.requesterPhoto,
                              });
                            }
                          }}
                          className="text-left min-w-0 block cursor-pointer"
                        >
                          <p className="text-xs font-bold text-stone-900 dark:text-white truncate hover:underline">
                            {req.requesterName}
                          </p>
                          <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                            @{req.requesterHandle || 'member'} · wants to follow &amp; chat with you
                          </p>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onAcceptRequest && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setBusyUid(req.requesterUid);
                            void Promise.resolve(onAcceptRequest(req.requesterUid)).finally(() =>
                              setBusyUid(null)
                            );
                          }}
                          className="flex-1 min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>
                      )}
                      {onDeclineRequest && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setBusyUid(req.requesterUid);
                            void Promise.resolve(onDeclineRequest(req.requesterUid)).finally(() =>
                              setBusyUid(null)
                            );
                          }}
                          className="flex-1 min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-stone-200 dark:border-slate-700 bg-white dark:bg-[#1C2128] text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {totalUnreadMarkable > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Mark all as read ({totalUnreadMarkable})
            </button>
          </div>
        )}

        {!hasAnyItems ? (
          <div className="py-10 text-center space-y-1.5">
            <Bell className="w-6 h-6 mx-auto text-stone-400" />
            <p className="text-sm font-medium text-stone-700 dark:text-slate-300">
              You are all caught up
            </p>
            <p className="text-xs text-stone-500 dark:text-slate-400">
              Follow requests, new followers, mentions, and replies will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Social Notifications (New Followers, Accepted Requests, Follow Request History) */}
            {activitySocialItems.map((sn) => {
              const alreadyFollowing = Boolean(myFollowingUids && myFollowingUids.has(sn.actorUid));
              return (
                <div
                  key={sn.id}
                  onClick={() => {
                    if (!sn.read && onMarkSocialNotificationRead) {
                      onMarkSocialNotificationRead(sn.id);
                    }
                    if (onViewActorProfile) {
                      onClose();
                      onViewActorProfile({
                        uid: sn.actorUid,
                        displayName: sn.actorName,
                        handle: sn.actorHandle,
                        photoUrl: sn.actorPhoto,
                      });
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (!sn.read && onMarkSocialNotificationRead) {
                        onMarkSocialNotificationRead(sn.id);
                      }
                      if (onViewActorProfile) {
                        onClose();
                        onViewActorProfile({
                          uid: sn.actorUid,
                          displayName: sn.actorName,
                          handle: sn.actorHandle,
                          photoUrl: sn.actorPhoto,
                        });
                      }
                    }
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer flex items-center gap-3 ${
                    sn.read
                      ? 'border-stone-200 dark:border-slate-800 bg-white dark:bg-[#1C2128]'
                      : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30'
                  }`}
                >
                  <Avatar name={sn.actorName} src={sn.actorPhoto} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                        {sn.title}
                      </p>
                      <span className="text-[10px] text-stone-400 dark:text-slate-500 shrink-0 tabular-nums">
                        {!sn.read ? (
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            New
                          </span>
                        ) : (
                          formatTimeAgo(sn.createdAt)
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {sn.body}
                    </p>
                  </div>

                  {sn.kind === 'new_follower' && onFollowBack && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!sn.read && onMarkSocialNotificationRead) {
                          onMarkSocialNotificationRead(sn.id);
                        }
                        onFollowBack({
                          uid: sn.actorUid,
                          displayName: sn.actorName,
                          handle: sn.actorHandle,
                          photoUrl: sn.actorPhoto,
                        });
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 cursor-pointer transition-colors ${
                        alreadyFollowing
                          ? 'border border-stone-200 dark:border-slate-700 text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
                          : 'bg-accent text-white hover:opacity-90'
                      }`}
                    >
                      {alreadyFollowing ? 'Following' : 'Follow Back'}
                    </button>
                  )}
                </div>
              );
            })}

            {/* Chat / Mention / Reply / Group Join Notifications */}
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  onSelectNotification(n);
                  onClose();
                }}
                className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                  n.read
                    ? 'border-stone-200 dark:border-slate-800 bg-white dark:bg-[#1C2128]'
                    : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                    {n.title}
                  </p>
                  {!n.read && (
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
                      New
                    </span>
                  )}
                </div>
                {n.body && (
                  <p className="text-xs text-stone-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {n.body}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/* =========================================================
 * 11. QUICK SWITCHER (⌘K) & KEYBOARD SHORTCUTS MODAL
 * ========================================================= */
export function QuickSwitcherModal({
  rooms,
  profiles,
  currentUid,
  onClose,
  onSelectRoom,
  onStartDM,
}: {
  rooms: Room[];
  profiles: Profile[];
  currentUid: string;
  onClose: () => void;
  onSelectRoom: (roomId: string) => void;
  onStartDM: (profile: Profile) => void;
}) {
  const [queryText, setQueryText] = useState('');
  const q = queryText.trim().toLowerCase();

  const matchingRooms = rooms
    .filter((r) => r.visibility !== 'dm')
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.slug.includes(q))
    .slice(0, 6);

  const matchingProfiles = profiles
    .filter((p) => p.uid !== currentUid)
    .filter((p) => !q || p.displayName.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q))
    .slice(0, 5);

  return (
    <ModalShell title="Quick Jump" subtitle="Switch groups or jump to an accepted friend chat." onClose={onClose}>
      <div className="space-y-4">
        <input
          type="search"
          autoFocus
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Type a group name or friend @handle..."
          className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />

        {matchingRooms.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-stone-500 dark:text-slate-400 px-2">Groups</p>
            {matchingRooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onSelectRoom(r.id);
                  onClose();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
              >
                {r.visibility === 'private' ? (
                  <Lock className="w-3.5 h-3.5 text-stone-400" />
                ) : (
                  <Hash className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                )}
                <span className="font-medium text-stone-900 dark:text-white">{r.name}</span>
                <span className="text-xs text-stone-400 capitalize ml-auto">{r.category}</span>
              </button>
            ))}
          </div>
        )}

        {matchingProfiles.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-stone-500 dark:text-slate-400 px-2">Friends</p>
            {matchingProfiles.map((p) => (
              <button
                key={p.uid}
                type="button"
                onClick={() => {
                  onStartDM(p);
                  onClose();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
              >
                <Avatar name={p.displayName} src={p.photoUrl} size="xs" />
                <span className="font-medium text-stone-900 dark:text-white">{p.displayName}</span>
                <span className="text-xs font-mono-tabular text-stone-400 ml-auto">@{p.handle}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: '⌘K / Ctrl+K', action: 'Open Quick Jump switcher' },
    { keys: '⌘F / Ctrl+F', action: 'Search messages in current room' },
    { keys: 'Shift + ?', action: 'Open keyboard shortcuts' },
    { keys: 'Enter', action: 'Send message' },
    { keys: 'Shift + Enter', action: 'Insert new line in composer' },
    { keys: '↑ (empty input)', action: 'Edit your most recent message' },
    { keys: '@handle', action: 'Mention a room member with live autocomplete' },
    { keys: 'Esc', action: 'Close active modal, cancel reply, or cancel edit' },
  ];

  return (
    <ModalShell title="Keyboard Shortcuts" subtitle="Navigate Quadline without leaving the keyboard." onClose={onClose}>
      <ul className="divide-y divide-stone-100 dark:divide-slate-800">
        {shortcuts.map((item) => (
          <li key={item.keys} className="py-2.5 flex items-center justify-between gap-4 text-xs sm:text-sm">
            <span className="text-stone-700 dark:text-slate-300">{item.action}</span>
            <kbd className="font-mono-tabular text-xs px-2 py-1 rounded bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-200 whitespace-nowrap">
              {item.keys}
            </kbd>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
}
