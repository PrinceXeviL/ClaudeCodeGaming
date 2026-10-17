"""Zafer sahnesi videosu (17 Eki, Caner: Mortimer'ın arka planı kesilmiyordu -> sahne arka planıyla birlikte video).
ham/zafer_sahnesi_veo.mp4 (Veo, 10 sn, 24 fps; gökyüzü sürekli kaydığı için kendisi döngü değil) ->
son 2 sn baştaki 2 sn ile harmanlanır: 8 sn dikişsiz döngü -> sinir-kalesi/img/win_scene.mp4 (sessiz) + win_scene.jpg (ilk kare, yedek).
    .venv/bin/python3 varliklar/zafer_video_isle.py"""
import os, glob, subprocess
import numpy as np
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img')
FF = glob.glob(os.path.join(D, '..', '.venv', 'lib', 'python3*', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg*'))[0]
W, H, FPS, X = 1280, 720, 24, 48  # X: harman kare sayısı (2 sn)
raw = subprocess.run([FF, '-loglevel', 'error', '-i', os.path.join(D, 'ham', 'zafer_sahnesi_veo.mp4'), '-vf', 'scale=%d:%d' % (W, H),
                      '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
v = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3); n = len(v); M = n - X
out = []
for i in range(M):
    if i < X:
        w = (i + 0.5) / X; w = w * w * (3 - 2 * w)
        out.append(((1 - w) * v[M + i].astype(np.float32) + w * v[i].astype(np.float32)).round().astype(np.uint8))
    else: out.append(v[i])
p = subprocess.Popen([FF, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', str(FPS), '-i', '-',
                      '-an', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart',
                      os.path.join(IMG, 'win_scene.mp4')], stdin=subprocess.PIPE)
for f in out: p.stdin.write(f.tobytes())
p.stdin.close(); p.wait()
Image.fromarray(out[0]).save(os.path.join(IMG, 'win_scene.jpg'), quality=86)
print(len(out), 'kare', os.path.getsize(os.path.join(IMG, 'win_scene.mp4')) // 1024, 'KB')
