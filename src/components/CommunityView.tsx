import React, { useState, useEffect } from 'react';
import { submitSuggestion } from '../services/api';
import { Category, Region, User } from '../types';
import { PlusCircle, ShieldCheck, CheckCircle2, AlertCircle, Lock } from 'lucide-react';

interface CommunityViewProps {
  categories: Category[];
  regions: Region[];
  onOpenAdmin: () => void;
  onExploreMap?: () => void;
  isAdmin?: boolean;
  currentUser?: User | null;
  onRequireAuth?: (
    message: string,
    action: (user: User) => void | Promise<void>,
    tab?: 'login' | 'register'
  ) => boolean;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  categories,
  regions,
  onOpenAdmin,
  onExploreMap,
  isAdmin = false,
  currentUser,
  onRequireAuth,
}) => {
  const [name, setName] = useState('');
  const [region, setRegion] = useState(regions[0]?.name || 'Южен централен (Родопи и Тракия)');
  const [category, setCategory] = useState(categories[0]?.name || 'Древни светилища');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [contact, setContact] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [queuedAutoSubmit, setQueuedAutoSubmit] = useState(false);

  useEffect(() => {
    if (regions.length > 0 && !regions.some((r) => r.name === region)) {
      setRegion(regions[0].name);
    }
  }, [regions, region]);

  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.name === category)) {
      setCategory(categories[0].name);
    }
  }, [categories, category]);

  const performSubmit = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (isNaN(latNum) || isNaN(lngNum) || latNum < 41 || latNum > 44.5 || lngNum < 22 || lngNum > 29) {
      setErrorMessage(
        'Моля, въведете географски координати на територията на България (Ширина ~41.2 до 44.3, Дължина ~22.3 до 28.6).'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await submitSuggestion({
        name,
        region,
        category,
        latitude: latNum,
        longitude: lngNum,
        description,
        source: source || 'Лично посещение на автора',
        imageUrl: imageUrl || undefined,
        contact: contact || undefined,
      });

      setSuccessMessage(res.message);
      setName('');
      setLatitude('');
      setLongitude('');
      setDescription('');
      setSource('');
      setImageUrl('');
      setContact('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Възникна грешка при изпращането на предложението.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (currentUser && queuedAutoSubmit) {
      setQueuedAutoSubmit(false);
      void performSubmit();
    }
  }, [currentUser, queuedAutoSubmit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (isNaN(latNum) || isNaN(lngNum) || latNum < 41 || latNum > 44.5 || lngNum < 22 || lngNum > 29) {
      setErrorMessage(
        'Моля, въведете географски координати на територията на България (Ширина ~41.2 до 44.3, Дължина ~22.3 до 28.6).'
      );
      return;
    }

    if (!currentUser && onRequireAuth) {
      onRequireAuth(
        'Влезте в профила си или създайте регистрация, за да изпратите предложението си за ново място.',
        () => {
          setQueuedAutoSubmit(true);
        }
      );
      return;
    }

    await performSubmit();
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Editorial Header */}
      <div className="border-b border-stone-200 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
            Общност на откривателите
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl font-bold text-stone-900 mt-1">
            Предложете скрито съкровище
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Знаете ли за древно светилище, каньон или манастир, който липсва на туристическите карти?
          </p>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="liquid-glass-focus-pill px-4 py-2 rounded-full text-xs text-stone-800 hover:text-stone-950 font-bold self-start sm:self-end shadow-xs cursor-pointer hover:scale-105 transition-all"
          >
            Административен панел →
          </button>
        ) : onExploreMap ? (
          <button
            type="button"
            onClick={onExploreMap}
            className="liquid-glass-focus-pill px-4 py-2 rounded-full text-xs text-stone-800 hover:text-stone-950 font-bold self-start sm:self-end shadow-xs cursor-pointer hover:scale-105 transition-all"
          >
            Разгледай картата →
          </button>
        ) : null}
      </div>

      {/* Verification Policy Banner */}
      <div className="bg-[#F5F1E8] border border-stone-300 rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-4">
        <ShieldCheck className="w-8 h-8 text-amber-800 shrink-0 mt-1" />
        <div className="space-y-1 text-xs sm:text-sm text-stone-700 leading-relaxed">
          <div className="font-bold text-stone-900">Принцип на проверка и надеждност</div>
          <p>
            Всяко предложено място преминава през верификация от краеведи и редактори. Ние проверяваме
            координатите, достъпа до терена и историческите източници преди публикуване в главния каталог.
            Така пазим туристите от опасни грешки и съхраняваме паметниците.
          </p>
        </div>
      </div>

      {/* Suggestion Form Card */}
      <div className="bg-[#FBF9F5] rounded-2xl border border-stone-300 p-6 sm:p-8 shadow-sm">
        {!currentUser && onRequireAuth && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-start sm:items-center gap-2.5">
              <Lock className="w-4 h-4 text-amber-800 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                За да изпратите предложение за нов обект, влезте в профила си или се регистрирайте.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onRequireAuth(
                    'Влезте в профила си, за да изпратите предложение за нов обект.',
                    () => {},
                    'login'
                  )
                }
                className="px-4 py-2.5 sm:px-3.5 sm:py-1.5 rounded-full bg-stone-900 hover:bg-stone-800 text-amber-200 font-bold text-xs cursor-pointer transition-colors"
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() =>
                  onRequireAuth(
                    'Създайте регистрация, за да предлагате нови места.',
                    () => {},
                    'register'
                  )
                }
                className="px-4 py-2.5 sm:px-3.5 sm:py-1.5 rounded-full bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs cursor-pointer transition-colors"
              >
                Регистрация
              </button>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3 text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Успешно изпратено!</span> {successMessage}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-start gap-3 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Грешка:</span> {errorMessage}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Име на обекта <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="напр. Скално светилище Купена"
                className="w-full px-4 py-2.5 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              />
            </div>

            {/* Region */}
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Регион в България <span className="text-red-600">*</span>
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Категория <span className="text-red-600">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Latitude */}
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Географска ширина (Latitude) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="напр. 41.8547"
                className="w-full px-4 py-2.5 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40 font-mono"
              />
            </div>

            {/* Longitude */}
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Географска дължина (Longitude) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="напр. 24.9669"
                className="w-full px-4 py-2.5 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40 font-mono"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Подробно описание и как се стига <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Опишете забележителността, откъде се тръгва, има ли маркировка, какъв е теренът и какво го прави специално..."
                className="w-full px-4 py-2.5 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40 leading-relaxed"
              />
            </div>

            {/* Source */}
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Източник на информацията
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="напр. Местни жители, краеведски сборник, личен преход"
                className="w-full px-4 py-2.5 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Линк към снимка (с авторски права)
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-4 py-2.5 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              />
            </div>

            {/* Contact */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-800 mb-1">
                Ваш имейл за обратна връзка при уточнения (по избор)
              </label>
              <input
                type="email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="vasheto.ime@email.bg"
                className="w-full px-4 py-2.5 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-stone-200/60 flex items-center justify-between">
            <span className="text-xs text-stone-500 font-medium">
              * Задължителните полета се проверяват и потвърждават от краеведи.
            </span>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-liquid-amber water-shimmer liquid-iridescent-rim px-8 py-3 rounded-full text-xs sm:text-sm font-bold text-stone-950 flex items-center gap-2 shadow-md cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
            >
              <PlusCircle className="w-4 h-4 text-stone-950" />
              <span>{isSubmitting ? 'Изпращане...' : 'Изпрати за преглед'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
