import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Copy,
  Download,
  Smartphone,
  Terminal,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'banner' | 'header';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Suppress install UI when already running as an installed standalone Android/mobile app
  if (isInstalled) {
    return null;
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const apkCommands = `npm install @capacitor/core @capacitor/cli @capacitor/android\nnpm run build\nnpx cap add android && npx cap sync android\nnpx cap open android`;

  const handleAction = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setGuideOpen(true);
      }
      return;
    }
    setGuideOpen(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleCopyApkCommands = async () => {
    try {
      await navigator.clipboard.writeText(apkCommands);
      setCopiedCmd(true);
      window.setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const buttonLabel = isInstallable
    ? isAndroid
      ? 'Install Android App'
      : 'Install App'
    : isIOS
      ? 'Install on Phone'
      : 'Android App';

  return (
    <>
      {variant === 'banner' ? (
        <button
          type="button"
          onClick={() => void handleAction()}
          className={`w-full px-3 py-2.5 rounded-xl bg-accent-soft border border-accent/25 text-left flex items-center justify-between gap-2.5 hover:opacity-90 transition-opacity cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/app-logo.png"
              alt="Quadline app logo"
              className="w-8 h-8 rounded-lg shrink-0 object-cover shadow-xs"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-stone-900 dark:text-white truncate">
                {isInstallable ? 'Install Quadline on Android' : 'Get Quadline Android App'}
              </p>
              <p className="text-[11px] text-stone-600 dark:text-slate-300 truncate">
                Full-screen app · Offline cache · Calls & voice notes
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent text-white text-[11px] font-semibold shrink-0">
            <Download className="w-3 h-3" />
            <span>{isInstallable ? 'Install' : 'Get'}</span>
          </span>
        </button>
      ) : variant === 'header' ? (
        <button
          type="button"
          onClick={() => void handleAction()}
          title="Install Quadline Android App"
          aria-label="Install Quadline Android App"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent-soft text-accent-soft hover:opacity-85 text-xs font-semibold transition-opacity whitespace-nowrap cursor-pointer ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>{buttonLabel}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleAction()}
          title="Install Quadline as an Android App"
          aria-label="Install Quadline as an Android App"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-[#161B22] hover:border-accent text-xs font-semibold text-stone-800 dark:text-slate-100 transition-colors whitespace-nowrap cursor-pointer ${className}`}
        >
          <Download className="w-3.5 h-3.5 text-accent shrink-0" />
          <span>{buttonLabel}</span>
        </button>
      )}

      <AnimatePresence>
        {guideOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          >
            <div className="fixed inset-0" onClick={() => setGuideOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 460, damping: 34 }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-[#161B22] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-stone-200/90 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/app-logo.png"
                    alt="Quadline Android icon"
                    className="w-9 h-9 rounded-xl shadow-xs object-cover"
                  />
                  <div>
                    <h2 className="font-display text-sm font-bold text-stone-900 dark:text-white">
                      Install Quadline Android App
                    </h2>
                    <p className="text-[11px] text-stone-500 dark:text-slate-400">
                      Standalone app icon · Push alerts · Offline ready
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGuideOpen(false)}
                  aria-label="Close install guide"
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {isInstallable && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await install();
                      if (ok) setGuideOpen(false);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-accent text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Install Now (1-Tap Android App)</span>
                  </button>
                )}

                {/* Step-by-step Android Chrome Install */}
                <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-stone-50/70 dark:bg-[#0D1117] p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-900 dark:text-white">
                    <Smartphone className="w-4 h-4 text-accent shrink-0" />
                    <span>Instant Install on Android Phone (Chrome)</span>
                  </div>
                  <ol className="text-xs text-stone-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>Open Quadline in <strong>Google Chrome</strong> on your Android phone.</li>
                    <li>
                      Tap the <strong>⋮ Menu</strong> in the top-right corner and choose{' '}
                      <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
                    </li>
                    <li>
                      Quadline installs as a full-screen Android app with its own home-screen icon,
                      camera/mic calls, voice notes, and offline caching.
                    </li>
                  </ol>
                  <div className="pt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={appUrl}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-700 text-[11px] font-mono-tabular text-stone-700 dark:text-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCopyUrl()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUrl ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>

                {/* iOS Safari Note */}
                {isIOS && (
                  <div className="rounded-xl border border-stone-200 dark:border-slate-800 p-3.5 space-y-1.5 text-xs text-stone-600 dark:text-slate-300">
                    <p className="font-bold text-stone-900 dark:text-white">iPhone / iPad (Safari)</p>
                    <p>
                      Tap the <strong>Share</strong> icon at the bottom of Safari, then select{' '}
                      <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                )}

                {/* Native APK / Play Store Build via Capacitor */}
                <div className="rounded-xl border border-stone-200 dark:border-slate-800 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 dark:text-white">
                      <Terminal className="w-3.5 h-3.5 text-accent" />
                      <span>Build Native Android APK (Android Studio)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyApkCommands()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline cursor-pointer"
                    >
                      {copiedCmd ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400 leading-relaxed">
                    A Capacitor Android config (<code>capacitor.config.ts</code>) is already included
                    in the project. Run these commands locally to compile a signed <code>.apk</code>{' '}
                    or Play Store <code>.aab</code>:
                  </p>
                  <pre className="p-2.5 rounded-lg bg-stone-900 text-emerald-300 text-[10.5px] font-mono-tabular overflow-x-auto leading-relaxed">
                    {apkCommands}
                  </pre>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Showing cached app data</span>
    </div>
  );
};
