"""Küçük görselleri atlas sayfalarında toplar (12 Eki): web yayınında sürüm başına 511 dosya sınırı ve yüzlerce ayrı istek yerine birkaç sayfa.
Dekorlar (nm*), arsa, kule parçaları ve kuledeki okçu/arbaletçi pozları toplanır; düşman ve karakter görselleri ayrı kalır.
Çıktı: sinir-kalesi/img/atlas_<N>.webp + atlas.json {pages: [...], items: {ad: [sayfa, x, y, w, h]}}. Toplanan görseller
manifest.json'dan çıkar (dosyaları img/'de kalır: işleme betikleri kullanır, ama yayına ve telefona gitmez). Oyun atlası açılışta yükler,
her parçayı ayrı tuvale kesip SPR[ad] yapar. Yeni küçük görsel eklenince ya da bu görsellerden biri değişince yeniden çalıştır:
    python3 varliklar/atlas_kur.py
"""
import json, os, re
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
PAGE, PAD = 2048, 2
SKIP = re.compile(r'^nm_bwall_')  # 15 Eki: eski Kemik Duvarı (yerine nm8_bw_*), bellekte yer tutmasın
PICK = re.compile(r'^(nm\d?_|ico_|plot$|tower_.+_(arm|front|rune|flag\d|sw\d)$|unit_(archer\d|ghostarcher|ghostxbow|xbow\d)(_\w+)?$)')
LAZY = re.compile(r'^(enemy|unit|hero)_.+_(walk|walk_on|walk_arka|atk|atk2|atk3|skill|die|idle|run|cast|block)x?$')


def main():
    man = json.load(open(os.path.join(IMG, 'manifest.json')))
    old = json.load(open(os.path.join(IMG, 'atlas.json'))) if os.path.exists(os.path.join(IMG, 'atlas.json')) else {'items': {}}
    names = sorted({f[:-5] for f in man if f.endswith('.webp')} | set(old['items']))
    strips = set(json.load(open(os.path.join(IMG, 'anim.json'))))  # 14 Eki: animasyon şeritleri (ör. unit_archer2_shot) atlasa girmez
    names = [n for n in names if PICK.match(n) and not SKIP.match(n) and not LAZY.match(n) and n not in strips and n != 'nm_key' and os.path.exists(os.path.join(IMG, n + '.webp'))]
    ims = {n: Image.open(os.path.join(IMG, n + '.webp')).convert('RGBA') for n in names}
    names.sort(key=lambda n: -ims[n].height)
    pages, items, x, y, row = [Image.new('RGBA', (PAGE, PAGE), (0, 0, 0, 0))], {}, 0, 0, 0
    for n in names:
        w, h = ims[n].size
        assert w <= PAGE and h <= PAGE, n
        if x + w > PAGE: x, y, row = 0, y + row + PAD, 0
        if y + h > PAGE: pages.append(Image.new('RGBA', (PAGE, PAGE), (0, 0, 0, 0))); x, y, row = 0, 0, 0
        pages[-1].paste(ims[n], (x, y)); items[n] = [len(pages) - 1, x, y, w, h]
        x += w + PAD; row = max(row, h)
    files = []
    for f in os.listdir(IMG):
        if re.match(r'^atlas_\d+\.webp$', f): os.remove(os.path.join(IMG, f))
    for i, p in enumerate(pages):
        # sayfanın boş altı kırpılır; sınır, sayfadaki parçaların KAYITLI alt kenarı (14 Eki: görünür piksele göre kırpınca altı saydam parçalar
        # sayfadan taşıyordu, iOS taşan kaynakta hiç çizmiyor: Ruh Feneri kolu telefonda görünmüyordu)
        bot = max([e[2] + e[4] for e in items.values() if e[0] == i] or [PAGE]); p = p.crop((0, 0, PAGE, min(PAGE, bot)))
        f = f'atlas_{i + 1}.webp'; p.save(os.path.join(IMG, f), 'WEBP', quality=94, alpha_quality=100, method=6); files.append(f)
    json.dump({'pages': files, 'items': items}, open(os.path.join(IMG, 'atlas.json'), 'w'), separators=(',', ':'))
    man = [m for m in man if m[:-5] not in items]
    json.dump(man, open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
    print(len(items), 'görsel,', len(files), 'sayfa:', ', '.join(f'{f} {os.path.getsize(os.path.join(IMG, f)) // 1024} KB' for f in files))


if __name__ == '__main__':
    main()
