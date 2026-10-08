"""Düşman animasyonlarını ücretsiz üretir: Hugging Face'teki Wan 2.2 "ilk-son kare" alanı (hesap gerekmez).

    python3 varliklar/video_uret.py gladiator assassin ...   # yürüyüş şeritleri (enemy_<tür>_walk)
    python3 varliklar/video_uret.py --hepsi                  # şeridi olmayan bütün ana düşmanlar

Akış: img/enemy_<tür>.webp magenta zemine konur (832x480) → aynı görsel hem ilk hem son kare verilir
(dikişsiz döngü) → video varliklar/ham/anim/<tür>_yuru.mp4 → video_isle.py şeride çevirir (16 kare/sn).
Gerekenler (geçici venv yeter): pip install gradio_client imageio-ffmpeg numpy pillow scipy
Kota: anonim kullanımda Hugging Face ZeroGPU günlük birkaç dakika verir (klip başı ~30 sn). Kota biterse
betik durur; ertesi gün kaldığı yerden devam eder (şeridi olanları atlar). HF_TOKEN ortam değişkeni varsa kullanılır (kota artar).
Lisans: Wan 2.2 Apache 2.0, çıktılar ticari kullanıma uygun.
"""
import json, os, shutil, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import video_isle

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
OUT = os.path.join(ROOT, 'varliklar', 'ham', 'anim')
SPACE = 'multimodalart/wan-2-2-first-last-frame'   # ilk = son kare: döngü kendiliğinden kapanır, ama çağrı başına 180 sn kota ayırır
FAST = 'zerogpu-aoti/wan2-2-fp8da-aoti-faster'      # tek görselden video: daha az kota ister, döngü videodan bulunur (find_loop)
STYLE = 'static camera, the character stays in the center of the frame, flat solid magenta background, 2D cartoon game character animation, smooth motion'
WALK = {
    'solarcher': 'a cartoon roman archer walking in place, walk cycle, legs stepping, holding a bow',
    'gladiator': 'a cartoon gladiator marching in place, walking cycle, legs stepping and arms swinging naturally',
    'assassin': 'a cartoon hooded assassin sneaking forward in place, quick light walking steps, crouched',
    'priest': 'a cartoon roman priest walking slowly in place, walk cycle, robe swaying, holding a staff',
    'heavy': 'a cartoon heavy roman infantryman marching in place with heavy steps, big shield in front, walk cycle',
    'cavalry': 'a cartoon roman cavalryman on a horse, the horse trots in place, legs moving in a trot cycle, rider bobbing',
    'gloriosus': 'a cartoon pompous roman general strutting proudly in place, walk cycle, cape swaying',
}


def ref_image(t):
    im = Image.open(os.path.join(IMG, f'enemy_{t}.webp')).convert('RGBA')
    W, H = 832, 480
    bg = Image.new('RGBA', (W, H), (255, 0, 255, 255))
    k = min(400 / im.height, 640 / im.width)
    im = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
    bg.alpha_composite(im, ((W - im.width) // 2, H - im.height - 40))
    p = os.path.join(OUT, f'{t}_ref.png'); bg.convert('RGB').save(p)
    return p


def walk(clients, t):
    from gradio_client import handle_file
    os.makedirs(OUT, exist_ok=True)
    ref = ref_image(t); prompt = WALK[t] + ', ' + STYLE
    mp4 = os.path.join(OUT, f'{t}_yuru.mp4'); rel = os.path.relpath(mp4, os.path.join(ROOT, 'varliklar'))
    try:  # önce hızlı alan (az kota); 3,2 sn videodan en iyi kapanan döngü seçilir
        r = clients['fast'].predict(handle_file(ref), prompt, steps=6, duration_seconds=3.2, randomize_seed=False, seed=7, api_name='/generate_video')
        shutil.copy(r[0]['video'] if isinstance(r[0], dict) else r[0], mp4)
        rgb = video_isle.frames_of(mp4, 16)
        st, L = video_isle.find_loop(rgb, 12, 30)
        video_isle.main(rel, f'enemy_{t}_walk', st, L, 16)
    except Exception as e:
        if 'quota' not in str(e).lower(): raise
        # ilk-son kare alanı: aynı görsel iki uçta, son kare tekrar etmesin
        r = clients['loop'].predict(handle_file(ref), handle_file(ref), prompt, duration_seconds=2.1, steps=8, randomize_seed=False, seed=7, api_name='/generate_video')
        shutil.copy(r[0]['video'] if isinstance(r[0], dict) else r[0], mp4)
        n = len(video_isle.frames_of(mp4, 16))
        video_isle.main(rel, f'enemy_{t}_walk', 0, n - 1, 16)


def main(args):
    from gradio_client import Client
    meta = json.load(open(os.path.join(IMG, 'anim.json')))
    todo = [t for t in WALK if f'enemy_{t}_walk' not in meta] if '--hepsi' in args else [a for a in args if a in WALK]
    tok = os.environ.get('HF_TOKEN')
    kw = {'token': tok} if tok else {}
    clients = {'fast': Client(FAST, verbose=False, **kw), 'loop': Client(SPACE, verbose=False, **kw)}
    for t in todo:
        print('üretiliyor:', t, flush=True)
        try:
            walk(clients, t)
        except Exception as e:
            print('durdu:', t, str(e)[:200]); break


if __name__ == '__main__':
    main(sys.argv[1:])
