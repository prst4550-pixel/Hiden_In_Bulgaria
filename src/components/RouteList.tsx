import React, { useState, useMemo } from 'react';
import { Route, Place, DifficultyLevel, RouteStop, User } from '../types';
import {
  Compass,
  Clock,
  MapPin,
  ChevronRight,
  Plus,
  Search,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit3,
  Check,
  X,
  Route as RouteIcon,
  Save,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { handleImageError, getFallbackImage } from '../utils/imageFallback';
import { calculateTotalTrailDistance, calculateDistanceKm } from '../utils/geo';

interface RouteListProps {
  routes: Route[];
  customRoutes: Route[];
  places: Place[];
  onSelectPlaceById: (placeId: string) => void;
  onExploreRouteOnMap: (route: Route) => void;
  onSaveCustomRoute: (route: Route) => void;
  onDeleteCustomRoute: (routeId: string) => void;
  currentUser?: User | null;
  onOpenAuth?: (tab?: 'login' | 'register') => void;
}

interface DraftStop {
  place: Place;
  notes: string;
}

const DIFFICULTIES: DifficultyLevel[] = ['Лесен', 'Умерен', 'Труден', 'Екстремен'];

function estimateRouteDuration(distanceKm: number, stopCount: number): { label: string; hours: number } {
  const driveHours = distanceKm / 55;
  const exploreHours = stopCount * 1.1;
  const totalHours = Math.max(1, Math.round(driveHours + exploreHours));
  if (totalHours <= 8) {
    return { label: `${totalHours} часа`, hours: totalHours };
  }
  const days = Math.ceil(totalHours / 8);
  return { label: `${days} ${days === 1 ? 'ден' : 'дни'} (${totalHours} ч)`, hours: totalHours };
}

export const RouteList: React.FC<RouteListProps> = ({
  routes,
  customRoutes,
  places,
  onSelectPlaceById,
  onExploreRouteOnMap,
  onSaveCustomRoute,
  onDeleteCustomRoute,
  currentUser,
  onOpenAuth,
}) => {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Умерен');
  const [draftStops, setDraftStops] = useState<DraftStop[]>([]);
  const [placeSearch, setPlaceSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredPlaces = useMemo(() => {
    const q = placeSearch.toLowerCase().trim();
    if (!q) return places;
    return places.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.regionName.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
    );
  }, [places, placeSearch]);

  const draftDistanceKm = useMemo(
    () => calculateTotalTrailDistance(draftStops.map((s) => s.place)),
    [draftStops]
  );

  const draftDuration = useMemo(
    () => estimateRouteDuration(draftDistanceKm, draftStops.length),
    [draftDistanceKm, draftStops.length]
  );

  const resetBuilder = () => {
    setEditingRouteId(null);
    setTitle('');
    setDescription('');
    setDifficulty('Умерен');
    setDraftStops([]);
    setPlaceSearch('');
    setFormError(null);
  };

  const handleOpenNewBuilder = () => {
    if (isBuilderOpen && !editingRouteId) {
      setIsBuilderOpen(false);
      return;
    }
    resetBuilder();
    setIsBuilderOpen(true);
  };

  const handleEditCustomRoute = (route: Route) => {
    const matchedStops: DraftStop[] = route.stops
      .map((stop) => {
        const place = places.find((p) => p.id === stop.placeId || p.slug === stop.placeId);
        if (!place) return null;
        return { place, notes: stop.notes || '' };
      })
      .filter(Boolean) as DraftStop[];

    setEditingRouteId(route.id);
    setTitle(route.title);
    setDescription(route.description);
    setDifficulty(route.difficulty);
    setDraftStops(matchedStops);
    setFormError(null);
    setIsBuilderOpen(true);
    window.scrollTo({ top: 100, behavior: 'smooth' });
  };

  const handleTogglePlaceInDraft = (place: Place) => {
    setFormError(null);
    setDraftStops((prev) => {
      const exists = prev.some((s) => s.place.id === place.id);
      if (exists) {
        return prev.filter((s) => s.place.id !== place.id);
      }
      return [...prev, { place, notes: place.shortDescription.slice(0, 110) }];
    });
  };

  const handleMoveStop = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draftStops.length) return;
    setDraftStops((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handleUpdateStopNote = (index: number, note: string) => {
    setDraftStops((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, notes: note } : item))
    );
  };

  const handleSave = (openOnMapAfter: boolean) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('Въведете име на маршрута.');
      return;
    }
    if (draftStops.length < 2) {
      setFormError('Изберете поне 2 спирки, за да създадете маршрут.');
      return;
    }

    const stops: RouteStop[] = draftStops.map((s, idx) => ({
      placeId: s.place.id,
      placeName: s.place.name,
      order: idx + 1,
      notes: s.notes.trim() || s.place.shortDescription,
      coordinates: [s.place.latitude, s.place.longitude],
    }));

    const uniqueRegions = Array.from(
      new Set(draftStops.map((s) => s.place.regionName.split('(')[0].trim()))
    );
    const regionSummary =
      uniqueRegions.length === 1
        ? uniqueRegions[0]
        : uniqueRegions.length === 2
          ? `${uniqueRegions[0]} · ${uniqueRegions[1]}`
          : `${uniqueRegions[0]} (+${uniqueRegions.length - 1})`;

    const firstPlace = draftStops[0].place;
    const distanceLabel = `${draftDistanceKm} км`;

    const builtRoute: Route = {
      id: editingRouteId || `custom-route-${Date.now()}`,
      title: trimmedTitle,
      description:
        description.trim() ||
        `Личен маршрут през ${stops.length} подбрани локации в България (${stops.map((s) => s.placeName).join(' → ')}).`,
      duration: draftDuration.label,
      durationHours: draftDuration.hours,
      totalDistance: distanceLabel,
      distanceKm: draftDistanceKm,
      difficulty,
      regionName: regionSummary,
      imageUrl: firstPlace.imageUrl || getFallbackImage(firstPlace.categoryId, firstPlace.name),
      stops,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    onSaveCustomRoute(builtRoute);
    setIsBuilderOpen(false);
    resetBuilder();

    if (openOnMapAfter) {
      onExploreRouteOnMap(builtRoute);
    }
  };

  const renderRouteCard = (route: Route) => (
    <article
      key={route.id}
      className="liquid-water-card rounded-3xl overflow-hidden shadow-2xs hover:shadow-2xl transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between group"
    >
      <div>
        {/* Route Banner Image */}
        <div className="relative h-64 w-full bg-stone-950 overflow-hidden">
          <img
            src={route.imageUrl}
            alt={route.title}
            className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-700 ease-out"
            referrerPolicy="no-referrer"
            onError={(e) => handleImageError(e)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-stone-950/20" />

          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 text-xs z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="liquid-glass-focus-pill-dark liquid-iridescent-rim text-amber-300 font-bold px-3 py-1 rounded-full text-xs shadow-md">
                {route.regionName}
              </span>
              {route.isCustom && (
                <span className="bg-emerald-950/90 text-emerald-200 border border-emerald-400/40 font-bold px-2.5 py-1 rounded-full text-[11px] shadow-md">
                  Личен маршрут
                </span>
              )}
            </div>
            <span className="liquid-glass-focus-pill-dark text-stone-200 font-semibold px-3 py-1 rounded-full text-xs shadow-md shrink-0">
              {route.difficulty}
            </span>
          </div>

          <div className="absolute bottom-4 left-4 right-4 text-white z-10 space-y-1">
            <div className="text-xs font-mono text-amber-300">
              {route.stops.length} {route.isCustom ? 'избрани' : 'проверени'} спирки · {route.totalDistance}
            </div>
            <h3 className="font-editorial text-2xl sm:text-3xl font-bold text-white leading-snug drop-shadow-sm">
              {route.title}
            </h3>
          </div>
        </div>

        {/* Route Overview Meta */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 text-xs text-stone-600 border-b border-stone-100 pb-3 font-medium flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-800" />
                <span className="font-semibold text-stone-900">{route.duration}</span>
              </div>
              <span aria-hidden="true" className="text-stone-300">·</span>
              <div className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-amber-800" />
                <span>Разстояние: {route.totalDistance}</span>
              </div>
            </div>

            {route.isCustom && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleEditCustomRoute(route)}
                  className="px-2.5 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold flex items-center gap-1 border border-stone-200 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Редактирай</span>
                </button>

                {confirmDeleteId === route.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteCustomRoute(route.id);
                        setConfirmDeleteId(null);
                      }}
                      className="px-2.5 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Потвърди
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-semibold cursor-pointer"
                    >
                      Отказ
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(route.id)}
                    className="px-2.5 py-1 rounded-full bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold flex items-center gap-1 border border-red-200 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Изтрий</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            {route.description}
          </p>

          {/* Stops Timeline */}
          <div className="space-y-3 pt-2">
            <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              Последователност на спирките:
            </div>
            <div className="space-y-2">
              {route.stops.map((stop, idx) => {
                const matchedPlace = places.find((p) => p.id === stop.placeId || p.slug === stop.placeId);
                return (
                  <div
                    key={`${stop.placeId}-${idx}`}
                    onClick={() => onSelectPlaceById(stop.placeId)}
                    className="flex items-start gap-3 p-2.5 rounded-xl bg-[#FBF9F5] hover:bg-[#F4EFE6] transition-colors cursor-pointer border border-stone-200/90 group/stop"
                  >
                    {matchedPlace ? (
                      <div className="relative shrink-0">
                        <img
                          src={matchedPlace.imageUrl}
                          alt={stop.placeName}
                          className="w-10 h-10 rounded-lg object-cover bg-stone-900"
                          referrerPolicy="no-referrer"
                          onError={(e) => handleImageError(e, matchedPlace.categoryId, matchedPlace.name)}
                        />
                        <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center border border-white shadow-xs">
                          {idx + 1}
                        </span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-stone-900 text-amber-200 text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-stone-900 group-hover/stop:text-amber-900 flex items-center justify-between">
                        <span className="truncate">{stop.placeName}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover/stop:text-amber-800 shrink-0" />
                      </div>
                      <div className="text-[11px] text-stone-600 mt-0.5 leading-relaxed">
                        {stop.notes}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Card Action */}
      <div className="p-6 pt-0 mt-2">
        <button
          type="button"
          onClick={() => onExploreRouteOnMap(route)}
          className="btn-liquid-dark water-shimmer w-full py-3.5 rounded-full text-amber-200 hover:text-amber-100 text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer"
        >
          <MapPin className="w-4 h-4 text-amber-400" />
          <span>Проследи целия маршрут на картата</span>
          <ChevronRight className="w-3.5 h-3.5 text-amber-300 ml-1" />
        </button>
      </div>
    </article>
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Editorial Header */}
      <div className="border-b border-stone-200 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
            <Compass className="w-4 h-4 text-amber-800" />
            <span>Тематични експедиции & Пътешествия</span>
          </div>
          <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-stone-950">
            Маршрути в България
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed">
            Създавайте свои лични маршрути или изберете от подбраните експедиции с последователни спирки, разстояния и директно проследяване на картата.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNewBuilder}
          className="btn-liquid-emerald water-shimmer px-5 py-3 rounded-full text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0 self-start md:self-auto"
        >
          {isBuilderOpen && !editingRouteId ? (
            <>
              <X className="w-4 h-4" />
              <span>Затвори конструктора</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Създай свой маршрут</span>
            </>
          )}
        </button>
      </div>

      {/* Inline Liquid Glass Route Builder */}
      {isBuilderOpen && (
        <section className="liquid-water-card rounded-3xl p-5 sm:p-7 border border-emerald-500/30 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-900 text-emerald-200 flex items-center justify-center shadow-sm shrink-0">
                <RouteIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-editorial text-xl sm:text-2xl font-bold text-stone-950">
                  {editingRouteId ? 'Редактирай личен маршрут' : 'Конструктор на маршрут'}
                </h3>
                <p className="text-xs text-stone-600">
                  Изберете обекти от каталога, подредете спирките и ги вижте свързани на картата.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsBuilderOpen(false);
                resetBuilder();
              }}
              className="liquid-orb-btn w-9 h-9 rounded-full flex items-center justify-center text-stone-600 hover:text-stone-950 self-end sm:self-auto cursor-pointer"
              aria-label="Затвори конструктора"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs font-semibold rounded-xl flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Metadata + Place Picker */}
            <div className="lg:col-span-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                    Име на маршрута
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Напр. Уикенд из Родопите"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/90 border border-stone-300 text-xs sm:text-sm text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                    Трудност
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/90 border border-stone-300 text-xs sm:text-sm text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                  >
                    {DIFFICULTIES.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                  Описание (по желание)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Кратко описание на пътуването, препоръчителен транспорт или подходящ сезон..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white/90 border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 resize-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                    Избери спирки от каталога ({places.length})
                  </label>
                  <span className="text-[11px] text-stone-500">Кликни за добавяне/премахване</span>
                </div>

                <div className="liquid-glass-focus-pill rounded-full px-3 py-1.5 flex items-center gap-2 border border-stone-300/80">
                  <Search className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <input
                    type="text"
                    value={placeSearch}
                    onChange={(e) => setPlaceSearch(e.target.value)}
                    placeholder="Търси място, регион или категория..."
                    className="w-full bg-transparent text-xs text-stone-900 font-medium focus:outline-none"
                  />
                  {placeSearch && (
                    <button
                      type="button"
                      onClick={() => setPlaceSearch('')}
                      className="text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto pr-1 space-y-1.5 rounded-2xl bg-white/70 border border-stone-200/90 p-2">
                  {filteredPlaces.map((place) => {
                    const selectedIdx = draftStops.findIndex((s) => s.place.id === place.id);
                    const isAdded = selectedIdx !== -1;
                    return (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => handleTogglePlaceInDraft(place)}
                        className={`w-full text-left p-2 rounded-xl flex items-center justify-between gap-2.5 transition-all cursor-pointer border ${
                          isAdded
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-2xs'
                            : 'bg-white/80 hover:bg-[#F4EFE6] border-stone-200/70 text-stone-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={place.imageUrl}
                            alt={place.name}
                            className="w-9 h-9 rounded-lg object-cover shrink-0 bg-stone-900"
                            referrerPolicy="no-referrer"
                            onError={(e) => handleImageError(e, place.categoryId, place.name)}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{place.name}</div>
                            <div className="text-[10px] text-stone-500 truncate">
                              {place.categoryName} · {place.regionName.split('(')[0].trim()}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 flex items-center gap-1 ${
                            isAdded
                              ? 'bg-emerald-700 text-white'
                              : 'bg-stone-100 text-stone-700 border border-stone-200'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Спирка #{selectedIdx + 1}</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>Добави</span>
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })}
                  {filteredPlaces.length === 0 && (
                    <div className="p-4 text-center text-xs text-stone-500">
                      Няма намерени места за „{placeSearch}“.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Selected Ordered Stops + Live Metrics + Save */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-4 bg-[#FBF9F5]/80 rounded-2xl p-4 border border-stone-200/90">
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Спирки в маршрута ({draftStops.length})
                  </span>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200">
                      {draftDistanceKm} км общо
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                      ~{draftDuration.label}
                    </span>
                  </div>
                </div>

                {draftStops.length === 0 ? (
                  <div className="py-12 px-4 text-center border-2 border-dashed border-stone-300/80 rounded-2xl space-y-2">
                    <MapPin className="w-7 h-7 text-stone-400 mx-auto" />
                    <div className="text-xs font-bold text-stone-700">
                      Все още няма избрани спирки
                    </div>
                    <p className="text-[11px] text-stone-500 max-w-xs mx-auto">
                      Изберете поне 2 места от списъка вляво, за да сглобите маршрут и да изчислим разстоянието.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {draftStops.map((item, idx) => {
                      const nextItem = draftStops[idx + 1];
                      const legKm = nextItem
                        ? calculateDistanceKm(
                            item.place.latitude,
                            item.place.longitude,
                            nextItem.place.latitude,
                            nextItem.place.longitude
                          )
                        : null;

                      return (
                        <div key={item.place.id} className="space-y-1.5">
                          <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-2xs space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-bold text-stone-950 truncate">
                                  {item.place.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveStop(idx, -1)}
                                  className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 disabled:opacity-30 text-stone-700 cursor-pointer"
                                  title="Премести нагоре"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === draftStops.length - 1}
                                  onClick={() => handleMoveStop(idx, 1)}
                                  className="p-1 rounded-lg bg-stone-100 hover:bg-stone-200 disabled:opacity-30 text-stone-700 cursor-pointer"
                                  title="Премести надолу"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTogglePlaceInDraft(item.place)}
                                  className="p-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
                                  title="Премахни спирка"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <input
                              type="text"
                              value={item.notes}
                              onChange={(e) => handleUpdateStopNote(idx, e.target.value)}
                              placeholder="Бележка за тази спирка..."
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[#FBF9F5] border border-stone-200 text-[11px] text-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                            />
                          </div>

                          {legKm !== null && (
                            <div className="text-[10px] font-mono text-emerald-800 font-bold pl-3 flex items-center gap-1.5">
                              <span>↓</span>
                              <span>{legKm} км до следващата спирка</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-stone-200 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  className="liquid-glass-focus-pill px-4 py-2.5 rounded-full text-stone-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Запази маршрута</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="btn-liquid-dark water-shimmer px-5 py-2.5 rounded-full text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Запази и виж на картата</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* User's Custom Routes */}
      {customRoutes.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-stone-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h3 className="font-editorial text-2xl font-bold text-stone-950">
                Моите маршрути ({customRoutes.length})
              </h3>
            </div>
            {currentUser ? (
              <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Запазени единствено в профила на {currentUser.name}</span>
              </span>
            ) : (
              onOpenAuth && (
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="text-xs font-bold text-amber-900 hover:text-amber-950 flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Влезте в профил, за да се пазят само при вас</span>
                </button>
              )
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {customRoutes.map((route) => renderRouteCard(route))}
          </div>
        </section>
      )}

      {/* Curated Routes Grid */}
      <section className="space-y-5">
        {customRoutes.length > 0 && (
          <div className="border-b border-stone-200 pb-3">
            <h3 className="font-editorial text-2xl font-bold text-stone-950">
              Препоръчани маршрути в България ({routes.length})
            </h3>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {routes.map((route) => renderRouteCard(route))}
        </div>
      </section>
    </div>
  );
};

