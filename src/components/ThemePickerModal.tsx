import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Car,
  Check,
  CloudRain,
  Database,
  Download,
  Flower2,
  Gamepad2,
  Moon,
  Palette,
  RefreshCw,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import {
  APP_THEMES,
  CHAT_THEMES,
  CHAT_WALLPAPERS,
  type ChatThemeCategory,
  type ChatThemeId,
  type ThemeId,
  type WallpaperId,
} from '../lib/themes';
import type { BackupSummary } from '../lib/backendApi';

interface ThemePickerModalProps {
  open: boolean;
  themeId: ThemeId;
  darkMode: boolean;
  wallpaperId: WallpaperId;
  activeRoomName?: string;
  activeRoomIsDm?: boolean;
  activeChatThemeId?: ChatThemeId;
  activeChatThemeUpdatedBy?: string;
  backupSummary: BackupSummary | null;
  savedCallsCount: number;
  savingBackup: boolean;
  exportUrl: string | null;
  onClose: () => void;
  onSelectTheme: (id: ThemeId) => void;
  onSelectChatTheme?: (id: ChatThemeId) => void;
  onToggleDarkMode: (nextDark: boolean) => void;
  onSelectWallpaper: (id: WallpaperId) => void;
  onSaveBackupNow: () => void;
}

const CATEGORY_TABS: Array<{ id: ChatThemeCategory; label: string; icon?: typeof Flower2 }> = [
  { id: 'all', label: 'All' },
  { id: 'cars', label: 'Cars', icon: Car },
  { id: 'nature', label: 'Nature', icon: CloudRain },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'flowers', label: 'Flowers', icon: Flower2 },
  { id: 'gradients', label: 'Gradients', icon: Sparkles },
];

export function ThemePickerModal({
  open,
  themeId,
  darkMode,
  wallpaperId,
  activeRoomName,
  activeRoomIsDm = false,
  activeChatThemeId = 'classic',
  activeChatThemeUpdatedBy,
  backupSummary,
  savedCallsCount,
  savingBackup,
  exportUrl,
  onClose,
  onSelectTheme,
  onSelectChatTheme,
  onToggleDarkMode,
  onSelectWallpaper,
  onSaveBackupNow,
}: ThemePickerModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const hasChatContext = Boolean(activeRoomName && onSelectChatTheme);
  const [modalTab, setModalTab] = useState<'chat' | 'app'>(hasChatContext ? 'chat' : 'app');
  const [categoryFilter, setCategoryFilter] = useState<ChatThemeCategory>('all');

  useEffect(() => {
    if (open) {
      setModalTab(hasChatContext ? 'chat' : 'app');
    }
  }, [open, hasChatContext]);

  const filteredChatThemes = CHAT_THEMES.filter((theme) => {
    if (categoryFilter === 'all') return true;
    return theme.category === categoryFilter;
  });

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
          aria-label="Chat themes and app appearance"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col pb-[env(safe-area-inset-bottom)] sm:pb-0"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-soft flex items-center justify-center shrink-0">
                  <Palette className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-sm font-bold text-stone-900 dark:text-white truncate">
                    {modalTab === 'chat' && activeRoomName
                      ? `Theme for ${activeRoomName}`
                      : 'Themes & Appearance'}
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-slate-400 truncate">
                    {modalTab === 'chat' && activeRoomName
                      ? `Applies live for everyone in this ${activeRoomIsDm ? 'DM' : 'group'}`
                      : 'App colors, dark mode, wallpapers, and backups'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close themes dialog"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Mode Switcher when inside a DM or Group */}
            {hasChatContext && (
              <div className="px-5 pt-3 pb-2 border-b border-stone-100 dark:border-slate-800/80 shrink-0">
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-slate-900/90">
                  <button
                    type="button"
                    onClick={() => setModalTab('chat')}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      modalTab === 'chat'
                        ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                        : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    Chat Theme ({activeRoomIsDm ? 'DM' : 'Group'})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab('app')}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      modalTab === 'app'
                        ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                        : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    App Appearance
                  </button>
                </div>
              </div>
            )}

            {/* Body */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {modalTab === 'chat' && hasChatContext && onSelectChatTheme ? (
                <>
                  {/* Category Filter Bar */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {CATEGORY_TABS.map((cat) => {
                      const Icon = cat.icon;
                      const active = categoryFilter === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryFilter(cat.id)}
                          className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors shrink-0 cursor-pointer ${
                            active
                              ? 'border-accent bg-accent-soft text-accent-soft'
                              : 'border-stone-200 dark:border-slate-700 text-stone-600 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {Icon && <Icon className="w-3.5 h-3.5" />}
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {activeChatThemeUpdatedBy && activeChatThemeId !== 'classic' && (
                    <p className="text-[11px] text-stone-500 dark:text-slate-400">
                      Current theme set by{' '}
                      <span className="font-semibold text-stone-800 dark:text-slate-200">
                        {activeChatThemeUpdatedBy}
                      </span>
                    </p>
                  )}

                  {/* Instagram-Style Per-Chat Theme Gallery */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filteredChatThemes.map((ct) => {
                      const isActive = ct.id === activeChatThemeId;
                      return (
                        <motion.button
                          key={ct.id}
                          type="button"
                          whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          onClick={() => onSelectChatTheme(ct.id)}
                          className={`group text-left rounded-2xl border overflow-hidden transition-all cursor-pointer flex flex-col ${
                            isActive
                              ? 'border-accent ring-2 ring-emerald-500/35 shadow-md'
                              : 'border-stone-200 dark:border-slate-800 hover:border-stone-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {/* Mini Chat Preview Surface */}
                          <div
                            className="relative h-28 w-full overflow-hidden flex flex-col justify-between p-2.5"
                            style={!ct.backdropImage ? { background: ct.previewGradient } : undefined}
                          >
                            {ct.backdropImage && (
                              <img
                                src={ct.backdropImage}
                                alt={ct.name}
                                referrerPolicy="no-referrer"
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            )}
                            <div
                              className={`absolute inset-0 ${
                                ct.backdropImage
                                  ? 'bg-gradient-to-t from-black/55 via-black/15 to-black/20'
                                  : 'bg-black/10'
                              }`}
                            />

                            {/* Active Badge */}
                            <div className="relative z-10 flex items-center justify-end">
                              {isActive ? (
                                <span className="w-6 h-6 rounded-full bg-white text-stone-900 shadow-sm flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                                </span>
                              ) : (
                                <span
                                  className="w-4 h-4 rounded-full border-2 border-white/90 shadow-xs"
                                  style={{ backgroundColor: ct.accentHex }}
                                />
                              )}
                            </div>

                            {/* Mini Instagram Outgoing + Incoming Bubbles */}
                            <div className="relative z-10 space-y-1.5">
                              <div className="w-3/4 h-4 rounded-xl rounded-bl-xs bg-white/88 backdrop-blur-xs shadow-xs" />
                              <div
                                className="w-2/3 h-4 ml-auto rounded-xl rounded-br-xs shadow-xs border border-white/20"
                                style={{ background: ct.ownBubbleGradient }}
                              />
                            </div>
                          </div>

                          {/* Card Label */}
                          <div className="p-2.5 bg-white dark:bg-[#1C2128] flex-1">
                            <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                              {ct.name}
                            </p>
                            <p className="text-[11px] text-stone-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {ct.tagline}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  {/* Appearance Mode */}
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                      Appearance
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleDarkMode(false)}
                        className={`min-h-[42px] py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                          !darkMode
                            ? 'border-accent bg-accent-soft text-accent-soft'
                            : 'border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Sun className="w-4 h-4" />
                        <span>Light Mode</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleDarkMode(true)}
                        className={`min-h-[42px] py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                          darkMode
                            ? 'border-accent bg-accent-soft text-accent-soft'
                            : 'border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Moon className="w-4 h-4" />
                        <span>Dark Mode</span>
                      </button>
                    </div>
                  </section>

                  {/* Accent Theme Palette */}
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                      App Accent Color
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {APP_THEMES.map((theme) => {
                        const active = theme.id === themeId;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => onSelectTheme(theme.id)}
                            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                              active
                                ? 'border-accent bg-accent-soft'
                                : 'border-stone-200 dark:border-slate-800 bg-stone-50/70 dark:bg-[#1C2128]/70 hover:border-stone-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span
                                className="w-6 h-6 rounded-full shadow-inner shrink-0"
                                style={{ backgroundColor: darkMode ? theme.swatchDark : theme.swatch }}
                              />
                              {active && <Check className="w-4 h-4 text-accent" />}
                            </div>
                            <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                              {theme.name}
                            </p>
                            <p className="text-[11px] text-stone-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {theme.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Classic Default Chat Wallpaper */}
                  <section className="space-y-2.5">
                    <h3 className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                      Classic Chat Background
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {CHAT_WALLPAPERS.map((wp) => {
                        const active = wp.id === wallpaperId;
                        return (
                          <button
                            key={wp.id}
                            type="button"
                            onClick={() => onSelectWallpaper(wp.id)}
                            className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                              active
                                ? 'border-accent bg-accent-soft'
                                : 'border-stone-200 dark:border-slate-800 hover:border-stone-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-xs font-semibold text-stone-900 dark:text-white">
                                {wp.name}
                              </span>
                              {active && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                            </div>
                            <p className="text-[11px] text-stone-500 dark:text-slate-400 mt-0.5">
                              {wp.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Persistent Backend Storage & Backup */}
                  <section className="pt-4 border-t border-stone-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-accent" />
                        <h3 className="text-xs font-semibold text-stone-900 dark:text-white">
                          Backend Saved Data
                        </h3>
                      </div>
                      <span className="text-[11px] text-stone-500 dark:text-slate-400 tabular-nums">
                        {backupSummary
                          ? `Saved ${new Date(backupSummary.savedAt).toLocaleTimeString([], {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}`
                          : 'Auto-save ready'}
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 dark:text-slate-400 leading-relaxed">
                      Chat themes, wallpapers, call logs (<span className="tabular-nums font-medium">{savedCallsCount}</span> saved), and workspace snapshots (
                      <span className="tabular-nums font-medium">{backupSummary?.roomsCount ?? 0}</span> groups ·{' '}
                      <span className="tabular-nums font-medium">{backupSummary?.messagesCount ?? 0}</span> messages) are saved on the server automatically alongside real-time Firestore sync.
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={savingBackup}
                        onClick={onSaveBackupNow}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent text-white text-xs font-medium disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${savingBackup ? 'animate-spin' : ''}`} />
                        <span>{savingBackup ? 'Saving...' : 'Save Backup Now'}</span>
                      </button>

                      {exportUrl && (
                        <a
                          href={exportUrl}
                          download="quadline-backup.json"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download JSON</span>
                        </a>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
