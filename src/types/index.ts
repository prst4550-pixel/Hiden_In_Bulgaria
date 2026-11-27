export type DifficultyLevel = 'Лесен' | 'Умерен' | 'Труден' | 'Екстремен';

export interface Place {
  id: string;
  name: string;
  slug: string;
  regionId: string;
  regionName: string;
  categoryId: string;
  categoryName: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  elevationMeters?: number;
  shortDescription: string;
  fullDescription: string;
  history: string;
  accessTips: string;
  terrainType: string;
  difficulty: DifficultyLevel;
  bestSeason: string;
  imageUrl: string;
  imageCredit: string;
  gallery?: string[];
  nearbyPlaceIds?: string[];
  routeIds?: string[];
  isFeatured?: boolean;
  isVerified: boolean;
  rating?: number;
  reviewCount?: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  iconName: string;
  slug?: string;
  icon?: string;
  count?: number;
}

export interface Region {
  id: string;
  name: string;
  description: string;
  centerCoordinates: [number, number];
  zoomLevel: number;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface RouteStop {
  placeId: string;
  placeName: string;
  order: number;
  notes: string;
  coordinates: [number, number];
}

export interface Route {
  id: string;
  title: string;
  description: string;
  duration: string;
  totalDistance: string;
  difficulty: DifficultyLevel;
  regionName: string;
  imageUrl: string;
  stops: RouteStop[];
  slug?: string;
  regionId?: string;
  durationHours?: number;
  distanceKm?: number;
  isCustom?: boolean;
  createdAt?: string;
}

export interface CommunitySuggestion {
  id: string;
  name: string;
  region: string;
  category: string;
  latitude: number;
  longitude: number;
  description: string;
  source: string;
  imageUrl?: string;
  contact?: string;
  status: 'pending' | 'approved' | 'rejected';
  userId?: string;
  /** Id of the catalog place created when the suggestion was approved. */
  placeId?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  placeId: string;
  author: string;
  userId?: string;
  rating: number;
  comment: string;
  visitSeason: string;
  createdAt: string;
}

export interface WebSource {
  title: string;
  uri: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status?: 'active' | 'blocked';
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AdminStatus {
  adminClaimed: boolean;
  envConfigured: boolean;
  adminEmail: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead?: boolean;
  createdAt: string;
}

export interface AdminReview extends Review {
  placeName: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  details: string;
  adminEmail: string;
  createdAt: string;
}

export interface AdminStats {
  totals: {
    places: number;
    featuredPlaces: number;
    users: number;
    blockedUsers: number;
    reviews: number;
    averageRating: number | null;
    pendingSuggestions: number;
    suggestions: number;
    messages: number;
    unreadMessages: number;
  };
  placesByCategory: { name: string; count: number }[];
  placesByRegion: { name: string; count: number }[];
  topRatedPlaces: { id: string; name: string; rating: number; reviewCount: number }[];
  mostFavoritedPlaces: { id: string; name: string; count: number }[];
  registrationsLast30Days: number;
  reviewsLast30Days: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'guide';
  text: string;
  timestamp: string;
  imageUrl?: string;
  modelUsed?: string;
  fallbackReason?: string;
  suggestedPlaceIds?: string[];
  webSources?: WebSource[];
  searchQueries?: string[];
}

export interface UserProfileData {
  favorites: string[];
  customRoutes: Route[];
  recentTrailIds: string[];
  guideChatHistory: ChatMessage[];
  updatedAt: string;
}
