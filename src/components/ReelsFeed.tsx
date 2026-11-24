import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Disc3,
  ExternalLink,
  Film,
  Heart,
  Instagram,
  Loader2,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Avatar } from './Avatar';
import {
  addReelComment,
  createReel,
  deleteReel,
  fetchReels,
  fetchSongs,
  fetchSpotifyAuthUrl,
  fetchSpotifyStatus,
  fetchSpotifyTracks,
  toggleReelLike,
  type ReelItem,
  type ReelSceneTheme,
} from '../lib/backendApi';
import { ResumableChunkedUpload } from '../lib/chunkedUpload';
import { parseInstagramReelUrl, type SongTrack } from '../lib/songsAndReels';
import type { Profile, Room } from '../types/chat';

interface ReelsFeedProps {
  profile: Profile;
  rooms: Room[];
  initialReelId?: string | null;
  initialCreateForRoomId?: string | null;
  onClearInitialIntent?: () => void;
  onCloseMobile?: () => void;
  onShareReelToRoom?: (roomId: string, reel: ReelItem) => Promise<void>;
  onNotice?: (title: string, body?: string) => void;
}

const SCENE_STYLES: Record<
  ReelSceneTheme,
  { gradient: string; orb1: string; orb2: string; label: string }
> = {
  aurora: {
    gradient: 'from-emerald-900 via-teal-900 to-slate-950',
    orb1: 'bg-emerald-400/35',
    orb2: 'bg-cyan-400/25',
    label: 'Aurora Emerald',
  },
  sunset: {
    gradient: 'from-orange-700 via-rose-800 to-slate-950',
    orb1: 'bg-amber-400/35',
    orb2: 'bg-pink-500/30',
    label: 'Golden Sunset',
  },
  neon_grid: {
    gradient: 'from-indigo-800 via-purple-900 to-slate-950',
    orb1: 'bg-violet-400/35',
    orb2: 'bg-sky-400/25',
    label: 'Studio Pulse',
  },
  ocean: {
    gradient: 'from-sky-800 via-blue-900 to-slate-950',
    orb1: 'bg-cyan-300/35',
    orb2: 'bg-blue-400/25',
    label: 'Deep Ocean',
  },
  midnight: {
    gradient: 'from-slate-800 via-zinc-900 to-black',
    orb1: 'bg-emerald-400/25',
    orb2: 'bg-indigo-400/25',
    label: 'Midnight Cinema',
  },
};

const SCENE_EMOJIS = ['🚀', '🎬', '🎧', '🔥', '🌅', '☕', '🎮', '✨', '🎉', '📚', '🎸', '⚡'];

function formatRelativeTime(ms: number): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export const ReelsFeed = React.memo(function ReelsFeed({
  profile,
  rooms,
  initialReelId,
  initialCreateForRoomId,
  onClearInitialIntent,
  onCloseMobile,
  onShareReelToRoom,
  onNotice,
}: ReelsFeedProps) {
  const prefersReducedMotion = useReducedMotion();
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [pausedMap, setPausedMap] = useState<Record<string, boolean>>({});
  const [heartBurstId, setHeartBurstId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`quadline_saved_reels_${profile.uid}`);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  // Linked Instagram handle (Join with Instagram)
  const [igConnectOpen, setIgConnectOpen] = useState(false);
  const [linkedIgHandle, setLinkedIgHandle] = useState<string>(() => {
    try {
      return localStorage.getItem(`quadline_ig_handle_${profile.uid}`) || '';
    } catch {
      return '';
    }
  });
  const [igHandleDraft, setIgHandleDraft] = useState(linkedIgHandle);

  // Comments & Share drawers
  const [commentReelId, setCommentReelId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [shareReel, setShareReel] = useState<ReelItem | null>(null);

  // Create Reel Modal (3 Modes: Media Upload, Instagram Link, Motion Scene)
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'media' | 'instagram' | 'scene'>('media');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number>(0);
  const [igUrlInput, setIgUrlInput] = useState('');
  const [caption, setCaption] = useState('');
  const [audioTitle, setAudioTitle] = useState('Original Audio');
  const [selectedSong, setSelectedSong] = useState<SongTrack | null>(null);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [reelSongSource, setReelSongSource] = useState<'catalog' | 'spotify'>('catalog');
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [songQuery, setSongQuery] = useState('');
  const [songResults, setSongResults] = useState<SongTrack[]>([]);
  const [loadingSongResults, setLoadingSongResults] = useState(false);
  const [previewSongId, setPreviewSongId] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState('reels, music');
  const [sceneTheme, setSceneTheme] = useState<ReelSceneTheme>('aurora');
  const [sceneEmoji, setSceneEmoji] = useState('🎬');
  const [sceneHeadline, setSceneHeadline] = useState('');
  const [shareToRoomId, setShareToRoomId] = useState<string>('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const previewSongAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  useEffect(() => {
    let cancelled = false;
    void fetchReels().then((list) => {
      if (!cancelled) {
        setReels(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle deep-link from a Group chat (open specific Reel OR open Create Reel for a Group)
  useEffect(() => {
    if (initialCreateForRoomId) {
      setShareToRoomId(initialCreateForRoomId);
      setCreateOpen(true);
      onClearInitialIntent?.();
    }
  }, [initialCreateForRoomId, onClearInitialIntent]);

  useEffect(() => {
    if (!initialReelId || reels.length === 0) return;
    const foundIdx = reels.findIndex((r) => r.id === initialReelId);
    if (foundIdx >= 0) {
      setActiveIndex(foundIdx);
      const container = scrollerRef.current;
      const targetChild = container?.children[foundIdx] as HTMLElement | undefined;
      targetChild?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
    onClearInitialIntent?.();
  }, [initialReelId, reels, onClearInitialIntent]);

  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
      bgMusicRef.current?.pause();
      previewSongAudioRef.current?.pause();
    };
  }, [uploadPreviewUrl]);

  // Check Spotify status when Create Reel song picker opens
  useEffect(() => {
    if (!createOpen || !songPickerOpen) return;
    let cancelled = false;
    void fetchSpotifyStatus(profile.uid).then((st) => {
      if (!cancelled) setSpotifyConnected(st.connected);
    });
    const onMsg = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) return;
      if (event.data?.type === 'SPOTIFY_OAUTH_SUCCESS') {
        setSpotifyConnected(true);
        setReelSongSource('spotify');
        onNotice?.('Spotify linked!', 'You can now attach your Spotify songs to Reels.');
      }
    };
    window.addEventListener('message', onMsg);
    return () => {
      cancelled = true;
      window.removeEventListener('message', onMsg);
    };
  }, [createOpen, songPickerOpen, profile.uid, onNotice]);

  // Load songs when Song Picker inside Create Reel modal is opened
  useEffect(() => {
    if (!createOpen || !songPickerOpen) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingSongResults(true);
      if (reelSongSource === 'spotify' && spotifyConnected) {
        void fetchSpotifyTracks(profile.uid, {
          section: songQuery.trim() ? 'search' : 'liked',
          q: songQuery,
        }).then((res) => {
          if (!cancelled) {
            setSongResults(res.songs);
            setLoadingSongResults(false);
          }
        });
      } else {
        void fetchSongs({
          category: songQuery.trim() ? 'all' : 'bollywood',
          q: songQuery,
        }).then((list) => {
          if (!cancelled) {
            setSongResults(list);
            setLoadingSongResults(false);
          }
        });
      }
    }, songQuery.trim() ? 300 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [createOpen, songPickerOpen, songQuery, reelSongSource, spotifyConnected, profile.uid]);

  // Sync video & attached Movie/Famous Song playback with active visible reel
  useEffect(() => {
    reels.forEach((reel, idx) => {
      const vid = videoRefs.current[reel.id];
      if (!vid) return;
      vid.muted = muted || Boolean(reel.audioPreviewUrl);
      if (idx === activeIndex && !pausedMap[reel.id] && !createOpen) {
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    });

    const activeReel = reels[activeIndex];
    if (!bgMusicRef.current) {
      bgMusicRef.current = new Audio();
      bgMusicRef.current.loop = true;
    }
    const bgAudio = bgMusicRef.current;
    if (
      activeReel &&
      activeReel.audioPreviewUrl &&
      !muted &&
      !pausedMap[activeReel.id] &&
      !createOpen &&
      activeReel.mediaType !== 'instagram'
    ) {
      if (bgAudio.src !== activeReel.audioPreviewUrl) {
        bgAudio.src = activeReel.audioPreviewUrl;
      }
      bgAudio.play().catch(() => {});
    } else {
      bgAudio.pause();
    }
  }, [reels, activeIndex, muted, pausedMap, createOpen]);

  const scrollToReel = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(reels.length - 1, nextIndex));
      setActiveIndex(clamped);
      const container = scrollerRef.current;
      if (!container) return;
      const targetChild = container.children[clamped] as HTMLElement | undefined;
      targetChild?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    },
    [reels.length, prefersReducedMotion]
  );

  // Keyboard up/down arrows for smooth laptop Reels browsing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (createOpen || commentReelId || shareReel) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        scrollToReel(activeIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        scrollToReel(activeIndex - 1);
      } else if (e.key === 'm') {
        setMuted((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, createOpen, commentReelId, shareReel, scrollToReel]);

  const handleScroll = useCallback(() => {
    const container = scrollerRef.current;
    if (!container || container.clientHeight === 0) return;
    const idx = Math.round(container.scrollTop / container.clientHeight);
    if (idx !== activeIndex && idx >= 0 && idx < reels.length) {
      setActiveIndex(idx);
    }
  }, [activeIndex, reels.length]);

  const handleLike = useCallback(
    async (reelId: string, onlyIfNotLiked = false) => {
      const existing = reels.find((r) => r.id === reelId);
      if (!existing) return;
      const alreadyLiked = existing.likedBy.includes(profile.uid);
      if (onlyIfNotLiked && alreadyLiked) return;

      // Optimistic update
      setReels((prev) =>
        prev.map((r) =>
          r.id === reelId
            ? {
                ...r,
                likedBy: alreadyLiked
                  ? r.likedBy.filter((id) => id !== profile.uid)
                  : [...r.likedBy, profile.uid],
              }
            : r
        )
      );

      const updated = await toggleReelLike(reelId, profile.uid);
      if (updated) {
        setReels((prev) => prev.map((r) => (r.id === reelId ? updated : r)));
      }
    },
    [reels, profile.uid]
  );

  const handleStageTap = (reel: ReelItem) => {
    const now = Date.now();
    if (lastTapRef.current.id === reel.id && now - lastTapRef.current.time < 280) {
      lastTapRef.current = { id: '', time: 0 };
      setHeartBurstId(reel.id);
      window.setTimeout(() => setHeartBurstId(null), 700);
      void handleLike(reel.id, true);
      return;
    }
    lastTapRef.current = { id: reel.id, time: now };
    setPausedMap((prev) => ({ ...prev, [reel.id]: !prev[reel.id] }));
  };

  const handleToggleSave = (reelId: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(reelId) ? prev.filter((id) => id !== reelId) : [...prev, reelId];
      try {
        localStorage.setItem(`quadline_saved_reels_${profile.uid}`, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentReelId || !commentDraft.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const updated = await addReelComment(commentReelId, {
        uid: profile.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoUrl,
        text: commentDraft.trim(),
      });
      if (updated) {
        setReels((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setCommentDraft('');
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteReel = async (reelId: string) => {
    const ok = await deleteReel(reelId, profile.uid);
    if (ok) {
      setReels((prev) => prev.filter((r) => r.id !== reelId));
      onNotice?.('Reel deleted', 'Your reel was removed from the feed.');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadFile(file);
    setUploadPreviewUrl(URL.createObjectURL(file));
    setPublishError(null);
  };

  const handlePublishReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (publishing) return;
    setPublishError(null);

    if (createMode === 'media' && !uploadFile) {
      setPublishError('Select a video or photo first, or switch to Instagram Link / Motion Scene.');
      return;
    }
    const parsedIg = createMode === 'instagram' ? parseInstagramReelUrl(igUrlInput) : null;
    if (createMode === 'instagram' && !parsedIg) {
      setPublishError('Paste a valid Instagram Reel link (e.g. https://www.instagram.com/reel/...).');
      return;
    }
    if (createMode === 'scene' && !sceneHeadline.trim() && !caption.trim()) {
      setPublishError('Add a headline or caption for your Reel.');
      return;
    }

    setPublishing(true);
    setUploadPct(0);
    previewSongAudioRef.current?.pause();
    setPreviewSongId(null);

    try {
      let mediaType: 'video' | 'image' | 'scene' | 'instagram' = 'scene';
      let mediaUrl = '';

      if (createMode === 'media' && uploadFile) {
        mediaType = uploadFile.type.startsWith('video/') ? 'video' : 'image';
        const uploader = new ResumableChunkedUpload({
          file: uploadFile,
          uploaderUid: profile.uid,
          onProgress: (st) => setUploadPct(st.progressPct),
        });
        const uploaded = await uploader.run();
        mediaUrl = uploaded.url;
      } else if (createMode === 'instagram' && parsedIg) {
        mediaType = 'instagram';
        mediaUrl = parsedIg.embedUrl;
      }

      const tags = tagsInput
        .split(/[,\s#]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 6);

      const created = await createReel({
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorHandle: linkedIgHandle || profile.handle,
        authorPhoto: profile.photoUrl,
        caption:
          caption.trim() ||
          (createMode === 'instagram' ? 'Joined from Instagram Reels' : sceneHeadline.trim()) ||
          'New Reel',
        audioTitle: selectedSong
          ? `${selectedSong.title} · ${selectedSong.movieOrAlbum}`
          : audioTitle.trim() || (createMode === 'instagram' ? 'Instagram Audio' : 'Original Audio'),
        audioArtist: selectedSong?.artist,
        audioPreviewUrl: selectedSong?.previewUrl,
        audioArtwork: selectedSong?.artworkUrl,
        mediaType,
        mediaUrl,
        instagramUrl: parsedIg?.canonicalUrl,
        instagramCode: parsedIg?.shortcode,
        sceneTheme,
        sceneEmoji,
        sceneHeadline:
          sceneHeadline.trim() ||
          (createMode === 'instagram' ? 'Instagram Reel' : caption.trim().slice(0, 48)) ||
          'Campus Reel',
        tags,
      });

      if (!created) {
        throw new Error('Could not publish Reel right now. Please try again.');
      }

      setReels((prev) => [created, ...prev]);

      if (shareToRoomId && onShareReelToRoom) {
        await onShareReelToRoom(shareToRoomId, created);
      }

      setCreateOpen(false);
      setUploadFile(null);
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
      setUploadPreviewUrl(null);
      setIgUrlInput('');
      setCaption('');
      setSceneHeadline('');
      setSelectedSong(null);
      setSongPickerOpen(false);
      setShareToRoomId('');
      setActiveIndex(0);
      scrollerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      onNotice?.(
        shareToRoomId ? 'Reel published & shared!' : 'Reel published!',
        shareToRoomId
          ? 'Your Reel is live in the feed and shared into your group.'
          : 'Your Reel is now live in the Reels feed.'
      );
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Unable to publish Reel.');
    } finally {
      setPublishing(false);
      setUploadPct(0);
    }
  };

  const handleToggleSongPreview = (track: SongTrack) => {
    if (!previewSongAudioRef.current) {
      previewSongAudioRef.current = new Audio();
      previewSongAudioRef.current.onended = () => setPreviewSongId(null);
    }
    const audio = previewSongAudioRef.current;
    if (previewSongId === track.id) {
      audio.pause();
      setPreviewSongId(null);
      return;
    }
    audio.pause();
    audio.src = track.previewUrl;
    setPreviewSongId(track.id);
    void audio.play().catch(() => setPreviewSongId(null));
  };

  const handleSaveInstagramLink = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = igHandleDraft.trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9._]/g, '').slice(0, 30);
    setLinkedIgHandle(cleaned);
    try {
      if (cleaned) {
        localStorage.setItem(`quadline_ig_handle_${profile.uid}`, cleaned);
      } else {
        localStorage.removeItem(`quadline_ig_handle_${profile.uid}`);
      }
    } catch {
      // Ignore storage errors
    }
    setIgConnectOpen(false);
    onNotice?.(
      cleaned ? 'Instagram joined!' : 'Instagram unlinked',
      cleaned ? `Connected @${cleaned} for Reels & Group sharing.` : 'Removed Instagram handle.'
    );
  };

  const activeCommentReel = commentReelId ? reels.find((r) => r.id === commentReelId) || null : null;

  return (
    <div className="relative flex-1 h-full w-full bg-[#090C10] text-white overflow-hidden flex flex-col">
      {/* Compact Top Overlay Header with Instagram Join & Create */}
      <div className="absolute top-0 left-0 right-0 z-30 px-3 sm:px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto min-w-0">
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Back to chats"
              className="lg:hidden min-h-[40px] min-w-[40px] rounded-full bg-black/45 backdrop-blur-md border border-white/15 flex items-center justify-center text-white cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <Film className="w-5 h-5 text-emerald-400 shrink-0" />
            <h1 className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white truncate">
              Reels
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              setIgHandleDraft(linkedIgHandle);
              setIgConnectOpen(true);
            }}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1 rounded-full bg-rose-600/25 hover:bg-rose-600/40 border border-rose-400/45 text-[11px] font-semibold text-rose-100 backdrop-blur-md transition-colors cursor-pointer shrink-0"
          >
            <Instagram className="w-3.5 h-3.5 text-rose-300" />
            <span className="truncate max-w-[105px]">
              {linkedIgHandle ? `@${linkedIgHandle}` : 'Instagram'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
          <button
            type="button"
            onClick={() => setMuted((v) => !v)}
            aria-label={muted ? 'Unmute reels audio' : 'Mute reels audio'}
            title={muted ? 'Unmute (M)' : 'Mute (M)'}
            className="min-h-[40px] min-w-[40px] rounded-full bg-black/45 backdrop-blur-md border border-white/15 flex items-center justify-center text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-full bg-accent text-white text-xs font-semibold shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </motion.button>
        </div>
      </div>

      {/* Desktop Prev/Next Quick Arrows */}
      {reels.length > 1 && (
        <div className="hidden lg:flex flex-col gap-2 fixed right-6 top-1/2 -translate-y-1/2 z-30">
          <button
            type="button"
            disabled={activeIndex <= 0}
            onClick={() => scrollToReel(activeIndex - 1)}
            aria-label="Previous reel"
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 border border-white/15 flex items-center justify-center text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            type="button"
            disabled={activeIndex >= reels.length - 1}
            onClick={() => scrollToReel(activeIndex + 1)}
            aria-label="Next reel"
            className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 border border-white/15 flex items-center justify-center text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Vertical Snap Reel Scroller */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
          Loading Reels feed…
        </div>
      ) : reels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
          <Film className="w-10 h-10 text-emerald-400" />
          <p className="font-display text-lg font-bold">No Reels yet</p>
          <p className="text-xs text-slate-400 max-w-xs">
            Upload a short campus video, photo, or animated story reel to kick off the feed.
          </p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-semibold cursor-pointer"
          >
            Create First Reel
          </button>
        </div>
      ) : (
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar"
        >
          {reels.map((reel, idx) => {
            const isLiked = reel.likedBy.includes(profile.uid);
            const isSaved = savedIds.includes(reel.id);
            const isPaused = Boolean(pausedMap[reel.id]);
            const isActive = idx === activeIndex;
            const scene = SCENE_STYLES[reel.sceneTheme || 'aurora'] || SCENE_STYLES.aurora;

            return (
              <section
                key={reel.id}
                className="h-full w-full snap-start snap-always flex items-center justify-center lg:py-4"
              >
                <div className="relative h-full w-full lg:max-w-[430px] lg:rounded-3xl overflow-hidden bg-black lg:border lg:border-white/12 shadow-2xl select-none">
                  {/* Media Stage (Tap to Pause / Double-tap to Like) */}
                  <div
                    onClick={() => handleStageTap(reel)}
                    className="absolute inset-0 cursor-pointer overflow-hidden"
                  >
                    {reel.mediaType === 'instagram' && reel.instagramCode ? (
                      /* Embedded Instagram Reel Player */
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-full bg-black flex flex-col items-center justify-center pt-14 pb-28 px-2"
                      >
                        <iframe
                          src={`https://www.instagram.com/reel/${reel.instagramCode}/embed/`}
                          title={`Instagram Reel by ${reel.authorName}`}
                          className="w-full h-full max-w-[380px] rounded-2xl border border-white/15 bg-black"
                          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    ) : reel.mediaType === 'video' && reel.mediaUrl ? (
                      <video
                        ref={(el) => {
                          videoRefs.current[reel.id] = el;
                        }}
                        src={reel.mediaUrl}
                        playsInline
                        loop
                        muted={muted || Boolean(reel.audioPreviewUrl)}
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                    ) : reel.mediaType === 'image' && reel.mediaUrl ? (
                      <motion.img
                        src={reel.mediaUrl}
                        alt={reel.caption || 'Reel'}
                        referrerPolicy="no-referrer"
                        animate={
                          isActive && !isPaused && !prefersReducedMotion
                            ? { scale: [1, 1.08, 1] }
                            : { scale: 1 }
                        }
                        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      /* Smooth Animated Looping Scene Reel */
                      <div
                        className={`relative w-full h-full bg-gradient-to-br ${scene.gradient} flex flex-col items-center justify-center px-8 text-center`}
                      >
                        {!prefersReducedMotion && isActive && !isPaused && (
                          <>
                            <motion.div
                              animate={{ x: [-20, 28, -20], y: [-18, 22, -18], scale: [1, 1.18, 1] }}
                              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                              className={`absolute -top-12 -left-12 w-64 h-64 rounded-full blur-3xl ${scene.orb1}`}
                            />
                            <motion.div
                              animate={{ x: [22, -26, 22], y: [24, -18, 24], scale: [1.1, 0.92, 1.1] }}
                              transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
                              className={`absolute -bottom-12 -right-12 w-72 h-72 rounded-full blur-3xl ${scene.orb2}`}
                            />
                          </>
                        )}
                        <motion.div
                          animate={
                            isActive && !isPaused && !prefersReducedMotion
                              ? { y: [0, -10, 0], rotate: [-2, 2, -2] }
                              : { y: 0, rotate: 0 }
                          }
                          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                          className="relative z-10 text-7xl sm:text-8xl mb-5 drop-shadow-xl"
                        >
                          {reel.sceneEmoji || '✨'}
                        </motion.div>
                        <h2 className="relative z-10 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-md max-w-[18ch] text-balance">
                          {reel.sceneHeadline || reel.caption.slice(0, 44)}
                        </h2>
                        {/* Subtle Animated Equalizer Visualizer */}
                        <div className="relative z-10 mt-6 flex items-end justify-center gap-1.5 h-8">
                          {[0.35, 0.85, 0.55, 1, 0.65, 0.9, 0.4].map((h, barIdx) => (
                            <motion.span
                              key={barIdx}
                              animate={
                                isActive && !isPaused && !prefersReducedMotion
                                  ? { scaleY: [0.3, h, 0.35] }
                                  : { scaleY: 0.25 }
                              }
                              transition={{
                                duration: 0.75 + barIdx * 0.08,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              }}
                              className="w-1.5 h-full rounded-full bg-white/75 origin-bottom"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Contrast Scrim for Bottom Metadata */}
                    <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/88 via-black/45 to-transparent pointer-events-none" />

                    {/* Pause / Play Indicator */}
                    <AnimatePresence>
                      {isPaused && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-md flex items-center justify-center text-white">
                            <Play className="w-7 h-7 ml-0.5 fill-current" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Double-Tap Heart Burst */}
                    <AnimatePresence>
                      {heartBurstId === reel.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.4 }}
                          animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.35, 1.1, 1.45] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.65 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                          <Heart className="w-24 h-24 text-rose-500 fill-rose-500 drop-shadow-2xl" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Right Vertical Action Rail (Instagram-Style) */}
                  <div className="absolute right-3 bottom-24 sm:bottom-20 z-20 flex flex-col items-center gap-4">
                    <motion.button
                      type="button"
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.85 }}
                      onClick={() => void handleLike(reel.id)}
                      aria-label={isLiked ? 'Unlike reel' : 'Like reel'}
                      className="flex flex-col items-center gap-1 min-w-[44px] cursor-pointer"
                    >
                      <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center">
                        <Heart
                          className={`w-6 h-6 transition-colors ${
                            isLiked ? 'text-rose-500 fill-rose-500' : 'text-white'
                          }`}
                        />
                      </span>
                      <span className="text-[11px] font-semibold font-mono-tabular text-white drop-shadow">
                        {reel.likedBy.length}
                      </span>
                    </motion.button>

                    <motion.button
                      type="button"
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.85 }}
                      onClick={() => setCommentReelId(reel.id)}
                      aria-label="Open reel comments"
                      className="flex flex-col items-center gap-1 min-w-[44px] cursor-pointer"
                    >
                      <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center">
                        <MessageCircle className="w-6 h-6 text-white" />
                      </span>
                      <span className="text-[11px] font-semibold font-mono-tabular text-white drop-shadow">
                        {reel.comments.length}
                      </span>
                    </motion.button>

                    <motion.button
                      type="button"
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.85 }}
                      onClick={() => setShareReel(reel)}
                      aria-label="Share reel to chat"
                      className="flex flex-col items-center gap-1 min-w-[44px] cursor-pointer"
                    >
                      <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center">
                        <Share2 className="w-5 h-5 text-white" />
                      </span>
                      <span className="text-[11px] font-semibold text-white drop-shadow">Share</span>
                    </motion.button>

                    <motion.button
                      type="button"
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.85 }}
                      onClick={() => handleToggleSave(reel.id)}
                      aria-label={isSaved ? 'Remove bookmark' : 'Save reel'}
                      className="flex flex-col items-center gap-1 min-w-[44px] cursor-pointer"
                    >
                      <span className="w-11 h-11 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center">
                        <Bookmark
                          className={`w-5 h-5 ${
                            isSaved ? 'text-amber-400 fill-amber-400' : 'text-white'
                          }`}
                        />
                      </span>
                      <span className="text-[11px] font-semibold text-white drop-shadow">
                        {isSaved ? 'Saved' : 'Save'}
                      </span>
                    </motion.button>

                    <button
                      type="button"
                      onClick={() => setPausedMap((prev) => ({ ...prev, [reel.id]: !prev[reel.id] }))}
                      aria-label={isPaused ? 'Play reel' : 'Pause reel'}
                      className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white cursor-pointer"
                    >
                      {isPaused ? <Play className="w-4 h-4 ml-0.5" /> : <Pause className="w-4 h-4" />}
                    </button>

                    {reel.authorUid === profile.uid && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteReel(reel.id)}
                        aria-label="Delete your reel"
                        title="Delete reel"
                        className="w-10 h-10 rounded-full bg-red-600/75 hover:bg-red-600 flex items-center justify-center text-white cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Bottom-Left Creator & Caption Overlay */}
                  <div className="absolute left-4 right-16 bottom-6 z-20 space-y-2.5 pointer-events-none">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={reel.authorName} src={reel.authorPhoto} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate drop-shadow">
                          {reel.authorName}
                        </p>
                        <p className="text-[11px] text-slate-300 truncate">
                          @{reel.authorHandle} · {formatRelativeTime(reel.createdAt)}
                        </p>
                      </div>
                    </div>

                    {reel.caption && (
                      <p className="text-xs sm:text-sm text-white/95 leading-snug line-clamp-3 drop-shadow">
                        {reel.caption}
                      </p>
                    )}

                    {reel.tags.length > 0 && (
                      <p className="text-[11px] text-emerald-300 font-medium truncate">
                        {reel.tags.map((t) => `#${t}`).join('  ')}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-white/90 pointer-events-auto">
                      {reel.audioArtwork ? (
                        <img
                          src={reel.audioArtwork}
                          alt={reel.audioTitle}
                          referrerPolicy="no-referrer"
                          className="w-5 h-5 rounded-full object-cover ring-1 ring-white/40 shrink-0"
                        />
                      ) : (
                        <Music2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      )}
                      <span className="truncate font-medium">
                        {reel.audioTitle}
                        {reel.audioArtist ? ` — ${reel.audioArtist}` : ''}
                      </span>
                      {reel.instagramUrl && (
                        <a
                          href={reel.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white text-[10px] font-semibold shrink-0"
                        >
                          <Instagram className="w-3 h-3" />
                          <span>Instagram</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Instagram Account Join & Quick Import Modal */}
      <AnimatePresence>
        {igConnectOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setIgConnectOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-[#161B22] border border-slate-700 text-white p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Instagram className="w-5 h-5 text-rose-400" />
                  <h2 className="font-display text-base font-bold">Join Instagram Reels</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIgConnectOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Link your Instagram handle to tag your Reels and jump seamlessly between Instagram Reels and your group chats.
              </p>
              <form onSubmit={handleSaveInstagramLink} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Instagram Username</label>
                  <input
                    type="text"
                    value={igHandleDraft}
                    onChange={(e) => setIgHandleDraft(e.target.value)}
                    placeholder="@your_instagram_handle"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Instagram Link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIgConnectOpen(false);
                      setCreateMode('instagram');
                      setCreateOpen(true);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Import Reel
                  </button>
                </div>
              </form>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <a
                  href={
                    linkedIgHandle
                      ? `https://www.instagram.com/${linkedIgHandle}/reels/`
                      : 'https://www.instagram.com/reels/'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-rose-300 hover:underline font-medium"
                >
                  <span>Open Instagram Reels</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {linkedIgHandle && (
                  <button
                    type="button"
                    onClick={() => {
                      setIgHandleDraft('');
                      setLinkedIgHandle('');
                      try {
                        localStorage.removeItem(`quadline_ig_handle_${profile.uid}`);
                      } catch {
                        // Ignore
                      }
                      setIgConnectOpen(false);
                    }}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments Bottom Sheet */}
      <AnimatePresence>
        {activeCommentReel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center"
            onClick={() => setCommentReelId(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md max-h-[75dvh] rounded-t-3xl sm:rounded-2xl bg-[#161B22] border border-slate-800 text-white flex flex-col overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <p className="text-sm font-bold">
                  Comments · <span className="font-mono-tabular">{activeCommentReel.comments.length}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setCommentReelId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeCommentReel.comments.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Be the first to drop a comment on this Reel!
                  </p>
                ) : (
                  activeCommentReel.comments.map((c) => (
                    <div key={c.id} className="flex items-start gap-2.5">
                      <Avatar name={c.authorName} src={c.authorPhoto} size="xs" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-white">{c.authorName}</span>
                          <span className="text-[11px] text-slate-400">
                            {formatRelativeTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 mt-0.5 break-words">{c.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={handlePostComment}
                className="p-3 border-t border-slate-800 flex items-center gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              >
                <input
                  type="text"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  maxLength={240}
                  placeholder="Add a comment…"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!commentDraft.trim() || submittingComment}
                  className="p-2.5 rounded-xl bg-accent disabled:opacity-45 text-white cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Reel to Chat Modal */}
      <AnimatePresence>
        {shareReel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShareReel(null)}
          >
            <motion.div
              initial={{ y: 36, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 36, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#161B22] border border-slate-800 text-white p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Share Reel to Group or DM</p>
                <button
                  type="button"
                  onClick={() => setShareReel(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {rooms.map((rm) => (
                  <button
                    key={rm.id}
                    type="button"
                    onClick={async () => {
                      if (onShareReelToRoom) {
                        await onShareReelToRoom(rm.id, shareReel);
                      }
                      setShareReel(null);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-between text-left cursor-pointer"
                  >
                    <span className="text-xs font-semibold truncate">{rm.name}</span>
                    <span className="text-[11px] text-emerald-400 font-semibold shrink-0">Send</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create New Reel Modal */}
      <AnimatePresence>
        {createOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => !publishing && setCreateOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[88dvh] overflow-y-auto rounded-2xl bg-[#161B22] border border-slate-700 text-white p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-bold">Create a Reel</h2>
                  <p className="text-xs text-slate-400">
                    Upload a short video/photo or build an animated story reel.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => setCreateOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 3-Mode Switch: Upload, Instagram Reel Link, Motion Scene */}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-900">
                <button
                  type="button"
                  onClick={() => setCreateMode('media')}
                  className={`py-2 px-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                    createMode === 'media' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('instagram')}
                  className={`py-2 px-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                    createMode === 'instagram' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Instagram className="w-3.5 h-3.5" />
                  <span>Instagram</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('scene')}
                  className={`py-2 px-1 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                    createMode === 'scene' ? 'bg-accent text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Scene</span>
                </button>
              </div>

              <form onSubmit={handlePublishReel} className="space-y-3.5">
                {publishError && (
                  <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200">
                    {publishError}
                  </div>
                )}

                {createMode === 'media' ? (
                  <div className="space-y-2">
                    <label className="block w-full rounded-xl border border-dashed border-slate-600 hover:border-emerald-500 bg-slate-900/70 p-4 text-center cursor-pointer transition-colors">
                      {uploadPreviewUrl ? (
                        uploadFile?.type.startsWith('video/') ? (
                          <video
                            src={uploadPreviewUrl}
                            muted
                            playsInline
                            controls
                            className="max-h-48 mx-auto rounded-lg"
                          />
                        ) : (
                          <img
                            src={uploadPreviewUrl}
                            alt="Reel preview"
                            className="max-h-48 mx-auto rounded-lg object-cover"
                          />
                        )
                      ) : (
                        <div className="py-4 space-y-1.5">
                          <Upload className="w-6 h-6 mx-auto text-emerald-400" />
                          <p className="text-xs font-semibold text-white">
                            Choose Video or Photo (up to 90 MB)
                          </p>
                          <p className="text-[11px] text-slate-400">MP4, WebM, MOV, JPG, PNG, GIF</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="video/*,image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                    {publishing && uploadPct > 0 && (
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${uploadPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                ) : createMode === 'instagram' ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300">Instagram Reel URL</label>
                      <a
                        href="https://www.instagram.com/reels/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-rose-300 hover:underline"
                      >
                        <span>Browse Instagram</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <input
                      type="url"
                      value={igUrlInput}
                      onChange={(e) => {
                        setIgUrlInput(e.target.value);
                        setPublishError(null);
                      }}
                      placeholder="https://www.instagram.com/reel/..."
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                    {parseInstagramReelUrl(igUrlInput) && (
                      <p className="text-[11px] text-emerald-400 font-medium">
                        Instagram Reel detected — ready to embed in feed &amp; share to groups!
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300">Reel Headline</label>
                      <input
                        type="text"
                        maxLength={60}
                        value={sceneHeadline}
                        onChange={(e) => setSceneHeadline(e.target.value)}
                        placeholder="Weekend Movie Night Vibes"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300">Backdrop Theme</label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {(Object.keys(SCENE_STYLES) as ReelSceneTheme[]).map((themeKey) => (
                          <button
                            key={themeKey}
                            type="button"
                            onClick={() => setSceneTheme(themeKey)}
                            className={`h-9 rounded-lg bg-gradient-to-br ${SCENE_STYLES[themeKey].gradient} border-2 cursor-pointer ${
                              sceneTheme === themeKey ? 'border-white scale-105' : 'border-transparent opacity-75'
                            }`}
                            title={SCENE_STYLES[themeKey].label}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300">Center Emoji</label>
                      <div className="flex flex-wrap gap-1.5">
                        {SCENE_EMOJIS.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => setSceneEmoji(em)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-base cursor-pointer ${
                              sceneEmoji === em ? 'bg-accent text-white' : 'bg-slate-800 hover:bg-slate-700'
                            }`}
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Attach a Real Movie / Famous Song Soundtrack */}
                {createMode !== 'instagram' && (
                  <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Music2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-xs font-semibold text-white truncate">
                          {selectedSong
                            ? `${selectedSong.title} — ${selectedSong.artist}`
                            : 'Add Movie or Famous Song'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {selectedSong && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSong(null);
                              previewSongAudioRef.current?.pause();
                              setPreviewSongId(null);
                            }}
                            className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSongPickerOpen((v) => !v)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-[11px] font-semibold text-white cursor-pointer"
                        >
                          {songPickerOpen ? 'Hide Songs' : 'Pick Song'}
                        </button>
                      </div>
                    </div>

                    {songPickerOpen && (
                      <div className="space-y-2 pt-1 border-t border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setReelSongSource('catalog')}
                            className={`flex-1 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                              reelSongSource === 'catalog'
                                ? 'bg-emerald-700 text-white'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            Movies &amp; Hits
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (spotifyConnected) {
                                setReelSongSource('spotify');
                                return;
                              }
                              const res = await fetchSpotifyAuthUrl(profile.uid);
                              if (res.url) {
                                window.open(res.url, 'spotify_oauth_popup', 'width=520,height=720,noopener=no');
                              } else {
                                onNotice?.(
                                  'Spotify Setup Needed',
                                  res.error || 'Add SPOTIFY_CLIENT_ID & SPOTIFY_CLIENT_SECRET in AI Studio Secrets.'
                                );
                              }
                            }}
                            className={`flex-1 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                              reelSongSource === 'spotify' && spotifyConnected
                                ? 'bg-[#1DB954] text-slate-950'
                                : 'bg-slate-800 text-[#1ED760]'
                            }`}
                          >
                            {spotifyConnected ? 'My Spotify' : 'Connect Spotify'}
                          </button>
                        </div>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={songQuery}
                            onChange={(e) => setSongQuery(e.target.value)}
                            placeholder={
                              reelSongSource === 'spotify'
                                ? 'Search your Spotify library or catalog...'
                                : 'Search Kesariya, Titanic, Blinding Lights, RRR...'
                            }
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {loadingSongResults ? (
                            <div className="py-4 flex justify-center">
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                            </div>
                          ) : (
                            songResults.slice(0, 10).map((track) => (
                              <div
                                key={track.id}
                                className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800/80"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleSongPreview(track)}
                                  className="w-8 h-8 rounded-md bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden relative cursor-pointer"
                                >
                                  {track.artworkUrl ? (
                                    <img
                                      src={track.artworkUrl}
                                      alt={track.title}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Disc3 className="w-4 h-4 text-emerald-400" />
                                  )}
                                  <span className="absolute inset-0 bg-black/45 flex items-center justify-center">
                                    {previewSongId === track.id ? (
                                      <Pause className="w-3 h-3 text-white fill-white" />
                                    ) : (
                                      <Play className="w-3 h-3 text-white fill-white" />
                                    )}
                                  </span>
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-semibold text-white truncate">
                                    {track.title}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {track.artist} · {track.movieOrAlbum}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSong(track);
                                    setAudioTitle(`${track.title} · ${track.movieOrAlbum}`);
                                    setSongPickerOpen(false);
                                    previewSongAudioRef.current?.pause();
                                    setPreviewSongId(null);
                                  }}
                                  className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-[10px] font-semibold text-white cursor-pointer"
                                >
                                  Use
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Caption</label>
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Write something about your Reel…"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Also share straight into a Group */}
                {rooms.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">
                      Also Share Immediately in Group / DM (optional)
                    </label>
                    <select
                      value={shareToRoomId}
                      onChange={(e) => setShareToRoomId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Publish to Reels Feed only</option>
                      {rooms.map((rm) => (
                        <option key={rm.id} value={rm.id}>
                          Share to: {rm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Audio Label</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={audioTitle}
                      onChange={(e) => setAudioTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Tags</label>
                    <input
                      type="text"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="reels, movies, songs"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={() => {
                      previewSongAudioRef.current?.pause();
                      setPreviewSongId(null);
                      setCreateOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={publishing}
                    className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {publishing
                      ? 'Publishing…'
                      : shareToRoomId
                        ? 'Publish & Share to Group'
                        : 'Publish Reel'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
