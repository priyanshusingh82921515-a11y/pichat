import React, { useEffect, useId, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Check,
  Film,
  Image as ImageIcon,
  Plus,
  Send,
  Sparkles,
  Sticker,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  buildCustomGifSvg,
  buildCustomStickerSvg,
  compressPhotoForStudio,
  STUDIO_EMOJIS,
  STUDIO_GRADIENTS,
  type GifMotionType,
  type GifSpeed,
  type StickerShape,
} from '../lib/stickersAndGifs';
import { saveCustomStudioMedia, type CustomStudioMedia } from '../lib/backendApi';

interface StickerGifStudioModalProps {
  open: boolean;
  initialTab: 'sticker' | 'gif';
  currentUid: string;
  onClose: () => void;
  onCreated: (item: CustomStudioMedia, sendNow: boolean) => Promise<void>;
}

const SHAPES: Array<{ id: StickerShape; label: string }> = [
  { id: 'rounded', label: 'Rounded' },
  { id: 'circle', label: 'Circle' },
  { id: 'badge', label: 'Badge' },
];

const MOTIONS: Array<{ id: GifMotionType; label: string }> = [
  { id: 'bounce', label: 'Bounce' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'spin', label: 'Tilt Spin' },
  { id: 'wave', label: 'Wave' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'glitch', label: 'Glitch' },
];

const SPEEDS: Array<{ id: GifSpeed; label: string }> = [
  { id: 'chill', label: 'Chill' },
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Fast' },
];

export function StickerGifStudioModal({
  open,
  initialTab,
  currentUid,
  onClose,
  onCreated,
}: StickerGifStudioModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const stickerFileId = useId();
  const gifFileId = useId();

  const [tab, setTab] = useState<'sticker' | 'gif'>(initialTab);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sticker Maker State
  const [stickerMode, setStickerMode] = useState<'emoji' | 'photo'>('emoji');
  const [stickerEmoji, setStickerEmoji] = useState('🔥');
  const [stickerPhoto, setStickerPhoto] = useState<string>('');
  const [stickerCaption, setStickerCaption] = useState('SO LIT!');
  const [stickerPaletteIdx, setStickerPaletteIdx] = useState(0);
  const [stickerShape, setStickerShape] = useState<StickerShape>('rounded');
  const [stickerRotate, setStickerRotate] = useState(-3);

  // GIF Maker State
  const [gifMode, setGifMode] = useState<'text' | 'photo'>('text');
  const [gifEmoji, setGifEmoji] = useState('🚀');
  const [gifSubEmoji, setGifSubEmoji] = useState('✨');
  const [gifTitle, setGifTitle] = useState('LETS GO!!');
  const [gifSubtitle, setGifSubtitle] = useState('Made in Quadline Studio');
  const [gifPaletteIdx, setGifPaletteIdx] = useState(3);
  const [gifMotion, setGifMotion] = useState<GifMotionType>('bounce');
  const [gifSpeed, setGifSpeed] = useState<GifSpeed>('normal');
  const [gifPhotoFrames, setGifPhotoFrames] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
    }
  }, [open, initialTab]);

  const stickerPalette = STUDIO_GRADIENTS[stickerPaletteIdx] || STUDIO_GRADIENTS[0];
  const gifPalette = STUDIO_GRADIENTS[gifPaletteIdx] || STUDIO_GRADIENTS[0];

  const stickerPreviewUrl = useMemo(
    () =>
      buildCustomStickerSvg({
        mode: stickerMode,
        emoji: stickerEmoji,
        photoDataUrl: stickerPhoto,
        caption: stickerCaption,
        bg1: stickerPalette.bg1,
        bg2: stickerPalette.bg2,
        borderColor: stickerPalette.accent,
        shape: stickerShape,
        rotate: stickerRotate,
      }),
    [
      stickerMode,
      stickerEmoji,
      stickerPhoto,
      stickerCaption,
      stickerPalette,
      stickerShape,
      stickerRotate,
    ]
  );

  const gifPreviewUrl = useMemo(
    () =>
      buildCustomGifSvg({
        mode: gifMode,
        emoji: gifEmoji,
        subEmoji: gifSubEmoji,
        title: gifTitle,
        subtitle: gifSubtitle,
        bg1: gifPalette.bg1,
        bg2: gifPalette.bg2,
        motionType: gifMotion,
        speed: gifSpeed,
        photoFrames: gifPhotoFrames,
      }),
    [
      gifMode,
      gifEmoji,
      gifSubEmoji,
      gifTitle,
      gifSubtitle,
      gifPalette,
      gifMotion,
      gifSpeed,
      gifPhotoFrames,
    ]
  );

  const handleStickerPhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const compact = await compressPhotoForStudio(file, 300);
      setStickerPhoto(compact);
      setStickerMode('photo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load photo.');
    }
  };

  const handleGifPhotosPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    e.target.value = '';
    if (files.length === 0) return;
    setError(null);
    try {
      const maxDim = files.length > 2 ? 240 : 300;
      const compressed = await Promise.all(files.map((f) => compressPhotoForStudio(f, maxDim)));
      setGifPhotoFrames((prev) => [...prev, ...compressed].slice(0, 5));
      setGifMode('photo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load photo frames.');
    }
  };

  const handleSave = async (sendNow: boolean) => {
    if (saving) return;
    setError(null);

    if (tab === 'sticker' && stickerMode === 'photo' && !stickerPhoto) {
      setError('Pick a photo from your device or switch to Emoji mode.');
      return;
    }
    if (tab === 'gif' && gifMode === 'photo' && gifPhotoFrames.length === 0) {
      setError('Add 1 to 5 photos to animate, or switch to Text & Emoji mode.');
      return;
    }

    const kind = tab;
    const dataUrl = kind === 'sticker' ? stickerPreviewUrl : gifPreviewUrl;
    if (dataUrl.length > 470_000) {
      setError('This photo animation is a bit large — try using 2 to 3 photos instead.');
      return;
    }

    const label =
      kind === 'sticker'
        ? (stickerCaption.trim() || `${stickerEmoji} Sticker`).slice(0, 48)
        : (gifTitle.trim() || `${gifEmoji} Custom GIF`).slice(0, 48);

    setSaving(true);
    try {
      const savedRes = await saveCustomStudioMedia({
        uid: currentUid,
        kind,
        label,
        dataUrl,
      });

      const finalItem: CustomStudioMedia = savedRes.item || {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        uid: currentUid,
        kind,
        label,
        dataUrl,
        createdAt: Date.now(),
      };

      await onCreated(finalItem, sendNow);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save right now.');
    } finally {
      setSaving(false);
    }
  };

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
          aria-label="Sticker and GIF Maker Studio"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col pb-[env(safe-area-inset-bottom)] sm:pb-0"
          >
            {/* Hidden file pickers */}
            <input
              id={stickerFileId}
              type="file"
              accept="image/*"
              onChange={handleStickerPhotoPicked}
              className="sr-only"
            />
            <input
              id={gifFileId}
              type="file"
              accept="image/*"
              multiple
              onChange={handleGifPhotosPicked}
              className="sr-only"
            />

            {/* Header */}
            <div className="px-5 py-3.5 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-soft flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-sm font-bold text-stone-900 dark:text-white truncate">
                    Sticker & GIF Studio
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-slate-400 truncate">
                    Design custom stickers & animated GIFs to save and send in any chat
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close studio"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Studio Mode Tabs */}
            <div className="px-5 py-2.5 border-b border-stone-100 dark:border-slate-800/80 shrink-0">
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setTab('sticker');
                    setError(null);
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    tab === 'sticker'
                      ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  <Sticker className="w-3.5 h-3.5" />
                  <span>Sticker Maker</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('gif');
                    setError(null);
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    tab === 'gif'
                      ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Animated GIF Maker</span>
                </button>
              </div>
            </div>

            {/* Studio Body */}
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* Left Column: Live Preview Canvas */}
                <div className="md:col-span-5 space-y-3 md:sticky md:top-0">
                  <div
                    className={`rounded-2xl border border-stone-200 dark:border-slate-800 p-4 flex items-center justify-center min-h-[220px] relative overflow-hidden ${
                      tab === 'sticker'
                        ? 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:14px_14px] bg-stone-50 dark:bg-[#0D1117]'
                        : 'bg-[#090D16]'
                    }`}
                  >
                    <img
                      src={tab === 'sticker' ? stickerPreviewUrl : gifPreviewUrl}
                      alt={tab === 'sticker' ? 'Custom sticker preview' : 'Custom animated GIF preview'}
                      referrerPolicy="no-referrer"
                      className={
                        tab === 'sticker'
                          ? 'w-44 h-44 object-contain drop-shadow-md select-none'
                          : 'w-full max-w-[280px] rounded-xl object-contain shadow-lg select-none'
                      }
                    />
                  </div>
                  <p className="text-[11px] text-center text-stone-500 dark:text-slate-400">
                    {tab === 'sticker'
                      ? 'Die-cut vinyl sticker preview — saves straight to My Stickers'
                      : 'Live looping animation preview — saves straight to My GIFs'}
                  </p>
                </div>

                {/* Right Column: Controls */}
                <div className="md:col-span-7 space-y-4">
                  {tab === 'sticker' ? (
                    <>
                      {/* Source Mode: Emoji vs Photo */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setStickerMode('emoji')}
                          className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                            stickerMode === 'emoji'
                              ? 'border-accent bg-accent-soft text-accent-soft'
                              : 'border-stone-200 dark:border-slate-700 text-stone-600 dark:text-slate-300'
                          }`}
                        >
                          <span>Emoji Sticker</span>
                        </button>
                        <label
                          htmlFor={stickerFileId}
                          className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                            stickerMode === 'photo'
                              ? 'border-accent bg-accent-soft text-accent-soft'
                              : 'border-stone-200 dark:border-slate-700 text-stone-600 dark:text-slate-300 hover:bg-stone-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>{stickerPhoto ? 'Change Photo' : 'Photo Sticker'}</span>
                        </label>
                      </div>

                      {stickerMode === 'emoji' && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                            Pick Center Emoji
                          </label>
                          <div className="grid grid-cols-10 gap-1 p-2 rounded-xl bg-stone-50 dark:bg-slate-900/80 border border-stone-200 dark:border-slate-800">
                            {STUDIO_EMOJIS.map((em) => (
                              <button
                                key={em}
                                type="button"
                                onClick={() => setStickerEmoji(em)}
                                className={`h-8 rounded-lg text-base flex items-center justify-center cursor-pointer transition-transform ${
                                  stickerEmoji === em
                                    ? 'bg-white dark:bg-slate-800 ring-2 ring-emerald-500 scale-110'
                                    : 'hover:bg-stone-200/70 dark:hover:bg-slate-800'
                                }`}
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Caption Input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                          Sticker Text (Optional)
                        </label>
                        <input
                          type="text"
                          value={stickerCaption}
                          maxLength={22}
                          onChange={(e) => setStickerCaption(e.target.value)}
                          placeholder="e.g. ON MY WAY, PURE VIBES"
                          className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-sm text-stone-900 dark:text-white focus:outline-none focus:border-accent"
                        />
                      </div>

                      {/* Shape & Tilt */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <span className="text-xs font-semibold text-stone-700 dark:text-slate-300 block">
                            Cutout Shape
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {SHAPES.map((sh) => (
                              <button
                                key={sh.id}
                                type="button"
                                onClick={() => setStickerShape(sh.id)}
                                className={`py-2 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                                  stickerShape === sh.id
                                    ? 'border-accent bg-accent-soft text-accent-soft'
                                    : 'border-stone-200 dark:border-slate-700 text-stone-600 dark:text-slate-300'
                                }`}
                              >
                                {sh.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-stone-700 dark:text-slate-300">
                              Sticker Tilt
                            </span>
                            <span className="font-mono-tabular text-stone-500 dark:text-slate-400">
                              {stickerRotate}°
                            </span>
                          </div>
                          <input
                            type="range"
                            min={-15}
                            max={15}
                            value={stickerRotate}
                            onChange={(e) => setStickerRotate(Number(e.target.value))}
                            className="w-full accent-emerald-600 cursor-pointer mt-1.5"
                          />
                        </div>
                      </div>

                      {/* Gradient Palette */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-stone-700 dark:text-slate-300 block">
                          Color & Border Theme
                        </span>
                        <div className="grid grid-cols-4 gap-2">
                          {STUDIO_GRADIENTS.map((pal, idx) => (
                            <button
                              key={pal.id}
                              type="button"
                              onClick={() => setStickerPaletteIdx(idx)}
                              className={`flex items-center gap-1.5 p-1.5 rounded-xl border text-left cursor-pointer transition-colors ${
                                stickerPaletteIdx === idx
                                  ? 'border-accent bg-accent-soft'
                                  : 'border-stone-200 dark:border-slate-800 hover:border-stone-300 dark:hover:border-slate-700'
                              }`}
                            >
                              <span
                                className="w-5 h-5 rounded-lg shrink-0 flex items-center justify-center text-white"
                                style={{
                                  background: `linear-gradient(135deg, ${pal.bg1}, ${pal.bg2})`,
                                }}
                              >
                                {stickerPaletteIdx === idx && <Check className="w-3 h-3" />}
                              </span>
                              <span className="text-[11px] font-medium text-stone-700 dark:text-slate-200 truncate">
                                {pal.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* GIF Source Mode */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setGifMode('text')}
                          className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                            gifMode === 'text'
                              ? 'border-accent bg-accent-soft text-accent-soft'
                              : 'border-stone-200 dark:border-slate-700 text-stone-600 dark:text-slate-300'
                          }`}
                        >
                          <span>Animated Text & Emoji</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGifMode('photo')}
                          className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                            gifMode === 'photo'
                              ? 'border-accent bg-accent-soft text-accent-soft'
                              : 'border-stone-200 dark:border-slate-700 text-stone-600 dark:text-slate-300'
                          }`}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Photo-to-GIF ({gifPhotoFrames.length}/5)</span>
                        </button>
                      </div>

                      {gifMode === 'photo' && (
                        <div className="space-y-2 p-3 rounded-xl bg-stone-50 dark:bg-slate-900/70 border border-stone-200 dark:border-slate-800">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-stone-700 dark:text-slate-200">
                              Photo Frames (1 photo = zoom motion, 2–5 = slideshow)
                            </span>
                            <label
                              htmlFor={gifFileId}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent text-white text-[11px] font-semibold cursor-pointer shrink-0"
                            >
                              <Upload className="w-3 h-3" />
                              <span>Add Photos</span>
                            </label>
                          </div>

                          {gifPhotoFrames.length > 0 ? (
                            <div className="flex items-center gap-2 overflow-x-auto pt-1">
                              {gifPhotoFrames.map((src, i) => (
                                <div
                                  key={`${i}-${src.slice(0, 24)}`}
                                  className="relative w-16 h-12 rounded-lg overflow-hidden border border-stone-300 dark:border-slate-700 shrink-0"
                                >
                                  <img
                                    src={src}
                                    alt={`Frame ${i + 1}`}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setGifPhotoFrames((prev) => prev.filter((_, idx) => idx !== i))
                                    }
                                    aria-label={`Remove frame ${i + 1}`}
                                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center cursor-pointer"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-stone-500 dark:text-slate-400">
                              Upload 1 to 5 photos from your gallery to create a looping animated GIF.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Headline & Subtitle */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                            Headline Text
                          </label>
                          <input
                            type="text"
                            value={gifTitle}
                            maxLength={26}
                            onChange={(e) => setGifTitle(e.target.value)}
                            placeholder="e.g. BIG W!!"
                            className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-accent"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                            Subtitle
                          </label>
                          <input
                            type="text"
                            value={gifSubtitle}
                            maxLength={34}
                            onChange={(e) => setGifSubtitle(e.target.value)}
                            placeholder="Optional smaller caption"
                            className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>

                      {/* Main Emoji Picker */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-stone-700 dark:text-slate-300">
                            Animated Emoji
                          </span>
                          {gifMode === 'text' && (
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-stone-500 dark:text-slate-400">
                                Sparkle:
                              </span>
                              {['✨', '⚡', '🔥', '💫', '❤️', '🎵'].map((sEm) => (
                                <button
                                  key={sEm}
                                  type="button"
                                  onClick={() => setGifSubEmoji(sEm)}
                                  className={`w-6 h-6 rounded-md text-xs flex items-center justify-center cursor-pointer ${
                                    gifSubEmoji === sEm
                                      ? 'bg-accent-soft ring-1 ring-emerald-500'
                                      : 'hover:bg-stone-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  {sEm}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-10 gap-1 p-2 rounded-xl bg-stone-50 dark:bg-slate-900/80 border border-stone-200 dark:border-slate-800">
                          {STUDIO_EMOJIS.slice(0, 20).map((em) => (
                            <button
                              key={em}
                              type="button"
                              onClick={() => setGifEmoji(em)}
                              className={`h-8 rounded-lg text-base flex items-center justify-center cursor-pointer ${
                                gifEmoji === em
                                  ? 'bg-white dark:bg-slate-800 ring-2 ring-emerald-500'
                                  : 'hover:bg-stone-200/70 dark:hover:bg-slate-800'
                              }`}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Motion Style & Speed */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-8 space-y-1.5">
                          <span className="text-xs font-semibold text-stone-700 dark:text-slate-300 block">
                            Animation Style
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            {MOTIONS.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setGifMotion(m.id)}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                                  gifMotion === m.id
                                    ? 'border-accent bg-accent-soft text-accent-soft'
                                    : 'border-stone-200 dark:border-slate-700 text-stone-600 dark:text-slate-300'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="sm:col-span-4 space-y-1.5">
                          <span className="text-xs font-semibold text-stone-700 dark:text-slate-300 block">
                            Speed
                          </span>
                          <div className="grid grid-cols-3 sm:grid-cols-1 gap-1.5">
                            {SPEEDS.map((sp) => (
                              <button
                                key={sp.id}
                                type="button"
                                onClick={() => setGifSpeed(sp.id)}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
                                  gifSpeed === sp.id
                                    ? 'border-accent bg-accent-soft text-accent-soft'
                                    : 'border-stone-200 dark:border-slate-700 text-stone-600 dark:text-slate-300'
                                }`}
                              >
                                {sp.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Background Gradient (Text GIF mode) */}
                      {gifMode === 'text' && (
                        <div className="space-y-1.5">
                          <span className="text-xs font-semibold text-stone-700 dark:text-slate-300 block">
                            Backdrop Gradient
                          </span>
                          <div className="grid grid-cols-4 gap-2">
                            {STUDIO_GRADIENTS.map((pal, idx) => (
                              <button
                                key={pal.id}
                                type="button"
                                onClick={() => setGifPaletteIdx(idx)}
                                className={`flex items-center gap-1.5 p-1.5 rounded-xl border text-left cursor-pointer transition-colors ${
                                  gifPaletteIdx === idx
                                    ? 'border-accent bg-accent-soft'
                                    : 'border-stone-200 dark:border-slate-800 hover:border-stone-300 dark:hover:border-slate-700'
                                }`}
                              >
                                <span
                                  className="w-5 h-5 rounded-lg shrink-0 flex items-center justify-center text-white"
                                  style={{
                                    background: `linear-gradient(135deg, ${pal.bg1}, ${pal.bg2})`,
                                  }}
                                >
                                  {gifPaletteIdx === idx && <Check className="w-3 h-3" />}
                                </span>
                                <span className="text-[11px] font-medium text-stone-700 dark:text-slate-200 truncate">
                                  {pal.name}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div className="mt-4 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 text-xs text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
            </div>

            {/* Footer Action Bar */}
            <div className="px-5 py-3.5 border-t border-stone-200 dark:border-slate-800 bg-stone-50/70 dark:bg-[#12161D] flex items-center justify-between gap-2.5 flex-wrap shrink-0">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave(false)}
                className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-[#1C2128] text-stone-800 dark:text-slate-100 hover:bg-stone-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save to My {tab === 'sticker' ? 'Stickers' : 'GIFs'}</span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave(true)}
                className="inline-flex items-center gap-1.5 min-h-[42px] px-5 rounded-xl bg-accent text-white text-xs font-semibold shadow-sm transition-opacity cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : `Save & Send ${tab === 'sticker' ? 'Sticker' : 'GIF'}`}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
