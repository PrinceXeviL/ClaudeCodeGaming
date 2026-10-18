"""Web yayınına özel atlas (18 Eki): claude.ai yayını sürüm başına 511 dosya tutar. Düşmanların tek resimleri (enemy_<tür>.webp, şerit olmayan)
web'de ayrı dosya yerine ek atlas sayfalarına (atlas_e<N>.webp) girer; böylece yer açılır (kule yıkılma şeritleri sığar).
Telefon sürümü değişmez (img/atlas.json ve manifest olduğu gibi; iOS tuval belleği için tek resimler ayrı kalır).
    .venv/bin/python3 varliklar/web_atlas.py <çıkış klasörü> [anim_web.json]
Çıkış: <klasör>/atlas.json, manifest.json, atlas_e*.webp ve yayin_ek.json (Artifact files eşlemesi: yeni dosyalar + silinecekler null)."""
import json, os, re, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
PAGE, PAD = 2048, 2
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
anim = json.load(open(os.path.join(IMG, 'anim.json')))
man = json.load(open(os.path.join(IMG, 'manifest.json'))); atlas = json.load(open(os.path.join(IMG, 'atlas.json')))
names = [f[:-5] for f in man if re.match(r'^enemy_[a-z0-9]+\.webp$', f) and f[:-5] not in anim and os.path.exists(os.path.join(IMG, f))]
ims = {n: Image.open(os.path.join(IMG, n + '.webp')).convert('RGBA') for n in names}
names.sort(key=lambda n: -ims[n].height)
p0 = len(atlas['pages']); pages, items, x, y, row = [Image.new('RGBA', (PAGE, PAGE), (0, 0, 0, 0))], {}, 0, 0, 0
for n in names:
    w, h = ims[n].size
    if x + w > PAGE: x, y, row = 0, y + row + PAD, 0
    if y + h > PAGE: pages.append(Image.new('RGBA', (PAGE, PAGE), (0, 0, 0, 0))); x, y, row = 0, 0, 0
    pages[-1].paste(ims[n], (x, y)); items[n] = [p0 + len(pages) - 1, x, y, w, h]; x += w + PAD; row = max(row, h)
files = {}
for i, p in enumerate(pages):
    bot = max(e[2] + e[4] for e in items.values() if e[0] == p0 + i); f = f'atlas_e{i + 1}.webp'
    p.crop((0, 0, PAGE, bot)).save(os.path.join(out, f), 'WEBP', quality=94, alpha_quality=100, method=6); files['img/' + f] = os.path.join(out, f)
A = {'pages': atlas['pages'] + [f'atlas_e{i + 1}.webp' for i in range(len(pages))], 'items': {**atlas['items'], **items}}
json.dump(A, open(os.path.join(out, 'atlas.json'), 'w'), separators=(',', ':'))
json.dump([m for m in man if m[:-5] not in items], open(os.path.join(out, 'manifest.json'), 'w'), indent=0)
files['img/atlas.json'] = os.path.join(out, 'atlas.json'); files['img/manifest.json'] = os.path.join(out, 'manifest.json')
for n in names: files['img/' + n + '.webp'] = None  # web'den silinir (atlasta)
json.dump(files, open(os.path.join(out, 'yayin_ek.json'), 'w'), indent=1)
print(len(names), 'düşman resmi,', len(pages), 'sayfa:', [os.path.getsize(os.path.join(out, f'atlas_e{i + 1}.webp')) // 1024 for i in range(len(pages))], 'KB')
