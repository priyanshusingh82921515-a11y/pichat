import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Image as ImageIcon,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { ResumableChunkedUpload } from '../lib/chunkedUpload';
import type { StoryItem } from '../lib/backendApi';
import type { Profile } from '../types/chat';

export interface StoryGroup {
  authorUid: string;
  authorName: string;
  authorHandle: string;
  authorPhoto: string;
  stories: StoryItem[];
  hasUnseen: boolean;
  latestCreatedAt: number;
}

export const STORY_GRADIENTS: Record<string, { label: string; className: string }> = {
  sunset: {
    label: 'Sunset',
    className: 'bg-gradient-to-br from-amber-500 via-rose-500 to-fuchsia-600',
  },
  ocean: {
    label: 'Ocean',
    className: 'bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700',
  },
  emerald: {
    label: 'Emerald',
    className: 'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700',
  },
  midnight: {
    label: 'Midnight',
    className: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-900',
  },
  rose: {
    label: 'Blush',
    className: 'bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400',
  },
  aurora: {
    label: 'Aurora',
    className: 'bg-gradient-to-br from-violet-600 via-fuchsia-600 to-amber-500',
  },
};

export function groupStoriesByAuthor(
  stories: StoryItem[],
  currentUid: string,
  profilesByUid: Record<string, Profile>
): StoryGroup[] {
  const byAuthor = new Map<string, StoryItem[]>();
  for (const s of stories) {
    const list = byAuthor.get(s.authorUid) || [];
    list.push(s);
    byAuthor.set(s.authorUid, list);
  }
  const groups: StoryGroup[] = [];
  for (const [authorUid, list] of byAuthor.entries()) {
    list.sort((a, b) => a.createdAt - b.createdAt);
    const live = profilesByUid[authorUid];
    const last = list[list.length - 1];
    const hasUnseen =
      authorUid !== currentUid &&
      list.some((s) => !s.viewers.some((v) => v.uid === currentUid));
    groups.push({
      authorUid,
      authorName: live?.displayName || last.authorName,
      authorHandle: live?.handle || last.authorHandle,
      authorPhoto: live?.photoUrl || last.authorPhoto,
      stories: list,
      hasUnseen,
      latestCreatedAt: last.createdAt,
    });
  }
  groups.sort((a, b) => {
    if (a.authorUid === currentUid) return -1;
    if (b.authorUid === currentUid) return 1;
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    return b.latestCreatedAt - a.latestCreatedAt;
  });
  return groups;
}

function formatStoryAgo(ts: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

/* =========================================================
 * 1. INSTAGRAM-STYLE MUTUAL STORIES TRAY (TOP OF SIDEBAR)
 * ========================================================= */
export function StoriesTray({
  currentProfile,
  storyGroups,
  onOpenCreateStory,
  onOpenStoryGroup,
}: {
  currentProfile: Profile;
  storyGroups: StoryGroup[];
  onOpenCreateStory: () => void;
  onOpenStoryGroup: (authorUid: string) => void;
}) {
  const myGroup = storyGroups.find((g) => g.authorUid === currentProfile.uid) || null;
  const friendGroups = storyGroups.filter((g) => g.authorUid !== currentProfile.uid);

  return (
    <section className="px-1 pt-0.5 pb-1">
      <div className="flex items-center justify-between px-1 mb-1.5">
        <p className="text-[11px] font-semibold text-stone-500 dark:text-slate-400">
          Stories · Mutual Friends
        </p>
        <button
          type="button"
          onClick={onOpenCreateStory}
          className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-0.5 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Add Story</span>
        </button>
      </div>

      <div className="flex items-start gap-2.5 overflow-x-auto pb-1 no-scrollbar">
        {/* Your Story Tile */}
        <div className="flex flex-col items-center gap-1 shrink-0 w-16">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (myGroup) {
                  onOpenStoryGroup(currentProfile.uid);
                } else {
                  onOpenCreateStory();
                }
              }}
              aria-label={myGroup ? 'View your active story' : 'Add your story'}
              className={`p-[2.5px] rounded-full transition-transform active:scale-95 cursor-pointer ${
                myGroup
                  ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600'
                  : 'bg-stone-200 dark:bg-slate-700'
              }`}
            >
              <div className="p-[2px] rounded-full bg-white dark:bg-[#0D1117]">
                <Avatar
                  name={currentProfile.displayName}
                  src={currentProfile.photoUrl}
                  size="md"
                />
              </div>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateStory();
              }}
              aria-label="Create new story"
              title="Add new story"
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-accent text-white border-2 border-white dark:border-[#0D1117] flex items-center justify-center shadow-xs cursor-pointer"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
            </button>
          </div>
          <span className="text-[10px] font-medium text-stone-700 dark:text-slate-300 truncate max-w-full">
            {myGroup ? 'Your Story' : 'Add Story'}
          </span>
        </div>

        {/* Mutual Friends' Active Stories */}
        {friendGroups.map((group) => (
          <button
            key={group.authorUid}
            type="button"
            onClick={() => onOpenStoryGroup(group.authorUid)}
            className="flex flex-col items-center gap-1 shrink-0 w-16 group cursor-pointer"
          >
            <div
              className={`p-[2.5px] rounded-full transition-transform group-active:scale-95 ${
                group.hasUnseen
                  ? 'bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600'
                  : 'bg-stone-300 dark:bg-slate-700'
              }`}
            >
              <div className="p-[2px] rounded-full bg-white dark:bg-[#0D1117]">
                <Avatar
                  name={group.authorName}
                  src={group.authorPhoto}
                  size="md"
                />
              </div>
            </div>
            <span className="text-[10px] font-medium text-stone-700 dark:text-slate-300 truncate max-w-full">
              {group.authorHandle}
            </span>
          </button>
        ))}

        {friendGroups.length === 0 && (
          <div className="flex-1 min-w-[160px] px-3 py-2 rounded-xl bg-white/80 dark:bg-[#161B22]/80 border border-dashed border-stone-200 dark:border-slate-800 flex flex-col justify-center">
            <p className="text-[11px] font-semibold text-stone-700 dark:text-slate-200">
              Mutual Follow Stories
            </p>
            <p className="text-[10px] text-stone-500 dark:text-slate-400 leading-snug">
              When you &amp; a friend follow each other, their 24h stories appear here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/* =========================================================
 * 2. FULL-SCREEN INSTAGRAM-STYLE STORY VIEWER
 * ========================================================= */
export function StoryViewerModal({
  storyGroups,
  initialAuthorUid,
  currentProfile,
  onClose,
  onMarkViewed,
  onDeleteStory,
  onReplyStory,
  onViewProfile,
}: {
  storyGroups: StoryGroup[];
  initialAuthorUid: string;
  currentProfile: Profile;
  onClose: () => void;
  onMarkViewed: (storyId: string) => void;
  onDeleteStory: (storyId: string) => Promise<void>;
  onReplyStory: (authorUid: string, replyText: string) => Promise<void>;
  onViewProfile: (uid: string) => void;
}) {
  const initialGroupIdx = Math.max(
    0,
    storyGroups.findIndex((g) => g.authorUid === initialAuthorUid)
  );
  const [groupIdx, setGroupIdx] = useState(initialGroupIdx);
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const viewedIdsRef = useRef<Set<string>>(new Set());

  const activeGroup = storyGroups[groupIdx] || null;
  const activeStory = activeGroup?.stories[storyIdx] || null;

  useEffect(() => {
    if (!activeGroup || !activeStory) {
      onClose();
    }
  }, [activeGroup, activeStory, onClose]);

  useEffect(() => {
    if (!activeStory) return;
    if (!viewedIdsRef.current.has(activeStory.id)) {
      viewedIdsRef.current.add(activeStory.id);
      onMarkViewed(activeStory.id);
    }
  }, [activeStory, onMarkViewed]);

  const goNext = useMemo(
    () => () => {
      if (!activeGroup) {
        onClose();
        return;
      }
      if (storyIdx + 1 < activeGroup.stories.length) {
        setStoryIdx((i) => i + 1);
        setProgress(0);
      } else if (groupIdx + 1 < storyGroups.length) {
        setGroupIdx((g) => g + 1);
        setStoryIdx(0);
        setProgress(0);
      } else {
        onClose();
      }
    },
    [activeGroup, storyIdx, groupIdx, storyGroups.length, onClose]
  );

  const goPrev = () => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      const prevGroup = storyGroups[groupIdx - 1];
      setGroupIdx((g) => g - 1);
      setStoryIdx(Math.max(0, prevGroup.stories.length - 1));
      setProgress(0);
    }
  };

  // Auto-advance timer for photo & text stories (5.5s each)
  useEffect(() => {
    if (!activeStory || paused || showViewers || activeStory.mediaType === 'video') return;
    const durationMs = 5500;
    const stepMs = 50;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + (stepMs / durationMs) * 100;
        if (next >= 100) {
          goNext();
          return 0;
        }
        return next;
      });
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [activeStory, paused, showViewers, goNext]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, onClose]);

  if (!activeGroup || !activeStory) return null;

  const isOwnStory = activeStory.authorUid === currentProfile.uid;
  const gradientClass =
    STORY_GRADIENTS[activeStory.backgroundTheme]?.className || STORY_GRADIENTS.sunset.className;

  const handleSendReply = async (textOverride?: string) => {
    const text = (textOverride ?? replyText).trim();
    if (!text || isOwnStory || sendingReply) return;
    setSendingReply(true);
    try {
      await onReplyStory(activeStory.authorUid, `Replied to your story: ${text}`);
      setReplyText('');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${activeGroup.authorName}'s Story`}
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-0 sm:p-4"
    >
      {/* Desktop Prev/Next Group Arrows */}
      {groupIdx > 0 && (
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous story"
          className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {groupIdx + 1 < storyGroups.length && (
        <button
          type="button"
          onClick={goNext}
          aria-label="Next story"
          className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center cursor-pointer"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Story Card Stage */}
      <div className="relative w-full h-full sm:w-[400px] sm:h-[720px] sm:max-h-[92dvh] sm:rounded-3xl overflow-hidden bg-slate-950 flex flex-col shadow-2xl">
        {/* Background Media or Gradient */}
        <div
          className={`absolute inset-0 flex items-center justify-center ${
            activeStory.mediaType === 'text' ? gradientClass : 'bg-black'
          }`}
        >
          {activeStory.mediaType === 'image' && (
            <img
              src={activeStory.mediaUrl}
              alt={activeStory.caption || `${activeGroup.authorName}'s story`}
              className="w-full h-full object-contain"
            />
          )}
          {activeStory.mediaType === 'video' && (
            <video
              key={activeStory.id}
              src={activeStory.mediaUrl}
              autoPlay
              playsInline
              muted={muted}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration > 0) {
                  setProgress((v.currentTime / v.duration) * 100);
                }
              }}
              onEnded={goNext}
              className="w-full h-full object-contain"
            />
          )}
          {activeStory.mediaType === 'text' && (
            <div className="px-8 text-center">
              <p className="font-display text-2xl sm:text-3xl font-bold text-white leading-snug drop-shadow-sm whitespace-pre-wrap break-words">
                {activeStory.caption}
              </p>
            </div>
          )}
        </div>

        {/* Tap Left / Right Invisible Navigation Zones */}
        <div className="absolute inset-0 z-10 flex">
          <button
            type="button"
            aria-label="Previous"
            onClick={goPrev}
            className="w-1/3 h-full bg-transparent cursor-pointer"
          />
          <button
            type="button"
            aria-label={paused ? 'Resume story' : 'Pause story'}
            onClick={() => setPaused((p) => !p)}
            className="w-1/3 h-full bg-transparent cursor-pointer"
          />
          <button
            type="button"
            aria-label="Next"
            onClick={goNext}
            className="w-1/3 h-full bg-transparent cursor-pointer"
          />
        </div>

        {/* Top Progress Bars & Header */}
        <div className="relative z-20 p-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/75 via-black/35 to-transparent space-y-2.5">
          <div className="flex items-center gap-1">
            {activeGroup.stories.map((st, idx) => {
              const pct = idx < storyIdx ? 100 : idx === storyIdx ? progress : 0;
              return (
                <div
                  key={st.id}
                  className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-[width] duration-75"
                    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewProfile(activeGroup.authorUid);
              }}
              className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
            >
              <Avatar
                name={activeGroup.authorName}
                src={activeGroup.authorPhoto}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {activeGroup.authorName}
                </p>
                <p className="text-[10px] text-white/80 truncate">
                  @{activeGroup.authorHandle} · {formatStoryAgo(activeStory.createdAt)}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-1 shrink-0">
              {activeStory.mediaType === 'video' && (
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  className="p-2 rounded-full bg-black/35 text-white hover:bg-black/55 cursor-pointer"
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? 'Play' : 'Pause'}
                className="p-2 rounded-full bg-black/35 text-white hover:bg-black/55 cursor-pointer"
              >
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              {isOwnStory && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await onDeleteStory(activeStory.id);
                      if (activeGroup.stories.length <= 1) {
                        onClose();
                      } else {
                        setStoryIdx((i) => Math.max(0, i - 1));
                      }
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  aria-label="Delete story"
                  title="Delete story"
                  className="p-2 rounded-full bg-black/35 text-red-300 hover:bg-red-600/80 hover:text-white cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close story"
                className="p-2 rounded-full bg-black/35 text-white hover:bg-black/55 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Caption + Viewers / Reply Bar */}
        <div className="mt-auto relative z-20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/85 via-black/45 to-transparent space-y-3">
          {activeStory.mediaType !== 'text' && activeStory.caption && (
            <p className="text-sm text-white text-center drop-shadow-xs px-2">
              {activeStory.caption}
            </p>
          )}

          {isOwnStory ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowViewers((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>
                  Seen by {activeStory.viewers.length}
                </span>
              </button>
              <span className="text-[11px] text-white/75">
                Visible only to mutual friends
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                {['🔥', '❤️', '😂', '😍', '👏'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => void handleSendReply(emoji)}
                    className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-base flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendReply();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={replyText}
                  onFocus={() => setPaused(true)}
                  onBlur={() => setPaused(false)}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${activeGroup.authorName}...`}
                  className="flex-1 px-4 py-2.5 rounded-full bg-white/15 border border-white/25 text-xs text-white placeholder:text-white/70 focus:outline-none focus:bg-white/20"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || sendingReply}
                  aria-label="Send reply"
                  className="p-2.5 rounded-full bg-accent text-white disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Own Story Viewers Drawer */}
        {isOwnStory && showViewers && (
          <div className="absolute inset-x-0 bottom-0 z-30 max-h-[60%] bg-white dark:bg-[#161B22] rounded-t-2xl p-4 flex flex-col gap-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-accent" />
                <span>Viewed by {activeStory.viewers.length}</span>
              </p>
              <button
                type="button"
                onClick={() => setShowViewers(false)}
                className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto space-y-2">
              {activeStory.viewers.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-slate-400 text-center py-6">
                  No mutual friends have viewed this story yet.
                </p>
              ) : (
                activeStory.viewers.map((viewer) => (
                  <div
                    key={viewer.uid}
                    className="flex items-center justify-between gap-2.5 p-2 rounded-xl bg-stone-50 dark:bg-slate-900/70"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={viewer.displayName} src={viewer.photoUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                          {viewer.displayName}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                          @{viewer.handle}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-stone-400 shrink-0">
                      {formatStoryAgo(viewer.viewedAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
 * 3. CREATE 24-HOUR STORY MODAL (PHOTO / VIDEO / TEXT)
 * ========================================================= */
export function CreateStoryModal({
  profile,
  onClose,
  onPublishStory,
}: {
  profile: Profile;
  onClose: () => void;
  onPublishStory: (payload: {
    mediaType: 'image' | 'video' | 'text';
    mediaUrl?: string;
    caption?: string;
    backgroundTheme?: string;
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<'media' | 'text'>('media');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [themeKey, setThemeKey] = useState<string>('sunset');
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setError('Please select a photo or video for your story.');
      return;
    }
    setUploading(true);
    setUploadPct(0);
    try {
      const uploader = new ResumableChunkedUpload({
        file,
        uploaderUid: profile.uid,
        onProgress: (st) => setUploadPct(st.progressPct),
      });
      const done = await uploader.run();
      setMediaType(isVideo ? 'video' : 'image');
      setMediaUrl(done.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload story media.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'media' && !mediaUrl) {
      setError('Pick a photo or video first, or switch to Text Story.');
      return;
    }
    if (mode === 'text' && !caption.trim()) {
      setError('Write something for your Text Story.');
      return;
    }
    setPublishing(true);
    try {
      await onPublishStory(
        mode === 'text'
          ? { mediaType: 'text', caption: caption.trim(), backgroundTheme: themeKey }
          : { mediaType, mediaUrl, caption: caption.trim(), backgroundTheme: themeKey }
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish story.');
    } finally {
      setPublishing(false);
    }
  };

  const gradientClass = STORY_GRADIENTS[themeKey]?.className || STORY_GRADIENTS.sunset.className;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create a Story"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
      >
        <div className="px-5 py-4 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-rose-500" />
              <span>Add to Your Story</span>
            </h2>
            <p className="text-[11px] text-stone-500 dark:text-slate-400">
              Visible for 24 hours only to friends who follow you back
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
          {/* Mode Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setMode('media')}
              className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'media'
                  ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-600 dark:text-slate-400'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Photo / Video</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'text'
                  ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                  : 'text-stone-600 dark:text-slate-400'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Text Story</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {mode === 'media' ? (
            <div className="space-y-3">
              {mediaUrl ? (
                <div className="relative rounded-2xl overflow-hidden bg-black h-64 flex items-center justify-center">
                  {mediaType === 'video' ? (
                    <video src={mediaUrl} controls className="w-full h-full object-contain" />
                  ) : (
                    <img src={mediaUrl} alt="Story preview" className="w-full h-full object-contain" />
                  )}
                  <button
                    type="button"
                    onClick={() => setMediaUrl('')}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 h-52 rounded-2xl border-2 border-dashed border-stone-300 dark:border-slate-700 bg-stone-50 dark:bg-slate-900/60 hover:border-accent transition-colors cursor-pointer px-4 text-center">
                  <Camera className="w-8 h-8 text-accent" />
                  <p className="text-xs font-semibold text-stone-800 dark:text-slate-200">
                    {uploading ? `Uploading... ${uploadPct}%` : 'Tap to pick a photo or short video'}
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400">
                    JPG, PNG, WebP or MP4 · Auto-expires in 24 hours
                  </p>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    disabled={uploading}
                    onChange={handleSelectFile}
                    className="hidden"
                  />
                </label>
              )}

              <input
                type="text"
                maxLength={220}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption (optional)..."
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className={`h-56 rounded-2xl p-6 flex items-center justify-center text-center shadow-inner ${gradientClass}`}
              >
                <textarea
                  rows={4}
                  maxLength={220}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Share a thought with your mutual friends..."
                  className="w-full bg-transparent text-white placeholder:text-white/75 text-center font-display text-xl font-bold resize-none focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-stone-500 dark:text-slate-400">
                  Background
                </span>
                <div className="flex items-center gap-1.5">
                  {Object.entries(STORY_GRADIENTS).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setThemeKey(key)}
                      title={item.label}
                      aria-label={item.label}
                      className={`w-7 h-7 rounded-full ${item.className} transition-transform cursor-pointer ${
                        themeKey === key
                          ? 'scale-110 ring-2 ring-offset-2 ring-stone-900 dark:ring-white dark:ring-offset-[#161B22]'
                          : 'hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || publishing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-white disabled:opacity-50 cursor-pointer"
            >
              <Heart className="w-3.5 h-3.5" />
              <span>{publishing ? 'Sharing...' : 'Share Story'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
