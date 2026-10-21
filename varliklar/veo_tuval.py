"""Veo için geniş beyaz tuval (KATI kural: karakter küçük, ortada, çevresi bol boşluk).
    .venv/bin/python3 varliklar/veo_tuval.py girdi.png cikti.png [boy_orani=0.45] [dikey_merkez=0.55]"""
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
k = float(sys.argv[3]) if len(sys.argv) > 3 else 0.45
cy = float(sys.argv[4]) if len(sys.argv) > 4 else 0.55
W, H = 1920, 1080
im = Image.open(src).convert('RGBA')
h = int(H * k); w = int(im.width * h / im.height)
im = im.resize((w, h), Image.LANCZOS)
c = Image.new('RGB', (W, H), (255, 255, 255))
c.paste(im, ((W - w) // 2, int(H * cy - h / 2)), im)
c.save(out); print(out, (w, h))
