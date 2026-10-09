// JS kaynağından string ve şablon literallerini çıkarır (basit tokenizer). Çıktı: {exact:[...], tpl:[...]}
const fs = require('fs');
function scan(src) {
  const out = []; let i = 0, prev = '';
  const isRegexStart = () => !prev || /[(,=:\[!&|?{};+\-*%<>~^]$/.test(prev) || /\b(return|typeof|case|in|of|delete|void|throw|new|else|do)$/.test(prev);
  function readTemplate() { // i at backtick
    let parts = [''], exprs = 0; i++;
    while (i < src.length && src[i] !== '`') {
      if (src[i] === '\\') { parts[parts.length - 1] += src[i] + src[i + 1]; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        i += 2; let depth = 1;
        while (i < src.length && depth) {
          const c = src[i];
          if (c === '`') { readTemplate(); continue; }
          if (c === "'" || c === '"') { readStr(c); continue; }
          if (c === '{') depth++; else if (c === '}') depth--;
          i++;
        }
        parts.push(''); exprs++; continue;
      }
      parts[parts.length - 1] += src[i]; i++;
    }
    i++;
    out.push({ t: exprs ? 'tpl' : 'str', v: exprs ? parts : parts[0] });
  }
  function readStr(q) {
    let s = ''; i++;
    while (i < src.length && src[i] !== q) { if (src[i] === '\\') { s += src[i + 1] === "'" || src[i + 1] === '"' ? src[i + 1] : src[i] + src[i + 1]; i += 2; continue; } s += src[i]; i++; }
    i++; out.push({ t: 'str', v: s });
  }
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === "'" || c === '"') { readStr(c); prev = 'str'; continue; }
    if (c === '`') { readTemplate(); prev = 'str'; continue; }
    if (c === '/' && isRegexStart()) { i++; let cls = false; while (i < src.length) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; i++; } i++; while (/[a-z]/.test(src[i])) i++; prev = 'rx'; continue; }
    if (!/\s/.test(c)) { if (/[A-Za-z0-9_$]/.test(c)) { let w = ''; while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) w += src[i++]; prev = w; continue; } prev = c; }
    i++;
  }
  return out;
}
const TR = /[ğüşıöçĞÜŞİÖÇ]/;
const looksText = (s) => {
  if (!s || s.length < 2) return false;
  if (/^[\w./-]+\.(webp|png|jpg|mp3|wav|json|js)$/.test(s)) return false;
  if (/^(rgba?|#[0-9a-f]{3,8}|\d)/i.test(s)) return false;
  if (/^[a-z_][a-zA-Z0-9_]*$/.test(s) && !TR.test(s)) return false; // anahtar/kimlik
  if (/^[A-Z_0-9]+$/.test(s) && s.length < 3) return false;
  if (/px|sans-serif|system-ui|Arial/.test(s)) return false;
  return TR.test(s) || /[a-zA-Z]{2,} [a-zA-Z]{2,}/.test(s) || /^[A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,}/.test(s) || /^[A-ZÇĞİÖŞÜ]{3,}( [A-ZÇĞİÖŞÜ]+)*!?$/.test(s);
};
const exact = new Set(), tpl = new Map();
for (const f of process.argv.slice(2)) {
  for (const tk of scan(fs.readFileSync(f, 'utf8'))) {
    if (tk.t === 'str') { if (looksText(tk.v)) exact.add(tk.v); }
    else { const joined = tk.v.join('{}'); if (TR.test(joined) || tk.v.some(p => /[a-zA-Z]{3,} [a-zA-Z]{2,}/.test(p))) tpl.set(joined, tk.v.length - 1); }
  }
}
console.log(JSON.stringify({ exact: [...exact], tpl: [...tpl.keys()] }, null, 0));
