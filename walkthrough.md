# Security Summary

**Reviewed Files**: 22
**Issues Resolved**: 8

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Hardcoded Admin Credentials | `server.ts`, `src/components/AuthModal.tsx`, `src/components/AdminPanel.tsx`, `data/database.json` | 91 (`AuthModal`), 145 (`AdminPanel`) | A fixed plaintext administrator password was displayed in the UI, pre-filled via a button, and seeded in `database.json`. | Critical | Fixed | Removed all hardcoded passwords from client/server code and `database.json`; implemented `ADMIN_PASSCODE` env support plus a one-time atomic `/api/auth/claim-admin` setup route that locks immediately after claim. |
| Missing Admin Access Checks | `server.ts` | 657, 725, 1024, 1192, 1204, 1338 | Sensitive endpoints (`/api/suggestions`, `/api/suggestions/:id/status`, `/api/ssms/schema`, `/api/ssms/export`, `/api/ssms/query`, and `/api/contact`) lacked or risked inconsistent admin verification or relied on unsafe query parameters. | Critical | Fixed | Enforced `requireAdmin` middleware (verifying HMAC-signed token, session expiration, and server-side `role === 'admin'`) on all admin, moderation, contact-read, and SSMS endpoints. |
| DOM XSS in Map Popups | `src/components/InteractiveMap.tsx` | 463 | Leaflet marker popups and custom icons concatenated place fields and `onerror` handlers via `innerHTML`. | High | Fixed | Rewrote `createPopupContent`, `createPinElement`, trail labels, and geolocation popups using `document.createElement`, `textContent`, URL protocol validation, and `addEventListener`. |
| Weak Password Hashing & Insecure Token Storage | `server.ts`, `src/services/api.ts`, `src/components/SsmsStudioView.tsx` | 227 (`server.ts`), 15 (`api.ts`), 93 (`SsmsStudioView`) | Legacy PBKDF2 used low iteration counts (1,000) without timing-safe comparison, and Bearer tokens were persisted in `localStorage`. | High | Fixed | Upgraded password hashing to `crypto.scryptSync` with 32-byte salts and `crypto.timingSafeEqual` (auto-upgrading legacy regular accounts on login), signed session tokens with HMAC-SHA256, and moved tokens to in-memory JS state while purging legacy `localStorage` keys. |
| Permissive CORS & Missing Security Headers | `server.ts` | 37–94 | `X-Powered-By` was exposed, HTTP security headers were absent, and CORS needed host/domain confinement. | Medium | Fixed | Disabled `x-powered-by`, added `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, conditional HSTS, and an origin-validated `/api` CORS allowlist. |
| Unvalidated Write Payloads & Missing Rate Limits | `server.ts` | 147–195, 612, 661, 1039, 2066 | Public write routes (`POST /api/reviews`, `/api/suggestions`, `/api/contact`, `/api/auth/*`, `/api/guide/chat`) lacked per-IP throttling, strict coordinate/enum bounds, or base64 image size/MIME checks. | Medium | Fixed | Added per-IP sliding-window rate limiters (`authRateLimiter`, `writeRateLimiter`, `aiRateLimiter`), Bulgaria geographic coordinate bounds validation, difficulty enum checks, `https:`/`http:`/`/places/` image URL validation, and base64 MIME/size caps. |
| Vulnerable Transitive Dependency | `package.json`, `bun.lock` | 20 (`package.json`) | `bun audit` flagged a high-severity DoS issue in `body-parser <= 1.20.8` via Express. | High | Fixed | Upgraded `express` to `^4.22.1` and `body-parser` to `1.20.9`; re-ran `bun audit` confirming 0 vulnerabilities. |
| Unsafe Destructive Confirmations & Unsanitized External Grounding URLs | `src/components/AdminPanel.tsx`, `src/components/EditPlaceModal.tsx`, `src/components/AiGuideChat.tsx` | 100 (`AdminPanel`), 137 (`EditPlaceModal`), 616 (`AiGuideChat`) | `window.confirm` blocked iframe execution and external grounding URIs were bound directly to `href` attributes without protocol verification. | Low | Fixed | Replaced all `window.confirm` calls with inline two-step confirmation controls and added `sanitizeExternalUrl` restricting `href` targets to `http:` and `https:`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| API Keys & Secrets | `server.ts`, `.env.example` | Server credentials (`GEMINI_API_KEY`, `SESSION_SECRET`, `ADMIN_PASSCODE`) are read solely on the backend from `process.env` and never returned in client responses. |
| T-SQL Console Input | `server.ts` | `/api/ssms/query` operates strictly as an authenticated admin-only read query evaluator (`SELECT` / approved `EXEC` procedures) against structured in-memory collections rather than passing raw strings to an OS shell or unparameterized database driver. |
| Public Input Handling | `src/components/*`, `server.ts` | React JSX auto-escaping and DOM `textContent` construction prevent script execution; backend routes enforce payload types, string lengths, and valid `placeId` references before persisting to `data/database.json`. |

---

## PoC Verification

### 1. Unauthenticated Access Blocked on Administrative & SSMS Endpoints

#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Authentication / Access Control |
| Impact | Critical |
| Affected File | `server.ts:498-531` |
| Test Scenario | `GET /api/suggestions`, `GET /api/users`, `GET /api/ssms/schema`, `GET /api/ssms/export`, `POST /api/ssms/query`, and `GET /api/contact` without an `Authorization: Bearer <token>` header or with a regular user token. |

#### How It Was Fixed
Added `extractAuthenticatedUser` (HMAC-SHA256 timing-safe token validation and expiration check) and enforced `requireAdmin` middleware across all moderation, user-management, contact-inbox, landmark-mutation, and SSMS routes.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Unauthenticated `GET /api/ssms/schema` arrives at Express router | Request enters `requireAdmin` at `server.ts:498` |
| 2 | `extractAuthenticatedUser(req)` returns `null` when header is absent or signature fails | Guard triggers `401 Unauthorized` at `server.ts:501` |
| 3 | Authenticated non-admin user attempts `POST /api/ssms/query` | `user.role !== 'admin'` triggers `403 Forbidden` at `server.ts:509` |

#### Conclusion
**Fix Verified** - Neither anonymous callers nor standard registered users can inspect suggestions, user records, contact messages, or execute/export SSMS database queries.

---

### 2. Map Popup XSS via Craft Place Attributes

#### Summary
| Field | Value |
|---|---|
| Issue Type | DOM-Based Cross-Site Scripting (XSS) |
| Impact | High |
| Affected File | `src/components/InteractiveMap.tsx:125-213` |
| Test Scenario | A landmark record containing `name: "<img src=x onerror=alert(1)>"` or `imageUrl: "javascript:alert(1)"` rendered into a Leaflet marker popup. |

#### How It Was Fixed
Replaced HTML string interpolation and `popupDiv.innerHTML` with explicit DOM node creation (`document.createElement`), `.textContent` assignment, and `sanitizeImageSrc()` validating `/places/...` or `http:`/`https:` protocols before assigning `img.src`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Marker renders popup via `createPopupContent(...)` | Function builds disconnected DOM nodes (`InteractiveMap.tsx:125`) |
| 2 | `img.src` passes through `sanitizeImageSrc(place.imageUrl, fallbackSrc)` | `javascript:` scheme is rejected and replaced with safe fallback image (`InteractiveMap.tsx:41-55`) |
| 3 | `place.name` and `place.shortDescription` are written via `element.textContent` | Payload renders strictly as literal text; no script or inline event handler can execute |

#### Conclusion
**Fix Verified** - Malicious HTML or script payloads in landmark metadata cannot execute in the browser when map markers or popups open.

---

### 3. Hardcoded Admin Login Elimination & Atomic First-Run Claim

#### Summary
| Field | Value |
|---|---|
| Issue Type | Hardcoded Administrative Credentials |
| Impact | Critical |
| Affected File | `server.ts:843-902`, `src/components/AuthModal.tsx:127-149` |
| Test Scenario | Calling `POST /api/auth/login` with legacy default credentials or calling `POST /api/auth/claim-admin` a second time after an administrator password has already been claimed. |

#### How It Was Fixed
Cleared legacy password material from `data/database.json`, removed client-side credential shortcuts from `AuthModal.tsx` and `AdminPanel.tsx`, and added `/api/auth/claim-admin` which succeeds only once when no `ADMIN_PASSCODE` env var or existing admin hash is set.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `POST /api/auth/login` runs with legacy password against `usr-admin-1` | Empty `passwordHash`/`salt` fails `verifyPassword` at `server.ts:232` -> returns `401` |
| 2 | First-time admin submits `POST /api/auth/claim-admin` with strong 8+ char password | Sets `scryptSync` hash + 32-byte salt and issues HMAC session token (`server.ts:878-899`) |
| 3 | Subsequent call to `POST /api/auth/claim-admin` hits `existingAdmin.passwordHash` check | Blocked immediately with `409 Conflict` (`server.ts:855`) |

#### Conclusion
**Fix Verified** - Legacy default credentials cannot authenticate, and the one-time setup endpoint permanently locks once administrator access is activated.
