import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { FunctionDeclaration, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { PLACES, CATEGORIES, REGIONS, ROUTES } from './src/data/seedData';
import {
  Place,
  CommunitySuggestion,
  Review,
  User,
  ContactMessage,
  AuditLogEntry,
  AdminStats,
  DifficultyLevel,
  Route,
  RouteStop,
  UserProfileData,
  ChatMessage,
} from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.disable('x-powered-by');
// Only trust X-Forwarded-For when actually running behind a reverse proxy; otherwise clients
// could spoof their IP and bypass the per-IP rate limiters.
if (process.env.TRUST_PROXY) {
  const tp = process.env.TRUST_PROXY.trim();
  app.set('trust proxy', /^\d+$/.test(tp) ? parseInt(tp, 10) : tp === 'true' ? true : tp);
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'prst4550@gmail.com').trim().toLowerCase();
const ENV_ADMIN_PASSCODE = (process.env.ADMIN_PASSCODE || '').trim();
// Optional pre-hashed admin credentials supplied by the operator. There is deliberately NO
// hardcoded fallback: without ADMIN_PASSCODE / these values the admin account stays unclaimed
// and is set up through the first-run claim form.
const DEFAULT_ADMIN_SALT = (process.env.ADMIN_PASSWORD_SALT || '').trim();
const DEFAULT_ADMIN_SCRYPT_HASH = (process.env.ADMIN_PASSWORD_HASH || '').trim();
const VALID_DIFFICULTIES: DifficultyLevel[] = ['Лесен', 'Умерен', 'Труден', 'Екстремен'];
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BASE64_IMAGE_BYTES = 8 * 1024 * 1024;

// -------------------------------------------------------------
// SECURITY HEADERS & CORS MIDDLEWARE
// -------------------------------------------------------------

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  const proto = req.headers['x-forwarded-proto'];
  if (req.secure || proto === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

function getAllowedOrigins(req: Request): Set<string> {
  const allowed = new Set<string>([
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
  ]);

  const appUrl = (process.env.APP_URL || '').trim();
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).origin);
    } catch {
      // ignore invalid APP_URL
    }
  }

  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }

  return allowed;
}

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');

  if (origin) {
    const allowedOrigins = getAllowedOrigins(req);
    const isSameOriginFetch = req.headers['sec-fetch-site'] === 'same-origin';
    if (!isSameOriginFetch && !allowedOrigins.has(origin)) {
      return res.status(403).json({ error: 'Забранен достъп от неоторизиран домейн (CORS).' });
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Static assets with proper caching headers
app.use(
  '/places',
  express.static(path.resolve(__dirname, 'public/places'), {
    maxAge: '7d',
    etag: true,
  })
);
app.use(
  '/assets',
  express.static(path.resolve(__dirname, 'public/assets'), {
    maxAge: '7d',
    etag: true,
  })
);
app.use(
  '/docs',
  express.static(path.resolve(__dirname, 'public/docs'), {
    maxAge: '1h',
    etag: true,
  })
);

// Explicit robots.txt & sitemap.xml routes for both dev & prod
app.get('/robots.txt', (_req: Request, res: Response) => {
  const prodFile = path.resolve(__dirname, 'dist/robots.txt');
  const pubFile = path.resolve(__dirname, 'public/robots.txt');
  const target = fs.existsSync(prodFile) ? prodFile : pubFile;
  if (fs.existsSync(target)) {
    res.type('text/plain; charset=utf-8').sendFile(target);
  } else {
    res.type('text/plain; charset=utf-8').send('User-agent: *\nAllow: /\nDisallow: /api/\n');
  }
});

app.get('/sitemap.xml', (_req: Request, res: Response) => {
  const prodFile = path.resolve(__dirname, 'dist/sitemap.xml');
  const pubFile = path.resolve(__dirname, 'public/sitemap.xml');
  const target = fs.existsSync(prodFile) ? prodFile : pubFile;
  if (fs.existsSync(target)) {
    res.type('application/xml; charset=utf-8').sendFile(target);
  } else {
    res.status(404).end();
  }
});

// -------------------------------------------------------------
// RATE LIMITER (IN-MEMORY SLIDING WINDOW)
// -------------------------------------------------------------

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(windowMs: number, maxRequests: number, errorMessage: string) {
  const buckets = new Map<string, RateLimitBucket>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now > bucket.resetAt) {
        buckets.delete(key);
      }
    }
  }, Math.max(windowMs, 60000));
  cleanupTimer.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const existing = buckets.get(ip);

    if (!existing || now > existing.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (existing.count >= maxRequests) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
      return res.status(429).json({ error: errorMessage });
    }

    existing.count += 1;
    next();
  };
}

const authRateLimiter = createRateLimiter(
  10 * 60 * 1000,
  60,
  'Твърде много опити за вход. Моля, изчакайте няколко минути и опитайте отново.'
);
const writeRateLimiter = createRateLimiter(
  10 * 60 * 1000,
  20,
  'Изпратихте твърде много заявки за кратък период. Моля, изчакайте малко.'
);
const aiRateLimiter = createRateLimiter(
  5 * 60 * 1000,
  30,
  'Временно достигнахте лимита за запитвания към Пътеводителя. Опитайте отново след малко.'
);

// -------------------------------------------------------------
// DATABASE PERSISTENCE & CRYPTOGRAPHIC PASSWORD HELPERS
// -------------------------------------------------------------

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.resolve(DATA_DIR, 'database.json');

export interface DbUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  hashAlgorithm?: 'scrypt' | 'pbkdf2';
  role: 'admin' | 'user';
  status: 'active' | 'blocked';
  createdAt: string;
}

interface DatabaseSchema {
  places: Place[];
  suggestions: CommunitySuggestion[];
  reviews: Review[];
  users: DbUser[];
  contactMessages: ContactMessage[];
  userProfiles: Record<string, UserProfileData>;
  auditLog: AuditLogEntry[];
  // Persist hashed sessions so valid logins survive a server restart.
  sessions?: Record<string, { userId: string; expiresAt: number }>;
}

function createSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashPasswordScrypt(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, user: DbUser): boolean {
  if (!user.passwordHash || !user.salt) {
    return false;
  }

  const storedBuf = Buffer.from(user.passwordHash, 'hex');
  let computedBuf: Buffer;

  if (user.hashAlgorithm === 'pbkdf2') {
    computedBuf = crypto.pbkdf2Sync(password, user.salt, 1000, 64, 'sha512');
  } else {
    computedBuf = crypto.scryptSync(password, user.salt, 64);
  }

  if (storedBuf.length !== computedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuf, computedBuf);
}

function createAdminRecord(): DbUser {
  // With neither ADMIN_PASSCODE nor operator-supplied hash/salt, the admin is created
  // unclaimed (empty hash) and must be activated through /api/auth/claim-admin.
  let salt = '';
  let passwordHash = '';
  if (ENV_ADMIN_PASSCODE) {
    salt = createSalt();
    passwordHash = hashPasswordScrypt(ENV_ADMIN_PASSCODE, salt);
  } else if (DEFAULT_ADMIN_SCRYPT_HASH && DEFAULT_ADMIN_SALT) {
    salt = DEFAULT_ADMIN_SALT;
    passwordHash = DEFAULT_ADMIN_SCRYPT_HASH;
  }
  return {
    id: 'usr-admin-1',
    name: 'Администратор',
    email: ADMIN_EMAIL,
    passwordHash,
    salt,
    hashAlgorithm: 'scrypt',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
  };
}

function initDatabase(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let data: DatabaseSchema | null = null;
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      data = JSON.parse(content) as DatabaseSchema;
    } catch (e) {
      // Never overwrite a corrupted database with the seed: that would silently destroy all
      // users, reviews and suggestions. Keep a backup and stop so the operator can inspect it.
      const backup = `${DB_FILE}.corrupt-${Date.now()}`;
      try {
        fs.copyFileSync(DB_FILE, backup);
      } catch {
        // ignore backup failure
      }
      console.error(`Failed to parse ${DB_FILE} (backup at ${backup}). Refusing to start.`, e);
      process.exit(1);
    }
  }

  if (data && typeof data === 'object') {
    if (!Array.isArray(data.places)) data.places = PLACES;
    if (!Array.isArray(data.users)) data.users = [];
    if (!Array.isArray(data.suggestions)) data.suggestions = [];
    if (!Array.isArray(data.reviews)) data.reviews = [];
    if (!Array.isArray(data.contactMessages)) data.contactMessages = [];
    if (!Array.isArray(data.auditLog)) data.auditLog = [];
    if (!data.sessions || typeof data.sessions !== 'object' || Array.isArray(data.sessions)) {
      data.sessions = {};
    }
    if (!data.userProfiles || typeof data.userProfiles !== 'object' || Array.isArray(data.userProfiles)) {
      data.userProfiles = {};
    }

    data.users = data.users.map((u) => ({
      ...u,
      status: u.status === 'blocked' ? 'blocked' : 'active',
    }));

    // Remove any duplicate entries for ADMIN_EMAIL keeping usr-admin-1
    const primaryAdmin =
      data.users.find((u) => u.id === 'usr-admin-1') ||
      data.users.find((u) => u.email.toLowerCase() === ADMIN_EMAIL);

    if (!primaryAdmin) {
      data.users.unshift(createAdminRecord());
    } else {
      primaryAdmin.id = primaryAdmin.id || 'usr-admin-1';
      const emailOwner = data.users.find(
        (u) => u !== primaryAdmin && u.email.toLowerCase() === ADMIN_EMAIL
      );
      if (emailOwner) {
        // Do not delete a real user just because their email matches ADMIN_EMAIL.
        console.warn(
          `ADMIN_EMAIL (${ADMIN_EMAIL}) already belongs to user ${emailOwner.id}; keeping the admin's current email.`
        );
      } else {
        primaryAdmin.email = ADMIN_EMAIL;
      }
      primaryAdmin.role = 'admin';
      primaryAdmin.status = 'active';
      if (ENV_ADMIN_PASSCODE) {
        // Apply ADMIN_PASSCODE whenever it doesn't match the stored hash, so setting/changing
        // it after the first boot actually takes effect.
        if (!verifyPassword(ENV_ADMIN_PASSCODE, primaryAdmin)) {
          const salt = createSalt();
          primaryAdmin.salt = salt;
          primaryAdmin.passwordHash = hashPasswordScrypt(ENV_ADMIN_PASSCODE, salt);
          primaryAdmin.hashAlgorithm = 'scrypt';
        }
      } else if ((!primaryAdmin.passwordHash || !primaryAdmin.salt) && DEFAULT_ADMIN_SCRYPT_HASH && DEFAULT_ADMIN_SALT) {
        primaryAdmin.salt = DEFAULT_ADMIN_SALT;
        primaryAdmin.passwordHash = DEFAULT_ADMIN_SCRYPT_HASH;
        primaryAdmin.hashAlgorithm = 'scrypt';
      }
      data.users = [primaryAdmin, ...data.users.filter((u) => u !== primaryAdmin)];
    }

    writeFileAtomic(DB_FILE, JSON.stringify(data, null, 2));
    return data;
  }

  const initialData: DatabaseSchema = {
    places: PLACES,
    suggestions: [
      {
        id: 'sugg-1',
        name: 'Скално светилище Купена край село Песнопой',
        region: 'Южен централен (Родопи и Тракия)',
        category: 'Древни светилища',
        latitude: 42.4561,
        longitude: 24.8123,
        description:
          'Масивен скален връх с изсечени ритуални ями и невероятна панорама към долината на река Стряма.',
        source: 'Краеведски архив Пловдив и местни жители',
        contact: 'boris.georgiev@example.bg',
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'sugg-2',
        name: 'Каньонът на река Черни Лом при село Кошов',
        region: 'Северен централен (Дунав и Балкан)',
        category: 'Водопади и каньони',
        latitude: 43.6621,
        longitude: 25.9812,
        description:
          'Див меандър на Лома с отвесни бели варовикови стени и скрити пещери на скални орли.',
        source: 'Природен парк Русенски Лом',
        contact: 'elena.dimitrova@example.bg',
        status: 'pending',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    reviews: [
      {
        id: 'rev-1',
        placeId: 'belintash',
        author: 'Красимир Стойчев',
        rating: 5,
        comment:
          'Уникална енергия при изгрев слънце! Пътят от село Врата е добър, но носете планински обувки за скалата.',
        visitSeason: 'Септември 2025',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'rev-2',
        placeId: 'dyavolski-most',
        author: 'Ралица Костова',
        rating: 5,
        comment:
          'Абсолютно задължително място. Отражението на Арда е като огледало в ранния следобед.',
        visitSeason: 'Май 2025',
        createdAt: new Date().toISOString(),
      },
    ],
    users: [createAdminRecord()],
    contactMessages: [],
    auditLog: [],
    userProfiles: {},
    sessions: {},
  };

  writeFileAtomic(DB_FILE, JSON.stringify(initialData, null, 2));
  return initialData;
}

// Write to a temp file then rename, so a crash mid-write can't leave a truncated database.
function writeFileAtomic(file: string, content: string) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, file);
}

let db = initDatabase();

function saveDatabase() {
  try {
    writeFileAtomic(DB_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Failed to persist database:', err);
  }
}

// -------------------------------------------------------------
// INPUT SANITIZATION & VALIDATION HELPERS
// -------------------------------------------------------------

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .trim()
    .slice(0, maxLength);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 160;
}

function sanitizeImageUrl(url: unknown, fallback = '/places/belintash.jpg'): string {
  if (typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith('/places/') || trimmed.startsWith('/assets/')) {
    if (!trimmed.includes('..')) return trimmed;
    return fallback;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function sanitizeExternalUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'place-' + Date.now()
  );
}

function isValidBulgariaCoordinates(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 41.0 &&
    lat <= 44.5 &&
    lng >= 22.0 &&
    lng <= 29.0
  );
}

// -------------------------------------------------------------
// SESSION STORE & AUTHENTICATION MIDDLEWARE
// -------------------------------------------------------------

// Store only SHA-256 hashes of bearer tokens. Sessions remain valid across server
// restarts without writing usable credentials to the database.
const activeSessions = new Map<string, { userId: string; expiresAt: number }>(
  Object.entries(db.sessions || {})
);

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const sessionCleanupTimer = setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [tokenHash, session] of activeSessions.entries()) {
    if (now > session.expiresAt) {
      activeSessions.delete(tokenHash);
      if (db.sessions) delete db.sessions[tokenHash];
      changed = true;
    }
  }
  if (changed) saveDatabase();
}, 15 * 60 * 1000);
sessionCleanupTimer.unref();

function issueSessionToken(user: DbUser): string {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const ttlMs = user.role === 'admin' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const session = { userId: user.id, expiresAt: Date.now() + ttlMs };
  activeSessions.set(tokenHash, session);
  db.sessions ||= {};
  db.sessions[tokenHash] = session;
  saveDatabase();
  return token;
}

function toSafeUser(u: DbUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status === 'blocked' ? 'blocked' : 'active',
    createdAt: u.createdAt,
  };
}

function revokeUserSessions(userId: string) {
  for (const [tokenHash, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(tokenHash);
      if (db.sessions) delete db.sessions[tokenHash];
    }
  }
  saveDatabase();
}

function getSessionAuthState(req: Request): { user: DbUser | null; blocked: boolean } {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, blocked: false };
  }
  const token = authHeader.substring(7).trim();
  if (!token) return { user: null, blocked: false };

  const tokenHash = hashSessionToken(token);
  const session = activeSessions.get(tokenHash);
  if (!session) return { user: null, blocked: false };

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(tokenHash);
    if (db.sessions) delete db.sessions[tokenHash];
    saveDatabase();
    return { user: null, blocked: false };
  }

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) {
    activeSessions.delete(tokenHash);
    if (db.sessions) delete db.sessions[tokenHash];
    saveDatabase();
    return { user: null, blocked: false };
  }

  if (user.status === 'blocked') {
    activeSessions.delete(tokenHash);
    if (db.sessions) delete db.sessions[tokenHash];
    saveDatabase();
    return { user: null, blocked: true };
  }

  return { user, blocked: false };
}

function getUserFromRequest(req: Request): DbUser | null {
  return getSessionAuthState(req).user;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { user, blocked } = getSessionAuthState(req);
  if (blocked) {
    return res.status(403).json({
      error: 'Вашият акаунт е блокиран от администратор. Достъпът до тази функция е спрян.',
    });
  }
  if (!user) {
    return res.status(401).json({
      error: 'За да използвате тази функция, влезте в профила си или се регистрирайте.',
    });
  }
  res.locals.currentUser = user;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { user, blocked } = getSessionAuthState(req);
  if (blocked) {
    return res.status(403).json({ error: 'Акаунтът е блокиран от администратор.' });
  }
  if (!user) {
    return res.status(401).json({ error: 'Изисква се автентикация за достъп до този ресурс.' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Достъпът е разрешен само за администратори.' });
  }
  res.locals.currentUser = user;
  next();
}

const AUDIT_LOG_LIMIT = 500;

// Records an admin action. Call before saveDatabase() in admin routes.
function recordAudit(res: Response, action: string, details: string) {
  const admin = res.locals.currentUser as DbUser | undefined;
  db.auditLog.unshift({
    id: 'log-' + crypto.randomUUID(),
    action,
    details,
    adminEmail: admin?.email || 'system',
    createdAt: new Date().toISOString(),
  });
  if (db.auditLog.length > AUDIT_LOG_LIMIT) db.auditLog.length = AUDIT_LOG_LIMIT;
}

function getOrCreateUserProfile(userId: string): UserProfileData {
  if (!db.userProfiles || typeof db.userProfiles !== 'object') {
    db.userProfiles = {};
  }
  const existing = db.userProfiles[userId];
  if (existing) {
    return {
      favorites: Array.isArray(existing.favorites) ? existing.favorites : [],
      customRoutes: Array.isArray(existing.customRoutes) ? existing.customRoutes : [],
      recentTrailIds: Array.isArray(existing.recentTrailIds) ? existing.recentTrailIds : [],
      guideChatHistory: Array.isArray(existing.guideChatHistory) ? existing.guideChatHistory : [],
      updatedAt: existing.updatedAt || new Date().toISOString(),
    };
  }
  const empty: UserProfileData = {
    favorites: [],
    customRoutes: [],
    recentTrailIds: [],
    guideChatHistory: [],
    updatedAt: new Date().toISOString(),
  };
  db.userProfiles[userId] = empty;
  return empty;
}

function getAdminUser(): DbUser | undefined {
  return db.users.find((u) => u.role === 'admin');
}

function isAdminClaimed(): boolean {
  const admin = getAdminUser();
  return Boolean(admin && admin.passwordHash && admin.passwordHash.length > 0);
}

// Gemini API initialization on server-side
function getAiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// -------------------------------------------------------------
// PUBLIC CATALOG, REGIONS, ROUTES & REVIEWS
// -------------------------------------------------------------

app.get('/api/places', (req: Request, res: Response) => {
  try {
    const { category, region, search, difficulty } = req.query;
    let results = [...db.places];

    if (category && typeof category === 'string' && category !== 'all') {
      results = results.filter((p) => p.categoryId === category);
    }

    if (region && typeof region === 'string' && region !== 'all') {
      results = results.filter((p) => p.regionId === region);
    }

    if (difficulty && typeof difficulty === 'string' && difficulty !== 'all') {
      results = results.filter((p) => p.difficulty === difficulty);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const query = search.trim().slice(0, 100).toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.shortDescription.toLowerCase().includes(query) ||
          p.fullDescription.toLowerCase().includes(query) ||
          p.regionName.toLowerCase().includes(query) ||
          p.categoryName.toLowerCase().includes(query)
      );
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching places:', error);
    res.status(500).json({ error: 'Грешка при зареждане на местата' });
  }
});

app.get('/api/places/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const place = db.places.find((p) => p.id === id || p.slug === id);
  if (!place) {
    return res.status(404).json({ error: 'Мястото не е намерено' });
  }
  res.json(place);
});

app.get('/api/categories', (_req: Request, res: Response) => {
  const categoriesWithCount = CATEGORIES.map((cat) => ({
    ...cat,
    count: db.places.filter((p) => p.categoryId === cat.id).length,
  }));
  res.json(categoriesWithCount);
});

app.get('/api/regions', (_req: Request, res: Response) => {
  res.json(REGIONS);
});

app.get('/api/routes', (_req: Request, res: Response) => {
  res.json(ROUTES);
});

app.get('/api/routes/:id', (req: Request, res: Response) => {
  const route = ROUTES.find((r) => r.id === req.params.id);
  if (!route) {
    return res.status(404).json({ error: 'Маршрутът не е намерен' });
  }
  res.json(route);
});

app.get('/api/reviews/:placeId', (req: Request, res: Response) => {
  const placeReviews = db.reviews.filter((r) => r.placeId === req.params.placeId);
  res.json(placeReviews);
});

app.post('/api/reviews', requireAuth, writeRateLimiter, (req: Request, res: Response) => {
  const { placeId, author, rating, comment, visitSeason } = req.body || {};
  const cleanPlaceId = cleanText(placeId, 80);
  const authUser = res.locals.currentUser as DbUser;
  const cleanAuthor = authUser.name || cleanText(author, 80);
  const cleanComment = cleanText(comment, 1200);
  const cleanSeason = cleanText(visitSeason || '2026', 60);
  const numericRating = Math.round(Number(rating));

  if (!cleanPlaceId || !cleanAuthor || !cleanComment || !Number.isFinite(numericRating)) {
    return res.status(400).json({ error: 'Моля, попълнете всички задължителни полета за отзива.' });
  }

  const targetPlace = db.places.find((p) => p.id === cleanPlaceId);
  if (!targetPlace) {
    return res.status(404).json({ error: 'Избраният обект не съществува в каталога.' });
  }

  const newReview: Review = {
    id: 'rev-' + crypto.randomUUID(),
    placeId: cleanPlaceId,
    author: cleanAuthor,
    userId: authUser.id,
    rating: Math.max(1, Math.min(5, numericRating)),
    comment: cleanComment,
    visitSeason: cleanSeason,
    createdAt: new Date().toISOString(),
  };

  db.reviews.unshift(newReview);

  // Recalculate aggregate review stats on place
  const placeReviews = db.reviews.filter((r) => r.placeId === cleanPlaceId);
  targetPlace.reviewCount = placeReviews.length;
  targetPlace.rating = Number(
    (placeReviews.reduce((sum, r) => sum + r.rating, 0) / placeReviews.length).toFixed(1)
  );

  saveDatabase();
  res.status(201).json(newReview);
});

// -------------------------------------------------------------
// COMMUNITY SUGGESTIONS & CONTACT SUBMISSIONS
// -------------------------------------------------------------

// Protected Admin-only listing (protects contributor emails/PII)
app.get('/api/suggestions', requireAdmin, (_req: Request, res: Response) => {
  res.json(db.suggestions);
});

app.post('/api/suggestions', requireAuth, writeRateLimiter, (req: Request, res: Response) => {
  const { name, region, category, latitude, longitude, description, source, imageUrl, contact } =
    req.body || {};

  const cleanName = cleanText(name, 160);
  const cleanRegion = cleanText(region, 120);
  const cleanCategory = cleanText(category, 100);
  const cleanDesc = cleanText(description, 2500);
  const cleanSource = cleanText(source || 'Личен опит', 200);
  const cleanContact = cleanText(contact, 160);

  if (!cleanName || !cleanDesc || !cleanRegion || !cleanCategory) {
    return res
      .status(400)
      .json({ error: 'Името, регионът, категорията и описанието са задължителни.' });
  }

  if (cleanContact && !isValidEmail(cleanContact)) {
    return res.status(400).json({ error: 'Моля, въведете валиден имейл адрес за контакт.' });
  }

  const latNum = parseFloat(String(latitude));
  const lngNum = parseFloat(String(longitude));
  if (!isValidBulgariaCoordinates(latNum, lngNum)) {
    return res.status(400).json({
      error:
        'Моля, въведете валидни географски координати в границите на България (Ширина 41.0–44.5, Дължина 22.0–29.0).',
    });
  }

  const sanitizedImage =
    typeof imageUrl === 'string' && imageUrl.trim()
      ? sanitizeImageUrl(imageUrl, '')
      : undefined;

  if (imageUrl && String(imageUrl).trim() && !sanitizedImage) {
    return res.status(400).json({ error: 'Линкът към снимката трябва да започва с https:// или http://.' });
  }

  const authUser = res.locals.currentUser as DbUser;
  const newSuggestion: CommunitySuggestion = {
    id: 'sugg-' + crypto.randomUUID(),
    name: cleanName,
    region: cleanRegion,
    category: cleanCategory,
    latitude: latNum,
    longitude: lngNum,
    description: cleanDesc,
    source: cleanSource,
    imageUrl: sanitizedImage || undefined,
    contact: cleanContact || authUser.email || undefined,
    status: 'pending',
    userId: authUser.id,
    createdAt: new Date().toISOString(),
  };

  db.suggestions.unshift(newSuggestion);
  saveDatabase();

  res.status(201).json({
    message:
      'Благодарим! Вашето предложение беше записано успешно и е изпратено за преглед от нашия екип.',
    suggestion: newSuggestion,
  });
});

app.patch('/api/suggestions/:id/status', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
    return res.status(400).json({ error: 'Невалиден статус' });
  }

  const item = db.suggestions.find((s) => s.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Предложението не е намерено' });
  }

  const previousStatus = item.status;
  item.status = status;

  if (previousStatus === 'approved' && status !== 'approved' && item.placeId) {
    // Un-approving removes the place that the approval added to the public catalog.
    const placeIdx = db.places.findIndex((p) => p.id === item.placeId);
    if (placeIdx !== -1) db.places.splice(placeIdx, 1);
    item.placeId = undefined;
  }

  if (status === 'approved') {
    const existing = db.places.find((p) => p.name.toLowerCase() === item.name.toLowerCase());
    if (!existing) {
      const matchedRegion = REGIONS.find(
        (r) =>
          r.id === item.region ||
          r.name.toLowerCase() === item.region.toLowerCase() ||
          item.region.toLowerCase().includes(r.name.split('(')[0].trim().toLowerCase())
      );
      const matchedCategory = CATEGORIES.find(
        (c) =>
          c.id === item.category ||
          c.name.toLowerCase() === item.category.toLowerCase() ||
          item.category.toLowerCase().includes(c.name.toLowerCase())
      );
      const newPlace: Place = {
        id: 'place-' + crypto.randomUUID(),
        name: item.name,
        slug: slugify(item.name),
        regionId: matchedRegion?.id || 'south_central',
        regionName: matchedRegion?.name || item.region,
        categoryId: matchedCategory?.id || 'sanctuaries',
        categoryName: matchedCategory?.name || item.category,
        latitude: item.latitude,
        longitude: item.longitude,
        shortDescription:
          item.description.slice(0, 150) + (item.description.length > 150 ? '...' : ''),
        fullDescription: item.description,
        history: 'Предложено от общността на „Скрито в България“. Източник: ' + item.source,
        accessTips: 'Проучете терена предварително.',
        terrainType: 'Естествен терен',
        difficulty: 'Умерен',
        bestSeason: 'Пролет - Есен',
        imageUrl: sanitizeImageUrl(item.imageUrl, '/places/belintash.jpg'),
        imageCredit: 'Общност „Скрито в България“',
        isVerified: true,
        isFeatured: false,
      };
      db.places.push(newPlace);
      item.placeId = newPlace.id;
    }
  }

  const statusLabel: Record<string, string> = { pending: 'чака преглед', approved: 'одобрено', rejected: 'отхвърлено' };
  recordAudit(
    res,
    'suggestion.status',
    `„${item.name}“: ${statusLabel[previousStatus]} → ${statusLabel[status]}`
  );
  saveDatabase();
  res.json({ message: `Статусът беше обновен на ${status}`, suggestion: item });
});

// Public Contact Inquiry Endpoint
app.post('/api/contact', writeRateLimiter, (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body || {};
  const cleanName = cleanText(name, 100);
  const cleanEmail = cleanText(email, 160).toLowerCase();
  const cleanSubject = cleanText(subject, 160);
  const cleanMessage = cleanText(message, 2500);

  if (!cleanName || !cleanEmail || !cleanSubject || !cleanMessage) {
    return res.status(400).json({ error: 'Моля, попълнете всички задължителни полета.' });
  }

  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Моля, въведете валиден имейл адрес.' });
  }

  if (cleanMessage.length < 10) {
    return res.status(400).json({ error: 'Съобщението трябва да съдържа поне 10 символа.' });
  }

  const entry: ContactMessage = {
    id: 'msg-' + crypto.randomUUID(),
    name: cleanName,
    email: cleanEmail,
    subject: cleanSubject,
    message: cleanMessage,
    createdAt: new Date().toISOString(),
  };

  db.contactMessages.unshift(entry);
  saveDatabase();

  res.status(201).json({
    message: 'Благодарим за запитването! Съобщението ви беше записано успешно.',
    contactMessage: {
      id: entry.id,
      createdAt: entry.createdAt,
    },
  });
});

app.get('/api/contact', requireAdmin, (_req: Request, res: Response) => {
  res.json(db.contactMessages);
});

app.patch('/api/contact/:id', requireAdmin, (req: Request, res: Response) => {
  const msg = db.contactMessages.find((m) => m.id === req.params.id);
  if (!msg) {
    return res.status(404).json({ error: 'Запитването не е намерено.' });
  }
  msg.isRead = Boolean((req.body || {}).isRead);
  saveDatabase();
  res.json(msg);
});

app.delete('/api/contact/:id', requireAdmin, (req: Request, res: Response) => {
  const idx = db.contactMessages.findIndex((m) => m.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Запитването не е намерено.' });
  }
  const [removed] = db.contactMessages.splice(idx, 1);
  recordAudit(res, 'message.delete', `„${removed.subject}“ от ${removed.email}`);
  saveDatabase();
  res.json({ message: 'Запитването беше изтрито.' });
});

app.delete('/api/suggestions/:id', requireAdmin, (req: Request, res: Response) => {
  const idx = db.suggestions.findIndex((s) => s.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Предложението не е намерено' });
  }
  const [removed] = db.suggestions.splice(idx, 1);
  recordAudit(res, 'suggestion.delete', `„${removed.name}“`);
  saveDatabase();
  res.json({ message: `Предложението „${removed.name}“ беше изтрито.` });
});

// -------------------------------------------------------------
// ADMIN: REVIEWS MODERATION, STATISTICS & AUDIT LOG
// -------------------------------------------------------------

function recalcPlaceRating(placeId: string) {
  const place = db.places.find((p) => p.id === placeId);
  if (!place) return;
  const placeReviews = db.reviews.filter((r) => r.placeId === placeId);
  place.reviewCount = placeReviews.length;
  place.rating = placeReviews.length
    ? Number((placeReviews.reduce((sum, r) => sum + r.rating, 0) / placeReviews.length).toFixed(1))
    : undefined;
}

app.get('/api/admin/reviews', requireAdmin, (_req: Request, res: Response) => {
  const names = new Map(db.places.map((p) => [p.id, p.name]));
  res.json(
    db.reviews.map((r) => ({ ...r, placeName: names.get(r.placeId) || 'Изтрит обект' }))
  );
});

app.delete('/api/reviews/:id', requireAdmin, (req: Request, res: Response) => {
  const idx = db.reviews.findIndex((r) => r.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Отзивът не е намерен.' });
  }
  const [removed] = db.reviews.splice(idx, 1);
  recalcPlaceRating(removed.placeId);
  const placeName = db.places.find((p) => p.id === removed.placeId)?.name || removed.placeId;
  recordAudit(res, 'review.delete', `${removed.author} за „${placeName}“`);
  saveDatabase();
  res.json({ message: 'Отзивът беше изтрит.' });
});

app.get('/api/admin/stats', requireAdmin, (_req: Request, res: Response) => {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const countBy = (values: string[]) => {
    const m = new Map<string, number>();
    values.forEach((v) => m.set(v, (m.get(v) || 0) + 1));
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };
  const favoriteCounts = new Map<string, number>();
  Object.values(db.userProfiles || {}).forEach((profile) =>
    (profile.favorites || []).forEach((id) => favoriteCounts.set(id, (favoriteCounts.get(id) || 0) + 1))
  );
  const placeName = new Map(db.places.map((p) => [p.id, p.name]));
  const avg = db.reviews.length
    ? Number((db.reviews.reduce((s, r) => s + r.rating, 0) / db.reviews.length).toFixed(2))
    : null;

  const stats: AdminStats = {
    totals: {
      places: db.places.length,
      featuredPlaces: db.places.filter((p) => p.isFeatured).length,
      users: db.users.length,
      blockedUsers: db.users.filter((u) => u.status === 'blocked').length,
      reviews: db.reviews.length,
      averageRating: avg,
      pendingSuggestions: db.suggestions.filter((s) => s.status === 'pending').length,
      suggestions: db.suggestions.length,
      messages: db.contactMessages.length,
      unreadMessages: db.contactMessages.filter((m) => !m.isRead).length,
    },
    placesByCategory: countBy(db.places.map((p) => p.categoryName)),
    placesByRegion: countBy(db.places.map((p) => p.regionName.split('(')[0].trim())),
    topRatedPlaces: db.places
      .filter((p) => (p.reviewCount || 0) > 0)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0))
      .slice(0, 5)
      .map((p) => ({ id: p.id, name: p.name, rating: p.rating || 0, reviewCount: p.reviewCount || 0 })),
    mostFavoritedPlaces: [...favoriteCounts.entries()]
      .filter(([id]) => placeName.has(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, name: placeName.get(id) as string, count })),
    registrationsLast30Days: db.users.filter((u) => new Date(u.createdAt).getTime() >= since).length,
    reviewsLast30Days: db.reviews.filter((r) => new Date(r.createdAt).getTime() >= since).length,
  };
  res.json(stats);
});

app.get('/api/admin/audit-log', requireAdmin, (_req: Request, res: Response) => {
  res.json(db.auditLog.slice(0, 200));
});

// -------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------

app.get('/api/auth/admin-status', (_req: Request, res: Response) => {
  res.json({
    adminClaimed: isAdminClaimed(),
    envConfigured: Boolean(ENV_ADMIN_PASSCODE),
    adminEmail: ADMIN_EMAIL,
  });
});

app.post('/api/auth/claim-admin', authRateLimiter, (req: Request, res: Response) => {
  if (ENV_ADMIN_PASSCODE || isAdminClaimed()) {
    return res.status(409).json({ error: 'Администраторският достъп вече е конфигуриран.' });
  }

  const { email, password, name } = req.body || {};
  const cleanEmail = cleanText(email || ADMIN_EMAIL, 160).toLowerCase();
  const rawPassword = String(password || '');

  if (cleanEmail !== ADMIN_EMAIL) {
    return res.status(400).json({
      error: `Първоначалната активация е разрешена само за конфигурирания администраторски имейл (${ADMIN_EMAIL}).`,
    });
  }

  if (rawPassword.length < 8 || !/[a-zA-Z]/.test(rawPassword) || !/[0-9]/.test(rawPassword)) {
    return res.status(400).json({
      error: 'Паролата за администратор трябва да е поне 8 символа и да съдържа букви и цифри.',
    });
  }

  let admin = getAdminUser();
  const salt = createSalt();
  const passwordHash = hashPasswordScrypt(rawPassword, salt);

  if (!admin) {
    admin = {
      id: 'usr-admin-1',
      name: cleanText(name || 'Администратор', 80),
      email: ADMIN_EMAIL,
      passwordHash,
      salt,
      hashAlgorithm: 'scrypt',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    db.users.unshift(admin);
  } else {
    if (name && cleanText(name, 80)) {
      admin.name = cleanText(name, 80);
    }
    admin.passwordHash = passwordHash;
    admin.salt = salt;
    admin.hashAlgorithm = 'scrypt';
    admin.role = 'admin';
    admin.status = 'active';
  }

  saveDatabase();

  const token = issueSessionToken(admin);
  res.status(201).json({ token, user: toSafeUser(admin) });
});

app.post('/api/auth/register', authRateLimiter, (req: Request, res: Response) => {
  const { name, email, password } = req.body || {};
  const cleanName = cleanText(name, 80);
  const cleanEmail = cleanText(email, 160).toLowerCase();
  const rawPassword = String(password || '');

  if (!cleanName || !cleanEmail || !rawPassword) {
    return res.status(400).json({ error: 'Моля, попълнете име, имейл и парола.' });
  }

  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: 'Моля, въведете валиден имейл адрес.' });
  }

  if (rawPassword.length < 8) {
    return res.status(400).json({ error: 'Паролата трябва да съдържа минимум 8 символа.' });
  }

  const existing = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'Вече съществува профил с този имейл адрес.' });
  }

  const salt = createSalt();
  const newUser: DbUser = {
    id: 'usr-' + crypto.randomUUID(),
    name: cleanName,
    email: cleanEmail,
    passwordHash: hashPasswordScrypt(rawPassword, salt),
    salt,
    hashAlgorithm: 'scrypt',
    role: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  saveDatabase();

  const token = issueSessionToken(newUser);
  res.status(201).json({ token, user: toSafeUser(newUser) });
});

app.post('/api/auth/login', authRateLimiter, (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const cleanEmail = cleanText(email, 160).toLowerCase();
  const rawPassword = String(password || '');

  if (!cleanEmail || !rawPassword) {
    return res.status(400).json({ error: 'Моля, въведете имейл и парола.' });
  }

  const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(401).json({ error: 'Невалиден имейл или парола.' });
  }

  if (user.role === 'admin' && !user.passwordHash) {
    return res.status(403).json({
      error: 'Администраторският профил все още не е активиран. Използвайте формата за първоначална настройка.',
    });
  }

  if (!verifyPassword(rawPassword, user)) {
    return res.status(401).json({ error: 'Невалиден имейл или парола.' });
  }

  if (user.status === 'blocked') {
    revokeUserSessions(user.id);
    return res.status(403).json({
      error: 'Вашият акаунт е блокиран от администратор. Входът е временно ограничен.',
    });
  }

  // Transparently upgrade legacy PBKDF2 hash to scrypt on login
  if (user.hashAlgorithm === 'pbkdf2') {
    const newSalt = createSalt();
    user.salt = newSalt;
    user.passwordHash = hashPasswordScrypt(rawPassword, newSalt);
    user.hashAlgorithm = 'scrypt';
    saveDatabase();
  }

  const token = issueSessionToken(user);
  res.json({ token, user: toSafeUser(user) });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const { user, blocked } = getSessionAuthState(req);
  if (blocked) {
    return res.status(403).json({ error: 'Вашият акаунт е блокиран от администратор.' });
  }
  if (!user) {
    return res.status(401).json({ error: 'Не сте влезли в профила си.' });
  }
  res.json({ user: toSafeUser(user) });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const tokenHash = hashSessionToken(token);
    activeSessions.delete(tokenHash);
    if (db.sessions) delete db.sessions[tokenHash];
    saveDatabase();
  }
  res.json({ message: 'Успешен изход от системата.' });
});

app.get('/api/users', requireAdmin, (_req: Request, res: Response) => {
  const safeUsers: User[] = [...db.users]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(toSafeUser);
  res.json(safeUsers);
});

app.patch('/api/users/:id/status', requireAdmin, (req: Request, res: Response) => {
  const adminUser = res.locals.currentUser as DbUser;
  const targetId = cleanText(req.params.id, 100);
  const { status } = req.body || {};

  if (status !== 'active' && status !== 'blocked') {
    return res.status(400).json({ error: 'Невалиден статус на профила.' });
  }

  const targetUser = db.users.find((u) => u.id === targetId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Потребителят не е намерен.' });
  }

  if (targetUser.id === adminUser.id || targetUser.role === 'admin') {
    return res.status(403).json({
      error: 'Администраторският акаунт не може да бъде блокиран.',
    });
  }

  targetUser.status = status;
  if (status === 'blocked') {
    revokeUserSessions(targetUser.id);
  }
  recordAudit(
    res,
    status === 'blocked' ? 'user.block' : 'user.unblock',
    `${targetUser.name} (${targetUser.email})`
  );
  saveDatabase();

  res.json({
    user: toSafeUser(targetUser),
    message:
      status === 'blocked'
        ? `Потребителят ${targetUser.name} (${targetUser.email}) беше блокиран.`
        : `Потребителят ${targetUser.name} (${targetUser.email}) беше отблокиран.`,
  });
});

app.delete('/api/users/:id', requireAdmin, (req: Request, res: Response) => {
  const adminUser = res.locals.currentUser as DbUser;
  const targetId = cleanText(req.params.id, 100);

  const targetIdx = db.users.findIndex((u) => u.id === targetId);
  if (targetIdx === -1) {
    return res.status(404).json({ error: 'Потребителят не е намерен.' });
  }

  const targetUser = db.users[targetIdx];
  if (targetUser.id === adminUser.id || targetUser.role === 'admin') {
    return res.status(403).json({
      error: 'Администраторският акаунт не може да бъде изтрит.',
    });
  }

  db.users.splice(targetIdx, 1);
  if (db.userProfiles && db.userProfiles[targetId]) {
    delete db.userProfiles[targetId];
  }
  revokeUserSessions(targetId);
  recordAudit(res, 'user.delete', `${targetUser.name} (${targetUser.email})`);
  saveDatabase();

  res.json({
    message: `Профилът на ${targetUser.name} (${targetUser.email}) беше изтрит окончателно.`,
  });
});

// -------------------------------------------------------------
// ISOLATED USER PROFILE DATA ENDPOINTS (AUTHENTICATED USER ONLY)
// -------------------------------------------------------------

app.get('/api/profile/data', requireAuth, (_req: Request, res: Response) => {
  const user = res.locals.currentUser as DbUser;
  const profile = getOrCreateUserProfile(user.id);
  res.json(profile);
});

app.patch('/api/profile', requireAuth, (req: Request, res: Response) => {
  const user = res.locals.currentUser as DbUser;
  const cleanName = cleanText(req.body?.name, 80);
  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ error: 'Името трябва да съдържа поне 2 символа.' });
  }

  user.name = cleanName;
  saveDatabase();

  res.json({ user: toSafeUser(user) });
});

app.put('/api/profile/favorites', requireAuth, (req: Request, res: Response) => {
  const user = res.locals.currentUser as DbUser;
  const rawFavorites = req.body?.favorites;
  if (!Array.isArray(rawFavorites)) {
    return res.status(400).json({ error: 'Невалиден формат за любими обекти.' });
  }

  const validPlaceIds = new Set(db.places.map((p) => p.id));
  const sanitizedFavorites = Array.from(
    new Set(
      rawFavorites
        .map((id) => cleanText(id, 100))
        .filter((id) => id && validPlaceIds.has(id))
    )
  ).slice(0, 200);

  const profile = getOrCreateUserProfile(user.id);
  profile.favorites = sanitizedFavorites;
  profile.updatedAt = new Date().toISOString();
  db.userProfiles[user.id] = profile;
  saveDatabase();

  res.json({ favorites: profile.favorites });
});

app.put('/api/profile/trail', requireAuth, (req: Request, res: Response) => {
  const user = res.locals.currentUser as DbUser;
  const rawTrail = req.body?.recentTrailIds;
  if (!Array.isArray(rawTrail)) {
    return res.status(400).json({ error: 'Невалиден формат за пътеката от стъпки.' });
  }

  const validPlaceIds = new Set(db.places.map((p) => p.id));
  const sanitizedTrailIds = rawTrail
    .map((id) => cleanText(id, 100))
    .filter((id) => id && validPlaceIds.has(id))
    .slice(-3);

  const profile = getOrCreateUserProfile(user.id);
  profile.recentTrailIds = sanitizedTrailIds;
  profile.updatedAt = new Date().toISOString();
  db.userProfiles[user.id] = profile;
  saveDatabase();

  res.json({ recentTrailIds: profile.recentTrailIds });
});

app.post('/api/profile/routes', requireAuth, (req: Request, res: Response) => {
  const user = res.locals.currentUser as DbUser;
  const body = req.body || {};

  const cleanTitle = cleanText(body.title, 140);
  if (!cleanTitle) {
    return res.status(400).json({ error: 'Името на маршрута е задължително.' });
  }

  if (!Array.isArray(body.stops) || body.stops.length < 2) {
    return res.status(400).json({ error: 'Маршрутът трябва да съдържа поне 2 спирки.' });
  }

  const sanitizedStops: RouteStop[] = [];
  for (let i = 0; i < Math.min(body.stops.length, 30); i++) {
    const rawStop = body.stops[i];
    if (!rawStop) continue;
    const placeId = cleanText(rawStop.placeId, 100);
    const placeName = cleanText(rawStop.placeName, 160);
    const coords = Array.isArray(rawStop.coordinates) ? rawStop.coordinates : [];
    const lat = Number(coords[0]);
    const lng = Number(coords[1]);
    if (!placeId || !placeName || !isValidBulgariaCoordinates(lat, lng)) {
      continue;
    }
    sanitizedStops.push({
      placeId,
      placeName,
      order: sanitizedStops.length + 1,
      notes: cleanText(rawStop.notes || '', 500),
      coordinates: [lat, lng],
    });
  }

  if (sanitizedStops.length < 2) {
    return res.status(400).json({ error: 'Маршрутът трябва да съдържа поне 2 валидни спирки.' });
  }

  const difficulty: DifficultyLevel = VALID_DIFFICULTIES.includes(body.difficulty)
    ? body.difficulty
    : 'Умерен';

  const profile = getOrCreateUserProfile(user.id);
  const requestedId = cleanText(body.id, 100);
  const existingIdx = requestedId
    ? profile.customRoutes.findIndex((r) => r.id === requestedId)
    : -1;

  const routeId =
    existingIdx !== -1
      ? profile.customRoutes[existingIdx].id
      : `custom-route-${user.id}-${Date.now()}`;

  const sanitizedRoute: Route = {
    id: routeId,
    title: cleanTitle,
    description: cleanText(body.description || '', 1200),
    duration: cleanText(body.duration || '2 часа', 60),
    durationHours: Number.isFinite(Number(body.durationHours))
      ? Math.max(1, Math.min(240, Math.round(Number(body.durationHours))))
      : undefined,
    totalDistance: cleanText(body.totalDistance || '0 км', 60),
    distanceKm: Number.isFinite(Number(body.distanceKm))
      ? Math.max(0, Math.min(5000, Number(body.distanceKm)))
      : undefined,
    difficulty,
    regionName: cleanText(body.regionName || 'България', 120),
    imageUrl: sanitizeImageUrl(body.imageUrl, '/places/belintash.jpg'),
    stops: sanitizedStops,
    isCustom: true,
    createdAt:
      existingIdx !== -1
        ? profile.customRoutes[existingIdx].createdAt || new Date().toISOString()
        : new Date().toISOString(),
  };

  if (existingIdx !== -1) {
    profile.customRoutes[existingIdx] = sanitizedRoute;
  } else {
    profile.customRoutes = [sanitizedRoute, ...profile.customRoutes].slice(0, 100);
  }

  profile.updatedAt = new Date().toISOString();
  db.userProfiles[user.id] = profile;
  saveDatabase();

  res.status(existingIdx !== -1 ? 200 : 201).json({
    route: sanitizedRoute,
    customRoutes: profile.customRoutes,
  });
});

app.delete('/api/profile/routes/:id', requireAuth, (req: Request, res: Response) => {
  const user = res.locals.currentUser as DbUser;
  const routeId = cleanText(req.params.id, 100);
  const profile = getOrCreateUserProfile(user.id);

  const nextRoutes = profile.customRoutes.filter((r) => r.id !== routeId);
  if (nextRoutes.length === profile.customRoutes.length) {
    return res.status(404).json({ error: 'Маршрутът не е намерен във вашия профил.' });
  }

  profile.customRoutes = nextRoutes;
  profile.updatedAt = new Date().toISOString();
  db.userProfiles[user.id] = profile;
  saveDatabase();

  res.json({ customRoutes: profile.customRoutes });
});

app.put('/api/profile/guide-chat', requireAuth, (req: Request, res: Response) => {
  const user = res.locals.currentUser as DbUser;
  const rawMessages = req.body?.messages;
  if (!Array.isArray(rawMessages)) {
    return res.status(400).json({ error: 'Невалиден формат за историята на чата.' });
  }

  const sanitizedMessages: ChatMessage[] = [];
  for (const msg of rawMessages.slice(-40)) {
    if (!msg || (msg.sender !== 'user' && msg.sender !== 'guide')) continue;
    const text = cleanText(msg.text, 6000);
    if (!text) continue;

    const webSources = Array.isArray(msg.webSources)
      ? msg.webSources
          .map((s: any) => {
            const uri = sanitizeExternalUrl(s?.uri);
            if (!uri) return null;
            return { title: cleanText(s?.title || uri, 120), uri };
          })
          .filter(Boolean)
          .slice(0, 6)
      : undefined;

    sanitizedMessages.push({
      id: cleanText(msg.id || `msg-${sanitizedMessages.length}`, 80),
      sender: msg.sender,
      text,
      timestamp: cleanText(msg.timestamp || '', 30),
      modelUsed: msg.modelUsed ? cleanText(msg.modelUsed, 60) : undefined,
      fallbackReason: msg.fallbackReason ? cleanText(msg.fallbackReason, 200) : undefined,
      suggestedPlaceIds: Array.isArray(msg.suggestedPlaceIds)
        ? msg.suggestedPlaceIds.map((id: unknown) => cleanText(id, 80)).filter(Boolean).slice(0, 6)
        : undefined,
      webSources: webSources && webSources.length > 0 ? webSources : undefined,
      searchQueries: Array.isArray(msg.searchQueries)
        ? msg.searchQueries.map((q: unknown) => cleanText(q, 120)).filter(Boolean).slice(0, 5)
        : undefined,
    });
  }

  const profile = getOrCreateUserProfile(user.id);
  profile.guideChatHistory = sanitizedMessages;
  profile.updatedAt = new Date().toISOString();
  db.userProfiles[user.id] = profile;
  saveDatabase();

  res.json({ guideChatHistory: profile.guideChatHistory });
});

app.get('/api/profile/activity', requireAuth, (_req: Request, res: Response) => {
  const user = res.locals.currentUser as DbUser;
  const mySuggestions = db.suggestions.filter((s) => s.userId === user.id);
  const myReviews = db.reviews.filter((r) => r.userId === user.id);
  res.json({ suggestions: mySuggestions, reviews: myReviews });
});

// -------------------------------------------------------------
// PLACES CRUD (ADMIN ONLY + STRICT WHITELIST VALIDATION)
// -------------------------------------------------------------

app.post('/api/places', requireAdmin, (req: Request, res: Response) => {
  const data = req.body || {};
  const cleanName = cleanText(data.name, 160);
  const cleanShortDesc = cleanText(data.shortDescription, 600);
  const latNum = parseFloat(String(data.latitude));
  const lngNum = parseFloat(String(data.longitude));

  if (!cleanName || !cleanShortDesc || !isValidBulgariaCoordinates(latNum, lngNum)) {
    return res.status(400).json({
      error: 'Моля, попълнете валидно име, описание и координати в границите на България.',
    });
  }

  const matchedRegion = REGIONS.find((r) => r.id === data.regionId);
  const matchedCategory = CATEGORIES.find((c) => c.id === data.categoryId);
  const difficulty: DifficultyLevel = VALID_DIFFICULTIES.includes(data.difficulty)
    ? data.difficulty
    : 'Умерен';

  const parsedAlt =
    data.altitude !== undefined && data.altitude !== ''
      ? Math.max(0, Math.min(3000, parseInt(String(data.altitude), 10) || 0))
      : undefined;

  const newPlace: Place = {
    id: 'place-' + crypto.randomUUID(),
    name: cleanName,
    slug: slugify(cleanName),
    regionId: matchedRegion?.id || 'south_central',
    regionName: matchedRegion?.name || cleanText(data.regionName || 'Южен централен (Родопи и Тракия)', 120),
    categoryId: matchedCategory?.id || 'sanctuaries',
    categoryName: matchedCategory?.name || cleanText(data.categoryName || 'Древни светилища', 100),
    latitude: latNum,
    longitude: lngNum,
    altitude: parsedAlt,
    elevationMeters: parsedAlt,
    shortDescription: cleanShortDesc,
    fullDescription: cleanText(data.fullDescription || cleanShortDesc, 4000),
    history: cleanText(data.history || '', 4000),
    accessTips: cleanText(data.accessTips || 'Проучете терена предварително.', 2000),
    terrainType: cleanText(data.terrainType || 'Планински', 100),
    difficulty,
    bestSeason: cleanText(data.bestSeason || 'Пролет - Есен', 100),
    imageUrl: sanitizeImageUrl(data.imageUrl, '/places/belintash.jpg'),
    imageCredit: cleanText(data.imageCredit || 'Скрито в България', 140),
    isVerified: true,
    isFeatured: Boolean(data.isFeatured),
    rating: 5.0,
    reviewCount: 0,
  };

  db.places.unshift(newPlace);
  recordAudit(res, 'place.create', `„${newPlace.name}“`);
  saveDatabase();
  res.status(201).json(newPlace);
});

app.put('/api/places/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = db.places.findIndex((p) => p.id === id || p.slug === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Обектът не е намерен.' });
  }

  const existing = db.places[idx];
  const body = req.body || {};

  const latNum =
    body.latitude !== undefined ? parseFloat(String(body.latitude)) : existing.latitude;
  const lngNum =
    body.longitude !== undefined ? parseFloat(String(body.longitude)) : existing.longitude;

  if (!isValidBulgariaCoordinates(latNum, lngNum)) {
    return res.status(400).json({
      error: 'Координатите трябва да са в границите на България (Ширина 41.0–44.5, Дължина 22.0–29.0).',
    });
  }

  const matchedRegion = body.regionId ? REGIONS.find((r) => r.id === body.regionId) : undefined;
  const matchedCategory = body.categoryId
    ? CATEGORIES.find((c) => c.id === body.categoryId)
    : undefined;
  const difficulty: DifficultyLevel = VALID_DIFFICULTIES.includes(body.difficulty)
    ? body.difficulty
    : existing.difficulty;

  const parsedAlt =
    body.altitude !== undefined && body.altitude !== ''
      ? Math.max(0, Math.min(3000, parseInt(String(body.altitude), 10) || 0))
      : existing.altitude;

  const updated: Place = {
    ...existing,
    name: body.name !== undefined ? cleanText(body.name, 160) || existing.name : existing.name,
    regionId: matchedRegion?.id || existing.regionId,
    regionName: matchedRegion?.name || existing.regionName,
    categoryId: matchedCategory?.id || existing.categoryId,
    categoryName: matchedCategory?.name || existing.categoryName,
    latitude: latNum,
    longitude: lngNum,
    altitude: parsedAlt,
    elevationMeters: parsedAlt ?? existing.elevationMeters,
    shortDescription:
      body.shortDescription !== undefined
        ? cleanText(body.shortDescription, 600) || existing.shortDescription
        : existing.shortDescription,
    fullDescription:
      body.fullDescription !== undefined
        ? cleanText(body.fullDescription, 4000) || existing.fullDescription
        : existing.fullDescription,
    history: body.history !== undefined ? cleanText(body.history, 4000) : existing.history,
    accessTips:
      body.accessTips !== undefined ? cleanText(body.accessTips, 2000) : existing.accessTips,
    terrainType:
      body.terrainType !== undefined
        ? cleanText(body.terrainType, 100) || existing.terrainType
        : existing.terrainType,
    difficulty,
    bestSeason:
      body.bestSeason !== undefined
        ? cleanText(body.bestSeason, 100) || existing.bestSeason
        : existing.bestSeason,
    imageUrl:
      body.imageUrl !== undefined
        ? sanitizeImageUrl(body.imageUrl, existing.imageUrl)
        : existing.imageUrl,
    imageCredit:
      body.imageCredit !== undefined
        ? cleanText(body.imageCredit, 140) || existing.imageCredit
        : existing.imageCredit,
    isFeatured: body.isFeatured !== undefined ? Boolean(body.isFeatured) : existing.isFeatured,
  };

  db.places[idx] = updated;
  recordAudit(res, 'place.update', `„${updated.name}“`);
  saveDatabase();
  res.json(updated);
});

app.delete('/api/places/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = db.places.findIndex((p) => p.id === id || p.slug === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Обектът не е намерен.' });
  }

  const deleted = db.places.splice(idx, 1)[0];
  recordAudit(res, 'place.delete', `„${deleted.name}“`);
  saveDatabase();
  res.json({ message: `Обектът "${deleted.name}" беше изтрит успешно.` });
});

app.patch('/api/places/:id/featured', requireAdmin, (req: Request, res: Response) => {
  const place = db.places.find((p) => p.id === req.params.id || p.slug === req.params.id);
  if (!place) {
    return res.status(404).json({ error: 'Обектът не е намерен.' });
  }
  place.isFeatured = Boolean((req.body || {}).isFeatured);
  recordAudit(res, place.isFeatured ? 'place.feature' : 'place.unfeature', `„${place.name}“`);
  saveDatabase();
  res.json(place);
});

// -------------------------------------------------------------
// FIELD GUIDE & LIVE WEATHER / SEARCH GROUNDING
// -------------------------------------------------------------

interface WebSearchResult {
  title: string;
  uri: string;
  snippet: string;
}

interface ToolExecutionResult {
  summary: string;
  sources: { title: string; uri: string }[];
  queries: string[];
  matchedPlaceIds: string[];
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/\[ID:\s*[^\]]+\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[\s(])__([^_\n]+)__(?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*\*\s+/gm, '• ')
    .replace(/\*\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function userExplicitlyRequestedLinks(message: string): boolean {
  const text = (message || '').toLowerCase();
  return /(линк|линкове|линка|линковете|връзка|връзки|уебсайт|уеб\s*сайт|сайт(?:а|ът|ове|овете)?|адрес(?:а|и|ите)?|\burl\b|страница\s+за\s+резерв|отвор(?:я|и|им|ете)|резервационн(?:а|и)\s+страниц|прати\s+.*(?:booking|букинг)|дай\s+.*(?:booking|букинг)|къде\s+да\s+(?:ги\s+)?резервирам|директ(?:ен|ни)\s+линк)/i.test(
    text
  );
}

function isHotelTopicQuery(text: string): boolean {
  return /(хотел|хотели|къщ(?:а|и)\s+за\s+гости|нощувк|настаняв|хиж(?:а|и)|спа\s+комплекс|почивка|апартамент(?:и)?\s+под\s+наем|booking|букинг)/i.test(
    (text || '').toLowerCase()
  );
}

function stripUrlsFromText(text: string): string {
  return text
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
    .replace(/\(\s*https?:\/\/[^\s)]+\s*\)/g, '')
    .replace(/(?:линк|сайт|booking(?:\.com)?\s*търсене|уеб\s*адрес|url)\s*[:\-–—]?\s*https?:\/\/\S+/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function calculateDistanceKmServer(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

function describeWmoCodeBg(code: number): string {
  if (code === 0) return 'Ясно и слънчево';
  if (code <= 2) return 'Предимно ясно до разкъсана облачност';
  if (code === 3) return 'Облачно';
  if (code === 45 || code === 48) return 'Мъгла';
  if (code >= 51 && code <= 57) return 'Слаб ръмеж';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Дъжд / валежи';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Снеговалеж';
  if (code >= 95) return 'Гръмотевична буря';
  return 'Променливо време';
}

const KNOWN_BG_PEAKS: { keys: string[]; name: string; lat: number; lon: number; elev: number }[] = [
  { keys: ['ботев', 'botev'], name: 'Връх Ботев (Стара планина)', lat: 42.7174, lon: 24.9168, elev: 2376 },
  { keys: ['мусала', 'musala'], name: 'Връх Мусала (Рила)', lat: 42.1792, lon: 23.5853, elev: 2925 },
  { keys: ['вихрен', 'vihren'], name: 'Връх Вихрен (Пирин)', lat: 41.7672, lon: 23.3989, elev: 2914 },
  { keys: ['черни връх', 'витоша'], name: 'Черни връх (Витоша)', lat: 42.5639, lon: 23.2783, elev: 2290 },
  { keys: ['мальовица', 'malyovitsa'], name: 'Връх Мальовица (Рила)', lat: 42.1742, lon: 23.3614, elev: 2729 },
  { keys: ['шипка', 'shipka'], name: 'Проход и връх Шипка', lat: 42.7483, lon: 25.3214, elev: 1326 },
  { keys: ['софия', 'sofia'], name: 'София', lat: 42.6977, lon: 23.3219, elev: 550 },
  { keys: ['пловдив', 'plovdiv'], name: 'Пловдив', lat: 42.1354, lon: 24.7453, elev: 164 },
  { keys: ['варна', 'varna'], name: 'Варна', lat: 43.2141, lon: 27.9147, elev: 35 },
  { keys: ['бургас', 'burgas'], name: 'Бургас', lat: 42.5048, lon: 27.4626, elev: 18 },
  { keys: ['банско', 'bansko'], name: 'Банско', lat: 41.8383, lon: 23.4885, elev: 925 },
  { keys: ['боровец', 'borovets'], name: 'Боровец', lat: 42.265, lon: 23.6061, elev: 1350 },
  { keys: ['пампорово', 'pamporovo'], name: 'Пампорово', lat: 41.6542, lon: 24.6967, elev: 1650 },
  { keys: ['смолян', 'родопи'], name: 'Смолян / Централни Родопи', lat: 41.5774, lon: 24.7011, elev: 1002 },
  { keys: ['велинград', 'velingrad'], name: 'Велинград', lat: 42.0275, lon: 23.9917, elev: 760 },
  { keys: ['велико търново', 'търново'], name: 'Велико Търново', lat: 43.0757, lon: 25.6172, elev: 210 },
  { keys: ['триград', 'trigrad'], name: 'Триград (Родопи)', lat: 41.5997, lon: 24.3806, elev: 1240 },
];

async function resolveBgLocation(
  query: string
): Promise<{ name: string; lat: number; lon: number; matchedPlaceIds: string[] } | null> {
  const lower = query.toLowerCase().trim();

  for (const peak of KNOWN_BG_PEAKS) {
    if (peak.keys.some((k) => lower.includes(k))) {
      return { name: peak.name, lat: peak.lat, lon: peak.lon, matchedPlaceIds: [] };
    }
  }

  for (const p of db.places) {
    const firstPart = p.name.toLowerCase().split('(')[0].trim();
    const coreTokens = firstPart
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= 4 &&
          !['пещера', 'водопад', 'крепост', 'скално', 'светилище', 'манастир', 'езеро', 'резерват'].includes(w)
      );
    if (lower.includes(firstPart) || coreTokens.some((tok) => lower.includes(tok))) {
      return { name: p.name, lat: p.latitude, lon: p.longitude, matchedPlaceIds: [p.id] };
    }
  }

  try {
    const cleanQ = query
      .replace(/времето|прогноза|хотели|цени|утре|днес|около|в|на|българия/gi, ' ')
      .trim()
      .slice(0, 60);
    if (cleanQ.length >= 2) {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        cleanQ
      )}&count=5&language=bg&format=json`;
      const r = await fetch(geoUrl, { signal: AbortSignal.timeout(3500) });
      if (r.ok) {
        const g: any = await r.json();
        const bgMatch = g?.results?.find((item: any) => item.country_code === 'BG') || g?.results?.[0];
        if (bgMatch) {
          return {
            name: `${bgMatch.name}${bgMatch.admin1 ? ` (${bgMatch.admin1})` : ''}`,
            lat: Number(bgMatch.latitude),
            lon: Number(bgMatch.longitude),
            matchedPlaceIds: [],
          };
        }
      }
    }
  } catch {
    // ignore geocode timeout
  }

  return null;
}

async function fetchBingRssResults(
  query: string,
  limit = 5
): Promise<{ title: string; uri: string; snippet: string }[]> {
  try {
    const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss&cc=BG&setlang=bg`;
    const r = await fetch(bingUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HiddenBulgariaGuide/2.0)' },
      signal: AbortSignal.timeout(4500),
    });
    if (!r.ok) return [];
    const xml = await r.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const out: { title: string; uri: string; snippet: string }[] = [];
    for (const item of items) {
      if (out.length >= limit) break;
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
      const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);
      const title = titleMatch ? decodeXmlEntities(titleMatch[1]) : '';
      const uri = linkMatch ? sanitizeExternalUrl(decodeXmlEntities(linkMatch[1])) : null;
      const snippet = descMatch ? decodeXmlEntities(descMatch[1]) : '';
      if (title && uri) {
        out.push({ title: cleanText(title, 110), uri, snippet: cleanText(snippet, 260) });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function executeWeatherForecastTool(locationQuery: string): Promise<ToolExecutionResult> {
  const sources: { title: string; uri: string }[] = [];
  const queries: string[] = [];
  const loc =
    (await resolveBgLocation(locationQuery)) || {
      name: locationQuery.trim() || 'София',
      lat: 42.6977,
      lon: 23.3219,
      matchedPlaceIds: [],
    };

  const cleanLocName = loc.name.split('(')[0].trim();
  const sinoptikSearchUrl = `https://www.sinoptik.bg/search?q=${encodeURIComponent(cleanLocName)}`;
  queries.push(`прогноза времето ${cleanLocName} 7 дни`);

  try {
    const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,apparent_temperature,precipitation,cloud_cover,weather_code,wind_speed_10m,wind_gusts_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,cloud_cover_mean,weather_code&timezone=Europe%2FSofia&forecast_days=7`;
    const [meteoRes, sinoptikHits] = await Promise.all([
      fetch(meteoUrl, { signal: AbortSignal.timeout(4500) }),
      fetchBingRssResults(`site:sinoptik.bg ${cleanLocName} прогноза`, 2),
    ]);

    if (sinoptikHits.length > 0) {
      sources.push({ title: sinoptikHits[0].title, uri: sinoptikHits[0].uri });
    } else {
      sources.push({ title: `Sinoptik.bg — ${cleanLocName}`, uri: sinoptikSearchUrl });
    }
    sources.push({ title: `Open-Meteo 7-дневна прогноза: ${cleanLocName}`, uri: 'https://open-meteo.com/en/docs' });

    if (!meteoRes.ok) {
      return {
        summary: `Не успях да заредя метеорологичната прогноза за ${loc.name} в момента. Проверете директно на ${sinoptikSearchUrl}.`,
        sources,
        queries,
        matchedPlaceIds: loc.matchedPlaceIds,
      };
    }

    const data: any = await meteoRes.json();
    const cur = data?.current;
    const daily = data?.daily;
    const lines: string[] = [];

    if (cur) {
      lines.push(
        `Текущи условия за ${loc.name} (${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)}): ${cur.temperature_2m}°C (усеща се като ${cur.apparent_temperature}°C), ${describeWmoCodeBg(Number(cur.weather_code ?? 0))}, облачност ${cur.cloud_cover ?? 0}%, вятър ${cur.wind_speed_10m} км/ч (пориви до ${cur.wind_gusts_10m ?? cur.wind_speed_10m} км/ч), текущи валежи ${cur.precipitation ?? 0} мм.`
      );
    }

    const warnings: string[] = [];
    if (daily && Array.isArray(daily.time)) {
      lines.push('Прогноза за следващите 7 дни (днес, утре и напред):');
      for (let i = 0; i < Math.min(7, daily.time.length); i++) {
        const dayStr = daily.time[i];
        const dayTag = i === 0 ? 'Днес' : i === 1 ? 'Утре' : dayStr;
        const tMin = daily.temperature_2m_min?.[i];
        const tMax = daily.temperature_2m_max?.[i];
        const rainProb = daily.precipitation_probability_max?.[i] ?? 0;
        const rainMm = daily.precipitation_sum?.[i] ?? 0;
        const windMax = daily.wind_speed_10m_max?.[i] ?? 0;
        const gustsMax = daily.wind_gusts_10m_max?.[i] ?? windMax;
        const clouds = daily.cloud_cover_mean?.[i] ?? 0;
        const code = Number(daily.weather_code?.[i] ?? 0);
        const cond = describeWmoCodeBg(code);

        lines.push(
          `- ${dayTag} (${dayStr}): мин ${tMin}°C / макс ${tMax}°C, ${cond}, облачност ${clouds}%, вероятност за валежи ${rainProb}% (${rainMm} мм), вятър до ${windMax} км/ч (пориви ${gustsMax} км/ч).`
        );

        if (code >= 95) {
          warnings.push(`${dayTag}: опасност от гръмотевична буря.`);
        } else if (Number(gustsMax) >= 60 || Number(windMax) >= 45) {
          warnings.push(`${dayTag}: силен вятър с пориви до ${gustsMax} км/ч — внимание по планински била.`);
        }
        if (Number(rainMm) >= 15) {
          warnings.push(`${dayTag}: очакват се интензивни валежи (${rainMm} мм).`);
        }
        if (Number(tMin) <= -5) {
          warnings.push(`${dayTag}: ниски отрицателни температури (${tMin}°C) — риск от заледяване.`);
        }
      }
    }

    if (warnings.length > 0) {
      lines.push(`Метеорологични предупреждения: ${warnings.slice(0, 3).join(' ')}`);
    } else {
      lines.push('Няма екстремни метеорологични предупреждения за периода, но следете планинската обстановка.');
    }

    if (sinoptikHits.length > 0 && sinoptikHits[0].snippet) {
      lines.push(`Sinoptik.bg бележка: ${sinoptikHits[0].snippet} (${sinoptikHits[0].uri})`);
    }

    return {
      summary: lines.join('\n'),
      sources,
      queries,
      matchedPlaceIds: loc.matchedPlaceIds,
    };
  } catch {
    return {
      summary: `Временен проблем при зареждане на метео данни за ${loc.name}. Проверете ${sinoptikSearchUrl}.`,
      sources,
      queries,
      matchedPlaceIds: loc.matchedPlaceIds,
    };
  }
}

async function executeHotelSearchTool(
  destination: string,
  budget?: string,
  includeLinks = false
): Promise<ToolExecutionResult> {
  const sources: { title: string; uri: string }[] = [];
  const queries: string[] = [];
  const cleanDest = destination.trim() || 'България';
  const loc = await resolveBgLocation(cleanDest);
  const searchDestName = (loc?.name || cleanDest).split('(')[0].trim();

  const bookingSearchUrl = `https://www.booking.com/searchresults.bg.html?ss=${encodeURIComponent(
    `${searchDestName}, България`
  )}`;
  if (includeLinks) {
    sources.push({ title: `Booking.com оферти за ${searchDestName}`, uri: bookingSearchUrl });
  }
  queries.push(`Booking.com ${searchDestName} хотели цени`);

  const lines: string[] = [
    `Търсене на хотели и настаняване за: ${searchDestName}${budget ? ` (Бюджет/предпочитание: ${budget})` : ''}`,
  ];
  if (includeLinks) {
    lines.push(`Директен линк за актуални цени и свободни стаи в Booking.com: ${bookingSearchUrl}`);
  }

  const [bookingHits, generalHotelHits, osmHotels, osmGuestHouses] = await Promise.all([
    fetchBingRssResults(`Booking.com ${searchDestName} хотели цени`, 5),
    fetchBingRssResults(`${searchDestName} хотели цени нощувка`, 4),
    (async () => {
      try {
        const nomUrl = loc
          ? `https://nominatim.openstreetmap.org/search?q=hotel&format=jsonv2&limit=6&bounded=1&viewbox=${
              loc.lon - 0.25
            },${loc.lat + 0.25},${loc.lon + 0.25},${loc.lat - 0.25}&extratags=1&addressdetails=1`
          : `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              `хотел ${searchDestName} България`
            )}&format=jsonv2&limit=5&extratags=1&addressdetails=1`;
        const r = await fetch(nomUrl, {
          headers: { 'User-Agent': 'HiddenBulgariaAtlas/2.0' },
          signal: AbortSignal.timeout(4000),
        });
        return r.ok ? ((await r.json()) as any[]) : [];
      } catch {
        return [];
      }
    })(),
    (async () => {
      if (!loc) return [];
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          'guest_house'
        )}&format=jsonv2&limit=4&bounded=1&viewbox=${loc.lon - 0.22},${loc.lat + 0.22},${
          loc.lon + 0.22
        },${loc.lat - 0.22}&extratags=1&addressdetails=1`;
        const r = await fetch(nomUrl, {
          headers: { 'User-Agent': 'HiddenBulgariaAtlas/2.0' },
          signal: AbortSignal.timeout(3500),
        });
        return r.ok ? ((await r.json()) as any[]) : [];
      } catch {
        return [];
      }
    })(),
  ]);

  const combinedOsm = [...(Array.isArray(osmHotels) ? osmHotels : []), ...(Array.isArray(osmGuestHouses) ? osmGuestHouses : [])];
  if (combinedOsm.length > 0) {
    lines.push(`Реални хотели и къщи за гости в района на ${searchDestName} (OpenStreetMap):`);
    const seenNames = new Set<string>();
    for (const item of combinedOsm) {
      const name = String(item.name || item.display_name?.split(',')[0] || '').trim();
      if (!name || seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());
      const stars = item.extratags?.stars ? `${item.extratags.stars}★` : '';
      const website = sanitizeExternalUrl(item.extratags?.website || item.extratags?.url);
      const phone = item.extratags?.phone || item.extratags?.['contact:phone'] || '';
      const town = item.address?.city || item.address?.town || item.address?.village || '';
      const bookingItemUrl = `https://www.booking.com/searchresults.bg.html?ss=${encodeURIComponent(
        `${name} ${searchDestName}`
      )}`;
      if (includeLinks) {
        if (website) {
          sources.push({ title: `${name} — Официален сайт`, uri: website });
        }
        sources.push({ title: `${name} в Booking.com`, uri: bookingItemUrl });
        lines.push(
          `- ${name}${stars ? ` (${stars})` : ''}${town ? `, ${town}` : ''}${phone ? `, тел: ${phone}` : ''}${
            website ? `, сайт: ${website}` : ''
          } | Booking линк: ${bookingItemUrl}`
        );
      } else {
        lines.push(
          `- ${name}${stars ? ` (${stars})` : ''}${town ? `, ${town}` : ''}${phone ? `, тел: ${phone}` : ''}`
        );
      }
      if (seenNames.size >= 6) break;
    }
  }

  const allWebHits = [...bookingHits, ...generalHotelHits];
  if (allWebHits.length > 0) {
    lines.push('Уеб резултати и оферти от Booking.com / туристически портали:');
    for (const hit of allWebHits.slice(0, 6)) {
      if (includeLinks) {
        sources.push({ title: hit.title, uri: hit.uri });
        lines.push(`- ${hit.title}: ${hit.snippet} (${hit.uri})`);
      } else {
        lines.push(`- ${hit.title}: ${hit.snippet}`);
      }
    }
  }

  lines.push(
    'ВАЖНО ПРАВИЛО ЗА ЦЕНИТЕ: Посочвай само конкретни цени, които действително присъстват в горните уеб резултати или Google Search. Ако за конкретен хотел няма изрично изписана актуална цена на нощувка в резултата, НЕ измисляй цифра.'
  );
  if (includeLinks) {
    lines.push(
      'ВАЖНО ПРАВИЛО ЗА ЛИНКОВЕТЕ: Потребителят ИЗРИЧНО ПОИСКА ЛИНКОВЕ. Предостави директни, кликаеми https://... линкове към хотелите и Booking.com на отделни редове (напр. Име на хотела: https://...).'
    );
  } else {
    lines.push(
      'ВАЖНО ПРАВИЛО ЗА ЛИНКОВЕТЕ: Потребителят НЕ е поискал линкове в този въпрос. Дай САМО реалните имена на хотелите/къщите за гости, характеристиките и проверените цени (ако има налични) — БЕЗ никакви http/https линкове в отговора! В края спомени кратко, че при желание може да поиска линкове и веднага ще ги изпратиш.'
    );
  }

  return {
    summary: lines.join('\n'),
    sources,
    queries,
    matchedPlaceIds: loc?.matchedPlaceIds || [],
  };
}

async function executePlacesAndDiningTool(destinationOrTopic: string): Promise<ToolExecutionResult> {
  const sources: { title: string; uri: string }[] = [];
  const queries: string[] = [];
  const matchedPlaceIds: string[] = [];
  const lower = destinationOrTopic.toLowerCase();
  const loc = await resolveBgLocation(destinationOrTopic);
  const topicLabel = (loc?.name || destinationOrTopic).split('(')[0].trim();

  queries.push(`${topicLabel} забележителности ресторанти работно време цени билети`);

  const matchedCatalog = db.places.filter((p) => {
    const pName = p.name.toLowerCase();
    const pReg = p.regionName.toLowerCase();
    if (lower.includes(pName.split('(')[0].trim()) || pReg.includes(lower)) return true;
    if (loc) {
      return calculateDistanceKmServer(loc.lat, loc.lon, p.latitude, p.longitude) <= 35;
    }
    return false;
  });

  const lines: string[] = [];
  if (matchedCatalog.length > 0) {
    lines.push(`Близки и свързани обекти от каталога на сайта (${matchedCatalog.length}):`);
    for (const p of matchedCatalog.slice(0, 6)) {
      matchedPlaceIds.push(p.id);
      lines.push(
        `- ${p.name} (${p.categoryName}, Трудност: ${p.difficulty}, Сезон: ${p.bestSeason}): ${p.shortDescription} | Достъп: ${p.accessTips}`
      );
    }
  }

  const [webInfoHits, osmRestaurants, wikiHits] = await Promise.all([
    fetchBingRssResults(`${topicLabel} работно време билети забележителности`, 4),
    (async () => {
      if (!loc) return [];
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=restaurant&format=jsonv2&limit=5&bounded=1&viewbox=${
          loc.lon - 0.18
        },${loc.lat + 0.18},${loc.lon + 0.18},${loc.lat - 0.18}&extratags=1&addressdetails=1`;
        const r = await fetch(nomUrl, {
          headers: { 'User-Agent': 'HiddenBulgariaAtlas/2.0' },
          signal: AbortSignal.timeout(3500),
        });
        return r.ok ? ((await r.json()) as any[]) : [];
      } catch {
        return [];
      }
    })(),
    (async () => {
      try {
        const wikiUrl = `https://bg.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          topicLabel
        )}&srlimit=2&format=json&utf8=1`;
        const r = await fetch(wikiUrl, {
          headers: { 'User-Agent': 'HiddenBulgariaGuide/2.0' },
          signal: AbortSignal.timeout(3500),
        });
        if (!r.ok) return [];
        const data: any = await r.json();
        return data?.query?.search || [];
      } catch {
        return [];
      }
    })(),
  ]);

  if (Array.isArray(osmRestaurants) && osmRestaurants.length > 0) {
    lines.push(`Реални ресторанти и заведения около ${topicLabel} (OpenStreetMap):`);
    for (const item of osmRestaurants.slice(0, 5)) {
      const n = String(item.name || item.display_name?.split(',')[0] || '').trim();
      if (!n) continue;
      const cuisine = item.extratags?.cuisine ? ` (${item.extratags.cuisine})` : '';
      const hours = item.extratags?.opening_hours ? `, раб. време: ${item.extratags.opening_hours}` : '';
      const web = sanitizeExternalUrl(item.extratags?.website || item.extratags?.url);
      if (web) sources.push({ title: `${n} — Ресторант`, uri: web });
      lines.push(`- ${n}${cuisine}${hours}${web ? ` — ${web}` : ''}`);
    }
  }

  if (webInfoHits.length > 0) {
    lines.push('Актуални уеб данни за билети, работно време и забележителности:');
    for (const hit of webInfoHits) {
      sources.push({ title: hit.title, uri: hit.uri });
      lines.push(`- ${hit.title}: ${hit.snippet} (${hit.uri})`);
    }
  }

  if (Array.isArray(wikiHits) && wikiHits.length > 0) {
    for (const hit of wikiHits.slice(0, 2)) {
      const title = String(hit.title || '');
      const snippet = decodeXmlEntities(String(hit.snippet || ''));
      const uri = `https://bg.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
      if (title && snippet) {
        sources.push({ title: `${title} — Уикипедия`, uri });
        lines.push(`Уикипедия (${title}): ${snippet}`);
      }
    }
  }

  return {
    summary: lines.join('\n') || `Няма допълнителни уеб резултати за ${topicLabel}.`,
    sources,
    queries,
    matchedPlaceIds,
  };
}

async function executeRoutePlannerTool(
  regionOrPlaces: string,
  days = 2
): Promise<ToolExecutionResult> {
  const lower = regionOrPlaces.toLowerCase();
  const loc = await resolveBgLocation(regionOrPlaces);

  let candidatePlaces = db.places.filter((p) => {
    const first = p.name.toLowerCase().split('(')[0].trim();
    return (
      lower.includes(first) ||
      p.regionName.toLowerCase().includes(lower) ||
      lower.includes(p.regionName.split('(')[0].trim().toLowerCase())
    );
  });

  if (candidatePlaces.length < 3 && loc) {
    candidatePlaces = [...db.places]
      .map((p) => ({
        place: p,
        dist: calculateDistanceKmServer(loc.lat, loc.lon, p.latitude, p.longitude),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6)
      .map((x) => x.place);
  }

  if (candidatePlaces.length === 0) {
    candidatePlaces = db.places.filter((p) => p.isFeatured).slice(0, 5);
  }

  const matchingRoutes = ROUTES.filter(
    (r) =>
      r.regionName.toLowerCase().includes(lower) ||
      r.title.toLowerCase().includes(lower) ||
      r.stops.some((s) => candidatePlaces.some((cp) => cp.id === s.placeId))
  );

  const lines: string[] = [
    `Препоръки за ${days}-дневен маршрут (${regionOrPlaces}):`,
  ];

  if (matchingRoutes.length > 0) {
    lines.push('Готови маршрути в раздела „Маршрути“ на сайта:');
    for (const r of matchingRoutes.slice(0, 3)) {
      lines.push(
        `- ${r.title} (${r.regionName}, ${r.duration}, ${r.totalDistance}, трудност: ${r.difficulty}): спирки ${r.stops
          .map((s) => s.placeName)
          .join(' -> ')}`
      );
    }
  }

  lines.push('Спирки от каталога с реални координати и съвети:');
  const chosen = candidatePlaces.slice(0, 6);
  for (let i = 0; i < chosen.length; i++) {
    const p = chosen[i];
    const next = chosen[i + 1];
    const distStr = next
      ? ` (разстояние до ${next.name}: ~${calculateDistanceKmServer(
          p.latitude,
          p.longitude,
          next.latitude,
          next.longitude
        )} км по права линия)`
      : '';
    lines.push(
      `- ${p.name} [${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}], Трудност: ${p.difficulty}, Сезон: ${p.bestSeason}. ${p.accessTips}${distStr}`
    );
  }

  return {
    summary: lines.join('\n'),
    sources: [],
    queries: [`маршрут ${regionOrPlaces} ${days} дни`],
    matchedPlaceIds: chosen.map((p) => p.id),
  };
}

const weatherToolDecl: FunctionDeclaration = {
  name: 'checkWeatherForecast',
  description:
    'Проверява реалната прогноза за времето за днес, утре и следващите 5-7 дни за даден град, курорт, планина или забележителност в България (температури, вероятност за дъжд, вятър, облачност, предупреждения и Sinoptik.bg връзка).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: {
        type: Type.STRING,
        description: 'Име на град, село, планински връх или забележителност в България (напр. Банско, Белинташ, връх Ботев).',
      },
    },
    required: ['location'],
  },
};

const hotelToolDecl: FunctionDeclaration = {
  name: 'searchHotelsAndBooking',
  description:
    'Търси реални хотели, къщи за гости, ценови оферти и Booking.com линкове около дестинация в България.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      destination: {
        type: Type.STRING,
        description: 'Дестинация, град или забележителност в България (напр. Банско, Триград, Родопи).',
      },
      budget: {
        type: Type.STRING,
        description: 'Бюджет или тип настаняване по желание (напр. бюджетен, семеен, СПА).',
      },
    },
    required: ['destination'],
  },
};

const placesDiningToolDecl: FunctionDeclaration = {
  name: 'searchPlacesAndRestaurants',
  description:
    'Търси забележителности от каталога на сайта, ресторанти, работно време и цени на билети за дадена дестинация.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: {
        type: Type.STRING,
        description: 'Място, град, ресторант или забележителност за проверка.',
      },
    },
    required: ['topic'],
  },
};

const routePlannerToolDecl: FunctionDeclaration = {
  name: 'planBulgariaRoute',
  description:
    'Подбира последователни спирки от каталога на сайта и готови маршрути с разстояния и координати за пътуване в България.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      regionOrPlaces: {
        type: Type.STRING,
        description: 'Регион или желани обекти/градове в България.',
      },
      days: {
        type: Type.NUMBER,
        description: 'Брой дни за пътуването (напр. 1, 2, 3).',
      },
    },
    required: ['regionOrPlaces'],
  },
};

async function dispatchGuideToolCall(
  name: string,
  args: Record<string, any>,
  options: { includeLinks: boolean }
): Promise<ToolExecutionResult> {
  if (name === 'checkWeatherForecast') {
    return executeWeatherForecastTool(String(args?.location || 'София'));
  }
  if (name === 'searchHotelsAndBooking') {
    return executeHotelSearchTool(
      String(args?.destination || 'България'),
      args?.budget ? String(args.budget) : undefined,
      options.includeLinks
    );
  }
  if (name === 'searchPlacesAndRestaurants') {
    return executePlacesAndDiningTool(String(args?.topic || 'България'));
  }
  if (name === 'planBulgariaRoute') {
    return executeRoutePlannerTool(
      String(args?.regionOrPlaces || 'Родопи'),
      Number.isFinite(Number(args?.days)) ? Number(args.days) : 2
    );
  }
  return {
    summary: 'Непозната заявка към инструмент.',
    sources: [],
    queries: [],
    matchedPlaceIds: [],
  };
}

async function performLiveWebSearch(
  userQuery: string,
  _catalogPlaces: Place[],
  options: { includeLinks: boolean; fallbackContextText?: string } = { includeLinks: false }
): Promise<{
  sources: { title: string; uri: string }[];
  queries: string[];
  contextSummary: string;
  matchedPlaceIds: string[];
}> {
  const sources: { title: string; uri: string }[] = [];
  const contextLines: string[] = [];
  const queries: string[] = [];
  const matchedPlaceIds: string[] = [];
  const lowerQ = userQuery.toLowerCase();

  const isWeatherQuery =
    /(врем|прогноз|температур|градус|сняг|снеж|дъжд|вятър|буря|мъгла|слънц|облач|синоптик|sinoptik)/i.test(
      lowerQ
    );
  const isHotelOrPriceQuery =
    /(хотел|къщ|нощувк|настаняв|хиж|цена|цени|booking|букинг|евтин|лукс|спа|резервац)/i.test(lowerQ) ||
    (options.includeLinks && isHotelTopicQuery(options.fallbackContextText || ''));
  const isRouteQuery = /(маршрут|обиколк|уикенд|дни|план|пътуване|експедиц)/i.test(lowerQ);

  const tasks: Promise<void>[] = [];

  if (isWeatherQuery) {
    tasks.push(
      (async () => {
        const res = await executeWeatherForecastTool(userQuery);
        contextLines.push(res.summary);
        sources.push(...res.sources);
        queries.push(...res.queries);
        matchedPlaceIds.push(...res.matchedPlaceIds);
      })()
    );
  }

  if (isHotelOrPriceQuery) {
    tasks.push(
      (async () => {
        const destinationQuery =
          options.fallbackContextText &&
          /(тези|тях|горните|предишните|изброените)/i.test(lowerQ)
            ? `${userQuery} ${options.fallbackContextText.slice(0, 180)}`
            : userQuery;
        const res = await executeHotelSearchTool(destinationQuery, undefined, options.includeLinks);
        contextLines.push(res.summary);
        sources.push(...res.sources);
        queries.push(...res.queries);
        matchedPlaceIds.push(...res.matchedPlaceIds);
      })()
    );
  }

  if (isRouteQuery) {
    tasks.push(
      (async () => {
        const res = await executeRoutePlannerTool(userQuery, 2);
        contextLines.push(res.summary);
        sources.push(...res.sources);
        queries.push(...res.queries);
        matchedPlaceIds.push(...res.matchedPlaceIds);
      })()
    );
  }

  if (!isWeatherQuery && !isHotelOrPriceQuery) {
    tasks.push(
      (async () => {
        const res = await executePlacesAndDiningTool(userQuery);
        contextLines.push(res.summary);
        sources.push(...res.sources);
        queries.push(...res.queries);
        matchedPlaceIds.push(...res.matchedPlaceIds);
      })()
    );
  }

  await Promise.allSettled(tasks);

  const uniqueSources: { title: string; uri: string }[] = [];
  const seenUris = new Set<string>();
  for (const s of sources) {
    const safeUri = sanitizeExternalUrl(s.uri);
    if (safeUri && !seenUris.has(safeUri)) {
      seenUris.add(safeUri);
      uniqueSources.push({ title: s.title, uri: safeUri });
    }
  }

  return {
    sources: uniqueSources.slice(0, 8),
    queries: Array.from(new Set(queries)).slice(0, 4),
    contextSummary: contextLines.join('\n\n'),
    matchedPlaceIds: Array.from(new Set(matchedPlaceIds)),
  };
}

async function handleGuideChat(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const { message, history, image, mimeType } = req.body || {};
    const hasImage = Boolean(image && typeof image === 'string' && image.length > 20);
    const cleanMsg = typeof message === 'string' ? message.trim().slice(0, 2000) : '';

    if (!cleanMsg && !hasImage) {
      return res.status(400).json({ error: 'Моля, задайте въпрос или качете снимка за Пътеводителя.' });
    }

    let safeMime = 'image/jpeg';
    let cleanBase64 = '';
    if (hasImage) {
      safeMime =
        typeof mimeType === 'string' && ALLOWED_IMAGE_MIMES.has(mimeType) ? mimeType : 'image/jpeg';
      cleanBase64 = image.includes(';base64,') ? image.split(';base64,')[1] : image;
      const estimatedBytes = Math.ceil((cleanBase64.length * 3) / 4);
      if (estimatedBytes > MAX_BASE64_IMAGE_BYTES) {
        return res.status(400).json({ error: 'Изображението надвишава допустимия размер от 8 MB.' });
      }
    }

    const aiClient = getAiClient();
    if (!aiClient) {
      return res.status(503).json({
        error:
          'Теренният съветник в момента не е конфигуриран (липсва GEMINI_API_KEY в настройките на сървъра).',
      });
    }

    const nowBg = new Date().toLocaleString('bg-BG', {
      timeZone: 'Europe/Sofia',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const lowerPrompt = cleanMsg.toLowerCase();
    const relevantPlaces = db.places.filter((p) => {
      const first = p.name.toLowerCase().split('(')[0].trim();
      return (
        lowerPrompt.includes(first) ||
        lowerPrompt.includes(p.regionName.toLowerCase().split('(')[0].trim())
      );
    });
    const detailedIds = new Set(relevantPlaces.slice(0, 8).map((p) => p.id));

    const catalogContext = db.places
      .map((p) =>
        detailedIds.has(p.id)
          ? `[ID: ${p.id}] ${p.name} (${p.categoryName}, ${p.regionName}, ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}, Трудност: ${p.difficulty}, Сезон: ${p.bestSeason}): ${p.shortDescription}`
          : `[ID: ${p.id}] ${p.name} (${p.categoryName}, ${p.regionName.split('(')[0].trim()}, ${p.difficulty})`
      )
      .join('\n');

    const wantsLinks = userExplicitlyRequestedLinks(cleanMsg);
    const hotelQueryDetected = isHotelTopicQuery(cleanMsg);
    let hotelToolUsed = false;

    const hotelLinkRule = wantsLinks
      ? 'ПОТРЕБИТЕЛЯТ ПОИСКА ЛИНКОВЕ: Включи директни, кликаеми https://... линкове към хотелите/местата и Booking.com на ясни нови редове (напр. Име на хотел: https://...), без Markdown удебеляване (**), така че потребителят да може да ги отвори веднага.'
      : 'ПРАВИЛО ЗА ХОТЕЛИ БЕЗ ЛИНКОВЕ (МНОГО ВАЖНО): Потребителят НЕ е поискал линкове! За въпроси за хотели и настаняване изброявай САМО реалните имена на хотелите/къщите за гости, района/особеностите и проверените цени (ако има налични). СТРОГО ЗАБРАНЕНО Е да включваш URL адреси, уеб линкове (http/https) или Markdown линкове в отговора си! В края добави едно кратко изречение, че при желание можеш веднага да изпратиш директни линкове към тези хотели или Booking.com.';

    const baseSystemInstruction = `Ти си „Пътеводителят“ на платформата „Скрито в България“ — интелигентен краевед, туристически консултант и планински водач с достъп до ${db.places.length} верифицирани обекта в България, Google Търсене и специализирани инструменти в реално време.

ТЕКУЩА ДАТА И ЧАС В БЪЛГАРИЯ: ${nowBg}

ПРАВИЛА ЗА ИНСТРУМЕНТИТЕ И ТОЧНОСТТА:
1. АВТОМАТИЧЕН ИЗБОР НА ИНСТРУМЕНТИ:
   - За въпрос за времето / прогнозата (днес, утре, следващите 5-7 дни): задължително извикай checkWeatherForecast и посочи минимални/максимални температури, вероятност за дъжд, количество валежи, вятър, облачност и предупреждения, ако има такива.
   - За въпрос за хотели, нощувки, цени или Booking.com: задължително извикай searchHotelsAndBooking (и Google Search при нужда). Предлагай реални места за настаняване според бюджета/предпочитанията, сравнявай цени само ако са намерени в реалните резултати. НИКОГА не измисляй цени! ${hotelLinkRule}
   - За въпрос за ресторанти, забележителности, работно време или входни билети: извикай searchPlacesAndRestaurants и Google Search.
   - За планиране на маршрути и екскурзии: извикай planBulgariaRoute и свържи препоръките с обектите от каталога.
2. ФОРМАТИРАНЕ НА ОТГОВОРИТЕ (СТРОГО ЗАДЪЛЖИТЕЛНО):
   - Пиши на естествен, ясен и подреден български език с кратки абзаци и тирета (-) или точки (•) за списъци.
   - НИКОГА не използвай Markdown символи за удебеляване (** или __) и НИКОГА не използвай символи # / ## / ### за заглавия! Вместо това използвай чист текст, главни букви за кратки секции при нужда, и нови редове.
3. ВИЗУАЛНО РАЗПОЗНАВАНЕ НА СНИМКИ:
   - При качена или заснета снимка разпознай обекта или района в България и дай практически насоки за достъп.
4. БЕЗОПАСНОСТ:
   - При планински преходи или неблагоприятно време напомняй спешните номера: 112 (Спешна помощ) и ПСС 1470 / +359 2 963 2000.

НАЛИЧЕН КАТАЛОГ С МЕСТА НА САЙТА:
${catalogContext}`;

    const rawTurns: { role: 'user' | 'model'; text: string }[] = [];
    if (Array.isArray(history)) {
      for (const turn of history.slice(-10)) {
        if (
          turn &&
          (turn.role === 'user' || turn.role === 'model') &&
          typeof turn.text === 'string' &&
          turn.text.trim()
        ) {
          const text = turn.text.trim().slice(0, 2000);
          if (rawTurns.length === 0 && turn.role === 'model') {
            continue;
          }
          const last = rawTurns[rawTurns.length - 1];
          if (last && last.role === turn.role) {
            last.text = `${last.text}\n${text}`.slice(0, 2000);
          } else {
            rawTurns.push({ role: turn.role, text });
          }
        }
      }
    }
    if (rawTurns.length > 0 && rawTurns[rawTurns.length - 1].role === 'user') {
      rawTurns.pop();
    }

    const baseHistory: any[] = rawTurns.map((t) => ({
      role: t.role,
      parts: [{ text: t.text }],
    }));

    const userPromptText =
      cleanMsg ||
      'Моля, разпознай това място, скален феномен, светилище или природен кът в България от снимката. Кажи ми как се казва, в кой регион е, как се стига дотам и какво е неговото историческо или природно значение.';

    const buildContents = (extraWebContext?: string) => {
      const userParts: any[] = [];
      if (hasImage) {
        userParts.push({
          inlineData: {
            mimeType: safeMime,
            data: cleanBase64,
          },
        });
      }
      const combinedText = extraWebContext
        ? `${userPromptText}\n\n[АКТУАЛНИ ДАННИ В РЕАЛНО ВРЕМЕ (${nowBg})]:\n${extraWebContext}`
        : userPromptText;
      userParts.push({ text: combinedText });
      return [...baseHistory, { role: 'user', parts: userParts }];
    };

    const modelTiers = [
      { id: 'gemini-4-hydrogen', name: 'Gemini 4 Hydrogen', supportsThinkingLow: true },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', supportsThinkingLow: false },
    ];

    let response: any = null;
    let successfulModelName = modelTiers[0].name;
    let fallbackNotice: string | null = null;
    let lastErrorStatus = 502;
    let lastErrorMessage = 'Временна грешка при връзка с услугата на Пътеводителя.';
    let authFatalError = false;
    const collectedToolSources: { title: string; uri: string }[] = [];
    const collectedToolQueries: string[] = [];
    const collectedToolPlaceIds: string[] = [];
    let usedLiveWebFallback: {
      sources: { title: string; uri: string }[];
      queries: string[];
      contextSummary: string;
      matchedPlaceIds: string[];
    } | null = null;

    const classifyError = (
      errMsg: string,
      modelId: string
    ): { fatalAuth: boolean; status: number; userMsg: string; reason: string } => {
      if (
        errMsg.includes('403') ||
        errMsg.includes('401') ||
        errMsg.includes('PERMISSION_DENIED') ||
        errMsg.includes('API_KEY_INVALID') ||
        errMsg.includes('API key not valid')
      ) {
        return {
          fatalAuth: true,
          status: 403,
          userMsg: 'Конфигурираният GEMINI_API_KEY е невалиден или няма необходимите права.',
          reason: `${modelId}: 403`,
        };
      }
      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
        return {
          fatalAuth: false,
          status: 429,
          userMsg: 'Услугата е временно натоварена (лимит на заявките). Моля, опитайте отново след малко.',
          reason: `${modelId}: 429`,
        };
      }
      if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand')) {
        return {
          fatalAuth: false,
          status: 503,
          userMsg: 'Услугата на Пътеводителя е временно претоварена. Моля, опитайте отново след няколко секунди.',
          reason: `${modelId}: 503`,
        };
      }
      if (errMsg.includes('TimeoutError') || errMsg.includes('aborted') || errMsg.includes('timeout')) {
        return {
          fatalAuth: false,
          status: 504,
          userMsg: 'Времето за отговор изтече. Моля, опитайте отново.',
          reason: `${modelId}: timeout`,
        };
      }
      return {
        fatalAuth: false,
        status: 502,
        userMsg: 'Временна грешка при комуникация с външната услуга.',
        reason: `${modelId}: ${errMsg.slice(0, 120)}`,
      };
    };

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const attemptLogs: string[] = [];

    if (!hasImage) {
      const hybridTools = [
        { googleSearch: {} },
        {
          functionDeclarations: [
            weatherToolDecl,
            hotelToolDecl,
            placesDiningToolDecl,
            routePlannerToolDecl,
          ],
        },
      ];
      const hybridToolConfig = { includeServerSideToolInvocations: true };

      try {
        let conversationContents = buildContents();
        let currentResp = await aiClient.models.generateContent({
          model: modelTiers[0].id,
          contents: conversationContents,
          config: {
            systemInstruction: baseSystemInstruction,
            tools: hybridTools,
            toolConfig: hybridToolConfig,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: AbortSignal.timeout(15000),
          },
        });

        for (let round = 0; round < 3; round++) {
          const functionCalls = currentResp.functionCalls;
          if (!functionCalls || functionCalls.length === 0) {
            break;
          }
          const previousContent = currentResp.candidates?.[0]?.content;
          if (!previousContent) break;

          const executedParts = await Promise.all(
            functionCalls.map(async (fc) => {
              if (fc.name === 'searchHotelsAndBooking') {
                hotelToolUsed = true;
              }
              const toolRes = await dispatchGuideToolCall(
                fc.name || '',
                (fc.args as Record<string, any>) || {},
                { includeLinks: wantsLinks }
              );
              collectedToolSources.push(...toolRes.sources);
              collectedToolQueries.push(...toolRes.queries);
              collectedToolPlaceIds.push(...toolRes.matchedPlaceIds);
              return {
                functionResponse: {
                  id: fc.id,
                  name: fc.name || '',
                  response: { result: toolRes.summary },
                },
              };
            })
          );

          conversationContents = [
            ...conversationContents,
            previousContent,
            { role: 'user', parts: executedParts },
          ];

          currentResp = await aiClient.models.generateContent({
            model: modelTiers[0].id,
            contents: conversationContents,
            config: {
              systemInstruction: baseSystemInstruction,
              tools: hybridTools,
              toolConfig: hybridToolConfig,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              abortSignal: AbortSignal.timeout(15000),
            },
          });
        }

        const candidateText = (currentResp?.text || '').trim();
        if (currentResp && candidateText.length > 0) {
          response = currentResp;
          successfulModelName = modelTiers[0].name;
        }
      } catch (attemptErr: any) {
        const errMsg = String(attemptErr?.message || attemptErr || '');
        const info = classifyError(errMsg, modelTiers[0].id);
        attemptLogs.push(`hybrid:${info.reason}`);
        console.warn('[Guide hybrid tool attempt failed]', modelTiers[0].id, errMsg.slice(0, 240));
        lastErrorStatus = info.status;
        lastErrorMessage = info.userMsg;
        if (info.fatalAuth) {
          authFatalError = true;
        }
      }
    }

    if (!response && !authFatalError) {
      if (!hasImage) {
        const recentHistorySnippet = rawTurns
          .slice(-2)
          .map((t) => t.text)
          .join(' ');
        usedLiveWebFallback = await performLiveWebSearch(userPromptText, db.places, {
          includeLinks: wantsLinks,
          fallbackContextText: recentHistorySnippet,
        });
      }

      const directContents = buildContents(usedLiveWebFallback?.contextSummary || undefined);

      const directAttempts = [
        { ...modelTiers[0], timeoutMs: 13000, waitBeforeMs: 0 },
        { ...modelTiers[1], timeoutMs: 13000, waitBeforeMs: 450 },
        { ...modelTiers[1], timeoutMs: 15000, waitBeforeMs: 1100 },
      ];

      for (const attempt of directAttempts) {
        if (attempt.waitBeforeMs > 0) {
          await delay(attempt.waitBeforeMs);
        }
        try {
          const r = await aiClient.models.generateContent({
            model: attempt.id,
            contents: directContents,
            config: {
              systemInstruction: baseSystemInstruction,
              ...(attempt.supportsThinkingLow
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
              abortSignal: AbortSignal.timeout(attempt.timeoutMs),
            },
          });

          if (r && (r.text || '').trim().length > 0) {
            response = r;
            successfulModelName = attempt.name;
            break;
          }
        } catch (attemptErr: any) {
          const errMsg = String(attemptErr?.message || attemptErr || '');
          const info = classifyError(errMsg, attempt.id);
          attemptLogs.push(`direct:${info.reason}`);
          console.warn('[Guide direct attempt failed]', attempt.id, errMsg.slice(0, 240));
          lastErrorStatus = info.status;
          lastErrorMessage = info.userMsg;
          if (info.fatalAuth) {
            break;
          }
        }
      }
    }

    const rawReplyText = (response?.text || '').trim();
    if (!response || !rawReplyText) {
      console.error('[Guide chat failed all tiers]', attemptLogs.join(' | '));
      return res.status(lastErrorStatus).json({ error: lastErrorMessage });
    }

    let replyText = stripMarkdownFormatting(rawReplyText);
    if (!wantsLinks && (hotelQueryDetected || hotelToolUsed)) {
      replyText = stripUrlsFromText(replyText);
    }

    const suggestedPlaceIds: string[] = [...collectedToolPlaceIds];
    if (usedLiveWebFallback?.matchedPlaceIds?.length) {
      suggestedPlaceIds.push(...usedLiveWebFallback.matchedPlaceIds);
    }
    for (const place of db.places) {
      if (
        rawReplyText.toLowerCase().includes(place.name.toLowerCase()) ||
        rawReplyText.includes(`[ID: ${place.id}]`) ||
        rawReplyText.includes(place.id)
      ) {
        suggestedPlaceIds.push(place.id);
      }
    }

    const candidate = response.candidates?.[0];
    const groundingChunks = (candidate as any)?.groundingMetadata?.groundingChunks;
    const rawSources: { title: string; uri: string }[] = [];
    if (Array.isArray(groundingChunks)) {
      for (const chunk of groundingChunks) {
        const safeUri = sanitizeExternalUrl(chunk.web?.uri);
        if (safeUri) {
          rawSources.push({
            title: cleanText(chunk.web?.title || 'Уеб източник', 120),
            uri: safeUri,
          });
        }
      }
    }
    rawSources.push(...collectedToolSources);
    if (usedLiveWebFallback?.sources?.length) {
      rawSources.push(...usedLiveWebFallback.sources);
    }

    const webSources: { title: string; uri: string }[] = [];
    const seenUris = new Set<string>();
    const suppressHotelSources = !wantsLinks && (hotelQueryDetected || hotelToolUsed);
    for (const s of rawSources) {
      const safe = sanitizeExternalUrl(s.uri);
      if (!safe || seenUris.has(safe)) continue;
      if (suppressHotelSources) {
        const isBookingOrHotelLink =
          /booking\.com|hotels\.com|tripadvisor|pochivka\.bg|bgturist|hotel|хотел/i.test(
            `${safe} ${s.title}`
          );
        if (isBookingOrHotelLink) continue;
      }
      seenUris.add(safe);
      webSources.push({ title: s.title, uri: safe });
    }

    const nativeQueries: string[] = (candidate as any)?.groundingMetadata?.webSearchQueries || [];
    const searchQueries: string[] = Array.from(
      new Set([
        ...nativeQueries,
        ...collectedToolQueries,
        ...(usedLiveWebFallback?.queries || []),
      ])
    ).slice(0, 4);

    return res.json({
      reply: replyText,
      modelUsed: successfulModelName,
      fallbackReason: fallbackNotice,
      suggestedPlaceIds: Array.from(new Set(suggestedPlaceIds)).slice(0, 4),
      webSources: webSources.slice(0, 8),
      searchQueries,
    });
  } catch (error: any) {
    console.error('Guide chat handler error:', error);
    return res.status(500).json({
      error: 'Възникна неочаквана грешка при комуникацията с Пътеводителя.',
    });
  }
}

app.post('/api/guide/chat', requireAuth, aiRateLimiter, handleGuideChat);
app.post('/api/ai/chat', requireAuth, aiRateLimiter, handleGuideChat);

// Unmatched API routes return structured JSON 404
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Заявеният API ресурс не съществува.' });
});

// -------------------------------------------------------------
// VITE MIDDLEWARE (DEV) & STATIC FILES (PROD)
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Скрито в България] Сървърът работи на http://0.0.0.0:${PORT}`);
  });
}

startServer();
