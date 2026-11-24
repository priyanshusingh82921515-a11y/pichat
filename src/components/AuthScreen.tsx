import React, { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { ArrowRight, AtSign, Camera, KeyRound, Mail, Moon, Sun, Trash2 } from 'lucide-react';
import { AppScrollShowcase } from './AppScrollShowcase';
import { Avatar } from './Avatar';
import { PWAInstallButton } from './PWAInstallButton';
import { AVATAR_PRESETS, generateRandomAvatarUrl } from '../lib/avatarCatalog';
import { checkUsernameAvailability, registerAccountProfile } from '../lib/backendApi';
import { auth, googleProvider } from '../lib/firebase';
import { APP_THEMES, type ThemeId } from '../lib/themes';
import { compressImageToDataUrl, LIMITS, sanitizeHandle } from '../lib/validation';

interface AuthScreenProps {
  darkMode: boolean;
  themeId: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  onToggleTheme: () => void;
  pendingInviteCode?: string | null;
}

export function AuthScreen({
  darkMode,
  themeId,
  onSelectTheme,
  onToggleTheme,
  pendingInviteCode,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'sso' | 'email_signin' | 'email_signup'>('sso');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean;
    reason?: string;
  }>({ checking: false, available: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'email_signup') return;
    const cleaned = username.trim().replace(/^@/, '').toLowerCase();
    if (!cleaned) {
      setUsernameStatus({ checking: false, available: true });
      return;
    }
    if (cleaned.length < 2) {
      setUsernameStatus({ checking: false, available: false, reason: 'At least 2 characters' });
      return;
    }
    let cancelled = false;
    setUsernameStatus({ checking: true, available: true });
    const timer = window.setTimeout(async () => {
      const res = await checkUsernameAvailability(cleaned);
      if (!cancelled) {
        setUsernameStatus({
          checking: false,
          available: res.available,
          reason: res.reason,
        });
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, mode]);

  const handleSignupPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImageToDataUrl(file, 320, LIMITS.PHOTO_URL_MAX);
      setPhotoUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process profile picture.');
    }
  };

  const handleCampusSSO = async () => {
    setError(null);
    setInfoMessage(null);
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to complete Campus SSO sign-in.';
      if (msg.includes('popup-closed-by-user')) {
        setError('Sign-in popup was closed before finishing. Try again when ready.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    if (!email.trim() || password.length < 6) {
      setError('Enter a valid campus email and a password of at least 6 characters.');
      return;
    }
    if (mode === 'email_signup') {
      if (!displayName.trim()) {
        setError('Please enter your full name.');
        return;
      }
      const cleanHandle = username.trim().replace(/^@/, '').toLowerCase();
      if (cleanHandle.length < 2) {
        setError('Choose a unique username (at least 2 characters, like Instagram).');
        return;
      }
      if (!usernameStatus.available) {
        setError(usernameStatus.reason || 'That username is already taken. Try another one.');
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === 'email_signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const cleanName = displayName.trim().slice(0, LIMITS.DISPLAY_NAME_MAX);
        const cleanHandle = sanitizeHandle(username, cred.user.uid);
        const cleanBio = bio.trim().slice(0, LIMITS.BIO_MAX);
        if (cleanName) {
          await updateProfile(cred.user, { displayName: cleanName });
        }
        try {
          localStorage.setItem(
            `quadline_pending_signup_profile_${cred.user.uid}`,
            JSON.stringify({
              displayName: cleanName,
              handle: cleanHandle,
              bio: cleanBio,
              photoUrl,
            })
          );
        } catch {
          // Ignore storage quota errors
        }
        void registerAccountProfile({
          uid: cred.user.uid,
          email: email.trim(),
          displayName: cleanName,
          handle: cleanHandle,
          bio: cleanBio,
          photoUrl,
          authMethod: 'email',
        });
        await sendEmailVerification(cred.user);
        setInfoMessage(
          `Account @${cleanHandle} created! Check your inbox to verify your email address, or sign in instantly with Campus SSO (Google).`
        );
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(
          'Email/Password login is not enabled on this Firebase project yet. Enable Email/Password in Firebase Console → Authentication → Sign-in method, or sign in right now with Campus SSO (Google).'
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Incorrect email or password. Double-check your credentials or use Campus SSO.');
      } else if (code === 'auth/email-already-in-use') {
        setError('An account with that email already exists. Try signing in instead.');
      } else {
        setError(err instanceof Error ? err.message : 'Authentication failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-[#0D1117] text-stone-900 dark:text-slate-100 flex flex-col">
      {/* Clean 3-Zone Top Bar */}
      <header className="w-full border-b border-stone-200 dark:border-slate-800 bg-white/90 dark:bg-[#161B22]/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5 shrink-0">
            <img
              src="/app-logo.png"
              alt="Quadline app logo"
              className="w-8 h-8 rounded-lg shrink-0 object-cover shadow-xs"
            />
            <span className="font-display text-lg font-extrabold tracking-tight text-stone-900 dark:text-white whitespace-nowrap shrink-0">
              Quadline
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600 dark:text-slate-400">
            <a href="#features" className="hover:text-stone-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Rooms
            </a>
            <a href="#features" className="hover:text-stone-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Direct Chat
            </a>
            <a href="#features" className="hover:text-stone-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Campus Events
            </a>
            <a href="#features" className="hover:text-stone-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Moderation
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <PWAInstallButton variant="header" />
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2.5 rounded-lg text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={handleCampusSSO}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium text-white bg-accent disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Workspace Welcome */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
        {/* Left Auth Card */}
        <section className="lg:col-span-5 flex flex-col justify-center">
          <div className="bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 rounded-2xl p-7 sm:p-8 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Campus & Club Messaging · Live Channels · Events
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 dark:text-white leading-tight">
                Your campus quad, always in sync.
              </h1>
              <p className="text-sm sm:text-base text-stone-600 dark:text-slate-400 leading-relaxed">
                Join club channels, coordinate study groups, share voice notes and polls, and RSVP to campus events in real time.
              </p>
            </div>

            {pendingInviteCode && (
              <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-900 dark:text-emerald-200">
                Sign in to accept invite code <span className="font-mono-tabular font-semibold">{pendingInviteCode}</span> and join the room automatically.
              </div>
            )}

            {/* Mode Switcher */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-stone-100 dark:bg-slate-900 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setMode('sso');
                  setError(null);
                }}
                className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'sso'
                    ? 'bg-white dark:bg-slate-800 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                Campus SSO
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('email_signin');
                  setError(null);
                }}
                className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'email_signin'
                    ? 'bg-white dark:bg-slate-800 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                Email Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('email_signup');
                  setError(null);
                }}
                className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'email_signup'
                    ? 'bg-white dark:bg-slate-800 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-600 dark:text-slate-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs sm:text-sm text-red-700 dark:text-red-300"
              >
                {error}
              </div>
            )}

            {infoMessage && (
              <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs sm:text-sm text-emerald-800 dark:text-emerald-200">
                {infoMessage}
              </div>
            )}

            {mode === 'sso' ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleCampusSSO}
                  disabled={busy}
                  className="w-full py-3 px-4 rounded-xl bg-accent disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span>{busy ? 'Signing in...' : 'Continue with Campus SSO (Google)'}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
                <p className="text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
                  Uses your verified Google / Campus Workspace account. Your email stays private and is never exposed in public member directories.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEmailAuth} className="space-y-3.5">
                {mode === 'email_signup' && (
                  <>
                    {/* Separate Profile Picture Section during Sign Up */}
                    <div className="p-3 rounded-xl bg-stone-50 dark:bg-slate-900/80 border border-stone-200 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={displayName || 'You'} src={photoUrl} size="lg" />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-xs font-semibold text-stone-800 dark:text-slate-200">
                            Separate Profile Picture
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-accent text-white cursor-pointer">
                              <Camera className="w-3 h-3" />
                              <span>Upload Photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleSignupPhotoUpload}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setPhotoUrl(generateRandomAvatarUrl(photoUrl))}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-200 cursor-pointer"
                            >
                              Random Avatar
                            </button>
                            {photoUrl && (
                              <button
                                type="button"
                                onClick={() => setPhotoUrl('')}
                                aria-label="Remove photo"
                                className="p-1 rounded-lg text-stone-400 hover:text-red-500 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                        {AVATAR_PRESETS.slice(0, 7).map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setPhotoUrl(preset.dataUrl)}
                            className={`w-7 h-7 rounded-full overflow-hidden border-2 shrink-0 cursor-pointer ${
                              photoUrl === preset.dataUrl
                                ? 'border-emerald-600 scale-105'
                                : 'border-stone-200 dark:border-slate-700'
                            }`}
                          >
                            <img src={preset.dataUrl} alt={preset.label} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label htmlFor="auth-name" className="block text-xs font-medium text-stone-700 dark:text-slate-300">
                          Full Name
                        </label>
                        <input
                          id="auth-name"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Maya Chen"
                          maxLength={LIMITS.DISPLAY_NAME_MAX}
                          required
                          className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="auth-username" className="block text-xs font-medium text-stone-700 dark:text-slate-300">
                          Username (Instagram-style)
                        </label>
                        <div className="relative">
                          <AtSign className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            id="auth-username"
                            type="text"
                            value={username}
                            onChange={(e) =>
                              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))
                            }
                            placeholder="maya.chen"
                            maxLength={LIMITS.HANDLE_MAX}
                            required
                            className="w-full pl-8 pr-3 py-2.5 rounded-lg text-sm font-mono-tabular bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </div>
                        {username.trim().length > 0 && (
                          <p
                            className={`text-[10px] ${
                              usernameStatus.checking
                                ? 'text-stone-400'
                                : usernameStatus.available
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {usernameStatus.checking
                              ? 'Checking...'
                              : usernameStatus.available
                                ? `@${username} is available`
                                : usernameStatus.reason || 'Already taken'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label htmlFor="auth-bio" className="block text-xs font-medium text-stone-700 dark:text-slate-300">
                          Bio
                        </label>
                        <span className="text-[10px] text-stone-400 tabular-nums">
                          {bio.length}/{LIMITS.BIO_MAX}
                        </span>
                      </div>
                      <textarea
                        id="auth-bio"
                        rows={2}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Add a short bio about yourself..."
                        maxLength={LIMITS.BIO_MAX}
                        className="w-full px-3.5 py-2 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <label htmlFor="auth-email" className="block text-xs font-medium text-stone-700 dark:text-slate-300">
                    Campus email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@campus.edu"
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="auth-password" className="block text-xs font-medium text-stone-700 dark:text-slate-300">
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    minLength={6}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>
                    {busy
                      ? 'Please wait...'
                      : mode === 'email_signup'
                        ? 'Create Campus Account'
                        : 'Sign In with Email'}
                  </span>
                </button>
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={handleCampusSSO}
                    className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    Or continue instantly with Campus SSO (Google)
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* Right Interactive Scrolling App Preview + Live Theme Switcher */}
        <section id="features" className="lg:col-span-7 flex flex-col justify-between gap-4">
          <div className="flex-1 bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-display text-lg sm:text-xl font-bold text-stone-900 dark:text-white">
                  WhatsApp-style groups, live calls &amp; themes
                </h2>
                <p className="text-xs text-stone-500 dark:text-slate-400">
                  Interactive scrolling preview — tap any color theme to try it live
                </p>
              </div>
              <div className="flex items-center gap-1.5" role="group" aria-label="Try app theme">
                {APP_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTheme(t.id)}
                    aria-label={`Select ${t.name} theme`}
                    title={t.name}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      themeId === t.id ? 'scale-110 ring-2 ring-offset-2 ring-stone-900 dark:ring-white dark:ring-offset-[#161B22]' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: darkMode ? t.swatchDark : t.swatch }}
                  />
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-[380px]">
              <AppScrollShowcase />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
