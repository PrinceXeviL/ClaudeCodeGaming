"""Gerçek ses kayıtlarından düşman asker seslerini üretir (sentez yerine).

Kaynaklar (varliklar/ham/ses/, CC-BY 3.0 — ses/LISANS.txt'te adları yazılı):
  baradari_*.wav     Michel Baradari, "11 male human pain/death sounds" (OpenGameArt)
  starninjas_clash_* StarNinjas, "20 Sword Sound Effects (Attacks and Clashes)" (OpenGameArt, CC0)

Çıktı sinir-kalesi/ses/: pain_1..8 (acı), dvoice_1..5 (ölüm iniltisi), scream_1..4 (korku çığlığı). Manifesti günceller.
Savaş çığlığı sesi yok (beğenilmedi; dalga başında yalnız yazı balonu çıkar).
Çalıştır: python3 varliklar/ses_kayit_isle.py
"""
import json
import os
import wave

import numpy as np

from ses_uret import OUT, SR, fade, norm, lowpass, bone_click, thud

HAM = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'ses')


def load(name):
    with wave.open(os.path.join(HAM, name + '.wav')) as w:
        ch, sr, n = w.getnchannels(), w.getframerate(), w.getnframes()
        x = np.frombuffer(w.readframes(n), '<i2').astype(float) / 32768
    if ch > 1: x = x.reshape(-1, ch).mean(1)
    if sr != SR: x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x)
    return trim(x)


FF = '/Library/Frameworks/Python.framework/Versions/3.14/lib/python3.14/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'


def load_mp3(name):
    """ElevenLabs efekt kaydı (ham/ses/eleven/<ad>.mp3) -> mono, oyunun örnekleme hızında"""
    import subprocess, tempfile
    t = tempfile.NamedTemporaryFile(suffix='.wav', delete=False).name
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', os.path.join(HAM, 'eleven', name + '.mp3'), '-ac', '1', '-ar', str(SR), t], check=True)
    with wave.open(t) as w: x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(float) / 32768
    os.remove(t)
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
    # kılıç: gerçek çarpışma kaydı (bıçakla kaydedilmiş, çok tiz) — çarpma anından kısa kesilir, biraz kalınlaştırılır (kılıç boyu),
    # tizleri yumuşatılır, altına hafif boğuk vuruş ve kemik tıkırtısı (iskelet) eklenir; ses düzeyi düşük
    for i, (n, k) in enumerate([(2, 0.84), (4, 0.8), (5, 0.86), (7, 0.82), (8, 0.88), (10, 0.8)], 1):
        x = load(f'starninjas_clash_{n}')
        a0 = int(np.argmax(np.abs(x) > 0.3 * np.abs(x).max())); x = x[max(0, a0 - int(SR * 0.004)):]
        x = pitch(x, k)[:int(SR * 0.34)]
        x = x * np.minimum(1, np.linspace(1, 0, len(x)) * 3)          # son üçte birde söner
        x = lowpass(lowpass(x, 4200), 4200) * 0.92 + x * 0.08      # iki kat yumuşatma: cam tınısı kalmasın
        c = bone_click(0.95, 0.07) * 0.18; x[:len(c)] += c
        th = thud(130, 0.09, 0.02) * 0.12; x[:len(th)] += th
        made.append(save(f'clash_{i}', x, -25))
    # ElevenLabs efektleri (ücretsiz plan, jenerikte elevenlabs.io): yeni birimler ve büyüler.
    # Savaş borusu (10 Eki, Caner: daha gerçekçi olsun, boss gelirken farklı borazan çalsın): ElevenLabs adaylarından ölçerek seçildi.
    # horn: hornf_3 (10 Eki, Caner 2.: "klasik savaş filmlerindeki savaş öncesi borazan"; derin ~195 Hz, sabit perde, yükselip tutan uzun üfleme).
    # Önceki: hornw_3 (beğenilmedi). hornboss: hornb_1 (iki uzun üfleme) %15 kalınlaştırılmış.
    # 10 Eki (Caner, 3.): Caner'in verdiği "Ancient Battle Horn" kaydı (lisanslı, ham dosya depoda değil: ham/ses/lisansli/, .gitignore).
    # İki üfleme + yankı: ilk 7,5 sn, sonu 1,5 sn'de söner. Kaynak yoksa ElevenLabs hornf_3'e düşer.
    if os.path.exists(os.path.join(HAM, 'lisansli', 'ancient_battle_horn.wav')): made.append(save('horn_1', fade(load('lisansli/ancient_battle_horn')[:int(SR * 7.5)], 0.01, 1.5), -17))
    else: made.append(save('horn_1', fade(load_mp3('hornf_3'), 0.01, 0.5), -17))
    # yell: Caner'in verdiği "Male Battle Yell" kaydı (lisanslı, ham/ses/lisansli/): düşman özel saldırı yaparken bağırır; ikinci hali biraz kalın
    if os.path.exists(os.path.join(HAM, 'lisansli', 'male_battle_yell.wav')):
        y = fade(load('lisansli/male_battle_yell'), 0.005, 0.15)
        made.append(save('yell_1', y, -19)); made.append(save('yell_2', pitch(y, 0.9), -19))
    # battle: Caner'in verdiği "Battling Knights" kaydı (lisanslı): yakın dövüş sürerken arkada dönen kılıç-nara ortam sesi.
    # İlk 18 sn; son 1,5 sn başa karıştırılır, döngü dikişsiz döner.
    if os.path.exists(os.path.join(HAM, 'lisansli', 'battling_knights.wav')):
        b = load('lisansli/battling_knights'); L, X = int(SR * 18), int(SR * 1.5)
        lp = b[:L].copy(); r = np.linspace(0, 1, X); lp[:X] = lp[:X] * r + b[L:L + X] * (1 - r)
        made.append(save('battle_1', lp, -24))
    made.append(save('hornboss_1', fade(pitch(load_mp3('hornb_1'), 0.85), 0.01, 0.5), -17))
    # eksik savaş efektleri: arbalet atışı, ağır arbalet, zırha çarpan cıvata, mahzenden çıkan iskeletin kemik takırtısı
    for n, cnt, db in [('xbow', 3, -23), ('xbowh', 2, -20), ('armorhit', 3, -25), ('rattle', 2, -25)]:
        for i in range(1, cnt + 1):
            made.append(save(f'{n}_{i}', fade(load_mp3(f'{n}_{i}'), 0.002, 0.08), db))
    for n, cnt, db in [('elephant', 2, -19), ('vulture', 2, -23), ('bonewall', 1, -20), ('raise', 1, -22), ('fear', 1, -22), ('bats', 1, -24)]:
        for i in range(1, cnt + 1):
            made.append(save(f'{n}_{i}', fade(load_mp3(f'{n}_{i}'), 0.005, 0.25), db))
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
