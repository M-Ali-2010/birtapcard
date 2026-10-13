/**
 * Оформление экрана ссылок PDP School: стили, иконки Phosphor (Regular), логотип и знак.
 * Взято из макета PDP-School-havolalar-ekrani.html (school.pdp.uz style.css + PDP Design System v1.0).
 * Шрифт Onest лежит в public/pdp/fonts — файлы отдаются как статика, а не вшиваются в каждый ответ.
 */

export const PDP_CSS = `/* ── Onest (subset со school.pdp.uz, SIL OFL); файлы лежат в public/pdp/fonts ── */
@font-face{font-family:"Onest";font-style:normal;font-weight:100 900;font-display:swap;
  src:url(/pdp/fonts/onest-cyrillic.woff2) format("woff2");
  unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}
@font-face{font-family:"Onest";font-style:normal;font-weight:100 900;font-display:swap;
  src:url(/pdp/fonts/onest-latin.woff2) format("woff2");
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}

/* ── Tokens — school.pdp.uz style.css + PDP Design System v1.0 ──────────── */
:root{
  --white:#fff;
  --blue:#2168F2;            /* brand blue: field start, icon glyphs, CTA */
  --navy:#0B1240;            /* text colour, never a big plane here */
  --navy2:#000C7A;           /* field end, shadow colour */
  --indigo:#1F50D4;          /* 3rd part of the PDP rule */
  --yellow:#FFC700;          /* 1st part of the PDP rule, dot, focus on the field */
  --pink:#FF0064;            /* 2nd part of the PDP rule */
  --page:#E6EAF5;            /* desktop backdrop only */
  --tint:rgba(33,104,242,.10);        /* icon tile */
  --muted:rgba(11,18,64,.66);         /* caption on white, 6.1:1 */
  --on-field:rgba(255,255,255,.88);   /* lead on the field */
  --field:linear-gradient(124deg,var(--blue) -10%,var(--navy2) 131%);

  --r-panel:24px; --r-icon:12px; --r-pill:999px;
  --ease:cubic-bezier(.4,0,.2,1);

  --gutter:clamp(18px,5.2vw,24px);
  --fs-hero:clamp(34px,20.5px + 4.22vw,44px);
  --fs-lead:clamp(15.5px,14.6px + .24vw,17px);
}

*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--page);color:var(--navy);
  font-family:"Onest",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.45;
  -webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
button{font:inherit;cursor:pointer}
ul{list-style:none;margin:0;padding:0}
p,h1{margin:0}
svg{display:block;flex:none}

:focus-visible{outline:3px solid var(--blue);outline-offset:3px;border-radius:6px}
.field :focus-visible{outline-color:var(--yellow)}
.skip{position:absolute;left:-9999px;top:0;z-index:10;padding:12px 20px;border-radius:0 0 12px 0;
  background:var(--blue);color:#fff;font-weight:600}
.skip:focus{left:0}

/* ── Screen: 390 reference, fluid 320–430 ───────────────────────────────── */
.screen{position:relative;display:flex;flex-direction:column;width:100%;max-width:430px;margin-inline:auto;
  min-height:100vh;min-height:100dvh;background:#fff}
@media (min-width:520px){
  /* desktop preview: the column stays the 390 reference, so fluid sizes are pinned to their 390 values */
  :root{--gutter:20px;--fs-hero:37px;--fs-lead:15.5px}
  .screen{width:390px;max-width:none;box-shadow:0 30px 80px rgba(0,12,122,.22)}
}

/* ── Header (same as school.pdp.uz): logo + language pill ───────────────── */
.head{display:flex;align-items:center;justify-content:space-between;gap:14px;
  padding:13px var(--gutter);padding-top:max(13px,env(safe-area-inset-top));background:#fff}
.logo{display:block;width:107px;height:38px;border-radius:6px}
.logo svg{width:107px;height:38px}
.logo .c-blue{fill:var(--blue)}
.logo .c-navy{fill:var(--navy)}

.lang{display:flex;align-items:center;gap:2px;padding:3px;border-radius:var(--r-pill);background:rgba(11,18,64,.06)}
.lang button{min-width:44px;min-height:44px;padding:6px 12px;border:0;border-radius:var(--r-pill);background:none;
  font-size:13px;font-weight:600;letter-spacing:.02em;color:var(--muted);
  transition:background .15s var(--ease),color .15s var(--ease)}
.lang button[aria-pressed="true"]{background:#fff;color:var(--navy);font-weight:800;box-shadow:0 1px 3px rgba(11,18,64,.18)}

/* PDP RULE — once per screen, directly under the header, 31 / 36 / 33 */
.rule{display:flex;height:4px}
.rule i{display:block;height:100%}
.rule i:nth-child(1){flex:31;background:var(--yellow)}
.rule i:nth-child(2){flex:36;background:var(--pink)}
.rule i:nth-child(3){flex:33;background:var(--indigo)}

/* ── The bright blue field ──────────────────────────────────────────────── */
.field{position:relative;flex:1;display:flex;flex-direction:column;overflow:hidden;
  padding:26px var(--gutter) 0;color:#fff;background:var(--field)}
.mark{position:absolute;right:-190px;top:-78px;width:480px;height:auto;opacity:.08;pointer-events:none;
  -webkit-mask-image:linear-gradient(180deg,#000 0,#000 40%,transparent 66%);
          mask-image:linear-gradient(180deg,#000 0,#000 40%,transparent 66%)}
.hero,.links-nav,.foot{position:relative}
.links-nav{margin-bottom:28px}

.pill{display:inline-flex;align-items:center;gap:9px;padding:8px 16px 8px 12px;border-radius:var(--r-pill);
  border:1px solid rgba(255,255,255,.34);background:rgba(255,255,255,.10);font-size:13.5px;font-weight:600}
.pill__dot{width:7px;height:7px;border-radius:50%;background:var(--yellow)}

h1{margin-top:16px;font-size:var(--fs-hero);font-weight:800;line-height:1.04;letter-spacing:-.045em}
h1 span{display:block}
.lead{margin-top:14px;max-width:34ch;font-size:var(--fs-lead);line-height:1.5;color:var(--on-field);text-wrap:pretty}

/* ── Link cards ─────────────────────────────────────────────────────────── */
.links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:28px;
  filter:drop-shadow(0 16px 24px rgba(0,12,122,.26))}   /* blue shadow, once for the whole group */
.links>li{display:flex;min-width:0}
.links>li.is-wide{grid-column:1/-1}

.link{flex:1;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto;
  grid-template-areas:"ico go" "body body";align-content:start;row-gap:16px;
  min-height:150px;padding:16px;border-radius:var(--r-panel);background:var(--white);color:var(--navy);
  -webkit-tap-highlight-color:transparent;transition:transform .15s var(--ease)}
.link__ico{grid-area:ico;display:grid;place-items:center;width:40px;height:40px;border-radius:var(--r-icon);
  background:var(--tint);color:var(--blue);transition:background .15s var(--ease),color .15s var(--ease)}
.link__ico svg{width:20px;height:20px}
.link__go{grid-area:go;display:grid;place-items:center;width:20px;height:20px;margin:10px 4px 0 0;
  color:rgba(11,18,64,.5);transition:color .15s var(--ease),transform .15s var(--ease)}
.link__go svg{width:20px;height:20px}
.link__body{grid-area:body;min-width:0}
.link__title{display:block;font-size:16px;font-weight:800;line-height:1.2;letter-spacing:-.02em}
.link__text{display:block;margin-top:5px;font-size:13px;line-height:1.38;color:var(--muted);text-wrap:balance}
.link__url{display:block;font-weight:700;color:var(--blue)}

.link--wide{grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"ico body go";
  align-items:center;column-gap:14px;min-height:0;padding:16px}
.link--wide .link__go{margin:0 4px 0 0}

/* the one primary card: Google Maps (= "Sharh qoldiring") */
.link--primary{padding:18px 18px 18px 18px;column-gap:16px}
.link--primary .link__ico{width:48px;height:48px;border-radius:14px;background:var(--blue);color:#fff}
.link--primary .link__ico svg{width:24px;height:24px}
.link--primary .link__go{width:40px;height:40px;margin:0;border-radius:var(--r-pill);background:var(--blue);color:#fff}
.link--primary .link__title{font-size:18px}
.link--primary .link__text{font-size:13.5px}

@media (hover:hover){
  .link:hover{transform:translateY(-2px)}
  .link:hover .link__ico{background:var(--blue);color:#fff}
  .link:hover .link__go{color:var(--blue);transform:translate(2px,-2px)}
  .link--primary:hover .link__go{color:#fff}
}
.link:active{transform:translateY(0) scale(.985)}

/* ── Footer ─────────────────────────────────────────────────────────────── */
.foot{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"brand site" "tag tag";
  align-items:center;column-gap:16px;margin-top:auto;
  padding:8px 0 max(24px,env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.18)}
.foot__brand{grid-area:brand;font-size:12.5px;font-weight:700;letter-spacing:.17em;text-transform:uppercase}
.foot__tag{grid-area:tag;margin-top:0;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.76)}
.foot__site{grid-area:site;display:inline-flex;align-items:center;gap:6px;min-height:44px;font-size:14.5px;font-weight:700;letter-spacing:-.01em}
.foot__site svg{width:16px;height:16px}

@media (prefers-reduced-motion:reduce){
  *{transition:none !important}
  .link:hover,.link:active{transform:none}
}

/* ── Wi-Fi: карточка-кнопка и шторка (на вебе сеть сама не подключается — показываем имя и пароль) ── */
button.link{appearance:none;-webkit-appearance:none;border:0;width:100%;text-align:left;font:inherit;color:var(--navy)}
.sheet{width:100%;max-width:430px;margin:auto auto 0;padding:0;border:0;border-radius:var(--r-panel) var(--r-panel) 0 0;
  background:#fff;color:var(--navy);box-shadow:0 -16px 48px rgba(0,12,122,.28)}
.sheet::backdrop{background:rgba(11,18,64,.52)}
.sheet__in{padding:22px var(--gutter) max(24px,env(safe-area-inset-bottom))}
.sheet__head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.sheet__title{margin:0;font-size:20px;font-weight:800;letter-spacing:-.03em}
.sheet__close{display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:var(--r-pill);
  background:rgba(11,18,64,.06);color:var(--navy)}
.sheet__close svg{width:18px;height:18px}
.sheet__text{margin-top:6px;font-size:14px;line-height:1.45;color:var(--muted)}
.kv{display:flex;align-items:center;gap:12px;margin-top:12px;padding:12px 12px 12px 16px;border-radius:16px;background:var(--tint)}
.kv__body{flex:1;min-width:0}
.kv__label{display:block;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.kv__value{display:block;margin-top:2px;font-size:18px;font-weight:800;letter-spacing:-.02em;overflow-wrap:anywhere}
.kv__copy{flex:none;min-height:44px;padding:0 16px;border:0;border-radius:var(--r-pill);background:var(--blue);color:#fff;
  font-size:14px;font-weight:700}
.kv__copy:focus-visible{outline-color:var(--navy)}
@media (prefers-reduced-motion:no-preference){
  .sheet[open]{animation:sheet-up .28s var(--ease)}
  @keyframes sheet-up{from{transform:translateY(24px);opacity:0}}
}`

/** Спрайт иконок: подключается через <use href="#i-…"> */
export const PDP_SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <symbol id="i-map-pin" viewBox="0 0 256 256" fill="currentColor"><path d="M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z"/></symbol>
    <symbol id="i-globe" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.27,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"/></symbol>
    <symbol id="i-telegram-logo" viewBox="0 0 256 256" fill="currentColor"><path d="M228.88,26.19a9,9,0,0,0-9.16-1.57L17.06,103.93a14.22,14.22,0,0,0,2.43,27.21L72,141.45V200a15.92,15.92,0,0,0,10,14.83,15.91,15.91,0,0,0,17.51-3.73l25.32-26.26L165,220a15.88,15.88,0,0,0,10.51,4,16.3,16.3,0,0,0,5-.79,15.85,15.85,0,0,0,10.67-11.63L231.77,35A9,9,0,0,0,228.88,26.19Zm-61.14,36L78.15,126.35l-49.6-9.73ZM88,200V152.52l24.79,21.74Zm87.53,8L92.85,135.5l119-85.29Z"/></symbol>
    <symbol id="i-google-play-logo" viewBox="0 0 256 256" fill="currentColor"><path d="M239.82,114.19,72,18.16a16,16,0,0,0-16.12,0A15.68,15.68,0,0,0,48,31.87V224.13a15.68,15.68,0,0,0,7.92,13.67,16,16,0,0,0,16.12,0l167.78-96a15.75,15.75,0,0,0,0-27.62ZM64,212.67V43.33L148.69,128Zm96-73.36,18.92,18.92-88.5,50.66ZM90.4,47.1l88.53,50.67L160,116.69ZM193.31,150l-22-22,22-22,38.43,22Z"/></symbol>
    <symbol id="i-app-store-logo" viewBox="0 0 256 256" fill="currentColor"><path d="M64.34,196.07l-9.45,16a8,8,0,1,1-13.78-8.14l9.46-16a8,8,0,1,1,13.77,8.14ZM232,152H184.2l-30.73-52a8,8,0,1,0-13.77,8.14l61.41,103.93a8,8,0,0,0,13.78-8.14L193.66,168H232a8,8,0,0,0,0-16Zm-89.53,0H90.38L158.89,36.07a8,8,0,0,0-13.78-8.14L128,56.89l-17.11-29a8,8,0,1,0-13.78,8.14l21.6,36.55L71.8,152H24a8,8,0,0,0,0,16H142.47a8,8,0,1,0,0-16Z"/></symbol>
    <symbol id="i-wifi-high" viewBox="0 0 256 256" fill="currentColor"><path d="M140,204a12,12,0,1,1-12-12A12,12,0,0,1,140,204ZM237.08,87A172,172,0,0,0,18.92,87,8,8,0,0,0,29.08,99.37a156,156,0,0,1,197.84,0A8,8,0,0,0,237.08,87ZM205,122.77a124,124,0,0,0-153.94,0A8,8,0,0,0,61,135.31a108,108,0,0,1,134.06,0,8,8,0,0,0,11.24-1.3A8,8,0,0,0,205,122.77Zm-32.26,35.76a76.05,76.05,0,0,0-89.42,0,8,8,0,0,0,9.42,12.94,60,60,0,0,1,70.58,0,8,8,0,1,0,9.42-12.94Z"/></symbol>
    <symbol id="i-arrow-up-right" viewBox="0 0 256 256" fill="currentColor"><path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"/></symbol>
      <symbol id="i-x" viewBox="0 0 256 256" fill="currentColor"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></symbol>
  </defs>
</svg>`

/** Логотип PDP School, три части, цвета через классы .c-blue / .c-navy */
export const PDP_LOGO = `<svg viewBox="0 0 107 38" width="107" height="38" aria-hidden="true" focusable="false">
        <g class="c-blue" transform="scale(.52044)"><path d="M 36.517 0 C 52.435 0 65.973 10.19 70.964 24.402 C 68.898 23.943 60.829 23.629 55.225 24.221 C 51.38 18.205 44.341 14.122 36.517 14.122 C 26.833 14.122 18.586 20.274 15.47 28.882 C 15.06 30.012 15.819 31.192 17.008 31.375 C 38.486 34.684 60.444 28.368 71.409 31.569 C 71.951 31.727 72.8 31.914 72.897 32.85 C 72.952 33.378 73.017 36.5 73.017 36.5 C 73.017 56.658 56.675 73 36.517 73 C 19.825 73 5.75 61.795 1.403 46.497 C 6.726 47.395 11.777 48.22 17.482 48.268 C 21.427 54.635 28.476 58.877 36.517 58.877 C 46.454 58.877 54.878 52.399 57.797 43.436 C 58.191 42.225 57.276 41.033 56.003 41.008 C 42.863 40.752 31.313 44.399 2.544 39.418 C 1.268 39.155 -0.001 38.126 0 36.715 C 0 16.257 16.497 0 36.517 0 Z"/><path d="M 27.409 47.871 C 27.584 46.31 28.99 45.187 30.551 45.361 C 32.111 45.536 33.234 46.942 33.06 48.502 C 32.938 49.591 32.217 50.466 31.261 50.837 C 31.097 51.067 30.944 51.39 30.807 51.916 C 29.172 59.039 21.958 63.87 14.418 62.095 L 11.793 61.477 L 12.327 59.213 L 14.951 59.831 C 21.063 61.27 26.919 57.473 28.443 51.783 C 28.634 50.999 28.557 50.631 28.385 50.346 C 27.695 49.754 27.3 48.842 27.409 47.871 Z"/><path d="M 41.813 21.493 C 43.445 14.366 50.663 9.532 58.205 11.307 L 60.829 11.925 L 60.296 14.189 L 57.671 13.571 C 51.564 12.133 45.713 15.923 44.183 21.605 C 44.027 22.238 44.043 22.603 44.144 22.87 C 44.983 23.445 45.485 24.451 45.365 25.532 C 45.19 27.092 43.784 28.217 42.224 28.042 C 40.663 27.868 39.539 26.461 39.714 24.901 C 39.825 23.902 40.443 23.083 41.281 22.668 C 41.474 22.434 41.654 22.099 41.813 21.493 Z"/><path d="M 40.726 47.685 C 40.901 46.124 42.307 45 43.867 45.174 C 45.428 45.349 46.551 46.756 46.377 48.316 C 46.267 49.294 45.673 50.1 44.861 50.523 C 44.594 50.788 44.357 51.153 44.202 52.086 C 44.198 52.109 44.186 52.129 44.169 52.149 C 42.687 59.373 36.293 64.85 28.58 64.85 L 20.367 64.85 L 20.367 62.524 L 28.579 62.524 C 35.299 62.524 40.847 57.655 41.962 51.301 C 42.036 50.369 41.591 50.217 41.244 49.66 C 40.847 49.108 40.645 48.413 40.726 47.685 Z"/><path d="M 52.145 10.62 L 43.934 10.62 C 37.214 10.62 31.666 15.488 30.55 21.842 C 30.499 22.483 30.692 22.755 30.931 23.043 C 31.63 23.634 32.031 24.552 31.922 25.53 C 31.748 27.091 30.341 28.215 28.78 28.04 C 27.22 27.866 26.097 26.459 26.271 24.899 C 26.336 24.318 26.571 23.797 26.922 23.381 C 27.452 22.566 28.021 22.796 28.311 21.06 C 28.314 21.037 28.325 21.016 28.342 20.997 C 29.824 13.772 36.22 8.294 43.934 8.294 L 52.146 8.293 L 52.145 10.62 Z"/></g>
        <g class="c-navy" transform="translate(47.7 2.7) scale(.52113)"><path d="M 5.784 17.144 L 5.784 24.845 L 0 24.845 L 0 0 L 12.684 0 C 15.855 0 18.329 0.314 20.245 0.906 C 24.043 2.16 25.611 4.669 25.611 8.746 C 25.611 14.356 21.569 17.179 13.241 17.144 L 5.784 17.144 Z M 5.784 4.913 L 5.784 12.231 L 12.893 12.231 C 17.98 12.231 19.722 11.429 19.722 8.711 C 19.722 7.527 19.479 6.725 18.956 6.202 C 17.98 5.122 15.924 4.913 12.719 4.913 L 5.784 4.913 Z"/><path d="M 28.491 0 L 40.06 0 C 50.27 0 55.497 3.694 55.497 12.475 L 55.497 12.649 C 55.497 21.29 50.27 24.845 40.409 24.845 L 28.491 24.845 L 28.491 0 Z M 34.276 5.053 L 34.276 19.757 L 40.095 19.757 C 42.43 19.757 44.241 19.513 45.635 19.06 C 48.388 18.12 49.538 16.099 49.538 12.544 L 49.538 12.44 C 49.538 10.628 49.19 9.234 48.597 8.119 C 47.273 5.959 44.59 5.053 39.816 5.053 L 34.276 5.053 Z"/><path d="M 64.605 17.144 L 64.605 24.845 L 58.82 24.845 L 58.82 0 L 71.504 0 C 74.675 0 77.149 0.314 79.066 0.906 C 82.864 2.16 84.432 4.669 84.432 8.746 C 84.432 14.356 80.39 17.179 72.062 17.144 L 64.605 17.144 Z M 64.605 4.913 L 64.605 12.231 L 71.713 12.231 C 76.801 12.231 78.543 11.429 78.543 8.711 C 78.543 7.527 78.299 6.725 77.776 6.202 C 76.801 5.122 74.745 4.913 71.539 4.913 L 64.605 4.913 Z"/></g>
        <g class="c-blue" transform="translate(46.8 20.5) scale(.52087)"><path d="M 10.175 27.179 C 7.736 27.179 5.854 26.831 4.356 26.134 C 1.429 24.74 0.139 22.022 0 18.294 L 3.624 18.294 C 3.728 22.092 5.68 24.148 10.21 24.148 C 11.569 24.148 12.649 23.939 13.52 23.521 C 15.262 22.684 16.029 21.29 16.029 19.757 C 16.029 18.677 15.715 17.841 15.053 17.283 C 13.729 16.168 11.534 15.715 9.164 15.297 C 7.143 14.879 5.157 14.426 3.554 13.485 C 1.951 12.509 0.941 10.976 0.941 8.363 C 0.941 7.143 1.289 6.028 1.882 4.948 C 3.206 2.857 5.715 1.464 9.548 1.464 C 15.715 1.464 18.712 4.356 18.956 9.129 L 15.436 9.129 C 15.262 5.993 13.415 4.356 9.478 4.356 C 5.993 4.356 4.356 6.168 4.356 8.328 C 4.356 9.339 4.704 10.105 5.296 10.628 C 6.551 11.638 8.711 12.022 11.046 12.544 C 13.102 12.962 15.158 13.45 16.761 14.426 C 18.398 15.402 19.444 16.97 19.444 19.688 C 19.444 21.047 19.095 22.301 18.398 23.416 C 17.004 25.716 14.287 27.179 10.175 27.179 Z"/><path d="M 31.766 27.179 C 25.459 27.179 21.835 23.451 21.835 17.039 L 21.835 16.586 C 21.835 14.356 22.288 12.544 23.159 10.941 C 24.901 7.875 28.003 6.202 31.801 6.202 C 37.062 6.202 40.756 8.781 41.348 14.321 L 41.348 14.391 L 37.829 14.391 L 37.829 14.321 C 37.271 10.767 35.111 9.129 31.836 9.129 C 28.003 9.129 25.319 11.778 25.319 16.586 L 25.319 16.97 C 25.319 21.5 27.724 24.148 31.801 24.148 C 35.25 24.148 37.271 22.406 37.864 18.956 L 37.864 18.921 L 41.383 18.921 L 41.383 18.991 C 40.791 24.636 37.097 27.179 31.766 27.179 Z"/><path d="M 47.773 26.657 L 44.532 26.657 L 44.532 0 L 47.773 0 L 47.773 10.767 C 48.992 8.014 51.431 6.202 54.986 6.202 C 60.108 6.202 62.617 9.408 62.617 14.496 L 62.617 26.657 L 59.237 26.657 L 59.237 15.332 C 59.237 11.673 57.703 9.164 53.766 9.164 C 49.933 9.164 47.773 12.056 47.773 16.203 L 47.773 26.657 Z"/><path d="M 75.683 27.179 C 69.341 27.179 65.717 23.451 65.717 17.039 L 65.717 16.586 C 65.717 14.356 66.17 12.544 67.006 10.941 C 68.748 7.875 71.85 6.202 75.683 6.202 C 77.634 6.202 79.341 6.621 80.84 7.457 C 83.871 9.095 85.648 12.196 85.648 16.586 L 85.648 17.039 C 85.648 19.2 85.23 20.977 84.429 22.51 C 82.756 25.542 79.759 27.179 75.683 27.179 Z M 75.683 24.148 C 79.829 24.148 82.199 21.5 82.199 16.97 L 82.199 16.586 C 82.199 11.952 79.55 9.129 75.683 9.129 C 71.85 9.129 69.166 11.778 69.166 16.586 L 69.166 16.97 C 69.166 21.5 71.571 24.148 75.683 24.148 Z"/><path d="M 98.185 27.179 C 91.843 27.179 88.219 23.451 88.219 17.039 L 88.219 16.586 C 88.219 14.356 88.672 12.544 89.508 10.941 C 91.251 7.875 94.352 6.202 98.185 6.202 C 100.136 6.202 101.844 6.621 103.342 7.457 C 106.374 9.095 108.151 12.196 108.151 16.586 L 108.151 17.039 C 108.151 19.2 107.733 20.977 106.931 22.51 C 105.259 25.542 102.262 27.179 98.185 27.179 Z M 98.185 24.148 C 102.332 24.148 104.701 21.5 104.701 16.97 L 104.701 16.586 C 104.701 11.952 102.053 9.129 98.185 9.129 C 94.352 9.129 91.669 11.778 91.669 16.586 L 91.669 16.97 C 91.669 21.5 94.073 24.148 98.185 24.148 Z"/><path d="M 111.427 26.657 L 111.427 0 L 114.807 0 L 114.807 26.657 L 111.427 26.657 Z"/></g>
      </svg>`

/** Знак PDP — водяной на синем поле, белый 8 % */
export const PDP_MARK = `<svg class="mark" viewBox="0 0 1291 1290" aria-hidden="true" focusable="false" fill="#fff"><path d="M645.514 0C926.59 0.000174075 1165.65 179.892 1253.84 430.823C1150.38 424.046 1053.37 426.678 975.883 427.638C905.226 320.282 783.646 249.419 645.516 249.419C459.738 249.419 303.897 377.604 261.618 550.353C663.118 622.85 1091.63 501.747 1285.68 568.66C1286.07 568.794 1286.32 569.066 1286.36 569.476C1286.55 571.595 1287.19 579.219 1287.8 590.68C1287.84 590.695 1287.88 590.709 1287.92 590.724C1289.39 608.498 1290.15 626.476 1290.15 644.63C1290.15 1000.65 1001.53 1289.26 645.514 1289.26C350.708 1289.26 102.122 1091.36 25.3553 821.164C119.342 837.011 208.535 851.612 309.293 852.451C378.961 964.925 503.489 1039.84 645.516 1039.84C836.37 1039.84 995.625 904.561 1032.62 724.656C720.125 722.158 214.077 772.281 1.54866 683.697C0.802544 683.386 0.349907 682.716 0.314287 681.908C-0.29016 668.175 0.0037439 651.87 0.968584 634.455C6.40486 283.128 292.893 0.000126799 645.514 0Z"/><path d="M484.353 845.464C487.433 817.905 512.271 798.061 539.83 801.141C567.389 804.222 587.233 829.06 584.152 856.619C582.001 875.868 569.232 891.35 552.338 897.889C549.614 901.711 547.044 906.999 544.729 915.357C516.561 1042.01 388.617 1128.15 254.91 1096.68L208.56 1085.77L217.976 1045.78L264.329 1056.69C372.498 1082.16 476.114 1014.77 502.776 913.94C505.94 900.618 504.633 894.204 501.687 889.264C489.442 878.811 482.43 862.668 484.353 845.464Z"/><path d="M738.309 381.273C766.362 254.482 894.389 168.197 1028.19 199.696L1074.54 210.605L1065.12 250.595L1018.77 239.679C910.733 214.248 807.239 281.433 780.419 382.058C777.795 392.921 778.105 399.248 779.856 403.898C794.677 414.047 803.553 431.835 801.419 450.933C798.338 478.492 773.5 498.335 745.941 495.255C718.382 492.174 698.539 467.336 701.619 439.777C703.596 422.089 714.537 407.579 729.407 400.269C732.607 396.361 735.63 390.855 738.309 381.273Z"/><path d="M719.622 842.035C722.703 814.476 747.541 794.632 775.1 797.712C802.658 800.793 822.502 825.631 819.422 853.19C817.489 870.486 806.984 884.742 792.616 892.201C787.907 896.877 783.752 903.339 781.012 919.779C780.944 920.184 780.747 920.555 780.438 920.896C754.266 1048.48 641.321 1145.2 505.093 1145.2L360.049 1145.2L360.056 1104.12L505.092 1104.12C623.826 1104.12 721.841 1018.07 741.485 905.779C742.737 889.429 734.869 886.748 728.758 876.926C721.746 867.182 718.183 854.905 719.622 842.035Z"/><path d="M921.37 187.379L776.353 187.38C657.656 187.38 559.658 273.373 539.96 385.609C539.062 396.909 542.495 401.713 546.717 406.793C559.053 417.241 566.13 433.445 564.199 450.718C561.118 478.277 536.28 498.121 508.721 495.041C481.163 491.96 461.319 467.122 464.399 439.563C465.547 429.296 469.715 420.1 475.919 412.76C485.282 398.372 495.314 402.411 500.424 371.756C500.49 371.36 500.679 370.994 500.977 370.66C527.136 243.049 640.1 146.3 776.352 146.3L921.377 146.296L921.37 187.379Z"/></svg>`

export const PDP_FAVICON = `data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2273.017%22%20height%3D%2273%22%20viewBox%3D%220%200%2073.017%2073%22%20fill%3D%22%232168F2%22%3E%20%3Cpath%20d%3D%22M%2036.517%200%20C%2052.435%200%2065.973%2010.19%2070.964%2024.402%20C%2068.898%2023.943%2060.829%2023.629%2055.225%2024.221%20C%2051.38%2018.205%2044.341%2014.122%2036.517%2014.122%20C%2026.833%2014.122%2018.586%2020.274%2015.47%2028.882%20C%2015.06%2030.012%2015.819%2031.192%2017.008%2031.375%20C%2038.486%2034.684%2060.444%2028.368%2071.409%2031.569%20C%2071.951%2031.727%2072.8%2031.914%2072.897%2032.85%20C%2072.952%2033.378%2073.017%2036.5%2073.017%2036.5%20C%2073.017%2056.658%2056.675%2073%2036.517%2073%20C%2019.825%2073%205.75%2061.795%201.403%2046.497%20C%206.726%2047.395%2011.777%2048.22%2017.482%2048.268%20C%2021.427%2054.635%2028.476%2058.877%2036.517%2058.877%20C%2046.454%2058.877%2054.878%2052.399%2057.797%2043.436%20C%2058.191%2042.225%2057.276%2041.033%2056.003%2041.008%20C%2042.863%2040.752%2031.313%2044.399%202.544%2039.418%20C%201.268%2039.155%20-0.001%2038.126%200%2036.715%20C%200%2016.257%2016.497%200%2036.517%200%20Z%22%20fill%3D%22%232168F2%22%20fill-rule%3D%22nonzero%22%3E%3C/path%3E%20%3Cpath%20d%3D%22M%2027.409%2047.871%20C%2027.584%2046.31%2028.99%2045.187%2030.551%2045.361%20C%2032.111%2045.536%2033.234%2046.942%2033.06%2048.502%20C%2032.938%2049.591%2032.217%2050.466%2031.261%2050.837%20C%2031.097%2051.067%2030.944%2051.39%2030.807%2051.916%20C%2029.172%2059.039%2021.958%2063.87%2014.418%2062.095%20L%2011.793%2061.477%20L%2012.327%2059.213%20L%2014.951%2059.831%20C%2021.063%2061.27%2026.919%2057.473%2028.443%2051.783%20C%2028.634%2050.999%2028.557%2050.631%2028.385%2050.346%20C%2027.695%2049.754%2027.3%2048.842%2027.409%2047.871%20Z%22%20fill%3D%22%232168F2%22%20fill-rule%3D%22nonzero%22%3E%3C/path%3E%20%3Cpath%20d%3D%22M%2041.813%2021.493%20C%2043.445%2014.366%2050.663%209.532%2058.205%2011.307%20L%2060.829%2011.925%20L%2060.296%2014.189%20L%2057.671%2013.571%20C%2051.564%2012.133%2045.713%2015.923%2044.183%2021.605%20C%2044.027%2022.238%2044.043%2022.603%2044.144%2022.87%20C%2044.983%2023.445%2045.485%2024.451%2045.365%2025.532%20C%2045.19%2027.092%2043.784%2028.217%2042.224%2028.042%20C%2040.663%2027.868%2039.539%2026.461%2039.714%2024.901%20C%2039.825%2023.902%2040.443%2023.083%2041.281%2022.668%20C%2041.474%2022.434%2041.654%2022.099%2041.813%2021.493%20Z%22%20fill%3D%22%232168F2%22%20fill-rule%3D%22nonzero%22%3E%3C/path%3E%20%3Cpath%20d%3D%22M%2040.726%2047.685%20C%2040.901%2046.124%2042.307%2045%2043.867%2045.174%20C%2045.428%2045.349%2046.551%2046.756%2046.377%2048.316%20C%2046.267%2049.294%2045.673%2050.1%2044.861%2050.523%20C%2044.594%2050.788%2044.357%2051.153%2044.202%2052.086%20C%2044.198%2052.109%2044.186%2052.129%2044.169%2052.149%20C%2042.687%2059.373%2036.293%2064.85%2028.58%2064.85%20L%2020.367%2064.85%20L%2020.367%2062.524%20L%2028.579%2062.524%20C%2035.299%2062.524%2040.847%2057.655%2041.962%2051.301%20C%2042.036%2050.369%2041.591%2050.217%2041.244%2049.66%20C%2040.847%2049.108%2040.645%2048.413%2040.726%2047.685%20Z%22%20fill%3D%22%232168F2%22%20fill-rule%3D%22nonzero%22%3E%3C/path%3E%20%3Cpath%20d%3D%22M%2052.145%2010.62%20L%2043.934%2010.62%20C%2037.214%2010.62%2031.666%2015.488%2030.55%2021.842%20C%2030.499%2022.483%2030.692%2022.755%2030.931%2023.043%20C%2031.63%2023.634%2032.031%2024.552%2031.922%2025.53%20C%2031.748%2027.091%2030.341%2028.215%2028.78%2028.04%20C%2027.22%2027.866%2026.097%2026.459%2026.271%2024.899%20C%2026.336%2024.318%2026.571%2023.797%2026.922%2023.381%20C%2027.452%2022.566%2028.021%2022.796%2028.311%2021.06%20C%2028.314%2021.037%2028.325%2021.016%2028.342%2020.997%20C%2029.824%2013.772%2036.22%208.294%2043.934%208.294%20L%2052.146%208.293%20L%2052.145%2010.62%20Z%22%20fill%3D%22%232168F2%22%20fill-rule%3D%22nonzero%22%3E%3C/path%3E%20%3C/svg%3E`
