"""Uygulama simgesi ve açılış ekranı: iOS ve Android kaynaklarını tek görselden üretir (11 Eki).
    python3 varliklar/simge_isle.py [simge.png]      (varsayılan: iOS AppIcon-512@2x.png, 1024x1024)
- iOS: AppIcon-512@2x.png (verilen görsel değiştiyse üzerine yazar)
- Android: mipmap-*/ic_launcher.png ve ic_launcher_round.png (eski cihazlar), ic_launcher_foreground.png (uyarlanır simge;
  108dp tuvalin tamamı görsel, sistem kenarlardan ~%18 kırpar → önemli kısım ortada olmalı), arka plan rengi koyu.
  drawable*/splash.png: iOS açılış görselinin (kare, ortada yatay sahne) yatay kırpımı, koyu zemin.
"""
import os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IOS = os.path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
BG = (6, 3, 10)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(IOS, 'AppIcon.appiconset', 'AppIcon-512@2x.png')
    icon = Image.open(src).convert('RGB')
    if icon.size != (1024, 1024): icon = icon.resize((1024, 1024), Image.LANCZOS)
    dst = os.path.join(IOS, 'AppIcon.appiconset', 'AppIcon-512@2x.png')
    if os.path.abspath(src) != os.path.abspath(dst): icon.save(dst)
    for d, k in DENS.items():
        n = round(48 * k); legacy = icon.resize((n, n), Image.LANCZOS)
        legacy.save(os.path.join(RES, f'mipmap-{d}', 'ic_launcher.png'))
        m = Image.new('L', (n, n), 0); ImageDraw.Draw(m).ellipse([0, 0, n - 1, n - 1], fill=255)
        r = Image.new('RGBA', (n, n), (0, 0, 0, 0)); r.paste(legacy, (0, 0), m); r.save(os.path.join(RES, f'mipmap-{d}', 'ic_launcher_round.png'))
        f = round(108 * k); icon.resize((f, f), Image.LANCZOS).save(os.path.join(RES, f'mipmap-{d}', 'ic_launcher_foreground.png'))
    open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w').write(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#06030A</color>\n</resources>\n')
    # açılış ekranı: iOS kare görselinin ortasındaki yatay sahne
    sp = Image.open(os.path.join(IOS, 'Splash.imageset', 'splash-2732x2732.png')).convert('RGB')
    W, H = sp.size; sh = round(W * 9 / 16); scene = sp.crop((0, (H - sh) // 2, W, (H - sh) // 2 + sh))
    for folder in os.listdir(RES):
        p = os.path.join(RES, folder, 'splash.png'); q = p[:-4] + '.webp'
        if not os.path.exists(p) and not os.path.exists(q): continue
        w, h = Image.open(p if os.path.exists(p) else q).size
        c = Image.new('RGB', (w, h), BG); k = max(w / scene.width, h / scene.height) if w >= h else w / scene.width
        im = scene.resize((round(scene.width * k), round(scene.height * k)), Image.LANCZOS)
        c.paste(im, ((w - im.width) // 2, (h - im.height) // 2)); c.save(q, 'WEBP', quality=85)  # WebP: PNG'nin ~1/10'u
        if os.path.exists(p): os.remove(p)
    print('simge ve açılış ekranı yazıldı')


if __name__ == '__main__':
    main()
