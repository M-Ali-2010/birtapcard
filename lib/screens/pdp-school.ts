/**
 * Отдельный экран ссылок для PDP School.
 *
 * Общий экран после скана (`renderScanGate` в lib/scan-gate.ts) одинаковый для всех
 * заведений. PDP School получает свой — в стиле school.pdp.uz и PDP Design System v1.0:
 * шесть карточек (отзыв в Google, сайт, Telegram-бот, Google Play, App Store, Wi-Fi) на
 * синем поле, языки UZ / RU / EN.
 *
 * Как он попадает к гостю: /r/nfc и /r/qr фиксируют скан и ведут на /r/go/[token];
 * там по названию компании (`isPdpSchoolCompany`) выбирается этот экран вместо общего.
 * Без токена экран открывается по адресу /pdp/links — для показа и проверки.
 *
 * Нажатия считаются так же, как на общем экране: sendBeacon на /api/track с токеном
 * филиала и целью (google, bot, website, google_play, app_store, wifi).
 */

import { PDP_CSS, PDP_FAVICON, PDP_LOGO, PDP_MARK, PDP_SPRITE } from './pdp-school.assets'

export type PdpLang = 'uz' | 'ru' | 'en'

/**
 * Ссылки по умолчанию. Всё, что заведено у филиала в кабинете (google_url, bot_url),
 * перекрывает эти значения — здесь только то, чего в базе нет.
 */
export const PDP_SCHOOL_LINKS = {
  /** «Написать отзыв» в Google: прямо в форму отзыва школы (Place ID школы) */
  review: 'https://search.google.com/local/writereview?placeid=ChIJcaGG9PthrjgRKO9yt89GDJM',
  /** Сайт школы: узбекская версия — «/», русская — «/ru». Английской версии на сайте нет. */
  web: {
    uz: 'https://school.pdp.uz/',
    ru: 'https://school.pdp.uz/ru',
    en: 'https://school.pdp.uz/',
  } as Record<PdpLang, string>,
  /** Telegram-бот школы: оценки, посещаемость, расписание, платежи */
  bot: 'https://t.me/PDPUzBot',
  /** Приложение «PDP School» для учеников, родителей и сотрудников */
  play: 'https://play.google.com/store/apps/details?id=uz.pdpschool.lms',
  ios: 'https://apps.apple.com/uz/app/pdp-school/id6807296022',
  /**
   * Wi-Fi: пока не задан — карточка не показывается.
   * Заполняется так: `{ ssid: 'PDP-Guest', password: '…' }` (лучше гостевая сеть).
   */
  wifi: null as { ssid: string; password?: string } | null,
}

/** Метки для сайта школы: по ним школа видит в своей аналитике, что гость пришёл с карточки */
const UTM = { utm_source: 'birtapcard', utm_medium: 'card', utm_campaign: 'links' }

export type PdpScreenOptions = {
  /** Токен филиала — по нему считаются нажатия. В демо-режиме (/pdp/links) его нет. */
  token?: string | null
  /** branches.google_url — ссылка на отзыв в Google */
  googleUrl?: string | null
  /** branches.bot_url — Telegram-бот */
  botUrl?: string | null
}

/** Компания PDP School? Проверка по названию, как оно заведено в кабинете. */
export function isPdpSchoolCompany(name: unknown): boolean {
  return typeof name === 'string' && /pdp\s*school/i.test(name)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Пускаем в href только http(s): значение приходит из базы, javascript: туда попасть не должно */
function httpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const u = new URL(value.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

function withUtm(url: string): string {
  const u = new URL(url)
  for (const [k, v] of Object.entries(UTM)) u.searchParams.set(k, v)
  return u.toString()
}

/** t.me/pdpschooll → «@pdpschooll»; для остальных адресов подписи нет */
function telegramHandle(url: string): string | null {
  const m = url.match(/^https?:\/\/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{3,})\/?(?:\?.*)?$/i)
  return m ? '@' + m[1] : null
}

/** Данные в <script> без риска закрыть тег раньше времени */
function jsonForScript(value: unknown): string {
  // «<» экранируем, чтобы данные не закрыли тег script; U+2028/2029 — потому что они ломают строки в старом JS
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(new RegExp('\\u2028', 'g'), '\\u2028')
    .replace(new RegExp('\\u2029', 'g'), '\\u2029')
}

const TEXT: Record<PdpLang, Record<string, string>> = {
  uz: {
    title: 'PDP School — Havolalar', nav: 'Havolalar', lang: 'Til', skip: 'Havolalarga o‘tish',
    pill: 'Bizda yoqdimi?', h1a: 'Sharh qoldiring', h1b: 'va obuna bo‘ling',
    lead: 'PDP School’ning yangiliklari, tadbirlari va imkoniyatlaridan birinchi bo‘lib xabardor bo‘ling',
    maps_t: 'Google Maps', maps_d: 'Google Maps’da sharh qoldiring',
    web_t: 'Veb-sayt', web_d: 'Rasmiy saytimiz',
    bot_t: 'Telegram bot', bot_d: 'Tezkor ma’lumot va yordam',
    play_t: 'Google Play', play_d: 'Android ilovasini yuklab oling',
    ios_t: 'App Store', ios_d: 'iOS ilovasini yuklab oling',
    wifi_t: 'Wi-Fi', wifi_d: 'PDP tarmog‘iga ulanish',
    wifi_h: 'Wi-Fi tarmog‘i', wifi_p: 'Telefoningiz Wi-Fi sozlamalarida shu tarmoqni tanlang',
    ssid: 'Tarmoq nomi', pass: 'Parol', copy: 'Nusxalash', copied: 'Nusxalandi', close: 'Yopish',
    tag: 'Bilim • Imkoniyat • Kelajak',
  },
  ru: {
    title: 'PDP School — Ссылки', nav: 'Ссылки', lang: 'Язык', skip: 'Перейти к ссылкам',
    pill: 'Вам у нас понравилось?', h1a: 'Оставьте отзыв', h1b: 'и подпишитесь',
    lead: 'Узнавайте первыми о новостях, мероприятиях и возможностях PDP School',
    maps_t: 'Google Maps', maps_d: 'Оставьте отзыв в Google Maps',
    web_t: 'Веб-сайт', web_d: 'Официальный сайт',
    bot_t: 'Telegram-бот', bot_d: 'Быстрая информация и помощь',
    play_t: 'Google Play', play_d: 'Скачать для Android',
    ios_t: 'App Store', ios_d: 'Скачать для iOS',
    wifi_t: 'Wi-Fi', wifi_d: 'Подключитесь к сети PDP',
    wifi_h: 'Сеть Wi-Fi', wifi_p: 'Выберите эту сеть в настройках Wi-Fi телефона',
    ssid: 'Название сети', pass: 'Пароль', copy: 'Копировать', copied: 'Скопировано', close: 'Закрыть',
    tag: 'Знания • Возможности • Будущее',
  },
  en: {
    title: 'PDP School — Links', nav: 'Links', lang: 'Language', skip: 'Skip to links',
    pill: 'Like it here?', h1a: 'Leave a review', h1b: 'and subscribe',
    lead: 'Be the first to hear about PDP School news, events and opportunities',
    maps_t: 'Google Maps', maps_d: 'Leave a review on Google Maps',
    web_t: 'Website', web_d: 'Our official site',
    bot_t: 'Telegram bot', bot_d: 'Quick info and help',
    play_t: 'Google Play', play_d: 'Download the Android app',
    ios_t: 'App Store', ios_d: 'Download the iOS app',
    wifi_t: 'Wi-Fi', wifi_d: 'Connect to the PDP network',
    wifi_h: 'Wi-Fi network', wifi_p: 'Pick this network in your phone’s Wi-Fi settings',
    ssid: 'Network name', pass: 'Password', copy: 'Copy', copied: 'Copied', close: 'Close',
    tag: 'Knowledge • Opportunity • Future',
  },
}

const ARROW = '<span class="link__go"><svg aria-hidden="true"><use href="#i-arrow-up-right"/></svg></span>'

function icon(id: string): string {
  return `<span class="link__ico"><svg aria-hidden="true"><use href="#i-${id}"/></svg></span>`
}

export function renderPdpSchoolScreen(opts: PdpScreenOptions = {}): string {
  const L = PDP_SCHOOL_LINKS
  const t = TEXT.uz // первичная отрисовка; язык гостя выбирает скрипт ниже

  const reviewUrl = httpUrl(opts.googleUrl) ?? L.review
  const botUrl = httpUrl(opts.botUrl) ?? L.bot
  const botHandle = telegramHandle(botUrl)
  const web = { uz: withUtm(L.web.uz), ru: withUtm(L.web.ru), en: withUtm(L.web.en) }
  const wifi = L.wifi && L.wifi.ssid ? L.wifi : null

  const open = 'target="_blank" rel="noopener"'

  const reviewCard = `
        <li class="is-wide">
          <a class="link link--wide link--primary" href="${escapeHtml(reviewUrl)}" ${open} data-t="google">
            ${icon('map-pin')}
            <span class="link__body">
              <span class="link__title" data-i="maps_t">${t.maps_t}</span>
              <span class="link__text" data-i="maps_d">${t.maps_d}</span>
            </span>
            ${ARROW}
          </a>
        </li>`

  const webCard = `
        <li>
          <a class="link" href="${escapeHtml(web.uz)}" ${open} data-t="website" data-web>
            ${icon('globe')}
            ${ARROW}
            <span class="link__body">
              <span class="link__title" data-i="web_t">${t.web_t}</span>
              <span class="link__text"><span class="link__url">school.pdp.uz</span><span data-i="web_d">${t.web_d}</span></span>
            </span>
          </a>
        </li>`

  const botCard = `
        <li>
          <a class="link" href="${escapeHtml(botUrl)}" ${open} data-t="bot">
            ${icon('telegram-logo')}
            ${ARROW}
            <span class="link__body">
              <span class="link__title" data-i="bot_t">${t.bot_t}</span>
              <span class="link__text">${botHandle ? `<span class="link__url">${escapeHtml(botHandle)}</span>` : ''}<span data-i="bot_d">${t.bot_d}</span></span>
            </span>
          </a>
        </li>`

  const playCard = `
        <li>
          <a class="link" href="${escapeHtml(L.play)}" ${open} data-t="google_play">
            ${icon('google-play-logo')}
            ${ARROW}
            <span class="link__body">
              <span class="link__title" data-i="play_t">${t.play_t}</span>
              <span class="link__text" data-i="play_d">${t.play_d}</span>
            </span>
          </a>
        </li>`

  const iosCard = `
        <li>
          <a class="link" href="${escapeHtml(L.ios)}" ${open} data-t="app_store">
            ${icon('app-store-logo')}
            ${ARROW}
            <span class="link__body">
              <span class="link__title" data-i="ios_t">${t.ios_t}</span>
              <span class="link__text" data-i="ios_d">${t.ios_d}</span>
            </span>
          </a>
        </li>`

  const wifiCard = wifi ? `
        <li class="is-wide">
          <button type="button" class="link link--wide" data-t="wifi" data-open="wifi-sheet" aria-haspopup="dialog">
            ${icon('wifi-high')}
            <span class="link__body">
              <span class="link__title" data-i="wifi_t">${t.wifi_t}</span>
              <span class="link__text" data-i="wifi_d">${t.wifi_d}</span>
            </span>
            ${ARROW}
          </button>
        </li>` : ''

  const wifiSheet = wifi ? `
  <dialog class="sheet" id="wifi-sheet" aria-labelledby="wifi-title">
    <div class="sheet__in">
      <div class="sheet__head">
        <h2 class="sheet__title" id="wifi-title" data-i="wifi_h">${t.wifi_h}</h2>
        <button type="button" class="sheet__close" data-close data-label="close" aria-label="${escapeHtml(t.close)}"><svg aria-hidden="true"><use href="#i-x"/></svg></button>
      </div>
      <p class="sheet__text" data-i="wifi_p">${t.wifi_p}</p>
      <div class="kv">
        <div class="kv__body"><span class="kv__label" data-i="ssid">${t.ssid}</span><span class="kv__value">${escapeHtml(wifi.ssid)}</span></div>
        <button type="button" class="kv__copy" data-copy="${escapeHtml(wifi.ssid)}" data-i="copy">${t.copy}</button>
      </div>${wifi.password ? `
      <div class="kv">
        <div class="kv__body"><span class="kv__label" data-i="pass">${t.pass}</span><span class="kv__value">${escapeHtml(wifi.password)}</span></div>
        <button type="button" class="kv__copy" data-copy="${escapeHtml(wifi.password)}" data-i="copy">${t.copy}</button>
      </div>` : ''}
    </div>
  </dialog>` : ''

  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#2168F2">
<meta name="color-scheme" content="light only">
<meta name="robots" content="noindex">
<title>${escapeHtml(t.title)}</title>
<link rel="icon" href="${escapeHtml(PDP_FAVICON)}">
<link rel="preload" href="/pdp/fonts/onest-latin.woff2" as="font" type="font/woff2" crossorigin>
<style>
${PDP_CSS}
</style>
</head>
<body>
<a class="skip" id="skip" href="#links" data-i="skip">${t.skip}</a>

${PDP_SPRITE}

<div class="screen">
  <header class="head">
    <a class="logo" href="${escapeHtml(web.uz)}" ${open} data-t="website" data-web aria-label="PDP School">
      ${PDP_LOGO}
    </a>
    <div class="lang" id="lang" role="group" aria-label="${escapeHtml(t.lang)}">
      <button type="button" data-lang="uz" aria-pressed="true">UZ</button>
      <button type="button" data-lang="ru" aria-pressed="false">RU</button>
      <button type="button" data-lang="en" aria-pressed="false">EN</button>
    </div>
  </header>
  <div class="rule" aria-hidden="true"><i></i><i></i><i></i></div>

  <main class="field">
    ${PDP_MARK}
    <section class="hero">
      <p class="pill"><span class="pill__dot" aria-hidden="true"></span><span data-i="pill">${t.pill}</span></p>
      <h1><span data-i="h1a">${t.h1a}</span> <span data-i="h1b">${t.h1b}</span></h1>
      <p class="lead" data-i="lead">${t.lead}</p>
    </section>

    <nav id="links" class="links-nav" aria-label="${escapeHtml(t.nav)}">
      <ul class="links">${reviewCard}${webCard}${botCard}${playCard}${iosCard}${wifiCard}
      </ul>
    </nav>

    <footer class="foot">
      <p class="foot__brand">PDP School</p>
      <a class="foot__site" href="${escapeHtml(web.uz)}" ${open} data-t="website" data-web>school.pdp.uz <svg aria-hidden="true"><use href="#i-arrow-up-right"/></svg></a>
      <p class="foot__tag" data-i="tag">${t.tag}</p>
    </footer>
  </main>
</div>
${wifiSheet}

<script>
(function(){
  var T = ${jsonForScript(TEXT)};
  var WEB = ${jsonForScript(web)};
  var TOKEN = ${jsonForScript(opts.token ?? null)};
  // тот же ключ, что у общего экрана: выбранный язык помнится между заведениями
  var KEY = 'btc:lang';
  var $ = function(id){ return document.getElementById(id) };
  var each = function(sel, fn){ [].forEach.call(document.querySelectorAll(sel), fn) };

  function initial(){
    var m = location.search.match(/[?&]lang=(uz|ru|en)\\b/);
    if (m) return m[1];
    try { var s = localStorage.getItem(KEY); if (s && T[s]) return s; } catch (e) {}
    var nl = (navigator.language || '').toLowerCase();
    return nl.indexOf('ru') === 0 ? 'ru' : nl.indexOf('en') === 0 ? 'en' : 'uz';
  }

  function apply(l){
    var d = T[l];
    document.documentElement.lang = l;
    document.title = d.title;
    each('[data-i]', function(n){ var v = d[n.getAttribute('data-i')]; if (v != null) n.textContent = v; });
    each('[data-lang]', function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-lang') === l ? 'true' : 'false'); });
    each('[data-web]', function(a){ a.setAttribute('href', WEB[l]); });
    each('[data-label]', function(n){ n.setAttribute('aria-label', d[n.getAttribute('data-label')]); });
    $('links').setAttribute('aria-label', d.nav);
    $('lang').setAttribute('aria-label', d.lang);
  }

  $('lang').addEventListener('click', function(e){
    var b = e.target.closest('[data-lang]'); if (!b) return;
    var l = b.getAttribute('data-lang'); apply(l);
    try { localStorage.setItem(KEY, l); } catch (err) {}
  });
  apply(initial());

  // Нажатия: sendBeacon доживает, даже если вкладка сразу уходит на другой сайт
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('[data-t]') : null;
    if (!a || !TOKEN) return;
    var body = JSON.stringify({ token: TOKEN, target: a.getAttribute('data-t') });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon('/api/track', body);
      else fetch('/api/track', { method: 'POST', body: body, keepalive: true });
    } catch (err) {}
  }, true);

  // Wi-Fi: сеть из браузера не подключить, поэтому показываем имя и пароль с кнопкой «копировать»
  var sheet = $('wifi-sheet');
  if (sheet) {
    each('[data-open]', function(b){
      b.addEventListener('click', function(){
        if (sheet.showModal) sheet.showModal(); else sheet.setAttribute('open', '');
      });
    });
    sheet.addEventListener('click', function(e){
      if (e.target === sheet || e.target.closest('[data-close]')) { if (sheet.close) sheet.close(); else sheet.removeAttribute('open'); }
    });
    each('[data-copy]', function(b){
      b.addEventListener('click', function(){
        var v = b.getAttribute('data-copy'), d = T[document.documentElement.lang] || T.uz;
        function done(){ b.textContent = d.copied; setTimeout(function(){ b.textContent = d.copy; }, 1600); }
        // запасной путь для браузеров без Clipboard API и для случаев, когда он отказал
        function legacy(){
          var i = document.createElement('input'), ok = false;
          i.value = v; i.setAttribute('readonly', '');
          i.style.position = 'fixed'; i.style.opacity = '0';
          document.body.appendChild(i); i.select(); i.setSelectionRange(0, v.length);
          try { ok = document.execCommand('copy'); } catch (err) {}
          document.body.removeChild(i);
          if (ok) done();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, legacy);
        else legacy();
      });
    });
  }
})();
</script>
</body>
</html>`
}
