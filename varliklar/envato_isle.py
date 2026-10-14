"""Envato denemesi (14 Eki, Caner: "envato sesleri kendi sentez seslerimizden kat kat iyi; tüm sesleri envatodan yapalım, deneme").
Ham dosyalar: ham/ses/lisansli/envato_deneme/<paket>/ (depoya girmez, .gitignore). Çıktı: sinir-kalesi/ses/ev_<tür>_N.wav + manifest.
Oyunda game.js ENVATO_ON + EV_ALIAS eski türlerin (clash, bash, arrowhit, bonefall, boom, cannon, meteor, magic, xbow, xbowh) yerine çalar;
ENVATO_ON = false ile anında eski seslere döner (eski dosyalara dokunulmaz). Ses düzeyi: her tür, eski karşılığının etkin bölge RMS'ine eşitlenir.
    .venv/bin/python varliklar/envato_isle.py
"""
import glob, json, os, subprocess, wave
import numpy as np
from ses_kayit_isle import FF
from ses_uret import OUT, SR
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'ses', 'lisansli', 'envato_deneme')


def dec(rel):
    p = os.path.join(R, rel)
    raw = subprocess.run([FF, '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def env(x, w=220): return np.convolve(np.abs(x), np.ones(w) / w, 'same')


def cut(x, a=None, b=None, tail=0.012, lead=0.004, maxd=None):
    """a-b saniye aralığı (verilmezse sesin kendisi: tepenin %2'sini aşan ilk yerden %tail altına inen son yere); kısa giriş ve sönüş"""
    e = env(x); pk = e.max()
    i0 = int(a * SR) if a is not None else max(0, np.flatnonzero(e > pk * 0.02)[0] - int(lead * SR))
    i1 = int(b * SR) if b is not None else np.flatnonzero(e > pk * tail)[-1] + int(0.02 * SR)
    if maxd: i1 = min(i1, i0 + int(maxd * SR))
    y = x[i0:i1].copy(); fi, fo = int(0.002 * SR), min(len(y) // 3, int(0.06 * SR))
    y[:fi] *= np.linspace(0, 1, fi); y[-fo:] *= np.linspace(1, 0, fo) ** 1.5
    return y


def act_rms(x):
    e = np.convolve(x ** 2, np.ones(2205) / 2205, 'same'); m = e > e.max() * 0.05
    return 10 * np.log10(x[m].__pow__(2).mean() + 1e-12)


def save(name, x, db):
    y = x * 10 ** ((db - act_rms(x)) / 20); pk = np.abs(y).max()
    if pk > 0.98: y *= 0.98 / pk  # kırpılmasın (tepe sınırı; RMS biraz düşer)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype('<i2').tobytes())
    return name


def pitch(x, k): n = int(len(x) / k); return np.interp(np.arange(n) * k, np.arange(len(x)), x)


def onsets(x, th=0.25, gap=0.12):
    e = env(x, 441); pk = e.max(); up = np.flatnonzero((e[1:] > pk * th) & (e[:-1] <= pk * th)) / SR; o = []
    for t in up:
        if not o or t - o[-1] > gap: o.append(t)
    return o


def main():
    made = []
    G = lambda pat: sorted(os.path.relpath(p, R) for p in glob.glob(os.path.join(R, pat)))
    # kılıç çarpışması (eski clash/fs_clash -20,5): Sword Clash 1-10 kısa kesilir
    for i, f in enumerate(G('sword-clash/*.wav'), 1): made.append(save(f'ev_clash_{i}', cut(dec(f), maxd=0.6), -20.5))
    # kalkan / ağır darbe (bash -15): kalkana metal vuruş + ağır silah darbeleri (yalnız ilk vuruş)
    made.append(save('ev_bash_1', cut(dec(G('weapons-medieval-hit-shield-metal-01/*.wav')[0]), maxd=0.32), -15))
    for i, f in enumerate(G('sword-impact-clash-hit/*/*.wav'), 2): made.append(save(f'ev_bash_{i}', cut(dec(f), maxd=0.38), -15.5))
    # ok saplanması (arrowhit -18,3): Arrow Impact 1-8 ve iki ete saplanma; ilk 0,35 sn
    for i, f in enumerate(G('arrow-impact/*.wav') + G('arrow-hit-body-flesh/*.wav'), 1): made.append(save(f'ev_arrowhit_{i}', cut(dec(f), maxd=0.35), -18.3))
    # iskelet dağılması (bonefall/fs_bone -18): kısa kırılmalar ve çatırdamalar
    bones = G('bone-break/Bone Break 0[1-5].wav') + G('bone-cracks/*.wav') + G('bone-cracking/*.wav') + G('bone-crack/*/*.wav')
    for i, f in enumerate(bones, 1): made.append(save(f'ev_bone_{i}', cut(dec(f), maxd=0.9), -18))
    # top atışı (cannon -11,4) ve patlama (boom -13,8): eski toplar, top atışı, top patlaması (uzun kuyruk 1,6 sn'de söner)
    c1, c2 = [dec(f) for f in G('medieval-old-cannon-fire/*.wav')]
    shot, blast = dec(G('explosion-cannon-shot/*.wav')[0]), dec(G('cannon-blast-explosion/*.wav')[0])
    made += [save('ev_cannon_1', cut(c1, maxd=1.4), -11.4), save('ev_cannon_2', cut(c2, maxd=1.4), -11.4), save('ev_cannon_3', cut(shot, maxd=1.4), -11.4)]
    made += [save('ev_boom_1', cut(blast, maxd=1.6), -13.8), save('ev_boom_2', cut(shot, maxd=1.6), -13.8), save('ev_boom_3', cut(c2, maxd=1.6), -13.8)]
    # göktaşı (meteor -12,9): top patlamasının kalın ve uzun hali
    made += [save('ev_meteor_1', pitch(cut(blast, maxd=2.2), 0.78), -12.9), save('ev_meteor_2', pitch(cut(c1, maxd=2.2), 0.82), -12.9)]
    # büyü (magic -13,9): kısa büyü atışı ve ateşli büyü fısıltısı; Merlin'in ateş topu (fireball) ateşli olan
    made += [save('ev_magic_1', cut(dec(G('magic-cast-spell-4/*.wav')[0]), maxd=1.2), -14.5),
             save('ev_magic_2', cut(dec(G('creating-a-magical-whoosh-emphasizes-movement-and/*.wav')[0]), 0.4, 1.9), -15)]
    fw = cut(dec(G('fire-whoosh-cast-bodied-spell-magic-04/*.wav')[0]), maxd=1.35)
    made += [save('ev_fireball_1', fw, -16), save('ev_fireball_2', pitch(fw, 1.1), -16)]
    # arbalet (xbow -19,6 / xbowh -18,2): çoklu atış kaydından ilk vuruş anlarından 0,3 sn'lik dilimler; ağır arbalet biraz kalın
    xb = dec(G('launching-medieval-crossbow-bolts-and-impacting-du/*.wav')[0]); on = onsets(xb, 0.3, 0.2)[:6]
    for i, t in enumerate(on[:4], 1): made.append(save(f'ev_xbow_{i}', cut(xb, max(0, t - 0.01), t + 0.3), -19.6))
    for i, t in enumerate(on[1:3], 1): made.append(save(f'ev_xbowh_{i}', pitch(cut(xb, max(0, t - 0.01), t + 0.38), 0.86), -18.2))
    mp = os.path.join(OUT, 'manifest.json'); man = json.load(open(mp))
    man = sorted({m for m in man if not m.startswith('ev_')} | set(made)); json.dump(man, open(mp, 'w'))
    print(len(made), 'ses:', ', '.join(sorted({m.rsplit('_', 1)[0] for m in made})))


if __name__ == '__main__':
    main()
