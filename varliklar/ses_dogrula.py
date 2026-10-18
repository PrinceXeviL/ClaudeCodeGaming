"""ElevenLabs sesini yazıya çevirip kontrol eder (scribe_v1): Türkçe anlaşılıyor mu, köşeli etiket yüksek sesle okunmuş mu.
    SSL_CERT_FILE=/etc/ssl/cert.pem .venv/bin/python3 varliklar/ses_dogrula.py <mp3> ..."""
import json, os, sys, uuid, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
argv = sys.argv; sys.argv = [argv[0]]
import elevenlabs_seslendir as E
k = E.key()
for f in argv[1:]:
    b = '----' + uuid.uuid4().hex; data = open(f, 'rb').read()
    body = (f'--{b}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n--{b}\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n').encode() + data + f'\r\n--{b}--\r\n'.encode()
    r = urllib.request.Request('https://api.elevenlabs.io/v1/speech-to-text', data=body, headers={'xi-api-key': k, 'Content-Type': 'multipart/form-data; boundary=' + b})
    try: o = json.loads(urllib.request.urlopen(r).read()); print(os.path.basename(f), '|', o.get('language_code'), '|', o.get('text'))
    except Exception as e: print(os.path.basename(f), 'HATA', e)
