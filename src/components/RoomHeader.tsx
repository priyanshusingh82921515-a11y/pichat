import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Calendar,
  Link2,
  Lock,
  Mic,
  Palette,
  PanelLeftOpen,
  Pencil,
  Phone,
  Pin,
  Search,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { formatLiveActivity } from '../lib/validation';
import type { ChatThemeMeta } from '../lib/themes';
import type {
  CallMode,
  MemberRole,
  NotificationPref,
  Profile,
  RightPanelTab,
  Room,
  TypingUser,
} from '../types/chat';

interface RoomHeaderProps {
  room: Room;
  dmPeer: Profile | null;
  memberCount: number;
  onlineCount: number;
  currentRole: MemberRole | null;
  notificationPref: NotificationPref;
  pinnedCount: number;
  pendingModCount: number;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  otherChatsBadgeCount?: number;
  isEncryptedChat?: boolean;
  isLockedChat?: boolean;
  activeChatTheme?: ChatThemeMeta;
  onBackToChats: () => void;
  onOpenMobileSidebar: () => void;
  onSelectRightTab: (tab: RightPanelTab) => void;
  onToggleRightPanel: () => void;
  onOpenInviteModal: () => void;
  onOpenThemes?: () => void;
  onOpenPrivacy?: () => void;
  onEditGroupName?: () => void;
  onChangeNotificationPref: (pref: NotificationPref) => void;
  onStartCall?: (target: Profile, mode: CallMode) => void;
  onOpenCallHub?: (defaultMode: CallMode) => void;
  typingUsers?: TypingUser[];
}

const CATEGORY_LABELS: Record<string, string> = {
  club: 'Club',
  class: 'Class',
  event: 'Event',
  topic: 'Group',
  direct: 'Direct',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'GR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export const RoomHeader = React.memo(function RoomHeader({
  room,
  dmPeer,
  memberCount,
  onlineCount,
  currentRole,
  notificationPref,
  pinnedCount,
  pendingModCount,
  rightPanelOpen,
  rightPanelTab,
  otherChatsBadgeCount = 0,
  isEncryptedChat = true,
  isLockedChat = false,
  activeChatTheme,
  onBackToChats,
  onOpenMobileSidebar,
  onSelectRightTab,
  onToggleRightPanel,
  onOpenInviteModal,
  onOpenThemes,
  onOpenPrivacy,
  onEditGroupName,
  onChangeNotificationPref,
  onStartCall,
  onOpenCallHub,
  typingUsers = [],
}: RoomHeaderProps) {
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const isDm = room.visibility === 'dm';
  const isMod = currentRole === 'owner' || currentRole === 'moderator';
  const title = isDm ? dmPeer?.displayName || room.name : room.name;
  const liveActivity = formatLiveActivity(typingUsers, true);

  const toggleTab = (tab: RightPanelTab) => {
    if (rightPanelOpen && rightPanelTab === tab) {
      onToggleRightPanel();
    } else {
      onSelectRightTab(tab);
    }
  };

  return (
    <header className="h-14 px-2 sm:px-4 border-b border-stone-200/90 dark:border-slate-800/90 bg-white dark:bg-[#161B22] flex items-center justify-between gap-2 sm:gap-3 shrink-0">
      {/* Left: WhatsApp Back Button + Group/DM Avatar + Title & Metadata */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <motion.button
          type="button"
          whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 520, damping: 30 }}
          onClick={onBackToChats}
          aria-label="Back to all chats"
          title="Back to all chats (Esc)"
          className="inline-flex items-center justify-center gap-1 min-h-[40px] min-w-[40px] px-2 -ml-0.5 rounded-xl text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 shrink-0" />
          {otherChatsBadgeCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent-solid text-white text-[10px] font-mono-tabular font-semibold flex items-center justify-center">
              {otherChatsBadgeCount > 9 ? '9+' : otherChatsBadgeCount}
            </span>
          )}
        </motion.button>

        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Peek minimized chats list"
          title="Quick peek chats drawer"
          className="hidden lg:inline-flex items-center justify-center min-h-[36px] min-w-[36px] p-1.5 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        {isDm ? (
          <Avatar
            name={title}
            src={dmPeer?.photoUrl}
            size="sm"
            status={dmPeer?.status || 'offline'}
            showStatus
          />
        ) : (
          <div className="relative w-9 h-9 rounded-full shrink-0">
            {room.coverImage ? (
              <img
                src={room.coverImage}
                alt={room.name}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover border border-stone-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-accent-solid text-white font-display text-xs font-bold flex items-center justify-center">
                {getInitials(room.name)}
              </div>
            )}
            {room.visibility === 'private' && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-stone-900 text-white border border-white dark:border-slate-800 flex items-center justify-center">
                <Lock className="w-2 h-2" />
              </span>
            )}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <h1 className="font-display text-sm sm:text-base font-bold text-stone-900 dark:text-white truncate">
              {title}
            </h1>
            {!isDm && onEditGroupName && (
              <button
                type="button"
                onClick={onEditGroupName}
                aria-label="Edit group name"
                title="Change group name"
                className="p-1 rounded-md text-stone-400 hover:text-accent hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {liveActivity ? (
              <motion.p
                key="live-activity"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="text-[11px] sm:text-xs font-medium text-accent truncate flex items-center gap-1"
              >
                {(liveActivity.kind === 'recording_voice' || liveActivity.kind === 'sending_voice') && (
                  <Mic className="w-3 h-3 shrink-0 animate-pulse" />
                )}
                <span className="truncate">{liveActivity.text}</span>
              </motion.p>
            ) : (
              <motion.p
                key="room-meta"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -3 }}
                transition={{ duration: 0.14 }}
                className="text-[11px] sm:text-xs text-stone-500 dark:text-slate-400 truncate"
              >
                {isDm ? (
                  <span>
                    Private 1-to-1 chat{dmPeer ? ` · @${dmPeer.handle}` : ''}
                    {dmPeer?.majorOrClub ? ` · ${dmPeer.majorOrClub}` : ''}
                  </span>
                ) : (
                  <span>
                    {CATEGORY_LABELS[room.category] || 'Group'} ·{' '}
                    <span className="tabular-nums">{memberCount}</span>{' '}
                    {memberCount === 1 ? 'member' : 'members'} ·{' '}
                    <span className="tabular-nums">{onlineCount}</span> online
                  </span>
                )}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Prominent Voice & Video Calls + Room Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {((isDm && dmPeer && onStartCall) || (!isDm && onOpenCallHub)) && (
          <div className="flex items-center gap-1 mr-0.5">
            <motion.button
              type="button"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
              transition={{ type: 'spring', stiffness: 520, damping: 28 }}
              onClick={() => {
                if (isDm && dmPeer && onStartCall) {
                  onStartCall(dmPeer, 'audio');
                } else if (onOpenCallHub) {
                  onOpenCallHub('audio');
                }
              }}
              aria-label={isDm && dmPeer ? `Start voice call with ${dmPeer.displayName}` : 'Start a voice call'}
              title="Voice call"
              className="inline-flex items-center justify-center gap-1.5 min-h-[36px] min-w-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-accent-soft text-accent-soft hover:opacity-85 text-xs font-semibold transition-opacity whitespace-nowrap cursor-pointer"
            >
              <Phone className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Voice</span>
            </motion.button>
            <motion.button
              type="button"
              whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
              transition={{ type: 'spring', stiffness: 520, damping: 28 }}
              onClick={() => {
                if (isDm && dmPeer && onStartCall) {
                  onStartCall(dmPeer, 'video');
                } else if (onOpenCallHub) {
                  onOpenCallHub('video');
                }
              }}
              aria-label={isDm && dmPeer ? `Start video call with ${dmPeer.displayName}` : 'Start a video call'}
              title="Video call"
              className="inline-flex items-center justify-center gap-1.5 min-h-[36px] min-w-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Video className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Video</span>
            </motion.button>
          </div>
        )}

        {onOpenPrivacy && (
          <button
            type="button"
            onClick={onOpenPrivacy}
            aria-label="Chat privacy and lock settings"
            title={
              isLockedChat
                ? 'Chat locked & private — manage privacy'
                : isEncryptedChat
                  ? 'End-to-end encrypted — privacy & chat lock'
                  : 'Chat privacy & lock'
            }
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isLockedChat || isEncryptedChat
                ? 'text-accent hover:bg-accent-soft'
                : 'text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
            }`}
          >
            {isLockedChat ? <Lock className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </button>
        )}

        {onOpenThemes && (
          <button
            type="button"
            onClick={onOpenThemes}
            aria-label="Change chat theme"
            title={
              activeChatTheme && activeChatTheme.id !== 'classic'
                ? `Chat theme: ${activeChatTheme.name}`
                : 'Chat themes (Flowers, Cars & more)'
            }
            className="relative inline-flex items-center justify-center min-h-[38px] min-w-[38px] p-2 rounded-lg text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Palette className="w-4 h-4" />
            {activeChatTheme && activeChatTheme.id !== 'classic' && (
              <span
                aria-hidden="true"
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-[#161B22]"
                style={{ backgroundColor: activeChatTheme.accentHex }}
              />
            )}
          </button>
        )}

        {!isDm && (
          <button
            type="button"
            onClick={onOpenInviteModal}
            aria-label="Share group join link or invite code"
            title="Share group join link & invite code"
            className="inline-flex items-center gap-1.5 p-2 xl:px-3 xl:py-1.5 rounded-lg text-xs font-medium text-accent hover:bg-accent-soft transition-colors whitespace-nowrap cursor-pointer"
          >
            <Link2 className="w-4 h-4 xl:w-3.5 xl:h-3.5 shrink-0" />
            <span className="hidden xl:inline">Group Link</span>
          </button>
        )}

        {/* Per-Room Notification Level Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifMenuOpen((v) => !v)}
            aria-label="Room notification settings"
            title={`Alerts: ${notificationPref}`}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              notificationPref === 'mute'
                ? 'text-stone-400 dark:text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-800'
                : 'text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
            }`}
          >
            {notificationPref === 'mute' ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>

          {notifMenuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setNotifMenuOpen(false)} />
              <div className="absolute right-0 mt-1.5 w-52 p-1.5 rounded-xl bg-white dark:bg-[#1C2128] border border-stone-200 dark:border-slate-700 shadow-lg z-30 space-y-0.5">
                <p className="px-2.5 py-1 text-[11px] font-semibold text-stone-500 dark:text-slate-400">
                  Room notifications
                </p>
                {(
                  [
                    { id: 'all', label: 'All messages', desc: 'Alert on every message' },
                    { id: 'mentions', label: 'Mentions & replies', desc: 'Only @mentions and replies' },
                    { id: 'mute', label: 'Muted', desc: 'Silence this room' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChangeNotificationPref(opt.id);
                      setNotifMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                      notificationPref === opt.id
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
                        : 'text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-medium">{opt.label}</div>
                    <div className="text-[11px] text-stone-500 dark:text-slate-400">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => toggleTab('search')}
          aria-label="Search messages in room"
          title="Search messages"
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            rightPanelOpen && rightPanelTab === 'search'
              ? 'bg-emerald-700/12 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
              : 'text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
          }`}
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => toggleTab('pinned')}
          aria-label="Pinned messages"
          title={`Pinned messages (${pinnedCount})`}
          className={`hidden sm:inline-flex relative p-2 rounded-lg transition-colors cursor-pointer ${
            rightPanelOpen && rightPanelTab === 'pinned'
              ? 'bg-emerald-700/12 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
              : 'text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
          }`}
        >
          <Pin className="w-4 h-4" />
          {pinnedCount > 0 && (
            <span className="absolute top-1 right-1 text-[9px] font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
              {pinnedCount}
            </span>
          )}
        </button>

        {!isDm && (
          <button
            type="button"
            onClick={() => toggleTab('events')}
            aria-label="Room events"
            title="Campus events & RSVPs"
            className={`hidden sm:inline-flex p-2 rounded-lg transition-colors cursor-pointer ${
              rightPanelOpen && rightPanelTab === 'events'
                ? 'bg-emerald-700/12 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                : 'text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
          </button>
        )}

        {!isDm && isMod && (
          <button
            type="button"
            onClick={() => toggleTab('moderation')}
            aria-label="Moderation and activity"
            title="Moderation, join requests, and activity"
            className={`relative p-2 rounded-lg transition-colors cursor-pointer ${
              rightPanelOpen && rightPanelTab === 'moderation'
                ? 'bg-emerald-700/12 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                : 'text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            {pendingModCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-amber-600 text-white text-[9px] font-mono-tabular font-semibold flex items-center justify-center">
                {pendingModCount}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => toggleTab('members')}
          aria-label="Toggle members panel"
          title="Members"
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            rightPanelOpen && rightPanelTab === 'members'
              ? 'bg-emerald-700/12 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
              : 'text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
});
