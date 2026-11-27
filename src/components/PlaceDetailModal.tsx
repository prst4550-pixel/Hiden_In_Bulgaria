import React, { useState, useEffect } from 'react';
import { Place, Review, User } from '../types';
import { fetchReviews, submitReview } from '../services/api';
import { handleImageError } from '../utils/imageFallback';
import {
  X,
  MapPin,
  Bookmark,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Compass,
  Calendar,
  AlertTriangle,
  Star,
  Send,
  MessageSquare,
  Edit3,
  Lock,
} from 'lucide-react';

interface PlaceDetailModalProps {
  place: Place | null;
  isOpen: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onLocateOnMap: (place: Place) => void;
  onSelectRelatedPlace?: (placeId: string) => void;
  allPlaces?: Place[];
  isAdmin?: boolean;
  onEditPlace?: (place: Place) => void;
  currentUser?: User | null;
  onRequireAuth?: (
    message: string,
    action: (user: User) => void | Promise<void>,
    tab?: 'login' | 'register'
  ) => boolean;
}

export const PlaceDetailModal: React.FC<PlaceDetailModalProps> = ({
  place,
  isOpen,
  onClose,
  isFavorite,
  onToggleFavorite,
  onLocateOnMap,
  onSelectRelatedPlace,
  allPlaces = [],
  isAdmin = false,
  onEditPlace,
  currentUser,
  onRequireAuth,
}) => {
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [sharedToast, setSharedToast] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [visitSeason, setVisitSeason] = useState('Пролет 2026');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [queuedReviewSubmit, setQueuedReviewSubmit] = useState(false);

  const placeId = place?.id;
  useEffect(() => {
    if (!placeId) return;
    // Reset per-place state and ignore stale responses when switching places quickly.
    let ignore = false;
    setReviews([]);
    setReviewComment('');
    setReviewError(null);
    fetchReviews(placeId).then((list) => {
      if (!ignore) setReviews(list);
    });
    return () => {
      ignore = true;
    };
  }, [placeId]);

  useEffect(() => {
    if (currentUser && !authorName.trim()) {
      setAuthorName(currentUser.name);
    }
  }, [currentUser]);

  // Process queued review after authentication. `isOpen && place` must be checked first:
  // performReviewSubmit is declared below the early return, so referencing it in a render
  // that returned early would throw a ReferenceError (TDZ).
  useEffect(() => {
    if (isOpen && place && currentUser && queuedReviewSubmit) {
      setQueuedReviewSubmit(false);
      void performReviewSubmit(authorName.trim() || currentUser.name);
    }
  }, [isOpen, place, currentUser, queuedReviewSubmit]);

  // All hooks must be above this condition
  if (!isOpen || !place) return null;

  const copyToClipboard = (text: string) => {
    // navigator.clipboard is undefined on non-secure (non-HTTPS) origins.
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const handleCopyCoords = () => {
    const coordsStr = `${place.latitude.toFixed(6)}, ${place.longitude.toFixed(6)}`;
    copyToClipboard(coordsStr);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: `${place.name} — Скрито в България`,
      text: place.shortDescription,
      url: url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (e) {
        // user cancelled or share unsupported
      }
    } else {
      copyToClipboard(url);
      setSharedToast(true);
      setTimeout(() => setSharedToast(false), 2500);
    }
  };

  const performReviewSubmit = async (overrideAuthor?: string) => {
    const finalAuthor = (overrideAuthor ?? authorName).trim();
    if (!finalAuthor || !reviewComment.trim()) return;

    setReviewError(null);
    try {
      setIsSubmittingReview(true);
      const newRev = await submitReview({
        placeId: place.id,
        author: finalAuthor,
        rating: reviewRating,
        comment: reviewComment,
        visitSeason: visitSeason,
      });
      setReviews((prev) => [newRev, ...prev]);
      setReviewComment('');
      setReviewSuccess(true);
      setTimeout(() => setReviewSuccess(false), 3000);
    } catch (err: any) {
      setReviewError(err.message || 'Грешка при публикуване на отзива.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    if (!currentUser && onRequireAuth) {
      onRequireAuth(
        'Влезте в профила си или се регистрирайте, за да публикувате отзив за това място.',
        () => {
          setQueuedReviewSubmit(true);
        }
      );
      return;
    }
    if (!authorName.trim() && !currentUser?.name) return;
    await performReviewSubmit(authorName.trim() || currentUser?.name);
  };

  const relatedPlaces = allPlaces.filter((p) => place.nearbyPlaceIds?.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/60 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="relative liquid-water-card w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        {/* Modal Top Bar - Liquid Water Header */}
        <div className="p-4 sm:px-6 border-b border-stone-200/50 flex items-center justify-between bg-white/40 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs text-stone-600">
            <span className="font-semibold text-amber-900">{place.categoryName}</span>
            <span aria-hidden="true">·</span>
            <span>{place.regionName}</span>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && onEditPlace && (
              <button
                onClick={() => {
                  onClose();
                  onEditPlace(place);
                }}
                className="btn-liquid-amber water-shimmer px-4 py-1.5 rounded-full text-stone-950 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Редактирай този обект (Администратор)"
              >
                <Edit3 className="w-3.5 h-3.5 text-stone-950" />
                <span>Редактирай</span>
              </button>
            )}

            <button
              onClick={() => onToggleFavorite(place.id)}
              className={`w-10 h-10 rounded-full transition-all duration-300 flex items-center justify-center cursor-pointer shadow-xs ${
                isFavorite
                  ? 'liquid-orb-btn-amber text-stone-950 shadow-md'
                  : 'liquid-orb-btn text-stone-700'
              }`}
              title={isFavorite ? 'Премахни от любими' : 'Запази в любими'}
            >
              <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full liquid-orb-btn text-stone-700 flex items-center justify-center cursor-pointer shadow-xs"
              title="Сподели страницата"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full liquid-orb-btn text-stone-700 flex items-center justify-center cursor-pointer shadow-xs"
              aria-label="Затвори"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>


        {/* Modal Content - Scrollable */}
        <div className="overflow-y-auto p-5 sm:p-8 space-y-8">
          {/* Hero Image & Headline - Natural aspect ratio with guaranteed full title visibility */}
          <div className="space-y-4">
            <div className="relative aspect-[16/9] min-h-[260px] sm:min-h-[340px] max-h-[460px] rounded-2xl overflow-hidden shadow-lg bg-stone-900">
              <img
                src={place.imageUrl}
                alt={place.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => handleImageError(e, place.categoryId, place.name)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/95 via-stone-950/40 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white flex flex-col sm:flex-row sm:items-end justify-between gap-2 z-10">
                <div className="space-y-1 max-w-2xl">
                  <span className="text-xs text-amber-300 tracking-wider uppercase font-bold drop-shadow-sm">
                    {place.categoryName} · {place.regionName.split('(')[0]}
                  </span>
                  <h1 className="font-editorial text-2xl sm:text-4xl font-bold text-white leading-tight drop-shadow-md">
                    {place.name}
                  </h1>
                </div>
                {place.imageCredit && (
                  <div className="text-[11px] text-stone-300 shrink-0 font-mono bg-stone-950/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10">
                    Снимка: {place.imageCredit}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 pb-4 border-b border-stone-200">
              {/* Coordinates with Copy button */}
              <div className="flex items-center gap-2 text-xs font-mono bg-[#F4EFE6] px-3.5 py-2 rounded-xl border border-stone-300 text-stone-900 font-semibold shadow-2xs">
                <MapPin className="w-4 h-4 text-amber-800" />
                <span>
                  {place.latitude.toFixed(6)}° N, {place.longitude.toFixed(6)}° E
                </span>
                <button
                  onClick={handleCopyCoords}
                  className="ml-2 pl-2 border-l border-stone-300 text-stone-600 hover:text-stone-900 flex items-center gap-1 font-sans active:scale-95 transition-all"
                  title="Копирай координати"
                >
                  {copiedCoords ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Копирани!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Копирай</span>
                    </>
                  )}
                </button>
              </div>

              {/* Navigation and Map Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => {
                    onClose();
                    onLocateOnMap(place);
                  }}
                  className="liquid-glass-focus-pill-dark px-5 py-2.5 rounded-full text-xs font-bold text-amber-200 hover:text-white transition-all flex items-center gap-2 cursor-pointer shadow-md hover:scale-105 active:scale-95"
                >
                  <Compass className="w-4 h-4 text-amber-300" />
                  <span>Покажи на картата</span>
                </button>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-liquid-amber water-shimmer liquid-iridescent-rim px-5 py-2.5 rounded-full text-xs font-bold text-stone-950 flex items-center gap-2 shadow-md hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Навигация (Google Maps)</span>
                </a>
              </div>
            </div>
          </div>

          {/* Key Overview Grid (2 Columns: Narrative & Terrain Specs) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Narrative Column (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-900 mb-2">
                  Описание и атмосфера
                </h2>
                <p className="text-stone-800 leading-relaxed text-base">
                  {place.fullDescription}
                </p>
              </div>

              <div className="pt-4 border-t border-stone-200">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-900 mb-2">
                  Исторически и културни сведения
                </h2>
                <p className="text-stone-800 leading-relaxed text-sm bg-[#F7F4EE] p-5 rounded-xl border border-stone-200/80">
                  {place.history}
                </p>
              </div>

              <div className="pt-4 border-t border-stone-200">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-900 mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>Практически съвети за достъп и терен</span>
                </h2>
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-2 text-xs sm:text-sm text-stone-800 leading-relaxed">
                  <p>{place.accessTips}</p>
                </div>
              </div>
            </div>

            {/* Right Operational Passport (4 cols) */}
            <div className="lg:col-span-4 bg-[#F5F1E8] rounded-xl p-5 border border-stone-300/80 space-y-4">
              <h3 className="font-editorial text-lg font-bold text-stone-950 pb-2 border-b border-stone-300">
                Паспорт на обекта
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-stone-500">Трудност на прехода</div>
                  <div className="font-semibold text-stone-900 text-sm mt-0.5">{place.difficulty}</div>
                </div>

                <div>
                  <div className="text-stone-500">Тип терен</div>
                  <div className="font-semibold text-stone-900 mt-0.5">{place.terrainType}</div>
                </div>

                <div>
                  <div className="text-stone-500">Подходящ сезон</div>
                  <div className="font-semibold text-stone-900 mt-0.5">{place.bestSeason}</div>
                </div>

                {place.altitude && (
                  <div>
                    <div className="text-stone-500">Надморска височина</div>
                    <div className="font-semibold text-stone-900 font-mono mt-0.5">{place.altitude} метра</div>
                  </div>
                )}

                <div>
                  <div className="text-stone-500">Статус на проверката</div>
                  <div className="text-emerald-800 font-semibold flex items-center gap-1 mt-0.5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Потвърдено от краеведи</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Related Nearby Places Section */}
          {relatedPlaces.length > 0 && (
            <div className="pt-6 border-t border-stone-200 space-y-4">
              <h3 className="font-editorial text-xl font-bold text-stone-900">
                Свързани места в същия район
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {relatedPlaces.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => onSelectRelatedPlace && onSelectRelatedPlace(rel.id)}
                    className="p-3 bg-white rounded-xl border border-stone-200 hover:border-amber-700 cursor-pointer transition-colors space-y-2 group shadow-sm"
                  >
                    <div className="h-28 rounded-lg overflow-hidden bg-stone-900">
                      <img
                        src={rel.imageUrl}
                        alt={rel.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, rel.categoryId)}
                      />
                    </div>
                    <h4 className="font-editorial text-sm font-bold text-stone-900 group-hover:text-amber-900">
                      {rel.name}
                    </h4>
                    <div className="text-[11px] text-stone-500">{rel.categoryName}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews & Traveler Notes Section */}
          <div className="pt-6 border-t border-stone-200 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-editorial text-xl font-bold text-stone-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-amber-800" />
                  <span>Отзиви и бележки от пътешественици ({reviews.length})</span>
                </h3>
                <p className="text-xs text-stone-600 mt-0.5">
                  Споделете актуално състояние на пътеката и лични впечатления.
                </p>
              </div>
            </div>

            {/* Submit Review Form */}
            <form onSubmit={handleReviewSubmit} className="bg-[#F7F4EE] p-5 rounded-xl border border-stone-200 space-y-4">
              {!currentUser && onRequireAuth && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-800 shrink-0" />
                    <span>Публикуването на отзиви изисква вход в профила или регистрация.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onRequireAuth(
                        'Влезте в профила си или се регистрирайте, за да публикувате отзив.',
                        () => {}
                      )
                    }
                    className="px-3 py-1.5 rounded-full bg-stone-900 hover:bg-stone-800 text-amber-200 font-bold text-[11px] shrink-0 cursor-pointer transition-colors self-start sm:self-auto"
                  >
                    Вход / Регистрация
                  </button>
                </div>
              )}

              {reviewError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
                  {reviewError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Вашето име</label>
                  <input
                    type="text"
                    required
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="напр. Иван Иванов"
                    className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Оценка</label>
                  <select
                    value={reviewRating}
                    onChange={(e) => setReviewRating(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-800"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (5 / 5) Превъзходно</option>
                    <option value={4}>⭐⭐⭐⭐ (4 / 5) Много добро</option>
                    <option value={3}>⭐⭐⭐ (3 / 5) Добро</option>
                    <option value={2}>⭐⭐ (2 / 5) Труден достъп</option>
                    <option value={1}>⭐ (1 / 5) Разочароващо</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Сезон на посещението</label>
                  <input
                    type="text"
                    value={visitSeason}
                    onChange={(e) => setVisitSeason(e.target.value)}
                    placeholder="напр. Септември 2026"
                    className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Вашият коментар и съвети за терена</label>
                <textarea
                  required
                  rows={2}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Опишете състоянието на пътя, има ли маркировка, подходящо ли е за деца..."
                  className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-amber-800"
                />
              </div>

              <div className="flex items-center justify-between">
                {reviewSuccess && (
                  <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Благодарим за вашия отзив!
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="ml-auto px-5 py-2 text-xs font-bold text-stone-950 btn-liquid-amber water-shimmer liquid-iridescent-rim rounded-full transition-all flex items-center gap-1.5 shadow-xs hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingReview ? 'Записване...' : 'Публикувай отзив'}</span>
                </button>
              </div>
            </form>

            {/* List of Reviews */}
            <div className="space-y-3">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-4 bg-white rounded-xl border border-stone-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-900">{rev.author}</span>
                    <span className="text-stone-400 font-mono text-[11px]">{rev.visitSeason}</span>
                  </div>
                  <div className="flex text-amber-600 text-xs">
                    {'★'.repeat(rev.rating)}
                    {'☆'.repeat(5 - rev.rating)}
                  </div>
                  <p className="text-xs text-stone-700 leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-200 bg-[#F7F4EE] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-stone-800 bg-white rounded-lg border border-stone-300 hover:bg-stone-100 transition-colors"
          >
            Затвори прозореца
          </button>
        </div>
      </div>
    </div>
  );
};
