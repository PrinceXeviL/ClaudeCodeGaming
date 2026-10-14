"""ElevenLabs ile bütün oyun sesleri (14 Eki, Caner: "eleven labs ile yap, eksiksiz olsun tüm sesler").
Ham: ham/ses/eleven/<kaynak>_N.mp3 (elevenlabs_efekt.py). Çıktı: sinir-kalesi/ses/el_<tür>_N.wav + manifest.
Oyunda game.js ELEVEN_ON + EL_ALIAS eski türlerin yerine çalar; ELEVEN_ON = false ile anında eski seslere döner (eski dosyalar duruyor).
Ses yüksekliği: her tür, oyunda o an çalan eski karşılığının (Freesound takma adı varsa onun) etkin bölge RMS'ine eşitlenir;
eski dosyası olmayan (kodla üretilen) türler için DB tablosu. Kapsam dışı: borazan (Caner ilk sürümü seçti), Mortimer'ın konuşması,
asit patlaması (Caner beğendi) ve zaten ElevenLabs olanlar.
    .venv/bin/python varliklar/elevenlabs_isle.py
"""
import glob, json, os, subprocess, sys, wave
import numpy as np
from ses_kayit_isle import FF
from ses_uret import OUT, SR
E = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'ses', 'eleven')
# tür: (kaynak önekleri, en uzun süre sn)
MAP = {
    'arrow': (['g_arrow'], 0.5), 'arrowhit': (['g_arrowhit'], 0.35), 'splash': (['g_splash'], 0.9),
    'pain': (['efor', 'g_pain'], 0.6), 'dvoice': (['olum', 'g_dvoice'], 1.3), 'scream': (['g_scream'], 1.0),
    'drum': (['g_drum'], 0.8), 'yell': (['g_yell'], 1.2), 'plaguethrow': (['g_plaguethrow'], 1.2), 'plaguefire': (['g_plaguefire'], 1.5),
    'bonefall': (['iskeletcoken'], 0.9), 'magic': (['g_magic'], 0.8), 'cannon': (['g_cannon'], 1.3), 'boom': (['g_boom'], 1.3),
    'meteor': (['g_meteor'], 2.5), 'clash': (['kemikvurus', 'g_clash'], 0.5),
    'step_foot': (['g_step_foot'], 0.3), 'step_gallop': (['g_step_gallop'], 0.55), 'step_bone': (['g_step_bone'], 0.3),
    'death': (['g_death'], 0.7), 'coin': (['g_coin'], 0.35), 'coins': (['g_coins'], 1.0), 'build': (['insa'], 1.1),
    'upgrade': (['g_upgrade'], 1.2), 'leak': (['g_leak'], 1.2), 'wave': (['g_wave'], 1.5), 'win': (['g_win'], 3.0),
    'lose': (['g_lose'], 3.0), 'levelup': (['g_levelup'], 1.2), 'click': (['g_click'], 0.2), 'select': (['g_select'], 0.3),
    'pick': (['g_pick'], 0.3), 'open': (['g_open'], 0.6), 'castlehit': (['g_castlehit'], 0.8), 'bash': (['g_bash'], 0.5),
    'cry': (['g_cry'], 1.2), 'whirl': (['g_whirl'], 0.8), 'zap': (['g_zap'], 0.5), 'error': (['g_error'], 0.3),
    'thunder': (['g_thunder'], 2.0), 'spell': (['g_spell'], 0.8), 'reinforce': (['g_reinforce'], 1.2),
    'portal': (['g_portal'], 1.5), 'roar': (['g_roar'], 1.5), 'stomp': (['g_stomp'], 0.8),
}
NOW = {'clash': 'fs_clash', 'pain': 'fs_pain', 'dvoice': 'fs_death', 'bonefall': 'fs_bone'}  # şu an oyunda çalan (Freesound takma adı)
DB = {'wave': -16, 'click': -22, 'select': -22, 'pick': -23, 'open': -20, 'thunder': -14, 'portal': -16, 'roar': -15, 'stomp': -14, 'win': -16, 'lose': -16}


def dec(p):
    raw = subprocess.run([FF, '-v', 'error', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def act_rms(x):
    w = min(2205, len(x)); e = np.convolve(x ** 2, np.ones(w) / w, "same")[:len(x)]; m = e > e.max() * 0.05  # çok kısa dosyada pencere küçülür
    return 10 * np.log10(x[m].__pow__(2).mean() + 1e-12)


def old_db(kind):
    fs = sorted(glob.glob(os.path.join(OUT, NOW.get(kind, kind) + '_[0-9]*.wav')))
    if not fs: return DB.get(kind, -18)
    v = []
    for p in fs:
        with wave.open(p) as w: v.append(act_rms(np.frombuffer(w.readframes(w.getnframes()), '<i2') / 32768))
    return float(np.mean(v))


def trim(x, maxd):
    e = np.convolve(np.abs(x), np.ones(220) / 220, 'same'); pk = e.max()
    a = max(0, np.flatnonzero(e > pk * 0.03)[0] - int(0.004 * SR)); b = np.flatnonzero(e > pk * 0.012)[-1] + int(0.03 * SR)
    y = x[a:min(b, a + int(maxd * SR))].copy(); fo = min(len(y) // 3, int(0.08 * SR))
    y[:int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR)); y[-fo:] *= np.linspace(1, 0, fo) ** 1.5
    return y


def save(name, y, db):
    y = y * 10 ** ((db - act_rms(y)) / 20); pk = np.abs(y).max()
    if pk > 0.97: y *= 0.97 / pk
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((y * 32767).astype('<i2').tobytes())
    return name


def main():
    made = []
    for kind, (srcs, maxd) in MAP.items():
        db = old_db(kind); files = [p for s in srcs for p in sorted(glob.glob(os.path.join(E, s + '_[0-9]*.mp3')))]
        for i, p in enumerate(files, 1): made.append(save(f'el_{kind}_{i}', trim(dec(p), maxd), db))
    # yakın dövüş ortam döngüsü: son 1,5 sn başa karıştırılır (dikişsiz)
    b = dec(os.path.join(E, 'g_battle_1.mp3')); X = int(SR * 1.5); L = len(b) - X
    lp = b[:L].copy(); r = np.linspace(0, 1, X); lp[:X] = lp[:X] * r + b[L:L + X] * (1 - r)
    made.append(save('el_battle_1', lp, old_db('battle')))
    # 14 Eki: yerine ElevenLabs gelen eski sesler pakete girmez (iPhone yüzlerce sesi çözerken düşürüyordu); dosyaları duruyor.
    # Geri almak: game.js ELEVEN_ON = false ve bu betiği --eski ile çalıştır (eskiler pakete döner, el_* çıkar).
    mp = os.path.join(OUT, 'manifest.json'); man = set(json.load(open(mp))) - {m for m in json.load(open(mp)) if m.startswith('el_')}
    old = {os.path.basename(p)[:-4] for k in list(MAP) + ['battle'] for g in {k, NOW.get(k, k)} for p in glob.glob(os.path.join(OUT, g + '_[0-9]*.wav'))}
    if '--eski' in sys.argv: man |= old
    else: man = (man - old) | set(made)
    json.dump(sorted(man), open(mp, 'w')); print('pakette', len(man), 'ses (eski', len(old), 'dışarıda)' if '--eski' not in sys.argv else '')
    print(len(made), 'ses,', len({m.rsplit('_', 1)[0] for m in made}), 'tür')


if __name__ == '__main__':
    main()
