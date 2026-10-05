// Magenta arka planı saydamlaştırır, kenarlardaki pembe taşmayı temizler, boşlukları kırpar.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [,, inFile, outFile, maxW] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage();
  const data = 'data:image/jpeg;base64,' + fs.readFileSync(inFile).toString('base64');
  const res = await p.evaluate(async ([data, maxW]) => {
    const im = new Image(); im.src = data; await im.decode();
    const W0 = im.width, H0 = im.height;
    const c = document.createElement('canvas'); c.width = W0; c.height = H0;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, W0, H0), a = d.data;
    // arka plan rengi: köşelerin ortalaması
    let br = 0, bg = 0, bb = 0, n = 0;
    for (const [x, y] of [[5,5],[W0-6,5],[5,H0-6],[W0-6,H0-6],[W0/2|0,5]]) { const i = (y*W0+x)*4; br += a[i]; bg += a[i+1]; bb += a[i+2]; n++; }
    br /= n; bg /= n; bb /= n;
    const bm = (br + bb) / 2 - bg;
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i], gg = a[i+1], bl = a[i+2];
      const m = (r + bl) / 2 - gg;             // "pembelik"
      const hueMag = Math.abs(r - bl) < 60;      // kırmızı/mor değil, gerçek pembe tonu
      let al = 1;
      if (hueMag) al = 1 - Math.min(1, Math.max(0, (m - bm * 0.35) / (bm * 0.5)));
      if (al < 1 && al > 0) {
        // yarı saydam pikselde arka plan katkısını çıkar (C = a*F + (1-a)*B)
        a[i]   = Math.max(0, Math.min(255, (r  - (1-al)*br) / al));
        a[i+1] = Math.max(0, Math.min(255, (gg - (1-al)*bg) / al));
        a[i+2] = Math.max(0, Math.min(255, (bl - (1-al)*bb) / al));
      }
      // kalan pembe ışıltıyı bastır
      if (hueMag && al > 0 && (al < 0.98 || m > bm * 0.3)) {
        const s = Math.min(a[i], a[i+2]) - a[i+1];
        if (s > 12) { const k = Math.abs(a[i] - a[i+2]) < 30 ? 0.95 : 0.6; a[i] -= s * k; a[i+2] -= s * k; }
      }
      a[i+3] = Math.round(al * 255);
    }
    g.putImageData(d, 0, 0);
    // kırp
    let x0 = W0, y0 = H0, x1 = 0, y1 = 0;
    for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) if (a[(y*W0+x)*4+3] > 20) { if (x<x0)x0=x; if (x>x1)x1=x; if (y<y0)y0=y; if (y>y1)y1=y; }
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, k = Math.min(1, maxW / cw);
    // yarıya yarıya küçült (kaliteli)
    let src = document.createElement('canvas'); src.width = cw; src.height = ch;
    src.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
    const tw = Math.round(cw * k), th = Math.round(ch * k);
    while (src.width / 2 > tw) { const h = document.createElement('canvas'); h.width = Math.ceil(src.width/2); h.height = Math.ceil(src.height/2); const hg = h.getContext('2d'); hg.imageSmoothingQuality='high'; hg.drawImage(src,0,0,h.width,h.height); src = h; }
    const o = document.createElement('canvas'); o.width = tw; o.height = th;
    const og = o.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(src, 0, 0, tw, th);
    return { png: o.toDataURL('image/png'), w: tw, h: th, bg: [br|0, bg|0, bb|0], crop: [x0, y0, k] };
  }, [data, +maxW]);
  fs.writeFileSync(outFile, Buffer.from(res.png.split(',')[1], 'base64'));
  console.log(outFile, res.w + 'x' + res.h, 'crop', JSON.stringify(res.crop));
  await b.close();
})();
