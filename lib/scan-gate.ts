/**
 * Страница-«шлюз» между сканированием и Google Reviews.
 *
 * Зачем она нужна:
 *  гость приложил телефон → мы записали скан → отправили его в Google.
 *  Дальше страница Google уже не наша, показать там ничего нельзя.
 *  Поэтому мы остаёмся в истории браузера: когда гость закончит с отзывом
 *  и вернётся назад (или переключится обратно во вкладку, если Google
 *  открылся в приложении Карт) — он попадает сюда снова и видит
 *  предложение подписаться на Instagram заведения.
 *
 * Важно: сам этот адрес НЕ пишет событие в базу. Скан фиксируется один раз
 * в /r/nfc/[token] и /r/qr/[token], а сюда можно возвращаться сколько угодно —
 * статистика от этого не поедет.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderScanGate(opts: {
  token: string
  branchName: string
  googleUrl: string
  instagramUrl?: string | null
  yandexUrl?: string | null
  gisUrl?: string | null
  telegramUrl?: string | null
}): string {
  const name = escapeHtml(opts.branchName)
  const key = JSON.stringify('btc_gate_' + opts.token)

  // Ссылки подставляются и в href, и в JS — экранируем для обоих контекстов
  const g = escapeHtml(opts.googleUrl)
  const hasIg = !!opts.instagramUrl
  const hasYa = !!opts.yandexUrl
  const hasGis = !!opts.gisUrl
  const hasTg = !!opts.telegramUrl
  const hasFollow = hasIg || hasTg

  // Заголовок зависит от того, есть ли Instagram: подписка или только отзывы
  const hasFollowJs = hasFollow ? 'true' : 'false'
  const headingRu = hasFollow
    ? 'Оставьте отзыв<br>и подпишитесь'
    : 'Оставьте, пожалуйста,<br>отзыв о нас'

  const yandexBtn = hasYa ? `
  <a class="btn btn-ya rev" data-k="ya" href="${escapeHtml(opts.yandexUrl!)}" target="_blank" rel="noopener">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>
    </svg>
    <span id="yaText">Отзыв на Яндекс Картах</span><span class="ok">✓</span>
  </a>
` : ''

  const gisBtn = hasGis ? `
  <a class="btn btn-gis rev" data-k="gis" href="${escapeHtml(opts.gisUrl!)}" target="_blank" rel="noopener">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>
    </svg>
    <span id="gisText">Отзыв в 2ГИС</span><span class="ok">✓</span>
  </a>
` : ''

  const igBtn = hasIg ? `
  <a class="btn" id="go" href="${escapeHtml(opts.instagramUrl!)}" rel="noopener">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/>
      <circle cx="12" cy="12" r="4.2"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
    <span id="btnText">Подписаться в Instagram</span>
  </a>
` : ''

  const tgBtn = hasTg ? `
  <a class="btn btn-tg" id="tg" href="${escapeHtml(opts.telegramUrl!)}" rel="noopener">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
      <path d="M21.6 3.3 2.9 10.4c-.9.35-.88 1.63.03 1.95l4.6 1.6 1.75 5.2c.27.8 1.32.98 1.84.32l2.36-2.98 4.66 3.42c.66.48 1.6.12 1.77-.68l3.06-14.5c.19-.9-.7-1.65-1.37-1.4z"/>
      <path d="m8 13.5 9.5-6.6-6.9 7.6"/>
    </svg>
    <span id="tgText">Наш Telegram-канал</span>
  </a>
` : ''

  const followBlock = hasFollow ? `
  <div class="or"><span id="orText">и ещё</span></div>
${igBtn}${tgBtn}
  <p class="sub" id="sub">Новости, акции и события — первыми у подписчиков</p>
` : ''

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${name}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{
  min-height:100dvh;display:flex;align-items:center;justify-content:center;
  padding:24px;background:#05070E;color:#EDF2FA;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;text-align:center
}
body::before{
  content:'';position:fixed;inset:0;z-index:-1;
  background:
    radial-gradient(70vw 50vh at 80% 0%,rgba(0,217,174,.14),transparent 62%),
    radial-gradient(70vw 50vh at 10% 100%,rgba(225,48,108,.12),transparent 62%)
}
.box{width:100%;max-width:340px}
.spin{
  width:34px;height:34px;margin:0 auto 18px;border-radius:50%;
  border:3px solid rgba(255,255,255,.12);border-top-color:#00D9AE;
  animation:s .8s linear infinite
}
@keyframes s{to{transform:rotate(360deg)}}
.muted{color:#8B9BB8;font-size:14px;line-height:1.5}
.muted a{color:#00D9AE}
#panel{display:none}
#panel.on{display:block;animation:up .45s cubic-bezier(.16,1,.3,1) both}
@keyframes up{from{opacity:0;transform:translateY(18px)}}
.ig{
  width:74px;height:74px;margin:0 auto 20px;display:none;border-radius:24px;display:grid;place-items:center;
  background:linear-gradient(135deg,#F9CE34,#EE2A7B 45%,#6228D7);
  box-shadow:0 16px 40px -12px rgba(238,42,123,.6)
}
h1{font-size:23px;line-height:1.25;font-weight:800;letter-spacing:-.03em;margin-bottom:10px}
.name{
  display:inline-block;margin-bottom:18px;padding:6px 14px;border-radius:99px;
  background:rgba(0,217,174,.12);border:1px solid rgba(0,217,174,.28);
  color:#00D9AE;font-size:13px;font-weight:700
}
.sub{color:#8B9BB8;font-size:13.5px;line-height:1.55;margin-top:20px}
.btn{
  display:flex;align-items:center;justify-content:center;gap:9px;
  padding:16px 22px;border-radius:15px;text-decoration:none;
  font-size:16px;font-weight:700;color:#fff;
  background:linear-gradient(135deg,#F9CE34,#EE2A7B 45%,#6228D7);
  box-shadow:0 14px 34px -12px rgba(238,42,123,.65)
}
.btn:active{transform:scale(.975)}
.btn-g{
  background:#fff;color:#1a1a1a;margin-bottom:14px;
  box-shadow:0 14px 34px -14px rgba(255,255,255,.4)
}
.btn-g.done{background:rgba(255,255,255,.09);color:#8B9BB8;box-shadow:none}
.btn-ya{
  background:#FC3F1D;color:#fff;margin-bottom:12px;
  box-shadow:0 14px 34px -14px rgba(252,63,29,.6)
}
.btn-tg{
  background:linear-gradient(135deg,#2AABEE,#229ED9);color:#fff;margin-top:12px;
  box-shadow:0 14px 34px -14px rgba(34,158,217,.6)
}
.btn-gis{
  background:#00B956;color:#fff;margin-bottom:12px;
  box-shadow:0 14px 34px -14px rgba(0,185,86,.55)
}
.rev.done{
  background:rgba(255,255,255,.07)!important;color:#8B9BB8!important;
  box-shadow:none!important
}
.rev.done .ok{display:inline}
.ok{display:none;margin-left:2px}
.or{
  display:flex;align-items:center;gap:12px;margin:0 0 14px;
  color:#4C5A79;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase
}
.or::before,.or::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.09)}
.skip{
  display:inline-block;margin-top:18px;color:#55637F;font-size:13.5px;
  text-decoration:none;padding:8px 14px
}
.thanks{
  display:inline-flex;align-items:center;gap:7px;margin-bottom:16px;
  color:#00D9AE;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase
}
</style>
</head>
<body>
<div class="box">

  <div class="thanks"><span>★</span><span id="thx">Понравилось у нас?</span></div>

  <h1 id="h">${headingRu}</h1>
  <div class="name">${name}</div>

  <a class="btn btn-g rev" data-k="g" href="${g}" target="_blank" rel="noopener">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
      <path d="m12 3 2.6 6.1 6.4.5-4.9 4.2 1.5 6.2L12 16.8 6.4 20l1.5-6.2L3 9.6l6.4-.5z"/>
    </svg>
    <span id="reviewText">Оставить отзыв в Google</span><span class="ok">✓</span>
  </a>
${yandexBtn}${gisBtn}${followBlock}
</div>

<script>
(function(){
  var KEY = ${key};
  var $ = function(id){ return document.getElementById(id) };
  var setText = function(id, t){ var e = $(id); if (e) e.textContent = t };

  // Узбекский по умолчанию, русский — если язык телефона русский
  var ru = (navigator.language || "").toLowerCase().indexOf("ru") === 0;
  if (!ru) {
    document.documentElement.lang = "uz";
    setText("thx", "Bizda yoqdimi?");
    $("h").innerHTML = ${hasFollowJs}
      ? "Sharh qoldiring<br>va obuna bo'ling"
      : "Iltimos, biz haqimizda<br>sharh qoldiring";
    setText("reviewText", "Google'da sharh qoldirish");
    setText("yaText", "Yandex Xaritalarda sharh");
    setText("gisText", "2GIS'da sharh");
    setText("orText", "va yana");
    setText("btnText", "Instagram'da obuna");
    setText("tgText", "Telegram kanalimiz");
    setText("sub", "Yangiliklar, aksiyalar va tadbirlar — avval obunachilarga");
  }

  var revs = [].slice.call(document.querySelectorAll(".rev"));
  var thx = $("thx"), h = $("h");

  // Гость уже уходил оставлять отзыв — меняем шапку на благодарность
  function afterReview(){
    thx.textContent = ru ? "Спасибо за отзыв" : "Sharh uchun rahmat";
    if (${hasFollowJs}) {
      h.innerHTML = ru
        ? "Осталось подписаться<br>на нас"
        : "Endi bizga obuna<br>bo'lish qoldi";
    } else {
      h.innerHTML = ru ? "Спасибо,<br>это очень помогает" : "Rahmat,<br>bu juda yordam beradi";
    }
  }

  function mark(a, k){
    a.classList.add("done");
    try { sessionStorage.setItem(KEY + ":" + k, "1") } catch(e){}
  }

  var any = false;
  revs.forEach(function(a){
    var k = a.getAttribute("data-k");
    var was = false;
    try { was = sessionStorage.getItem(KEY + ":" + k) === "1" } catch(e){}
    if (was) { a.classList.add("done"); any = true }
    a.addEventListener("click", function(){
      setTimeout(function(){ mark(a, k); afterReview() }, 900);
    });
  });
  if (any) afterReview();

  // Вернулся во вкладку после отзыва — обновляем вид
  document.addEventListener("visibilitychange", function(){
    if (document.visibilityState !== "visible") return;
    var some = false;
    revs.forEach(function(a){
      var k = a.getAttribute("data-k");
      try { if (sessionStorage.getItem(KEY + ":" + k) === "1") { a.classList.add("done"); some = true } } catch(e){}
    });
    if (some) afterReview();
  });
})();
</script>
</body>
</html>`
}
