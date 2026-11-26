import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { PLACES, CATEGORIES, REGIONS, ROUTES } from './src/data/seedData';
import {
  Place,
  CommunitySuggestion,
  Review,
  User,
  ContactMessage,
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
app.set('trust proxy', 1);

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'prst4550@gmail.com').trim().toLowerCase();
const ENV_ADMIN_PASSCODE = (process.env.ADMIN_PASSCODE || '').trim();
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
    if (!allowedOrigins.has(origin)) {
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
  15 * 60 * 1000,
  25,
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
  createdAt: string;
}

interface DatabaseSchema {
  places: Place[];
  suggestions: CommunitySuggestion[];
  reviews: Review[];
  users: DbUser[];
  contactMessages: ContactMessage[];
  userProfiles: Record<string, UserProfileData>;
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
  const salt = ENV_ADMIN_PASSCODE ? createSalt() : '';
  const passwordHash = ENV_ADMIN_PASSCODE ? hashPasswordScrypt(ENV_ADMIN_PASSCODE, salt) : '';
  return {
    id: 'usr-admin-1',
    name: 'Администратор',
    email: ADMIN_EMAIL,
    passwordHash,
    salt,
    hashAlgorithm: 'scrypt',
    role: 'admin',
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
      console.error('Error reading existing database, re-initializing from seed:', e);
    }
  }

  if (data && Array.isArray(data.places) && data.places.length > 0) {
    if (!Array.isArray(data.users)) data.users = [];
    if (!Array.isArray(data.suggestions)) data.suggestions = [];
    if (!Array.isArray(data.reviews)) data.reviews = [];
    if (!Array.isArray(data.contactMessages)) data.contactMessages = [];
    if (!data.userProfiles || typeof data.userProfiles !== 'object' || Array.isArray(data.userProfiles)) {
      data.userProfiles = {};
    }

    const adminIdx = data.users.findIndex(
      (u) => u.email.toLowerCase() === ADMIN_EMAIL || u.id === 'usr-admin-1'
    );

    if (adminIdx === -1) {
      data.users.push(createAdminRecord());
    } else {
      data.users[adminIdx].email = ADMIN_EMAIL;
      data.users[adminIdx].role = 'admin';
      if (ENV_ADMIN_PASSCODE) {
        const salt = createSalt();
        data.users[adminIdx].salt = salt;
        data.users[adminIdx].passwordHash = hashPasswordScrypt(ENV_ADMIN_PASSCODE, salt);
        data.users[adminIdx].hashAlgorithm = 'scrypt';
      }
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
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
    userProfiles: {},
  };

  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  return initialData;
}

let db = initDatabase();

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
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

const activeSessions = new Map<string, { userId: string; expiresAt: number }>();

const sessionCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (now > session.expiresAt) {
      activeSessions.delete(token);
    }
  }
}, 15 * 60 * 1000);
sessionCleanupTimer.unref();

function issueSessionToken(user: DbUser): string {
  const token = crypto.randomBytes(32).toString('hex');
  const ttlMs = user.role === 'admin' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  activeSessions.set(token, {
    userId: user.id,
    expiresAt: Date.now() + ttlMs,
  });
  return token;
}

function getUserFromRequest(req: Request): DbUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  const session = activeSessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  const user = db.users.find((u) => u.id === session.userId);
  return user || null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Изисква се вход в профила за достъп до тези данни.' });
  }
  res.locals.currentUser = user;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Изисква се автентикация за достъп до този ресурс.' });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Достъпът е разрешен само за администратори.' });
  }
  res.locals.currentUser = user;
  next();
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

app.post('/api/reviews', writeRateLimiter, (req: Request, res: Response) => {
  const { placeId, author, rating, comment, visitSeason } = req.body || {};
  const cleanPlaceId = cleanText(placeId, 80);
  const cleanAuthor = cleanText(author, 80);
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

  const authUser = getUserFromRequest(req);
  const newReview: Review = {
    id: 'rev-' + Date.now(),
    placeId: cleanPlaceId,
    author: authUser ? authUser.name : cleanAuthor,
    userId: authUser?.id,
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

app.post('/api/suggestions', writeRateLimiter, (req: Request, res: Response) => {
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

  const authUser = getUserFromRequest(req);
  const newSuggestion: CommunitySuggestion = {
    id: 'sugg-' + Date.now(),
    name: cleanName,
    region: cleanRegion,
    category: cleanCategory,
    latitude: latNum,
    longitude: lngNum,
    description: cleanDesc,
    source: cleanSource,
    imageUrl: sanitizedImage || undefined,
    contact: cleanContact || authUser?.email || undefined,
    status: 'pending',
    userId: authUser?.id,
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

  item.status = status;

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
        id: 'place-' + Date.now(),
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
    }
  }

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
    id: 'msg-' + Date.now(),
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
  }

  saveDatabase();

  const token = issueSessionToken(admin);
  const safeUser: User = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    createdAt: admin.createdAt,
  };

  res.status(201).json({ token, user: safeUser });
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
    id: 'usr-' + Date.now(),
    name: cleanName,
    email: cleanEmail,
    passwordHash: hashPasswordScrypt(rawPassword, salt),
    salt,
    hashAlgorithm: 'scrypt',
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  saveDatabase();

  const token = issueSessionToken(newUser);
  const safeUser: User = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    createdAt: newUser.createdAt,
  };

  res.status(201).json({ token, user: safeUser });
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

  // Transparently upgrade legacy PBKDF2 hash to scrypt on login
  if (user.hashAlgorithm === 'pbkdf2') {
    const newSalt = createSalt();
    user.salt = newSalt;
    user.passwordHash = hashPasswordScrypt(rawPassword, newSalt);
    user.hashAlgorithm = 'scrypt';
    saveDatabase();
  }

  const token = issueSessionToken(user);
  const safeUser: User = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

  res.json({ token, user: safeUser });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Не сте влезли в профила си.' });
  }

  const safeUser: User = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
  res.json({ user: safeUser });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    activeSessions.delete(token);
  }
  res.json({ message: 'Успешен изход от системата.' });
});

app.get('/api/users', requireAdmin, (_req: Request, res: Response) => {
  const safeUsers: User[] = db.users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
  }));
  res.json(safeUsers);
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

  const safeUser: User = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
  res.json({ user: safeUser });
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
    id: 'place-' + Date.now(),
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
  saveDatabase();
  res.json({ message: `Обектът "${deleted.name}" беше изтрит успешно.` });
});

// -------------------------------------------------------------
// MICROSOFT SQL SERVER / SSMS INTEGRATION ENDPOINTS (ADMIN ONLY)
// -------------------------------------------------------------

app.get('/api/ssms/export', requireAdmin, (_req: Request, res: Response) => {
  const ssmsFilePath = path.resolve(DATA_DIR, 'BulgariaTravel_SSMS.sql');
  if (!fs.existsSync(ssmsFilePath)) {
    return res.status(404).json({ error: 'SSMS T-SQL скриптът все още не е генериран.' });
  }

  res.setHeader('Content-Type', 'application/sql; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="BulgariaTravel_SSMS.sql"');
  const fileStream = fs.createReadStream(ssmsFilePath);
  fileStream.pipe(res);
});

app.get('/api/ssms/schema', requireAdmin, (_req: Request, res: Response) => {
  const ssmsFilePath = path.resolve(DATA_DIR, 'BulgariaTravel_SSMS.sql');
  const fileStats = fs.existsSync(ssmsFilePath) ? fs.statSync(ssmsFilePath) : null;

  res.json({
    databaseName: 'BulgariaTravel',
    databaseClient: 'Microsoft SQL Server Management Studio (SSMS 18 / 19 / 20)',
    compatibility: 'Microsoft SQL Server 2017+, 2019, 2022, Azure SQL',
    collation: 'Cyrillic_General_100_CI_AI_SC_UTF8',
    fileSizeKb: fileStats ? +(fileStats.size / 1024).toFixed(1) : 0,
    connectionStrings: {
      windowsAuth:
        'Server=localhost;Database=BulgariaTravel;Trusted_Connection=True;TrustServerCertificate=True;',
      localDb: 'Server=(localdb)\\MSSQLLocalDB;Database=BulgariaTravel;Trusted_Connection=True;',
      sqlAuth:
        'Server=localhost,1433;Database=BulgariaTravel;User Id=sa;Password=<SQL_PASSWORD>;TrustServerCertificate=True;',
      efCore:
        'Server=localhost;Database=BulgariaTravel;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true',
    },
    tables: [
      {
        name: 'dbo.Places',
        rowCount: db.places.length,
        description:
          'Основни географски и исторически локации с пространствени координати и T-SQL GEOGRAPHY тип.',
        columns: [
          { name: 'PlaceId', type: 'NVARCHAR(50)', isPk: true, nullable: false },
          { name: 'Name', type: 'NVARCHAR(200)', isPk: false, nullable: false },
          { name: 'Slug', type: 'NVARCHAR(200)', isPk: false, nullable: false },
          { name: 'CategoryId', type: 'NVARCHAR(50)', isFk: true, nullable: false },
          { name: 'RegionId', type: 'NVARCHAR(50)', isFk: true, nullable: false },
          { name: 'Latitude', type: 'FLOAT', isPk: false, nullable: false },
          { name: 'Longitude', type: 'FLOAT', isPk: false, nullable: false },
          { name: 'GeoLocation', type: 'GEOGRAPHY', isPk: false, nullable: true },
          { name: 'ElevationMeters', type: 'INT', isPk: false, nullable: false },
          { name: 'Difficulty', type: 'NVARCHAR(50)', isPk: false, nullable: false },
          { name: 'ShortDescription', type: 'NVARCHAR(1000)', isPk: false, nullable: false },
          { name: 'FullDescription', type: 'NVARCHAR(MAX)', isPk: false, nullable: false },
          { name: 'HistoricalContext', type: 'NVARCHAR(MAX)', isPk: false, nullable: true },
          { name: 'ImageUrl', type: 'NVARCHAR(500)', isPk: false, nullable: false },
          { name: 'IsFeatured', type: 'BIT', isPk: false, nullable: false },
        ],
      },
      {
        name: 'dbo.Categories',
        rowCount: CATEGORIES.length,
        description: 'Категории на обектите (светилища, крепости, водопади, пещери, села, феномени).',
        columns: [
          { name: 'CategoryId', type: 'NVARCHAR(50)', isPk: true, nullable: false },
          { name: 'Name', type: 'NVARCHAR(100)', isPk: false, nullable: false },
          { name: 'Slug', type: 'NVARCHAR(100)', isPk: false, nullable: false },
          { name: 'Description', type: 'NVARCHAR(500)', isPk: false, nullable: true },
          { name: 'Icon', type: 'NVARCHAR(50)', isPk: false, nullable: true },
        ],
      },
      {
        name: 'dbo.Regions',
        rowCount: REGIONS.length,
        description: 'Шестте географски региона на България с гранични координати.',
        columns: [
          { name: 'RegionId', type: 'NVARCHAR(50)', isPk: true, nullable: false },
          { name: 'Name', type: 'NVARCHAR(100)', isPk: false, nullable: false },
          { name: 'Description', type: 'NVARCHAR(500)', isPk: false, nullable: true },
          { name: 'BoundNorth', type: 'FLOAT', isPk: false, nullable: true },
          { name: 'BoundSouth', type: 'FLOAT', isPk: false, nullable: true },
          { name: 'BoundEast', type: 'FLOAT', isPk: false, nullable: true },
          { name: 'BoundWest', type: 'FLOAT', isPk: false, nullable: true },
        ],
      },
      {
        name: 'dbo.Routes',
        rowCount: ROUTES.length,
        description: 'Експедиционни маршрути, свързващи множество исторически обекти.',
        columns: [
          { name: 'RouteId', type: 'NVARCHAR(50)', isPk: true, nullable: false },
          { name: 'Title', type: 'NVARCHAR(200)', isPk: false, nullable: false },
          { name: 'Slug', type: 'NVARCHAR(200)', isPk: false, nullable: false },
          { name: 'RegionId', type: 'NVARCHAR(50)', isFk: true, nullable: false },
          { name: 'Difficulty', type: 'NVARCHAR(50)', isPk: false, nullable: false },
          { name: 'DurationHours', type: 'FLOAT', isPk: false, nullable: false },
          { name: 'DistanceKm', type: 'FLOAT', isPk: false, nullable: false },
        ],
      },
      {
        name: 'dbo.Users',
        rowCount: db.users.length,
        description: 'Потребители на системата и куратори с криптографски защитени пароли.',
        columns: [
          { name: 'UserId', type: 'NVARCHAR(50)', isPk: true, nullable: false },
          { name: 'Email', type: 'NVARCHAR(200)', isPk: false, nullable: false },
          { name: 'FullName', type: 'NVARCHAR(100)', isPk: false, nullable: false },
          { name: 'Role', type: 'NVARCHAR(20)', isPk: false, nullable: false },
          { name: 'CreatedAt', type: 'DATETIME2(3)', isPk: false, nullable: false },
        ],
      },
      {
        name: 'dbo.Reviews',
        rowCount: db.reviews.length,
        description: 'Автентични отзиви и оценки от теренни посещения.',
        columns: [
          { name: 'ReviewId', type: 'NVARCHAR(50)', isPk: true, nullable: false },
          { name: 'PlaceId', type: 'NVARCHAR(50)', isFk: true, nullable: false },
          { name: 'Author', type: 'NVARCHAR(100)', isPk: false, nullable: false },
          { name: 'Rating', type: 'INT', isPk: false, nullable: false },
          { name: 'Comment', type: 'NVARCHAR(MAX)', isPk: false, nullable: false },
        ],
      },
    ],
    views: [
      {
        name: 'dbo.vw_PlacesDetailed',
        description: 'Обединява обектите с имената на техните категории и региони, плюс брой отзиви.',
      },
      { name: 'dbo.vw_FeaturedDestinations', description: 'Филтрира само препоръчаните дестинации.' },
      {
        name: 'dbo.vw_RegionalStatistics',
        description: 'Аналитичен изглед: брой обекти, минимална/максимална/средна надморска височина по региони.',
      },
    ],
    storedProcedures: [
      {
        name: 'dbo.usp_FindNearbyPlaces',
        params: '@Latitude FLOAT, @Longitude FLOAT, @RadiusKm FLOAT = 25.0',
        description: 'Използва native SQL Server GEOGRAPHY пространствен индекс за намиране на обекти в радиус.',
      },
      {
        name: 'dbo.usp_SearchCatalog',
        params: '@SearchTerm NVARCHAR(100), @CategoryId NVARCHAR(50), @RegionId NVARCHAR(50)',
        description: 'Търсене в каталога по ключова дума и филтри.',
      },
    ],
  });
});

app.post('/api/ssms/query', requireAdmin, (req: Request, res: Response) => {
  const { query } = req.body || {};
  if (!query || typeof query !== 'string' || query.length > 4000) {
    return res.status(400).json({ error: 'Липсва валидна T-SQL заявка.' });
  }

  const cleanQuery = query.trim().replace(/;+$/, '');
  const startTime = Date.now();

  try {
    let rows: Record<string, unknown>[] = [];
    let columns: string[] = [];

    const lowerQ = cleanQuery.toLowerCase();

    if (lowerQ.includes('vw_regionalstatistics')) {
      columns = [
        'RegionId',
        'RegionName',
        'TotalPlaces',
        'MinElevation',
        'MaxElevation',
        'AvgElevation',
        'FeaturedPlacesCount',
      ];
      rows = REGIONS.map((r) => {
        const pInR = db.places.filter((p) => p.regionId === r.id);
        const elevations = pInR.map((p) => p.elevationMeters || p.altitude || 0);
        return {
          RegionId: r.id,
          RegionName: r.name,
          TotalPlaces: pInR.length,
          MinElevation: elevations.length ? Math.min(...elevations) : 0,
          MaxElevation: elevations.length ? Math.max(...elevations) : 0,
          AvgElevation: elevations.length
            ? Math.round(elevations.reduce((a, b) => a + b, 0) / elevations.length)
            : 0,
          FeaturedPlacesCount: pInR.filter((p) => p.isFeatured).length,
        };
      });
    } else if (lowerQ.includes('vw_featureddestinations')) {
      columns = ['PlaceId', 'PlaceName', 'CategoryName', 'RegionName', 'ElevationMeters', 'Difficulty', 'ImageUrl'];
      rows = db.places
        .filter((p) => p.isFeatured)
        .map((p) => ({
          PlaceId: p.id,
          PlaceName: p.name,
          CategoryName: p.categoryName,
          RegionName: p.regionName,
          ElevationMeters: p.elevationMeters || p.altitude || 0,
          Difficulty: p.difficulty,
          ImageUrl: p.imageUrl,
        }));
    } else if (lowerQ.includes('categories')) {
      columns = ['CategoryId', 'Name', 'Slug', 'Description', 'Icon'];
      rows = CATEGORIES.map((c) => ({
        CategoryId: c.id,
        Name: c.name,
        Slug: c.slug || c.id,
        Description: c.description,
        Icon: c.icon || c.iconName,
      }));
    } else if (lowerQ.includes('regions')) {
      columns = ['RegionId', 'Name', 'Description', 'BoundNorth', 'BoundSouth', 'BoundEast', 'BoundWest'];
      rows = REGIONS.map((r) => ({
        RegionId: r.id,
        Name: r.name,
        Description: r.description,
        BoundNorth: r.bounds?.north ?? r.centerCoordinates[0] + 0.5,
        BoundSouth: r.bounds?.south ?? r.centerCoordinates[0] - 0.5,
        BoundEast: r.bounds?.east ?? r.centerCoordinates[1] + 0.5,
        BoundWest: r.bounds?.west ?? r.centerCoordinates[1] - 0.5,
      }));
    } else if (lowerQ.includes('routes')) {
      columns = ['RouteId', 'Title', 'Slug', 'RegionId', 'Difficulty', 'DurationHours', 'DistanceKm'];
      rows = ROUTES.map((rt) => ({
        RouteId: rt.id,
        Title: rt.title,
        Slug: rt.slug || rt.id,
        RegionId: rt.regionId || 'south_central',
        Difficulty: rt.difficulty,
        DurationHours: rt.durationHours || 6.0,
        DistanceKm: rt.distanceKm || 30.0,
      }));
    } else if (lowerQ.includes('reviews')) {
      columns = ['ReviewId', 'PlaceId', 'Author', 'Rating', 'Comment', 'VisitSeason'];
      rows = db.reviews.map((rv) => ({
        ReviewId: rv.id,
        PlaceId: rv.placeId,
        Author: rv.author,
        Rating: rv.rating,
        Comment: rv.comment,
        VisitSeason: rv.visitSeason,
      }));
    } else if (lowerQ.includes('users')) {
      columns = ['UserId', 'Email', 'FullName', 'Role', 'CreatedAt'];
      rows = db.users.map((u) => ({
        UserId: u.id,
        Email: u.email,
        FullName: u.name,
        Role: u.role,
        CreatedAt: u.createdAt,
      }));
    } else if (lowerQ.includes('count(*)')) {
      columns = ['TotalCount'];
      rows = [{ TotalCount: db.places.length }];
    } else {
      let filtered = [...db.places];

      if (
        lowerQ.includes("regionid = 'south_central'") ||
        lowerQ.includes("regionid = 'rhodopes'") ||
        lowerQ.includes('родопи')
      ) {
        filtered = filtered.filter((p) => p.regionId === 'south_central');
      } else if (
        lowerQ.includes("regionid = 'north_central'") ||
        lowerQ.includes("regionid = 'danube-balkan'")
      ) {
        filtered = filtered.filter((p) => p.regionId === 'north_central');
      } else if (lowerQ.includes("regionid = 'northwest'")) {
        filtered = filtered.filter((p) => p.regionId === 'northwest');
      } else if (lowerQ.includes("regionid = 'northeast'")) {
        filtered = filtered.filter((p) => p.regionId === 'northeast');
      } else if (lowerQ.includes("regionid = 'southeast'")) {
        filtered = filtered.filter((p) => p.regionId === 'southeast');
      } else if (lowerQ.includes("regionid = 'southwest'")) {
        filtered = filtered.filter((p) => p.regionId === 'southwest');
      }

      if (lowerQ.includes("categoryid = 'sanctuaries'")) {
        filtered = filtered.filter((p) => p.categoryId === 'sanctuaries');
      } else if (lowerQ.includes("categoryid = 'waterfalls'") || lowerQ.includes("categoryid = 'canyons'")) {
        filtered = filtered.filter((p) => p.categoryId === 'waterfalls');
      } else if (lowerQ.includes("categoryid = 'fortresses'")) {
        filtered = filtered.filter((p) => p.categoryId === 'fortresses');
      } else if (lowerQ.includes("categoryid = 'caves'")) {
        filtered = filtered.filter((p) => p.categoryId === 'caves');
      } else if (lowerQ.includes("categoryid = 'villages'")) {
        filtered = filtered.filter((p) => p.categoryId === 'villages');
      } else if (lowerQ.includes("categoryid = 'monasteries'")) {
        filtered = filtered.filter((p) => p.categoryId === 'monasteries');
      }

      if (lowerQ.includes('isfeatured = 1')) {
        filtered = filtered.filter((p) => p.isFeatured);
      }

      if (lowerQ.includes('order by elevationmeters desc')) {
        filtered.sort((a, b) => (b.elevationMeters || b.altitude || 0) - (a.elevationMeters || a.altitude || 0));
      }

      const topMatch = cleanQuery.match(/top\s+(\d+)/i);
      if (topMatch) {
        const limit = Math.max(1, Math.min(200, parseInt(topMatch[1], 10)));
        filtered = filtered.slice(0, limit);
      }

      columns = [
        'PlaceId',
        'Name',
        'CategoryName',
        'RegionName',
        'Latitude',
        'Longitude',
        'ElevationMeters',
        'Difficulty',
        'IsFeatured',
        'ImageUrl',
      ];
      rows = filtered.map((p) => ({
        PlaceId: p.id,
        Name: p.name,
        CategoryName: p.categoryName,
        RegionName: p.regionName,
        Latitude: p.latitude,
        Longitude: p.longitude,
        ElevationMeters: p.elevationMeters || p.altitude || 0,
        Difficulty: p.difficulty,
        IsFeatured: p.isFeatured ? 1 : 0,
        ImageUrl: p.imageUrl,
      }));
    }

    const executionTimeMs = Math.max(1, Date.now() - startTime);

    res.json({
      success: true,
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs,
      messages: `Заявката се изпълни успешно. (${rows.length} реда върнати) Време за изпълнение: ${executionTimeMs} ms.`,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Грешка при изпълнение на T-SQL заявка.',
      messages: `Msg 50000, Level 16, State 1: ${err.message || 'Синтактична или транзакционна грешка в T-SQL.'}`,
    });
  }
});

// -------------------------------------------------------------
// FIELD GUIDE & LIVE WEATHER / SEARCH GROUNDING
// -------------------------------------------------------------

interface WebSearchResult {
  title: string;
  uri: string;
  snippet: string;
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

function describeWmoCodeBg(code: number): string {
  if (code === 0) return 'Ясно и слънчево';
  if (code <= 2) return 'Предимно ясно до разкъсана облачност';
  if (code === 3) return 'Облачно';
  if (code === 45 || code === 48) return 'Мъгла';
  if (code >= 51 && code <= 57) return 'Ръмеж';
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
  { keys: ['банско', 'bansko'], name: 'Банско', lat: 41.8383, lon: 23.4885, elev: 925 },
  { keys: ['смолян', 'родопи'], name: 'Смолян / Централни Родопи', lat: 41.5774, lon: 24.7011, elev: 1002 },
];

async function performLiveWebSearch(
  userQuery: string,
  catalogPlaces: Place[]
): Promise<{
  sources: { title: string; uri: string }[];
  queries: string[];
  contextSummary: string;
}> {
  const sources: { title: string; uri: string }[] = [];
  const contextLines: string[] = [];
  const lowerQ = userQuery.toLowerCase();

  const stopWords = new Set([
    'каква', 'какво', 'какъв', 'как', 'кой', 'коя', 'кое', 'кои', 'къде', 'кога',
    'е', 'са', 'има', 'ли', 'в', 'на', 'до', 'за', 'с', 'от', 'по', 'и', 'или',
    'днес', 'сега', 'утре', 'моля', 'кажи', 'ми', 'провери', 'актуална', 'информация',
    'прогнозата', 'препоръчай', 'подходящи', 'най', 'много', 'около', 'района',
  ]);

  const rawWords = userQuery
    .replace(/[?!.,:;"'()[\]]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);

  const meaningfulKeywords = rawWords.filter((w) => !stopWords.has(w.toLowerCase()));
  const searchQuery = (meaningfulKeywords.slice(0, 6).join(' ') || userQuery.slice(0, 80)).trim();
  const queries: string[] = [searchQuery];

  const isWeatherQuery =
    /(врем|прогноз|температур|градус|сняг|снеж|дъжд|вятър|буря|мъгла|слънц|услови|проходим)/i.test(lowerQ);
  const isHotelOrPriceQuery =
    /(хотел|къщ|нощувк|настаняв|хиж|цена|цени|билет|такса|ресторант|престой|booking|евтин|лукс)/i.test(lowerQ);

  const weatherLocations: { name: string; lat: number; lon: number }[] = [];
  for (const p of catalogPlaces) {
    const firstPart = p.name.toLowerCase().split('(')[0].trim();
    const coreTokens = firstPart.split(/\s+/).filter((w) => w.length >= 5 && !['пещера', 'водопад', 'крепост', 'скално', 'светилище', 'манастир', 'езеро', 'резерват'].includes(w));
    if (
      lowerQ.includes(firstPart) ||
      coreTokens.some((tok) => lowerQ.includes(tok) || (tok.length > 6 && lowerQ.includes(tok.slice(0, 6))))
    ) {
      if (!weatherLocations.some((wl) => wl.name === p.name)) {
        weatherLocations.push({ name: p.name, lat: p.latitude, lon: p.longitude });
      }
    }
  }
  for (const peak of KNOWN_BG_PEAKS) {
    if (peak.keys.some((k) => lowerQ.includes(k))) {
      if (!weatherLocations.some((wl) => wl.name === peak.name)) {
        weatherLocations.push({ name: peak.name, lat: peak.lat, lon: peak.lon });
      }
    }
  }

  const tasks: Promise<void>[] = [];

  // Live Web Search via Bing RSS for hotels, prices, tickets, and current conditions
  tasks.push(
    (async () => {
      try {
        const hotelTokens = meaningfulKeywords.filter(
          (w) => !/(врем|прогноз|температур|градус|сняг|дъжд|вятър|google|провери)/i.test(w)
        );
        const webQ = isHotelOrPriceQuery
          ? `${hotelTokens.slice(0, 4).join(' ') || searchQuery} цени`
          : isWeatherQuery
          ? `${searchQuery} прогноза`
          : searchQuery;
        const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(webQ)}&format=rss&cc=BG&setlang=bg`;
        const r = await fetch(bingUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HiddenBulgariaGuide/1.0)' },
          signal: AbortSignal.timeout(4500),
        });
        if (!r.ok) return;
        const xml = await r.text();
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        let added = 0;
        for (const item of items) {
          if (added >= 5) break;
          const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
          const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
          const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);
          const title = titleMatch ? decodeXmlEntities(titleMatch[1]) : '';
          const uri = linkMatch ? sanitizeExternalUrl(decodeXmlEntities(linkMatch[1])) : null;
          const snippet = descMatch ? decodeXmlEntities(descMatch[1]) : '';
          if (title && uri) {
            sources.push({ title: cleanText(title, 110), uri });
            contextLines.push(`[Уеб резултат] ${title}: ${snippet} (${uri})`);
            added++;
          }
        }
        queries.push(webQ);
      } catch {
        // ignore search timeout
      }
    })()
  );

  // Real local accommodations lookup via OpenStreetMap Nominatim when user asks about hotels/stays/prices
  if (isHotelOrPriceQuery) {
    const nonHotelTokens = meaningfulKeywords.filter(
      (w) => !/(хотел|хотели|къщ|нощувк|цени|цена|провери|google|около|врем|прогноз|днес|утре|билет)/i.test(w)
    );
    const placeHint = nonHotelTokens.slice(0, 2).join(' ') || weatherLocations[0]?.name.split('(')[0].trim() || '';
    if (placeHint.length >= 3) {
      tasks.push(
        (async () => {
          try {
            const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              `хотел ${placeHint} България`
            )}&format=jsonv2&limit=5&addressdetails=1&extratags=1`;
            const r = await fetch(nomUrl, {
              headers: { 'User-Agent': 'HiddenBulgariaAtlas/1.0' },
              signal: AbortSignal.timeout(4000),
            });
            if (!r.ok) return;
            const list: any[] = await r.json();
            if (Array.isArray(list) && list.length > 0) {
              const lines = list.slice(0, 5).map((item) => {
                const n = item.name || item.display_name?.split(',')[0] || 'Настаняване';
                const web = sanitizeExternalUrl(item.extratags?.website || item.extratags?.url);
                const tel = item.extratags?.phone || item.extratags?.['contact:phone'] || '';
                if (web) {
                  sources.push({ title: `${n} (Официален сайт)`, uri: web });
                }
                return `- ${n}${tel ? ` (тел: ${tel})` : ''}${web ? ` — ${web}` : ''}`;
              });
              contextLines.push(`[Реални места за настаняване около ${placeHint} от OpenStreetMap]:\n${lines.join('\n')}`);
            }
          } catch {
            // ignore nominatim timeout
          }
        })()
      );
    }
  }

  if (isWeatherQuery) {
    if (weatherLocations.length === 0 && meaningfulKeywords.length > 0) {
      try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          meaningfulKeywords.slice(0, 2).join(' ')
        )}&count=3&language=bg&format=json`;
        const r = await fetch(geoUrl, { signal: AbortSignal.timeout(3500) });
        if (r.ok) {
          const g: any = await r.json();
          const bgMatch = g?.results?.find((item: any) => item.country_code === 'BG') || g?.results?.[0];
          if (bgMatch) {
            weatherLocations.push({ name: bgMatch.name, lat: bgMatch.latitude, lon: bgMatch.longitude });
          }
        }
      } catch {
        // ignore geocode timeout
      }
    }

    for (const loc of weatherLocations.slice(0, 2)) {
      tasks.push(
        (async () => {
          try {
            const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Europe%2FSofia&forecast_days=3`;
            const r = await fetch(meteoUrl, { signal: AbortSignal.timeout(4000) });
            if (!r.ok) return;
            const data: any = await r.json();
            const cur = data?.current;
            const daily = data?.daily;
            if (cur) {
              const cond = describeWmoCodeBg(Number(cur.weather_code ?? 0));
              let forecastTxt = '';
              if (daily && Array.isArray(daily.time)) {
                forecastTxt = daily.time
                  .slice(0, 3)
                  .map(
                    (d: string, i: number) =>
                      `${d}: ${daily.temperature_2m_min?.[i]}°C..${daily.temperature_2m_max?.[i]}°C, валежи ${daily.precipitation_sum?.[i]}мм (${describeWmoCodeBg(
                        Number(daily.weather_code?.[i] ?? 0)
                      )})`
                  )
                  .join(' | ');
              }
              contextLines.push(
                `[Актуална метео прогноза за ${loc.name} (${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)})]: Сега ${cur.temperature_2m}°C (усеща се като ${cur.apparent_temperature}°C), ${cond}, вятър ${cur.wind_speed_10m} km/h, валежи ${cur.precipitation} мм. 3-дневна прогноза: ${forecastTxt}`
              );
              sources.push({
                title: `Open-Meteo Прогноза: ${loc.name}`,
                uri: 'https://open-meteo.com/en/docs',
              });
              queries.push(`прогноза времето ${loc.name}`);
            }
          } catch {
            // ignore weather timeout
          }
        })()
      );
    }
  }

  tasks.push(
    (async () => {
      try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
          searchQuery
        )}&hl=bg&gl=BG&ceid=BG:bg`;
        const r = await fetch(rssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HiddenBulgariaGuide/1.0)' },
          signal: AbortSignal.timeout(4000),
        });
        if (!r.ok) return;
        const xml = await r.text();
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        const parsed: WebSearchResult[] = [];
        for (const item of items.slice(0, 4)) {
          const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
          const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
          const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
          const title = titleMatch ? decodeXmlEntities(titleMatch[1]) : '';
          const uri = linkMatch ? sanitizeExternalUrl(decodeXmlEntities(linkMatch[1])) : null;
          const pubDate = dateMatch ? decodeXmlEntities(dateMatch[1]) : '';
          if (title && uri) {
            parsed.push({ title, uri, snippet: pubDate });
          }
        }
        for (const p of parsed.slice(0, 3)) {
          sources.push({ title: p.title, uri: p.uri });
          contextLines.push(`[Новини] ${p.title} (${p.snippet}) — ${p.uri}`);
        }
      } catch {
        // ignore RSS error
      }
    })()
  );

  const wikiSearchTerm =
    weatherLocations[0]?.name.split('(')[0].trim() || meaningfulKeywords.slice(0, 3).join(' ');
  if (wikiSearchTerm.length >= 3) {
    tasks.push(
      (async () => {
        try {
          const wikiUrl = `https://bg.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
            wikiSearchTerm
          )}&srlimit=2&format=json&utf8=1`;
          const r = await fetch(wikiUrl, {
            headers: { 'User-Agent': 'HiddenBulgariaGuide/1.0' },
            signal: AbortSignal.timeout(3500),
          });
          if (!r.ok) return;
          const data: any = await r.json();
          const hits = data?.query?.search || [];
          for (const hit of hits.slice(0, 2)) {
            const title = String(hit.title || '');
            const snippet = decodeXmlEntities(String(hit.snippet || ''));
            const uri = `https://bg.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
            if (title && snippet) {
              sources.push({ title: `${title} — Уикипедия`, uri });
              contextLines.push(`[Българска Уикипедия: ${title}] ${snippet}`);
            }
          }
        } catch {
          // ignore wiki error
        }
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
    sources: uniqueSources.slice(0, 6),
    queries: Array.from(new Set(queries)).slice(0, 3),
    contextSummary: contextLines.join('\n'),
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

    const baseSystemInstruction = `Ти си „Пътеводителят“ на платформата „Скрито в България“ — опитен краевед, туристически консултант и планински водач с достъп до картографския архив на ${db.places.length} верифицирани обекта в България и търсене в Google в реално време.

ТЕКУЩА ДАТА И ЧАС В БЪЛГАРИЯ: ${nowBg}

ТВОИТЕ ПРАВИЛА И СТИЛ:
1. ЗАДЪЛЖИТЕЛНО ТЪРСЕНЕ В GOOGLE (ЦЕНИ, ХОТЕЛИ, ПРОГНОЗА ЗА ВРЕМЕТО):
   - Когато потребителят пита за хотели, къщи за гости, цени за нощувки, входни такси/билети, ресторанти, транспорт, актуална прогноза за времето, сняг или пътна обстановка в България — ВИНАГИ използвай инструмента за търсене в Google, за да провериш реални актуални цени, налични места за настаняване, оценки и прогнози.
   - Посочвай конкретни примери с ориентировъчни цени (в BGN/EUR, както са в актуалните източници), метеорологични стойности (температури, валежи, вятър) и предупреждения за безопасност. Никога не измисляй цени или дати, ако липсват в резултатите от търсенето — кажи ясно какво показват актуалните източници.
2. ВИЗУАЛНО РАЗПОЗНАВАНЕ НА СНИМКИ:
   - Когато потребителят качи или заснеме кадър на природна забележителност, скала, пещера, водопад или историческа крепост в България, анализирай формите и го съпостави с каталога или географските характеристики, като обясниш локацията и практическите съвети за достъп.
3. БЕЗОПАСНОСТ И СПЕШНИ НОМЕРА:
   - При планински преходи и лошо време напомняй за спешните телефони в България: Единен спешен номер 112 и Планинска спасителна служба (ПСС): 1470 / +359 2 963 2000.
4. ЕСТЕСТВЕН ТОПЪЛ ДИАЛОГ И КРАЕВЕДСКИ СЪВЕТИ:
   - Отговаряй приветливо на чист, богат български език с кратки абзаци и ясни препоръки от каталога.

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
          // Skip leading model welcome messages so conversation history always begins with 'user'
          if (rawTurns.length === 0 && turn.role === 'model') {
            continue;
          }
          // Merge or replace consecutive turns with the same role to satisfy strict alternation
          const last = rawTurns[rawTurns.length - 1];
          if (last && last.role === turn.role) {
            last.text = `${last.text}\n${text}`.slice(0, 2000);
          } else {
            rawTurns.push({ role: turn.role, text });
          }
        }
      }
    }
    // Ensure history before the new 'user' turn ends with a 'model' turn (never two trailing 'user' turns)
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
        ? `${userPromptText}\n\n[АКТУАЛНИ РЕЗУЛТАТИ И ДАННИ В РЕАЛНО ВРЕМЕ (${nowBg})]:\n${extraWebContext}`
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
    let usedLiveWebFallback: {
      sources: { title: string; uri: string }[];
      queries: string[];
      contextSummary: string;
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
      try {
        const r = await aiClient.models.generateContent({
          model: modelTiers[0].id,
          contents: buildContents(),
          config: {
            systemInstruction: baseSystemInstruction,
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            abortSignal: AbortSignal.timeout(12000),
          },
        });

        if (r && (r.text || r.candidates?.[0]?.content)) {
          response = r;
          successfulModelName = modelTiers[0].name;
        }
      } catch (attemptErr: any) {
        const errMsg = String(attemptErr?.message || attemptErr || '');
        const info = classifyError(errMsg, modelTiers[0].id);
        attemptLogs.push(`search:${info.reason}`);
        console.warn('[Guide googleSearch attempt failed]', modelTiers[0].id, errMsg.slice(0, 240));
        lastErrorStatus = info.status;
        lastErrorMessage = info.userMsg;
        if (info.fatalAuth) {
          authFatalError = true;
        }
      }
    }

    if (!response && !authFatalError) {
      if (!hasImage) {
        usedLiveWebFallback = await performLiveWebSearch(userPromptText, db.places);
      }

      const directContents = buildContents(usedLiveWebFallback?.contextSummary || undefined);

      const directAttempts = [
        { ...modelTiers[0], timeoutMs: 12000, waitBeforeMs: 0 },
        { ...modelTiers[1], timeoutMs: 12000, waitBeforeMs: 450 },
        { ...modelTiers[1], timeoutMs: 14000, waitBeforeMs: 1100 },
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

          if (r && (r.text || r.candidates?.[0]?.content)) {
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

    if (!response || (!response.text && !response.candidates?.[0]?.content)) {
      console.error('[Guide chat failed all tiers]', attemptLogs.join(' | '));
      return res.status(lastErrorStatus).json({ error: lastErrorMessage });
    }

    const replyText = response.text || '';

    const suggestedPlaceIds: string[] = [];
    for (const place of db.places) {
      if (
        replyText.toLowerCase().includes(place.name.toLowerCase()) ||
        replyText.includes(`[ID: ${place.id}]`) ||
        replyText.includes(place.id)
      ) {
        suggestedPlaceIds.push(place.id);
      }
    }

    const candidate = response.candidates?.[0];
    const groundingChunks = (candidate as any)?.groundingMetadata?.groundingChunks;
    const webSources: { title: string; uri: string }[] = [];
    if (Array.isArray(groundingChunks)) {
      for (const chunk of groundingChunks) {
        const safeUri = sanitizeExternalUrl(chunk.web?.uri);
        if (safeUri) {
          webSources.push({
            title: cleanText(chunk.web?.title || 'Уеб източник', 120),
            uri: safeUri,
          });
        }
      }
    }

    if (webSources.length === 0 && usedLiveWebFallback?.sources?.length) {
      webSources.push(...usedLiveWebFallback.sources);
    }

    const nativeQueries: string[] = (candidate as any)?.groundingMetadata?.webSearchQueries || [];
    const searchQueries: string[] =
      nativeQueries.length > 0 ? nativeQueries : usedLiveWebFallback?.queries || [];

    return res.json({
      reply: replyText.replace(/\[ID:\s*[^\]]+\]/g, '').trim(),
      modelUsed: successfulModelName,
      fallbackReason: fallbackNotice,
      suggestedPlaceIds: Array.from(new Set(suggestedPlaceIds)).slice(0, 4),
      webSources: webSources.slice(0, 6),
      searchQueries,
    });
  } catch (error: any) {
    console.error('Guide chat handler error:', error);
    return res.status(500).json({
      error: 'Възникна неочаквана грешка при комуникацията с Пътеводителя.',
    });
  }
}

app.post('/api/guide/chat', aiRateLimiter, handleGuideChat);
app.post('/api/ai/chat', aiRateLimiter, handleGuideChat);

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
