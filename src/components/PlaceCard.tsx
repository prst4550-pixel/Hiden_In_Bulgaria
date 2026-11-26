import React from 'react';
import { Place } from '../types';
import { Bookmark, MapPin, ArrowUpRight, Edit3, Trash2, Camera } from 'lucide-react';
import { handleImageError } from '../utils/imageFallback';

interface PlaceCardProps {
  place: Place;
  isFavorite: boolean;
  onToggleFavorite: (placeId: string) => void;
  onSelect: (place: Place) => void;
  onLocateOnMap: (place: Place) => void;
  isAdmin?: boolean;
  onEdit?: (place: Place) => void;
  onDelete?: (place: Place) => void;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({
  place,
  isFavorite,
  onToggleFavorite,
  onSelect,
  onLocateOnMap,
  isAdmin = false,
  onEdit,
  onDelete,
}) => {
  return (
    <article className="group liquid-water-card rounded-3xl overflow-hidden shadow-xs hover:shadow-2xl flex flex-col justify-between transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]">
      {/* Visual Photography Container - natural ratio so nothing is awkwardly cropped */}
      <div
        className="relative aspect-[16/10] w-full bg-stone-950 overflow-hidden cursor-pointer"
        onClick={() => onSelect(place)}
      >
        <img
          src={place.imageUrl}
          alt={place.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
          referrerPolicy="no-referrer"
          onError={(e) => handleImageError(e, place.categoryId, place.name)}
        />
        {/* Cinematic gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/20 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />

        {/* Top Badges: Real Photo Verification Seal & Featured */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
          <div className="bg-emerald-950/85 backdrop-blur-xl text-emerald-300 text-[11px] font-semibold px-3 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
            <Camera className="w-3 h-3 text-emerald-400" />
            <span>Реална снимка</span>
          </div>
          {place.isFeatured && (
            <div className="btn-liquid-amber liquid-iridescent-rim text-stone-950 text-[10px] font-bold px-3 py-0.5 rounded-full shadow-sm">
              Топ избор
            </div>
          )}
        </div>

        {/* Liquid Glass Orb Bookmark Action (Matching user reference circular bell) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(place.id);
          }}
          className={`absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 active:scale-90 cursor-pointer ${
            isFavorite
              ? 'liquid-orb-btn-amber text-stone-950 shadow-md'
              : 'liquid-orb-btn text-stone-800'
          }`}
          title={isFavorite ? 'Премахни от любими' : 'Запази в любими'}
          aria-label={isFavorite ? 'Премахни от любими' : 'Запази в любими'}
        >
          <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-stone-950 text-stone-950' : 'text-stone-800'}`} />
        </button>

        {/* Admin Quick Badge */}
        {isAdmin && (
          <div className="absolute top-12 left-3 z-10 liquid-glass-focus-pill-dark text-amber-200 text-[10px] font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
            <Edit3 className="w-3 h-3 text-amber-300" />
            <span>Редакция</span>
          </div>
        )}

        {/* Bottom Coordinates & Elevation Strip */}
        <div className="absolute bottom-2.5 inset-x-3 z-10 flex items-center justify-between text-[11px] font-mono text-stone-300">
          <span className="tracking-tight text-white/95 drop-shadow-xs">
            {place.latitude.toFixed(4)}°N, {place.longitude.toFixed(4)}°E
          </span>
          <span className="liquid-glass-focus-pill-dark px-2.5 py-0.5 rounded-full text-amber-300 text-[10px] shadow-xs">
            {place.elevationMeters || place.altitude ? `${place.elevationMeters || place.altitude} м н.в.` : place.difficulty}
          </span>
        </div>
      </div>

      {/* Content Section - no truncated text */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-3.5">
        <div className="space-y-2">
          {/* Metadata */}
          <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
            <span className="text-amber-900 font-bold">{place.categoryName}</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span>{place.regionName.split('(')[0].trim()}</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="text-stone-600">{place.difficulty}</span>
          </div>

          {/* Full Place Title */}
          <h3
            onClick={() => onSelect(place)}
            className="font-editorial text-xl font-bold text-stone-950 group-hover:text-amber-900 transition-colors cursor-pointer leading-snug"
          >
            {place.name}
          </h3>

          {/* Descriptive text with generous line spacing and natural flow */}
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed line-clamp-3">
            {place.shortDescription}
          </p>
        </div>

        {/* Liquid Water Card Action Buttons */}
        <div className="pt-3 border-t border-stone-200/50 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => onLocateOnMap(place)}
              className="btn-liquid-water water-shimmer px-3.5 py-1.5 rounded-full text-stone-800 hover:text-stone-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-800" />
              <span>На картата</span>
            </button>

            <button
              onClick={() => onSelect(place)}
              className="btn-liquid-dark water-shimmer px-4 py-1.5 rounded-full text-amber-200 hover:text-amber-100 text-xs font-bold flex items-center gap-1.5 group/btn cursor-pointer"
            >
              <span>Разгледай</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform duration-300" />
            </button>
          </div>


          {/* Admin Edit/Delete Bar */}
          {isAdmin && (
            <div className="flex items-center gap-2 pt-2 border-t border-stone-200/50">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit && onEdit(place);
                }}
                className="flex-1 py-1.5 px-3 rounded-full liquid-glass-focus-pill text-stone-800 hover:text-stone-950 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer hover:scale-102"
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/80 border border-white/90 shadow-inner text-amber-800 shrink-0">
                  <Edit3 className="w-3 h-3" />
                </div>
                <span>Редактирай</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete && onDelete(place);
                }}
                className="w-8 h-8 rounded-full liquid-orb-btn text-rose-700 hover:text-rose-900 hover:bg-rose-100/50 flex items-center justify-center transition-all cursor-pointer hover:scale-105 shrink-0"
                title="Изтрий обект"
                aria-label="Изтрий обект"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
