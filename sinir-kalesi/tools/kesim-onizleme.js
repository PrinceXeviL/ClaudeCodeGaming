// Tarayıcı konsolu yardımcısı (oyun açıkken): kol kesimlerini gösterir.
// Kullanım: fetch('/tools/kesim-onizleme.js').then(r=>r.text()).then(eval); sonra showCuts(['enemy_orc', ...], -0.9)
window.showCuts = (names, ang = -0.9) => {
  const g = window.__game, S = 300;
  const out = document.createElement('canvas'); out.width = names.length * S; out.height = S * 2;
  const o = out.getContext('2d'); o.fillStyle = '#4a5060'; o.fillRect(0, 0, out.width, out.height);
  const t0 = performance.now();
  names.forEach((n, i) => {
    const c = g.cut(n); if (!c) return;
    const x = i * S, k = Math.min(S / c.body.width, S / c.body.height);
    o.drawImage(c.body, x, 0, c.body.width * k, c.body.height * k);
    o.save(); o.translate(x, S); o.scale(k, k); o.drawImage(c.body, 0, 0);
    for (const A of c.arms) { const px = A.a.p[0] * c.body.width, py = A.a.p[1] * c.body.height; o.save(); o.translate(px, py); o.rotate(ang * (A.a.amp ?? 1)); o.translate(-px, -py); o.drawImage(A.c, 0, 0); o.restore(); }
    o.restore(); o.fillStyle = '#fff'; o.font = '14px sans-serif'; o.fillText(n, x + 4, 14);
  });
  let im = document.getElementById('stripimg');
  if (!im) { im = document.createElement('img'); im.id = 'stripimg'; im.style.cssText = 'position:fixed;left:0;top:0;width:100%;z-index:99;background:#222'; document.body.appendChild(im); }
  im.src = out.toDataURL(); document.getElementById('game').style.display = 'none';
  return Math.round(performance.now() - t0);
};
window.unstrip = () => { const im = document.getElementById('stripimg'); if (im) im.remove(); document.getElementById('game').style.display = ''; };
// Kare şeridi: getXY() dünya noktasını izler, n kareyi yavaş çekimde yakalayıp ızgara olarak gösterir
window.strip = async function (getXY, n = 12, every = 90, spd = 0.25, w = 60, h = 50, cols = 4) {
  const g = window.__game, c = g.cam, cv = document.getElementById('game'), k = Math.min(cv.width / 960, cv.height / 540), offX = (cv.width - 960 * k) / 2, offY = (cv.height - 540 * k) / 2;
  const S = 4; g.setSpeed(spd);
  const out = document.createElement('canvas'); out.width = cols * w * S; out.height = Math.ceil(n / cols) * h * S;
  const o = out.getContext('2d'); o.fillStyle = '#222'; o.fillRect(0, 0, out.width, out.height);
  for (let i = 0; i < n; i++) {
    await new Promise(r => setTimeout(r, every));
    const [wx, wy] = getXY(), sx = (wx - c.x) * c.z, sy = (wy - c.y) * c.z;
    o.drawImage(cv, offX + (sx - w / 2 * c.z) * k, offY + (sy - h * 0.8 * c.z) * k, w * c.z * k, h * c.z * k, (i % cols) * w * S, Math.floor(i / cols) * h * S, w * S, h * S);
    o.strokeStyle = '#000'; o.strokeRect((i % cols) * w * S, Math.floor(i / cols) * h * S, w * S, h * S);
    o.fillStyle = '#fff'; o.font = 'bold 22px sans-serif'; o.fillText(i, (i % cols) * w * S + 6, Math.floor(i / cols) * h * S + 24);
  }
  g.setSpeed(1);
  let im = document.getElementById('stripimg');
  if (!im) { im = document.createElement('img'); im.id = 'stripimg'; im.style.cssText = 'position:fixed;left:0;top:0;width:100%;z-index:99;background:#222'; document.body.appendChild(im); }
  im.src = out.toDataURL(); cv.style.display = 'none'; return 'ok';
};
// Animasyon vitrini: showAnim(['enemy_orc','hero'], 'atk') — her karakter için n kare, satır başına cols kare
window.showAnim = (names, kind = 'atk', n = 12, size = 130, cols = 6) => {
  const g = window.__game;
  const v = (i) => kind === 'atk' ? -0.3 + 0.75 * i / (n - 1) : kind === 'walk' ? i / n : kind === 'cast' ? 0.45 * (1 - i / (n - 1)) : kind === 'die' ? 0.8 * i / (n - 1) : i;
  const rowsPer = Math.ceil(n / cols);
  const out = document.createElement('canvas'); out.width = cols * size; out.height = names.length * rowsPer * size;
  const o = out.getContext('2d'); o.font = 'bold 14px sans-serif';
  const jobs = names.map((nm, r) => new Promise(res => {
    const u = g.anim(nm, Array.from({ length: n }, (_, i) => ({ kind, v: v(i) })), size); if (!u) return res();
    const im = new Image(); im.onload = () => {
      for (let i = 0; i < n; i++) {
        const x = (i % cols) * size, y = (r * rowsPer + Math.floor(i / cols)) * size;
        o.drawImage(im, i * size, 0, size, size, x, y, size, size);
        o.strokeStyle = '#000'; o.strokeRect(x, y, size, size); o.fillStyle = '#fff'; o.fillText(i, x + 4, y + 15);
      }
      res();
    }; im.src = u;
  }));
  return Promise.all(jobs).then(() => {
    let im = document.getElementById('stripimg');
    if (!im) { im = document.createElement('img'); im.id = 'stripimg'; im.style.cssText = 'position:fixed;left:0;top:0;width:100%;z-index:99;background:#222'; document.body.appendChild(im); }
    im.src = out.toDataURL(); document.getElementById('game').style.display = 'none'; return 'ok';
  });
};
