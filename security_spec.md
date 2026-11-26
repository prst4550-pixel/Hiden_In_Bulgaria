# Firestore Security Specification (Phase 0 TDD & Red Team Audit)

## 1. Data Invariants
1. **UserProfile (`/users/{userId}`)**: A profile document's `uid` must match both `request.auth.uid` and the path `{userId}`. Non-admin users may only create profiles with `role == "user"` and can never modify `role`, `uid`, `email`, or `createdAt`.
2. **FavoritePlace (`/users/{userId}/favorites/{placeId}`)**: Only the owning authenticated user (`request.auth.uid == userId`) can read, list, create, or delete favorites. `userId` must match `request.auth.uid` and `placeId` must match the path parameter.
3. **CommunitySuggestion (`/suggestions/{suggestionId}`)**: Created only by verified users with `authorUid == request.auth.uid`, initial `status == "pending"`, Bulgarian coordinates (`41.0..44.5`, `22.0..29.0`), and server timestamps `request.time`. Only admins (`prst4550@gmail.com` with `email_verified == true` or registered in `/admins`) can approve/reject; terminal states (`approved`, `rejected`) are locked against non-admin updates.
4. **PlaceReview (`/reviews/{reviewId}`)**: Publicly readable (`get` and `list` scoped to `placeId`), created only by verified users with `authorUid == request.auth.uid`, integer `rating` between `1` and `5`, and server timestamp `createdAt == request.time`. Only the author or admin may delete.
5. **AdminRecord (`/admins/{userId}`)**: Read/write restricted strictly to the bootstrapped admin (`prst4550@gmail.com` with `email_verified == true`) or owner read.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Privilege Escalation (User Create)**: `/users/{uid}` create with `{ role: "admin" }` by a standard user.
2. **Privilege Escalation (User Update)**: `/users/{uid}` update changing `role` from `"user"` to `"admin"`.
3. **PII Leak (User Get/List)**: Unauthenticated or non-owner `get`/`list` on `/users`.
4. **Identity Spoofing (Suggestion Create)**: `/suggestions/{id}` create with `authorUid` set to another user's UID.
5. **State Shortcutting (Suggestion Create)**: `/suggestions/{id}` create with `status: "approved"` directly.
6. **Shadow Update / Ghost Field (Review Create)**: `/reviews/{id}` create containing undeclared ghost field `isVerified: true`.
7. **Timestamp Forgery**: `/suggestions/{id}` or `/reviews/{id}` create with client-forged `createdAt` (`!= request.time`).
8. **Email Spoofing**: Request claiming `email: "prst4550@gmail.com"` with `email_verified: false`.
9. **Resource Poisoning (Oversized ID)**: `/reviews/{1500-char-id}` create bypassing `isValidId()` regex/length guard.
10. **Value Poisoning**: `/suggestions/{id}` update setting `description` to a boolean or string `> 2000` characters.
11. **Terminal State Tampering**: Non-admin updating an already `approved` suggestion.
12. **Unscoped List Scraping**: `list` on `/suggestions` by an unauthenticated client or querying documents belonging to other users.
