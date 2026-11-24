import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AtSign,
  Bell,
  BellRing,
  Compass,
  Film,
  KeyRound,
  Keyboard,
  Lock,
  MessageCircle,
  MessageSquarePlus,
  Mic,
  Moon,
  Palette,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Sun,
  Trash2,
  Unlock,
  User,
  UserCheck,
  UserPlus,
  Users,
  Video,
  VolumeX,
  X,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { PWAInstallButton } from './PWAInstallButton';
import { StoriesTray, type StoryGroup } from './StoriesComponents';
import { formatLiveActivity, formatTimestamp } from '../lib/validation';
import {
  searchAccountsByUsername,
  type CallHistoryRecord,
  type SocialRelation,
} from '../lib/backendApi';
import type {
  CallMode,
  LivePresenceEntry,
  OnlineStatus,
  Profile,
  Room,
  TypingUser,
  UserPrivate,
} from '../types/chat';

export type SidebarSectionTab = 'chats' | 'groups' | 'reels' | 'dms' | 'calls';

interface SidebarProps {
  profile: Profile;
  userPrivate: UserPrivate;
  joinedRooms: Room[];
  dmRooms: Room[];
  friendProfiles: Profile[];
  incomingFriendRequests: SocialRelation[];
  profilesByUid: Record<string, Profile>;
  presenceMap: Record<string, LivePresenceEntry>;
  typingByRoom: Record<string, TypingUser[]>;
  callHistory: CallHistoryRecord[];
  activeRoomId: string | null;
  activeTab: SidebarSectionTab;
  unreadNotificationsCount: number;
  darkMode: boolean;
  chatOpen: boolean;
  mobileOpen: boolean;
  hideMessagePreviews?: boolean;
  lockedRoomIds?: string[];
  lockedVaultUnlocked?: boolean;
  onRequestToggleLockedVault?: () => void;
  onOpenPrivacy?: () => void;
  onChangeTab: (tab: SidebarSectionTab) => void;
  onCloseMobile: () => void;
  onSelectRoom: (roomId: string) => void;
  onStartDM: (target: Profile) => void;
  onAcceptFriendRequest: (otherUid: string) => void;
  onDeclineFriendRequest: (otherUid: string) => void;
  onOpenDiscover: () => void;
  onOpenCreateRoom: () => void;
  onOpenJoinByCode: () => void;
  onOpenNewDM: () => void;
  onOpenProfileModal: () => void;
  onOpenNotifications: () => void;
  onOpenQuickSwitcher: () => void;
  onOpenShortcuts: () => void;
  onOpenThemes: () => void;
  onToggleTheme: () => void;
  onChangeStatus: (status: OnlineStatus) => void;
  onStartCall: (target: Profile, mode: CallMode) => void;
  onStartCallCheck: (mode: CallMode) => void;
  onDeleteCallLog: (callId: string) => void;
  onQuickRandomProfile?: () => void;
  storyGroups: StoryGroup[];
  onOpenCreateStory: () => void;
  onOpenStoryGroup: (authorUid: string) => void;
  onViewProfile: (target: Profile) => void;
  showPhonePushBanner?: boolean;
  phonePushBusy?: boolean;
  onEnablePhonePush?: () => void;
  onDismissPhonePushBanner?: () => void;
}

const STATUS_LABELS: Record<OnlineStatus, string> = {
  online: 'Online',
  away: 'Away',
  busy: 'Busy',
  offline: 'Offline',
};

const GROUP_AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-teal-600',
  'bg-sky-600',
  'bg-indigo-600',
  'bg-amber-600',
  'bg-rose-600',
];

function getGroupInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'GR';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function getGroupColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return GROUP_AVATAR_COLORS[hash % GROUP_AVATAR_COLORS.length];
}

function formatDurationCompact(sec: number): string {
  if (!sec || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatCallTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const Sidebar = React.memo(function Sidebar({
  profile,
  userPrivate,
  joinedRooms,
  dmRooms,
  friendProfiles,
  incomingFriendRequests,
  profilesByUid,
  presenceMap,
  typingByRoom,
  callHistory,
  activeRoomId,
  activeTab,
  unreadNotificationsCount,
  darkMode,
  chatOpen,
  mobileOpen,
  hideMessagePreviews = false,
  lockedRoomIds = [],
  lockedVaultUnlocked = false,
  onRequestToggleLockedVault,
  onOpenPrivacy,
  onChangeTab,
  onCloseMobile,
  onSelectRoom,
  onStartDM,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onOpenDiscover,
  onOpenCreateRoom,
  onOpenJoinByCode,
  onOpenNewDM,
  onOpenProfileModal,
  onOpenNotifications,
  onOpenQuickSwitcher,
  onOpenShortcuts,
  onOpenThemes,
  onToggleTheme,
  onChangeStatus,
  onStartCall,
  onStartCallCheck,
  onDeleteCallLog,
  onQuickRandomProfile,
  storyGroups,
  onOpenCreateStory,
  onOpenStoryGroup,
  onViewProfile,
  showPhonePushBanner = false,
  phonePushBusy = false,
  onEnablePhonePush,
  onDismissPhonePushBanner,
}: SidebarProps) {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [usernameMatches, setUsernameMatches] = useState<Profile[]>([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const cleaned = filterQuery.trim().replace(/^@/, '').toLowerCase();
    if (cleaned.length < 2) {
      setUsernameMatches([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const localMap = new Map<string, Profile>();
      for (const p of Object.values(profilesByUid)) {
        if (p.uid === profile.uid) continue;
        if (
          p.handle.toLowerCase().includes(cleaned) ||
          p.displayName.toLowerCase().includes(cleaned)
        ) {
          localMap.set(p.uid, p);
        }
      }
      const remote = await searchAccountsByUsername(cleaned, profile.uid);
      if (cancelled) return;
      for (const acc of remote) {
        if (acc.uid === profile.uid || localMap.has(acc.uid)) continue;
        localMap.set(acc.uid, {
          uid: acc.uid,
          displayName: acc.displayName,
          handle: acc.handle,
          bio: acc.bio || '',
          photoUrl: acc.photoUrl || '',
          majorOrClub: '',
          status: presenceMap[acc.uid]?.status || 'offline',
          statusMessage: '',
          discoverable: true,
          lastSeenAt: null,
          createdAt: null,
          updatedAt: null,
        });
      }
      setUsernameMatches(Array.from(localMap.values()).slice(0, 6));
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filterQuery, profilesByUid, profile.uid, presenceMap]);

  const getDmPeer = (room: Room): Profile | null => {
    const peerUid = room.dmParticipantIds.find((id) => id !== profile.uid);
    if (!peerUid) return null;
    return profilesByUid[peerUid] || null;
  };

  const getLiveStatus = (uid: string, fallback: OnlineStatus): OnlineStatus => {
    const live = presenceMap[uid];
    return live ? live.status : fallback;
  };

  const isMuted = (roomId: string) =>
    userPrivate.mutedRoomIds.includes(roomId) ||
    userPrivate.roomNotificationPrefs[roomId] === 'mute';

  const normalizedQuery = filterQuery.trim().toLowerCase();

  const lockedSet = useMemo(() => new Set(lockedRoomIds), [lockedRoomIds]);

  const lockedRoomsList = useMemo(() => {
    const all = [...joinedRooms, ...dmRooms];
    return all.filter((r) => lockedSet.has(r.id));
  }, [joinedRooms, dmRooms, lockedSet]);

  const filteredGroups = useMemo(() => {
    const unlocked = joinedRooms.filter((r) => !lockedSet.has(r.id));
    if (!normalizedQuery) return unlocked;
    return unlocked.filter(
      (r) =>
        r.name.toLowerCase().includes(normalizedQuery) ||
        (!hideMessagePreviews && r.lastMessageText.toLowerCase().includes(normalizedQuery)) ||
        r.description.toLowerCase().includes(normalizedQuery)
    );
  }, [joinedRooms, normalizedQuery, lockedSet, hideMessagePreviews]);

  const filteredDms = useMemo(() => {
    const unlocked = dmRooms.filter((dm) => !lockedSet.has(dm.id));
    if (!normalizedQuery) return unlocked;
    return unlocked.filter((dm) => {
      const peer = getDmPeer(dm);
      const label = (peer?.displayName || dm.name).toLowerCase();
      return (
        label.includes(normalizedQuery) ||
        (!hideMessagePreviews && dm.lastMessageText.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [dmRooms, normalizedQuery, profilesByUid, lockedSet, hideMessagePreviews]);

  const filteredFriends = useMemo(() => {
    const list = friendProfiles.filter((p) => p.uid !== profile.uid);
    if (!normalizedQuery) return list;
    return list.filter(
      (p) =>
        p.displayName.toLowerCase().includes(normalizedQuery) ||
        p.handle.toLowerCase().includes(normalizedQuery)
    );
  }, [friendProfiles, profile.uid, normalizedQuery]);

  const getRoomLiveActivity = (roomId: string) => {
    const others = (typingByRoom[roomId] || []).filter((u) => u.uid !== profile.uid);
    return formatLiveActivity(others, true);
  };

  const renderWhatsAppGroupRow = (room: Room) => {
    const active = room.id === activeRoomId;
    const muted = isMuted(room.id);
    const timeLabel = room.lastMessageAt ? formatTimestamp(room.lastMessageAt) : '';
    const liveActivity = getRoomLiveActivity(room.id);

    return (
      <li key={room.id} className="msg-row-perf">
        <motion.button
          type="button"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.982 }}
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          onClick={() => {
            onSelectRoom(room.id);
            onCloseMobile();
          }}
          className={`relative w-full text-left px-2.5 py-2.5 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
            active
              ? 'bg-accent-soft text-stone-950 dark:text-white'
              : 'text-stone-800 dark:text-slate-200 hover:bg-stone-200/60 dark:hover:bg-slate-800/70'
          }`}
        >
          {/* WhatsApp-style Circular Group Avatar */}
          <div className="relative w-11 h-11 rounded-full shrink-0">
            {room.coverImage ? (
              <img
                src={room.coverImage}
                alt={room.name}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border border-stone-200 dark:border-slate-700"
              />
            ) : (
              <div
                className={`w-11 h-11 rounded-full ${getGroupColorClass(room.id)} text-white font-display text-xs font-bold flex items-center justify-center`}
              >
                {getGroupInitials(room.name)}
              </div>
            )}
            {room.visibility === 'private' && (
              <span
                title="Private group"
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-stone-900 dark:bg-slate-950 text-white border border-white dark:border-slate-800 flex items-center justify-center"
              >
                <Lock className="w-2.5 h-2.5" />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 border-b border-stone-200/60 dark:border-slate-800/60 pb-2.5 -mb-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm truncate ${active ? 'font-bold' : 'font-semibold'}`}>
                {room.name}
              </span>
              {timeLabel && (
                <span
                  className={`text-[11px] font-mono-tabular shrink-0 ${
                    active || liveActivity
                      ? 'text-accent font-medium'
                      : 'text-stone-400 dark:text-slate-500'
                  }`}
                >
                  {timeLabel}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              {liveActivity ? (
                <p className="text-xs font-semibold text-accent truncate flex items-center gap-1">
                  {(liveActivity.kind === 'recording_voice' ||
                    liveActivity.kind === 'sending_voice') && (
                    <Mic className="w-3 h-3 shrink-0 animate-pulse" />
                  )}
                  <span className="truncate">{liveActivity.text}</span>
                </p>
              ) : (
                <p className="text-xs font-normal text-stone-500 dark:text-slate-400 truncate">
                  {hideMessagePreviews || lockedSet.has(room.id)
                    ? 'Private message'
                    : room.lastMessageText || room.description || `${room.memberCount} members`}
                </p>
              )}
              <div className="flex items-center gap-1 shrink-0">
                {muted && (
                  <VolumeX
                    aria-label="Muted"
                    className="w-3.5 h-3.5 text-stone-400 dark:text-slate-500"
                  />
                )}
                <span className="text-[11px] font-mono-tabular text-stone-400 dark:text-slate-500">
                  {room.memberCount}
                </span>
              </div>
            </div>
          </div>
        </motion.button>
      </li>
    );
  };

  const renderDmRow = (dm: Room) => {
    const peer = getDmPeer(dm);
    const active = dm.id === activeRoomId;
    const peerName = peer ? peer.displayName : dm.name;
    const peerStatus = peer ? getLiveStatus(peer.uid, peer.status) : 'offline';
    const timeLabel = dm.lastMessageAt ? formatTimestamp(dm.lastMessageAt) : '';
    const liveActivity = getRoomLiveActivity(dm.id);

    return (
      <li key={dm.id} className="msg-row-perf">
        <motion.button
          type="button"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.982 }}
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          onClick={() => {
            onSelectRoom(dm.id);
            onCloseMobile();
          }}
          className={`w-full text-left px-2.5 py-2.5 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
            active
              ? 'bg-accent-soft text-stone-950 dark:text-white'
              : 'text-stone-800 dark:text-slate-200 hover:bg-stone-200/60 dark:hover:bg-slate-800/70'
          }`}
        >
          <Avatar name={peerName} src={peer?.photoUrl} size="md" status={peerStatus} showStatus />
          <div className="min-w-0 flex-1 border-b border-stone-200/60 dark:border-slate-800/60 pb-2.5 -mb-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-sm truncate ${active ? 'font-bold' : 'font-semibold'}`}>
                {peerName}
              </p>
              {timeLabel && (
                <span
                  className={`text-[11px] font-mono-tabular shrink-0 ${
                    liveActivity ? 'text-accent font-medium' : 'text-stone-400 dark:text-slate-500'
                  }`}
                >
                  {timeLabel}
                </span>
              )}
            </div>
            {liveActivity ? (
              <p className="text-xs font-semibold text-accent truncate mt-0.5 flex items-center gap-1">
                {(liveActivity.kind === 'recording_voice' ||
                  liveActivity.kind === 'sending_voice') && (
                  <Mic className="w-3 h-3 shrink-0 animate-pulse" />
                )}
                <span className="truncate">{liveActivity.text}</span>
              </p>
            ) : (
              <p className="text-xs font-normal text-stone-500 dark:text-slate-400 truncate mt-0.5">
                {hideMessagePreviews || lockedSet.has(dm.id)
                  ? 'Private message'
                  : dm.lastMessageText || STATUS_LABELS[peerStatus]}
              </p>
            )}
          </div>
        </motion.button>
      </li>
    );
  };

  const buildSidebarBody = (isDrawer: boolean) => (
    <aside
      aria-label="Workspace navigation"
      className={`h-full shrink-0 bg-[#F4F3EF] dark:bg-[#12161D] border-r border-stone-200/90 dark:border-slate-800/90 flex flex-col select-none ${
        isDrawer ? 'w-[320px] max-w-[90vw] shadow-2xl' : 'w-full lg:w-[360px] xl:w-[390px]'
      }`}
    >
      {/* Top Brand & Utility Bar */}
      <div className="h-14 px-4 border-b border-stone-200/90 dark:border-slate-800/90 flex items-center justify-between gap-2 shrink-0 bg-white/80 dark:bg-[#161B22]/90">
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <img
            src="/app-logo.png"
            alt="Quadline app logo"
            className="w-7 h-7 rounded-lg shrink-0 object-cover shadow-xs"
          />
          <span className="font-display text-base font-extrabold tracking-tight text-stone-900 dark:text-white whitespace-nowrap shrink-0">
            Quadline
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {onOpenPrivacy && (
            <button
              type="button"
              onClick={onOpenPrivacy}
              aria-label="Chat privacy and lock settings"
              title="Chat Privacy & Lock"
              className="p-2 rounded-lg text-accent hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenThemes}
            aria-label="Themes and saved data"
            title="Themes & saved data"
            className="p-2 rounded-lg text-stone-600 dark:text-slate-300 hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Palette className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label={`Notifications${unreadNotificationsCount > 0 ? `, ${unreadNotificationsCount} unread` : ''}`}
            title="Notifications"
            className="relative p-2 rounded-lg text-stone-600 dark:text-slate-300 hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent-solid text-white text-[10px] font-mono-tabular font-semibold flex items-center justify-center">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            title={darkMode ? 'Light mode' : 'Dark mode'}
            className="p-2 rounded-lg text-stone-600 dark:text-slate-300 hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {isDrawer && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close chat list"
              className="p-2 rounded-lg text-stone-600 dark:text-slate-300 hover:bg-stone-200/70 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* In-App Android / Mobile PWA Install Prompt & One-Tap Phone Notifications Banner */}
      <div className="px-3 pt-2.5 shrink-0 space-y-2 empty:hidden">
        <PWAInstallButton variant="banner" />
        {showPhonePushBanner && onEnablePhonePush && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-900/60">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-stone-900 dark:text-white leading-tight">
                Phone Notifications
              </p>
              <p className="text-[11px] text-stone-600 dark:text-slate-400 leading-snug truncate">
                Get alerts on your mobile phone
              </p>
            </div>
            <button
              type="button"
              disabled={phonePushBusy}
              onClick={onEnablePhonePush}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shrink-0 cursor-pointer disabled:opacity-50"
            >
              {phonePushBusy ? '...' : 'Turn On'}
            </button>
            {onDismissPhonePushBanner && (
              <button
                type="button"
                onClick={onDismissPhonePushBanner}
                aria-label="Dismiss phone notification banner"
                className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 5-Option Segmented Tabs (Desktop / Tablet top bar) */}
      <div className="hidden lg:block px-3 pt-3 pb-2 shrink-0">
        <div
          role="tablist"
          aria-label="Workspace sections"
          className="grid grid-cols-5 gap-0.5 p-1 rounded-xl bg-stone-200/75 dark:bg-slate-800/80"
        >
          {(
            [
              { id: 'chats', label: 'Chats', icon: MessageCircle },
              { id: 'groups', label: 'Groups', icon: Users },
              { id: 'reels', label: 'Reels', icon: Film },
              { id: 'dms', label: 'DMs', icon: User },
              { id: 'calls', label: 'Calls', icon: Phone },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChangeTab(tab.id)}
                className={`relative py-2 px-1 rounded-lg text-[10px] font-semibold flex flex-col items-center justify-center gap-0.5 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'text-stone-900 dark:text-white'
                    : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active-tab"
                    transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                    className="absolute inset-0 rounded-lg bg-white dark:bg-[#1C2128] shadow-xs"
                  />
                )}
                <Icon className={`relative z-10 w-3.5 h-3.5 shrink-0 ${active ? 'text-accent' : ''}`} />
                <span className="relative z-10">{tab.label}</span>
                {tab.id === 'dms' && incomingFriendRequests.length > 0 && (
                  <span className="absolute top-1 right-1 z-20 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {incomingFriendRequests.length > 9 ? '9+' : incomingFriendRequests.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search / Quick Jump Input */}
      <div className="px-3 pb-2 shrink-0 flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={
              activeTab === 'calls'
                ? 'Search friends, @username or calls...'
                : activeTab === 'groups'
                  ? 'Search groups or @username...'
                  : activeTab === 'dms'
                    ? 'Type @username to view account...'
                    : 'Search chats or type @username...'
            }
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 text-xs text-stone-900 dark:text-slate-100 placeholder:text-stone-400 focus:outline-none focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={onOpenQuickSwitcher}
          title="Quick jump (⌘K)"
          aria-label="Open quick switcher"
          className="px-2 py-2 rounded-xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 text-[11px] font-mono-tabular text-stone-500 dark:text-slate-400 hover:border-stone-300 dark:hover:border-slate-700 shrink-0 cursor-pointer"
        >
          ⌘K
        </button>
      </div>

      {/* Live @username Account Lookup Dropdown (strictly search-only, never shows total users) */}
      {usernameMatches.length > 0 && (
        <div className="px-3 pb-2 shrink-0">
          <div className="rounded-xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500 dark:text-slate-400 border-b border-stone-100 dark:border-slate-800 flex items-center gap-1">
              <AtSign className="w-3 h-3 text-accent" />
              <span>Matching Accounts · Tap to View Profile</span>
            </p>
            <div className="divide-y divide-stone-100 dark:divide-slate-800/80 max-h-48 overflow-y-auto">
              {usernameMatches.map((acc) => (
                <button
                  key={acc.uid}
                  type="button"
                  onClick={() => {
                    onViewProfile(acc);
                    setFilterQuery('');
                    onCloseMobile();
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2.5 text-left hover:bg-stone-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                >
                  <Avatar name={acc.displayName} src={acc.photoUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                      {acc.displayName}
                    </p>
                    <p className="text-[11px] font-mono-tabular text-emerald-700 dark:text-emerald-400 truncate">
                      @{acc.handle}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300 shrink-0">
                    View
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Tab Content */}
      <div className="flex-1 scroll-pane px-2.5 py-1.5">
        <AnimatePresence mode="wait">
          {/* CHATS TAB (All Groups + Direct Chats like WhatsApp) */}
          {activeTab === 'chats' && (
            <motion.div
              key="tab-chats"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="space-y-4 pb-3"
            >
              {/* Instagram-Style Mutual Follow 24h Stories Bar */}
              <StoriesTray
                currentProfile={profile}
                storyGroups={storyGroups}
                onOpenCreateStory={() => {
                  onOpenCreateStory();
                  onCloseMobile();
                }}
                onOpenStoryGroup={(authorUid) => {
                  onOpenStoryGroup(authorUid);
                  onCloseMobile();
                }}
              />

              {/* Quick Discovery Row */}
              <div className="px-1 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onOpenDiscover();
                    onCloseMobile();
                  }}
                  className="px-2.5 py-2 rounded-xl text-xs font-medium bg-white dark:bg-[#161B22] border border-stone-200/80 dark:border-slate-800 text-stone-700 dark:text-slate-200 hover:border-stone-300 dark:hover:border-slate-700 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>Discover</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenJoinByCode();
                    onCloseMobile();
                  }}
                  className="px-2.5 py-2 rounded-xl text-xs font-medium bg-white dark:bg-[#161B22] border border-stone-200/80 dark:border-slate-800 text-stone-700 dark:text-slate-200 hover:border-stone-300 dark:hover:border-slate-700 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-stone-500 dark:text-slate-400 shrink-0" />
                  <span>Invite Code</span>
                </button>
              </div>

              {/* WhatsApp-Style Locked Chats Vault */}
              {lockedRoomsList.length > 0 && onRequestToggleLockedVault && (
                <section className="px-1 space-y-1.5">
                  <button
                    type="button"
                    onClick={onRequestToggleLockedVault}
                    className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#161B22] border border-stone-200/90 dark:border-slate-800 hover:border-accent flex items-center justify-between gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-accent-soft text-accent-soft flex items-center justify-center shrink-0">
                        {lockedVaultUnlocked ? (
                          <Unlock className="w-4 h-4" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                      </span>
                      <div className="min-w-0 text-left">
                        <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                          Locked Chats
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                          {lockedVaultUnlocked
                            ? 'Unlocked · Tap to relock'
                            : 'Protected with your 4-digit PIN'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono-tabular font-semibold text-accent shrink-0">
                      {lockedRoomsList.length}
                    </span>
                  </button>

                  {lockedVaultUnlocked && (
                    <ul className="space-y-0.5 pl-1 border-b border-stone-200/70 dark:border-slate-800 pb-2">
                      {lockedRoomsList.map((room) =>
                        room.visibility === 'dm'
                          ? renderDmRow(room)
                          : renderWhatsAppGroupRow(room)
                      )}
                    </ul>
                  )}
                </section>
              )}

              {/* Groups Section */}
              <section>
                <div className="flex items-center justify-between px-2 mb-1">
                  <h2 className="text-xs font-semibold text-stone-500 dark:text-slate-400">
                    Groups · <span className="tabular-nums">{filteredGroups.length}</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenCreateRoom();
                      onCloseMobile();
                    }}
                    aria-label="Create new group"
                    title="New group"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-accent hover:bg-stone-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Group</span>
                  </button>
                </div>

                {filteredGroups.length === 0 ? (
                  <div className="px-2.5 py-3 text-xs text-stone-500 dark:text-slate-400 space-y-1.5">
                    <p>No groups match your filter.</p>
                    <button
                      type="button"
                      onClick={onOpenDiscover}
                      className="text-accent font-medium hover:underline cursor-pointer"
                    >
                      Browse campus groups
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-0.5">{filteredGroups.map(renderWhatsAppGroupRow)}</ul>
                )}
              </section>

              {/* Direct Chats Section */}
              <section>
                <div className="flex items-center justify-between px-2 mb-1">
                  <h2 className="text-xs font-semibold text-stone-500 dark:text-slate-400">
                    Direct Chats · <span className="tabular-nums">{filteredDms.length}</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenNewDM();
                      onCloseMobile();
                    }}
                    aria-label="Start direct message"
                    title="New chat"
                    className="p-1.5 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {filteredDms.length === 0 ? (
                  <p className="px-2.5 py-2 text-xs text-stone-500 dark:text-slate-400">
                    Add &amp; accept a friend request to chat 1-to-1 privately.
                  </p>
                ) : (
                  <ul className="space-y-0.5">{filteredDms.map(renderDmRow)}</ul>
                )}
              </section>
            </motion.div>
          )}

          {/* GROUPS TAB (Dedicated WhatsApp-Style Groups Directory) */}
          {activeTab === 'groups' && (
            <motion.div
              key="tab-groups"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="space-y-3 pb-3"
            >
              <div className="px-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenCreateRoom();
                    onCloseMobile();
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-accent text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Group</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenDiscover();
                    onCloseMobile();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 text-stone-700 dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-accent" />
                  <span>Explore</span>
                </button>
              </div>

              {filteredGroups.length === 0 ? (
                <div className="px-3 py-8 text-center space-y-2">
                  <Users className="w-7 h-7 mx-auto text-stone-400 dark:text-slate-500" />
                  <p className="text-xs font-medium text-stone-700 dark:text-slate-300">
                    No groups yet
                  </p>
                  <p className="text-xs text-stone-500 dark:text-slate-400">
                    Create a club or class group, or explore open campus groups.
                  </p>
                </div>
              ) : (
                <ul className="space-y-0.5">{filteredGroups.map(renderWhatsAppGroupRow)}</ul>
              )}
            </motion.div>
          )}

          {/* REELS TAB (Quick Guide & Shortcuts beside Full-Screen Reels Player) */}
          {activeTab === 'reels' && (
            <motion.div
              key="tab-reels"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="space-y-3 pb-3 px-1"
            >
              <div className="rounded-2xl bg-gradient-to-br from-emerald-800 to-slate-900 text-white p-4 space-y-2 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <Film className="w-4 h-4" />
                  <span>Quadline Reels</span>
                </div>
                <p className="font-display text-sm font-bold">
                  Watch, like, comment &amp; post short campus Reels
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Scroll vertically with swipe or ↑/↓ arrows, double-tap to heart, upload videos up to 90 MB, and share any Reel directly into a chat.
                </p>
              </div>
              <div className="space-y-1.5">
                <p className="px-1 text-xs font-semibold text-stone-500 dark:text-slate-400">
                  Jump back to a chat
                </p>
                <ul className="space-y-0.5">
                  {filteredGroups.slice(0, 4).map(renderWhatsAppGroupRow)}
                </ul>
              </div>
            </motion.div>
          )}

          {/* DMS TAB (Friends-Only Private 1-to-1 Chats + Friend Requests) */}
          {activeTab === 'dms' && (
            <motion.div
              key="tab-dms"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="space-y-4 pb-3 px-0.5"
            >
              <div className="px-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onOpenNewDM();
                    onCloseMobile();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-accent text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>App Chat Requests &amp; Find People</span>
                  {incomingFriendRequests.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/25 text-white text-[10px] font-bold">
                      {incomingFriendRequests.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Pending Incoming App Chat Requests (Separate from Follow) */}
              {incomingFriendRequests.length > 0 && (
                <section className="space-y-1.5">
                  <h2 className="px-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>App Chat Requests · {incomingFriendRequests.length}</span>
                  </h2>
                  <ul className="space-y-1.5">
                    {incomingFriendRequests.map((req) => (
                      <li
                        key={req.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-[#161B22] border border-emerald-200 dark:border-emerald-900/50 space-y-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={req.requesterName} src={req.requesterPhoto} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                              {req.requesterName}
                            </p>
                            <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                              @{req.requesterHandle} wants to connect
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => onAcceptFriendRequest(req.requesterUid)}
                            className="py-1.5 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeclineFriendRequest(req.requesterUid)}
                            className="py-1.5 px-2.5 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-300 text-[11px] font-semibold cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Active 1-to-1 Direct Conversations (Friends Only) */}
              <section className="space-y-1">
                <h2 className="px-1.5 text-xs font-semibold text-stone-500 dark:text-slate-400">
                  Private Chats · <span className="tabular-nums">{filteredDms.length}</span>
                </h2>
                {filteredDms.length === 0 ? (
                  <p className="px-2.5 py-3 text-xs text-stone-500 dark:text-slate-400 bg-white/70 dark:bg-[#161B22]/70 rounded-xl border border-stone-200/70 dark:border-slate-800">
                    No private chats yet. Accept a friend request or tap a friend below to start talking 1-to-1.
                  </p>
                ) : (
                  <ul className="space-y-0.5">{filteredDms.map(renderDmRow)}</ul>
                )}
              </section>

              {/* Accepted Friends Only (Never displays global app users) */}
              <section className="space-y-1.5">
                <h2 className="px-1.5 text-xs font-semibold text-stone-500 dark:text-slate-400">
                  Your Friends · <span className="tabular-nums">{filteredFriends.length}</span>
                </h2>
                {filteredFriends.length === 0 ? (
                  <p className="px-2.5 py-3 text-xs text-stone-500 dark:text-slate-400 bg-white/70 dark:bg-[#161B22]/70 rounded-xl border border-stone-200/70 dark:border-slate-800">
                    Only accepted friends can message or call each other 1-to-1. Follow someone from a group or search by @handle above.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {filteredFriends.map((member) => {
                      const st = getLiveStatus(member.uid, member.status);
                      return (
                        <li
                          key={member.uid}
                          className="px-2.5 py-2 rounded-xl hover:bg-stone-200/60 dark:hover:bg-slate-800/70 flex items-center justify-between gap-2 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onStartDM(member);
                              onCloseMobile();
                            }}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <Avatar
                              name={member.displayName}
                              src={member.photoUrl}
                              size="sm"
                              status={st}
                              showStatus
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                                {member.displayName}
                              </p>
                              <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                                {STATUS_LABELS[st]} · @{member.handle}
                              </p>
                            </div>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onStartDM(member);
                                onCloseMobile();
                              }}
                              aria-label={`Direct message ${member.displayName}`}
                              title="Private message"
                              className="px-2.5 py-1.5 rounded-lg bg-accent-soft text-accent-soft hover:opacity-85 text-[11px] font-semibold transition-opacity cursor-pointer"
                            >
                              Message
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onStartCall(member, 'audio');
                                onCloseMobile();
                              }}
                              aria-label={`Voice call ${member.displayName}`}
                              title="Voice call"
                              className="p-1.5 rounded-lg text-stone-500 dark:text-slate-400 hover:text-accent hover:bg-accent-soft transition-colors cursor-pointer"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </motion.div>
          )}

          {/* CALLS TAB (Prominent Voice & Video Calls + Saved Call History) */}
          {activeTab === 'calls' && (
            <motion.div
              key="tab-calls"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="space-y-4 pb-3 px-0.5"
            >
              {/* Instant Voice & Video Call Stage Actions */}
              <div className="rounded-xl border border-accent bg-accent-soft p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-soft">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Start Voice or Video Call</span>
                </div>
                <p className="text-[11px] text-stone-600 dark:text-slate-300 leading-relaxed">
                  Test your mic, camera, screen sharing, and 8 live Voice FX instantly, or call any member below.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onStartCallCheck('audio');
                      onCloseMobile();
                    }}
                    className="py-2.5 px-2.5 rounded-xl bg-accent text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Voice Call</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onStartCallCheck('video');
                      onCloseMobile();
                    }}
                    className="py-2.5 px-2.5 rounded-xl bg-white dark:bg-[#161B22] border border-accent text-accent-soft text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Video Call</span>
                  </button>
                </div>
              </div>

              {/* Saved Call History (From Persistent Backend) */}
              <section className="space-y-1.5">
                <div className="flex items-center justify-between px-1.5">
                  <h2 className="text-xs font-semibold text-stone-500 dark:text-slate-400">
                    Recent Calls · <span className="tabular-nums">{callHistory.length}</span>
                  </h2>
                </div>

                {callHistory.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-stone-500 dark:text-slate-400 bg-white/70 dark:bg-[#161B22]/70 rounded-xl border border-stone-200/70 dark:border-slate-800">
                    No calls logged yet. Start a Voice or Video call above — your call history saves automatically on the server.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {callHistory.slice(0, 20).map((log) => {
                      const peerProfile = profilesByUid[log.peerUid];
                      return (
                        <li
                          key={log.callId}
                          className="group px-2.5 py-2 rounded-xl bg-white/80 dark:bg-[#161B22]/80 border border-stone-200/70 dark:border-slate-800/80 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar name={log.peerName} src={log.peerPhoto} size="sm" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                                {log.peerName}
                              </p>
                              <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-slate-400">
                                {log.direction === 'incoming' ? (
                                  <PhoneIncoming className="w-3 h-3 text-emerald-600 shrink-0" />
                                ) : (
                                  <PhoneOutgoing className="w-3 h-3 text-accent shrink-0" />
                                )}
                                <span className="truncate">
                                  {log.mode === 'video' ? 'Video' : 'Voice'} ·{' '}
                                  <span className="font-mono-tabular">
                                    {formatDurationCompact(log.durationSec)}
                                  </span>{' '}
                                  · {formatCallTime(log.startedAt)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (log.direction === 'check' || log.peerUid === 'self-test') {
                                  onStartCallCheck(log.mode);
                                } else {
                                  onStartCall(
                                    peerProfile || {
                                      uid: log.peerUid,
                                      displayName: log.peerName,
                                      handle: log.peerName.toLowerCase().replace(/\s+/g, ''),
                                      bio: '',
                                      photoUrl: log.peerPhoto,
                                      majorOrClub: '',
                                      status: 'online',
                                      statusMessage: '',
                                      discoverable: true,
                                      lastSeenAt: null,
                                      createdAt: null,
                                      updatedAt: null,
                                    },
                                    log.mode
                                  );
                                }
                                onCloseMobile();
                              }}
                              aria-label={`Call ${log.peerName} again`}
                              title={`Call again (${log.mode})`}
                              className="p-2 rounded-lg bg-accent-soft text-accent-soft hover:opacity-85 transition-opacity cursor-pointer"
                            >
                              {log.mode === 'video' ? (
                                <Video className="w-3.5 h-3.5" />
                              ) : (
                                <Phone className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteCallLog(log.callId)}
                              aria-label="Remove call log"
                              title="Delete from history"
                              className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-stone-100 dark:hover:bg-slate-800 opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Friends-Only Quick-Call List (Never shows global app user count) */}
              <section className="space-y-1.5">
                <h2 className="px-1.5 text-xs font-semibold text-stone-500 dark:text-slate-400">
                  Call Friends · <span className="tabular-nums">{filteredFriends.length}</span>
                </h2>
                {filteredFriends.length === 0 ? (
                  <div className="px-2.5 py-3 text-xs text-stone-500 dark:text-slate-400 bg-white/70 dark:bg-[#161B22]/70 rounded-xl border border-stone-200/70 dark:border-slate-800 space-y-2">
                    <p>Accept a friend request to start 1-to-1 voice or video calls.</p>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenNewDM();
                        onCloseMobile();
                      }}
                      className="text-accent font-semibold hover:underline cursor-pointer"
                    >
                      Add Friend / Manage Requests
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {filteredFriends.map((member) => {
                      const st = getLiveStatus(member.uid, member.status);
                      return (
                        <li
                          key={member.uid}
                          className="px-2.5 py-2 rounded-xl hover:bg-stone-200/60 dark:hover:bg-slate-800/70 flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar
                              name={member.displayName}
                              src={member.photoUrl}
                              size="sm"
                              status={st}
                              showStatus
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                                {member.displayName}
                              </p>
                              <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                                {STATUS_LABELS[st]} · @{member.handle}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onStartCall(member, 'audio');
                                onCloseMobile();
                              }}
                              aria-label={`Voice call ${member.displayName}`}
                              title="Voice call"
                              className="p-2 rounded-lg text-accent hover:bg-accent-soft transition-colors cursor-pointer"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onStartCall(member, 'video');
                                onCloseMobile();
                              }}
                              aria-label={`Video call ${member.displayName}`}
                              title="Video call"
                              className="p-2 rounded-lg text-accent hover:bg-accent-soft transition-colors cursor-pointer"
                            >
                              <Video className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom User Profile & Status Bar */}
      <div className="relative p-3 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-stone-200/90 dark:border-slate-800/90 bg-white/80 dark:bg-[#161B22]/90 shrink-0">
        {statusMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 p-1.5 rounded-xl bg-white dark:bg-[#1C2128] border border-stone-200 dark:border-slate-700 shadow-lg z-30 space-y-0.5">
            {(['online', 'away', 'busy', 'offline'] as OnlineStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  onChangeStatus(st);
                  setStatusMenuOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-lg text-left text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  profile.status === st
                    ? 'bg-accent-soft text-accent-soft'
                    : 'text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{STATUS_LABELS[st]}</span>
                {profile.status === st && <span className="text-[11px]">Active</span>}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onViewProfile(profile);
              onCloseMobile();
            }}
            title="View your profile, followers & zoom photo"
            aria-label="View your profile and followers"
            className="rounded-full shrink-0 hover:opacity-90 active:scale-95 transition-transform cursor-pointer"
          >
            <Avatar name={profile.displayName} src={profile.photoUrl} size="md" status={profile.status} showStatus />
          </button>
          <button
            type="button"
            onClick={() => setStatusMenuOpen((v) => !v)}
            aria-label="Change online status"
            className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-lg p-1 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                {profile.displayName}
              </p>
              <p className="text-xs text-stone-500 dark:text-slate-400 truncate">
                {STATUS_LABELS[profile.status]} · @{profile.handle}
              </p>
            </div>
          </button>

          {onQuickRandomProfile && (
            <button
              type="button"
              onClick={onQuickRandomProfile}
              aria-label="Roll a random avatar"
              title="Randomize avatar instantly"
              className="p-2 rounded-lg text-stone-500 dark:text-slate-400 hover:text-accent hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenShortcuts}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="hidden sm:inline-flex p-2 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenProfileModal}
            aria-label="Profile and account settings"
            title="Choose profile, avatar & settings"
            className="p-2 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Android Material 3 Bottom Navigation Bar (5 Primary Options on Mobile) */}
      <nav
        aria-label="Mobile sections"
        className="lg:hidden grid grid-cols-5 border-t border-stone-200/90 dark:border-slate-800/90 bg-white dark:bg-[#161B22] px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shrink-0"
      >
        {(
          [
            { id: 'chats', label: 'Chats', icon: MessageCircle },
            { id: 'groups', label: 'Groups', icon: Users },
            { id: 'reels', label: 'Reels', icon: Film },
            { id: 'dms', label: 'DMs', icon: User },
            { id: 'calls', label: 'Calls', icon: Phone },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
              onClick={() => onChangeTab(tab.id)}
              className="flex flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-semibold cursor-pointer"
            >
              <span className="relative px-3 py-1 rounded-full">
                {active && (
                  <motion.span
                    layoutId="mobile-nav-pill"
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-accent-soft"
                  />
                )}
                <Icon
                  className={`relative z-10 w-4 h-4 ${
                    active ? 'text-accent' : 'text-stone-500 dark:text-slate-400'
                  }`}
                />
                {tab.id === 'dms' && incomingFriendRequests.length > 0 && (
                  <span className="absolute -top-0.5 right-1 z-20 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {incomingFriendRequests.length > 9 ? '9+' : incomingFriendRequests.length}
                  </span>
                )}
              </span>
              <span className={active ? 'text-stone-900 dark:text-white' : 'text-stone-500 dark:text-slate-400'}>
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <>
      {/* WhatsApp Home Chat List: Full-screen on mobile, left pane on desktop; completely hidden when a chat is opened */}
      {!chatOpen && (
        <motion.div
          key="whatsapp-home-list"
          initial={prefersReducedMotion ? false : { opacity: 0.85, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 460, damping: 36 }}
          className="flex h-full w-full lg:w-auto shrink-0 gpu-layer"
        >
          {buildSidebarBody(false)}
        </motion.div>
      )}

      {/* Optional Slide-Over Peek Drawer (only when user taps Peek Chats while inside an open chat) */}
      <AnimatePresence>
        {chatOpen && mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.16 }}
            className="fixed inset-0 z-50 flex"
          >
            <div className="fixed inset-0 bg-black/45 backdrop-blur-[1px]" onClick={onCloseMobile} />
            <motion.div
              initial={prefersReducedMotion ? false : { x: -32 }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? undefined : { x: -32 }}
              transition={{ type: 'spring', stiffness: 460, damping: 36 }}
              className="relative z-10 h-full gpu-layer"
            >
              {buildSidebarBody(true)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
