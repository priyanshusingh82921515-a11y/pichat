# Quadline Firestore Security Specification

## 1. Data Invariants

1. **PII Isolation**: Email addresses, blocked user lists, and private preferences live exclusively in `/userPrivate/{userId}` and are readable/writable only by `userId` (or a verified global admin). Public profiles in `/profiles/{userId}` contain zero PII.
2. **Master Gate Membership**: Every subcollection inside `/rooms/{roomId}` (`members`, `messages`, `events`, `reports`, `activity`) requires active membership in `/rooms/{roomId}/members/{request.auth.uid}`. Revoking a member document synchronously revokes access to all room subcollections.
3. **Private Room Invite Isolation**: Private room invite codes are stored in `/invites/{code}` with single-document `get` lookup only (no `list` scraping). Joining a private room requires either an active invite code, an approved join request, or being the room creator.
4. **Role Escalation Prevention**: Users cannot assign themselves `'owner'` or `'moderator'` when joining an existing room. Only the room owner can promote/demote moderators; only owner/moderator can remove lower-privileged members.
5. **Terminal State Locking**: Once a `JoinRequest` transitions from `'pending'` to `'approved'` or `'rejected'`, or a `ModerationReport` transitions from `'open'` to `'resolved'` or `'dismissed'`, no further status updates are permitted (except verified global admin override).
6. **Temporal & Immutable Integrity**: `createdAt`, `joinedAt`, `ownerId`, `authorId`, `roomId`, and `uid` are immutable after creation; `createdAt` and `updatedAt` must strictly equal `request.time`.
7. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **PII Snooping (`GET /userPrivate/victimUid` as attacker)**: Must fail (`PERMISSION_DENIED`).
2. **Shadow Field Injection (`CREATE /profiles/attackerUid` with extra `isAdmin: true`)**: Must fail via `keys().hasOnly(...)`.
3. **Identity Spoofing (`CREATE /rooms/r1/messages/m1` with `authorId: "victimUid"`)**: Must fail via `incoming().authorId == request.auth.uid`.
4. **Self-Role Escalation (`CREATE /rooms/r1/members/attackerUid` with `role: "owner"` on existing room)**: Must fail because room already has a different `ownerId`.
5. **Private Room Bypass (`CREATE /rooms/priv1/members/attackerUid` with no valid invite or approved join request)**: Must fail because room is private.
6. **ID Poisoning (`CREATE /rooms/../../evil!!` or 1.5KB roomId)**: Must fail via `isValidId(roomId)`.
7. **Timestamp Forgery (`CREATE /rooms/r1/messages/m1` with client timestamp instead of `request.time`)**: Must fail via `incoming().createdAt == request.time`.
8. **Message Impersonation Edit (`UPDATE /rooms/r1/messages/m1` text by non-author member)**: Must fail because only author can edit `text`.
9. **Terminal State Re-Opening (`UPDATE /rooms/r1/joinRequests/u2` changing `status` from `'rejected'` back to `'pending'`)**: Must fail via terminal state lock.
10. **Value Poisoning (`UPDATE /rooms/r1/messages/m1` setting `pinned: "yes"` string instead of boolean)**: Must fail because `isValidMessage(incoming())` wraps the update block.
11. **Query Scraping Notifications (`LIST /notifications` without `where('recipientId', '==', uid)`)**: Must fail because `allow list` checks `resource.data.recipientId == request.auth.uid`.
12. **Unverified Admin Email Spoof (`UPDATE /rooms/r1` with admin email but `email_verified: false`)**: Must fail because `isVerified()` and `isAdmin()` both mandate `request.auth.token.email_verified == true`.
