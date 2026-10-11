"""Bütün animasyon şeritleri için "abartılı" Kaggle Wan işleri (12 Eki, Caner: abartılı yürüyüşler çok beğenildi, hepsine yapılsın).

Her şeridin asıl işi varliklar/ham/anim/*.json içinden bulunur (aynı ad birden çok dosyada varsa en yenisi); işi olmayan eski şeritlerin
(ilk Veo/eski denemeler) karakter tarifi aynı karakterin başka bir işinden alınır. Promptun hareket cümlesine türüne göre abartı eklenir:
büyük hazırlık, tüm gövdeyle vuruş, güçlü devam, squash and stretch, kesik zamanlama; "smooth motion" yerine "crisp clean frames, no motion blur".
Çıktı adları <şerit>x (asıl şerit yerinde kalır; beğenilenler sonra abarti_degistir ile yerine geçer). Atlananlar:
iskeletlerin yürüyüşü (Caner: abartılıda öne doğru yürüdüler), Mortimer'ın sakin sahneleri, zaten abartılı olanlar.
    python3 varliklar/abarti_isler.py          → varliklar/ham/anim/abarti/parti_NN.json (parti başına PARTI iş)
"""
import glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANIM = os.path.join(ROOT, 'varliklar', 'ham', 'anim')
OUT = os.path.join(ANIM, 'abarti')
PARTI = 26
DONE_WALK = {'enemy_solarcher', 'enemy_heavy', 'enemy_gladiator', 'enemy_hunter', 'enemy_torch', 'enemy_flagellant'}
SKIP = {'mortimer_cay', 'mortimer_otur', 'mortimer_panik', 'unit_corpsegolem_rise'}
TAIL = 'flat solid magenta background, 2D cartoon game character animation, crisp clean frames, no motion blur'
CUT = r' (is struck|walks|walking forward|marches|rolls|flies|flaps|trots|runs|stands|raises|swings|lunges|thrusts|hurls|lashes|casts|charges|kneels|slams|throws|draws|fires|shoots|aims|spins|leaps|jumps|attacks|bites|rears|stomps|blows|beats|rings|lifts|points|sits|holds up|pulls|pours|sprays|smashes|crashes|collapses|bursts|explodes|screams|roars|waves|crouches|steps|hops)\b'

KIND_WALK = {
    'machine': 'rolls forward in place with exaggerated bouncy cartoon motion: the whole machine bounces and wobbles over bumps, the wheels turn fast, loose parts rattle and swing, squash and stretch, lively snappy timing, a full looping cycle',
    'flyer': 'flies in place with exaggerated cartoon flight: big powerful wing beats, the whole body bobs up and down with each beat, squash and stretch, lively snappy timing, a full looping cycle',
    'beast': 'walks forward in place with an exaggerated bouncy cartoon gait: the legs reach far, the paws stomp down firmly, the whole body bobs up and down and rocks, squash and stretch, lively snappy timing, a full walk cycle',
    'mount': 'moves forward in place with an exaggerated bouncy cartoon gallop: the animals legs reach far and stomp down, their bodies bob and rock, the rider or the vehicle bounces with every stride, squash and stretch, lively snappy timing, a full looping cycle',
    'biped': 'marches forward in place with a bouncy, exaggerated cartoon walk: big strides, each knee lifts high and each foot stomps down firmly, the whole body bobs up and down and sways side to side, the arms swing strongly, squash on each step, lively snappy timing, a full walk cycle',
}
EXTRA = {
    'atk': 'Exaggerated punchy cartoon action: a big anticipation wind-up, then a fast powerful strike with the whole body leaning into it, strong follow-through and recoil, squash and stretch, snappy timing.',
    'die': 'Exaggerated comic cartoon death: violently knocked back, limbs flailing, the body bounces once on the ground and then lies still, squash and stretch, snappy timing.',
    'idle': 'Lively cartoon idle: big breathing, the shoulders rise and fall, a slight bounce, the weight shifts from foot to foot, squash and stretch, but the character stays in place, seamless loop.',
    'run': 'Exaggerated cartoon run: very long strides, knees high, the body leans far forward and bounces, the arms pump hard, squash and stretch, snappy timing.',
    'block': 'Exaggerated cartoon action: braces hard, a big recoil from the blow, then snaps back, squash and stretch, snappy timing.',
}
GENERIC = {  # işi olmayan eski şeritler için hareket cümlesi
    'walk': None,
    'atk': 'attacks forward with his weapon in one powerful strike, then returns exactly to the starting pose',
    'idle': 'stands in place in a ready stance, breathing, a seamless idle loop',
    'cast': 'raises his arms and casts a powerful glowing spell, then returns exactly to the starting pose',
    'skill': 'performs his special attack forward in one powerful move, then returns exactly to the starting pose',
}


def kind_of(desc):  # yalnız karakter tarifinden (hareket cümlesi karıştırmasın)
    t = desc.lower()
    if re.search(r'\b(riding|pulled by|horse|lions)\b', t): return 'mount'
    if re.search(r'\b(cart|wheel|wheels|catapult|siege|ram|wagon)\b', t): return 'machine'
    if re.search(r'\b(eagle|vulture|bat|bats|wings|flying)\b', t): return 'flyer'
    if re.search(r'\b(hound|wolfhound|dog|mastiff|elephant)\b', t) and not re.search(r'\b(man|master|keeper|soldier)\b', t): return 'beast'
    return 'biped'


def suffix(name):
    for s in ('walk', 'atk3', 'atk2', 'atk', 'skill', 'die', 'idle', 'run', 'cast', 'block', 'buyu'):
        if name.endswith('_' + s): return s
    return None


def desc_of(prompt):
    m = re.search(CUT, prompt)
    return re.sub(r'[ ,]+(that|which|and|who)$', '', prompt[:m.start()]) if m else None


def main():
    A = json.load(open(os.path.join(ROOT, 'sinir-kalesi', 'img', 'anim.json')))
    jobs = {}
    for f in sorted(glob.glob(os.path.join(ANIM, '*.json')), key=os.path.getmtime):
        try: L = json.load(open(f))
        except Exception: continue
        if isinstance(L, list):
            for j in L:
                if isinstance(j, dict) and 'name' in j and 'prompt' in j and not j['name'].endswith('x'): jobs[j['name']] = j
    descs = {}
    for n, j in jobs.items():
        d = desc_of(j['prompt']); base = n.rsplit('_', 1)[0] if suffix(n) else n
        if d and base not in descs: descs[base] = d
    out, miss = [], []
    for n in A:
        s = suffix(n)
        if not s or n in SKIP: continue
        base = n[:-(len(s) + 1)]
        if s == 'walk' and (base in DONE_WALK or base.startswith('unit_skel_')): continue
        j = jobs.get(n)
        if j:
            p, ref, frames, loop, seed = j['prompt'], j['ref'], j.get('frames', 33), j.get('loop', s in ('walk', 'idle', 'run')), j.get('seed', 21)
        else:
            d = descs.get(base); ref = 'ham/anim/%s_ref.png' % base
            if not d or not os.path.exists(os.path.join(ROOT, 'varliklar', ref)) or s not in GENERIC: miss.append(n); continue
            act = GENERIC[s] or 'walks forward in place, a full walk cycle'
            p = f'{d} {act}. Side view facing right, static camera, the character stays in the center of the frame, {TAIL}'
            frames, loop, seed = 33, s in ('walk', 'idle'), 21
        view = re.search(r'\. (Side|Front) view', p)
        head, rest = (p[:view.start()], p[view.start() + 2:]) if view else (p, '')
        if s == 'walk':
            d = desc_of(head) or head; head = d + ' ' + KIND_WALK[kind_of(d)]
        else:
            ex = EXTRA['atk' if s in ('atk', 'atk2', 'atk3', 'skill', 'cast', 'buyu') else s]
            head = head + '. ' + ex.rstrip('.')
        rest = re.sub(r'smooth motion\.?$', 'crisp clean frames, no motion blur', rest.strip())
        out.append({'name': n + 'x', 'ref': ref, 'prompt': head.rstrip('.') + '. ' + rest, 'frames': frames, 'loop': loop, 'seed': seed})
    # önce düşmanlar (Caner: önce düşmanları bitir), içlerinde yeni komutanlar ve finaller önde; sonra yürüyüş, saldırı, ölüm, özel
    pri = lambda j: (0 if j['name'].startswith('enemy_') else 1, 0 if any(k in j['name'] for k in ('severus3', 'hubertus', 'agnes', 'lucia', 'godfrey', 'gloriosus', 'centurion', 'champion', 'hierophant', 'shadowmaster', 'ironwarden', 'cavcaptain')) else 1,
                     ['walk', 'atk', 'die', 'skill'].index(suffix(j['name'][:-1])) if suffix(j['name'][:-1]) in ('walk', 'atk', 'die', 'skill') else 4)
    out.sort(key=pri)
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, 'parti_*.json')): os.remove(f)
    for i in range(0, len(out), PARTI):
        json.dump(out[i:i + PARTI], open(os.path.join(OUT, 'parti_%02d.json' % (i // PARTI + 1)), 'w'), indent=1, ensure_ascii=False)
    print(len(out), 'iş,', (len(out) + PARTI - 1) // PARTI, 'parti; tarifi bulunamayan:', miss)


if __name__ == '__main__':
    main()
