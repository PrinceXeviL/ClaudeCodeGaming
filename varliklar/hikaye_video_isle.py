"""Hikâye sahnesi videoları (18 Eki, Caner: açılış, boss girişi, sefer sonu). ham/hikaye/<ad>_veo.mp4 (Veo, 8-10 sn, 24 fps)
-> sinir-kalesi/img/cine_<ad>.mp4 (1280x720, sessiz, H.264, hızlı başlama) + cine_<ad>.jpg (ilk kare; video yüklenene kadar).
Altyazılar oyunda (game.js CINE), 6 dile çevrilir.
    .venv/bin/python3 varliklar/hikaye_video_isle.py 1_acilis_a [2_acilis_b ...]"""
import os, sys, glob, subprocess
D = os.path.dirname(os.path.abspath(__file__)); IMG = os.path.join(D, '..', 'sinir-kalesi', 'img')
FF = glob.glob(os.path.join(D, '..', '.venv', 'lib', 'python3*', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg*'))[0]
for ad in sys.argv[1:]:
    src = os.path.join(D, 'ham', 'hikaye', ad + '_veo.mp4'); name = 'cine_' + ad.split('_', 1)[1]
    out = os.path.join(IMG, name + '.mp4')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', src, '-an', '-vf', 'scale=1280:720', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '25', '-preset', 'slow', '-movflags', '+faststart', out], check=True)
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', out, '-frames:v', '1', '-q:v', '4', os.path.join(IMG, name + '.jpg')], check=True)
    print(name, os.path.getsize(out) // 1024, 'KB')
