"""Mortimer'ın seslendirilmiş replikleri (varliklar/ham/mort/*.mp3) tek dosyada birleştirilir (ses ızgarası): yayın 512 dosya sınırına
takılmasın, uygulama tek istekte yüklesin. Çıktı: ses/mort/mort_all.mp3 + ses/mort/sprite.json {yazı: [başlangıç sn, süre sn]}.
Replikler arasına 0,25 sn sessizlik konur. ffmpeg: imageio_ffmpeg'in ikilisi."""
import json, os, subprocess, sys, wave, struct
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
H = os.path.dirname(os.path.abspath(__file__))
SRC, D = os.path.join(H, 'ham', 'mort'), os.path.join(H, '..', 'sinir-kalesi', 'ses', 'mort')  # kaynak mp3'ler oyuna girmez
idx = json.load(open(os.path.join(SRC, 'index.json')))
SR, GAP = 44100, 0.25
pcm, pos, spans = bytearray(), {}, {}
for text, f in idx.items():
    if f not in pos:
        raw = subprocess.run([FF, '-v', 'error', '-i', os.path.join(SRC, f), '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
        start = len(pcm) / 2 / SR
        pcm += raw; pos[f] = (round(start, 4), round(len(raw) / 2 / SR, 4))
        pcm += b'\x00\x00' * int(SR * GAP)
    spans[text] = pos[f]
tmp = os.path.join(D, '_tmp.wav')
with wave.open(tmp, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(pcm))
subprocess.run([FF, '-v', 'error', '-y', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', '80k', os.path.join(D, 'mort_all.mp3')], check=True)
os.remove(tmp)
json.dump(spans, open(os.path.join(D, 'sprite.json'), 'w'), ensure_ascii=False, indent=0)
print(len(pos), 'dosya,', len(spans), 'replik,', round(len(pcm) / 2 / SR, 1), 'sn', os.path.getsize(os.path.join(D, 'mort_all.mp3')) // 1024, 'KB')
