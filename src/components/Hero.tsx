import React, { useState, useEffect } from 'react';
import { handleImageError } from '../utils/imageFallback';
import {
  MapPin,
  Compass,
  ArrowRight,
  Database,
  ChevronLeft,
  ChevronRight,
  Camera,
  Search,
  Sparkles,
  Mountain,
  Sun,
  Waves,
  Shield,
  ArrowUpRight,
} from 'lucide-react';

interface HeroProps {
  onExploreMap: () => void;
  onExploreCatalog: () => void;
  onAskGuide: () => void;
  onOpenSsms?: () => void;
  onSelectCategory?: (categoryId: string) => void;
  onSearchSubmit?: (searchTerm: string) => void;
  isAdmin?: boolean;
}

const HERO_PLACES = [
  {
    id: 'belogradchishki-skali',
    title: 'Белоградчишките скали и крепост „Калето“',
    subtitle: 'Антична римска стража и средновековна царска твърдина',
    region: 'Северозападен регион',
    coords: '43.6238° N, 22.6826° E',
    elevation: '510 м н.в.',
    image: '/places/belogradchishki-skali.jpg',
    highlight: 'Червени пясъчници, извисяващи се на 200 метра над Дунавската равнина.',
    bestSeason: 'Пролет и Златен Октомври',
    difficulty: 'Лесен достъп',
  },
  {
    id: 'sedemte-rilski-ezera',
    title: 'Седемте рилски езера',
    subtitle: 'Ледников циркус под Езерния връх и Харамията',
    region: 'Рила и Югозападна България',
    coords: '42.2033° N, 23.3150° E',
    elevation: '2535 м н.в.',
    image: '/places/sedemte-rilski-ezera.jpg',
    highlight: 'Кристални алпийски води: Сълзата, Окото, Бъбрека, Близнака, Трилистника, Рибното и Долното.',
    bestSeason: 'Юли — Септември',
    difficulty: 'Планински преход',
  },
  {
    id: 'dyavolski-most',
    title: 'Дяволският мост над река Арда',
    subtitle: 'Шедьовър на османската каменна архитектура от XVI век',
    region: 'Източни Родопи',
    coords: '41.6206° N, 25.1142° E',
    elevation: '420 м н.в.',
    image: '/places/dyavolski-most.jpg',
    highlight: 'Пълен отразителен кръг във водите на Арда, достъпен през стария път от Ардино.',
    bestSeason: 'Април — Ноември',
    difficulty: 'Лесен пешеходен',
  },
  {
    id: 'peshtera-prohodna',
    title: 'Пещера Проходна („Очите на Бога“)',
    subtitle: 'Естествен карстов мост с две симетрични окръглени окна',
    region: 'Северен централен регион',
    coords: '43.1751° N, 24.0722° E',
    elevation: '140 м н.в.',
    image: '/places/peshtera-prohodna.jpg',
    highlight: 'Дължина 262 метра, най-високият пещерен свод в България (45 метра височина).',
    bestSeason: 'Целогодишно',
    difficulty: 'Лесен достъп',
  },
  {
    id: 'chudnite-mostove',
    title: 'Чудните мостове (Еркюприя)',
    subtitle: 'Мраморен карстов феномен в дълбоката долина на река Еркюприя',
    region: 'Западни Родопи',
    coords: '41.8197° N, 24.5819° E',
    elevation: '1450 м н.в.',
    image: '/places/chudnite-mostove.jpg',
    highlight: 'Гигантски мраморни арки под връх Голям Персенк сред вековни смърчови гори.',
    bestSeason: 'Май — Октомври',
    difficulty: 'Среден преход',
  },
];

const QUICK_CATEGORIES = [
  { id: 'sanctuaries', label: 'Древни светилища', icon: Sun },
  { id: 'fortresses', label: 'Непристъпни крепости', icon: Shield },
  { id: 'waterfalls', label: 'Водопади & каньони', icon: Waves },
  { id: 'caves', label: 'Пещери & феномени', icon: Mountain },
  { id: 'villages', label: 'Автентични села', icon: Compass },
];

export const Hero: React.FC<HeroProps> = ({
  onExploreMap,
  onExploreCatalog,
  onAskGuide,
  onOpenSsms,
  onSelectCategory,
  onSearchSubmit,
  isAdmin = false,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_PLACES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const current = HERO_PLACES[activeSlide];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchSubmit && searchInput.trim()) {
      onSearchSubmit(searchInput.trim());
    } else {
      onExploreCatalog();
    }
  };

  return (
    <section className="relative overflow-hidden bg-[#FBF9F5] border-b border-stone-200/90 pt-6 pb-16 lg:pt-10 lg:pb-20">
      {/* Delicate topographic contour background texture */}
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(#d6cebe_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute -top-32 right-1/4 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-8">
        {/* Curatorial Header Ribbon - wraps cleanly with no clipping */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 pb-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
            <Compass className="w-4 h-4 text-amber-800" />
            <span className="text-stone-900 font-bold">Картографски атлас на България</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span>48 Документирани обекта</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="text-emerald-800 flex items-center gap-1 font-semibold">
              <Camera className="w-3.5 h-3.5" />
              <span>100% Реални снимки</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-stone-500 text-[11px]">
            <span className="font-mono">Стара планина · Родопи · Рила · Пирин · Странджа</span>
          </div>
        </div>

        {/* Hero Split Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          {/* Left Column (7 cols): Hero Stage with authentic STARA PLANINA background */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            {/* The Main Hero Text Container featuring authentic STARA PLANINA photo backdrop */}
            <div className="relative rounded-3xl overflow-hidden p-6 sm:p-10 border border-stone-800 shadow-2xl bg-stone-950 text-white min-h-[400px] flex flex-col justify-between group">
              {/* Authentic high-resolution photo of Stara Planina (Central Balkan ridge & Botev peak) */}
              <img
                src="/places/stara-planina-hero.jpg"
                alt="Стара планина - Централен Балкан и връх Ботев"
                className="absolute inset-0 w-full h-full object-cover object-center opacity-45 group-hover:scale-105 group-hover:opacity-55 transition-all duration-1000 ease-out"
                referrerPolicy="no-referrer"
                onError={(e) => handleImageError(e, 'sanctuaries', 'Стара планина')}
              />

              {/* Multi-layered cinematic gradient for ultra-crisp typographic contrast */}
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/95 via-stone-950/80 to-stone-950/40" />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-stone-950/60" />

              {/* Top Badge: Stara Planina verification */}
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/80 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-xs">
                  <Mountain className="w-4 h-4 text-emerald-400" />
                  <span>Стара планина · Централен Балкан</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-[11px] text-stone-300">връх Ботев (2376 м)</span>
                </div>

                <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 backdrop-blur-md border border-emerald-600/40 text-[11px] text-emerald-200 font-mono">
                  <span>42.719° N, 24.916° E</span>
                </div>
              </div>

              {/* Main Headline with Stara Planina in background - no cutoffs */}
              <div className="relative z-10 space-y-4 my-auto py-4">
                <h1 className="font-editorial text-3xl sm:text-5xl lg:text-5xl xl:text-6xl font-bold text-white leading-[1.08] tracking-tight drop-shadow-md">
                  Открийте тайните на България, <span className="italic font-normal text-emerald-300">скрити отвъд утъпканите пътища</span>
                </h1>

                <p className="text-sm sm:text-base text-stone-200 font-normal leading-relaxed max-w-xl drop-shadow-xs">
                  Точен картографски архив на 48 диви светилища, забравени средновековни твърдини, карстови каньони и водопади с проверени координати, пътеки и истински теренни фотографии.
                </p>
              </div>

              {/* Photo Attribution Footer Strip */}
              <div className="relative z-10 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  <span>Фон: Реална панорама на Стара планина</span>
                </span>
                <span className="text-stone-400 text-[10px] font-mono">
                  Експедиционен архив BG
                </span>
              </div>
            </div>

            {/* Instant Search Bar & Filter Controls */}
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="relative">
                <div className="liquid-glass-focus-pill liquid-iridescent-rim rounded-full p-1.5 sm:p-2 pr-2 sm:pr-2.5 flex items-center gap-2 sm:gap-2.5 transition-all focus-within:ring-2 focus-within:ring-amber-700/40">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-white/95 via-stone-100/70 to-stone-200/50 border border-white/90 shadow-inner">
                    <Search className="w-4 h-4 text-stone-700" />
                  </div>
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Търси Белинташ, Проходна, регион..."
                    className="w-full min-w-0 flex-1 bg-transparent px-1.5 sm:px-2 py-1 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none font-semibold truncate"
                  />
                  <button
                    type="submit"
                    className="btn-liquid-amber water-shimmer liquid-iridescent-rim px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-stone-950 font-bold text-xs flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-all"
                  >
                    <span>Търси</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>

              {/* Quick Category Discovery Pills with Apple Liquid Glass Focus Capsules */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mr-1">
                  Категории:
                </span>
                {QUICK_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => onSelectCategory ? onSelectCategory(cat.id) : onExploreCatalog()}
                      className="liquid-glass-focus-pill pl-2 pr-3.5 py-1.5 rounded-full text-xs font-bold text-stone-800 hover:text-stone-950 inline-flex items-center gap-2 cursor-pointer shadow-xs hover:scale-105 active:scale-95 transition-all"
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-white/80 border border-white/90 shadow-inner text-amber-800 shrink-0">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Primary Action Buttons - Liquid Glass Focus & Emerald Pills */}
              <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 pt-1">
                <button
                  onClick={onExploreMap}
                  className="btn-liquid-dark water-shimmer px-5 sm:px-6 py-3 sm:py-3.5 rounded-full text-amber-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 group cursor-pointer shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0"
                >
                  <Compass className="w-4 h-4 text-amber-300 group-hover:rotate-45 transition-transform duration-500" />
                  <span>Интерактивна карта</span>
                </button>

                <button
                  onClick={onAskGuide}
                  className="btn-liquid-emerald water-shimmer liquid-iridescent-rim px-5 sm:px-6 py-3 sm:py-3.5 rounded-full text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 group cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-all shrink-0"
                >
                  <Sparkles className="w-4 h-4 text-emerald-100 group-hover:scale-110 transition-transform duration-300" />
                  <span>Пътеводител (Gemini 4 Flash)</span>
                </button>

                {/* Database Button - STRICTLY FOR ADMIN ONLY */}
                {isAdmin && onOpenSsms && (
                  <button
                    onClick={onOpenSsms}
                    className="btn-liquid-water water-shimmer px-4 sm:px-5 py-3 sm:py-3.5 rounded-full text-blue-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0"
                    title="Отвори SSMS Студио (само за администратори)"
                  >
                    <Database className="w-4 h-4 text-[#0078D4]" />
                    <span>SSMS База (Админ)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Interactive Spotlight Card with Liquid Water Glass */}
          <div
            className="lg:col-span-5 relative flex flex-col justify-between"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div className="relative liquid-water-card rounded-3xl p-3 shadow-2xl transition-all duration-500 h-full flex flex-col justify-between">
              {/* Image Frame - generous height, no cut-offs */}
              <div className="relative h-80 sm:h-96 lg:h-full min-h-[400px] w-full rounded-2xl overflow-hidden bg-stone-950 flex flex-col justify-between">
                <img
                  src={current.image}
                  alt={current.title}
                  className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 hover:scale-105"
                  referrerPolicy="no-referrer"
                  onError={(e) => handleImageError(e, undefined, current.title)}
                />
                {/* Gradient vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-stone-950/20" />

                {/* Top Badges */}
                <div className="relative z-10 pt-4 px-4 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-950/80 text-amber-300 backdrop-blur-xl border border-amber-400/40 font-semibold text-[11px] shadow-sm">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>Реална снимка</span>
                  </div>

                  <div className="px-2.5 py-1 rounded-full bg-stone-950/80 text-stone-100 backdrop-blur-xl text-[11px] font-mono tabular-nums border border-white/20 shrink-0 shadow-sm">
                    {activeSlide + 1} / {HERO_PLACES.length}
                  </div>
                </div>

                {/* Telemetry Strip - full text without cutoffs */}
                <div className="relative z-10 p-5 sm:p-6 space-y-2.5 text-white">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-amber-300 font-semibold">
                    <span>{current.region}</span>
                    <span aria-hidden="true" className="text-white/40">·</span>
                    <span>{current.elevation}</span>
                    <span aria-hidden="true" className="text-white/40">·</span>
                    <span className="text-stone-300">{current.difficulty}</span>
                  </div>

                  <h3 className="font-editorial text-2xl sm:text-3xl font-bold leading-tight drop-shadow-sm text-white">
                    {current.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-stone-200 leading-relaxed drop-shadow-xs">
                    {current.highlight}
                  </p>

                  <div className="pt-2.5 flex items-center justify-between text-xs border-t border-white/20">
                    <span className="font-mono text-[11px] text-stone-300">
                      {current.coords}
                    </span>

                    <button
                      onClick={onExploreCatalog}
                      className="btn-liquid-amber water-shimmer px-4 py-1.5 rounded-full text-stone-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <span>Разгледай в архива</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Slider Navigation Bar */}

              <div className="pt-3 px-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  {HERO_PLACES.map((p, idx) => (
                    <button
                      key={p.id}
                      onClick={() => setActiveSlide(idx)}
                      className={`h-2.5 rounded-full transition-all ${
                        activeSlide === idx
                          ? 'w-8 bg-amber-700'
                          : 'w-2.5 bg-stone-300 hover:bg-stone-400'
                      }`}
                      aria-label={`Слайд ${idx + 1}`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveSlide((prev) => (prev - 1 + HERO_PLACES.length) % HERO_PLACES.length)}
                    className="w-8 h-8 rounded-full liquid-orb-btn text-stone-800 hover:text-stone-950 flex items-center justify-center cursor-pointer shadow-xs hover:scale-105 active:scale-95 transition-all"
                    aria-label="Предишен обект"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveSlide((prev) => (prev + 1) % HERO_PLACES.length)}
                    className="w-8 h-8 rounded-full liquid-orb-btn text-stone-800 hover:text-stone-950 flex items-center justify-center cursor-pointer shadow-xs hover:scale-105 active:scale-95 transition-all"
                    aria-label="Следващ обект"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Expedition Metric Strip - Liquid Water Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-stone-200/50">
          <div className="p-4 sm:p-5 liquid-water-card rounded-2xl shadow-2xs space-y-1">
            <div className="font-editorial text-3xl font-bold text-stone-900">48</div>
            <div className="text-xs font-semibold text-stone-800">Верифицирани обекта</div>
            <div className="text-[11px] text-stone-500">Светилища, крепости, пещери</div>
          </div>

          <div className="p-4 sm:p-5 liquid-water-card rounded-2xl shadow-2xs space-y-1">
            <div className="font-editorial text-3xl font-bold text-amber-900">6</div>
            <div className="text-xs font-semibold text-stone-800">Планински региона</div>
            <div className="text-[11px] text-stone-500">Родопи, Рила, Пирин, Балкан</div>
          </div>

          <div className="p-4 sm:p-5 liquid-water-card rounded-2xl shadow-2xs space-y-1">
            <div className="font-editorial text-3xl font-bold text-emerald-800">100%</div>
            <div className="text-xs font-semibold text-stone-800">Реални снимки</div>
            <div className="text-[11px] text-stone-500">Google & Commons теренни кадри</div>
          </div>


          {isAdmin ? (
            <div
              onClick={onOpenSsms}
              className="p-4 sm:p-5 liquid-water-card water-shimmer rounded-2xl shadow-2xs space-y-1 cursor-pointer transition-all group"
            >
              <div className="font-editorial text-3xl font-bold text-[#0078D4] flex items-center justify-between">
                <span>SSMS</span>
                <Database className="w-5 h-5 text-[#0078D4] group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div className="text-xs font-semibold text-blue-900">T-SQL База данни</div>
              <div className="text-[11px] text-blue-700">Отвори студио (Админ)</div>
            </div>
          ) : (
            <div
              onClick={onAskGuide}
              className="p-4 sm:p-5 liquid-water-card water-shimmer rounded-2xl shadow-2xs space-y-1 cursor-pointer transition-all group"
            >
              <div className="font-editorial text-3xl font-bold text-emerald-800 flex items-center justify-between">
                <span>AI</span>
                <Sparkles className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <div className="text-xs font-semibold text-stone-900">Gemini 4 Flash</div>
              <div className="text-[11px] text-stone-600">Теренен краевед съветник</div>
            </div>
          )}

        </div>
      </div>
    </section>
  );
};
