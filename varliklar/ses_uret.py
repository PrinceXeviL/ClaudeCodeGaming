"""Necromancer savaş sesleri: kodla sentezlenir (dosya indirilmez, telif yok) -> sinir-kalesi/ses/*.wav + manifest.

    python3 varliklar/ses_uret.py

Üretilenler (tür_n.wav, oyun aynı türün varyantlarını rastgele çalar):
  arrow     kemik ok bırakma (hafif "fıtt")
  arrowhit  kemik ok ucu saplanması (kuru tok tık)
  clash     yakın dövüş: kemik kalkana/kılıca çarpar (boğuk, tiz değil)
  bash      ağır vuruş: kemik çatırtısı
  zap       büyücü kulesi: karanlık ruh uğultusu
  splash    kazan kulesi: fokurdayan yeşil buhar
  pain      düşman hasar alınca "ah / uh / ıh" (formant sentezi)
  dvoice    ölüm iniltisi "aaargh"
  scream    korku büyüsünde çığlık "aaaa!"
  horn      bölüm başında düşman borazanı
Hepsi aynı RMS düzeyine getirilir; oyundaki düzey SOUND (game.js) ile ayarlanır.
"""
import json, os, wave
import numpy as np

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'sinir-kalesi', 'ses')
rng = np.random.default_rng(7)


def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (SR * tau))


def resonate(x, f, bw):
    """Klatt rezonatörü (2. derece). f, bw sabit ya da örnek başına dizi."""
    n = len(x)
    f = np.broadcast_to(np.asarray(f, float), (n,))
    bw = np.broadcast_to(np.asarray(bw, float), (n,))
    T = 1 / SR
    C = -np.exp(-2 * np.pi * bw * T)
    B = 2 * np.exp(-np.pi * bw * T) * np.cos(2 * np.pi * f * T)
    A = 1 - B - C
    y = np.zeros(n)
    y1 = y2 = 0.0
    for i in range(n):
        v = A[i] * x[i] + B[i] * y1 + C[i] * y2
        y[i] = v; y2 = y1; y1 = v
    return y


def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.zeros_like(x); p = 0.0
    for i in range(len(x)):
        p = (1 - a) * x[i] + a * p; y[i] = p
    return y


def highpass(x, fc):
    return x - lowpass(x, fc)


def modes(dur, freqs, taus, amps, scale=1.0):
    t = t_axis(dur)
    out = np.zeros_like(t)
    for f, tau, a in zip(freqs, taus, amps):
        out += a * np.sin(2 * np.pi * f * scale * t + rng.uniform(0, 6)) * np.exp(-t / tau)
    return out


def noise(n):
    return rng.standard_normal(n)


def fade(x, a=0.002, b=0.02):
    n = len(x); ia = int(SR * a); ib = int(SR * b)
    if ia: x[:ia] *= np.linspace(0, 1, ia)
    if ib: x[-ib:] *= np.linspace(1, 0, ib)
    return x


def norm(x, rms_db=-18.0, peak=0.89):
    x = x - np.mean(x)
    r = np.sqrt(np.mean(x ** 2)) + 1e-9
    x = x * (10 ** (rms_db / 20) / r)
    x = np.tanh(x / peak) * peak  # yumuşak sınırlama: patlama/cızırtı yok
    return x


def save(name, x, rms_db=-18.0):
    x = norm(fade(x.copy()), rms_db)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())
    return name


# ---------- vuruşlar ----------
def bone_click(scale=1.0, dur=0.09):
    """kuru, tahtamsı kemik tıkırtısı: kısa gürültü darbesiyle uyarılan birkaç kısa ömürlü mod"""
    n = int(SR * dur)
    ex = np.zeros(n); k = int(SR * 0.0025); ex[:k] = noise(k) * np.linspace(1, 0, k)
    body = np.zeros(n)
    for f, bw, a in [(980, 160, 1.0), (2350, 260, 0.7), (3900, 420, 0.35)]:
        body += a * resonate(ex, f * scale, bw)
    return body


def bone_fall(k):
    """iskelet dağılması: kafatası ve kemikler yere saçılır; ilk kuru çatırtı, sonra seken irili ufaklı kemik tıkırtıları (zamanla seyrelir)"""
    dur = 0.9; n = int(SR * dur); out = np.zeros(n)
    c = bone_click(0.85 * k, 0.12) * 1.3; out[:len(c)] += c                      # ilk kırılma
    t = 0.035
    for i in range(int(rng.integers(9, 13))):
        sc = rng.uniform(0.8, 1.45) * k; c = bone_click(sc, 0.08) * rng.uniform(0.25, 0.8) * (1 - t / dur) ** 0.7
        j = int(SR * t); out[j:j + len(c)] += c[:max(0, n - j)]
        t += rng.uniform(0.02, 0.09) * (1 + i * 0.12)
        if t > dur - 0.1: break
    th = thud(120 * k, 0.15, 0.04) * 0.35; out[:len(th)] += th                   # gövde yere değer
    return out


def thud(f0=150, dur=0.12, tau=0.035):
    t = t_axis(dur)
    f = f0 * (1 + 0.6 * np.exp(-t / 0.01))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau)


def arrow_shot(k):
    dur = 0.16; n = int(SR * dur); t = t_axis(dur)
    fc = 1700 * k * np.exp(-t / 0.08) + 600
    air = resonate(noise(n), fc, 900) * np.exp(-t / 0.05) * (1 - np.exp(-t / 0.006))
    string = np.sin(2 * np.pi * 105 * k * t) * np.exp(-t / 0.04) * 0.5
    return lowpass(air + string, 5000)


def arrow_hit(k):
    x = bone_click(1.15 * k, 0.1) * 0.8
    x += thud(170 * k, 0.1, 0.025) * 1.2
    return lowpass(x, 5200)


def clash(k):
    """kılıç çarpışması: keskin metal "çın" + çeliğin uyumsuz tınlaması (iki bıçak, hafif dalgalanan) + kısa sürtünme;
    altında küçük kemik tıkırtısı ve boğuk vuruş (iskelet kolu, konsept bozulmasın)"""
    dur = 0.55; n = int(SR * dur); t = t_axis(dur)
    x = np.zeros(n)
    k0 = int(SR * 0.004); x[:k0] += highpass(noise(k0), 3000) * np.linspace(1, 0, k0) * 0.9           # çın: ilk temas
    f0 = 640 * k
    for r, tau, a in [(1, 0.32, 0.45), (2.76, 0.24, 0.75), (5.40, 0.16, 0.55), (8.93, 0.09, 0.3), (12.2, 0.05, 0.18)]:
        for det in (1.0, 1.007):                                                                      # iki bıçak: hafif vuru
            x += a * 0.5 * np.sin(2 * np.pi * f0 * r * det * t + rng.uniform(0, 6)) * np.exp(-t / tau) * (1 - np.exp(-t / 0.0015))
    sc = int(SR * 0.13); fc = np.linspace(3600, 1900, sc) * k                                            # sürtünme: bıçak bıçağın üstünden kayar
    scrape = resonate(noise(sc), fc, 700) * np.sin(np.linspace(0, np.pi, sc)) * 0.22
    j = int(SR * 0.012); x[j:j + sc] += scrape[:n - j]
    c = bone_click(1.0 * k, 0.08) * 0.35; x[:len(c)] += c
    th = thud(150 * k, 0.1, 0.025) * 0.35; x[:len(th)] += th
    return lowpass(x, 9000)


def bash(k):
    dur = 0.3; n = int(SR * dur)
    x = np.zeros(n)
    # çatırtı: 5-8 mikro kırılma
    for j in range(rng.integers(5, 9)):
        at = int(SR * rng.uniform(0, 0.06)); c = bone_click(rng.uniform(0.7, 1.3) * k, 0.06) * rng.uniform(0.4, 1)
        x[at:at + len(c)] += c[:n - at]
    x += thud(95 * k, dur, 0.07) * 1.6
    return lowpass(x, 4800)


def dark_zap(k):
    dur = 0.42; n = int(SR * dur); t = t_axis(dur)
    e = (1 - np.exp(-t / 0.03)) * np.exp(-t / 0.13)
    low = np.sin(2 * np.pi * np.cumsum(110 * k * np.exp(-t / 0.25) + 45) / SR) * e
    # hayaletimsi "uuu": gürültü iki formanttan geçer, formant aşağı kayar
    ghost = resonate(noise(n), 520 * k - 180 * t, 90) + 0.6 * resonate(noise(n), 900 * k - 300 * t, 120)
    ghost *= e * 0.35
    shimmer = sum(np.sin(2 * np.pi * f * k * t) for f in (640, 643.5, 961)) * e * 0.08 * (0.6 + 0.4 * np.sin(2 * np.pi * 14 * t))
    return low + ghost + shimmer


def splash(k):
    dur = 0.6; n = int(SR * dur); t = t_axis(dur)
    x = thud(80 * k, dur, 0.06) * 1.2
    # kabarcık patlamaları: yükselen kısa sinüsler
    for j in range(7):
        at = rng.uniform(0.0, 0.25); d = rng.uniform(0.025, 0.06); f0 = rng.uniform(260, 520) * k
        tt = t_axis(d); b = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 2.2 * tt / d)) / SR) * np.exp(-tt / (d / 2.5))
        i = int(SR * at); x[i:i + len(b)] += b * rng.uniform(0.25, 0.5)
    hiss = highpass(noise(n), 1200) * (1 - np.exp(-t / 0.02)) * np.exp(-t / 0.18) * 0.05
    return lowpass(x, 5000) + lowpass(hiss, 3800)


def war_drum(k):
    """savaş davulu: gergin deri "dum" — perdesi hızla düşen alçak gövde + tokmağın kuru vuruşu + kısa gövde tınısı"""
    dur = 0.42; n = int(SR * dur); t = t_axis(dur)
    f = 92 * k * (1 + 0.55 * np.exp(-t / 0.018))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)
    over = np.sin(2 * np.pi * np.cumsum(f * 2.3) / SR) * np.exp(-t / 0.05) * 0.3
    k0 = int(SR * 0.006); snap = np.zeros(n); snap[:k0] = lowpass(noise(k0), 2500) * np.linspace(1, 0, k0) * 0.6
    shell = resonate(noise(n) * np.exp(-t / 0.02), 420 * k, 120) * 0.25
    return lowpass(body + over + snap + shell, 3000)


def horn():
    """savaş borazanı (Roma cornu'su gibi): kısa-kısa-uzun üç nota (sol -> re -> sol), iki borazancı birlikte (hafif akort farkı),
    ataklarda kaba "hırıltı", uzun notada güç artışı ve titreşim, pirinç formantları, açık alanda uzun yankı"""
    notes = [(0.0, 0.24, 98.0, 0.8), (0.3, 0.24, 146.8, 0.9), (0.6, 1.45, 196.0, 1.0)]
    dur = 2.9; n = int(SR * dur); out = np.zeros(n)
    for at, d, f, amp in notes:
        t = t_axis(d); u = t / d
        for det, g in [(1.0, 1.0), (1.004, 0.7), (0.5, 0.35)]:  # ikinci borazan + bir oktav altta kalın destek
            f0 = f * det * (1 - 0.07 * np.exp(-t / 0.035)) * (1 + 0.014 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.4) / 0.4, 0, 1))
            ph = np.cumsum(f0) / SR
            src = sum(np.sin(2 * np.pi * k * ph) / k ** 0.8 for k in range(1, 16))
            growl = 1 + 0.35 * np.sin(2 * np.pi * 31 * t) * np.exp(-t / 0.08)       # atakta pirincin kaba titreşimi
            swell = 0.75 + 0.25 * np.minimum(1, t / 0.6) if d > 1 else 1               # uzun notada güç artar
            env = np.minimum(1, t / 0.04) * np.where(u > 0.85, (1 - u) / 0.15, 1) * swell * growl
            x = src * env * g * amp
            y = resonate(x, 480, 150) + 0.9 * resonate(x, 1100, 220) + 0.4 * resonate(x, 2300, 380)
            i = int(SR * at); out[i:i + len(y)] += y[:n - i]
    for dl, g in [(0.09, 0.32), (0.19, 0.22), (0.33, 0.14), (0.52, 0.08)]:  # açık alan yankısı
        k = int(SR * dl); out[k:] += out[:-k] * g
    return lowpass(out, 4600)


# ---------- sesler (formant sentezi) ----------
VOW = {  # F1, F2, F3, F4 (erkek)
    'a': (730, 1090, 2440, 3400), 'ʌ': (640, 1190, 2390, 3300), 'ə': (500, 1450, 2450, 3300),
    'u': (320, 870, 2240, 3200), 'o': (560, 860, 2410, 3300), 'ı': (420, 1500, 2500, 3400), 'e': (530, 1840, 2480, 3400),
}
BW = (80, 100, 140, 220)


def glottal(f0):
    """Rosenberg darbesi + titreşim (jitter) + nefes; f0 örnek başına dizi"""
    n = len(f0)
    jit = 1 + 0.012 * lowpass(noise(n), 30) * 8
    ph = np.cumsum(f0 * jit / SR) % 1.0
    oq = 0.6
    flow = np.where(ph < oq * 0.66, 0.5 * (1 - np.cos(np.pi * ph / (oq * 0.66))),
                    np.where(ph < oq, np.cos(0.5 * np.pi * (ph - oq * 0.66) / (oq * 0.34)), 0.0))
    src = np.diff(flow, prepend=0) * SR / 1000
    asp = highpass(noise(n), 600) * flow * 0.08
    return src + asp


def voice(dur, f0_fn, vow_path, amp_fn, growl=0.0, breath=0.04, fk=1.0):
    n = int(SR * dur); t = t_axis(dur); u = t / dur
    f0 = f0_fn(u)
    src = glottal(f0)
    if growl:  # hırıltı: periyot ikileme (alt harmonik) + genlik titremesi
        src *= 1 + growl * np.sign(np.sin(np.pi * np.cumsum(f0) / SR))
        src *= 1 - 0.35 * growl * (0.5 + 0.5 * np.sin(2 * np.pi * 32 * t))
    # ünlü yolu: [(u, ünlü), ...] doğrusal geçiş
    us = [p[0] for p in vow_path]
    F = [np.interp(u, us, [VOW[p[1]][i] for p in vow_path]) * fk for i in range(4)]
    y = src
    out = np.zeros(n)
    for i in range(4):
        out += resonate(y, F[i], BW[i] * (1.2 if i else 1)) * (1, 0.55, 0.3, 0.15)[i]
    a = amp_fn(u)
    out *= a
    # başta "h" nefesi
    hb = int(SR * breath)
    if hb:
        h = resonate(noise(hb), F[1][:hb], 300) * np.linspace(0, 1, hb) ** 2 * 0.15
        out[:hb] += h
    return highpass(out, 70)


def mort_babble(k, nsyl, seed):
    """Mortimer'ın 'konuşması': anlamsız ama karakterli heceler (Simlish benzeri) — alçak, hırıltılı, kurumlu bir ses;
    her hece ünsüz patlaması + ünlü, perde cümle boyunca iner, sonda sinsi bir yükselme. Dil bağımsız (İngilizcede de çalışır)."""
    r = np.random.default_rng(seed)
    vows = ['a', 'o', 'ʌ', 'e', 'ı', 'u', 'ə']
    out = []
    for i in range(nsyl):
        d = r.uniform(0.09, 0.15) * (1.6 if i == nsyl - 1 else 1)
        v1, v2 = r.choice(vows), r.choice(vows)
        base = 92 * k * (1.12 - 0.22 * i / max(1, nsyl - 1)) * r.uniform(0.95, 1.06)
        last = i == nsyl - 1
        f0 = lambda u, b=base, l=last: b * (1 + (0.18 * u if l else 0.06 * np.sin(np.pi * u)))
        amp = lambda u: np.minimum(1, u / 0.12) * np.where(u > 0.7, (1 - u) / 0.3, 1)
        syl = voice(d, f0, [(0, v1), (1, v2)], amp, growl=0.22, breath=0.0, fk=0.92)
        # ünsüz: kısa gürültü patlaması (k/t/s/ş benzeri), hecenin başında
        cn = int(SR * r.uniform(0.012, 0.03)); cons = resonate(noise(cn), r.uniform(1800, 4200), 900) * np.linspace(1, 0, cn) * 0.25
        syl[:cn] += cons[:len(syl)]
        out.append(syl); out.append(np.zeros(int(SR * r.uniform(0.01, 0.04))))
    x = np.concatenate(out)
    for dl, g in [(0.06, 0.18), (0.13, 0.08)]:  # balkondan hafif yankı
        j = int(SR * dl); x[j:] += x[:-j] * g
    return lowpass(x, 5200)


def mort_laugh(k, n, seed):
    """sinsi kahkaha: 'heh-heh-heh' — her vuruşta perde biraz iner, nefesli"""
    r = np.random.default_rng(seed); out = []
    for i in range(n):
        d = 0.11; base = 120 * k * (1 - 0.06 * i)
        f0 = lambda u, b=base: b * (1 - 0.15 * u)
        amp = lambda u: np.minimum(1, u / 0.08) * np.where(u > 0.5, (1 - u) / 0.5, 1)
        out.append(voice(d, f0, [(0, 'e'), (1, 'ə')], amp, growl=0.3, breath=0.04, fk=0.95)); out.append(np.zeros(int(SR * 0.05)))
    x = np.concatenate(out)
    for dl, g in [(0.06, 0.18), (0.13, 0.08)]:
        j = int(SR * dl); x[j:] += x[:-j] * g
    return lowpass(x, 5000)


def pain(k, vw):
    dur = rng.uniform(0.17, 0.3)
    base = 190 * k
    f0 = lambda u: base * (1 + 0.22 * np.exp(-((u - 0.12) / 0.1) ** 2)) * (1 - 0.28 * u)
    amp = lambda u: np.minimum(1, u / 0.05) * np.where(u > 0.65, (1 - u) / 0.35, 1)
    return voice(dur, f0, [(0, vw[0]), (1, vw[1])], amp, growl=0, breath=0.05, fk=1.07)


def dvoice(k):
    dur = rng.uniform(0.5, 0.75)
    f0 = lambda u: 215 * k * (1 + 0.18 * np.exp(-((u - 0.1) / 0.08) ** 2)) * (1 - 0.42 * u)
    amp = lambda u: np.minimum(1, u / 0.05) * np.where(u > 0.55, ((1 - u) / 0.45) ** 1.5, 1)
    return voice(dur, f0, [(0, 'a'), (0.5, 'ʌ'), (1, 'ə')], amp, growl=0.05, breath=0.06, fk=1.06)


def scream(k):
    dur = rng.uniform(0.6, 0.85)
    f0 = lambda u: 330 * k * (1 + 0.05 * np.sin(2 * np.pi * 7.5 * u * dur)) * (1 + 0.15 * np.minimum(1, u / 0.15)) * (1 - 0.25 * np.maximum(0, u - 0.6))
    amp = lambda u: np.minimum(1, u / 0.08) * np.where(u > 0.65, (1 - u) / 0.35, 1) * (0.85 + 0.15 * np.sin(2 * np.pi * 11 * u * dur))
    return voice(dur, f0, [(0, 'a'), (0.7, 'a'), (1, 'ʌ')], amp, breath=0.02, fk=1.12)


def warcry(k, syl):
    """ordu çığlığı: 5-6 erkek sesi üst üste, hafif gecikme ve perde farkıyla ('HAA!' / 'HU-RAA!' / 'HEY!')"""
    voices = []
    for v in range(6):
        kk = k * rng.uniform(0.85, 1.18); dl = rng.uniform(0, 0.09)
        parts = []
        for vw, d, rise in syl:
            dur = d * rng.uniform(0.92, 1.08)
            f0 = lambda u, kk=kk, rise=rise: 165 * kk * (1 + rise * np.minimum(1, u / 0.25)) * (1 - 0.18 * np.maximum(0, u - 0.55))
            amp = lambda u: np.minimum(1, u / 0.07) * np.where(u > 0.7, (1 - u) / 0.3, 1)
            parts.append(voice(dur, f0, [(0, vw[0]), (1, vw[1])], amp, growl=0.08, breath=0.05, fk=1.05))
        x = np.concatenate(parts)
        voices.append(np.concatenate([np.zeros(int(SR * dl)), x]))
    n = max(len(x) for x in voices); out = np.zeros(n)
    for x in voices: out[:len(x)] += x
    for dl, g in [(0.07, 0.3), (0.16, 0.15)]:  # açık havada kısa yankı
        kd = int(SR * dl); out[kd:] += out[:-kd] * g
    return lowpass(out, 3800)


def main():
    made = []
    for i, k in enumerate([0.95, 1.0, 1.08], 1): made.append(save(f'arrow_{i}', arrow_shot(k), -22))
    for i, k in enumerate([0.9, 1.0, 1.1, 1.2], 1): made.append(save(f'arrowhit_{i}', arrow_hit(k), -20))
    # clash artık gerçek kayıttan: ses_kayit_isle.py
    for i, k in enumerate([0.9, 1.0, 1.1], 1): made.append(save(f'bash_{i}', bash(k), -18))
    for i, k in enumerate([0.92, 1.0, 1.1], 1): made.append(save(f'zap_{i}', dark_zap(k), -19))
    for i, k in enumerate([0.9, 1.0, 1.12], 1): made.append(save(f'splash_{i}', splash(k), -19))
    # pain, dvoice, scream, warcry artık gerçek kayıtlardan: ses_kayit_isle.py
    # Mortimer konuşması: kısa (s), orta (m), uzun (l) cümleler için ayrı gruplar (oyun yazının uzunluğuna göre seçer)
    for grp, specs in (('s', [(3, 1), (4, 2), (4, 7)]), ('m', [(5, 3), (6, 4), (6, 8)]), ('l', [(7, 5), (8, 6), (9, 9)])):
        for i, (ns, sd) in enumerate(specs, 1): made.append(save(f'mvoice{grp}_{i}', mort_babble(1.0, ns, sd), -19))
    for i, (n, sd) in enumerate([(3, 1), (4, 2)], 1): made.append(save(f'mlaugh_{i}', mort_laugh(1.0, n, sd), -19))
    # horn_1 artık ham/ses/horn_ilk.wav (ses_kayit_isle.py kopyalar); üç notalı sentez beğenilmedi
    # made.append(save('horn_1', horn(), -17))
    for i, k in enumerate([0.95, 1.0, 1.06], 1): made.append(save(f'drum_{i}', war_drum(k), -18))
    for i, k in enumerate([0.9, 1.0, 1.12], 1): made.append(save(f'bonefall_{i}', bone_fall(k), -19))
    # manifest: eski aynı adlı türler yerine yenileri
    mp = os.path.join(OUT, 'manifest.json')
    man = json.load(open(mp))
    kinds = {m.rsplit('_', 1)[0] for m in made}
    man = sorted({m for m in man if m.rsplit('_', 1)[0] not in kinds} | set(made))
    for f in os.listdir(OUT):  # artık kullanılmayan eski varyantlar
        if f.endswith('.wav') and f[:-4].rsplit('_', 1)[0] in kinds and f[:-4] not in made:
            os.remove(os.path.join(OUT, f))
    json.dump(man, open(mp, 'w'))
    print(len(made), 'ses:', ', '.join(sorted(kinds)))


if __name__ == '__main__':
    main()
