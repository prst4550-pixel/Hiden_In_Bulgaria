import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Place, Category, Region, Route, User, ChatMessage, UserProfileData } from './types';
import {
  fetchPlaces,
  fetchCategories,
  fetchRegions,
  fetchRoutes,
  getCurrentUser,
  logoutUser,
  deletePlace,
  fetchProfileData,
  saveProfileFavorites,
  saveProfileTrail,
  saveProfileRoute,
  deleteProfileRoute,
  saveProfileGuideChat,
} from './services/api';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { InteractiveMap } from './components/InteractiveMap';
import { CatalogView } from './components/CatalogView';
import { RouteList } from './components/RouteList';
import { AiGuideChat } from './components/AiGuideChat';
import { CommunityView } from './components/CommunityView';
import { PlaceDetailModal } from './components/PlaceDetailModal';
import { FavoritesModal } from './components/FavoritesModal';
import { ProfileModal } from './components/ProfileModal';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { EditPlaceModal } from './components/EditPlaceModal';
import { SsmsStudioView } from './components/SsmsStudioView';
import { Footer } from './components/Footer';
import { LegalPages, LegalPageMode } from './components/LegalPages';
import { handleImageError } from './utils/imageFallback';
import {
  Compass,
  ArrowRight,
  MapPin,
  ChevronRight,
  Edit3,
  Shield,
  BookOpen,
  Database,
  Camera,
  ArrowUpRight,
  AlertTriangle,
  X,
} from 'lucide-react';

const TAB_TITLES: Record<string, string> = {
  home: 'Скрито в България — Интерактивен атлас и тайни маршрути',
  map: 'Интерактивна карта — Скрито в България',
  catalog: 'Каталог на скритите места — Скрито в България',
  routes: 'Експедиционни маршрути — Скрито в България',
  guide: 'Пътеводител — Скрито в България',
  community: 'Предложи скрито място — Скрито в България',
  ssms: 'SSMS База данни — Скрито в България',
  privacy: 'Политика за поверителност — Скрито в България',
  terms: 'Общи условия — Скрито в България',
  cookies: 'Политика за бисквитки — Скрито в България',
  contact: 'Контакти — Скрито в България',
};

const TAB_DESCRIPTIONS: Record<string, string> = {
  home: 'Открийте малко известни древни светилища, крепости, водопади, пещери и автентични маршрути в България с проверени GPS координати.',
  map: 'Интерактивна топографска и сателитна карта на скритите забележителности и персонални маршрути в България.',
  catalog: 'Пълен каталог на верифицираните природни и исторически места в България с филтри по регион, категория и трудност.',
  routes: 'Експедиционни маршрути и планиране на собствен маршрут с интерактивно проследяване на картата.',
  guide: 'Интерактивен пътеводител с проверка на цени, хотели, прогноза за времето и разпознаване на забележителности по снимка.',
  community: 'Предложете ново скрито природно или историческо място в България за проверка и включване в каталога.',
  ssms: 'Административна T-SQL конзола и управление на каталога.',
  privacy: 'Политика за поверителност и защита на личните данни на платформата Скрито в България.',
  terms: 'Общи условия за ползване на платформата Скрито в България.',
  cookies: 'Информация за локалното съхранение и настройките за поверителност.',
  contact: 'Контакти, редакционни запитвания и спешни номера в България.',
};

const VALID_TABS = new Set(Object.keys(TAB_TITLES));

function getInitialTabFromUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && VALID_TABS.has(tab)) {
      return tab;
    }
  } catch {
    // ignore URL parse error
  }
  return 'home';
}

const GUEST_LEGACY_KEYS = [
  'hb_guest_favorites',
  'hb_guest_recent_trail',
  'hb_guest_custom_routes',
  'hb_guest_guide_chat',
];

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>(() => getInitialTabFromUrl());
  const [places, setPlaces] = useState<Place[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogCategory, setCatalogCategory] = useState<string>('all');

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register'>('login');
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
  const pendingAuthActionRef = useRef<
    ((user: User, profile?: UserProfileData | null) => void | Promise<void>) | null
  >(null);
  const [isEditPlaceOpen, setIsEditPlaceOpen] = useState(false);
  const [editTargetPlace, setEditTargetPlace] = useState<Place | null>(null);
  const [confirmDeletePlaceTarget, setConfirmDeletePlaceTarget] = useState<Place | null>(null);

  // Per-profile isolated states (populated strictly for authenticated users)
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentTrail, setRecentTrail] = useState<Place[]>([]);
  const [pendingTrailIds, setPendingTrailIds] = useState<string[] | null>(null);
  const [customRoutes, setCustomRoutes] = useState<Route[]>([]);
  const [guideMessages, setGuideMessages] = useState<ChatMessage[]>([]);
  const [activeMapRoute, setActiveMapRoute] = useState<Route | null>(null);

  // Modal states
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [mapTargetPlaceId, setMapTargetPlaceId] = useState<string | null>(null);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';
  const isLegalPage =
    currentTab === 'privacy' ||
    currentTab === 'terms' ||
    currentTab === 'cookies' ||
    currentTab === 'contact';

  useEffect(() => {
    document.title = TAB_TITLES[currentTab] || TAB_TITLES.home;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', TAB_DESCRIPTIONS[currentTab] || TAB_DESCRIPTIONS.home);
    }
    try {
      const url = new URL(window.location.href);
      if (currentTab === 'home') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', currentTab);
      }
      window.history.replaceState(null, '', url.pathname + url.search);
    } catch {
      // ignore history update restriction
    }
  }, [currentTab]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isEditPlaceOpen) {
        setIsEditPlaceOpen(false);
        setEditTargetPlace(null);
      } else if (isAdminOpen) {
        setIsAdminOpen(false);
      } else if (isProfileOpen) {
        setIsProfileOpen(false);
      } else if (isFavoritesOpen) {
        setIsFavoritesOpen(false);
      } else if (isAuthOpen) {
        setIsAuthOpen(false);
      } else if (selectedPlace) {
        setSelectedPlace(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditPlaceOpen, isAdminOpen, isProfileOpen, isFavoritesOpen, isAuthOpen, selectedPlace]);

  const loadIsolatedUserProfile = useCallback(
    async (placesCatalog: Place[]): Promise<UserProfileData | null> => {
      try {
        const profile = await fetchProfileData();
        setFavorites(Array.isArray(profile.favorites) ? profile.favorites : []);
        setCustomRoutes(Array.isArray(profile.customRoutes) ? profile.customRoutes : []);
        setGuideMessages(Array.isArray(profile.guideChatHistory) ? profile.guideChatHistory : []);

        const trailIds = Array.isArray(profile.recentTrailIds) ? profile.recentTrailIds : [];
        if (placesCatalog.length > 0) {
          const resolved = trailIds
            .map((id) => placesCatalog.find((p) => p.id === id || p.slug === id))
            .filter(Boolean) as Place[];
          setRecentTrail(resolved);
          setPendingTrailIds(null);
        } else {
          setPendingTrailIds(trailIds);
          setRecentTrail([]);
        }
        return profile;
      } catch (err) {
        console.warn('Could not load isolated user profile:', err);
        return null;
      }
    },
    []
  );

  // Resolve pending profile trail IDs once places finish loading
  useEffect(() => {
    if (pendingTrailIds && places.length > 0) {
      const resolved = pendingTrailIds
        .map((id) => places.find((p) => p.id === id || p.slug === id))
        .filter(Boolean) as Place[];
      setRecentTrail(resolved);
      setPendingTrailIds(null);
    }
  }, [pendingTrailIds, places]);

  const recordViewedPlace = (place: Place) => {
    if (!place || !place.id) return;
    setRecentTrail((prev) => {
      const filtered = prev.filter((p) => p.id !== place.id);
      const updated = [...filtered, place].slice(-3);
      if (currentUser) {
        saveProfileTrail(updated.map((p) => p.id)).catch((err) =>
          console.warn('Failed to save trail to profile:', err)
        );
      }
      return updated;
    });
  };

  const handleClearTrail = () => {
    setRecentTrail([]);
    if (currentUser) {
      saveProfileTrail([]).catch((err) => console.warn('Failed to clear profile trail:', err));
    }
  };

  useEffect(() => {
    try {
      for (const k of GUEST_LEGACY_KEYS) {
        localStorage.removeItem(k);
      }
    } catch {
      // ignore storage restriction
    }
    loadAllData();
    getCurrentUser().then((user) => {
      if (user) {
        setCurrentUser(user);
        void loadIsolatedUserProfile(places);
      }
    });

    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [placesData, catsData, regionsData, routesData] = await Promise.all([
        fetchPlaces(),
        fetchCategories(),
        fetchRegions(),
        fetchRoutes(),
      ]);
      setPlaces(placesData);
      setCategories(catsData);
      setRegions(regionsData);
      setRoutes(routesData);
    } catch (e) {
      console.error('Error loading data:', e);
    } finally {
      setLoading(false);
    }
  };

  const requireAuthForAction = useCallback(
    (
      message: string,
      action: (user: User, profile?: UserProfileData | null) => void | Promise<void>,
      tab: 'login' | 'register' = 'login'
    ): boolean => {
      if (currentUser) {
        void action(currentUser);
        return true;
      }
      pendingAuthActionRef.current = action;
      setAuthPromptMessage(message);
      setAuthInitialTab(tab);
      setIsAuthOpen(true);
      return false;
    },
    [currentUser]
  );

  const handleToggleFavorite = (placeId: string) => {
    if (!currentUser) {
      requireAuthForAction(
        'Влезте в профила си или създайте регистрация, за да запазвате любими места във вашия профил.',
        (_user, profile) => {
          const baseFavs = Array.isArray(profile?.favorites) ? profile.favorites : [];
          const updated = baseFavs.includes(placeId)
            ? baseFavs.filter((id) => id !== placeId)
            : [...baseFavs, placeId];
          setFavorites(updated);
          saveProfileFavorites(updated).catch((err) =>
            console.warn('Failed to save favorites to profile:', err)
          );
        }
      );
      return;
    }

    setFavorites((prev) => {
      const updated = prev.includes(placeId)
        ? prev.filter((id) => id !== placeId)
        : [...prev, placeId];
      saveProfileFavorites(updated).catch((err) =>
        console.warn('Failed to save favorites to profile:', err)
      );
      return updated;
    });
  };

  const handleLocateOnMap = (place: Place) => {
    setActiveMapRoute(null);
    setMapTargetPlaceId(place.id);
    recordViewedPlace(place);
    setCurrentTab('map');
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleSelectPlaceById = (placeId: string) => {
    const found = places.find((p) => p.id === placeId || p.slug === placeId);
    if (found) {
      setSelectedPlace(found);
      recordViewedPlace(found);
    }
  };

  const handleSaveCustomRoute = async (route: Route) => {
    if (!currentUser) {
      requireAuthForAction(
        'Влезте или създайте акаунт, за да създавате и запазвате лични маршрути.',
        async () => {
          try {
            const res = await saveProfileRoute(route);
            setCustomRoutes(res.customRoutes);
            setActiveMapRoute((prev) =>
              prev && (prev.id === route.id || prev.id === res.route.id) ? res.route : prev
            );
          } catch (err: any) {
            setAppError(err.message || 'Грешка при запис на маршрута във вашия профил.');
          }
        }
      );
      return;
    }

    try {
      const res = await saveProfileRoute(route);
      setCustomRoutes(res.customRoutes);
      setActiveMapRoute((prev) =>
        prev && (prev.id === route.id || prev.id === res.route.id) ? res.route : prev
      );
    } catch (err: any) {
      setAppError(err.message || 'Грешка при запис на маршрута във вашия профил.');
    }
  };

  const handleDeleteCustomRoute = async (routeId: string) => {
    if (!currentUser) {
      requireAuthForAction(
        'Влезте в профила си, за да управлявате личните си маршрути.',
        () => {}
      );
      return;
    }
    try {
      const updatedRoutes = await deleteProfileRoute(routeId);
      setCustomRoutes(updatedRoutes);
      setActiveMapRoute((prev) => (prev?.id === routeId ? null : prev));
    } catch (err: any) {
      setAppError(err.message || 'Грешка при изтриване на маршрута.');
    }
  };

  const handleGuideMessagesChange = (messages: ChatMessage[]) => {
    setGuideMessages(messages);
    if (currentUser) {
      const compact = messages.map(({ imageUrl: _img, ...rest }) => rest);
      saveProfileGuideChat(compact).catch((err) =>
        console.warn('Failed to save guide chat to profile:', err)
      );
    }
  };

  const handleExploreRouteOnMap = (route: Route) => {
    if (!currentUser) {
      requireAuthForAction(
        `Влезте или се регистрирайте, за да проследите и използвате маршрута „${route.title}“ на картата.`,
        () => {
          setMapTargetPlaceId(null);
          setActiveMapRoute(route);
          setCurrentTab('map');
          window.scrollTo({ top: 120, behavior: 'smooth' });
        }
      );
      return;
    }
    setMapTargetPlaceId(null);
    setActiveMapRoute(route);
    setCurrentTab('map');
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const handleAuthSuccess = async (user: User) => {
    const pendingAction = pendingAuthActionRef.current;
    pendingAuthActionRef.current = null;
    setAuthPromptMessage(null);

    const profile = await loadIsolatedUserProfile(places);
    setCurrentUser(user);
    void loadAllData();

    if (pendingAction) {
      await pendingAction(user, profile);
    } else {
      setActiveMapRoute(null);
      setSelectedPlace(null);
      setMapTargetPlaceId(null);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    pendingAuthActionRef.current = null;
    setAuthPromptMessage(null);
    setCurrentUser(null);
    setIsAdminOpen(false);
    setIsProfileOpen(false);
    setIsFavoritesOpen(false);
    setActiveMapRoute(null);
    setSelectedPlace(null);
    setMapTargetPlaceId(null);
    setPendingTrailIds(null);
    setFavorites([]);
    setCustomRoutes([]);
    setRecentTrail([]);
    setGuideMessages([]);
  };

  const handleAddNewPlace = () => {
    setEditTargetPlace(null);
    setIsEditPlaceOpen(true);
  };

  const handleEditPlace = (place: Place) => {
    setEditTargetPlace(place);
    setIsEditPlaceOpen(true);
  };

  const handleDeletePlace = (place: Place) => {
    setConfirmDeletePlaceTarget(place);
  };

  const confirmDeletePlaceAction = async () => {
    if (!confirmDeletePlaceTarget) return;
    try {
      await deletePlace(confirmDeletePlaceTarget.id);
      setConfirmDeletePlaceTarget(null);
      await loadAllData();
    } catch (err: any) {
      setAppError(err.message || 'Грешка при изтриване на обекта.');
    }
  };

  const handleHeroSearch = (term: string) => {
    setCatalogSearch(term);
    setCatalogCategory('all');
    setCurrentTab('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHeroCategory = (catId: string) => {
    setCatalogCategory(catId);
    setCatalogSearch('');
    setCurrentTab('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectRegion = (regId: string) => {
    setActiveMapRoute(null);
    const firstPlace = places.find((p) => p.regionId === regId);
    if (firstPlace) {
      setMapTargetPlaceId(firstPlace.id);
    }
    setCurrentTab('map');
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  const featuredPlaces = places.filter((p) => p.isFeatured);
  const spotlightPlace = places.find((p) => p.id === 'belogradchishki-skali') || featuredPlaces[0];
  const secondaryFeatured = featuredPlaces.filter((p) => p.id !== spotlightPlace?.id).slice(0, 4);

  const regionBanners: Record<string, { image: string; tag: string }> = {
    'south_central': { image: '/places/dyavolski-most.jpg', tag: 'Родопи и Тракия' },
    'north_central': { image: '/places/hotnishki-vodopad.jpg', tag: 'Дунав и Балкан' },
    'northwest': { image: '/places/belogradchishki-skali.jpg', tag: 'Северозападен карст' },
    'northeast': { image: '/places/tyulenovo-yaylata.jpg', tag: 'Черноморие & Добруджа' },
    'southwest': { image: '/places/sedemte-rilski-ezera.jpg', tag: 'Рила & Пирин' },
    'southeast': { image: '/places/meandrite-na-veleka.jpg', tag: 'Странджа & Сакар' },
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-stone-900 selection:bg-amber-200 selection:text-stone-950">
      {/* Google Maps Platform Quota Exceeded Notice */}
      {gmpQuotaExceeded && (
        <div
          role="alert"
          className="sticky top-0 z-50 w-full bg-amber-50 border-b border-amber-300 text-amber-950 px-4 py-2.5 text-xs flex items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Дневният лимит на Google Maps Demo ключа е изчерпан.</strong> Превключете на <strong>Leaflet / OSM</strong> в секция „Карта“ или активирайте собствен ключ в Google Cloud.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setGmpQuotaExceeded(false)}
            className="text-amber-800 hover:text-amber-950 cursor-pointer shrink-0"
            aria-label="Затвори предупреждението"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {appError && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-200 text-red-900 px-4 py-2 text-xs flex items-center justify-between gap-2"
        >
          <span>{appError}</span>
          <button
            type="button"
            onClick={() => setAppError(null)}
            className="text-red-700 hover:text-red-950 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Top Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab === 'catalog') {
            setCatalogSearch('');
            setCatalogCategory('all');
          }
          setCurrentTab(tab);
        }}
        favoritesCount={favorites.length}
        onOpenSuggestModal={() => setCurrentTab('community')}
        onOpenFavorites={() =>
          requireAuthForAction(
            'Влезте в профила си или се регистрирайте, за да виждате и управлявате вашите любими места.',
            () => setIsFavoritesOpen(true)
          )
        }
        currentUser={currentUser}
        onOpenAuth={(tab?: 'login' | 'register') => {
          pendingAuthActionRef.current = null;
          setAuthPromptMessage(null);
          setAuthInitialTab(tab || 'login');
          setIsAuthOpen(true);
        }}
        onLogout={handleLogout}
        onOpenAdmin={() => setIsAdminOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onAddNewPlace={handleAddNewPlace}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentTab === 'home' && (
          <div className="space-y-16 lg:space-y-24 pb-20">
            {/* Hero Section with Search & Category Launcher */}
            <Hero
              onExploreMap={() => setCurrentTab('map')}
              onExploreCatalog={() => {
                setCatalogSearch('');
                setCatalogCategory('all');
                setCurrentTab('catalog');
              }}
              onAskGuide={() => setCurrentTab('guide')}
              onOpenSsms={() => setCurrentTab('ssms')}
              onSelectCategory={handleHeroCategory}
              onSearchSubmit={handleHeroSearch}
              isAdmin={isAdmin}
              placesCount={places.length || 48}
            />

            {/* Curated Editorial Spotlight: Grand Feature + Secondary Gems */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
                    <Compass className="w-4 h-4 text-amber-700" />
                    <span>Кураторска селекция</span>
                    {isAdmin && (
                      <span className="bg-amber-100 text-amber-950 font-bold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 border border-amber-300">
                        <Shield className="w-3 h-3" />
                        <span>Администратор</span>
                      </span>
                    )}
                  </div>
                  <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-stone-900 mt-1">
                    Открития на експедицията
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 mt-1">
                    Автентични локации с реални фотографски кадри, прецизен релеф и съхранена история.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <button
                      onClick={handleAddNewPlace}
                      className="btn-liquid-dark water-shimmer px-4 py-2 text-amber-200 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                      <span>Добави обект</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setCatalogSearch('');
                      setCatalogCategory('all');
                      setCurrentTab('catalog');
                    }}
                    className="btn-liquid-water water-shimmer px-5 py-2 text-stone-900 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 group cursor-pointer shadow-xs"
                  >
                    <span>Виж всички {places.length} места</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-amber-800" />
                  </button>
                </div>
              </div>

              {/* Asymmetric Showcase: 1 Panoramic Spotlight + 4 Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                {/* 1. Large Spotlight Panoramic Feature (7 cols) */}
                {spotlightPlace && (
                  <div
                    onClick={() => setSelectedPlace(spotlightPlace)}
                    className="lg:col-span-7 liquid-water-card rounded-3xl overflow-hidden shadow-2xl relative group cursor-pointer flex flex-col justify-end min-h-[460px] border border-white/40"
                  >
                    <img
                      src={spotlightPlace.imageUrl}
                      alt={spotlightPlace.name}
                      className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, spotlightPlace.categoryId, spotlightPlace.name)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />

                    {/* Top badging */}
                    <div className="absolute top-5 left-5 z-10 flex items-center gap-2">
                      <span className="liquid-glass-dock px-3.5 py-1.5 rounded-full text-amber-300 text-xs font-semibold flex items-center gap-1.5 shadow-md">
                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                        <span>Главна експедиция · Реална снимка</span>
                      </span>
                      <span className="liquid-glass-dock px-3 py-1.5 rounded-full text-stone-200 text-xs font-mono">
                        {spotlightPlace.elevationMeters || spotlightPlace.altitude || 510} м н.в.
                      </span>
                    </div>


                    {/* Bottom dossier overlay - full text without cutoffs */}
                    <div className="relative z-10 p-6 sm:p-8 text-white space-y-3.5">
                      <div className="text-xs text-amber-300 font-bold tracking-wider uppercase">
                        {spotlightPlace.categoryName} · {spotlightPlace.regionName}
                      </div>

                      <h3 className="font-editorial text-2xl sm:text-4xl font-bold text-white group-hover:text-amber-200 transition-colors leading-tight">
                        {spotlightPlace.name}
                      </h3>

                      <p className="text-xs sm:text-sm text-stone-200 max-w-xl leading-relaxed">
                        {spotlightPlace.shortDescription}
                      </p>

                      <div className="pt-3 border-t border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <span className="font-mono text-stone-400">
                          {spotlightPlace.latitude.toFixed(4)}°N, {spotlightPlace.longitude.toFixed(4)}°E
                        </span>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLocateOnMap(spotlightPlace);
                            }}
                            className="px-4 py-2 bg-stone-900/90 hover:bg-stone-900 text-amber-200 rounded-xl backdrop-blur-md flex items-center gap-1.5 border border-stone-700/80 shadow-sm font-semibold text-xs active:scale-95 transition-all"
                          >
                            <MapPin className="w-3.5 h-3.5 text-amber-400" />
                            <span>На картата</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlace(spotlightPlace);
                            }}
                            className="px-5 py-2 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 hover:brightness-105 text-stone-950 font-bold rounded-xl shadow-md border border-amber-300/60 flex items-center gap-1.5 text-xs active:scale-95 transition-all"
                          >
                            <span>Разгледай подробно</span>
                            <ArrowUpRight className="w-4 h-4 text-stone-950" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Secondary 4 Featured Cards (5 cols) */}
                <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {secondaryFeatured.map((place) => (
                    <div
                      key={place.id}
                      onClick={() => setSelectedPlace(place)}
                      className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col justify-between group cursor-pointer"
                    >
                      <div className="relative aspect-[16/10] bg-stone-900 overflow-hidden">
                        <img
                          src={place.imageUrl}
                          alt={place.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, place.categoryId, place.name)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-transparent to-transparent" />
                        <div className="absolute top-2.5 left-2.5">
                          <span className="bg-stone-950/85 backdrop-blur-md text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-amber-400/30 flex items-center gap-1 shadow-2xs">
                            <Camera className="w-3 h-3 text-amber-400" />
                            <span>Реална снимка</span>
                          </span>
                        </div>
                        <div className="absolute bottom-2 inset-x-2.5 text-[10px] font-mono text-stone-300 flex items-center justify-between">
                          <span>{place.latitude.toFixed(3)}°N, {place.longitude.toFixed(3)}°E</span>
                          {place.elevationMeters || place.altitude ? (
                            <span className="text-amber-300">{place.elevationMeters || place.altitude} м</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <div className="text-[11px] text-amber-900 font-bold">
                            {place.categoryName} · <span className="text-stone-500 font-normal">{place.difficulty}</span>
                          </div>
                          <h4 className="font-editorial text-base font-bold text-stone-950 group-hover:text-amber-900 transition-colors leading-snug">
                            {place.name}
                          </h4>
                          <p className="text-xs text-stone-600 leading-relaxed line-clamp-3">
                            {place.shortDescription}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLocateOnMap(place);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#F4EFE6] hover:bg-[#EAE2D2] text-stone-800 text-[11px] font-semibold flex items-center gap-1 border border-stone-300/80 transition-all active:scale-95"
                          >
                            <MapPin className="w-3 h-3 text-amber-800" />
                            <span>Карта</span>
                          </button>
                          <span className="px-3 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 text-amber-200 font-bold text-[11px] flex items-center gap-1 border border-stone-800 transition-all shadow-2xs">
                            <span>Виж</span>
                            <ArrowUpRight className="w-3 h-3 text-amber-300" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Microsoft SQL Server / SSMS T-SQL Integration Showcase Banner (ADMIN ONLY) */}
            {isAdmin && (
              <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-[#18181B] text-white rounded-3xl p-6 sm:p-10 border border-[#27272A] shadow-2xl relative overflow-hidden">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                    <div className="lg:col-span-7 space-y-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#0078D4]/20 text-[#60A5FA] rounded-lg text-xs font-mono font-semibold border border-[#0078D4]/40">
                        <Database className="w-3.5 h-3.5 text-[#60A5FA]" />
                        <span>Microsoft SQL Server (SSMS 18/19/20) & T-SQL Database (Администратор)</span>
                      </div>

                      <h3 className="font-editorial text-3xl sm:text-4xl font-bold text-white leading-tight">
                        Пълната база данни на България, готова за SSMS
                      </h3>

                      <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-xl">
                        Всички 48 исторически и природни локации са моделирани в пълна релационна T-SQL база данни с native <code>GEOGRAPHY (SRID 4326)</code> типове, пространствени индекси, изгледи и съхранени процедури за разстояния.
                      </p>

                      <div className="pt-2 flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => setCurrentTab('ssms')}
                          className="px-6 py-3.5 bg-gradient-to-b from-[#0078D4] to-[#005A9E] hover:from-[#106EBE] hover:to-[#004E8C] text-white text-xs sm:text-sm font-bold rounded-xl border border-blue-400/50 shadow-md flex items-center gap-2 transition-all active:scale-95"
                        >
                          <Database className="w-4 h-4" />
                          <span>Отвори SSMS Студио в браузъра</span>
                        </button>

                        <a
                          href="/api/ssms/export"
                          download="BulgariaTravel_SSMS.sql"
                          className="px-5 py-3.5 bg-[#27272A] hover:bg-[#3F3F46] text-stone-200 text-xs sm:text-sm font-bold rounded-xl border border-[#3F3F46] shadow-sm flex items-center gap-2 transition-all active:scale-95"
                        >
                          <span>Свали .SQL файл (60 KB)</span>
                          <ArrowUpRight className="w-4 h-4 text-amber-400" />
                        </a>
                      </div>
                    </div>

                    {/* Right side: T-SQL code snippet replica */}
                    <div className="lg:col-span-5 bg-[#0F0F11] rounded-2xl border border-[#27272A] p-4 font-mono text-[11px] text-stone-300 space-y-2 shadow-inner">
                      <div className="flex items-center justify-between text-stone-500 text-[10px] pb-2 border-b border-[#27272A]">
                        <span>BulgariaTravel_SSMS.sql</span>
                        <span className="text-emerald-400">● T-SQL Validated</span>
                      </div>
                      <div className="text-blue-400">-- Създаване на база данни в SSMS</div>
                      <div>
                        <span className="text-purple-400">CREATE DATABASE</span> [BulgariaTravel]
                      </div>
                      <div>
                        <span className="text-purple-400">COLLATE</span> Cyrillic_General_100_CI_AI_SC_UTF8;
                      </div>
                      <div className="text-blue-400 pt-1">-- Пространствено търсене в радиус:</div>
                      <div>
                        <span className="text-purple-400">SELECT</span> Name, GeoLocation.<span className="text-amber-300">STDistance</span>(@P) / 1000.0 <span className="text-purple-400">AS</span> Km
                      </div>
                      <div>
                        <span className="text-purple-400">FROM</span> dbo.Places <span className="text-purple-400">WHERE</span> IsFeatured = 1;
                      </div>
                    </div>
                  </div>

                  {/* Subtle blue background glow */}
                  <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[#0078D4]/10 blur-3xl pointer-events-none" />
                </div>
              </section>
            )}

            {/* Geographic Regions of Bulgaria with Real Photos */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="border-b border-stone-200 pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                  География на родината
                </span>
                <h2 className="font-editorial text-3xl font-bold text-stone-900 mt-1">
                  Открийте България по региони
                </h2>
                <p className="text-xs sm:text-sm text-stone-600 mt-1">
                  Всеки от шестте региона крие свой уникален ландшафт и хилядолетни културни пластове.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {regions.map((reg) => {
                  const regCount = places.filter((p) => p.regionId === reg.id).length;
                  const banner = regionBanners[reg.id] || {
                    image: '/places/belintash.jpg',
                    tag: reg.name,
                  };
                  return (
                    <div
                      key={reg.id}
                      onClick={() => handleSelectRegion(reg.id)}
                      className="group bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="relative aspect-[16/10] bg-stone-900 overflow-hidden">
                        <img
                          src={banner.image}
                          alt={reg.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, undefined, reg.name)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/20 to-transparent" />
                        <div className="absolute top-3 left-3">
                          <span className="bg-stone-950/80 backdrop-blur-md text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-amber-400/30">
                            {banner.tag}
                          </span>
                        </div>
                        <div className="absolute bottom-3 left-3 right-3 text-white flex items-center justify-between">
                          <h3 className="font-editorial text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                            {reg.name.split('(')[0]}
                          </h3>
                          <span className="text-xs font-semibold bg-stone-900/80 px-2 py-0.5 rounded border border-stone-700 text-stone-200 font-mono">
                            {regCount} места
                          </span>
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        <p className="text-xs text-stone-600 leading-relaxed line-clamp-3">
                          {reg.description}
                        </p>
                        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-stone-900 group-hover:text-amber-900">
                          <span>Виж на картата</span>
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-amber-800" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Field Guide Banner (AI Guide) */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-[#1C1917] text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-2xl border border-stone-800">
                <div className="relative z-10 max-w-2xl space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 text-amber-300 rounded-xl text-xs font-semibold border border-amber-400/30">
                    <BookOpen className="w-4 h-4 text-amber-300" />
                    <span>Теренен съветник & Краеведски архив</span>
                  </div>
                  <h3 className="font-editorial text-3xl sm:text-5xl font-bold text-white leading-tight">
                    „Пътеводителят“ — вашият личен краевед
                  </h3>
                  <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
                    Задайте въпрос за достъпността на пътеките, прогнозата за времето, легендите за древните светилища или най-доброто време за снимане.
                    Нашият съветник отговаря на чист български език, анализира каталога и предлага точни маршрути.
                  </p>
                  <div className="pt-3">
                    <button
                      onClick={() => setCurrentTab('guide')}
                      className="px-7 py-4 text-xs sm:text-sm font-bold text-stone-950 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:brightness-105 rounded-xl border border-amber-300/60 shadow-lg active:scale-95 inline-flex items-center gap-2.5 transition-all"
                    >
                      <Compass className="w-4 h-4 text-stone-950" />
                      <span>Започни разговор с Пътеводителя</span>
                    </button>
                  </div>
                </div>

                <div className="absolute right-0 bottom-0 top-0 w-1/2 opacity-15 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-200 via-stone-500 to-transparent" />
              </div>
            </section>
          </div>
        )}

        {currentTab === 'map' && (
          <InteractiveMap
            places={places}
            categories={categories}
            regions={regions}
            selectedPlaceId={mapTargetPlaceId}
            onSelectPlace={(place) => {
              setSelectedPlace(place);
              recordViewedPlace(place);
            }}
            currentUser={currentUser}
            onEditPlace={handleEditPlace}
            recentTrail={recentTrail}
            onClearTrail={handleClearTrail}
            onSelectTrailStep={(place) => {
              setMapTargetPlaceId(place.id);
              recordViewedPlace(place);
            }}
            routes={[...customRoutes, ...routes]}
            activeRoute={activeMapRoute}
            onSelectActiveRoute={setActiveMapRoute}
            onSaveCustomRoute={handleSaveCustomRoute}
            onRequireAuth={requireAuthForAction}
          />
        )}

        {currentTab === 'catalog' && (
          <CatalogView
            places={places}
            categories={categories}
            regions={regions}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onSelectPlace={(place) => setSelectedPlace(place)}
            onLocateOnMap={handleLocateOnMap}
            currentUser={currentUser}
            onAddNewPlace={handleAddNewPlace}
            onEditPlace={handleEditPlace}
            onDeletePlace={handleDeletePlace}
            initialSearch={catalogSearch}
            initialCategory={catalogCategory}
          />
        )}

        {currentTab === 'routes' && (
          <RouteList
            routes={routes}
            customRoutes={customRoutes}
            places={places}
            onSelectPlaceById={handleSelectPlaceById}
            onExploreRouteOnMap={handleExploreRouteOnMap}
            onSaveCustomRoute={handleSaveCustomRoute}
            onDeleteCustomRoute={handleDeleteCustomRoute}
            currentUser={currentUser}
            onOpenAuth={(tab) => {
              pendingAuthActionRef.current = null;
              setAuthPromptMessage(null);
              setAuthInitialTab(tab || 'login');
              setIsAuthOpen(true);
            }}
            onRequireAuth={requireAuthForAction}
          />
        )}

        {currentTab === 'guide' && (
          <AiGuideChat
            places={places}
            onSelectPlaceById={handleSelectPlaceById}
            currentUser={currentUser}
            persistedMessages={guideMessages}
            onPersistedMessagesChange={handleGuideMessagesChange}
            onRequireAuth={requireAuthForAction}
          />
        )}

        {currentTab === 'ssms' && (
          isAdmin ? (
            <SsmsStudioView onBackToExplore={() => setCurrentTab('home')} />
          ) : (
            <div className="max-w-md mx-auto my-20 p-8 bg-white rounded-3xl border border-stone-200 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto border border-amber-200">
                <Shield className="w-6 h-6 text-amber-800" />
              </div>
              <h3 className="font-editorial text-2xl font-bold text-stone-900">
                Достъпът е ограничен
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Студиото за управление на T-SQL базата данни (SSMS) е налично единствено за системни администратори.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-stone-900 text-amber-200 text-xs font-semibold rounded-xl hover:bg-stone-800 transition-colors shadow-2xs"
                >
                  Вход като администратор
                </button>
                <button
                  onClick={() => setCurrentTab('home')}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#F4EFE6] text-stone-800 text-xs font-semibold rounded-xl hover:bg-[#EBE4D8] transition-colors"
                >
                  Начална страница
                </button>
              </div>
            </div>
          )
        )}

        {currentTab === 'community' && (
          <CommunityView
            categories={categories}
            regions={regions}
            onOpenAdmin={() => setIsAdminOpen(true)}
            onExploreMap={() => setCurrentTab('map')}
            isAdmin={isAdmin}
            currentUser={currentUser}
            onRequireAuth={requireAuthForAction}
          />
        )}

        {isLegalPage && (
          <LegalPages
            mode={currentTab as LegalPageMode}
            onNavigate={(tab) => {
              setCurrentTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      {/* Place Detail Modal */}
      <PlaceDetailModal
        place={selectedPlace}
        isOpen={!!selectedPlace}
        onClose={() => setSelectedPlace(null)}
        isFavorite={selectedPlace ? favorites.includes(selectedPlace.id) : false}
        onToggleFavorite={handleToggleFavorite}
        onLocateOnMap={handleLocateOnMap}
        onSelectRelatedPlace={handleSelectPlaceById}
        allPlaces={places}
        isAdmin={isAdmin}
        onEditPlace={handleEditPlace}
        currentUser={currentUser}
        onRequireAuth={requireAuthForAction}
      />

      {/* Edit Place Modal (Admin Only) */}
      <EditPlaceModal
        place={editTargetPlace}
        isOpen={isEditPlaceOpen}
        onClose={() => {
          setIsEditPlaceOpen(false);
          setEditTargetPlace(null);
        }}
        onSaved={loadAllData}
        categories={categories}
        regions={regions}
      />

      {/* Auth Modal (Login / Register) */}
      <AuthModal
        isOpen={isAuthOpen}
        initialTab={authInitialTab}
        promptMessage={authPromptMessage}
        onClose={() => {
          setIsAuthOpen(false);
          setAuthPromptMessage(null);
          pendingAuthActionRef.current = null;
        }}
        onSuccess={handleAuthSuccess}
      />

      {/* Isolated Personal Profile Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
        favoritesCount={favorites.length}
        customRoutesCount={customRoutes.length}
        recentTrailCount={recentTrail.length}
        guideMessagesCount={guideMessages.length}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
        onGoToRoutes={() => setCurrentTab('routes')}
        onLogout={handleLogout}
      />

      {/* Favorites Modal */}
      <FavoritesModal
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        favoriteIds={favorites}
        allPlaces={places}
        onToggleFavorite={handleToggleFavorite}
        onSelectPlace={(place) => setSelectedPlace(place)}
        onLocateOnMap={handleLocateOnMap}
        currentUser={currentUser}
        onOpenAuth={(tab) => {
          setAuthInitialTab(tab || 'login');
          setIsAuthOpen(true);
        }}
      />

      {/* Admin Panel Modal */}
      {isAdminOpen && (
        <AdminPanel
          onClose={() => setIsAdminOpen(false)}
          onRefreshPlaces={loadAllData}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthOpen(true)}
          onAuthSuccess={handleAuthSuccess}
          places={places}
          onEditPlace={handleEditPlace}
          onAddNewPlace={handleAddNewPlace}
          onOpenSsms={() => setCurrentTab('ssms')}
        />
      )}

      {/* Confirm Delete Place Modal */}
      {confirmDeletePlaceTarget && (
        <div
          className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Потвърждение за изтриване на обект"
        >
          <div className="bg-white w-full max-w-md rounded-2xl border border-stone-200 shadow-2xl p-6 space-y-4">
            <h4 className="font-editorial text-lg font-bold text-stone-950">
              Изтриване на обект от каталога
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              Сигурни ли сте, че искате да изтриете <strong className="text-stone-900">„{confirmDeletePlaceTarget.name}“</strong> от каталога?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePlaceTarget(null)}
                className="px-4 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer"
              >
                Отказ
              </button>
              <button
                type="button"
                onClick={confirmDeletePlaceAction}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold cursor-pointer"
              >
                Потвърди изтриването
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Curatorial Footer */}
      <Footer
        onNavClick={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAdmin={() => setIsAdminOpen(true)}
        placesCount={places.length}
        isAdmin={isAdmin}
      />
    </div>
  );
}
