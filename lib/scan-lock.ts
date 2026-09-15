/**
 * Экран «подписка устройства истекла».
 *
 * Показывается вместо страницы отзывов, когда у филиала прошёл срок
 * paid_until. Скан при этом всё равно записывается в статистику — владельцу
 * полезно видеть, что гости продолжают прикладывать телефон к неоплаченной
 * карточке.
 *
 * paid_until = NULL означает «без срока» — такие филиалы никогда не блокируются.
 */

/** Куда вести гостя и владельца, если устройство заблокировано */
const SUPPORT_TELEGRAM = 'https://t.me/Jrkhnv777'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function isSubscriptionExpired(paidUntil: string | null | undefined): boolean {
  if (!paidUntil) return false
  const t = new Date(paidUntil).getTime()
  return Number.isFinite(t) && t < Date.now()
}

export function renderExpiredPage(branchName: string): string {
  const name = escapeHtml(branchName)
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;
  background:#05070E;color:#EDF2FA;
  display:flex;align-items:center;justify-content:center;
  padding:28px 22px;text-align:center;-webkit-font-smoothing:antialiased
}
body::before{
  content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:radial-gradient(70vw 50vh at 50% 0%,rgba(240,71,71,.12),transparent 65%)
}
.box{width:100%;max-width:380px}
.lock{
  width:78px;height:78px;margin:0 auto 22px;border-radius:24px;
  display:grid;place-items:center;
  background:rgba(240,71,71,.12);border:1px solid rgba(240,71,71,.3);color:#F04747
}
.tag{
  display:inline-block;margin-bottom:14px;padding:6px 13px;border-radius:99px;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  font-size:12.5px;font-weight:700;color:#8B9BB8
}
h1{font-size:23px;line-height:1.2;font-weight:800;letter-spacing:-.03em;margin-bottom:12px}
p{color:#8B9BB8;font-size:14.5px;line-height:1.6;margin-bottom:24px}
.btn{
  display:flex;align-items:center;justify-content:center;gap:9px;
  padding:16px 22px;border-radius:15px;text-decoration:none;
  font-size:16px;font-weight:700;color:#fff;
  background:linear-gradient(135deg,#2AABEE,#229ED9);
  box-shadow:0 14px 34px -14px rgba(34,158,217,.6)
}
.btn:active{transform:scale(.975)}
.brand{
  display:inline-flex;flex-direction:column;align-items:center;gap:9px;
  margin-top:30px;text-decoration:none;color:#EDF2FA
}
.brand-row{display:inline-flex;align-items:center;gap:9px}
.brand-mark{
  width:26px;height:26px;border-radius:8px;display:grid;place-items:center;
  background:linear-gradient(135deg,#5CE8C4,#00C89A);box-shadow:0 8px 20px -10px rgba(0,217,174,.7)
}
.brand-mark svg{width:18px;height:18px}
.brand-name{font-size:15.5px;font-weight:800;letter-spacing:-.02em}
.brand-name em{font-style:normal;color:#00D9AE}
.brand-tag{color:#55637F;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
</style>
</head>
<body>
<div class="box">
  <div class="lock">
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
      <rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M7.8 10.5V7.2a4.2 4.2 0 0 1 8.4 0v3.3"/>
    </svg>
  </div>
  <div class="tag">${name}</div>
  <h1 id="h">Подписка устройства<br>истекла</h1>
  <p id="p">Карточка временно не работает. Чтобы возобновить, обратитесь в поддержку — это займёт пару минут.</p>
  <a class="btn" href="${SUPPORT_TELEGRAM}" rel="noopener">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
      <path d="M21.6 3.3 2.9 10.4c-.9.35-.88 1.63.03 1.95l4.6 1.6 1.75 5.2c.27.8 1.32.98 1.84.32l2.36-2.98 4.66 3.42c.66.48 1.6.12 1.77-.68l3.06-14.5c.19-.9-.7-1.65-1.37-1.4z"/>
    </svg>
    <span id="b">Написать в поддержку</span>
  </a>
  <a class="brand" href="https://birtapcard.vercel.app/info" target="_blank" rel="noopener">
    <span class="brand-row">
      <span class="brand-mark"><svg viewBox="0 0 512 512" fill="none" stroke="#04121C" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"><path d="M166 214 L222 158 V378"/><path d="M280 172 a74 74 0 0 1 74 74"/><path d="M280 100 a146 146 0 0 1 146 146"/></svg></span>
      <span class="brand-name">Bir<em>Tap</em>Card</span>
    </span>
    <span class="brand-tag" id="brandTag">Одно касание — один отзыв</span>
  </a>
</div>
<script>
(function(){
  var T = {
    uz: { h: "Qurilma obunasi<br>tugagan", p: "Kartochka vaqtincha ishlamaydi. Qayta yoqish uchun qo'llab-quvvatlashga murojaat qiling — bu bir necha daqiqa oladi.", b: "Qo'llab-quvvatlashga yozish", t: "Bir teginish — bir sharh" },
    en: { h: "Device subscription<br>has expired", p: "This card is paused. Contact support to reactivate it — it only takes a few minutes.", b: "Message support", t: "One tap — one review" }
  };
  var lang = "";
  try { lang = localStorage.getItem("btc:lang") || "" } catch(e){}
  if (!lang) { var nl = (navigator.language || "").toLowerCase(); lang = nl.indexOf("ru") === 0 ? "ru" : nl.indexOf("uz") === 0 ? "uz" : "en"; }
  var t = T[lang];
  if (!t) return;
  document.documentElement.lang = lang;
  document.getElementById("h").innerHTML = t.h;
  document.getElementById("p").textContent = t.p;
  document.getElementById("b").textContent = t.b;
  document.getElementById("brandTag").textContent = t.t;
})();
</script>
</body>
</html>`
}
