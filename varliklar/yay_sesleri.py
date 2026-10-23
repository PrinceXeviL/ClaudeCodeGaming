"""23 Eki (Caner: "bütün birimlerin yay germe ve fırlatma sesleri olsun, ok zırha saplanınca da ses çıksın; ElevenLabs'te en kaliteli"):
ElevenLabs Sound Effects (eleven_text_to_sound_v2, istem etkisi yüksek), her türden birkaç çeşit. Çıktı varliklar/ham/ses/yay/<tür>_<n>.mp3,
dinleme için ~/Downloads/GameLab/yay_sesleri/. Sonra seçilenler ses/<tür>_<n>.wav (loudnorm, 44,1 kHz mono).
    SSL_CERT_FILE=/etc/ssl/cert.pem .venv/bin/python3 varliklar/yay_sesleri.py"""
import os, sys, subprocess, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.argv = [sys.argv[0]]
import elevenlabs_seslendir as E, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe(); k = E.key()
H = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(H, 'ham', 'ses', 'yay'); os.makedirs(OUT, exist_ok=True)
DL = os.path.expanduser('~/Downloads/GameLab/yay_sesleri'); os.makedirs(DL, exist_ok=True)
# tür: (istem, süre sn, adet)
SFX = {
  'bowdraw2': ('loud close-up foley: archer pulls back a wooden longbow, strong creaking of bending wood and stretching bowstring, arrow nocking click, tension building, no release, crisp and clearly audible, no music, no voice', 1.5, 4),
  'bonedraw': ('close-up foley of a bow made of old bones being drawn: dry bone creaking and rattling, taut sinew string stretching, no release, clean studio recording, no music, no voice', 0.9, 3),
  'bowshot': ('loud punchy medieval archery sound effect: a bowstring is released with a sharp twang thwack and an arrow whooshes past fast, single shot, crisp and clearly audible, no music, no voice', 1.2, 4),
  'xbowshot': ('single heavy crossbow firing: loud mechanical trigger clack, thick string thwack and a fast bolt whoosh, punchy, clean studio foley, no music, no voice', 0.8, 4),
  'armorhit2': ('an arrow striking steel plate armor: sharp metallic clang and ping with a short ricochet scrape, single impact, clean studio foley, no music, no voice', 0.6, 5),
  'shieldarrow': ('loud impact sound effect: an arrow hits a wooden shield hard, solid thunk and splinter crack with shaft vibrating twang, single impact, crisp and clearly audible, no music, no voice', 1.0, 3),
}
for name, (text, dur, n) in SFX.items():
    for i in range(1, n + 1):
        p = os.path.join(OUT, f'{name}_{i}.mp3')
        if not os.path.exists(p):
            try: open(p, 'wb').write(E.req('POST', '/sound-generation?output_format=mp3_44100_128', k, {'text': text, 'duration_seconds': dur, 'prompt_influence': 0.7, 'model_id': 'eleven_text_to_sound_v2'}, raw=True)); print('ok', name, i)
            except Exception as e: print('HATA', name, i, str(e)[:160]); continue
    # dinleme dosyası: çeşitler arka arkaya
    fs = [os.path.join(OUT, f'{name}_{i}.mp3') for i in range(1, n + 1) if os.path.exists(os.path.join(OUT, f'{name}_{i}.mp3'))]
    a, fl = [], ''
    for j, f in enumerate(fs): a += ['-i', f]; fl += f'[{j}:a]aresample=44100,apad=pad_dur=0.6[a{j}];'
    fl += ''.join(f'[a{j}]' for j in range(len(fs))) + f'concat=n={len(fs)}:v=0:a=1[o]'
    subprocess.run([FF, '-y', '-v', 'error'] + a + ['-filter_complex', fl, '-map', '[o]', '-b:a', '192k', os.path.join(DL, f'{name}_hepsi.mp3')], check=True)
print(E.req('GET', '/user/subscription', k)['character_count'], 'kredi kullanıldı')
