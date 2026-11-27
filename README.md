# Skrito v Bulgaria (Hidden in Bulgaria)

A full-stack commercial web platform, interactive cartographic atlas, and cultural-heritage expedition catalog showcasing verified natural wonders, ancient sanctuaries, fortresses, caves, waterfalls, monasteries, and architectural villages across Bulgaria.

---

## Project Overview

**Skrito v Bulgaria** (*Скрито в България*) is an editorial travel and geographic discovery web application built with React, TypeScript, Tailwind CSS, Leaflet, and an Express Node.js backend. The platform pairs an authentic regional archive with interactive terrain mapping, expedition route planning, a field advisor interface, community moderation workflows, and an administrative T-SQL schema and query console compatible with Microsoft SQL Server Management Studio (SSMS).

---

## Website Description

Visitors can explore Bulgaria's lesser-known cultural and natural destinations through:

- **Editorial Landing Showcase**: Curated expedition spotlight, regional geographic banners covering six Bulgarian planning regions, and direct category/search shortcuts.
- **Interactive Cartographic Atlas**: Dual-provider mapping built around Leaflet/OpenStreetMap with Esri World Imagery satellite tiles and configurable Esri World Hillshade relief shading, alongside optional Google Maps terrain integration.
- **Verified Destination Catalog**: Searchable and sortable directory supporting grid and tabular expedition-log views, seasonal filtering, difficulty ratings, elevation data, and GPS coordinate lookup.
- **Curated Expedition Routes**: Multi-stop thematic journeys with stop notes, duration, total distance, and one-click map route tracing.
- **Interactive Field Guide**: Conversational terrain advisor supporting photo capture/upload from the device camera, voice input via the browser Web Speech API, spoken response playback, and contextual landmark linking.
- **Community Submissions & Moderation**: Public suggestion form with strict geographic bounds validation and an administrative approval workflow that publishes verified submissions directly into the live catalog.
- **Legal & Contact Compliance**: Dedicated Bulgarian Privacy Policy, Terms & Conditions, Cookie Policy, and persistent Contact Inquiry system.

---

## Main Features

- **Dual-Mode Interactive Map** (`src/components/InteractiveMap.tsx`, `src/components/GoogleMapView.tsx`):
  - Category color-coded markers, automatic region framing, user geolocation lookup, and an animated **"Trail of Steps"** (*Пътека от стъпки*) tracking the last three visited landmarks with inter-stop geodesic distances.
  - Real-time Hillshade opacity slider and satellite/map layer switching.
- **Catalog & Detail Passports** (`src/components/CatalogView.tsx`, `src/components/PlaceDetailModal.tsx`):
  - Filter by category, region, terrain difficulty, and optimal visiting season.
  - Full destination dossiers with historical context, practical trail tips, one-click WGS84 coordinate copying, external turn-by-turn navigation links, favorites list, and visitor reviews.
- **Authentication & Role-Based Administration** (`src/components/AuthModal.tsx`, `src/components/AdminPanel.tsx`, `src/components/EditPlaceModal.tsx`):
  - Cryptographically salted `scrypt` password hashing, timing-safe comparison, HMAC-signed Bearer tokens held strictly in memory, and role-based access control (`admin` vs. `user`).
  - First-run administrator activation flow or environment-based administrator configuration (`ADMIN_PASSCODE`).
  - Full CRUD management for destinations, moderation of community suggestions, user role registry, and contact message inbox.
- **SSMS & T-SQL Management Studio** (`src/components/SsmsStudioView.tsx`):
  - Admin-only browser console displaying relational schema metadata (`dbo.Places`, `dbo.Categories`, `dbo.Regions`, `dbo.Routes`, `dbo.RouteStops`, `dbo.Reviews`, `dbo.CommunitySuggestions`), executing read-only T-SQL queries, and exporting a complete `BulgariaTravel_SSMS.sql` deployment script with `GEOGRAPHY (SRID 4326)` spatial types and stored procedures.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons
- **Mapping & Spatial Utilities**: Leaflet 1.9.4 (bundled CSS + Esri Hillshade/Satellite + OpenStreetMap), `@vis.gl/react-google-maps` (optional Google Maps layer), Haversine geodesic distance utilities
- **Backend**: Node.js, Express 4, `tsx` runtime, JSON file persistence (`data/database.json`) with automated seed initialization
- **External Integrations (Optional / Configurable)**:
  - Google Maps JavaScript API (`VITE_GOOGLE_MAPS_API_KEY`) for the Google Maps provider view
  - External search/vision service key (`GEMINI_API_KEY`) for extended natural-language and image-recognition responses in the Field Guide module

---

## Installation

### Prerequisites

- Node.js 20 LTS or newer
- `npm` or `bun`

### Steps

```bash
# 1. Install project dependencies
npm install

# 2. Create environment configuration from template
cp .env.example .env

# 3. Verify TypeScript types and production build
npm run lint
npm run build
```

---

## Configuration

Edit `.env` at the project root before starting the server in staging or production:

1. Set a strong `SESSION_SECRET` (at least 32 random characters) so issued authentication tokens remain stable across server restarts.
2. Set `APP_URL` to your public origin (for example `https://skritovbulgaria.bg`) so CORS allowlisting matches your deployment domain.
3. Configure administrator credentials via `ADMIN_EMAIL` and `ADMIN_PASSCODE`, or leave `ADMIN_PASSCODE` empty on initial boot to activate the administrator account once via the built-in first-run setup form.
4. Optionally provide `GEMINI_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY` if you intend to enable extended conversational/vision search and Google Maps rendering.

---

## Environment Variables

| Variable | Scope | Required | Description |
|---|---|---|---|
| `PORT` | Server | No (default `3000`) | HTTP port used by the Express server and Vite middleware. |
| `NODE_ENV` | Server | No | Set to `production` when serving compiled assets from `dist/`. |
| `APP_URL` | Server | Recommended | Public base URL added to the strict API CORS origin allowlist. |
| `SESSION_SECRET` | Server | Recommended | Secret key used to sign and verify HMAC-SHA256 session tokens. |
| `ADMIN_EMAIL` | Server | No (default `prst4550@gmail.com`) | Primary administrator account email address. |
| `ADMIN_PASSCODE` | Server | Optional | Pre-configured administrator password. If omitted, the administrator password can be claimed once via the UI on first run. |
| `GEMINI_API_KEY` | Server | Optional | Server-side API credential for extended conversational and image-analysis capabilities in the Field Guide. |
| `VITE_GOOGLE_MAPS_API_KEY` | Client | Optional | Browser API key for enabling the Google Maps view alongside Leaflet/OpenStreetMap. |

---

## Project Structure

```text
.
├── .env.example                 # Environment variable template (no secrets)
├── index.html                   # Document entry point with SEO, OpenGraph, and JSON-LD metadata
├── package.json                 # Dependencies and build/runtime scripts
├── server.ts                    # Express API server, security headers, CORS, auth, SSMS & Field Guide routes
├── vite.config.ts               # Vite bundler configuration with vendor chunk splitting
├── data/
│   └── database.json            # Persistent runtime store (places, suggestions, reviews, users, inquiries)
├── public/
│   ├── places/                  # Verified landmark photography
│   ├── logo-emblem.jpg          # Brand emblem artwork
│   ├── favicon.svg              # Browser vector icon
│   ├── robots.txt               # Search engine crawl directives
│   └── sitemap.xml              # XML sitemap for indexed sections
└── src/
    ├── App.tsx                  # Root application layout, routing state, and modal orchestration
    ├── main.tsx                 # React entry point and bundled Leaflet stylesheet
    ├── index.css                # Typography, color palette, and editorial utility styles
    ├── data/
    │   └── seedData.ts          # Initial 48 landmarks, 6 regions, 6 categories, and expedition routes
    ├── services/
    │   └── api.ts               # Typed frontend API client with in-memory session token handling
    ├── types/
    │   └── index.ts             # Shared TypeScript domain interfaces
    ├── utils/
    │   ├── geo.ts               # Haversine distance and trail length calculations
    │   └── imageFallback.ts     # Resilient fallback imagery handler
    └── components/
        ├── AdminPanel.tsx       # Moderation console, catalog CRUD, users list, and inquiry inbox
        ├── AiGuideChat.tsx      # Interactive Field Guide with camera capture, upload, and voice controls
        ├── AuthModal.tsx        # Login, registration, and first-run admin setup modal
        ├── CatalogView.tsx      # Grid & table catalog with category, region, difficulty, and season filters
        ├── CommunityView.tsx    # Public landmark suggestion submission form
        ├── EditPlaceModal.tsx   # Create/edit/delete landmark modal
        ├── FavoritesModal.tsx   # Saved favorites drawer/modal
        ├── Footer.tsx           # Editorial footer with navigation and legal links
        ├── GoogleMapView.tsx    # Optional Google Maps provider view
        ├── Hero.tsx             # Landing hero with live search and category chips
        ├── InteractiveMap.tsx   # Leaflet/OSM/Hillshade map, safe DOM popups, custom route builder, and trail simulation
        ├── LegalPages.tsx       # Privacy Policy, Terms & Conditions, Cookie Policy, and Contact page
        ├── LiquidGlassDropdown.tsx # Accessible custom filter select menu
        ├── Navbar.tsx           # Responsive header navigation and account menu
        ├── PlaceCard.tsx        # Catalog destination card
        ├── PlaceDetailModal.tsx # Landmark dossier, GPS coordinates, reviews, and nearby locations
        ├── ProfileModal.tsx     # Isolated user profile management and personal activity modal
        ├── RouteList.tsx        # Curated and custom expedition routes showcase
        └── SsmsStudioView.tsx   # Admin-only T-SQL query runner and SSMS export console
```

---

## Development

Start the unified development server (Express API + Vite HMR middleware on port `3000`):

```bash
npm run dev
```

Run static type validation:

```bash
npm run lint
```

Run dependency vulnerability audit:

```bash
bun audit
```

---

## Production Deployment

1. Build the optimized client bundle into `dist/`:
   ```bash
   npm run build
   ```
2. Set environment variables (`NODE_ENV=production`, `PORT=3000`, `SESSION_SECRET`, `APP_URL`, and optional integration keys).
3. Start the Express server, which serves static compiled assets and handles all `/api/*` routes:
   ```bash
   NODE_ENV=production npm start
   ```
4. Place the Node.js process behind a TLS-terminating reverse proxy (Nginx, Caddy, or Cloud Load Balancer) so HTTPS and `Strict-Transport-Security` headers are active for all visitors.

---

## Security

The platform enforces multiple layered security controls:

- **Authentication & Sessions**: Passwords are hashed with `crypto.scryptSync` using per-user 32-byte cryptographic salts and compared using `crypto.timingSafeEqual`. Session tokens are HMAC-SHA256 signed with timing-safe signature verification and stored strictly in client JS memory (never in `localStorage` or `sessionStorage`).
- **Zero Hardcoded Credentials**: No default administrator passwords exist in source code or client bundles. Administrative access requires either `ADMIN_PASSCODE` in server environment variables or completion of the one-time first-run setup flow.
- **Role-Based Access Control**: Server middleware (`requireAdmin`) enforces administrator verification (`401`/`403`) across user listings, moderation endpoints, landmark mutations, contact inquiry retrieval, and all SSMS schema/query/export routes.
- **XSS Prevention**: Map markers and Leaflet popups construct DOM nodes exclusively via `document.createElement`, `textContent`, and validated URL helpers, avoiding raw HTML string injection.
- **Input Validation & Rate Limiting**: Strict coordinate bounds for Bulgaria, whitelisted enum and URL-protocol checks, size-bounded base64 image checks, and per-IP sliding-window rate limiters on authentication, public submissions, and guide endpoints.
- **HTTP Hardening & CORS**: Disables `X-Powered-By`, sets `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, conditional HSTS, and a strict host-aware `/api` CORS allowlist.

---

## Maintenance

- **Backups**: Regularly back up `data/database.json` and uploaded assets in `public/places/` before deploying updates or bulk importing destinations.
- **T-SQL Synchronization**: Use the admin SSMS Studio export (`BulgariaTravel_SSMS.sql`) after catalog edits to keep external Microsoft SQL Server replicas synchronized.
- **Dependency Hygiene**: Periodically run `bun audit` and `npm run lint` to verify dependency integrity and TypeScript strictness.
- **Contact & Moderation**: Review pending community submissions and visitor inquiries regularly inside the Administrative Center (`Предложения` and `Запитвания` tabs).
