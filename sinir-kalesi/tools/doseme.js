// PNG'leri satır satır döşer: node tile.js out.png cols a.png b.png ...
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [,, out, cols, ...files] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage();
  const srcs = files.map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
  const png = await p.evaluate(async ([srcs, cols]) => {
    const ims = await Promise.all(srcs.map(async s => { const i = new Image(); i.src = s; await i.decode(); return i; }));
    const cw = Math.max(...ims.map(i => i.width)), ch = Math.max(...ims.map(i => i.height)), rows = Math.ceil(ims.length / cols);
    const c = document.createElement('canvas'); c.width = cw * cols + 4 * (cols - 1); c.height = ch * rows + 4 * (rows - 1);
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    ims.forEach((im, k) => g.drawImage(im, (k % cols) * (cw + 4), Math.floor(k / cols) * (ch + 4)));
    return c.toDataURL('image/png');
  }, [srcs, +cols]);
  fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64')); await b.close();
})();
