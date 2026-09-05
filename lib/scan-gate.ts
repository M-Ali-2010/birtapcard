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
  instagramUrl: string
}): string {
  const name = escapeHtml(opts.branchName)
  // Ссылки уходят в JS строками — JSON.stringify экранирует кавычки и юникод
  const g = JSON.stringify(opts.googleUrl)
  const ig = JSON.stringify(opts.instagramUrl)
  const key = JSON.stringify('btc_gate_' + opts.token)

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

  <h1 id="h">Оставьте отзыв<br>и подпишитесь</h1>
  <div class="name">${name}</div>

  <a class="btn btn-g" id="review" href="#" target="_blank" rel="noopener">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1">
      <path d="m12 3 2.6 6.1 6.4.5-4.9 4.2 1.5 6.2L12 16.8 6.4 20l1.5-6.2L3 9.6l6.4-.5z"/>
    </svg>
    <span id="reviewText">Оставить отзыв в Google</span>
  </a>

  <div class="or"><span id="orText">и ещё</span></div>

  <a class="btn" id="go" href="#" rel="noopener">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/>
      <circle cx="12" cy="12" r="4.2"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/>
    </svg>
    <span id="btnText">Подписаться в Instagram</span>
  </a>

  <p class="sub" id="sub">Новые блюда, акции и события — первыми у подписчиков</p>

</div>

<script>
(function(){
  var G = ${g}, IG = ${ig}, KEY = ${key};

  // Узбекский по умолчанию, русский — если язык телефона русский
  var ru = (navigator.language || '').toLowerCase().indexOf('ru') === 0;
  if (!ru) {
    document.documentElement.lang = 'uz';
    document.getElementById('thx').textContent = 'Bizda yoqdimi?';
    document.getElementById('h').innerHTML = "Sharh qoldiring<br>va obuna bo'ling";
    document.getElementById('reviewText').textContent = "Google'da sharh qoldirish";
    document.getElementById('orText').textContent = 'va yana';
    document.getElementById('btnText').textContent = "Instagram'da obuna";
    document.getElementById('sub').textContent =
      'Yangi taomlar, aksiyalar va tadbirlar — avval obunachilarga';
  }

  var review = document.getElementById('review');
  var thx = document.getElementById('thx');
  var h = document.getElementById('h');
  review.setAttribute('href', G);
  document.getElementById('go').setAttribute('href', IG);

  // Гость уже уходил оставлять отзыв — значит вернулся, благодарим
  function thanked(){
    review.classList.add('done');
    thx.textContent = ru ? 'Спасибо за отзыв' : 'Sharh uchun rahmat';
    h.innerHTML = ru
      ? 'Осталось подписаться<br>на нас'
      : "Endi bizga obuna<br>bo'lish qoldi";
  }

  var been = false;
  try { been = sessionStorage.getItem(KEY) === '1' } catch(e){}
  if (been) thanked();

  review.addEventListener('click', function(){
    try { sessionStorage.setItem(KEY, '1') } catch(e){}
    setTimeout(thanked, 900);
  });

  // Вернулся во вкладку после Google — подсвечиваем Instagram
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState !== 'visible') return;
    var flag = false;
    try { flag = sessionStorage.getItem(KEY) === '1' } catch(e){}
    if (flag) thanked();
  });
})();
</script>
</body>
</html>`
}
