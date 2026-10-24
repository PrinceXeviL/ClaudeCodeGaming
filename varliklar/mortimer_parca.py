"""24 Eki (bellek): Mortimer'ın replikleri telefonda tek tek dosya (ses/mort/<tr|en>/<n>.mp3 + ses/mort/parca[_en].json {metin: n}).
Oyun telefonda yalnız çalınacak repliği açar (eskiden 7,7 dk'lık mort_all tek parça açılıp ~40-85 MB bellek tutuyordu). Web yine mort_all kullanır.
Kaynak: oyuncu_seslendir.py'nin replik başına kayıtları (varliklar/ham/oyuncu_sesleri/mortimer/<dil>/<md5>.mp3); sessizlik kırpılır, ses düzeyi eşitlenir, 24 kHz mono 48 kb/sn.
    .venv/bin/python3 varliklar/mortimer_parca.py"""
import hashlib, json, os, subprocess
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
H = os.path.dirname(os.path.abspath(__file__)); SES = os.path.join(H, '..', 'sinir-kalesi', 'ses', 'mort'); HAM = os.path.join(H, 'ham', 'oyuncu_sesleri', 'mortimer')
AF = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1.5:LRA=11'
for lang, f in (('tr', ''), ('en', '_en')):
    sp = json.load(open(os.path.join(SES, f'sprite{f}.json'))); out = os.path.join(SES, lang); os.makedirs(out, exist_ok=True)
    idx = {}; tot = 0
    for n, key in enumerate(sp):
        src = os.path.join(HAM, lang, hashlib.md5(key.encode()).hexdigest()[:12] + '.mp3')
        if not os.path.exists(src): print('yok', lang, key[:40]); continue
        dst = os.path.join(out, f'{n}.mp3')
        subprocess.run([FF, '-v', 'error', '-y', '-i', src, '-af', AF, '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '48k', dst], check=True)
        idx[key] = n; tot += os.path.getsize(dst)
    json.dump(idx, open(os.path.join(SES, f'parca{f}.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    print(lang, len(idx), 'replik', round(tot / 1048576, 1), 'MB')
