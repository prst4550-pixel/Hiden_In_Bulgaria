import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { Place } from '../types';
import { MapPin, Compass, ExternalLink, Mountain } from 'lucide-react';
import { handleImageError } from '../utils/imageFallback';

interface GoogleMapViewProps {
  places: Place[];
  selectedPlaceId?: string | null;
  onSelectPlace: (place: Place) => void;
  isAdmin?: boolean;
  onEditPlace?: (place: Place) => void;
  height?: string;
  dynamicRelief?: boolean;
  recentTrail?: Place[];
  activeRouteKey?: string | null;
  isBuildingRoute?: boolean;
  onToggleRouteStop?: (place: Place) => void;
  onSwitchToLeaflet?: () => void;
}

const MapSelectionController: React.FC<{
  selectedPlace?: Place | null;
}> = ({ selectedPlace }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !selectedPlace) return;
    map.panTo({ lat: selectedPlace.latitude, lng: selectedPlace.longitude });
    const currentZoom = map.getZoom() || 7.5;
    if (currentZoom < 11) {
      map.setZoom(12);
    }
  }, [map, selectedPlace]);

  return null;
};

const TrailPolylineController: React.FC<{
  trail: Place[];
  activeRouteKey?: string | null;
}> = ({ trail, activeRouteKey }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const gMaps = (window as unknown as { google?: { maps?: { Polyline?: new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void }; LatLngBounds?: new () => { extend: (pt: { lat: number; lng: number }) => void } } } }).google?.maps;
    if (!gMaps?.Polyline || trail.length < 2) return;

    const path = trail
      .filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number')
      .map((p) => ({ lat: p.latitude, lng: p.longitude }));

    if (path.length < 2) return;

    const polyline = new gMaps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#059669',
      strokeOpacity: 0.9,
      strokeWeight: 4,
    });
    polyline.setMap(map);

    return () => {
      polyline.setMap(null);
    };
  }, [map, trail]);

  useEffect(() => {
    if (!map || !activeRouteKey || trail.length === 0) return;
    const gMaps = (window as unknown as { google?: { maps?: { LatLngBounds?: new () => { extend: (pt: { lat: number; lng: number }) => void } } } }).google?.maps;
    if (!gMaps?.LatLngBounds) return;

    const valid = trail.filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number');
    if (valid.length === 1) {
      map.panTo({ lat: valid[0].latitude, lng: valid[0].longitude });
      map.setZoom(12);
      return;
    }

    if (valid.length >= 2) {
      const bounds = new gMaps.LatLngBounds();
      valid.forEach((p) => bounds.extend({ lat: p.latitude, lng: p.longitude }));
      (map as unknown as { fitBounds: (b: unknown, padding?: number) => void }).fitBounds(bounds, 60);
    }
  }, [map, activeRouteKey, trail]);

  return null;
};

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  places,
  selectedPlaceId,
  onSelectPlace,
  isAdmin = false,
  onEditPlace,
  height = '540px',
  dynamicRelief = true,
  recentTrail = [],
  activeRouteKey = null,
  isBuildingRoute = false,
  onToggleRouteStop,
  onSwitchToLeaflet,
}) => {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  const [activePlace, setActivePlace] = useState<Place | null>(
    selectedPlaceId
      ? places.find((p) => p.id === selectedPlaceId || p.slug === selectedPlaceId) || null
      : null
  );

  useEffect(() => {
    if (!selectedPlaceId) return;
    const match = places.find((p) => p.id === selectedPlaceId || p.slug === selectedPlaceId);
    if (match) {
      setActivePlace(match);
    }
  }, [selectedPlaceId, places]);

  const BULGARIA_CENTER = { lat: 42.7339, lng: 25.4858 };

  if (!apiKey) {
    return (
      <div
        className="w-full relative rounded-3xl overflow-hidden shadow-xl border border-stone-300/90 bg-stone-900 flex items-center justify-center p-6 text-center"
        style={{ height }}
      >
        <div className="max-w-md bg-[#FBF9F5] text-stone-900 rounded-2xl p-6 shadow-2xl border border-stone-200 space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto border border-amber-300">
            <Mountain className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-editorial text-xl font-bold text-stone-950">
              Google Maps API ключът не е активен в тази среда
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              За да визуализирате интерактивния релеф на България със сенчест терен (Hillshade) и всички {places.length} маркера, превключете към картата на Leaflet / OpenStreetMap.
            </p>
          </div>
          {onSwitchToLeaflet && (
            <button
              type="button"
              onClick={onSwitchToLeaflet}
              className="btn-liquid-emerald water-shimmer px-5 py-2.5 rounded-full text-xs font-bold text-white inline-flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Compass className="w-4 h-4" />
              <span>Отвори Leaflet карта с Hillshade релеф</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full relative rounded-3xl overflow-hidden shadow-xl border border-stone-300/90 bg-stone-900 flex flex-col"
      style={{ height }}
    >
      <div className="relative flex-1 w-full min-h-0">
        <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={
            activePlace
              ? { lat: activePlace.latitude, lng: activePlace.longitude }
              : BULGARIA_CENTER
          }
          defaultZoom={7.5}
          mapId="DEMO_MAP_ID"
          mapTypeId={dynamicRelief ? 'terrain' : 'roadmap'}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          gestureHandling="greedy"
          disableDefaultUI={false}
          className="w-full h-full"
        >
          <MapSelectionController selectedPlace={activePlace} />
          <TrailPolylineController trail={recentTrail} activeRouteKey={activeRouteKey} />

          {places.map((place) => {
            const isSelected = activePlace?.id === place.id;
            const trailIdx = recentTrail.findIndex((t) => t.id === place.id);
            const isInTrail = trailIdx !== -1;

            return (
              <AdvancedMarker
                key={place.id}
                position={{ lat: place.latitude, lng: place.longitude }}
                onClick={() => setActivePlace(place)}
                title={place.name}
              >
                <Pin
                  background={isSelected ? '#b45309' : isInTrail ? '#059669' : '#1b3b2b'}
                  borderColor="#ffffff"
                  glyphColor="#fef08a"
                  glyph={isInTrail ? String(trailIdx + 1) : undefined}
                  scale={isSelected ? 1.3 : isInTrail ? 1.15 : 1.0}
                />
              </AdvancedMarker>
            );
          })}

          {activePlace && (
            <InfoWindow
              position={{ lat: activePlace.latitude, lng: activePlace.longitude }}
              onCloseClick={() => setActivePlace(null)}
            >
              <div className="w-64 p-2 font-sans space-y-2 text-stone-900">
                <div className="h-28 rounded-xl overflow-hidden relative bg-stone-900 shadow-xs">
                  <img
                    src={activePlace.imageUrl}
                    alt={activePlace.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImageError(e, activePlace.categoryId, activePlace.name)}
                  />
                  <span className="absolute top-1.5 left-1.5 bg-stone-900/85 text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-amber-400/30">
                    {activePlace.categoryName}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="font-editorial text-base font-bold text-stone-950 leading-snug">
                    {activePlace.name}
                  </h4>
                  <div className="text-[11px] text-stone-500 font-medium">
                    📍 {activePlace.regionName.split('(')[0]} · {activePlace.difficulty}
                  </div>
                  <p className="text-xs text-stone-700 leading-relaxed line-clamp-2">
                    {activePlace.shortDescription}
                  </p>
                </div>

                <div className="pt-2 space-y-1">
                  {isBuildingRoute && onToggleRouteStop && (
                    <button
                      type="button"
                      onClick={() => onToggleRouteStop(activePlace)}
                      className={`w-full py-1.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                        recentTrail.some((p) => p.id === activePlace.id)
                          ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                          : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      }`}
                    >
                      <span>
                        {recentTrail.some((p) => p.id === activePlace.id)
                          ? 'Премахни от маршрута'
                          : '+ Добави към маршрута'}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => onSelectPlace(activePlace)}
                    className="w-full py-1.5 px-3 bg-stone-900 hover:bg-stone-800 text-amber-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <span>Разгледай детайли</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  {isAdmin && onEditPlace && (
                    <button
                      onClick={() => onEditPlace(activePlace)}
                      className="w-full py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all border border-stone-300 shadow-2xs cursor-pointer"
                    >
                      ✏️ Редактирай (Админ)
                    </button>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
        </APIProvider>
      </div>

      {/* Bottom Google Maps Status Strip (placed below the map canvas so it never covers Map/Satellite controls) */}
      <div className="px-4 py-2 bg-[#FBF9F5]/95 backdrop-blur-md border-t border-stone-200/90 text-xs font-bold text-stone-900 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Google Maps Platform</span>
          {dynamicRelief && (
            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
              Релеф
            </span>
          )}
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <span className="text-[11px] font-medium text-stone-500">
          {places.length} обекта · WGS84 България
        </span>
      </div>
    </div>
  );
};
