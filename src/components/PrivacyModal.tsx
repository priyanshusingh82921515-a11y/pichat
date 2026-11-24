import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Check,
  CheckCheck,
  Delete,
  EyeOff,
  KeyRound,
  Lock,
  MessageSquareOff,
  ShieldCheck,
  Unlock,
  UserX,
  X,
} from 'lucide-react';
import {
  computeRoomSecurityCode,
  hashPrivacyPin,
  isRoomEncryptionEnabled,
  verifyPrivacyPin,
  type ChatPrivacySettings,
} from '../lib/chatPrivacy';
import type { Room } from '../types/chat';

interface PrivacyModalProps {
  open: boolean;
  uid: string;
  settings: ChatPrivacySettings;
  readReceiptsEnabled: boolean;
  savingReadReceipts?: boolean;
  activeRoom: Room | null;
  activeRoomMemberUids: string[];
  onClose: () => void;
  onUpdateSettings: (next: ChatPrivacySettings) => void;
  onToggleReadReceipts: (enabled: boolean) => Promise<void> | void;
  onLockAppNow: () => void;
}

function PrivacyToggleRow({
  icon,
  title,
  description,
  checked,
  disabled,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="w-full text-left p-3 rounded-xl border border-stone-200/80 dark:border-slate-800 bg-stone-50/70 dark:bg-[#1C2128]/70 hover:bg-stone-100/80 dark:hover:bg-[#1C2128] disabled:opacity-50 flex items-center justify-between gap-3 transition-colors cursor-pointer"
    >
      <div className="flex items-start gap-3 min-w-0">
        <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent-soft flex items-center justify-center shrink-0 mt-0.5">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-stone-900 dark:text-white">{title}</p>
          <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-relaxed mt-0.5">
            {description}
          </p>
        </div>
      </div>
      <span
        aria-hidden="true"
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-accent-solid' : 'bg-stone-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

export function PrivacyModal({
  open,
  uid,
  settings,
  readReceiptsEnabled,
  savingReadReceipts = false,
  activeRoom,
  activeRoomMemberUids,
  onClose,
  onUpdateSettings,
  onToggleReadReceipts,
  onLockAppNow,
}: PrivacyModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const [securityCode, setSecurityCode] = useState<string>('');
  const [showCode, setShowCode] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinStep, setPinStep] = useState<'idle' | 'setup'>('idle');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSavedNotice, setPinSavedNotice] = useState(false);

  useEffect(() => {
    if (!open || !activeRoom) {
      setSecurityCode('');
      setShowCode(false);
      return;
    }
    let cancelled = false;
    void computeRoomSecurityCode(activeRoom.id, activeRoomMemberUids).then((code) => {
      if (!cancelled) setSecurityCode(code);
    });
    return () => {
      cancelled = true;
    };
  }, [open, activeRoom, activeRoomMemberUids]);

  if (!open) return null;

  const isCurrentRoomEncrypted = activeRoom
    ? isRoomEncryptionEnabled(activeRoom.id, settings)
    : settings.encryptChatsByDefault;
  const isCurrentRoomLocked = activeRoom ? settings.lockedRoomIds.includes(activeRoom.id) : false;

  const handleToggleCurrentRoomEncryption = () => {
    if (!activeRoom) return;
    if (!settings.encryptChatsByDefault) {
      onUpdateSettings({
        ...settings,
        encryptChatsByDefault: true,
        unencryptedRoomIds: settings.unencryptedRoomIds.filter((id) => id !== activeRoom.id),
      });
      return;
    }
    const optedOut = settings.unencryptedRoomIds.includes(activeRoom.id);
    onUpdateSettings({
      ...settings,
      unencryptedRoomIds: optedOut
        ? settings.unencryptedRoomIds.filter((id) => id !== activeRoom.id)
        : [...settings.unencryptedRoomIds, activeRoom.id],
    });
  };

  const handleToggleCurrentRoomLock = () => {
    if (!activeRoom) return;
    if (!settings.pinHash) {
      setPinStep('setup');
      setPinError('Set a 4-digit Privacy PIN below first to lock this chat.');
      return;
    }
    const nextLocked = isCurrentRoomLocked
      ? settings.lockedRoomIds.filter((id) => id !== activeRoom.id)
      : [...settings.lockedRoomIds, activeRoom.id];
    onUpdateSettings({
      ...settings,
      lockedRoomIds: nextLocked,
    });
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    if (!/^\d{4}$/.test(pinDraft)) {
      setPinError('Enter a 4-digit numeric PIN.');
      return;
    }
    if (pinDraft !== pinConfirm) {
      setPinError('PIN entries do not match.');
      return;
    }
    const hashed = await hashPrivacyPin(pinDraft, uid);
    onUpdateSettings({
      ...settings,
      pinHash: hashed,
    });
    setPinDraft('');
    setPinConfirm('');
    setPinStep('idle');
    setPinSavedNotice(true);
    window.setTimeout(() => setPinSavedNotice(false), 2600);
  };

  const handleRemovePin = () => {
    onUpdateSettings({
      ...settings,
      pinHash: null,
      appLockEnabled: false,
      lockedRoomIds: [],
    });
    setPinStep('idle');
    setPinError(null);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: prefersReducedMotion ? 0.01 : 0.16 }}
        role="dialog"
        aria-modal="true"
        aria-label="Chat Privacy & Security"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      >
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 440, damping: 34 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[88dvh] flex flex-col pb-[env(safe-area-inset-bottom)] sm:pb-0"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent-soft flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold text-stone-900 dark:text-white truncate">
                  Chat Privacy &amp; Lock
                </h2>
                <p className="text-xs text-stone-500 dark:text-slate-400 truncate">
                  End-to-end AES-256 encryption, locked chats &amp; visibility controls
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close privacy settings"
              className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Privacy Settings */}
          <div className="p-4 sm:p-5 space-y-5 scroll-pane">
            {/* Active Chat Specific Privacy */}
            {activeRoom && (
              <section className="space-y-2.5">
                <p className="text-xs font-semibold text-stone-500 dark:text-slate-400">
                  This Chat · {activeRoom.name}
                </p>

                <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-accent-soft/60 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-stone-900 dark:text-white">
                        {isCurrentRoomEncrypted
                          ? 'End-to-End Encrypted (AES-256-GCM)'
                          : 'Standard Transport Security'}
                      </p>
                      <p className="text-[11px] text-stone-600 dark:text-slate-300 leading-relaxed mt-0.5">
                        {isCurrentRoomEncrypted
                          ? 'New text messages in this chat are encrypted on your device before saving so only room members can read them.'
                          : 'Enable AES-256 encryption below to encrypt message contents on-device before syncing.'}
                      </p>
                    </div>
                  </div>

                  {securityCode && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCode((v) => !v)}
                        className="text-[11px] font-semibold text-accent hover:underline cursor-pointer"
                      >
                        {showCode ? 'Hide verification security code' : 'Verify 60-digit security code'}
                      </button>
                      {showCode && (
                        <div className="mt-2 p-3 rounded-lg bg-white/90 dark:bg-[#0D1117] border border-stone-200 dark:border-slate-800 font-mono-tabular text-xs tracking-wider text-stone-800 dark:text-slate-200 leading-relaxed select-all">
                          {securityCode}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <PrivacyToggleRow
                    icon={<Lock className="w-4 h-4" />}
                    title="Encrypt messages in this chat"
                    description="Encrypts text with AES-256-GCM on-device before sending"
                    checked={isCurrentRoomEncrypted}
                    onToggle={handleToggleCurrentRoomEncryption}
                  />
                  <PrivacyToggleRow
                    icon={isCurrentRoomLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    title="Lock this chat with PIN"
                    description="Hides this chat inside the PIN-protected Locked Chats vault"
                    checked={isCurrentRoomLocked}
                    onToggle={handleToggleCurrentRoomLock}
                  />
                </div>
              </section>
            )}

            {/* Global Visibility & Privacy Controls */}
            <section className="space-y-2">
              <p className="text-xs font-semibold text-stone-500 dark:text-slate-400">
                Messaging &amp; Visibility Privacy
              </p>
              <PrivacyToggleRow
                icon={<ShieldCheck className="w-4 h-4" />}
                title="End-to-end encrypt all chats by default"
                description="Automatically protect outgoing text messages with AES-256-GCM"
                checked={settings.encryptChatsByDefault}
                onToggle={() =>
                  onUpdateSettings({
                    ...settings,
                    encryptChatsByDefault: !settings.encryptChatsByDefault,
                  })
                }
              />
              <PrivacyToggleRow
                icon={<CheckCheck className="w-4 h-4" />}
                title="Read Receipts"
                description={
                  savingReadReceipts
                    ? 'Saving your preference to your account...'
                    : 'Synced to your account. Turn off so others cannot see blue ticks when you read messages'
                }
                checked={readReceiptsEnabled}
                disabled={savingReadReceipts}
                onToggle={() => void onToggleReadReceipts(!readReceiptsEnabled)}
              />
              <PrivacyToggleRow
                icon={<MessageSquareOff className="w-4 h-4" />}
                title="Typing & voice recording indicator"
                description="Turn off to hide when you are typing or recording a voice note"
                checked={settings.typingIndicatorsEnabled}
                onToggle={() =>
                  onUpdateSettings({
                    ...settings,
                    typingIndicatorsEnabled: !settings.typingIndicatorsEnabled,
                  })
                }
              />
              <PrivacyToggleRow
                icon={<UserX className="w-4 h-4" />}
                title="Hide my online status"
                description="Appear offline to everyone while still sending and receiving messages"
                checked={settings.hideOnlineStatus}
                onToggle={() =>
                  onUpdateSettings({
                    ...settings,
                    hideOnlineStatus: !settings.hideOnlineStatus,
                  })
                }
              />
              <PrivacyToggleRow
                icon={<EyeOff className="w-4 h-4" />}
                title="Hide chat previews in inbox"
                description="Mask message text in the Chats list to protect against shoulder-surfing"
                checked={settings.hideMessagePreviews}
                onToggle={() =>
                  onUpdateSettings({
                    ...settings,
                    hideMessagePreviews: !settings.hideMessagePreviews,
                  })
                }
              />
            </section>

            {/* 4-Digit Privacy PIN & App Lock */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-500 dark:text-slate-400">
                  Privacy PIN &amp; App Lock
                </p>
                {pinSavedNotice && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                    <Check className="w-3.5 h-3.5" />
                    <span>PIN saved</span>
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-stone-200 dark:border-slate-800 p-3.5 space-y-3 bg-stone-50/60 dark:bg-[#0D1117]/70">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-accent" />
                    <span className="text-xs font-semibold text-stone-900 dark:text-white">
                      {settings.pinHash ? '4-Digit Privacy PIN is active' : 'No Privacy PIN set'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setPinStep(pinStep === 'setup' ? 'idle' : 'setup');
                        setPinError(null);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white cursor-pointer"
                    >
                      {settings.pinHash ? 'Change PIN' : 'Set 4-Digit PIN'}
                    </button>
                    {settings.pinHash && (
                      <button
                        type="button"
                        onClick={handleRemovePin}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {pinStep === 'setup' && (
                  <form onSubmit={(e) => void handleSavePin(e)} className="space-y-2.5 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinDraft}
                        onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="Enter 4-digit PIN"
                        className="px-3 py-2 rounded-lg text-sm font-mono-tabular tracking-widest bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-700 focus:outline-none focus:border-accent"
                      />
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinConfirm}
                        onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="Confirm PIN"
                        className="px-3 py-2 rounded-lg text-sm font-mono-tabular tracking-widest bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-700 focus:outline-none focus:border-accent"
                      />
                    </div>
                    {pinError && <p className="text-xs text-red-600 dark:text-red-400">{pinError}</p>}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPinStep('idle');
                          setPinDraft('');
                          setPinConfirm('');
                          setPinError(null);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs text-stone-600 dark:text-slate-300 hover:bg-stone-200/70 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white cursor-pointer"
                      >
                        Save PIN
                      </button>
                    </div>
                  </form>
                )}

                {settings.pinHash && (
                  <div className="pt-1 space-y-2">
                    <PrivacyToggleRow
                      icon={<Lock className="w-4 h-4" />}
                      title="Require PIN on app launch"
                      description="Locks all chats behind your 4-digit PIN whenever you open Quadline"
                      checked={settings.appLockEnabled}
                      onToggle={() =>
                        onUpdateSettings({
                          ...settings,
                          appLockEnabled: !settings.appLockEnabled,
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onLockAppNow();
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-950 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Lock App Now</span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface PinUnlockModalProps {
  open: boolean;
  uid: string;
  pinHash: string;
  title: string;
  subtitle: string;
  fullScreen?: boolean;
  onUnlocked: () => void;
  onCancel?: () => void;
}

export function PinUnlockModal({
  open,
  uid,
  pinHash,
  title,
  subtitle,
  fullScreen = false,
  onUnlocked,
  onCancel,
}: PinUnlockModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const [digits, setDigits] = useState('');
  const [wrongShake, setWrongShake] = useState(false);

  useEffect(() => {
    if (!open) {
      setDigits('');
      setWrongShake(false);
    }
  }, [open]);

  const handlePressDigit = async (d: string) => {
    if (digits.length >= 4) return;
    const next = `${digits}${d}`;
    setDigits(next);
    if (next.length === 4) {
      const ok = await verifyPrivacyPin(next, uid, pinHash);
      if (ok) {
        setDigits('');
        onUnlocked();
      } else {
        setWrongShake(true);
        window.setTimeout(() => {
          setWrongShake(false);
          setDigits('');
        }, 420);
      }
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`fixed inset-0 z-[85] flex items-center justify-center p-4 ${
        fullScreen
          ? 'bg-[#F7F7F5] dark:bg-[#0D1117]'
          : 'bg-black/60 backdrop-blur-sm'
      }`}
    >
      <motion.div
        animate={
          wrongShake && !prefersReducedMotion
            ? { x: [-10, 10, -8, 8, -4, 4, 0] }
            : { x: 0 }
        }
        transition={{ duration: 0.34 }}
        className="w-full max-w-xs rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-[#161B22] shadow-2xl p-6 text-center space-y-5"
      >
        <div className="space-y-2">
          <img
            src="/app-logo.png"
            alt="Quadline app logo"
            className="w-12 h-12 rounded-2xl mx-auto shadow-sm object-cover"
          />
          <h2 className="font-display text-base font-bold text-stone-900 dark:text-white">
            {title}
          </h2>
          <p className="text-xs text-stone-500 dark:text-slate-400">{subtitle}</p>
        </div>

        {/* 4 PIN Dots */}
        <div className="flex items-center justify-center gap-3.5 py-1">
          {[0, 1, 2, 3].map((idx) => (
            <span
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                wrongShake
                  ? 'bg-red-500 scale-110'
                  : idx < digits.length
                    ? 'bg-accent-solid scale-110'
                    : 'bg-stone-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {wrongShake && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400 -mt-2">
            Incorrect PIN. Try again.
          </p>
        )}

        {/* Tactile Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <motion.button
              key={n}
              type="button"
              whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
              onClick={() => void handlePressDigit(n)}
              className="h-12 rounded-xl bg-stone-100 dark:bg-[#1C2128] hover:bg-stone-200 dark:hover:bg-slate-700 text-base font-display font-bold text-stone-900 dark:text-white transition-colors cursor-pointer"
            >
              {n}
            </motion.button>
          ))}
          <div className="flex items-center justify-center">
            {onCancel && !fullScreen && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs font-medium text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>
          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
            onClick={() => void handlePressDigit('0')}
            className="h-12 rounded-xl bg-stone-100 dark:bg-[#1C2128] hover:bg-stone-200 dark:hover:bg-slate-700 text-base font-display font-bold text-stone-900 dark:text-white transition-colors cursor-pointer"
          >
            0
          </motion.button>
          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
            onClick={() => setDigits((prev) => prev.slice(0, -1))}
            aria-label="Backspace digit"
            className="h-12 rounded-xl bg-stone-100 dark:bg-[#1C2128] hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
