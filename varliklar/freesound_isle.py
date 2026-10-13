"""Freesound CC0 önizlemelerini (ham/ses/freesound/*.mp3) oyun seslerine çevirir (15 Eki, Caner izniyle indirildi).
Eski sesler SİLİNMEZ: yeniler ayrı adlarla yazılır (fs_*), oyunda FREESOUND_ON ile eskilerin yerine çalar; kapatınca eskiler döner.

Kaynaklar (hepsi CC0, freesound.org):
  MrFossy "Voice – Male Grunts and Screams" (547198-547209)      -> fs_pain   (Romalı acı/zorlanma)
  ale-batec "Male Fight Grunts" (511023), unfa "Medium Male Pain Grunts" (610998) -> fs_pain / fs_death (uzun kayıt bölünür)
  Artmasterrich "Action SFX Vocal Kit" Male_Death_02/04, Male_Fall_Death_01 -> fs_death
  JohnBuhr "Sword Clashes Pack" (326857-326868), Bird_man 275159, loudernoises 334169 -> fs_clash
  velcronator "Sword Impact" 733887, Empiremonkey "clank" 616492 -> fs_clash (zırha vuruş)
  samueleunimancer "BoneSnaping" 578874, JarredGibb "Cracks" 219042, NeoSpica "Punch" 434147 -> fs_bone (iskelet kırılır)
  spookymodem "Rattling Bones" 202102, Kneeling "bones" 473526 -> fs_rattle (bekleyen iskelet, kısık)

    python3 varliklar/freesound_isle.py
"""
import glob, json, os, subprocess, tempfile, wave
import numpy as np
from ses_uret import OUT, SR, fade, norm
from ses_kayit_isle import FF, save

HAM = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'ses', 'freesound')


def load(path):
    t = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), t], check=True)
    with wave.open(t) as w: x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(float) / 32768
    os.remove(t); return x


def pieces(x, lo=0.12, hi=1.6, th=0.1, gap=0.07):
    """kayıttaki ayrı sesleri bul: 10 ms zarf eşiği aşan bölgeler, gap'ten kısa sessizlikler birleşir"""
    w = int(SR * 0.01); env = np.sqrt(np.convolve(x * x, np.ones(w) / w, 'same')); on = env > th * env.max()
    segs, i, n = [], 0, len(x)
    while i < n:
        if not on[i]: i += 1; continue
        j = i
        while j < n and (on[j] or (j + int(SR * gap) < n and on[j:j + int(SR * gap)].any())): j += 1
        a, b = max(0, i - int(SR * 0.008)), min(n, j + int(SR * 0.04))
        if lo <= (b - a) / SR <= hi: segs.append(x[a:b])
        i = j + 1
    return segs


def trimx(x, th=0.03):
    a = np.abs(x); idx = np.where(a > th * a.max())[0]
    return x[max(0, idx[0] - int(SR * 0.005)):idx[-1] + int(SR * 0.04)] if len(idx) else x


def main():
    f = lambda pat: sorted(glob.glob(os.path.join(HAM, pat)))
    made, kinds = [], {}
    def add(kind, xs, db, cap):
        xs = [x for x in xs if len(x) > SR * 0.08][:cap]
        for i, x in enumerate(xs, 1): made.append(save(f'{kind}_{i}', fade(x, 0.003, 0.05), db))
        kinds[kind] = len(xs)
    clash = [trimx(load(p))[:int(SR * 0.9)] for p in f('clash_*.mp3')]
    clash += [trimx(load(p))[:int(SR * 0.7)] for p in f('swordimpact_*.mp3') + f('armorclank_*.mp3')]
    add('fs_clash', clash, -24, 16)
    pain = [trimx(load(p)) for p in f('grunt_*.mp3')]
    pain = [x for x in pain if len(x) < SR * 1.2]
    pain += pieces(load(f('fightgrunts_*.mp3')[0]), 0.15, 0.9)[:8]
    add('fs_pain', pain, -21, 20)
    death = [trimx(load(p)) for p in f('death_*.mp3')]
    death += pieces(load(f('paingrunts_*.mp3')[0]), 0.5, 1.8)[:5]
    add('fs_death', death, -20, 8)
    bone = [trimx(load(f('bonesnap_*.mp3')[0]))] + pieces(load(f('bonecrack_*.mp3')[0]), 0.1, 1.0)[:4] + [trimx(load(f('bonepunch_*.mp3')[0]))]
    add('fs_bone', bone, -22, 6)
    rattle = pieces(load(f('bonerattle_*.mp3')[0]), 0.4, 2.0, th=0.15, gap=0.15)[:4] + pieces(load(f('bonecrawl_*.mp3')[0]), 0.4, 2.0, th=0.15, gap=0.15)[:2]
    add('fs_rattle', rattle, -27, 6)
    mp = os.path.join(OUT, 'manifest.json'); man = json.load(open(mp))
    man = sorted({m for m in man if not m.startswith('fs_')} | set(made)); json.dump(man, open(mp, 'w'))
    print(kinds)


if __name__ == '__main__':
    main()
