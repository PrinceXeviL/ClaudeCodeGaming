// Dil desteği (10 Eki): kaynak dil Türkçe. İngilizcede tuvale yazılan her metin (fillText / strokeText / measureText)
// buradan geçer: önce birebir sözlük, sonra şablonlar ({} = sayı ya da ad, parçalar da çevrilir), en son ayraçlardan bölüp parça parça.
// Sözlük tools/dil-cikar.js ile koddan çıkarılan metinlerden üretilir; yeni metin eklenince oraya da eklenmeli.
(() => {
  let L = null; try { L = localStorage.getItem('sinirKalesi.lang'); } catch (e) {}
  if (L !== 'tr' && L !== 'en') L = /^tr/i.test(navigator.language || '') ? 'tr' : 'en';
  window.LANG = L;
  window.setLang = (l) => { try { localStorage.setItem('sinirKalesi.lang', l); } catch (e) {} location.reload(); };
  window.tr = (s) => s;
  if (L === 'tr') return;
  const EX = __EX__;
  const TPL = __TPL__.map(([k, v]) => ({ n: -k.replace(/\{\}/g, '').length, re: new RegExp('^' + k.split('{}').map(p => p.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('(.+?)') + '$'), en: v }))
    .sort((a, b) => a.n - b.n); // önce sabit metni en uzun (en özel) şablon
  const SEP = [' · ', ' — ', ' → ', ': ', ', ', '! ', '. ', ' | '];
  const LETTER = /[A-Za-zÇĞİÖŞÜçğıöşü]/;
  function trx(s, d) {
    if (EX[s] != null) return EX[s];
    const t = s.trim(); if (t && t !== s && EX[t] != null) return s.replace(t, EX[t]);
    for (const T of TPL) { const m = T.re.exec(s); if (m) { const a = m.slice(1).map(x => (d < 3 && LETTER.test(x) ? trx(x, d + 1) : x)); return T.en.replace(/\{\}/g, () => a.shift()); } }
    if (d < 3) for (const sep of SEP) if (s.includes(sep)) { const p = s.split(sep), o = p.map(x => trx(x, d + 1)); if (o.some((x, i) => x !== p[i])) return o.join(sep); }
    return s;
  }
  const cache = new Map();
  const tr = window.tr = (s) => {
    if (typeof s !== 'string' || !LETTER.test(s)) return s;
    let r = cache.get(s); if (r !== undefined) return r;
    r = trx(s, 0).replace(/%(\d+(?:[.,]\d+)?)/g, '$1%'); // Türkçe %15 → İngilizce 15%
    if (cache.size > 8000) cache.clear(); cache.set(s, r);
    if (/[ğüşıöçĞÜŞİÖÇ]|\b(hasar|menzil|can|sn|altın|dalga|bölüm|kule|düşman|zırh|hız|yıldız|seviye|asker|iskelet|ok|büyü)\b/i.test(r)) (window.__trMiss = window.__trMiss || new Set()).add(r); // çevrilmeden kalan (geliştirme için)
    return r;
  };
  const P = CanvasRenderingContext2D.prototype, F = P.fillText, S = P.strokeText, M = P.measureText;
  P.fillText = function (t, ...a) { return F.call(this, tr(t), ...a); };
  P.strokeText = function (t, ...a) { return S.call(this, tr(t), ...a); };
  P.measureText = function (t) { return M.call(this, tr(t)); };
})();
