import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CallSignalPayload,
  LiveActivityKind,
  LivePresenceEntry,
  OnlineStatus,
  TypingUser,
} from '../types/chat';

interface UseRealtimeSocketParams {
  uid: string | null;
  displayName: string;
  status: OnlineStatus;
  activeRoomId: string | null;
  onIncomingPing?: (payload: { roomId: string; title: string; body: string }) => void;
  onCallSignal?: (signal: CallSignalPayload) => void;
  onSocialUpdate?: (payload: { action: string; actorUid?: string; actorName?: string }) => void;
  onStoryUpdate?: (payload: { action: string; authorUid?: string; authorName?: string }) => void;
  onRoomThemeUpdate?: (payload: {
    roomId: string;
    chatThemeId: string;
    updatedBy: string;
    updatedByName: string;
    updatedAt: number;
  }) => void;
  onResumeSync?: () => void;
}

interface QueuedSignal {
  data: Record<string, unknown>;
  queuedAt: number;
}

export function useRealtimeSocket({
  uid,
  displayName,
  status,
  activeRoomId,
  onIncomingPing,
  onCallSignal,
  onSocialUpdate,
  onStoryUpdate,
  onRoomThemeUpdate,
  onResumeSync,
}: UseRealtimeSocketParams) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const pongWatchdogRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pendingCallSignalsRef = useRef<QueuedSignal[]>([]);

  const pingCallbackRef = useRef(onIncomingPing);
  pingCallbackRef.current = onIncomingPing;
  const callSignalListenersRef = useRef<Set<(signal: CallSignalPayload) => void>>(new Set());
  const onCallSignalPropRef = useRef(onCallSignal);
  onCallSignalPropRef.current = onCallSignal;
  const onSocialUpdateRef = useRef(onSocialUpdate);
  onSocialUpdateRef.current = onSocialUpdate;
  const onStoryUpdateRef = useRef(onStoryUpdate);
  onStoryUpdateRef.current = onStoryUpdate;
  const onRoomThemeUpdateRef = useRef(onRoomThemeUpdate);
  onRoomThemeUpdateRef.current = onRoomThemeUpdate;
  const onResumeSyncRef = useRef(onResumeSync);
  onResumeSyncRef.current = onResumeSync;

  const [presenceMap, setPresenceMap] = useState<Record<string, LivePresenceEntry>>({});
  const [typingByRoom, setTypingByRoom] = useState<Record<string, TypingUser[]>>({});
  const [socketConnected, setSocketConnected] = useState(false);
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const latestIdentityRef = useRef({ uid, displayName, status, activeRoomId });
  latestIdentityRef.current = { uid, displayName, status, activeRoomId };

  const sendJson = useCallback((data: Record<string, unknown>, queueIfCall = false) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
        return true;
      } catch {
        // Fall through to queue if applicable
      }
    }
    if (queueIfCall) {
      pendingCallSignalsRef.current.push({ data, queuedAt: Date.now() });
      if (pendingCallSignalsRef.current.length > 24) {
        pendingCallSignalsRef.current.shift();
      }
    }
    return false;
  }, []);

  const subscribeCallSignals = useCallback((listener: (signal: CallSignalPayload) => void) => {
    callSignalListenersRef.current.add(listener);
    return () => {
      callSignalListenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!uid) return;
    let disposed = false;

    const clearHeartbeat = () => {
      if (heartbeatIntervalRef.current !== null) {
        window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (pongWatchdogRef.current !== null) {
        window.clearTimeout(pongWatchdogRef.current);
        pongWatchdogRef.current = null;
      }
    };

    const scheduleReconnect = (immediate = false) => {
      if (disposed) return;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine && !immediate) {
        return;
      }
      const attempt = reconnectAttemptsRef.current;
      const delayMs = immediate ? 150 : Math.min(10000, 1000 * Math.pow(1.6, attempt));
      reconnectAttemptsRef.current = Math.min(attempt + 1, 8);
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delayMs);
    };

    const connect = () => {
      if (disposed) return;
      const existing = wsRef.current;
      if (
        existing &&
        (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      clearHeartbeat();
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        reconnectAttemptsRef.current = 0;
        setSocketConnected(true);
        setHasConnectedOnce(true);
        const id = latestIdentityRef.current;
        if (id.uid) {
          ws.send(
            JSON.stringify({
              type: 'auth:identify',
              uid: id.uid,
              displayName: id.displayName,
              status: id.status,
              activeRoomId: id.activeRoomId,
            })
          );
        }
        onResumeSyncRef.current?.();

        // Flush any recent call signaling payloads queued during brief disconnect (< 8s old)
        const now = Date.now();
        const freshQueue = pendingCallSignalsRef.current.filter((item) => now - item.queuedAt < 8000);
        pendingCallSignalsRef.current = [];
        for (const item of freshQueue) {
          try {
            ws.send(JSON.stringify(item.data));
          } catch {
            // Ignore
          }
        }

        // Periodic heartbeat to detect silent mobile network drops quickly
        heartbeatIntervalRef.current = window.setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          try {
            ws.send(JSON.stringify({ type: 'ping' }));
            if (pongWatchdogRef.current !== null) {
              window.clearTimeout(pongWatchdogRef.current);
            }
            pongWatchdogRef.current = window.setTimeout(() => {
              pongWatchdogRef.current = null;
              if (wsRef.current === ws) {
                ws.close();
              }
            }, 8000);
          } catch {
            ws.close();
          }
        }, 18000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.type === 'pong') {
            if (pongWatchdogRef.current !== null) {
              window.clearTimeout(pongWatchdogRef.current);
              pongWatchdogRef.current = null;
            }
            return;
          }
          if (msg.type === 'presence:sync' && Array.isArray(msg.users)) {
            const next: Record<string, LivePresenceEntry> = {};
            for (const entry of msg.users as LivePresenceEntry[]) {
              next[entry.uid] = entry;
            }
            setPresenceMap(next);
          } else if (msg.type === 'presence:update' && msg.user?.uid) {
            const entry = msg.user as LivePresenceEntry;
            setPresenceMap((prev) => ({ ...prev, [entry.uid]: entry }));
          } else if (msg.type === 'typing:update' && typeof msg.roomId === 'string') {
            setTypingByRoom((prev) => ({
              ...prev,
              [msg.roomId]: Array.isArray(msg.users) ? (msg.users as TypingUser[]) : [],
            }));
          } else if (msg.type === 'notify:incoming') {
            pingCallbackRef.current?.({
              roomId: String(msg.roomId || ''),
              title: String(msg.title || 'New message'),
              body: String(msg.body || ''),
            });
          } else if (msg.type === 'social:update') {
            onSocialUpdateRef.current?.({
              action: String(msg.action || 'updated'),
              actorUid: typeof msg.actorUid === 'string' ? msg.actorUid : undefined,
              actorName: typeof msg.actorName === 'string' ? msg.actorName : undefined,
            });
          } else if (msg.type === 'story:update') {
            onStoryUpdateRef.current?.({
              action: String(msg.action || 'updated'),
              authorUid: typeof msg.authorUid === 'string' ? msg.authorUid : undefined,
              authorName: typeof msg.authorName === 'string' ? msg.authorName : undefined,
            });
          } else if (msg.type === 'room:theme' && typeof msg.roomId === 'string') {
            onRoomThemeUpdateRef.current?.({
              roomId: msg.roomId,
              chatThemeId: String(msg.chatThemeId || 'classic'),
              updatedBy: String(msg.updatedBy || ''),
              updatedByName: String(msg.updatedByName || 'Member'),
              updatedAt: Number(msg.updatedAt || Date.now()),
            });
          } else if (typeof msg.type === 'string' && msg.type.startsWith('call:')) {
            const signal = msg as CallSignalPayload;
            onCallSignalPropRef.current?.(signal);
            for (const listener of callSignalListenersRef.current) {
              listener(signal);
            }
          }
        } catch {
          // Ignore malformed message
        }
      };

      ws.onclose = () => {
        clearHeartbeat();
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        setSocketConnected(false);
        if (!disposed) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    const handleOnline = () => {
      setIsOnline(true);
      reconnectAttemptsRef.current = 0;
      scheduleReconnect(true);
      onResumeSyncRef.current?.();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSocketConnected(false);
    };

    const probeOrReconnect = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      onResumeSyncRef.current?.();
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        reconnectAttemptsRef.current = 0;
        scheduleReconnect(true);
      } else if (ws.readyState === WebSocket.OPEN) {
        // Probe immediately on app foreground return to catch half-open mobile sockets
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
          if (pongWatchdogRef.current !== null) {
            window.clearTimeout(pongWatchdogRef.current);
          }
          pongWatchdogRef.current = window.setTimeout(() => {
            pongWatchdogRef.current = null;
            if (wsRef.current === ws) ws.close();
          }, 4000);
        } catch {
          ws.close();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        probeOrReconnect();
      }
    };

    const handlePageShow = () => {
      probeOrReconnect();
    };

    const handleWindowFocus = () => {
      if (!document.hidden) {
        probeOrReconnect();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    connect();

    return () => {
      disposed = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearHeartbeat();
      setSocketConnected(false);
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    sendJson({
      type: 'presence:set',
      status,
      displayName,
      activeRoomId,
    });
  }, [uid, status, displayName, activeRoomId, sendJson]);

  const startTyping = useCallback(
    (roomId: string, activity: LiveActivityKind = 'typing') => {
      sendJson({ type: 'typing:start', roomId, activity });
    },
    [sendJson]
  );

  const stopTyping = useCallback(
    (roomId: string) => {
      sendJson({ type: 'typing:stop', roomId });
    },
    [sendJson]
  );

  const sendNotifyPing = useCallback(
    (recipientId: string, roomId: string, title: string, body: string) => {
      sendJson({ type: 'notify:ping', recipientId, roomId, title, body });
    },
    [sendJson]
  );

  const sendCallSignal = useCallback(
    (signal: CallSignalPayload) => {
      return sendJson(signal, true);
    },
    [sendJson]
  );

  return {
    socketConnected,
    hasConnectedOnce,
    isOnline,
    presenceMap,
    typingByRoom,
    startTyping,
    stopTyping,
    sendNotifyPing,
    sendCallSignal,
    subscribeCallSignals,
  };
}
