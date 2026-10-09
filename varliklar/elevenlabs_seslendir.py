"""Mortimer'ın repliklerini ElevenLabs ile seslendirir (ses: "Callum - Husky Trickster" (ücretsiz planda hazır ses), model: Eleven Multilingual v2).

    python3 varliklar/elevenlabs_seslendir.py            # eksik replikleri üretir (var olanı atlar)
    python3 varliklar/elevenlabs_seslendir.py --dene 3   # yalnız ilk 3 replik (ses tonunu denemek için)
    python3 varliklar/elevenlabs_seslendir.py --yeniden  # hepsini baştan üretir

Anahtar: repo kökündeki .env -> ELEVENLABS_API_KEY=... (git'e girmez; anahtarı kullanıcı kendisi ekler).
Replikler game.js MORT_LINES'tan okunur. Çıktı: sinir-kalesi/ses/mort/<kısa-özet>.mp3 + index.json (yazı -> dosya).
Oyun (game.js mortVoice) balondaki yazının dosyası varsa onu çalar, yoksa sentez mırıltıya düşer.
LİSANS: ücretsiz planda üretilen ses ticari kullanılamaz; mağaza sürümü için Starter (veya üstü) planla yeniden üret.
"""
import hashlib, json, os, re, ssl, subprocess, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, 'sinir-kalesi', 'js', 'game.js')
OUT = os.path.join(ROOT, 'sinir-kalesi', 'ses', 'mort')
API = 'https://api.elevenlabs.io/v1'
VOICE_SEARCH = 'Callum'  # --ses AD ile değiştirilir (Mordred ücretli plan ister; ücretsizde ör. 'Altinsoy' ya da 'Callum')
MODEL = 'eleven_multilingual_v2'
# alaycı, teatral ama anlaşılır: orta kararlılık, biraz stil
SETTINGS = {'stability': 0.45, 'similarity_boost': 0.8, 'style': 0.35, 'use_speaker_boost': True}


def key():
    k = os.environ.get('ELEVENLABS_API_KEY')
    env = os.path.join(ROOT, '.env')
    if not k and os.path.exists(env):
        for line in open(env, encoding='utf-8'):
            if line.startswith('ELEVENLABS_API_KEY='): k = line.split('=', 1)[1].strip().strip('"\'')
    m = re.search(r'sk_[0-9a-f]{40,64}', k or '')  # yapıştırırken araya giren kaçış kodları / yinelenen kopyalar ayıklanır
    if not m: sys.exit('ELEVENLABS_API_KEY yok ya da biçimi tanınmadı: repo kökündeki .env dosyasına ekle.')
    return m.group(0)


# python.org Python'u macOS sertifikalarını görmez: certifi ya da sistemin cert.pem dosyası
try:
    import certifi; CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context(cafile='/etc/ssl/cert.pem') if os.path.exists('/etc/ssl/cert.pem') else None


def req(method, path, k, body=None, raw=False):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method,
                               headers={'xi-api-key': k, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' if raw else 'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(r, timeout=90, context=CTX) as resp:
                b = resp.read()
                return b if raw else json.loads(b or b'{}')
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='replace')[:300]
            if e.code == 429 and attempt < 3: time.sleep(5 * (attempt + 1)); continue
            sys.exit(f'HTTP {e.code} {path}: {msg}')


def voice_id(k):
    global VOICE_SEARCH
    if '--ses' in sys.argv: VOICE_SEARCH = sys.argv[sys.argv.index('--ses') + 1]
    mine = req('GET', '/voices', k).get('voices', [])
    for v in mine:
        if VOICE_SEARCH.lower() in v.get('name', '').lower(): return v['voice_id']
    shared = req('GET', f'/shared-voices?search={VOICE_SEARCH}&page_size=10', k).get('voices', [])
    if not shared: sys.exit('Kütüphanede ses bulunamadı: ' + VOICE_SEARCH)
    s = shared[0]
    print('kütüphaneden ekleniyor:', s.get('name'))
    r = req('POST', f"/voices/add/{s['public_owner_id']}/{s['voice_id']}", k, {'new_name': 'Mordred (Mortimer)'})
    return r.get('voice_id', s['voice_id'])


def lines():
    js = ("const s=require('fs').readFileSync(process.argv[1],'utf8');const a=s.indexOf('const MORT_LINES = {');"
          "const b=s.indexOf('\\n};',a);const o=eval('('+s.slice(a+'const MORT_LINES = '.length,b+2)+')');"
          "console.log(JSON.stringify(Object.values(o).flat()));")
    return list(dict.fromkeys(json.loads(subprocess.check_output(['node', '-e', js, GAME]))))


def fname(text):
    return hashlib.sha1(text.encode()).hexdigest()[:12] + '.mp3'


def main():
    global OUT
    if '--cikti' in sys.argv: OUT = sys.argv[sys.argv.index('--cikti') + 1]  # deneme sesleri için ayrı klasör
    k = key(); vid = voice_id(k); os.makedirs(OUT, exist_ok=True)
    L = lines()
    if '--dene' in sys.argv: L = L[:int(sys.argv[sys.argv.index('--dene') + 1])]
    idx_path = os.path.join(OUT, 'index.json')
    idx = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
    for i, t in enumerate(L, 1):
        f = fname(t); p = os.path.join(OUT, f)
        if os.path.exists(p) and '--yeniden' not in sys.argv: idx[t] = f; continue
        audio = req('POST', f'/text-to-speech/{vid}?output_format=mp3_44100_64', k,
                    {'text': t, 'model_id': MODEL, 'voice_settings': SETTINGS}, raw=True)
        open(p, 'wb').write(audio); idx[t] = f
        print(f'{i}/{len(L)} {f} {t}')
    json.dump(idx, open(idx_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(len(idx), 'replik hazır ->', OUT)


if __name__ == '__main__':
    main()
