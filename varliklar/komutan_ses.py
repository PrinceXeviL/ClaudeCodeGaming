"""Komutan konuşma sesleri (18 Eki, Caner: "Báthory gibi diğer tüm komutanları seslendir, en iyi sesleri tercih et").
Báthory'nin düzeni (varliklar/bathory_ses.py) genelleşti: seçilince / yürütünce (hsel_<id><v>_N, hmove_<id><v>_N), saldırı, güç, ikinci güç,
yetenek, alay, can azalınca, dirilince (<önek>atk/ult/ult2/sk/taunt/low/back_N). Sözler seyrek (game.js HERO_VOICE). ElevenLabs eleven_v3.
Sesler: Leonidas = Harry "Fierce Warrior", Merlin = George "Warm Captivating Storyteller" (İngiliz, bilge büyücü), Robin = Callum "Husky Trickster".
Büyü sözleri Latince (Merlin), savaş narası Yunanca (Leonidas: Alala, Molon labe).
LİSANS: ücretsiz planda üretildi; mağaza öncesi ücretli planda yeniden üret (ses-lisanslari notu).
    SSL_CERT_FILE=/etc/ssl/cert.pem .venv/bin/python3 varliklar/komutan_ses.py [komutan ...] [--yeniden]"""
import json, os, subprocess, sys, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv; sys.argv = [argv[0]]
import elevenlabs_seslendir as E
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SES = os.path.join(ROOT, 'sinir-kalesi', 'ses')
HEROES = {
  'leonidas': ('SOYHLrjzK2X1ezoPC6cr', {
    'hsel_leonidas2_1': '[commanding] Emrindeyim! Sparta asla diz çökmez.',
    'hsel_leonidas2_2': '[proud, deep] Kalkanım hazır.',
    'hsel_leonidas2_3': '[gruff laugh] Ölüm mü? Onu çoktan yendim.',
    'hmove_leonidas2_1': '[firm] İleri!',
    'hmove_leonidas2_2': '[commanding] Safları koruyun!',
    'lvatk_1': '[battle cry, shouting] Spartaaa!',
    'lvatk_2': '[fierce] Molon labe!',
    'lvatk_3': '[grunting, effort] Hah!',
    'lvult_1': '[shouting] Mızraklar, gökyüzünü karartın!',
    'lvult2_1': '[roaring] Falanks! Geçit yok!',
    'lvsk_1': '[battle cry] Hücum!',
    'lvtaunt_1': '[contemptuous laugh] Persler bile sizden iyi savaşırdı.',
    'lvlow_1': '[strained, defiant] Bir Spartalı... düşmez!',
    'lvback_1': '[proud] Sparta geri döndü!',
  }),
  'merlin': ('JBFqnCBsd6RMkjVDRZzb', {
    'hsel_merlin2_1': '[wise, amused] Hımm... bir büyü mü lazım?',
    'hsel_merlin2_2': '[mysterious, slow] Yıldızlar bugün kanlı konuşuyor.',
    'hsel_merlin2_3': '[grumpy] Asam nerede... Ah, elimdeymiş.',
    'hmove_merlin2_1': '[sighs] Bu yaşta yürüyüş...',
    'hmove_merlin2_2': '[calm] Yolu görüyorum.',
    'mvatk_1': '[chanting] Fulgur!',
    'mvatk_2': '[chanting] Ignis arcana!',
    'mvatk_3': '[intense whisper] Ictus.',
    'mvult_1': '[booming, commanding] Caelum, cade!',
    'mvult2_1': '[chanting, rising] Turbo tempestatis!',
    'mvsk_1': '[mischievous] Vrak vrak, sevgili düşmanım.',
    'mvtaunt_1': '[chuckles] Bin yıldır böyle beceriksiz görmedim.',
    'mvlow_1': '[coughing] Kemiklerim eskisi gibi değil...',
    'mvback_1': '[amused] Ölüm mü? Onu zaten denemiştim.',
  }),
  'robin': ('N2lVS1w4EtoT3dr4eOWO', {
    'hsel_robin3_1': '[sly] Hedefi göster, gerisi bende.',
    'hsel_robin3_2': '[whispering, playful] Ormanın gölgesi benim evim.',
    'hsel_robin3_3': '[smirking] Zenginden alırım... ölüden de.',
    'hmove_robin3_1': '[quietly] Sessizce...',
    'hmove_robin3_2': '[confident] Kurdum, peşimden.',
    'rvatk_1': '[cocky] Al bakalım!',
    'rvatk_2': '[cocky] Bir ok, bir ölü.',
    'rvatk_3': '[sly] Kaçamazsın.',
    'rvult_1': '[shouting] Gökyüzü ok yağdıracak!',
    'rvult2_1': '[fierce, shouting] Kurtlarım! Av zamanı!',
    'rvsk_1': '[playful] Bıçaklar uçuyor!',
    'rvtaunt_1': '[mocking] Şerif bile senden iyi nişan alırdı.',
    'rvlow_1': '[pained, wry] Bu yara... iz bırakacak.',
    'rvback_1': '[cheeky] Özlediniz mi beni?',
  }),
}
FF = glob.glob(os.path.join(ROOT, '.venv', 'lib', 'python3*', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg*'))[0]
k = E.key(); man = json.load(open(os.path.join(SES, 'manifest.json')))
only = [a for a in argv[1:] if not a.startswith('--')]
for hid, (voice, lines) in HEROES.items():
    if only and hid not in only: continue
    HAM = os.path.join(ROOT, 'varliklar', 'ham', 'ses', 'eleven', hid); os.makedirs(HAM, exist_ok=True)
    for name, text in lines.items():
        mp3 = os.path.join(HAM, name + '.mp3')
        if '--yeniden' in argv or not os.path.exists(mp3):
            b = E.req('POST', f'/text-to-speech/{voice}?output_format=mp3_44100_128', k, {'text': text, 'model_id': 'eleven_v3', 'language_code': 'tr', 'voice_settings': {'stability': 0.5, 'similarity_boost': 0.8}}, raw=True)
            open(mp3, 'wb').write(b)
        wav = os.path.join(SES, name + '.wav')
        af = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,loudnorm=I=-16:TP=-1.5:LRA=11'
        if subprocess.run([FF, '-y', '-loglevel', 'error', '-i', mp3, '-af', af, '-ac', '1', '-ar', '22050', '-sample_fmt', 's16', wav]).returncode:  # ffmpeg sessizlik süzgecinde çöküyor: yalnız düzey eşitle
            subprocess.run([FF, '-y', '-loglevel', 'error', '-i', mp3, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '22050', '-sample_fmt', 's16', wav], check=True)
        if name not in man: man.append(name)
        print(name, os.path.getsize(wav) // 1024, 'KB')
json.dump(sorted(man), open(os.path.join(SES, 'manifest.json'), 'w'))
