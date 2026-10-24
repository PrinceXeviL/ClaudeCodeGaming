"""24 Eki (Caner: "butonların yeşili felan çok cırtlak, renk düzenine bir el at"): arayüz seti renklerini tok/koyu tona çeker.
arayuz_v4_kes.py ve arayuz_v4b_kes.py kaydetmeden önce ton(rgba, ad) çağırır (ham görselden her seferinde yeniden, iki kez uygulanmaz).
Renk kuşağına göre (ton derecesi): yeşil 75-175, mavi 190-250, mor 250-310, kızıl 330-15; altın kenar (25-55) yalnız altın kubbede.
Doygunluk ve parlaklık çarpanları TON'da; değiştirmek için yalnız buraya bak."""
import numpy as np
TON = {  # kuşak: (ton aralığı, doygunluk ×, parlaklık ×)
    'yesil': ((75, 175), 0.80, 0.70),
    'mavi': ((190, 250), 0.85, 0.80),
    'mor': ((250, 310), 0.85, 0.80),
    'kizil': ((330, 375), 0.90, 0.80),
    'altin': ((25, 55), 0.85, 0.86),
}
def _hsv(rgb):
    r, g, b = [rgb[..., i] for i in range(3)]; mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, np.where(mx > 0, d / (mx + 1e-6), 0), mx
def _rgb(h, s, v):
    c = v * s; x = c * (1 - np.abs((h / 60) % 2 - 1)); m = v - c; k = (h // 60).astype(int) % 6
    z = np.zeros_like(h); R = np.select([k == 0, k == 1, k == 2, k == 3, k == 4, k == 5], [c, x, z, z, x, c])
    G = np.select([k == 0, k == 1, k == 2, k == 3, k == 4, k == 5], [x, c, c, x, z, z]); B = np.select([k == 0, k == 1, k == 2, k == 3, k == 4, k == 5], [z, z, x, c, c, x])
    return np.stack([R + m, G + m, B + m], -1)
def ton(rgba, name):
    f = rgba[..., :3].astype(np.float32) / 255; h, s, v = _hsv(f)
    bands = ['yesil', 'mavi', 'mor', 'kizil'] + (['altin'] if 'gold' in name else [])
    for k in bands:
        (a, b), ks, kv = TON[k]; hh = np.where(h < 15, h + 360, h) if k == 'kizil' else h
        m = (hh >= a) & (hh < b) & (s > 0.28)
        w = np.clip((s - 0.28) / 0.2, 0, 1) * m  # gri/kemik/altın kenar az etkilenir
        s = s * (1 - w + w * ks); v = v * (1 - w + w * kv)
    out = rgba.copy(); out[..., :3] = np.clip(_rgb(h, s, v) * 255, 0, 255).astype(np.uint8); return out
