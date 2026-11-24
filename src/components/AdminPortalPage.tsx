import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  ArrowLeft,
  Bell,
  Database,
  Download,
  Film,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Palette,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import {
  adminDeleteAccount,
  adminDeleteReel,
  adminDeleteStory,
  fetchAdminOverview,
  type AdminOverviewResponse,
} from '../lib/backendApi';
import { getChatThemeById } from '../lib/themes';

type AdminSection = 'overview' | 'accounts' | 'media' | 'themes' | 'system';

interface AdminPortalPageProps {
  onReturnToApp: () => void;
}

function formatDateTime(ts: number): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function AdminPortalPage({ onReturnToApp }: AdminPortalPageProps) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [section, setSection] = useState<AdminSection>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Admin Sign-in Form State (when unauthenticated on /admin)
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Dashboard Data State
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const loadDashboard = useCallback(async (email: string) => {
    setLoadingData(true);
    setDataError(null);
    setAccessDenied(false);
    try {
      const result = await fetchAdminOverview(email);
      if (result.status === 403) {
        setOverview(null);
        setAccessDenied(true);
        return;
      }
      if (!result.ok || !result.data) {
        setDataError(result.error || 'Could not load admin telemetry from server.');
        return;
      }
      setOverview(result.data);
    } catch {
      setDataError('Network error while connecting to Admin API.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user?.email) {
      setOverview(null);
      setAccessDenied(false);
      return;
    }
    void loadDashboard(user.email);
  }, [authReady, user?.email, loadDashboard]);

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid admin credentials.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleExportCsv = () => {
    if (!overview) return;
    const header = [
      'UID',
      'Display Name',
      'Username',
      'Email',
      'Auth Method',
      'Followers',
      'Following',
      'Joined At',
      'Last Active',
    ];
    const escapeCell = (val: string | number) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = overview.accounts.map((a) =>
      [
        a.uid,
        a.displayName,
        `@${a.handle}`,
        a.email,
        a.authMethod,
        a.followersCount,
        a.followingCount,
        new Date(a.createdAt).toISOString(),
        new Date(a.lastLoginAt).toISOString(),
      ]
        .map(escapeCell)
        .join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quadline-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAccount = async (uid: string) => {
    if (!user?.email) return;
    setBusyId(uid);
    const ok = await adminDeleteAccount(user.email, uid);
    setBusyId(null);
    if (ok) {
      void loadDashboard(user.email);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!user?.email) return;
    setBusyId(storyId);
    const ok = await adminDeleteStory(user.email, storyId);
    setBusyId(null);
    if (ok) {
      void loadDashboard(user.email);
    }
  };

  const handleDeleteReel = async (reelId: string) => {
    if (!user?.email) return;
    setBusyId(reelId);
    const ok = await adminDeleteReel(user.email, reelId);
    setBusyId(null);
    if (ok) {
      void loadDashboard(user.email);
    }
  };

  const filteredAccounts = useMemo(() => {
    const list = overview?.accounts || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (acc) =>
        acc.displayName.toLowerCase().includes(q) ||
        acc.handle.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        acc.uid.toLowerCase().includes(q)
    );
  }, [overview?.accounts, searchQuery]);

  // 1. Loading Auth State
  if (!authReady) {
    return (
      <div className="min-h-dvh bg-[#F8FAFC] dark:bg-[#0B0F14] flex items-center justify-center p-6">
        <div className="flex items-center gap-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Verifying admin session...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Admin Sign-In Gate
  if (!user) {
    return (
      <div className="min-h-dvh bg-[#F8FAFC] dark:bg-[#0B0F14] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h1 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Quadline Admin Portal
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Restricted console · /admin
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onReturnToApp}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>App</span>
            </button>
          </div>

          <button
            type="button"
            disabled={authBusy}
            onClick={() => void handleGoogleSignIn()}
            className="w-full min-h-[42px] px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-xs font-semibold flex items-center justify-center gap-2 transition-opacity cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Sign in with Admin Google Account</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
            <span className="bg-white dark:bg-[#11161D] px-2.5 text-[11px] text-slate-400 absolute">
              or email
            </span>
          </div>

          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="admin@domain.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white focus:outline-none focus:border-slate-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white focus:outline-none focus:border-slate-500"
              />
            </div>
            {authError && (
              <p className="text-xs text-red-600 dark:text-red-400">{authError}</p>
            )}
            <button
              type="submit"
              disabled={authBusy}
              className="w-full min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#161B22] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer disabled:opacity-50"
            >
              {authBusy ? 'Signing in...' : 'Continue with Email'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Authenticated Non-Admin Access Denied Screen (Zero Data Leaked)
  if (accessDenied) {
    return (
      <div className="min-h-dvh bg-[#F8FAFC] dark:bg-[#0B0F14] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Access Restricted
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Administrator privileges required
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Signed in as <span className="font-semibold text-slate-900 dark:text-white">{user.email}</span>.
            This account does not have permission to open the Quadline Admin Portal.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onReturnToApp}
              className="flex-1 min-h-[40px] px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold cursor-pointer"
            >
              Return to Quadline
            </button>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="min-h-[40px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard; count?: number }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'accounts', label: 'Accounts', icon: Users, count: overview?.stats.totalAccounts },
    {
      id: 'media',
      label: 'Stories & Reels',
      icon: Film,
      count: (overview?.stats.activeStoriesCount ?? 0) + (overview?.stats.reelsCount ?? 0),
    },
    { id: 'themes', label: 'Chat Themes', icon: Palette, count: overview?.stats.roomThemesCount },
    { id: 'system', label: 'Calls & System', icon: Database, count: overview?.stats.savedCallsCount },
  ];

  const sectionLabel = navItems.find((n) => n.id === section)?.label || 'Overview';

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-[#11161D] border-r border-slate-200 dark:border-slate-800">
      <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/app-logo.png"
            alt="Quadline"
            className="w-7 h-7 rounded-lg object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-slate-900 dark:text-white leading-none truncate">
              Quadline Admin
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              /admin console
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                setMobileNavOpen(false);
              }}
              className={`w-full min-h-[40px] px-3 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                active
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.count === 'number' && (
                <span
                  className={`text-[11px] font-mono-tabular ${
                    active ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 shrink-0">
        <div className="px-2.5 py-1.5">
          <p className="text-[11px] font-medium text-slate-900 dark:text-white truncate">
            {user.displayName || 'Administrator'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={onReturnToApp}
          className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Main Website</span>
        </button>
        <button
          type="button"
          onClick={() => void signOut(auth)}
          className="w-full min-h-[38px] px-3 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  // 4. Authorized Admin SaaS Dashboard
  return (
    <div className="min-h-dvh bg-[#F8FAFC] dark:bg-[#0B0F14] text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-dvh">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <div className="relative w-64 max-w-[82vw] h-full z-10">{renderSidebarContent()}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Utility & Breadcrumb Header */}
        <header className="h-14 px-4 sm:px-6 bg-white dark:bg-[#11161D] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open admin menu"
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs min-w-0">
              <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">Quadline Admin</span>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
              <h1 className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                {sectionLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={loadingData || !user.email}
              onClick={() => user.email && void loadDashboard(user.email)}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161B22] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              disabled={!overview || overview.accounts.length === 0}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-xs font-semibold cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
          {dataError && (
            <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {dataError}
            </div>
          )}

          {loadingData && !overview ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((k) => (
                <div
                  key={k}
                  className="h-24 rounded-xl bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : overview ? (
            <>
              {/* OVERVIEW SECTION */}
              {section === 'overview' && (
                <>
                  {/* Flat 1px Bordered KPI Grid */}
                  <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      {
                        label: 'Total Accounts',
                        value: overview.stats.totalAccounts,
                        sub: `+${overview.stats.todayAccounts} today`,
                      },
                      {
                        label: 'Online Now',
                        value: overview.stats.onlineUsersCount,
                        sub: `${overview.stats.pushDevicesCount} push devices`,
                      },
                      {
                        label: 'Stories & Reels',
                        value: overview.stats.activeStoriesCount + overview.stats.reelsCount,
                        sub: `${overview.stats.activeStoriesCount} stories · ${overview.stats.reelsCount} reels`,
                      },
                      {
                        label: 'Custom Studio Media',
                        value: overview.stats.customMediaCount,
                        sub: `${overview.stats.roomThemesCount} themed chats`,
                      },
                    ].map((kpi) => (
                      <div
                        key={kpi.label}
                        className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl p-4"
                      >
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {kpi.label}
                        </p>
                        <p className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                          {kpi.value}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                          {kpi.sub}
                        </p>
                      </div>
                    ))}
                  </section>

                  {/* Recent Sign-ups Dense Table */}
                  <section className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                          Recent Account Sign-Ups
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Strictly visible to administrator at /admin
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSection('accounts')}
                        className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:underline cursor-pointer"
                      >
                        View all ({overview.accounts.length})
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0D1117]">
                            <th className="py-2.5 px-4">Account</th>
                            <th className="py-2.5 px-4">Email</th>
                            <th className="py-2.5 px-4">Auth</th>
                            <th className="py-2.5 px-4 text-right">Followers</th>
                            <th className="py-2.5 px-4 text-right">Joined</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                          {overview.accounts.slice(0, 8).map((acc) => (
                            <tr
                              key={acc.uid}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                            >
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {acc.photoUrl ? (
                                    <img
                                      src={acc.photoUrl}
                                      alt={acc.displayName}
                                      referrerPolicy="no-referrer"
                                      className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                                    />
                                  ) : (
                                    <span className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                                      {(acc.displayName || 'U').slice(0, 1).toUpperCase()}
                                    </span>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                                      {acc.displayName}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                      @{acc.handle}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                                {acc.email || '—'}
                              </td>
                              <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 capitalize">
                                {acc.authMethod}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-tabular">
                                {acc.followersCount}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                {formatDateTime(acc.createdAt)}
                              </td>
                            </tr>
                          ))}
                          {overview.accounts.length === 0 && (
                            <tr>
                              <td
                                colSpan={5}
                                className="py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                              >
                                No registered accounts yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}

              {/* ACCOUNTS DIRECTORY SECTION */}
              {section === 'accounts' && (
                <section className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                        Registered Accounts ({filteredAccounts.length})
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Search by name, @username, email, or UID
                      </p>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter accounts..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F14] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-500"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0D1117]">
                          <th className="py-2.5 px-4">User</th>
                          <th className="py-2.5 px-4">Email</th>
                          <th className="py-2.5 px-4">Bio</th>
                          <th className="py-2.5 px-4 text-right">Followers</th>
                          <th className="py-2.5 px-4 text-right">Following</th>
                          <th className="py-2.5 px-4 text-right">Joined</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                        {filteredAccounts.map((acc) => (
                          <tr
                            key={acc.uid}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                          >
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2.5">
                                {acc.photoUrl ? (
                                  <img
                                    src={acc.photoUrl}
                                    alt={acc.displayName}
                                    referrerPolicy="no-referrer"
                                    className="w-7 h-7 rounded-full object-cover shrink-0"
                                  />
                                ) : (
                                  <span className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-[11px] font-bold flex items-center justify-center shrink-0">
                                    {(acc.displayName || 'U').slice(0, 1).toUpperCase()}
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                                    {acc.displayName}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    @{acc.handle}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                              {acc.email || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
                              {acc.bio || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-tabular">
                              {acc.followersCount}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-tabular">
                              {acc.followingCount}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {formatDateTime(acc.createdAt)}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                disabled={busyId === acc.uid}
                                onClick={() => void handleDeleteAccount(acc.uid)}
                                title="Remove account directory record"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer disabled:opacity-40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredAccounts.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="py-10 text-center text-xs text-slate-500 dark:text-slate-400"
                            >
                              No matching accounts found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* STORIES & REELS MODERATION SECTION */}
              {section === 'media' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Active Stories */}
                  <section className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                      <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                        Active 24h Stories ({overview.stories.length})
                      </h2>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {overview.stories.map((st) => (
                        <div
                          key={st.id}
                          className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {st.authorName}{' '}
                              <span className="font-normal text-slate-500">@{st.authorHandle}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {st.caption || (st.mediaType === 'image' ? 'Photo story' : 'Text story')} ·{' '}
                              <span className="font-mono-tabular">{st.viewerUids.length}</span> views
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={busyId === st.id}
                            onClick={() => void handleDeleteStory(st.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer shrink-0 disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      ))}
                      {overview.stories.length === 0 && (
                        <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                          No active stories right now.
                        </p>
                      )}
                    </div>
                  </section>

                  {/* Published Reels */}
                  <section className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                      <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                        Shared Reels ({overview.reels.length})
                      </h2>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {overview.reels.map((rl) => (
                        <div
                          key={rl.id}
                          className="px-4 py-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {rl.authorName}{' '}
                              <span className="font-normal text-slate-500">@{rl.authorHandle}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {rl.caption || 'Reel'} ·{' '}
                              <span className="font-mono-tabular">{rl.likesCount}</span> likes
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={busyId === rl.id}
                            onClick={() => void handleDeleteReel(rl.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer shrink-0 disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      ))}
                      {overview.reels.length === 0 && (
                        <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                          No user reels uploaded yet.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              )}

              {/* ACTIVE CHAT THEMES SECTION */}
              {section === 'themes' && (
                <section className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                      Active DM & Group Chat Themes ({overview.roomThemes.length})
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0D1117]">
                          <th className="py-2.5 px-4">Room ID</th>
                          <th className="py-2.5 px-4">Theme</th>
                          <th className="py-2.5 px-4">Updated By</th>
                          <th className="py-2.5 px-4 text-right">Updated At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                        {overview.roomThemes.map((rt) => {
                          const theme = getChatThemeById(rt.chatThemeId);
                          return (
                            <tr key={rt.roomId}>
                              <td className="py-2.5 px-4 font-mono-tabular text-[11px] text-slate-600 dark:text-slate-300">
                                {rt.roomId}
                              </td>
                              <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: theme.accentHex }}
                                  />
                                  <span>{theme.name}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                                {rt.updatedByName || 'Member'}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-500 dark:text-slate-400">
                                {formatDateTime(rt.updatedAt)}
                              </td>
                            </tr>
                          );
                        })}
                        {overview.roomThemes.length === 0 && (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                            >
                              No custom DM or group themes applied yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* CALLS & SYSTEM STORAGE SECTION */}
              {section === 'system' && (
                <div className="space-y-5">
                  <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <Database className="w-4 h-4" />
                        <span>Storage Engine</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {overview.storageEngine}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                        {overview.stats.friendshipsCount} friend connections · {overview.stats.pendingRequestsCount} pending
                      </p>
                    </div>
                    <div className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <Bell className="w-4 h-4" />
                        <span>Mobile Web Push</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular">
                        {overview.stats.pushDevicesCount} Devices
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                        {overview.stats.followsCount} follow connections
                      </p>
                    </div>
                    <div className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <Sparkles className="w-4 h-4" />
                        <span>Sticker & GIF Studio</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular">
                        {overview.stats.customMediaCount} Creations
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                        {overview.stats.savedCallsCount} call logs stored
                      </p>
                    </div>
                  </section>

                  <section className="bg-white dark:bg-[#11161D] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-500" />
                      <h2 className="text-xs font-bold text-slate-900 dark:text-white">
                        Recent Call Logs ({overview.recentCalls.length})
                      </h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0D1117]">
                            <th className="py-2.5 px-4">Peer</th>
                            <th className="py-2.5 px-4">Mode</th>
                            <th className="py-2.5 px-4">Status</th>
                            <th className="py-2.5 px-4 text-right">Duration</th>
                            <th className="py-2.5 px-4 text-right">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                          {overview.recentCalls.map((c) => (
                            <tr key={c.callId}>
                              <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                                {c.peerName}
                              </td>
                              <td className="py-2.5 px-4 capitalize text-slate-600 dark:text-slate-300">
                                {c.mode} ({c.direction})
                              </td>
                              <td className="py-2.5 px-4 capitalize text-slate-500 dark:text-slate-400">
                                {c.status}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-tabular">
                                {c.durationSec}s
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-500 dark:text-slate-400">
                                {formatDateTime(c.startedAt)}
                              </td>
                            </tr>
                          ))}
                          {overview.recentCalls.length === 0 && (
                            <tr>
                              <td
                                colSpan={5}
                                className="py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                              >
                                No call records logged yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
