"""ses/*.wav (manifest.json sırasıyla) -> ses/paket.bin + ses/paket.json [[ad, başlangıç, uzunluk], ...]
Yayın (Artifact) sürüm başına en çok 512 dosya tutar; 140'ı aşkın kısa ses tek pakette (11 Eki). Oyun önce paketi dener, yoksa tek tek WAV yükler.
    python3 tools/ses_paket.py   (sinir-kalesi klasöründen; yeni ses eklenince yeniden çalıştır)
"""
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ses')
names = json.load(open(os.path.join(D, 'manifest.json')))
idx, off = [], 0
with open(os.path.join(D, 'paket.bin'), 'wb') as out:
    for n in names:
        b = open(os.path.join(D, n + '.wav'), 'rb').read()
        out.write(b); idx.append([n, off, len(b)]); off += len(b)
json.dump(idx, open(os.path.join(D, 'paket.json'), 'w'))
print(len(idx), 'ses,', off // 1024, 'KB')
