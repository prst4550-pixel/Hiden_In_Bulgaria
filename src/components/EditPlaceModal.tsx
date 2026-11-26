import React, { useState, useEffect } from 'react';
import { Place, Category, Region } from '../types';
import { createPlace, updatePlace, deletePlace } from '../services/api';
import { X, Save, Trash2, MapPin, AlertCircle, Shield } from 'lucide-react';

interface EditPlaceModalProps {
  place: Place | null; // null means create new
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  categories: Category[];
  regions: Region[];
}

export const EditPlaceModal: React.FC<EditPlaceModalProps> = ({
  place,
  isOpen,
  onClose,
  onSaved,
  categories,
  regions,
}) => {
  const [name, setName] = useState('');
  const [regionId, setRegionId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [altitude, setAltitude] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [history, setHistory] = useState('');
  const [accessTips, setAccessTips] = useState('');
  const [terrainType, setTerrainType] = useState('Планински');
  const [difficulty, setDifficulty] = useState<'Лесен' | 'Умерен' | 'Труден' | 'Екстремен'>('Умерен');
  const [bestSeason, setBestSeason] = useState('Пролет - Есен');
  const [imageUrl, setImageUrl] = useState('');
  const [imageCredit, setImageCredit] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (place) {
      setName(place.name);
      setRegionId(place.regionId);
      setCategoryId(place.categoryId);
      setLatitude(String(place.latitude));
      setLongitude(String(place.longitude));
      setAltitude(place.altitude ? String(place.altitude) : '');
      setShortDescription(place.shortDescription);
      setFullDescription(place.fullDescription);
      setHistory(place.history || '');
      setAccessTips(place.accessTips || '');
      setTerrainType(place.terrainType || 'Планински');
      setDifficulty(place.difficulty || 'Умерен');
      setBestSeason(place.bestSeason || 'Пролет - Есен');
      setImageUrl(place.imageUrl || '');
      setImageCredit(place.imageCredit || '');
      setIsFeatured(Boolean(place.isFeatured));
    } else {
      setName('');
      setRegionId(regions[0]?.id || 'south_central');
      setCategoryId(categories[0]?.id || 'sanctuaries');
      setLatitude('42.0');
      setLongitude('25.0');
      setAltitude('');
      setShortDescription('');
      setFullDescription('');
      setHistory('');
      setAccessTips('');
      setTerrainType('Планински');
      setDifficulty('Умерен');
      setBestSeason('Пролет - Есен');
      setImageUrl('');
      setImageCredit('Скрито в България');
      setIsFeatured(false);
    }
    setErrorMessage(null);
    setConfirmDelete(false);
  }, [place, isOpen, categories, regions]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (isNaN(latNum) || isNaN(lngNum)) {
      setErrorMessage('Моля, въведете коректни координати.');
      return;
    }

    const regObj = regions.find((r) => r.id === regionId);
    const catObj = categories.find((c) => c.id === categoryId);

    const payload: Partial<Place> = {
      name,
      regionId,
      regionName: regObj ? regObj.name : 'Южен централен (Родопи и Тракия)',
      categoryId,
      categoryName: catObj ? catObj.name : 'Древни светилища',
      latitude: latNum,
      longitude: lngNum,
      altitude: altitude ? parseInt(altitude, 10) : undefined,
      shortDescription,
      fullDescription: fullDescription || shortDescription,
      history,
      accessTips,
      terrainType,
      difficulty,
      bestSeason,
      imageUrl: imageUrl || '/places/belintash.jpg',
      imageCredit: imageCredit || 'Скрито в България',
      isFeatured,
    };

    setIsLoading(true);
    try {
      if (place) {
        await updatePlace(place.id, payload);
      } else {
        await createPlace(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Грешка при запис на обекта.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!place) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsLoading(true);
    try {
      await deletePlace(place.id);
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Грешка при изтриване на обекта.');
    } finally {
      setIsLoading(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in overflow-y-auto">
      <div className="liquid-water-card w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto border border-white/70">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200/60 bg-white/40 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-800 to-stone-900 text-amber-200 shadow-inner">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-editorial text-xl font-bold text-stone-950">
                {place ? `Редакция: ${place.name}` : 'Добавяне на нов обект'}
              </h3>
              <p className="text-xs text-stone-600">
                Администраторски права: Пълен контрол над съдържанието в базата данни
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full liquid-orb-btn text-stone-700 hover:text-stone-950 flex items-center justify-center cursor-pointer shadow-xs hover:scale-105 active:scale-95 transition-all"
            aria-label="Затвори"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form id="edit-place-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Име на обекта *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Регион *
                </label>
                <select
                  value={regionId}
                  onChange={(e) => setRegionId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300"
                >
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Категория *
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Ширина (Latitude) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Дължина (Longitude) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Трудност *
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300"
                >
                  <option value="Лесен">Лесен</option>
                  <option value="Умерен">Умерен</option>
                  <option value="Труден">Труден</option>
                  <option value="Екстремен">Екстремен</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Подходящ сезон
                </label>
                <input
                  type="text"
                  value={bestSeason}
                  onChange={(e) => setBestSeason(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Кратко описание (за картичката) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Пълно описание
                </label>
                <textarea
                  rows={3}
                  value={fullDescription}
                  onChange={(e) => setFullDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Исторически и културни сведения
                </label>
                <textarea
                  rows={3}
                  value={history}
                  onChange={(e) => setHistory(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Съвети за достъп и терен
                </label>
                <textarea
                  rows={2}
                  value={accessTips}
                  onChange={(e) => setAccessTips(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Линк към изображение (URL)
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Автор / Източник на снимката
                </label>
                <input
                  type="text"
                  value={imageCredit}
                  onChange={(e) => setImageCredit(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white rounded-lg border border-stone-300"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="featured-checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-4 h-4 text-amber-800 rounded border-stone-300 focus:ring-amber-800"
                />
                <label htmlFor="featured-checkbox" className="text-xs text-stone-800 font-medium cursor-pointer">
                  Показвай в подбраните обекти на началната страница (Featured)
                </label>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-stone-200/60 bg-white/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-2">
          {place ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Потвърди изтриването</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={isLoading}
                  className="btn-liquid-water px-3 py-2 rounded-full text-xs font-semibold text-stone-700 cursor-pointer"
                >
                  Откажи
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-full transition-all flex items-center gap-1.5 cursor-pointer shadow-xs hover:scale-102"
              >
                <Trash2 className="w-4 h-4" />
                <span>Изтрий обекта</span>
              </button>
            )
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-liquid-water water-shimmer px-5 py-2 rounded-full text-xs font-semibold text-stone-700 hover:text-stone-950 cursor-pointer shadow-xs"
            >
              Отказ
            </button>
            <button
              type="submit"
              form="edit-place-form"
              disabled={isLoading}
              className="btn-liquid-amber water-shimmer liquid-iridescent-rim px-6 py-2 rounded-full text-xs font-bold text-stone-950 flex items-center gap-2 cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-stone-950" />
              <span>{isLoading ? 'Записване...' : 'Запази промените'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
