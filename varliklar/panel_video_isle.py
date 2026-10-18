"""Komutanlar sayfası bekleme videoları (18 Eki, Caner: "komutanlar sayfası süper olmuş"). Wan çıktıları ham/anim/panel_<komutan>_idle.mp4
(832x480: panelin portre alanı 328x200 mantıksal px, 2,4 kat, iki yanda 22,4 px kenar payı) -> img/hero_panels.mp4 (2x2 ızgara, tek dosya: web dosya sınırı).
Döngü ileri-geri (0..48..1): dikiş yok, ara kare harmanlanmaz. Sıra: leonidas sol üst, merlin sağ üst, robin sol alt, bathory sağ alt (game.js HERO_PANEL_V)."""
import os, sys
import numpy as np
import imageio_ffmpeg
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import video_isle
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = ['leonidas', 'merlin', 'robin', 'bathory']; X0, W, HH = 22, 787, 480
F = [np.array(video_isle.frames_of(os.path.join(ROOT, 'varliklar', 'ham', 'anim', f'panel_{h}_idle.mp4'), 16))[:, :, X0:X0 + W] for h in H]
n = min(len(f) for f in F); order = list(range(n)) + list(range(n - 2, 0, -1))
out = os.path.join(ROOT, 'sinir-kalesi', 'img', 'hero_panels.mp4')
wr = imageio_ffmpeg.write_frames(out, (W * 2 + 0, HH * 2), fps=16, codec='libx264', quality=None, bitrate=None, pix_fmt_out='yuv420p', output_params=['-crf', '21', '-preset', 'slow', '-movflags', '+faststart'], macro_block_size=2)
wr.send(None)
for i in order:
    fr = np.zeros((HH * 2, W * 2, 3), np.uint8)
    for k, f in enumerate(F): fr[(k // 2) * HH:(k // 2 + 1) * HH, (k % 2) * W:(k % 2 + 1) * W] = f[i]
    wr.send(np.ascontiguousarray(fr))
wr.close(); print(out, len(order), 'kare', os.path.getsize(out) // 1024, 'KB')
