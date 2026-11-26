import React, { useState, useMemo, useEffect } from 'react';
import { Place, Category, Region, User } from '../types';
import { PlaceCard } from './PlaceCard';
import {
  Search,
  RotateCcw,
  SlidersHorizontal,
  PlusCircle,
  LayoutGrid,
  ListFilter,
  MapPin,
  ArrowUpRight,
  Bookmark,
  Camera,
  Database,
  Mountain,
  ChevronDown,
  ArrowUpDown,
  Check,
  Sun,
  Snowflake,
  Leaf,
  Calendar,
  Sparkles,
  Compass,
} from 'lucide-react';
import { LiquidGlassDropdown } from './LiquidGlassDropdown';
import { handleImageError } from '../utils/imageFallback';


interface CatalogViewProps {
  places: Place[];
  categories: Category[];
  regions: Region[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onSelectPlace: (place: Place) => void;
  onLocateOnMap: (place: Place) => void;
  currentUser?: User | null;
  onAddNewPlace?: () => void;
  onEditPlace?: (place: Place) => void;
  onDeletePlace?: (place: Place) => void;
  initialSearch?: string;
  initialCategory?: string;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  places,
  categories,
  regions,
  favorites,
  onToggleFavorite,
  onSelectPlace,
  onLocateOnMap,
  currentUser,
  onAddNewPlace,
  onEditPlace,
  onDeletePlace,
  initialSearch = '',
  initialCategory = 'all',
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedSeason, setSelectedSeason] = useState<'all' | 'spring' | 'summer' | 'autumn' | 'winter'>('all');
  const [sortBy, setSortBy] = useState<
    'rating' | 'elevation_desc' | 'name_asc' | 'name_desc' | 'reviews'
  >('rating');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [visibleCount, setVisibleCount] = useState(15);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setSelectedCategory(initialCategory || 'all');
  }, [initialCategory]);

  useEffect(() => {
    setVisibleCount(15);
  }, [search, selectedCategory, selectedRegion, selectedDifficulty, selectedSeason]);

  const isAdmin = currentUser?.role === 'admin';

  // Determine current season in Bulgaria:
  // Spring: Mar-May (2, 3, 4), Summer: Jun-Aug (5, 6, 7), Autumn: Sep-Nov (8, 9, 10), Winter: Dec-Feb (11, 0, 1)
  const currentMonth = new Date().getMonth();
  const currentSeasonId =
    currentMonth >= 2 && currentMonth <= 4
      ? 'spring'
      : currentMonth >= 5 && currentMonth <= 7
      ? 'summer'
      : currentMonth >= 8 && currentMonth <= 10
      ? 'autumn'
      : 'winter';

  const regionOptions = useMemo(() => [
    { id: 'all', label: 'Всички региони', count: places.length },
    ...regions.map((reg) => ({
      id: reg.id,
      label: reg.name.split('(')[0].trim(),
      count: places.filter((p) => p.regionId === reg.id).length,
    })),
  ], [regions, places]);

  const difficultyOptions = useMemo(() => [
    { id: 'all', label: 'Всяка трудност' },
    { id: 'Лесен', label: 'Лесен достъп', subtitle: 'Равен терен, подходящ за семейни разходки' },
    { id: 'Умерен', label: 'Умерен преход', subtitle: 'Планински пътеки със средно изкачване' },
    { id: 'Труден', label: 'Труден терен', subtitle: 'Стръмни скали, пропасти или дълги преходи' },
  ], []);

  const sortOptions = useMemo(() => [
    { id: 'rating', label: 'По рейтинг & популярност' },
    { id: 'elevation_desc', label: 'По надморска височина' },
    { id: 'name_asc', label: 'По име (А — Я)' },
    { id: 'name_desc', label: 'По име (Я — А)' },
    { id: 'reviews', label: 'По брой отзиви' },
  ], []);

  const filteredPlaces = useMemo(() => {
    return places
      .filter((p) => {
        if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
        if (selectedRegion !== 'all' && p.regionId !== selectedRegion) return false;
        if (selectedDifficulty !== 'all' && p.difficulty !== selectedDifficulty) return false;
        if (selectedSeason !== 'all') {
          const sText = (p.bestSeason || '').toLowerCase();
          const isYearRound = sText.includes('целогодишно') || sText.includes('всеки сезон');
          if (!isYearRound) {
            if (selectedSeason === 'spring') {
              const match = sText.includes('пролет') || sText.includes('март') || sText.includes('април') || sText.includes('май');
              if (!match) return false;
            } else if (selectedSeason === 'summer') {
              const match = sText.includes('лято') || sText.includes('юни') || sText.includes('юли') || sText.includes('август');
              if (!match) return false;
            } else if (selectedSeason === 'autumn') {
              const match = sText.includes('есен') || sText.includes('септември') || sText.includes('октомври') || sText.includes('ноември');
              if (!match) return false;
            } else if (selectedSeason === 'winter') {
              const match = sText.includes('зима') || sText.includes('декември') || sText.includes('януари') || sText.includes('февруари');
              if (!match) return false;
            }
          }
        }
        if (search.trim() !== '') {
          const q = search.toLowerCase().trim();
          const matchName = p.name.toLowerCase().includes(q);
          const matchRegion = p.regionName.toLowerCase().includes(q);
          const matchCategory = p.categoryName.toLowerCase().includes(q);
          const matchDesc = p.shortDescription.toLowerCase().includes(q);
          if (!matchName && !matchRegion && !matchCategory && !matchDesc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name, 'bg');
        if (sortBy === 'name_desc') return b.name.localeCompare(a.name, 'bg');
        if (sortBy === 'elevation_desc')
          return (b.elevationMeters || b.altitude || 0) - (a.elevationMeters || a.altitude || 0);
        if (sortBy === 'rating') return (b.rating || 5) - (a.rating || 5);
        if (sortBy === 'reviews') return (b.reviewCount || 0) - (a.reviewCount || 0);
        return 0;
      });
  }, [places, selectedCategory, selectedRegion, selectedDifficulty, selectedSeason, search, sortBy]);

  const displayedPlaces = filteredPlaces.slice(0, visibleCount);
  const hasActiveFilters =
    search.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedRegion !== 'all' ||
    selectedDifficulty !== 'all' ||
    selectedSeason !== 'all';

  const handleReset = () => {
    setSearch('');
    setSelectedCategory('all');
    setSelectedRegion('all');
    setSelectedDifficulty('all');
    setSelectedSeason('all');
    setSortBy('rating');
  };


  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Editorial Header */}
      <div className="border-b border-stone-200 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
            <span>Пълен картографски регистър</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span>{places.length} Верифицирани обекта</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="text-emerald-800 flex items-center gap-1 font-bold">
              <Camera className="w-3.5 h-3.5" />
              <span>Реални снимки</span>
            </span>
          </div>
          <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-stone-950">
            Каталог на скритите съкровища
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed">
            Изследвайте всички документирани светилища, крепости, водопади и пещери с проверени координати, височини и съвети за достъп.
          </p>
        </div>

        {/* Header Actions: Add New Place & View Mode Toggle */}
        <div className="flex items-center gap-3 shrink-0">
          {isAdmin && onAddNewPlace && (
            <button
              onClick={onAddNewPlace}
              className="btn-liquid-dark water-shimmer px-4 py-2 text-xs font-bold text-amber-200 rounded-full flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-amber-300" />
              <span>Добави обект</span>
            </button>
          )}

          {/* Grid vs Table View Mode Switcher */}
          <div className="flex items-center p-1 btn-liquid-water rounded-full">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-full transition-all duration-300 ${
                viewMode === 'grid'
                  ? 'bg-stone-900 text-amber-200 shadow-xs'
                  : 'text-stone-600 hover:text-stone-950'
              }`}
              title="Решетъчен изглед (Карти)"
              aria-label="Решетъчен изглед"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-full transition-all duration-300 ${
                viewMode === 'table'
                  ? 'bg-stone-900 text-amber-200 shadow-xs'
                  : 'text-stone-600 hover:text-stone-950'
              }`}
              title="Табличен изглед (Експедиционен списък)"
              aria-label="Табличен изглед"
            >
              <ListFilter className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Control Filter Bar - Liquid Water Card */}
      <div className="liquid-water-card p-4 sm:p-6 rounded-3xl space-y-4 relative z-30 overflow-visible">

        {/* Search & Selectors Row with Apple Liquid Glass Focus Pills & Orbs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search Box - Liquid Glass Focus Capsule (4 cols) */}
          <div className="lg:col-span-4 relative">
            <div className="liquid-glass-focus-pill liquid-iridescent-rim rounded-full p-1.5 sm:p-2 pr-3 flex items-center gap-2.5 transition-all focus-within:ring-2 focus-within:ring-amber-700/40">
              {/* Inner Frosted Glass Orb with Search Icon */}
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-white/95 via-stone-100/70 to-stone-200/50 border border-white/90 shadow-inner">
                <Search className="w-4 h-4 text-stone-700" />
              </div>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Търси име, регион, пещера, връх..."
                className="w-full bg-transparent text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 font-semibold focus:outline-none"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="w-6 h-6 rounded-full flex items-center justify-center bg-stone-900/10 hover:bg-stone-900/20 text-stone-600 hover:text-stone-900 text-xs transition-colors shrink-0 cursor-pointer"
                  title="Изчисти търсенето"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Region Dropdown - Apple Liquid Glass Capsule (3 cols) */}
          <div className="lg:col-span-3">
            <LiquidGlassDropdown
              label="Регион"
              value={selectedRegion}
              options={regionOptions}
              onChange={setSelectedRegion}
              icon={MapPin}
              orbVariant="emerald"
            />
          </div>

          {/* Difficulty Dropdown - Apple Liquid Glass Capsule (2 cols) */}
          <div className="lg:col-span-2">
            <LiquidGlassDropdown
              label="Трудност"
              value={selectedDifficulty}
              options={difficultyOptions}
              onChange={setSelectedDifficulty}
              icon={Mountain}
              orbVariant="amber"
            />
          </div>

          {/* Sort By Dropdown - Apple Liquid Glass Capsule (3 cols) */}
          <div className="lg:col-span-3">
            <LiquidGlassDropdown
              label="Подреди"
              value={sortBy}
              options={sortOptions}
              onChange={(val) => setSortBy(val as any)}
              icon={ArrowUpDown}
              orbVariant="blue"
              align="right"
            />
          </div>
        </div>

        {/* Category Filter Pills Row - Apple Liquid Glass Pills with Mobile Touch Swipe */}
        <div className="flex items-center gap-2 pt-3 border-t border-stone-300/40 overflow-x-auto pb-1.5 sm:pb-0 flex-nowrap sm:flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer flex items-center gap-2 shrink-0 ${
              selectedCategory === 'all'
                ? 'btn-liquid-amber water-shimmer liquid-iridescent-rim text-stone-950 shadow-md scale-105'
                : 'liquid-glass-focus-pill text-stone-700 hover:text-stone-950'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${selectedCategory === 'all' ? 'bg-amber-950 animate-pulse' : 'bg-stone-400'}`} />
            <span className="whitespace-nowrap">Всички категории ({places.length})</span>
          </button>

          {categories.map((cat) => {
            const count = places.filter((p) => p.categoryId === cat.id).length;
            const isSel = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer flex items-center gap-2 shrink-0 ${
                  isSel
                    ? 'btn-liquid-amber water-shimmer liquid-iridescent-rim text-stone-950 shadow-md scale-105'
                    : 'liquid-glass-focus-pill text-stone-700 hover:text-stone-950'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isSel ? 'bg-amber-950 animate-pulse' : 'bg-emerald-600/60'}`} />
                <span className="whitespace-nowrap">{cat.name}</span>
                <span className={`text-[10px] font-mono ${isSel ? 'text-amber-950/80 font-bold' : 'text-stone-400'}`}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Season Filter Row - Apple Liquid Glass Focus Pills (Matching User Reference) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-300/40">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 flex-nowrap sm:flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mr-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-800" />
              <span>Сезон за посещение:</span>
            </span>

            {[
              { id: 'all', label: 'Всички', icon: Calendar },
              { id: 'spring', label: 'Пролет', icon: Leaf, highlight: 'Буйни водопади & свежест' },
              { id: 'summer', label: 'Лято', icon: Sun, highlight: 'Върхове & прохладни пещери' },
              { id: 'autumn', label: 'Есен', icon: Leaf, highlight: 'Златни гори & светилища' },
              { id: 'winter', label: 'Зима', icon: Snowflake, highlight: 'Кристални зимни панорами' },
            ].map((season) => {
              const Icon = season.icon;
              const isSel = selectedSeason === season.id;
              const isCurrent = (season.id as string) === currentSeasonId;

              return (
                <button
                  key={season.id}
                  onClick={() => setSelectedSeason(season.id as any)}
                  className={`pl-2 pr-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-2 cursor-pointer relative ${
                    isSel
                      ? 'btn-liquid-amber water-shimmer liquid-iridescent-rim text-stone-950 shadow-md scale-105'
                      : 'liquid-glass-focus-pill text-stone-700 hover:text-stone-950'
                  }`}
                  title={season.highlight}
                >
                  {/* Inner Frosted Glass Orb holding the seasonal icon */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                      isSel
                        ? 'bg-amber-950/15 border-amber-900/30 text-amber-950'
                        : 'bg-white/80 border-white/90 text-stone-700 shadow-inner'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span>{season.label}</span>
                  {isCurrent && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider shadow-xs">
                      Сега
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Active Season Action & Clear Filters */}
          <div className="flex items-center gap-2 ml-auto">
            {selectedSeason !== currentSeasonId && (
              <button
                onClick={() => setSelectedSeason(currentSeasonId as any)}
                className="btn-liquid-water water-shimmer px-3.5 py-1.5 text-xs font-semibold text-emerald-800 rounded-full flex items-center gap-1.5 shadow-2xs hover:border-emerald-500 cursor-pointer"
                title="Филтрирай за дестинации, подходящи за актуалния сезон"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                <span>Актуално време ({currentSeasonId === 'spring' ? 'Пролет' : currentSeasonId === 'summer' ? 'Лято' : currentSeasonId === 'autumn' ? 'Есен' : 'Зима'})</span>
              </button>
            )}

            {hasActiveFilters && (
              <button
                onClick={handleReset}
                className="btn-liquid-water water-shimmer inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-amber-950 rounded-full cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-800" />
                <span>Изчисти филтрите</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Results Header: Count & Status */}
      <div className="flex items-center justify-between text-xs text-stone-600">
        <span>
          Намерени <strong>{filteredPlaces.length}</strong> обекта
          {hasActiveFilters && ' (с активни филтри)'}
        </span>
        <span className="font-mono text-[11px] text-stone-500">
          Показване на {displayedPlaces.length} от {filteredPlaces.length}
        </span>
      </div>

      {/* MAIN VIEW: GRID vs TABLE */}
      {filteredPlaces.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-stone-200 space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-editorial text-2xl font-bold text-stone-900">
              Няма намерени обекти
            </h3>
            <p className="text-xs text-stone-600 max-w-md mx-auto">
              Опитайте да промените ключовата дума за търсене или да премахнете някой от филтрите по регион или категория.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition-colors"
          >
            Възстанови всички филтри
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {displayedPlaces.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              isFavorite={favorites.includes(place.id)}
              onToggleFavorite={onToggleFavorite}
              onSelect={onSelectPlace}
              onLocateOnMap={onLocateOnMap}
              isAdmin={isAdmin}
              onEdit={onEditPlace}
              onDelete={onDeletePlace}
            />
          ))}
        </div>
      ) : (
        /* TABLE / EXPEDITION LOG VIEW */
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F5F2EA] text-stone-800 border-b border-stone-200 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Обект & Снимка</th>
                  <th className="py-3.5 px-4">Категория</th>
                  <th className="py-3.5 px-4">Регион</th>
                  <th className="py-3.5 px-4">Височина</th>
                  <th className="py-3.5 px-4">Трудност</th>
                  <th className="py-3.5 px-4">GPS Координати</th>
                  <th className="py-3.5 px-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {displayedPlaces.map((place) => {
                  const isFav = favorites.includes(place.id);
                  return (
                    <tr
                      key={place.id}
                      onClick={() => onSelectPlace(place)}
                      className="hover:bg-amber-50/40 cursor-pointer transition-colors group"
                    >
                      {/* Name & Photo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-stone-900 overflow-hidden shrink-0 border border-stone-200 relative">
                            <img
                              src={place.imageUrl}
                              alt={place.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                              onError={(e) => handleImageError(e, place.categoryId)}
                            />
                          </div>
                          <div>
                            <div className="font-editorial text-sm font-bold text-stone-950 group-hover:text-amber-900 transition-colors">
                              {place.name}
                            </div>
                            <div className="text-[11px] text-stone-500 flex items-center gap-1">
                              <span>📷 Реална снимка</span>
                              {place.isFeatured && (
                                <span className="text-amber-800 font-bold">· Топ</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-stone-700 font-medium">
                        {place.categoryName}
                      </td>

                      {/* Region */}
                      <td className="py-3 px-4 text-stone-600">
                        {place.regionName.split('(')[0]}
                      </td>

                      {/* Altitude */}
                      <td className="py-3 px-4 font-mono text-stone-800">
                        {place.elevationMeters || place.altitude
                          ? `${place.elevationMeters || place.altitude} м`
                          : '—'}
                      </td>

                      {/* Difficulty */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-stone-800">{place.difficulty}</span>
                      </td>

                      {/* GPS */}
                      <td className="py-3 px-4 font-mono text-stone-500 text-[11px]">
                        {place.latitude.toFixed(4)}°N, {place.longitude.toFixed(4)}°E
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div
                          className="flex items-center justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => onToggleFavorite(place.id)}
                            className={`liquid-orb-btn w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shadow-xs ${
                              isFav ? 'liquid-orb-btn-amber text-stone-950' : 'text-stone-600'
                            }`}
                            title="Любими"
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={() => onLocateOnMap(place)}
                            className="liquid-orb-btn w-8 h-8 rounded-full flex items-center justify-center text-amber-800 cursor-pointer shadow-xs"
                            title="Виж на картата"
                          >
                            <MapPin className="w-3.5 h-3.5 text-amber-800" />
                          </button>
                          <button
                            onClick={() => onSelectPlace(place)}
                            className="liquid-orb-btn w-8 h-8 rounded-full flex items-center justify-center text-stone-800 hover:text-stone-950 cursor-pointer shadow-xs"
                            title="Отвори детайли"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination / Load More Button - Apple Liquid Amber Glass Pill */}
      {visibleCount < filteredPlaces.length && (
        <div className="text-center pt-8">
          <button
            onClick={() => setVisibleCount((prev) => prev + 15)}
            className="btn-liquid-amber water-shimmer liquid-iridescent-rim px-8 py-3.5 rounded-full text-xs font-bold text-stone-950 shadow-md inline-flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 transition-all"
          >
            <span>Зареди още обекти ({filteredPlaces.length - visibleCount} оставащи)</span>
            <ChevronDown className="w-4 h-4 text-stone-950" />
          </button>
        </div>
      )}
    </div>
  );
};
