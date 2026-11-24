import themeFlowerSakuraImg from '../assets/images/theme_flower_sakura_1795462880477.jpg';
import themeFlowerRosesImg from '../assets/images/theme_flower_roses_1795462880725.jpg';
import themeCarMidnightGtImg from '../assets/images/theme_car_midnight_gt_1795462880330.jpg';
import themeCarSunsetGtImg from '../assets/images/theme_car_sunset_gt_1795462879660.jpg';
import themeCarBmwMImg from '../assets/images/theme_car_bmw_m_1795464572991.jpg';
import themeCarAudiRsImg from '../assets/images/theme_car_audi_rs_1795464573472.jpg';
import themeNatureCloudyImg from '../assets/images/theme_nature_cloudy_1795464570027.jpg';
import themeNatureRainyImg from '../assets/images/theme_nature_rainy_1795464571663.jpg';
import themeGameMinecraftImg from '../assets/images/theme_game_minecraft_1795464572375.jpg';
import themeGameArcadeImg from '../assets/images/theme_game_arcade_1795464572480.jpg';

export type ThemeId = 'emerald' | 'whatsapp' | 'ocean' | 'iris' | 'sunset' | 'rose';
export type WallpaperId = 'none' | 'dots' | 'grid' | 'aurora';

export type ChatThemeId =
  | 'classic'
  | 'bmw_m'
  | 'audi_rs'
  | 'midnight_gt'
  | 'sunset_gt'
  | 'turbo_drift'
  | 'cloudy_peaks'
  | 'rainy_glass'
  | 'misty_forest'
  | 'aurora_sky'
  | 'minecraft_world'
  | 'cyber_quest'
  | 'retro_arcade'
  | 'sakura'
  | 'velvet_roses'
  | 'sunflower'
  | 'lavender_bloom'
  | 'ig_berry'
  | 'ocean_wave'
  | 'obsidian';

export type ChatThemeCategory = 'all' | 'cars' | 'nature' | 'games' | 'flowers' | 'gradients';

export interface AppThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  swatch: string;
  swatchDark: string;
  surfaceTint: string;
}

export interface WallpaperMeta {
  id: WallpaperId;
  name: string;
  description: string;
}

export interface ChatThemeMeta {
  id: ChatThemeId;
  name: string;
  category: Exclude<ChatThemeCategory, 'all'> | 'classic';
  tagline: string;
  accentHex: string;
  /** CSS gradient for your own outgoing message bubbles (Instagram DM style) */
  ownBubbleGradient: string;
  /** CSS class/bg for incoming message bubbles with guaranteed contrast */
  peerBubbleClass: string;
  /** Optional generated photo artwork backdrop */
  backdropImage?: string;
  /** Optional CSS backdrop class when no photo image is used */
  backdropClass?: string;
  /** Scrim overlay class so text & date dividers always pass contrast over artwork */
  scrimClass: string;
  /** Whether the theme backdrop is predominantly dark (controls header/date text readability) */
  isDarkSurface: boolean;
  /** Swatch preview CSS background for theme picker tiles */
  previewGradient: string;
}

export const APP_THEMES: AppThemeMeta[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Classic',
    description: 'Signature teal-green chat palette with crisp contrast',
    swatch: '#008069',
    swatchDark: '#00A884',
    surfaceTint: '#EFEAE2',
  },
  {
    id: 'emerald',
    name: 'Campus Emerald',
    description: 'Botanical deep green paired with warm campus stone',
    swatch: '#047857',
    swatchDark: '#10B981',
    surfaceTint: '#F4F3EF',
  },
  {
    id: 'ocean',
    name: 'Midnight Ocean',
    description: 'Clean maritime blue for focused study groups',
    swatch: '#0369A1',
    swatchDark: '#38BDF8',
    surfaceTint: '#F0F6FA',
  },
  {
    id: 'iris',
    name: 'Royal Iris',
    description: 'Expressive studio violet with balanced cool neutrals',
    swatch: '#6D28D9',
    swatchDark: '#A78BFA',
    surfaceTint: '#F5F3FA',
  },
  {
    id: 'sunset',
    name: 'Sunset Amber',
    description: 'Warm golden terracotta inspired by campus quad evenings',
    swatch: '#C2410C',
    swatchDark: '#FB923C',
    surfaceTint: '#FAF4EE',
  },
  {
    id: 'rose',
    name: 'Rose Editorial',
    description: 'Refined berry-rose accent with soft neutral paper',
    swatch: '#BE123C',
    swatchDark: '#FB7185',
    surfaceTint: '#FAF2F4',
  },
];

export const CHAT_WALLPAPERS: WallpaperMeta[] = [
  {
    id: 'none',
    name: 'Clean Canvas',
    description: 'Minimal solid conversation background',
  },
  {
    id: 'dots',
    name: 'Chat Pattern',
    description: 'Subtle dotted WhatsApp-inspired texture',
  },
  {
    id: 'grid',
    name: 'Notebook Grid',
    description: 'Light architectural graph lines for study chats',
  },
  {
    id: 'aurora',
    name: 'Soft Tint',
    description: 'Gentle theme-matched ambient gradient backdrop',
  },
];

export const CHAT_THEMES: ChatThemeMeta[] = [
  {
    id: 'classic',
    name: 'Classic',
    category: 'classic',
    tagline: 'Clean default workspace style',
    accentHex: '#008069',
    ownBubbleGradient: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)',
    peerBubbleClass:
      'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-slate-100 border border-stone-200/80 dark:border-slate-700/80',
    scrimClass: '',
    isDarkSurface: false,
    previewGradient: 'linear-gradient(135deg, #008069 0%, #10B981 100%)',
  },

  /* ---- CARS (BMW, Audi & Supercars) ---- */
  {
    id: 'bmw_m',
    name: 'BMW M Sport',
    category: 'cars',
    tagline: 'Frozen-blue BMW M4 alpine twilight drive',
    accentHex: '#1D4ED8',
    ownBubbleGradient: 'linear-gradient(135deg, #0284C7 0%, #1D4ED8 60%, #DC2626 100%)',
    peerBubbleClass: 'bg-[#0C1324]/86 text-slate-100 border border-sky-400/25 backdrop-blur-md',
    backdropImage: themeCarBmwMImg,
    scrimClass: 'bg-gradient-to-b from-[#070B14]/50 via-[#081020]/30 to-[#050810]/65',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #0284C7 0%, #1D4ED8 65%, #DC2626 100%)',
  },
  {
    id: 'audi_rs',
    name: 'Audi RS Quattro',
    category: 'cars',
    tagline: 'Nardo-grey Audi RS7 on rain-lit boulevard',
    accentHex: '#DC2626',
    ownBubbleGradient: 'linear-gradient(135deg, #334155 0%, #1E293B 55%, #B91C1C 100%)',
    peerBubbleClass: 'bg-[#14171D]/86 text-slate-100 border border-slate-400/25 backdrop-blur-md',
    backdropImage: themeCarAudiRsImg,
    scrimClass: 'bg-gradient-to-b from-black/50 via-[#10131A]/35 to-black/65',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #475569 0%, #0F172A 60%, #DC2626 100%)',
  },
  {
    id: 'midnight_gt',
    name: 'Midnight Supercar',
    category: 'cars',
    tagline: 'Rain-slicked supercar & cobalt boost',
    accentHex: '#2563EB',
    ownBubbleGradient: 'linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%)',
    peerBubbleClass: 'bg-[#0F172A]/84 text-slate-100 border border-sky-400/20 backdrop-blur-md',
    backdropImage: themeCarMidnightGtImg,
    scrimClass: 'bg-gradient-to-b from-[#070B14]/55 via-[#070B14]/35 to-[#070B14]/65',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #0F172A 0%, #2563EB 100%)',
  },
  {
    id: 'sunset_gt',
    name: 'Sunset Coast GT',
    category: 'cars',
    tagline: 'Crimson coupe on golden coastal drive',
    accentHex: '#EA580C',
    ownBubbleGradient: 'linear-gradient(135deg, #DC2626 0%, #EA580C 100%)',
    peerBubbleClass: 'bg-[#1A1214]/84 text-orange-50 border border-amber-300/20 backdrop-blur-md',
    backdropImage: themeCarSunsetGtImg,
    scrimClass: 'bg-gradient-to-b from-black/40 via-[#1B0E10]/35 to-black/60',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #DC2626 0%, #F59E0B 100%)',
  },
  {
    id: 'turbo_drift',
    name: 'Carbon Motorsport',
    category: 'cars',
    tagline: 'Carbon-fiber weave & racing cyan',
    accentHex: '#06B6D4',
    ownBubbleGradient: 'linear-gradient(135deg, #0891B2 0%, #0F766E 100%)',
    peerBubbleClass: 'bg-[#121820]/88 text-slate-100 border border-cyan-400/20 backdrop-blur-md',
    backdropClass: 'chat-theme-turbo',
    scrimClass: 'bg-black/25',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #111827 0%, #0891B2 100%)',
  },

  /* ---- NATURE (Cloudy, Rainy, Forest & Aurora) ---- */
  {
    id: 'cloudy_peaks',
    name: 'Cloudy Peaks',
    category: 'nature',
    tagline: 'Overcast clouds over misty pine mountains',
    accentHex: '#475569',
    ownBubbleGradient: 'linear-gradient(135deg, #334155 0%, #1E293B 100%)',
    peerBubbleClass: 'bg-white/88 dark:bg-[#131C26]/86 text-slate-900 dark:text-slate-100 border border-slate-300/60 dark:border-slate-600/40 backdrop-blur-md',
    backdropImage: themeNatureCloudyImg,
    scrimClass: 'bg-gradient-to-b from-slate-900/35 via-slate-900/20 to-slate-950/55',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #94A3B8 0%, #334155 100%)',
  },
  {
    id: 'rainy_glass',
    name: 'Rainy Night',
    category: 'nature',
    tagline: 'Cozy raindrops on glass & warm forest lights',
    accentHex: '#0D9488',
    ownBubbleGradient: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)',
    peerBubbleClass: 'bg-[#0D1A1C]/84 text-teal-50 border border-teal-300/20 backdrop-blur-md',
    backdropImage: themeNatureRainyImg,
    scrimClass: 'bg-gradient-to-b from-black/40 via-[#091517]/35 to-black/60',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #115E59 0%, #0F172A 100%)',
  },
  {
    id: 'misty_forest',
    name: 'Misty Pine Valley',
    category: 'nature',
    tagline: 'Calm evergreen canopy & morning fog',
    accentHex: '#15803D',
    ownBubbleGradient: 'linear-gradient(135deg, #16A34A 0%, #166534 100%)',
    peerBubbleClass: 'bg-[#0F1E16]/88 text-emerald-50 border border-emerald-400/20 backdrop-blur-md',
    backdropClass: 'chat-theme-misty-forest',
    scrimClass: 'bg-black/20',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #16A34A 0%, #064E3B 100%)',
  },
  {
    id: 'aurora_sky',
    name: 'Northern Aurora',
    category: 'nature',
    tagline: 'Starry polar sky with emerald light ribbons',
    accentHex: '#10B981',
    ownBubbleGradient: 'linear-gradient(135deg, #059669 0%, #0284C7 100%)',
    peerBubbleClass: 'bg-[#0B1622]/88 text-sky-50 border border-emerald-300/25 backdrop-blur-md',
    backdropClass: 'chat-theme-aurora-sky',
    scrimClass: 'bg-black/20',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #059669 0%, #0EA5E9 55%, #312E81 100%)',
  },

  /* ---- GAMES (Minecraft Voxel World, Fantasy Quest & Retro Arcade) ---- */
  {
    id: 'minecraft_world',
    name: 'Minecraft Craft',
    category: 'games',
    tagline: 'Voxel sunset hills, waterfall & blocky cabin',
    accentHex: '#16A34A',
    ownBubbleGradient: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
    peerBubbleClass: 'bg-[#171F14]/84 text-lime-50 border border-lime-300/25 backdrop-blur-md',
    backdropImage: themeGameMinecraftImg,
    scrimClass: 'bg-gradient-to-b from-black/35 via-[#131C10]/30 to-black/55',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #22C55E 0%, #D97706 100%)',
  },
  {
    id: 'cyber_quest',
    name: 'Crystal Citadel',
    category: 'games',
    tagline: 'Starlit RPG floating castle & crystal valley',
    accentHex: '#6366F1',
    ownBubbleGradient: 'linear-gradient(135deg, #4F46E5 0%, #0EA5E9 100%)',
    peerBubbleClass: 'bg-[#0D132B]/86 text-indigo-50 border border-cyan-300/25 backdrop-blur-md',
    backdropImage: themeGameArcadeImg,
    scrimClass: 'bg-gradient-to-b from-[#060918]/45 via-[#091026]/30 to-[#060918]/60',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
  },
  {
    id: 'retro_arcade',
    name: '8-Bit Pixel Grid',
    category: 'games',
    tagline: 'Classic arcade pixel floor & console glow',
    accentHex: '#9333EA',
    ownBubbleGradient: 'linear-gradient(135deg, #9333EA 0%, #DB2777 100%)',
    peerBubbleClass: 'bg-[#161026]/90 text-fuchsia-50 border border-purple-400/30 backdrop-blur-md',
    backdropClass: 'chat-theme-retro-arcade',
    scrimClass: 'bg-black/20',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
  },

  /* ---- FLOWERS ---- */
  {
    id: 'sakura',
    name: 'Sakura Blossom',
    category: 'flowers',
    tagline: 'Soft cherry blossoms & rose bubbles',
    accentHex: '#DB2777',
    ownBubbleGradient: 'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)',
    peerBubbleClass:
      'bg-white/90 dark:bg-[#1E161D]/88 text-stone-900 dark:text-rose-50 border border-pink-200/80 dark:border-pink-900/50 backdrop-blur-md',
    backdropImage: themeFlowerSakuraImg,
    scrimClass:
      'bg-gradient-to-b from-rose-50/40 via-white/35 to-rose-100/45 dark:from-[#160D14]/65 dark:via-[#120B11]/60 dark:to-[#160D14]/70',
    isDarkSurface: false,
    previewGradient: 'linear-gradient(135deg, #FBCFE8 0%, #EC4899 100%)',
  },
  {
    id: 'velvet_roses',
    name: 'Velvet Roses',
    category: 'flowers',
    tagline: 'Moody garden roses & crimson silk',
    accentHex: '#E11D48',
    ownBubbleGradient: 'linear-gradient(135deg, #E11D48 0%, #881337 100%)',
    peerBubbleClass: 'bg-[#1D1318]/86 text-rose-50 border border-rose-300/20 backdrop-blur-md',
    backdropImage: themeFlowerRosesImg,
    scrimClass: 'bg-gradient-to-b from-black/45 via-[#170A10]/45 to-black/55',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #9F1239 0%, #2B0D18 100%)',
  },
  {
    id: 'sunflower',
    name: 'Sunflower Bloom',
    category: 'flowers',
    tagline: 'Warm botanical petals & golden honey',
    accentHex: '#D97706',
    ownBubbleGradient: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
    peerBubbleClass:
      'bg-white/92 dark:bg-[#1E1A12]/88 text-stone-900 dark:text-amber-50 border border-amber-200/80 dark:border-amber-800/50 backdrop-blur-md',
    backdropClass: 'chat-theme-sunflower',
    scrimClass: 'bg-amber-50/20 dark:bg-black/35',
    isDarkSurface: false,
    previewGradient: 'linear-gradient(135deg, #FDE047 0%, #D97706 100%)',
  },
  {
    id: 'lavender_bloom',
    name: 'Lavender Petals',
    category: 'flowers',
    tagline: 'Soft lilac floral mist & amethyst',
    accentHex: '#7C3AED',
    ownBubbleGradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    peerBubbleClass:
      'bg-white/92 dark:bg-[#181526]/88 text-stone-900 dark:text-violet-50 border border-violet-200/80 dark:border-violet-800/50 backdrop-blur-md',
    backdropClass: 'chat-theme-lavender',
    scrimClass: '',
    isDarkSurface: false,
    previewGradient: 'linear-gradient(135deg, #DDD6FE 0%, #7C3AED 100%)',
  },

  /* ---- GRADIENTS ---- */
  {
    id: 'ig_berry',
    name: 'Instagram Berry',
    category: 'gradients',
    tagline: 'Signature IG violet-to-coral gradient',
    accentHex: '#C026D3',
    ownBubbleGradient: 'linear-gradient(135deg, #7C3AED 0%, #DB2777 55%, #F97316 100%)',
    peerBubbleClass:
      'bg-white/92 dark:bg-[#1B1626]/88 text-stone-900 dark:text-slate-100 border border-fuchsia-200/70 dark:border-fuchsia-900/50 backdrop-blur-md',
    backdropClass: 'chat-theme-ig-berry',
    scrimClass: '',
    isDarkSurface: false,
    previewGradient: 'linear-gradient(135deg, #7C3AED 0%, #DB2777 55%, #F97316 100%)',
  },
  {
    id: 'ocean_wave',
    name: 'Ocean Breeze',
    category: 'gradients',
    tagline: 'Calm sapphire depths & seafoam glow',
    accentHex: '#0284C7',
    ownBubbleGradient: 'linear-gradient(135deg, #0284C7 0%, #0D9488 100%)',
    peerBubbleClass:
      'bg-white/92 dark:bg-[#0F1B26]/88 text-stone-900 dark:text-sky-50 border border-sky-200/80 dark:border-sky-800/50 backdrop-blur-md',
    backdropClass: 'chat-theme-ocean-wave',
    scrimClass: '',
    isDarkSurface: false,
    previewGradient: 'linear-gradient(135deg, #0284C7 0%, #14B8A6 100%)',
  },
  {
    id: 'obsidian',
    name: 'Monochrome Noir',
    category: 'gradients',
    tagline: 'Minimal graphite & crisp editorial contrast',
    accentHex: '#475569',
    ownBubbleGradient: 'linear-gradient(135deg, #334155 0%, #0F172A 100%)',
    peerBubbleClass: 'bg-[#181C22]/92 text-slate-100 border border-slate-700/70 backdrop-blur-md',
    backdropClass: 'chat-theme-obsidian',
    scrimClass: '',
    isDarkSurface: true,
    previewGradient: 'linear-gradient(135deg, #334155 0%, #090C10 100%)',
  },
];

export function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && APP_THEMES.some((t) => t.id === value);
}

export function isValidWallpaperId(value: unknown): value is WallpaperId {
  return typeof value === 'string' && CHAT_WALLPAPERS.some((w) => w.id === value);
}

export function isValidChatThemeId(value: unknown): value is ChatThemeId {
  return typeof value === 'string' && CHAT_THEMES.some((t) => t.id === value);
}

export function getChatThemeById(id?: string | null): ChatThemeMeta {
  return CHAT_THEMES.find((t) => t.id === id) || CHAT_THEMES[0];
}

export function applyThemeToDocument(themeId: ThemeId, darkMode: boolean): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', themeId);
  root.classList.toggle('dark', darkMode);

  // Keep Android system status bar synced with active theme & dark mode
  const themeMeta = APP_THEMES.find((t) => t.id === themeId);
  const statusBarColor = darkMode ? '#161B22' : themeMeta?.swatch || '#059669';
  const metaTag = document.querySelector('meta[name="theme-color"]');
  if (metaTag) {
    metaTag.setAttribute('content', statusBarColor);
  }

  try {
    localStorage.setItem('quadline_theme_palette', themeId);
    localStorage.setItem('quadline_theme', darkMode ? 'dark' : 'light');
  } catch {
    // Ignore private-mode storage errors
  }
}
