"""Abartılı Wan işleri, 2. tur (17 Eki, Caner: "listede gereksiz kalanlar olabilir, yeniden analiz et; abartı animasyonlarda idle halleri de olsun").

Yayındaki şeritler (img/anim.json) taranır, her biri şu kurallarla ayıklanır:
  - abartılısı zaten yerine geçmiş (varliklar/cikti/abarti_eski/ içinde eski kopyası olan) → yapılmaz
  - Veo ile yapılmış (VEO kümesi: komutanlar, kale, kuleler, top, koçbaşı/kule yıkılışı, kartal/akbaba, Mezar Bekçisi/Ölüm Şövalyesi hamleleri) → yapılmaz
  - artık oyunda olmayan ya da yeniden tasarlanacak karakter (ESKI) → yapılmaz
  - Veo videosu bekleyen (VEO_BEKLER: mancınık) → yapılmaz
  - baştan abartılı yapılmış yürüyüşler (DONE_WALK) → yapılmaz
Kalanlar abartılı tarzda yeniden yapılır (çıktı <şerit>x). Ek olarak oyunda kullanılan ama bekleme (idle) şeridi olmayan karakterlere
abartılı bekleme döngüsü işi eklenir (çıktı doğrudan <karakter>_idle: yeni şerit). Makineler (araba, top, koçbaşı...) ve uçanlar bekleme almaz.
Karakter tarifi eski işlerin istemlerinden kesilir (CUT2: hareket fiilinden önceki kısım).
    python3 varliklar/abarti_isler2.py   → varliklar/ham/anim/abarti2/parti_NN.json + liste.md
"""
import glob, json, os, re
import abarti_isler as A1

ROOT = A1.ROOT
OUT = os.path.join(A1.ANIM, 'abarti2')
PARTI = 24
VEO = {'castle_keep_1_idle', 'castle_keep_2_idle', 'castle_keep_3_idle', 'enemy_cannon_atk', 'enemy_cannon_die', 'enemy_cannon_walk', 'enemy_ram_die',
       'enemy_siegetower_die', 'enemy_siegetower_walk', 'enemy_eagle_atk', 'enemy_eagle_walk', 'enemy_vulture_atk', 'enemy_vulture_walk',
       'unit_skel_4_dash', 'unit_skel_4_die', 'unit_skel_4_guard', 'unit_skel_5_die', 'unit_skel_5_skill', 'unit_skel_4_atk'}
VEO_PRE = ('hero_merlin', 'hero_robin', 'hero_bathory', 'tower_', 'mortimer')
ESKI = ('enemy_gloriosus_', 'enemy_herald', 'hero_wren', 'hero_drakula', 'hero_vladrik', 'hero_spartacus', 'hero_leonidas', 'unit_archer1', 'unit_archer2')
VEO_BEKLER = ('enemy_catapult',)
NO_IDLE = {'cannon', 'catapult', 'ram', 'siegetower', 'lantern', 'chariot', 'cathedral', 'eagle', 'vulture'}  # makine / uçan: durunca tek kare yeter
CUT2 = A1.CUT[:-3] + r'|stalks|strides|shuffles|lumbers|prowls|glides|floats|waddles|limps|staggers|creeps|trudges|swaggers|sways|struts|gallops|plods|bounces|drags|rides|pushes|is pulled)\b'
IDLE = ('stands in place in a lively exaggerated cartoon idle: big breathing, the chest and shoulders rise and fall, a slight bounce on the knees, '
        'the weight shifts from foot to foot, the head turns a little to look around, the weapon is held ready and moves slightly, the feet stay planted '
        'on the same spot, squash and stretch, a seamless idle loop. The colors stay exactly the same as in the reference image')
IDLE_BEAST = ('stands in place in a lively exaggerated cartoon idle: big panting breaths, the body rises and falls, the head and ears twitch and look around, '
              'the tail swishes, the paws stay planted on the same spot, squash and stretch, a seamless idle loop. The colors stay exactly the same as in the reference image')


def desc(p):
    m = re.search(CUT2, p)
    return re.sub(r'[ ,]+(that|which|and|who|with)$', '', p[:m.start()]).strip() if m else None


def main():
    anim = json.load(open(os.path.join(ROOT, 'sinir-kalesi', 'img', 'anim.json')))
    used = set(json.load(open(os.path.join(os.environ.get('USED', '/dev/null')))) if os.environ.get('USED') else set())
    eski = {os.path.splitext(os.path.basename(f))[0] for f in glob.glob(os.path.join(ROOT, 'varliklar', 'cikti', 'abarti_eski', '*.webp'))}
    jobs = {}
    for f in sorted(glob.glob(os.path.join(A1.ANIM, '**', '*.json'), recursive=True), key=os.path.getmtime):
        try: L = json.load(open(f))
        except Exception: continue
        if isinstance(L, list):
            for j in L:
                if isinstance(j, dict) and 'name' in j and 'prompt' in j: jobs[j['name']] = j
    descs = {}
    for n, j in jobs.items():
        b = n.rstrip('x'); s = A1.suffix(b); base = b[:-(len(s) + 1)] if s else b; d = desc(j['prompt'])
        if d and len(d) > 25: descs.setdefault(base, d)
    redo, idle, skip = [], [], {'abartılı yapıldı': [], 'Veo': [], 'eski/kilitli': [], 'Veo bekliyor': [], 'tarif yok': []}
    for n in sorted(anim):
        s = A1.suffix(n)
        if not s: continue
        base = n[:-(len(s) + 1)]
        if n in eski or (s == 'walk' and base in A1.DONE_WALK): skip['abartılı yapıldı'].append(n); continue
        if n in VEO or base.startswith(VEO_PRE): skip['Veo'].append(n); continue
        if n.startswith(ESKI): skip['eski/kilitli'].append(n); continue
        if base.startswith(VEO_BEKLER): skip['Veo bekliyor'].append(n); continue
        if base.startswith('enemy_') and used and base[6:] not in used: skip['eski/kilitli'].append(n); continue
        j = jobs.get(n) or jobs.get(n + 'x')
        if not j: skip['tarif yok'].append(n); continue
        d = desc(j['prompt']) or descs.get(base)  # tarif bu işten kesilemezse karakterin öbür işlerinden
        if not d: skip['tarif yok'].append(n); continue
        kind = A1.kind_of(d)
        if s == 'walk': act = A1.KIND_WALK[kind]
        elif s == 'idle': act = IDLE_BEAST if kind == 'beast' else IDLE
        else:
            mv = j['prompt'][len(d):] if j['prompt'].startswith(d) else (A1.GENERIC.get(s) or A1.GENERIC['atk'])
            for ex in A1.EXTRA.values(): mv = mv.replace(' ' + ex, '').replace(ex, '')  # kaynak iş zaten abartılıysa cümle tekrarlanmasın
            if s.startswith('atk') and re.search(r'\bbow\b', d) and not re.search(r'\b(draws|shoots|arrow)\b', mv): mv = 'draws the bow back fully and shoots a glowing arrow forward, then returns exactly to the starting pose'
            act = mv.split('. Side view')[0].split('. Front view')[0].strip().rstrip('.') + '. ' + A1.EXTRA['atk' if s.startswith(('atk', 'skill', 'cast')) else s].rstrip('.')
        redo.append({'name': n + 'x', 'ref': j['ref'], 'prompt': f'{d} {act}. Side view facing right, static camera, the character stays in the center of the frame, {A1.TAIL}',
                     'frames': j.get('frames', 33), 'loop': s in ('walk', 'idle'), 'seed': j.get('seed', 21)})
    # bekleme şeridi olmayan, oyunda kullanılan karakterler
    chars = {n[:-(len(A1.suffix(n)) + 1)] for n in anim if A1.suffix(n)}
    for base in sorted(chars):
        if base + '_idle' in anim or base.startswith(VEO_PRE + ESKI) or base.startswith('tower_') or base.startswith('castle'): continue
        t = base[6:] if base.startswith('enemy_') else None
        if t and (t in NO_IDLE or (used and t not in used)): continue
        d = descs.get(base); ref = 'ham/anim/%s_ref.png' % base
        if not d or not os.path.exists(os.path.join(ROOT, 'varliklar', ref)): skip['tarif yok'].append(base + '_idle'); continue
        act = IDLE_BEAST if A1.kind_of(d) == 'beast' else IDLE
        idle.append({'name': base + '_idle', 'ref': ref, 'prompt': f'{d} {act}. Side view facing right, static camera, the character stays in the center of the frame, {A1.TAIL}',
                     'frames': 33, 'loop': True, 'seed': 21})
    out = idle + redo  # Caner: bekleme halleri de olsun → önce eksik beklemeler
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, 'parti_*.json')): os.remove(f)
    for i in range(0, len(out), PARTI):
        json.dump(out[i:i + PARTI], open(os.path.join(OUT, 'parti_%02d.json' % (i // PARTI + 1)), 'w'), indent=1, ensure_ascii=False)
    md = ['# Abartılı Wan işleri, 2. tur (17 Eki)', '', f'Toplam **{len(out)} iş**, {(len(out) + PARTI - 1) // PARTI} parti (varliklar/ham/anim/abarti2/).', '',
          f'## Yeni bekleme (idle) döngüleri: {len(idle)}', ', '.join(j['name'] for j in idle), '', f'## Abartılısı yapılacaklar: {len(redo)}', ', '.join(j['name'][:-1] for j in redo), '']
    for k, v in skip.items(): md += [f'## Yapılmayacak — {k}: {len(v)}', ', '.join(v), '']
    open(os.path.join(OUT, 'liste.md'), 'w').write('\n'.join(md))
    print('\n'.join(md))


if __name__ == '__main__':
    main()
