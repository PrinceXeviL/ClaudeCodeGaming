// Dil desteği (10 Eki): kaynak dil Türkçe. İngilizcede tuvale yazılan her metin (fillText / strokeText / measureText)
// buradan geçer: önce birebir sözlük, sonra şablonlar ({} = sayı ya da ad, parçalar da çevrilir), en son ayraçlardan bölüp parça parça.
// Sözlük tools/dil-cikar.js ile koddan çıkarılan metinlerden üretilir; yeni metin eklenince oraya da eklenmeli.
(() => {
  let L = null; try { L = localStorage.getItem('sinirKalesi.lang'); } catch (e) {}
  const LS = ['tr', 'en', 'es', 'de', 'fr', 'ru', 'zh'];
  if (!LS.includes(L)) { const n = (navigator.language || '').slice(0, 2).toLowerCase(); L = LS.includes(n) ? n : 'en'; }
  window.LANG = L;
  window.setLang = (l) => { try { localStorage.setItem('sinirKalesi.lang', l); } catch (e) {} location.reload(); };
  window.tr = (s) => s;
  if (L === 'tr') return;
  // İngilizce gömülü; öteki diller js/dil/<dil>.js ile window.DIL olarak önceden yüklenir (yoksa İngilizce)
  const D = L !== 'en' && window.DIL && window.DIL.lang === L ? window.DIL : null;
  const EX = Object.assign(__EX__, D ? D.EX : {});
  const tplKey = new Set(D ? D.TPL.map(t => t[0]) : []);
  const TPL = (D ? D.TPL : []).concat(__TPL__.filter(t => !tplKey.has(t[0]))).map(([k, v]) => ({ n: -k.replace(/\{\}/g, '').length, re: new RegExp('^' + k.split('{}').map(p => p.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('(.+?)') + '$'), en: v }))
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
  const PCT = L === 'de' || L === 'fr' ? '$1 %' : '$1%';
  const cache = new Map();
  const tr = window.tr = (s) => {
    if (typeof s !== 'string' || !LETTER.test(s)) return s;
    let r = cache.get(s); if (r !== undefined) return r;
    r = trx(s, 0).replace(/%(\d+(?:[.,]\d+)?)/g, PCT); // Türkçe %15 → 15% (Almanca/Fransızca 15 %)
    if (cache.size > 8000) cache.clear(); cache.set(s, r);
    if (/[ğüşıöçĞÜŞİÖÇ]|\b(hasar|menzil|can|sn|altın|dalga|bölüm|kule|düşman|zırh|hız|yıldız|seviye|asker|iskelet|ok|büyü)\b/i.test(r)) (window.__trMiss = window.__trMiss || new Set()).add(r); // çevrilmeden kalan (geliştirme için)
    return r;
  };
  const P = CanvasRenderingContext2D.prototype, F = P.fillText, S = P.strokeText, M = P.measureText;
  P.fillText = function (t, ...a) { return F.call(this, tr(t), ...a); };
  P.strokeText = function (t, ...a) { return S.call(this, tr(t), ...a); };
  P.measureText = function (t) { return M.call(this, tr(t)); };
})();
