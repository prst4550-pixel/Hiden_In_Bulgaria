import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { Place, Category, Region, User, Route as RouteType, DifficultyLevel, RouteStop } from '../types';
import {
  Search,
  RotateCcw,
  MapPin,
  Compass,
  AlertCircle,
  Navigation,
  Shield,
  Mountain,
  Layers,
  Footprints,
  Route,
  Play,
  Maximize2,
  Trash2,
  Loader2,
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  Save,
} from 'lucide-react';
import { LiquidGlassDropdown } from './LiquidGlassDropdown';
import { calculateDistanceKm, calculateTotalTrailDistance } from '../utils/geo';
import { getFallbackImage } from '../utils/imageFallback';
import { GoogleMapView } from './GoogleMapView';

interface InteractiveMapProps {
  places: Place[];
  categories: Category[];
  regions: Region[];
  selectedPlaceId?: string | null;
  onSelectPlace: (place: Place) => void;
  currentUser?: User | null;
  onEditPlace?: (place: Place) => void;
  recentTrail?: Place[];
  onClearTrail?: () => void;
  onSelectTrailStep?: (place: Place) => void;
  routes?: RouteType[];
  activeRoute?: RouteType | null;
  onSelectActiveRoute?: (route: RouteType | null) => void;
  onSaveCustomRoute?: (route: RouteType) => void;
}

function sanitizeImageSrc(rawUrl: string | undefined, fallback: string): string {
  const candidate = String(rawUrl || '').trim();
  if (!candidate) return fallback;
  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    // invalid URL
  }
  return fallback;
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; label: string; shortCode: string }> = {
  sanctuaries: { bg: '#92400E', border: '#FDE68A', label: 'Светилища', shortCode: 'СВ' },
  fortresses: { bg: '#1C1917', border: '#D6D3D1', label: 'Крепости', shortCode: 'КР' },
  waterfalls: { bg: '#0369A1', border: '#BAE6FD', label: 'Водопади и каньони', shortCode: 'ВД' },
  caves: { bg: '#374151', border: '#E5E7EB', label: 'Пещери и феномени', shortCode: 'ПЩ' },
  villages: { bg: '#065F46', border: '#A7F3D0', label: 'Села', shortCode: 'СЛ' },
  monasteries: { bg: '#991B1B', border: '#FECACA', label: 'Манастири', shortCode: 'МН' },
};

function createPinElement(
  categoryId: string,
  isSelected: boolean,
  stepNumber: number | null
): HTMLElement {
  const style = CATEGORY_COLORS[categoryId] || {
    bg: '#44403C',
    border: '#E7E5E4',
    label: 'Обект',
    shortCode: 'ОБ',
  };

  const pin = document.createElement('div');
  const size = isSelected ? '36px' : '30px';
  pin.style.position = 'relative';
  pin.style.width = size;
  pin.style.height = size;
  pin.style.backgroundColor = isSelected ? '#B45309' : style.bg;
  pin.style.border = `2px solid ${isSelected ? '#FFFFFF' : style.border}`;
  pin.style.borderRadius = '50% 50% 50% 0';
  pin.style.transform = 'rotate(-45deg)';
  pin.style.display = 'flex';
  pin.style.alignItems = 'center';
  pin.style.justifyContent = 'center';
  pin.style.boxShadow = '0 4px 10px rgba(0,0,0,0.35)';
  pin.style.cursor = 'pointer';

  const innerDot = document.createElement('span');
  innerDot.style.transform = 'rotate(45deg)';
  innerDot.style.width = isSelected ? '10px' : '8px';
  innerDot.style.height = isSelected ? '10px' : '8px';
  innerDot.style.borderRadius = '9999px';
  innerDot.style.backgroundColor = '#FFFFFF';
  innerDot.style.display = 'block';
  pin.appendChild(innerDot);

  if (stepNumber !== null) {
    const badge = document.createElement('div');
    badge.style.position = 'absolute';
    badge.style.top = '-9px';
    badge.style.right = '-9px';
    badge.style.width = '20px';
    badge.style.height = '20px';
    badge.style.backgroundColor = '#059669';
    badge.style.color = '#FFFFFF';
    badge.style.fontWeight = '800';
    badge.style.fontSize = '10px';
    badge.style.borderRadius = '9999px';
    badge.style.border = '2px solid #FFFFFF';
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    badge.style.boxShadow = '0 2px 6px rgba(0,0,0,0.35)';
    badge.style.transform = 'rotate(45deg)';
    badge.style.zIndex = '20';
    badge.textContent = String(stepNumber);
    pin.appendChild(badge);
  }

  return pin;
}

function createPopupContent(params: {
  place: Place;
  stepNumber: number | null;
  totalTrailSteps: number;
  isAdmin: boolean;
  isBuildingRoute: boolean;
  isInDraftRoute: boolean;
  onToggleRouteStop?: (place: Place) => void;
  onSelect: (place: Place) => void;
  onEdit?: (place: Place) => void;
}): HTMLElement {
  const {
    place,
    stepNumber,
    totalTrailSteps,
    isAdmin,
    isBuildingRoute,
    isInDraftRoute,
    onToggleRouteStop,
    onSelect,
    onEdit,
  } = params;
  const fallbackSrc = getFallbackImage(place.categoryId, place.name);
  const safeImgSrc = sanitizeImageSrc(place.imageUrl, fallbackSrc);

  const root = document.createElement('div');
  root.className = 'w-64 p-3 font-sans space-y-2.5';

  if (stepNumber !== null) {
    const stepBanner = document.createElement('div');
    stepBanner.className =
      'bg-emerald-950 text-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-700 flex items-center justify-between';
    const stepLabel = document.createElement('span');
    stepLabel.textContent = isBuildingRoute
      ? `Нов маршрут: Спирка ${stepNumber} от ${totalTrailSteps}`
      : `Маршрут: Спирка ${stepNumber} от ${totalTrailSteps}`;
    const stepIdx = document.createElement('span');
    stepIdx.className = 'text-emerald-400 font-mono';
    stepIdx.textContent = `#${stepNumber}`;
    stepBanner.appendChild(stepLabel);
    stepBanner.appendChild(stepIdx);
    root.appendChild(stepBanner);
  }

  const imgBox = document.createElement('div');
  imgBox.className = 'h-28 rounded-xl overflow-hidden relative bg-stone-900';

  const img = document.createElement('img');
  img.src = safeImgSrc;
  img.alt = place.name;
  img.className = 'w-full h-full object-cover';
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', () => {
    if (img.src !== fallbackSrc) {
      img.src = fallbackSrc;
    }
  });
  imgBox.appendChild(img);

  const catBadge = document.createElement('span');
  catBadge.className =
    'absolute top-2 left-2 bg-stone-950/85 text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-400/30';
  catBadge.textContent = place.categoryName;
  imgBox.appendChild(catBadge);

  root.appendChild(imgBox);

  const textWrap = document.createElement('div');
  textWrap.className = 'space-y-1';

  const title = document.createElement('h4');
  title.className = 'font-editorial text-base font-bold text-stone-950 leading-snug';
  title.textContent = place.name;
  textWrap.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'text-[11px] text-stone-600 font-medium';
  meta.textContent = `${place.regionName.split('(')[0].trim()} · ${place.difficulty}`;
  textWrap.appendChild(meta);

  const desc = document.createElement('p');
  desc.className = 'text-xs text-stone-700 leading-relaxed line-clamp-3';
  desc.textContent = place.shortDescription;
  textWrap.appendChild(desc);

  root.appendChild(textWrap);

  if (isBuildingRoute && onToggleRouteStop) {
    const routeBtn = document.createElement('button');
    routeBtn.type = 'button';
    routeBtn.className = isInDraftRoute
      ? 'w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer'
      : 'w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs';
    routeBtn.textContent = isInDraftRoute ? 'Премахни от маршрута' : '+ Добави към маршрута';
    routeBtn.addEventListener('click', () => onToggleRouteStop(place));
    root.appendChild(routeBtn);
  }

  const detailsBtn = document.createElement('button');
  detailsBtn.type = 'button';
  detailsBtn.className =
    'w-full mt-1 py-2 px-3 bg-stone-900 hover:bg-stone-800 text-amber-200 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer';
  detailsBtn.textContent = 'Разгледай подробно →';
  detailsBtn.addEventListener('click', () => onSelect(place));
  root.appendChild(detailsBtn);

  if (isAdmin && onEdit) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className =
      'w-full py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors border border-stone-300 cursor-pointer';
    editBtn.textContent = 'Редактирай обекта';
    editBtn.addEventListener('click', () => onEdit(place));
    root.appendChild(editBtn);
  }

  return root;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  places,
  categories,
  regions,
  selectedPlaceId,
  onSelectPlace,
  currentUser,
  onEditPlace,
  recentTrail = [],
  onClearTrail,
  onSelectTrailStep,
  routes = [],
  activeRoute = null,
  onSelectActiveRoute,
  onSaveCustomRoute,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const trailLayerRef = useRef<L.LayerGroup | null>(null);
  const hillshadeLayerRef = useRef<L.TileLayer | null>(null);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const hasGoogleKey = Boolean((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '');

  const [isSimulatingTrail, setIsSimulatingTrail] = useState(false);
  const [activeSimStep, setActiveSimStep] = useState<number | null>(null);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  const [dynamicRelief, setDynamicRelief] = useState<boolean>(true);
  const [hillshadeOpacity, setHillshadeOpacity] = useState<number>(0.55);

  const categoryOptions = React.useMemo(
    () => [
      { id: 'all', label: 'Всички категории' },
      ...categories.map((c) => ({
        id: c.id,
        label: c.name,
        count: places.filter((p) => p.categoryId === c.id).length,
      })),
    ],
    [categories, places]
  );

  const regionOptions = React.useMemo(
    () => [
      { id: 'all', label: 'Всички региони' },
      ...regions.map((r) => ({
        id: r.id,
        label: r.name.split('(')[0].trim(),
        count: places.filter((p) => p.regionId === r.id).length,
      })),
    ],
    [regions, places]
  );

  const difficultyOptions = React.useMemo(
    () => [
      { id: 'all', label: 'Всички трудности' },
      { id: 'Лесен', label: 'Лесен достъп' },
      { id: 'Умерен', label: 'Умерен преход' },
      { id: 'Труден', label: 'Труден терен' },
      { id: 'Екстремен', label: 'Екстремен' },
    ],
    []
  );

  const [mapProvider, setMapProvider] = useState<'google' | 'leaflet'>(
    hasGoogleKey ? 'google' : 'leaflet'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locatingUser, setLocatingUser] = useState(false);

  const [isBuildingRoute, setIsBuildingRoute] = useState(false);
  const [draftStops, setDraftStops] = useState<Place[]>([]);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDifficulty, setDraftDifficulty] = useState<DifficultyLevel>('Умерен');
  const [builderSearch, setBuilderSearch] = useState('');
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [focusedStepPlaceId, setFocusedStepPlaceId] = useState<string | null>(null);

  const BULGARIA_CENTER: [number, number] = [42.7339, 25.4858];
  const DEFAULT_ZOOM = 7.5;
  const isAdmin = currentUser?.role === 'admin';

  const routeOptions = useMemo(
    () => [
      { id: 'none', label: 'Без избран маршрут (Пътека)' },
      ...routes.map((r) => ({
        id: r.id,
        label: r.isCustom ? `★ ${r.title}` : r.title,
        count: r.stops.length,
      })),
    ],
    [routes]
  );

  const activeRoutePlaces = useMemo(() => {
    if (!activeRoute || !activeRoute.stops) return [];
    return activeRoute.stops
      .map((stop) => {
        const matched = places.find((p) => p.id === stop.placeId || p.slug === stop.placeId);
        if (matched) return matched;
        if (Array.isArray(stop.coordinates) && stop.coordinates.length === 2) {
          return {
            id: stop.placeId,
            slug: stop.placeId,
            name: stop.placeName,
            regionId: '',
            regionName: activeRoute.regionName,
            categoryId: 'sanctuaries',
            categoryName: 'Спирка',
            latitude: stop.coordinates[0],
            longitude: stop.coordinates[1],
            shortDescription: stop.notes,
            fullDescription: stop.notes,
            history: '',
            accessTips: '',
            terrainType: '',
            difficulty: activeRoute.difficulty,
            bestSeason: '',
            imageUrl: activeRoute.imageUrl,
            imageCredit: '',
            isVerified: true,
          } as Place;
        }
        return null;
      })
      .filter(Boolean) as Place[];
  }, [activeRoute, places]);

  const displayedTrail = useMemo(() => {
    if (isBuildingRoute) return draftStops;
    if (activeRoute && activeRoutePlaces.length > 0) return activeRoutePlaces;
    return recentTrail;
  }, [isBuildingRoute, draftStops, activeRoute, activeRoutePlaces, recentTrail]);

  const builderQuickMatches = useMemo(() => {
    const q = builderSearch.toLowerCase().trim();
    if (!q) return [];
    return places
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.regionName.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [places, builderSearch]);

  const filteredPlaces = places.filter((p) => {
    if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
    if (selectedRegion !== 'all' && p.regionId !== selectedRegion) return false;
    if (selectedDifficulty !== 'all' && p.difficulty !== selectedDifficulty) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchRegion = p.regionName.toLowerCase().includes(q);
      const matchCategory = p.categoryName.toLowerCase().includes(q);
      const matchDesc = p.shortDescription.toLowerCase().includes(q);
      if (!matchName && !matchRegion && !matchCategory && !matchDesc) return false;
    }
    return true;
  });

  const totalTrailDistance = calculateTotalTrailDistance(displayedTrail);

  const handleToggleDraftStop = (place: Place) => {
    setBuilderError(null);
    setDraftStops((prev) => {
      const exists = prev.some((p) => p.id === place.id);
      if (exists) {
        return prev.filter((p) => p.id !== place.id);
      }
      return [...prev, place];
    });
  };

  const handleMoveDraftStop = (index: number, direction: -1 | 1) => {
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

  const handleSaveMapRoute = () => {
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      setBuilderError('Въведете име на маршрута.');
      return;
    }
    if (draftStops.length < 2) {
      setBuilderError('Добавете поне 2 спирки от картата или чрез търсене.');
      return;
    }

    const distKm = calculateTotalTrailDistance(draftStops);
    const estHours = Math.max(1, Math.round(distKm / 55 + draftStops.length * 1.1));
    const durationLabel =
      estHours <= 8
        ? `${estHours} часа`
        : `${Math.ceil(estHours / 8)} дни (${estHours} ч)`;

    const uniqueRegions = Array.from(
      new Set(draftStops.map((p) => p.regionName.split('(')[0].trim()))
    );
    const regionSummary =
      uniqueRegions.length === 1
        ? uniqueRegions[0]
        : `${uniqueRegions[0]} (+${uniqueRegions.length - 1})`;

    const stops: RouteStop[] = draftStops.map((p, idx) => ({
      placeId: p.id,
      placeName: p.name,
      order: idx + 1,
      notes: p.shortDescription,
      coordinates: [p.latitude, p.longitude],
    }));

    const newRoute: RouteType = {
      id: `custom-route-${Date.now()}`,
      title: trimmed,
      description: `Личен маршрут с ${stops.length} спирки: ${stops.map((s) => s.placeName).join(' → ')}.`,
      duration: durationLabel,
      durationHours: estHours,
      totalDistance: `${distKm} км`,
      distanceKm: distKm,
      difficulty: draftDifficulty,
      regionName: regionSummary,
      imageUrl: draftStops[0].imageUrl || getFallbackImage(draftStops[0].categoryId, draftStops[0].name),
      stops,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    onSaveCustomRoute?.(newRoute);
    setIsBuildingRoute(false);
    setDraftStops([]);
    setDraftTitle('');
    setBuilderSearch('');
    setBuilderError(null);
    onSelectActiveRoute?.(newRoute);
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (mapProvider !== 'leaflet') return;
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: BULGARIA_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 6,
      maxZoom: 18,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
    });

    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Спътник: &copy; Esri, Maxar',
        maxZoom: 19,
      }
    );

    const hillshadeLayer = L.tileLayer(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Релеф (Hillshade): &copy; Esri',
        maxZoom: 16,
        opacity: hillshadeOpacity,
        className: 'hillshade-tile-layer',
        zIndex: 200,
      }
    );

    osmLayer.addTo(map);
    if (dynamicRelief) {
      hillshadeLayer.addTo(map);
    }

    const baseLayers = {
      'Географска карта (OSM)': osmLayer,
      'Спътникова снимка': satelliteLayer,
    };
    const overlays = {
      'Сенчест терен (Hillshade)': hillshadeLayer,
    };

    L.control.layers(baseLayers, overlays, { position: 'topright' }).addTo(map);

    map.on('overlayadd', (e: L.LayersControlEvent) => {
      if (e.layer === hillshadeLayer) setDynamicRelief(true);
    });
    map.on('overlayremove', (e: L.LayersControlEvent) => {
      if (e.layer === hillshadeLayer) setDynamicRelief(false);
    });

    const markersGroup = L.layerGroup().addTo(map);
    const trailGroup = L.layerGroup().addTo(map);

    hillshadeLayerRef.current = hillshadeLayer;
    markersLayerRef.current = markersGroup;
    trailLayerRef.current = trailGroup;
    mapInstanceRef.current = map;

    const invalidate = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };

    requestAnimationFrame(invalidate);
    const timer1 = setTimeout(invalidate, 80);
    const timer2 = setTimeout(invalidate, 300);

    const resizeObserver = new ResizeObserver(() => invalidate());
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }
    window.addEventListener('resize', invalidate);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      window.removeEventListener('resize', invalidate);
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      trailLayerRef.current = null;
      hillshadeLayerRef.current = null;
      markersMapRef.current.clear();
    };
  }, [mapProvider]);

  useEffect(() => {
    if (mapProvider !== 'leaflet') return;
    const map = mapInstanceRef.current;
    const hillshade = hillshadeLayerRef.current;
    if (!map || !hillshade) return;

    hillshade.setOpacity(hillshadeOpacity);
    if (dynamicRelief) {
      if (!map.hasLayer(hillshade)) hillshade.addTo(map);
    } else if (map.hasLayer(hillshade)) {
      map.removeLayer(hillshade);
    }
  }, [dynamicRelief, hillshadeOpacity, mapProvider]);

  // Render trail polyline connector & midpoint distance chips safely via DOM elements
  useEffect(() => {
    if (mapProvider !== 'leaflet') return;
    const map = mapInstanceRef.current;
    const trailGroup = trailLayerRef.current;
    if (!map || !trailGroup) return;

    trailGroup.clearLayers();

    const validTrail = displayedTrail.filter(
      (p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number'
    );

    if (validTrail.length < 2) return;

    const latLngs = validTrail.map((p) => [p.latitude, p.longitude] as [number, number]);

    L.polyline(latLngs, {
      color: '#065F46',
      weight: 9,
      opacity: 0.25,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(trailGroup);

    L.polyline(latLngs, {
      color: '#059669',
      weight: 4,
      opacity: 0.95,
      dashArray: '8, 10',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(trailGroup);

    for (let i = 0; i < validTrail.length - 1; i++) {
      const p1 = validTrail[i];
      const p2 = validTrail[i + 1];
      const dist = calculateDistanceKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      const midLat = (p1.latitude + p2.latitude) / 2;
      const midLng = (p1.longitude + p2.longitude) / 2;

      const labelEl = document.createElement('div');
      labelEl.style.background = '#064E3B';
      labelEl.style.color = '#D1FAE5';
      labelEl.style.border = '1px solid #34D399';
      labelEl.style.fontSize = '10px';
      labelEl.style.fontWeight = '700';
      labelEl.style.padding = '2px 8px';
      labelEl.style.borderRadius = '6px';
      labelEl.style.whiteSpace = 'nowrap';
      labelEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
      labelEl.textContent = `${dist} км`;

      const segmentIcon = L.divIcon({
        className: 'trail-segment-pill',
        html: labelEl,
        iconSize: [60, 22],
        iconAnchor: [30, 11],
      });

      L.marker([midLat, midLng], { icon: segmentIcon, interactive: false }).addTo(trailGroup);
    }
  }, [displayedTrail, mapProvider]);

  // Auto-fit Leaflet bounds when switching activeRoute
  useEffect(() => {
    if (mapProvider !== 'leaflet') return;
    const map = mapInstanceRef.current;
    if (!map || !activeRoute || activeRoutePlaces.length === 0) return;

    const valid = activeRoutePlaces.filter(
      (p) => typeof p.latitude === 'number' && typeof p.longitude === 'number'
    );
    if (valid.length === 1) {
      map.flyTo([valid[0].latitude, valid[0].longitude], 12.5, { animate: true });
      return;
    }
    if (valid.length >= 2) {
      const group = L.featureGroup(valid.map((p) => L.marker([p.latitude, p.longitude])));
      const timer = setTimeout(() => {
        map.fitBounds(group.getBounds().pad(0.22), { animate: true });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeRoute?.id, activeRoutePlaces, mapProvider]);

  // Render markers safely without innerHTML
  useEffect(() => {
    if (mapProvider !== 'leaflet') return;
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    markersMapRef.current.clear();

    const effectiveSelectedId = focusedStepPlaceId || selectedPlaceId;

    filteredPlaces.forEach((place) => {
      const isSelected = effectiveSelectedId === place.id;
      const trailIndex = displayedTrail.findIndex((p) => p.id === place.id);
      const stepNumber = trailIndex !== -1 ? trailIndex + 1 : null;
      const isInDraftRoute = draftStops.some((p) => p.id === place.id);

      const pinElement = createPinElement(place.categoryId, isSelected, stepNumber);
      const customIcon = L.divIcon({
        className: 'custom-map-marker',
        html: pinElement,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([place.latitude, place.longitude], {
        icon: customIcon,
        title: place.name,
      });

      const popupElement = createPopupContent({
        place,
        stepNumber,
        totalTrailSteps: displayedTrail.length,
        isAdmin,
        isBuildingRoute,
        isInDraftRoute,
        onToggleRouteStop: handleToggleDraftStop,
        onSelect: onSelectPlace,
        onEdit: onEditPlace,
      });

      marker.bindPopup(popupElement);
      marker.addTo(markersGroup);
      markersMapRef.current.set(place.id, marker);

      if (isSelected) {
        marker.openPopup();
      }
    });

    if (filteredPlaces.length > 0 && (selectedRegion !== 'all' || searchQuery.trim() !== '')) {
      const group = L.featureGroup(
        filteredPlaces.map((p) => L.marker([p.latitude, p.longitude]))
      );
      map.fitBounds(group.getBounds().pad(0.2));
    }
  }, [filteredPlaces, selectedPlaceId, focusedStepPlaceId, isAdmin, displayedTrail, isBuildingRoute, draftStops, mapProvider]);

  useEffect(() => {
    if (mapProvider !== 'leaflet') return;
    const map = mapInstanceRef.current;
    const targetId = focusedStepPlaceId || selectedPlaceId;
    if (!map || !targetId) return;

    const targetPlace = places.find((p) => p.id === targetId || p.slug === targetId);
    if (targetPlace) {
      map.flyTo([targetPlace.latitude, targetPlace.longitude], 12.5, {
        animate: true,
        duration: 1.2,
      });

      const marker = markersMapRef.current.get(targetPlace.id);
      if (marker) {
        setTimeout(() => {
          marker.openPopup();
        }, 700);
      }
    }
  }, [selectedPlaceId, focusedStepPlaceId, places, mapProvider]);

  const handleResetView = () => {
    setSelectedCategory('all');
    setSelectedRegion('all');
    setSelectedDifficulty('all');
    setSearchQuery('');
    setFocusedStepPlaceId(null);
    setGeoNotice(null);
    if (mapProvider === 'leaflet' && mapInstanceRef.current) {
      mapInstanceRef.current.setView(BULGARIA_CENTER, DEFAULT_ZOOM);
    }
  };

  const handleFocusTrail = () => {
    if (displayedTrail.length === 0) return;

    if (mapProvider !== 'leaflet') {
      setMapProvider('leaflet');
      return;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    const validPlaces = displayedTrail.filter((p) => p && typeof p.latitude === 'number');
    if (validPlaces.length === 0) return;

    if (validPlaces.length === 1) {
      map.flyTo([validPlaces[0].latitude, validPlaces[0].longitude], 12.5, { animate: true });
      return;
    }

    const group = L.featureGroup(validPlaces.map((p) => L.marker([p.latitude, p.longitude])));
    map.fitBounds(group.getBounds().pad(0.25), { animate: true });
  };

  const handleSimulateTrail = async () => {
    if (displayedTrail.length === 0 || isSimulatingTrail) return;

    if (mapProvider !== 'leaflet') {
      setMapProvider('leaflet');
      await new Promise((res) => setTimeout(res, 250));
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    const validPlaces = displayedTrail.filter((p) => p && typeof p.latitude === 'number');
    if (validPlaces.length === 0) return;

    setIsSimulatingTrail(true);

    for (let i = 0; i < validPlaces.length; i++) {
      const place = validPlaces[i];
      setActiveSimStep(i + 1);

      map.flyTo([place.latitude, place.longitude], 12.5, {
        animate: true,
        duration: 1.3,
      });

      const marker = markersMapRef.current.get(place.id);
      if (marker) {
        setTimeout(() => marker.openPopup(), 650);
      }

      await new Promise((res) => setTimeout(res, 2200));
    }

    setActiveSimStep(null);
    setIsSimulatingTrail(false);
    handleFocusTrail();
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGeoNotice('Геолокацията не се поддържа от вашия браузър.');
      return;
    }

    setGeoNotice(null);
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingUser(false);
        const { latitude, longitude } = pos.coords;
        if (mapProvider !== 'leaflet') {
          setMapProvider('leaflet');
        }
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([latitude, longitude], 12, { animate: true });
            const pinEl = document.createElement('div');
            pinEl.style.width = '18px';
            pinEl.style.height = '18px';
            pinEl.style.background = '#2563EB';
            pinEl.style.border = '3px solid #FFFFFF';
            pinEl.style.borderRadius = '50%';
            pinEl.style.boxShadow = '0 0 10px rgba(37,99,235,0.6)';

            const userIcon = L.divIcon({
              className: 'user-location-pin',
              html: pinEl,
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            });

            const popupEl = document.createElement('strong');
            popupEl.textContent = 'Вашата текуща локация';

            L.marker([latitude, longitude], { icon: userIcon })
              .addTo(mapInstanceRef.current)
              .bindPopup(popupEl)
              .openPopup();
          }
        }, 120);
      },
      () => {
        setLocatingUser(false);
        setGeoNotice(
          'Не можахме да определим местоположението ви. Разрешете достъпа до местоположение в браузъра.'
        );
      },
      { timeout: 8000 }
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
            <Compass className="w-4 h-4 text-amber-800" />
            <span>Интерактивна картография на България</span>
          </div>
          <h2 className="font-editorial text-3xl font-bold text-stone-950 mt-1">
            Карта на скритите съкровища
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Изберете маркер за пълни детайли, панорами, сенчест релеф и GPS координати.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Shaded Relief (Hillshade) Dynamic Toggle */}
          <button
            type="button"
            onClick={() => setDynamicRelief((prev) => !prev)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border shadow-2xs ${
              dynamicRelief
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-sm'
                : 'liquid-glass-focus-pill text-stone-700 border-stone-300/80 hover:text-stone-950'
            }`}
            title="Включи или изключи сенчест релеф (Hillshade) за планинските масиви"
          >
            <Mountain className={`w-3.5 h-3.5 ${dynamicRelief ? 'text-emerald-400' : 'text-stone-500'}`} />
            <span>Динамичен релеф</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                dynamicRelief ? 'bg-emerald-500/20 text-emerald-300' : 'bg-stone-200 text-stone-600'
              }`}
            >
              {dynamicRelief ? 'ВКЛ' : 'ИЗКЛ'}
            </span>
          </button>

          {/* Map Engine Switcher (Google Maps vs Leaflet/OSM) */}
          <div className="liquid-glass-focus-pill p-1 rounded-full flex items-center gap-1 border border-stone-300/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setMapProvider('google')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mapProvider === 'google'
                  ? 'bg-stone-900 text-amber-300 shadow-xs'
                  : 'text-stone-700 hover:text-stone-950'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>Google Maps</span>
            </button>
            <button
              type="button"
              onClick={() => setMapProvider('leaflet')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mapProvider === 'leaflet'
                  ? 'bg-stone-900 text-amber-300 shadow-xs'
                  : 'text-stone-700 hover:text-stone-950'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span>Leaflet / OSM</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-600 bg-stone-100 px-3 py-2 rounded-lg border border-stone-200">
            <span className="font-semibold text-stone-900">{filteredPlaces.length}</span>
            <span>от {places.length} места</span>
          </div>
        </div>
      </div>

      {geoNotice && (
        <div
          role="status"
          className="p-3 bg-amber-50 border border-amber-200 text-amber-950 text-xs rounded-xl flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{geoNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setGeoNotice(null)}
            className="text-stone-500 hover:text-stone-900 cursor-pointer shrink-0"
            aria-label="Затвори известието"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="liquid-water-card p-4 sm:p-5 rounded-3xl space-y-3 relative z-30 overflow-visible">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Input - Apple Liquid Focus Pill */}
          <div className="lg:col-span-3">
            <div className="liquid-glass-focus-pill liquid-iridescent-rim rounded-full p-1.5 sm:p-2 pr-3 flex items-center gap-2.5 transition-all focus-within:ring-2 focus-within:ring-amber-700/40">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white/90 border border-white/95 shadow-inner">
                <Search className="w-3.5 h-3.5 text-stone-700" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Търси обект..."
                className="w-full bg-transparent text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 font-semibold focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="w-5 h-5 rounded-full flex items-center justify-center bg-stone-900/10 text-stone-600 hover:text-stone-900 text-xs transition-colors shrink-0 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="lg:col-span-3">
            <LiquidGlassDropdown
              label="Категория"
              value={selectedCategory}
              options={categoryOptions}
              onChange={setSelectedCategory}
              icon={Layers}
              orbVariant="neutral"
            />
          </div>

          {/* Region Dropdown */}
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

          {/* Difficulty Dropdown & Action Buttons */}
          <div className="lg:col-span-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <LiquidGlassDropdown
                label="Трудност"
                value={selectedDifficulty}
                options={difficultyOptions}
                onChange={setSelectedDifficulty}
                icon={Mountain}
                orbVariant="amber"
              />
            </div>

            <button
              type="button"
              onClick={handleLocateMe}
              disabled={locatingUser}
              className={`liquid-orb-btn w-11 h-11 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow-xs ${
                locatingUser ? 'animate-pulse liquid-orb-btn-cyan text-white' : 'text-stone-700'
              }`}
              title="Моята текуща локация"
            >
              <Navigation className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleResetView}
              className="liquid-orb-btn w-11 h-11 rounded-full flex items-center justify-center text-stone-700 shrink-0 cursor-pointer shadow-xs"
              title="Нулирай филтрите и мащаба"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Legend, Route Selector & Builder Trigger */}
        <div className="pt-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600 border-t border-stone-200">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-semibold text-stone-800">Легенда:</span>
            {Object.entries(CATEGORY_COLORS).map(([key, item]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block border border-white shadow-xs"
                  style={{ backgroundColor: item.bg }}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {mapProvider === 'leaflet' && dynamicRelief && (
              <div className="flex items-center gap-2.5 liquid-glass-focus-pill px-3 py-1 rounded-full border border-stone-300/70 shadow-2xs">
                <Mountain className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="text-[11px] font-semibold text-stone-700 whitespace-nowrap">
                  Релеф:
                </span>
                <input
                  type="range"
                  min={0.2}
                  max={0.85}
                  step={0.05}
                  value={hillshadeOpacity}
                  onChange={(e) => setHillshadeOpacity(parseFloat(e.target.value))}
                  className="w-20 accent-emerald-700 cursor-pointer"
                  title="Интензитет на сенчестия терен (Hillshade)"
                />
                <span className="text-[11px] font-mono text-stone-600 w-7 text-right">
                  {Math.round(hillshadeOpacity * 100)}%
                </span>
              </div>
            )}

            {routes.length > 0 && (
              <div className="w-56 sm:w-64">
                <LiquidGlassDropdown
                  label="Маршрут"
                  value={activeRoute?.id || 'none'}
                  options={routeOptions}
                  onChange={(val) => {
                    setFocusedStepPlaceId(null);
                    if (val === 'none') {
                      onSelectActiveRoute?.(null);
                    } else {
                      const picked = routes.find((r) => r.id === val) || null;
                      setIsBuildingRoute(false);
                      onSelectActiveRoute?.(picked);
                    }
                  }}
                  icon={Route}
                  orbVariant="emerald"
                />
              </div>
            )}

            {onSaveCustomRoute && (
              <button
                type="button"
                onClick={() => {
                  setIsBuildingRoute((prev) => {
                    const next = !prev;
                    if (next) {
                      setBuilderError(null);
                    }
                    return next;
                  });
                }}
                className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm ${
                  isBuildingRoute
                    ? 'bg-stone-900 text-amber-200 border border-stone-700'
                    : 'btn-liquid-emerald water-shimmer text-white'
                }`}
              >
                {isBuildingRoute ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Отказ от маршрут</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Създай маршрут</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Map Route Builder Panel */}
      {isBuildingRoute && (
        <div className="liquid-water-card p-4 sm:p-5 rounded-3xl border border-emerald-500/40 shadow-xl space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-800 text-emerald-100 flex items-center justify-center shrink-0 shadow-sm">
                <Route className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-editorial text-lg font-bold text-stone-950">
                  Конструктор на маршрут върху картата
                </h3>
                <p className="text-[11px] text-stone-600">
                  Кликнете върху който и да е маркер на картата и натиснете „+ Добави към маршрута“ или потърсете обект по-долу.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {totalTrailDistance > 0 && (
                <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200 text-xs font-bold">
                  {draftStops.length} спирки · {totalTrailDistance} км
                </span>
              )}
              {draftStops.length >= 2 && (
                <button
                  type="button"
                  onClick={handleFocusTrail}
                  className="liquid-glass-focus-pill px-3 py-1.5 rounded-full text-xs font-bold text-stone-800 flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-amber-800" />
                  <span>Центрирай</span>
                </button>
              )}
            </div>
          </div>

          {builderError && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-900 text-xs font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{builderError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            <div className="lg:col-span-4">
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Име на маршрута (напр. Моят преход в Пирин)..."
                className="w-full px-3.5 py-2 rounded-full bg-white/90 border border-stone-300 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
              />
            </div>

            <div className="lg:col-span-2">
              <select
                value={draftDifficulty}
                onChange={(e) => setDraftDifficulty(e.target.value as DifficultyLevel)}
                className="w-full px-3 py-2 rounded-full bg-white/90 border border-stone-300 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
              >
                <option value="Лесен">Лесен</option>
                <option value="Умерен">Умерен</option>
                <option value="Труден">Труден</option>
                <option value="Екстремен">Екстремен</option>
              </select>
            </div>

            <div className="lg:col-span-4 relative">
              <div className="liquid-glass-focus-pill rounded-full px-3 py-1.5 flex items-center gap-2 border border-stone-300/80">
                <Search className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <input
                  type="text"
                  value={builderSearch}
                  onChange={(e) => setBuilderSearch(e.target.value)}
                  placeholder="Бързо добавяне по име..."
                  className="w-full bg-transparent text-xs text-stone-900 font-medium focus:outline-none"
                />
                {builderSearch && (
                  <button
                    type="button"
                    onClick={() => setBuilderSearch('')}
                    className="text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {builderQuickMatches.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 z-40 bg-white rounded-2xl border border-stone-200 shadow-2xl max-h-56 overflow-y-auto p-1.5 space-y-1">
                  {builderQuickMatches.map((p) => {
                    const added = draftStops.some((s) => s.id === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleToggleDraftStop(p)}
                        className="w-full text-left px-2.5 py-2 rounded-xl hover:bg-[#F4EFE6] flex items-center justify-between gap-2 text-xs cursor-pointer"
                      >
                        <span className="font-bold text-stone-900 truncate">{p.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            added ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {added ? '✓ Добавено' : '+ Добави'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleSaveMapRoute}
                className="btn-liquid-dark water-shimmer w-full py-2 px-4 rounded-full text-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Save className="w-3.5 h-3.5 text-amber-400" />
                <span>Запази</span>
              </button>
            </div>
          </div>

          {draftStops.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {draftStops.map((stop, idx) => (
                <div
                  key={stop.id}
                  className="liquid-glass-focus-pill px-2.5 py-1.5 rounded-full border border-emerald-500/40 flex items-center gap-2 text-xs"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFocusedStepPlaceId(stop.id)}
                    className="font-bold text-stone-900 hover:text-emerald-800 cursor-pointer"
                  >
                    {stop.name}
                  </button>
                  <div className="flex items-center gap-0.5 pl-1 border-l border-stone-300/70">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveDraftStop(idx, -1)}
                      className="p-0.5 text-stone-600 hover:text-stone-950 disabled:opacity-30 cursor-pointer"
                      title="Наляво"
                    >
                      <ArrowUp className="w-3 h-3 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === draftStops.length - 1}
                      onClick={() => handleMoveDraftStop(idx, 1)}
                      className="p-0.5 text-stone-600 hover:text-stone-950 disabled:opacity-30 cursor-pointer"
                      title="Надясно"
                    >
                      <ArrowDown className="w-3 h-3 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleDraftStop(stop)}
                      className="p-0.5 text-red-600 hover:text-red-800 cursor-pointer"
                      title="Премахни"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-stone-500 italic">
              Все още няма избрани спирки — отворете маркер на картата или потърсете обект по име.
            </div>
          )}
        </div>
      )}

      {/* Active Route Viewer OR Recent Trail Banner */}
      {!isBuildingRoute && activeRoute && activeRoutePlaces.length > 0 ? (
        <div className="liquid-water-card p-4 sm:p-5 rounded-3xl border border-amber-500/40 shadow-lg space-y-3 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-stone-900 text-amber-300 shrink-0 shadow-sm">
                <Route className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-editorial text-lg sm:text-xl font-bold text-stone-950 leading-tight">
                    {activeRoute.title}
                  </h3>
                  <span className="bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    {activeRoute.isCustom ? 'Личен маршрут' : 'Активен маршрут'}
                  </span>
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                    {activeRoute.difficulty}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 mt-0.5">
                  {activeRoute.regionName} · {activeRoutePlaces.length} спирки · {activeRoute.duration}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
              {totalTrailDistance > 0 && (
                <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50/90 text-emerald-900 rounded-full border border-emerald-200 text-xs font-bold shadow-2xs">
                  <Route className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{totalTrailDistance} км по карта</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleFocusTrail}
                className="liquid-glass-focus-pill px-3.5 py-1.5 rounded-full text-stone-800 hover:text-stone-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Maximize2 className="w-3.5 h-3.5 text-amber-800" />
                <span>Центрирай</span>
              </button>

              <button
                type="button"
                disabled={isSimulatingTrail}
                onClick={handleSimulateTrail}
                className="btn-liquid-emerald water-shimmer px-4 py-1.5 rounded-full text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isSimulatingTrail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Спирка {activeSimStep}...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Обхождане</span>
                  </>
                )}
              </button>

              {onSelectActiveRoute && (
                <button
                  type="button"
                  onClick={() => {
                    setFocusedStepPlaceId(null);
                    onSelectActiveRoute(null);
                  }}
                  className="liquid-orb-btn w-8 h-8 rounded-full flex items-center justify-center text-stone-600 hover:text-stone-950 transition-colors shrink-0 cursor-pointer"
                  title="Затвори активния маршрут"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {activeRoutePlaces.map((place, idx) => {
              const stepNum = idx + 1;
              const nextPlace = activeRoutePlaces[idx + 1];
              const distToNext = nextPlace
                ? calculateDistanceKm(
                    place.latitude,
                    place.longitude,
                    nextPlace.latitude,
                    nextPlace.longitude
                  )
                : null;
              const stopNote = activeRoute.stops[idx]?.notes;

              return (
                <div
                  key={`${place.id}-${idx}`}
                  onClick={() => {
                    setFocusedStepPlaceId(place.id);
                    onSelectTrailStep?.(place);
                  }}
                  className={`group liquid-glass-focus-pill p-2.5 rounded-2xl flex items-center justify-between gap-2.5 cursor-pointer border transition-all shadow-xs ${
                    focusedStepPlaceId === place.id
                      ? 'border-amber-600 ring-2 ring-amber-500/30'
                      : 'border-white/80 hover:border-emerald-500/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                      {stepNum}
                    </div>

                    <div className="w-10 h-10 rounded-xl overflow-hidden relative shrink-0 border border-stone-200/80 shadow-2xs">
                      <img
                        src={place.imageUrl}
                        alt={place.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = getFallbackImage(place.categoryId, place.name);
                        }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-stone-900 group-hover:text-emerald-900 truncate leading-snug">
                        {place.name}
                      </h4>
                      <div className="text-[10px] text-stone-500 font-medium truncate">
                        {stopNote || place.regionName.split('(')[0].trim()}
                      </div>
                    </div>
                  </div>

                  {distToNext !== null && (
                    <div className="flex flex-col items-end shrink-0 pl-2 border-l border-stone-200/80 text-[10px] text-emerald-800 font-bold">
                      <span className="text-stone-400">→</span>
                      <span>{distToNext} км</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        !isBuildingRoute &&
        recentTrail &&
        recentTrail.length > 0 && (
          <div className="liquid-water-card p-4 sm:p-5 rounded-3xl border border-emerald-500/30 shadow-lg space-y-3 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-emerald-700/10 border border-emerald-500/30 text-emerald-800 shrink-0 shadow-inner">
                  <Footprints className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-editorial text-lg font-bold text-stone-900 leading-tight">
                      Пътека от стъпки
                    </h3>
                    <span className="bg-emerald-100/90 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300/70">
                      Последно 3 разгледани
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Интерактивна маршрутна връзка между последните ви разгледани обекти
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
                {totalTrailDistance > 0 && (
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50/90 text-emerald-900 rounded-full border border-emerald-200 text-xs font-bold shadow-2xs">
                    <Route className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Общо: {totalTrailDistance} км</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleFocusTrail}
                  className="liquid-glass-focus-pill px-3.5 py-1.5 rounded-full text-stone-800 hover:text-stone-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Центрирай и мащабирай цялата пътека"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-amber-800" />
                  <span>Центрирай</span>
                </button>

                <button
                  type="button"
                  disabled={isSimulatingTrail}
                  onClick={handleSimulateTrail}
                  className="btn-liquid-emerald water-shimmer px-4 py-1.5 rounded-full text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Анимация: последователно обхождане на стъпките по картата"
                >
                  {isSimulatingTrail ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Стъпка {activeSimStep}...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Обхождане</span>
                    </>
                  )}
                </button>

                {onClearTrail && (
                  <button
                    type="button"
                    onClick={onClearTrail}
                    className="liquid-orb-btn w-8 h-8 rounded-full flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors shrink-0 cursor-pointer"
                    title="Изчисти пътеката от стъпки"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Step Cards Connected Horizontally */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              {recentTrail.map((place, idx) => {
                const stepNum = idx + 1;
                const nextPlace = recentTrail[idx + 1];
                const distToNext = nextPlace
                  ? calculateDistanceKm(
                      place.latitude,
                      place.longitude,
                      nextPlace.latitude,
                      nextPlace.longitude
                    )
                  : null;

                return (
                  <div
                    key={place.id}
                    onClick={() => {
                      if (onSelectTrailStep) {
                        onSelectTrailStep(place);
                      } else {
                        onSelectPlace(place);
                      }
                    }}
                    className="group liquid-glass-focus-pill p-2.5 rounded-2xl flex items-center justify-between gap-2.5 cursor-pointer border border-white/80 hover:border-emerald-500/50 transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                        {stepNum}
                      </div>

                      <div className="w-10 h-10 rounded-xl overflow-hidden relative shrink-0 border border-stone-200/80 shadow-2xs">
                        <img
                          src={place.imageUrl}
                          alt={place.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = getFallbackImage(place.categoryId, place.name);
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-stone-900 group-hover:text-emerald-900 truncate leading-snug">
                          {place.name}
                        </h4>
                        <div className="text-[10px] text-stone-500 font-medium truncate flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-amber-800 shrink-0" />
                          <span>{place.regionName.split('(')[0].trim()}</span>
                        </div>
                      </div>
                    </div>

                    {distToNext !== null && (
                      <div className="hidden md:flex flex-col items-end shrink-0 pl-2 border-l border-stone-200/80 text-[10px] text-emerald-800 font-bold">
                        <span className="text-stone-400">→</span>
                        <span>{distToNext} км</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Map Container */}
      {mapProvider === 'google' ? (
        <GoogleMapView
          places={filteredPlaces}
          selectedPlaceId={focusedStepPlaceId || selectedPlaceId}
          onSelectPlace={onSelectPlace}
          isAdmin={isAdmin}
          onEditPlace={onEditPlace}
          height="600px"
          dynamicRelief={dynamicRelief}
          recentTrail={displayedTrail}
          activeRouteKey={activeRoute?.id || null}
          isBuildingRoute={isBuildingRoute}
          onToggleRouteStop={handleToggleDraftStop}
          onSwitchToLeaflet={() => setMapProvider('leaflet')}
        />
      ) : (
        <div className="relative rounded-3xl overflow-hidden shadow-xl border border-stone-300/90 h-[560px] lg:h-[640px] bg-stone-200">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {filteredPlaces.length === 0 && (
            <div className="absolute inset-0 z-20 bg-stone-900/60 flex items-center justify-center p-6">
              <div className="bg-[#FBF9F5] p-6 rounded-xl max-w-md text-center shadow-xl border border-stone-300 space-y-3">
                <AlertCircle className="w-8 h-8 text-amber-700 mx-auto" />
                <h3 className="font-editorial text-xl font-bold text-stone-950">
                  Няма открити обекти по тези критерии
                </h3>
                <p className="text-xs text-stone-600">
                  Опитайте да изчистите филтрите или да промените региона и търсената дума.
                </p>
                <button
                  type="button"
                  onClick={handleResetView}
                  className="btn-liquid-dark px-5 py-2 text-xs font-semibold text-amber-200 rounded-lg cursor-pointer"
                >
                  Покажи всички места в България
                </button>
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 z-20 bg-white/95 px-3 py-1.5 rounded-lg border border-stone-300 shadow-sm text-xs text-stone-700 hidden sm:flex items-center gap-3">
            <span>
              Карта: OpenStreetMap {dynamicRelief ? '& Esri World Hillshade' : '& Esri Imagery'}
            </span>
            <span aria-hidden="true">·</span>
            <span>WGS84 България</span>
            {isAdmin && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-800 font-semibold flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  <span>Админ режим активен</span>
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
