import React, { useState } from 'react';
import {
  ShieldCheck,
  FileText,
  Cookie,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
} from 'lucide-react';
import { submitContactMessage } from '../services/api';

export type LegalPageMode = 'privacy' | 'terms' | 'cookies' | 'contact';

interface LegalPagesProps {
  mode: LegalPageMode;
  onNavigate: (tab: string) => void;
}

export const LegalPages: React.FC<LegalPagesProps> = ({ mode, onNavigate }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!consent) {
      setErrorMsg('Моля, потвърдете съгласието си за обработка на въведените данни за контакт.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitContactMessage({ name, email, subject, message });
      setSuccessMsg(res.message);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setConsent(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Възникна грешка при изпращане на съобщението.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs: { id: LegalPageMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'contact', label: 'Контакти', icon: Mail },
    { id: 'privacy', label: 'Поверителност', icon: ShieldCheck },
    { id: 'terms', label: 'Общи условия', icon: FileText },
    { id: 'cookies', label: 'Бисквитки', icon: Cookie },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Breadcrumb & Section Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-6">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700 hover:text-amber-900 transition-colors self-start cursor-pointer min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Обратно към началната страница</span>
        </button>

        <nav aria-label="Правни и информационни страници" className="flex flex-wrap items-center gap-2">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px] ${
                  active
                    ? 'bg-stone-900 text-amber-200'
                    : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* PRIVACY POLICY */}
      {mode === 'privacy' && (
        <article className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-10 space-y-6 shadow-xs">
          <header className="space-y-2 border-b border-stone-200 pb-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
              <ShieldCheck className="w-4 h-4" />
              <span>Защита на личните данни</span>
            </div>
            <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-stone-950">
              Политика за поверителност
            </h1>
            <p className="text-xs text-stone-500">
              Последна актуализация: 2026 г. · Отнася се за платформата „Скрито в България“
            </p>
          </header>

          <div className="space-y-5 text-sm text-stone-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="font-editorial text-xl font-bold text-stone-950">1. Обща информация и контакт</h2>
              <p>
                „Скрито в България“ е независим картографски и краеведски уеб проект за документиране и представяне на природни и исторически забележителности в България. За въпроси, свързани с лични данни, корекция или премахване на информация, можете да се свържете с администратора на проекта на електронен адрес{' '}
                <a href="mailto:prst4550@gmail.com" className="text-amber-900 font-semibold underline">
                  prst4550@gmail.com
                </a>{' '}
                или чрез{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('contact')}
                  className="text-amber-900 font-semibold underline cursor-pointer"
                >
                  формата за контакт
                </button>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-editorial text-xl font-bold text-stone-950">2. Какви данни събираме</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Данни при регистрация и вход:</strong> име, имейл адрес и криптографски хеширана парола (чрез алгоритъма <code>scrypt</code> с уникална сол). Паролите никога не се съхраняват в чист вид.
                </li>
                <li>
                  <strong>Публични отзиви и предложения:</strong> име или псевдоним на автора, текст на коментара, сезон на посещение и доброволно предоставен имейл за уточнения при подаване на ново място.
                </li>
                <li>
                  <strong>Запитвания през формата за контакт:</strong> име, имейл адрес, тема и съдържание на съобщението, използвани единствено за отговор на вашето запитване.
                </li>
                <li>
                  <strong>Технически данни и геолокация:</strong> заявката за текущо местоположение в секция „Карта“ се обработва изцяло в браузъра ви след изрично разрешение от ваша страна и не се записва на сървъра.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-editorial text-xl font-bold text-stone-950">3. Сигурност и съхранение</h2>
              <p>
                Сесийните токени за достъп се съхраняват само в оперативната памет на браузъра по време на активната сесия и не се записват в постоянни клиентски хранилища. Сървърната комуникация прилага заглавки за сигурност, валидация на входящите данни и ограничаване на честотата на заявките.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-editorial text-xl font-bold text-stone-950">4. Вашите права</h2>
              <p>
                Имате право да поискате достъп до съхраняваните за вас данни, тяхната корекция или пълното им изтриване, като изпратите заявка до{' '}
                <a href="mailto:prst4550@gmail.com" className="text-amber-900 font-semibold underline">
                  prst4550@gmail.com
                </a>
                .
              </p>
            </section>
          </div>
        </article>
      )}

      {/* TERMS AND CONDITIONS */}
      {mode === 'terms' && (
        <article className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-10 space-y-6 shadow-xs">
          <header className="space-y-2 border-b border-stone-200 pb-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
              <FileText className="w-4 h-4" />
              <span>Правила за ползване</span>
            </div>
            <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-stone-950">
              Общи условия за ползване
            </h1>
            <p className="text-xs text-stone-500">
              Последна актуализация: 2026 г. · „Скрито в България“
            </p>
          </header>

          <div className="space-y-5 text-sm text-stone-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="font-editorial text-xl font-bold text-stone-950">1. Предмет и предназначение</h2>
              <p>
                Платформата „Скрито в България“ предоставя информационен, картографски и краеведски каталог с координати, описания, маршрути и теренни бележки за обекти на територията на Република България. Използването на сайта е доброволно и означава приемане на настоящите правила.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-editorial text-xl font-bold text-stone-950">2. Безопасност на терен и отговорност</h2>
              <p>
                Макар координатите и описанията да се поддържат с грижа за точността, метеорологичните условия, състоянието на планинските пътеки и достъпността на природните обекти се променят динамично. Всеки посетител планира преходите си съобразно собствената си подготовка, екипировка и актуалната прогноза, като носи лична отговорност за безопасността си.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-editorial text-xl font-bold text-stone-950">3. Потребителско съдържание и етика</h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Потребителите могат да публикуват реални отзиви и предложения за нови обекти.</li>
                <li>Забранено е публикуването на невярна информация, обидно съдържание, спам или материали, нарушаващи авторски права.</li>
                <li>Екипът си запазва правото да модерира, редактира или премахва предложения и коментари преди или след публикуване.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-editorial text-xl font-bold text-stone-950">4. Авторски права и карти</h2>
              <p>
                Текстовете, структурата на маршрутите и локалната картографска база данни са предназначени за информационно ползване. Картографските слоеве на трети страни (OpenStreetMap, Esri, Google Maps, когато е конфигуриран съответен ключ) се предоставят при спазване на техните лицензионни условия.
              </p>
            </section>
          </div>
        </article>
      )}

      {/* COOKIE POLICY */}
      {mode === 'cookies' && (
        <article className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-10 space-y-6 shadow-xs">
          <header className="space-y-2 border-b border-stone-200 pb-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
              <Cookie className="w-4 h-4" />
              <span>Локално съхранение и бисквитки</span>
            </div>
            <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-stone-950">
              Политика за бисквитки и локално съхранение
            </h1>
            <p className="text-xs text-stone-500">
              Последна актуализация: 2026 г. · „Скрито в България“
            </p>
          </header>

          <div className="space-y-5 text-sm text-stone-700 leading-relaxed">
            <section className="space-y-2">
              <h2 className="font-editorial text-xl font-bold text-stone-950">1. Какво използва приложението</h2>
              <p>
                „Скрито в България“ не използва рекламни, маркетингови или проследяващи бисквитки на трети страни за профилиране на потребители. За да работят удобствата на интерфейса, браузърът използва единствено ограничено локално съхранение (<code>localStorage</code>) за следните предпочитания:
              </p>
              <div className="overflow-x-auto border border-stone-200 rounded-xl mt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F4EFE6] text-stone-900 font-semibold border-b border-stone-200">
                    <tr>
                      <th className="p-3">Ключ</th>
                      <th className="p-3">Предназначение</th>
                      <th className="p-3">Срок</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    <tr>
                      <td className="p-3 font-mono text-stone-900">hb_guest_favorites</td>
                      <td className="p-3">Запазва избраните от вас любими обекти в гост режим.</td>
                      <td className="p-3">До изчистване или вход в профил</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-stone-900">hb_guest_recent_trail</td>
                      <td className="p-3">Съхранява последните 3 разгледани локации за маршрута „Пътека от стъпки“ в гост режим.</td>
                      <td className="p-3">До изчистване от бутона в картата</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-stone-900">hb_guest_custom_routes</td>
                      <td className="p-3">Съхранява създадените от вас маршрути в гост режим.</td>
                      <td className="p-3">До изтриване от потребителя</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-stone-900">hb_guest_guide_chat</td>
                      <td className="p-3">Пази локално историята на текущия разговор с Пътеводителя в гост режим.</td>
                      <td className="p-3">До започване на нов разговор</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-stone-600 pt-2">
                При вход в личен потребителски профил всички любими места, персонални маршрути, пътека и разговори се съхраняват изолирано в сървърната база данни единствено към вашия акаунт.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-editorial text-xl font-bold text-stone-950">2. Картографски услуги на трети страни</h2>
              <p>
                При зареждане на картографски плочки от OpenStreetMap или Esri (и Google Maps, ако е активиран собствен ключ), тези външни доставчици обработват стандартни HTTP заявки съгласно собствените си политики за поверителност.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-editorial text-xl font-bold text-stone-950">3. Управление от браузъра</h2>
              <p>
                Можете по всяко време да изтриете записите от локалното хранилище чрез настройките за поверителност на вашия браузър или да изчистите пътеката директно от интерфейса на картата.
              </p>
            </section>
          </div>
        </article>
      )}

      {/* CONTACT PAGE */}
      {mode === 'contact' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
                <Mail className="w-4 h-4" />
                <span>Директна връзка</span>
              </div>
              <h1 className="font-editorial text-3xl font-bold text-stone-950">
                Контакти и редакционни запитвания
              </h1>
              <p className="text-sm text-stone-600 leading-relaxed">
                Свържете се с нас за корекции по координати, партньорства, авторски права върху фотографии или предложения за подобрение на каталога.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-stone-200 text-xs sm:text-sm">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#F4EFE6] text-amber-900 flex items-center justify-center shrink-0 border border-stone-200">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-stone-900">Електронна поща</div>
                  <a
                    href="mailto:prst4550@gmail.com"
                    className="text-amber-900 hover:underline font-mono text-xs"
                  >
                    prst4550@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#F4EFE6] text-amber-900 flex items-center justify-center shrink-0 border border-stone-200">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-stone-900">Териториален обхват</div>
                  <div className="text-stone-600 text-xs">
                    Република България · Всички 6 географски региона
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#F4EFE6] text-amber-900 flex items-center justify-center shrink-0 border border-stone-200">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-stone-900">Обработка на сигнали</div>
                  <div className="text-stone-600 text-xs">
                    Съобщенията се преглеждат директно в административния панел на платформата.
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-rose-950">
                  <Phone className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>Спешни номера при инцидент (24/7)</span>
                </div>
                <div className="space-y-1 text-stone-700">
                  <div className="flex items-center justify-between">
                    <span>Спешна помощ / Единен номер:</span>
                    <a href="tel:112" className="font-mono font-bold text-rose-800 hover:underline">
                      112
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Планинска спасителна служба (ПСС):</span>
                    <a href="tel:1470" className="font-mono font-bold text-amber-900 hover:underline">
                      1470
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Дежурен център ПСС (БЧК):</span>
                    <a href="tel:+35929632000" className="font-mono font-semibold text-stone-900 hover:underline">
                      +359 2 963 2000
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 shadow-xs space-y-5">
            <h2 className="font-editorial text-2xl font-bold text-stone-950">
              Изпратете съобщение
            </h2>

            {successMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm">
                <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-semibold text-stone-800 mb-1">
                    Вашето име <span className="text-red-700">*</span>
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="напр. Мария Николова"
                    className="w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/30"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-xs font-semibold text-stone-800 mb-1">
                    Имейл адрес <span className="text-red-700">*</span>
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    maxLength={160}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.bg"
                    className="w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/30"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact-subject" className="block text-xs font-semibold text-stone-800 mb-1">
                  Тема на запитването <span className="text-red-700">*</span>
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  required
                  maxLength={160}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="напр. Уточнение на координати или запитване за партньорство"
                  className="w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/30"
                />
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-xs font-semibold text-stone-800 mb-1">
                  Съобщение <span className="text-red-700">*</span>
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  required
                  minLength={10}
                  maxLength={2500}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Напишете подробно вашето запитване..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-800/30 leading-relaxed"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-stone-300 text-amber-800 focus:ring-amber-800"
                />
                <span>
                  Съгласен съм предоставените данни да бъдат обработени единствено за отговор на това запитване съгласно{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('privacy')}
                    className="text-amber-900 font-semibold underline cursor-pointer"
                  >
                    Политиката за поверителност
                  </button>
                  .
                </span>
              </label>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-liquid-amber px-6 py-2.5 rounded-lg text-xs sm:text-sm font-bold text-white inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Изпращане...' : 'Изпрати запитването'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
