import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  AtSign,
  Camera,
  Check,
  Clock,
  Maximize2,
  MessageCircle,
  Pencil,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Video,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { AVATAR_PRESETS, generateRandomAvatarUrl } from '../lib/avatarCatalog';
import {
  checkUsernameAvailability,
  fetchAdminAccounts,
  fetchProfileFollowData,
  type AdminAccountRecord,
  type FollowUserSummary,
  type ProfileFollowData,
} from '../lib/backendApi';
import { compressImageToDataUrl, LIMITS, sanitizeHandle } from '../lib/validation';
import type { CallMode, LivePresenceEntry, Profile } from '../types/chat';

/* =========================================================
 * 1. INSTAGRAM-STYLE USER ACCOUNT PROFILE MODAL
 *    - Profile Photo Zoom Lightbox (interactive 1x / 1.75x / 2.5x zoom)
 *    - Live Followers & Following Counts + In-Profile Lists
 *    - Separate Follow/Unfollow vs. App Chat & Call Request controls
 * ========================================================= */
export function UserProfileModal({
  targetProfile,
  currentUid,
  presence,
  isFriend,
  isIncomingRequest,
  isOutgoingRequest,
  myFollowingUids,
  hasActiveStory,
  hasUnseenStory,
  onClose,
  onToggleFollow,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onRemoveFriendRelation,
  onStartDM,
  onStartCall,
  onOpenStory,
  onInspectProfile,
  onEditOwnProfile,
}: {
  targetProfile: Profile;
  currentUid: string;
  presence?: LivePresenceEntry;
  isFriend: boolean;
  isIncomingRequest: boolean;
  isOutgoingRequest: boolean;
  myFollowingUids?: Set<string>;
  hasActiveStory: boolean;
  hasUnseenStory: boolean;
  onClose: () => void;
  onToggleFollow: (
    target: { uid: string; displayName: string; handle: string; photoUrl: string },
    action?: 'follow' | 'unfollow'
  ) => Promise<ProfileFollowData | null>;
  onSendFriendRequest: (target: Profile) => Promise<void>;
  onAcceptFriendRequest: (otherUid: string) => Promise<void>;
  onDeclineFriendRequest: (otherUid: string) => Promise<void>;
  onRemoveFriendRelation: (otherUid: string) => Promise<void>;
  onStartDM: (target: Profile) => Promise<void>;
  onStartCall: (target: Profile, mode: CallMode) => void;
  onOpenStory?: (authorUid: string) => void;
  onInspectProfile?: (nextProfile: Profile) => void;
  onEditOwnProfile?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [rowFollowBusyUid, setRowFollowBusyUid] = useState<string | null>(null);
  const [zoomAvatar, setZoomAvatar] = useState(false);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [zoomRounded, setZoomRounded] = useState<boolean>(true);
  const [followData, setFollowData] = useState<ProfileFollowData | null>(null);
  const [followLoading, setFollowLoading] = useState(true);
  const [activeListTab, setActiveListTab] = useState<'none' | 'followers' | 'following'>('none');
  const [listSearch, setListSearch] = useState('');

  const isSelf = targetProfile.uid === currentUid;
  const liveStatus = presence?.status || targetProfile.status || 'offline';
  const isFollowingTarget =
    followData?.isFollowing ?? Boolean(myFollowingUids?.has(targetProfile.uid));
  const followsYou = Boolean(followData?.followsYou);
  const isMutualFollow = Boolean(followData?.isMutualFollow);
  const canSeeStory = (isSelf || isFriend || isMutualFollow) && hasActiveStory && Boolean(onOpenStory);

  useEffect(() => {
    let cancelled = false;
    setFollowLoading(true);
    setActiveListTab('none');
    setListSearch('');
    setZoomAvatar(false);
    setZoomScale(1);

    void fetchProfileFollowData(targetProfile.uid, currentUid).then((data) => {
      if (!cancelled) {
        setFollowData(data);
        setFollowLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [targetProfile.uid, currentUid]);

  const handleToggleMainFollow = async () => {
    if (isSelf || followBusy) return;
    setFollowBusy(true);
    try {
      const updated = await onToggleFollow(
        {
          uid: targetProfile.uid,
          displayName: targetProfile.displayName,
          handle: targetProfile.handle,
          photoUrl: targetProfile.photoUrl,
        },
        isFollowingTarget ? 'unfollow' : 'follow'
      );
      if (updated) {
        setFollowData(updated);
      } else {
        const refreshed = await fetchProfileFollowData(targetProfile.uid, currentUid);
        setFollowData(refreshed);
      }
    } finally {
      setFollowBusy(false);
    }
  };

  const handleToggleRowFollow = async (item: FollowUserSummary) => {
    if (item.uid === currentUid || rowFollowBusyUid) return;
    setRowFollowBusyUid(item.uid);
    try {
      const currentlyFollowing = Boolean(myFollowingUids?.has(item.uid));
      await onToggleFollow(
        {
          uid: item.uid,
          displayName: item.displayName,
          handle: item.handle,
          photoUrl: item.photoUrl,
        },
        currentlyFollowing ? 'unfollow' : 'follow'
      );
      const refreshed = await fetchProfileFollowData(targetProfile.uid, currentUid);
      setFollowData(refreshed);
    } finally {
      setRowFollowBusyUid(null);
    }
  };

  const openFollowerProfile = (item: FollowUserSummary) => {
    if (!onInspectProfile) return;
    onInspectProfile({
      uid: item.uid,
      displayName: item.displayName,
      handle: item.handle,
      bio: item.bio || '',
      photoUrl: item.photoUrl || '',
      majorOrClub: '',
      status: 'offline',
      statusMessage: '',
      discoverable: true,
      lastSeenAt: null,
      createdAt: null,
      updatedAt: null,
    });
  };

  const activeUsersList: FollowUserSummary[] =
    activeListTab === 'followers'
      ? followData?.followers || []
      : activeListTab === 'following'
        ? followData?.following || []
        : [];

  const cleanedListQuery = listSearch.trim().replace(/^@/, '').toLowerCase();
  const filteredUsersList = cleanedListQuery
    ? activeUsersList.filter(
        (u) =>
          u.displayName.toLowerCase().includes(cleanedListQuery) ||
          u.handle.toLowerCase().includes(cleanedListQuery)
      )
    : activeUsersList;

  const cycleZoom = () => {
    setZoomScale((prev) => (prev < 1.5 ? 1.75 : prev < 2.25 ? 2.5 : 1));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${targetProfile.displayName} account profile`}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col pb-[env(safe-area-inset-bottom)] sm:pb-0"
      >
        {activeListTab !== 'none' ? (
          /* ================= FOLLOWERS / FOLLOWING IN-PROFILE LIST VIEW ================= */
          <div className="flex flex-col max-h-[82dvh]">
            <div className="px-4 py-3.5 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveListTab('none');
                    setListSearch('');
                  }}
                  aria-label="Back to profile"
                  className="p-1.5 rounded-lg text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-stone-900 dark:text-white truncate">
                    {targetProfile.displayName}
                  </p>
                  <p className="text-[11px] font-mono-tabular text-stone-500 dark:text-slate-400 truncate">
                    @{targetProfile.handle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close profile"
                className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Followers / Following Tabs */}
            <div className="grid grid-cols-2 border-b border-stone-200 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveListTab('followers')}
                className={`py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeListTab === 'followers'
                    ? 'border-emerald-600 text-stone-900 dark:text-white'
                    : 'border-transparent text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200'
                }`}
              >
                Followers ({followData?.followersCount ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveListTab('following')}
                className={`py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeListTab === 'following'
                    ? 'border-emerald-600 text-stone-900 dark:text-white'
                    : 'border-transparent text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-slate-200'
                }`}
              >
                Following ({followData?.followingCount ?? 0})
              </button>
            </div>

            {activeUsersList.length >= 4 && (
              <div className="px-4 pt-3 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    placeholder={`Search ${activeListTab}...`}
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>
            )}

            <div className="p-4 overflow-y-auto space-y-2 flex-1 min-h-[220px]">
              {followLoading ? (
                <p className="text-xs text-stone-500 text-center py-10">Loading {activeListTab}...</p>
              ) : filteredUsersList.length === 0 ? (
                <div className="py-10 text-center space-y-1.5">
                  <Users className="w-6 h-6 mx-auto text-stone-400" />
                  <p className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                    {activeListTab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400">
                    {activeListTab === 'followers'
                      ? `People who follow @${targetProfile.handle} will appear here.`
                      : `Accounts @${targetProfile.handle} follows will appear here.`}
                  </p>
                </div>
              ) : (
                filteredUsersList.map((item) => {
                  const isMeRow = item.uid === currentUid;
                  const iFollowRow = Boolean(myFollowingUids?.has(item.uid));
                  return (
                    <div
                      key={item.uid}
                      className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-stone-50/80 dark:bg-slate-900/70 border border-stone-200/70 dark:border-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() => openFollowerProfile(item)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <Avatar name={item.displayName} src={item.photoUrl} size="md" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                            {item.displayName}
                          </p>
                          <p className="text-[11px] font-mono-tabular text-stone-500 dark:text-slate-400 truncate">
                            @{item.handle}
                          </p>
                          {item.bio && (
                            <p className="text-[10px] text-stone-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {item.bio}
                            </p>
                          )}
                        </div>
                      </button>

                      {!isMeRow && (
                        <button
                          type="button"
                          disabled={rowFollowBusyUid === item.uid}
                          onClick={() => void handleToggleRowFollow(item)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${
                            iFollowRow
                              ? 'bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-stone-300 dark:hover:bg-slate-700'
                              : 'bg-accent text-white hover:opacity-90'
                          }`}
                        >
                          {rowFollowBusyUid === item.uid
                            ? '...'
                            : iFollowRow
                              ? 'Following'
                              : 'Follow'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* ================= MAIN PROFILE OVERVIEW ================= */
          <div className="overflow-y-auto">
            {/* Top Cover Accent Strip */}
            <div className="h-20 bg-gradient-to-r from-emerald-600/20 via-teal-500/15 to-fuchsia-500/20 dark:from-emerald-500/20 dark:via-teal-500/15 dark:to-fuchsia-500/20 relative">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close profile"
                className="absolute top-3 right-3 p-2 rounded-full bg-white/85 dark:bg-slate-900/80 text-stone-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 pb-5 -mt-11 space-y-4">
              {/* Zoomable Profile Picture + Live Followers / Following Stats Row */}
              <div className="flex items-end justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setZoomScale(1);
                    setZoomAvatar(true);
                  }}
                  title="Tap to zoom profile picture"
                  aria-label="Zoom profile picture"
                  className={`relative group rounded-full p-[3px] transition-transform active:scale-95 cursor-pointer shrink-0 ${
                    canSeeStory
                      ? hasUnseenStory
                        ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600'
                        : 'bg-stone-300 dark:bg-slate-600'
                      : 'bg-white dark:bg-[#161B22]'
                  }`}
                >
                  <div className="rounded-full p-[3px] bg-white dark:bg-[#161B22]">
                    <Avatar
                      name={targetProfile.displayName}
                      src={targetProfile.photoUrl}
                      size="xl"
                      status={isFriend || isSelf ? liveStatus : undefined}
                      showStatus={isFriend || isSelf}
                    />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-stone-900/85 dark:bg-white text-white dark:text-stone-900 flex items-center justify-center shadow-md ring-2 ring-white dark:ring-[#161B22] group-hover:scale-110 transition-transform">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </span>
                </button>

                {/* Instagram-Style Tappable Followers & Following Counters */}
                <div className="flex items-center gap-2 pb-1 flex-1 justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveListTab('followers')}
                    className="px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-slate-900/80 border border-stone-200/80 dark:border-slate-800 hover:border-emerald-500/60 transition-colors text-center min-w-[76px] cursor-pointer"
                  >
                    <p className="font-display text-base font-bold text-stone-900 dark:text-white tabular-nums leading-tight">
                      {followLoading ? '–' : followData?.followersCount ?? 0}
                    </p>
                    <p className="text-[10px] font-medium text-stone-500 dark:text-slate-400">
                      Followers
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveListTab('following')}
                    className="px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-slate-900/80 border border-stone-200/80 dark:border-slate-800 hover:border-emerald-500/60 transition-colors text-center min-w-[76px] cursor-pointer"
                  >
                    <p className="font-display text-base font-bold text-stone-900 dark:text-white tabular-nums leading-tight">
                      {followLoading ? '–' : followData?.followingCount ?? 0}
                    </p>
                    <p className="text-[10px] font-medium text-stone-500 dark:text-slate-400">
                      Following
                    </p>
                  </button>
                </div>
              </div>

              {/* Instagram-style Name, @username, Relationship Tags & Bio */}
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold text-stone-900 dark:text-white leading-tight truncate">
                      {targetProfile.displayName}
                    </h2>
                    <p className="text-xs font-mono-tabular text-stone-500 dark:text-slate-400">
                      @{targetProfile.handle}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                    {isSelf ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-200">
                        Your Profile
                      </span>
                    ) : (
                      <>
                        {isMutualFollow ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                            Mutual Follow
                          </span>
                        ) : followsYou ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300">
                            Follows you
                          </span>
                        ) : null}
                        {isFriend && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            Chat Connected
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {targetProfile.bio ? (
                  <p className="text-xs text-stone-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pt-1">
                    {targetProfile.bio}
                  </p>
                ) : (
                  <p className="text-xs text-stone-400 dark:text-slate-500 italic pt-0.5">
                    No bio added yet.
                  </p>
                )}

                {targetProfile.majorOrClub && (
                  <p className="text-[11px] text-stone-500 dark:text-slate-400">
                    {targetProfile.majorOrClub}
                  </p>
                )}
              </div>

              {/* Mutual Story Banner (Separate from Photo Zoom!) */}
              {canSeeStory && onOpenStory && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenStory(targetProfile.uid);
                  }}
                  className="w-full py-2 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{hasUnseenStory ? 'View New 24h Story' : 'View Active 24h Story'}</span>
                </button>
              )}

              {/* Own Profile Actions */}
              {isSelf && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setZoomScale(1);
                      setZoomAvatar(true);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Zoom Photo</span>
                  </button>
                  {onEditOwnProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onEditOwnProfile();
                      }}
                      className="py-2.5 px-3 rounded-xl bg-accent text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Profile</span>
                    </button>
                  )}
                </div>
              )}

              {/* SEPARATE ACTIONS FOR OTHER USERS: 1) FOLLOW vs 2) APP CHAT REQUEST */}
              {!isSelf && (
                <div className="space-y-3 pt-1">
                  {/* 1. FOLLOW / UNFOLLOW (Dedicated Followers System) */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={followBusy}
                      onClick={() => void handleToggleMainFollow()}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                        isFollowingTarget
                          ? 'bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-800 dark:text-slate-100 border border-stone-200 dark:border-slate-700'
                          : 'bg-accent text-white hover:opacity-90'
                      }`}
                    >
                      {isFollowingTarget ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{followBusy ? 'Updating...' : 'Following'}</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>
                            {followBusy
                              ? 'Following...'
                              : followsYou
                                ? 'Follow Back'
                                : 'Follow'}
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setZoomScale(1);
                        setZoomAvatar(true);
                      }}
                      title="Zoom profile photo"
                      aria-label="Zoom profile photo"
                      className="py-2.5 px-3 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer shrink-0"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>Zoom</span>
                    </button>
                  </div>

                  {/* 2. SEPARATE APP CHAT & CALL REQUEST CARD */}
                  <div className="p-3 rounded-2xl bg-stone-50/90 dark:bg-slate-900/70 border border-stone-200/80 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-stone-700 dark:text-slate-300 flex items-center gap-1.5">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>App Chat &amp; Call Request</span>
                      </p>
                      <span className="text-[10px] font-medium text-stone-500 dark:text-slate-400">
                        {isFriend
                          ? 'Accepted'
                          : isIncomingRequest
                            ? 'Incoming Request'
                            : isOutgoingRequest
                              ? 'Pending'
                              : 'Separate from Follow'}
                      </span>
                    </div>

                    {isFriend ? (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await onStartDM(targetProfile);
                              onClose();
                            }}
                            className="py-2 px-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onStartCall(targetProfile, 'audio');
                              onClose();
                            }}
                            className="py-2 px-2.5 rounded-xl bg-white dark:bg-[#1C2128] border border-stone-200 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-stone-900 dark:text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Voice</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onStartCall(targetProfile, 'video');
                              onClose();
                            }}
                            className="py-2 px-2.5 rounded-xl bg-white dark:bg-[#1C2128] border border-stone-200 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-800 text-stone-900 dark:text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Video className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Video</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await onRemoveFriendRelation(targetProfile.uid);
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="w-full py-1.5 px-3 rounded-lg text-[11px] font-medium text-stone-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/70 dark:hover:bg-red-950/30 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <UserMinus className="w-3 h-3" />
                          <span>Remove Chat Connection</span>
                        </button>
                      </>
                    ) : isIncomingRequest ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-stone-600 dark:text-slate-400">
                          @{targetProfile.handle} sent you an app chat request to message &amp; call.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await onAcceptFriendRequest(targetProfile.uid);
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Accept Request</span>
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await onDeclineFriendRequest(targetProfile.uid);
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="py-2 px-3 rounded-xl bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ) : isOutgoingRequest ? (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await onRemoveFriendRelation(targetProfile.uid);
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Chat Request Sent · Cancel</span>
                        </button>
                        <p className="text-[10px] text-center text-stone-500 dark:text-slate-400">
                          Waiting for @{targetProfile.handle} to accept your private chat &amp; call request.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await onSendFriendRequest(targetProfile);
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#1C2128] border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Send App Chat Request</span>
                        </button>
                        <p className="text-[10px] text-center text-stone-500 dark:text-slate-400">
                          Follow adds you to their followers. Send a separate Chat Request to message or call 1-to-1.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Full-Screen Profile Picture Zoom Lightbox */}
      {zoomAvatar && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setZoomAvatar(false);
            setZoomScale(1);
          }}
          className="fixed inset-0 z-60 bg-black/92 backdrop-blur-sm flex flex-col items-center justify-between p-4 sm:p-6"
        >
          {/* Top Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg flex items-center justify-between gap-2 text-white"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{targetProfile.displayName}</p>
              <p className="text-[11px] font-mono-tabular text-white/70 truncate">
                @{targetProfile.handle} · Tap photo to zoom ({Math.round(zoomScale * 100)}%)
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setZoomAvatar(false);
                setZoomScale(1);
              }}
              aria-label="Close photo zoom"
              className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Center Zoomable Photo Stage */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              cycleZoom();
            }}
            className="flex-1 w-full flex items-center justify-center overflow-auto p-4 cursor-zoom-in"
          >
            {targetProfile.photoUrl ? (
              <img
                src={targetProfile.photoUrl}
                alt={targetProfile.displayName}
                style={{ transform: `scale(${zoomScale})` }}
                className={`w-64 h-64 sm:w-80 sm:h-80 object-cover shadow-2xl ring-4 ring-white/20 transition-transform duration-200 select-none ${
                  zoomRounded ? 'rounded-full' : 'rounded-2xl'
                }`}
              />
            ) : (
              <div
                style={{ transform: `scale(${zoomScale})` }}
                className={`w-64 h-64 sm:w-80 sm:h-80 bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex flex-col items-center justify-center gap-2 shadow-2xl ring-4 ring-white/20 transition-transform duration-200 select-none ${
                  zoomRounded ? 'rounded-full' : 'rounded-2xl'
                }`}
              >
                <span className="font-display text-7xl font-bold">
                  {(targetProfile.displayName || 'U').slice(0, 2).toUpperCase()}
                </span>
                <span className="text-xs text-white/80">No custom photo yet</span>
              </div>
            )}
          </div>

          {/* Bottom Zoom Controls Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/12 border border-white/15 text-white backdrop-blur-md"
          >
            <button
              type="button"
              disabled={zoomScale <= 1}
              onClick={() => setZoomScale((s) => Math.max(1, Number((s - 0.5).toFixed(2))))}
              aria-label="Zoom out"
              className="p-2 rounded-full hover:bg-white/15 disabled:opacity-35 cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono-tabular min-w-[46px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              disabled={zoomScale >= 3}
              onClick={() => setZoomScale((s) => Math.min(3, Number((s + 0.5).toFixed(2))))}
              aria-label="Zoom in"
              className="p-2 rounded-full hover:bg-white/15 disabled:opacity-35 cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="w-px h-4 bg-white/20" />
            <button
              type="button"
              onClick={() => setZoomRounded((r) => !r)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium hover:bg-white/15 cursor-pointer"
            >
              {zoomRounded ? 'Square' : 'Circle'}
            </button>
            {zoomScale > 1 && (
              <button
                type="button"
                onClick={() => setZoomScale(1)}
                aria-label="Reset zoom"
                className="p-2 rounded-full hover:bg-white/15 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
 * 2. INSTAGRAM-STYLE NEW ACCOUNT SETUP MODAL (FOR SSO / NEW USERS)
 * ========================================================= */
export function OnboardingProfileModal({
  profile,
  onSave,
  onSkip,
}: {
  profile: Profile;
  onSave: (updates: {
    displayName: string;
    handle: string;
    bio: string;
    photoUrl: string;
  }) => Promise<void>;
  onSkip: () => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [handle, setHandle] = useState(profile.handle || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl || '');
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean;
    reason?: string;
  }>({ checking: false, available: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cleaned = handle.trim().replace(/^@/, '').toLowerCase();
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
  }, [handle, profile.uid]);

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
    setError(null);
    const cleanHandle = sanitizeHandle(handle, profile.uid);
    if (!usernameStatus.available) {
      setError(usernameStatus.reason || 'Please choose an available username.');
      return;
    }
    setBusy(true);
    try {
      await onSave({
        displayName: displayName.trim() || profile.displayName,
        handle: cleanHandle,
        bio: bio.trim(),
        photoUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set up your account profile"
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        <div className="px-5 py-4 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-stone-900 dark:text-white">
              Set Up Your Account
            </h2>
            <p className="text-xs text-stone-500 dark:text-slate-400">
              Choose your separate profile picture, @username, name &amp; bio
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
          >
            Skip
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Separate Profile Picture Card */}
          <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-slate-900/70 border border-stone-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-3.5">
              <Avatar name={displayName || 'You'} src={photoUrl} size="xl" />
              <div className="flex-1 space-y-1.5">
                <p className="text-xs font-bold text-stone-900 dark:text-white">
                  Profile Picture
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white cursor-pointer">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(generateRandomAvatarUrl(photoUrl))}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-200 cursor-pointer"
                  >
                    Random Avatar
                  </button>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      aria-label="Remove photo"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {AVATAR_PRESETS.slice(0, 8).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPhotoUrl(preset.dataUrl)}
                  className={`w-8 h-8 rounded-full overflow-hidden border-2 shrink-0 cursor-pointer ${
                    photoUrl === preset.dataUrl
                      ? 'border-emerald-600 scale-105'
                      : 'border-stone-200 dark:border-slate-700'
                  }`}
                >
                  <img src={preset.dataUrl} alt={preset.label} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
              Full Name
            </label>
            <input
              type="text"
              required
              maxLength={LIMITS.DISPLAY_NAME_MAX}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Aarav Sharma"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
              Username (like Instagram)
            </label>
            <div className="relative">
              <AtSign className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                maxLength={LIMITS.HANDLE_MAX}
                value={handle}
                onChange={(e) =>
                  setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))
                }
                placeholder="aarav.sharma"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-mono-tabular bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <p
              className={`text-[11px] ${
                usernameStatus.checking
                  ? 'text-stone-400'
                  : usernameStatus.available
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
              }`}
            >
              {usernameStatus.checking
                ? 'Checking username...'
                : usernameStatus.available
                  ? `@${handle || 'username'} is available`
                  : usernameStatus.reason || 'Username not available'}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-stone-700 dark:text-slate-300">
                Bio
              </label>
              <span className="text-[10px] text-stone-400 tabular-nums">
                {bio.length}/{LIMITS.BIO_MAX}
              </span>
            </div>
            <textarea
              rows={2}
              maxLength={LIMITS.BIO_MAX}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a short bio about yourself..."
              className="w-full px-3.5 py-2 rounded-xl text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !usernameStatus.available}
            className="w-full py-2.5 px-4 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{busy ? 'Saving...' : 'Finish Account Setup'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
 * 3. ADMIN-ONLY REGISTERED ACCOUNTS MODAL
 * ========================================================= */
export function AdminAccountsModal({
  adminEmail,
  onClose,
  onInspectProfile,
}: {
  adminEmail: string;
  onClose: () => void;
  onInspectProfile?: (acc: AdminAccountRecord) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [accounts, setAccounts] = useState<AdminAccountRecord[]>([]);
  const [search, setSearch] = useState('');

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    const res = await fetchAdminAccounts(adminEmail);
    if (res.error) {
      setError(res.error);
    } else {
      setTotalCount(res.totalCount);
      setTodayCount(res.todayCount);
      setAccounts(res.accounts);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadAccounts();
  }, [adminEmail]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? accounts.filter(
        (a) =>
          a.displayName.toLowerCase().includes(q) ||
          a.handle.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.bio.toLowerCase().includes(q)
      )
    : accounts;

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Admin Account Directory"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[88dvh] flex flex-col"
      >
        <div className="px-5 py-4 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-stone-900 dark:text-white">
                Admin · Website Accounts
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-slate-400">
                Visible only to website admin ({adminEmail})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void loadAccounts()}
              aria-label="Refresh accounts"
              className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {error ? (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : (
            <>
              {/* Admin KPI Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800">
                  <p className="text-[11px] font-medium text-stone-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Total Registered Accounts</span>
                  </p>
                  <p className="font-display text-2xl font-bold text-stone-900 dark:text-white tabular-nums mt-1">
                    {totalCount}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-slate-900 border border-stone-200/80 dark:border-slate-800">
                  <p className="text-[11px] font-medium text-stone-500 dark:text-slate-400">
                    New Signups Today
                  </p>
                  <p className="font-display text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                    +{todayCount}
                  </p>
                </div>
              </div>

              {/* Search Registered Accounts */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by @username, name, or email..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Account Rows */}
              {loading ? (
                <p className="text-xs text-stone-500 text-center py-8">Loading accounts...</p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-8">
                  No accounts match your filter.
                </p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((acc) => (
                    <div
                      key={acc.uid}
                      onClick={() => onInspectProfile?.(acc)}
                      className="p-3 rounded-xl bg-stone-50/80 dark:bg-slate-900/70 border border-stone-200/80 dark:border-slate-800 hover:border-accent flex items-start gap-3 transition-colors cursor-pointer"
                    >
                      <Avatar name={acc.displayName} src={acc.photoUrl} size="md" />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="min-w-0 flex items-center gap-1.5">
                            <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                              {acc.displayName}
                            </p>
                            <span className="text-[11px] font-mono-tabular text-emerald-700 dark:text-emerald-400">
                              @{acc.handle}
                            </span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-200/80 dark:bg-slate-800 text-stone-600 dark:text-slate-300 uppercase font-semibold">
                            {acc.authMethod || 'email'}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 dark:text-slate-400 truncate">
                          {acc.email || 'No email recorded'}
                        </p>
                        {acc.bio && (
                          <p className="text-[11px] text-stone-500 dark:text-slate-400 line-clamp-1">
                            {acc.bio}
                          </p>
                        )}
                        <p className="text-[10px] text-stone-400 dark:text-slate-500 pt-0.5">
                          Joined {formatDate(acc.createdAt)} · Last active {formatDate(acc.lastLoginAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
