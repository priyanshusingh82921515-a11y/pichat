import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CheckCheck,
  Mic,
  Pause,
  Phone,
  Play,
  Users,
  Video,
} from 'lucide-react';

type ShowcaseScene = 'groups' | 'chat' | 'calls';

const SCENES: Array<{ id: ShowcaseScene; label: string }> = [
  { id: 'groups', label: 'Groups' },
  { id: 'chat', label: 'Live Chat' },
  { id: 'calls', label: 'Voice & Video' },
];

const DEMO_GROUPS = [
  {
    name: 'General Quad',
    initials: 'GQ',
    tint: 'bg-emerald-600',
    time: '11:04 AM',
    preview: 'Maya: Meet by the north steps in 10?',
    unread: 3,
    members: 48,
  },
  {
    name: 'CS 204 Study Group',
    initials: 'CS',
    tint: 'bg-sky-600',
    time: '10:52 AM',
    preview: 'Devon shared lab_notes.pdf · 2.4 MB',
    unread: 5,
    members: 19,
  },
  {
    name: 'Robotics & Makers',
    initials: 'RM',
    tint: 'bg-violet-600',
    time: '10:18 AM',
    preview: 'Priya: Voice note (0:24) · Robot FX',
    unread: 2,
    members: 31,
  },
  {
    name: 'Campus Film Club',
    initials: 'CF',
    tint: 'bg-amber-600',
    time: '9:40 AM',
    preview: 'Leo: Friday screening RSVP is live',
    unread: 0,
    members: 27,
  },
  {
    name: 'Intramural Soccer',
    initials: 'IS',
    tint: 'bg-rose-600',
    time: 'Yesterday',
    preview: 'Sam: Field 3 booked for 5:30 PM',
    unread: 0,
    members: 22,
  },
  {
    name: 'Design Critique Circle',
    initials: 'DC',
    tint: 'bg-teal-600',
    time: 'Yesterday',
    preview: 'Elena shared 2 campus posters',
    unread: 1,
    members: 14,
  },
];

const DEMO_MESSAGES = [
  {
    author: 'Maya Chen',
    time: '11:01',
    own: false,
    text: 'Just uploaded the whiteboard photos from studio!',
  },
  {
    author: 'Devon Brooks',
    time: '11:02',
    own: false,
    kind: 'voice' as const,
    duration: '0:18',
    effect: 'Deep',
  },
  {
    author: 'You',
    time: '11:03',
    own: true,
    text: 'Awesome, jumping on a quick video call in 2 mins.',
  },
  {
    author: 'Priya Patel',
    time: '11:04',
    own: false,
    text: 'Count me in — sharing my screen with the deck!',
  },
  {
    author: 'You',
    time: '11:05',
    own: true,
    text: 'Starting the call now.',
  },
];

const DEMO_CALLS = [
  { name: 'Maya Chen', mode: 'video' as const, detail: 'Outgoing video · 14m 22s', time: '10:40 AM' },
  { name: 'CS 204 Study Group', mode: 'audio' as const, detail: 'Voice call · 28m 05s', time: '9:15 AM' },
  { name: 'Devon Brooks', mode: 'audio' as const, detail: 'Voice FX: Robot · 6m 12s', time: 'Yesterday' },
  { name: 'Priya Patel', mode: 'video' as const, detail: 'Screen shared · 19m 48s', time: 'Yesterday' },
];

export function AppScrollShowcase() {
  const prefersReducedMotion = useReducedMotion();
  const [scene, setScene] = useState<ShowcaseScene>('groups');
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    if (!autoPlay || prefersReducedMotion) return;
    const order: ShowcaseScene[] = ['groups', 'chat', 'calls'];
    const id = window.setInterval(() => {
      setScene((prev) => order[(order.indexOf(prev) + 1) % order.length]);
    }, 5200);
    return () => window.clearInterval(id);
  }, [autoPlay, prefersReducedMotion]);

  return (
    <div className="w-full h-full flex flex-col justify-between gap-4">
      {/* Interactive Scene Selector Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-stone-200/80 dark:bg-slate-800/80">
          {SCENES.map((item) => {
            const active = scene === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setScene(item.id);
                  setAutoPlay(false);
                }}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'text-stone-900 dark:text-white'
                    : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="showcase-scene-pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                    className="absolute inset-0 rounded-lg bg-white dark:bg-[#161B22] shadow-xs"
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setAutoPlay((v) => !v)}
          aria-label={autoPlay ? 'Pause scroll preview' : 'Play scroll preview'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-600 dark:text-slate-300 bg-white/90 dark:bg-[#161B22] border border-stone-200 dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {autoPlay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{autoPlay ? 'Auto-scrolling' : 'Paused'}</span>
        </button>
      </div>

      {/* App Device Frame with Simulated Human Finger Scrolling */}
      <div className="relative flex-1 min-h-[370px] rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-[#11161D] shadow-lg overflow-hidden flex flex-col">
        {/* Top App Bar inside Preview */}
        <div className="h-12 px-4 bg-accent-solid text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/app-logo.png"
              alt="Quadline logo"
              className="w-6 h-6 rounded-md shrink-0 object-cover ring-1 ring-white/25"
            />
            <span className="font-display text-sm font-bold tracking-tight">Quadline</span>
            <span className="text-[11px] text-white/75 truncate">
              · {scene === 'groups' ? 'Groups' : scene === 'chat' ? 'General Quad' : 'Calls'}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-white/90">
            <Phone className="w-3.5 h-3.5" />
            <Video className="w-3.5 h-3.5" />
            <Users className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Scrolling Viewport */}
        <div className="relative flex-1 overflow-hidden bg-stone-50 dark:bg-[#0D1117] chat-wallpaper-dots">
          <AnimatePresence mode="wait">
            {scene === 'groups' && (
              <motion.div
                key="scene-groups"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: prefersReducedMotion ? 0.01 : 0.28 }}
                className="h-full overflow-hidden px-3 py-2"
              >
                <motion.div
                  animate={
                    prefersReducedMotion || !autoPlay
                      ? { y: 0 }
                      : { y: [0, -108, -108, 0] }
                  }
                  transition={{
                    duration: 4.8,
                    times: [0, 0.45, 0.72, 1],
                    ease: [0.22, 1, 0.36, 1],
                    repeat: Infinity,
                  }}
                  className="divide-y divide-stone-200/70 dark:divide-slate-800/80 gpu-layer"
                >
                  {DEMO_GROUPS.map((g, idx) => (
                    <div
                      key={g.name}
                      className={`py-3 px-2.5 flex items-center gap-3 rounded-xl transition-colors ${
                        idx === 1 ? 'bg-white/90 dark:bg-[#161B22]/90 shadow-2xs' : ''
                      }`}
                    >
                      <div
                        className={`w-11 h-11 rounded-full ${g.tint} text-white font-display text-xs font-bold flex items-center justify-center shrink-0`}
                      >
                        {g.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                            {g.name}
                          </p>
                          <span className="text-[11px] font-mono-tabular text-stone-400 dark:text-slate-500 shrink-0">
                            {g.time}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-stone-500 dark:text-slate-400 truncate">
                            {g.preview}
                          </p>
                          {g.unread > 0 ? (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accent-solid text-white text-[10px] font-mono-tabular font-semibold flex items-center justify-center shrink-0">
                              {g.unread}
                            </span>
                          ) : (
                            <span className="text-[10px] text-stone-400 dark:text-slate-500 shrink-0 tabular-nums">
                              {g.members}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {scene === 'chat' && (
              <motion.div
                key="scene-chat"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: prefersReducedMotion ? 0.01 : 0.28 }}
                className="h-full overflow-hidden px-3.5 py-3"
              >
                <motion.div
                  animate={
                    prefersReducedMotion || !autoPlay
                      ? { y: 0 }
                      : { y: [0, -86, -86, 0] }
                  }
                  transition={{
                    duration: 4.8,
                    times: [0, 0.45, 0.72, 1],
                    ease: [0.22, 1, 0.36, 1],
                    repeat: Infinity,
                  }}
                  className="space-y-2.5"
                >
                  {DEMO_MESSAGES.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${m.own ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                          m.own
                            ? 'bg-accent-solid text-white rounded-br-sm'
                            : 'bg-white dark:bg-[#161B22] border border-stone-200/80 dark:border-slate-800 text-stone-900 dark:text-slate-100 rounded-bl-sm'
                        }`}
                      >
                        {!m.own && (
                          <p className="text-[11px] font-semibold text-accent mb-0.5">{m.author}</p>
                        )}
                        {'kind' in m && m.kind === 'voice' ? (
                          <div className="flex items-center gap-2.5 py-0.5">
                            <span className="w-7 h-7 rounded-full bg-accent-solid text-white flex items-center justify-center shrink-0">
                              <Mic className="w-3.5 h-3.5" />
                            </span>
                            <div className="flex items-end gap-0.5 h-5">
                              {[6, 14, 18, 10, 16, 12, 19, 9, 15, 11, 8].map((h, bIdx) => (
                                <span
                                  key={bIdx}
                                  style={{ height: `${h}px` }}
                                  className="w-1 rounded-full bg-accent-solid opacity-80"
                                />
                              ))}
                            </div>
                            <span className="text-[11px] font-mono-tabular text-stone-500 dark:text-slate-400">
                              {m.duration} · {m.effect}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs sm:text-[13px] leading-relaxed">{m.text}</p>
                        )}
                        <div
                          className={`mt-1 flex items-center justify-end gap-1 text-[10px] font-mono-tabular ${
                            m.own ? 'text-white/80' : 'text-stone-400 dark:text-slate-500'
                          }`}
                        >
                          <span>{m.time}</span>
                          {m.own && <CheckCheck className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {scene === 'calls' && (
              <motion.div
                key="scene-calls"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: prefersReducedMotion ? 0.01 : 0.28 }}
                className="h-full overflow-hidden p-3.5 space-y-3"
              >
                {/* Live Active Call Preview Banner */}
                <div className="rounded-xl bg-slate-900 text-white p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-accent-solid flex items-center justify-center shrink-0">
                      <Video className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">HD Voice &amp; Video Calls</p>
                      <p className="text-[11px] text-slate-300 truncate">
                        Screen share · 8 live Voice FX · Auto-saved logs
                      </p>
                    </div>
                  </div>
                  <div className="flex items-end gap-0.5 h-5 shrink-0" aria-hidden="true">
                    {[10, 18, 13, 20, 11].map((h, idx) => (
                      <motion.span
                        key={idx}
                        animate={
                          prefersReducedMotion
                            ? undefined
                            : { scaleY: [0.45, 1, 0.55, 0.9, 0.45] }
                        }
                        transition={{
                          duration: 1.1 + idx * 0.14,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        style={{ height: `${h}px`, transformOrigin: 'bottom' }}
                        className="w-1 rounded-full bg-emerald-400"
                      />
                    ))}
                  </div>
                </div>

                {/* Scrolling Recent Calls */}
                <motion.div
                  animate={
                    prefersReducedMotion || !autoPlay
                      ? { y: 0 }
                      : { y: [0, -48, -48, 0] }
                  }
                  transition={{
                    duration: 4.8,
                    times: [0, 0.45, 0.72, 1],
                    ease: [0.22, 1, 0.36, 1],
                    repeat: Infinity,
                  }}
                  className="space-y-1.5"
                >
                  {DEMO_CALLS.map((c) => (
                    <div
                      key={c.name}
                      className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#161B22] border border-stone-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                          {c.name}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                          {c.detail} · {c.time}
                        </p>
                      </div>
                      <span className="p-2 rounded-lg bg-accent-soft text-accent-soft shrink-0">
                        {c.mode === 'video' ? (
                          <Video className="w-3.5 h-3.5" />
                        ) : (
                          <Phone className="w-3.5 h-3.5" />
                        )}
                      </span>
                    </div>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Animated Scroll-Thumb Indicator Mimicking Someone Scrolling */}
          {!prefersReducedMotion && autoPlay && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-1.5 top-3 bottom-3 w-1 rounded-full bg-stone-300/40 dark:bg-slate-700/40"
            >
              <motion.div
                animate={{ y: [0, 128, 128, 0] }}
                transition={{
                  duration: 4.8,
                  times: [0, 0.45, 0.72, 1],
                  ease: [0.22, 1, 0.36, 1],
                  repeat: Infinity,
                }}
                className="w-1 h-12 rounded-full bg-accent-solid opacity-75"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
