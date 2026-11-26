import React, { useEffect, useState } from 'react';
import { User, CommunitySuggestion, Review } from '../types';
import { fetchMyProfileActivity, updateProfileName } from '../services/api';
import {
  X,
  User as UserIcon,
  Shield,
  Bookmark,
  Route,
  Footprints,
  MessageSquare,
  Edit3,
  Check,
  LogOut,
  MapPin,
  Star,
  AlertCircle,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUserUpdated: (user: User) => void;
  favoritesCount: number;
  customRoutesCount: number;
  recentTrailCount: number;
  guideMessagesCount: number;
  onOpenFavorites: () => void;
  onGoToRoutes: () => void;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  favoritesCount,
  customRoutesCount,
  recentTrailCount,
  guideMessagesCount,
  onOpenFavorites,
  onGoToRoutes,
  onLogout,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [activityLoading, setActivityLoading] = useState(false);
  const [mySuggestions, setMySuggestions] = useState<CommunitySuggestion[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    setNameInput(currentUser.name);
    setIsEditingName(false);
    setNameError(null);
    setNameSuccess(false);

    setActivityLoading(true);
    fetchMyProfileActivity()
      .then((res) => {
        setMySuggestions(res.suggestions || []);
        setMyReviews(res.reviews || []);
      })
      .catch(() => {
        setMySuggestions([]);
        setMyReviews([]);
      })
      .finally(() => setActivityLoading(false));
  }, [isOpen, currentUser?.id]);

  if (!isOpen || !currentUser) return null;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      setNameError('Името трябва да е поне 2 символа.');
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      const updated = await updateProfileName(trimmed);
      onUserUpdated(updated);
      setIsEditingName(false);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 2500);
    } catch (err: any) {
      setNameError(err.message || 'Грешка при запазване на името.');
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="liquid-water-card w-full max-w-2xl rounded-3xl border border-white/90 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200/60 bg-white/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-600 to-stone-900 text-amber-200 flex items-center justify-center font-bold text-base shadow-inner border border-white/50 shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-editorial text-xl font-bold text-stone-950 truncate">
                  Моят профил
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    currentUser.role === 'admin'
                      ? 'bg-amber-200 text-stone-950 border border-amber-400'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}
                >
                  {currentUser.role === 'admin' ? 'Администратор' : 'Потребител'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 truncate">{currentUser.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="liquid-orb-btn w-9 h-9 rounded-full flex items-center justify-center text-stone-700 hover:text-stone-950 cursor-pointer shadow-xs shrink-0"
            aria-label="Затвори"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Isolation assurance banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-950 text-xs flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Този профил е напълно самостоятелен. Всички ваши любими места, създадени маршрути, разгледана пътека и разговори с Пътеводителя се запазват единствено във вашия личен акаунт.
            </div>
          </div>

          {/* Identity & Inline Rename */}
          <div className="liquid-glass-focus-pill p-4 rounded-2xl border border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-700 uppercase tracking-wider">
                <UserIcon className="w-3.5 h-3.5 text-amber-800" />
                <span>Лични данни</span>
              </div>
              <span className="text-[11px] text-stone-500">
                Регистриран: {new Date(currentUser.createdAt).toLocaleDateString('bg-BG')}
              </span>
            </div>

            {isEditingName ? (
              <form onSubmit={handleSaveName} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs sm:text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-700/40"
                  placeholder="Вашето име"
                  required
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={savingName}
                    className="btn-liquid-emerald px-4 py-2 rounded-xl text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {savingName ? 'Запис...' : 'Запази'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setNameInput(currentUser.name);
                      setNameError(null);
                    }}
                    className="px-3 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold cursor-pointer"
                  >
                    Отказ
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-stone-950">{currentUser.name}</div>
                  <div className="text-xs text-stone-500">{currentUser.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-800" />
                  <span>Промени име</span>
                </button>
              </div>
            )}

            {nameError && (
              <div className="text-xs text-red-700 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{nameError}</span>
              </div>
            )}

            {nameSuccess && (
              <div className="text-xs text-emerald-700 flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Името е обновено успешно.</span>
              </div>
            )}
          </div>

          {/* Isolated Profile Data Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onGoToRoutes();
              }}
              className="p-3.5 rounded-2xl bg-white/80 hover:bg-[#F4EFE6] border border-stone-200 text-left transition-all cursor-pointer shadow-2xs space-y-1"
            >
              <Route className="w-4 h-4 text-emerald-700" />
              <div className="text-xl font-bold font-mono text-stone-950">{customRoutesCount}</div>
              <div className="text-[11px] font-semibold text-stone-600">Лични маршрути</div>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFavorites();
              }}
              className="p-3.5 rounded-2xl bg-white/80 hover:bg-[#F4EFE6] border border-stone-200 text-left transition-all cursor-pointer shadow-2xs space-y-1"
            >
              <Bookmark className="w-4 h-4 text-amber-700" />
              <div className="text-xl font-bold font-mono text-stone-950">{favoritesCount}</div>
              <div className="text-[11px] font-semibold text-stone-600">Любими места</div>
            </button>

            <div className="p-3.5 rounded-2xl bg-white/80 border border-stone-200 text-left shadow-2xs space-y-1">
              <Footprints className="w-4 h-4 text-stone-700" />
              <div className="text-xl font-bold font-mono text-stone-950">{recentTrailCount}</div>
              <div className="text-[11px] font-semibold text-stone-600">Стъпки в пътеката</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/80 border border-stone-200 text-left shadow-2xs space-y-1">
              <MessageSquare className="w-4 h-4 text-blue-700" />
              <div className="text-xl font-bold font-mono text-stone-950">{guideMessagesCount}</div>
              <div className="text-[11px] font-semibold text-stone-600">Съобщения в гида</div>
            </div>
          </div>

          {/* Personal Activity (Reviews & Suggestions submitted by this user) */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600">
              Моята активност в общността
            </h4>

            {activityLoading ? (
              <div className="text-xs text-stone-500 py-3">Зареждане на личната активност...</div>
            ) : mySuggestions.length === 0 && myReviews.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/60 border border-stone-200/80 text-xs text-stone-500">
                Все още нямате изпратени отзиви или предложения за нови места от този профил.
              </div>
            ) : (
              <div className="space-y-2">
                {mySuggestions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl bg-white/80 border border-stone-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                      <span className="font-bold text-stone-900 truncate">{s.name}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        s.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-900'
                          : s.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {s.status === 'approved'
                        ? 'Одобрено'
                        : s.status === 'rejected'
                          ? 'Отхвърлено'
                          : 'Чака преглед'}
                    </span>
                  </div>
                ))}

                {myReviews.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-white/80 border border-stone-200 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900">Отзив за: {r.placeId}</span>
                      <span className="flex items-center gap-0.5 text-amber-700 font-bold">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>{r.rating}/5</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 line-clamp-2">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200/60 bg-white/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="px-4 py-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Изход от профила</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn-liquid-dark px-5 py-2 rounded-full text-xs font-bold text-amber-200 cursor-pointer shadow-xs"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
