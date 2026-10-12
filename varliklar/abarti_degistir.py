"""Abartılı şeritleri (<ad>x) asıl şeridin yerine geçirir ve karşılaştırma GIF'i üretir (12 Eki).

    python3 varliklar/abarti_degistir.py gif  <ad> [<ad> ...]     → ~/Downloads/abarti_karsilastirma/N_<ad>.gif (solda eski, sağda abartılı)
    python3 varliklar/abarti_degistir.py gec  <ad> [<ad> ...]     → <ad>x.webp asıl <ad>.webp olur (eski: varliklar/cikti/abarti_eski/), anim.json
                                                                    ve manifest güncellenir, serit_netlestir uygulanır
    python3 varliklar/abarti_degistir.py geri <ad> [<ad> ...]     → eski şeridi geri koyar (abartılı varliklar/cikti/abarti_red/ içine)
<ad> şeridin asıl adıdır (ör. enemy_legion_atk). Yalnız yeni şeridi olanlar işlenir, olmayanlar atlanır.
"""
import json, os, shutil, subprocess, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
OLD = os.path.join(ROOT, 'varliklar', 'cikti', 'abarti_eski')
RED = os.path.join(ROOT, 'varliklar', 'cikti', 'abarti_red')
GIFS = os.path.expanduser('~/Downloads/abarti_karsilastirma')
BG = (62, 74, 52, 255)


def frames(name, h):
    A = json.load(open(os.path.join(IMG, 'anim.json')))
    F = A[name]; im = Image.open(os.path.join(IMG, name + '.webp')).convert('RGBA'); k = h / F['fh']
    return [im.crop((i * F['fw'], 0, (i + 1) * F['fw'], F['fh'])).resize((max(1, round(F['fw'] * k)), h), Image.LANCZOS) for i in range(F['n'])]


def gif(names):
    os.makedirs(GIFS, exist_ok=True)
    n0 = len([f for f in os.listdir(GIFS) if f.endswith('.gif')])
    for j, n in enumerate(names, n0 + 1):
        if not os.path.exists(os.path.join(IMG, n + 'x.webp')): print('yeni şerit yok:', n); continue
        a, b = frames(n, 260), frames(n + 'x', 260)
        wa, wb = max(x.width for x in a), max(x.width for x in b); w = wa + wb + 40; N = max(len(a), len(b)) * 2
        out = []
        for i in range(N):
            bg = Image.new('RGBA', (w, 300), BG); d = ImageDraw.Draw(bg)
            x1, x2 = a[i % len(a)], b[i % len(b)]
            bg.alpha_composite(x1, ((wa - x1.width) // 2 + 10, 30)); bg.alpha_composite(x2, (wa + 30 + (wb - x2.width) // 2, 30))
            d.text((10, 6), 'ESKI', fill=(255, 255, 255, 255)); d.text((wa + 30, 6), 'ABARTILI', fill=(255, 230, 120, 255))
            out.append(bg.convert('P', palette=Image.ADAPTIVE))
        p = os.path.join(GIFS, f'{j}_{n.replace("enemy_", "").replace("unit_", "")}.gif')
        out[0].save(p, save_all=True, append_images=out[1:], duration=62, loop=0, disposal=2)
        print(p)


def swap(names, back=False):
    A = json.load(open(os.path.join(IMG, 'anim.json'))); M = json.load(open(os.path.join(IMG, 'manifest.json')))
    done = []
    for n in names:
        if back:
            src = os.path.join(OLD, n + '.webp')
            if not os.path.exists(src): print('eski yok:', n); continue
            os.makedirs(RED, exist_ok=True); shutil.move(os.path.join(IMG, n + '.webp'), os.path.join(RED, n + '.webp'))
            shutil.move(src, os.path.join(IMG, n + '.webp'))
            m = os.path.join(OLD, n + '.json')
            if os.path.exists(m): A[n] = json.load(open(m))
            done.append(n); continue
        x = os.path.join(IMG, n + 'x.webp')
        if not os.path.exists(x) or n + 'x' not in A: print('yeni şerit yok:', n); continue
        os.makedirs(OLD, exist_ok=True)
        if os.path.exists(os.path.join(IMG, n + '.webp')):
            shutil.move(os.path.join(IMG, n + '.webp'), os.path.join(OLD, n + '.webp'))
            if n in A: json.dump(A[n], open(os.path.join(OLD, n + '.json'), 'w'))
        shutil.move(x, os.path.join(IMG, n + '.webp'))
        meta = A.pop(n + 'x')
        if n in A and 'idle' in A[n] and 'idle' not in meta: meta['idle'] = 0
        A[n] = meta
        bak = os.path.join(ROOT, 'varliklar', 'cikti', 'serit_yedek', n + '.webp')
        if os.path.exists(bak): os.remove(bak)  # netleştirme yeni şeritten başlasın
        if n + '.webp' not in M: M.append(n + '.webp')
        done.append(n)
    M = [m for m in M if not (m.endswith('x.webp') and m[:-6] in done)]
    json.dump(A, open(os.path.join(IMG, 'anim.json'), 'w'), indent=1, ensure_ascii=False)
    json.dump(M, open(os.path.join(IMG, 'manifest.json'), 'w'), indent=0)
    if done and not back:
        subprocess.run([sys.executable, os.path.join(ROOT, 'varliklar', 'serit_netlestir.py')] + done, check=False)
    print(('geri alındı: ' if back else 'yerine geçti: ') + ', '.join(done))


if __name__ == '__main__':
    cmd, names = sys.argv[1], sys.argv[2:]
    {'gif': lambda: gif(names), 'gec': lambda: swap(names), 'geri': lambda: swap(names, True)}[cmd]()
