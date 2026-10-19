"""20 Eki (Caner: "eksik ses efektleri"): Merlin hortumu sürerken döngülü rüzgâr uğultusu.
ElevenLabs'ten 7 sn kayıt -> sonu başına 1 sn çapraz geçişle dikişsiz döngü -> sinir-kalesi/ses/tornado_1.wav
    .venv/bin/python3 varliklar/hortum_ses_20eki.py"""
import os, sys, wave
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from elevenlabs_seslendir import key, req
from ses_kayit_isle import load_mp3, norm, SR, OUT
RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'ses', 'eleven')
TEXT = 'a magical tornado: a steady roaring whirlwind spinning in place, howling swirling wind with a low rumble and some debris rattling, constant intensity, seamless loop, no thunder, no music'
p = os.path.join(RAW, 'tornado_1.mp3')
if not os.path.exists(p):
    a = req('POST', '/sound-generation?output_format=mp3_44100_128', key(), {'text': TEXT, 'duration_seconds': 7, 'prompt_influence': 0.5}, raw=True)
    open(p, 'wb').write(a); print('üretildi', len(a))
x = load_mp3('tornado_1'); F = int(SR * 1.0)
x = x[int(SR * 0.3):]  # başlangıçtaki yükselişi at
body, tail = x[:-F], x[-F:]
k = np.linspace(0, 1, F); body[:F] = body[:F] * k + tail * (1 - k)  # son saniye başa karışır: döngü dikişsiz
x = norm(body, -20)
with wave.open(os.path.join(OUT, 'tornado_1.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
print('tornado_1.wav', round(len(x) / SR, 2), 'sn')
