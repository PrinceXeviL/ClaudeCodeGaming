"""Báthory'nin konuşma sesleri (17 Eki, Caner: "güçlü bir kadın sesi, alaycı kibirli konuşan bir büyücü; replikler seyrek; saldırı ve büyü sözleri Latince").
ElevenLabs ses "Lily - Velvety Actress" (Caner seçti), model eleven_v3 (köşeli parantezli duygu etiketleri). ham: varliklar/ham/ses/eleven/bathory/<ad>.mp3
-> sinir-kalesi/ses/<ad>.wav (22 kHz mono, baş/son sessizlik kırpılır, ses düzeyi eşitlenir) + ses/manifest.json; sonra tools/ses_paket.py.
LİSANS: ücretsiz planda üretildi; mağaza öncesi ücretli planda yeniden üret (ses-lisanslari notu).
    SSL_CERT_FILE=/etc/ssl/cert.pem python3 varliklar/bathory_ses.py [--yeniden]"""
import json, os, subprocess, sys, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv; sys.argv = [argv[0]]
import elevenlabs_seslendir as E
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SES = os.path.join(ROOT, 'sinir-kalesi', 'ses')
HAM = os.path.join(ROOT, 'varliklar', 'ham', 'ses', 'eleven', 'bathory'); os.makedirs(HAM, exist_ok=True)
VOICE = 'pFZP5JQG7iQjIQuC4Bku'
LINES = {
    'hsel_bathory2_1': '[arrogant] Emret bakalım, ölümlü.',
    'hsel_bathory2_2': '[haughty] Güzelliğim ebedi... Sabrım değil.',
    'hsel_bathory2_3': '[whispering, seductive] Kan çağırıyor... dinliyorum.',
    'hmove_bathory2_1': '[annoyed] Eteklerim kirlenmesin.',
    'hmove_bathory2_2': '[amused] Kanın kokusu oradan geliyor.',
    'bvatk_1': '[fierce] Sanguis!',
    'bvatk_2': '[cold, cruel] Morere!',
    'bvatk_3': '[fierce] Cruor!',
    'bvult_1': '[commanding, powerful] Lacus sanguinis, surge!',
    'bvult2_1': '[commanding] Vespertiliones, ad me!',
    'bvlink_1': '[hissing] Vincula sanguinis!',
    'bvtaunt_1': '[sarcastic laugh] Bu mu imparatorluğun en iyisi? Yazık.',
    'bvtaunt_2': '[disgusted] Kanın tadı bile sıradan.',
    'bvlow_1': '[furious] Elbisemi yırttın. Bunu ödeyeceksin!',
    'bvback_1': '[smug] Geri döndüm. Özlediniz mi?',
}
FF = glob.glob(os.path.join(ROOT, '.venv', 'lib', 'python3*', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg*'))[0]
k = E.key(); man = json.load(open(os.path.join(SES, 'manifest.json')))
for name, text in LINES.items():
    mp3 = os.path.join(HAM, name + '.mp3')
    if '--yeniden' in argv or not os.path.exists(mp3):
        b = E.req('POST', f'/text-to-speech/{VOICE}?output_format=mp3_44100_128', k, {'text': text, 'model_id': 'eleven_v3', 'voice_settings': {'stability': 0.5, 'similarity_boost': 0.8}}, raw=True)
        open(mp3, 'wb').write(b)
    wav = os.path.join(SES, name + '.wav')
    af = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,loudnorm=I=-16:TP=-1.5:LRA=11'
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', mp3, '-af', af, '-ac', '1', '-ar', '22050', '-sample_fmt', 's16', wav], check=True)
    if name not in man: man.append(name)
    print(name, os.path.getsize(wav) // 1024, 'KB')
json.dump(sorted(man), open(os.path.join(SES, 'manifest.json'), 'w'))
