import React, { useState, useEffect } from 'react';
import { User, AdminStatus } from '../types';
import {
  loginUser,
  registerUser,
  fetchAdminStatus,
  claimAdminAccount,
} from '../services/api';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  LogIn,
  UserPlus,
  Shield,
  Check,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  initialTab?: 'login' | 'register';
  promptMessage?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'login',
  promptMessage = null,
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'claim'>('login');
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');

  // First-run admin claim form
  const [claimName, setClaimName] = useState('Администратор');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimPasswordConfirm, setClaimPasswordConfirm] = useState('');

  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegPasswordConfirm, setShowRegPasswordConfirm] = useState(false);
  const [showClaimPassword, setShowClaimPassword] = useState(false);
  const [showClaimPasswordConfirm, setShowClaimPasswordConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setErrorMessage(null);
      setSuccessMessage(null);
      setShowLoginPassword(false);
      setShowRegPassword(false);
      setShowRegPasswordConfirm(false);
      setShowClaimPassword(false);
      setShowClaimPasswordConfirm(false);
      fetchAdminStatus()
        .then((status) => {
          setAdminStatus(status);
          if (status.adminEmail) {
            setClaimEmail(status.adminEmail);
          }
        })
        .catch(() => {
          setAdminStatus(null);
        });
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const validateStrongPassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Паролата трябва да е с дължина минимум 8 символа.';
    }
    if (!/[A-Za-zА-Яа-я]/.test(pwd) || !/\d/.test(pwd)) {
      return 'Паролата трябва да съдържа поне една буква и една цифра.';
    }
    return null;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await loginUser(loginEmail, loginPassword);
      setSuccessMessage(`Добре дошли отново, ${res.user.name}!`);
      setTimeout(() => {
        onSuccess(res.user);
        onClose();
      }, 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Неуспешен вход. Проверете имейла и паролата.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (regPassword !== regPasswordConfirm) {
      setErrorMessage('Паролите не съвпадат.');
      return;
    }

    const pwdError = validateStrongPassword(regPassword);
    if (pwdError) {
      setErrorMessage(pwdError);
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerUser(regName, regEmail, regPassword);
      setSuccessMessage(`Профилът беше създаден успешно! Добре дошли, ${res.user.name}!`);
      setTimeout(() => {
        onSuccess(res.user);
        onClose();
      }, 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Възникна грешка при регистрацията.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (claimPassword !== claimPasswordConfirm) {
      setErrorMessage('Паролите не съвпадат.');
      return;
    }

    const pwdError = validateStrongPassword(claimPassword);
    if (pwdError) {
      setErrorMessage(pwdError);
      return;
    }

    setIsLoading(true);
    try {
      const res = await claimAdminAccount(claimEmail, claimPassword, claimName);
      setSuccessMessage('Администраторският достъп е активиран успешно.');
      setTimeout(() => {
        onSuccess(res.user);
        onClose();
      }, 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Грешка при активиране на администраторския акаунт.');
    } finally {
      setIsLoading(false);
    }
  };

  const showAdminClaimOption = Boolean(adminStatus && !adminStatus.adminClaimed && !adminStatus.envConfigured);

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="liquid-water-card w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/70">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200/60 bg-white/40 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-800 to-stone-900 text-amber-200 shadow-inner">
              {tab === 'claim' ? <Shield className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-editorial text-xl font-bold text-stone-900">
                {tab === 'login'
                  ? 'Вход в профила'
                  : tab === 'register'
                  ? 'Нова регистрация'
                  : 'Активиране на администратор'}
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                {tab === 'login'
                  ? 'Достъп до любими обекти и редакция'
                  : tab === 'register'
                  ? 'Създайте свой личен акаунт'
                  : 'Еднократна настройка на главния администратор'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="liquid-orb-btn w-9 h-9 rounded-full flex items-center justify-center text-stone-700 hover:text-stone-950 cursor-pointer shadow-xs"
            aria-label="Затвори"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-2.5 bg-stone-100/50 border-b border-stone-200/50">
          <div className="liquid-glass-focus-pill rounded-full p-1 grid grid-cols-2 gap-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setErrorMessage(null);
              }}
              className={`py-1.5 rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'login'
                  ? 'bg-gradient-to-r from-stone-900 to-stone-800 text-amber-200 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Вход</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setErrorMessage(null);
              }}
              className={`py-1.5 rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                tab === 'register'
                  ? 'bg-gradient-to-r from-stone-900 to-stone-800 text-amber-200 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Регистрация</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-6 space-y-4">
          {promptMessage && !successMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-950 text-xs rounded-xl flex items-start gap-2 leading-relaxed">
              <Lock className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
              <span>{promptMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Имейл адрес
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@example.bg"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Парола
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    aria-label={showLoginPassword ? 'Скрий паролата' : 'Покажи паролата'}
                    title={showLoginPassword ? 'Скрий паролата' : 'Покажи паролата'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-500 hover:text-stone-900 rounded-md transition-colors cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {showAdminClaimOption && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-[11px] text-amber-950">
                  <div className="flex items-center gap-2 font-medium">
                    <Shield className="w-4 h-4 text-amber-800 shrink-0" />
                    <span>Първоначална настройка на администратор:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('claim');
                      setErrorMessage(null);
                    }}
                    className="font-bold underline text-amber-900 hover:text-amber-950 shrink-0 cursor-pointer"
                  >
                    Задай парола
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 text-xs sm:text-sm font-bold text-white btn-liquid-amber water-shimmer rounded-full transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'Проверка...' : 'Влез в профила'}</span>
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Име и фамилия <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Иван Петров"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Имейл адрес <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="ivan@example.bg"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Парола (мин. 8 символа, букви и цифри) <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((prev) => !prev)}
                    aria-label={showRegPassword ? 'Скрий паролата' : 'Покажи паролата'}
                    title={showRegPassword ? 'Скрий паролата' : 'Покажи паролата'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-500 hover:text-stone-900 rounded-md transition-colors cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Потвърди паролата <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showRegPasswordConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={regPasswordConfirm}
                    onChange={(e) => setRegPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPasswordConfirm((prev) => !prev)}
                    aria-label={showRegPasswordConfirm ? 'Скрий паролата' : 'Покажи паролата'}
                    title={showRegPasswordConfirm ? 'Скрий паролата' : 'Покажи паролата'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-stone-500 hover:text-stone-900 rounded-md transition-colors cursor-pointer"
                  >
                    {showRegPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-stone-500">
                Новите профили се регистрират с роля <strong>Потребител</strong>.
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 text-xs sm:text-sm font-bold text-white btn-liquid-amber water-shimmer rounded-full transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isLoading ? 'Регистриране...' : 'Създай акаунт'}</span>
              </button>
            </form>
          )}

          {tab === 'claim' && showAdminClaimOption && (
            <form onSubmit={handleClaimSubmit} className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-950 leading-relaxed">
                Задайте силна администраторска парола (минимум 8 символа с букви и цифри). След активирането тази форма се заключва автоматично.
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Име на администратора
                </label>
                <input
                  type="text"
                  required
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Администраторски имейл
                </label>
                <input
                  type="email"
                  required
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Нова администраторска парола
                </label>
                <div className="relative">
                  <input
                    type={showClaimPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={claimPassword}
                    onChange={(e) => setClaimPassword(e.target.value)}
                    placeholder="Мин. 8 символа, букви и цифри"
                    className="w-full pl-3 pr-10 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
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
                    className="w-full pl-3 pr-10 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
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

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMessage(null);
                  }}
                  className="btn-liquid-water px-4 py-2.5 text-xs font-semibold text-stone-700 rounded-full cursor-pointer"
                >
                  Назад
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 text-xs sm:text-sm font-bold text-white btn-liquid-amber water-shimmer rounded-full disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isLoading ? 'Активиране...' : 'Активирай администратор'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
