"""Fragman v2 seslendirmesi (22 Eki, Caner: "seslendirmeler daha özenli olsun"): Mortimer (ElevenLabs Callum), TR + EN, 10 replik.
Her replik için 3 okuma (eleven_v3 duygu etiketli + multilingual_v2 iki ayar); hepsi scribe_v1 ile yazıya çevrilir, metne en yakın olan
(eşitlikte v3) seçilir. Çıktı: varliklar/ham/fragman2/vo_<dil>_<n>.mp3 (+ secim.json: okumalar, yazıya dökümler, benzerlik).
    SSL_CERT_FILE=/etc/ssl/cert.pem .venv/bin/python3 varliklar/fragman_ses2.py
"""
import difflib, json, os, re, shutil, sys, uuid, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv; sys.argv = [argv[0]]
import elevenlabs_seslendir as E
OUT = os.path.join(E.ROOT, 'varliklar', 'ham', 'fragman2'); os.makedirs(OUT, exist_ok=True)
# (duygu etiketi v3 için, TR, EN)
LINES = [
    ('[tired, low voice]', 'Her gece... hep aynı şey.', 'Every night... the same thing.'),
    ('[wistful]', 'Tek istediğim... sessiz bir fincan kahve.', 'All I ask for... is one quiet cup of coffee.'),
    ('[annoyed]', 'Ve her gece, İmparatorluk kapımı çalıyor.', 'And every night... the Empire comes knocking.'),
    ('[angry, shouting]', 'Yeter!', 'Enough!'),
    ('[sinister, playful]', 'Kemik. Veba. Şimşek. Seç birini.', 'Bones. Plague. Lightning. Pick your poison.'),
    ('[commanding, dramatic]', 'Kalkın dostlarım... misafirlerimiz var.', 'Rise, my friends... we have guests.'),
    ('[sarcastic]', 'Bir de general getirmişler. Ne incelik.', 'Oh, they brought a general. How thoughtful.'),
    ('[grand]', 'Efsaneler... buyurun.', 'Legends... if you please.'),
    ('[calm, satisfied]', 'Şimdi... nerede kalmıştım?', 'Now... where was I?'),
    ('[menacing whisper]', "Necromancer'a bulaşma.", "Don't mess with the Necromancer."),
]
k = E.key()
V = next(x for x in E.req('GET', '/voices', k)['voices'] if x['name'].startswith('Callum'))['voice_id']
TAKES = [('v3', 'eleven_v3', {'stability': 0.5, 'similarity_boost': 0.8}, True),
         ('v2a', 'eleven_multilingual_v2', {'stability': 0.38, 'similarity_boost': 0.8, 'style': 0.45, 'use_speaker_boost': True}, False),
         ('v2b', 'eleven_multilingual_v2', {'stability': 0.55, 'similarity_boost': 0.85, 'style': 0.25, 'use_speaker_boost': True}, False)]


def stt(path):
    b = '----' + uuid.uuid4().hex; data = open(path, 'rb').read()
    body = (f'--{b}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n--{b}\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n').encode() + data + f'\r\n--{b}--\r\n'.encode()
    r = urllib.request.Request('https://api.elevenlabs.io/v1/speech-to-text', data=body, headers={'xi-api-key': k, 'Content-Type': 'multipart/form-data; boundary=' + b})
    return json.loads(urllib.request.urlopen(r, context=E.CTX, timeout=90).read()).get('text', '')


norm = lambda s: re.sub(r'[^\wçğıöşüâ ]', '', s.lower().replace('i̇', 'i')).split()
sel = {}
for lang_i, lang in ((1, 'tr'), (2, 'en')):
    for n, L in enumerate(LINES, 1):
        text, best = L[lang_i], None
        for tag, model, st, tagged in TAKES:
            p = os.path.join(OUT, f'take_{lang}_{n}_{tag}.mp3')
            if not os.path.exists(p):
                body = {'text': (L[0] + ' ' + text) if tagged else text, 'model_id': model, 'voice_settings': st}
                if model != 'eleven_v3': body['language_code'] = lang
                try: open(p, 'wb').write(E.req('POST', f'/text-to-speech/{V}?output_format=mp3_44100_128', k, body, raw=True))
                except Exception as e: print('HATA', p, e); continue
            try: heard = stt(p)
            except Exception as e: heard = ''; print('stt hata', e)
            sim = difflib.SequenceMatcher(None, norm(text), norm(heard)).ratio()
            if re.search(r'\[|tired|angry|whisper|sarcastic', heard, re.I) and not re.search(r'tired|angry', text, re.I): sim -= 0.5  # etiket okunmuş
            print(lang, n, tag, f'{sim:.2f}', '|', heard)
            if not best or sim > best[0] + 0.02 or (abs(sim - best[0]) <= 0.02 and tag == 'v3'): best = (sim, tag, p, heard)
        if best:
            shutil.copyfile(best[2], os.path.join(OUT, f'vo_{lang}_{n}.mp3'))
            sel[f'{lang}_{n}'] = {'take': best[1], 'sim': round(best[0], 2), 'heard': best[3]}
json.dump(sel, open(os.path.join(OUT, 'secim.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps(sel, ensure_ascii=False, indent=1))
