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
  width:74px;height:74px;margin:0 auto 20px;border-radius:24px;display:grid;place-items:center;
  background:linear-gradient(135deg,#F9CE34,#EE2A7B 45%,#6228D7);
  box-shadow:0 16px 40px -12px rgba(238,42,123,.6)
}
h1{font-size:23px;line-height:1.25;font-weight:800;letter-spacing:-.03em;margin-bottom:10px}
.name{
  display:inline-block;margin-bottom:18px;padding:6px 14px;border-radius:99px;
  background:rgba(0,217,174,.12);border:1px solid rgba(0,217,174,.28);
  color:#00D9AE;font-size:13px;font-weight:700
}
.sub{color:#8B9BB8;font-size:14.5px;line-height:1.55;margin-bottom:26px}
.btn{
  display:flex;align-items:center;justify-content:center;gap:9px;
  padding:16px 22px;border-radius:15px;text-decoration:none;
  font-size:16px;font-weight:700;color:#fff;
  background:linear-gradient(135deg,#F9CE34,#EE2A7B 45%,#6228D7);
  box-shadow:0 14px 34px -12px rgba(238,42,123,.65)
}
.btn:active{transform:scale(.975)}
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

  <div id="wait">
    <div class="spin"></div>
    <p class="muted" id="waitText">Открываем страницу отзыва…<br>
      <a href="#" id="manual">Открыть вручную</a></p>
  </div>

  <div id="panel">
    <div class="thanks"><span>★</span><span id="thx">Спасибо за отзыв</span></div>
    <div class="ig">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/>
        <circle cx="12" cy="12" r="4.2"/>
        <circle cx="17.5" cy="6.5" r="1.2" fill="#fff" stroke="none"/>
      </svg>
    </div>
    <h1 id="h">Подпишитесь на нас<br>в Instagram</h1>
    <div class="name">${name}</div>
    <p class="sub" id="sub">Новые блюда, акции и события — первыми у подписчиков</p>
    <a class="btn" id="go" href="#" rel="noopener">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/>
        <circle cx="12" cy="12" r="4.2"/>
        <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/>
      </svg>
      <span id="btnText">Подписаться</span>
    </a>
    <a class="skip" href="#" id="close">Не сейчас</a>
  </div>

</div>

<script>
(function(){
  var G = ${g}, IG = ${ig}, KEY = ${key};

  // Узбекский по умолчанию, русский — если язык телефона русский
  var ru = (navigator.language || '').toLowerCase().indexOf('ru') === 0;
  if (!ru) {
    document.documentElement.lang = 'uz';
    document.getElementById('waitText').innerHTML =
      'Sharh sahifasi ochilmoqda…<br><a href="#" id="manual">Qo\\'lda ochish</a>';
    document.getElementById('thx').textContent = 'Sharh uchun rahmat';
    document.getElementById('h').innerHTML = 'Instagram\\'da bizga<br>obuna bo\\'ling';
    document.getElementById('sub').textContent =
      'Yangi taomlar, aksiyalar va tadbirlar — avval obunachilarga';
    document.getElementById('btnText').textContent = 'Obuna bo\\'lish';
    document.getElementById('close').textContent = 'Hozir emas';
  }

  document.getElementById('go').setAttribute('href', IG);

  var panel = document.getElementById('panel'), wait = document.getElementById('wait');
  var shown = false;
  function show(){
    if (shown) return;
    shown = true;
    wait.style.display = 'none';
    panel.classList.add('on');
  }

  // Возвращались ли мы уже отсюда в Google?
  var been = location.search.indexOf('r=1') !== -1;
  try { been = been || sessionStorage.getItem(KEY) === '1' } catch(e){}

  if (been) {
    show();
  } else {
    try { sessionStorage.setItem(KEY, '1') } catch(e){}
    var m = document.getElementById('manual');
    if (m) m.setAttribute('href', G);
    // помечаем свою запись в истории — по кнопке «назад» вернёмся сюда же
    try { history.replaceState(null, '', location.pathname + '?r=1') } catch(e){}
    setTimeout(function(){ location.href = G }, 80);
  }

  // Google открылся в приложении Карт — наша вкладка осталась живой.
  // Как только гость вернётся в браузер, показываем панель.
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible') setTimeout(show, 600);
  });
  // Возврат «назад» из кэша страниц
  window.addEventListener('pageshow', function(e){ if (e.persisted) show() });

  document.getElementById('close').addEventListener('click', function(e){
    e.preventDefault();
    panel.style.opacity = '.35';
    setTimeout(function(){ panel.classList.remove('on') }, 200);
  });
})();
</script>
</body>
</html>`
}
