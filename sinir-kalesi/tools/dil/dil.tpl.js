// Dil desteği (10 Eki): kaynak dil Türkçe. Başka dilde tuvale yazılan her metin (fillText / strokeText / measureText)
// buradan geçer: önce birebir sözlük, sonra şablonlar ({} = sayı ya da ad, parçalar da çevrilir), en son ayraçlardan bölüp parça parça.
// Sözlük tools/dil-cikar.js ile koddan çıkarılan metinlerden üretilir; yeni metin eklenince oraya da eklenmeli.
// Varsayılan dil Türkçe (Caner, 10 Eki). Dil sayfa yenilenmeden değişir: setLang(l, bitince) gerekirse js/dil/<dil>.js'i yükler,
// sözlüğü yeniden kurar ve 'langchange' olayını yayar (oyun önbellekli yazıları temizler, açık menü olduğu gibi kalır).
(() => {
  const LS = ['tr', 'en', 'es', 'de', 'fr', 'ru', 'zh'];
  let L = null; try { L = localStorage.getItem('sinirKalesi.lang'); } catch (e) {}
  if (!LS.includes(L)) L = 'tr';
  const BASE_EX = __EX__, BASE_TPL = __TPL__;
  const SEP = [' · ', ' — ', ' → ', ': ', ', ', '! ', '. ', ' | '];
  const LETTER = /[A-Za-zÇĞİÖŞÜçğıöşü]/;
  let on = false, EX = null, TPL = null, PCT = '$1%', cache = new Map();
  function build(l) {
    window.LANG = l; on = l !== 'tr'; cache = new Map(); if (!on) return;
    // İngilizce gömülü; öteki diller js/dil/<dil>.js ile window.DIL olarak yüklenir (yoksa İngilizce)
    const D = l !== 'en' && window.DIL && window.DIL.lang === l ? window.DIL : null;
    EX = Object.assign({}, BASE_EX, D ? D.EX : {});
    const tplKey = new Set(D ? D.TPL.map(t => t[0]) : []);
    TPL = (D ? D.TPL : []).concat(BASE_TPL.filter(t => !tplKey.has(t[0]))).map(([k, v]) => ({ n: -k.replace(/\{\}/g, '').length, re: new RegExp('^' + k.split('{}').map(p => p.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('(.+?)') + '$'), en: v }))
      .sort((a, b) => a.n - b.n); // önce sabit metni en uzun (en özel) şablon
    PCT = l === 'de' || l === 'fr' ? '$1 %' : '$1%';
  }
  function trx(s, d) {
    if (EX[s] != null) return EX[s];
    const t = s.trim(); if (t && t !== s && EX[t] != null) return s.replace(t, EX[t]);
    for (const T of TPL) { const m = T.re.exec(s); if (m) { const a = m.slice(1).map(x => (d < 3 && LETTER.test(x) ? trx(x, d + 1) : x)); return T.en.replace(/\{\}/g, () => a.shift()); } }
    if (d < 3) for (const sep of SEP) if (s.includes(sep)) { const p = s.split(sep), o = p.map(x => trx(x, d + 1)); if (o.some((x, i) => x !== p[i])) return o.join(sep); }
    return s;
  }
  const tr = window.tr = (s) => {
    if (!on || typeof s !== 'string' || !LETTER.test(s)) return s;
    let r = cache.get(s); if (r !== undefined) return r;
    r = trx(s, 0).replace(/%(\d+(?:[.,]\d+)?)/g, PCT); // Türkçe %15 → 15% (Almanca/Fransızca 15 %)
    if (cache.size > 8000) cache.clear(); cache.set(s, r);
    if (/[ğüşıöçĞÜŞİÖÇ]|\b(hasar|menzil|can|sn|altın|dalga|bölüm|kule|düşman|zırh|hız|yıldız|seviye|asker|iskelet|ok|büyü)\b/i.test(r)) (window.__trMiss = window.__trMiss || new Set()).add(r); // çevrilmeden kalan (geliştirme için)
    return r;
  };
  window.setLang = (l, done) => {
    if (!LS.includes(l)) return;
    try { localStorage.setItem('sinirKalesi.lang', l); } catch (e) {}
    const fin = () => { build(l); window.dispatchEvent(new Event('langchange')); if (done) done(); };
    if (l === 'tr' || l === 'en' || (window.DIL && window.DIL.lang === l)) { fin(); return; }
    const sc = document.createElement('script'); sc.src = 'js/dil/' + l + '.js?v=' + (window.SURUM || ''); sc.onload = fin; sc.onerror = fin; document.head.appendChild(sc);
  };
  build(L);
  const P = CanvasRenderingContext2D.prototype, F = P.fillText, S = P.strokeText, M = P.measureText;
  P.fillText = function (t, ...a) { return F.call(this, on ? tr(t) : t, ...a); };
  P.strokeText = function (t, ...a) { return S.call(this, on ? tr(t) : t, ...a); };
  P.measureText = function (t) { return M.call(this, on ? tr(t) : t); };
})();
