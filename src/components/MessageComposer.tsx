import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  AudioLines,
  BarChart2,
  Calendar,
  Camera,
  Film,
  Image as ImageIcon,
  Mic,
  Music2,
  Paperclip,
  Plus,
  RotateCcw,
  Send,
  Smile,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { StickerGifStudioModal } from './StickerGifStudioModal';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import {
  deleteCustomStudioMedia,
  fetchCustomStudioMedia,
  type CustomStudioMedia,
} from '../lib/backendApi';
import {
  generatePhotoThumbnail,
  ResumableChunkedUpload,
  type UploadProgressState,
} from '../lib/chunkedUpload';
import {
  formatBytes,
  formatDuration,
  MAX_FILE_SIZE_MB,
  validateFileClient,
  VOICE_EFFECTS,
  VOICE_NOTE_MAX_HINT,
  VOICE_NOTE_MAX_SEC,
  VOICE_NOTE_MIN_HINT,
  VOICE_NOTE_MIN_SEC,
  type VoiceEffectId,
} from '../lib/constants';
import { extractMentionedUids, formatLiveActivity, LIMITS } from '../lib/validation';
import { renderVoiceNoteWithEffect } from '../lib/voiceEffects';
import {
  ANIMATED_GIFS,
  COMPOSER_EMOJI_GROUPS,
  STICKERS,
} from '../lib/stickersAndGifs';
import type { LiveActivityKind, Message, RoomMember, TypingUser } from '../types/chat';

export interface UploadedPhotoPayload {
  mediaUrl: string;
  thumbnailUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  caption: string;
}

export interface UploadedFilePayload {
  mediaUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface UploadedVoicePayload {
  mediaUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  durationSec: number;
  voiceEffect: VoiceEffectId;
  waveform: number[];
}

interface PendingVoiceDraft {
  rawBlob: Blob;
  durationSec: number;
  selectedEffect: VoiceEffectId;
  processedBlob: Blob;
  previewUrl: string;
  waveform: number[];
  processing: boolean;
}

interface ActiveUploadContext {
  uploader: ResumableChunkedUpload;
  kind: 'image' | 'file' | 'voice';
  file: File;
  caption?: string;
  thumbnailUrl?: string;
  voiceMeta?: { durationSec: number; voiceEffect: VoiceEffectId; waveform: number[] };
}

interface MessageComposerProps {
  roomId?: string;
  roomName: string;
  currentUid: string;
  members: RoomMember[];
  typingUsers: TypingUser[];
  replyTo: Message | null;
  editingMessage: Message | null;
  placeholder?: string;
  compact?: boolean;
  isGroupRoom?: boolean;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onEditLastOwnMessage?: () => void;
  onTypingStart: (activity?: LiveActivityKind) => void;
  onTypingStop: () => void;
  onSendText: (text: string, mentionedUids: string[]) => Promise<void>;
  onSaveEdit: (messageId: string, text: string, mentionedUids: string[]) => Promise<void>;
  onSendImage: (payload: UploadedPhotoPayload) => Promise<void>;
  onSendFile: (payload: UploadedFilePayload) => Promise<void>;
  onSendVoice: (payload: UploadedVoicePayload) => Promise<void>;
  onOpenPollModal?: () => void;
  onOpenEventModal?: () => void;
  onOpenSongsModal?: () => void;
  onOpenReelsModal?: () => void;
}

export function MessageComposer({
  roomId,
  roomName,
  currentUid,
  members,
  typingUsers,
  replyTo,
  editingMessage,
  placeholder,
  compact = false,
  isGroupRoom = false,
  onCancelReply,
  onCancelEdit,
  onEditLastOwnMessage,
  onTypingStart,
  onTypingStop,
  onSendText,
  onSaveEdit,
  onSendImage,
  onSendFile,
  onSendVoice,
  onOpenPollModal,
  onOpenEventModal,
  onOpenSongsModal,
  onOpenReelsModal,
}: MessageComposerProps) {
  const inputUid = useId();
  const galleryInputId = `ql-gallery-${inputUid}`;
  const cameraFileInputId = `ql-camera-file-${inputUid}`;
  const fileInputId = `ql-file-${inputUid}`;
  const audioFileInputId = `ql-audio-file-${inputUid}`;
  const prefersReducedMotion = useReducedMotion();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'stickers' | 'gifs'>('emoji');
  const [pickerQuery, setPickerQuery] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioInitialTab, setStudioInitialTab] = useState<'sticker' | 'gif'>('sticker');
  const [customStudioMedia, setCustomStudioMedia] = useState<CustomStudioMedia[]>(() => {
    try {
      const raw = localStorage.getItem(`quadline_custom_media_${currentUid}`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!currentUid) return;
    let cancelled = false;
    void fetchCustomStudioMedia(currentUid).then((items) => {
      if (cancelled) return;
      if (items.length > 0) {
        setCustomStudioMedia(items);
        try {
          localStorage.setItem(`quadline_custom_media_${currentUid}`, JSON.stringify(items));
        } catch {
          // Ignore quota errors
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentUid]);

  const sendStickerOrGifAsset = async (
    kind: 'sticker' | 'gif',
    label: string,
    dataUrl: string
  ) => {
    setEmojiOpen(false);
    setSending(true);
    setError(null);
    try {
      await onSendImage({
        mediaUrl: dataUrl,
        thumbnailUrl: dataUrl,
        fileName: `${kind}:${label}`,
        mimeType: 'image/svg+xml',
        size: dataUrl.length,
        caption: '',
      });
    } catch {
      setError(`Could not send ${kind === 'sticker' ? 'sticker' : 'GIF'} right now.`);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteCustomAsset = async (id: string) => {
    setCustomStudioMedia((prev) => {
      const next = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(`quadline_custom_media_${currentUid}`, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
    if (!id.startsWith('local-')) {
      await deleteCustomStudioMedia(currentUid, id);
    }
  };

  // Chunked upload state (supports cancel & retry)
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);
  const activeUploadRef = useRef<ActiveUploadContext | null>(null);

  // Camera capture modal state (with reliable device-picker fallback)
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Voice recording & pre-send effect preview state
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'requesting' | 'recording' | 'mic_error'>('idle');
  const [micErrorText, setMicErrorText] = useState<string | null>(null);
  const [recordLocked, setRecordLocked] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveWaveBars, setLiveWaveBars] = useState<number[]>(() =>
    Array.from({ length: 28 }, () => 0.15)
  );
  const [swipeCancelOffset, setSwipeCancelOffset] = useState(0);
  const [voiceDraft, setVoiceDraft] = useState<PendingVoiceDraft | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);
  const analyserCtxRef = useRef<AudioContext | null>(null);
  const analyserRafRef = useRef<number | null>(null);
  const pointerActiveRef = useRef(false);
  const pointerDownXRef = useRef<number | null>(null);
  const pointerDownTimeRef = useRef<number>(0);
  const recordingCancelledRef = useRef(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingThrottleRef = useRef<number>(0);
  const typingIdleTimerRef = useRef<number | null>(null);
  const draftKey = roomId ? `quadline_draft_${compact ? 'thread_' : ''}${roomId}` : null;

  // Restore saved unsent draft when switching rooms (protects against network/navigation loss)
  useEffect(() => {
    if (!draftKey || editingMessage) return;
    try {
      const saved = sessionStorage.getItem(draftKey);
      setText(saved || '');
    } catch {
      setText('');
    }
    setMentionQuery(null);
    setError(null);
    return () => {
      if (typingIdleTimerRef.current !== null) {
        window.clearTimeout(typingIdleTimerRef.current);
        typingIdleTimerRef.current = null;
      }
      onTypingStopRef.current();
    };
  }, [draftKey, editingMessage]);

  // Smoothly auto-size textarea height while typing multi-line messages
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [text]);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text);
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  useEffect(() => {
    return () => {
      if (typingIdleTimerRef.current !== null) window.clearTimeout(typingIdleTimerRef.current);
      if (recordTimerRef.current !== null) window.clearInterval(recordTimerRef.current);
      if (analyserRafRef.current !== null) cancelAnimationFrame(analyserRafRef.current);
      analyserCtxRef.current?.close().catch(() => {});
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const url = voiceDraft?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [voiceDraft?.previewUrl]);

  // Broadcast live "recording a voice note..." activity while recording
  const onTypingStartRef = useRef(onTypingStart);
  const onTypingStopRef = useRef(onTypingStop);
  onTypingStartRef.current = onTypingStart;
  onTypingStopRef.current = onTypingStop;

  useEffect(() => {
    if (voiceStatus !== 'recording') return;
    onTypingStartRef.current('recording_voice');
    const heartbeat = window.setInterval(() => {
      onTypingStartRef.current('recording_voice');
    }, 2500);
    return () => {
      window.clearInterval(heartbeat);
      onTypingStopRef.current();
    };
  }, [voiceStatus]);

  // Open live camera stream when camera modal opens (never silently fails)
  useEffect(() => {
    if (!cameraModalOpen) {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
      setCameraError(null);
      setCameraReady(false);
      return;
    }

    let cancelled = false;
    const openCam = async () => {
      setCameraError(null);
      setCameraReady(false);
      if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
        setCameraError('Live camera preview is unavailable here. Choose or snap a photo from your device below.');
        return;
      }
      try {
        cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cameraFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
        }
        setCameraReady(true);
      } catch {
        if (!cancelled) {
          setCameraError(
            'Camera permission was denied or no camera was detected. You can still pick or capture a photo directly using the button below.'
          );
        }
      }
    };

    void openCam();
    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraModalOpen, cameraFacingMode]);

  const broadcastMentionOptions =
    mentionQuery !== null && isGroupRoom
      ? [
          {
            token: 'everyone',
            label: 'Everyone in group',
            desc: `Notify all ${members.length} members`,
          },
          {
            token: 'all',
            label: 'All group members',
            desc: `Notify everyone in ${roomName}`,
          },
        ].filter((opt) => opt.token.startsWith(mentionQuery.toLowerCase()))
      : [];

  const filteredMentions =
    mentionQuery !== null
      ? members
          .filter(
            (m) =>
              m.handle.toLowerCase().includes(mentionQuery.toLowerCase()) ||
              m.displayName.toLowerCase().includes(mentionQuery.toLowerCase())
          )
          .slice(0, 6)
      : [];

  const persistDraft = (val: string) => {
    if (!draftKey || editingMessage) return;
    try {
      if (val) sessionStorage.setItem(draftKey, val);
      else sessionStorage.removeItem(draftKey);
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleTextChange = (value: string, cursorPos?: number) => {
    setText(value);
    persistDraft(value);
    setError(null);
    setHint(null);

    const pos = typeof cursorPos === 'number' ? cursorPos : value.length;
    const beforeCursor = value.slice(0, pos);
    const mentionMatch = beforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_.-]{0,24})$/);
    setMentionQuery(mentionMatch ? mentionMatch[1] : null);

    if (typingIdleTimerRef.current !== null) {
      window.clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }

    const now = Date.now();
    if (value.trim().length > 0) {
      if (now - typingThrottleRef.current > 2200) {
        typingThrottleRef.current = now;
        onTypingStart('typing');
      }
      typingIdleTimerRef.current = window.setTimeout(() => {
        typingIdleTimerRef.current = null;
        typingThrottleRef.current = 0;
        onTypingStop();
      }, 3600);
    } else {
      typingThrottleRef.current = 0;
      onTypingStop();
    }
  };

  const insertMention = (handle: string) => {
    const el = textareaRef.current;
    const pos = el?.selectionStart ?? text.length;
    const before = text.slice(0, pos);
    const after = text.slice(pos);
    const replacedBefore = before.replace(/(^|\s)@[a-zA-Z0-9_.-]{0,24}$/, `$1@${handle} `);
    const next = `${replacedBefore}${after}`;
    setText(next);
    persistDraft(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(replacedBefore.length, replacedBefore.length);
      }
    });
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setHint(null);
    if (typingIdleTimerRef.current !== null) {
      window.clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    typingThrottleRef.current = 0;
    onTypingStop();

    try {
      const mentionedUids = extractMentionedUids(trimmed, members, currentUid);
      if (editingMessage) {
        await onSaveEdit(editingMessage.id, trimmed, mentionedUids);
        onCancelEdit();
      } else {
        await onSendText(trimmed, mentionedUids);
      }
      setText('');
      persistDraft('');
      setMentionQuery(null);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : '';
      const isNetworkIssue =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        rawMsg.toLowerCase().includes('offline') ||
        rawMsg.toLowerCase().includes('network') ||
        rawMsg.toLowerCase().includes('unavailable');
      setError(
        isNetworkIssue
          ? 'Network unstable — your message is saved here. Tap Send once reconnected.'
          : rawMsg && !rawMsg.startsWith('{')
            ? rawMsg
            : 'Unable to send message right now. Please tap Send to retry.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent premature send while composing accented/Hindi/IME keyboard input
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
      return;
    }
    if (e.key === 'Escape') {
      if (mentionQuery !== null) {
        setMentionQuery(null);
      } else if (editingMessage) {
        onCancelEdit();
        setText('');
      } else if (replyTo) {
        onCancelReply();
      }
      return;
    }
    if (e.key === 'ArrowUp' && !text.trim() && !editingMessage && onEditLastOwnMessage) {
      e.preventDefault();
      onEditLastOwnMessage();
    }
  };

  // =========================================================================
  // CHUNKED UPLOAD EXECUTION (PHOTOS, FILES, VOICE NOTES UP TO 90 MB)
  // =========================================================================

  const executeUploadContext = async (ctx: ActiveUploadContext) => {
    activeUploadRef.current = ctx;
    setSending(true);
    setError(null);
    setHint(null);

    try {
      const completed = await ctx.uploader.run();

      if (ctx.kind === 'image') {
        await onSendImage({
          mediaUrl: completed.url,
          thumbnailUrl: ctx.thumbnailUrl || '',
          fileName: completed.fileName,
          mimeType: completed.mimeType,
          size: completed.size,
          caption: ctx.caption || '',
        });
        setText('');
      } else if (ctx.kind === 'file') {
        await onSendFile({
          mediaUrl: completed.url,
          fileName: completed.fileName,
          mimeType: completed.mimeType,
          size: completed.size,
        });
      } else if (ctx.kind === 'voice' && ctx.voiceMeta) {
        await onSendVoice({
          mediaUrl: completed.url,
          fileName: completed.fileName,
          mimeType: completed.mimeType,
          size: completed.size,
          durationSec: ctx.voiceMeta.durationSec,
          voiceEffect: ctx.voiceMeta.voiceEffect,
          waveform: ctx.voiceMeta.waveform,
        });
        setVoiceDraft(null);
      }

      activeUploadRef.current = null;
      setUploadProgress(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      if (msg !== 'Upload cancelled') {
        setError(msg);
      } else {
        activeUploadRef.current = null;
        setUploadProgress(null);
      }
    } finally {
      setSending(false);
    }
  };

  const startPhotoUpload = async (file: File) => {
    setCameraModalOpen(false);
    setError(null);
    setHint(null);
    const validation = validateFileClient(file, true);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    const thumbnailUrl = await generatePhotoThumbnail(file);
    const uploader = new ResumableChunkedUpload({
      file,
      uploaderUid: currentUid,
      expectImageOnly: true,
      onProgress: (st) => setUploadProgress(st),
    });

    await executeUploadContext({
      uploader,
      kind: 'image',
      file,
      caption: text.trim(),
      thumbnailUrl,
    });
  };

  const startFileUpload = async (file: File) => {
    setError(null);
    setHint(null);
    const validation = validateFileClient(file, false);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    // If user attached an image via Paperclip, send it as a rich photo with thumbnail
    if (file.type.startsWith('image/')) {
      await startPhotoUpload(file);
      return;
    }

    const uploader = new ResumableChunkedUpload({
      file,
      uploaderUid: currentUid,
      expectImageOnly: false,
      onProgress: (st) => setUploadProgress(st),
    });

    await executeUploadContext({
      uploader,
      kind: 'file',
      file,
    });
  };

  const handleCancelUpload = async () => {
    if (activeUploadRef.current) {
      await activeUploadRef.current.uploader.cancel();
      activeUploadRef.current = null;
    }
    setUploadProgress(null);
    setError(null);
  };

  const handleRetryUpload = async () => {
    if (!activeUploadRef.current) return;
    await executeUploadContext(activeUploadRef.current);
  };

  const handleGalleryPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await startPhotoUpload(file);
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await startFileUpload(file);
  };

  const handleAudioFileFallbackPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setVoiceStatus('idle');
    setMicErrorText(null);
    setError(null);
    const validation = validateFileClient(file, false);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    try {
      const rendered = await renderVoiceNoteWithEffect(file, 'normal');
      const previewUrl = URL.createObjectURL(rendered.blob);
      setVoiceDraft({
        rawBlob: file,
        durationSec: Math.max(VOICE_NOTE_MIN_SEC, Math.min(VOICE_NOTE_MAX_SEC, rendered.durationSec)),
        selectedEffect: 'normal',
        processedBlob: rendered.blob,
        previewUrl,
        waveform: rendered.waveform,
        processing: false,
      });
    } catch {
      const fallbackUrl = URL.createObjectURL(file);
      setVoiceDraft({
        rawBlob: file,
        durationSec: 5,
        selectedEffect: 'normal',
        processedBlob: file,
        previewUrl: fallbackUrl,
        waveform: liveWaveBars,
        processing: false,
      });
    }
  };

  const handleSnapCameraPhoto = () => {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        void startPhotoUpload(file);
      },
      'image/jpeg',
      0.92
    );
  };

  // =========================================================================
  // VOICE NOTE RECORDING (TAP OR HOLD, SWIPE-TO-CANCEL, 1s–5:00, VOICE FX)
  // =========================================================================

  const stopRecordingResources = () => {
    if (recordTimerRef.current !== null) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (analyserRafRef.current !== null) {
      cancelAnimationFrame(analyserRafRef.current);
      analyserRafRef.current = null;
    }
    analyserCtxRef.current?.close().catch(() => {});
    analyserCtxRef.current = null;
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordStreamRef.current = null;
  };

  const startVoiceRecording = async (lockImmediately = false) => {
    if (voiceStatus === 'recording' || voiceStatus === 'requesting') return;
    setError(null);
    setHint(null);
    setMicErrorText(null);
    setVoiceDraft(null);
    recordingCancelledRef.current = false;
    setSwipeCancelOffset(0);

    if (typeof navigator.mediaDevices?.getUserMedia !== 'function' || typeof MediaRecorder === 'undefined') {
      setVoiceStatus('mic_error');
      setMicErrorText('Live microphone recording is unavailable in this browser. Upload an audio clip instead.');
      return;
    }

    setVoiceStatus('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      if (recordingCancelledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        setVoiceStatus('idle');
        return;
      }

      recordStreamRef.current = stream;

      // Live waveform meter via Web Audio AnalyserNode
      try {
        const audioCtx = new AudioContext();
        analyserCtxRef.current = audioCtx;
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tickWave = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / (data.length * 255);
          const barHeight = Math.max(0.14, Math.min(1, avg * 2.5));
          setLiveWaveBars((prev) => [...prev.slice(1), barHeight]);
          analyserRafRef.current = requestAnimationFrame(tickWave);
        };
        analyserRafRef.current = requestAnimationFrame(tickWave);
      } catch {
        // Non-fatal if AudioContext unavailable
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.start(250);
      recordStartRef.current = Date.now();
      setRecordSeconds(0);
      setVoiceStatus('recording');
      // If user already released pointer (quick tap), lock recording open hands-free
      setRecordLocked(lockImmediately || !pointerActiveRef.current);

      recordTimerRef.current = window.setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - recordStartRef.current) / 1000);
        setRecordSeconds(elapsedSec);
        if (elapsedSec >= VOICE_NOTE_MAX_SEC) {
          void finishVoiceRecording(true);
        }
      }, 250);
    } catch {
      setVoiceStatus('mic_error');
      setMicErrorText('Microphone permission denied or no microphone found. Allow access or upload an audio clip.');
    }
  };

  const cancelVoiceRecording = () => {
    recordingCancelledRef.current = true;
    pointerActiveRef.current = false;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    stopRecordingResources();
    setVoiceStatus('idle');
    setMicErrorText(null);
    setRecordLocked(false);
    setRecordSeconds(0);
    setSwipeCancelOffset(0);
    setHint('Voice recording cancelled.');
  };

  const finishVoiceRecording = async (hitMaxLimit = false) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setVoiceStatus('idle');
      return;
    }

    const elapsedMs = Date.now() - recordStartRef.current;
    const elapsedSec = Math.min(VOICE_NOTE_MAX_SEC, Math.round(elapsedMs / 1000));

    if (elapsedMs < VOICE_NOTE_MIN_SEC * 1000) {
      recordingCancelledRef.current = true;
      recorder.stop();
      stopRecordingResources();
      setVoiceStatus('idle');
      setRecordLocked(false);
      setRecordSeconds(0);
      setSwipeCancelOffset(0);
      setHint(VOICE_NOTE_MIN_HINT);
      return;
    }

    setVoiceStatus('idle');
    setRecordLocked(false);
    setSwipeCancelOffset(0);

    const rawBlob = await new Promise<Blob>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => resolve(new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })),
        { once: true }
      );
      recorder.stop();
    });

    stopRecordingResources();
    if (recordingCancelledRef.current) return;

    if (hitMaxLimit) {
      setHint(VOICE_NOTE_MAX_HINT);
    }

    try {
      const rendered = await renderVoiceNoteWithEffect(rawBlob, 'normal');
      const previewUrl = URL.createObjectURL(rendered.blob);
      setVoiceDraft({
        rawBlob,
        durationSec: Math.max(
          VOICE_NOTE_MIN_SEC,
          Math.min(VOICE_NOTE_MAX_SEC, rendered.durationSec || elapsedSec)
        ),
        selectedEffect: 'normal',
        processedBlob: rendered.blob,
        previewUrl,
        waveform: rendered.waveform,
        processing: false,
      });
    } catch {
      const fallbackUrl = URL.createObjectURL(rawBlob);
      setVoiceDraft({
        rawBlob,
        durationSec: Math.max(VOICE_NOTE_MIN_SEC, elapsedSec),
        selectedEffect: 'normal',
        processedBlob: rawBlob,
        previewUrl: fallbackUrl,
        waveform: liveWaveBars,
        processing: false,
      });
    }
  };

  const handleSelectVoiceDraftEffect = async (nextEffect: VoiceEffectId) => {
    if (!voiceDraft || voiceDraft.processing || voiceDraft.selectedEffect === nextEffect) return;
    setVoiceDraft((prev) => (prev ? { ...prev, selectedEffect: nextEffect, processing: true } : null));
    try {
      const rendered = await renderVoiceNoteWithEffect(voiceDraft.rawBlob, nextEffect);
      const nextUrl = URL.createObjectURL(rendered.blob);
      setVoiceDraft((prev) =>
        prev
          ? {
              ...prev,
              selectedEffect: nextEffect,
              processedBlob: rendered.blob,
              previewUrl: nextUrl,
              waveform: rendered.waveform,
              processing: false,
            }
          : null
      );
    } catch {
      setError('Unable to preview voice effect.');
      setVoiceDraft((prev) => (prev ? { ...prev, processing: false } : null));
    }
  };

  const handleSendVoiceDraft = async () => {
    if (!voiceDraft || voiceDraft.processing) return;
    const ext = voiceDraft.processedBlob.type.includes('wav')
      ? 'wav'
      : voiceDraft.processedBlob.type.includes('mp4')
        ? 'm4a'
        : 'webm';
    const fileName = `voice-note-${voiceDraft.durationSec}s${
      voiceDraft.selectedEffect !== 'normal' ? `-${voiceDraft.selectedEffect}` : ''
    }.${ext}`;
    const file = new File([voiceDraft.processedBlob], fileName, {
      type: voiceDraft.processedBlob.type || 'audio/wav',
    });

    let lastPing = Date.now();
    onTypingStart('sending_voice');

    const uploader = new ResumableChunkedUpload({
      file,
      uploaderUid: currentUid,
      expectImageOnly: false,
      onProgress: (st) => {
        setUploadProgress(st);
        const now = Date.now();
        if (now - lastPing > 2200) {
          lastPing = now;
          onTypingStart('sending_voice');
        }
      },
    });

    try {
      await executeUploadContext({
        uploader,
        kind: 'voice',
        file,
        voiceMeta: {
          durationSec: voiceDraft.durationSec,
          voiceEffect: voiceDraft.selectedEffect,
          waveform: voiceDraft.waveform,
        },
      });
    } finally {
      onTypingStop();
    }
  };

  // Reliable Tap-to-Record OR Hold-to-Record + Swipe-Left-to-Cancel
  const handleMicPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (voiceStatus !== 'idle' || voiceDraft || sending) return;
    pointerActiveRef.current = true;
    pointerDownXRef.current = e.clientX;
    pointerDownTimeRef.current = Date.now();
    void startVoiceRecording(false);
  };

  const handleMicPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (voiceStatus !== 'recording' || recordLocked || pointerDownXRef.current === null) return;
    const deltaX = pointerDownXRef.current - e.clientX;
    if (deltaX > 0) {
      setSwipeCancelOffset(Math.min(110, deltaX));
      if (deltaX >= 80) {
        pointerDownXRef.current = null;
        cancelVoiceRecording();
      }
    } else {
      setSwipeCancelOffset(0);
    }
  };

  const handleMicPointerUp = () => {
    const heldMs = Date.now() - pointerDownTimeRef.current;
    pointerActiveRef.current = false;
    pointerDownXRef.current = null;
    setSwipeCancelOffset(0);

    if (voiceStatus !== 'recording' || recordLocked) return;

    // Quick tap (< 350ms) locks hands-free recording; long hold (>= 350ms) stops on release
    if (heldMs < 350) {
      setRecordLocked(true);
    } else {
      void finishVoiceRecording(false);
    }
  };

  const liveActivity = formatLiveActivity(typingUsers);

  return (
    <div className="border-t border-stone-200/90 dark:border-slate-800/90 bg-white dark:bg-[#161B22] px-3 sm:px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
      {/* Hidden Native File Inputs (triggered via native <label htmlFor> so mobile & iframes never block them) */}
      <input
        id={galleryInputId}
        type="file"
        accept="image/*"
        onChange={handleGalleryPicked}
        className="sr-only"
      />
      <input
        id={cameraFileInputId}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleGalleryPicked}
        className="sr-only"
      />
      <input id={fileInputId} type="file" onChange={handleFilePicked} className="sr-only" />
      <input
        id={audioFileInputId}
        type="file"
        accept="audio/*"
        onChange={handleAudioFileFallbackPicked}
        className="sr-only"
      />

      {/* Live Typing / Voice Note Recording & Sending Indicator */}
      <div className="min-h-4 px-1 mb-1 flex items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 min-w-0">
          {liveActivity && (
            <>
              {liveActivity.kind === 'recording_voice' || liveActivity.kind === 'sending_voice' ? (
                <>
                  <Mic className="w-3 h-3 text-accent shrink-0 animate-pulse" />
                  <span className="truncate font-medium text-accent">{liveActivity.text}</span>
                  <span className="inline-flex items-end gap-0.5 h-3 shrink-0">
                    {[0, 1, 2].map((bar) => (
                      <motion.span
                        key={bar}
                        animate={
                          prefersReducedMotion
                            ? undefined
                            : { height: ['4px', '11px', '5px'] }
                        }
                        transition={{
                          repeat: Infinity,
                          duration: 0.65,
                          delay: bar * 0.14,
                          ease: 'easeInOut',
                        }}
                        className="w-[2.5px] rounded-full bg-accent-solid"
                        style={{ height: '6px' }}
                      />
                    ))}
                  </span>
                </>
              ) : (
                <>
                  <span className="truncate font-medium text-accent">{liveActivity.text}</span>
                  <span className="inline-flex items-center gap-0.5 shrink-0">
                    {[0, 1, 2].map((dot) => (
                      <motion.span
                        key={dot}
                        animate={prefersReducedMotion ? undefined : { y: [0, -3, 0] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.7,
                          delay: dot * 0.14,
                          ease: 'easeInOut',
                        }}
                        className="w-1 h-1 rounded-full bg-accent-solid"
                      />
                    ))}
                  </span>
                </>
              )}
            </>
          )}
        </div>
        {hint && !error && (
          <span className="text-amber-700 dark:text-amber-400 font-medium truncate">{hint}</span>
        )}
      </div>

      {/* Prominent Dismissible Error Callout (Never silently hidden) */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mb-2 px-3 py-2 rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
              className="p-0.5 hover:opacity-75 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chunked Upload Progress Card (with Cancel & Retry) */}
      <AnimatePresence>
        {uploadProgress && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-[#0D1117] px-3.5 py-2.5 space-y-2"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-stone-900 dark:text-white truncate">
                  {uploadProgress.fileName}
                </p>
                <p className="text-[11px] text-stone-500 dark:text-slate-400 font-mono-tabular">
                  {uploadProgress.status === 'failed'
                    ? uploadProgress.error || 'Upload interrupted'
                    : uploadProgress.status === 'finalizing'
                      ? 'Finalizing file…'
                      : `${formatBytes(uploadProgress.uploadedBytes)} / ${formatBytes(
                          uploadProgress.totalBytes
                        )} · Chunk ${Math.min(
                          uploadProgress.chunkIndex + 1,
                          uploadProgress.totalChunks
                        )}/${uploadProgress.totalChunks} (${uploadProgress.progressPct}%)`}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {uploadProgress.status === 'failed' && activeUploadRef.current && (
                  <button
                    type="button"
                    onClick={() => void handleRetryUpload()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleCancelUpload()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-200/80 dark:bg-slate-800 hover:bg-stone-300 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-200 text-xs font-medium cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>

            <div className="h-1.5 rounded-full bg-stone-200 dark:bg-slate-800 overflow-hidden">
              <motion.div
                initial={false}
                animate={{ width: `${uploadProgress.progressPct}%` }}
                transition={{ ease: 'easeOut', duration: 0.18 }}
                className={`h-full ${
                  uploadProgress.status === 'failed' ? 'bg-red-500' : 'bg-emerald-600'
                }`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Reply or Edit Banner */}
      <AnimatePresence initial={false}>
        {(replyTo || editingMessage) && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            className={`mb-2 px-3 py-2 rounded-xl flex items-center justify-between gap-2 text-xs border ${
              editingMessage
                ? 'bg-emerald-50/90 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800/70'
                : 'bg-stone-100 dark:bg-slate-800/90 border-transparent'
            }`}
          >
            <div className="min-w-0 flex-1">
              {editingMessage ? (
                <div className="space-y-0.5 min-w-0">
                  <span className="font-semibold text-accent block">
                    Editing message · Press Enter to save or Esc to cancel
                  </span>
                  {editingMessage.text && (
                    <span className="text-[11px] text-stone-500 dark:text-slate-400 truncate block">
                      Original: “{editingMessage.text}”
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-stone-600 dark:text-slate-300 truncate block">
                  Replying to{' '}
                  <strong className="text-stone-900 dark:text-white">{replyTo?.authorName}</strong>:{' '}
                  {replyTo?.text || replyTo?.mediaName || 'attachment'}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (editingMessage) {
                  onCancelEdit();
                  setText('');
                } else {
                  onCancelReply();
                }
              }}
              aria-label="Cancel reply or edit"
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-slate-700/70 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* @Mention Autocomplete Popover (including @everyone & @all for groups) */}
      <AnimatePresence initial={false}>
        {(broadcastMentionOptions.length > 0 || filteredMentions.length > 0) && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            className="mb-2 p-1.5 rounded-xl bg-white dark:bg-[#1C2128] border border-stone-200 dark:border-slate-700 shadow-lg max-w-sm space-y-0.5"
          >
            {broadcastMentionOptions.length > 0 && (
              <>
                <p className="px-2 py-1 text-[11px] font-medium text-accent">
                  Notify entire group
                </p>
                {broadcastMentionOptions.map((opt) => (
                  <button
                    key={opt.token}
                    type="button"
                    onClick={() => insertMention(opt.token)}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-accent-soft flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-accent-soft text-accent-soft flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-900 dark:text-white truncate">
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                          {opt.desc}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono-tabular font-semibold text-accent shrink-0">
                      @{opt.token}
                    </span>
                  </button>
                ))}
              </>
            )}

            {filteredMentions.length > 0 && (
              <>
                <p className="px-2 py-1 text-[11px] font-medium text-stone-400 dark:text-slate-500">
                  Mention member
                </p>
                {filteredMentions.map((m) => (
                  <button
                    key={m.uid}
                    type="button"
                    onClick={() => insertMention(m.handle)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-stone-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="font-medium text-stone-900 dark:text-white truncate">
                      {m.displayName}
                    </span>
                    <span className="font-mono-tabular text-stone-500 dark:text-slate-400">
                      @{m.handle}
                    </span>
                  </button>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pre-Send Voice Note Preview & 8-Effect Voice Changer Picker */}
      {voiceDraft ? (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-emerald-300 dark:border-emerald-900/70 bg-stone-50 dark:bg-[#0D1117] p-3 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-900 dark:text-white">
              <AudioLines className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>Voice Note Preview & Voice Changer</span>
              {voiceDraft.processing && (
                <span className="text-[11px] font-normal text-stone-500 dark:text-slate-400">
                  Applying effect…
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setVoiceDraft(null)}
              aria-label="Discard voice note"
              className="p-1.5 rounded-md text-stone-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <VoiceNotePlayer
            src={voiceDraft.previewUrl}
            durationSec={voiceDraft.durationSec}
            waveform={voiceDraft.waveform}
            voiceEffect={voiceDraft.selectedEffect}
            compact
          />

          {/* 8 Voice Changer Effect Selector Buttons (Normal / Off always first) */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-stone-500 dark:text-slate-400">
              Choose voice effect before sending:
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {VOICE_EFFECTS.map((fx) => {
                const active = voiceDraft.selectedEffect === fx.id;
                return (
                  <button
                    key={fx.id}
                    type="button"
                    disabled={voiceDraft.processing}
                    onClick={() => void handleSelectVoiceDraftEffect(fx.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
                      active
                        ? 'bg-emerald-700 border-emerald-700 text-white'
                        : 'bg-white dark:bg-[#161B22] border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-200 hover:border-emerald-500'
                    }`}
                  >
                    {fx.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setVoiceDraft(null)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-stone-200/70 dark:hover:bg-slate-800 cursor-pointer"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={voiceDraft.processing || sending}
              onClick={() => void handleSendVoiceDraft()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? 'Uploading…' : 'Send Voice Note'}</span>
            </button>
          </div>
        </motion.div>
      ) : voiceStatus === 'mic_error' ? (
        /* Clear Mic Permission Recovery + Audio File Fallback */
        <div className="rounded-xl border border-amber-300 dark:border-amber-900/70 bg-amber-50/70 dark:bg-amber-950/30 px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{micErrorText}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => void startVoiceRecording(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
            >
              Try Mic Again
            </button>
            <label
              htmlFor={audioFileInputId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-800 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Audio</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setVoiceStatus('idle');
                setMicErrorText(null);
              }}
              className="p-1.5 rounded-lg text-stone-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : voiceStatus === 'requesting' || voiceStatus === 'recording' ? (
        /* Live Voice Recording Bar with Live Waveform, 5:00 Timer & Swipe-to-Cancel */
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-red-300 dark:border-red-900/70 bg-red-50/75 dark:bg-red-950/30 px-3.5 py-2.5 flex items-center justify-between gap-2.5 transition-transform"
          style={{
            transform:
              swipeCancelOffset > 0 ? `translateX(-${swipeCancelOffset * 0.4}px)` : undefined,
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Mic className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            {voiceStatus === 'requesting' ? (
              <span className="text-xs font-medium text-red-700 dark:text-red-300">
                Allow microphone access to start recording…
              </span>
            ) : (
              <>
                <span className="font-mono-tabular text-xs font-semibold text-red-700 dark:text-red-300 shrink-0">
                  {formatDuration(recordSeconds)} / {formatDuration(VOICE_NOTE_MAX_SEC)}
                </span>

                {/* Live Recording Waveform */}
                <div className="flex items-center gap-[2px] h-7 flex-1 max-w-[180px]">
                  {liveWaveBars.map((val, i) => (
                    <span
                      key={i}
                      className="flex-1 rounded-full bg-red-500/80 dark:bg-red-400/80 transition-all duration-75"
                      style={{ height: `${Math.max(16, Math.round(val * 100))}%` }}
                    />
                  ))}
                </div>

                {!recordLocked && (
                  <span className="hidden md:inline text-[11px] text-red-600/80 dark:text-red-300/80 truncate">
                    {swipeCancelOffset > 20 ? 'Release to cancel' : '← Swipe left to cancel'}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={cancelVoiceRecording}
              className="px-2.5 py-2 rounded-lg text-xs font-medium text-stone-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            {voiceStatus === 'recording' && (
              <button
                type="button"
                onClick={() => void finishVoiceRecording(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Done</span>
              </button>
            )}
          </div>
        </motion.div>
      ) : (
        /* Standard Message Composer (Phone + Laptop Optimized) */
        <div className="rounded-xl border border-stone-200 dark:border-slate-700/90 bg-stone-50/80 dark:bg-[#0D1117] focus-within:border-emerald-600 dark:focus-within:border-emerald-500 transition-colors">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => handleTextChange(e.target.value, e.target.selectionStart)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (typingIdleTimerRef.current !== null) {
                window.clearTimeout(typingIdleTimerRef.current);
                typingIdleTimerRef.current = null;
              }
              typingThrottleRef.current = 0;
              onTypingStop();
            }}
            enterKeyHint="send"
            autoCorrect="on"
            spellCheck
            maxLength={LIMITS.MESSAGE_TEXT_MAX}
            placeholder={placeholder || `Message ${roomName} (use @ to mention)`}
            className="w-full resize-none bg-transparent px-3.5 pt-2.5 pb-1.5 text-[16px] sm:text-sm text-stone-900 dark:text-slate-100 placeholder:text-stone-400 dark:placeholder:text-slate-500 focus:outline-none min-h-[42px] max-h-36 overflow-y-auto"
          />

          <div className="px-2 pb-2 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-0.5 flex-wrap">
              {!compact && (
                <>
                  {/* Native <label> for Gallery Photo (100% reliable on phones & iframes) */}
                  <label
                    htmlFor={sending ? undefined : galleryInputId}
                    aria-label="Share photo from gallery"
                    title={`Share photo from gallery (up to ${MAX_FILE_SIZE_MB} MB)`}
                    className={`p-2.5 sm:p-2 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors ${
                      sending ? 'opacity-45 pointer-events-none' : 'cursor-pointer'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                  </label>

                  {/* Camera Photo Capture */}
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => setCameraModalOpen(true)}
                    aria-label="Take photo with camera"
                    title="Take photo with camera"
                    className="p-2.5 sm:p-2 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-45"
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  {/* Native <label> for File / Video Attachment (up to 90 MB) */}
                  <label
                    htmlFor={sending ? undefined : fileInputId}
                    aria-label="Attach file"
                    title={`Attach document, video, or file (up to ${MAX_FILE_SIZE_MB} MB)`}
                    className={`p-2.5 sm:p-2 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors ${
                      sending ? 'opacity-45 pointer-events-none' : 'cursor-pointer'
                    }`}
                  >
                    <Paperclip className="w-4 h-4" />
                  </label>

                  {/* Voice Note (Tap OR Hold, 1s–5:00 + Voice Changer) */}
                  <button
                    type="button"
                    disabled={sending}
                    onPointerDown={handleMicPointerDown}
                    onPointerMove={handleMicPointerMove}
                    onPointerUp={handleMicPointerUp}
                    onPointerCancel={handleMicPointerUp}
                    aria-label="Tap or hold to record voice note"
                    title="Tap or hold to record voice note (1s–5:00, with Voice Changer)"
                    className="p-2.5 sm:p-2 rounded-lg text-stone-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer touch-none disabled:opacity-45"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </>
              )}

              {!compact && onOpenSongsModal && (
                <button
                  type="button"
                  onClick={onOpenSongsModal}
                  aria-label="Share movies and famous songs"
                  title="Send Movie & Famous Songs"
                  className="p-2.5 sm:p-2 rounded-lg text-stone-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Music2 className="w-4 h-4" />
                </button>
              )}

              {!compact && onOpenReelsModal && (
                <button
                  type="button"
                  onClick={onOpenReelsModal}
                  aria-label="Share or create Reels in group"
                  title="Share Instagram Reel or Make Reel"
                  className="p-2.5 sm:p-2 rounded-lg text-stone-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Film className="w-4 h-4" />
                </button>
              )}

              {!compact && onOpenPollModal && (
                <button
                  type="button"
                  onClick={onOpenPollModal}
                  aria-label="Create poll"
                  title="Create quick poll"
                  className="p-2.5 sm:p-2 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <BarChart2 className="w-4 h-4" />
                </button>
              )}

              {!compact && onOpenEventModal && (
                <button
                  type="button"
                  onClick={onOpenEventModal}
                  aria-label="Create event"
                  title="Create room event"
                  className="hidden sm:inline-flex p-2 rounded-lg text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setEmojiOpen((v) => !v);
                    setPickerQuery('');
                  }}
                  aria-label="Insert emoji, sticker, or GIF"
                  title="Emoji, Stickers & GIFs"
                  className={`inline-flex items-center gap-1 p-2.5 sm:px-2 sm:py-2 rounded-lg transition-colors cursor-pointer ${
                    emojiOpen
                      ? 'bg-accent-soft text-accent-soft'
                      : 'text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/70 dark:hover:bg-slate-800'
                  }`}
                >
                  <Smile className="w-4 h-4" />
                  {!compact && <span className="hidden sm:inline text-[11px] font-semibold">GIF</span>}
                </button>
                <AnimatePresence>
                  {emojiOpen && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setEmojiOpen(false)} />
                      <motion.div
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
                        transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                        className="fixed sm:absolute left-3 right-3 sm:left-0 sm:right-auto bottom-20 sm:bottom-full sm:mb-2 rounded-2xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-700 shadow-2xl z-30 sm:w-80 overflow-hidden"
                      >
                        {/* 3-Tab Switcher: Emoji · Stickers · GIFs */}
                        <div className="p-2 border-b border-stone-200 dark:border-slate-800 space-y-2">
                          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-slate-900">
                            {(
                              [
                                { id: 'emoji', label: 'Emoji' },
                                { id: 'stickers', label: 'Stickers' },
                                { id: 'gifs', label: 'GIFs' },
                              ] as const
                            ).map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setPickerTab(tab.id)}
                                className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  pickerTab === tab.id
                                    ? 'bg-white dark:bg-[#1C2128] text-stone-900 dark:text-white shadow-xs'
                                    : 'text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                          {pickerTab !== 'emoji' && (
                            <input
                              type="search"
                              value={pickerQuery}
                              onChange={(e) => setPickerQuery(e.target.value)}
                              placeholder={
                                pickerTab === 'stickers' ? 'Search stickers...' : 'Search animated GIFs...'
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-accent"
                            />
                          )}
                        </div>

                        <div className="max-h-64 overflow-y-auto p-2.5">
                          {pickerTab === 'emoji' && (
                            <div className="space-y-3">
                              {COMPOSER_EMOJI_GROUPS.map((grp) => (
                                <div key={grp.label} className="space-y-1">
                                  <p className="text-[10px] font-semibold text-stone-400 dark:text-slate-500 px-1">
                                    {grp.label}
                                  </p>
                                  <div className="grid grid-cols-6 gap-1">
                                    {grp.emojis.map((em) => (
                                      <motion.button
                                        key={`${grp.label}-${em}`}
                                        type="button"
                                        whileHover={prefersReducedMotion ? undefined : { scale: 1.2 }}
                                        whileTap={prefersReducedMotion ? undefined : { scale: 0.88 }}
                                        onClick={() => {
                                          setText((prev) => prev + em);
                                          textareaRef.current?.focus();
                                        }}
                                        className="h-9 flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800 text-lg cursor-pointer"
                                      >
                                        {em}
                                      </motion.button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {pickerTab === 'stickers' && (
                            <div className="space-y-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEmojiOpen(false);
                                  setStudioInitialTab('sticker');
                                  setStudioOpen(true);
                                }}
                                className="w-full py-2 px-3 rounded-xl bg-accent-soft text-accent-soft hover:opacity-90 text-xs font-semibold flex items-center justify-center gap-1.5 transition-opacity cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>+ Make Custom Sticker</span>
                              </button>

                              {(() => {
                                const q = pickerQuery.trim().toLowerCase();
                                const myStickers = customStudioMedia.filter(
                                  (m) =>
                                    m.kind === 'sticker' &&
                                    (!q || m.label.toLowerCase().includes(q))
                                );
                                if (myStickers.length === 0) return null;
                                return (
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold text-stone-400 dark:text-slate-500 px-1">
                                      My Custom Stickers ({myStickers.length})
                                    </p>
                                    <div className="grid grid-cols-4 gap-2">
                                      {myStickers.map((stk) => (
                                        <div key={stk.id} className="relative group">
                                          <motion.button
                                            type="button"
                                            disabled={sending}
                                            whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
                                            whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                                            onClick={() =>
                                              void sendStickerOrGifAsset('sticker', stk.label, stk.dataUrl)
                                            }
                                            title={stk.label}
                                            className="w-full aspect-square p-1 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                                          >
                                            <img
                                              src={stk.dataUrl}
                                              alt={stk.label}
                                              referrerPolicy="no-referrer"
                                              className="w-full h-full object-contain"
                                            />
                                          </motion.button>
                                          <button
                                            type="button"
                                            onClick={() => void handleDeleteCustomAsset(stk.id)}
                                            aria-label={`Delete ${stk.label}`}
                                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-stone-900/85 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}

                              <div className="grid grid-cols-4 gap-2">
                                {STICKERS.filter((s) => {
                                  const q = pickerQuery.trim().toLowerCase();
                                  if (!q) return true;
                                  return (
                                    s.label.toLowerCase().includes(q) ||
                                    s.category.includes(q) ||
                                    s.keywords.some((k) => k.includes(q))
                                  );
                                }).map((stk) => (
                                  <motion.button
                                    key={stk.id}
                                    type="button"
                                    disabled={sending}
                                    whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
                                    whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                                    onClick={() =>
                                      void sendStickerOrGifAsset('sticker', stk.label, stk.dataUrl)
                                    }
                                    title={stk.label}
                                    className="aspect-square p-1 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    <img
                                      src={stk.dataUrl}
                                      alt={stk.label}
                                      className="w-full h-full object-contain"
                                    />
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          )}

                          {pickerTab === 'gifs' && (
                            <div className="space-y-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEmojiOpen(false);
                                  setStudioInitialTab('gif');
                                  setStudioOpen(true);
                                }}
                                className="w-full py-2 px-3 rounded-xl bg-accent-soft text-accent-soft hover:opacity-90 text-xs font-semibold flex items-center justify-center gap-1.5 transition-opacity cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Make Animated GIF</span>
                              </button>

                              {(() => {
                                const q = pickerQuery.trim().toLowerCase();
                                const myGifs = customStudioMedia.filter(
                                  (m) =>
                                    m.kind === 'gif' &&
                                    (!q || m.label.toLowerCase().includes(q))
                                );
                                if (myGifs.length === 0) return null;
                                return (
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold text-stone-400 dark:text-slate-500 px-1">
                                      My Custom GIFs ({myGifs.length})
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {myGifs.map((gif) => (
                                        <div key={gif.id} className="relative group">
                                          <motion.button
                                            type="button"
                                            disabled={sending}
                                            whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
                                            whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                                            onClick={() =>
                                              void sendStickerOrGifAsset('gif', gif.label, gif.dataUrl)
                                            }
                                            title={gif.label}
                                            className="w-full rounded-xl overflow-hidden border border-stone-200 dark:border-slate-700 hover:border-accent transition-colors cursor-pointer disabled:opacity-50"
                                          >
                                            <img
                                              src={gif.dataUrl}
                                              alt={gif.label}
                                              referrerPolicy="no-referrer"
                                              className="w-full h-24 object-cover"
                                            />
                                          </motion.button>
                                          <button
                                            type="button"
                                            onClick={() => void handleDeleteCustomAsset(gif.id)}
                                            aria-label={`Delete ${gif.label}`}
                                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}

                              <div className="grid grid-cols-2 gap-2">
                                {ANIMATED_GIFS.filter((g) => {
                                  const q = pickerQuery.trim().toLowerCase();
                                  if (!q) return true;
                                  return (
                                    g.label.toLowerCase().includes(q) ||
                                    g.category.includes(q) ||
                                    g.keywords.some((k) => k.includes(q))
                                  );
                                }).map((gif) => (
                                  <motion.button
                                    key={gif.id}
                                    type="button"
                                    disabled={sending}
                                    whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
                                    whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                                    onClick={() =>
                                      void sendStickerOrGifAsset('gif', gif.label, gif.dataUrl)
                                    }
                                    title={gif.label}
                                    className="rounded-xl overflow-hidden border border-stone-200 dark:border-slate-700 hover:border-accent transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    <img
                                      src={gif.dataUrl}
                                      alt={gif.label}
                                      className="w-full h-24 object-cover"
                                    />
                                  </motion.button>
                                ))}
                              </div>
                              {!compact && (
                                <label
                                  htmlFor={galleryInputId}
                                  onClick={() => setEmojiOpen(false)}
                                  className="block w-full py-2 rounded-lg text-center text-[11px] font-semibold bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-200 cursor-pointer"
                                >
                                  + Upload GIF file from device
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <motion.button
              type="button"
              whileHover={prefersReducedMotion || !text.trim() ? undefined : { scale: 1.03 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
              transition={{ type: 'spring', stiffness: 520, damping: 28 }}
              onClick={() => void handleSubmit()}
              disabled={!text.trim() || sending}
              aria-label={editingMessage ? 'Save edited message' : 'Send message'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-semibold bg-accent disabled:opacity-45 text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{editingMessage ? 'Save Edit' : 'Send'}</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* Live Camera Capture Modal (with guaranteed Device Camera / Photo Picker fallback) */}
      <AnimatePresence>
        {cameraModalOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Take a photo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-[#161B22] border border-slate-700 overflow-hidden shadow-2xl"
            >
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-white">
                <span className="text-sm font-semibold">Take or Choose a Photo</span>
                <button
                  type="button"
                  onClick={() => setCameraModalOpen(false)}
                  aria-label="Close camera"
                  className="p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {cameraError ? (
                <div className="p-6 text-center space-y-4">
                  <Camera className="w-9 h-9 mx-auto text-slate-400" />
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{cameraError}</p>
                  <div className="flex items-center justify-center gap-2.5 flex-wrap">
                    <label
                      htmlFor={cameraFileInputId}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Open Device Camera</span>
                    </label>
                    <label
                      htmlFor={galleryInputId}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 cursor-pointer"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>Choose from Gallery</span>
                    </label>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-black aspect-video flex items-center justify-center overflow-hidden relative">
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {!cameraReady && (
                      <span className="absolute text-xs text-slate-300">Starting camera…</span>
                    )}
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between gap-2 bg-[#161B22] flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCameraFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                        }
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        Flip Camera
                      </button>
                      <label
                        htmlFor={galleryInputId}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        Gallery
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCameraModalOpen(false)}
                        className="px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!cameraReady}
                        onClick={handleSnapCameraPhoto}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Capture & Send</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-App Custom Sticker & Animated GIF Maker Studio */}
      <StickerGifStudioModal
        open={studioOpen}
        initialTab={studioInitialTab}
        currentUid={currentUid}
        onClose={() => setStudioOpen(false)}
        onCreated={async (item, sendNow) => {
          setCustomStudioMedia((prev) => {
            const next = [item, ...prev.filter((x) => x.id !== item.id)].slice(0, 48);
            try {
              localStorage.setItem(`quadline_custom_media_${currentUid}`, JSON.stringify(next));
            } catch {
              // Ignore storage quota errors
            }
            return next;
          });
          if (sendNow) {
            await sendStickerOrGifAsset(item.kind, item.label, item.dataUrl);
          } else {
            setHint(
              item.kind === 'sticker'
                ? `Saved "${item.label}" to My Stickers`
                : `Saved "${item.label}" to My GIFs`
            );
          }
        }}
      />
    </div>
  );
}
