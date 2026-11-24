export interface StickerAsset {
  id: string;
  label: string;
  category: 'reactions' | 'campus' | 'vibes' | 'fun';
  keywords: string[];
  dataUrl: string;
}

export interface AnimatedGifAsset {
  id: string;
  label: string;
  category: 'celebrate' | 'funny' | 'love' | 'campus';
  keywords: string[];
  dataUrl: string;
}

function encodeSvg(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

function makeStickerSvg(opts: {
  bg1: string;
  bg2: string;
  emoji: string;
  caption: string;
  accent: string;
  rotate?: number;
}): string {
  const rot = opts.rotate ?? 0;
  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="220" height="220">
      <defs>
        <linearGradient id="stbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${opts.bg1}"/>
          <stop offset="100%" stop-color="${opts.bg2}"/>
        </linearGradient>
      </defs>
      <g transform="rotate(${rot} 110 110)">
        <rect x="16" y="16" width="188" height="188" rx="46" fill="#FFFFFF" stroke="${opts.accent}" stroke-width="5"/>
        <rect x="24" y="24" width="172" height="172" rx="38" fill="url(#stbg)"/>
        <circle cx="170" cy="48" r="10" fill="#FFFFFF" opacity="0.24"/>
        <circle cx="48" cy="166" r="7" fill="#FFFFFF" opacity="0.2"/>
        <text x="110" y="122" text-anchor="middle" font-size="82" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${opts.emoji}</text>
        <rect x="34" y="146" width="152" height="34" rx="17" fill="#0F172A" opacity="0.82"/>
        <text x="110" y="169" text-anchor="middle" fill="#FFFFFF" font-size="17" font-weight="800" font-family="system-ui, -apple-system, sans-serif">${opts.caption}</text>
      </g>
    </svg>
  `);
}

function makeAnimatedGifSvg(opts: {
  bg1: string;
  bg2: string;
  emoji: string;
  subEmoji: string;
  title: string;
  subtitle: string;
  motionType: 'bounce' | 'pulse' | 'spin' | 'wave';
}): string {
  const animMarkup =
    opts.motionType === 'bounce'
      ? `<animateTransform attributeName="transform" type="translate" values="0,8; 0,-12; 0,8" dur="0.9s" repeatCount="indefinite"/>`
      : opts.motionType === 'spin'
        ? `<animateTransform attributeName="transform" type="rotate" values="-12 160 95; 12 160 95; -12 160 95" dur="1.1s" repeatCount="indefinite"/>`
        : opts.motionType === 'wave'
          ? `<animateTransform attributeName="transform" type="translate" values="-10,0; 10,-6; -10,0" dur="1.2s" repeatCount="indefinite"/>`
          : `<animateTransform attributeName="transform" type="scale" additive="sum" values="1; 1.16; 1" dur="0.85s" repeatCount="indefinite"/>`;

  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200">
      <defs>
        <linearGradient id="gbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${opts.bg1}"/>
          <stop offset="100%" stop-color="${opts.bg2}"/>
        </linearGradient>
      </defs>
      <rect width="320" height="200" rx="24" fill="url(#gbg)"/>
      <circle cx="52" cy="44" r="18" fill="#FFFFFF" opacity="0.16">
        <animate attributeName="r" values="14;24;14" dur="2.1s" repeatCount="indefinite"/>
      </circle>
      <circle cx="272" cy="154" r="24" fill="#FFFFFF" opacity="0.14">
        <animate attributeName="r" values="20;30;20" dur="1.8s" repeatCount="indefinite"/>
      </circle>
      <text x="58" y="64" font-size="24" opacity="0.9" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">
        ${opts.subEmoji}
        <animate attributeName="opacity" values="0.35;1;0.35" dur="1.3s" repeatCount="indefinite"/>
      </text>
      <text x="242" y="64" font-size="24" opacity="0.9" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">
        ${opts.subEmoji}
        <animate attributeName="opacity" values="1;0.35;1" dur="1.3s" repeatCount="indefinite"/>
      </text>
      <g>
        ${animMarkup}
        <text x="160" y="110" text-anchor="middle" font-size="68" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${opts.emoji}</text>
      </g>
      <rect x="20" y="138" width="280" height="44" rx="14" fill="#090D16" opacity="0.72"/>
      <text x="160" y="159" text-anchor="middle" fill="#FFFFFF" font-size="18" font-weight="800" font-family="system-ui, -apple-system, sans-serif">${opts.title}</text>
      <text x="160" y="175" text-anchor="middle" fill="#CBD5E1" font-size="11" font-weight="600" font-family="system-ui, -apple-system, sans-serif">${opts.subtitle}</text>
      <rect x="14" y="12" width="38" height="20" rx="6" fill="#090D16" opacity="0.75"/>
      <text x="33" y="26" text-anchor="middle" fill="#FFFFFF" font-size="10" font-weight="800" font-family="system-ui, -apple-system, sans-serif">GIF</text>
    </svg>
  `);
}

export const STICKERS: StickerAsset[] = [
  {
    id: 'stk-fire',
    label: 'Lit!',
    category: 'reactions',
    keywords: ['fire', 'lit', 'awesome', 'wow'],
    dataUrl: makeStickerSvg({ bg1: '#F97316', bg2: '#DC2626', emoji: '🔥', caption: 'SO LIT!', accent: '#FDBA74', rotate: -3 }),
  },
  {
    id: 'stk-lol',
    label: 'LMAO',
    category: 'reactions',
    keywords: ['lol', 'funny', 'laugh', 'haha'],
    dataUrl: makeStickerSvg({ bg1: '#FACC15', bg2: '#EA580C', emoji: '😂', caption: 'LMAO!', accent: '#FEF08A', rotate: 3 }),
  },
  {
    id: 'stk-love',
    label: 'Love It',
    category: 'reactions',
    keywords: ['love', 'heart', 'cute', 'thanks'],
    dataUrl: makeStickerSvg({ bg1: '#EC4899', bg2: '#BE123C', emoji: '😍', caption: 'LOVE IT!', accent: '#FBCFE8', rotate: -2 }),
  },
  {
    id: 'stk-100',
    label: '100% Facts',
    category: 'reactions',
    keywords: ['100', 'facts', 'agree', 'true'],
    dataUrl: makeStickerSvg({ bg1: '#10B981', bg2: '#047857', emoji: '💯', caption: 'PURE FACTS', accent: '#6EE7B7', rotate: 2 }),
  },
  {
    id: 'stk-omw',
    label: 'On My Way',
    category: 'campus',
    keywords: ['omw', 'coming', 'fast', 'run'],
    dataUrl: makeStickerSvg({ bg1: '#0EA5E9', bg2: '#2563EB', emoji: '🏃', caption: 'ON MY WAY', accent: '#BAE6FD', rotate: -2 }),
  },
  {
    id: 'stk-coffee',
    label: 'Chai / Coffee?',
    category: 'campus',
    keywords: ['coffee', 'chai', 'break', 'cafe'],
    dataUrl: makeStickerSvg({ bg1: '#92400E', bg2: '#451A03', emoji: '☕', caption: 'CHAI BREAK?', accent: '#FDE68A', rotate: 3 }),
  },
  {
    id: 'stk-study',
    label: 'Study Grind',
    category: 'campus',
    keywords: ['study', 'exam', 'notes', 'library'],
    dataUrl: makeStickerSvg({ bg1: '#4F46E5', bg2: '#312E81', emoji: '📚', caption: 'STUDY MODE', accent: '#C7D2FE', rotate: -2 }),
  },
  {
    id: 'stk-call',
    label: 'Hop on Call',
    category: 'campus',
    keywords: ['call', 'voice', 'video', 'talk'],
    dataUrl: makeStickerSvg({ bg1: '#059669', bg2: '#0F766E', emoji: '📞', caption: 'HOP ON CALL', accent: '#A7F3D0', rotate: 2 }),
  },
  {
    id: 'stk-vibe',
    label: 'Good Vibes',
    category: 'vibes',
    keywords: ['vibe', 'music', 'chill', 'cool'],
    dataUrl: makeStickerSvg({ bg1: '#7C3AED', bg2: '#4C1D95', emoji: '🎧', caption: 'GOOD VIBES', accent: '#DDD6FE', rotate: -3 }),
  },
  {
    id: 'stk-cool',
    label: 'Too Cool',
    category: 'vibes',
    keywords: ['cool', 'swag', 'boss', 'sunglasses'],
    dataUrl: makeStickerSvg({ bg1: '#0284C7', bg2: '#0F172A', emoji: '😎', caption: 'NO STRESS', accent: '#7DD3FC', rotate: 2 }),
  },
  {
    id: 'stk-party',
    label: 'Party Time',
    category: 'vibes',
    keywords: ['party', 'celebrate', 'birthday', 'yay'],
    dataUrl: makeStickerSvg({ bg1: '#DB2777', bg2: '#7E22CE', emoji: '🥳', caption: 'PARTY TIME', accent: '#F5D0FE', rotate: -2 }),
  },
  {
    id: 'stk-gm',
    label: 'Good Morning',
    category: 'vibes',
    keywords: ['morning', 'hi', 'hello', 'sun'],
    dataUrl: makeStickerSvg({ bg1: '#F59E0B', bg2: '#D97706', emoji: '☀️', caption: 'MORNING!', accent: '#FEF3C7', rotate: 2 }),
  },
  {
    id: 'stk-gg',
    label: 'GG Well Played',
    category: 'fun',
    keywords: ['gg', 'game', 'win', 'trophy'],
    dataUrl: makeStickerSvg({ bg1: '#16A34A', bg2: '#15803D', emoji: '🏆', caption: 'GG EASY!', accent: '#BBF7D0', rotate: -2 }),
  },
  {
    id: 'stk-mindblown',
    label: 'Mind Blown',
    category: 'fun',
    keywords: ['mind', 'shock', 'woah', 'crazy'],
    dataUrl: makeStickerSvg({ bg1: '#E11D48', bg2: '#9333EA', emoji: '🤯', caption: 'MIND BLOWN', accent: '#FDA4AF', rotate: 3 }),
  },
  {
    id: 'stk-yrr',
    label: 'Arre Yrr!',
    category: 'fun',
    keywords: ['yrr', 'yaar', 'bro', 'please', 'drama'],
    dataUrl: makeStickerSvg({ bg1: '#0D9488', bg2: '#0369A1', emoji: '🙌', caption: 'ARRE YRR!', accent: '#99F6E4', rotate: -3 }),
  },
  {
    id: 'stk-rocket',
    label: 'Lets Go!',
    category: 'fun',
    keywords: ['go', 'rocket', 'launch', 'hype'],
    dataUrl: makeStickerSvg({ bg1: '#2563EB', bg2: '#7C3AED', emoji: '🚀', caption: 'LETS GO!!', accent: '#BFDBFE', rotate: 2 }),
  },
];

export const ANIMATED_GIFS: AnimatedGifAsset[] = [
  {
    id: 'gif-celebrate',
    label: 'Big Celebration',
    category: 'celebrate',
    keywords: ['party', 'win', 'congrats', 'yay', 'celebrate'],
    dataUrl: makeAnimatedGifSvg({
      bg1: '#7C3AED',
      bg2: '#EC4899',
      emoji: '🎉',
      subEmoji: '✨',
      title: 'LET’S CELEBRATE!',
      subtitle: 'Big W for the squad',
      motionType: 'bounce',
    }),
  },
  {
    id: 'gif-lol',
    label: 'Cant Stop Laughing',
    category: 'funny',
    keywords: ['lol', 'funny', 'haha', 'rofl', 'meme'],
    dataUrl: makeAnimatedGifSvg({
      bg1: '#F59E0B',
      bg2: '#EA580C',
      emoji: '🤣',
      subEmoji: '💥',
      title: 'HAHAHA DEAD!',
      subtitle: 'Too funny yrr',
      motionType: 'spin',
    }),
  },
  {
    id: 'gif-fire',
    label: 'Straight Fire',
    category: 'celebrate',
    keywords: ['fire', 'lit', 'hot', 'cool'],
    dataUrl: makeAnimatedGifSvg({
      bg1: '#EA580C',
      bg2: '#B91C1C',
      emoji: '🔥',
      subEmoji: '⚡',
      title: 'STRAIGHT FIRE',
      subtitle: 'Next-level energy',
      motionType: 'bounce',
    }),
  },
  {
    id: 'gif-love',
    label: 'Sending Love',
    category: 'love',
    keywords: ['love', 'heart', 'hug', 'bestie'],
    dataUrl: makeAnimatedGifSvg({
      bg1: '#EC4899',
      bg2: '#9D174D',
      emoji: '💖',
      subEmoji: '💕',
      title: 'SENDING LOVE',
      subtitle: 'You are the best',
      motionType: 'wave',
    }),
  },
  {
    id: 'gif-omw',
    label: 'Running Late OMW',
    category: 'campus',
    keywords: ['omw', 'late', 'coming', 'fast'],
    dataUrl: makeAnimatedGifSvg({
      bg1: '#0284C7',
      bg2: '#1D4ED8',
      emoji: '⚡',
      subEmoji: '💨',
      title: '2 MINS AWAY!',
      subtitle: 'Actually on my way',
      motionType: 'wave',
    }),
  },
  {
    id: 'gif-applause',
    label: 'Standing Ovation',
    category: 'celebrate',
    keywords: ['clap', 'applause', 'bravo', 'nice'],
    dataUrl: makeAnimatedGifSvg({
      bg1: '#059669',
      bg2: '#0F766E',
      emoji: '👏',
      subEmoji: '🌟',
      title: 'WELL DONE!',
      subtitle: 'Respect +100',
      motionType: 'bounce',
    }),
  },
  {
    id: 'gif-mindblown',
    label: 'Mind Blown',
    category: 'funny',
    keywords: ['shock', 'wow', 'what', 'mind'],
    dataUrl: makeAnimatedGifSvg({
      bg1: '#4F46E5',
      bg2: '#9333EA',
      emoji: '🤯',
      subEmoji: '💫',
      title: 'WAIT WHAT?!',
      subtitle: 'Brain officially melted',
      motionType: 'spin',
    }),
  },
  {
    id: 'gif-coffee',
    label: 'Coffee Boost',
    category: 'campus',
    keywords: ['coffee', 'chai', 'tired', 'morning'],
    dataUrl: makeAnimatedGifSvg({
      bg1: '#78350F',
      bg2: '#92400E',
      emoji: '☕',
      subEmoji: '✨',
      title: 'CHAI / COFFEE NOW',
      subtitle: 'Battery at 5%',
      motionType: 'wave',
    }),
  },
  {
    id: 'gif-micdrop',
    label: 'Mic Drop',
    category: 'funny',
    keywords: ['mic', 'drop', 'boss', 'win'],
    dataUrl: makeAnimatedGifSvg({
      bg1: '#1E293B',
      bg2: '#0F172A',
      emoji: '🎤',
      subEmoji: '🔥',
      title: 'MIC DROP!',
      subtitle: 'Nothing left to say',
      motionType: 'bounce',
    }),
  },
  {
    id: 'gif-vibe',
    label: 'Music Vibe',
    category: 'love',
    keywords: ['music', 'dance', 'reel', 'vibe'],
    dataUrl: makeAnimatedGifSvg({
      bg1: '#0D9488',
      bg2: '#2563EB',
      emoji: '🕺',
      subEmoji: '🎵',
      title: 'MAIN CHARACTER',
      subtitle: 'Vibe check passed',
      motionType: 'spin',
    }),
  },
  {
    id: 'gif-study',
    label: 'All-Nighter',
    category: 'campus',
    keywords: ['study', 'code', 'exam', 'night'],
    dataUrl: makeAnimatedGifSvg({
      bg1: '#312E81',
      bg2: '#0F172A',
      emoji: '💻',
      subEmoji: '🌙',
      title: 'GRIND MODE ON',
      subtitle: 'Shipping before deadline',
      motionType: 'wave',
    }),
  },
  {
    id: 'gif-hug',
    label: 'Big Hug',
    category: 'love',
    keywords: ['hug', 'comfort', 'care', 'aww'],
    dataUrl: makeAnimatedGifSvg({
      bg1: '#F43F5E',
      bg2: '#FB7185',
      emoji: '🤗',
      subEmoji: '💛',
      title: 'VIRTUAL HUG',
      subtitle: 'Got your back always',
      motionType: 'bounce',
    }),
  },
];

export const COMPOSER_EMOJI_GROUPS: Array<{ label: string; emojis: string[] }> = [
  {
    label: 'Popular',
    emojis: ['😀', '😂', '🤣', '😍', '🥳', '😎', '🔥', '❤️', '🙌', '👍', '👏', '💯', '🎉', '🚀', '✨', '🥹', '🤝', '🫶'],
  },
  {
    label: 'Reactions',
    emojis: ['😮', '🤯', '🤔', '😅', '😭', '🙏', '💀', '👀', '🫡', '😤', '😴', '🤩', '🫶', '💪', '👌', '✌️', '🫰', '🤙'],
  },
  {
    label: 'Campus & Fun',
    emojis: ['📚', '💻', '☕', '🎧', '🎬', '📸', '🎮', '🏆', '🎵', '🍕', '🌟', '⚡', '📞', '🎥', '💡', '📍', '🗓️', '🔔'],
  },
];

export function isStickerMedia(mediaName?: string, mediaMime?: string): boolean {
  return Boolean(
    mediaName?.startsWith('sticker:') ||
      (mediaMime === 'image/svg+xml' && mediaName?.toLowerCase().includes('sticker'))
  );
}

export function isAnimatedGifMedia(mediaName?: string, mediaMime?: string): boolean {
  return Boolean(
    mediaName?.startsWith('gif:') ||
      mediaMime === 'image/gif' ||
      (mediaMime === 'image/svg+xml' && mediaName?.toLowerCase().includes('gif'))
  );
}

// =========================================================================
// IN-APP STICKER & ANIMATED GIF STUDIO BUILDERS
// =========================================================================

export type StickerShape = 'rounded' | 'circle' | 'badge';
export type GifMotionType = 'bounce' | 'pulse' | 'spin' | 'wave' | 'zoom' | 'glitch';
export type GifSpeed = 'fast' | 'normal' | 'chill';

export interface StudioGradientPreset {
  id: string;
  name: string;
  bg1: string;
  bg2: string;
  accent: string;
}

export const STUDIO_GRADIENTS: StudioGradientPreset[] = [
  { id: 'sunset', name: 'Sunset', bg1: '#F97316', bg2: '#DB2777', accent: '#FDE68A' },
  { id: 'emerald', name: 'Emerald', bg1: '#10B981', bg2: '#0F766E', accent: '#A7F3D0' },
  { id: 'bmw', name: 'M Cobalt', bg1: '#1D4ED8', bg2: '#0F172A', accent: '#93C5FD' },
  { id: 'violet', name: 'Neon', bg1: '#7C3AED', bg2: '#EC4899', accent: '#F5D0FE' },
  { id: 'gold', name: 'Solar', bg1: '#F59E0B', bg2: '#B91C1C', accent: '#FEF08A' },
  { id: 'ocean', name: 'Ocean', bg1: '#06B6D4', bg2: '#2563EB', accent: '#BAE6FD' },
  { id: 'rose', name: 'Blossom', bg1: '#FB7185', bg2: '#9D174D', accent: '#FECDD3' },
  { id: 'obsidian', name: 'Stealth', bg1: '#334155', bg2: '#090D16', accent: '#CBD5E1' },
];

export const STUDIO_EMOJIS: string[] = [
  '🔥', '😂', '😍', '🥳', '😎', '💯', '🚀', '⚡', '💖', '🫶',
  '🤯', '🤣', '🏆', '🎮', '🏎️', '🌧️', '☁️', '🌸', '🎧', '☕',
  '👏', '🙌', '💀', '👑', '✨', '💫', '🎉', '🫡', '🥹', '😤',
];

export function escapeSvgText(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface CustomStickerOptions {
  mode: 'emoji' | 'photo';
  emoji: string;
  photoDataUrl?: string;
  caption: string;
  bg1: string;
  bg2: string;
  borderColor: string;
  shape: StickerShape;
  rotate: number;
}

export function buildCustomStickerSvg(opts: CustomStickerOptions): string {
  const rot = Math.max(-18, Math.min(18, Math.round(opts.rotate || 0)));
  const cleanCaption = escapeSvgText(opts.caption.trim().slice(0, 22));
  const cleanEmoji = escapeSvgText((opts.emoji || '🔥').slice(0, 8));
  const hasPhoto = opts.mode === 'photo' && Boolean(opts.photoDataUrl);
  const clipId = 'stclip';

  let outerShape = '';
  let innerShape = '';
  let clipShape = '';

  if (opts.shape === 'circle') {
    outerShape = `<circle cx="110" cy="110" r="96" fill="#FFFFFF" stroke="${opts.borderColor}" stroke-width="5"/>`;
    innerShape = `<circle cx="110" cy="110" r="87" fill="url(#cstbg)"/>`;
    clipShape = `<circle cx="110" cy="110" r="87"/>`;
  } else if (opts.shape === 'badge') {
    const outerPts = '110,12 188,46 202,130 156,202 64,202 18,130 32,46';
    const innerPts = '110,22 180,52 192,128 150,192 70,192 28,128 40,52';
    outerShape = `<polygon points="${outerPts}" fill="#FFFFFF" stroke="${opts.borderColor}" stroke-width="5" stroke-linejoin="round"/>`;
    innerShape = `<polygon points="${innerPts}" fill="url(#cstbg)" stroke-linejoin="round"/>`;
    clipShape = `<polygon points="${innerPts}"/>`;
  } else {
    outerShape = `<rect x="14" y="14" width="192" height="192" rx="46" fill="#FFFFFF" stroke="${opts.borderColor}" stroke-width="5"/>`;
    innerShape = `<rect x="23" y="23" width="174" height="174" rx="38" fill="url(#cstbg)"/>`;
    clipShape = `<rect x="23" y="23" width="174" height="174" rx="38"/>`;
  }

  const contentMarkup = hasPhoto
    ? `<image href="${opts.photoDataUrl}" x="20" y="20" width="180" height="180" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
    : `<circle cx="166" cy="52" r="11" fill="#FFFFFF" opacity="0.22"/>
       <circle cx="52" cy="158" r="8" fill="#FFFFFF" opacity="0.18"/>
       <text x="110" y="${cleanCaption ? '122' : '136'}" text-anchor="middle" font-size="${cleanCaption ? '84' : '98'}" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${cleanEmoji}</text>`;

  const captionMarkup = cleanCaption
    ? `<rect x="28" y="150" width="164" height="36" rx="18" fill="#090D16" fill-opacity="0.86" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.32"/>
       <text x="110" y="174" text-anchor="middle" fill="#FFFFFF" font-size="${cleanCaption.length > 14 ? '14' : '16'}" font-weight="800" letter-spacing="0.4" font-family="system-ui, -apple-system, sans-serif">${cleanCaption}</text>`
    : '';

  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="220" height="220">
      <defs>
        <linearGradient id="cstbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${opts.bg1}"/>
          <stop offset="100%" stop-color="${opts.bg2}"/>
        </linearGradient>
        <clipPath id="${clipId}">
          ${clipShape}
        </clipPath>
      </defs>
      <g transform="rotate(${rot} 110 110)">
        ${outerShape}
        ${innerShape}
        ${contentMarkup}
        ${captionMarkup}
      </g>
    </svg>
  `);
}

export interface CustomGifOptions {
  mode: 'text' | 'photo';
  emoji: string;
  subEmoji: string;
  title: string;
  subtitle: string;
  bg1: string;
  bg2: string;
  motionType: GifMotionType;
  speed: GifSpeed;
  photoFrames?: string[];
}

export function buildCustomGifSvg(opts: CustomGifOptions): string {
  const speedMul = opts.speed === 'fast' ? 0.65 : opts.speed === 'chill' ? 1.55 : 1;
  const dur = (sec: number) => `${(sec * speedMul).toFixed(2)}s`;

  const cleanTitle = escapeSvgText(opts.title.trim().slice(0, 26));
  const cleanSub = escapeSvgText(opts.subtitle.trim().slice(0, 34));
  const cleanEmoji = escapeSvgText((opts.emoji || '🔥').slice(0, 8));
  const cleanSubEmoji = escapeSvgText((opts.subEmoji || '✨').slice(0, 8));
  const frames = (opts.photoFrames || []).filter(Boolean).slice(0, 5);

  const buildMotionTransform = (cx: number, cy: number): string => {
    switch (opts.motionType) {
      case 'bounce':
        return `<animateTransform attributeName="transform" type="translate" values="0,8; 0,-12; 0,8" dur="${dur(0.88)}" repeatCount="indefinite"/>`;
      case 'spin':
        return `<animateTransform attributeName="transform" type="rotate" values="-14 ${cx} ${cy}; 14 ${cx} ${cy}; -14 ${cx} ${cy}" dur="${dur(1.05)}" repeatCount="indefinite"/>`;
      case 'wave':
        return `<animateTransform attributeName="transform" type="translate" values="-12,0; 12,-6; -12,0" dur="${dur(1.2)}" repeatCount="indefinite"/>`;
      case 'zoom':
        return `<animateTransform attributeName="transform" type="translate" values="0,0; -14,-8; 0,0" dur="${dur(1.3)}" repeatCount="indefinite"/>`;
      case 'glitch':
        return `<animateTransform attributeName="transform" type="translate" values="0,0; -6,2; 6,-2; -3,0; 0,0" dur="${dur(0.55)}" repeatCount="indefinite"/>`;
      case 'pulse':
      default:
        return `<animateTransform attributeName="transform" type="translate" values="0,2; 0,-6; 0,2" dur="${dur(0.95)}" repeatCount="indefinite"/>`;
    }
  };

  if (opts.mode === 'photo' && frames.length > 0) {
    const totalDur = Math.max(1.6, frames.length * 1.15 * speedMul);
    const frameMarkup =
      frames.length === 1
        ? `<g>
            <animateTransform attributeName="transform" type="translate" values="0,0; -10,-6; 0,0" dur="${dur(2.8)}" repeatCount="indefinite"/>
            <image href="${frames[0]}" x="-12" y="-10" width="344" height="220" preserveAspectRatio="xMidYMid slice"/>
          </g>`
        : frames
            .map((src, idx) => {
              const n = frames.length;
              const step = 1 / n;
              const start = idx * step;
              const holdEnd = Math.min(1, start + step * 0.84);
              const fadeOutEnd = Math.min(1, start + step);
              let values = '0;0;1;1;0;0';
              let keyTimes = `0;${Math.max(0, start - 0.01).toFixed(3)};${start.toFixed(3)};${holdEnd.toFixed(3)};${fadeOutEnd.toFixed(3)};1`;
              if (idx === 0) {
                values = '1;1;0;0;1';
                keyTimes = `0;${holdEnd.toFixed(3)};${fadeOutEnd.toFixed(3)};0.985;1`;
              } else if (idx === n - 1) {
                values = '0;0;1;1;0';
                keyTimes = `0;${Math.max(0.01, start - 0.01).toFixed(3)};${start.toFixed(3)};0.96;1`;
              }
              return `<image href="${src}" x="0" y="0" width="320" height="200" preserveAspectRatio="xMidYMid slice" opacity="${idx === 0 ? '1' : '0'}">
                <animate attributeName="opacity" values="${values}" keyTimes="${keyTimes}" dur="${totalDur.toFixed(2)}s" repeatCount="indefinite"/>
              </image>`;
            })
            .join('');

    const captionBar =
      cleanTitle || cleanSub
        ? `<rect x="16" y="138" width="288" height="48" rx="14" fill="#090D16" fill-opacity="0.74"/>
           ${cleanTitle ? `<text x="160" y="${cleanSub ? '159' : '168'}" text-anchor="middle" fill="#FFFFFF" font-size="17" font-weight="800" font-family="system-ui, -apple-system, sans-serif">${cleanTitle}</text>` : ''}
           ${cleanSub ? `<text x="160" y="176" text-anchor="middle" fill="#E2E8F0" font-size="11" font-weight="600" font-family="system-ui, -apple-system, sans-serif">${cleanSub}</text>` : ''}`
        : '';

    return encodeSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200">
        <defs>
          <clipPath id="pgclip"><rect width="320" height="200" rx="22"/></clipPath>
        </defs>
        <g clip-path="url(#pgclip)">
          <rect width="320" height="200" fill="#090D16"/>
          ${frameMarkup}
          <rect width="320" height="200" fill="#000000" fill-opacity="0.16"/>
          <g>
            ${buildMotionTransform(276, 46)}
            <text x="276" y="54" text-anchor="middle" font-size="34" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${cleanEmoji}</text>
          </g>
          ${captionBar}
          <rect x="14" y="12" width="42" height="20" rx="6" fill="#090D16" fill-opacity="0.78"/>
          <text x="35" y="26" text-anchor="middle" fill="#FFFFFF" font-size="10" font-weight="800" font-family="system-ui, -apple-system, sans-serif">GIF</text>
        </g>
      </svg>
    `);
  }

  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200" width="320" height="200">
      <defs>
        <linearGradient id="cgbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${opts.bg1}"/>
          <stop offset="100%" stop-color="${opts.bg2}"/>
        </linearGradient>
      </defs>
      <rect width="320" height="200" rx="22" fill="url(#cgbg)"/>
      <circle cx="54" cy="46" r="18" fill="#FFFFFF" opacity="0.16">
        <animate attributeName="r" values="14;26;14" dur="${dur(2.0)}" repeatCount="indefinite"/>
      </circle>
      <circle cx="272" cy="154" r="24" fill="#FFFFFF" opacity="0.14">
        <animate attributeName="r" values="18;30;18" dur="${dur(1.75)}" repeatCount="indefinite"/>
      </circle>
      <text x="54" y="66" font-size="24" opacity="0.92" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">
        ${cleanSubEmoji}
        <animate attributeName="opacity" values="0.3;1;0.3" dur="${dur(1.2)}" repeatCount="indefinite"/>
      </text>
      <text x="244" y="66" font-size="24" opacity="0.92" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">
        ${cleanSubEmoji}
        <animate attributeName="opacity" values="1;0.3;1" dur="${dur(1.2)}" repeatCount="indefinite"/>
      </text>
      <g>
        ${buildMotionTransform(160, 96)}
        <text x="160" y="110" text-anchor="middle" font-size="68" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${cleanEmoji}</text>
      </g>
      <rect x="18" y="136" width="284" height="48" rx="14" fill="#090D16" fill-opacity="0.74"/>
      <text x="160" y="${cleanSub ? '158' : '166'}" text-anchor="middle" fill="#FFFFFF" font-size="18" font-weight="800" font-family="system-ui, -apple-system, sans-serif">${cleanTitle || 'CUSTOM GIF'}</text>
      ${cleanSub ? `<text x="160" y="175" text-anchor="middle" fill="#CBD5E1" font-size="11" font-weight="600" font-family="system-ui, -apple-system, sans-serif">${cleanSub}</text>` : ''}
      <rect x="14" y="12" width="40" height="20" rx="6" fill="#090D16" fill-opacity="0.78"/>
      <text x="34" y="26" text-anchor="middle" fill="#FFFFFF" font-size="10" font-weight="800" font-family="system-ui, -apple-system, sans-serif">GIF</text>
    </svg>
  `);
}

export async function compressPhotoForStudio(file: File, maxDim = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read photo file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported image format.'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

