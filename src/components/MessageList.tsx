import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDown, Lock, Palette, Pin, Users } from 'lucide-react';
import { MessageItem } from './MessageItem';
import { formatDateDivider } from '../lib/validation';
import type { ChatThemeMeta, WallpaperId } from '../lib/themes';
import type { MemberRole, Message, Room, RoomEvent } from '../types/chat';

interface MessageListProps {
  room: Room;
  messages: Message[];
  eventsById: Record<string, RoomEvent>;
  loading: boolean;
  currentUid: string;
  currentRole: MemberRole | null;
  blockedUserIds: string[];
  pinnedMessages: Message[];
  wallpaperId?: WallpaperId;
  chatTheme?: ChatThemeMeta;
  chatThemeUpdatedBy?: string;
  deletedForMeIds?: Set<string>;
  isEncryptedChat?: boolean;
  onOpenPrivacy?: () => void;
  onOpenChatTheme?: () => void;
  onOpenPinned: () => void;
  onQuickPrompt: (text: string) => void;
  onReply: (message: Message) => void;
  onOpenThread: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message, isModAction: boolean) => void;
  onDeleteForMe?: (message: Message) => void;
  onTogglePin: (message: Message) => void;
  onToggleReaction: (message: Message, emoji: string) => void;
  onVotePoll: (message: Message, optionId: string) => void;
  onRsvpEvent: (event: RoomEvent, choice: 'going' | 'maybe' | 'none') => void;
  onReport: (message: Message) => void;
  onPreviewImage: (url: string, caption: string, fileName?: string, fallbackUrl?: string) => void;
  onDirectMessageAuthor?: (authorId: string, authorName: string, authorPhoto: string) => void;
  onOpenReelFromChat?: (reelId: string) => void;
}

export const MessageList = React.memo(function MessageList({
  room,
  messages,
  eventsById,
  loading,
  currentUid,
  currentRole,
  blockedUserIds,
  pinnedMessages,
  wallpaperId = 'dots',
  chatTheme,
  chatThemeUpdatedBy,
  deletedForMeIds,
  isEncryptedChat = true,
  onOpenPrivacy,
  onOpenChatTheme,
  onOpenPinned,
  onQuickPrompt,
  onReply,
  onOpenThread,
  onEdit,
  onDelete,
  onDeleteForMe,
  onTogglePin,
  onToggleReaction,
  onVotePoll,
  onRsvpEvent,
  onReport,
  onPreviewImage,
  onDirectMessageAuthor,
  onOpenReelFromChat,
}: MessageListProps) {
  const prefersReducedMotion = useReducedMotion();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(0);
  const showScrollBottomRef = useRef(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const hasCustomChatTheme = Boolean(chatTheme && chatTheme.id !== 'classic');
  const isDarkThemeSurface = Boolean(hasCustomChatTheme && chatTheme?.isDarkSurface);

  // Memoize main feed messages & filter out messages deleted locally ("Delete for Me")
  const mainMessages = useMemo(
    () =>
      messages.filter(
        (m) => !m.threadRootId && !(deletedForMeIds && deletedForMeIds.has(m.id))
      ),
    [messages, deletedForMeIds]
  );
  const blockedSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds]);

  useEffect(() => {
    if (mainMessages.length !== prevCountRef.current) {
      bottomRef.current?.scrollIntoView({
        behavior: prevCountRef.current === 0 ? 'auto' : 'smooth',
      });
      prevCountRef.current = mainMessages.length;
    }
  }, [mainMessages.length, room.id]);

  useEffect(() => {
    prevCountRef.current = 0;
    showScrollBottomRef.current = false;
    setShowScrollBottom(false);
    if (progressBarRef.current) {
      progressBarRef.current.style.transform = 'scaleX(1)';
    }
  }, [room.id]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  // Zero-re-render 120fps scroll handler (updates GPU transform directly via rAF)
  const handleFeedScroll = () => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = scrollContainerRef.current;
      if (!el) return;
      const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
      const ratio = Math.min(1, Math.max(0, el.scrollTop / maxScroll));
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${ratio})`;
      }
      const shouldShow = el.scrollHeight - el.scrollTop - el.clientHeight > 220;
      if (shouldShow !== showScrollBottomRef.current) {
        showScrollBottomRef.current = shouldShow;
        setShowScrollBottom(shouldShow);
      }
    });
  };

  const wallpaperClass = hasCustomChatTheme
    ? ''
    : wallpaperId === 'dots'
      ? 'chat-wallpaper-dots'
      : wallpaperId === 'grid'
        ? 'chat-wallpaper-grid'
        : wallpaperId === 'aurora'
          ? 'chat-wallpaper-aurora'
          : '';

  const latestPinned = pinnedMessages[0];

  return (
    <div
      className={`relative flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-[#0D1117] ${wallpaperClass}`}
    >
      {/* Full-Bleed Instagram-Style Chat Theme Backdrop (Flowers, Cars, Gradients) */}
      {hasCustomChatTheme && chatTheme && (
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          {chatTheme.backdropImage ? (
            <img
              src={chatTheme.backdropImage}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover select-none"
            />
          ) : chatTheme.backdropClass ? (
            <div className={`w-full h-full ${chatTheme.backdropClass}`} />
          ) : null}
          {chatTheme.scrimClass && <div className={`absolute inset-0 ${chatTheme.scrimClass}`} />}
        </div>
      )}

      {/* GPU-Accelerated Scroll Progress Micro-Bar (Zero React Re-Renders) */}
      {mainMessages.length > 4 && (
        <div
          aria-hidden="true"
          className="relative z-10 h-[2px] w-full bg-transparent shrink-0 overflow-hidden"
        >
          <div
            ref={progressBarRef}
            className="h-full origin-left gpu-layer opacity-70"
            style={{
              transform: 'scaleX(1)',
              backgroundColor: hasCustomChatTheme && chatTheme ? chatTheme.accentHex : 'var(--accent)',
            }}
          />
        </div>
      )}

      {/* Pinned Banner */}
      {latestPinned && (
        <button
          type="button"
          onClick={onOpenPinned}
          className="relative z-10 px-4 sm:px-5 py-2 border-b border-stone-200/80 dark:border-slate-800 bg-stone-50/90 dark:bg-[#161B22]/90 backdrop-blur-md flex items-center justify-between gap-3 text-left hover:bg-stone-100 dark:hover:bg-slate-800/70 transition-colors shrink-0 cursor-pointer"
        >
          <div className="flex items-center gap-2 min-w-0 text-xs">
            <Pin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-medium text-stone-700 dark:text-slate-200 shrink-0">Pinned</span>
            <span className="text-stone-500 dark:text-slate-400 truncate">
              {latestPinned.authorName}: {latestPinned.text || latestPinned.mediaName || 'Attachment'}
            </span>
          </div>
          <span className="text-xs font-medium text-accent whitespace-nowrap shrink-0">
            View all ({pinnedMessages.length})
          </span>
        </button>
      )}

      {/* Message Feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleFeedScroll}
        className="relative z-[1] flex-1 scroll-pane py-4"
      >
        {loading ? (
          <div className="px-5 space-y-5">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-start gap-3 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-stone-200/80 dark:bg-slate-800/80 shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3.5 w-36 bg-stone-200/80 dark:bg-slate-800/80 rounded" />
                  <div className="h-3.5 w-3/4 max-w-md bg-stone-100/80 dark:bg-slate-800/60 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : mainMessages.length === 0 ? (
          <div className="max-w-lg mx-auto px-6 py-12 text-center space-y-4">
            <div
              className={`rounded-2xl p-6 space-y-4 ${
                hasCustomChatTheme
                  ? isDarkThemeSurface
                    ? 'bg-black/45 backdrop-blur-md border border-white/15 text-white'
                    : 'bg-white/82 dark:bg-[#161B22]/85 backdrop-blur-md border border-white/60 dark:border-slate-700/70'
                  : ''
              }`}
            >
              {room.coverImage ? (
                <img
                  src={room.coverImage}
                  alt={room.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-40 object-cover rounded-xl border border-stone-200 dark:border-slate-800"
                />
              ) : (
                <div className="w-12 h-12 mx-auto rounded-full bg-accent-soft text-accent-soft flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              )}
              <div className="space-y-1">
                <h2
                  className={`font-display text-lg font-bold ${
                    isDarkThemeSurface ? 'text-white' : 'text-stone-900 dark:text-white'
                  }`}
                >
                  Welcome to {room.visibility === 'dm' ? 'your direct chat' : room.name}
                </h2>
                <p
                  className={`text-sm ${
                    isDarkThemeSurface ? 'text-white/80' : 'text-stone-500 dark:text-slate-400'
                  }`}
                >
                  {room.description || 'Send the first message to kick off the conversation.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                {[
                  'Hey everyone! Glad to be here.',
                  'Anyone free for a study session later?',
                  'What are we working on this week?',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onQuickPrompt(prompt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isDarkThemeSurface
                        ? 'bg-white/15 hover:bg-white/25 text-white border border-white/15'
                        : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-stone-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <motion.div
            key={room.id}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="space-y-0.5"
          >
            {/* Room Intro, Theme Quick-Switch & Privacy Notice */}
            <div
              className={`px-5 pb-4 mb-3 border-b space-y-2.5 ${
                isDarkThemeSurface
                  ? 'border-white/15'
                  : 'border-stone-100 dark:border-slate-800/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p
                    className={`font-display text-base font-bold ${
                      isDarkThemeSurface ? 'text-white drop-shadow-xs' : 'text-stone-900 dark:text-white'
                    }`}
                  >
                    {room.name}
                  </p>
                  {room.description && (
                    <p
                      className={`text-xs sm:text-sm mt-0.5 max-w-2xl ${
                        isDarkThemeSurface ? 'text-white/80' : 'text-stone-500 dark:text-slate-400'
                      }`}
                    >
                      {room.description}
                    </p>
                  )}
                </div>

                {onOpenChatTheme && (
                  <button
                    type="button"
                    onClick={onOpenChatTheme}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      isDarkThemeSurface
                        ? 'bg-black/45 hover:bg-black/60 text-white border border-white/20 backdrop-blur-md'
                        : 'bg-white/85 dark:bg-[#1C2128]/90 hover:bg-white dark:hover:bg-slate-800 text-stone-800 dark:text-slate-100 border border-stone-200/80 dark:border-slate-700 backdrop-blur-xs shadow-2xs'
                    }`}
                  >
                    <Palette
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: hasCustomChatTheme && chatTheme ? chatTheme.accentHex : undefined }}
                    />
                    <span>
                      {hasCustomChatTheme && chatTheme ? chatTheme.name : 'Chat Theme'}
                    </span>
                  </button>
                )}
              </div>

              {hasCustomChatTheme && chatTheme && chatThemeUpdatedBy && (
                <p
                  className={`text-[11px] ${
                    isDarkThemeSurface ? 'text-white/75' : 'text-stone-600 dark:text-slate-300'
                  }`}
                >
                  {chatThemeUpdatedBy} set this chat theme to <strong>{chatTheme.name}</strong>
                </p>
              )}

              {onOpenPrivacy && (
                <button
                  type="button"
                  onClick={onOpenPrivacy}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] hover:opacity-90 transition-opacity text-left cursor-pointer ${
                    isDarkThemeSurface
                      ? 'bg-black/45 border-white/15 text-amber-200 backdrop-blur-md'
                      : 'bg-amber-50/90 dark:bg-amber-950/35 border-amber-200/70 dark:border-amber-900/50 text-amber-950 dark:text-amber-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    {isEncryptedChat
                      ? 'Messages in this chat are end-to-end encrypted (AES-256). Tap to verify code or lock chat.'
                      : 'Private chat controls active. Tap to enable AES-256 encryption or lock this chat.'}
                  </span>
                </button>
              )}
            </div>

            {mainMessages.map((msg, index) => {
              const prev = index > 0 ? mainMessages[index - 1] : null;
              const currentDay = formatDateDivider(msg.createdAt);
              const prevDay = prev ? formatDateDivider(prev.createdAt) : null;
              const showDateDivider = !prev || currentDay !== prevDay;

              const sameAuthor =
                prev &&
                !showDateDivider &&
                prev.authorId === msg.authorId &&
                !prev.deleted &&
                !msg.replyToId &&
                prev.createdAt &&
                msg.createdAt &&
                msg.createdAt.toMillis() - prev.createdAt.toMillis() < 5 * 60 * 1000;

              return (
                <div key={msg.id}>
                  {showDateDivider && (
                    <div className="flex items-center gap-3 px-5 py-3">
                      <div
                        className={`flex-1 h-px ${
                          isDarkThemeSurface
                            ? 'bg-white/20'
                            : 'bg-stone-200/80 dark:bg-slate-800'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${
                          isDarkThemeSurface
                            ? 'bg-black/45 text-white/90 backdrop-blur-xs'
                            : hasCustomChatTheme
                              ? 'bg-white/80 dark:bg-black/45 text-stone-700 dark:text-slate-200 backdrop-blur-xs'
                              : 'text-stone-400 dark:text-slate-500'
                        }`}
                      >
                        {currentDay}
                      </span>
                      <div
                        className={`flex-1 h-px ${
                          isDarkThemeSurface
                            ? 'bg-white/20'
                            : 'bg-stone-200/80 dark:bg-slate-800'
                        }`}
                      />
                    </div>
                  )}

                  <MessageItem
                    message={msg}
                    compact={Boolean(sameAuthor)}
                    currentUid={currentUid}
                    currentRole={currentRole}
                    isBlockedAuthor={blockedSet.has(msg.authorId)}
                    linkedEvent={msg.eventId ? eventsById[msg.eventId] : undefined}
                    chatTheme={chatTheme}
                    onReply={onReply}
                    onOpenThread={onOpenThread}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDeleteForMe={onDeleteForMe}
                    onTogglePin={onTogglePin}
                    onToggleReaction={onToggleReaction}
                    onVotePoll={onVotePoll}
                    onRsvpEvent={onRsvpEvent}
                    onReport={onReport}
                    onPreviewImage={onPreviewImage}
                    onDirectMessageAuthor={onDirectMessageAuthor}
                    onOpenReelFromChat={onOpenReelFromChat}
                  />
                </div>
              );
            })}
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Floating Scroll-to-Latest Button */}
      <AnimatePresence>
        {showScrollBottom && (
          <motion.button
            type="button"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.92 }}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
            aria-label="Scroll to latest messages"
            className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-[#1C2128] border border-stone-200 dark:border-slate-700 text-xs font-semibold text-stone-800 dark:text-white shadow-lg hover:border-accent transition-colors cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5 text-accent" />
            <span>Latest</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});
