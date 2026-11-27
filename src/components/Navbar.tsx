import React, { useState, useRef, useEffect } from 'react';
import {
  Compass,
  Bookmark,
  Menu,
  X,
  PlusCircle,
  LogIn,
  LogOut,
  User as UserIcon,
  Shield,
  ChevronDown,
  Sparkles,
  MapPin,
  Camera,
  Layers,
  Mountain,
  Home,
} from 'lucide-react';
import { User } from '../types';
import { createSvgDataUri } from '../utils/imageFallback';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  favoritesCount: number;
  onOpenSuggestModal: () => void;
  onOpenFavorites: () => void;
  currentUser: User | null;
  onOpenAuth: (tab?: 'login' | 'register') => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onOpenProfile: () => void;
  onAddNewPlace: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  favoritesCount,
  onOpenSuggestModal,
  onOpenFavorites,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenAdmin,
  onOpenProfile,
  onAddNewPlace,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Navigation items unified in one master Apple Liquid Glass navigation
  const navItems = [
    { id: 'home', label: 'Начало', icon: Home },
    { id: 'map', label: 'Карта', icon: MapPin },
    { id: 'catalog', label: 'Каталог', icon: Layers },
    { id: 'routes', label: 'Маршрути', icon: Mountain },
    {
      id: 'guide',
      label: 'Пътеводител',
      icon: Sparkles,
      hasDot: true,
      dotColor: 'bg-emerald-400',
    },
    { id: 'community', label: 'Общност', icon: Camera },
  ];

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (id: string) => {
    setCurrentTab(id);
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-50 bg-[#FBF9F5]/50 backdrop-blur-3xl border-b border-white/60 shadow-[0_10px_35px_-10px_rgba(28,25,23,0.06),inset_0_1px_1px_rgba(255,255,255,0.95)] transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]">
      {/* Unified Master Navigation Bar: Logo + Unified Liquid Glass Menu + Action Buttons */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-3 xl:gap-4">
        {/* Brand Identity with User's Uploaded Custom Mountain & Sun Emblem Logo */}
        <button
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-2.5 sm:gap-3 text-left group focus:outline-none shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98]"
          title="Скрито в България"
        >
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden shrink-0 shadow-[0_8px_22px_-4px_rgba(28,25,23,0.28)] border-2 border-amber-500/80 ring-2 ring-emerald-700/60 bg-[#13191d] group-hover:scale-105 group-hover:border-amber-400 transition-all duration-300 flex items-center justify-center">
            <img
              src="/logo-emblem.jpg"
              alt="Скрито в България емблема"
              className="w-full h-full object-cover object-center scale-[1.34] group-hover:scale-[1.38] transition-transform duration-500"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.onerror = null;
                img.src = createSvgDataUri('Скрито в България');
              }}
            />
          </div>
          <div className="flex flex-col min-w-0 max-w-[125px] sm:max-w-[170px] md:max-w-none">
            <span className="font-editorial text-sm sm:text-lg lg:text-xl xl:text-2xl font-bold tracking-tight text-stone-900 truncate leading-tight group-hover:text-amber-900 transition-colors">
              Скрито в България
            </span>
            <span className="text-[7.5px] sm:text-[9px] xl:text-[10px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.18em] text-amber-900 truncate">
              Картографски архив
            </span>
          </div>
        </button>

        {/* Unified Apple Liquid Glass Navigation Pill Bar (VisionOS Focus Capsule style) */}
        <nav
          aria-label="Основна навигация"
          className="hidden lg:flex items-center gap-1 xl:gap-1.5 liquid-glass-dock rounded-full p-1 xl:p-1.5 shadow-lg border border-white/40 backdrop-blur-3xl shrink"
        >
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;

            if (isActive) {
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className="liquid-bubble-active water-shimmer liquid-iridescent-rim text-white rounded-full pl-2 pr-3.5 xl:pr-4 py-1.5 flex items-center gap-1.5 xl:gap-2 font-bold text-xs sm:text-[13px] border border-white/50 shadow-md transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] scale-[1.03] shrink-0 cursor-pointer"
                >
                  {/* Apple VisionOS inner glass orb (like the Moon in Focus pill) */}
                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white/30 backdrop-blur-md border border-white/50 shadow-inner shrink-0">
                    <Icon className="w-3.5 h-3.5 text-amber-300 drop-shadow-xs" />
                  </div>
                  <span className="whitespace-nowrap">{item.label}</span>
                  {item.hasDot && (
                    <span
                      className={`w-2 h-2 rounded-full ${item.dotColor || 'bg-emerald-400'} animate-water-ring`}
                    />
                  )}
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="text-stone-300 hover:text-white hover:bg-white/15 rounded-full px-2.5 xl:px-3 py-1.5 xl:py-2 flex items-center gap-1.5 text-xs font-semibold transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 active:scale-95 group shrink-0 relative cursor-pointer"
                title={item.label}
              >
                <Icon className="w-4 h-4 group-hover:scale-110 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0" />
                <span className="hidden 2xl:inline whitespace-nowrap">{item.label}</span>
                {item.hasDot && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      item.dotColor || 'bg-emerald-400'
                    }`}
                  />
                )}
              </button>
            );

          })}
        </nav>

        {/* Right Action Cluster - Apple Liquid Orb & Focus Pill Buttons (Never clipped) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
          {/* Favorites Button - Glass Sphere Orb (Matching Bell in user reference image) */}
          <button
            onClick={onOpenFavorites}
            className="liquid-orb-btn relative w-10 h-10 rounded-full flex items-center justify-center text-stone-800 hover:text-stone-950 shrink-0 cursor-pointer shadow-xs group"
            title="Запазени любими дестинации"
          >
            <Bookmark className="w-4 h-4 text-amber-800 group-hover:scale-110 transition-transform duration-300" />
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-amber-800 text-white font-mono shadow-xs animate-pulse">
                {favoritesCount}
              </span>
            )}
          </button>

          {/* Suggest Place Button - Liquid Glass Focus Capsule */}
          <button
            onClick={onOpenSuggestModal}
            className="hidden xl:flex items-center gap-2 pl-2 pr-3.5 py-1.5 liquid-glass-focus-pill liquid-iridescent-rim rounded-full text-xs font-bold text-stone-900 whitespace-nowrap shrink-0 cursor-pointer shadow-xs group"
            title="Предложи нова дестинация за архива"
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-amber-500/15 border border-amber-600/30 text-amber-800 group-hover:scale-110 transition-transform">
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-800" />
            </div>
            <span>Предложи</span>
          </button>

          {/* Authentication / User Menu */}
          {currentUser ? (
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 liquid-glass-focus-pill-dark text-white text-xs font-semibold rounded-full shadow-md cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center font-bold text-[11px] shadow-inner border border-white/40">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[100px] truncate">{currentUser.name}</span>
                {isAdmin && (
                  <span className="px-1.5 py-0.2 bg-amber-400 text-stone-950 text-[9px] font-bold rounded-full uppercase">
                    Admin
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-stone-300 group-hover:text-white transition-colors" />
              </button>

              {/* Dropdown Menu */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 liquid-water-card rounded-2xl shadow-2xl py-2 z-50 text-xs overflow-hidden border border-white/60">
                  <div className="px-4 py-2.5 border-b border-stone-200/50 bg-stone-50/50">
                    <div className="font-semibold text-stone-900 truncate">{currentUser.name}</div>
                    <div className="text-[11px] text-stone-500 truncate">{currentUser.email}</div>
                  </div>

                  {isAdmin && (
                    <div className="py-1 border-b border-stone-200/50">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onOpenAdmin();
                        }}
                        className="w-full text-left px-4 py-2 text-stone-700 hover:bg-stone-50 hover:text-stone-950 flex items-center gap-2 transition-colors font-medium"
                      >
                        <Shield className="w-4 h-4 text-amber-800" />
                        <span>Административен панел</span>
                      </button>
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onAddNewPlace();
                        }}
                        className="w-full text-left px-4 py-2 text-stone-700 hover:bg-stone-50 hover:text-stone-950 flex items-center gap-2 transition-colors font-medium"
                      >
                        <PlusCircle className="w-4 h-4 text-emerald-700" />
                        <span>Добави нов обект</span>
                      </button>
                    </div>
                  )}

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onOpenProfile();
                      }}
                      className="w-full text-left px-4 py-2 text-stone-700 hover:bg-stone-50 hover:text-stone-950 flex items-center gap-2 transition-colors font-medium cursor-pointer"
                    >
                      <UserIcon className="w-4 h-4 text-emerald-700" />
                      <span>Моят профил</span>
                    </button>
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onOpenFavorites();
                      }}
                      className="w-full text-left px-4 py-2 text-stone-700 hover:bg-stone-50 hover:text-stone-950 flex items-center gap-2 transition-colors font-medium cursor-pointer"
                    >
                      <Bookmark className="w-4 h-4 text-amber-800" />
                      <span>Любими обекти ({favoritesCount})</span>
                    </button>
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors font-medium cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <span>Изход от профила</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Login Button - Liquid Glass Focus Pill */}
              <button
                onClick={() => onOpenAuth('login')}
                className="liquid-glass-focus-pill px-3.5 py-2.5 sm:py-2 text-xs font-bold text-stone-800 hover:text-stone-950 rounded-full shrink-0 whitespace-nowrap cursor-pointer shadow-xs transition-all"
              >
                Вход
              </button>

              {/* Registration Button - Clean Apple Liquid Amber Glass Pill */}
              <button
                onClick={() => onOpenAuth('register')}
                className="hidden sm:inline-flex btn-liquid-amber water-shimmer liquid-iridescent-rim px-2.5 sm:px-3.5 xl:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold text-stone-950 shrink-0 whitespace-nowrap items-center justify-center shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                <span>Регистрация</span>
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden btn-liquid-water water-shimmer flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full text-stone-800 shrink-0 cursor-pointer shadow-xs"
            aria-label={mobileMenuOpen ? 'Затвори менюто' : 'Отвори менюто'}
          >
            {mobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu - Liquid Water Glass */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#FBF9F5]/90 backdrop-blur-3xl border-b border-white/70 px-4 pt-3 pb-6 space-y-3 shadow-xl">
          <nav className="flex flex-col space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`px-4 py-3 rounded-2xl text-sm font-semibold text-left transition-all flex items-center justify-between cursor-pointer ${
                    isActive
                      ? 'btn-liquid-dark water-shimmer text-amber-200 shadow-md'
                      : 'text-stone-700 hover:bg-white/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-amber-500" />
                    <span>{item.label}</span>
                  </div>
                  {item.hasDot && (
                    <span className={`w-2 h-2 rounded-full ${item.dotColor || 'bg-emerald-400'} animate-water-ring`} />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-stone-200/60 space-y-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenSuggestModal();
              }}
              className="w-full py-2.5 px-4 text-xs font-semibold text-stone-800 btn-liquid-water water-shimmer rounded-full flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-amber-800" />
              <span>Предложи скрит обект за архива</span>
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenFavorites();
              }}
              className="w-full py-2.5 px-4 text-xs font-semibold text-stone-800 btn-liquid-water water-shimmer rounded-full flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Bookmark className="w-4 h-4 text-amber-800" />
              <span>Любими обекти ({favoritesCount})</span>
            </button>

            {!currentUser && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('login');
                  }}
                  className="py-2.5 text-xs font-semibold text-stone-700 btn-liquid-water rounded-full cursor-pointer"
                >
                  Вход
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('register');
                  }}
                  className="btn-liquid-amber water-shimmer py-2.5 text-xs font-bold text-stone-950 rounded-full cursor-pointer shadow-md"
                >
                  Регистрация
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
