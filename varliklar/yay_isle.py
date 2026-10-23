"""23 Eki: varliklar/ham/ses/yay/*.mp3 -> sinir-kalesi/ses/<tür>_<n>.wav (baş/son sessizlik kırpılır, tepe -1 dBFS, 44,1 kHz mono 16 bit)
ve ~/Downloads/GameLab/yay_sesleri/<tür>_hepsi.mp3 (işlenmiş çeşitler arka arkaya). Yeni türler manifest'e eklenir."""
import glob, json, os, subprocess
import numpy as np, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe(); H = os.path.dirname(os.path.abspath(__file__)); SES = os.path.join(H, '..', 'sinir-kalesi', 'ses')
DL = os.path.expanduser('~/Downloads/GameLab/yay_sesleri'); SR = 44100
man = json.load(open(os.path.join(SES, 'manifest.json'))); groups = {}
for f in sorted(glob.glob(os.path.join(H, 'ham', 'ses', 'yay', '*.mp3'))):
    name = os.path.basename(f)[:-4]
    a = np.frombuffer(subprocess.run([FF, '-v', 'error', '-i', f, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout, np.float32).copy()
    env = np.convolve(np.abs(a), np.ones(256) / 256, 'same'); thr = env.max() * 0.04
    idx = np.where(env > thr)[0]; s0 = max(0, idx[0] - int(0.01 * SR)); s1 = min(len(a), idx[-1] + int(0.06 * SR))
    a = a[s0:s1]; a *= 0.89 / max(1e-6, np.abs(a).max())
    MAXL = 0.75 if 'draw' in name else 9  # germe sesi oyundaki nişan süresine sığsın (eski bowdraw 0,68 sn)
    if len(a) > MAXL * SR: a = a[:int(MAXL * SR)]
    fade = int((0.12 if 'draw' in name else 0.02) * SR); a[-fade:] *= np.linspace(1, 0, fade)
    pcm = (np.clip(a, -1, 1) * 32767).astype(np.int16)
    w = os.path.join(SES, name + '.wav')
    subprocess.run([FF, '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', w], input=pcm.tobytes(), check=True)
    if name not in man: man.append(name)
    groups.setdefault(name.rsplit('_', 1)[0], []).append(w); print(name, f'{len(a) / SR:.2f}s')
json.dump(sorted(man), open(os.path.join(SES, 'manifest.json'), 'w'))
for g, fs in groups.items():
    a, fl = [], ''
    for j, f in enumerate(fs): a += ['-i', f]; fl += f'[{j}:a]apad=pad_dur=0.6[a{j}];'
    fl += ''.join(f'[a{j}]' for j in range(len(fs))) + f'concat=n={len(fs)}:v=0:a=1[o]'
    subprocess.run([FF, '-y', '-v', 'error'] + a + ['-filter_complex', fl, '-map', '[o]', '-b:a', '192k', os.path.join(DL, f'{g}_hepsi.mp3')], check=True)
