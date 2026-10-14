"""ses/*.wav (manifest.json sırasıyla) -> ses/paket.wav, paket2.wav, ... (WAV'ların art arda eklenmiş hali; yayın .bin sunmuyor)
+ ses/paket.json [[ad, başlangıç, uzunluk, parça], ...] (parça 0 = paket.wav, 1 = paket2.wav ...).
Yayın (Artifact) sürüm başına en çok 512 dosya tutar; 140'ı aşkın kısa ses pakette (11 Eki). 14 Eki: Artifact dosya başına en çok 15 MB
yüklüyor (Envato sesleriyle paket 16 MB oldu): her parça en çok PART bayt. Oyun önce paketi dener, yoksa tek tek WAV yükler.
    python3 tools/ses_paket.py   (sinir-kalesi klasöründen; yeni ses eklenince yeniden çalıştır)
"""
import glob, json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ses')
PART = 12 * 1024 * 1024
names = json.load(open(os.path.join(D, 'manifest.json')))
for p in glob.glob(os.path.join(D, 'paket[0-9]*.wav')): os.remove(p)  # eski fazla parçalar kalmasın
idx, part, off, total = [], 0, 0, 0
fname = lambda k: os.path.join(D, 'paket.wav' if k == 0 else f'paket{k + 1}.wav')
out = open(fname(0), 'wb')
for n in names:
    b = open(os.path.join(D, n + '.wav'), 'rb').read()
    if off and off + len(b) > PART: out.close(); part += 1; off = 0; out = open(fname(part), 'wb')
    out.write(b); idx.append([n, off, len(b), part]); off += len(b); total += len(b)
out.close()
json.dump(idx, open(os.path.join(D, 'paket.json'), 'w'))
print(len(idx), 'ses,', total // 1024, 'KB,', part + 1, 'parça')
