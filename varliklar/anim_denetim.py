"""Bütün animasyon şeritlerinin hareket denetimi (19 Eki, Caner: "tüm animasyonları incele, kusurluları yeniden yaptır; döngülere dikkat").
serit_denetim.py kenar/renk bakar; bu betik hareketi ölçer. Her şerit için:
  dikis : döngü şeritlerinde (walk/idle/run/cheer/walk_hurt/walk_on/walk_arka) son kareden ilk kareye geçişin, ortalama kare geçişine oranı (>2,2 = sıçrama)
  tasma : karakterin kare kenarına değdiği karelerin oranı (kesik kol/silah/kuyruk)
  titre : ayak çizgisinin (alt kenar) kareler arası oynaması, kare boyunun %'si (döngülerde; yürüyüşte zıplama doğal, idle'da olmamalı)
  boy   : gövde yüksekliğinin kareler boyu en büyük/en küçük oranı (aniden büyüyüp küçülen)
  dondu : bir öncekiyle neredeyse aynı kare sayısı (takılma)
  bos   : neredeyse boş kare sayısı
  sis   : gövde dışında yarı saydam (alfa 15-160) piksellerin oranı (duman/sis/hale)
    .venv/bin/python3 varliklar/anim_denetim.py → varliklar/cikti/anim_denetim.json + .txt"""
import json, os, re, sys
import numpy as np
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); IMG = os.path.join(ROOT, 'sinir-kalesi', 'img')
A = json.load(open(os.path.join(IMG, 'anim.json')))
LOOP = re.compile(r'_(walk|walk_on|walk_arka|idle|run|walk_hurt|cheer)x?$')
def frames(n):
    M = A[n]; p = os.path.join(IMG, n + '.webp')
    if not os.path.exists(p) or 'fw' not in M: return None
    im = np.asarray(Image.open(p).convert('RGBA')); fw, fh = M['fw'], M['fh']; cols = M.get('cols') or max(1, im.shape[1] // fw)
    out = []
    for i in range(M['n']):
        x, y = (i % cols) * fw, (i // cols) * fh; f = im[y:y + fh, x:x + fw]
        if f.shape[0] == fh and f.shape[1] == fw: out.append(f)
    return out
def small(f, h=48):
    t = np.asarray(Image.fromarray(f).resize((max(1, int(f.shape[1] * h / f.shape[0])), h))).astype(np.float32) / 255
    return np.concatenate([t[..., :3] * t[..., 3:], t[..., 3:]], -1)
R = {}
for n in sorted(A):
    if n.startswith(('fx_', 'cine_', 'comic')): continue
    F = frames(n)
    if not F or len(F) < 3: continue
    al = [f[..., 3] for f in F]; fh, fw = al[0].shape
    bb = []
    for a in al:
        ys, xs = np.where(a > 40)
        bb.append((ys.min(), ys.max(), xs.min(), xs.max()) if len(ys) else None)
    bos = sum(1 for b in bb if b is None or (b[1] - b[0]) < fh * 0.08)
    ok = [b for b in bb if b is not None]
    edge = sum(1 for a in al if (a[:, :2] > 60).sum() > 3 or (a[:, -2:] > 60).sum() > 3 or (a[:2, :] > 60).sum() > 3) / len(al)
    hs = [b[1] - b[0] for b in ok]; boy = max(hs) / max(1, min(hs)) if hs else 0
    bot = np.array([b[1] for b in ok], float); titre = float(np.abs(np.diff(bot)).mean() / fh * 100) if len(bot) > 1 else 0
    S = [small(f) for f in F]; w = min(s.shape[1] for s in S); S = [s[:, :w] for s in S]
    d = np.array([np.abs(S[i + 1] - S[i]).mean() for i in range(len(S) - 1)]); md = float(np.median(d)) + 1e-6
    dondu = int((d < md * 0.12).sum())
    loop = bool(LOOP.search(n))
    dikis = float(np.abs(S[0] - S[-1]).mean() / md) if loop else 0
    semi = np.mean([((a > 15) & (a < 160)).sum() / max(1, (a > 15).sum()) for a in al])
    R[n] = dict(n=len(F), loop=loop, dikis=round(dikis, 2), tasma=round(edge, 2), titre=round(titre, 2), boy=round(boy, 2), dondu=dondu, bos=bos, sis=round(float(semi), 3))
os.makedirs(os.path.join(ROOT, 'varliklar', 'cikti'), exist_ok=True)
json.dump(R, open(os.path.join(ROOT, 'varliklar', 'cikti', 'anim_denetim.json'), 'w'), indent=0)
def bad(n, r):
    out = []
    if r['loop'] and r['dikis'] > 2.2: out.append(f"dikiş {r['dikis']}")
    if r['tasma'] > 0.25: out.append(f"taşma %{int(r['tasma'] * 100)}")
    if r['loop'] and n.endswith('_idle') and r['titre'] > 1.0: out.append(f"titreme {r['titre']}")
    if r['boy'] > 1.6 and not n.endswith(('_die', '_collapse', '_rise', '_skill', '_skill2', '_dash', '_lvlup')): out.append(f"boy x{r['boy']}")
    if r['dondu'] >= 3: out.append(f"donuk {r['dondu']}")
    if r['bos'] >= 2 and not n.endswith(('_die', '_collapse', '_rise')): out.append(f"boş {r['bos']}")
    if r['sis'] > 0.18: out.append(f"sis {r['sis']}")
    return out
L = sorted(((n, bad(n, r)) for n, r in R.items()), key=lambda x: -len(x[1]))
with open(os.path.join(ROOT, 'varliklar', 'cikti', 'anim_denetim.txt'), 'w') as o:
    for n, b in L:
        if b: o.write(f"{n}\t{'; '.join(b)}\n")
print(len(R), 'şerit;', sum(1 for _, b in L if b), 'sorunlu')
