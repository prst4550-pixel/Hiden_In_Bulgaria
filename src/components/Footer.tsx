import React from 'react';
import { MapPin, ShieldCheck, Mountain, Phone } from 'lucide-react';
import { createSvgDataUri } from '../utils/imageFallback';

interface FooterProps {
  onNavClick: (tab: string) => void;
  onOpenAdmin: () => void;
  placesCount?: number;
  isAdmin?: boolean;
}

export const Footer: React.FC<FooterProps> = ({
  onNavClick,
  onOpenAdmin,
  placesCount = 48,
  isAdmin = false,
}) => {
  return (
    <footer className="bg-stone-900 text-stone-300 border-t border-stone-800 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Mission and Brand (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-[#13191d] shadow-md border-2 border-amber-500/70 shrink-0 flex items-center justify-center">
                <img
                  src="/logo-emblem.jpg"
                  alt="Скрито в България емблема"
                  className="w-full h-full object-cover object-center scale-[1.34] hover:scale-[1.38] transition-transform duration-500"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.onerror = null;
                    img.src = createSvgDataUri('Скрито в България');
                  }}
                />
              </div>
              <div className="flex flex-col">
                <span className="font-editorial text-2xl font-bold text-white tracking-tight">
                  Скрито в България
                </span>
                <span className="text-[10px] uppercase tracking-widest text-stone-400 font-medium">
                  Независим картографски проект
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-400 leading-relaxed max-w-sm">
              Създаден от любители пътешественици и краеведи, архивът събира и документира най-чистите,
              непознати и съкровени места на родината — от скалните светилища на Родопите до каньоните на Дунав.
            </p>
            <div className="pt-2 flex items-center gap-3 text-xs text-stone-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Проверени GPS координати</span>
              <span>·</span>
              <span>Теренни бележки</span>
            </div>
          </div>

          {/* Quick Nav (3 cols) */}
          <div className="md:col-span-3 space-y-3 text-xs sm:text-sm">
            <div className="font-semibold text-white uppercase tracking-wider text-xs">
              Раздели на архива
            </div>
            <ul className="space-y-2 text-stone-400">
              <li>
                <button type="button" onClick={() => onNavClick('home')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  Начална страница
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavClick('map')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  Интерактивна карта
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavClick('catalog')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  Пълен каталог на местата
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavClick('routes')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  Експедиционни маршрути
                </button>
              </li>
              {isAdmin && (
                <li>
                  <button type="button" onClick={() => onNavClick('ssms')} className="text-blue-400 hover:text-blue-300 transition-colors font-medium flex items-center gap-1 cursor-pointer">
                    <span>SSMS База данни (Админ)</span>
                  </button>
                </li>
              )}
              <li>
                <button type="button" onClick={() => onNavClick('guide')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  Пътеводителят
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavClick('community')} className="hover:text-amber-300 transition-colors cursor-pointer">
                  Предложи скрито място
                </button>
              </li>
            </ul>
          </div>

          {/* Curation & Principles (4 cols) */}
          <div className="md:col-span-4 space-y-3 text-xs sm:text-sm">
            <div className="font-semibold text-white uppercase tracking-wider text-xs">
              Теренен кодекс
            </div>
            <p className="text-stone-400 text-xs leading-relaxed">
              Не оставяйте следи, спазвайте маркировките и пазете древните камъни. Всички обекти в платформата са придружени от проверени координати, теренни бележки и подбрани автентични фотографии.
            </p>
            <div className="pt-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-stone-400">
                <Mountain className="w-4 h-4 text-amber-400" />
                <span>{placesCount} документирани диви локации с реални снимки</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-400">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>6 географски региона на България</span>
              </div>

              {/* Emergency & Mountain Rescue Numbers (24/7) */}
              <div className="mt-2 p-3 rounded-xl bg-stone-800/80 border border-rose-500/30 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-300">
                  <Phone className="w-3.5 h-3.5 text-rose-400" />
                  <span>Спешни случаи и спасяване (24/7)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  <a
                    href="tel:112"
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-900 text-stone-200 border border-stone-700/80 transition-colors"
                  >
                    <span className="text-stone-400">Спешна помощ:</span>
                    <span className="font-mono font-bold text-rose-300">112</span>
                  </a>
                  <a
                    href="tel:1470"
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-900 text-stone-200 border border-stone-700/80 transition-colors"
                  >
                    <span className="text-stone-400">Планинска (ПСС):</span>
                    <span className="font-mono font-bold text-amber-300">1470</span>
                  </a>
                </div>
                <div className="text-[11px] text-stone-400 flex items-center justify-between pt-0.5">
                  <span>Дежурен център ПСС:</span>
                  <a href="tel:+35929632000" className="font-mono text-stone-200 hover:text-amber-300 transition-colors">
                    +359 2 963 2000
                  </a>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenAdmin}
                className="mt-2 text-left text-xs text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
              >
                Редакторски вход
              </button>
            </div>
          </div>
        </div>

        {/* Bottom copyright & legal line */}
        <div className="pt-8 border-t border-stone-800 text-xs text-stone-500 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            © {new Date().getFullYear()} Скрито в България. Всички права запазени.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-stone-400">
            <button type="button" onClick={() => onNavClick('privacy')} className="hover:text-amber-300 transition-colors cursor-pointer">
              Поверителност
            </button>
            <button type="button" onClick={() => onNavClick('terms')} className="hover:text-amber-300 transition-colors cursor-pointer">
              Общи условия
            </button>
            <button type="button" onClick={() => onNavClick('cookies')} className="hover:text-amber-300 transition-colors cursor-pointer">
              Бисквитки
            </button>
            <button type="button" onClick={() => onNavClick('contact')} className="hover:text-amber-300 transition-colors cursor-pointer">
              Контакти
            </button>
            <span className="hidden sm:inline text-stone-600">·</span>
            <span className="hidden sm:inline">С обич към българската природа и история</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
