import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Calendar,
  Check,
  CheckCheck,
  Copy,
  CornerUpLeft,
  Disc3,
  Download,
  ExternalLink,
  EyeOff,
  FileText,
  Film,
  Flag,
  Instagram,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Music2,
  Pause,
  Pencil,
  Pin,
  Play,
  SmilePlus,
  Trash2,
  X,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { isAnimatedGifMedia, isStickerMedia } from '../lib/stickersAndGifs';
import {
  decodeReelMessage,
  decodeSongMessage,
  REEL_MESSAGE_MIME,
  SONG_MESSAGE_MIME,
  type ReelMessageMeta,
  type SongMessageMeta,
} from '../lib/songsAndReels';
import type { ChatThemeMeta } from '../lib/themes';
import { formatBytes, formatEventDate, formatTimestamp } from '../lib/validation';
import type { MemberRole, Message, RoomEvent } from '../types/chat';

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🎉', '😂', '👏'];

function ChatSongCard({ song }: { song: SongMessageMeta }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(song.durationSec || 30);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = () => {
    if (!song.previewUrl) return;
    if (!audioRef.current) {
      const el = new Audio(song.previewUrl);
      el.ontimeupdate = () => setCurrentTime(el.currentTime);
      el.onloadedmetadata = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration);
      };
      el.onended = () => {
        setPlaying(false);
        setCurrentTime(0);
      };
      audioRef.current = el;
    }
    const el = audioRef.current;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      setPlaying(true);
      void el.play().catch(() => setPlaying(false));
    }
  };

  const isSpotify = song.source === 'spotify' || Boolean(song.spotifyTrackId);
  const [showSpotifyEmbed, setShowSpotifyEmbed] = useState<boolean>(
    Boolean(song.spotifyTrackId && !song.previewUrl)
  );

  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const formatSec = (s: number) => {
    const rounded = Math.max(0, Math.floor(s));
    return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
  };

  return (
    <div
      className={`max-w-sm rounded-2xl border p-3 space-y-2.5 shadow-xs ${
        isSpotify
          ? 'border-[#1DB954]/40 bg-gradient-to-br from-[#0F1B14] via-[#131C18] to-[#0C1210] text-white'
          : 'border-stone-200 dark:border-slate-700/90 bg-gradient-to-br from-stone-50 to-emerald-50/40 dark:from-[#182028] dark:to-[#11191E]'
      }`}
    >
      {song.note && (
        <p className={`text-xs leading-snug ${isSpotify ? 'text-emerald-100' : 'text-stone-700 dark:text-slate-200'}`}>
          {song.note}
        </p>
      )}

      {isSpotify && showSpotifyEmbed && song.spotifyTrackId ? (
        <div className="space-y-2">
          <iframe
            src={`https://open.spotify.com/embed/track/${song.spotifyTrackId}?utm_source=generator&theme=0`}
            title={`Spotify player for ${song.title}`}
            className="w-full h-[152px] rounded-xl border-0 bg-black"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
          <div className="flex items-center justify-between gap-2 text-[11px]">
            {song.previewUrl && (
              <button
                type="button"
                onClick={() => setShowSpotifyEmbed(false)}
                className="text-emerald-300 hover:underline font-medium cursor-pointer"
              >
                Compact player
              </button>
            )}
            {song.spotifyUrl && (
              <a
                href={song.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-[#1ED760] hover:underline font-semibold"
              >
                <span>Open in Spotify</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={song.previewUrl ? togglePlay : () => song.spotifyTrackId && setShowSpotifyEmbed(true)}
              aria-label={playing ? `Pause ${song.title}` : `Play ${song.title}`}
              className="relative w-14 h-14 rounded-xl overflow-hidden bg-stone-900 shrink-0 shadow-sm cursor-pointer"
            >
              {song.artworkUrl ? (
                <img
                  src={song.artworkUrl}
                  alt={song.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-emerald-800 flex items-center justify-center text-white">
                  <Disc3 className="w-6 h-6" />
                </div>
              )}
              <span className="absolute inset-0 bg-black/45 flex items-center justify-center text-white">
                {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </span>
            </button>

            <div className="min-w-0 flex-1 space-y-1">
              <div
                className={`flex items-center gap-1.5 text-[10px] font-semibold ${
                  isSpotify ? 'text-[#1ED760]' : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                <Music2 className="w-3 h-3 shrink-0" />
                <span className="truncate">{isSpotify ? `Spotify · ${song.movieOrAlbum}` : song.movieOrAlbum}</span>
              </div>
              <p
                className={`text-sm font-bold truncate leading-tight ${
                  isSpotify ? 'text-white' : 'text-stone-900 dark:text-white'
                }`}
              >
                {song.title}
              </p>
              <p className={`text-xs truncate ${isSpotify ? 'text-slate-300' : 'text-stone-500 dark:text-slate-400'}`}>
                {song.artist}
              </p>
            </div>
          </div>

          {song.previewUrl && (
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono-tabular w-7 ${isSpotify ? 'text-slate-300' : 'text-stone-500 dark:text-slate-400'}`}>
                {formatSec(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 30}
                step={0.25}
                value={currentTime}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCurrentTime(val);
                  if (audioRef.current) audioRef.current.currentTime = val;
                }}
                aria-label="Seek song preview"
                className="flex-1 h-1.5 accent-emerald-600 cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${isSpotify ? '#1DB954' : '#059669'} ${pct}%, rgba(120,113,108,0.25) ${pct}%)`,
                }}
              />
              <span className={`text-[10px] font-mono-tabular w-7 text-right ${isSpotify ? 'text-slate-300' : 'text-stone-500 dark:text-slate-400'}`}>
                {formatSec(duration)}
              </span>
            </div>
          )}

          {isSpotify && (
            <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-white/10 text-[11px]">
              {song.spotifyTrackId && (
                <button
                  type="button"
                  onClick={() => {
                    audioRef.current?.pause();
                    setPlaying(false);
                    setShowSpotifyEmbed(true);
                  }}
                  className="text-emerald-300 hover:underline font-semibold cursor-pointer"
                >
                  Open Spotify Player
                </button>
              )}
              {song.spotifyUrl && (
                <a
                  href={song.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-[#1ED760] hover:underline font-semibold"
                >
                  <span>Play in Spotify App</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ChatReelCard({
  reel,
  onOpenReel,
}: {
  reel: ReelMessageMeta;
  onOpenReel?: (reelId: string) => void;
}) {
  const [showIgEmbed, setShowIgEmbed] = useState(false);
  const isInstagram = reel.mediaType === 'instagram' && Boolean(reel.instagramCode);

  return (
    <div className="max-w-xs sm:max-w-sm rounded-2xl border border-stone-200 dark:border-slate-700/90 bg-white dark:bg-[#182028] overflow-hidden shadow-xs">
      {isInstagram && showIgEmbed && reel.instagramCode ? (
        <div className="bg-black">
          <iframe
            src={`https://www.instagram.com/reel/${reel.instagramCode}/embed/`}
            title={`Instagram Reel by ${reel.authorName}`}
            className="w-full h-[420px] border-0"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="relative h-44 bg-gradient-to-br from-emerald-900 via-slate-900 to-rose-950 flex flex-col items-center justify-center p-4 text-center text-white overflow-hidden">
          {reel.mediaType === 'image' && reel.mediaUrl ? (
            <img
              src={reel.mediaUrl}
              alt={reel.caption}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
          <div className="relative z-10 flex flex-col items-center gap-1.5">
            {isInstagram ? (
              <Instagram className="w-8 h-8 text-rose-400 drop-shadow" />
            ) : (
              <span className="text-4xl drop-shadow">{reel.sceneEmoji || '🎬'}</span>
            )}
            <p className="font-display text-sm font-bold line-clamp-2 drop-shadow">
              {isInstagram ? 'Instagram Reel' : reel.sceneHeadline || reel.caption || 'Shared Reel'}
            </p>
            <p className="text-[11px] text-white/85 flex items-center gap-1">
              <Music2 className="w-3 h-3 text-emerald-300" />
              <span className="truncate max-w-[200px]">
                {reel.audioTitle}
                {reel.audioArtist ? ` — ${reel.audioArtist}` : ''}
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="p-3 space-y-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
            {reel.authorName}{' '}
            <span className="font-normal text-stone-500 dark:text-slate-400">@{reel.authorHandle}</span>
          </p>
          {reel.caption && (
            <p className="text-xs text-stone-600 dark:text-slate-300 line-clamp-2 mt-0.5">{reel.caption}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isInstagram && (
            <button
              type="button"
              onClick={() => setShowIgEmbed((v) => !v)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Instagram className="w-3.5 h-3.5" />
              <span>{showIgEmbed ? 'Hide Player' : 'Play Instagram Reel'}</span>
            </button>
          )}
          {onOpenReel && (
            <button
              type="button"
              onClick={() => onOpenReel(reel.reelId)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Watch in Reels</span>
            </button>
          )}
          {reel.instagramUrl && (
            <a
              href={reel.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open on Instagram"
              className="p-2 rounded-xl border border-stone-200 dark:border-slate-700 text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

interface MessageItemProps {
  message: Message;
  compact: boolean;
  currentUid: string;
  currentRole: MemberRole | null;
  isBlockedAuthor: boolean;
  linkedEvent?: RoomEvent;
  highlightQuery?: string;
  isThreadView?: boolean;
  chatTheme?: ChatThemeMeta;
  onReply: (message: Message) => void;
  onOpenThread: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message, isModAction: boolean) => void;
  onDeleteForMe?: (message: Message) => void;
  onTogglePin: (message: Message) => void;
  onToggleReaction: (message: Message, emoji: string) => void;
  onVotePoll: (message: Message, optionId: string) => void;
  onRsvpEvent: (event: RoomEvent, choice: 'going' | 'maybe' | 'none') => void;
  onReport: (message: Message) => void;
  onPreviewImage: (url: string, caption: string, fileName?: string, fallbackUrl?: string) => void;
  onDirectMessageAuthor?: (authorId: string, authorName: string, authorPhoto: string) => void;
  onOpenReelFromChat?: (reelId: string) => void;
}

function renderFormattedText(
  text: string,
  highlightQuery?: string,
  onDarkBubble = false
): React.ReactNode {
  const tokenRegex = /(https?:\/\/[^\s<>()]+|@[a-zA-Z0-9_.-]{2,32})/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={
            onDarkBubble
              ? 'text-white underline underline-offset-2 break-all hover:opacity-85 font-medium'
              : 'text-emerald-700 dark:text-emerald-400 underline underline-offset-2 break-all hover:opacity-80'
          }
        >
          {part}
        </a>
      );
    }
    if (/^@(?:everyone|all)$/i.test(part)) {
      return (
        <span
          key={idx}
          className={
            onDarkBubble
              ? 'font-semibold bg-white/20 text-white px-1.5 py-0.5 rounded-md'
              : 'font-semibold bg-accent-soft text-accent-soft px-1.5 py-0.5 rounded-md'
          }
        >
          {part}
        </span>
      );
    }
    if (/^@[a-zA-Z0-9_.-]{2,32}$/.test(part)) {
      return (
        <span
          key={idx}
          className={
            onDarkBubble
              ? 'font-medium text-white bg-white/20 px-1 rounded'
              : 'font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-500/12 px-1 rounded'
          }
        >
          {part}
        </span>
      );
    }
    if (highlightQuery && highlightQuery.trim().length > 1) {
      const escaped = highlightQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const subParts = part.split(new RegExp(`(${escaped})`, 'gi'));
      return subParts.map((sub, sIdx) =>
        sub.toLowerCase() === highlightQuery.trim().toLowerCase() ? (
          <mark
            key={`${idx}-${sIdx}`}
            className="bg-amber-200 dark:bg-amber-700/70 text-stone-900 dark:text-white rounded px-0.5"
          >
            {sub}
          </mark>
        ) : (
          <React.Fragment key={`${idx}-${sIdx}`}>{sub}</React.Fragment>
        )
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const MessageItem = React.memo(function MessageItem({
  message,
  compact,
  currentUid,
  currentRole,
  isBlockedAuthor,
  linkedEvent,
  highlightQuery,
  isThreadView = false,
  chatTheme,
  onReply,
  onOpenThread,
  onEdit,
  onDelete,
  onDeleteForMe,
  onTogglePin,
  onToggleReaction,
  onVotePoll,
  onRsvpEvent,
  onReport,
  onPreviewImage,
  onDirectMessageAuthor,
  onOpenReelFromChat,
}: MessageItemProps) {
  const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [revealBlocked, setRevealBlocked] = useState(false);
  const [useDirectMediaSrc, setUseDirectMediaSrc] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const reactionSpring = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.55 };

  const isOwn = message.authorId === currentUid;
  const isMod = currentRole === 'owner' || currentRole === 'moderator';
  const readByOthersCount = message.readBy.filter((id) => id !== message.authorId).length;
  const deliveredToOthersCount = (message.deliveredTo || []).filter(
    (id) => id !== message.authorId
  ).length;

  const isThemed = Boolean(chatTheme && chatTheme.id !== 'classic');
  const isDarkBackdrop = Boolean(isThemed && chatTheme?.isDarkSurface);

  const isStructuredSpecialCard =
    message.kind === 'poll' ||
    message.kind === 'event' ||
    message.mediaMime === SONG_MESSAGE_MIME ||
    message.mediaMime === REEL_MESSAGE_MIME ||
    message.text.startsWith('__QL_SONG__:') ||
    message.text.startsWith('__QL_REEL__:');

  const isStickerOrGif =
    message.kind === 'image' &&
    (isStickerMedia(message.mediaName, message.mediaMime) ||
      isAnimatedGifMedia(message.mediaName, message.mediaMime));

  const hasVisibleText = Boolean(message.text && !isStructuredSpecialCard);
  const canEdit =
    isOwn &&
    !message.deleted &&
    !isStructuredSpecialCard &&
    (message.kind === 'text' || (message.kind === 'image' && !isStickerOrGif));
  const canDeleteForEveryone = !message.deleted && (isOwn || isMod);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartRef.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (message.deleted || e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    clearLongPress();
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      setActionSheetOpen(true);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(14);
        } catch {
          // Ignore unsupported vibrate
        }
      }
    }, 420);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const t = e.touches[0];
    if (
      Math.abs(t.clientX - touchStartRef.current.x) > 10 ||
      Math.abs(t.clientY - touchStartRef.current.y) > 10
    ) {
      clearLongPress();
    }
  };

  const handleCopyText = () => {
    if (!hasVisibleText || !navigator.clipboard) return;
    void navigator.clipboard.writeText(message.text).then(() => {
      setCopiedText(true);
      window.setTimeout(() => {
        setCopiedText(false);
        setActionSheetOpen(false);
      }, 650);
    });
  };

  if (isBlockedAuthor && !revealBlocked) {
    return (
      <div className="px-4 py-1.5 flex items-center justify-between text-xs text-stone-500 dark:text-slate-400">
        <span>Message from a blocked user is hidden.</span>
        <button
          type="button"
          onClick={() => setRevealBlocked(true)}
          className="text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
        >
          Show once
        </button>
      </div>
    );
  }

  const totalPollVotes = message.poll
    ? message.poll.options.reduce((sum, opt) => sum + opt.voterIds.length, 0)
    : 0;

  const useOwnGradientBubble = isThemed && isOwn && !message.deleted && !isStickerOrGif && !isStructuredSpecialCard;
  const usePeerThemedBubble = isThemed && !isOwn && !message.deleted && !isStickerOrGif && !isStructuredSpecialCard;

  return (
    <motion.article
      id={`msg-${message.id}`}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.6 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={clearLongPress}
      onTouchCancel={clearLongPress}
      onContextMenu={(e) => {
        if (message.deleted) return;
        e.preventDefault();
        setActionSheetOpen(true);
      }}
      className={`msg-row-perf group relative px-3.5 sm:px-5 transition-colors ${
        isThemed
          ? compact
            ? 'py-0.5'
            : 'pt-2 pb-1'
          : `hover:bg-stone-100/70 dark:hover:bg-slate-800/35 ${compact ? 'py-0.5' : 'pt-2.5 pb-1'}`
      } ${message.pinned && !isThemed ? 'bg-amber-50/50 dark:bg-amber-950/15' : ''}`}
    >
      {/* Desktop Hover Quick Action Bar */}
      {!message.deleted && (
        <div className="hidden sm:group-hover:flex sm:focus-within:flex items-center gap-0.5 absolute right-4 -top-3 bg-white dark:bg-[#1C2128] border border-stone-200 dark:border-slate-700 rounded-lg p-0.5 shadow-sm z-10">
          <div className="relative">
            <button
              type="button"
              onClick={() => setEmojiMenuOpen((v) => !v)}
              aria-label="Add reaction"
              title="React"
              className="p-1.5 rounded-md text-stone-500 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
            <AnimatePresence>
              {emojiMenuOpen && (
                <motion.div
                  initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 4 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 3 }}
                  transition={reactionSpring}
                  className="absolute right-0 bottom-full mb-1.5 flex items-center gap-1 p-1 bg-white dark:bg-[#1C2128] border border-stone-200 dark:border-slate-700 rounded-lg shadow-lg z-20"
                >
                  {QUICK_EMOJIS.map((emoji) => (
                    <motion.button
                      key={emoji}
                      type="button"
                      whileHover={prefersReducedMotion ? undefined : { scale: 1.22, y: -1.5 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.88 }}
                      transition={reactionSpring}
                      onClick={() => {
                        onToggleReaction(message, emoji);
                        setEmojiMenuOpen(false);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-stone-100 dark:hover:bg-slate-700 text-sm cursor-pointer"
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => onReply(message)}
            aria-label="Reply to message"
            title="Reply"
            className="p-1.5 rounded-md text-stone-500 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-700 cursor-pointer"
          >
            <CornerUpLeft className="w-3.5 h-3.5" />
          </button>

          {!isThreadView && (
            <button
              type="button"
              onClick={() => onOpenThread(message)}
              aria-label="Open thread"
              title="Start or view thread"
              className="p-1.5 rounded-md text-stone-500 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}

          {isMod && !isThreadView && (
            <button
              type="button"
              onClick={() => onTogglePin(message)}
              aria-label={message.pinned ? 'Unpin message' : 'Pin message'}
              title={message.pinned ? 'Unpin' : 'Pin'}
              className={`p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-slate-700 cursor-pointer ${
                message.pinned ? 'text-amber-600 dark:text-amber-400' : 'text-stone-500 dark:text-slate-300'
              }`}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(message)}
              aria-label="Edit message"
              title="Edit message"
              className="p-1.5 rounded-md text-stone-500 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}

          {(canDeleteForEveryone || onDeleteForMe) && (
            <button
              type="button"
              onClick={() => setActionSheetOpen(true)}
              aria-label="Delete options"
              title={canDeleteForEveryone ? 'Delete for Everyone / Delete for Me' : 'Delete for Me'}
              className="p-1.5 rounded-md text-stone-500 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {!isOwn && onDirectMessageAuthor && (
            <button
              type="button"
              onClick={() =>
                onDirectMessageAuthor(message.authorId, message.authorName, message.authorPhoto)
              }
              aria-label={`Message ${message.authorName} privately`}
              title={`Message ${message.authorName} privately`}
              className="p-1.5 rounded-md text-stone-500 dark:text-slate-300 hover:text-accent hover:bg-stone-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
          )}

          {!isOwn && (
            <button
              type="button"
              onClick={() => onReport(message)}
              aria-label="Report message"
              title="Report message"
              className="p-1.5 rounded-md text-stone-500 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-stone-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Inline Reply Context */}
      {message.replyToId && (
        <div
          className={`flex items-center gap-2 mb-1 text-xs ${
            isThemed && isOwn ? 'justify-end mr-1' : 'ml-11'
          } ${
            isDarkBackdrop
              ? 'text-white/80'
              : 'text-stone-500 dark:text-slate-400'
          }`}
        >
          <CornerUpLeft className="w-3 h-3 shrink-0" />
          <span
            className={`font-medium shrink-0 ${
              isDarkBackdrop ? 'text-white' : 'text-stone-700 dark:text-slate-300'
            }`}
          >
            {message.replyToAuthor}
          </span>
          <span className="truncate max-w-[240px]">{message.replyToSnippet}</span>
        </div>
      )}

      <div
        className={`flex items-start gap-2.5 sm:gap-3 ${
          isThemed && isOwn ? 'flex-row-reverse' : ''
        }`}
      >
        {/* Avatar or Compact Timestamp (Hidden on Own Instagram-Style Right Bubbles) */}
        {!(isThemed && isOwn) && (
          <div className="w-9 shrink-0 flex justify-center pt-0.5">
            {compact ? (
              <span
                className={`opacity-0 group-hover:opacity-100 text-[10px] font-mono-tabular pt-1 ${
                  isDarkBackdrop ? 'text-white/70' : 'text-stone-400 dark:text-slate-500'
                }`}
              >
                {formatTimestamp(message.createdAt)}
              </span>
            ) : !isOwn && onDirectMessageAuthor ? (
              <button
                type="button"
                onClick={() =>
                  onDirectMessageAuthor(message.authorId, message.authorName, message.authorPhoto)
                }
                title={`Message ${message.authorName} privately`}
                aria-label={`Message ${message.authorName} privately`}
                className="rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
              >
                <Avatar name={message.authorName} src={message.authorPhoto} size="md" />
              </button>
            ) : (
              <Avatar name={message.authorName} src={message.authorPhoto} size="md" />
            )}
          </div>
        )}

        <div
          className={`min-w-0 flex-1 space-y-1.5 ${
            isThemed && isOwn ? 'flex flex-col items-end' : ''
          }`}
        >
          {/* Classic Header OR Peer Name on Themed Chat */}
          {!compact && !(isThemed && isOwn) && (
            <div className="flex items-baseline gap-2 flex-wrap">
              {!isOwn && onDirectMessageAuthor ? (
                <button
                  type="button"
                  onClick={() =>
                    onDirectMessageAuthor(message.authorId, message.authorName, message.authorPhoto)
                  }
                  title={`Open private DM with ${message.authorName}`}
                  className={`text-sm font-semibold hover:underline cursor-pointer ${
                    isDarkBackdrop
                      ? 'text-white drop-shadow-xs'
                      : 'text-stone-900 dark:text-white hover:text-accent'
                  }`}
                >
                  {message.authorName}
                </button>
              ) : (
                <span
                  className={`text-sm font-semibold ${
                    isDarkBackdrop ? 'text-white drop-shadow-xs' : 'text-stone-900 dark:text-white'
                  }`}
                >
                  {message.authorName}
                </span>
              )}
              <span
                className={`text-[11px] font-mono-tabular ${
                  isDarkBackdrop ? 'text-white/70' : 'text-stone-400 dark:text-slate-500'
                }`}
              >
                {formatTimestamp(message.createdAt)}
              </span>
              {message.edited && !message.deleted && (
                <span
                  className={`text-[11px] ${
                    isDarkBackdrop ? 'text-white/75' : 'text-stone-400 dark:text-slate-500'
                  }`}
                >
                  · edited
                </span>
              )}
              {message.pinned && (
                <span className="text-[11px] text-amber-500 dark:text-amber-400 font-medium">
                  · pinned
                </span>
              )}
              {isOwn && !message.deleted && !isThemed && (
                <span
                  title={
                    readByOthersCount > 0
                      ? `Read by ${readByOthersCount} ${readByOthersCount === 1 ? 'member' : 'members'}`
                      : deliveredToOthersCount > 0
                        ? `Delivered to ${deliveredToOthersCount}`
                        : 'Sent'
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-stone-400 dark:text-slate-500"
                >
                  {readByOthersCount > 0 ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                        Read{readByOthersCount > 1 ? ` · ${readByOthersCount}` : ''}
                      </span>
                    </>
                  ) : deliveredToOthersCount > 0 ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-stone-400 dark:text-slate-400" />
                      <span>Delivered</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Sent</span>
                    </>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Deleted Placeholder */}
          {message.deleted ? (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs italic ${
                isDarkBackdrop
                  ? 'bg-black/40 text-white/70 border border-white/15 backdrop-blur-xs'
                  : isThemed
                    ? 'bg-white/75 dark:bg-slate-900/75 text-stone-500 dark:text-slate-400 border border-stone-200/80 dark:border-slate-700/70'
                    : 'px-0 py-0 text-sm text-stone-400 dark:text-slate-500'
              }`}
            >
              <span>{message.text}</span>
            </div>
          ) : (
            <div
              className={`flex items-end gap-1.5 max-w-full ${
                isThemed && isOwn ? 'flex-row-reverse' : ''
              }`}
            >
              {/* Bubble / Content Container */}
              <div
                style={
                  useOwnGradientBubble && chatTheme
                    ? { background: chatTheme.ownBubbleGradient }
                    : undefined
                }
                className={`space-y-1.5 min-w-0 ${
                  useOwnGradientBubble
                    ? 'max-w-[85vw] sm:max-w-[520px] px-3.5 py-2.5 rounded-2xl rounded-br-sm text-white shadow-sm'
                    : usePeerThemedBubble && chatTheme
                      ? `max-w-[85vw] sm:max-w-[520px] px-3.5 py-2.5 rounded-2xl rounded-bl-sm shadow-xs ${chatTheme.peerBubbleClass}`
                      : 'flex-1 min-w-0'
                }`}
              >
                {/* Text Body (hidden for structured Song / Reel rich cards) */}
                {hasVisibleText && (
                  <p
                    className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words max-w-[72ch] ${
                      useOwnGradientBubble
                        ? 'text-white'
                        : usePeerThemedBubble
                          ? ''
                          : 'text-stone-800 dark:text-slate-200'
                    }`}
                  >
                    {renderFormattedText(message.text, highlightQuery, useOwnGradientBubble)}
                  </p>
                )}

              {/* Link Preview Card */}
              {message.linkPreview && (
                <a
                  href={message.linkPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block max-w-md rounded-xl border border-stone-200 dark:border-slate-700/80 bg-stone-50 dark:bg-[#1C2128] p-3 hover:border-stone-300 dark:hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-slate-400">
                    <span className="truncate font-mono-tabular">{message.linkPreview.domain}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </div>
                  <p className="text-sm font-semibold text-stone-900 dark:text-white mt-0.5 line-clamp-1">
                    {message.linkPreview.title}
                  </p>
                  {message.linkPreview.description && (
                    <p className="text-xs text-stone-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {message.linkPreview.description}
                    </p>
                  )}
                </a>
              )}

              {/* Sticker, Animated GIF, or Image Attachment */}
              {message.kind === 'image' && (message.mediaUrl || message.thumbnailUrl) && (
                isStickerMedia(message.mediaName, message.mediaMime) ? (
                  <motion.div
                    whileHover={prefersReducedMotion ? undefined : { scale: 1.06, rotate: -1 }}
                    transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                    className="inline-block py-1"
                  >
                    <img
                      src={message.mediaUrl || message.thumbnailUrl || ''}
                      alt={message.mediaName.replace(/^sticker:/, '') || 'Sticker'}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-36 h-36 sm:w-44 sm:h-44 object-contain drop-shadow-sm select-none"
                    />
                  </motion.div>
                ) : isAnimatedGifMedia(message.mediaName, message.mediaMime) ? (
                  <div className="max-w-[270px] space-y-1">
                    <button
                      type="button"
                      onClick={() =>
                        onPreviewImage(
                          message.mediaUrl || message.thumbnailUrl || '',
                          message.text || message.mediaName.replace(/^gif:/, ''),
                          message.mediaName,
                          message.thumbnailUrl || undefined
                        )
                      }
                      className="group/photo relative block w-full rounded-2xl overflow-hidden border border-stone-200 dark:border-slate-700 bg-stone-900 cursor-zoom-in text-left shadow-xs"
                    >
                      <img
                        src={message.mediaUrl || message.thumbnailUrl || ''}
                        alt={message.mediaName.replace(/^gif:/, '') || 'Animated GIF'}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full max-h-56 object-contain"
                      />
                    </button>
                  </div>
                ) : (
                  <div className="max-w-sm space-y-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onPreviewImage(
                          message.mediaUrl || message.thumbnailUrl || '',
                          message.text || message.mediaName,
                          message.mediaName,
                          message.thumbnailUrl || undefined
                        )
                      }
                      className="group/photo relative block w-full rounded-xl overflow-hidden border border-stone-200 dark:border-slate-700 bg-stone-100 dark:bg-slate-900 cursor-zoom-in text-left"
                    >
                      <img
                        src={
                          useDirectMediaSrc
                            ? message.mediaUrl || message.thumbnailUrl || ''
                            : message.thumbnailUrl || message.mediaUrl || ''
                        }
                        alt={message.mediaName || 'Shared campus photo'}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => {
                          if (!useDirectMediaSrc && message.mediaUrl && message.thumbnailUrl) {
                            setUseDirectMediaSrc(true);
                          }
                        }}
                        className="w-full max-h-72 object-cover transition-transform duration-300 group-hover/photo:scale-[1.015]"
                      />
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium backdrop-blur-sm opacity-90 sm:opacity-0 sm:group-hover/photo:opacity-100 transition-opacity">
                        Tap to view
                      </span>
                    </button>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-slate-400 px-0.5">
                      <span className="truncate font-mono-tabular">
                        {message.mediaName || 'Photo'}
                        {message.mediaSize > 0 ? ` · ${formatBytes(message.mediaSize)}` : ''}
                      </span>
                      <a
                        href={
                          message.mediaUrl.startsWith('/api/media/')
                            ? `${message.mediaUrl}?download=1`
                            : message.mediaUrl
                        }
                        download={message.mediaName || 'photo.jpg'}
                        className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline shrink-0 font-medium"
                      >
                        <Download className="w-3 h-3" />
                        <span>Original</span>
                      </a>
                    </div>
                  </div>
                )
              )}

              {/* Playable Movie / Famous Song Card */}
              {message.kind === 'file' &&
                (message.mediaMime === SONG_MESSAGE_MIME || message.text.startsWith('__QL_SONG__:')) &&
                (() => {
                  const songMeta = decodeSongMessage(
                    message.text,
                    message.mediaUrl,
                    message.mediaName,
                    message.thumbnailUrl
                  );
                  return songMeta ? <ChatSongCard song={songMeta} /> : null;
                })()}

              {/* Interactive Shared Instagram / Quadline Reel Card */}
              {message.kind === 'file' &&
                (message.mediaMime === REEL_MESSAGE_MIME || message.text.startsWith('__QL_REEL__:')) &&
                (() => {
                  const reelMeta = decodeReelMessage(message.text);
                  return reelMeta ? (
                    <ChatReelCard reel={reelMeta} onOpenReel={onOpenReelFromChat} />
                  ) : null;
                })()}

              {/* Standard File, Photo-File, or Video Attachment */}
              {message.kind === 'file' &&
                message.mediaUrl &&
                message.mediaMime !== SONG_MESSAGE_MIME &&
                message.mediaMime !== REEL_MESSAGE_MIME &&
                !message.text.startsWith('__QL_SONG__:') &&
                !message.text.startsWith('__QL_REEL__:') && (
                <div className="max-w-md space-y-1.5">
                  {message.mediaMime.startsWith('image/') && (
                    <button
                      type="button"
                      onClick={() =>
                        onPreviewImage(
                          message.mediaUrl,
                          message.text || message.mediaName,
                          message.mediaName,
                          message.thumbnailUrl || undefined
                        )
                      }
                      className="block w-full max-w-sm rounded-xl overflow-hidden border border-stone-200 dark:border-slate-700 bg-stone-100 dark:bg-slate-900 cursor-zoom-in"
                    >
                      <img
                        src={message.thumbnailUrl || message.mediaUrl}
                        alt={message.mediaName || 'Shared image file'}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full max-h-72 object-cover"
                      />
                    </button>
                  )}
                  {message.mediaMime.startsWith('video/') && (
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      src={message.mediaUrl}
                      className="w-full max-h-72 rounded-xl border border-stone-200 dark:border-slate-700 bg-black"
                    />
                  )}
                  <a
                    href={
                      message.mediaUrl.startsWith('/api/media/')
                        ? `${message.mediaUrl}?download=1`
                        : message.mediaUrl
                    }
                    download={message.mediaName || 'attachment'}
                    className="inline-flex items-center gap-3 max-w-sm px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-[#1C2128] hover:border-stone-300 dark:hover:border-slate-600 transition-colors"
                  >
                    <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-900 dark:text-white truncate">
                        {message.mediaName || 'Campus file'}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-slate-400 font-mono-tabular">
                        {formatBytes(message.mediaSize)}
                      </p>
                    </div>
                    <Download className="w-4 h-4 text-stone-500 dark:text-slate-400 shrink-0" />
                  </a>
                </div>
              )}

              {/* Interactive Voice Note Player */}
              {message.kind === 'voice' && message.mediaUrl && (
                <VoiceNotePlayer
                  src={message.mediaUrl}
                  durationSec={message.voiceDurationSec}
                  waveform={message.waveform}
                  voiceEffect={message.voiceEffect}
                />
              )}

              {/* Interactive Poll Card */}
              {message.kind === 'poll' && message.poll && (
                <div className="max-w-md rounded-xl border border-stone-200 dark:border-slate-700/90 bg-white dark:bg-[#1C2128] p-4 space-y-3">
                  <div>
                    <p className="text-xs text-stone-500 dark:text-slate-400">
                      Campus Poll ·{' '}
                      <span className="tabular-nums">{totalPollVotes}</span>{' '}
                      {totalPollVotes === 1 ? 'vote' : 'votes'}
                      {message.poll.allowMultiple ? ' · Multiple choice' : ' · Single choice'}
                    </p>
                    <h3 className="font-display text-sm font-bold text-stone-900 dark:text-white mt-0.5">
                      {message.poll.question}
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {message.poll.options.map((opt) => {
                      const voted = opt.voterIds.includes(currentUid);
                      const pct =
                        totalPollVotes > 0 ? Math.round((opt.voterIds.length / totalPollVotes) * 100) : 0;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onVotePoll(message, opt.id)}
                          className={`relative w-full text-left rounded-lg border px-3 py-2 overflow-hidden transition-colors cursor-pointer ${
                            voted
                              ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                              : 'border-stone-200 dark:border-slate-700 hover:border-stone-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div
                            className="absolute inset-y-0 left-0 bg-emerald-600/12 dark:bg-emerald-500/18 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                          <div className="relative flex items-center justify-between gap-2 text-xs sm:text-sm">
                            <span className="font-medium text-stone-900 dark:text-slate-100">
                              {opt.label}
                            </span>
                            <span className="font-mono-tabular text-xs text-stone-600 dark:text-slate-300 shrink-0">
                              {pct}% · {opt.voterIds.length}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Embedded Event Card */}
              {message.kind === 'event' && (
                <div className="max-w-md rounded-xl border border-stone-200 dark:border-slate-700/90 bg-white dark:bg-[#1C2128] overflow-hidden">
                  {linkedEvent?.coverImage && (
                    <img
                      src={linkedEvent.coverImage}
                      alt={linkedEvent.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <div className="p-4 space-y-2.5">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        Campus Event
                        {linkedEvent
                          ? ` · Reminder ${linkedEvent.reminderMinutes} min before`
                          : ''}
                      </p>
                      <h3 className="font-display text-sm font-bold text-stone-900 dark:text-white">
                        {linkedEvent ? linkedEvent.title : message.text}
                      </h3>
                    </div>

                    {linkedEvent && (
                      <>
                        {linkedEvent.description && (
                          <p className="text-xs text-stone-600 dark:text-slate-400 leading-relaxed">
                            {linkedEvent.description}
                          </p>
                        )}
                        <div className="space-y-1 text-xs text-stone-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span className="tabular-nums">{formatEventDate(linkedEvent.startAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>{linkedEvent.location}</span>
                          </div>
                        </div>

                        <div className="pt-1 flex items-center gap-2 flex-wrap">
                          {(() => {
                            const going = linkedEvent.rsvpGoing.includes(currentUid);
                            const maybe = linkedEvent.rsvpMaybe.includes(currentUid);
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRsvpEvent(linkedEvent, going ? 'none' : 'going')
                                  }
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                    going
                                      ? 'bg-emerald-700 text-white'
                                      : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-stone-200 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  Going · <span className="tabular-nums">{linkedEvent.rsvpGoing.length}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRsvpEvent(linkedEvent, maybe ? 'none' : 'maybe')
                                  }
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                    maybe
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-stone-200 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  Maybe · <span className="tabular-nums">{linkedEvent.rsvpMaybe.length}</span>
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Emoji Reactions */}
              {Object.keys(message.reactions || {}).length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <AnimatePresence initial={false} mode="popLayout">
                    {Object.entries(message.reactions).map(([emoji, uids]) => {
                      const reacted = uids.includes(currentUid);
                      return (
                        <motion.button
                          key={emoji}
                          layout={!prefersReducedMotion}
                          type="button"
                          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                          whileHover={prefersReducedMotion ? undefined : { scale: 1.07, y: -1 }}
                          whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                          transition={reactionSpring}
                          onClick={() => onToggleReaction(message, emoji)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border transition-colors cursor-pointer ${
                            reacted
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500/60 text-emerald-900 dark:text-emerald-200'
                              : 'bg-white dark:bg-[#1C2128] border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300 hover:border-stone-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <motion.span
                            key={`${emoji}-${reacted ? 'on' : 'off'}`}
                            initial={prefersReducedMotion ? false : { scale: reacted ? 1.28 : 0.9 }}
                            animate={{ scale: 1 }}
                            transition={reactionSpring}
                            className="inline-block"
                          >
                            {emoji}
                          </motion.span>
                          <motion.span
                            key={uids.length}
                            initial={prefersReducedMotion ? false : { opacity: 0.6, y: -3 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={reactionSpring}
                            className="font-mono-tabular text-[11px]"
                          >
                            {uids.length}
                          </motion.span>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

                {/* Bubble Timestamp + Edited + Read Receipt Footer for Own Themed Messages */}
                {isThemed && isOwn && (
                  <div
                    className={`flex items-center justify-end gap-1.5 text-[10px] font-mono-tabular pt-0.5 ${
                      useOwnGradientBubble
                        ? 'text-white/80'
                        : isDarkBackdrop
                          ? 'text-white/75'
                          : 'text-stone-500 dark:text-slate-400'
                    }`}
                  >
                    {message.edited && <span>edited ·</span>}
                    <span>{formatTimestamp(message.createdAt)}</span>
                    {readByOthersCount > 0 ? (
                      <CheckCheck className="w-3.5 h-3.5 text-white" />
                    ) : deliveredToOthersCount > 0 ? (
                      <CheckCheck className="w-3.5 h-3.5 opacity-80" />
                    ) : (
                      <Check className="w-3.5 h-3.5 opacity-80" />
                    )}
                  </div>
                )}

                {/* Thread Counter Button */}
                {!isThreadView && message.threadReplyCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenThread(message)}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium hover:underline pt-0.5 cursor-pointer ${
                      useOwnGradientBubble
                        ? 'text-white'
                        : isDarkBackdrop
                          ? 'text-emerald-300'
                          : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="tabular-nums">
                      {message.threadReplyCount}{' '}
                      {message.threadReplyCount === 1 ? 'thread reply' : 'thread replies'}
                    </span>
                  </button>
                )}
              </div>

              {/* Always-Accessible Mobile & Desktop Message Actions Trigger (Edit, Delete for Everyone, Reply, React) */}
              <button
                type="button"
                onClick={() => setActionSheetOpen(true)}
                aria-label="Message actions (edit, delete, reply)"
                title="More actions (Edit, Delete, Reply)"
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-opacity sm:opacity-35 sm:group-hover:opacity-100 focus:opacity-100 cursor-pointer ${
                  isDarkBackdrop
                    ? 'text-white/75 hover:text-white bg-black/30 hover:bg-black/50'
                    : 'text-stone-400 dark:text-slate-500 hover:text-stone-800 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-slate-800'
                }`}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Smooth Touch & Desktop Message Action Sheet (Edit, Delete for Everyone, Delete for Me, Reply, Copy) */}
      <AnimatePresence>
        {actionSheetOpen && !message.deleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.14 }}
            role="dialog"
            aria-modal="true"
            aria-label="Message actions"
            onClick={() => setActionSheetOpen(false)}
            className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 460, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden pb-[env(safe-area-inset-bottom)] sm:pb-0"
            >
              {/* Message Snippet Header */}
              <div className="px-4 py-3 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                    {message.authorName}
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                    {hasVisibleText ? message.text : message.mediaName || 'Attachment'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActionSheetOpen(false)}
                  aria-label="Close message actions"
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Reactions Row */}
              <div className="px-4 py-2.5 border-b border-stone-100 dark:border-slate-800/80 flex items-center justify-between gap-1">
                {QUICK_EMOJIS.map((emoji) => (
                  <motion.button
                    key={emoji}
                    type="button"
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.85 }}
                    onClick={() => {
                      onToggleReaction(message, emoji);
                      setActionSheetOpen(false);
                    }}
                    className="w-10 h-10 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center justify-center text-xl cursor-pointer transition-colors"
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="p-2 space-y-1">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionSheetOpen(false);
                      onEdit(message);
                    }}
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center gap-3 text-left text-sm font-medium text-stone-800 dark:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-4 h-4 text-accent shrink-0" />
                    <div>
                      <p className="leading-tight">Edit Message</p>
                      <p className="text-[11px] text-stone-500 dark:text-slate-400">
                        Fix typos or update text for everyone
                      </p>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActionSheetOpen(false);
                    onReply(message);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-sm font-medium text-stone-800 dark:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <CornerUpLeft className="w-4 h-4 text-stone-500 dark:text-slate-400 shrink-0" />
                  <span>Reply</span>
                </button>

                {!isThreadView && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionSheetOpen(false);
                      onOpenThread(message);
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-sm font-medium text-stone-800 dark:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4 text-stone-500 dark:text-slate-400 shrink-0" />
                    <span>Open Thread</span>
                  </button>
                )}

                {hasVisibleText && (
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-sm font-medium text-stone-800 dark:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Copy className="w-4 h-4 text-stone-500 dark:text-slate-400 shrink-0" />
                    <span>{copiedText ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                )}

                {isMod && !isThreadView && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionSheetOpen(false);
                      onTogglePin(message);
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-sm font-medium text-stone-800 dark:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Pin className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{message.pinned ? 'Unpin Message' : 'Pin Message'}</span>
                  </button>
                )}

                {!isOwn && onDirectMessageAuthor && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionSheetOpen(false);
                      onDirectMessageAuthor(
                        message.authorId,
                        message.authorName,
                        message.authorPhoto
                      );
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-sm font-medium text-stone-800 dark:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-accent shrink-0" />
                    <span>Message {message.authorName} Privately</span>
                  </button>
                )}

                {/* Delete Section */}
                {(canDeleteForEveryone || onDeleteForMe) && (
                  <div className="pt-1 mt-1 border-t border-stone-100 dark:border-slate-800 space-y-1">
                    {canDeleteForEveryone && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionSheetOpen(false);
                          onDelete(message, !isOwn && isMod);
                        }}
                        className="w-full min-h-[44px] px-3 py-2.5 rounded-xl flex items-center gap-3 text-left text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/35 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <div>
                          <p className="leading-tight">
                            {isOwn ? 'Delete for Everyone' : 'Delete for Everyone (Mod)'}
                          </p>
                          <p className="text-[11px] font-normal text-red-500/80 dark:text-red-400/80">
                            Unsends this message for all members in this chat
                          </p>
                        </div>
                      </button>
                    )}

                    {onDeleteForMe && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionSheetOpen(false);
                          onDeleteForMe(message);
                        }}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-sm font-medium text-stone-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <EyeOff className="w-4 h-4 text-stone-500 dark:text-slate-400 shrink-0" />
                        <div>
                          <p className="leading-tight">Delete for Me</p>
                          <p className="text-[11px] text-stone-500 dark:text-slate-400">
                            Hides this message only on your screen
                          </p>
                        </div>
                      </button>
                    )}
                  </div>
                )}

                {!isOwn && (
                  <button
                    type="button"
                    onClick={() => {
                      setActionSheetOpen(false);
                      onReport(message);
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl flex items-center gap-3 text-left text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                  >
                    <Flag className="w-4 h-4 shrink-0" />
                    <span>Report Message</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
});
