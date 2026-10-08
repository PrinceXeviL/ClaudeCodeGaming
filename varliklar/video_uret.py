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


if __name__ == '__main__' and '--modal' not in sys.argv:
    main(sys.argv[1:])


# ---------------- Modal ile toplu üretim (aylık 30 $ ücretsiz kredi, kota derdi yok) ----------------
#   <venv>/bin/python varliklar/video_uret.py --modal            # eksik bütün yürüyüş ve saldırı şeritleri
# Görsel: img/<ad>.webp. Yürüyüş: döngülü (ilk = son kare). Saldırı: döngülü, sonra darbe karesi (silahın en uzağa
# uzandığı kare) şeridin %40'ına kaydırılır: oyun saldırı şeridini ATK_PREP/(ATK_PREP+ATK_AFTER) = 0,4 anında vurur.
SKEL = {
    'unit_skel_1': 'a cartoon skeleton recruit with a rusty sword, round wooden shield and a cooking pot helmet',
    'unit_skel_2': 'a cartoon skeleton guard in chainmail with a skull shield and a long sword',
    'unit_skel_3': 'a cartoon skeleton knight in dark armor with a green flaming sword and shield',
    'unit_skel_4': 'a cartoon big skeleton grave warden with a coffin shield and a spiked mace',
    'unit_skel_5': 'a cartoon skeleton death knight in purple tattered robes with two green flaming blades',
    'unit_skel_6': 'a cartoon hooded skeleton archer with a bone bow',
    'unit_skel_7': 'a cartoon skeleton archer in leather armor with a bone bow',
    'unit_skel_8': 'a cartoon armored skeleton archer with a glowing green bone bow',
}
ENEMY = {
    'enemy_solarcher': 'a cartoon roman archer with a bow',
    'enemy_gladiator': 'a cartoon gladiator with a sword and a net',
    'enemy_assassin': 'a cartoon hooded assassin with daggers',
    'enemy_priest': 'a cartoon roman war priest with a golden scepter',
    'enemy_heavy': 'a cartoon heavy roman infantryman with a big sun shield and a short sword',
    'enemy_cavalry': 'a cartoon roman cavalryman with a lance riding a white horse',
    'enemy_ram': 'a cartoon wooden siege battering ram cart with a lion head ram and soldiers inside',
    'enemy_catapult': 'a cartoon wooden catapult cart with a soldier',
    'enemy_gloriosus': 'a cartoon pompous roman general on a white horse',
}
WALK_ACT = {'enemy_ram': 'rolls forward in place, wheels turning, soldiers pushing', 'enemy_catapult': 'rolls forward in place, wheels turning',
            'enemy_cavalry': 'the horse trots in place, legs moving in a trot cycle, rider bobbing', 'enemy_gloriosus': 'the horse trots in place proudly, legs moving in a trot cycle'}
ATK_ACT = {
    'enemy_solarcher': 'draws the bow and shoots one arrow to the right, then lowers the bow',
    'enemy_gladiator': 'swings the sword forward in one strong strike',
    'enemy_assassin': 'lunges forward and stabs with the daggers',
    'enemy_priest': 'raises the golden scepter and casts a glowing spell forward',
    'enemy_heavy': 'bashes forward with the big shield and stabs with the short sword',
    'enemy_cavalry': 'thrusts the lance forward while the horse rears slightly',
    'enemy_ram': 'swings the lion head ram forward and strikes, then swings back',
    'enemy_catapult': 'the catapult arm swings up and throws a stone, then the arm comes back down',
    'enemy_gloriosus': 'swings his sword forward from horseback',
}
for k in SKEL:
    ATK_ACT[k] = 'draws the bone bow and shoots one arrow to the right, then lowers the bow' if k >= 'unit_skel_6' else 'swings the weapon forward in one strong strike'
TAIL = ', then returns exactly to the starting pose. Side view facing right, ' + STYLE


def ref_of(name):
    im = Image.open(os.path.join(IMG, name + '.webp')).convert('RGBA')
    W, H = 832, 480
    bg = Image.new('RGBA', (W, H), (255, 0, 255, 255))
    k = min(400 / im.height, 560 / im.width)
    im = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
    bg.alpha_composite(im, ((W - im.width) // 2, H - im.height - 40))
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name + '_ref.png'); bg.convert('RGB').save(p)
    return os.path.relpath(p, os.path.join(ROOT, 'varliklar'))


def modal_jobs(meta):
    jobs = []
    for name, who in list(ENEMY.items()) + list(SKEL.items()):
        if name + '_walk' not in meta:
            act = WALK_ACT.get(name, 'walking in place, walk cycle, legs stepping, arms swinging naturally')
            jobs.append({'name': name + '_walk', 'ref': ref_of(name), 'prompt': f'{who} {act}. Side view facing right, ' + STYLE, 'frames': 33, 'loop': True})
        if name + '_atk' not in meta:
            jobs.append({'name': name + '_atk', 'ref': ref_of(name), 'prompt': f'{who} {ATK_ACT[name]}' + TAIL, 'frames': 33, 'loop': True})
    return jobs


def process(job):
    import numpy as np
    from anim_isle import remove_magenta
    rel = os.path.join('ham', 'anim', job['name'] + '.mp4')
    rgb = video_isle.frames_of(os.path.join(ROOT, 'varliklar', rel), 16)
    L = len(rgb) - (1 if job.get('loop') else 0)  # döngüde son kare = ilk kare
    order = list(range(L))
    if (job['name'].endswith('_walk') or job.get('cycle')) and not job.get('loop'):
        # döngüsüz üretilmiş yürüyüş: videonun içinden en iyi kapanan döngü seçilir (ilk=son kuralı bazen 'yürü-dur' yaptırıyor)
        st, n = video_isle.find_loop(rgb, 12, 30); order = list(range(st, st + n))
    if job['name'].endswith('_atk'):
        wid = []
        for a in rgb[:L]:
            xs = np.nonzero(remove_magenta(a)[..., 3] > 128)[1]
            wid.append(xs.max() - xs.min() if len(xs) else 0)
        hit = int(np.argmax(wid)); st = (hit - round(0.4 * L)) % L
        order = [(st + i) % L for i in range(L)]
    die = job['name'].endswith('_die')
    if die: order = list(range(0, L, 2))  # ölüm: ~1 sn, yarı kare (bellek)
    video_isle.main(rel, job['name'], fps=16, order=order, first_h=die)


def run_modal():
    import subprocess
    meta = json.load(open(os.path.join(IMG, 'anim.json')))
    jobs = modal_jobs(meta)
    print(len(jobs), 'iş:', ', '.join(j['name'] for j in jobs), flush=True)
    if not jobs: return
    jp = os.path.join(OUT, 'isler.json'); json.dump(jobs, open(jp, 'w'), indent=1)
    modal_bin = os.path.join(os.path.dirname(sys.executable), 'modal')
    subprocess.run([modal_bin, 'run', os.path.join(ROOT, 'varliklar', 'modal_wan.py'), '--jobs', jp], check=True)
    for j in jobs:
        if os.path.exists(os.path.join(OUT, j['name'] + '.mp4')): process(j)


if __name__ == '__main__' and '--modal' in sys.argv:
    run_modal()
