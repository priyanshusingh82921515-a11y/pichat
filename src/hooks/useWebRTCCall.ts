import { useCallback, useEffect, useRef, useState } from 'react';
import { getIceServers, type VoiceEffectId } from '../lib/constants';
import { createLiveVoiceProcessor, type LiveVoiceProcessor } from '../lib/voiceEffects';
import type {
  CallMode,
  CallPeerInfo,
  CallSignalPayload,
  CallStatus,
  ConnectionQuality,
} from '../types/chat';

interface UseWebRTCCallParams {
  currentUser: CallPeerInfo | null;
  socketConnected?: boolean;
  sendCallSignal: (signal: CallSignalPayload) => boolean;
  subscribeCallSignals: (listener: (signal: CallSignalPayload) => void) => () => void;
  onNotice?: (message: string, tone?: 'info' | 'error') => void;
}

export interface ActiveCallViewModel {
  callId: string | null;
  status: CallStatus;
  mode: CallMode;
  peer: CallPeerInfo | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOn: boolean;
  canSwitchCamera: boolean;
  isScreenSharing: boolean;
  remoteIsScreenSharing: boolean;
  voiceEffect: VoiceEffectId;
  remoteVoiceEffect: VoiceEffectId;
  durationSec: number;
  quality: ConnectionQuality;
  rttMs: number | null;
  statusDetail: string;
  isTestMode: boolean;
  isMonitoringVoice: boolean;
}

export function useWebRTCCall({
  currentUser,
  socketConnected = true,
  sendCallSignal,
  subscribeCallSignals,
  onNotice,
}: UseWebRTCCallParams) {
  const [callId, setCallId] = useState<string | null>(null);
  const [status, setStatus] = useState<CallStatus>('idle');
  const [mode, setMode] = useState<CallMode>('video');
  const [peer, setPeer] = useState<CallPeerInfo | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);
  const [voiceEffect, setVoiceEffectState] = useState<VoiceEffectId>('normal');
  const [remoteVoiceEffect, setRemoteVoiceEffect] = useState<VoiceEffectId>('normal');
  const [durationSec, setDurationSec] = useState(0);
  const [quality, setQuality] = useState<ConnectionQuality>('unknown');
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [statusDetail, setStatusDetail] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);
  const [isMonitoringVoice, setIsMonitoringVoice] = useState(false);

  // Mutable refs for WebRTC callbacks without stale closures
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const rawMicStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const voiceProcessorRef = useRef<LiveVoiceProcessor | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const callIdRef = useRef<string | null>(null);
  const statusRef = useRef<CallStatus>('idle');
  const peerRef = useRef<CallPeerInfo | null>(null);
  const modeRef = useRef<CallMode>('video');
  const isInitiatorRef = useRef(false);
  const isMutedRef = useRef(false);
  const cameraDeviceIndexRef = useRef(0);
  const videoDevicesRef = useRef<MediaDeviceInfo[]>([]);
  const reconnectTimerRef = useRef<number | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const isTestModeRef = useRef(false);

  statusRef.current = status;
  callIdRef.current = callId;
  peerRef.current = peer;
  modeRef.current = mode;
  isTestModeRef.current = isTestMode;

  const cleanupCall = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.metadata = null;
      } catch {
        // Ignore unsupported mediaSession cleanup
      }
    }

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    voiceProcessorRef.current?.dispose();
    voiceProcessorRef.current = null;

    for (const stream of [rawMicStreamRef.current, cameraStreamRef.current, screenStreamRef.current]) {
      stream?.getTracks().forEach((t) => t.stop());
    }
    rawMicStreamRef.current = null;
    cameraStreamRef.current = null;
    screenStreamRef.current = null;
    pendingIceRef.current = [];

    setCallId(null);
    setStatus('idle');
    setPeer(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    isMutedRef.current = false;
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setRemoteIsScreenSharing(false);
    setVoiceEffectState('normal');
    setRemoteVoiceEffect('normal');
    setDurationSec(0);
    setQuality('unknown');
    setRttMs(null);
    setStatusDetail('');
    setIsTestMode(false);
    setIsMonitoringVoice(false);
  }, []);

  const refreshVideoDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === 'videoinput');
      videoDevicesRef.current = cams;
      setCanSwitchCamera(cams.length > 1);
    } catch {
      setCanSwitchCamera(false);
    }
  }, []);

  const acquireLocalMedia = useCallback(
    async (withVideo: boolean): Promise<{ audioTrack: MediaStreamTrack; videoTrack: MediaStreamTrack | null }> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: withVideo
            ? {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
        });

        const rawAudioTrack = stream.getAudioTracks()[0];
        if (!rawAudioTrack) {
          throw new Error('Microphone stream unavailable.');
        }

        const audioOnlyStream = new MediaStream([rawAudioTrack]);
        rawMicStreamRef.current = audioOnlyStream;

        const processor = await createLiveVoiceProcessor(audioOnlyStream, 'normal');
        voiceProcessorRef.current = processor;
        const processedAudioTrack = processor.outputStream.getAudioTracks()[0];
        processedAudioTrack.enabled = !isMutedRef.current;

        const videoTrack = stream.getVideoTracks()[0] || null;
        if (videoTrack) {
          cameraStreamRef.current = new MediaStream([videoTrack]);
          setIsCameraOn(true);
        } else {
          cameraStreamRef.current = null;
          setIsCameraOn(false);
        }

        const previewTracks: MediaStreamTrack[] = [processedAudioTrack];
        if (videoTrack) previewTracks.push(videoTrack);
        setLocalStream(new MediaStream(previewTracks));

        await refreshVideoDevices();
        return { audioTrack: processedAudioTrack, videoTrack };
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          throw new Error(
            withVideo
              ? 'Camera and microphone access was denied. Please allow permissions in your browser.'
              : 'Microphone access was denied. Please allow microphone permission in your browser.'
          );
        }
        if (name === 'NotFoundError') {
          throw new Error('No microphone or camera device was found on this device.');
        }
        throw new Error(err instanceof Error ? err.message : 'Unable to access microphone/camera.');
      }
    },
    [refreshVideoDevices]
  );

  const attemptIceRestart = useCallback(async () => {
    const pc = pcRef.current;
    const activePeer = peerRef.current;
    const activeCallId = callIdRef.current;
    if (!pc || !activePeer || !activeCallId) return;
    if (pc.signalingState !== 'stable') return;

    try {
      setStatus('reconnecting');
      setStatusDetail('Network interrupted — reconnecting…');
      if (typeof pc.restartIce === 'function') {
        pc.restartIce();
      }
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      sendCallSignal({
        type: 'call:offer',
        callId: activeCallId,
        targetUid: activePeer.uid,
        sdp: offer,
      });
    } catch {
      // Next network event or timeout will retry
    }
  }, [sendCallSignal]);

  const createPeerConnection = useCallback(
    (activeCallId: string, targetPeer: CallPeerInfo) => {
      const pc = new RTCPeerConnection({
        iceServers: getIceServers(),
        iceCandidatePoolSize: 6,
      });
      pcRef.current = pc;

      const remoteMedia = new MediaStream();
      setRemoteStream(remoteMedia);

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach((track) => {
            if (!remoteMedia.getTracks().some((t) => t.id === track.id)) {
              remoteMedia.addTrack(track);
            }
          });
        } else if (event.track) {
          if (!remoteMedia.getTracks().some((t) => t.id === event.track.id)) {
            remoteMedia.addTrack(event.track);
          }
        }
        setRemoteStream(new MediaStream(remoteMedia.getTracks()));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendCallSignal({
            type: 'call:ice',
            callId: activeCallId,
            targetUid: targetPeer.uid,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        if (iceState === 'connected' || iceState === 'completed') {
          if (reconnectTimerRef.current !== null) {
            window.clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          setStatus('connected');
          setStatusDetail('');
        } else if (iceState === 'disconnected') {
          setStatus('reconnecting');
          setStatusDetail('Connection unstable — reconnecting…');
          if (isInitiatorRef.current && reconnectTimerRef.current === null) {
            reconnectTimerRef.current = window.setTimeout(() => {
              reconnectTimerRef.current = null;
              if (
                pcRef.current &&
                (pcRef.current.iceConnectionState === 'disconnected' ||
                  pcRef.current.iceConnectionState === 'failed')
              ) {
                void attemptIceRestart();
              }
            }, 2500);
          }
        } else if (iceState === 'failed') {
          if (isInitiatorRef.current) {
            void attemptIceRestart();
          } else {
            setStatus('reconnecting');
            setStatusDetail('Waiting for peer to reconnect…');
          }
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setStatus('connected');
          setStatusDetail('');
        } else if (pc.connectionState === 'failed') {
          setStatus('reconnecting');
          setStatusDetail('Re-establishing media link…');
        }
      };

      return pc;
    },
    [attemptIceRestart, sendCallSignal]
  );

  // Trigger ICE restart automatically when browser comes back online or foregrounded mid-call
  useEffect(() => {
    const handleOnline = () => {
      void voiceProcessorRef.current?.resume();
      if (statusRef.current === 'reconnecting' || statusRef.current === 'connected') {
        const ice = pcRef.current?.iceConnectionState;
        if (isInitiatorRef.current && (ice === 'disconnected' || ice === 'failed' || statusRef.current === 'reconnecting')) {
          void attemptIceRestart();
        }
      }
    };

    const handleVisibility = () => {
      if (statusRef.current === 'idle') return;
      void voiceProcessorRef.current?.resume();
      if (!document.hidden) {
        // Re-acquire screen wake lock when returning from another app
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock && !wakeLockRef.current) {
          nav.wakeLock
            .request('screen')
            .then((sentinel) => {
              wakeLockRef.current = sentinel;
            })
            .catch(() => {});
        }
        const ice = pcRef.current?.iceConnectionState;
        if (isInitiatorRef.current && (ice === 'disconnected' || ice === 'failed')) {
          void attemptIceRestart();
        }
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [attemptIceRestart]);

  // Recover WebRTC connection automatically if signaling WebSocket reconnects mid-call
  useEffect(() => {
    if (!socketConnected || statusRef.current === 'idle' || isTestModeRef.current) return;
    const ice = pcRef.current?.iceConnectionState;
    if (
      isInitiatorRef.current &&
      (statusRef.current === 'reconnecting' || ice === 'disconnected' || ice === 'failed')
    ) {
      void attemptIceRestart();
    }
  }, [socketConnected, attemptIceRestart]);

  // Acquire Wake Lock + OS Media Session during active calls so switching apps keeps call audio alive
  useEffect(() => {
    const isActive = status !== 'idle';
    if (!isActive || !peer) return;

    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (nav.wakeLock && !wakeLockRef.current) {
      nav.wakeLock
        .request('screen')
        .then((sentinel) => {
          wakeLockRef.current = sentinel;
        })
        .catch(() => {});
    }

    if ('mediaSession' in navigator) {
      try {
        if (typeof MediaMetadata !== 'undefined') {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: `${mode === 'video' ? 'Video' : 'Voice'} call with ${peer.displayName}`,
            artist: 'Quadline Ongoing Call',
            album: 'Encrypted WebRTC Call',
            artwork: [{ src: '/app-logo.png', sizes: '512x512', type: 'image/png' }],
          });
        }
        navigator.mediaSession.playbackState = 'playing';
      } catch {
        // Ignore browsers without full MediaSession support
      }
    }
  }, [status, peer, mode]);

  // Call duration timer
  useEffect(() => {
    if (status !== 'connected') return;
    const timer = window.setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  // Live WebRTC connection quality telemetry (RTT & packet loss)
  useEffect(() => {
    if (status !== 'connected' && status !== 'reconnecting') return;
    const interval = window.setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let currentRttMs: number | null = null;
        let packetsLost = 0;
        let packetsReceived = 0;

        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (typeof report.currentRoundTripTime === 'number') {
              currentRttMs = Math.round(report.currentRoundTripTime * 1000);
            }
          }
          if (report.type === 'inbound-rtp') {
            if (typeof report.packetsLost === 'number') packetsLost += report.packetsLost;
            if (typeof report.packetsReceived === 'number') packetsReceived += report.packetsReceived;
          }
        });

        setRttMs(currentRttMs);
        const totalPkts = packetsLost + packetsReceived;
        const lossRatio = totalPkts > 0 ? packetsLost / totalPkts : 0;

        if (statusRef.current === 'reconnecting') {
          setQuality('poor');
        } else if (currentRttMs !== null) {
          if (currentRttMs < 110 && lossRatio < 0.02) setQuality('excellent');
          else if (currentRttMs < 230 && lossRatio < 0.05) setQuality('good');
          else if (currentRttMs < 400 && lossRatio < 0.1) setQuality('fair');
          else setQuality('poor');
        }
      } catch {
        // Ignore transient getStats error
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [status]);

  // Subscribe to WebSocket WebRTC signaling messages
  useEffect(() => {
    return subscribeCallSignals((signal) => {
      const { type } = signal;

      if (type === 'call:invite' && signal.fromUid && signal.callId) {
        if (statusRef.current !== 'idle') {
          sendCallSignal({
            type: 'call:busy',
            callId: signal.callId,
            targetUid: signal.fromUid,
          });
          return;
        }
        isInitiatorRef.current = false;
        setCallId(signal.callId);
        setMode(signal.mode === 'audio' ? 'audio' : 'video');
        setPeer({
          uid: signal.fromUid,
          displayName: signal.fromName || 'Campus Member',
          photoUrl: signal.fromPhoto || '',
        });
        setStatus('ringing');
        setStatusDetail(signal.mode === 'audio' ? 'Incoming voice call' : 'Incoming video call');
        return;
      }

      if (type === 'call:offline' && signal.callId === callIdRef.current) {
        onNotice?.(`${peerRef.current?.displayName || 'Member'} is currently offline.`, 'info');
        cleanupCall();
        return;
      }

      if (type === 'call:busy' && signal.callId === callIdRef.current) {
        onNotice?.(`${peerRef.current?.displayName || 'Member'} is on another call.`, 'info');
        cleanupCall();
        return;
      }

      if (type === 'call:reject' && signal.callId === callIdRef.current) {
        onNotice?.(`${peerRef.current?.displayName || 'Member'} declined the call.`, 'info');
        cleanupCall();
        return;
      }

      if (type === 'call:hangup' && signal.callId === callIdRef.current) {
        onNotice?.('Call ended.', 'info');
        cleanupCall();
        return;
      }

      if (type === 'call:peer_disconnected' && signal.callId === callIdRef.current) {
        setStatus('reconnecting');
        setStatusDetail('Peer switched network — reconnecting…');
        return;
      }

      if (type === 'call:peer_reconnected' && signal.callId === callIdRef.current) {
        setStatusDetail('Peer back online — restoring audio & video…');
        if (isInitiatorRef.current) {
          void attemptIceRestart();
        }
        return;
      }

      if (type === 'call:screen_state' && signal.callId === callIdRef.current) {
        setRemoteIsScreenSharing(Boolean(signal.isSharingScreen));
        return;
      }

      if (type === 'call:effect_state' && signal.callId === callIdRef.current && signal.voiceEffect) {
        setRemoteVoiceEffect(signal.voiceEffect);
        return;
      }

      // Caller receives call:accept -> create RTCPeerConnection & send Offer
      if (type === 'call:accept' && signal.callId === callIdRef.current && peerRef.current) {
        void (async () => {
          try {
            setStatus('connecting');
            setStatusDetail('Connecting peer audio & video…');
            const pc = createPeerConnection(signal.callId!, peerRef.current!);
            const localTracks = localStream?.getTracks() || [];
            // Add existing local tracks from refs
            const procAudio = voiceProcessorRef.current?.outputStream.getAudioTracks()[0];
            const camVideo = cameraStreamRef.current?.getVideoTracks()[0];
            const sendStream = new MediaStream();
            if (procAudio) {
              sendStream.addTrack(procAudio);
              pc.addTrack(procAudio, sendStream);
            }
            if (camVideo) {
              sendStream.addTrack(camVideo);
              pc.addTrack(camVideo, sendStream);
            } else if (localTracks.length === 0) {
              // Ensure at least audio transceiver exists
              pc.addTransceiver('audio', { direction: 'sendrecv' });
            }

            const offer = await pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pc.setLocalDescription(offer);
            sendCallSignal({
              type: 'call:offer',
              callId: signal.callId!,
              targetUid: peerRef.current!.uid,
              sdp: offer,
            });
          } catch (err) {
            onNotice?.(err instanceof Error ? err.message : 'Failed to start WebRTC call.', 'error');
            cleanupCall();
          }
        })();
        return;
      }

      // Callee (or renegotiating peer) receives Offer -> setRemoteDescription & send Answer
      if (type === 'call:offer' && signal.callId === callIdRef.current && signal.sdp && signal.fromUid) {
        void (async () => {
          try {
            let pc = pcRef.current;
            if (!pc) {
              pc = createPeerConnection(signal.callId!, {
                uid: signal.fromUid!,
                displayName: signal.fromName || peerRef.current?.displayName || 'Member',
                photoUrl: peerRef.current?.photoUrl,
              });
              const procAudio = voiceProcessorRef.current?.outputStream.getAudioTracks()[0];
              const camVideo = cameraStreamRef.current?.getVideoTracks()[0];
              const sendStream = new MediaStream();
              if (procAudio) {
                sendStream.addTrack(procAudio);
                pc.addTrack(procAudio, sendStream);
              }
              if (camVideo) {
                sendStream.addTrack(camVideo);
                pc.addTrack(camVideo, sendStream);
              }
            }

            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
            for (const cand of pendingIceRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            pendingIceRef.current = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendCallSignal({
              type: 'call:answer',
              callId: signal.callId!,
              targetUid: signal.fromUid!,
              sdp: answer,
            });
          } catch (err) {
            onNotice?.(err instanceof Error ? err.message : 'Call negotiation failed.', 'error');
          }
        })();
        return;
      }

      // Caller receives Answer
      if (type === 'call:answer' && signal.callId === callIdRef.current && signal.sdp) {
        void (async () => {
          const pc = pcRef.current;
          if (!pc) return;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp!));
            for (const cand of pendingIceRef.current) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
            pendingIceRef.current = [];
          } catch {
            // Ignore duplicate answer
          }
        })();
        return;
      }

      // ICE Candidate
      if (type === 'call:ice' && signal.callId === callIdRef.current && signal.candidate) {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        } else {
          pendingIceRef.current.push(signal.candidate);
        }
      }
    });
  }, [cleanupCall, createPeerConnection, localStream, onNotice, sendCallSignal, subscribeCallSignals]);

  const startCall = useCallback(
    async (targetPeer: CallPeerInfo, callMode: CallMode) => {
      if (!currentUser) return;
      if (statusRef.current !== 'idle') {
        onNotice?.('You are already in an active call.', 'info');
        return;
      }

      const nextCallId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      isInitiatorRef.current = true;
      setCallId(nextCallId);
      setMode(callMode);
      setPeer(targetPeer);
      setStatus('calling');
      setStatusDetail('Requesting microphone & camera…');

      try {
        await acquireLocalMedia(callMode === 'video');
        setStatusDetail(`Ringing ${targetPeer.displayName}…`);
        const sent = sendCallSignal({
          type: 'call:invite',
          callId: nextCallId,
          targetUid: targetPeer.uid,
          fromPhoto: currentUser.photoUrl || '',
          mode: callMode,
        });
        if (!sent) {
          throw new Error('Real-time signaling server is disconnected. Please try again.');
        }
      } catch (err) {
        onNotice?.(err instanceof Error ? err.message : 'Unable to start call.', 'error');
        cleanupCall();
      }
    },
    [acquireLocalMedia, cleanupCall, currentUser, onNotice, sendCallSignal]
  );

  const startSelfTestCall = useCallback(
    async (callMode: CallMode) => {
      if (statusRef.current !== 'idle') {
        onNotice?.('End your current call before starting a device check.', 'info');
        return;
      }

      const nextCallId = `test_${Date.now()}`;
      setCallId(nextCallId);
      setMode(callMode);
      setIsTestMode(true);
      setPeer({
        uid: 'studio_check',
        displayName: callMode === 'video' ? 'Video & Voice FX Studio' : 'Voice & FX Studio',
        photoUrl: currentUser?.photoUrl || '',
      });
      setStatus('connecting');
      setStatusDetail('Opening camera & microphone…');

      try {
        const { audioTrack, videoTrack } = await acquireLocalMedia(callMode === 'video');
        const previewTracks: MediaStreamTrack[] = [audioTrack];
        if (videoTrack) previewTracks.push(videoTrack);
        setRemoteStream(new MediaStream(previewTracks));
        setQuality('excellent');
        setRttMs(1);
        setStatus('connected');
        setStatusDetail('Live local studio active — switch effects or share screen');
      } catch (err) {
        onNotice?.(err instanceof Error ? err.message : 'Unable to start device test.', 'error');
        cleanupCall();
      }
    },
    [acquireLocalMedia, cleanupCall, currentUser, onNotice]
  );

  const toggleMonitorVoice = useCallback(() => {
    setIsMonitoringVoice((prev) => {
      const next = !prev;
      voiceProcessorRef.current?.setMonitorEnabled(next);
      return next;
    });
  }, []);

  const acceptCall = useCallback(async () => {
    const activeCallId = callIdRef.current;
    const activePeer = peerRef.current;
    if (!activeCallId || !activePeer || statusRef.current !== 'ringing') return;

    try {
      setStatus('connecting');
      setStatusDetail('Accessing microphone & camera…');
      await acquireLocalMedia(modeRef.current === 'video');
      sendCallSignal({
        type: 'call:accept',
        callId: activeCallId,
        targetUid: activePeer.uid,
      });
    } catch (err) {
      onNotice?.(err instanceof Error ? err.message : 'Could not join call.', 'error');
      sendCallSignal({
        type: 'call:reject',
        callId: activeCallId,
        targetUid: activePeer.uid,
      });
      cleanupCall();
    }
  }, [acquireLocalMedia, cleanupCall, onNotice, sendCallSignal]);

  const rejectCall = useCallback(() => {
    if (callIdRef.current && peerRef.current) {
      sendCallSignal({
        type: 'call:reject',
        callId: callIdRef.current,
        targetUid: peerRef.current.uid,
      });
    }
    cleanupCall();
  }, [cleanupCall, sendCallSignal]);

  const endCall = useCallback(() => {
    if (callIdRef.current && peerRef.current && !isTestModeRef.current) {
      sendCallSignal({
        type: 'call:hangup',
        callId: callIdRef.current,
        targetUid: peerRef.current.uid,
      });
    }
    cleanupCall();
  }, [cleanupCall, sendCallSignal]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMutedRef.current;
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    voiceProcessorRef.current?.outputStream.getAudioTracks().forEach((t) => {
      t.enabled = !nextMuted;
    });
    rawMicStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !nextMuted;
    });
  }, []);

  const renegotiateIfNeeded = useCallback(async () => {
    const pc = pcRef.current;
    const activePeer = peerRef.current;
    const activeCallId = callIdRef.current;
    if (!pc || !activePeer || !activeCallId || pc.signalingState !== 'stable') return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendCallSignal({
        type: 'call:offer',
        callId: activeCallId,
        targetUid: activePeer.uid,
        sdp: offer,
      });
    } catch {
      // Non-fatal
    }
  }, [sendCallSignal]);

  const toggleCamera = useCallback(async () => {
    const pc = pcRef.current;
    const currentCamTrack = cameraStreamRef.current?.getVideoTracks()[0];

    if (currentCamTrack) {
      const nextEnabled = !currentCamTrack.enabled;
      currentCamTrack.enabled = nextEnabled;
      setIsCameraOn(nextEnabled);
      return;
    }

    // Audio-only call upgrading to video
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newVideoTrack = camStream.getVideoTracks()[0];
      cameraStreamRef.current = camStream;
      setIsCameraOn(true);
      setMode('video');

      const procAudio = voiceProcessorRef.current?.outputStream.getAudioTracks()[0];
      const tracks = procAudio ? [procAudio, newVideoTrack] : [newVideoTrack];
      setLocalStream(new MediaStream(tracks));

      if (pc && !isScreenSharing) {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        } else {
          pc.addTrack(newVideoTrack, new MediaStream(tracks));
          await renegotiateIfNeeded();
        }
      } else if (isTestMode && !isScreenSharing) {
        setRemoteStream(new MediaStream(tracks));
      }
      await refreshVideoDevices();
    } catch {
      onNotice?.('Could not access camera. Please check browser permissions.', 'error');
    }
  }, [isScreenSharing, isTestMode, onNotice, refreshVideoDevices, renegotiateIfNeeded]);

  const switchCamera = useCallback(async () => {
    const cams = videoDevicesRef.current;
    if (cams.length < 2) return;
    const nextIdx = (cameraDeviceIndexRef.current + 1) % cams.length;
    cameraDeviceIndexRef.current = nextIdx;
    const nextDevice = cams[nextIdx];

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: nextDevice.deviceId } },
      });
      const newTrack = nextStream.getVideoTracks()[0];
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = nextStream;
      setIsCameraOn(true);

      if (!isScreenSharing) {
        const pc = pcRef.current;
        const videoSender = pc?.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(newTrack);
        }
        const procAudio = voiceProcessorRef.current?.outputStream.getAudioTracks()[0];
        const nextStreamObj = new MediaStream(procAudio ? [procAudio, newTrack] : [newTrack]);
        setLocalStream(nextStreamObj);
        if (isTestMode) setRemoteStream(nextStreamObj);
      }
    } catch {
      onNotice?.('Unable to switch camera on this device.', 'error');
    }
  }, [isScreenSharing, isTestMode, onNotice]);

  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    const pc = pcRef.current;
    const camTrack = cameraStreamRef.current?.getVideoTracks()[0] || null;
    const videoSender = pc?.getSenders().find((s) => s.track?.kind === 'video');
    if (videoSender) {
      await videoSender.replaceTrack(camTrack).catch(() => {});
    }

    const procAudio = voiceProcessorRef.current?.outputStream.getAudioTracks()[0];
    const nextLocalTracks: MediaStreamTrack[] = [];
    if (procAudio) nextLocalTracks.push(procAudio);
    if (camTrack) nextLocalTracks.push(camTrack);
    const restoredStream = new MediaStream(nextLocalTracks);
    setLocalStream(restoredStream);
    if (isTestMode) {
      setRemoteStream(restoredStream);
      setRemoteIsScreenSharing(false);
    }

    if (callIdRef.current && peerRef.current && !isTestMode) {
      sendCallSignal({
        type: 'call:screen_state',
        callId: callIdRef.current,
        targetUid: peerRef.current.uid,
        isSharingScreen: false,
      });
    }
  }, [isTestMode, sendCallSignal]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      onNotice?.('Screen sharing is not supported in this browser.', 'error');
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false,
      });
      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) return;

      screenStreamRef.current = displayStream;
      setIsScreenSharing(true);

      screenTrack.onended = () => {
        void stopScreenShare();
      };

      const pc = pcRef.current;
      const procAudio = voiceProcessorRef.current?.outputStream.getAudioTracks()[0];
      const nextScreenPreview = new MediaStream(procAudio ? [procAudio, screenTrack] : [screenTrack]);
      setLocalStream(nextScreenPreview);
      if (isTestMode) {
        setRemoteStream(nextScreenPreview);
        setRemoteIsScreenSharing(true);
      }

      if (pc) {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, displayStream);
          await renegotiateIfNeeded();
        }
      }

      if (callIdRef.current && peerRef.current && !isTestMode) {
        sendCallSignal({
          type: 'call:screen_state',
          callId: callIdRef.current,
          targetUid: peerRef.current.uid,
          isSharingScreen: true,
        });
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name !== 'NotAllowedError' && name !== 'AbortError') {
        onNotice?.('Could not start screen sharing.', 'error');
      }
    }
  }, [isScreenSharing, isTestMode, onNotice, renegotiateIfNeeded, sendCallSignal, stopScreenShare]);

  const setVoiceEffect = useCallback(
    (nextEffect: VoiceEffectId) => {
      setVoiceEffectState(nextEffect);
      voiceProcessorRef.current?.setEffect(nextEffect);
      if (callIdRef.current && peerRef.current) {
        sendCallSignal({
          type: 'call:effect_state',
          callId: callIdRef.current,
          targetUid: peerRef.current.uid,
          voiceEffect: nextEffect,
        });
      }
    },
    [sendCallSignal]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, [cleanupCall]);

  const callState: ActiveCallViewModel = {
    callId,
    status,
    mode,
    peer,
    localStream,
    remoteStream,
    isMuted,
    isCameraOn,
    canSwitchCamera,
    isScreenSharing,
    remoteIsScreenSharing,
    voiceEffect,
    remoteVoiceEffect,
    durationSec,
    quality,
    rttMs,
    statusDetail,
    isTestMode,
    isMonitoringVoice,
  };

  return {
    callState,
    startCall,
    startSelfTestCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    toggleScreenShare,
    stopScreenShare,
    setVoiceEffect,
    toggleMonitorVoice,
  };
}
