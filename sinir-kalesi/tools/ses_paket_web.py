"""Web yayını için MP3 ses paketi (18 Eki): claude.ai yayını sürüm başına en çok 256 MB tutuyor, WAV paketleri (~29 MB) yer kaplıyordu.
ses/paket.json'daki her ses ayrı ayrı MP3'e çevrilir (her parça tam bir MP3 dosyası, oyun dilim dilim çözer) ve ses/paket.mp3'te birleşir.
Çıktı <klasör>/paket.mp3 + paket.json (girdilerin 5. alanı 'mp3'). Telefon sürümü WAV paketini kullanmaya devam eder.
    python3 tools/ses_paket_web.py <çıkış klasörü>"""
import json, os, subprocess, sys, tempfile
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ses'); out = sys.argv[1]; os.makedirs(out, exist_ok=True)
idx = json.load(open(os.path.join(D, 'paket.json'))); parts = {}
def part(k):
    if k not in parts: parts[k] = open(os.path.join(D, 'paket.wav' if k == 0 else f'paket{k + 1}.wav'), 'rb').read()
    return parts[k]
tmp = tempfile.mkdtemp(); res, off = [], 0; mp = open(os.path.join(out, 'paket.mp3'), 'wb')
for name, o, n, k in idx:
    w = os.path.join(tmp, 'a.wav'); m = os.path.join(tmp, 'a.mp3'); open(w, 'wb').write(part(k)[o:o + n])
    subprocess.run([FF, '-v', 'error', '-y', '-i', w, '-codec:a', 'libmp3lame', '-b:a', '112k', m], check=True)
    b = open(m, 'rb').read(); mp.write(b); res.append([name, off, len(b), 0, 'mp3']); off += len(b)
mp.close(); json.dump(res, open(os.path.join(out, 'paket.json'), 'w'))
print(len(res), 'ses,', off // 1024, 'KB')
