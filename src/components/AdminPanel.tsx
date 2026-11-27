import React, { useState, useEffect, useCallback } from 'react';
import {
  CommunitySuggestion,
  Place,
  User,
  AdminStatus,
  ContactMessage,
  AdminStats,
  AdminReview,
  AuditLogEntry,
} from '../types';
import {
  fetchSuggestions,
  updateSuggestionStatus,
  deleteSuggestion,
  fetchUsers,
  fetchContactMessages,
  setContactMessageRead,
  deleteContactMessage,
  deletePlace,
  setPlaceFeatured,
  fetchAdminStatus,
  claimAdminAccount,
  updateUserStatus,
  deleteUserAccount,
  fetchAdminStats,
  fetchAdminReviews,
  deleteReview,
  fetchAuditLog,
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
  Mail,
  MailOpen,
  User as UserIcon,
  KeyRound,
  Ban,
  UserCheck,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  History,
  Star,
  Heart,
  RotateCcw,
  Reply,
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
}

type AdminTab = 'overview' | 'suggestions' | 'places' | 'reviews' | 'users' | 'messages' | 'log';
type SuggestionFilter = 'all' | 'pending' | 'approved' | 'rejected';

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'place.create': 'Добавен обект',
  'place.update': 'Редактиран обект',
  'place.delete': 'Изтрит обект',
  'place.feature': 'Обект маркиран като препоръчан',
  'place.unfeature': 'Обект премахнат от препоръчани',
  'suggestion.status': 'Променен статус на предложение',
  'suggestion.delete': 'Изтрито предложение',
  'review.delete': 'Изтрит отзив',
  'user.block': 'Блокиран потребител',
  'user.unblock': 'Отблокиран потребител',
  'user.delete': 'Изтрит потребител',
  'message.delete': 'Изтрито запитване',
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('bg-BG');
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('bg-BG', { dateStyle: 'short', timeStyle: 'short' });

const inputClass =
  'w-full pl-9 pr-3 py-2.5 text-sm sm:text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40';

const SearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => (
  <div className="relative w-full sm:w-80">
    <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputClass}
    />
  </div>
);

const EmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-center py-12 text-stone-500 text-sm sm:text-xs">{children}</div>
);

const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
  onClick?: () => void;
}> = ({ label, value, hint, tone = 'text-stone-950', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className="p-3 sm:p-4 bg-white rounded-xl border border-stone-200 text-left enabled:hover:border-amber-300 enabled:hover:bg-amber-50/40 enabled:cursor-pointer transition-colors min-w-0"
  >
    <div className="text-[11px] text-stone-500 font-medium truncate">{label}</div>
    <div className={`font-editorial text-2xl sm:text-3xl font-bold tabular-nums mt-0.5 ${tone}`}>
      {value}
    </div>
    {hint && <div className="text-[11px] text-stone-500 mt-0.5 truncate">{hint}</div>}
  </button>
);

const BarList: React.FC<{ title: string; items: { name: string; count: number }[] }> = ({
  title,
  items,
}) => {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-stone-500">Няма данни.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.name} className="text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-stone-800 truncate">{item.name}</span>
                <span className="text-stone-600 tabular-nums font-semibold">{item.count}</span>
              </div>
              <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-700 rounded-full"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onClose,
  onRefreshPlaces,
  currentUser,
  onOpenAuth,
  onAuthSuccess,
  places,
  onEditPlace,
  onAddNewPlace,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [suggestions, setSuggestions] = useState<CommunitySuggestion[]>([]);
  const [suggestionFilter, setSuggestionFilter] = useState<SuggestionFilter>('pending');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [placeSearch, setPlaceSearch] = useState('');
  const [placeCategory, setPlaceCategory] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [reviewSearch, setReviewSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // First-run admin setup state when !isAdmin
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimPasswordConfirm, setClaimPasswordConfirm] = useState('');
  const [showClaimPassword, setShowClaimPassword] = useState(false);
  const [showClaimPasswordConfirm, setShowClaimPasswordConfirm] = useState(false);
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

  // Lock background scroll while the panel is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const refreshStats = useCallback(() => {
    fetchAdminStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      if (activeTab === 'overview') {
        const [s, log] = await Promise.all([fetchAdminStats(), fetchAuditLog()]);
        setStats(s);
        setAuditLog(log);
      } else if (activeTab === 'suggestions') {
        setSuggestions(await fetchSuggestions());
      } else if (activeTab === 'users') {
        setUsersList(await fetchUsers());
      } else if (activeTab === 'messages') {
        setContactMessages(await fetchContactMessages());
      } else if (activeTab === 'reviews') {
        setReviews(await fetchAdminReviews());
      } else if (activeTab === 'log') {
        setAuditLog(await fetchAuditLog());
      }
    } catch (err: any) {
      setActionError(err.message || 'Грешка при зареждане на данните.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isAdmin) {
      void loadData();
    }
  }, [isAdmin, loadData]);

  useEffect(() => {
    if (isAdmin) refreshStats();
  }, [isAdmin, refreshStats]);

  const flash = (message: string) => {
    setActionMessage(message);
    setTimeout(() => setActionMessage(null), 3500);
  };

  /** Runs an admin mutation with shared busy/error/success handling. */
  const runAction = async (
    id: string,
    action: () => Promise<void | string>,
    fallbackError: string
  ) => {
    setActionError(null);
    setBusyId(id);
    try {
      const msg = await action();
      if (msg) flash(msg);
      refreshStats();
    } catch (err: any) {
      setActionError(err.message || fallbackError);
    } finally {
      setBusyId(null);
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

  const handleUpdateStatus = (s: CommunitySuggestion, status: 'approved' | 'rejected' | 'pending') =>
    runAction(
      s.id,
      async () => {
        await updateSuggestionStatus(s.id, status);
        setSuggestions(await fetchSuggestions());
        onRefreshPlaces();
        return status === 'approved'
          ? `„${s.name}“ беше одобрено и добавено в каталога.`
          : status === 'rejected'
          ? `„${s.name}“ беше отхвърлено.`
          : `„${s.name}“ е върнато за преглед.`;
      },
      'Грешка при обновяване на статуса.'
    );

  const handleDeleteSuggestion = (s: CommunitySuggestion) =>
    runAction(
      s.id,
      async () => {
        const res = await deleteSuggestion(s.id);
        setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
        setConfirmDeleteId(null);
        return res.message;
      },
      'Грешка при изтриване на предложението.'
    );

  const handleConfirmDeletePlace = (place: Place) =>
    runAction(
      place.id,
      async () => {
        await deletePlace(place.id);
        setConfirmDeleteId(null);
        onRefreshPlaces();
        return `Обектът „${place.name}“ беше изтрит успешно.`;
      },
      'Грешка при изтриване на обекта.'
    );

  const handleToggleFeatured = (place: Place) =>
    runAction(
      place.id,
      async () => {
        await setPlaceFeatured(place.id, !place.isFeatured);
        onRefreshPlaces();
        return place.isFeatured
          ? `„${place.name}“ вече не е препоръчан.`
          : `„${place.name}“ е маркиран като препоръчан.`;
      },
      'Грешка при обновяване на обекта.'
    );

  const handleDeleteReview = (review: AdminReview) =>
    runAction(
      review.id,
      async () => {
        const res = await deleteReview(review.id);
        setReviews((prev) => prev.filter((r) => r.id !== review.id));
        setConfirmDeleteId(null);
        onRefreshPlaces();
        return res.message;
      },
      'Грешка при изтриване на отзива.'
    );

  const handleToggleRead = (msg: ContactMessage) =>
    runAction(
      msg.id,
      async () => {
        const updated = await setContactMessageRead(msg.id, !msg.isRead);
        setContactMessages((prev) => prev.map((m) => (m.id === msg.id ? updated : m)));
      },
      'Грешка при обновяване на запитването.'
    );

  const handleDeleteMessage = (msg: ContactMessage) =>
    runAction(
      msg.id,
      async () => {
        const res = await deleteContactMessage(msg.id);
        setContactMessages((prev) => prev.filter((m) => m.id !== msg.id));
        setConfirmDeleteId(null);
        return res.message;
      },
      'Грешка при изтриване на запитването.'
    );

  const handleToggleUserStatus = (targetUser: User) =>
    runAction(
      targetUser.id,
      async () => {
        const nextStatus = targetUser.status === 'blocked' ? 'active' : 'blocked';
        const res = await updateUserStatus(targetUser.id, nextStatus);
        setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? res.user : u)));
        return res.message;
      },
      'Грешка при промяна на статуса на потребителя.'
    );

  const handleConfirmDeleteUser = () => {
    const target = confirmDeleteUser;
    if (!target) return;
    return runAction(
      target.id,
      async () => {
        const res = await deleteUserAccount(target.id);
        setUsersList((prev) => prev.filter((u) => u.id !== target.id));
        setConfirmDeleteUser(null);
        return res.message || 'Потребителят беше изтрит успешно.';
      },
      'Грешка при изтриване на потребителя.'
    );
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
                ? 'Задайте първоначална администраторска парола, за да активирате управлението на обектите, предложенията и потребителите.'
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
                <div className="relative">
                  <input
                    type={showClaimPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={claimPassword}
                    onChange={(e) => setClaimPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-3 pr-10 py-2 text-xs bg-white/80 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClaimPassword((prev) => !prev)}
                    aria-label={showClaimPassword ? 'Скрий паролата' : 'Покажи паролата'}
                    title={showClaimPassword ? 'Скрий паролата' : 'Покажи паролата'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-500 hover:text-stone-900 rounded-md transition-colors cursor-pointer"
                  >
                    {showClaimPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Потвърдете паролата
                </label>
                <div className="relative">
                  <input
                    type={showClaimPasswordConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={claimPasswordConfirm}
                    onChange={(e) => setClaimPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-3 pr-10 py-2 text-xs bg-white/80 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClaimPasswordConfirm((prev) => !prev)}
                    aria-label={showClaimPasswordConfirm ? 'Скрий паролата' : 'Покажи паролата'}
                    title={showClaimPasswordConfirm ? 'Скрий паролата' : 'Покажи паролата'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-500 hover:text-stone-900 rounded-md transition-colors cursor-pointer"
                  >
                    {showClaimPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
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

  const categories = Array.from(new Map(places.map((p) => [p.categoryId, p.categoryName])).entries());
  const normalizedPlaceSearch = placeSearch.trim().toLowerCase();
  const filteredPlaces = places.filter((p) => {
    if (placeCategory === 'featured' && !p.isFeatured) return false;
    if (placeCategory !== 'all' && placeCategory !== 'featured' && p.categoryId !== placeCategory)
      return false;
    if (!normalizedPlaceSearch) return true;
    return (
      p.name.toLowerCase().includes(normalizedPlaceSearch) ||
      p.regionName.toLowerCase().includes(normalizedPlaceSearch) ||
      p.categoryName.toLowerCase().includes(normalizedPlaceSearch)
    );
  });

  const filteredSuggestions = suggestions.filter(
    (s) => suggestionFilter === 'all' || s.status === suggestionFilter
  );
  const suggestionCounts = {
    all: suggestions.length,
    pending: suggestions.filter((s) => s.status === 'pending').length,
    approved: suggestions.filter((s) => s.status === 'approved').length,
    rejected: suggestions.filter((s) => s.status === 'rejected').length,
  };

  const normalizedReviewSearch = reviewSearch.trim().toLowerCase();
  const filteredReviews = reviews.filter(
    (r) =>
      !normalizedReviewSearch ||
      r.author.toLowerCase().includes(normalizedReviewSearch) ||
      r.placeName.toLowerCase().includes(normalizedReviewSearch) ||
      r.comment.toLowerCase().includes(normalizedReviewSearch)
  );

  const pendingCount = stats?.totals.pendingSuggestions ?? 0;
  const unreadCount = stats?.totals.unreadMessages ?? 0;

  const tabs: { id: AdminTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'overview', label: 'Табло', icon: LayoutDashboard },
    { id: 'suggestions', label: 'Предложения', icon: Lightbulb, badge: pendingCount },
    { id: 'places', label: `Обекти (${places.length})`, icon: MapPin },
    { id: 'reviews', label: 'Отзиви', icon: MessageSquare },
    { id: 'users', label: 'Потребители', icon: Users },
    { id: 'messages', label: 'Запитвания', icon: Mail, badge: unreadCount },
    { id: 'log', label: 'Дневник', icon: History },
  ];

  const smallBtn =
    'min-h-9 px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const iconBtn =
    'w-9 h-9 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 shrink-0';

  const renderConfirm = (id: string, onConfirm: () => void, label = 'Изтрий') => (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={busyId === id}
        onClick={onConfirm}
        className={`${smallBtn} bg-red-700 hover:bg-red-800 text-white border-red-700`}
      >
        {busyId === id ? 'Изтриване...' : label}
      </button>
      <button
        type="button"
        onClick={() => setConfirmDeleteId(null)}
        className={`${smallBtn} bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200`}
      >
        Отказ
      </button>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/65 flex items-stretch sm:items-center justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Административен център"
    >
      <div className="bg-white w-full max-w-6xl sm:rounded-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto sm:max-h-[92vh] overflow-hidden border border-stone-200">
        {/* Admin Header */}
        <div className="px-4 py-3 sm:p-5 border-b border-stone-200 bg-[#FBF9F5] flex items-center justify-between gap-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl hidden sm:flex items-center justify-center bg-stone-900 text-amber-300 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-editorial text-lg sm:text-xl font-bold text-stone-950 truncate">
                Административен център
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-600 truncate">{currentUser?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onAddNewPlace()}
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg btn-liquid-amber text-white text-xs font-bold cursor-pointer"
              aria-label="Нов обект"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Нов обект</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void loadData();
                refreshStats();
              }}
              className={`${iconBtn} bg-stone-100 hover:bg-stone-200 text-stone-700`}
              title="Презареди данните"
              aria-label="Презареди данните"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`${iconBtn} bg-stone-100 hover:bg-stone-200 text-stone-700`}
              aria-label="Затвори"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation (horizontally scrollable on phones) */}
        <nav
          className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 border-b border-stone-200 bg-[#F4EFE6] text-xs font-semibold overflow-x-auto scrollbar-none shrink-0"
          aria-label="Секции на админ панела"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setConfirmDeleteId(null);
                }}
                aria-current={active ? 'page' : undefined}
                className={`py-3 px-2.5 border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                  active
                    ? 'border-amber-800 text-amber-950 font-bold'
                    : 'border-transparent text-stone-600 hover:text-stone-900'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span>{tab.label}</span>
                {!!tab.badge && (
                  <span className="px-1.5 py-0.5 bg-amber-800 text-white text-[10px] rounded tabular-nums">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Action notification & error banners */}
        {(actionMessage || actionError) && (
          <div className="px-3 sm:px-6 pt-3 space-y-2 shrink-0">
            {actionMessage && (
              <div
                role="status"
                className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{actionMessage}</span>
              </div>
            )}
            {actionError && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{actionError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionError(null)}
                  className="text-red-700 hover:text-red-950 cursor-pointer p-1"
                  aria-label="Скрий грешката"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* TAB: Overview dashboard */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {!stats ? (
                <EmptyState>{isLoading ? 'Зареждане...' : 'Няма заредена статистика.'}</EmptyState>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                    <StatTile
                      label="Обекти"
                      value={stats.totals.places}
                      hint={`${stats.totals.featuredPlaces} препоръчани`}
                      onClick={() => setActiveTab('places')}
                    />
                    <StatTile
                      label="Чакащи предложения"
                      value={stats.totals.pendingSuggestions}
                      hint={`${stats.totals.suggestions} общо`}
                      tone="text-amber-800"
                      onClick={() => {
                        setSuggestionFilter('pending');
                        setActiveTab('suggestions');
                      }}
                    />
                    <StatTile
                      label="Потребители"
                      value={stats.totals.users}
                      hint={`+${stats.registrationsLast30Days} за 30 дни`}
                      onClick={() => setActiveTab('users')}
                    />
                    <StatTile
                      label="Блокирани"
                      value={stats.totals.blockedUsers}
                      tone="text-rose-700"
                      onClick={() => setActiveTab('users')}
                    />
                    <StatTile
                      label="Отзиви"
                      value={stats.totals.reviews}
                      hint={
                        stats.totals.averageRating !== null
                          ? `Ср. оценка ${stats.totals.averageRating.toFixed(1)} ★`
                          : undefined
                      }
                      tone="text-emerald-800"
                      onClick={() => setActiveTab('reviews')}
                    />
                    <StatTile
                      label="Непрочетени запитвания"
                      value={stats.totals.unreadMessages}
                      hint={`${stats.totals.messages} общо`}
                      tone="text-blue-800"
                      onClick={() => setActiveTab('messages')}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <BarList title="Обекти по категория" items={stats.placesByCategory} />
                    <BarList title="Обекти по регион" items={stats.placesByRegion} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-amber-600" />
                        <span>Най-високо оценени</span>
                      </div>
                      {stats.topRatedPlaces.length === 0 ? (
                        <div className="text-xs text-stone-500">Все още няма отзиви.</div>
                      ) : (
                        <ol className="space-y-1.5 text-xs">
                          {stats.topRatedPlaces.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-2">
                              <span className="truncate text-stone-800">{p.name}</span>
                              <span className="tabular-nums text-stone-600 shrink-0">
                                {p.rating.toFixed(1)} ★ · {p.reviewCount}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-rose-600" />
                        <span>Най-често в любими</span>
                      </div>
                      {stats.mostFavoritedPlaces.length === 0 ? (
                        <div className="text-xs text-stone-500">Все още няма запазени любими.</div>
                      ) : (
                        <ol className="space-y-1.5 text-xs">
                          {stats.mostFavoritedPlaces.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-2">
                              <span className="truncate text-stone-800">{p.name}</span>
                              <span className="tabular-nums text-stone-600 shrink-0">{p.count}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-stone-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-stone-600" />
                        <span>Последни действия</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('log')}
                        className="text-xs font-semibold text-amber-900 hover:underline cursor-pointer"
                      >
                        Виж всички
                      </button>
                    </div>
                    {auditLog.length === 0 ? (
                      <div className="text-xs text-stone-500">Все още няма записани действия.</div>
                    ) : (
                      <ul className="divide-y divide-stone-100">
                        {auditLog.slice(0, 6).map((entry) => (
                          <AuditRow key={entry.id} entry={entry} />
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: Suggestions */}
          {activeTab === 'suggestions' && (
            <div className="space-y-4">
              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
                {(
                  [
                    ['pending', 'Чакащи'],
                    ['approved', 'Одобрени'],
                    ['rejected', 'Отхвърлени'],
                    ['all', 'Всички'],
                  ] as [SuggestionFilter, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSuggestionFilter(id)}
                    className={`${smallBtn} whitespace-nowrap ${
                      suggestionFilter === id
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    {label} <span className="tabular-nums opacity-75">({suggestionCounts[id]})</span>
                  </button>
                ))}
              </div>

              {filteredSuggestions.length === 0 ? (
                <EmptyState>Няма предложения в тази категория.</EmptyState>
              ) : (
                filteredSuggestions.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 sm:p-5 bg-white rounded-xl border border-stone-200 space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
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
                            {formatDate(s.createdAt)}
                          </span>
                        </div>
                        <h4 className="font-editorial text-lg font-bold text-stone-950 mt-1 break-words">
                          {s.name}
                        </h4>
                        <div className="text-xs text-stone-600 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-amber-800" />
                            <span>{s.region}</span>
                          </span>
                          <span>·</span>
                          <span>{s.category}</span>
                          <span>·</span>
                          <a
                            href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono tabular-nums text-amber-900 hover:underline"
                          >
                            {s.latitude.toFixed(4)}°N, {s.longitude.toFixed(4)}°E
                          </a>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {confirmDeleteId === s.id ? (
                          renderConfirm(s.id, () => handleDeleteSuggestion(s))
                        ) : (
                          <>
                            {s.status !== 'approved' && (
                              <button
                                type="button"
                                disabled={busyId === s.id}
                                onClick={() => handleUpdateStatus(s, 'approved')}
                                className={`${smallBtn} bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-700`}
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Одобри</span>
                              </button>
                            )}
                            {s.status !== 'rejected' && (
                              <button
                                type="button"
                                disabled={busyId === s.id}
                                onClick={() => handleUpdateStatus(s, 'rejected')}
                                className={`${smallBtn} bg-white hover:bg-red-50 text-red-700 border-red-200`}
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Отхвърли</span>
                              </button>
                            )}
                            {s.status !== 'pending' && (
                              <button
                                type="button"
                                disabled={busyId === s.id}
                                onClick={() => handleUpdateStatus(s, 'pending')}
                                className={`${smallBtn} bg-white hover:bg-stone-50 text-stone-700 border-stone-300`}
                                title="Върни за преглед"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>За преглед</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(s.id)}
                              className={`${iconBtn} text-stone-400 hover:text-red-700 hover:bg-red-50`}
                              title="Изтрий предложението"
                              aria-label={`Изтрий ${s.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {s.imageUrl && (
                      <img
                        src={s.imageUrl}
                        alt={s.name}
                        loading="lazy"
                        className="w-full max-h-56 object-cover rounded-lg border border-stone-200"
                        referrerPolicy="no-referrer"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                      />
                    )}

                    <p className="text-xs sm:text-sm text-stone-700 leading-relaxed bg-[#FBF9F5] p-3 rounded-lg border border-stone-200 break-words">
                      {s.description}
                    </p>

                    <div className="text-[11px] text-stone-500 flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-4 pt-1">
                      <span className="break-words">
                        <strong>Източник:</strong> {s.source}
                      </span>
                      {s.contact && (
                        <a href={`mailto:${s.contact}`} className="hover:underline break-all">
                          <strong>Контакт:</strong> {s.contact}
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: Places Management */}
          {activeTab === 'places' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <SearchInput
                    value={placeSearch}
                    onChange={setPlaceSearch}
                    placeholder="Търси обект..."
                  />
                  <select
                    value={placeCategory}
                    onChange={(e) => setPlaceCategory(e.target.value)}
                    className="w-full sm:w-52 px-3 py-2.5 text-sm sm:text-xs bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                    aria-label="Филтър по категория"
                  >
                    <option value="all">Всички категории</option>
                    <option value="featured">★ Само препоръчани</option>
                    {categories.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-stone-500 tabular-nums">
                  Показани: <strong className="text-stone-800">{filteredPlaces.length}</strong> от{' '}
                  {places.length}
                </div>
              </div>

              <div className="divide-y divide-stone-200 bg-white rounded-xl border border-stone-200 overflow-hidden">
                {filteredPlaces.length === 0 && <EmptyState>Няма намерени обекти.</EmptyState>}
                {filteredPlaces.map((place) => (
                  <div
                    key={place.id}
                    className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FBF9F5] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={place.imageUrl}
                        alt={place.name}
                        loading="lazy"
                        decoding="async"
                        className="w-14 h-14 sm:w-12 sm:h-12 rounded-lg object-cover bg-stone-200 shrink-0"
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageError(e, place.categoryId, place.name)}
                      />
                      <div className="min-w-0">
                        <div className="font-editorial text-base font-bold text-stone-950 flex items-center gap-1.5">
                          <span className="truncate">{place.name}</span>
                          {place.isFeatured && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 flex flex-wrap items-center gap-x-2">
                          <span>{place.categoryName}</span>
                          <span>·</span>
                          <span className="truncate">{place.regionName.split('(')[0]}</span>
                          <span>·</span>
                          <span>{place.difficulty}</span>
                          {!!place.reviewCount && (
                            <>
                              <span>·</span>
                              <span className="tabular-nums">
                                {place.rating?.toFixed(1)} ★ ({place.reviewCount})
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      {confirmDeleteId === place.id ? (
                        renderConfirm(place.id, () => handleConfirmDeletePlace(place))
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={busyId === place.id}
                            onClick={() => handleToggleFeatured(place)}
                            className={`${iconBtn} ${
                              place.isFeatured
                                ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                : 'text-stone-400 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                            title={place.isFeatured ? 'Премахни от препоръчани' : 'Маркирай като препоръчан'}
                            aria-label={place.isFeatured ? 'Премахни от препоръчани' : 'Маркирай като препоръчан'}
                            aria-pressed={!!place.isFeatured}
                          >
                            <Star className={`w-4 h-4 ${place.isFeatured ? 'fill-amber-400' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditPlace(place)}
                            className={`${smallBtn} bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200`}
                            title="Редактирай"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Редактирай</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(place.id)}
                            className={`${iconBtn} text-stone-400 hover:text-red-700 hover:bg-red-50`}
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

          {/* TAB: Reviews moderation */}
          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <SearchInput
                  value={reviewSearch}
                  onChange={setReviewSearch}
                  placeholder="Търси по автор, обект или текст..."
                />
                <div className="text-xs text-stone-500 tabular-nums">
                  Показани: <strong className="text-stone-800">{filteredReviews.length}</strong> от{' '}
                  {reviews.length}
                </div>
              </div>
              {filteredReviews.length === 0 ? (
                <EmptyState>Няма отзиви.</EmptyState>
              ) : (
                <div className="space-y-3">
                  {filteredReviews.map((r) => (
                    <div key={r.id} className="p-4 bg-white rounded-xl border border-stone-200 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-stone-950 break-words">{r.placeName}</div>
                          <div className="text-xs text-stone-600 flex flex-wrap items-center gap-x-2">
                            <span className="font-medium text-stone-800">{r.author}</span>
                            <span>·</span>
                            <span className="text-amber-600 tracking-tight" aria-label={`${r.rating} от 5`}>
                              {'★'.repeat(r.rating)}
                              <span className="text-stone-300">{'★'.repeat(5 - r.rating)}</span>
                            </span>
                            <span>·</span>
                            <span>{r.visitSeason}</span>
                            <span>·</span>
                            <span className="tabular-nums">{formatDate(r.createdAt)}</span>
                          </div>
                        </div>
                        <div className="shrink-0 self-end sm:self-auto">
                          {confirmDeleteId === r.id ? (
                            renderConfirm(r.id, () => handleDeleteReview(r))
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(r.id)}
                              className={`${smallBtn} bg-white hover:bg-red-50 text-red-700 border-red-200`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Изтрий</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-stone-700 leading-relaxed bg-[#FBF9F5] p-3 rounded-lg border border-stone-200 break-words">
                        {r.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Users & Roles */}
          {activeTab === 'users' && (() => {
            const normalizedSearch = userSearch.trim().toLowerCase();
            const sortedUsers = [...usersList].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const filteredUsers = sortedUsers.filter((u) => {
              if (!normalizedSearch) return true;
              return (
                u.name.toLowerCase().includes(normalizedSearch) ||
                u.email.toLowerCase().includes(normalizedSearch)
              );
            });
            const totalUsers = usersList.length;
            const activeUsersCount = usersList.filter((u) => u.status !== 'blocked').length;
            const blockedUsersCount = usersList.filter((u) => u.status === 'blocked').length;
            const adminUsersCount = usersList.filter((u) => u.role === 'admin').length;

            const renderActions = (user: User) => {
              const isProtected = user.role === 'admin' || user.id === currentUser?.id;
              const isBlocked = user.status === 'blocked';
              const isBusy = busyId === user.id;
              if (isProtected) {
                return <span className="text-[11px] text-stone-400 italic">Защитен акаунт</span>;
              }
              return (
                <div className="inline-flex items-center justify-end gap-1.5">
                  <a
                    href={`mailto:${user.email}`}
                    className={`${iconBtn} text-stone-500 hover:text-stone-900 hover:bg-stone-100`}
                    title="Изпрати имейл"
                    aria-label={`Изпрати имейл на ${user.name}`}
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleToggleUserStatus(user)}
                    className={`${smallBtn} ${
                      isBlocked
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                    }`}
                    title={isBlocked ? 'Отблокирай потребителя' : 'Блокирай потребителя'}
                  >
                    {isBlocked ? <UserCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                    <span>{isBlocked ? 'Отблокирай' : 'Блокирай'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setConfirmDeleteUser(user)}
                    className={`${iconBtn} text-stone-400 hover:text-red-700 hover:bg-red-50`}
                    title="Изтрий потребител"
                    aria-label={`Изтрий ${user.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            };

            const roleBadge = (user: User) =>
              user.role === 'admin' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300">
                  <ShieldCheck className="w-3 h-3 text-amber-800" />
                  <span>Администратор</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
                  <UserIcon className="w-3 h-3 text-stone-600" />
                  <span>Потребител</span>
                </span>
              );

            const statusBadge = (user: User) =>
              user.status === 'blocked' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-200">
                  <Ban className="w-3 h-3 text-rose-700" />
                  <span>Блокиран</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                  <UserCheck className="w-3 h-3 text-emerald-700" />
                  <span>Активен</span>
                </span>
              );

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  <StatTile label="Общо регистрации" value={totalUsers} />
                  <StatTile label="Активни акаунти" value={activeUsersCount} tone="text-emerald-800" />
                  <StatTile label="Блокирани" value={blockedUsersCount} tone="text-rose-700" />
                  <StatTile label="Администратори" value={adminUsersCount} tone="text-amber-800" />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                  <SearchInput
                    value={userSearch}
                    onChange={setUserSearch}
                    placeholder="Търси по име или имейл..."
                  />
                  <div className="text-xs text-stone-500 tabular-nums">
                    Показани: <strong className="text-stone-800">{filteredUsers.length}</strong> от {totalUsers}
                  </div>
                </div>

                {filteredUsers.length === 0 ? (
                  <EmptyState>Няма намерени потребители по зададеното търсене.</EmptyState>
                ) : (
                  <>
                    {/* Phones: cards */}
                    <ul className="md:hidden space-y-2">
                      {filteredUsers.map((user) => (
                        <li key={user.id} className="p-3 bg-white rounded-xl border border-stone-200 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-stone-900 truncate">{user.name}</div>
                              <div className="text-[11px] text-stone-600 font-mono break-all">{user.email}</div>
                            </div>
                            <span className="text-[11px] text-stone-500 tabular-nums shrink-0">
                              {formatDate(user.createdAt)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1.5">
                              {roleBadge(user)}
                              {statusBadge(user)}
                            </div>
                            {renderActions(user)}
                          </div>
                        </li>
                      ))}
                    </ul>

                    {/* Tablets & desktop: table */}
                    <div className="hidden md:block bg-white rounded-xl border border-stone-200 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F4EFE6] border-b border-stone-200 text-stone-700 font-semibold">
                          <tr>
                            <th className="p-3 lg:p-4">Потребител</th>
                            <th className="p-3 lg:p-4">Имейл</th>
                            <th className="p-3 lg:p-4">Роля</th>
                            <th className="p-3 lg:p-4">Статус</th>
                            <th className="p-3 lg:p-4">Регистрация</th>
                            <th className="p-3 lg:p-4 text-right">Действия</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                          {filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-stone-50">
                              <td className="p-3 lg:p-4 font-semibold text-stone-900">{user.name}</td>
                              <td className="p-3 lg:p-4 text-stone-600 font-mono text-[11px] break-all">
                                {user.email}
                              </td>
                              <td className="p-3 lg:p-4">{roleBadge(user)}</td>
                              <td className="p-3 lg:p-4">{statusBadge(user)}</td>
                              <td className="p-3 lg:p-4 text-stone-500 text-[11px] tabular-nums">
                                {formatDate(user.createdAt)}
                              </td>
                              <td className="p-3 lg:p-4 text-right">{renderActions(user)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* TAB: Contact Messages */}
          {activeTab === 'messages' && (
            <div className="space-y-3">
              {contactMessages.length === 0 ? (
                <EmptyState>Все още няма получени запитвания през формата за контакти.</EmptyState>
              ) : (
                contactMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-4 sm:p-5 rounded-xl border space-y-2 ${
                      msg.isRead ? 'bg-white border-stone-200' : 'bg-blue-50/40 border-blue-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-editorial text-lg font-bold text-stone-950 flex items-center gap-2 break-words">
                          {!msg.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" aria-label="Непрочетено" />
                          )}
                          <span>{msg.subject}</span>
                        </h4>
                        <div className="text-xs text-stone-600 flex flex-wrap items-center gap-x-2">
                          <span className="font-semibold text-stone-900">{msg.name}</span>
                          <span>·</span>
                          <span className="font-mono text-[11px] break-all">{msg.email}</span>
                          <span>·</span>
                          <span className="tabular-nums">{formatDateTime(msg.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        {confirmDeleteId === msg.id ? (
                          renderConfirm(msg.id, () => handleDeleteMessage(msg))
                        ) : (
                          <>
                            <a
                              href={`mailto:${msg.email}?subject=${encodeURIComponent('Re: ' + msg.subject)}`}
                              className={`${smallBtn} bg-stone-900 hover:bg-stone-800 text-white border-stone-900`}
                              onClick={() => {
                                if (!msg.isRead) void handleToggleRead(msg);
                              }}
                            >
                              <Reply className="w-3.5 h-3.5" />
                              <span>Отговори</span>
                            </a>
                            <button
                              type="button"
                              disabled={busyId === msg.id}
                              onClick={() => handleToggleRead(msg)}
                              className={`${iconBtn} text-stone-500 hover:text-stone-900 hover:bg-stone-100`}
                              title={msg.isRead ? 'Маркирай като непрочетено' : 'Маркирай като прочетено'}
                              aria-label={msg.isRead ? 'Маркирай като непрочетено' : 'Маркирай като прочетено'}
                            >
                              {msg.isRead ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(msg.id)}
                              className={`${iconBtn} text-stone-400 hover:text-red-700 hover:bg-red-50`}
                              title="Изтрий запитването"
                              aria-label="Изтрий запитването"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-stone-700 leading-relaxed bg-[#FBF9F5] p-3 rounded-lg border border-stone-200 whitespace-pre-line break-words">
                      {msg.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: Audit log */}
          {activeTab === 'log' && (
            <div className="bg-white rounded-xl border border-stone-200 p-3 sm:p-4">
              {auditLog.length === 0 ? (
                <EmptyState>Все още няма записани административни действия.</EmptyState>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {auditLog.map((entry) => (
                    <AuditRow key={entry.id} entry={entry} showAdmin />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* In-App Confirm Delete User Modal */}
      {confirmDeleteUser && (
        <div
          className="fixed inset-0 z-[60] bg-stone-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Потвърждение за изтриване на потребител"
        >
          <div className="bg-white w-full max-w-md rounded-2xl border border-stone-200 shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="font-editorial text-lg font-bold text-stone-950">
                  Изтриване на потребителски профил
                </h4>
                <p className="text-xs text-stone-600 leading-relaxed break-words">
                  Сигурни ли сте, че искате да изтриете профила на{' '}
                  <strong className="text-stone-900">{confirmDeleteUser.name}</strong> (
                  <span className="font-mono">{confirmDeleteUser.email}</span>)? Всички запазени любими обекти, лични маршрути и история ще бъдат премахнати безвъзвратно.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busyId === confirmDeleteUser.id}
                onClick={() => setConfirmDeleteUser(null)}
                className="px-4 py-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm sm:text-xs font-semibold cursor-pointer"
              >
                Отказ
              </button>
              <button
                type="button"
                disabled={busyId === confirmDeleteUser.id}
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm sm:text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {busyId === confirmDeleteUser.id ? 'Изтриване...' : 'Потвърди изтриването'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AuditRow: React.FC<{ entry: AuditLogEntry; showAdmin?: boolean }> = ({ entry, showAdmin }) => (
  <li className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-3 text-xs">
    <div className="min-w-0">
      <span className="font-semibold text-stone-900">
        {AUDIT_ACTION_LABELS[entry.action] || entry.action}
      </span>
      <span className="text-stone-600"> — {entry.details}</span>
    </div>
    <div className="text-[11px] text-stone-500 tabular-nums shrink-0">
      {formatDateTime(entry.createdAt)}
      {showAdmin && <span className="hidden sm:inline"> · {entry.adminEmail}</span>}
    </div>
  </li>
);
