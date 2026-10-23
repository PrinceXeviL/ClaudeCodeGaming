"""23 Eki (Caner: "Mortimer için daha çok seçenek"): 2. tur aday sesler, üç tonu gösteren uzun replik (sakin/egolu, alaycı, emreden).
Çıktı ~/Downloads/GameLab/ses_oyuncu/mortimer2/<dil>_<n>_<ad>.mp3 + dinle/mortimer2_<dil>.mp3"""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.argv = [sys.argv[0]]
import elevenlabs_seslendir as E, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe(); k = E.key(); OUT = os.path.expanduser('~/Downloads/GameLab/ses_oyuncu/mortimer2'); os.makedirs(OUT, exist_ok=True)
LINE = {'tr': 'Bu topraklar benim. Ölüleri de... sessizliği de. Bir de general getirmişler, ne incelik. Kalkın dostlarım! Misafirlerimiz var.',
        'en': 'These lands are mine. The dead... and the silence. Oh, they brought a general. How thoughtful. Rise, my friends! We have guests.'}
CAST = {'tr': [('Orhan_Oyuncu', 'y6X1mFgtBqHFtQwrOezf'), ('Sercan_Esen', 'dLAxUPEUCZ9cz4KHisnL'), ('Erdem_Polat', 'j7muYRsIHo28KxuIfZjf'), ('Celil', 'Zpbxhg6LG47cY8y5BJrf'),
               ('Goksel', 'FrXe0VVv2EHm9zvR8Jra'), ('Can_Seckin', 'rSuyucEH95GpZEfLV0AM'), ('Kadir_Kayisci', 'j82ax9yhzfYwq9lDvRWL'), ('Fatih_Yildirim', '7VqWGAWwo2HMrylfKrcm'),
               ('Dogan_Akgul', 'eqPrDM1Ow5CTLgwoWqoi'), ('Emin', 'j9K9HnBcmgA6xNWqjlX0')],
        'en': [('Lance_Blackwood', 'agL69Vji082CshT65Tcy'), ('Victor_Eloquent', 'ttNi9wVM8M97tsxE7PFZ'), ('Prof_Mandrake', 'dUercWozs0yhe4xBCgZ0'), ('Jasper_Vayne', 'ybjoxm7ASLDUFh2pC2eM'),
               ('Zane_Evil', 'qbkH1EDealYs8PUoNNuB'), ('Mordred', 'UFO0Yv86wqRxAt1DmXUu'), ('Vampire_Lord', 'Tj9l48J9AJbry5yCP5eW'), ('Final_Boss', 'd3qrd1ge6zWDvUxIeXiH'),
               ('Julian', '7p1Ofvcwsv7UBPoFNcpI'), ('Raymond', 'b1A9OAVD1Yu0SjoFdv4A')]}
ST = {'stability': 0.4, 'similarity_boost': 0.85, 'style': 0.45, 'use_speaker_boost': True}
for lang, L in CAST.items():
    fs = []
    for n, (name, vid) in enumerate(L, 1):
        p = os.path.join(OUT, f'{lang}_{n:02d}_{name}.mp3')
        if not os.path.exists(p):
            try: open(p, 'wb').write(E.req('POST', f'/text-to-speech/{vid}?output_format=mp3_44100_128', k, {'text': LINE[lang], 'model_id': 'eleven_multilingual_v2', 'language_code': lang, 'voice_settings': ST}, raw=True))
            except Exception as e: print('HATA', name, str(e)[:120]); continue
        fs.append(p); print('ok', lang, n, name)
    a, fl = [], ''
    for i, f in enumerate(fs): a += ['-i', f]; fl += f'[{i}:a]aresample=44100,apad=pad_dur=1.2[a{i}];'
    fl += ''.join(f'[a{i}]' for i in range(len(fs))) + f'concat=n={len(fs)}:v=0:a=1[o]'
    subprocess.run([FF, '-y', '-v', 'error'] + a + ['-filter_complex', fl, '-map', '[o]', '-b:a', '160k', os.path.join(OUT, '..', 'dinle', f'mortimer2_{lang}.mp3')], check=True)
print(E.req('GET', '/user/subscription', k)['character_count'], 'karakter kullanıldı')
