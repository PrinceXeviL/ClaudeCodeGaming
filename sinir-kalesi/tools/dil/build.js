// js/dil.js üretir:  node tools/dil/build.js   (sinir-kalesi klasöründen)
// strings.json: extract.js ile koddan çıkan metinler; en_0/1/2.json ve en_tpl.json aynı sırayla çeviriler;
// en_extra.json: sonradan elle eklenen { exact: {tr: en}, tpl: [[tr, en]] } (oyun içinde yakalanan kaçaklar)
const fs = require('fs'), path = require('path'), D = __dirname;
const J = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const S = J('strings.json'), en = [...J('en_0.json'), ...J('en_1.json'), ...J('en_2.json')], et = J('en_tpl.json');
const X = fs.existsSync(path.join(D, 'en_extra.json')) ? J('en_extra.json') : { exact: {}, tpl: [] };
if (en.length !== S.exact.length || et.length !== S.tpl.length) throw new Error('uzunluk uyuşmuyor');
const EX = {};
S.exact.forEach((k, i) => { if (k !== en[i]) EX[k] = en[i]; });
Object.assign(EX, X.exact);
const TPL = S.tpl.map((k, i) => [k, et[i]]).concat(X.tpl);
for (const [k, v] of Object.entries({ ...EX })) { const ku = k.toLocaleUpperCase('tr'); if (ku !== k && !(ku in EX)) EX[ku] = v.toUpperCase(); }
const tplSrc = fs.readFileSync(path.join(D, 'dil.tpl.js'), 'utf8');
const out = tplSrc.replace('__EX__', JSON.stringify(EX)).replace('__TPL__', JSON.stringify(TPL));
fs.writeFileSync(path.join(D, '..', '..', 'js', 'dil.js'), out);
console.log('dil.js:', Object.keys(EX).length, 'metin,', TPL.length, 'şablon');

// öteki diller: kaynak.json (tr, en, tpl) sırasıyla <dil>_0..3.json çevirileri -> js/dil/<dil>.js (window.DIL)
const K = J('kaynak.json'), OUT = path.join(D, '..', '..', 'js', 'dil');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
for (const L of ['es', 'de', 'fr', 'ru', 'zh']) {
  const parts = [0, 1, 2, 3].filter(i => fs.existsSync(path.join(D, `${L}_${i}.json`))).flatMap(i => J(`${L}_${i}.json`));
  if (parts.length !== K.length) console.log(L, 'eksik:', K.length - parts.length, '(İngilizceye düşer)');
  const ex = {}, tpl = [];
  K.forEach((k, i) => {
    const v = parts[i]; if (v == null) return;
    if (k.tpl) tpl.push([k.tr, v]);
    else {
      ex[k.tr] = v;
      const ku = k.tr.toLocaleUpperCase('tr'); if (ku !== k.tr && !(ku in ex)) ex[ku] = v.toLocaleUpperCase(L);
    }
  });
  fs.writeFileSync(path.join(OUT, L + '.js'), `// üretildi: node tools/dil/build.js — elle düzenleme\nwindow.DIL = ${JSON.stringify({ lang: L, EX: ex, TPL: tpl })};\n`);
  console.log(L + '.js:', Object.keys(ex).length, 'metin,', tpl.length, 'şablon');
}
