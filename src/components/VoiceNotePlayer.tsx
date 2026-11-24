import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AlertCircle, Download, Pause, Play } from 'lucide-react';
import {
  formatDuration,
  getVoiceEffectLabel,
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
  type VoiceEffectId,
} from '../lib/constants';

interface VoiceNotePlayerProps {
  src: string;
  durationSec?: number;
  waveform?: number[];
  voiceEffect?: VoiceEffectId;
  compact?: boolean;
}

const DEFAULT_WAVEFORM = [
  0.22, 0.35, 0.58, 0.44, 0.72, 0.85, 0.62, 0.48, 0.9, 0.76, 0.54, 0.38, 0.66, 0.82, 0.55, 0.4,
  0.74, 0.92, 0.68, 0.52, 0.45, 0.61, 0.79, 0.49, 0.36, 0.64, 0.88, 0.71, 0.46, 0.32, 0.52, 0.38,
];

export function VoiceNotePlayer({
  src,
  durationSec = 0,
  waveform,
  voiceEffect,
  compact = false,
}: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(durationSec > 0 ? durationSec : 0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const speed: PlaybackSpeed = PLAYBACK_SPEEDS[speedIdx];

  const bars = useMemo(() => {
    if (waveform && waveform.length >= 12) return waveform.slice(0, 40);
    return DEFAULT_WAVEFORM;
  }, [waveform]);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setLoadError(null);
    if (durationSec > 0) setTotalDuration(durationSec);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }
  }, [src, durationSec]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    setLoadError(null);
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      try {
        el.playbackRate = speed;
        if (el.readyState === 0) {
          el.load();
        }
        await el.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
        setLoadError('Could not play audio. Tap download to open directly.');
      }
    }
  };

  const seekAtClientX = (container: HTMLDivElement, clientX: number) => {
    const el = audioRef.current;
    if (!el) return;
    const effectiveDur =
      Number.isFinite(el.duration) && el.duration > 0 ? el.duration : totalDuration;
    if (!effectiveDur || effectiveDur <= 0) return;

    const rect = container.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const nextTime = ratio * effectiveDur;
    try {
      el.currentTime = nextTime;
      setCurrentTime(nextTime);
    } catch {
      // Ignore if metadata not loaded yet
    }
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    seekAtClientX(e.currentTarget, e.clientX);
  };

  const cycleSpeed = () => {
    setSpeedIdx((prev) => (prev + 1) % PLAYBACK_SPEEDS.length);
  };

  const effectiveTotal = totalDuration > 0 ? totalDuration : durationSec;
  const progress = effectiveTotal > 0 ? Math.min(1, currentTime / effectiveTotal) : 0;
  const downloadHref = src.startsWith('/api/media/') ? `${src}?download=1` : src;

  return (
    <div
      className={`rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-[#1C2128] ${
        compact ? 'p-2.5' : 'p-3 max-w-sm w-full'
      } space-y-2`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        playsInline
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) {
            setTotalDuration(d);
          }
          setLoadError(null);
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => {
          setPlaying(false);
          setLoadError('Audio unavailable on this device.');
        }}
      />

      <div className="flex items-center gap-2.5">
        <motion.button
          type="button"
          whileHover={prefersReducedMotion ? undefined : { scale: 1.06 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
          onClick={() => void togglePlay()}
          aria-label={playing ? 'Pause voice note' : 'Play voice note'}
          className="w-10 h-10 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-xs"
        >
          {playing ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </motion.button>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Interactive Seekable Waveform */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Seek voice note"
            aria-valuemin={0}
            aria-valuemax={Math.round(effectiveTotal)}
            aria-valuenow={Math.round(currentTime)}
            onClick={handleSeekClick}
            onKeyDown={(e) => {
              const el = audioRef.current;
              if (!el || effectiveTotal <= 0) return;
              if (e.key === 'ArrowRight') {
                const t = Math.min(effectiveTotal, el.currentTime + 5);
                el.currentTime = t;
                setCurrentTime(t);
              } else if (e.key === 'ArrowLeft') {
                const t = Math.max(0, el.currentTime - 5);
                el.currentTime = t;
                setCurrentTime(t);
              }
            }}
            className="h-9 flex items-center gap-[2px] cursor-pointer select-none touch-pan-y"
          >
            {bars.map((amp, idx) => {
              const barRatio = idx / Math.max(1, bars.length - 1);
              const filled = barRatio <= progress;
              const isHead = playing && Math.abs(barRatio - progress) < 0.04;
              const heightPct = Math.max(18, Math.min(100, Math.round(amp * 100)));
              return (
                <span
                  key={idx}
                  className={`flex-1 rounded-full transition-all duration-150 ${
                    isHead
                      ? 'bg-emerald-500 scale-y-110'
                      : filled
                        ? 'bg-emerald-600 dark:bg-emerald-400'
                        : 'bg-stone-300 dark:bg-slate-600'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-slate-400">
            <span className="font-mono-tabular">
              {formatDuration(playing || currentTime > 0 ? currentTime : effectiveTotal)}
              {playing || currentTime > 0 ? ` / ${formatDuration(effectiveTotal)}` : ''}
            </span>
            {voiceEffect && voiceEffect !== 'normal' && (
              <span className="text-emerald-700 dark:text-emerald-400 font-medium truncate">
                {getVoiceEffectLabel(voiceEffect)} voice
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={cycleSpeed}
            aria-label={`Playback speed ${speed}x`}
            title="Change playback speed (1x, 1.5x, 2x)"
            className="px-2 py-1.5 rounded-lg text-[11px] font-mono-tabular font-semibold bg-white dark:bg-[#0D1117] border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-200 hover:border-emerald-500 transition-colors cursor-pointer"
          >
            {speed}x
          </button>

          {!compact && (
            <a
              href={downloadHref}
              download="voice-note.wav"
              aria-label="Download voice note"
              title="Download audio"
              className="p-1.5 rounded-lg text-stone-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}
    </div>
  );
}
