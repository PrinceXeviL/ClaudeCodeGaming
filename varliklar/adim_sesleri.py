"""Yürüyüş sesleri (13 Eki, Caner): düşman piyadesinin ayak sesi, süvarinin dörtnalı, iskeletlerin kemik takırtılı adımı.

Kaynaklar (hepsi CC0, atıf gerekmez):
  Kenney "RPG Audio" footstep00-09 ve "Impact Sounds" footstep_grass_* / footstep_concrete_* / impactWood_light_* (kenney.nl)
    -> ham/ses/kenney_indir/{rpg,impact}/Audio
  Freesound spookymodem "Rattling Bones" 202102 (CC0) -> ham/ses/freesound/bonerattle_*.mp3 (kemik takırtısı katmanı)
Çıktı: sinir-kalesi/ses/step_foot_N.wav, step_gallop_N.wav, step_bone_N.wav (+ manifest). Oyunda game.js updateSteps kısık çalar.

    python3 varliklar/adim_sesleri.py
"""
import glob, json, os
import numpy as np
from ses_uret import OUT, SR
from ses_kayit_isle import save
from freesound_isle import load, pieces, trimx

K = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'ses', 'kenney_indir')
FS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'ses', 'freesound')
g = lambda pat: sorted(glob.glob(os.path.join(K, pat)))


def resample(x, k):  # k > 1: tiz ve kısa, k < 1: kalın ve uzun
    n = int(len(x) / k); return np.interp(np.arange(n) * k, np.arange(len(x)), x)


def lowpass(x, a):
    y = np.empty_like(x); y[0] = x[0]
    for i in range(1, len(x)): y[i] = y[i - 1] + a * (x[i] - y[i - 1])
    return y


def place(parts, total):
    out = np.zeros(int(SR * total))
    for t, x, gain in parts:
        a = int(SR * t); b = min(len(out), a + len(x)); out[a:b] += x[:b - a] * gain
    return out


def main():
    made = []
    # piyade: toprakta yumuşak adımlar (çimen + deri çizme), biraz boğuk ki kalabalıkta tıkırdamasın
    feet = [trimx(load(p)) for p in g('rpg/Audio/footstep0*.ogg')] + [trimx(load(p)) for p in g('impact/Audio/footstep_grass_*.ogg')]
    for i, x in enumerate(feet[:10], 1): made.append(save(f'step_foot_{i}', lowpass(x[:int(SR * 0.35)], 0.35), -30))
    # süvari dörtnalı: dört nal vuruşu (ta-ta-ta-tam), beton adımları kalınlaştırılır, altına boğuk gümleme
    hoof = [lowpass(resample(trimx(load(p)), 0.72), 0.5) for p in g('impact/Audio/footstep_concrete_*.ogg')]
    thump = [lowpass(resample(trimx(load(p)), 0.55), 0.18) for p in g('impact/Audio/impactWood_light_*.ogg')]
    rng = np.random.default_rng(7)
    for i in range(4):
        h = [hoof[(i + k) % len(hoof)][:int(SR * 0.18)] for k in range(4)]
        T = [0, 0.075 + rng.uniform(-0.008, 0.008), 0.165 + rng.uniform(-0.01, 0.01), 0.235]
        parts = [(t, x, gn) for t, x, gn in zip(T, h, [0.75, 0.6, 0.85, 1.0])] + [(0.235, thump[i % len(thump)][:int(SR * 0.2)], 0.5)]
        made.append(save(f'step_gallop_{i + 1}', place(parts, 0.5), -28))
    # iskelet adımı: tiz tahta tıkırtısı (kemik) + kısa kemik takırtısı parçası
    click = [resample(trimx(load(p)), 1.7) for p in g('impact/Audio/impactWood_light_*.ogg')]
    rat = pieces(load(glob.glob(os.path.join(FS, 'bonerattle_*.mp3'))[0]), 0.08, 0.5, th=0.2, gap=0.03)
    for i in range(6):
        c1, c2 = click[i % len(click)][:int(SR * 0.12)], click[(i + 2) % len(click)][:int(SR * 0.12)]
        parts = [(0, c1, 1.0), (0.045 + 0.01 * (i % 3), c2, 0.55)]
        if rat: parts.append((0.01, rat[i % len(rat)][:int(SR * 0.22)], 0.45))
        made.append(save(f'step_bone_{i + 1}', place(parts, 0.3), -29))
    mp = os.path.join(OUT, 'manifest.json'); man = json.load(open(mp))
    man = sorted({m for m in man if not m.startswith('step_')} | set(made)); json.dump(man, open(mp, 'w'))
    print(len(made), 'ses')


if __name__ == '__main__':
    main()
