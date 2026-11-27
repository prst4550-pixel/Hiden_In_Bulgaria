import React from 'react';
import { Place, User } from '../types';
import { Bookmark, X, MapPin, Trash2, Lock } from 'lucide-react';
import { handleImageError } from '../utils/imageFallback';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  favoriteIds: string[];
  allPlaces: Place[];
  onToggleFavorite: (id: string) => void;
  onSelectPlace: (place: Place) => void;
  onLocateOnMap: (place: Place) => void;
  currentUser?: User | null;
  onOpenAuth?: (tab?: 'login' | 'register') => void;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({
  isOpen,
  onClose,
  favoriteIds,
  allPlaces,
  onToggleFavorite,
  onSelectPlace,
  onLocateOnMap,
  currentUser,
  onOpenAuth,
}) => {
  if (!isOpen) return null;

  const favoritePlaces = allPlaces.filter((p) => favoriteIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="liquid-water-card w-full max-w-2xl rounded-3xl border border-white/90 shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200/60 bg-white/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-inner border border-white/50">
              <Bookmark className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h3 className="font-editorial text-xl font-bold text-stone-900">
                Запазени любими места ({favoritePlaces.length})
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                {currentUser
                  ? `Запазено единствено в профила на ${currentUser.name}`
                  : 'Необходим е вход в профила, за да запазвате любими места'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="liquid-orb-btn w-9 h-9 rounded-full flex items-center justify-center text-stone-700 hover:text-stone-950 cursor-pointer shadow-xs"
            aria-label="Затвори"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {favoritePlaces.length === 0 ? (
            <div className="text-center py-12 space-y-3 text-stone-600">
              <div className="liquid-orb-btn w-16 h-16 rounded-full mx-auto flex items-center justify-center text-stone-400">
                <Bookmark className="w-8 h-8 text-stone-400" />
              </div>
              <div className="font-editorial text-xl font-bold text-stone-900">
                Все още нямате запазени любими места
              </div>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Натиснете иконата с флагчето (отметка) на всяка карта или детайлна страница, за да запазите място за следващото си пътуване.
              </p>
            </div>
          ) : (
            favoritePlaces.map((place) => (
              <div
                key={place.id}
                className="p-3 liquid-glass-focus-pill rounded-2xl flex items-center justify-between gap-4 transition-all hover:scale-[1.01]"
              >
                <div
                  onClick={() => {
                    onClose();
                    onSelectPlace(place);
                  }}
                  className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0"
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-900 shrink-0 border border-white/60 shadow-xs">
                    <img
                      src={place.imageUrl}
                      alt={place.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, place.categoryId, place.name)}
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-editorial text-base font-bold text-stone-950 truncate">
                      {place.name}
                    </h4>
                    <div className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5 font-medium">
                      <span>{place.categoryName}</span>
                      <span>·</span>
                      <span>{place.regionName.split('(')[0]}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      onClose();
                      onLocateOnMap(place);
                    }}
                    className="liquid-orb-btn w-9 h-9 rounded-full flex items-center justify-center text-amber-800 cursor-pointer shadow-xs"
                    title="Виж на картата"
                  >
                    <MapPin className="w-4 h-4 text-amber-800" />
                  </button>

                  <button
                    onClick={() => onToggleFavorite(place.id)}
                    className="liquid-orb-btn w-9 h-9 rounded-full flex items-center justify-center text-stone-400 hover:text-rose-600 cursor-pointer shadow-xs"
                    title="Премахни от любими"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200/60 bg-white/40 flex items-center justify-between gap-3 flex-wrap">
          {!currentUser && onOpenAuth ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAuth('login');
              }}
              className="text-xs font-bold text-amber-900 hover:text-amber-950 flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Влезте в профил, за да запазите списъка само за себе си</span>
            </button>
          ) : (
            <span className="text-[11px] text-stone-500">
              {currentUser ? `Синхронизирано с профил: ${currentUser.email}` : ''}
            </span>
          )}
          <button
            onClick={onClose}
            className="btn-liquid-water water-shimmer px-6 py-2 rounded-full text-xs font-bold text-stone-800 hover:text-stone-950 cursor-pointer shadow-xs ml-auto"
          >
            Затвори
          </button>
        </div>
      </div>
    </div>
  );
};
