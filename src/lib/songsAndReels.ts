import type { ReelItem } from './backendApi';

export type SongCategory = 'bollywood' | 'hollywood' | 'famous' | 'punjabi' | 'all';

export interface SongTrack {
  id: string;
  title: string;
  artist: string;
  movieOrAlbum: string;
  category: Exclude<SongCategory, 'all'> | 'spotify';
  previewUrl: string;
  artworkUrl: string;
  durationSec: number;
  externalUrl?: string;
  source?: 'itunes' | 'spotify';
  spotifyTrackId?: string;
  spotifyUrl?: string;
}

export const SONG_MESSAGE_MIME = 'audio/x-quadline-song';
export const REEL_MESSAGE_MIME = 'application/x-quadline-reel';

export const SONG_CATEGORIES: { id: SongCategory; label: string }[] = [
  { id: 'bollywood', label: 'Bollywood Movies' },
  { id: 'hollywood', label: 'Hollywood Movies' },
  { id: 'famous', label: 'Famous Hits' },
  { id: 'punjabi', label: 'Punjabi & Party' },
  { id: 'all', label: 'All Songs' },
];

export interface ParsedSpotifyTrack {
  trackId: string;
  canonicalUrl: string;
  embedUrl: string;
}

export function parseSpotifyTrackUrl(raw: string): ParsedSpotifyTrack | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const uriMatch = trimmed.match(/^spotify:track:([A-Za-z0-9]{22})$/i);
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{10,32})/i
  );
  const trackId = uriMatch?.[1] || urlMatch?.[1];
  if (!trackId) return null;

  return {
    trackId,
    canonicalUrl: `https://open.spotify.com/track/${trackId}`,
    embedUrl: `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`,
  };
}

export interface ParsedInstagramReel {
  shortcode: string;
  canonicalUrl: string;
  embedUrl: string;
}

export function parseInstagramReelUrl(raw: string): ParsedInstagramReel | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Accept bare shortcode or full instagram.com/reel/CODE, /reels/CODE, /p/CODE, /tv/CODE
  const match = trimmed.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]{5,32})/i
  );
  if (!match) return null;

  const shortcode = match[1];
  return {
    shortcode,
    canonicalUrl: `https://www.instagram.com/reel/${shortcode}/`,
    embedUrl: `https://www.instagram.com/reel/${shortcode}/embed/`,
  };
}

export interface SongMessageMeta {
  title: string;
  artist: string;
  movieOrAlbum: string;
  category: string;
  previewUrl: string;
  artworkUrl: string;
  durationSec: number;
  note?: string;
  source?: 'itunes' | 'spotify';
  spotifyTrackId?: string;
  spotifyUrl?: string;
}

const SONG_PREFIX = '__QL_SONG__:';
const REEL_PREFIX = '__QL_REEL__:';

export function encodeSongMessageText(song: SongTrack, note?: string): string {
  const payload: SongMessageMeta = {
    title: song.title.slice(0, 80),
    artist: song.artist.slice(0, 80),
    movieOrAlbum: song.movieOrAlbum.slice(0, 80),
    category: song.category,
    previewUrl: song.previewUrl,
    artworkUrl: song.artworkUrl,
    durationSec: song.durationSec || 30,
    note: note?.trim().slice(0, 180) || undefined,
    source: song.source,
    spotifyTrackId: song.spotifyTrackId,
    spotifyUrl: song.spotifyUrl,
  };
  return `${SONG_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeSongMessage(
  text: string,
  mediaUrl: string,
  mediaName: string,
  thumbnailUrl?: string
): SongMessageMeta | null {
  if (text.startsWith(SONG_PREFIX)) {
    try {
      const parsed = JSON.parse(text.slice(SONG_PREFIX.length)) as Partial<SongMessageMeta>;
      if (parsed && typeof parsed.title === 'string') {
        return {
          title: parsed.title,
          artist: parsed.artist || 'Featured Artist',
          movieOrAlbum: parsed.movieOrAlbum || 'Movie Soundtrack',
          category: parsed.category || 'famous',
          previewUrl: parsed.previewUrl || (mediaUrl.startsWith('https://open.spotify.com') ? '' : mediaUrl),
          artworkUrl: parsed.artworkUrl || thumbnailUrl || '',
          durationSec: typeof parsed.durationSec === 'number' ? parsed.durationSec : 30,
          note: parsed.note,
          source: parsed.source,
          spotifyTrackId: parsed.spotifyTrackId,
          spotifyUrl: parsed.spotifyUrl,
        };
      }
    } catch {
      // Fallback below
    }
  }
  if (!mediaUrl && !mediaName) return null;
  const spotifyParsed = parseSpotifyTrackUrl(mediaUrl);
  const parts = mediaName.split(' — ');
  return {
    title: parts[0] || mediaName || 'Shared Song',
    artist: parts[1] || 'Featured Artist',
    movieOrAlbum: spotifyParsed ? 'Spotify' : 'Music Track',
    category: spotifyParsed ? 'spotify' : 'famous',
    previewUrl: spotifyParsed ? '' : mediaUrl,
    artworkUrl: thumbnailUrl || '',
    durationSec: 30,
    source: spotifyParsed ? 'spotify' : 'itunes',
    spotifyTrackId: spotifyParsed?.trackId,
    spotifyUrl: spotifyParsed?.canonicalUrl,
  };
}

export interface ReelMessageMeta {
  reelId: string;
  authorName: string;
  authorHandle: string;
  caption: string;
  mediaType: 'video' | 'image' | 'scene' | 'instagram';
  mediaUrl: string;
  instagramUrl?: string;
  instagramCode?: string;
  audioTitle: string;
  audioArtist?: string;
  sceneTheme?: string;
  sceneEmoji?: string;
  sceneHeadline?: string;
}

export function encodeReelMessageText(reel: ReelItem): string {
  const payload: ReelMessageMeta = {
    reelId: reel.id,
    authorName: reel.authorName.slice(0, 50),
    authorHandle: reel.authorHandle.slice(0, 32),
    caption: reel.caption.slice(0, 180),
    mediaType: reel.mediaType,
    mediaUrl: reel.mediaUrl.slice(0, 300),
    instagramUrl: reel.instagramUrl,
    instagramCode: reel.instagramCode,
    audioTitle: reel.audioTitle.slice(0, 80),
    audioArtist: reel.audioArtist?.slice(0, 60),
    sceneTheme: reel.sceneTheme,
    sceneEmoji: reel.sceneEmoji,
    sceneHeadline: reel.sceneHeadline?.slice(0, 60),
  };
  return `${REEL_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeReelMessage(text: string): ReelMessageMeta | null {
  if (!text.startsWith(REEL_PREFIX)) return null;
  try {
    const parsed = JSON.parse(text.slice(REEL_PREFIX.length)) as Partial<ReelMessageMeta>;
    if (!parsed || typeof parsed.reelId !== 'string') return null;
    return {
      reelId: parsed.reelId,
      authorName: parsed.authorName || 'Creator',
      authorHandle: parsed.authorHandle || 'creator',
      caption: parsed.caption || '',
      mediaType: parsed.mediaType || 'scene',
      mediaUrl: parsed.mediaUrl || '',
      instagramUrl: parsed.instagramUrl,
      instagramCode: parsed.instagramCode,
      audioTitle: parsed.audioTitle || 'Original Audio',
      audioArtist: parsed.audioArtist,
      sceneTheme: parsed.sceneTheme || 'aurora',
      sceneEmoji: parsed.sceneEmoji || '🎬',
      sceneHeadline: parsed.sceneHeadline || 'Shared Reel',
    };
  } catch {
    return null;
  }
}

export function getCleanLastMessagePreview(
  text: string,
  mediaMime?: string,
  mediaName?: string
): string {
  if (mediaMime === SONG_MESSAGE_MIME || text.startsWith(SONG_PREFIX)) {
    const song = decodeSongMessage(text, '', mediaName || '');
    return song ? `🎵 ${song.title} — ${song.artist}` : '🎵 Shared a song';
  }
  if (mediaMime === REEL_MESSAGE_MIME || text.startsWith(REEL_PREFIX)) {
    const reel = decodeReelMessage(text);
    if (reel?.mediaType === 'instagram') {
      return `📸 Instagram Reel · ${reel.caption || `@${reel.authorHandle}`}`;
    }
    return reel ? `🎬 Reel · ${reel.sceneHeadline || reel.caption}` : '🎬 Shared a Reel';
  }
  return text;
}
