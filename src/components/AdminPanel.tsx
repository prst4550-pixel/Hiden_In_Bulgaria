import React, { useState, useEffect } from 'react';
import {
  CommunitySuggestion,
  Place,
  User,
  AdminStatus,
  ContactMessage,
} from '../types';
import {
  fetchSuggestions,
  updateSuggestionStatus,
  fetchUsers,
  fetchContactMessages,
  deletePlace,
  fetchAdminStatus,
  claimAdminAccount,
} from '../services/api';
import { handleImageError } from '../utils/imageFallback';
import {
  ShieldCheck,
  Check,
  X,
  Lock,
  RefreshCw,
  Edit3,
  Trash2,
  PlusCircle,
  Users,
  MapPin,
  Search,
  LogIn,
  AlertCircle,
  CheckCircle2,
  Database,
  Mail,
  User as UserIcon,
  KeyRound,
} from 'lucide-react';

interface AdminPanelProps {
  onClose: () => void;
  onRefreshPlaces: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onAuthSuccess?: (user: User) => void;
  places: Place[];
  onEditPlace: (place: Place) => void;
  onAddNewPlace: () => void;
  onOpenSsms?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onClose,
  onRefreshPlaces,
  currentUser,
  onOpenAuth,
  onAuthSuccess,
  places,
  onEditPlace,
  onAddNewPlace,
  onOpenSsms,
}) => {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'places' | 'users' | 'messages'>(
    'suggestions'
  );
  const [suggestions, setSuggestions] = useState<CommunitySuggestion[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [placeSearch, setPlaceSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // First-run admin setup state when !isAdmin
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimPasswordConfirm, setClaimPasswordConfirm] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      fetchAdminStatus()
        .then((status) => {
          setAdminStatus(status);
          if (status.adminEmail) {
            setClaimEmail(status.adminEmail);
          }
        })
        .catch(() => setAdminStatus(null));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      if (activeTab === 'suggestions') {
        const data = await fetchSuggestions();
        setSuggestions(data);
      } else if (activeTab === 'users') {
        const users = await fetchUsers();
        setUsersList(users);
      } else if (activeTab === 'messages') {
        const msgs = await fetchContactMessages();
        setContactMessages(msgs);
      }
    } catch (err: any) {
      setActionError(err.message || 'Грешка при зареждане на данните.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError(null);

    if (claimPassword !== claimPasswordConfirm) {
      setClaimError('Паролите не съвпадат.');
      return;
    }
    if (claimPassword.length < 8 || !/[A-Za-zА-Яа-я]/.test(claimPassword) || !/\d/.test(claimPassword)) {
      setClaimError('Паролата трябва да е минимум 8 символа и да съдържа букви и цифри.');
      return;
    }

    setIsClaiming(true);
    try {
      const res = await claimAdminAccount(claimEmail, claimPassword, 'Администратор');
      if (onAuthSuccess) {
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      setClaimError(err.message || 'Грешка при активиране на администраторския акаунт.');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setActionError(null);
    try {
      await updateSuggestionStatus(id, status);
      setActionMessage(
        `Предложението беше маркирано като ${status === 'approved' ? 'Одобрено' : 'Отхвърлено'}.`
      );
      await loadData();
      onRefreshPlaces();
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      setActionError(err.message || 'Грешка при обновяване на статуса.');
    }
  };

  const handleConfirmDeletePlace = async (place: Place) => {
    setActionError(null);
    try {
      await deletePlace(place.id);
      setConfirmDeleteId(null);
      setActionMessage(`Обектът „${place.name}“ беше изтрит успешно.`);
      onRefreshPlaces();
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      setActionError(err.message || 'Грешка при изтриване на обекта.');
    }
  };

  // Gate when user is not logged in as administrator
  if (!isAdmin) {
    const canClaim = Boolean(adminStatus && !adminStatus.adminClaimed && !adminStatus.envConfigured);

    return (
      <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-4">
        <div className="liquid-water-card w-full max-w-md rounded-3xl p-6 sm:p-8 border border-white/70 shadow-2xl space-y-6 text-center">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-800 to-stone-900 text-amber-200 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h3 className="font-editorial text-2xl font-bold text-stone-900">
              {canClaim ? 'Активиране на администраторски достъп' : 'Административен достъп'}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {canClaim
                ? 'Задайте първоначална администраторска парола, за да активирате управлението на обектите, предложенията и T-SQL базата.'
                : 'За пълен контрол върху обектите, одобрение на предложения и редакция на съдържанието е необходим вход с администраторския акаунт.'}
            </p>
          </div>

          {canClaim ? (
            <form onSubmit={handleClaimAdmin} className="space-y-3 text-left">
              {claimError && (
                <div
                  role="alert"
                  className="p-2.5 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{claimError}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Администраторски имейл
                </label>
                <input
                  type="email"
                  required
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white/80 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Нова парола (мин. 8 символа, букви и цифри)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={claimPassword}
                  onChange={(e) => setClaimPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs bg-white/80 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Потвърдете паролата
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={claimPasswordConfirm}
                  onChange={(e) => setClaimPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs bg-white/80 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-liquid-water w-1/2 py-2.5 text-xs font-semibold text-stone-700 rounded-full cursor-pointer"
                >
                  Затвори
                </button>
                <button
                  type="submit"
                  disabled={isClaiming}
                  className="btn-liquid-amber water-shimmer w-1/2 py-2.5 text-xs font-bold text-white rounded-full flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isClaiming ? 'Активиране...' : 'Активирай'}</span>
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="p-4 bg-amber-50/70 backdrop-blur-xs rounded-2xl border border-amber-200/80 text-left text-xs text-stone-800 space-y-2">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-800" />
                  <span>Достъп с оторизиран профил</span>
                </div>
                <p className="text-stone-600 leading-relaxed">
                  {adminStatus?.envConfigured
                    ? 'Влезте с конфигурирания администраторски имейл и зададената системна парола.'
                    : `Влезте с администраторския имейл (${adminStatus?.adminEmail || 'администратор'}) и зададената при настройката парола.`}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-liquid-water w-1/2 py-2.5 text-xs font-semibold text-stone-700 rounded-full cursor-pointer"
                >
                  Затвори
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="btn-liquid-amber water-shimmer w-1/2 py-2.5 text-xs font-bold text-white rounded-full flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Вход като Админ</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const filteredPlaces = places.filter((p) => {
    if (!placeSearch.trim()) return true;
    const q = placeSearch.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.regionName.toLowerCase().includes(q) ||
      p.categoryName.toLowerCase().includes(q)
    );
  });

  const pendingSuggestionsCount = suggestions.filter((s) => s.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/65 flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-stone-200">
        {/* Admin Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-[#FBF9F5] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-stone-900 text-amber-300 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-editorial text-xl font-bold text-stone-950">
                  Административен център
                </h3>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-950 px-2.5 py-0.5 rounded border border-amber-300">
                  {currentUser?.email}
                </span>
              </div>
              <p className="text-xs text-stone-600">
                Управление на обектите, предложенията от общността, запитванията и потребителите
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSsms && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSsms();
                }}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0078D4] hover:bg-[#106EBE] text-white text-xs font-semibold transition-colors cursor-pointer"
                title="Отвори SSMS Студио (T-SQL База данни)"
              >
                <Database className="w-3.5 h-3.5" />
                <span>SSMS Студио</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onAddNewPlace()}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg btn-liquid-amber text-white text-xs font-bold cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Нов обект</span>
            </button>

            <button
              type="button"
              onClick={loadData}
              className="w-9 h-9 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-950 flex items-center justify-center cursor-pointer transition-colors"
              title="Презареди данните"
              aria-label="Презареди данните"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-950 flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Затвори"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-4 px-5 pt-3 border-b border-stone-200 bg-[#F4EFE6] text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('suggestions')}
            className={`pb-2.5 px-1 border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'suggestions'
                ? 'border-amber-800 text-amber-950 font-bold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>Предложения</span>
            {pendingSuggestionsCount > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-800 text-white text-[10px] rounded tabular-nums">
                {pendingSuggestionsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('places')}
            className={`pb-2.5 px-1 border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'places'
                ? 'border-amber-800 text-amber-950 font-bold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <span className="tabular-nums">Обекти ({places.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`pb-2.5 px-1 border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'users'
                ? 'border-amber-800 text-amber-950 font-bold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Потребители</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`pb-2.5 px-1 border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'messages'
                ? 'border-amber-800 text-amber-950 font-bold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Запитвания</span>
          </button>
        </div>

        {/* Action notification & error banners */}
        {actionMessage && (
          <div className="m-4 mb-0 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}
        {actionError && (
          <div className="m-4 mb-0 p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-700 hover:text-red-950 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: Suggestions */}
          {activeTab === 'suggestions' && (
            <div className="space-y-4">
              {suggestions.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs">
                  Няма регистрирани предложения в системата.
                </div>
              ) : (
                suggestions.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 sm:p-5 bg-white rounded-xl border border-stone-200 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              s.status === 'pending'
                                ? 'bg-amber-100 text-amber-900'
                                : s.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-red-100 text-red-900'
                            }`}
                          >
                            {s.status === 'pending'
                              ? 'Чака одобрение'
                              : s.status === 'approved'
                              ? 'Одобрено'
                              : 'Отхвърлено'}
                          </span>
                          <span className="text-xs text-stone-500 tabular-nums">
                            {new Date(s.createdAt).toLocaleDateString('bg-BG')}
                          </span>
                        </div>
                        <h4 className="font-editorial text-lg font-bold text-stone-950 mt-1">
                          {s.name}
                        </h4>
                        <div className="text-xs text-stone-600 flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-amber-800" />
                            <span>{s.region}</span>
                          </span>
                          <span>·</span>
                          <span>{s.category}</span>
                          <span>·</span>
                          <span className="font-mono tabular-nums">
                            {s.latitude.toFixed(4)}°N, {s.longitude.toFixed(4)}°E
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {s.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(s.id, 'approved')}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Одобри</span>
                          </button>
                        )}
                        {s.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(s.id, 'rejected')}
                            className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Отхвърли</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-stone-700 leading-relaxed bg-[#FBF9F5] p-3 rounded-lg border border-stone-200">
                      {s.description}
                    </p>

                    <div className="text-[11px] text-stone-500 flex flex-wrap gap-4 pt-1">
                      <span>
                        <strong>Източник:</strong> {s.source}
                      </span>
                      {s.contact && (
                        <span>
                          <strong>Контакт:</strong> {s.contact}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Places Management */}
          {activeTab === 'places' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-1">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={placeSearch}
                    onChange={(e) => setPlaceSearch(e.target.value)}
                    placeholder="Търси обект за редакция..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                  />
                </div>

                <button
                  type="button"
                  onClick={onAddNewPlace}
                  className="w-full sm:w-auto px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-amber-300" />
                  <span>Добави нов обект</span>
                </button>
              </div>

              <div className="divide-y divide-stone-200 bg-white rounded-xl border border-stone-200 overflow-hidden">
                {filteredPlaces.map((place) => (
                  <div
                    key={place.id}
                    className="p-3 sm:p-4 flex items-center justify-between gap-3 hover:bg-[#FBF9F5] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={place.imageUrl}
                        alt={place.name}
                        loading="lazy"
                        decoding="async"
                        className="w-12 h-12 rounded-lg object-cover bg-stone-200 shrink-0"
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, place.categoryId, place.name)}
                      />
                      <div className="min-w-0">
                        <div className="font-editorial text-base font-bold text-stone-950 truncate">
                          {place.name}
                        </div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-2">
                          <span>{place.categoryName}</span>
                          <span>·</span>
                          <span className="truncate">{place.regionName.split('(')[0]}</span>
                          <span>·</span>
                          <span>{place.difficulty}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {confirmDeleteId === place.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleConfirmDeletePlace(place)}
                            className="px-2.5 py-1 bg-red-700 hover:bg-red-800 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                          >
                            Потвърди изтриването
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[11px] font-semibold cursor-pointer"
                          >
                            Отказ
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditPlace(place)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-semibold flex items-center gap-1 border border-amber-200 transition-colors cursor-pointer"
                            title="Редактирай"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Редактирай</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(place.id)}
                            className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Изтрий"
                            aria-label={`Изтрий ${place.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Users & Roles */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#FBF9F5] rounded-xl border border-stone-200 text-xs text-stone-800">
                <strong>Ролева система:</strong> Платформата поддържа две роли — <strong>Администратор</strong> (пълни права за управление на обекти, предложения, запитвания и SSMS базата) и <strong>Потребител</strong> (публикуване на отзиви и запазване на списък с любими).
              </div>

              <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F4EFE6] border-b border-stone-200 text-stone-700 font-semibold">
                    <tr>
                      <th className="p-3 sm:p-4">Потребител</th>
                      <th className="p-3 sm:p-4">Имейл</th>
                      <th className="p-3 sm:p-4">Роля</th>
                      <th className="p-3 sm:p-4">Дата на регистрация</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {usersList.map((user) => (
                      <tr key={user.id} className="hover:bg-stone-50">
                        <td className="p-3 sm:p-4 font-semibold text-stone-900">{user.name}</td>
                        <td className="p-3 sm:p-4 text-stone-600 font-mono text-[11px]">
                          {user.email}
                        </td>
                        <td className="p-3 sm:p-4">
                          {user.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300">
                              <ShieldCheck className="w-3 h-3 text-amber-800" />
                              <span>Администратор</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
                              <UserIcon className="w-3 h-3 text-stone-600" />
                              <span>Потребител</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 sm:p-4 text-stone-500 text-[11px] tabular-nums">
                          {new Date(user.createdAt).toLocaleDateString('bg-BG')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Contact Messages */}
          {activeTab === 'messages' && (
            <div className="space-y-3">
              {contactMessages.length === 0 ? (
                <div className="text-center py-12 text-stone-500 text-xs">
                  Все още няма получени запитвания през формата за контакти.
                </div>
              ) : (
                contactMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 sm:p-5 bg-white rounded-xl border border-stone-200 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-editorial text-lg font-bold text-stone-950">
                          {msg.subject}
                        </h4>
                        <div className="text-xs text-stone-600 flex items-center gap-2">
                          <span className="font-semibold text-stone-900">{msg.name}</span>
                          <span>·</span>
                          <span className="font-mono text-[11px]">{msg.email}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-stone-500 tabular-nums">
                        {new Date(msg.createdAt).toLocaleString('bg-BG')}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed bg-[#FBF9F5] p-3 rounded-lg border border-stone-200">
                      {msg.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
