import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { onAuthStateChanged, sendEmailVerification, signOut, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  Clock,
  Compass,
  Download,
  Hash,
  KeyRound,
  Lock,
  MailCheck,
  Phone,
  Plus,
  Sparkles,
  UserCheck,
  UserPlus,
  Video,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { Avatar } from './components/Avatar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MessageComposer } from './components/MessageComposer';
import { MessageList } from './components/MessageList';
import { OfflineIndicator } from './components/PWAInstallButton';
import { RightPanel } from './components/RightPanel';
import { RoomHeader } from './components/RoomHeader';
import { Sidebar, type SidebarSectionTab } from './components/Sidebar';
import {
  CreateStoryModal,
  groupStoriesByAuthor,
  StoryViewerModal,
} from './components/StoriesComponents';
import {
  OnboardingProfileModal,
  UserProfileModal,
} from './components/ProfileAccountModals';

const AdminPortalPage = lazy(() =>
  import('./components/AdminPortalPage').then((m) => ({ default: m.AdminPortalPage }))
);
const CallOverlay = lazy(() =>
  import('./components/CallOverlay').then((m) => ({ default: m.CallOverlay }))
);
const ReelsFeed = lazy(() =>
  import('./components/ReelsFeed').then((m) => ({ default: m.ReelsFeed }))
);
const ThemePickerModal = lazy(() =>
  import('./components/ThemePickerModal').then((m) => ({ default: m.ThemePickerModal }))
);
const PrivacyModal = lazy(() =>
  import('./components/PrivacyModal').then((m) => ({ default: m.PrivacyModal }))
);
const PinUnlockModal = lazy(() =>
  import('./components/PrivacyModal').then((m) => ({ default: m.PinUnlockModal }))
);
const SongsAndReelsModal = lazy(() =>
  import('./components/SongsAndReelsModal').then((m) => ({ default: m.SongsAndReelsModal }))
);
import {
  CreateEventModal,
  CreatePollModal,
  CreateRoomModal,
  DiscoverRoomsModal,
  EditGroupModal,
  InviteMembersModal,
  JoinByCodeModal,
  NewDirectMessageModal,
  NotificationsModal,
  ProfileSettingsModal,
  QuickSwitcherModal,
  ReportModal,
  ShortcutsModal,
} from './components/WorkspaceModals';
import { useRealtimeSocket } from './hooks/useRealtimeSocket';
import { useWebRTCCall } from './hooks/useWebRTCCall';
import {
  bootstrapStarterRoomsIfEmpty,
  createInviteCode,
  createRoom,
  createRoomEvent,
  deleteUserMembershipIndex,
  editMessage,
  ensureUserProfileAndPrivate,
  joinPrivateRoomWithCode,
  joinPublicRoom,
  joinRoomById,
  leaveRoom,
  markAllNotificationsRead,
  markMessagesDelivered,
  markMessagesRead,
  markNotificationRead,
  removeRoomMember,
  requestToJoinRoom,
  resolveReport,
  reviewJoinRequest,
  revokeInviteCode,
  sendMessage,
  softDeleteMessage,
  startOrOpenDM,
  submitReport,
  togglePinMessage,
  toggleReaction,
  updateEventRsvp,
  updateMemberRole,
  updateRoomMetadata,
  updateUserPrivateSettings,
  updateUserProfile,
  voteOnPoll,
} from './lib/chatService';
import { auth, db, handleFirestoreError, isTransientNetworkError, OperationType } from './lib/firebase';
import {
  clearAppBadgeIfSupported,
  fetchPushStatus,
  getNotificationPermission,
  isIOSNeedsHomeScreenInstall,
  sendBackgroundRoomPush,
  sendTestPhoneNotification,
  showLocalServiceWorkerNotification,
  subscribeDeviceToMobilePush,
  syncExistingMobilePushSubscription,
  unsubscribeDeviceFromMobilePush,
  type PushPermissionState,
} from './lib/mobilePush';
import {
  createStory,
  deleteCallHistoryRecord,
  deleteStory,
  fetchBackendBootstrap,
  fetchMutualStories,
  fetchMyFollows,
  fetchRoomThemes,
  fetchSocialGraph,
  fetchSocialNotifications,
  getBackupExportUrl,
  markSocialNotificationsRead,
  markStoryViewed,
  recordCallHistory,
  registerAccountProfile,
  removeFriendRelation,
  respondFriendRequest,
  saveBackendPreferences,
  saveRoomChatTheme,
  saveWorkspaceSnapshot,
  sendFriendRequest,
  toggleFollowUser,
  type BackupSummary,
  type CallHistoryRecord,
  type ProfileFollowData,
  type ReelItem,
  type RoomChatThemeRecord,
  type SocialAppNotification,
  type SocialGraph,
  type StoryItem,
} from './lib/backendApi';
import { generateRandomAvatarUrl } from './lib/avatarCatalog';
import {
  applyThemeToDocument,
  getChatThemeById,
  isValidChatThemeId,
  isValidThemeId,
  isValidWallpaperId,
  type ChatThemeId,
  type ThemeId,
  type WallpaperId,
} from './lib/themes';
import {
  DEFAULT_PRIVACY_SETTINGS,
  decryptChatText,
  encryptChatText,
  isEncryptedPayload,
  isRoomEncryptionEnabled,
  loadPrivacySettings,
  savePrivacySettings,
  type ChatPrivacySettings,
} from './lib/chatPrivacy';
import { hasGroupBroadcastMention } from './lib/validation';
import {
  encodeReelMessageText,
  encodeSongMessageText,
  REEL_MESSAGE_MIME,
  SONG_MESSAGE_MIME,
  type SongTrack,
} from './lib/songsAndReels';
import type { VoiceEffectId } from './lib/constants';
import type {
  CallMode,
  JoinRequest,
  MemberRole,
  Message,
  ModerationReport,
  NotificationItem,
  NotificationPref,
  OnlineStatus,
  Profile,
  RightPanelTab,
  Room,
  RoomActivity,
  RoomEvent,
  RoomInvite,
  RoomMember,
  UserPrivate,
  UserRoomMembership,
} from './types/chat';

interface ToastNotice {
  id: string;
  title: string;
  body?: string;
}

function QuadlineWorkspace() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userPrivate, setUserPrivate] = useState<UserPrivate | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  // Dark / Light mode, color theme, and chat wallpaper synced with <html> + backend
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('quadline_theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return false;
  });

  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('quadline_theme_palette');
    return isValidThemeId(saved) ? saved : 'whatsapp';
  });

  const [wallpaperId, setWallpaperId] = useState<WallpaperId>(() => {
    const saved = localStorage.getItem('quadline_wallpaper');
    return isValidWallpaperId(saved) ? saved : 'dots';
  });

  useEffect(() => {
    applyThemeToDocument(themeId, darkMode);
  }, [themeId, darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem('quadline_wallpaper', wallpaperId);
    } catch {
      // Ignore storage failures
    }
  }, [wallpaperId]);

  // URL invite code (/?invite=CODE) & direct group link (/?join=ROOM_ID) support — persisted across sign-in
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite')?.trim().toUpperCase();
    if (code) {
      try {
        sessionStorage.setItem('quadline_pending_invite', code);
      } catch {
        // Ignore storage failures
      }
      return code;
    }
    try {
      return sessionStorage.getItem('quadline_pending_invite');
    } catch {
      return null;
    }
  });

  const [pendingJoinRoomId, setPendingJoinRoomId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('join')?.trim();
    if (roomId) {
      try {
        sessionStorage.setItem('quadline_pending_join_room', roomId);
      } catch {
        // Ignore storage failures
      }
      return roomId;
    }
    try {
      return sessionStorage.getItem('quadline_pending_join_room');
    } catch {
      return null;
    }
  });

  // Workspace Data State
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [discoverableRooms, setDiscoverableRooms] = useState<Room[]>([]);
  const [dmRooms, setDmRooms] = useState<Room[]>([]);
  const [memberships, setMemberships] = useState<UserRoomMembership[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [myInvites, setMyInvites] = useState<RoomInvite[]>([]);

  // Active Room Data State
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [roomMessages, setRoomMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [roomEvents, setRoomEvents] = useState<RoomEvent[]>([]);
  const [roomJoinRequests, setRoomJoinRequests] = useState<JoinRequest[]>([]);
  const [roomReports, setRoomReports] = useState<ModerationReport[]>([]);
  const [roomActivities, setRoomActivities] = useState<RoomActivity[]>([]);

  // UI Layout & Interaction State
  const prefersReducedMotion = useReducedMotion();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarSectionTab>(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'dms' || tabParam === 'calls' || tabParam === 'groups' || tabParam === 'reels') {
      return tabParam;
    }
    return 'chats';
  });
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('members');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [activeThreadRootId, setActiveThreadRootId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  // Persistent Backend State (Call History, Workspace Backups & Friend/Follow Graph)
  const [callHistory, setCallHistory] = useState<CallHistoryRecord[]>([]);
  const [backupSummary, setBackupSummary] = useState<BackupSummary | null>(null);
  const [savingBackup, setSavingBackup] = useState(false);
  const [socialGraph, setSocialGraph] = useState<SocialGraph>({
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
  });
  const [myFollowingUids, setMyFollowingUids] = useState<Set<string>>(() => new Set());
  const [socialNotifications, setSocialNotifications] = useState<SocialAppNotification[]>([]);
  const [roomThemes, setRoomThemes] = useState<Record<string, RoomChatThemeRecord>>({});
  const [deletedForMeIds, setDeletedForMeIds] = useState<Set<string>>(() => new Set());
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [createStoryOpen, setCreateStoryOpen] = useState(false);
  const [activeStoryAuthorUid, setActiveStoryAuthorUid] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);
  const [onboardingProfileOpen, setOnboardingProfileOpen] = useState(false);

  // Mobile Phone Web Push State
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(() =>
    getNotificationPermission()
  );
  const [pushDeviceCount, setPushDeviceCount] = useState(0);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushBannerDismissed, setPushBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('quadline_phone_push_banner_dismissed') === '1';
    } catch {
      return false;
    }
  });
  const [pendingNotifRoomId, setPendingNotifRoomId] = useState<string | null>(() => {
    const param = new URLSearchParams(window.location.search).get('room');
    return param && param.trim() ? param.trim() : null;
  });
  const iosNeedsHomeScreen = useMemo(() => isIOSNeedsHomeScreenInstall(), []);

  // Modals State
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [joinCodeOpen, setJoinCodeOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [callHubMode, setCallHubMode] = useState<CallMode | null>(null);
  const [themesModalOpen, setThemesModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<ChatPrivacySettings>(DEFAULT_PRIVACY_SETTINGS);
  const [savingReadReceipts, setSavingReadReceipts] = useState(false);
  const [appLocked, setAppLocked] = useState(false);
  const [lockedVaultUnlocked, setLockedVaultUnlocked] = useState(false);
  const [pinVaultPromptOpen, setPinVaultPromptOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [songsReelsModalTab, setSongsReelsModalTab] = useState<'songs' | 'reels' | null>(null);
  const [initialReelId, setInitialReelId] = useState<string | null>(null);
  const [initialCreateReelForRoomId, setInitialCreateReelForRoomId] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    targetUserId: string;
    targetUserName: string;
    targetMessageId?: string;
    targetSnippet?: string;
  } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    fallbackUrl?: string;
    caption: string;
    fileName?: string;
    usedFallback?: boolean;
  } | null>(null);
  const [lightboxZoomed, setLightboxZoomed] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [inlineJoinNote, setInlineJoinNote] = useState('');
  const [checkingVerification, setCheckingVerification] = useState(false);

  const pushToast = useCallback((title: string, body?: string) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev.slice(-2), { id, title, body }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setProfile(null);
        setUserPrivate(null);
        setActiveRoomId(null);
        setSocialGraph({ friends: [], incomingRequests: [], outgoingRequests: [] });
        setMyFollowingUids(new Set());
        setStories([]);
        setViewingProfile(null);
        setActiveStoryAuthorUid(null);
        setOnboardingProfileOpen(false);
        setPrivacySettings(DEFAULT_PRIVACY_SETTINGS);
        setAppLocked(false);
        setLockedVaultUnlocked(false);
      } else {
        const loadedPrivacy = loadPrivacySettings(user.uid);
        setPrivacySettings(loadedPrivacy);
        if (loadedPrivacy.appLockEnabled && loadedPrivacy.pinHash) {
          setAppLocked(true);
        }
      }
    });
    return unsub;
  }, []);

  // Bootstrap user profile, private settings, starter rooms, and pending invite
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    let cancelled = false;

    const init = async () => {
      setBootstrapping(true);
      try {
        const providerId = firebaseUser.providerData[0]?.providerId;
        const authMethod = providerId === 'google.com' ? 'campus_sso' : 'email';
        let pendingSignupProfile:
          | { displayName?: string; handle?: string; bio?: string; photoUrl?: string }
          | undefined;
        try {
          const raw = localStorage.getItem(`quadline_pending_signup_profile_${firebaseUser.uid}`);
          if (raw) {
            pendingSignupProfile = JSON.parse(raw) as {
              displayName?: string;
              handle?: string;
              bio?: string;
              photoUrl?: string;
            };
          }
        } catch {
          // Ignore malformed local storage
        }

        const { profile: prof, userPrivate: priv, isNewProfile } =
          await ensureUserProfileAndPrivate(firebaseUser, authMethod, pendingSignupProfile);
        if (cancelled) return;

        if (pendingSignupProfile) {
          try {
            localStorage.removeItem(`quadline_pending_signup_profile_${firebaseUser.uid}`);
          } catch {
            // Ignore
          }
        }

        setProfile(prof);
        setUserPrivate(priv);
        if (priv.theme === 'dark') setDarkMode(true);
        if (priv.theme === 'light') setDarkMode(false);

        // Register/sync account profile with backend directory
        void registerAccountProfile({
          uid: prof.uid,
          email: firebaseUser.email || priv.email || '',
          displayName: prof.displayName,
          handle: prof.handle,
          bio: prof.bio,
          photoUrl: prof.photoUrl,
          authMethod,
        });

        // Prompt brand-new SSO accounts once to pick their Instagram-style username, bio & separate profile pic
        if (isNewProfile && !pendingSignupProfile) {
          setOnboardingProfileOpen(true);
        }

        await bootstrapStarterRoomsIfEmpty(prof);
        if (cancelled) return;

        if (pendingInviteCode) {
          try {
            const invitedRoom = await joinPrivateRoomWithCode(pendingInviteCode, prof);
            if (!cancelled) {
              setActiveRoomId(invitedRoom.id);
              pushToast(`Joined ${invitedRoom.name}`, `Accepted invite code ${pendingInviteCode}`);
              setPendingInviteCode(null);
              try {
                sessionStorage.removeItem('quadline_pending_invite');
              } catch {
                // Ignore
              }
              window.history.replaceState({}, '', window.location.pathname);
            }
          } catch (err) {
            if (!cancelled) {
              pushToast('Invite code issue', err instanceof Error ? err.message : 'Invalid invite code');
              setPendingInviteCode(null);
              try {
                sessionStorage.removeItem('quadline_pending_invite');
              } catch {
                // Ignore
              }
            }
          }
        } else if (pendingJoinRoomId) {
          try {
            const result = await joinRoomById(pendingJoinRoomId, prof);
            if (!cancelled) {
              if (result.outcome === 'requested') {
                pushToast(
                  `Join request sent to ${result.room.name}`,
                  'A group moderator will approve your access.'
                );
              } else {
                setActiveRoomId(result.room.id);
                pushToast(
                  result.outcome === 'already_member'
                    ? `Opened ${result.room.name}`
                    : `Joined ${result.room.name}`,
                  result.outcome === 'already_member'
                    ? 'You are already a member of this group.'
                    : 'Welcome to the group!'
                );
              }
              setPendingJoinRoomId(null);
              try {
                sessionStorage.removeItem('quadline_pending_join_room');
              } catch {
                // Ignore
              }
              window.history.replaceState({}, '', window.location.pathname);
            }
          } catch (err) {
            if (!cancelled) {
              pushToast(
                'Group link issue',
                err instanceof Error ? err.message : 'This group link is invalid or unavailable.'
              );
              setPendingJoinRoomId(null);
              try {
                sessionStorage.removeItem('quadline_pending_join_room');
              } catch {
                // Ignore
              }
            }
          }
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    };

    void init();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, pendingInviteCode, pendingJoinRoomId, pushToast]);

  // Sync mobile phone Web Push subscription automatically when already granted
  useEffect(() => {
    if (!firebaseUser?.uid || !firebaseUser.emailVerified) return;
    let cancelled = false;
    const syncPush = async () => {
      const perm = getNotificationPermission();
      setPushPermission(perm);
      if (perm === 'granted' && userPrivate?.pushEnabled !== false) {
        const synced = await syncExistingMobilePushSubscription(firebaseUser.uid);
        if (!cancelled) {
          setPushDeviceCount(synced.deviceCount);
        }
      } else {
        const status = await fetchPushStatus(firebaseUser.uid);
        if (!cancelled) {
          setPushDeviceCount(status.deviceCount);
        }
      }
    };
    void syncPush();
    clearAppBadgeIfSupported();

    const onVisibility = () => {
      if (!document.hidden) {
        clearAppBadgeIfSupported();
        setPushPermission(getNotificationPermission());
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [firebaseUser?.uid, firebaseUser?.emailVerified, userPrivate?.pushEnabled]);

  // Handle tapping a mobile phone notification when app is already open (Service Worker postMessage)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; roomId?: string; tab?: string; category?: string }
        | undefined;
      if (!data) return;
      if (data.type === 'quadline:open-notification') {
        clearAppBadgeIfSupported();
        if (data.roomId) {
          setPendingNotifRoomId(data.roomId);
        } else if (data.tab === 'dms' || data.tab === 'calls' || data.tab === 'groups' || data.tab === 'reels') {
          setSidebarTab(data.tab);
        }
      } else if (data.type === 'quadline:push-subscription-changed' && firebaseUser?.uid) {
        void syncExistingMobilePushSubscription(firebaseUser.uid).then((res) => {
          setPushDeviceCount(res.deviceCount);
        });
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, [firebaseUser?.uid]);

  const handleEnablePhonePush = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    setPushBusy(true);
    try {
      const res = await subscribeDeviceToMobilePush(firebaseUser.uid);
      setPushPermission(res.permission);
      if (typeof res.deviceCount === 'number') {
        setPushDeviceCount(res.deviceCount);
      }
      if (!res.ok) {
        pushToast('Phone notifications', res.error || 'Could not enable phone notifications.');
        return;
      }
      await updateUserPrivateSettings(firebaseUser.uid, { pushEnabled: true });
      pushToast(
        'Phone notifications enabled!',
        'You will now receive alerts directly on your mobile phone.'
      );
      void showLocalServiceWorkerNotification({
        title: 'Quadline Phone Alerts Enabled',
        body: 'Chats, calls, friend requests & stories will now notify your phone.',
        url: '/',
        tag: 'quadline-welcome-push',
        category: 'system',
      });
    } finally {
      setPushBusy(false);
    }
  }, [firebaseUser?.uid, pushToast]);

  const handleTogglePhonePush = useCallback(
    async (enabled: boolean) => {
      if (!firebaseUser?.uid) return;
      if (enabled) {
        await handleEnablePhonePush();
        return;
      }
      setPushBusy(true);
      try {
        await unsubscribeDeviceFromMobilePush(firebaseUser.uid);
        await updateUserPrivateSettings(firebaseUser.uid, { pushEnabled: false });
        setPushDeviceCount(0);
        pushToast('Phone notifications paused', 'You can turn them back on anytime.');
      } finally {
        setPushBusy(false);
      }
    },
    [firebaseUser?.uid, handleEnablePhonePush, pushToast]
  );

  const handleSendTestPhonePush = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    setPushBusy(true);
    try {
      const res = await sendTestPhoneNotification(firebaseUser.uid);
      if (res.ok) {
        pushToast(
          'Test notification sent!',
          'Check your mobile phone notification bar (swipe down from top).'
        );
      } else {
        pushToast(
          'Notification blocked',
          'Re-enable phone notifications or allow site alerts in phone settings.'
        );
      }
    } finally {
      setPushBusy(false);
    }
  }, [firebaseUser?.uid, pushToast]);

  const handleDismissPhonePushBanner = useCallback(() => {
    setPushBannerDismissed(true);
    try {
      localStorage.setItem('quadline_phone_push_banner_dismissed', '1');
    } catch {
      // Ignore
    }
  }, []);

  // Real-time WebSocket for presence, live typing, and instant notification pings
  const handleIncomingPing = useCallback(
    (payload: { roomId: string; title: string; body: string }) => {
      const pref = userPrivate?.roomNotificationPrefs?.[payload.roomId];
      if (pref === 'mute' || userPrivate?.mutedRoomIds?.includes(payload.roomId)) return;
      pushToast(payload.title, payload.body);
      if (userPrivate?.pushEnabled !== false && document.hidden) {
        void showLocalServiceWorkerNotification({
          title: payload.title,
          body: payload.body,
          roomId: payload.roomId,
          url: payload.roomId ? `/?room=${encodeURIComponent(payload.roomId)}` : '/',
          tag: payload.roomId ? `room-${payload.roomId}` : 'quadline-chat',
          category: 'message',
        });
      }
    },
    [userPrivate, pushToast]
  );

  const myUid = firebaseUser?.uid || profile?.uid || '';
  const friendUidSet = useMemo(
    () =>
      new Set(
        socialGraph.friends.map((rel) =>
          rel.requesterUid === myUid ? rel.targetUid : rel.requesterUid
        )
      ),
    [socialGraph.friends, myUid]
  );
  const incomingRequestUidSet = useMemo(
    () => new Set(socialGraph.incomingRequests.map((rel) => rel.requesterUid)),
    [socialGraph.incomingRequests]
  );
  const outgoingRequestUidSet = useMemo(
    () => new Set(socialGraph.outgoingRequests.map((rel) => rel.targetUid)),
    [socialGraph.outgoingRequests]
  );

  const refreshSocialGraph = useCallback(async (uid: string) => {
    const graph = await fetchSocialGraph(uid);
    setSocialGraph(graph);
  }, []);

  const refreshMyFollows = useCallback(async (uid: string) => {
    const data = await fetchMyFollows(uid);
    setMyFollowingUids(new Set(data.following.map((f) => f.uid)));
  }, []);

  const refreshSocialNotifications = useCallback(async (uid: string) => {
    const items = await fetchSocialNotifications(uid);
    setSocialNotifications(items);
  }, []);

  const refreshRoomThemes = useCallback(async () => {
    const map = await fetchRoomThemes();
    setRoomThemes(map);
  }, []);

  const refreshStories = useCallback(async (uid: string) => {
    const list = await fetchMutualStories(uid);
    setStories(list);
  }, []);

  const handleSocialUpdate = useCallback(
    (payload: { action: string; actorUid?: string; actorName?: string }) => {
      if (!firebaseUser?.uid) return;
      void refreshSocialGraph(firebaseUser.uid);
      void refreshMyFollows(firebaseUser.uid);
      void refreshSocialNotifications(firebaseUser.uid);
      void refreshStories(firebaseUser.uid);
      if (payload.actorUid && payload.actorUid !== firebaseUser.uid) {
        if (payload.action === 'followed') {
          const title = 'New Follower';
          const body = `${payload.actorName || 'Someone'} started following you.`;
          pushToast(title, body);
          if (userPrivate?.pushEnabled !== false && document.hidden) {
            void showLocalServiceWorkerNotification({
              title,
              body,
              url: '/',
              tag: `follow-${payload.actorUid}`,
              category: 'social',
            });
          }
        } else if (payload.action === 'request') {
          const title = 'New Follow & Chat Request';
          const body = `${payload.actorName || 'Someone'} sent you a follow & chat request.`;
          pushToast(title, body);
          if (userPrivate?.pushEnabled !== false && document.hidden) {
            void showLocalServiceWorkerNotification({
              title,
              body,
              url: '/?tab=dms',
              tab: 'dms',
              tag: `social-req-${payload.actorUid}`,
              category: 'social',
            });
          }
        } else if (payload.action === 'accept' || payload.action === 'accepted') {
          const title = 'Chat Request Accepted';
          const body = `You and ${payload.actorName || 'your friend'} can now message & call 1-to-1.`;
          pushToast(title, body);
          if (userPrivate?.pushEnabled !== false && document.hidden) {
            void showLocalServiceWorkerNotification({
              title,
              body,
              url: '/?tab=dms',
              tab: 'dms',
              tag: `social-acc-${payload.actorUid}`,
              category: 'social',
            });
          }
        }
      }
    },
    [
      firebaseUser?.uid,
      userPrivate?.pushEnabled,
      refreshSocialGraph,
      refreshMyFollows,
      refreshSocialNotifications,
      refreshStories,
      pushToast,
    ]
  );

  const handleRoomThemeUpdate = useCallback(
    (payload: {
      roomId: string;
      chatThemeId: string;
      updatedBy: string;
      updatedByName: string;
      updatedAt: number;
    }) => {
      if (!payload.roomId || !isValidChatThemeId(payload.chatThemeId)) return;
      setRoomThemes((prev) => ({
        ...prev,
        [payload.roomId]: {
          roomId: payload.roomId,
          chatThemeId: payload.chatThemeId,
          updatedBy: payload.updatedBy,
          updatedByName: payload.updatedByName,
          updatedAt: payload.updatedAt,
        },
      }));
      if (
        payload.roomId === activeRoomId &&
        payload.updatedBy &&
        payload.updatedBy !== firebaseUser?.uid
      ) {
        const themeMeta = getChatThemeById(payload.chatThemeId);
        pushToast(
          'Chat theme updated',
          `${payload.updatedByName || 'Someone'} changed this chat to ${themeMeta.name}.`
        );
      }
    },
    [activeRoomId, firebaseUser?.uid, pushToast]
  );

  const handleResumeSync = useCallback(() => {
    if (!firebaseUser?.uid || !firebaseUser.emailVerified) return;
    void refreshSocialGraph(firebaseUser.uid);
    void refreshMyFollows(firebaseUser.uid);
    void refreshSocialNotifications(firebaseUser.uid);
    void refreshStories(firebaseUser.uid);
    void refreshRoomThemes();
  }, [
    firebaseUser?.uid,
    firebaseUser?.emailVerified,
    refreshSocialGraph,
    refreshMyFollows,
    refreshSocialNotifications,
    refreshStories,
    refreshRoomThemes,
  ]);

  const handleStoryUpdate = useCallback(
    (payload: { action: string; authorUid?: string; authorName?: string }) => {
      if (!firebaseUser?.uid) return;
      void refreshStories(firebaseUser.uid);
      if (
        payload.action === 'created' &&
        payload.authorUid &&
        payload.authorUid !== firebaseUser.uid
      ) {
        const title = 'New Friend Story';
        const body = `${payload.authorName || 'Your friend'} added to their 24h Story.`;
        pushToast(title, body);
        if (userPrivate?.pushEnabled !== false && document.hidden) {
          void showLocalServiceWorkerNotification({
            title,
            body,
            url: '/',
            tag: `story-${payload.authorUid}`,
            category: 'story',
          });
        }
      }
    },
    [firebaseUser?.uid, userPrivate?.pushEnabled, refreshStories, pushToast]
  );

  const {
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
  } = useRealtimeSocket({
    uid: firebaseUser?.emailVerified ? firebaseUser.uid : null,
    displayName: profile?.displayName || firebaseUser?.displayName || 'Member',
    status: privacySettings.hideOnlineStatus ? 'offline' : profile?.status || 'online',
    activeRoomId,
    onIncomingPing: handleIncomingPing,
    onSocialUpdate: handleSocialUpdate,
    onStoryUpdate: handleStoryUpdate,
    onRoomThemeUpdate: handleRoomThemeUpdate,
    onResumeSync: handleResumeSync,
  });

  const {
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
  } = useWebRTCCall({
    currentUser: profile
      ? { uid: profile.uid, displayName: profile.displayName, photoUrl: profile.photoUrl }
      : null,
    socketConnected,
    sendCallSignal,
    subscribeCallSignals,
    onNotice: (msg, tone) => pushToast(tone === 'error' ? 'Call error' : 'Call update', msg),
  });

  const handleStartCallWithProfile = useCallback(
    (target: Profile, mode: CallMode) => {
      if (!friendUidSet.has(target.uid)) {
        if (incomingRequestUidSet.has(target.uid)) {
          pushToast(
            'Accept Friend Request first',
            `${target.displayName} sent you a request. Accept it in Requests to start a call.`
          );
        } else if (outgoingRequestUidSet.has(target.uid)) {
          pushToast(
            'Friend Request pending',
            `Wait for ${target.displayName} to accept your request before calling.`
          );
        } else {
          pushToast(
            'Friend Request required to call',
            `Send a Friend / Follow Request to ${target.displayName} first to talk 1-to-1.`
          );
        }
        setNewDmOpen(true);
        return;
      }
      void startCall(
        {
          uid: target.uid,
          displayName: target.displayName,
          photoUrl: target.photoUrl,
        },
        mode
      );
    },
    [friendUidSet, incomingRequestUidSet, outgoingRequestUidSet, pushToast, startCall]
  );

  // Global Firestore Subscriptions (attached strictly when authenticated & verified)
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const uid = firebaseUser.uid;

    const safeSnapshotError = (err: unknown, op: OperationType, path: string) => {
      if (isTransientNetworkError(err)) return;
      handleFirestoreError(err, op, path);
    };

    const unsubProfile = onSnapshot(
      doc(db, 'profiles', uid),
      (snap) => {
        if (snap.exists()) setProfile(snap.data() as Profile);
      },
      (err) => safeSnapshotError(err, OperationType.GET, `profiles/${uid}`)
    );

    const unsubPrivate = onSnapshot(
      doc(db, 'userPrivate', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserPrivate;
          setUserPrivate(data);
          if (typeof data.readReceiptsEnabled === 'boolean') {
            setPrivacySettings((prev) => {
              if (prev.readReceiptsEnabled === data.readReceiptsEnabled) return prev;
              const next = { ...prev, readReceiptsEnabled: data.readReceiptsEnabled! };
              savePrivacySettings(uid, next);
              return next;
            });
          }
        }
      },
      (err) => safeSnapshotError(err, OperationType.GET, `userPrivate/${uid}`)
    );

    const unsubAllProfiles = onSnapshot(
      query(collection(db, 'profiles'), where('discoverable', '==', true)),
      (snap) => {
        setAllProfiles(snap.docs.map((d) => d.data() as Profile));
      },
      (err) => safeSnapshotError(err, OperationType.LIST, 'profiles')
    );

    const unsubRooms = onSnapshot(
      query(collection(db, 'rooms'), where('visibility', 'in', ['public', 'private'])),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Room);
        list.sort((a, b) => (b.lastMessageAt?.toMillis() || 0) - (a.lastMessageAt?.toMillis() || 0));
        setDiscoverableRooms(list);
      },
      (err) => safeSnapshotError(err, OperationType.LIST, 'rooms')
    );

    const unsubDms = onSnapshot(
      query(
        collection(db, 'rooms'),
        where('dmParticipantIds', 'array-contains', uid)
      ),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Room)
          .filter((r) => r.visibility === 'dm');
        list.sort((a, b) => (b.lastMessageAt?.toMillis() || 0) - (a.lastMessageAt?.toMillis() || 0));
        setDmRooms(list);
      },
      (err) => safeSnapshotError(err, OperationType.LIST, 'rooms(dm)')
    );

    const unsubMemberships = onSnapshot(
      query(collection(db, 'userMemberships', uid, 'rooms'), where('uid', '==', uid)),
      (snap) => {
        setMemberships(snap.docs.map((d) => d.data() as UserRoomMembership));
      },
      (err) => safeSnapshotError(err, OperationType.LIST, `userMemberships/${uid}/rooms`)
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('recipientId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }));
        list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setNotifications(list);
      },
      (err) => safeSnapshotError(err, OperationType.LIST, 'notifications')
    );

    const unsubInvites = onSnapshot(
      query(collection(db, 'invites'), where('createdBy', '==', uid)),
      (snap) => {
        setMyInvites(snap.docs.map((d) => d.data() as RoomInvite));
      },
      (err) => safeSnapshotError(err, OperationType.LIST, 'invites')
    );

    return () => {
      unsubProfile();
      unsubPrivate();
      unsubAllProfiles();
      unsubRooms();
      unsubDms();
      unsubMemberships();
      unsubNotifs();
      unsubInvites();
    };
  }, [firebaseUser]);

  // Derived maps & active room
  const profilesByUid = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of allProfiles) map[p.uid] = p;
    if (profile) map[profile.uid] = profile;
    return map;
  }, [allProfiles, profile]);

  const friendProfiles = useMemo(() => {
    if (!profile) return [];
    const list: Profile[] = [];
    const seen = new Set<string>([profile.uid]);
    for (const rel of socialGraph.friends) {
      const isRequester = rel.requesterUid === profile.uid;
      const otherUid = isRequester ? rel.targetUid : rel.requesterUid;
      const otherName = isRequester ? rel.targetName : rel.requesterName;
      const otherHandle = isRequester ? rel.targetHandle : rel.requesterHandle;
      const otherPhoto = isRequester ? rel.targetPhoto : rel.requesterPhoto;
      if (seen.has(otherUid)) continue;
      seen.add(otherUid);
      const live = profilesByUid[otherUid];
      list.push(
        live || {
          uid: otherUid,
          displayName: otherName || 'Friend',
          handle: otherHandle || otherUid.slice(0, 8),
          bio: '',
          photoUrl: otherPhoto || '',
          majorOrClub: '',
          status: presenceMap[otherUid]?.status || 'offline',
          statusMessage: '',
          discoverable: true,
          lastSeenAt: null,
          createdAt: null,
          updatedAt: null,
        }
      );
    }
    return list;
  }, [profile, socialGraph.friends, profilesByUid, presenceMap]);

  const friendDmRooms = useMemo(() => {
    if (!profile) return [];
    return dmRooms.filter((r) => {
      const peerUid = r.dmParticipantIds.find((id) => id !== profile.uid);
      return Boolean(peerUid && friendUidSet.has(peerUid));
    });
  }, [dmRooms, profile, friendUidSet]);

  const joinedRoomIds = useMemo(() => new Set(memberships.map((m) => m.roomId)), [memberships]);

  const joinedRooms = useMemo(() => {
    return discoverableRooms.filter((r) => joinedRoomIds.has(r.id));
  }, [discoverableRooms, joinedRoomIds]);

  const allAccessibleRooms = useMemo(() => [...joinedRooms, ...dmRooms], [joinedRooms, dmRooms]);
  const shareableRooms = useMemo(() => [...joinedRooms, ...friendDmRooms], [joinedRooms, friendDmRooms]);

  // Open target chat when launched or focused from a mobile phone notification (?room=<id>)
  useEffect(() => {
    if (!pendingNotifRoomId) return;
    const target = allAccessibleRooms.find((r) => r.id === pendingNotifRoomId);
    if (target) {
      setActiveRoomId(target.id);
      setPendingNotifRoomId(null);
      if (window.location.search.includes('room=')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [pendingNotifRoomId, allAccessibleRooms]);

  // Show native phone notification when an incoming call arrives while the app is backgrounded
  useEffect(() => {
    if (callState.status !== 'ringing' || !callState.peer) return;
    if (userPrivate?.pushEnabled === false) return;
    if (document.hidden) {
      void showLocalServiceWorkerNotification({
        title: callState.mode === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call',
        body: `${callState.peer.displayName} is calling you on Quadline`,
        url: '/?tab=calls',
        tab: 'calls',
        tag: `call-${callState.callId || callState.peer.uid}`,
        category: 'call',
        requireInteraction: true,
      });
    }
  }, [callState.status, callState.mode, callState.callId, callState.peer, userPrivate?.pushEnabled]);

  // Clear activeRoomId if the room no longer exists (but never force-reopen when user is on Chats Home)
  useEffect(() => {
    if (
      activeRoomId &&
      discoverableRooms.length > 0 &&
      !allAccessibleRooms.some((r) => r.id === activeRoomId) &&
      !discoverableRooms.some((r) => r.id === activeRoomId)
    ) {
      setActiveRoomId(null);
    }
  }, [activeRoomId, allAccessibleRooms, discoverableRooms]);

  // Android / browser hardware Back gesture returns from open chat to the WhatsApp Chats list
  const pushedChatHistoryRef = useRef(false);
  useEffect(() => {
    if (activeRoomId && !pushedChatHistoryRef.current) {
      pushedChatHistoryRef.current = true;
      try {
        window.history.pushState({ quadlineChatOpen: true }, '');
      } catch {
        // Ignore history restrictions in sandboxed iframes
      }
    }
  }, [activeRoomId]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      // When pressing Back from a fullscreen call overlay, keep the underlying open chat intact
      if (e.state && (e.state as { quadlineChatOpen?: boolean }).quadlineChatOpen) {
        return;
      }
      // Close any open modal before exiting the active chat on Android Back gesture
      if (
        notificationsOpen ||
        themesModalOpen ||
        viewingProfile ||
        privacyModalOpen ||
        profileModalOpen ||
        editGroupOpen ||
        discoverOpen ||
        newDmOpen
      ) {
        setNotificationsOpen(false);
        setThemesModalOpen(false);
        setViewingProfile(null);
        setPrivacyModalOpen(false);
        setProfileModalOpen(false);
        setEditGroupOpen(false);
        setDiscoverOpen(false);
        setNewDmOpen(false);
        if (activeRoomId) {
          try {
            window.history.pushState({ quadlineChatOpen: true }, '');
          } catch {
            // Ignore history restrictions
          }
        }
        return;
      }
      if (activeRoomId) {
        pushedChatHistoryRef.current = false;
        setActiveRoomId(null);
        setRightPanelOpen(false);
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [
    activeRoomId,
    notificationsOpen,
    themesModalOpen,
    viewingProfile,
    privacyModalOpen,
    profileModalOpen,
    editGroupOpen,
    discoverOpen,
    newDmOpen,
  ]);

  const activeRoom = useMemo(
    () =>
      allAccessibleRooms.find((r) => r.id === activeRoomId) ||
      discoverableRooms.find((r) => r.id === activeRoomId) ||
      null,
    [allAccessibleRooms, discoverableRooms, activeRoomId]
  );

  const isMemberOfActiveRoom = useMemo(() => {
    if (!activeRoom || !firebaseUser) return false;
    if (activeRoom.visibility === 'dm') return activeRoom.dmParticipantIds.includes(firebaseUser.uid);
    return joinedRoomIds.has(activeRoom.id);
  }, [activeRoom, firebaseUser, joinedRoomIds]);

  const currentMemberRecord = useMemo(
    () => roomMembers.find((m) => m.uid === firebaseUser?.uid) || null,
    [roomMembers, firebaseUser]
  );

  const currentRole: MemberRole | null = currentMemberRecord?.role || null;
  const isActiveRoomMod = currentRole === 'owner' || currentRole === 'moderator';

  // Active Room Subcollection Listeners
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified || !activeRoomId || !isMemberOfActiveRoom) {
      setRoomMembers([]);
      setRoomMessages([]);
      setRoomEvents([]);
      setRoomJoinRequests([]);
      setRoomReports([]);
      setRoomActivities([]);
      return;
    }

    setMessagesLoading(true);
    setReplyTo(null);
    setEditingMessage(null);
    setActiveThreadRootId(null);

    const handleMembershipRevoked = (err: unknown, path: string) => {
      if (isTransientNetworkError(err)) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Missing or insufficient permissions')) {
        void deleteUserMembershipIndex(firebaseUser.uid, activeRoomId);
        setActiveRoomId(null);
        pushToast('Room access updated', 'You are no longer a member of that room.');
        return;
      }
      handleFirestoreError(err, OperationType.LIST, path);
    };

    const unsubMembers = onSnapshot(
      query(collection(db, 'rooms', activeRoomId, 'members'), where('roomId', '==', activeRoomId)),
      (snap) => {
        setRoomMembers(snap.docs.map((d) => d.data() as RoomMember));
      },
      (err) => handleMembershipRevoked(err, `rooms/${activeRoomId}/members`)
    );

    let unsubCancelled = false;
    const unsubMessages = onSnapshot(
      query(
        collection(db, 'rooms', activeRoomId, 'messages'),
        where('roomId', '==', activeRoomId)
      ),
      (snap) => {
        const rawList = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) }));
        rawList.sort(
          (a, b) => (a.createdAt?.toMillis() || Date.now()) - (b.createdAt?.toMillis() || Date.now())
        );

        const needsDecrypt = rawList.some(
          (m) => isEncryptedPayload(m.text) || isEncryptedPayload(m.replyToSnippet)
        );
        if (!needsDecrypt) {
          setRoomMessages(rawList);
          setMessagesLoading(false);
          return;
        }

        void Promise.all(
          rawList.map(async (m) => {
            const nextText = isEncryptedPayload(m.text)
              ? await decryptChatText(activeRoomId, m.text)
              : m.text;
            const nextReplySnippet = isEncryptedPayload(m.replyToSnippet)
              ? await decryptChatText(activeRoomId, m.replyToSnippet)
              : m.replyToSnippet;
            if (nextText === m.text && nextReplySnippet === m.replyToSnippet) return m;
            return { ...m, text: nextText, replyToSnippet: nextReplySnippet };
          })
        ).then((decryptedList) => {
          if (!unsubCancelled) {
            setRoomMessages(decryptedList);
            setMessagesLoading(false);
          }
        });
      },
      (err) => {
        setMessagesLoading(false);
        handleMembershipRevoked(err, `rooms/${activeRoomId}/messages`);
      }
    );

    const unsubEvents = onSnapshot(
      query(collection(db, 'rooms', activeRoomId, 'events'), where('roomId', '==', activeRoomId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RoomEvent, 'id'>) }));
        list.sort((a, b) => a.startAt.localeCompare(b.startAt));
        setRoomEvents(list);
      },
      (err) => handleMembershipRevoked(err, `rooms/${activeRoomId}/events`)
    );

    const unsubActivities = onSnapshot(
      query(collection(db, 'rooms', activeRoomId, 'activity'), where('roomId', '==', activeRoomId)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RoomActivity, 'id'>) }));
        list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        setRoomActivities(list);
      },
      (err) => handleMembershipRevoked(err, `rooms/${activeRoomId}/activity`)
    );

    return () => {
      unsubCancelled = true;
      unsubMembers();
      unsubMessages();
      unsubEvents();
      unsubActivities();
    };
  }, [firebaseUser, activeRoomId, isMemberOfActiveRoom, pushToast]);

  // Moderator-only subcollections (join requests & safety reports)
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified || !activeRoomId || !isActiveRoomMod) {
      setRoomJoinRequests([]);
      setRoomReports([]);
      return;
    }

    const unsubReqs = onSnapshot(
      query(collection(db, 'rooms', activeRoomId, 'joinRequests'), where('roomId', '==', activeRoomId)),
      (snap) => {
        setRoomJoinRequests(snap.docs.map((d) => d.data() as JoinRequest));
      },
      (err) => {
        if (!isTransientNetworkError(err)) {
          handleFirestoreError(err, OperationType.LIST, `rooms/${activeRoomId}/joinRequests`);
        }
      }
    );

    const unsubReports = onSnapshot(
      query(collection(db, 'rooms', activeRoomId, 'reports'), where('roomId', '==', activeRoomId)),
      (snap) => {
        setRoomReports(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ModerationReport, 'id'>) })));
      },
      (err) => {
        if (!isTransientNetworkError(err)) {
          handleFirestoreError(err, OperationType.LIST, `rooms/${activeRoomId}/reports`);
        }
      }
    );

    return () => {
      unsubReqs();
      unsubReports();
    };
  }, [firebaseUser, activeRoomId, isActiveRoomMod]);

  const effectiveReadReceiptsEnabled =
    userPrivate?.readReceiptsEnabled ?? privacySettings.readReceiptsEnabled;

  // Mark incoming messages as delivered (when received) and read (when tab is visible)
  const lastDeliveredSyncRef = useRef<string>('');
  const lastReadSyncRef = useRef<string>('');
  useEffect(() => {
    if (!activeRoomId || !firebaseUser || !isMemberOfActiveRoom || roomMessages.length === 0) return;
    const latestId = roomMessages[roomMessages.length - 1]?.id || '';
    const key = `${activeRoomId}:${latestId}`;

    if (document.hidden || !effectiveReadReceiptsEnabled) {
      if (lastDeliveredSyncRef.current !== key) {
        lastDeliveredSyncRef.current = key;
        void markMessagesDelivered(activeRoomId, roomMessages, firebaseUser.uid);
      }
      return;
    }

    if (lastReadSyncRef.current !== key) {
      lastReadSyncRef.current = key;
      lastDeliveredSyncRef.current = key;
      void markMessagesRead(activeRoomId, roomMessages, firebaseUser.uid);
    }
  }, [activeRoomId, firebaseUser, isMemberOfActiveRoom, roomMessages, effectiveReadReceiptsEnabled]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (
        !document.hidden &&
        effectiveReadReceiptsEnabled &&
        activeRoomId &&
        firebaseUser &&
        isMemberOfActiveRoom &&
        roomMessages.length > 0
      ) {
        void markMessagesRead(activeRoomId, roomMessages, firebaseUser.uid);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [activeRoomId, firebaseUser, isMemberOfActiveRoom, roomMessages, effectiveReadReceiptsEnabled]);

  // Global keyboard shortcuts (⌘K, ⌘F, Shift+?, Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickSwitcherOpen((v) => !v);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && activeRoomId && isMemberOfActiveRoom) {
        e.preventDefault();
        setRightPanelTab('search');
        setRightPanelOpen(true);
        return;
      }
      const target = e.target as HTMLElement | null;
      const inInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (!inInput && e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        if (
          quickSwitcherOpen ||
          shortcutsOpen ||
          callHubMode ||
          themesModalOpen ||
          privacyModalOpen ||
          editGroupOpen ||
          pinVaultPromptOpen ||
          songsReelsModalTab ||
          lightboxImage ||
          mobileSidebarOpen ||
          rightPanelOpen
        ) {
          setQuickSwitcherOpen(false);
          setShortcutsOpen(false);
          setCallHubMode(null);
          setThemesModalOpen(false);
          setPrivacyModalOpen(false);
          setEditGroupOpen(false);
          setPinVaultPromptOpen(false);
          setSongsReelsModalTab(null);
          setLightboxImage(null);
          setLightboxZoomed(false);
          setMobileSidebarOpen(false);
          setRightPanelOpen(false);
        } else if (!inInput && activeRoomId) {
          setActiveRoomId(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeRoomId,
    isMemberOfActiveRoom,
    quickSwitcherOpen,
    shortcutsOpen,
    callHubMode,
    themesModalOpen,
    privacyModalOpen,
    editGroupOpen,
    pinVaultPromptOpen,
    songsReelsModalTab,
    lightboxImage,
    mobileSidebarOpen,
    rightPanelOpen,
  ]);

  // Derived room helpers
  const eventsById = useMemo(() => {
    const map: Record<string, RoomEvent> = {};
    for (const e of roomEvents) map[e.id] = e;
    return map;
  }, [roomEvents]);

  const pinnedMessages = useMemo(
    () => roomMessages.filter((m) => m.pinned && !m.deleted),
    [roomMessages]
  );

  const activeThreadRoot = useMemo(
    () => (activeThreadRootId ? roomMessages.find((m) => m.id === activeThreadRootId) || null : null),
    [activeThreadRootId, roomMessages]
  );

  const activeDmPeer = useMemo(() => {
    if (!activeRoom || activeRoom.visibility !== 'dm' || !profile) return null;
    const peerUid = activeRoom.dmParticipantIds.find((id) => id !== profile.uid);
    return peerUid ? profilesByUid[peerUid] || null : null;
  }, [activeRoom, profile, profilesByUid]);

  const activeRoomOnlineCount = useMemo(() => {
    return roomMembers.filter((m) => {
      const st = presenceMap[m.uid]?.status || profilesByUid[m.uid]?.status || 'offline';
      return st !== 'offline';
    }).length;
  }, [roomMembers, presenceMap, profilesByUid]);

  const activeTypingUsers = useMemo(() => {
    if (!activeRoomId || !profile) return [];
    return (typingByRoom[activeRoomId] || []).filter((u) => u.uid !== profile.uid);
  }, [typingByRoom, activeRoomId, profile]);

  const unreadNotificationsCount = useMemo(() => {
    const firestoreUnread = notifications.filter((n) => !n.read).length;
    const pendingRequestsCount = socialGraph.incomingRequests.length;
    const otherSocialUnread = socialNotifications.filter(
      (n) => !n.read && n.kind !== 'follow_request'
    ).length;
    return firestoreUnread + pendingRequestsCount + otherSocialUnread;
  }, [notifications, socialGraph.incomingRequests.length, socialNotifications]);

  const activeRoomThemeRecord = activeRoomId ? roomThemes[activeRoomId] || null : null;
  const activeChatTheme = useMemo(
    () => getChatThemeById(activeRoomThemeRecord?.chatThemeId),
    [activeRoomThemeRecord?.chatThemeId]
  );

  const otherChatsBadgeCount = useMemo(() => {
    let otherTypingRooms = 0;
    if (profile) {
      for (const [roomId, users] of Object.entries(typingByRoom)) {
        if (roomId !== activeRoomId && users.some((u) => u.uid !== profile.uid)) {
          otherTypingRooms += 1;
        }
      }
    }
    return unreadNotificationsCount + otherTypingRooms;
  }, [unreadNotificationsCount, typingByRoom, activeRoomId, profile]);

  const pendingModCount = useMemo(() => {
    const reqs = roomJoinRequests.filter((r) => r.status === 'pending').length;
    const reps = roomReports.filter((r) => r.status === 'open').length;
    return reqs + reps;
  }, [roomJoinRequests, roomReports]);

  const activeRoomNotificationPref: NotificationPref = useMemo(() => {
    if (!activeRoomId || !userPrivate) return 'all';
    if (userPrivate.mutedRoomIds.includes(activeRoomId)) return 'mute';
    return userPrivate.roomNotificationPrefs[activeRoomId] || 'all';
  }, [activeRoomId, userPrivate]);

  // Only accepted friends can be called 1-to-1
  const callableContacts = useMemo(() => friendProfiles, [friendProfiles]);

  // Load locally hidden ("Delete for Me") message IDs per user
  useEffect(() => {
    if (!firebaseUser?.uid) {
      setDeletedForMeIds(new Set());
      return;
    }
    try {
      const raw = localStorage.getItem(`quadline_deleted_for_me_${firebaseUser.uid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDeletedForMeIds(new Set(parsed.filter((id): id is string => typeof id === 'string')));
          return;
        }
      }
    } catch {
      // Ignore storage failures
    }
    setDeletedForMeIds(new Set());
  }, [firebaseUser?.uid]);

  // Load saved preferences, call history, backup status, social notifications, chat themes & Friend/Follow graph from Express backend
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setCallHistory([]);
      setBackupSummary(null);
      setSocialGraph({ friends: [], incomingRequests: [], outgoingRequests: [] });
      setSocialNotifications([]);
      return;
    }
    let cancelled = false;
    void fetchBackendBootstrap(firebaseUser.uid).then((data) => {
      if (cancelled || !data) return;
      if (data.preferences) {
        if (isValidThemeId(data.preferences.themeId)) setThemeId(data.preferences.themeId);
        if (isValidWallpaperId(data.preferences.wallpaperId)) setWallpaperId(data.preferences.wallpaperId);
        setDarkMode(data.preferences.darkMode);
      }
      setCallHistory(data.callHistory || []);
      setBackupSummary(data.backupSummary || null);
    });
    void fetchSocialGraph(firebaseUser.uid).then((graph) => {
      if (cancelled) return;
      setSocialGraph(graph);
    });
    void fetchMyFollows(firebaseUser.uid).then((data) => {
      if (cancelled) return;
      setMyFollowingUids(new Set(data.following.map((f) => f.uid)));
    });
    void fetchSocialNotifications(firebaseUser.uid).then((items) => {
      if (cancelled) return;
      setSocialNotifications(items);
    });
    void fetchRoomThemes().then((map) => {
      if (cancelled) return;
      setRoomThemes(map);
    });
    void fetchMutualStories(firebaseUser.uid).then((list) => {
      if (cancelled) return;
      setStories(list);
    });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  // Keep mutual-follow stories synced whenever friend or following list changes
  useEffect(() => {
    if (!firebaseUser?.uid || !firebaseUser.emailVerified) return;
    void refreshStories(firebaseUser.uid);
  }, [
    firebaseUser?.uid,
    firebaseUser?.emailVerified,
    socialGraph.friends.length,
    myFollowingUids.size,
    refreshStories,
  ]);

  const storyGroups = useMemo(
    () => (profile ? groupStoriesByAuthor(stories, profile.uid, profilesByUid) : []),
    [stories, profile, profilesByUid]
  );

  const handlePublishStory = useCallback(
    async (payload: {
      mediaType: 'image' | 'video' | 'text';
      mediaUrl?: string;
      caption?: string;
      backgroundTheme?: string;
    }) => {
      if (!profile) return;
      const res = await createStory({
        authorUid: profile.uid,
        authorName: profile.displayName,
        authorHandle: profile.handle,
        authorPhoto: profile.photoUrl,
        ...payload,
      });
      if (res.error) {
        throw new Error(res.error);
      }
      await refreshStories(profile.uid);
      pushToast('Story shared!', 'Visible for 24 hours to mutual friends.');
    },
    [profile, refreshStories, pushToast]
  );

  const handleMarkStoryViewed = useCallback(
    (storyId: string) => {
      if (!profile) return;
      void markStoryViewed(storyId, {
        uid: profile.uid,
        displayName: profile.displayName,
        handle: profile.handle,
        photoUrl: profile.photoUrl,
      }).then((viewers) => {
        if (!viewers) return;
        setStories((prev) =>
          prev.map((s) => (s.id === storyId ? { ...s, viewers } : s))
        );
      });
    },
    [profile]
  );

  const handleDeleteStory = useCallback(
    async (storyId: string) => {
      if (!profile) return;
      const ok = await deleteStory(storyId, profile.uid);
      if (ok) {
        setStories((prev) => prev.filter((s) => s.id !== storyId));
        pushToast('Story deleted');
      }
    },
    [profile, pushToast]
  );

  const handleReplyStory = useCallback(
    async (authorUid: string, replyText: string) => {
      if (!profile || !friendUidSet.has(authorUid)) return;
      const peer = profilesByUid[authorUid] || friendProfiles.find((p) => p.uid === authorUid);
      if (!peer) return;
      const dmId = await startOrOpenDM(profile, peer);
      await sendMessage({
        roomId: dmId,
        roomName: peer.displayName,
        author: profile,
        kind: 'text',
        text: replyText,
        dmRecipientId: peer.uid,
        onNotifyPing: (recipientId, title, body) => sendNotifyPing(recipientId, dmId, title, body),
      });
      pushToast('Story reply sent', `Sent privately to ${peer.displayName}.`);
    },
    [profile, friendUidSet, profilesByUid, friendProfiles, sendNotifyPing, pushToast]
  );

  // Automatically log every call to the persistent backend when a call finishes
  const activeCallSnapshotRef = useRef<{
    callId: string;
    peerUid: string;
    peerName: string;
    peerPhoto: string;
    mode: CallMode;
    direction: 'outgoing' | 'incoming' | 'check';
    durationSec: number;
    voiceEffect: VoiceEffectId;
    startedAt: number;
    wasConnected: boolean;
  } | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (callState.status !== 'idle' && callState.callId) {
      const prev = activeCallSnapshotRef.current;
      const direction: 'outgoing' | 'incoming' | 'check' = callState.isTestMode
        ? 'check'
        : prev?.callId === callState.callId
          ? prev.direction
          : callState.status === 'ringing'
            ? 'incoming'
            : 'outgoing';
      activeCallSnapshotRef.current = {
        callId: callState.callId,
        peerUid: callState.peer?.uid || 'self-test',
        peerName: callState.peer?.displayName || 'Voice & Video Check',
        peerPhoto: callState.peer?.photoUrl || '',
        mode: callState.mode,
        direction,
        durationSec: callState.durationSec,
        voiceEffect: callState.voiceEffect,
        startedAt: prev?.callId === callState.callId ? prev.startedAt : Date.now(),
        wasConnected:
          (prev?.callId === callState.callId && prev.wasConnected) ||
          callState.status === 'connected' ||
          callState.status === 'reconnecting',
      };
    } else if (callState.status === 'idle' && activeCallSnapshotRef.current) {
      const finished = activeCallSnapshotRef.current;
      activeCallSnapshotRef.current = null;
      const record: CallHistoryRecord = {
        callId: finished.callId,
        uid: profile.uid,
        peerUid: finished.peerUid,
        peerName: finished.peerName,
        peerPhoto: finished.peerPhoto,
        mode: finished.mode,
        direction: finished.direction,
        status: finished.wasConnected || finished.durationSec > 0 ? 'completed' : 'missed',
        durationSec: finished.durationSec,
        voiceEffect: finished.voiceEffect,
        startedAt: finished.startedAt,
        endedAt: Date.now(),
      };
      setCallHistory((prev) => [record, ...prev.filter((c) => c.callId !== record.callId)].slice(0, 100));
      void recordCallHistory(record);
    }
  }, [callState, profile]);

  // Auto-save workspace snapshot to persistent backend (debounced)
  const handleSaveWorkspaceBackup = useCallback(
    async (notify = false) => {
      if (!profile) return;
      setSavingBackup(true);
      try {
        const roomsPayload = allAccessibleRooms.map((r) => ({
          id: r.id,
          name: r.name,
          visibility: r.visibility,
          category: r.category,
          memberCount: r.memberCount,
          lastMessageText: r.lastMessageText || '',
        }));
        const messagesPayload = roomMessages.slice(-200).map((m) => ({
          id: m.id,
          roomId: m.roomId,
          authorName: m.authorName,
          kind: m.kind,
          text: m.text || m.mediaName || '',
          createdAtMs: m.createdAt?.toMillis() || Date.now(),
        }));
        const summary = await saveWorkspaceSnapshot({
          uid: profile.uid,
          displayName: profile.displayName,
          rooms: roomsPayload,
          recentMessages: messagesPayload,
        });
        if (summary) {
          setBackupSummary(summary);
          if (notify) {
            pushToast(
              'Backup saved to backend',
              `Saved ${summary.roomsCount} groups and ${summary.messagesCount} recent messages.`
            );
          }
        }
      } finally {
        setSavingBackup(false);
      }
    },
    [profile, allAccessibleRooms, roomMessages, pushToast]
  );

  useEffect(() => {
    if (!profile || allAccessibleRooms.length === 0) return;
    const timer = window.setTimeout(() => {
      void handleSaveWorkspaceBackup(false);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [profile?.uid, allAccessibleRooms.length, roomMessages.length, handleSaveWorkspaceBackup]);

  // Handlers
  const persistAppearance = useCallback(
    (nextTheme: ThemeId, nextDark: boolean, nextWallpaper: WallpaperId) => {
      if (!profile) return;
      void saveBackendPreferences(profile.uid, {
        themeId: nextTheme,
        darkMode: nextDark,
        wallpaperId: nextWallpaper,
      });
    },
    [profile]
  );

  const handleToggleTheme = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (profile) {
      void updateUserPrivateSettings(profile.uid, { theme: nextDark ? 'dark' : 'light' });
      persistAppearance(themeId, nextDark, wallpaperId);
    }
  };

  const handleSetDarkMode = (nextDark: boolean) => {
    setDarkMode(nextDark);
    if (profile) {
      void updateUserPrivateSettings(profile.uid, { theme: nextDark ? 'dark' : 'light' });
      persistAppearance(themeId, nextDark, wallpaperId);
    }
  };

  const handleSelectThemeId = (nextTheme: ThemeId) => {
    setThemeId(nextTheme);
    persistAppearance(nextTheme, darkMode, wallpaperId);
  };

  const handleSelectWallpaperId = (nextWallpaper: WallpaperId) => {
    setWallpaperId(nextWallpaper);
    persistAppearance(themeId, darkMode, nextWallpaper);
  };

  const handleDeleteCallLog = (callId: string) => {
    if (!profile) return;
    setCallHistory((prev) => prev.filter((c) => c.callId !== callId));
    void deleteCallHistoryRecord(profile.uid, callId);
  };

  const handleChangeStatus = (nextStatus: OnlineStatus) => {
    if (!profile) return;
    void updateUserProfile(profile.uid, { status: nextStatus });
  };

  const handleSelectNotification = async (item: NotificationItem) => {
    if (!item.read) {
      await markNotificationRead(item.id);
    }
    if (item.type === 'join_approved' && profile) {
      const targetRoom = discoverableRooms.find((r) => r.id === item.roomId);
      if (targetRoom && !joinedRoomIds.has(targetRoom.id)) {
        await joinPublicRoom(targetRoom, profile);
      }
    }
    if (item.roomId) {
      setActiveRoomId(item.roomId);
    }
  };

  const handleToggleFollow = useCallback(
    async (
      target: { uid: string; displayName: string; handle: string; photoUrl: string },
      action?: 'follow' | 'unfollow'
    ): Promise<ProfileFollowData | null> => {
      if (!profile || target.uid === profile.uid) return null;
      const res = await toggleFollowUser({
        followerUid: profile.uid,
        followerName: profile.displayName,
        followerHandle: profile.handle,
        followerPhoto: profile.photoUrl,
        targetUid: target.uid,
        targetName: target.displayName,
        targetHandle: target.handle,
        targetPhoto: target.photoUrl,
        action,
      });
      if (!res.ok || res.error) {
        pushToast('Follow update failed', res.error || 'Please try again.');
        return null;
      }
      setMyFollowingUids((prev) => {
        const next = new Set(prev);
        if (res.isFollowing) next.add(target.uid);
        else next.delete(target.uid);
        return next;
      });
      void refreshStories(profile.uid);
      if (res.isFollowing) {
        pushToast(
          `Following @${target.handle}`,
          res.profileData?.isMutualFollow
            ? 'Mutual follow! You can now view each other’s 24h Stories.'
            : `You are now following ${target.displayName}.`
        );
      } else {
        pushToast(`Unfollowed @${target.handle}`);
      }
      return res.profileData || null;
    },
    [profile, pushToast, refreshStories]
  );

  const handleSendFriendRequest = useCallback(
    async (target: Profile) => {
      if (!profile || target.uid === profile.uid) return;
      const res = await sendFriendRequest({
        fromUid: profile.uid,
        fromName: profile.displayName,
        fromHandle: profile.handle,
        fromPhoto: profile.photoUrl,
        toUid: target.uid,
        toName: target.displayName,
        toHandle: target.handle,
        toPhoto: target.photoUrl,
      });
      if (res.error) {
        pushToast('Request failed', res.error);
        return;
      }
      if (res.graph) {
        setSocialGraph(res.graph);
      } else {
        await refreshSocialGraph(profile.uid);
      }
      if (res.autoAccepted || res.relation?.status === 'accepted') {
        pushToast('You are now friends!', `You and ${target.displayName} can now chat & call.`);
      } else {
        pushToast('Friend request sent', `Waiting for ${target.displayName} to accept.`);
      }
    },
    [profile, pushToast, refreshSocialGraph]
  );

  const handleAcceptFriendRequest = useCallback(
    async (otherUid: string) => {
      if (!profile) return;
      const res = await respondFriendRequest({
        uid: profile.uid,
        otherUid,
        action: 'accept',
        actorName: profile.displayName,
      });
      if (res.error) {
        pushToast('Could not accept', res.error);
        return;
      }
      if (res.graph) {
        setSocialGraph(res.graph);
      } else {
        await refreshSocialGraph(profile.uid);
      }
      void refreshSocialNotifications(profile.uid);
      const peerName = profilesByUid[otherUid]?.displayName || 'Your new friend';
      pushToast('Friend request accepted', `You can now message and call ${peerName}.`);
    },
    [profile, profilesByUid, pushToast, refreshSocialGraph, refreshSocialNotifications]
  );

  const handleDeclineFriendRequest = useCallback(
    async (otherUid: string) => {
      if (!profile) return;
      const res = await respondFriendRequest({
        uid: profile.uid,
        otherUid,
        action: 'decline',
        actorName: profile.displayName,
      });
      if (res.error) {
        pushToast('Action failed', res.error);
        return;
      }
      if (res.graph) {
        setSocialGraph(res.graph);
      } else {
        await refreshSocialGraph(profile.uid);
      }
      void refreshSocialNotifications(profile.uid);
      pushToast('Request declined');
    },
    [profile, pushToast, refreshSocialGraph, refreshSocialNotifications]
  );

  const handleRemoveFriendRelation = useCallback(
    async (otherUid: string) => {
      if (!profile) return;
      const wasFriend = friendUidSet.has(otherUid);
      const res = await removeFriendRelation({
        uid: profile.uid,
        otherUid,
      });
      if (res.error) {
        pushToast('Action failed', res.error);
        return;
      }
      if (res.graph) {
        setSocialGraph(res.graph);
      } else {
        await refreshSocialGraph(profile.uid);
      }
      pushToast(wasFriend ? 'Unfollowed friend' : 'Friend request cancelled');
    },
    [profile, friendUidSet, pushToast, refreshSocialGraph]
  );

  const handleStartDM = async (target: Profile) => {
    if (!profile || target.uid === profile.uid) return;
    if (!friendUidSet.has(target.uid)) {
      if (incomingRequestUidSet.has(target.uid)) {
        await handleAcceptFriendRequest(target.uid);
        const dmId = await startOrOpenDM(profile, target);
        setActiveRoomId(dmId);
        return;
      }
      if (outgoingRequestUidSet.has(target.uid)) {
        pushToast(
          'Friend request pending',
          `Waiting for ${target.displayName} to accept your request before private chatting.`
        );
        return;
      }
      await handleSendFriendRequest(target);
      return;
    }
    const dmId = await startOrOpenDM(profile, target);
    setActiveRoomId(dmId);
  };

  const handleDirectMessageByAuthor = (authorId: string, authorName: string, authorPhoto: string) => {
    if (!profile || authorId === profile.uid) return;
    const existing = profilesByUid[authorId];
    const target: Profile = existing || {
      uid: authorId,
      displayName: authorName,
      handle: authorName.toLowerCase().replace(/[^a-z0-9]/g, '') || authorId.slice(0, 8),
      bio: '',
      photoUrl: authorPhoto || '',
      majorOrClub: '',
      status: presenceMap[authorId]?.status || 'offline',
      statusMessage: '',
      discoverable: true,
      lastSeenAt: null,
      createdAt: null,
      updatedAt: null,
    };
    if (friendUidSet.has(authorId) || incomingRequestUidSet.has(authorId)) {
      setSidebarTab('dms');
    }
    void handleStartDM(target);
  };

  const handleSendRoomMessage = async (
    kind: 'text' | 'image' | 'file' | 'voice' | 'poll',
    payload: {
      text?: string;
      mentionedUids?: string[];
      mediaUrl?: string;
      thumbnailUrl?: string;
      mediaName?: string;
      mediaMime?: string;
      mediaSize?: number;
      voiceDurationSec?: number;
      voiceEffect?: VoiceEffectId;
      waveform?: number[];
      poll?: Message['poll'];
    }
  ) => {
    if (!activeRoom || !profile) return;
    const dmRecipientId =
      activeRoom.visibility === 'dm'
        ? activeRoom.dmParticipantIds.find((id) => id !== profile.uid)
        : undefined;
    if (activeRoom.visibility === 'dm' && dmRecipientId && !friendUidSet.has(dmRecipientId)) {
      pushToast(
        'Friend request required',
        'You and this person must be accepted friends before sending private messages.'
      );
      return;
    }

    const isBroadcastMention =
      activeRoom.visibility !== 'dm' && hasGroupBroadcastMention(payload.text || '');
    const notifyAllMemberUids = isBroadcastMention
      ? roomMembers.map((m) => m.uid).filter((id) => id !== profile.uid)
      : undefined;

    const shouldEncrypt =
      kind === 'text' &&
      Boolean(payload.text?.trim()) &&
      isRoomEncryptionEnabled(activeRoom.id, privacySettings);
    const outgoingText = shouldEncrypt
      ? await encryptChatText(activeRoom.id, payload.text || '')
      : payload.text || '';

    const alreadyPinged = new Set<string>();
    await sendMessage({
      roomId: activeRoom.id,
      roomName: activeRoom.visibility === 'dm' ? profile.displayName : activeRoom.name,
      author: profile,
      kind,
      text: outgoingText,
      mediaUrl: payload.mediaUrl,
      thumbnailUrl: payload.thumbnailUrl,
      mediaName: payload.mediaName,
      mediaMime: payload.mediaMime,
      mediaSize: payload.mediaSize,
      voiceDurationSec: payload.voiceDurationSec,
      voiceEffect: payload.voiceEffect,
      waveform: payload.waveform,
      poll: payload.poll,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            authorName: replyTo.authorName,
            authorId: replyTo.authorId,
            snippet: shouldEncrypt
              ? 'Encrypted message'
              : replyTo.text || replyTo.mediaName || 'attachment',
          }
        : null,
      mentionedUids: payload.mentionedUids || [],
      notifyAllMemberUids,
      isBroadcastMention,
      dmRecipientId,
      onNotifyPing: (recipientId, title, body) => {
        alreadyPinged.add(recipientId);
        if (socketConnected) {
          sendNotifyPing(recipientId, activeRoom.id, title, body);
        } else {
          sendBackgroundRoomPush({
            senderUid: profile.uid,
            recipientIds: [recipientId],
            roomId: activeRoom.id,
            title,
            body,
            category: 'message',
          });
        }
      },
    });

    // Also deliver mobile phone push alerts to other group members who didn't already get a mention/reply ping
    if (activeRoom.visibility !== 'dm' && roomMembers.length > 1) {
      const otherGroupMembers = roomMembers
        .map((m) => m.uid)
        .filter((uid) => uid !== profile.uid && !alreadyPinged.has(uid));
      if (otherGroupMembers.length > 0) {
        const pushPreview = shouldEncrypt
          ? 'Encrypted message'
          : kind === 'image'
            ? 'Sent a photo'
            : kind === 'voice'
              ? 'Sent a voice note'
              : kind === 'file'
                ? `Shared ${payload.mediaName || 'a file'}`
                : kind === 'poll'
                  ? `Poll: ${payload.poll?.question || 'Quick poll'}`
                  : (payload.text || 'New message').slice(0, 140);
        sendBackgroundRoomPush({
          senderUid: profile.uid,
          recipientIds: otherGroupMembers,
          roomId: activeRoom.id,
          title: `${profile.displayName} · ${activeRoom.name}`,
          body: pushPreview,
          category: 'message',
        });
      }
    }

    if (isBroadcastMention && notifyAllMemberUids && notifyAllMemberUids.length > 0) {
      pushToast(
        'Notified everyone in group',
        `Alerted ${notifyAllMemberUids.length} ${
          notifyAllMemberUids.length === 1 ? 'member' : 'members'
        } in ${activeRoom.name}.`
      );
    }
    setReplyTo(null);
  };

  const handleJumpToMessage = useCallback((messageId: string) => {
    if (window.innerWidth < 1280) {
      setRightPanelOpen(false);
    }
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-emerald-500/70', 'rounded-lg');
      window.setTimeout(() => {
        el.classList.remove('ring-2', 'ring-emerald-500/70', 'rounded-lg');
      }, 1800);
    }
  }, []);

  // Keep latest mutable refs so memoized MessageList/Sidebar/RoomHeader callbacks remain referentially stable
  const activeRoomRef = useRef<Room | null>(activeRoom);
  activeRoomRef.current = activeRoom;
  const profileRef = useRef<Profile | null>(profile);
  profileRef.current = profile;
  const userPrivateRef = useRef<UserPrivate | null>(userPrivate);
  userPrivateRef.current = userPrivate;
  const handleSendRoomMessageRef = useRef(handleSendRoomMessage);
  handleSendRoomMessageRef.current = handleSendRoomMessage;
  const handleStartDMRef = useRef(handleStartDM);
  handleStartDMRef.current = handleStartDM;
  const handleDirectMessageByAuthorRef = useRef(handleDirectMessageByAuthor);
  handleDirectMessageByAuthorRef.current = handleDirectMessageByAuthor;
  const startSelfTestCallRef = useRef(startSelfTestCall);
  startSelfTestCallRef.current = startSelfTestCall;

  // Stabilized Sidebar & Header handlers
  const handleCloseMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);
  const handleOpenMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const handleSelectRoom = useCallback((id: string) => {
    setActiveRoomId(id);
    setMobileSidebarOpen(false);
    setRightPanelOpen(false);
  }, []);
  const handleBackToChats = useCallback(() => {
    setActiveRoomId(null);
    setRightPanelOpen(false);
    setMobileSidebarOpen(false);
    if (pushedChatHistoryRef.current) {
      pushedChatHistoryRef.current = false;
      try {
        if (window.history.state?.quadlineChatOpen) {
          window.history.back();
        }
      } catch {
        // Ignore history restrictions
      }
    }
  }, []);
  const handleSidebarStartDM = useCallback((target: Profile) => {
    setSidebarTab('dms');
    setMobileSidebarOpen(false);
    setRightPanelOpen(false);
    void handleStartDMRef.current(target);
  }, []);
  const handleOpenDiscover = useCallback(() => setDiscoverOpen(true), []);
  const handleOpenCreateRoom = useCallback(() => setCreateRoomOpen(true), []);
  const handleOpenJoinByCode = useCallback(() => setJoinCodeOpen(true), []);
  const handleOpenNewDM = useCallback(() => setNewDmOpen(true), []);
  const handleOpenProfileModal = useCallback(() => setProfileModalOpen(true), []);
  const handleOpenNotifications = useCallback(() => setNotificationsOpen(true), []);
  const handleOpenQuickSwitcher = useCallback(() => setQuickSwitcherOpen(true), []);
  const handleOpenShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const handleOpenThemes = useCallback(() => setThemesModalOpen(true), []);
  const handleOpenPrivacy = useCallback(() => setPrivacyModalOpen(true), []);
  const handleOpenEditGroup = useCallback(() => setEditGroupOpen(true), []);
  const handleChangeSidebarTab = useCallback((nextTab: SidebarSectionTab) => {
    setSidebarTab(nextTab);
    if (nextTab === 'reels') {
      setActiveRoomId(null);
      setRightPanelOpen(false);
      setMobileSidebarOpen(false);
    }
  }, []);
  const handleQuickRandomProfile = useCallback(async () => {
    const current = profileRef.current;
    if (!current) return;
    const nextPhoto = generateRandomAvatarUrl(current.photoUrl);
    await updateUserProfile(current.uid, { photoUrl: nextPhoto });
    pushToast('Random avatar applied', 'You can pick more avatars or customize anytime in Profile.');
  }, [pushToast]);
  const handleShareReelToRoom = useCallback(
    async (roomId: string, reel: ReelItem) => {
      const current = profileRef.current;
      if (!current) return;
      const targetRoom = allAccessibleRooms.find((r) => r.id === roomId);
      if (!targetRoom) return;
      const dmRecipientId =
        targetRoom.visibility === 'dm'
          ? targetRoom.dmParticipantIds.find((id) => id !== current.uid)
          : undefined;
      const label = reel.mediaType === 'instagram' ? 'Instagram Reel' : 'Reel';
      const mediaName = `${label} · ${reel.caption || `@${reel.authorHandle}`}`.slice(0, 155);
      await sendMessage({
        roomId: targetRoom.id,
        roomName: targetRoom.visibility === 'dm' ? current.displayName : targetRoom.name,
        author: current,
        kind: 'file',
        text: encodeReelMessageText(reel),
        mediaUrl: reel.instagramUrl || reel.mediaUrl || `reel:${reel.id}`,
        thumbnailUrl: reel.audioArtwork || (reel.mediaType === 'image' ? reel.mediaUrl : undefined),
        mediaName,
        mediaMime: REEL_MESSAGE_MIME,
        mediaSize: 0,
        dmRecipientId,
        onNotifyPing: (recipientId, title, body) =>
          sendNotifyPing(recipientId, targetRoom.id, title, body),
      });
      pushToast(`${label} shared!`, `Sent to ${targetRoom.name}`);
    },
    [allAccessibleRooms, pushToast, sendNotifyPing]
  );
  const handleSendSongToActiveRoom = useCallback(
    async (song: SongTrack, note?: string) => {
      await handleSendRoomMessageRef.current('file', {
        text: encodeSongMessageText(song, note),
        mediaUrl: song.previewUrl || song.spotifyUrl || '',
        thumbnailUrl: song.artworkUrl,
        mediaName: `${song.title} — ${song.artist}`.slice(0, 155),
        mediaMime: SONG_MESSAGE_MIME,
        mediaSize: 0,
      });
      pushToast('Song sent!', `${song.title} — ${song.artist}`);
    },
    [pushToast]
  );
  const handleOpenReelFromChat = useCallback((reelId: string) => {
    setInitialReelId(reelId);
    setInitialCreateReelForRoomId(null);
    setActiveRoomId(null);
    setRightPanelOpen(false);
    setMobileSidebarOpen(false);
    setSidebarTab('reels');
  }, []);
  const handleOpenCreateReelForActiveRoom = useCallback(() => {
    const room = activeRoomRef.current;
    if (!room) return;
    setInitialReelId(null);
    setInitialCreateReelForRoomId(room.id);
    setSongsReelsModalTab(null);
    setActiveRoomId(null);
    setRightPanelOpen(false);
    setMobileSidebarOpen(false);
    setSidebarTab('reels');
  }, []);
  const handleClearInitialReelIntent = useCallback(() => {
    setInitialReelId(null);
    setInitialCreateReelForRoomId(null);
  }, []);
  const handleUpdatePrivacySettings = useCallback(
    (next: ChatPrivacySettings) => {
      const uid = profileRef.current?.uid;
      setPrivacySettings(next);
      if (uid) {
        savePrivacySettings(uid, next);
      }
      if (!next.pinHash) {
        setAppLocked(false);
        setLockedVaultUnlocked(false);
      }
      if (next.lockedRoomIds.includes(activeRoomRef.current?.id || '') && !lockedVaultUnlocked) {
        setLockedVaultUnlocked(false);
      }
    },
    [lockedVaultUnlocked]
  );
  const handleToggleReadReceipts = useCallback(
    async (enabled: boolean) => {
      const uid = profileRef.current?.uid;
      if (!uid) return;
      const previousEnabled = userPrivateRef.current?.readReceiptsEnabled ?? privacySettings.readReceiptsEnabled;
      setSavingReadReceipts(true);
      setPrivacySettings((prev) => {
        const next = { ...prev, readReceiptsEnabled: enabled };
        savePrivacySettings(uid, next);
        return next;
      });
      setUserPrivate((prev) => (prev ? { ...prev, readReceiptsEnabled: enabled } : prev));
      try {
        await updateUserPrivateSettings(uid, { readReceiptsEnabled: enabled });
        pushToast(
          enabled ? 'Read Receipts enabled' : 'Read Receipts disabled',
          enabled
            ? 'Others can now see when you read messages.'
            : 'Others will no longer see blue ticks when you read messages.'
        );
      } catch {
        setPrivacySettings((prev) => {
          const reverted = { ...prev, readReceiptsEnabled: previousEnabled };
          savePrivacySettings(uid, reverted);
          return reverted;
        });
        setUserPrivate((prev) => (prev ? { ...prev, readReceiptsEnabled: previousEnabled } : prev));
        pushToast('Could not save Read Receipts setting', 'Please check your connection and try again.');
      } finally {
        setSavingReadReceipts(false);
      }
    },
    [privacySettings.readReceiptsEnabled, pushToast]
  );
  const handleRequestToggleLockedVault = useCallback(() => {
    if (lockedVaultUnlocked) {
      setLockedVaultUnlocked(false);
      pushToast('Locked chats hidden', 'Your locked chats are hidden again.');
      return;
    }
    if (privacySettings.pinHash) {
      setPinVaultPromptOpen(true);
    } else {
      setLockedVaultUnlocked(true);
    }
  }, [lockedVaultUnlocked, privacySettings.pinHash, pushToast]);
  const handleStartCallCheck = useCallback((mode: CallMode) => {
    void startSelfTestCallRef.current(mode);
  }, []);
  const handleSelectRightTab = useCallback((tab: RightPanelTab) => {
    setRightPanelTab(tab);
    setRightPanelOpen(true);
  }, []);
  const handleToggleRightPanel = useCallback(() => setRightPanelOpen((v) => !v), []);
  const handleOpenInviteModal = useCallback(() => setInviteOpen(true), []);
  const handleOpenCallHub = useCallback((mode: CallMode) => setCallHubMode(mode), []);
  const handleChangeRoomNotificationPref = useCallback(
    (pref: NotificationPref) => {
      const currentRoom = activeRoomRef.current;
      const currentProfile = profileRef.current;
      const currentPrivate = userPrivateRef.current;
      if (!currentRoom || !currentProfile || !currentPrivate) return;
      const nextPrefs = { ...currentPrivate.roomNotificationPrefs, [currentRoom.id]: pref };
      const nextMuted =
        pref === 'mute'
          ? Array.from(new Set([...currentPrivate.mutedRoomIds, currentRoom.id]))
          : currentPrivate.mutedRoomIds.filter((id) => id !== currentRoom.id);
      void updateUserPrivateSettings(currentProfile.uid, {
        roomNotificationPrefs: nextPrefs,
        mutedRoomIds: nextMuted,
      });
      pushToast(
        'Notification preference saved',
        pref === 'mute'
          ? `${currentRoom.name} is now muted.`
          : `Alerts set to ${pref === 'all' ? 'all messages' : 'mentions & replies'}.`
      );
    },
    [pushToast]
  );

  // Stabilized MessageList & MessageItem handlers (prevents list re-renders on typing/presence/toast updates)
  const handleOpenPinned = useCallback(() => {
    setRightPanelTab('pinned');
    setRightPanelOpen(true);
  }, []);
  const handleQuickPrompt = useCallback((txt: string) => {
    void handleSendRoomMessageRef.current('text', { text: txt });
  }, []);
  const handleReplyMessage = useCallback((msg: Message) => setReplyTo(msg), []);
  const handleOpenThread = useCallback((msg: Message) => {
    setActiveThreadRootId(msg.id);
    setRightPanelTab('thread');
    setRightPanelOpen(true);
  }, []);
  const roomMessagesRef = useRef<Message[]>(roomMessages);
  roomMessagesRef.current = roomMessages;

  const handleEditMessage = useCallback((msg: Message) => setEditingMessage(msg), []);
  const handleDeleteMessage = useCallback(
    (msg: Message, isModAction: boolean) => {
      const currentRoom = activeRoomRef.current;
      const currentProfile = profileRef.current;
      if (!currentRoom || !currentProfile) return;
      const mainMsgs = roomMessagesRef.current.filter((m) => !m.threadRootId);
      const isLatestMessage = mainMsgs.length > 0 && mainMsgs[mainMsgs.length - 1].id === msg.id;
      void softDeleteMessage(currentRoom.id, msg.id, currentProfile, isModAction, {
        isLatestMessage,
      }).then(() => {
        pushToast(
          'Deleted for everyone',
          'This message was removed for all members in this chat.'
        );
      });
    },
    [pushToast]
  );

  const handleDeleteMessageForMe = useCallback(
    (msg: Message) => {
      const currentProfile = profileRef.current;
      if (!currentProfile) return;
      setDeletedForMeIds((prev) => {
        const next = new Set(prev);
        next.add(msg.id);
        try {
          localStorage.setItem(
            `quadline_deleted_for_me_${currentProfile.uid}`,
            JSON.stringify(Array.from(next).slice(-400))
          );
        } catch {
          // Ignore storage failures
        }
        return next;
      });
      pushToast('Hidden on your screen', 'Message deleted for you.');
    },
    [pushToast]
  );

  const handleSelectChatTheme = useCallback(
    async (chatThemeId: ChatThemeId) => {
      const currentRoom = activeRoomRef.current;
      const currentProfile = profileRef.current;
      if (!currentRoom || !currentProfile) return;
      const optimisticRecord: RoomChatThemeRecord = {
        roomId: currentRoom.id,
        chatThemeId,
        updatedBy: currentProfile.uid,
        updatedByName: currentProfile.displayName,
        updatedAt: Date.now(),
      };
      setRoomThemes((prev) => ({ ...prev, [currentRoom.id]: optimisticRecord }));
      const themeMeta = getChatThemeById(chatThemeId);
      pushToast('Chat theme applied', `${themeMeta.name} is now live in this chat.`);
      const saved = await saveRoomChatTheme({
        roomId: currentRoom.id,
        chatThemeId,
        updatedBy: currentProfile.uid,
        updatedByName: currentProfile.displayName,
      });
      if (saved) {
        setRoomThemes((prev) => ({ ...prev, [currentRoom.id]: saved }));
      }
    },
    [pushToast]
  );

  const handleOpenActorProfile = useCallback(
    (actor: { uid: string; displayName: string; handle: string; photoUrl: string }) => {
      const existing = profilesByUid[actor.uid];
      if (existing) {
        setViewingProfile(existing);
        return;
      }
      setViewingProfile({
        uid: actor.uid,
        displayName: actor.displayName || 'Quadline User',
        handle: actor.handle || 'member',
        photoUrl: actor.photoUrl || '',
        bio: '',
        majorOrClub: '',
        status: 'offline',
        statusMessage: '',
        discoverable: true,
        lastSeenAt: null,
        createdAt: null,
        updatedAt: null,
      });
    },
    [profilesByUid]
  );
  const handleTogglePinMessage = useCallback((msg: Message) => {
    const currentRoom = activeRoomRef.current;
    const currentProfile = profileRef.current;
    if (!currentRoom || !currentProfile) return;
    void togglePinMessage(currentRoom.id, msg, currentProfile);
  }, []);
  const handleToggleReactionMessage = useCallback((msg: Message, emoji: string) => {
    const currentRoom = activeRoomRef.current;
    const currentProfile = profileRef.current;
    if (!currentRoom || !currentProfile) return;
    void toggleReaction(currentRoom.id, msg, emoji, currentProfile.uid);
  }, []);
  const handleVotePollMessage = useCallback((msg: Message, optId: string) => {
    const currentRoom = activeRoomRef.current;
    const currentProfile = profileRef.current;
    if (!currentRoom || !currentProfile) return;
    void voteOnPoll(currentRoom.id, msg, optId, currentProfile.uid);
  }, []);
  const handleRsvpEventMessage = useCallback((evt: RoomEvent, choice: 'going' | 'maybe' | 'none') => {
    const currentRoom = activeRoomRef.current;
    const currentProfile = profileRef.current;
    if (!currentRoom || !currentProfile) return;
    void updateEventRsvp(currentRoom.id, evt, currentProfile.uid, choice);
  }, []);
  const handleReportMessage = useCallback((msg: Message) => {
    setReportTarget({
      targetUserId: msg.authorId,
      targetUserName: msg.authorName,
      targetMessageId: msg.id,
      targetSnippet: msg.text || msg.mediaName || 'Attachment',
    });
  }, []);
  const handlePreviewImage = useCallback(
    (url: string, caption?: string, fileName?: string, fallbackUrl?: string) => {
      setLightboxZoomed(false);
      setLightboxImage({ url, caption: caption || '', fileName, fallbackUrl, usedFallback: false });
    },
    []
  );
  const handleStableDirectMessageByAuthor = useCallback(
    (authorId: string, authorName: string, authorPhoto: string) => {
      handleDirectMessageByAuthorRef.current(authorId, authorName, authorPhoto);
    },
    []
  );

  // Loading auth state
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] dark:bg-[#0D1117]">
        <div className="text-center space-y-3">
          <img
            src="/app-logo.png"
            alt="Quadline app logo"
            className="w-14 h-14 rounded-2xl mx-auto shadow-sm object-cover"
          />
          <div className="space-y-1">
            <p className="font-display text-lg font-bold text-stone-900 dark:text-white">Quadline</p>
            <p className="text-xs text-stone-500 dark:text-slate-400">Connecting to campus workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  // Signed out state
  if (!firebaseUser) {
    return (
      <AuthScreen
        darkMode={darkMode}
        themeId={themeId}
        onSelectTheme={handleSelectThemeId}
        onToggleTheme={handleToggleTheme}
        pendingInviteCode={pendingInviteCode}
      />
    );
  }

  // Unverified email/password sign-up gate
  if (!firebaseUser.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] dark:bg-[#0D1117] p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
            <MailCheck className="w-5 h-5" />
            <h1 className="font-display text-lg font-bold text-stone-900 dark:text-white">
              Verify your campus email
            </h1>
          </div>
          <p className="text-sm text-stone-600 dark:text-slate-400 leading-relaxed">
            We sent a verification link to <strong>{firebaseUser.email}</strong>. Click the link in your inbox, then refresh to enter Quadline.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                await sendEmailVerification(firebaseUser);
                pushToast('Verification sent', 'Check your inbox for the confirmation link.');
              }}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
            >
              Resend Email
            </button>
            <button
              type="button"
              disabled={checkingVerification}
              onClick={async () => {
                setCheckingVerification(true);
                try {
                  await firebaseUser.reload();
                  if (auth.currentUser?.emailVerified) {
                    setFirebaseUser({ ...auth.currentUser } as User);
                    window.location.reload();
                  } else {
                    pushToast(
                      'Not verified yet',
                      'Click the verification link in your campus inbox, then try again.'
                    );
                  }
                } finally {
                  setCheckingVerification(false);
                }
              }}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-stone-100 dark:bg-slate-800 text-stone-800 dark:text-slate-200 disabled:opacity-50 cursor-pointer"
            >
              {checkingVerification ? 'Checking...' : 'I Verified It'}
            </button>
            <button
              type="button"
              onClick={() => void signOut(auth)}
              className="ml-auto text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Profile bootstrapping state
  if (!profile || !userPrivate || bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5] dark:bg-[#0D1117]">
        <div className="text-center space-y-3">
          <img
            src="/app-logo.png"
            alt="Quadline app logo"
            className="w-14 h-14 rounded-2xl mx-auto shadow-sm object-cover"
          />
          <div className="space-y-1">
            <p className="font-display text-lg font-bold text-stone-900 dark:text-white">Quadline</p>
            <p className="text-xs text-stone-500 dark:text-slate-400">Preparing your campus rooms...</p>
          </div>
        </div>
      </div>
    );
  }

  const hasOpenChat = Boolean(activeRoom);
  const isReelsView = sidebarTab === 'reels' && !hasOpenChat;

  return (
    <div className="h-[100dvh] w-full overflow-hidden flex bg-white dark:bg-[#0D1117] text-stone-900 dark:text-slate-100">
      {/* Left Sidebar (WhatsApp Home Chat List — hidden when any chat is opened; desktop stays docked during Reels) */}
      <div className={isReelsView ? 'hidden lg:flex h-full shrink-0' : 'contents'}>
        <Sidebar
          profile={profile}
          userPrivate={userPrivate}
          joinedRooms={joinedRooms}
          dmRooms={friendDmRooms}
          friendProfiles={friendProfiles}
          incomingFriendRequests={socialGraph.incomingRequests}
          profilesByUid={profilesByUid}
          presenceMap={presenceMap}
          typingByRoom={typingByRoom}
          callHistory={callHistory}
          activeRoomId={activeRoomId}
          activeTab={sidebarTab}
          unreadNotificationsCount={unreadNotificationsCount}
          darkMode={darkMode}
          chatOpen={hasOpenChat}
          mobileOpen={mobileSidebarOpen}
          hideMessagePreviews={privacySettings.hideMessagePreviews}
          lockedRoomIds={privacySettings.lockedRoomIds}
          lockedVaultUnlocked={lockedVaultUnlocked}
          onRequestToggleLockedVault={handleRequestToggleLockedVault}
          onOpenPrivacy={handleOpenPrivacy}
          onChangeTab={handleChangeSidebarTab}
          onCloseMobile={handleCloseMobileSidebar}
          onSelectRoom={handleSelectRoom}
          onStartDM={handleSidebarStartDM}
          onAcceptFriendRequest={(otherUid) => void handleAcceptFriendRequest(otherUid)}
          onDeclineFriendRequest={(otherUid) => void handleDeclineFriendRequest(otherUid)}
          onOpenDiscover={handleOpenDiscover}
          onOpenCreateRoom={handleOpenCreateRoom}
          onOpenJoinByCode={handleOpenJoinByCode}
          onOpenNewDM={handleOpenNewDM}
          onOpenProfileModal={handleOpenProfileModal}
          onOpenNotifications={handleOpenNotifications}
          onOpenQuickSwitcher={handleOpenQuickSwitcher}
          onOpenShortcuts={handleOpenShortcuts}
          onOpenThemes={handleOpenThemes}
          onToggleTheme={handleToggleTheme}
          onChangeStatus={handleChangeStatus}
          onStartCall={handleStartCallWithProfile}
          onStartCallCheck={handleStartCallCheck}
          onDeleteCallLog={handleDeleteCallLog}
          onQuickRandomProfile={() => void handleQuickRandomProfile()}
          storyGroups={storyGroups}
          onOpenCreateStory={() => setCreateStoryOpen(true)}
          onOpenStoryGroup={(authorUid) => setActiveStoryAuthorUid(authorUid)}
          onViewProfile={(target) => setViewingProfile(target)}
          showPhonePushBanner={
            !pushBannerDismissed &&
            pushPermission !== 'granted' &&
            pushPermission !== 'denied' &&
            pushPermission !== 'unsupported'
          }
          phonePushBusy={pushBusy}
          onEnablePhonePush={() => void handleEnablePhonePush()}
          onDismissPhonePushBanner={handleDismissPhonePushBanner}
        />
      </div>

      {/* Center Conversation / Reels Pane */}
      <motion.main
        key={hasOpenChat ? `chat-${activeRoom?.id}` : isReelsView ? 'reels-stage' : 'chats-home-canvas'}
        initial={prefersReducedMotion ? false : hasOpenChat ? { opacity: 0.9, x: 18 } : { opacity: 0.92 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 460, damping: 36 }}
        className={`flex-1 flex-col min-w-0 min-h-0 gpu-layer ${hasOpenChat || isReelsView ? 'flex' : 'hidden lg:flex'}`}
      >
        {isReelsView ? (
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center bg-[#090B0E] text-white text-xs">
                Loading Reels…
              </div>
            }
          >
            <ReelsFeed
              profile={profile}
              rooms={shareableRooms}
              initialReelId={initialReelId}
              initialCreateForRoomId={initialCreateReelForRoomId}
              onClearInitialIntent={handleClearInitialReelIntent}
              onCloseMobile={() => setSidebarTab('chats')}
              onShareReelToRoom={handleShareReelToRoom}
              onNotice={pushToast}
            />
          </Suspense>
        ) : activeRoom && isMemberOfActiveRoom ? (
          <>
            <RoomHeader
              room={activeRoom}
              dmPeer={activeDmPeer}
              memberCount={roomMembers.length || activeRoom.memberCount}
              onlineCount={activeRoomOnlineCount}
              currentRole={currentRole}
              notificationPref={activeRoomNotificationPref}
              pinnedCount={pinnedMessages.length}
              pendingModCount={pendingModCount}
              rightPanelOpen={rightPanelOpen}
              rightPanelTab={rightPanelTab}
              otherChatsBadgeCount={otherChatsBadgeCount}
              isEncryptedChat={isRoomEncryptionEnabled(activeRoom.id, privacySettings)}
              isLockedChat={privacySettings.lockedRoomIds.includes(activeRoom.id)}
              activeChatTheme={activeChatTheme}
              typingUsers={activeTypingUsers}
              onBackToChats={handleBackToChats}
              onOpenMobileSidebar={handleOpenMobileSidebar}
              onSelectRightTab={handleSelectRightTab}
              onToggleRightPanel={handleToggleRightPanel}
              onOpenInviteModal={handleOpenInviteModal}
              onEditGroupName={activeRoom.visibility !== 'dm' ? handleOpenEditGroup : undefined}
              onOpenThemes={handleOpenThemes}
              onOpenPrivacy={handleOpenPrivacy}
              onStartCall={handleStartCallWithProfile}
              onOpenCallHub={handleOpenCallHub}
              onChangeNotificationPref={handleChangeRoomNotificationPref}
            />

            <MessageList
              room={activeRoom}
              messages={roomMessages}
              eventsById={eventsById}
              loading={messagesLoading}
              currentUid={profile.uid}
              currentRole={currentRole}
              blockedUserIds={userPrivate.blockedUserIds}
              pinnedMessages={pinnedMessages}
              wallpaperId={wallpaperId}
              chatTheme={activeChatTheme}
              chatThemeUpdatedBy={activeRoomThemeRecord?.updatedByName}
              deletedForMeIds={deletedForMeIds}
              isEncryptedChat={isRoomEncryptionEnabled(activeRoom.id, privacySettings)}
              onOpenPrivacy={handleOpenPrivacy}
              onOpenChatTheme={handleOpenThemes}
              onOpenPinned={handleOpenPinned}
              onQuickPrompt={handleQuickPrompt}
              onReply={handleReplyMessage}
              onOpenThread={handleOpenThread}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onDeleteForMe={handleDeleteMessageForMe}
              onTogglePin={handleTogglePinMessage}
              onToggleReaction={handleToggleReactionMessage}
              onVotePoll={handleVotePollMessage}
              onRsvpEvent={handleRsvpEventMessage}
              onReport={handleReportMessage}
              onPreviewImage={handlePreviewImage}
              onOpenReelFromChat={handleOpenReelFromChat}
              onDirectMessageAuthor={
                activeRoom.visibility !== 'dm' ? handleStableDirectMessageByAuthor : undefined
              }
            />

            {activeRoom.visibility === 'dm' && activeDmPeer && !friendUidSet.has(activeDmPeer.uid) ? (
              <div className="shrink-0 px-4 py-3.5 border-t border-stone-200 dark:border-slate-800 bg-white dark:bg-[#161B22] pb-[max(0.875rem,env(safe-area-inset-bottom))]">
                <div className="max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/25 px-4 py-3">
                  <div className="flex items-center gap-2.5 text-center sm:text-left">
                    <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 hidden sm:block" />
                    <div>
                      <p className="text-xs font-semibold text-stone-900 dark:text-white">
                        Friend / Follow Request Required to Chat
                      </p>
                      <p className="text-[11px] text-stone-600 dark:text-slate-400">
                        {incomingRequestUidSet.has(activeDmPeer.uid)
                          ? `${activeDmPeer.displayName} sent you a request. Accept it to message and call.`
                          : outgoingRequestUidSet.has(activeDmPeer.uid)
                            ? `Waiting for ${activeDmPeer.displayName} to accept your Friend Request.`
                            : `Send and accept a Friend Request with ${activeDmPeer.displayName} to continue talking 1-to-1.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {incomingRequestUidSet.has(activeDmPeer.uid) ? (
                      <button
                        type="button"
                        onClick={() => void handleAcceptFriendRequest(activeDmPeer.uid)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Accept Request</span>
                      </button>
                    ) : outgoingRequestUidSet.has(activeDmPeer.uid) ? (
                      <button
                        type="button"
                        onClick={() => void handleRemoveFriendRelation(activeDmPeer.uid)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-stone-200 dark:bg-slate-800 text-stone-700 dark:text-slate-200 hover:bg-stone-300 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Requested · Cancel</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSendFriendRequest(activeDmPeer)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-accent text-white cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Send Friend Request</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <MessageComposer
                roomId={activeRoom.id}
                roomName={activeRoom.visibility === 'dm' ? activeDmPeer?.displayName || activeRoom.name : activeRoom.name}
                currentUid={profile.uid}
                members={roomMembers}
                typingUsers={activeTypingUsers}
                replyTo={replyTo}
                editingMessage={editingMessage}
                isGroupRoom={activeRoom.visibility !== 'dm'}
                onCancelReply={() => setReplyTo(null)}
                onCancelEdit={() => setEditingMessage(null)}
                onEditLastOwnMessage={() => {
                  const lastOwn = [...roomMessages]
                    .reverse()
                    .find((m) => m.authorId === profile.uid && !m.deleted && m.kind === 'text' && !m.threadRootId);
                  if (lastOwn) setEditingMessage(lastOwn);
                }}
                onTypingStart={(activity) => {
                  if (privacySettings.typingIndicatorsEnabled) {
                    startTyping(activeRoom.id, activity);
                  }
                }}
                onTypingStop={() => stopTyping(activeRoom.id)}
                onSendText={(text, mentionedUids) => handleSendRoomMessage('text', { text, mentionedUids })}
                onSaveEdit={async (messageId, text, mentionedUids) => {
                  const encrypted = isRoomEncryptionEnabled(activeRoom.id, privacySettings);
                  const nextText = encrypted
                    ? await encryptChatText(activeRoom.id, text)
                    : text;
                  const mainMsgs = roomMessages.filter((m) => !m.threadRootId);
                  const isLatestMessage =
                    mainMsgs.length > 0 && mainMsgs[mainMsgs.length - 1].id === messageId;
                  await editMessage(activeRoom.id, messageId, nextText, mentionedUids, {
                    isLatestMessage,
                    previewText: encrypted ? '🔒 Encrypted message (edited)' : text,
                  });
                  pushToast('Message updated', 'Your edit is now live for everyone.');
                }}
                onSendImage={(photo) =>
                  handleSendRoomMessage('image', {
                    text: photo.caption,
                    mediaUrl: photo.mediaUrl,
                    thumbnailUrl: photo.thumbnailUrl,
                    mediaName: photo.fileName,
                    mediaMime: photo.mimeType,
                    mediaSize: photo.size,
                  })
                }
                onSendFile={(file) =>
                  handleSendRoomMessage('file', {
                    text: '',
                    mediaUrl: file.mediaUrl,
                    mediaName: file.fileName,
                    mediaMime: file.mimeType,
                    mediaSize: file.size,
                  })
                }
                onSendVoice={(voice) =>
                  handleSendRoomMessage('voice', {
                    text: '',
                    mediaUrl: voice.mediaUrl,
                    mediaName: voice.fileName,
                    mediaMime: voice.mimeType,
                    mediaSize: voice.size,
                    voiceDurationSec: voice.durationSec,
                    voiceEffect: voice.voiceEffect,
                    waveform: voice.waveform,
                  })
                }
                onOpenPollModal={() => setPollModalOpen(true)}
                onOpenEventModal={activeRoom.visibility !== 'dm' ? () => setEventModalOpen(true) : undefined}
                onOpenSongsModal={() => setSongsReelsModalTab('songs')}
                onOpenReelsModal={() => setSongsReelsModalTab('reels')}
              />
            )}
          </>
        ) : (
          /* Effortless Room Preview or Quick-Join Campus Lounge */
          <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#F7F7F5] dark:bg-[#0D1117]">
            {activeRoom && !isMemberOfActiveRoom && (
              <header className="h-14 px-3 sm:px-5 border-b border-stone-200 dark:border-slate-800 bg-white dark:bg-[#161B22] flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={handleBackToChats}
                  className="inline-flex items-center gap-2 min-h-[40px] px-2 -ml-1 rounded-xl text-sm font-semibold text-stone-900 dark:text-white hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>All Chats</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCallHubMode('audio')}
                    aria-label="Start voice call"
                    className="p-2 rounded-lg bg-accent-soft text-accent-soft cursor-pointer"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCallHubMode('video')}
                    aria-label="Start video call"
                    className="p-2 rounded-lg bg-accent text-white cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              </header>
            )}

            <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
              {activeRoom && !isMemberOfActiveRoom ? (
                <div className="max-w-lg w-full rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-[#161B22] overflow-hidden">
                  {activeRoom.coverImage && (
                    <img
                      src={activeRoom.coverImage}
                      alt={activeRoom.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-44 object-cover"
                    />
                  )}
                  <div className="p-6 space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-xs text-stone-500 dark:text-slate-400 capitalize">
                        {activeRoom.category === 'topic' ? 'Interest' : activeRoom.category} ·{' '}
                        {activeRoom.visibility === 'private' ? 'Private Room' : 'Public Room'} ·{' '}
                        <span className="tabular-nums">{activeRoom.memberCount}</span>{' '}
                        {activeRoom.memberCount === 1 ? 'member' : 'members'}
                      </p>
                      <h1 className="font-display text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                        {activeRoom.visibility === 'private' ? (
                          <Lock className="w-5 h-5 text-stone-400 shrink-0" />
                        ) : (
                          <Hash className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        )}
                        <span>{activeRoom.name}</span>
                      </h1>
                      <p className="text-sm text-stone-600 dark:text-slate-400 leading-relaxed">
                        {activeRoom.description || 'Join this campus room to view messages and chat live.'}
                      </p>
                    </div>

                    {activeRoom.visibility === 'public' ? (
                      <div className="flex items-center gap-2.5 flex-wrap pt-1">
                        <button
                          type="button"
                          disabled={joiningRoomId === activeRoom.id}
                          onClick={async () => {
                            setJoiningRoomId(activeRoom.id);
                            try {
                              await joinPublicRoom(activeRoom, profile);
                              pushToast(`Joined #${activeRoom.slug}`, 'Say hello to the room!');
                            } finally {
                              setJoiningRoomId(null);
                            }
                          }}
                          className="px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white transition-colors cursor-pointer"
                        >
                          {joiningRoomId === activeRoom.id
                            ? 'Joining...'
                            : `Join #${activeRoom.slug} & Start Chatting`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscoverOpen(true)}
                          className="px-4 py-2.5 rounded-xl text-xs font-medium text-stone-700 dark:text-slate-200 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          Browse Other Rooms
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-1">
                        <input
                          type="text"
                          value={inlineJoinNote}
                          onChange={(e) => setInlineJoinNote(e.target.value)}
                          placeholder="Optional note for room moderators (e.g., club member, class section)"
                          className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-stone-50 dark:bg-slate-900 border border-stone-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <button
                            type="button"
                            disabled={joiningRoomId === activeRoom.id}
                            onClick={async () => {
                              setJoiningRoomId(activeRoom.id);
                              try {
                                await requestToJoinRoom(activeRoom, profile, inlineJoinNote);
                                setInlineJoinNote('');
                                pushToast(
                                  'Join request sent',
                                  `Moderators of ${activeRoom.name} have been notified.`
                                );
                              } finally {
                                setJoiningRoomId(null);
                              }
                            }}
                            className="px-4 py-2.5 rounded-xl text-xs font-medium bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white cursor-pointer"
                          >
                            {joiningRoomId === activeRoom.id ? 'Sending...' : 'Request Access'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setJoinCodeOpen(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-200 hover:bg-stone-50 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Have an Invite Code?</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl w-full space-y-6">
                  <div className="text-center space-y-3">
                    <img
                      src="/app-logo.png"
                      alt="Quadline app logo"
                      className="w-16 h-16 rounded-2xl mx-auto shadow-md object-cover"
                    />
                    <div className="space-y-2">
                      <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white text-balance">
                        {allAccessibleRooms.length > 0
                          ? 'Select a chat to start talking'
                          : 'Find your first campus room'}
                      </h1>
                      <p className="text-sm text-stone-500 dark:text-slate-400 max-w-md mx-auto">
                        {allAccessibleRooms.length > 0
                          ? 'Open any group or direct message on the left — the rest of your chats automatically hide so you can focus.'
                          : 'Join an open club, class, or interest room in one click to jump straight into the conversation.'}
                      </p>
                    </div>
                  </div>

                  {discoverableRooms.filter((r) => r.visibility === 'public' && !joinedRoomIds.has(r.id)).length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {discoverableRooms
                        .filter((r) => r.visibility === 'public' && !joinedRoomIds.has(r.id))
                        .slice(0, 4)
                        .map((room) => (
                          <div
                            key={room.id}
                            className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-[#161B22] overflow-hidden flex flex-col"
                          >
                            {room.coverImage && (
                              <img
                                src={room.coverImage}
                                alt={room.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-24 object-cover"
                              />
                            )}
                            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-[11px] text-stone-500 dark:text-slate-400 capitalize">
                                  {room.category === 'topic' ? 'Interest' : room.category} ·{' '}
                                  <span className="tabular-nums">{room.memberCount}</span>{' '}
                                  {room.memberCount === 1 ? 'member' : 'members'}
                                </p>
                                <h2 className="font-display text-sm font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                                  <Hash className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                                  <span className="truncate">{room.name}</span>
                                </h2>
                                <p className="text-xs text-stone-600 dark:text-slate-400 line-clamp-2">
                                  {room.description}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={joiningRoomId === room.id}
                                onClick={async () => {
                                  setJoiningRoomId(room.id);
                                  try {
                                    await joinPublicRoom(room, profile);
                                    setActiveRoomId(room.id);
                                    pushToast(`Joined #${room.slug}`, 'Say hello to the room!');
                                  } finally {
                                    setJoiningRoomId(null);
                                  }
                                }}
                                className="w-full py-2 rounded-lg text-xs font-medium bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white transition-colors cursor-pointer"
                              >
                                {joiningRoomId === room.id ? 'Joining...' : 'Join & Say Hello'}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2.5 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={() => setDiscoverOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-accent text-white cursor-pointer"
                    >
                      <Compass className="w-4 h-4" />
                      <span>Browse All Rooms</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateRoomOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-800 text-stone-800 dark:text-slate-200 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Room</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setJoinCodeOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-800 text-stone-700 dark:text-slate-300 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Use Invite Code</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.main>

      {/* Contextual Right Panel */}
      {activeRoom && isMemberOfActiveRoom && (
        <RightPanel
          open={rightPanelOpen}
          tab={rightPanelTab}
          room={activeRoom}
          currentProfile={profile}
          currentRole={currentRole}
          members={roomMembers}
          profilesByUid={profilesByUid}
          presenceMap={presenceMap}
          messages={roomMessages}
          events={roomEvents}
          joinRequests={roomJoinRequests}
          reports={roomReports}
          activities={roomActivities}
          blockedUserIds={userPrivate.blockedUserIds}
          activeThreadRoot={activeThreadRoot}
          friendUids={friendUidSet}
          incomingRequestUids={incomingRequestUidSet}
          outgoingRequestUids={outgoingRequestUidSet}
          onClose={() => setRightPanelOpen(false)}
          onSelectTab={(tab) => setRightPanelTab(tab)}
          onStartDM={(target) => void handleStartDM(target)}
          onStartCall={handleStartCallWithProfile}
          onViewProfile={(target) => setViewingProfile(target)}
          onSendFriendRequest={(target) => void handleSendFriendRequest(target)}
          onAcceptFriendRequest={(otherUid) => void handleAcceptFriendRequest(otherUid)}
          onRemoveFriendRelation={(otherUid) => void handleRemoveFriendRelation(otherUid)}
          onPromoteOrDemote={(member, newRole) => {
            void updateMemberRole({
              room: activeRoom,
              targetUid: member.uid,
              targetName: member.displayName,
              newRole,
              actor: profile,
            });
            pushToast('Role updated', `${member.displayName} is now a ${newRole}.`);
          }}
          onRemoveMember={(member) => {
            void removeRoomMember({
              roomId: activeRoom.id,
              targetUid: member.uid,
              targetName: member.displayName,
              actor: profile,
            });
            pushToast('Member removed', `${member.displayName} was removed from ${activeRoom.name}.`);
          }}
          onLeaveRoom={async () => {
            const leftId = activeRoom.id;
            const leftName = activeRoom.name;
            await leaveRoom(leftId, profile.uid);
            handleBackToChats();
            pushToast('Left room', `You left ${leftName}.`);
          }}
          onToggleBlockUser={(targetUid) => {
            const exists = userPrivate.blockedUserIds.includes(targetUid);
            const next = exists
              ? userPrivate.blockedUserIds.filter((id) => id !== targetUid)
              : [...userPrivate.blockedUserIds, targetUid];
            void updateUserPrivateSettings(profile.uid, { blockedUserIds: next });
            pushToast(exists ? 'User unblocked' : 'User blocked');
          }}
          onReportMember={(member) =>
            setReportTarget({
              targetUserId: member.uid,
              targetUserName: member.displayName,
            })
          }
          onOpenCreateEvent={() => setEventModalOpen(true)}
          onRsvpEvent={(evt, choice) => void updateEventRsvp(activeRoom.id, evt, profile.uid, choice)}
          onUnpinMessage={(msg) => void togglePinMessage(activeRoom.id, msg, profile)}
          onJumpToMessage={handleJumpToMessage}
          onReviewJoinRequest={async (req, decision) => {
            await reviewJoinRequest({
              room: activeRoom,
              request: req,
              decision,
              reviewer: profile,
            });
            pushToast(
              decision === 'approved' ? 'Member approved' : 'Request declined',
              `${req.displayName}'s request was ${decision}.`
            );
          }}
          onResolveReport={async (reportId, decision) => {
            await resolveReport({
              roomId: activeRoom.id,
              reportId,
              decision,
              actor: profile,
            });
            pushToast('Report updated', `Marked as ${decision}.`);
          }}
          onSendThreadReply={async (root, text, mentionedUids) => {
            const isBroadcastMention =
              activeRoom.visibility !== 'dm' && hasGroupBroadcastMention(text);
            const notifyAllMemberUids = isBroadcastMention
              ? roomMembers.map((m) => m.uid).filter((id) => id !== profile.uid)
              : undefined;
            const useE2EE = isRoomEncryptionEnabled(activeRoom.id, privacySettings);
            const outgoingText = useE2EE ? await encryptChatText(activeRoom.id, text) : text;
            await sendMessage({
              roomId: activeRoom.id,
              roomName: activeRoom.name,
              author: profile,
              kind: 'text',
              text: outgoingText,
              threadRootId: root.id,
              mentionedUids,
              notifyAllMemberUids,
              isBroadcastMention,
              replyTo: {
                id: root.id,
                authorName: root.authorName,
                authorId: root.authorId,
                snippet: useE2EE ? 'Encrypted message' : root.text || 'thread',
              },
              onNotifyPing: (recipientId, title, body) =>
                sendNotifyPing(recipientId, activeRoom.id, title, body),
            });
            if (isBroadcastMention && notifyAllMemberUids && notifyAllMemberUids.length > 0) {
              pushToast(
                'Notified everyone in group',
                `Alerted ${notifyAllMemberUids.length} ${
                  notifyAllMemberUids.length === 1 ? 'member' : 'members'
                } in ${activeRoom.name}.`
              );
            }
          }}
          onToggleReaction={(msg, emoji) => void toggleReaction(activeRoom.id, msg, emoji, profile.uid)}
          onDeleteMessage={(msg, isModAction) => void softDeleteMessage(activeRoom.id, msg.id, profile, isModAction)}
          onReportMessage={(msg) =>
            setReportTarget({
              targetUserId: msg.authorId,
              targetUserName: msg.authorName,
              targetMessageId: msg.id,
              targetSnippet: msg.text || msg.mediaName,
            })
          }
          onPreviewImage={(url, caption, fileName, fallbackUrl) => {
            setLightboxZoomed(false);
            setLightboxImage({ url, caption, fileName, fallbackUrl, usedFallback: false });
          }}
        />
      )}

      {/* MODALS */}
      {discoverOpen && (
        <DiscoverRoomsModal
          rooms={discoverableRooms}
          joinedRoomIds={joinedRoomIds}
          onClose={() => setDiscoverOpen(false)}
          onJoinPublic={async (room) => {
            await joinPublicRoom(room, profile);
            setActiveRoomId(room.id);
            pushToast(`Joined #${room.slug}`, 'Say hello to the room!');
          }}
          onOpenRoom={(roomId) => setActiveRoomId(roomId)}
          onRequestPrivate={async (room, note) => {
            await requestToJoinRoom(room, profile, note);
          }}
          onCreateRoom={() => setCreateRoomOpen(true)}
        />
      )}

      {createRoomOpen && (
        <CreateRoomModal
          onClose={() => setCreateRoomOpen(false)}
          onSubmit={async (data) => {
            const newId = await createRoom({ ...data, creator: profile });
            setActiveRoomId(newId);
            pushToast(`Created ${data.name}`, 'Invite classmates or send the first message.');
          }}
        />
      )}

      {editGroupOpen && activeRoom && activeRoom.visibility !== 'dm' && (
        <EditGroupModal
          room={activeRoom}
          onClose={() => setEditGroupOpen(false)}
          onSave={async (updates) => {
            await updateRoomMetadata(activeRoom.id, updates);
            pushToast('Group updated', `Renamed to ${updates.name}`);
          }}
        />
      )}

      {joinCodeOpen && (
        <JoinByCodeModal
          onClose={() => setJoinCodeOpen(false)}
          onJoinCode={async (code) => {
            const room = await joinPrivateRoomWithCode(code, profile);
            setActiveRoomId(room.id);
            pushToast(`Joined ${room.name}`, `Invite code ${code} accepted.`);
          }}
          onJoinRoomLink={async (roomId) => {
            const result = await joinRoomById(roomId, profile);
            if (result.outcome === 'requested') {
              pushToast(
                `Join request sent to ${result.room.name}`,
                'A group moderator will approve your access.'
              );
            } else {
              setActiveRoomId(result.room.id);
              pushToast(
                result.outcome === 'already_member'
                  ? `Opened ${result.room.name}`
                  : `Joined ${result.room.name}`,
                result.outcome === 'already_member'
                  ? 'You are already in this group.'
                  : 'Welcome to the group!'
              );
            }
          }}
        />
      )}

      {inviteOpen && activeRoom && (
        <InviteMembersModal
          room={activeRoom}
          canGenerate={isActiveRoomMod}
          invites={myInvites.filter((i) => i.roomId === activeRoom.id)}
          onClose={() => setInviteOpen(false)}
          onGenerateCode={async () => {
            const inv = await createInviteCode(activeRoom, profile);
            pushToast('Invite code created', inv.code);
          }}
          onRevokeCode={async (code) => {
            await revokeInviteCode(code);
            pushToast('Invite revoked', code);
          }}
        />
      )}

      {newDmOpen && (
        <NewDirectMessageModal
          profiles={allProfiles}
          friendProfiles={friendProfiles}
          incomingRequests={socialGraph.incomingRequests}
          outgoingRequests={socialGraph.outgoingRequests}
          friendUids={friendUidSet}
          incomingRequestUids={incomingRequestUidSet}
          outgoingRequestUids={outgoingRequestUidSet}
          myFollowingUids={myFollowingUids}
          currentUid={profile.uid}
          presenceMap={presenceMap}
          onClose={() => setNewDmOpen(false)}
          onStartDM={handleStartDM}
          onStartCall={handleStartCallWithProfile}
          onViewProfile={(target) => setViewingProfile(target)}
          onToggleFollow={handleToggleFollow}
          onSendFriendRequest={handleSendFriendRequest}
          onAcceptFriendRequest={handleAcceptFriendRequest}
          onDeclineFriendRequest={handleDeclineFriendRequest}
          onRemoveFriendRelation={handleRemoveFriendRelation}
        />
      )}

      {profileModalOpen && (
        <ProfileSettingsModal
          profile={profile}
          userPrivate={userPrivate}
          profilesByUid={profilesByUid}
          pushPermission={pushPermission}
          pushDeviceCount={pushDeviceCount}
          pushBusy={pushBusy}
          iosNeedsHomeScreen={iosNeedsHomeScreen}
          onClose={() => setProfileModalOpen(false)}
          onSaveProfile={async (updates) => {
            await updateUserProfile(profile.uid, updates);
            void registerAccountProfile({
              uid: profile.uid,
              email: firebaseUser?.email || userPrivate.email || '',
              displayName: updates.displayName,
              handle: updates.handle,
              bio: updates.bio,
              photoUrl: updates.photoUrl,
              authMethod: userPrivate.authMethod || 'email',
            });
            pushToast('Profile saved');
          }}
          onTogglePush={handleTogglePhonePush}
          onSendTestPush={handleSendTestPhonePush}
          onUnblockUser={async (uid) => {
            await updateUserPrivateSettings(profile.uid, {
              blockedUserIds: userPrivate.blockedUserIds.filter((id) => id !== uid),
            });
          }}
          onSignOut={async () => {
            await updateUserProfile(profile.uid, { status: 'offline' });
            await signOut(auth);
          }}
        />
      )}

      {/* Instagram-Style User Account Profile Card (Followers, Following, Photo Zoom, Separate Follow vs Chat Request) */}
      {viewingProfile && (
        <UserProfileModal
          targetProfile={profilesByUid[viewingProfile.uid] || viewingProfile}
          currentUid={profile.uid}
          presence={presenceMap[viewingProfile.uid]}
          isFriend={friendUidSet.has(viewingProfile.uid)}
          isIncomingRequest={incomingRequestUidSet.has(viewingProfile.uid)}
          isOutgoingRequest={outgoingRequestUidSet.has(viewingProfile.uid)}
          myFollowingUids={myFollowingUids}
          hasActiveStory={storyGroups.some((g) => g.authorUid === viewingProfile.uid)}
          hasUnseenStory={Boolean(
            storyGroups.find((g) => g.authorUid === viewingProfile.uid)?.hasUnseen
          )}
          onClose={() => setViewingProfile(null)}
          onToggleFollow={handleToggleFollow}
          onSendFriendRequest={handleSendFriendRequest}
          onAcceptFriendRequest={handleAcceptFriendRequest}
          onDeclineFriendRequest={handleDeclineFriendRequest}
          onRemoveFriendRelation={handleRemoveFriendRelation}
          onStartDM={handleStartDM}
          onStartCall={handleStartCallWithProfile}
          onOpenStory={(authorUid) => setActiveStoryAuthorUid(authorUid)}
          onInspectProfile={(nextProfile) =>
            setViewingProfile(profilesByUid[nextProfile.uid] || nextProfile)
          }
          onEditOwnProfile={() => setProfileModalOpen(true)}
        />
      )}

      {/* Create 24-Hour Mutual Story Modal */}
      {createStoryOpen && (
        <CreateStoryModal
          profile={profile}
          onClose={() => setCreateStoryOpen(false)}
          onPublishStory={handlePublishStory}
        />
      )}

      {/* Full-Screen Mutual Story Viewer */}
      {activeStoryAuthorUid && storyGroups.some((g) => g.authorUid === activeStoryAuthorUid) && (
        <StoryViewerModal
          storyGroups={storyGroups}
          initialAuthorUid={activeStoryAuthorUid}
          currentProfile={profile}
          onClose={() => setActiveStoryAuthorUid(null)}
          onMarkViewed={handleMarkStoryViewed}
          onDeleteStory={handleDeleteStory}
          onReplyStory={handleReplyStory}
          onViewProfile={(uid) => {
            const found = profilesByUid[uid] || friendProfiles.find((p) => p.uid === uid);
            if (found) setViewingProfile(found);
          }}
        />
      )}

      {/* First-Time Account Setup Modal (Name, @username, Bio & Separate Profile Pic) */}
      {onboardingProfileOpen && (
        <OnboardingProfileModal
          profile={profile}
          onSkip={() => setOnboardingProfileOpen(false)}
          onSave={async (updates) => {
            await updateUserProfile(profile.uid, updates);
            void registerAccountProfile({
              uid: profile.uid,
              email: firebaseUser?.email || userPrivate.email || '',
              displayName: updates.displayName,
              handle: updates.handle,
              bio: updates.bio,
              photoUrl: updates.photoUrl,
              authMethod: userPrivate.authMethod || 'campus_sso',
            });
            setOnboardingProfileOpen(false);
            pushToast('Account set up!', `Welcome, @${updates.handle}`);
          }}
        />
      )}

      {pollModalOpen && activeRoom && (
        <CreatePollModal
          onClose={() => setPollModalOpen(false)}
          onCreatePoll={async (poll) => {
            await handleSendRoomMessage('poll', { text: poll.question, poll });
          }}
        />
      )}

      {eventModalOpen && activeRoom && (
        <CreateEventModal
          onClose={() => setEventModalOpen(false)}
          onCreateEvent={async (data) => {
            await createRoomEvent({
              roomId: activeRoom.id,
              roomName: activeRoom.name,
              creator: profile,
              ...data,
            });
            pushToast('Event scheduled', data.title);
          }}
        />
      )}

      {reportTarget && activeRoom && (
        <ReportModal
          targetName={reportTarget.targetUserName}
          snippet={reportTarget.targetSnippet}
          onClose={() => setReportTarget(null)}
          onSubmitReport={async (reason) => {
            await submitReport({
              roomId: activeRoom.id,
              reporter: profile,
              targetUserId: reportTarget.targetUserId,
              targetUserName: reportTarget.targetUserName,
              targetMessageId: reportTarget.targetMessageId,
              targetSnippet: reportTarget.targetSnippet,
              reason,
            });
            pushToast('Report submitted', 'Room moderators have been notified.');
          }}
        />
      )}

      {notificationsOpen && (
        <NotificationsModal
          notifications={notifications}
          incomingRequests={socialGraph.incomingRequests}
          socialNotifications={socialNotifications}
          myFollowingUids={myFollowingUids}
          pushEnabled={Boolean(userPrivate.pushEnabled)}
          pushPermission={pushPermission}
          pushDeviceCount={pushDeviceCount}
          pushBusy={pushBusy}
          iosNeedsHomeScreen={iosNeedsHomeScreen}
          onEnablePhonePush={handleEnablePhonePush}
          onSendTestPush={handleSendTestPhonePush}
          onClose={() => setNotificationsOpen(false)}
          onSelectNotification={(item) => void handleSelectNotification(item)}
          onAcceptRequest={(otherUid) => void handleAcceptFriendRequest(otherUid)}
          onDeclineRequest={(otherUid) => void handleDeclineFriendRequest(otherUid)}
          onFollowBack={(actor) => void handleToggleFollow(actor)}
          onViewActorProfile={handleOpenActorProfile}
          onMarkSocialNotificationRead={(id) => {
            if (!profile) return;
            setSocialNotifications((prev) =>
              prev.map((item) => (item.id === id ? { ...item, read: true } : item))
            );
            void markSocialNotificationsRead(profile.uid, { id });
          }}
          onMarkAllRead={() => {
            void markAllNotificationsRead(notifications.filter((n) => !n.read).map((n) => n.id));
            if (profile && socialNotifications.some((s) => !s.read)) {
              setSocialNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
              void markSocialNotificationsRead(profile.uid, { markAll: true });
            }
          }}
        />
      )}

      {quickSwitcherOpen && (
        <QuickSwitcherModal
          rooms={
            lockedVaultUnlocked
              ? joinedRooms
              : joinedRooms.filter((r) => !privacySettings.lockedRoomIds.includes(r.id))
          }
          profiles={friendProfiles}
          currentUid={profile.uid}
          onClose={() => setQuickSwitcherOpen(false)}
          onSelectRoom={(id) => setActiveRoomId(id)}
          onStartDM={(target) => void handleStartDM(target)}
        />
      )}

      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}

      {/* Themes, Instagram Per-Chat Themes & Saved Backend Data Modal (lazy-loaded on demand) */}
      {themesModalOpen && (
        <Suspense fallback={null}>
          <ThemePickerModal
            open={themesModalOpen}
            themeId={themeId}
            darkMode={darkMode}
            wallpaperId={wallpaperId}
            activeRoomName={
              activeRoom
                ? activeRoom.visibility === 'dm'
                  ? activeDmPeer?.displayName || activeRoom.name
                  : activeRoom.name
                : undefined
            }
            activeRoomIsDm={activeRoom?.visibility === 'dm'}
            activeChatThemeId={activeChatTheme.id}
            activeChatThemeUpdatedBy={activeRoomThemeRecord?.updatedByName}
            backupSummary={backupSummary}
            savedCallsCount={callHistory.length}
            savingBackup={savingBackup}
            exportUrl={profile ? getBackupExportUrl(profile.uid) : null}
            onClose={() => setThemesModalOpen(false)}
            onSelectTheme={handleSelectThemeId}
            onSelectChatTheme={(id) => void handleSelectChatTheme(id)}
            onToggleDarkMode={handleSetDarkMode}
            onSelectWallpaper={handleSelectWallpaperId}
            onSaveBackupNow={() => void handleSaveWorkspaceBackup(true)}
          />
        </Suspense>
      )}

      {/* Chat Privacy, AES-256 Encryption, Locked Chats & 4-Digit PIN Modal */}
      {privacyModalOpen && (
        <Suspense fallback={null}>
          <PrivacyModal
            open={privacyModalOpen}
            uid={profile.uid}
            settings={privacySettings}
            readReceiptsEnabled={effectiveReadReceiptsEnabled}
            savingReadReceipts={savingReadReceipts}
            activeRoom={activeRoom}
            activeRoomMemberUids={
              activeRoom?.visibility === 'dm'
                ? activeRoom.dmParticipantIds
                : roomMembers.map((m) => m.uid)
            }
            onClose={() => setPrivacyModalOpen(false)}
            onUpdateSettings={handleUpdatePrivacySettings}
            onToggleReadReceipts={handleToggleReadReceipts}
            onLockAppNow={() => {
              if (privacySettings.pinHash) {
                setActiveRoomId(null);
                setLockedVaultUnlocked(false);
                setAppLocked(true);
              }
            }}
          />
        </Suspense>
      )}

      {/* PIN Prompt for Unlocking the Locked Chats Vault */}
      {pinVaultPromptOpen && privacySettings.pinHash && (
        <Suspense fallback={null}>
          <PinUnlockModal
            open={pinVaultPromptOpen}
            uid={profile.uid}
            pinHash={privacySettings.pinHash}
            title="Unlock Locked Chats"
            subtitle="Enter your 4-digit Privacy PIN to view hidden chats"
            onUnlocked={() => {
              setPinVaultPromptOpen(false);
              setLockedVaultUnlocked(true);
            }}
            onCancel={() => setPinVaultPromptOpen(false)}
          />
        </Suspense>
      )}

      {/* Full-Screen App Privacy Lock Screen */}
      {appLocked && privacySettings.pinHash && (
        <Suspense fallback={null}>
          <PinUnlockModal
            open={appLocked}
            uid={profile.uid}
            pinHash={privacySettings.pinHash}
            title="Quadline is Locked"
            subtitle="Enter your 4-digit Privacy PIN to access your chats"
            fullScreen
            onUnlocked={() => setAppLocked(false)}
          />
        </Suspense>
      )}

      {/* Voice & Video Call Hub Modal (Accessible from any room on phone & laptop) */}
      <AnimatePresence>
        {callHubMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-label="Start a Voice or Video Call"
            onClick={() => setCallHubMode(null)}
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#161B22] border border-stone-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[85dvh] flex flex-col pb-[env(safe-area-inset-bottom)] sm:pb-0"
            >
              <div className="px-5 py-4 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-700/12 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                    {callHubMode === 'video' ? (
                      <Video className="w-4 h-4" />
                    ) : (
                      <Phone className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-display text-sm font-bold text-stone-900 dark:text-white">
                      Voice &amp; Video Calls
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-slate-400">
                      Call a friend or test your mic, camera &amp; Voice FX
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCallHubMode(null)}
                  aria-label="Close call dialog"
                  className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto">
                {/* Instant Local Device & Voice FX Studio Check */}
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>Live Audio, Video &amp; Voice Changer Check</span>
                  </div>
                  <p className="text-xs text-emerald-900/75 dark:text-emerald-200/75 leading-relaxed">
                    Launch an instant local call stage to test your microphone, flip cameras, share your screen, and preview all 8 live Voice FX.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCallHubMode(null);
                        void startSelfTestCall('audio');
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        callHubMode === 'audio'
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                          : 'bg-white dark:bg-[#1C2128] border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40'
                      }`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Voice Call Check</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCallHubMode(null);
                        void startSelfTestCall('video');
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        callHubMode === 'video'
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                          : 'bg-white dark:bg-[#1C2128] border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40'
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Video Call Check</span>
                    </button>
                  </div>
                </div>

                {/* Accepted Friends Direct Call List */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-slate-400">
                    Call a friend ({callableContacts.length})
                  </p>
                  {callableContacts.length === 0 ? (
                    <div className="text-xs text-stone-500 dark:text-slate-400 py-6 text-center bg-stone-50 dark:bg-slate-900/60 rounded-xl px-4 space-y-3">
                      <p>
                        No accepted friends yet. Send and accept a Friend Request before starting a 1-to-1 call, or use the Call Check above.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setCallHubMode(null);
                          setNewDmOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-accent text-white cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Friend / Requests</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {callableContacts.map((member) => {
                        const st = presenceMap[member.uid]?.status || member.status || 'offline';
                        return (
                          <div
                            key={member.uid}
                            className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-stone-200/80 dark:border-slate-800 bg-stone-50/70 dark:bg-[#1C2128]/70"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar
                                name={member.displayName}
                                src={member.photoUrl}
                                size="sm"
                                status={st}
                                showStatus
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-stone-900 dark:text-white truncate">
                                  {member.displayName}
                                </p>
                                <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
                                  @{member.handle} · {st === 'offline' ? 'Offline' : 'Active'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setCallHubMode(null);
                                  handleStartCallWithProfile(member, 'audio');
                                }}
                                aria-label={`Voice call ${member.displayName}`}
                                title="Voice call"
                                className="p-2.5 rounded-xl bg-emerald-700/12 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-700 hover:text-white transition-colors cursor-pointer"
                              >
                                <Phone className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCallHubMode(null);
                                  handleStartCallWithProfile(member, 'video');
                                }}
                                aria-label={`Video call ${member.displayName}`}
                                title="Video call"
                                className="p-2.5 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 transition-colors cursor-pointer"
                              >
                                <Video className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-Screen Photo Lightbox with Smooth Zoom, Fallback & Download Original */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.01 : 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-label="Photo viewer"
            onClick={() => {
              setLightboxImage(null);
              setLightboxZoomed(false);
            }}
            className="fixed inset-0 z-50 bg-black/92 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 cursor-zoom-out"
          >
            <div className="absolute top-4 right-4 sm:top-5 sm:right-5 flex items-center gap-2 z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxZoomed((v) => !v);
                }}
                aria-label={lightboxZoomed ? 'Fit photo to screen' : 'Zoom in photo'}
                title={lightboxZoomed ? 'Fit to screen' : 'Zoom in'}
                className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
              >
                {lightboxZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
              </button>
              <a
                href={
                  lightboxImage.url.startsWith('/api/media/')
                    ? `${lightboxImage.url}?download=1`
                    : lightboxImage.url
                }
                download={lightboxImage.fileName || 'photo.jpg'}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download Original</span>
                <span className="sm:hidden">Save</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setLightboxImage(null);
                  setLightboxZoomed(false);
                }}
                aria-label="Close photo preview"
                className="p-2.5 rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className={`max-w-5xl max-h-[86dvh] space-y-2.5 ${lightboxZoomed ? 'overflow-auto' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={
                  lightboxImage.usedFallback && lightboxImage.fallbackUrl
                    ? lightboxImage.fallbackUrl
                    : lightboxImage.url
                }
                alt={lightboxImage.caption || 'Shared photo'}
                referrerPolicy="no-referrer"
                onClick={() => setLightboxZoomed((v) => !v)}
                onError={() => {
                  if (!lightboxImage.usedFallback && lightboxImage.fallbackUrl) {
                    setLightboxImage((prev) => (prev ? { ...prev, usedFallback: true } : null));
                  }
                }}
                className={`mx-auto rounded-xl transition-transform duration-200 ${
                  lightboxZoomed
                    ? 'max-h-none w-auto max-w-none cursor-zoom-out'
                    : 'max-h-[78dvh] max-w-full w-auto object-contain cursor-zoom-in'
                }`}
              />
              {lightboxImage.caption && (
                <p className="text-center text-xs text-stone-300 px-3">{lightboxImage.caption}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Movies & Famous Songs + Reels & Instagram Share Modal for Active Chat */}
      {songsReelsModalTab && activeRoom && isMemberOfActiveRoom && (
        <Suspense fallback={null}>
          <SongsAndReelsModal
            open={Boolean(songsReelsModalTab)}
            initialTab={songsReelsModalTab}
            roomName={
              activeRoom.visibility === 'dm'
                ? activeDmPeer?.displayName || activeRoom.name
                : activeRoom.name
            }
            profile={profile}
            onClose={() => setSongsReelsModalTab(null)}
            onSendSong={handleSendSongToActiveRoom}
            onShareReel={(reel) => handleShareReelToRoom(activeRoom.id, reel)}
            onOpenCreateReelForRoom={handleOpenCreateReelForActiveRoom}
          />
        </Suspense>
      )}

      {/* Active / Incoming WebRTC Video & Audio Call Overlay (lazy-loaded on demand) */}
      {callState.status !== 'idle' && (
        <Suspense fallback={null}>
          <CallOverlay
            call={callState}
            currentUserName={profile.displayName}
            sendCallSignal={sendCallSignal}
            subscribeCallSignals={subscribeCallSignals}
            onAccept={() => void acceptCall()}
            onReject={rejectCall}
            onEnd={endCall}
            onToggleMute={toggleMute}
            onToggleCamera={() => void toggleCamera()}
            onSwitchCamera={() => void switchCamera()}
            onToggleScreenShare={() => void toggleScreenShare()}
            onStopScreenShare={() => void stopScreenShare()}
            onSelectVoiceEffect={setVoiceEffect}
            onToggleMonitorVoice={toggleMonitorVoice}
          />
        </Suspense>
      )}

      {/* Subtle Reconnecting Banner (shown only on transient live-socket drops while online; OfflineIndicator handles full offline) */}
      <AnimatePresence>
        {isOnline && hasConnectedOnce && !socketConnected && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            role="status"
            aria-live="polite"
            className="fixed top-2.5 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-amber-950/95 text-amber-100 border border-amber-500/40 shadow-lg flex items-center gap-2 text-xs font-medium pointer-events-none"
          >
            <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>Reconnecting live chat &amp; calls…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle Floating Toast Notifications */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 sm:max-w-xs sm:w-full pointer-events-none"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout={!prefersReducedMotion}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 460, damping: 32 }}
              className="pointer-events-auto rounded-xl bg-stone-900 dark:bg-[#1C2128] text-white border border-stone-700 px-4 py-3 shadow-lg"
            >
              <p className="text-xs font-semibold">{t.title}</p>
              {t.body && <p className="text-xs text-stone-300 mt-0.5 line-clamp-2">{t.body}</p>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function isAdminPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  return clean === '/admin';
}

export default function App() {
  const [adminRoute, setAdminRoute] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isAdminPath(window.location.pathname) : false
  );

  useEffect(() => {
    const syncRoute = () => setAdminRoute(isAdminPath(window.location.pathname));
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  const handleReturnToMainApp = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      setAdminRoute(false);
    }
  }, []);

  return (
    <ErrorBoundary>
      {adminRoute ? (
        <Suspense
          fallback={
            <div className="min-h-dvh bg-[#F8FAFC] dark:bg-[#0B0F14] flex items-center justify-center text-xs text-slate-500">
              Loading Admin Portal...
            </div>
          }
        >
          <AdminPortalPage onReturnToApp={handleReturnToMainApp} />
        </Suspense>
      ) : (
        <>
          <OfflineIndicator />
          <QuadlineWorkspace />
        </>
      )}
    </ErrorBoundary>
  );
}
