# ChronicleDesk Security Specification (Phase 0)

## Data Invariants
1. **Identity Isolation**: Only authenticated, email-verified users (`request.auth != null && request.auth.token.email_verified == true`) can create, update, or delete tasks, courses, or public content records.
2. **Ownership Integrity**: Every created `Course`, `Task`, and `PublicContent` document must set `ownerId == request.auth.uid`, and `ownerId` and `createdAt` are immutable on updates.
3. **PII Isolation**: User email addresses are stored exclusively in `/users/{userId}/private/info`, which is readable and writable only by `request.auth.uid == userId`. Public creator attribution uses `/users/{userId}/public/profile` containing only `displayName` and `photoURL`.
4. **Public Content Hub Visibility**: `/publicContents/{contentId}` is intentionally readable (`get`, `list`) by any visitor (signed in or guest) so anyone visiting the site can view and download shared study content, while mutations (`create`, `update`, `delete`) are strictly restricted to the verified `ownerId` or the bootstrapped admin.
5. **Private Task/Course List Enforcement**: `/tasks` and `/courses` `allow list` rules explicitly enforce `resource.data.ownerId == request.auth.uid` so unauthorized scraping across users fails.
6. **Temporal & Size Bounds**: Every timestamp field (`createdAt`, `updatedAt`) must equal `request.time`, every document ID must match `^[a-zA-Z0-9_-]{1,128}$`, and all strings/arrays have explicit `.size()` ceilings.

## Dirty Dozen Test Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated write to `/publicContents/c1` (`ownerId: "u1"`).
2. Authenticated write to `/tasks/t1` with spoofed `ownerId: "victim-uid"`.
3. Authenticated write to `/courses/crs1` with `email_verified == false`.
4. Shadow update adding ghost field `isAdmin: true` on `/users/u1/public/profile`.
5. Unauthenticated `get` on `/users/u1/private/info` attempting PII read.
6. Cross-user `get` on `/users/u1/private/info` by `u2`.
7. Cross-user `list` on `/tasks` without `where('ownerId', '==', auth.uid)`.
8. Oversized ID poisoning (`150`-char document ID) on `/tasks/{longId}`.
9. Oversized string (`> 4000` chars) in `Task.notes`.
10. Unbounded array (`25` items `> 20`) in `Task.attachmentIds`.
11. Mutating immutable `ownerId` or `createdAt` on `/publicContents/c1`.
12. Client-spoofed past/future timestamp (`createdAt != request.time`) on `/tasks/t1`.
