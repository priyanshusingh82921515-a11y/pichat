import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  AudioLines,
  Camera,
  CameraOff,
  Captions,
  Check,
  CircleDot,
  Download,
  FlipHorizontal2,
  Hand,
  Headphones,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  Music,
  Palette,
  Phone,
  PhoneOff,
  PictureInPicture2,
  RefreshCw,
  Send,
  ShieldCheck,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Sparkles,
  Square,
  Video,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { Avatar } from './Avatar';
import {
  formatDuration,
  getVoiceEffectLabel,
  VOICE_EFFECTS,
  type VoiceEffectId,
} from '../lib/constants';
import type { ActiveCallViewModel } from '../hooks/useWebRTCCall';
import type { CallSignalPayload } from '../types/chat';

interface CallOverlayProps {
  call: ActiveCallViewModel;
  currentUserName?: string;
  sendCallSignal?: (signal: CallSignalPayload) => boolean;
  subscribeCallSignals?: (listener: (signal: CallSignalPayload) => void) => () => void;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onToggleScreenShare: () => void;
  onStopScreenShare: () => void;
  onSelectVoiceEffect: (effect: VoiceEffectId) => void;
  onToggleMonitorVoice?: () => void;
}

type VideoFilterId = 'normal' | 'warm' | 'cinema' | 'vivid' | 'cool' | 'soft';
type SoundFxId = 'applause' | 'drumroll' | 'airhorn' | 'bell' | 'whoosh' | 'victory';

interface FloatingReaction {
  id: string;
  emoji: string;
  sender: string;
  xPercent: number;
}

interface InCallMessage {
  id: string;
  sender: string;
  text: string;
  isMine: boolean;
  timestamp: string;
}

const QUALITY_META = {
  excellent: { label: 'Excellent', color: 'text-emerald-400', Icon: SignalHigh },
  good: { label: 'Good', color: 'text-emerald-300', Icon: Signal },
  fair: { label: 'Fair', color: 'text-amber-300', Icon: SignalMedium },
  poor: { label: 'Poor', color: 'text-red-400', Icon: SignalLow },
  unknown: { label: 'Measuring', color: 'text-slate-400', Icon: Signal },
} as const;

const VIDEO_FILTERS: { id: VideoFilterId; label: string; css: string }[] = [
  { id: 'normal', label: 'Normal', css: 'none' },
  { id: 'warm', label: 'Warm Glow', css: 'sepia(0.22) saturate(1.25) brightness(1.04)' },
  { id: 'cinema', label: 'Cinema B&W', css: 'grayscale(1) contrast(1.18)' },
  { id: 'vivid', label: 'Vivid Pop', css: 'saturate(1.45) contrast(1.08)' },
  { id: 'cool', label: 'Cool Night', css: 'hue-rotate(18deg) saturate(1.15) brightness(0.96)' },
  { id: 'soft', label: 'Soft Focus', css: 'brightness(1.08) contrast(0.94) saturate(1.1)' },
];

const QUICK_REACTIONS = ['❤️', '🔥', '😂', '👏', '🎉', '👍'];

const SOUNDBOARD_ITEMS: { id: SoundFxId; label: string; emoji: string }[] = [
  { id: 'applause', label: 'Cheer', emoji: '👏' },
  { id: 'bell', label: 'Ding', emoji: '🔔' },
  { id: 'victory', label: 'Win', emoji: '🏆' },
  { id: 'drumroll', label: 'Drums', emoji: '🥁' },
  { id: 'airhorn', label: 'Horn', emoji: '📢' },
  { id: 'whoosh', label: 'Whoosh', emoji: '💨' },
];

function playSynthesizedSoundFx(id: SoundFxId) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.24;
    master.connect(ctx.destination);

    if (id === 'bell') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, now);
      osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08);
      g.gain.setValueAtTime(0.6, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc.connect(g).connect(master);
      osc.start(now);
      osc.stop(now + 0.78);
    } else if (id === 'victory') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        const t = now + idx * 0.1;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.45, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(g).connect(master);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    } else if (id === 'airhorn') {
      [440, 554.37, 659.25].forEach((freq) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.28, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(g).connect(master);
        osc.start(now);
        osc.stop(now + 0.58);
      });
    } else if (id === 'drumroll') {
      for (let i = 0; i < 8; i++) {
        const t = now + i * 0.065;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(175 + i * 8, t);
        osc.frequency.exponentialRampToValueAtTime(75, t + 0.05);
        g.gain.setValueAtTime(0.45, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
        osc.connect(g).connect(master);
        osc.start(t);
        osc.stop(t + 0.06);
      }
    } else if (id === 'whoosh') {
      const bufferSize = Math.floor(ctx.sampleRate * 0.45);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(2200, now + 0.22);
      filter.frequency.exponentialRampToValueAtTime(260, now + 0.44);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.01, now);
      g.gain.linearRampToValueAtTime(0.65, now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      noise.connect(filter).connect(g).connect(master);
      noise.start(now);
      noise.stop(now + 0.45);
    } else {
      // Applause / bright cheer burst
      for (let i = 0; i < 6; i++) {
        const t = now + i * 0.075;
        const bufferSize = Math.floor(ctx.sampleRate * 0.06);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < bufferSize; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1200 + (i % 3) * 350;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
        src.connect(bp).connect(g).connect(master);
        src.start(t);
        src.stop(t + 0.065);
      }
    }

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch {
    // Ignore if audio context unavailable
  }
}

export function CallOverlay({
  call,
  currentUserName = 'You',
  sendCallSignal,
  subscribeCallSignals,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onToggleScreenShare,
  onStopScreenShare,
  onSelectVoiceEffect,
  onToggleMonitorVoice,
}: CallOverlayProps) {
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const miniVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const [effectMenuOpen, setEffectMenuOpen] = useState(false);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [inCallChatOpen, setInCallChatOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [audioBars, setAudioBars] = useState<number[]>([0.2, 0.3, 0.25, 0.4, 0.25, 0.3, 0.2]);
  const prefersReducedMotion = useReducedMotion();
  const callHistoryPushedRef = useRef(false);

  // 10+ Call Add-Ons State
  const [videoFilter, setVideoFilter] = useState<VideoFilterId>('normal');
  const [mirrorVideo, setMirrorVideo] = useState<boolean>(false);
  const [handRaised, setHandRaised] = useState(false);
  const [peerHandRaised, setPeerHandRaised] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [speakerVolume, setSpeakerVolume] = useState(1);
  const [noiseReductionOn, setNoiseReductionOn] = useState(true);
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [addonNotice, setAddonNotice] = useState<string | null>(null);
  const [inCallMessages, setInCallMessages] = useState<InCallMessage[]>([]);
  const [inCallDraft, setInCallDraft] = useState('');
  const [unreadInCallCount, setUnreadInCallCount] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const addonNoticeTimerRef = useRef<number | null>(null);

  const showAddonToast = useCallback((msg: string) => {
    setAddonNotice(msg);
    if (addonNoticeTimerRef.current !== null) {
      window.clearTimeout(addonNoticeTimerRef.current);
    }
    addonNoticeTimerRef.current = window.setTimeout(() => {
      setAddonNotice(null);
      addonNoticeTimerRef.current = null;
    }, 2600);
  }, []);

  const remoteHasVideo = Boolean(
    call.remoteStream?.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled)
  );
  const localHasVideo = Boolean(
    call.localStream?.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled)
  );

  // Reset call-scoped states when a brand-new call starts or ends
  useEffect(() => {
    if (call.status === 'idle' || call.status === 'ringing') {
      setMinimized(false);
      setEffectMenuOpen(false);
      setAddonsOpen(false);
      setInCallChatOpen(false);
      setHandRaised(false);
      setPeerHandRaised(false);
      setFloatingReactions([]);
      setInCallMessages([]);
      setUnreadInCallCount(0);
      setCaptionText('');
      setCaptionsEnabled(false);
      setVideoFilter('normal');
      setMirrorVideo(false);
      callHistoryPushedRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore
        }
      }
      setIsRecordingCall(false);
      setRecordingSec(0);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
        recognitionRef.current = null;
      }
    }
  }, [call.status, call.callId]);

  // Spawn a floating reaction bubble
  const spawnReaction = useCallback((emoji: string, sender: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const xPercent = 18 + Math.round(Math.random() * 64);
    setFloatingReactions((prev) => [...prev.slice(-10), { id, emoji, sender, xPercent }]);
    window.setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((item) => item.id !== id));
    }, 2400);
  }, []);

  // Subscribe to peer Call Add-On signals (reactions, hand raise, in-call chat, soundboard)
  useEffect(() => {
    if (!subscribeCallSignals || call.status === 'idle') return;
    return subscribeCallSignals((signal) => {
      if (signal.callId && call.callId && signal.callId !== call.callId) return;
      const senderName = String(signal.fromName || call.peer?.displayName || 'Peer');

      if (signal.type === 'call:reaction' && typeof signal.emoji === 'string') {
        spawnReaction(signal.emoji, senderName);
      } else if (signal.type === 'call:hand_raise') {
        const raised = Boolean(signal.raised);
        setPeerHandRaised(raised);
        showAddonToast(raised ? `${senderName} raised their hand ✋` : `${senderName} lowered hand`);
      } else if (signal.type === 'call:sound_fx' && typeof signal.fxId === 'string') {
        playSynthesizedSoundFx(signal.fxId as SoundFxId);
        showAddonToast(`${senderName} played ${String(signal.label || 'sound FX')}`);
      } else if (signal.type === 'call:chat' && typeof signal.text === 'string' && signal.text.trim()) {
        const msgItem: InCallMessage = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sender: senderName,
          text: signal.text.trim(),
          isMine: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setInCallMessages((prev) => [...prev.slice(-40), msgItem]);
        setUnreadInCallCount((c) => (inCallChatOpen ? 0 : c + 1));
      }
    });
  }, [subscribeCallSignals, call.status, call.callId, call.peer?.displayName, inCallChatOpen, spawnReaction, showAddonToast]);

  // Keep remote audio playing continuously whether fullscreen, minimized, or switching apps
  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    if (!audioEl) return;
    audioEl.srcObject = call.isTestMode ? null : call.remoteStream;
    audioEl.volume = speakerVolume;
    audioEl.muted = speakerMuted;
    if (!call.isTestMode && call.remoteStream) {
      audioEl.play().catch(() => {});
    }
  }, [call.remoteStream, call.isTestMode, call.status, speakerVolume, speakerMuted]);

  // Re-trigger playback cleanly when returning from another app
  useEffect(() => {
    if (call.status === 'idle') return;
    const onVisibility = () => {
      if (!document.hidden) {
        if (remoteAudioRef.current && !call.isTestMode && call.remoteStream) {
          remoteAudioRef.current.play().catch(() => {});
        }
        remoteVideoRef.current?.play().catch(() => {});
        miniVideoRef.current?.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [call.status, call.isTestMode, call.remoteStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = call.remoteStream;
    }
    if (miniVideoRef.current) {
      miniVideoRef.current.srcObject = call.remoteStream;
    }
  }, [call.remoteStream, minimized, remoteHasVideo]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = call.localStream;
    }
  }, [call.localStream, localHasVideo, minimized]);

  // Android / browser Back button minimizes the full-screen call so it runs smoothly in background
  useEffect(() => {
    const isFullCall = call.status !== 'idle' && call.status !== 'ringing' && !minimized;
    if (!isFullCall) return;

    if (!callHistoryPushedRef.current) {
      try {
        window.history.pushState({ quadlineCallFull: true }, '');
        callHistoryPushedRef.current = true;
      } catch {
        // Ignore history restrictions
      }
    }

    const handlePopState = () => {
      if (callHistoryPushedRef.current) {
        callHistoryPushedRef.current = false;
        setEffectMenuOpen(false);
        setAddonsOpen(false);
        setInCallChatOpen(false);
        setMinimized(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [call.status, minimized]);

  // Register MediaSession hangup & mic controls while in call (background notification shade controls)
  useEffect(() => {
    if (call.status === 'idle' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('pause', () => onToggleMute());
      navigator.mediaSession.setActionHandler('play', () => onToggleMute());
      navigator.mediaSession.setActionHandler('stop', () => onEnd());
    } catch {
      // Ignore unsupported actions
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('stop', null);
      } catch {
        // Ignore
      }
    };
  }, [call.status, onToggleMute, onEnd]);

  // Track native Picture-in-Picture state (lets video float over OTHER apps on phone & laptop)
  useEffect(() => {
    const onEnter = () => setIsPipActive(true);
    const onLeave = () => setIsPipActive(false);
    document.addEventListener('enterpictureinpicture', onEnter);
    document.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      document.removeEventListener('enterpictureinpicture', onEnter);
      document.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, []);

  // Recording elapsed timer
  useEffect(() => {
    if (!isRecordingCall) return;
    const id = window.setInterval(() => setRecordingSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [isRecordingCall]);

  // Live Captions via Browser SpeechRecognition API
  useEffect(() => {
    if (!captionsEnabled || call.status === 'idle') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore
        }
        recognitionRef.current = null;
      }
      return;
    }

    type SpeechRecCtor = new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((ev: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };

    const win = window as unknown as {
      SpeechRecognition?: SpeechRecCtor;
      webkitSpeechRecognition?: SpeechRecCtor;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setCaptionText('Live captions require Chrome, Edge, or Android browser speech support.');
      return;
    }

    let stopped = false;
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (ev) => {
      const len = ev.results.length;
      if (len > 0) {
        const latest = ev.results[len - 1]?.[0]?.transcript || '';
        if (latest.trim()) setCaptionText(latest.trim());
      }
    };
    rec.onerror = () => {
      // Keep quiet on minor no-speech pauses
    };
    rec.onend = () => {
      if (!stopped) {
        try {
          rec.start();
        } catch {
          // Ignore
        }
      }
    };
    try {
      rec.start();
      recognitionRef.current = rec;
      setCaptionText('Listening for live captions…');
    } catch {
      setCaptionText('Could not start live captions microphone listener.');
    }

    return () => {
      stopped = true;
      try {
        rec.stop();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    };
  }, [captionsEnabled, call.status]);

  const canUsePip =
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    Boolean((document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled) &&
    remoteHasVideo;

  const handleTogglePip = useCallback(async () => {
    const docPip = document as Document & {
      pictureInPictureElement?: Element | null;
      exitPictureInPicture?: () => Promise<void>;
    };
    try {
      if (docPip.pictureInPictureElement && docPip.exitPictureInPicture) {
        await docPip.exitPictureInPicture();
        return;
      }
      const videoEl = (minimized ? miniVideoRef.current : remoteVideoRef.current) as
        | (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> })
        | null;
      if (videoEl && typeof videoEl.requestPictureInPicture === 'function') {
        await videoEl.requestPictureInPicture();
      }
    } catch {
      showAddonToast('Picture-in-Picture blocked by browser');
    }
  }, [minimized, showAddonToast]);

  const handleMinimize = useCallback(() => {
    setEffectMenuOpen(false);
    setAddonsOpen(false);
    setInCallChatOpen(false);
    setMinimized(true);
    callHistoryPushedRef.current = false;
  }, []);

  const handleExpand = useCallback(() => {
    setMinimized(false);
  }, []);

  // Add-On Handlers
  const handleSendReaction = useCallback(
    (emoji: string) => {
      spawnReaction(emoji, 'You');
      if (sendCallSignal && call.peer && !call.isTestMode) {
        sendCallSignal({
          type: 'call:reaction',
          callId: call.callId || undefined,
          targetUid: call.peer.uid,
          fromName: currentUserName,
          emoji,
        });
      }
    },
    [spawnReaction, sendCallSignal, call.peer, call.isTestMode, call.callId, currentUserName]
  );

  const handleToggleRaiseHand = useCallback(() => {
    const next = !handRaised;
    setHandRaised(next);
    showAddonToast(next ? 'You raised your hand ✋' : 'Hand lowered');
    if (sendCallSignal && call.peer && !call.isTestMode) {
      sendCallSignal({
        type: 'call:hand_raise',
        callId: call.callId || undefined,
        targetUid: call.peer.uid,
        fromName: currentUserName,
        raised: next,
      });
    }
  }, [handRaised, sendCallSignal, call.peer, call.isTestMode, call.callId, currentUserName, showAddonToast]);

  const handlePlaySoundFx = useCallback(
    (item: { id: SoundFxId; label: string; emoji: string }) => {
      playSynthesizedSoundFx(item.id);
      showAddonToast(`Played ${item.emoji} ${item.label}`);
      if (sendCallSignal && call.peer && !call.isTestMode) {
        sendCallSignal({
          type: 'call:sound_fx',
          callId: call.callId || undefined,
          targetUid: call.peer.uid,
          fromName: currentUserName,
          fxId: item.id,
          label: `${item.emoji} ${item.label}`,
        });
      }
    },
    [sendCallSignal, call.peer, call.isTestMode, call.callId, currentUserName, showAddonToast]
  );

  const handleSendInCallMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = inCallDraft.trim();
      if (!text) return;
      const msgItem: InCallMessage = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sender: 'You',
        text,
        isMine: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setInCallMessages((prev) => [...prev.slice(-40), msgItem]);
      setInCallDraft('');
      if (sendCallSignal && call.peer && !call.isTestMode) {
        sendCallSignal({
          type: 'call:chat',
          callId: call.callId || undefined,
          targetUid: call.peer.uid,
          fromName: currentUserName,
          text,
        });
      }
    },
    [inCallDraft, sendCallSignal, call.peer, call.isTestMode, call.callId, currentUserName]
  );

  const handleToggleCallRecording = useCallback(() => {
    if (isRecordingCall) {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // Ignore
      }
      setIsRecordingCall(false);
      setRecordingSec(0);
      return;
    }

    const audioTracks = [
      ...(call.localStream?.getAudioTracks() || []),
      ...(call.isTestMode ? [] : call.remoteStream?.getAudioTracks() || []),
    ].filter((t) => t.readyState === 'live');

    if (audioTracks.length === 0 || typeof MediaRecorder === 'undefined') {
      showAddonToast('No active call audio track available to record');
      return;
    }

    try {
      const combined = new MediaStream(audioTracks);
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType ? new MediaRecorder(combined, { mimeType }) : new MediaRecorder(combined);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        if (recordedChunksRef.current.length === 0) return;
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quadline-call-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        showAddonToast('Call recording saved (.webm)');
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setRecordingSec(0);
      setIsRecordingCall(true);
      showAddonToast('Recording call audio…');
    } catch {
      showAddonToast('Could not start call recording on this device');
    }
  }, [isRecordingCall, call.localStream, call.remoteStream, call.isTestMode, showAddonToast]);

  const handleToggleNoiseReduction = useCallback(async () => {
    const next = !noiseReductionOn;
    setNoiseReductionOn(next);
    const micTrack = call.localStream?.getAudioTracks()[0];
    if (micTrack && typeof micTrack.applyConstraints === 'function') {
      try {
        await micTrack.applyConstraints({
          noiseSuppression: next,
          echoCancellation: next,
          autoGainControl: next,
        });
      } catch {
        // Ignore if browser rejects constraint change
      }
    }
    showAddonToast(next ? 'Studio Noise Cancellation ON' : 'Noise Cancellation OFF');
  }, [noiseReductionOn, call.localStream, showAddonToast]);

  const handleTakeVideoSnapshot = useCallback(() => {
    const videoEl = remoteVideoRef.current || localVideoRef.current;
    if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
      showAddonToast('Turn on video to take a snapshot');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const activeCss = VIDEO_FILTERS.find((f) => f.id === videoFilter)?.css || 'none';
      if (activeCss !== 'none') ctx.filter = activeCss;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `quadline-snapshot-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showAddonToast('Video snapshot saved (.png)');
    } catch {
      showAddonToast('Snapshot failed');
    }
  }, [videoFilter, showAddonToast]);

  // Real-time Web Audio AnalyserNode visualizer driven by active call stream (only when fullscreen)
  useEffect(() => {
    const streamToAnalyze = call.isTestMode ? call.localStream : call.remoteStream || call.localStream;
    if (
      minimized ||
      call.status !== 'connected' ||
      !streamToAnalyze ||
      streamToAnalyze.getAudioTracks().length === 0 ||
      prefersReducedMotion
    ) {
      return;
    }

    let rafId: number | null = null;
    let ctx: AudioContext | null = null;

    try {
      ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(streamToAnalyze);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 32;
      source.connect(analyser);
      const bins = new Uint8Array(analyser.frequencyBinCount);

      const renderFrame = () => {
        analyser.getByteFrequencyData(bins);
        const nextBars = Array.from({ length: 7 }, (_, idx) => {
          const val = (bins[idx + 1] || 0) / 255;
          return Math.max(0.16, Math.min(1, val * 1.45));
        });
        setAudioBars(nextBars);
        rafId = requestAnimationFrame(renderFrame);
      };
      rafId = requestAnimationFrame(renderFrame);
    } catch {
      // Ignore if AudioContext unavailable
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ctx?.close().catch(() => {});
    };
  }, [call.status, call.localStream, call.remoteStream, call.isTestMode, minimized, prefersReducedMotion]);

  if (call.status === 'idle' || !call.peer) return null;

  const qMeta = QUALITY_META[call.quality];
  const QualityIcon = qMeta.Icon;
  const activeFilterCss = VIDEO_FILTERS.find((f) => f.id === videoFilter)?.css || 'none';
  const activeAddonsCount =
    (videoFilter !== 'normal' ? 1 : 0) +
    (handRaised ? 1 : 0) +
    (isRecordingCall ? 1 : 0) +
    (captionsEnabled ? 1 : 0) +
    (mirrorVideo ? 1 : 0) +
    (speakerMuted ? 1 : 0);

  return (
    <>
      {/* Persistent audio sink stays mounted across fullscreen, minimized & background modes so voice never cuts */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <AnimatePresence>
        {call.status === 'ringing' ? (
          <motion.div
            key="call-ringing"
            role="dialog"
            aria-modal="true"
            aria-label={`Incoming ${call.mode} call from ${call.peer.displayName}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="w-full max-w-sm rounded-2xl bg-[#161B22] border border-slate-700/90 text-white p-6 space-y-5 shadow-2xl text-center"
            >
              <div className="flex justify-center">
                <div className="relative">
                  {!prefersReducedMotion && (
                    <motion.span
                      animate={{ scale: [1, 1.32, 1], opacity: [0.45, 0, 0.45] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                      className="absolute inset-0 rounded-full border-2 border-emerald-400/70"
                    />
                  )}
                  <Avatar name={call.peer.displayName} src={call.peer.photoUrl || ''} size="lg" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-emerald-400">
                  {call.mode === 'video' ? 'Incoming video call' : 'Incoming audio call'}
                </p>
                <h2 className="font-display text-xl font-bold">{call.peer.displayName}</h2>
                <p className="text-xs text-slate-400">Encrypted peer-to-peer WebRTC connection</p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <motion.button
                  type="button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                  onClick={onReject}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Decline</span>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                  onClick={onAccept}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors cursor-pointer"
                >
                  {call.mode === 'video' ? (
                    <Video className="w-4 h-4" />
                  ) : (
                    <Phone className="w-4 h-4" />
                  )}
                  <span>Accept</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        ) : minimized ? (
          /* Floating Background Mini-Call Bar — stays live across Chats, Reels & switching apps */
          <motion.div
            key="call-minimized"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            className="fixed top-[max(0.75rem,env(safe-area-inset-top))] right-3 left-3 sm:left-auto sm:w-84 z-[65] rounded-2xl bg-[#11161D]/96 backdrop-blur-md border border-emerald-500/45 text-white shadow-2xl overflow-hidden"
          >
            {remoteHasVideo && (
              <div
                onClick={handleExpand}
                className="relative w-full h-36 bg-black cursor-pointer group overflow-hidden"
              >
                <video
                  ref={miniVideoRef}
                  autoPlay
                  playsInline
                  muted={call.isTestMode}
                  style={{ filter: activeFilterCss }}
                  className={`w-full h-full ${
                    call.remoteIsScreenSharing || call.isScreenSharing
                      ? 'object-contain'
                      : call.isTestMode !== mirrorVideo
                        ? 'object-cover -scale-x-100'
                        : 'object-cover'
                  }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end justify-between px-3 py-2">
                  <span className="text-[11px] font-medium text-emerald-300">
                    Running in background · Tap to return
                  </span>
                  <Maximize2 className="w-3.5 h-3.5 text-white/90 group-hover:scale-110 transition-transform" />
                </div>
              </div>
            )}

            <div className="px-3 py-2.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleExpand}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
              >
                <div className="relative shrink-0">
                  <Avatar name={call.peer.displayName} src={call.peer.photoUrl || ''} size="sm" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#11161D]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                    <span className="truncate">{call.peer.displayName}</span>
                    {isRecordingCall && (
                      <span className="text-[10px] font-bold text-red-400 shrink-0">REC</span>
                    )}
                  </p>
                  <p className="text-[11px] text-emerald-300 font-mono-tabular truncate">
                    {call.status === 'connected'
                      ? formatDuration(call.durationSec)
                      : call.status === 'reconnecting'
                        ? 'Reconnecting…'
                        : 'In background…'}
                    {' · Live'}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                {canUsePip && (
                  <button
                    type="button"
                    onClick={() => void handleTogglePip()}
                    aria-label="Float video over other apps (Picture-in-Picture)"
                    title="Float over other apps (PiP)"
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      isPipActive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                  >
                    <PictureInPicture2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleMute}
                  aria-label={call.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    call.isMuted
                      ? 'bg-red-600/30 text-red-200 border border-red-500/50'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                >
                  {call.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleExpand}
                  aria-label="Return to full call"
                  title="Expand call"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onEnd}
                  aria-label="End call"
                  title="End call"
                  className="p-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="call-active"
            role="dialog"
            aria-modal="true"
            aria-label={`Active call with ${call.peer.displayName}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 h-[100dvh] w-full bg-[#0B0F14] text-white flex flex-col"
          >
            {/* Explicit "You are sharing your screen" Indicator Bar */}
            <AnimatePresence>
              {call.isScreenSharing && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-emerald-700 text-white px-4 py-2 flex items-center justify-between gap-3 shrink-0 overflow-hidden"
                >
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                    <MonitorUp className="w-4 h-4 shrink-0" />
                    <span>You are sharing your screen</span>
                  </div>
                  <button
                    type="button"
                    onClick={onStopScreenShare}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <MonitorOff className="w-3.5 h-3.5" />
                    <span>Stop Sharing</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Top Call Info, Back/Background Mode, PiP & Connection Quality Header */}
            <header className="px-2.5 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-black/45 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <motion.button
                  type="button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                  onClick={handleMinimize}
                  aria-label="Run call in background and go back"
                  title="Back (keep call running in background)"
                  className="inline-flex items-center justify-center gap-1.5 min-h-[40px] min-w-[40px] px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline text-xs font-medium">Background</span>
                </motion.button>

                <Avatar name={call.peer.displayName} src={call.peer.photoUrl || ''} size="sm" />
                <div className="min-w-0">
                  <h2 className="font-display text-sm sm:text-base font-bold truncate flex items-center gap-2">
                    <span className="truncate">{call.peer.displayName}</span>
                    {isRecordingCall && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-600/30 border border-red-500/50 text-[10px] font-semibold text-red-200 font-mono-tabular">
                        <CircleDot className="w-3 h-3 text-red-400" />
                        {formatDuration(recordingSec)}
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono-tabular">
                      {call.status === 'connected'
                        ? formatDuration(call.durationSec)
                        : call.statusDetail ||
                          (call.status === 'calling'
                            ? 'Calling…'
                            : call.status === 'reconnecting'
                              ? 'Reconnecting…'
                              : 'Connecting…')}
                    </span>
                    {call.isTestMode && (
                      <span className="text-emerald-400 font-medium">· Live Preview</span>
                    )}
                    {call.voiceEffect !== 'normal' && (
                      <span className="text-amber-300 font-medium">
                        · FX: {getVoiceEffectLabel(call.voiceEffect)}
                      </span>
                    )}
                    {videoFilter !== 'normal' && (
                      <span className="text-sky-300 font-medium">
                        · {VIDEO_FILTERS.find((f) => f.id === videoFilter)?.label}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Right: PiP + Monitor + Connection Quality */}
              <div className="flex items-center gap-1.5 text-xs shrink-0">
                {canUsePip && (
                  <button
                    type="button"
                    onClick={() => void handleTogglePip()}
                    aria-label="Pop out video over other apps (Picture-in-Picture)"
                    title="Float video over other apps (PiP)"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                      isPipActive
                        ? 'bg-emerald-600/30 border-emerald-400/50 text-emerald-200'
                        : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <PictureInPicture2 className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{isPipActive ? 'PiP On' : 'Float PiP'}</span>
                  </button>
                )}

                {call.isTestMode && onToggleMonitorVoice && (
                  <button
                    type="button"
                    onClick={onToggleMonitorVoice}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                      call.isMonitoringVoice
                        ? 'bg-emerald-600/25 border-emerald-400/50 text-emerald-200'
                        : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {call.isMonitoringVoice ? 'Hearing FX' : 'Hear Myself'}
                    </span>
                  </button>
                )}

                {call.status === 'reconnecting' ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Reconnecting</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                    <QualityIcon className={`w-3.5 h-3.5 ${qMeta.color}`} />
                    <span className={qMeta.color}>{qMeta.label}</span>
                    {call.rttMs !== null && !call.isTestMode && (
                      <span className="hidden sm:inline text-slate-400 font-mono-tabular">
                        · {call.rttMs} ms
                      </span>
                    )}
                  </div>
                )}
              </div>
            </header>

            {/* Main Media Stage */}
            <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden bg-[#0B0F14]">
              {remoteHasVideo ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={call.isTestMode}
                  style={{ filter: activeFilterCss }}
                  className={`w-full h-full transition-[filter] duration-200 ${
                    call.remoteIsScreenSharing || call.isScreenSharing
                      ? 'object-contain bg-black'
                      : call.isTestMode !== mirrorVideo
                        ? 'object-cover -scale-x-100'
                        : 'object-cover'
                  }`}
                />
              ) : (
                <div className="text-center space-y-5 px-6 max-w-sm">
                  <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                    {call.status === 'connected' && !prefersReducedMotion && (
                      <motion.div
                        animate={{
                          scale: [1, 1 + Math.max(...audioBars) * 0.25, 1],
                          opacity: [0.35, 0.12, 0.35],
                        }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-full bg-emerald-500/30 blur-md"
                      />
                    )}
                    <div className="relative w-24 h-24 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center overflow-hidden">
                      <Avatar name={call.peer.displayName} src={call.peer.photoUrl || ''} size="lg" />
                    </div>
                  </div>

                  {/* Live Audio-Reactive Spectrum Bars */}
                  <div className="h-9 flex items-center justify-center gap-1.5">
                    {audioBars.map((level, i) => (
                      <span
                        key={i}
                        className="w-1.5 rounded-full bg-emerald-400/90 transition-all duration-75"
                        style={{ height: `${Math.max(18, Math.round(level * 100))}%` }}
                      />
                    ))}
                  </div>

                  <div className="space-y-1">
                    <p className="font-display text-xl font-bold">{call.peer.displayName}</p>
                    <p className="text-xs sm:text-sm text-slate-400">
                      {call.status === 'connected'
                        ? 'Tap Back anytime to run this call in the background while browsing Chats, Reels, or other apps.'
                        : call.statusDetail || 'Waiting for peer…'}
                    </p>
                  </div>
                </div>
              )}

              {/* Raised Hand Badges */}
              {(handRaised || peerHandRaised) && (
                <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-10 pointer-events-none">
                  {handRaised && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/25 border border-amber-400/50 text-amber-100 text-xs font-semibold backdrop-blur-sm">
                      <Hand className="w-3.5 h-3.5" />
                      <span>You raised hand</span>
                    </span>
                  )}
                  {peerHandRaised && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/25 border border-emerald-400/50 text-emerald-100 text-xs font-semibold backdrop-blur-sm">
                      <Hand className="w-3.5 h-3.5" />
                      <span>{call.peer.displayName} raised hand</span>
                    </span>
                  )}
                </div>
              )}

              {/* Add-On Status Notice */}
              <AnimatePresence>
                {addonNotice && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-white/15 text-xs font-medium text-white shadow-lg backdrop-blur-sm pointer-events-none"
                  >
                    {addonNotice}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Floating Live Reactions Layer */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
                <AnimatePresence>
                  {floatingReactions.map((r) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 0, scale: 0.6 }}
                      animate={{ opacity: [0, 1, 1, 0], y: -260, scale: [0.6, 1.2, 1.05, 0.9] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 2.2, ease: 'easeOut' }}
                      style={{ left: `${r.xPercent}%` }}
                      className="absolute bottom-8 -translate-x-1/2 flex flex-col items-center gap-0.5"
                    >
                      <span className="text-3xl drop-shadow-md">{r.emoji}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/60 text-white/90">
                        {r.sender}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Live Auto-Captions Bar */}
              {captionsEnabled && captionText && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[90%] sm:max-w-xl z-10 px-4 py-2 rounded-xl bg-black/75 border border-white/15 text-xs sm:text-sm text-white text-center backdrop-blur-sm">
                  {captionText}
                </div>
              )}

              {/* Reconnecting Overlay Banner */}
              {call.status === 'reconnecting' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-amber-950/90 border border-amber-600/60 text-amber-100 text-xs font-medium flex items-center gap-2 shadow-lg z-10">
                  <WifiOff className="w-4 h-4 shrink-0" />
                  <span>{call.statusDetail || 'Network interrupted — attempting to reconnect…'}</span>
                </div>
              )}

              {/* Local Picture-in-Picture Preview (for 1-to-1 peer calls) */}
              {localHasVideo && !call.isTestMode && (
                <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 w-28 sm:w-48 aspect-video rounded-xl overflow-hidden border border-white/20 bg-black shadow-2xl z-10">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ filter: activeFilterCss }}
                    className={`w-full h-full ${
                      call.isScreenSharing
                        ? 'object-contain'
                        : mirrorVideo
                          ? 'object-cover'
                          : 'object-cover -scale-x-100'
                    }`}
                  />
                  <span className="absolute bottom-1 left-1.5 text-[10px] font-medium text-white bg-black/65 px-1.5 py-0.5 rounded">
                    {call.isScreenSharing ? 'Your Screen' : 'You'}
                  </span>
                </div>
              )}

              {/* In-Call Quick Chat Slide-Over Drawer */}
              <AnimatePresence>
                {inCallChatOpen && (
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-y-0 right-0 w-full sm:w-80 bg-[#11161D]/96 backdrop-blur-md border-l border-white/10 z-30 flex flex-col"
                  >
                    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold text-white">In-Call Chat &amp; Notes</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInCallChatOpen(false)}
                        aria-label="Close in-call chat"
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {inCallMessages.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-8">
                          Drop links, notes, or quick messages here without leaving your call.
                        </p>
                      ) : (
                        inCallMessages.map((m) => (
                          <div
                            key={m.id}
                            className={`rounded-xl px-3 py-2 text-xs ${
                              m.isMine
                                ? 'bg-emerald-600/30 border border-emerald-500/35 ml-6 text-white'
                                : 'bg-white/10 mr-6 text-slate-100'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-0.5 text-[10px] text-slate-300">
                              <span className="font-semibold">{m.sender}</span>
                              <span>{m.timestamp}</span>
                            </div>
                            <p className="break-words">{m.text}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <form
                      onSubmit={handleSendInCallMessage}
                      className="p-2.5 border-t border-white/10 flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={inCallDraft}
                        onChange={(e) => setInCallDraft(e.target.value)}
                        placeholder="Message during call…"
                        className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                      <button
                        type="submit"
                        disabled={!inCallDraft.trim()}
                        aria-label="Send in-call message"
                        className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Call Control Dock + 10+ Call Add-Ons Drawer */}
            <footer className="relative px-2.5 sm:px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] bg-black/65 border-t border-white/10 shrink-0">
              {/* 10+ Call Add-Ons Sheet */}
              <AnimatePresence>
                {addonsOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setAddonsOpen(false)} />
                    <motion.div
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.97 }}
                      transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                      className="fixed sm:absolute bottom-24 sm:bottom-full left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:mb-3 sm:w-[460px] max-h-[68dvh] overflow-y-auto rounded-2xl bg-[#161B22] border border-slate-700 shadow-2xl p-4 z-30 space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          <h3 className="text-xs font-bold text-white">Call Add-Ons Studio (12+ Tools)</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAddonsOpen(false)}
                          aria-label="Close add-ons"
                          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 1. Floating Live Reactions */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-slate-400">Live Reactions</p>
                        <div className="grid grid-cols-6 gap-1.5">
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleSendReaction(emoji)}
                              className="py-2 rounded-xl bg-white/5 hover:bg-white/15 text-lg transition-transform active:scale-90 cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 2. Quick Toggles Grid (Raise Hand, Record, Captions, Noise Cancel, Mirror, Snapshot, In-Call Chat, Background) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={handleToggleRaiseHand}
                          className={`p-2.5 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border transition-colors cursor-pointer ${
                            handRaised
                              ? 'bg-amber-500/25 border-amber-400/50 text-amber-200'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                          }`}
                        >
                          <Hand className="w-4 h-4" />
                          <span>{handRaised ? 'Lower Hand' : 'Raise Hand'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleToggleCallRecording}
                          className={`p-2.5 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border transition-colors cursor-pointer ${
                            isRecordingCall
                              ? 'bg-red-600/30 border-red-400/50 text-red-200'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                          }`}
                        >
                          {isRecordingCall ? <Square className="w-4 h-4" /> : <CircleDot className="w-4 h-4" />}
                          <span>{isRecordingCall ? 'Stop Rec' : 'Record Call'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCaptionsEnabled((v) => !v)}
                          className={`p-2.5 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border transition-colors cursor-pointer ${
                            captionsEnabled
                              ? 'bg-emerald-600/30 border-emerald-400/50 text-emerald-200'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                          }`}
                        >
                          <Captions className="w-4 h-4" />
                          <span>{captionsEnabled ? 'Captions On' : 'Captions'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleNoiseReduction()}
                          className={`p-2.5 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border transition-colors cursor-pointer ${
                            noiseReductionOn
                              ? 'bg-emerald-600/25 border-emerald-400/40 text-emerald-200'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                          }`}
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Noise Cancel</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setMirrorVideo((v) => !v);
                            showAddonToast(!mirrorVideo ? 'Video mirrored' : 'Video unmirrored');
                          }}
                          className={`p-2.5 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border transition-colors cursor-pointer ${
                            mirrorVideo
                              ? 'bg-sky-600/25 border-sky-400/50 text-sky-200'
                              : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                          }`}
                        >
                          <FlipHorizontal2 className="w-4 h-4" />
                          <span>Mirror Cam</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleTakeVideoSnapshot}
                          className="p-2.5 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border bg-white/5 border-white/10 hover:bg-white/10 text-slate-200 transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Snapshot</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAddonsOpen(false);
                            setInCallChatOpen(true);
                            setUnreadInCallCount(0);
                          }}
                          className="p-2.5 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border bg-white/5 border-white/10 hover:bg-white/10 text-slate-200 transition-colors cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>In-Call Chat</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleMinimize}
                          className="p-2.5 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border bg-white/5 border-white/10 hover:bg-white/10 text-slate-200 transition-colors cursor-pointer"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Background</span>
                        </button>
                      </div>

                      {/* 3. Live Video Filters */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                          <Palette className="w-3.5 h-3.5" />
                          <span>Live Video Filters</span>
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {VIDEO_FILTERS.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setVideoFilter(f.id)}
                              className={`px-2.5 py-2 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                                videoFilter === f.id
                                  ? 'bg-emerald-600/25 border-emerald-400/50 text-emerald-200'
                                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 4. Live Soundboard FX */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                          <Music className="w-3.5 h-3.5" />
                          <span>Live Soundboard FX</span>
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {SOUNDBOARD_ITEMS.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handlePlaySoundFx(item)}
                              className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-[11px] font-medium text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>{item.emoji}</span>
                              <span>{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 5. Speaker Volume & Output Mute */}
                      <div className="space-y-1.5 pt-1 border-t border-slate-800">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-400">Speaker Volume</span>
                          <span className="font-mono-tabular text-slate-300">
                            {speakerMuted ? 'Muted' : `${Math.round(speakerVolume * 100)}%`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSpeakerMuted((v) => !v)}
                            aria-label={speakerMuted ? 'Unmute speaker' : 'Mute speaker'}
                            className={`p-2 rounded-lg cursor-pointer ${
                              speakerMuted ? 'bg-red-600/30 text-red-200' : 'bg-white/10 text-white'
                            }`}
                          >
                            {speakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={speakerMuted ? 0 : speakerVolume}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setSpeakerVolume(val);
                              setSpeakerMuted(val === 0);
                            }}
                            aria-label="Call speaker volume"
                            className="flex-1 accent-emerald-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              <div className="max-w-3xl mx-auto grid grid-cols-4 sm:flex sm:items-center sm:justify-center gap-1.5 sm:gap-2.5">
                {/* Mute / Unmute */}
                <motion.button
                  type="button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                  onClick={onToggleMute}
                  aria-label={call.isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
                    call.isMuted
                      ? 'bg-red-600/25 text-red-200 border border-red-500/50'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                >
                  {call.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  <span>{call.isMuted ? 'Unmute' : 'Mute'}</span>
                </motion.button>

                {/* Camera On / Off */}
                <motion.button
                  type="button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                  onClick={onToggleCamera}
                  aria-label={call.isCameraOn ? 'Turn camera off' : 'Turn camera on'}
                  className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
                    !call.isCameraOn
                      ? 'bg-white/10 hover:bg-white/15 text-slate-300'
                      : 'bg-white/15 hover:bg-white/20 text-white'
                  }`}
                >
                  {call.isCameraOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
                  <span>{call.isCameraOn ? 'Cam On' : 'Cam Off'}</span>
                </motion.button>

                {/* Switch Camera */}
                <motion.button
                  type="button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                  onClick={onSwitchCamera}
                  disabled={!call.canSwitchCamera || !call.isCameraOn}
                  aria-label="Switch camera"
                  className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-[11px] font-medium bg-white/10 hover:bg-white/15 disabled:opacity-35 text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Flip</span>
                </motion.button>

                {/* Screen Share Toggle */}
                <motion.button
                  type="button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                  onClick={onToggleScreenShare}
                  aria-label={call.isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
                  className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
                    call.isScreenSharing
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                >
                  {call.isScreenSharing ? (
                    <MonitorOff className="w-5 h-5" />
                  ) : (
                    <MonitorUp className="w-5 h-5" />
                  )}
                  <span>{call.isScreenSharing ? 'Stop' : 'Share'}</span>
                </motion.button>

                {/* Real-Time Voice Changer Popover */}
                <div className="relative">
                  <motion.button
                    type="button"
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                    onClick={() => {
                      setAddonsOpen(false);
                      setEffectMenuOpen((v) => !v);
                    }}
                    aria-label="Live voice changer effects"
                    className={`w-full flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
                      call.voiceEffect !== 'normal'
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                  >
                    <AudioLines className="w-5 h-5" />
                    <span className="truncate max-w-full">
                      {call.voiceEffect === 'normal'
                        ? 'Voice FX'
                        : getVoiceEffectLabel(call.voiceEffect)}
                    </span>
                  </motion.button>

                  <AnimatePresence>
                    {effectMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setEffectMenuOpen(false)} />
                        <motion.div
                          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.96 }}
                          transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                          className="fixed sm:absolute bottom-24 sm:bottom-full left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:mb-3 sm:w-64 rounded-2xl bg-[#161B22] border border-slate-700 shadow-2xl p-2 z-30 space-y-1"
                        >
                          <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-800">
                            <span className="text-xs font-semibold text-white">Live Voice Changer</span>
                            {call.voiceEffect !== 'normal' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectVoiceEffect('normal');
                                  setEffectMenuOpen(false);
                                }}
                                className="text-[11px] font-medium text-emerald-400 hover:underline cursor-pointer"
                              >
                                Reset Normal
                              </button>
                            )}
                          </div>
                          <div className="max-h-64 overflow-y-auto space-y-0.5">
                            {VOICE_EFFECTS.map((fx) => {
                              const active = call.voiceEffect === fx.id;
                              return (
                                <button
                                  key={fx.id}
                                  type="button"
                                  onClick={() => {
                                    onSelectVoiceEffect(fx.id);
                                    setEffectMenuOpen(false);
                                  }}
                                  className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                    active
                                      ? 'bg-emerald-600/25 text-emerald-200 border border-emerald-500/40'
                                      : 'hover:bg-slate-800 text-slate-200'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium">{fx.label}</p>
                                    <p className="text-[11px] text-slate-400 truncate">
                                      {fx.description}
                                    </p>
                                  </div>
                                  {active && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* In-Call Chat Toggle */}
                <motion.button
                  type="button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                  onClick={() => {
                    setAddonsOpen(false);
                    setEffectMenuOpen(false);
                    setInCallChatOpen((v) => !v);
                    setUnreadInCallCount(0);
                  }}
                  aria-label="Open in-call chat"
                  className={`relative flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
                    inCallChatOpen
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>Chat</span>
                  {unreadInCallCount > 0 && (
                    <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {unreadInCallCount}
                    </span>
                  )}
                </motion.button>

                {/* 10+ Call Add-Ons Button */}
                <motion.button
                  type="button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                  onClick={() => {
                    setEffectMenuOpen(false);
                    setAddonsOpen((v) => !v);
                  }}
                  aria-label="Open call add-ons"
                  className={`relative flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
                    addonsOpen || activeAddonsCount > 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-white/10 hover:bg-white/15 text-white'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Add-Ons</span>
                  {activeAddonsCount > 0 && (
                    <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                      {activeAddonsCount}
                    </span>
                  )}
                </motion.button>

                {/* End Call */}
                <motion.button
                  type="button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                  onClick={onEnd}
                  aria-label="End call"
                  className="flex flex-col items-center justify-center gap-1 px-2.5 py-2.5 rounded-xl text-[11px] font-medium bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
                >
                  <PhoneOff className="w-5 h-5" />
                  <span>End</span>
                </motion.button>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
