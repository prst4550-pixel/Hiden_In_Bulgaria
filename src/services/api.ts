import {
  Place,
  Category,
  Region,
  Route,
  CommunitySuggestion,
  Review,
  User,
  AdminStatus,
  ContactMessage,
  UserProfileData,
  ChatMessage,
} from '../types';
import { PLACES, CATEGORIES, REGIONS, ROUTES } from '../data/seedData';

// In-memory session token store (never persisted in localStorage or sessionStorage)
let inMemoryAuthToken: string | null = null;

// Clean up any legacy token from earlier builds
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('hb_auth_token');
  }
} catch {
  // ignore storage restriction
}

function getAuthHeader(): Record<string, string> {
  return inMemoryAuthToken ? { Authorization: `Bearer ${inMemoryAuthToken}` } : {};
}

async function safeJsonParse<T = any>(res: Response, fallbackError: string): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.reply || fallbackError);
      }
      return data;
    } catch (err: any) {
      if (err.message && err.message !== fallbackError) throw err;
      throw new Error(fallbackError);
    }
  }

  const text = await res.text();
  console.warn('Server returned non-JSON response:', text.slice(0, 120));
  throw new Error(
    !res.ok
      ? `Сървърът върна статус (${res.status}). Моля, опитайте отново.`
      : fallbackError
  );
}

export async function fetchPlaces(filters?: {
  category?: string;
  region?: string;
  search?: string;
  difficulty?: string;
}): Promise<Place[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters?.region && filters.region !== 'all') params.append('region', filters.region);
    if (filters?.difficulty && filters.difficulty !== 'all') params.append('difficulty', filters.difficulty);
    if (filters?.search) params.append('search', filters.search);

    const res = await fetch(`/api/places?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch from server');
    return await res.json();
  } catch (err) {
    console.warn('API error fetching places, falling back to local seed data:', err);
    let results = [...PLACES];
    if (filters?.category && filters.category !== 'all') {
      results = results.filter((p) => p.categoryId === filters.category);
    }
    if (filters?.region && filters.region !== 'all') {
      results = results.filter((p) => p.regionId === filters.region);
    }
    if (filters?.difficulty && filters.difficulty !== 'all') {
      results = results.filter((p) => p.difficulty === filters.difficulty);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      results = results.filter(
        (p) => p.name.toLowerCase().includes(q) || p.shortDescription.toLowerCase().includes(q)
      );
    }
    return results;
  }
}

export async function fetchPlaceById(id: string): Promise<Place | null> {
  try {
    const res = await fetch(`/api/places/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Not found');
    return await res.json();
  } catch (err) {
    console.warn('API error fetching place by id:', err);
    return PLACES.find((p) => p.id === id || p.slug === id) || null;
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const res = await fetch('/api/categories');
    if (!res.ok) throw new Error('Failed');
    return await res.json();
  } catch {
    return CATEGORIES;
  }
}

export async function fetchRegions(): Promise<Region[]> {
  try {
    const res = await fetch('/api/regions');
    if (!res.ok) throw new Error('Failed');
    return await res.json();
  } catch {
    return REGIONS;
  }
}

export async function fetchRoutes(): Promise<Route[]> {
  try {
    const res = await fetch('/api/routes');
    if (!res.ok) throw new Error('Failed');
    return await res.json();
  } catch {
    return ROUTES;
  }
}

export async function fetchSuggestions(): Promise<CommunitySuggestion[]> {
  const res = await fetch('/api/suggestions', {
    headers: { ...getAuthHeader() },
  });
  return await safeJsonParse<CommunitySuggestion[]>(res, 'Грешка при зареждане на предложенията.');
}

export async function submitSuggestion(
  data: Partial<CommunitySuggestion>
): Promise<{ message: string; suggestion: CommunitySuggestion }> {
  const res = await fetch('/api/suggestions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });
  return await safeJsonParse(res, 'Възникна грешка при изпращането.');
}

export async function updateSuggestionStatus(
  id: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  const res = await fetch(`/api/suggestions/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ status }),
  });
  await safeJsonParse(res, 'Грешка при обновяване на статуса.');
}

export async function fetchReviews(placeId: string): Promise<Review[]> {
  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(placeId)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function submitReview(data: {
  placeId: string;
  author: string;
  rating: number;
  comment: string;
  visitSeason: string;
}): Promise<Review> {
  const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(data),
  });
  return await safeJsonParse(res, 'Грешка при запис на отзива.');
}

export async function submitContactMessage(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<{ message: string }> {
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return await safeJsonParse(res, 'Грешка при изпращане на запитването.');
}

export async function fetchContactMessages(): Promise<ContactMessage[]> {
  const res = await fetch('/api/contact', {
    headers: { ...getAuthHeader() },
  });
  return await safeJsonParse<ContactMessage[]>(res, 'Грешка при зареждане на запитванията.');
}

export async function sendGuideMessage(
  message: string,
  history: { role: string; text: string }[],
  image?: string,
  mimeType?: string
): Promise<{
  reply: string;
  modelUsed?: string;
  fallbackReason?: string;
  suggestedPlaceIds?: string[];
  webSources?: { title: string; uri: string }[];
  searchQueries?: string[];
}> {
  try {
    const res = await fetch('/api/guide/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, image, mimeType }),
      signal: AbortSignal.timeout(40000),
    });
    return await safeJsonParse(res, 'Временна грешка при връзка с Пътеводителя.');
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new Error('Заявката към Пътеводителя отне твърде много време. Моля, опитайте отново.');
    }
    if (err instanceof TypeError) {
      throw new Error('Връзката със сървъра беше прекъсната. Моля, опитайте отново.');
    }
    throw err;
  }
}

// -------------------------------------------------------------
// AUTH & ADMIN API METHODS
// -------------------------------------------------------------

export async function fetchAdminStatus(): Promise<AdminStatus> {
  const res = await fetch('/api/auth/admin-status');
  return await safeJsonParse<AdminStatus>(res, 'Грешка при проверка на администраторския статус.');
}

export async function claimAdminAccount(
  email: string,
  password: string,
  name?: string
): Promise<{ token: string; user: User }> {
  const res = await fetch('/api/auth/claim-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  const data = await safeJsonParse<{ token: string; user: User }>(
    res,
    'Неуспешно активиране на администраторския достъп.'
  );
  inMemoryAuthToken = data.token;
  return data;
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ token: string; user: User }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await safeJsonParse<{ token: string; user: User }>(
    res,
    'Неуспешен вход в системата.'
  );
  inMemoryAuthToken = data.token;
  return data;
}

export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<{ token: string; user: User }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await safeJsonParse<{ token: string; user: User }>(res, 'Неуспешна регистрация.');
  inMemoryAuthToken = data.token;
  return data;
}

export async function getCurrentUser(): Promise<User | null> {
  if (!inMemoryAuthToken) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      inMemoryAuthToken = null;
      return null;
    }
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    if (inMemoryAuthToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { ...getAuthHeader() },
      });
    }
  } finally {
    inMemoryAuthToken = null;
  }
}

export async function fetchUsers(): Promise<User[]> {
  try {
    const res = await fetch('/api/users', {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// ISOLATED USER PROFILE DATA API METHODS
// -------------------------------------------------------------

export async function fetchProfileData(): Promise<UserProfileData> {
  const res = await fetch('/api/profile/data', {
    headers: { ...getAuthHeader() },
  });
  return await safeJsonParse<UserProfileData>(res, 'Грешка при зареждане на личния профил.');
}

export async function updateProfileName(name: string): Promise<User> {
  const res = await fetch('/api/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ name }),
  });
  const data = await safeJsonParse<{ user: User }>(res, 'Грешка при обновяване на името.');
  return data.user;
}

export async function saveProfileFavorites(favorites: string[]): Promise<string[]> {
  const res = await fetch('/api/profile/favorites', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ favorites }),
  });
  const data = await safeJsonParse<{ favorites: string[] }>(res, 'Грешка при запис на любимите обекти.');
  return data.favorites;
}

export async function saveProfileTrail(recentTrailIds: string[]): Promise<string[]> {
  const res = await fetch('/api/profile/trail', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ recentTrailIds }),
  });
  const data = await safeJsonParse<{ recentTrailIds: string[] }>(res, 'Грешка при запис на пътеката.');
  return data.recentTrailIds;
}

export async function saveProfileRoute(
  route: Route
): Promise<{ route: Route; customRoutes: Route[] }> {
  const res = await fetch('/api/profile/routes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(route),
  });
  return await safeJsonParse<{ route: Route; customRoutes: Route[] }>(
    res,
    'Грешка при запис на маршрута в профила.'
  );
}

export async function deleteProfileRoute(routeId: string): Promise<Route[]> {
  const res = await fetch(`/api/profile/routes/${encodeURIComponent(routeId)}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() },
  });
  const data = await safeJsonParse<{ customRoutes: Route[] }>(
    res,
    'Грешка при изтриване на маршрута.'
  );
  return data.customRoutes;
}

export async function saveProfileGuideChat(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const res = await fetch('/api/profile/guide-chat', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ messages }),
  });
  const data = await safeJsonParse<{ guideChatHistory: ChatMessage[] }>(
    res,
    'Грешка при запис на разговора.'
  );
  return data.guideChatHistory;
}

export async function fetchMyProfileActivity(): Promise<{
  suggestions: CommunitySuggestion[];
  reviews: Review[];
}> {
  const res = await fetch('/api/profile/activity', {
    headers: { ...getAuthHeader() },
  });
  return await safeJsonParse<{ suggestions: CommunitySuggestion[]; reviews: Review[] }>(
    res,
    'Грешка при зареждане на личната активност.'
  );
}

export async function createPlace(placeData: Partial<Place>): Promise<Place> {
  const res = await fetch('/api/places', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(placeData),
  });

  return await safeJsonParse(res, 'Грешка при създаване на обекта.');
}

export async function updatePlace(id: string, placeData: Partial<Place>): Promise<Place> {
  const res = await fetch(`/api/places/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(placeData),
  });

  return await safeJsonParse(res, 'Грешка при редактиране на обекта.');
}

export async function deletePlace(id: string): Promise<void> {
  const res = await fetch(`/api/places/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeader(),
    },
  });

  await safeJsonParse(res, 'Грешка при изтриване на обекта.');
}

// -------------------------------------------------------------
// SSMS ADMIN API HELPERS
// -------------------------------------------------------------

export async function fetchSsmsSchema(): Promise<any> {
  const res = await fetch('/api/ssms/schema', {
    headers: { ...getAuthHeader() },
  });
  return await safeJsonParse(res, 'Грешка при зареждане на схемата.');
}

export async function runSsmsQuery(query: string): Promise<any> {
  const res = await fetch('/api/ssms/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ query }),
  });
  return await safeJsonParse(res, 'Грешка при изпълнение на T-SQL заявката.');
}

export async function downloadSsmsSql(): Promise<void> {
  const res = await fetch('/api/ssms/export', {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) {
    throw new Error('Необходими са администраторски права за изтегляне на SQL скрипта.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'BulgariaTravel_SSMS.sql';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
