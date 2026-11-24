export interface AvatarPreset {
  id: string;
  label: string;
  category: 'portraits' | 'characters' | 'abstract';
  dataUrl: string;
}

function encodeSvgDataUrl(svg: string): string {
  const cleaned = svg.replace(/\s+/g, ' ').trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`;
}

function makePortraitSvg(opts: {
  bg1: string;
  bg2: string;
  skin: string;
  hair: string;
  shirt: string;
  glasses?: boolean;
  smile?: 'big' | 'calm' | 'wink';
  hairStyle?: 'short' | 'bob' | 'curly' | 'bun' | 'cap';
  accessory?: 'headphones' | 'star' | 'none';
}): string {
  const hairMarkup =
    opts.hairStyle === 'bob'
      ? `<path d="M26 52 C26 24, 74 24, 74 52 L76 70 C70 66, 66 56, 66 44 C56 46, 44 46, 34 44 C34 56, 30 66, 24 70 Z" fill="${opts.hair}"/>`
      : opts.hairStyle === 'curly'
        ? `<circle cx="34" cy="34" r="11" fill="${opts.hair}"/><circle cx="50" cy="28" r="12" fill="${opts.hair}"/><circle cx="66" cy="34" r="11" fill="${opts.hair}"/><circle cx="29" cy="46" r="8" fill="${opts.hair}"/><circle cx="71" cy="46" r="8" fill="${opts.hair}"/>`
        : opts.hairStyle === 'bun'
          ? `<circle cx="50" cy="18" r="9" fill="${opts.hair}"/><path d="M29 48 C29 26, 71 26, 71 48 C65 38, 35 38, 29 48 Z" fill="${opts.hair}"/>`
          : opts.hairStyle === 'cap'
            ? `<path d="M28 43 C28 24, 72 24, 72 43 Z" fill="${opts.shirt}"/><path d="M26 41 L82 41 C80 46, 72 47, 64 46 L26 45 Z" fill="#111827"/>`
            : `<path d="M29 48 C29 25, 71 25, 71 48 C64 38, 56 35, 44 37 C36 38, 32 42, 29 48 Z" fill="${opts.hair}"/>`;

  const eyesMarkup =
    opts.smile === 'wink'
      ? `<circle cx="42" cy="52" r="2.6" fill="#1F2937"/><path d="M54 52 Q58 49 62 52" stroke="#1F2937" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
      : `<circle cx="42" cy="52" r="2.6" fill="#1F2937"/><circle cx="58" cy="52" r="2.6" fill="#1F2937"/>`;

  const glassesMarkup = opts.glasses
    ? `<rect x="34" y="47" width="14" height="10" rx="4" fill="none" stroke="#1F2937" stroke-width="2"/><rect x="52" y="47" width="14" height="10" rx="4" fill="none" stroke="#1F2937" stroke-width="2"/><line x1="48" y1="52" x2="52" y2="52" stroke="#1F2937" stroke-width="2"/>`
    : '';

  const mouthMarkup =
    opts.smile === 'big'
      ? `<path d="M42 61 Q50 69 58 61 Z" fill="#FFFFFF" stroke="#1F2937" stroke-width="1.8" stroke-linejoin="round"/>`
      : `<path d="M43 62 Q50 67 57 62" stroke="#1F2937" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;

  const accMarkup =
    opts.accessory === 'headphones'
      ? `<path d="M26 52 C26 24, 74 24, 74 52" fill="none" stroke="#111827" stroke-width="4"/><rect x="21" y="46" width="7" height="14" rx="3.5" fill="#10B981"/><rect x="72" y="46" width="7" height="14" rx="3.5" fill="#10B981"/>`
      : opts.accessory === 'star'
        ? `<polygon points="80,18 82,24 88,24 83,27 85,33 80,29 75,33 77,27 72,24 78,24" fill="#FDE047"/>`
        : '';

  return encodeSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="128" height="128">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${opts.bg1}"/>
          <stop offset="100%" stop-color="${opts.bg2}"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="50" fill="url(#g)"/>
      <path d="M18 100 C20 77, 36 72, 50 72 C64 72, 80 77, 82 100 Z" fill="${opts.shirt}"/>
      <rect x="44" y="64" width="12" height="12" rx="5" fill="${opts.skin}"/>
      <circle cx="50" cy="50" r="20" fill="${opts.skin}"/>
      ${hairMarkup}
      ${eyesMarkup}
      ${glassesMarkup}
      ${mouthMarkup}
      ${accMarkup}
    </svg>
  `);
}

function makeMascotSvg(opts: {
  bg1: string;
  bg2: string;
  emoji: string;
  ring: string;
}): string {
  return encodeSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="128" height="128">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${opts.bg1}"/>
          <stop offset="100%" stop-color="${opts.bg2}"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="50" fill="url(#bg)"/>
      <circle cx="50" cy="50" r="39" fill="none" stroke="${opts.ring}" stroke-width="2.5" opacity="0.55"/>
      <text x="50" y="63" text-anchor="middle" font-size="44" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${opts.emoji}</text>
    </svg>
  `);
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'av-aarav',
    label: 'Studio Beats',
    category: 'portraits',
    dataUrl: makePortraitSvg({
      bg1: '#059669',
      bg2: '#0F766E',
      skin: '#E0A97B',
      hair: '#1F2937',
      shirt: '#111827',
      smile: 'big',
      hairStyle: 'short',
      accessory: 'headphones',
    }),
  },
  {
    id: 'av-priya',
    label: 'Campus Coder',
    category: 'portraits',
    dataUrl: makePortraitSvg({
      bg1: '#6366F1',
      bg2: '#4F46E5',
      skin: '#D6996A',
      hair: '#18181B',
      shirt: '#F43F5E',
      glasses: true,
      smile: 'calm',
      hairStyle: 'bob',
    }),
  },
  {
    id: 'av-leo',
    label: 'Street Cap',
    category: 'portraits',
    dataUrl: makePortraitSvg({
      bg1: '#F59E0B',
      bg2: '#EA580C',
      skin: '#F3C7A4',
      hair: '#451A03',
      shirt: '#1D4ED8',
      smile: 'wink',
      hairStyle: 'cap',
    }),
  },
  {
    id: 'av-zara',
    label: 'Curly Vibes',
    category: 'portraits',
    dataUrl: makePortraitSvg({
      bg1: '#EC4899',
      bg2: '#BE185D',
      skin: '#9C6644',
      hair: '#1C1917',
      shirt: '#FBBF24',
      smile: 'big',
      hairStyle: 'curly',
      accessory: 'star',
    }),
  },
  {
    id: 'av-maya',
    label: 'Design Bun',
    category: 'portraits',
    dataUrl: makePortraitSvg({
      bg1: '#0EA5E9',
      bg2: '#0369A1',
      skin: '#F5CBA7',
      hair: '#3F2718',
      shirt: '#0F766E',
      glasses: true,
      smile: 'calm',
      hairStyle: 'bun',
    }),
  },
  {
    id: 'av-dev',
    label: 'Night Owl',
    category: 'portraits',
    dataUrl: makePortraitSvg({
      bg1: '#1E293B',
      bg2: '#0F172A',
      skin: '#C68652',
      hair: '#09090B',
      shirt: '#10B981',
      glasses: true,
      smile: 'wink',
      hairStyle: 'short',
      accessory: 'headphones',
    }),
  },
  {
    id: 'av-fox',
    label: 'Clever Fox',
    category: 'characters',
    dataUrl: makeMascotSvg({ bg1: '#F97316', bg2: '#C2410C', emoji: '🦊', ring: '#FED7AA' }),
  },
  {
    id: 'av-panda',
    label: 'Chill Panda',
    category: 'characters',
    dataUrl: makeMascotSvg({ bg1: '#10B981', bg2: '#047857', emoji: '🐼', ring: '#A7F3D0' }),
  },
  {
    id: 'av-cat',
    label: 'Cool Cat',
    category: 'characters',
    dataUrl: makeMascotSvg({ bg1: '#8B5CF6', bg2: '#6D28D9', emoji: '😎', ring: '#DDD6FE' }),
  },
  {
    id: 'av-astro',
    label: 'Astronaut',
    category: 'characters',
    dataUrl: makeMascotSvg({ bg1: '#0284C7', bg2: '#1E3A8A', emoji: '🧑‍🚀', ring: '#BAE6FD' }),
  },
  {
    id: 'av-tiger',
    label: 'Campus Tiger',
    category: 'characters',
    dataUrl: makeMascotSvg({ bg1: '#EAB308', bg2: '#B45309', emoji: '🐯', ring: '#FEF08A' }),
  },
  {
    id: 'av-bot',
    label: 'Robo Lab',
    category: 'characters',
    dataUrl: makeMascotSvg({ bg1: '#14B8A6', bg2: '#115E59', emoji: '🤖', ring: '#99F6E4' }),
  },
  {
    id: 'av-rocket',
    label: 'Launchpad',
    category: 'abstract',
    dataUrl: makeMascotSvg({ bg1: '#E11D48', bg2: '#9F1239', emoji: '🚀', ring: '#FECDD3' }),
  },
  {
    id: 'av-gamer',
    label: 'Pro Gamer',
    category: 'abstract',
    dataUrl: makeMascotSvg({ bg1: '#4F46E5', bg2: '#312E81', emoji: '🎮', ring: '#C7D2FE' }),
  },
  {
    id: 'av-music',
    label: 'Lo-Fi Beats',
    category: 'abstract',
    dataUrl: makeMascotSvg({ bg1: '#0D9488', bg2: '#134E4A', emoji: '🎧', ring: '#99F6E4' }),
  },
  {
    id: 'av-fire',
    label: 'Streak Fire',
    category: 'abstract',
    dataUrl: makeMascotSvg({ bg1: '#EA580C', bg2: '#9A3412', emoji: '🔥', ring: '#FED7AA' }),
  },
  {
    id: 'av-coffee',
    label: 'Cafe Crew',
    category: 'abstract',
    dataUrl: makeMascotSvg({ bg1: '#78350F', bg2: '#451A03', emoji: '☕', ring: '#FDE68A' }),
  },
  {
    id: 'av-camera',
    label: 'Reel Maker',
    category: 'abstract',
    dataUrl: makeMascotSvg({ bg1: '#DB2777', bg2: '#831843', emoji: '🎬', ring: '#FBCFE8' }),
  },
];

const RANDOM_FIRST_NAMES = [
  'Aarav',
  'Riya',
  'Kabir',
  'Ananya',
  'Vihaan',
  'Meera',
  'Rohan',
  'Zoya',
  'Arjun',
  'Sana',
  'Dev',
  'Tara',
  'Nikhil',
  'Isha',
  'Karan',
  'Naina',
];

const RANDOM_LAST_TAGS = [
  'Vibes',
  'Spark',
  'Nova',
  'Pulse',
  'Wave',
  'Drift',
  'Craft',
  'Orbit',
  'Dash',
  'Pixel',
  'Zen',
  'Echo',
];

const RANDOM_MAJORS = [
  'Computer Science · AI Club',
  'Design & Film · Reels Crew',
  'Music & Jam Society',
  'Robotics & Makerspace',
  'Entrepreneurship Cell',
  'Photography & Visual Arts',
  'Gaming & Esports Squad',
  'Data Science & Analytics',
];

const RANDOM_BIOS = [
  'Building cool apps, vibing on campus reels, and always down for coffee.',
  'Late-night coder, weekend photographer, and voice-note enthusiast.',
  'Creating short reels, sharing playlists, and hanging out in group calls.',
  'Exploring design, tech, and spontaneous campus adventures.',
  'Always online for study sprints, gaming sessions, and good memes.',
];

const RANDOM_STATUS_NOTES = [
  'Listening to lo-fi beats',
  'Editing a new Reel',
  'At the campus cafe',
  'Ready for a voice call',
  'Building something fun',
  'In study mode',
];

function pickRandom<T>(arr: readonly T[], exclude?: T): T {
  const pool = exclude !== undefined && arr.length > 1 ? arr.filter((x) => x !== exclude) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateRandomAvatarUrl(currentUrl?: string): string {
  const preset = pickRandom(
    AVATAR_PRESETS,
    AVATAR_PRESETS.find((p) => p.dataUrl === currentUrl)
  );
  return preset.dataUrl;
}

export interface RandomProfileCombo {
  displayName: string;
  handle: string;
  majorOrClub: string;
  bio: string;
  statusMessage: string;
  photoUrl: string;
}

export function generateRandomProfileCombo(currentPhotoUrl?: string): RandomProfileCombo {
  const first = pickRandom(RANDOM_FIRST_NAMES);
  const tag = pickRandom(RANDOM_LAST_TAGS);
  const num = Math.floor(10 + Math.random() * 89);
  const displayName = `${first} ${tag}`;
  const handle = `${first.toLowerCase()}.${tag.toLowerCase()}${num}`;
  return {
    displayName,
    handle,
    majorOrClub: pickRandom(RANDOM_MAJORS),
    bio: pickRandom(RANDOM_BIOS),
    statusMessage: pickRandom(RANDOM_STATUS_NOTES),
    photoUrl: generateRandomAvatarUrl(currentPhotoUrl),
  };
}
