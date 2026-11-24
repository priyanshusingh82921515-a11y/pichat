import { useMemo, useState } from 'react';
import {
  Ban,
  Calendar,
  Check,
  Clock,
  Flag,
  LogOut,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Pin,
  Plus,
  Search,
  Shield,
  UserCheck,
  UserMinus,
  UserPlus,
  Video,
  X,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { MessageComposer } from './MessageComposer';
import { MessageItem } from './MessageItem';
import { formatEventDate, formatTimestamp } from '../lib/validation';
import type {
  CallMode,
  JoinRequest,
  LivePresenceEntry,
  MemberRole,
  Message,
  ModerationReport,
  OnlineStatus,
  Profile,
  RightPanelTab,
  Room,
  RoomActivity,
  RoomEvent,
  RoomMember,
} from '../types/chat';

interface RightPanelProps {
  open: boolean;
  tab: RightPanelTab;
  room: Room;
  currentProfile: Profile;
  currentRole: MemberRole | null;
  members: RoomMember[];
  profilesByUid: Record<string, Profile>;
  presenceMap: Record<string, LivePresenceEntry>;
  messages: Message[];
  events: RoomEvent[];
  joinRequests: JoinRequest[];
  reports: ModerationReport[];
  activities: RoomActivity[];
  blockedUserIds: string[];
  friendUids: Set<string>;
  incomingRequestUids: Set<string>;
  outgoingRequestUids: Set<string>;
  activeThreadRoot: Message | null;
  onClose: () => void;
  onSelectTab: (tab: RightPanelTab) => void;
  onStartDM: (targetProfile: Profile) => void;
  onStartCall: (targetProfile: Profile, mode: CallMode) => void;
  onViewProfile?: (targetProfile: Profile) => void;
  onSendFriendRequest: (targetProfile: Profile) => void;
  onAcceptFriendRequest: (otherUid: string) => void;
  onRemoveFriendRelation: (otherUid: string) => void;
  onPromoteOrDemote: (member: RoomMember, newRole: 'moderator' | 'member') => void;
  onRemoveMember: (member: RoomMember) => void;
  onLeaveRoom: () => void;
  onToggleBlockUser: (targetUid: string) => void;
  onReportMember: (member: RoomMember) => void;
  onOpenCreateEvent: () => void;
  onRsvpEvent: (event: RoomEvent, choice: 'going' | 'maybe' | 'none') => void;
  onUnpinMessage: (message: Message) => void;
  onJumpToMessage: (messageId: string) => void;
  onReviewJoinRequest: (req: JoinRequest, decision: 'approved' | 'rejected') => void;
  onResolveReport: (reportId: string, decision: 'resolved' | 'dismissed') => void;
  onSendThreadReply: (root: Message, text: string, mentionedUids: string[]) => Promise<void>;
  onToggleReaction: (message: Message, emoji: string) => void;
  onDeleteMessage: (message: Message, isModAction: boolean) => void;
  onReportMessage: (message: Message) => void;
  onPreviewImage: (url: string, caption: string, fileName?: string, fallbackUrl?: string) => void;
}

const STATUS_TEXT: Record<OnlineStatus, string> = {
  online: 'Online',
  away: 'Away',
  busy: 'Busy',
  offline: 'Offline',
};

const ROLE_TEXT: Record<MemberRole, string> = {
  owner: 'Owner',
  moderator: 'Moderator',
  member: 'Member',
};

export function RightPanel({
  open,
  tab,
  room,
  currentProfile,
  currentRole,
  members,
  profilesByUid,
  presenceMap,
  messages,
  events,
  joinRequests,
  reports,
  activities,
  blockedUserIds,
  friendUids,
  incomingRequestUids,
  outgoingRequestUids,
  activeThreadRoot,
  onClose,
  onSelectTab,
  onStartDM,
  onStartCall,
  onViewProfile,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onRemoveFriendRelation,
  onPromoteOrDemote,
  onRemoveMember,
  onLeaveRoom,
  onToggleBlockUser,
  onReportMember,
  onOpenCreateEvent,
  onRsvpEvent,
  onUnpinMessage,
  onJumpToMessage,
  onReviewJoinRequest,
  onResolveReport,
  onSendThreadReply,
  onToggleReaction,
  onDeleteMessage,
  onReportMessage,
  onPreviewImage,
}: RightPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuUid, setOpenMenuUid] = useState<string | null>(null);

  const isMod = currentRole === 'owner' || currentRole === 'moderator';
  const isOwner = currentRole === 'owner';

  const getMemberStatus = (uid: string): OnlineStatus => {
    const live = presenceMap[uid];
    if (live) return live.status;
    return profilesByUid[uid]?.status || 'offline';
  };

  const { onlineMembers, offlineMembers } = useMemo(() => {
    const online: RoomMember[] = [];
    const offline: RoomMember[] = [];
    for (const m of members) {
      const st = getMemberStatus(m.uid);
      if (st === 'offline') offline.push(m);
      else online.push(m);
    }
    return { onlineMembers: online, offlineMembers: offline };
  }, [members, presenceMap, profilesByUid]);

  const pinnedMessages = useMemo(
    () => messages.filter((m) => m.pinned && !m.deleted),
    [messages]
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages
      .filter(
        (m) =>
          !m.deleted &&
          (m.text.toLowerCase().includes(q) ||
            m.authorName.toLowerCase().includes(q) ||
            m.mediaName.toLowerCase().includes(q))
      )
      .slice(-40)
      .reverse();
  }, [messages, searchQuery]);

  const threadReplies = useMemo(() => {
    if (!activeThreadRoot) return [];
    return messages.filter((m) => m.threadRootId === activeThreadRoot.id);
  }, [messages, activeThreadRoot]);

  const pendingRequests = useMemo(
    () => joinRequests.filter((r) => r.status === 'pending'),
    [joinRequests]
  );

  const openReports = useMemo(
    () => reports.filter((r) => r.status === 'open'),
    [reports]
  );

  if (!open) return null;

  const panelTitle =
    tab === 'members'
      ? `Members (${members.length})`
      : tab === 'events'
        ? `Events (${events.length})`
        : tab === 'pinned'
          ? `Pinned (${pinnedMessages.length})`
          : tab === 'search'
            ? 'Search Room'
            : tab === 'moderation'
              ? 'Moderation & Activity'
              : 'Thread';

  const renderMemberRow = (member: RoomMember) => {
    const prof = profilesByUid[member.uid];
    const st = getMemberStatus(member.uid);
    const isSelf = member.uid === currentProfile.uid;
    const isBlocked = blockedUserIds.includes(member.uid);
    const canRemove =
      !isSelf &&
      ((isOwner && member.role !== 'owner') || (isMod && member.role === 'member'));
    const canManageRole = !isSelf && isOwner && member.role !== 'owner';

    const targetProfile: Profile = prof || {
      uid: member.uid,
      displayName: member.displayName,
      handle: member.handle,
      bio: '',
      photoUrl: member.photoUrl,
      majorOrClub: '',
      status: st,
      statusMessage: '',
      discoverable: true,
      lastSeenAt: null,
      createdAt: null,
      updatedAt: null,
    };

    const isFriend = friendUids.has(member.uid);
    const isIncoming = incomingRequestUids.has(member.uid);
    const isOutgoing = outgoingRequestUids.has(member.uid);

    return (
      <div
        key={member.uid}
        className="relative flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-stone-100/80 dark:hover:bg-slate-800/60 transition-colors"
      >
        <button
          type="button"
          onClick={() => onViewProfile?.(targetProfile)}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
        >
          <Avatar
            name={member.displayName}
            src={prof?.photoUrl || member.photoUrl}
            size="sm"
            status={st}
            showStatus
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                {prof?.displayName || member.displayName}
                {isSelf ? ' (You)' : ''}
              </p>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
              {STATUS_TEXT[st]}
              {member.role !== 'member' ? ` · ${ROLE_TEXT[member.role]}` : ''}
              {!isSelf && isFriend ? ' · Friend' : ''}
              {isBlocked ? ' · Blocked' : ''}
            </p>
          </div>
        </button>

        {!isSelf && (
          <div className="relative flex items-center gap-1 shrink-0">
            {isIncoming ? (
              <button
                type="button"
                onClick={() => onAcceptFriendRequest(member.uid)}
                className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold cursor-pointer"
              >
                Accept
              </button>
            ) : isOutgoing ? (
              <button
                type="button"
                onClick={() => onRemoveFriendRelation(member.uid)}
                title="Cancel friend request"
                className="px-2 py-1 rounded-lg bg-stone-200 dark:bg-slate-700 text-stone-700 dark:text-slate-200 text-[11px] font-medium cursor-pointer"
              >
                Requested
              </button>
            ) : !isFriend ? (
              <button
                type="button"
                onClick={() => onSendFriendRequest(targetProfile)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-accent-soft text-accent-soft hover:opacity-85 text-[11px] font-semibold cursor-pointer"
              >
                <UserPlus className="w-3 h-3" />
                <span>Follow</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setOpenMenuUid(openMenuUid === member.uid ? null : member.uid)}
              aria-label={`Actions for ${member.displayName}`}
              className="p-1.5 rounded-md text-stone-500 dark:text-slate-400 hover:bg-stone-200/70 dark:hover:bg-slate-700 cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {openMenuUid === member.uid && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setOpenMenuUid(null)} />
                <div className="absolute right-0 top-full mt-1 w-52 p-1 rounded-xl bg-white dark:bg-[#1C2128] border border-stone-200 dark:border-slate-700 shadow-lg z-30 space-y-0.5 text-xs">
                  {isFriend ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onStartDM(targetProfile);
                          setOpenMenuUid(null);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Direct message</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onStartCall(targetProfile, 'audio');
                          setOpenMenuUid(null);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                        <span>Voice call</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onStartCall(targetProfile, 'video');
                          setOpenMenuUid(null);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Video className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                        <span>Video call</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onRemoveFriendRelation(member.uid);
                          setOpenMenuUid(null);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-2 cursor-pointer"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        <span>Unfriend / Unfollow</span>
                      </button>
                    </>
                  ) : isIncoming ? (
                    <button
                      type="button"
                      onClick={() => {
                        onAcceptFriendRequest(member.uid);
                        setOpenMenuUid(null);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-2 font-semibold cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Accept Friend Request</span>
                    </button>
                  ) : isOutgoing ? (
                    <button
                      type="button"
                      onClick={() => {
                        onRemoveFriendRelation(member.uid);
                        setOpenMenuUid(null);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel Friend Request</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onSendFriendRequest(targetProfile);
                        setOpenMenuUid(null);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-2 font-semibold cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Send Friend Request to Chat</span>
                    </button>
                  )}

                  {canManageRole && (
                    <button
                      type="button"
                      onClick={() => {
                        onPromoteOrDemote(
                          member,
                          member.role === 'moderator' ? 'member' : 'moderator'
                        );
                        setOpenMenuUid(null);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>
                        {member.role === 'moderator' ? 'Remove moderator' : 'Make moderator'}
                      </span>
                    </button>
                  )}

                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => {
                        onRemoveMember(member);
                        setOpenMenuUid(null);
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 cursor-pointer"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>Remove from room</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onToggleBlockUser(member.uid);
                      setOpenMenuUid(null);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{isBlocked ? 'Unblock user' : 'Block user'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onReportMember(member);
                      setOpenMenuUid(null);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2 cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report member</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const panelBody = (
    <aside
      aria-label={panelTitle}
      className="h-full w-[312px] sm:w-[328px] max-w-[92vw] shrink-0 bg-[#FAF9F7] dark:bg-[#12161D] border-l border-stone-200/90 dark:border-slate-800/90 flex flex-col"
    >
      {/* Header */}
      <div className="h-14 px-4 border-b border-stone-200/90 dark:border-slate-800/90 flex items-center justify-between gap-2 shrink-0">
        <h2 className="font-display text-sm font-bold text-stone-900 dark:text-white truncate">
          {panelTitle}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close side panel"
          className="p-1.5 rounded-lg text-stone-500 dark:text-slate-400 hover:bg-stone-200/70 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* MEMBERS TAB */}
      {tab === 'members' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {onlineMembers.length > 0 && (
            <section>
              <p className="px-2 mb-1.5 text-[11px] font-semibold text-stone-500 dark:text-slate-400">
                Active now · <span className="tabular-nums">{onlineMembers.length}</span>
              </p>
              <div className="space-y-0.5">{onlineMembers.map(renderMemberRow)}</div>
            </section>
          )}

          {offlineMembers.length > 0 && (
            <section>
              <p className="px-2 mb-1.5 text-[11px] font-semibold text-stone-500 dark:text-slate-400">
                Offline · <span className="tabular-nums">{offlineMembers.length}</span>
              </p>
              <div className="space-y-0.5">{offlineMembers.map(renderMemberRow)}</div>
            </section>
          )}

          {room.visibility !== 'dm' && currentRole !== 'owner' && (
            <div className="pt-4 border-t border-stone-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={onLeaveRoom}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Room</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* EVENTS TAB */}
      {tab === 'events' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <button
            type="button"
            onClick={onOpenCreateEvent}
            className="w-full py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Room Event</span>
          </button>

          {events.length === 0 ? (
            <div className="py-10 text-center space-y-1.5">
              <Calendar className="w-6 h-6 mx-auto text-stone-400 dark:text-slate-500" />
              <p className="text-sm font-medium text-stone-700 dark:text-slate-300">No upcoming events</p>
              <p className="text-xs text-stone-500 dark:text-slate-400">
                Plan study sessions, club socials, or build nights with RSVPs and reminders.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((evt) => {
                const going = evt.rsvpGoing.includes(currentProfile.uid);
                const maybe = evt.rsvpMaybe.includes(currentProfile.uid);
                return (
                  <div
                    key={evt.id}
                    className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-[#161B22] overflow-hidden"
                  >
                    {evt.coverImage && (
                      <img
                        src={evt.coverImage}
                        alt={evt.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-24 object-cover"
                      />
                    )}
                    <div className="p-3.5 space-y-2">
                      <div>
                        <p className="text-sm font-bold text-stone-900 dark:text-white">{evt.title}</p>
                        <p className="text-[11px] text-stone-500 dark:text-slate-400">
                          Hosted by {evt.creatorName} · Reminder {evt.reminderMinutes}m prior
                        </p>
                      </div>
                      {evt.description && (
                        <p className="text-xs text-stone-600 dark:text-slate-400">{evt.description}</p>
                      )}
                      <div className="space-y-1 text-xs text-stone-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="tabular-nums">{formatEventDate(evt.startAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>{evt.location}</span>
                        </div>
                      </div>
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRsvpEvent(evt, going ? 'none' : 'going')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            going
                              ? 'bg-emerald-700 text-white'
                              : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-stone-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          Going ({evt.rsvpGoing.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => onRsvpEvent(evt, maybe ? 'none' : 'maybe')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                            maybe
                              ? 'bg-amber-600 text-white'
                              : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-stone-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          Maybe ({evt.rsvpMaybe.length})
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PINNED TAB */}
      {tab === 'pinned' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {pinnedMessages.length === 0 ? (
            <div className="py-10 text-center space-y-1.5">
              <Pin className="w-6 h-6 mx-auto text-stone-400 dark:text-slate-500" />
              <p className="text-sm font-medium text-stone-700 dark:text-slate-300">No pinned messages</p>
              <p className="text-xs text-stone-500 dark:text-slate-400">
                Room owners and moderators can pin syllabus links, meeting times, or announcements.
              </p>
            </div>
          ) : (
            pinnedMessages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-[#161B22] p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-stone-900 dark:text-white truncate">
                    {msg.authorName}
                  </span>
                  <span className="font-mono-tabular text-[11px] text-stone-400">
                    {formatTimestamp(msg.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-stone-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                  {msg.text || msg.mediaName || 'Pinned attachment'}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => onJumpToMessage(msg.id)}
                    className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Jump to message
                  </button>
                  {isMod && (
                    <button
                      type="button"
                      onClick={() => onUnpinMessage(msg)}
                      className="text-xs text-stone-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      Unpin
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SEARCH TAB */}
      {tab === 'search' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 border-b border-stone-200/80 dark:border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages or files..."
                autoFocus
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {!searchQuery.trim() ? (
              <p className="text-xs text-stone-500 dark:text-slate-400 text-center py-8">
                Type a keyword, link domain, or member name to search this conversation.
              </p>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-slate-400 text-center py-8">
                No messages matched "{searchQuery}".
              </p>
            ) : (
              searchResults.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => onJumpToMessage(msg.id)}
                  className="w-full text-left rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-[#161B22] p-3 hover:border-emerald-500/60 transition-colors space-y-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-slate-400">
                    <span className="font-semibold text-stone-900 dark:text-white">{msg.authorName}</span>
                    <span className="font-mono-tabular">{formatTimestamp(msg.createdAt)}</span>
                  </div>
                  <p className="text-xs text-stone-700 dark:text-slate-300 line-clamp-3">
                    {msg.text || msg.mediaName}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODERATION & ACTIVITY TAB */}
      {tab === 'moderation' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Private Room Join Requests */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-stone-500 dark:text-slate-400">
              Join Requests · <span className="tabular-nums">{pendingRequests.length}</span>
            </h3>
            {pendingRequests.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-slate-400">No pending join requests.</p>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <div
                    key={req.uid}
                    className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-[#161B22] p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={req.displayName} src={req.photoUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                          {req.displayName}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-slate-400">@{req.handle}</p>
                      </div>
                    </div>
                    {req.note && (
                      <p className="text-xs text-stone-600 dark:text-slate-300">{req.note}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onReviewJoinRequest(req, 'approved')}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onReviewJoinRequest(req, 'rejected')}
                        className="flex-1 py-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-200 text-xs font-medium cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Open Reports */}
          <section className="space-y-2 pt-3 border-t border-stone-200/80 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-stone-500 dark:text-slate-400">
              Open Safety Reports · <span className="tabular-nums">{openReports.length}</span>
            </h3>
            {openReports.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-slate-400">No open reports in this room.</p>
            ) : (
              <div className="space-y-2">
                {openReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-[#161B22] p-3 space-y-2"
                  >
                    <div className="text-xs">
                      <p className="font-semibold text-stone-900 dark:text-white">
                        Target: {rep.targetUserName}
                      </p>
                      <p className="text-[11px] text-stone-500 dark:text-slate-400">
                        Reported by {rep.reporterName}
                      </p>
                    </div>
                    {rep.targetSnippet && (
                      <p className="text-xs text-stone-600 dark:text-slate-300 bg-stone-50 dark:bg-slate-900 p-2 rounded-lg">
                        "{rep.targetSnippet}"
                      </p>
                    )}
                    <p className="text-xs text-stone-700 dark:text-slate-200">
                      Reason: {rep.reason}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onResolveReport(rep.id, 'resolved')}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveReport(rep.id, 'dismissed')}
                        className="flex-1 py-1.5 rounded-lg bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-200 text-xs font-medium cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Room Activity Log */}
          <section className="space-y-2 pt-3 border-t border-stone-200/80 dark:border-slate-800">
            <h3 className="text-xs font-semibold text-stone-500 dark:text-slate-400">
              Recent Room Activity
            </h3>
            {activities.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-slate-400">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {activities.slice(0, 25).map((act) => (
                  <li key={act.id} className="text-xs space-y-0.5">
                    <p className="text-stone-700 dark:text-slate-200">{act.summary}</p>
                    <p className="text-[11px] font-mono-tabular text-stone-400 dark:text-slate-500">
                      {act.actorName} · {formatTimestamp(act.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* THREAD TAB */}
      {tab === 'thread' && (
        <div className="flex-1 flex flex-col min-h-0">
          {!activeThreadRoot ? (
            <div className="p-6 text-center text-xs text-stone-500 dark:text-slate-400">
              Select a message to open its thread.
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto divide-y divide-stone-200/70 dark:divide-slate-800">
                <div className="py-2 bg-white dark:bg-[#161B22]">
                  <MessageItem
                    message={activeThreadRoot}
                    compact={false}
                    currentUid={currentProfile.uid}
                    currentRole={currentRole}
                    isBlockedAuthor={blockedUserIds.includes(activeThreadRoot.authorId)}
                    isThreadView
                    onReply={() => {}}
                    onOpenThread={() => {}}
                    onEdit={() => {}}
                    onDelete={onDeleteMessage}
                    onTogglePin={() => {}}
                    onToggleReaction={onToggleReaction}
                    onVotePoll={() => {}}
                    onRsvpEvent={onRsvpEvent}
                    onReport={onReportMessage}
                    onPreviewImage={onPreviewImage}
                  />
                </div>

                <div className="py-2">
                  <p className="px-4 py-1.5 text-[11px] font-medium text-stone-500 dark:text-slate-400">
                    <span className="tabular-nums">{threadReplies.length}</span>{' '}
                    {threadReplies.length === 1 ? 'reply' : 'replies'}
                  </p>
                  {threadReplies.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-stone-400 dark:text-slate-500">
                      Start the thread conversation below.
                    </p>
                  ) : (
                    threadReplies.map((rep) => (
                      <MessageItem
                        key={rep.id}
                        message={rep}
                        compact={false}
                        currentUid={currentProfile.uid}
                        currentRole={currentRole}
                        isBlockedAuthor={blockedUserIds.includes(rep.authorId)}
                        isThreadView
                        onReply={() => {}}
                        onOpenThread={() => {}}
                        onEdit={() => {}}
                        onDelete={onDeleteMessage}
                        onTogglePin={() => {}}
                        onToggleReaction={onToggleReaction}
                        onVotePoll={() => {}}
                        onRsvpEvent={onRsvpEvent}
                        onReport={onReportMessage}
                        onPreviewImage={onPreviewImage}
                      />
                    ))
                  )}
                </div>
              </div>

              <MessageComposer
                roomName={room.name}
                currentUid={currentProfile.uid}
                members={members}
                typingUsers={[]}
                replyTo={null}
                editingMessage={null}
                placeholder="Reply in thread..."
                compact
                isGroupRoom={room.visibility !== 'dm'}
                onCancelReply={() => {}}
                onCancelEdit={() => {}}
                onTypingStart={() => {}}
                onTypingStop={() => {}}
                onSendText={(txt, mentioned) => onSendThreadReply(activeThreadRoot, txt, mentioned)}
                onSaveEdit={async () => {}}
                onSendImage={async () => {}}
                onSendFile={async () => {}}
                onSendVoice={async () => {}}
              />
            </>
          )}
        </div>
      )}

      {/* Bottom Tab Quick Switcher for Mobile/Compact Access */}
      <div className="px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-stone-200/80 dark:border-slate-800 flex items-center justify-around bg-white dark:bg-[#161B22] shrink-0">
        {(
          [
            { id: 'members', label: 'Members', icon: UserPlus },
            { id: 'events', label: 'Events', icon: Calendar },
            { id: 'pinned', label: 'Pinned', icon: Pin },
            { id: 'search', label: 'Search', icon: Search },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                active
                  ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                  : 'text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden xl:flex h-full">{panelBody}</div>
      <div className="fixed inset-0 z-40 xl:hidden flex justify-end">
        <div className="fixed inset-0 bg-black/45 backdrop-blur-[1px]" onClick={onClose} />
        <div className="relative z-10 h-full">{panelBody}</div>
      </div>
    </>
  );
}
