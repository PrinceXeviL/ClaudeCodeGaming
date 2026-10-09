"""Gerçek ses kayıtlarından düşman asker seslerini üretir (sentez yerine).

Kaynaklar (varliklar/ham/ses/, CC-BY 3.0 — ses/LISANS.txt'te adları yazılı):
  baradari_*.wav     Michel Baradari, "11 male human pain/death sounds" (OpenGameArt)
  spookymodem_*.wav  spookymodem, "Battlecry" (OpenGameArt)

Çıktı sinir-kalesi/ses/: pain_1..8 (acı), dvoice_1..5 (ölüm iniltisi), scream_1..4 (korku çığlığı),
warcry_1..4 (savaş çığlığı; 2-4 birkaç sesin üst üste bindiği bölük bağırışı). Manifesti günceller.
Çalıştır: python3 varliklar/ses_kayit_isle.py
"""
import json
import os
import wave

import numpy as np

from ses_uret import OUT, SR, fade, norm

HAM = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'ses')


def load(name):
    with wave.open(os.path.join(HAM, name + '.wav')) as w:
        ch, sr, n = w.getnchannels(), w.getframerate(), w.getnframes()
        x = np.frombuffer(w.readframes(n), '<i2').astype(float) / 32768
    if ch > 1: x = x.reshape(-1, ch).mean(1)
    if sr != SR: x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x)
    return trim(x)


def trim(x, th=0.02):
    """baştaki/sondaki sessizliği at (RMS normalleştirmesi sessizlikle şaşmasın)"""
    a = np.abs(x); idx = np.where(a > th * a.max())[0]
    if not len(idx): return x
    return x[max(0, idx[0] - int(SR * 0.005)):idx[-1] + int(SR * 0.03)]


def pitch(x, k):
    """k > 1 ince ve kısa; basit yeniden örnekleme (kısa seslerde yeterli)"""
    if k == 1: return x
    return np.interp(np.arange(0, len(x) - 1, k), np.arange(len(x)), x)


def shelf(x, k=0.35):
    """hafif tiz kesme: kayıttaki sert 's/h' hışırtısı oyunda kulak tırmalamasın"""
    y = np.copy(x)
    for i in range(1, len(y)): y[i] = y[i - 1] + k * (x[i] - y[i - 1])
    return y


def layer(parts):
    """[(ses, gecikme sn, kazanç)] üst üste bindir (bölük bağırışı)"""
    n = max(len(s) + int(d * SR) for s, d, _ in parts)
    out = np.zeros(n)
    for s, d, g in parts:
        i = int(d * SR); out[i:i + len(s)] += s * g
    return out


def save(name, x, rms_db):
    x = norm(fade(x.copy(), 0.003, 0.04), rms_db)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())
    return name


def main():
    B = lambda n: shelf(load('baradari_' + n), 0.5)
    made = []
    # acı: kısa "ıh/ah" iniltileri; oyun ayrıca türüne göre perdeyi oynatır (voicePitch)
    for i, (n, k) in enumerate([('pain1', 1.0), ('pain2', 1.0), ('pain3', 1.0), ('pain4', 1.0), ('pain5', 1.0),
                                ('pain6', 1.0), ('painh', 1.0), ('paino', 1.0)], 1):
        made.append(save(f'pain_{i}', pitch(B(n), k), -21))
    for i, (n, k) in enumerate([('die1', 1.0), ('die2', 1.0), ('deathh', 1.0), ('die1', 1.07), ('die2', 0.95)], 1):
        made.append(save(f'dvoice_{i}', pitch(B(n), k), -20))
    # korku: aynı kayıtlar biraz daha ince (paniğe kapılmış asker)
    for i, (n, k) in enumerate([('painh', 1.1), ('paino', 1.12), ('die1', 1.14), ('pain4', 1.1)], 1):
        made.append(save(f'scream_{i}', pitch(B(n), k), -20))
    cry = shelf(load('spookymodem_battlecry'), 0.6)
    made.append(save('warcry_1', cry, -19))
    made.append(save('warcry_2', layer([(pitch(cry, 1.0), 0, 1), (pitch(cry, 1.06), 0.05, 0.8), (pitch(cry, 0.95), 0.11, 0.7)]), -19))
    made.append(save('warcry_3', layer([(pitch(cry, 1.04), 0, 1), (pitch(cry, 0.97), 0.07, 0.8), (pitch(cry, 1.1), 0.13, 0.6)]), -19))
    made.append(save('warcry_4', layer([(pitch(cry, 0.98), 0, 1), (pitch(cry, 1.08), 0.04, 0.75), (pitch(cry, 1.02), 0.1, 0.7), (pitch(cry, 0.93), 0.16, 0.6)]), -19))
    mp = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mp))
    kinds = {m.rsplit('_', 1)[0] for m in made}
    for f in os.listdir(OUT):  # artık kullanılmayan eski varyantlar (ör. sentez pain_9..18)
        if f.endswith('.wav') and f[:-4].rsplit('_', 1)[0] in kinds and f[:-4] not in made:
            os.remove(os.path.join(OUT, f))
    man = sorted({m for m in man if m.rsplit('_', 1)[0] not in kinds} | set(made))
    json.dump(man, open(mp, 'w'))
    print(len(made), 'ses:', ', '.join(sorted(kinds)))


if __name__ == '__main__':
    main()
