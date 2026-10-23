"""23 Eki (Caner: "bütün konuşan karakterler ElevenLabs'te en kaliteli stüdyo kaydı ve oyuncu sesleriyle, hem Türkçe hem İngilizce"):
Mortimer + 4 komutan, seçilen profesyonel ses oyuncularıyla (varliklar/oyuncu_secim.json: {karakter: {tr: ses kimliği, en: ses kimliği}}).
- Model eleven_multilingual_v2 (profesyonel klonlarda en sadık), 44,1 kHz; her okuma scribe_v1 ile yazıya dökülür, metne benzerliği 0,85'in
  altındaysa eleven_v3 (duygu etiketli) ile bir kez daha okunur, iyisi kalır (karakter kotası: tek okuma + gerekenlerde ikinci).
- Mortimer: MORT_LINES'ın hepsi (varliklar/mortimer_replikler.json: Türkçe anahtar, İngilizce karşılık); {h}'li replikler her komutan adıyla ayrı.
  Çıktı ses/mort/mort_all.mp3 + sprite.json (Türkçe), mort_all_en.mp3 + sprite_en.json (İngilizce; öteki diller de bunu kullanır), 128 kb/sn.
- Komutanlar: varliklar/komutan_replikler.json → ses/<ad>.wav (Türkçe), ses/en_<ad>.wav (İngilizce), 32 kHz mono, ses düzeyi eşit (loudnorm).
- Eski dosyalar varliklar/cikti/ses_yedek_23eki/'ye kopyalanır (silinmez).
    SSL_CERT_FILE=/etc/ssl/cert.pem .venv/bin/python3 varliklar/oyuncu_seslendir.py [mortimer leonidas ...] [--dil tr|en] [--deneme]"""
import difflib, hashlib, json, os, re, shutil, subprocess, sys, uuid, urllib.request, wave
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv; sys.argv = [argv[0]]
import elevenlabs_seslendir as E
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
H = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(H); SES = os.path.join(ROOT, 'sinir-kalesi', 'ses')
HAM = os.path.join(H, 'ham', 'oyuncu_sesleri'); YEDEK = os.path.join(H, 'cikti', 'ses_yedek_23eki')
CAST = json.load(open(os.path.join(H, 'oyuncu_secim.json')))
ONLY = [a for a in argv[1:] if not a.startswith('--') and a not in ('tr', 'en')]
LANGS = [argv[argv.index('--dil') + 1]] if '--dil' in argv else ['tr', 'en']
TRY = '--deneme' in argv  # yalnız ilk 3 replik (kulak kontrolü)
HERO_NAME = {'leonidas': 'Leonidas', 'merlin': 'Merlin', 'robin': 'Robin', 'bathory': 'Báthory'}
k = E.key()
V2 = {'stability': 0.42, 'similarity_boost': 0.85, 'style': 0.4, 'use_speaker_boost': True}
V3 = {'stability': 0.5, 'similarity_boost': 0.85}


def stt(path):
    b = '----' + uuid.uuid4().hex; data = open(path, 'rb').read()
    body = (f'--{b}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n--{b}\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n').encode() + data + f'\r\n--{b}--\r\n'.encode()
    r = urllib.request.Request('https://api.elevenlabs.io/v1/speech-to-text', data=body, headers={'xi-api-key': k, 'Content-Type': 'multipart/form-data; boundary=' + b})
    return json.loads(urllib.request.urlopen(r, context=E.CTX, timeout=90).read()).get('text', '')


norm = lambda s: re.sub(r'[^\wçğıöşüâ ]', '', s.lower().replace('i̇', 'i')).split()
LATIN = re.compile(r'^(Fulgur|Ignis|Ictus|Caelum|Turbo|Sanguis|Morere|Cruor|Lacus|Vespertiliones|Vincula|Molon|Spartaaa|Hah)', re.I)


def say(voice, text, tag, lang, out):
    """Bir replik: v2 okuması, gerekirse v3; en iyisi out'a. Dönüş (benzerlik, okuma)."""
    os.makedirs(os.path.dirname(out), exist_ok=True)
    best = None
    for name, model, st, tagged in (('v2', 'eleven_multilingual_v2', V2, False), ('v3', 'eleven_v3', V3, True)):
        p = out[:-4] + f'.{name}.mp3'
        if not os.path.exists(p):
            body = {'text': (tag + ' ' + text).strip() if tagged and tag else text, 'model_id': model, 'voice_settings': st}
            if model != 'eleven_v3': body['language_code'] = lang
            try: open(p, 'wb').write(E.req('POST', f'/text-to-speech/{voice}?output_format=mp3_44100_128', k, body, raw=True))
            except Exception as e: print('HATA', out, name, str(e)[:120]); continue
        if LATIN.match(text) or len(norm(text)) <= 1: sim, heard = 1.0, '(kısa/latince)'  # yazıya dökme ölçüsü anlamsız
        else:
            try: heard = stt(p)
            except Exception as e: heard = ''
            sim = difflib.SequenceMatcher(None, norm(text), norm(heard)).ratio()
            if 'sersemledi' in norm(text) and 'sersemlemedi' in norm(heard): sim = 0  # 23 Eki: olumsuz okunmuş (anlam tersine)
            if re.search(r'\[|laugh|whisper|sarcastic|shouting', heard, re.I) and not re.search(r'laugh|whisper', text, re.I): sim -= 0.5  # etiket okunmuş
        if not best or sim > best[0] + 0.02: best = (sim, name, p, heard)
        if best[0] >= 0.85 and not (text.endswith('sersemledi.') and 'sersemlemedi' in norm(heard)): break
    if best: shutil.copyfile(best[2], out)
    return best


def wav_of(mp3, wav, sr):
    af = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,loudnorm=I=-16:TP=-1.5:LRA=11'
    if subprocess.run([FF, '-y', '-loglevel', 'error', '-i', mp3, '-af', af, '-ac', '1', '-ar', str(sr), '-sample_fmt', 's16', wav]).returncode:
        subprocess.run([FF, '-y', '-loglevel', 'error', '-i', mp3, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', str(sr), '-sample_fmt', 's16', wav], check=True)


def backup(path):
    if os.path.exists(path):
        d = os.path.join(YEDEK, os.path.relpath(os.path.dirname(path), SES)); os.makedirs(d, exist_ok=True)
        t = os.path.join(d, os.path.basename(path))
        if not os.path.exists(t): shutil.copyfile(path, t)


report = {}
# ---- Mortimer ----
if not ONLY or 'mortimer' in ONLY:
    R = json.load(open(os.path.join(H, 'mortimer_replikler.json')))
    TAG = {'start': '[confident]', 'start2': '[mocking]', 'leak': '[annoyed]', 'firstleak': '[annoyed]', 'low': '[menacing]', 'boss': '[sarcastic]', 'bossRage': '[mocking]',
           'bossDown': '[smug]', 'raise': '[commanding]', 'fear': '[sinister laugh]', 'scold': '[irritated]', 'scoldHero': '[angry]', 'clean': '[smug]', 'tea': '[calm]', 'loot': '[amused]',
           'rich': '[amused]', 'heroDown': '[annoyed]', 'gatebreak': '[furious]', 'wall': '[confident]', 'burst': '[gleeful]'}
    for lang in LANGS:
        voice = CAST['mortimer'][lang]; spans, pcm, SR, GAP = {}, bytearray(), 44100, 0.25
        items = []
        for tr, v in R.items():
            text = tr if lang == 'tr' else v['en']
            if '{h}' in tr:
                for hid, nm in HERO_NAME.items(): items.append((tr.replace('{h}', nm), text.replace('{h}', nm), v['kind']))
            else: items.append((tr, text, v['kind']))
        if TRY: items = items[:3]
        for key, text, kind in items:
            out = os.path.join(HAM, 'mortimer', lang, hashlib.md5(key.encode()).hexdigest()[:12] + '.mp3')
            b = say(voice, text, TAG.get(kind, '[confident]'), lang, out)
            if not b: continue
            report[f'mortimer/{lang}/{key}'] = [round(b[0], 2), b[1]]
            raw = subprocess.run([FF, '-v', 'error', '-i', out, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11',
                                  '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
            spans[key] = (round(len(pcm) / 2 / SR, 4), round(len(raw) / 2 / SR, 4)); pcm += raw + b'\x00\x00' * int(SR * GAP)
            print('mortimer', lang, f'{b[0]:.2f}', b[1], '|', text[:60])
        if TRY: continue
        D = os.path.join(SES, 'mort'); f = '' if lang == 'tr' else '_en'
        backup(os.path.join(D, f'mort_all{f}.mp3')); backup(os.path.join(D, f'sprite{f}.json'))
        tmp = os.path.join(D, '_tmp.wav')
        with wave.open(tmp, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(pcm))
        subprocess.run([FF, '-v', 'error', '-y', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', '128k', os.path.join(D, f'mort_all{f}.mp3')], check=True); os.remove(tmp)
        json.dump(spans, open(os.path.join(D, f'sprite{f}.json'), 'w'), ensure_ascii=False, indent=0)
        print('mortimer', lang, len(spans), 'replik', round(len(pcm) / 2 / SR, 1), 'sn')
# ---- komutanlar ----
HL = json.load(open(os.path.join(H, 'komutan_replikler.json')))
PRE = {'leonidas': ('hsel_leonidas', 'hmove_leonidas', 'lv'), 'merlin': ('hsel_merlin', 'hmove_merlin', 'mv'), 'robin': ('hsel_robin', 'hmove_robin', 'rv'), 'bathory': ('hsel_bathory', 'hmove_bathory', 'bv')}
man = json.load(open(os.path.join(SES, 'manifest.json')))
for hid, pre in PRE.items():
    if ONLY and hid not in ONLY: continue
    keys = [n for n in HL if n.startswith(pre)]
    if TRY: keys = keys[:3]
    for lang in LANGS:
        voice = CAST[hid][lang]
        for n in keys:
            L = HL[n]; text = L[lang]
            out = os.path.join(HAM, hid, lang, n + '.mp3')
            b = say(voice, text, L['tag'], lang, out)
            if not b: continue
            report[f'{hid}/{lang}/{n}'] = [round(b[0], 2), b[1]]
            if TRY: print(hid, lang, f'{b[0]:.2f}', b[1], '|', text); continue
            name = n if lang == 'tr' else 'en_' + n
            wav = os.path.join(SES, name + '.wav'); backup(wav); wav_of(out, wav, 32000)
            if name not in man: man.append(name)
            print(hid, lang, f'{b[0]:.2f}', b[1], '|', text)
if not TRY: json.dump(sorted(man), open(os.path.join(SES, 'manifest.json'), 'w'))
json.dump(report, open(os.path.join(HAM, 'rapor.json'), 'w'), ensure_ascii=False, indent=0)
bad = {k: v for k, v in report.items() if v[0] < 0.8}
print(len(report), 'okuma;', len(bad), 'zayıf:', json.dumps(bad, ensure_ascii=False)[:600])
print(E.req('GET', '/user/subscription', k)['character_count'], 'karakter kullanıldı')
