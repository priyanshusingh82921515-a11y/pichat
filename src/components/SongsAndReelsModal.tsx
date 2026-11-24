import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Check,
  Copy,
  Disc3,
  ExternalLink,
  Film,
  Instagram,
  Link2,
  Loader2,
  LogOut,
  Music2,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  createReel,
  disconnectSpotify,
  fetchReels,
  fetchSongs,
  fetchSpotifyAuthUrl,
  fetchSpotifyStatus,
  fetchSpotifyTracks,
  resolveSpotifyTrackUrl,
  type ReelItem,
  type SpotifyConnectionStatus,
  type SpotifyLibrarySection,
} from '../lib/backendApi';
import {
  parseInstagramReelUrl,
  parseSpotifyTrackUrl,
  SONG_CATEGORIES,
  type SongCategory,
  type SongTrack,
} from '../lib/songsAndReels';
import type { Profile } from '../types/chat';

interface SongsAndReelsModalProps {
  open: boolean;
  initialTab: 'songs' | 'reels';
  roomName: string;
  profile: Profile;
  onClose: () => void;
  onSendSong: (song: SongTrack, note?: string) => Promise<void>;
  onShareReel: (reel: ReelItem) => Promise<void>;
  onOpenCreateReelForRoom: () => void;
}

const SPOTIFY_SECTIONS: { id: SpotifyLibrarySection; label: string }[] = [
  { id: 'liked', label: 'Liked Songs' },
  { id: 'top', label: 'Top Tracks' },
  { id: 'recent', label: 'Recently Played' },
  { id: 'search', label: 'Search Spotify' },
];

function SpotifyGlyph({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.58 14.42c-.18.3-.56.4-.86.21-2.36-1.44-5.33-1.77-8.83-.97-.34.08-.68-.13-.76-.47-.08-.34.13-.68.47-.76 3.83-.88 7.12-.5 9.77 1.13.3.18.4.56.21.86zm1.22-2.72c-.23.37-.71.49-1.08.26-2.7-1.66-6.82-2.14-10.01-1.17-.42.13-.86-.11-.99-.53-.13-.42.11-.86.53-.99 3.65-1.11 8.19-.57 11.29 1.34.37.23.49.71.26 1.09zm.11-2.84c-3.24-1.92-8.59-2.1-11.68-1.16-.5.15-1.02-.13-1.17-.63-.15-.5.13-1.02.63-1.17 3.55-1.08 9.46-.87 13.19 1.34.45.27.59.85.33 1.29-.27.45-.85.59-1.3.33z" />
    </svg>
  );
}

export function SongsAndReelsModal({
  open,
  initialTab,
  roomName,
  profile,
  onClose,
  onSendSong,
  onShareReel,
  onOpenCreateReelForRoom,
}: SongsAndReelsModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const [tab, setTab] = useState<'songs' | 'reels'>(initialTab);
  const [songSource, setSongSource] = useState<'spotify' | 'catalog'>('spotify');

  // Spotify OAuth & Library state
  const [spotifyStatus, setSpotifyStatus] = useState<SpotifyConnectionStatus | null>(null);
  const [loadingSpotifyStatus, setLoadingSpotifyStatus] = useState(false);
  const [connectingSpotify, setConnectingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [spotifySetupHint, setSpotifySetupHint] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);
  const [spotifySection, setSpotifySection] = useState<SpotifyLibrarySection>('liked');
  const [spotifyQuery, setSpotifyQuery] = useState('');
  const [spotifySongs, setSpotifySongs] = useState<SongTrack[]>([]);
  const [loadingSpotifySongs, setLoadingSpotifySongs] = useState(false);
  const [spotifyLinkInput, setSpotifyLinkInput] = useState('');
  const [resolvingSpotifyLink, setResolvingSpotifyLink] = useState(false);
  const [embeddedPreviewTrackId, setEmbeddedPreviewTrackId] = useState<string | null>(null);

  // Catalog Movies & Hits state
  const [category, setCategory] = useState<SongCategory>('bollywood');
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<SongTrack[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sendingSongId, setSendingSongId] = useState<string | null>(null);
  const [songNote, setSongNote] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reels & Instagram share state
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loadingReels, setLoadingReels] = useState(false);
  const [igLinkInput, setIgLinkInput] = useState('');
  const [igCaption, setIgCaption] = useState('');
  const [importingIg, setImportingIg] = useState(false);
  const [igError, setIgError] = useState<string | null>(null);
  const [sharingReelId, setSharingReelId] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, open]);

  // Cleanup audio on close/unmount
  useEffect(() => {
    if (!open) {
      audioRef.current?.pause();
      setPlayingId(null);
      setEmbeddedPreviewTrackId(null);
    }
    return () => {
      audioRef.current?.pause();
    };
  }, [open]);

  const refreshSpotifyStatus = useCallback(async () => {
    setLoadingSpotifyStatus(true);
    try {
      const status = await fetchSpotifyStatus(profile.uid);
      setSpotifyStatus(status);
      return status;
    } finally {
      setLoadingSpotifyStatus(false);
    }
  }, [profile.uid]);

  // Load Spotify status when opening Songs tab
  useEffect(() => {
    if (!open || tab !== 'songs') return;
    void refreshSpotifyStatus();
  }, [open, tab, refreshSpotifyStatus]);

  // Listen for OAuth popup postMessage from /auth/spotify/callback
  useEffect(() => {
    if (!open) return;
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'SPOTIFY_OAUTH_SUCCESS') {
        setConnectingSpotify(false);
        setSpotifyError(null);
        setSpotifySetupHint(false);
        setSongSource('spotify');
        void refreshSpotifyStatus();
      } else if (event.data?.type === 'SPOTIFY_OAUTH_ERROR') {
        setConnectingSpotify(false);
        setSpotifyError(
          typeof event.data.error === 'string'
            ? event.data.error
            : 'Spotify authorization was cancelled.'
        );
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [open, refreshSpotifyStatus]);

  // Load Spotify tracks when connected & Spotify source active
  useEffect(() => {
    if (!open || tab !== 'songs' || songSource !== 'spotify' || !spotifyStatus?.connected) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingSpotifySongs(true);
      setSpotifyError(null);
      void fetchSpotifyTracks(profile.uid, {
        section: spotifySection,
        q: spotifyQuery,
      }).then((res) => {
        if (cancelled) return;
        setSpotifySongs(res.songs);
        if (res.needsReconnect) {
          setSpotifyError(res.error || 'Spotify session expired. Please reconnect Spotify.');
          void refreshSpotifyStatus();
        } else if (res.error) {
          setSpotifyError(res.error);
        }
        setLoadingSpotifySongs(false);
      });
    }, spotifyQuery.trim() ? 320 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    open,
    tab,
    songSource,
    spotifyStatus?.connected,
    spotifySection,
    spotifyQuery,
    profile.uid,
    refreshSpotifyStatus,
  ]);

  // Load Movie & Famous Songs catalog when catalog source is active
  useEffect(() => {
    if (!open || tab !== 'songs' || songSource !== 'catalog') return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingSongs(true);
      void fetchSongs({ category, q: query }).then((list) => {
        if (!cancelled) {
          setSongs(list);
          setLoadingSongs(false);
        }
      });
    }, query.trim() ? 320 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, tab, songSource, category, query]);

  // Load reels when Reels tab is open
  useEffect(() => {
    if (!open || tab !== 'reels') return;
    let cancelled = false;
    setLoadingReels(true);
    void fetchReels().then((list) => {
      if (!cancelled) {
        setReels(list);
        setLoadingReels(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, tab]);

  const handleConnectSpotify = async () => {
    setSpotifyError(null);
    setSpotifySetupHint(false);
    setConnectingSpotify(true);
    try {
      const result = await fetchSpotifyAuthUrl(profile.uid);
      if (result.needsSetup || !result.url) {
        setConnectingSpotify(false);
        setSpotifySetupHint(true);
        setSpotifyError(
          result.error ||
            'Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in AI Studio Secrets to enable Spotify sign-in.'
        );
        return;
      }

      // Open Spotify's official authorization URL directly in popup (never a container route)
      const popup = window.open(
        result.url,
        'spotify_oauth_popup',
        'width=520,height=720,noopener=no'
      );
      if (!popup) {
        setConnectingSpotify(false);
        setSpotifyError('Popup was blocked by your browser. Please allow popups and try again.');
        return;
      }

      // Reset spinner if user closes popup manually
      const pollTimer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(pollTimer);
          setConnectingSpotify(false);
        }
      }, 600);
    } catch {
      setConnectingSpotify(false);
      setSpotifyError('Could not start Spotify authorization. Please try again.');
    }
  };

  const handleDisconnectSpotify = async () => {
    await disconnectSpotify(profile.uid);
    setSpotifySongs([]);
    setEmbeddedPreviewTrackId(null);
    await refreshSpotifyStatus();
  };

  const handleCopyRedirectUri = async () => {
    const uri = spotifyStatus?.redirectUri || `${window.location.origin}/auth/spotify/callback`;
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedRedirect(true);
      window.setTimeout(() => setCopiedRedirect(false), 1800);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const parsedSpotifyLink = parseSpotifyTrackUrl(spotifyLinkInput);

  const handleSendSpotifyLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedSpotifyLink) {
      setSpotifyError('Paste a valid Spotify song link (e.g. https://open.spotify.com/track/...)');
      return;
    }
    setSpotifyError(null);
    setResolvingSpotifyLink(true);
    try {
      const { song, error } = await resolveSpotifyTrackUrl(spotifyLinkInput);
      if (!song) {
        setSpotifyError(error || 'Could not load that Spotify song link.');
        return;
      }
      await onSendSong(song, songNote);
      setSpotifyLinkInput('');
      setSongNote('');
      onClose();
    } finally {
      setResolvingSpotifyLink(false);
    }
  };

  const handleTogglePreview = (track: SongTrack) => {
    if (!track.previewUrl) {
      if (track.spotifyTrackId) {
        audioRef.current?.pause();
        setPlayingId(null);
        setEmbeddedPreviewTrackId((prev) =>
          prev === track.spotifyTrackId ? null : track.spotifyTrackId || null
        );
      }
      return;
    }

    setEmbeddedPreviewTrackId(null);
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingId(null);
    }
    const audio = audioRef.current;

    if (playingId === track.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }

    audio.pause();
    audio.src = track.previewUrl;
    audio.currentTime = 0;
    setPlayingId(track.id);
    void audio.play().catch(() => {
      setPlayingId(null);
    });
  };

  const handleSendSongClick = async (track: SongTrack) => {
    setSendingSongId(track.id);
    try {
      audioRef.current?.pause();
      setPlayingId(null);
      setEmbeddedPreviewTrackId(null);
      await onSendSong(track, songNote);
      setSongNote('');
      onClose();
    } finally {
      setSendingSongId(null);
    }
  };

  const parsedIg = parseInstagramReelUrl(igLinkInput);

  const handleImportAndShareIg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIgError(null);
    const parsed = parseInstagramReelUrl(igLinkInput);
    if (!parsed) {
      setIgError('Paste a valid Instagram Reel link (e.g. https://www.instagram.com/reel/...)');
      return;
    }

    setImportingIg(true);
    try {
      const saved = await createReel({
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorHandle: profile.handle,
        authorPhoto: profile.photoUrl,
        caption: igCaption.trim() || `Instagram Reel shared in ${roomName}`,
        audioTitle: 'Instagram Reels Audio',
        mediaType: 'instagram',
        mediaUrl: parsed.embedUrl,
        instagramUrl: parsed.canonicalUrl,
        instagramCode: parsed.shortcode,
        sceneTheme: 'sunset',
        sceneEmoji: '📸',
        sceneHeadline: 'Instagram Reel',
        tags: ['instagram', 'reels'],
      });

      if (!saved) {
        setIgError('Could not save Instagram Reel right now. Please try again.');
        return;
      }

      await onShareReel(saved);
      setIgLinkInput('');
      setIgCaption('');
      onClose();
    } finally {
      setImportingIg(false);
    }
  };

  const handleShareExistingReel = async (reel: ReelItem) => {
    setSharingReelId(reel.id);
    try {
      await onShareReel(reel);
      onClose();
    } finally {
      setSharingReelId(null);
    }
  };

  const visibleTracks = songSource === 'spotify' ? spotifySongs : songs;
  const isTracksLoading = songSource === 'spotify' ? loadingSpotifySongs : loadingSongs;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.16 }}
          role="dialog"
          aria-modal="true"
          aria-label="Share Spotify, Movie Songs, and Instagram Reels"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 440, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[90dvh] rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] sm:pb-0"
          >
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold text-stone-900 dark:text-white truncate">
                  {tab === 'songs' ? 'Spotify & Movie Songs' : 'Instagram & Group Reels'}
                </h2>
                <p className="text-xs text-stone-500 dark:text-slate-400 truncate">
                  Share directly into {roomName}
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

            {/* Segmented Mode Tabs */}
            <div className="px-4 sm:px-5 pt-3 pb-2 shrink-0">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setTab('songs')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    tab === 'songs'
                      ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  <Music2 className="w-3.5 h-3.5" />
                  <span>Spotify &amp; Songs</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioRef.current?.pause();
                    setPlayingId(null);
                    setEmbeddedPreviewTrackId(null);
                    setTab('reels');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    tab === 'reels'
                      ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Reels &amp; Instagram</span>
                </button>
              </div>
            </div>

            {tab === 'songs' ? (
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Song Source Switcher: Spotify App vs Movie & Famous Catalog */}
                <div className="px-4 sm:px-5 pb-2.5 space-y-2.5 shrink-0 border-b border-stone-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        audioRef.current?.pause();
                        setPlayingId(null);
                        setSongSource('spotify');
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                        songSource === 'spotify'
                          ? 'bg-[#1DB954] border-[#1DB954] text-stone-950'
                          : 'bg-stone-50 dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <SpotifyGlyph className="w-4 h-4" />
                      <span>Spotify App</span>
                      {spotifyStatus?.connected && (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        audioRef.current?.pause();
                        setPlayingId(null);
                        setEmbeddedPreviewTrackId(null);
                        setSongSource('catalog');
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                        songSource === 'catalog'
                          ? 'bg-emerald-700 border-emerald-700 text-white'
                          : 'bg-stone-50 dark:bg-slate-900 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Disc3 className="w-3.5 h-3.5" />
                      <span>Movies &amp; Hits</span>
                    </button>
                  </div>

                  {songSource === 'spotify' ? (
                    <div className="space-y-2.5">
                      {/* Spotify Account Permission Card */}
                      <div className="p-3 rounded-xl bg-[#0F1B14] border border-[#1DB954]/35 text-white space-y-2">
                        {loadingSpotifyStatus && !spotifyStatus ? (
                          <div className="flex items-center gap-2 text-xs text-emerald-200">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Checking Spotify link…</span>
                          </div>
                        ) : spotifyStatus?.connected && spotifyStatus.user ? (
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {spotifyStatus.user.avatarUrl ? (
                                <img
                                  src={spotifyStatus.user.avatarUrl}
                                  alt={spotifyStatus.user.displayName}
                                  referrerPolicy="no-referrer"
                                  className="w-9 h-9 rounded-full object-cover border border-[#1DB954]/60 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-[#1DB954] text-stone-950 flex items-center justify-center shrink-0">
                                  <SpotifyGlyph className="w-5 h-5" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate flex items-center gap-1.5">
                                  <span>{spotifyStatus.user.displayName}</span>
                                  <ShieldCheck className="w-3.5 h-3.5 text-[#1ED760] shrink-0" />
                                </p>
                                <p className="text-[11px] text-emerald-200/80 truncate">
                                  Spotify linked with library &amp; song permissions
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleDisconnectSpotify()}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-white shrink-0 cursor-pointer"
                            >
                              <LogOut className="w-3 h-3" />
                              <span>Unlink</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="min-w-0">
                                <p className="text-xs font-bold flex items-center gap-1.5">
                                  <SpotifyGlyph className="w-4 h-4 text-[#1ED760]" />
                                  <span>Link your Spotify Account</span>
                                </p>
                                <p className="text-[11px] text-emerald-100/80 mt-0.5">
                                  Grant Spotify OAuth permission to browse your Liked Songs, Top Tracks &amp; full Spotify search.
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={connectingSpotify}
                                onClick={() => void handleConnectSpotify()}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1DB954] hover:bg-[#1ED760] disabled:opacity-60 text-stone-950 text-xs font-bold shrink-0 cursor-pointer"
                              >
                                {connectingSpotify ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <SpotifyGlyph className="w-3.5 h-3.5" />
                                )}
                                <span>{connectingSpotify ? 'Waiting…' : 'Connect'}</span>
                              </button>
                            </div>

                            {spotifySetupHint && (
                              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 space-y-1.5 text-[11px] text-slate-200">
                                <p className="font-semibold text-[#1ED760]">
                                  Spotify Developer App Setup Required
                                </p>
                                <p className="text-slate-300">
                                  Add <code className="text-white">SPOTIFY_CLIENT_ID</code> &amp;{' '}
                                  <code className="text-white">SPOTIFY_CLIENT_SECRET</code> in AI Studio Secrets, and register this Redirect URI in your Spotify Dashboard:
                                </p>
                                <div className="flex items-center gap-1.5">
                                  <code className="flex-1 px-2 py-1 rounded bg-black/60 text-[10px] text-emerald-300 truncate">
                                    {spotifyStatus?.redirectUri || `${window.location.origin}/auth/spotify/callback`}
                                  </code>
                                  <button
                                    type="button"
                                    onClick={() => void handleCopyRedirectUri()}
                                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                                  >
                                    {copiedRedirect ? <Check className="w-3 h-3 text-[#1ED760]" /> : <Copy className="w-3 h-3" />}
                                    <span>{copiedRedirect ? 'Copied' : 'Copy'}</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {spotifyError && !spotifySetupHint && (
                          <p className="text-[11px] text-amber-300">{spotifyError}</p>
                        )}
                      </div>

                      {/* Search & Section Filters when Connected */}
                      {spotifyStatus?.connected && (
                        <>
                          <div className="relative">
                            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={spotifyQuery}
                              onChange={(e) => setSpotifyQuery(e.target.value)}
                              placeholder="Search any song, movie, or artist on Spotify..."
                              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#1DB954]"
                            />
                            {spotifyQuery && (
                              <button
                                type="button"
                                onClick={() => setSpotifyQuery('')}
                                aria-label="Clear Spotify search"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                            {SPOTIFY_SECTIONS.map((sec) => (
                              <button
                                key={sec.id}
                                type="button"
                                onClick={() => {
                                  setSpotifySection(sec.id);
                                  if (sec.id !== 'search') setSpotifyQuery('');
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                                  spotifySection === sec.id && !spotifyQuery.trim()
                                    ? 'bg-[#1DB954] text-stone-950'
                                    : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-300 hover:bg-stone-200 dark:hover:bg-slate-700'
                                }`}
                              >
                                {sec.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Direct Spotify Track Link Share (works anytime) */}
                      <form onSubmit={handleSendSpotifyLink} className="flex items-center gap-1.5">
                        <div className="relative flex-1 min-w-0">
                          <Link2 className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={spotifyLinkInput}
                            onChange={(e) => {
                              setSpotifyLinkInput(e.target.value);
                              setSpotifyError(null);
                            }}
                            placeholder="Or paste Spotify track link (open.spotify.com/track/...)"
                            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg text-xs bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-[#1DB954]"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={!parsedSpotifyLink || resolvingSpotifyLink}
                          className="px-3 py-1.5 rounded-lg bg-[#1DB954] hover:bg-[#1ED760] disabled:opacity-45 text-stone-950 text-xs font-bold shrink-0 inline-flex items-center gap-1 cursor-pointer"
                        >
                          {resolvingSpotifyLink ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          <span>Share Link</span>
                        </button>
                      </form>
                    </div>
                  ) : (
                    /* Catalog Search & Category Filters */
                    <div className="space-y-2.5">
                      <div className="relative">
                        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search Bollywood, Hollywood movies or famous songs..."
                          className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        {query && (
                          <button
                            type="button"
                            onClick={() => setQuery('')}
                            aria-label="Clear search"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                        {SONG_CATEGORIES.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setCategory(cat.id);
                              setQuery('');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                              category === cat.id && !query.trim()
                                ? 'bg-emerald-700 text-white'
                                : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-300 hover:bg-stone-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <input
                    type="text"
                    value={songNote}
                    onChange={(e) => setSongNote(e.target.value)}
                    maxLength={140}
                    placeholder="Optional dedication or message with this song..."
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                {/* Song List */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-2">
                  {songSource === 'spotify' && !spotifyStatus?.connected ? (
                    <div className="py-8 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#1DB954]/15 text-[#1DB954] flex items-center justify-center mx-auto">
                        <SpotifyGlyph className="w-7 h-7" />
                      </div>
                      <div className="space-y-1 max-w-xs mx-auto">
                        <p className="text-xs font-bold text-stone-900 dark:text-white">
                          Connect Spotify for your personal library
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-slate-400">
                          Sign in with Spotify permission above to pick from your Liked Songs, Top Tracks &amp; Spotify search — or switch to Movies &amp; Hits anytime.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleConnectSpotify()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1DB954] hover:bg-[#1ED760] text-stone-950 text-xs font-bold cursor-pointer"
                        >
                          <SpotifyGlyph className="w-3.5 h-3.5" />
                          <span>Connect Spotify</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSongSource('catalog')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-800 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                        >
                          <Disc3 className="w-3.5 h-3.5" />
                          <span>Browse Movies &amp; Hits</span>
                        </button>
                      </div>
                    </div>
                  ) : isTracksLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-stone-500 dark:text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                      <p className="text-xs">
                        {songSource === 'spotify' ? 'Loading your Spotify songs…' : 'Loading movie & famous songs…'}
                      </p>
                    </div>
                  ) : visibleTracks.length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                      <Music2 className="w-8 h-8 mx-auto text-stone-400" />
                      <p className="text-xs text-stone-500 dark:text-slate-400">
                        {songSource === 'spotify'
                          ? 'No Spotify tracks found here yet. Try searching any song or movie title above.'
                          : 'No songs found for that search. Try a movie name like "RRR", "Titanic", or "Arijit Singh".'}
                      </p>
                    </div>
                  ) : (
                    visibleTracks.map((track) => {
                      const isPlaying = playingId === track.id;
                      const isEmbedOpen =
                        Boolean(track.spotifyTrackId) && embeddedPreviewTrackId === track.spotifyTrackId;
                      const isSending = sendingSongId === track.id;
                      const isSpotifyTrack = track.source === 'spotify' || Boolean(track.spotifyTrackId);
                      return (
                        <div
                          key={track.id}
                          className={`rounded-xl border transition-colors overflow-hidden ${
                            isPlaying || isEmbedOpen
                              ? 'border-[#1DB954]/70 bg-emerald-50/70 dark:bg-emerald-950/25'
                              : 'border-stone-200/80 dark:border-slate-800 bg-stone-50/60 dark:bg-[#1C2128]/70'
                          }`}
                        >
                          <div className="flex items-center gap-3 p-2.5">
                            {/* Album Cover + Play/Preview Button */}
                            <button
                              type="button"
                              onClick={() => handleTogglePreview(track)}
                              aria-label={isPlaying || isEmbedOpen ? `Pause ${track.title}` : `Preview ${track.title}`}
                              className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-stone-900 group cursor-pointer"
                            >
                              {track.artworkUrl ? (
                                <img
                                  src={track.artworkUrl}
                                  alt={track.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-emerald-800 text-white">
                                  <Disc3 className="w-5 h-5" />
                                </div>
                              )}
                              <span className="absolute inset-0 bg-black/45 flex items-center justify-center text-white">
                                {isPlaying || isEmbedOpen ? (
                                  <Pause className="w-4 h-4 fill-white" />
                                ) : (
                                  <Play className="w-4 h-4 fill-white ml-0.5" />
                                )}
                              </span>
                            </button>

                            {/* Track Details */}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                                {track.title}
                              </p>
                              <p className="text-[11px] text-stone-600 dark:text-slate-300 truncate">
                                {track.artist}
                              </p>
                              <p className="text-[10px] text-stone-500 dark:text-slate-400 truncate">
                                {isSpotifyTrack ? `Spotify · ${track.movieOrAlbum}` : `${track.movieOrAlbum} · 30s preview`}
                              </p>
                            </div>

                            {/* Send to Chat Button */}
                            <button
                              type="button"
                              disabled={isSending}
                              onClick={() => void handleSendSongClick(track)}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl disabled:opacity-50 text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                                isSpotifyTrack
                                  ? 'bg-[#1DB954] hover:bg-[#1ED760] text-stone-950'
                                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                              }`}
                            >
                              {isSending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              <span>Send</span>
                            </button>
                          </div>

                          {/* Inline Spotify Embed Preview when a Spotify track lacks an MP3 preview */}
                          {isEmbedOpen && track.spotifyTrackId && (
                            <div className="px-2.5 pb-2.5">
                              <iframe
                                src={`https://open.spotify.com/embed/track/${track.spotifyTrackId}?utm_source=generator&theme=0`}
                                title={`Preview ${track.title} on Spotify`}
                                className="w-full h-[80px] rounded-lg border-0 bg-black"
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                loading="lazy"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* REELS & INSTAGRAM TAB */
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-4">
                {/* Create New Reel directly for this Group */}
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/25 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Make &amp; Share a Reel in {roomName}</span>
                    </p>
                    <p className="text-[11px] text-emerald-900/75 dark:text-emerald-200/75 mt-0.5">
                      Record or upload a video, add movie songs, and drop it straight into this group.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCreateReelForRoom();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Make Reel</span>
                  </button>
                </div>

                {/* Join / Import Instagram Reel Link straight to Group */}
                <form
                  onSubmit={handleImportAndShareIg}
                  className="p-3.5 rounded-xl border border-stone-200 dark:border-slate-800 bg-stone-50/70 dark:bg-[#1C2128]/70 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                      <Instagram className="w-4 h-4 text-rose-500" />
                      <span>Share an Instagram Reel</span>
                    </p>
                    <a
                      href="https://www.instagram.com/reels/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      <span>Open Instagram</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <input
                    type="url"
                    value={igLinkInput}
                    onChange={(e) => {
                      setIgLinkInput(e.target.value);
                      setIgError(null);
                    }}
                    placeholder="Paste Instagram Reel URL (https://www.instagram.com/reel/...)"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />

                  <input
                    type="text"
                    value={igCaption}
                    onChange={(e) => setIgCaption(e.target.value)}
                    maxLength={140}
                    placeholder="Add a caption for the group (optional)…"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-stone-900 dark:text-white placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />

                  {igError && <p className="text-[11px] text-red-600 dark:text-red-400">{igError}</p>}

                  <button
                    type="submit"
                    disabled={importingIg || !parsedIg}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-45 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {importingIg ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Instagram className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {parsedIg
                        ? `Import & Share Instagram Reel to ${roomName}`
                        : 'Paste Instagram Reel Link to Share'}
                    </span>
                  </button>
                </form>

                {/* Existing Reels Ready to Share into Group */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-stone-500 dark:text-slate-400">
                    Share a Reel from Feed ({reels.length})
                  </p>
                  {loadingReels ? (
                    <div className="py-8 flex items-center justify-center text-stone-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reels.slice(0, 12).map((reel) => (
                        <div
                          key={reel.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-stone-200/80 dark:border-slate-800 bg-white dark:bg-[#1C2128]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-11 h-14 rounded-lg bg-gradient-to-br from-emerald-800 to-slate-900 text-white flex items-center justify-center text-lg shrink-0 overflow-hidden">
                              {reel.mediaType === 'image' && reel.mediaUrl ? (
                                <img
                                  src={reel.mediaUrl}
                                  alt={reel.caption}
                                  className="w-full h-full object-cover"
                                />
                              ) : reel.mediaType === 'instagram' ? (
                                <Instagram className="w-5 h-5 text-rose-400" />
                              ) : (
                                <span>{reel.sceneEmoji || '🎬'}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                                {reel.mediaType === 'instagram'
                                  ? 'Instagram Reel'
                                  : reel.sceneHeadline || reel.caption}
                              </p>
                              <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                                @{reel.authorHandle} · {reel.audioTitle}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={sharingReelId === reel.id}
                            onClick={() => void handleShareExistingReel(reel)}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold shrink-0 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Share</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
