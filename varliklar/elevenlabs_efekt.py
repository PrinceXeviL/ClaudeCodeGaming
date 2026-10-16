"""Eksik efekt seslerini ElevenLabs Sound Effects ile üretir (ücretsiz planda kullanılabilir; jenerikte elevenlabs.io anılmalı).

    python3 varliklar/elevenlabs_efekt.py          # eksikleri üretir -> varliklar/ham/ses/eleven/<ad>_<n>.mp3
    python3 varliklar/elevenlabs_efekt.py --yeniden

Sonra: python3 varliklar/ses_kayit_isle.py (mp3 -> oyunun wav'ları, ses düzeyi eşitlenir).
"""
import os, sys
from elevenlabs_seslendir import key, req

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ham', 'ses', 'eleven')
# ad: (istem, süre sn, adet)
SFX = {
    'elephant': ('angry armored war elephant trumpeting loudly, single call, fantasy battle, no music', 1.6, 2),
    'vulture': ('large vulture screech, single harsh raspy bird cry, no music', 1.0, 2),
    'bonewall': ('ground cracking open and a wall of bones bursting up from the earth, rattling bones, dirt debris, dark magic, short, no music', 1.6, 1),
    'raise': ('undead rising from graves, eerie ghostly whoosh with rattling bones and low zombie groan, dark magic, short, no music', 1.8, 1),
    'fear': ('chorus of wailing ghosts swooping past, spooky whoosh, short, no music', 1.8, 1),
    'bats': ('swarm of bats flapping wings and squeaking, flying past, short, no music', 2.0, 1),
    # 10 Eki (Caner): daha gerçekçi borazan, boss için ayrı borazan; eksik savaş efektleri
    'hornw': ('realistic recording of a single medieval war horn blown by an army on an open battlefield, long deep brass note that swells and fades, natural outdoor echo, no music, no drums', 3.0, 3),
    'hornb': ('realistic recording of a huge ancient war horn, two long ominous very low blasts, a giant warlord arriving, deep rumbling brass, distant echo across a valley, no music', 4.0, 3),
    # 10 Eki (Caner, 2.): klasik savaş filmlerindeki savaş öncesi borazan (hornw beğenilmedi)
    'hornf': ('epic war horn call before a great battle, like in classic historical war movies, a mighty deep brass battle horn blown by a herald, one long powerful note that rises and holds, a huge army waits, big reverb across the battlefield, no drums, no orchestra', 4.0, 4),
    # 11 Eki: yeni kule sesleri
    'soulsuck': ('a tormented ghost soul being sucked into a cursed lantern, rising eerie whoosh with a faint distant scream, dark magic, short, no music', 1.2, 3),
    'cursegaze': ('a giant evil eye glaring with fury, low ominous dark magic pulse and sinister whispering hiss, curse being cast, short, no music', 1.4, 3),
    'freeze': ('an enemy instantly frozen into a block of ice, sharp crackling ice forming with a crystalline crunch, short, no music', 0.9, 3),
    'blooddrain': ('dark blood magic draining life, thick wet liquid swirl and low sinister hum, vampiric, short, no music', 1.4, 2),
    'xbow': ('crossbow firing, sharp taut string twang and bolt release, wooden stock clack, short close recording, no music', 0.6, 3),
    'xbowh': ('heavy siege crossbow firing, loud thick string thump, heavy mechanism clunk, bolt whooshing away, short, no music', 0.9, 2),
    'armorhit': ('crossbow bolt striking steel plate armor, short sharp metallic clang and ricochet ping, no music', 0.5, 3),
    'rattle': ('skeleton warrior stepping out of a stone crypt, dry bones rattling and clattering, short, no music', 0.9, 2),
    # 16 Eki (Caner): iskeletlere kısa sesler (kelimesiz: dile bağlı değil). Seçince / bayrağa gönderince / öldürünce kahkaha
    # 16 Eki (Caner: zafer ekranı konsepte uysun): nekromantik zafer müziği ve yıldız vuruşu
    'winnecro': ('short dark gothic victory fanfare for a necromancer game: a swelling church pipe organ chord with an eerie ghostly choir singing aaah, triumphant but sinister, ending with one deep resonant bell toll, no drums, no words', 3.5, 2),
    'skelcheer': ('a small crowd of cartoon skeletons cheering victoriously, hollow raspy hooray-like cheers and cackles with bones rattling and clacking, celebration after winning a battle, short, funny, no words, no music', 2.2, 2),
    'lootchime': ('a magical treasure reward sound: bright crystal chime sparkle with a few clinking gold coins, short and satisfying, game loot pickup, no music', 1.0, 2),
    'starchime': ('one bright magical bell chime ding with sparkling shimmer tail, single clear high note, cute and rewarding, mobile game star earned sound, no music, no voice', 0.8, 2),
    'flybuzz': ('an angry swarm of buzzing plague flies rising and darting away, loud close insect buzz swelling then flying off, gross and creepy, short, no music', 1.3, 2),
    'flyswarm': ('a dense swarm of fat plague flies buzzing around a victim, continuous loud close insect buzzing with wing flutter, gross, steady, no music', 1.8, 2),
    'achieve': ('dark fantasy achievement unlocked jingle: a short triumphant spooky fanfare with a deep church bell, a bright magical chime sparkle and a ghostly choir swell, rewarding, game UI, no voice', 1.6, 2),
    'titlego': ('dark fantasy game start transition: a deep rushing whoosh pulled into a swirling ghostly vortex, eerie spirit choir rising quickly, then one heavy magical boom with a shimmering tail, cinematic, no voice words', 2.4, 2),
    'titlesoft': ('a soft calm magical transition: one gentle airy whoosh fading into a single warm low chime, soothing, relaxing, quiet, short, no music, no voice', 1.2, 1),
    'mapfly': ('a long gentle airy night wind whoosh, like gliding softly through the air over a dark forest, slowly swelling then settling down calmly, soothing, quiet, no music, no voice', 3.2, 1),
    'hsel_spartacus': ('a tough gladiator warrior gives one short confident battle grunt \'hah\', heavy chains rattle, game unit selected acknowledgment, no words', 1.1, 2),
    'hmove_spartacus': ('a heavy gladiator starts running, a few strong footsteps on dirt, chains clinking, one short determined grunt, no words', 1.1, 2),
    'hsel_leonidas': ('a spartan king gives one deep commanding \'hmm\' growl, bronze armor and shield clank, game unit selected, no words', 1.1, 2),
    'hmove_leonidas': ('an armored spartan marches off, steady heavy footsteps, bronze shield clank, a short battle \'hup\', no words', 1.1, 2),
    'hsel_merlin': ('an old wise wizard gives a thoughtful \'hmm\' and a soft magical sparkle chime, game unit selected, no words', 1.1, 2),
    'hmove_merlin': ('an old wizard walks off with a wooden staff tapping the ground and a soft swirl of magic sparkles, no words', 1.1, 2),
    'hsel_robin': ('a confident rogue archer gives a short sharp whistle, a bowstring creaks, game unit selected, no words', 1.1, 2),
    'hmove_robin': ('light quick footsteps on dry leaves, arrows rattling in a quiver and a wolf gives one short eager bark, no words', 1.1, 2),
    'hsel_bathory': ('a vampire countess gives a soft eerie amused laugh, a few bats flutter around, game unit selected, no words', 1.1, 2),
    'hmove_bathory': ('a silk gown swishes as a vampire glides away, a flock of bats flutters past with a soft whoosh, no words', 1.1, 2),
    'starthud': ('a magical star slamming into place: a deep hollow bone thud with a bright eerie green magic chime sparkle on top, short, satisfying game reward sound, no music', 0.7, 3),
    'skelsel': ('a cartoon skeleton soldier answering an order, short raspy hollow undead grunt like hrrah, with a quick clack of its jaw bones and a dry bone rattle, funny, game voice, no words, no music', 0.8, 3),
    'skelmove': ('a small group of cartoon skeleton warriors marching off with a raspy hollow undead battle cry, bones clattering, short, funny, no words, no music', 1.0, 3),
    'skellaugh': ('a cartoon skeleton cackling a short creepy hollow laugh, jaw bones clacking, heh heh heh, funny, no words, no music', 0.9, 3),
    # 15 Eki (Caner: Merlin'in büyü sesi çok kötü): Merlin'e özel sesler
    'soulorb': ('dark sorcerer hurling a magic orb of ghostly green and purple energy, short swirling whoosh with a crackling magical spark and an eerie shimmering chime, fantasy game spell, no music', 0.8, 3),
    'soulbolt': ('eerie green necromantic lightning arcing and chaining between several targets, sharp electric crackle and zaps with a ghostly hiss, fantasy spell, short, no music', 1.0, 2),
    'gravemist': ('thick cursed graveyard fog rolling in over the ground, low ghostly whoosh with faint sinister whispers, dark magic, short, no music', 1.6, 1),
    # 14 Eki (Caner: Báthory'nin standart büyü sesi daha güzel olsun): kan oku
    'bloodbolt': ('a vampire countess hurling a crimson bolt of blood magic, quick wet swirling whoosh with a thick liquid blood splash, a faint sinister female whisper, sharp and satisfying, dark fantasy game spell, no music', 0.8, 4),
    'timegate': ('a magical time portal tearing open, a giant clock ticking rapidly backwards, deep swirling whoosh and a resonant magical boom, epic dark fantasy spell, no music', 2.5, 2),
    # 14 Eki (Caner'in taslak promptları, oyuna uyarlandı): önce dinletilir, onaysız oyuna girmez
    'kemikvurus': ('close-mic game impact: a steel sword slashes into a dry skeleton, sharp bone crack and splintering with a short metallic ring, single hit, punchy, no music, no ambience', 1.0, 3),
    'efor': ('single short male medieval soldier battle grunt while swinging a heavy sword, aggressive exhale, no words, close-mic, dry, no music, no reverb', 0.6, 3),
    'olum': ('short male medieval soldier death cry, pained groan fading into a final breath, no words, close-mic, dry, no music, no reverb', 1.5, 3),
    'iskeletcoken': ('a skeleton collapses onto stone, dry bones clatter and scatter, brittle rattling, a skull bounces at the end, close-mic, no ambience, no music', 1.2, 3),
    'insa': ('building a dark gothic tower in a strategy game: quick hammer strikes on stone and wood, a heavy stone block thuds into place, short rumble, satisfying construction complete sound, no music', 1.5, 3),
    # 14 Eki (Caner: "eleven labs ile yap, eksiksiz olsun tüm sesler"): oyunun bütün sentez / Kenney / Freesound / Envato seslerinin yerine (g_<tür>)
    'g_arrow': ('a skeleton archer releases an arrow from a bone bow, sharp bowstring twang and quick arrow whoosh, short, no music', 0.6, 4),
    'g_arrowhit': ('an arrow thuds into a soldier\'s leather armor and flesh, short sharp impact thunk, no music', 0.5, 4),
    'g_splash': ('a bubbling cauldron of green plague liquid splashing and hissing steam, short, no music', 1.0, 3),
    'g_pain': ('a medieval roman soldier gives a short pained grunt when struck, no words, close-mic, dry, no music', 0.6, 6),
    'g_dvoice': ('a medieval roman soldier dying, short agonized groan and final breath, no words, close-mic, dry, no music', 1.2, 3),
    'g_scream': ('a terrified medieval soldier screams in fear, short shriek, no words, no music', 1.0, 4),
    'g_drum': ('a single heavy roman war drum hit, deep boom with skin resonance, no music', 0.8, 3),
    'g_yell': ('a medieval soldier battle cry, aggressive charging shout, no words, short, no music', 1.2, 2),
    'g_battle': ('distant medieval melee battle ambience, swords clashing, shields banging, men shouting and grunting, continuous, no music', 12.0, 1),
    'g_plaguethrow': ('a catapult flings a sloshing bucket of thick green toxic liquid, wet whoosh and splashing launch, short, no music', 1.2, 2),
    'g_plaguefire': ('a fuse sizzles briefly then a plague bomb is launched from a catapult with a heavy wooden thump, short, no music', 1.5, 2),
    'g_magic': ('a dark magic tower casts a spell, short mystical whoosh with a shimmering crackle, fantasy game, no music', 0.8, 3),
    'g_cannon': ('a medieval cannon fires, deep boom with a sharp crack and short rumble, no music', 1.2, 2),
    'g_boom': ('a heavy explosion with flying debris, punchy fantasy game explosion with a short rumble tail, no music', 1.2, 3),
    'g_meteor': ('a giant flaming meteor slams into the ground, massive deep explosion, rocks and debris, long rumble, epic, no music', 2.5, 2),
    'g_clash': ('two swords clash in melee, sharp metallic clang with a bony crack, short single hit, close-mic, no music', 0.5, 4),
    'g_step_foot': ('a single footstep of a soldier in leather sandals on a dirt road, soft, close, no music', 0.5, 6),
    'g_step_gallop': ('a single horse gallop stride on dirt, four quick hoof beats, short, no music', 0.6, 4),
    'g_step_bone': ('a skeleton takes a single step, dry bony clack of foot bones on dirt, quiet, no music', 0.5, 5),
    'g_death': ('an enemy soldier collapses dead, short body thud on dirt with a light armor rattle, no music', 0.7, 3),
    'g_coin': ('a single gold coin clinks into a pile, bright short metallic tink, game ui, no music', 0.5, 3),
    'g_coins': ('a handful of gold coins jingling and pouring into a chest, rewarding, short, no music', 1.0, 2),
    'g_upgrade': ('a tower is upgraded in a dark fantasy strategy game: magical power-up shimmer with stone and iron reinforcing, rewarding, short, no music', 1.2, 2),
    'g_leak': ('an enemy breaks through to the castle, ominous low gong and a single castle bell toll, warning, short, no music', 1.2, 2),
    'g_wave': ('a deep ominous war drum roll ending in one heavy boom, the next enemy wave is coming, short, no music', 1.5, 1),
    'g_win': ('a short triumphant dark fantasy victory sting, deep choir and brass hit, then a warm magical shimmer', 3.0, 1),
    'g_lose': ('a short dark defeat sting, low ominous choir and a fading gong, sad and grim', 3.0, 1),
    'g_levelup': ('a magical level up chime, rising sparkling arpeggio with a soft whoosh, game ui, no music', 1.2, 1),
    'g_click': ('a soft dry bone click, a small bone tapping on dark wood, game ui button press, very short', 0.5, 2),
    'g_select': ('a two-tone bony tick and soft magical pop, game ui selection, very short', 0.5, 2),
    'g_pick': ('a small bone being picked up, light click with a tiny rattle, game ui, very short', 0.5, 2),
    'g_open': ('a heavy old leather book opening with a page flip, game ui menu open, short', 0.6, 1),
    'g_castlehit': ('a heavy battering blow against a big wooden castle gate, deep thud with cracking wood, no music', 0.8, 3),
    'g_bash': ('a heavy shield bash, a wooden shield slams into armor, deep thud, short, no music', 0.6, 3),
    'g_cry': ('a spartan warrior war cry, short powerful shout, no words, no music', 1.2, 1),
    'g_whirl': ('heavy iron chains whirling through the air in a fast circle, metallic whoosh, short, no music', 0.8, 1),
    'g_zap': ('a short eerie dark spirit energy zap, ghostly electric buzz, no music', 0.6, 3),
    'g_error': ('a soft dull wooden knock, game ui error, not allowed, very short', 0.5, 1),
    'g_thunder': ('a loud thunder crack directly overhead followed by a short rolling rumble, no music', 2.0, 2),
    'g_spell': ('a dark necromancer readies a spell, short sinister whoosh with faint whispers, no music', 0.8, 1),
    'g_reinforce': ('skeleton reinforcements rising from the ground, bones rattling with a dark magical whoosh, short, no music', 1.2, 1),
    'g_portal': ('a dark magic portal tears open, deep swirling whoosh and hum, short, no music', 1.5, 1),
    'g_roar': ('a mighty roar that blasts out as a shockwave, deep and powerful, short, no music', 1.5, 1),
    'g_stomp': ('a giant takes one heavy stomping footstep that shakes the ground, deep boom, no music', 0.8, 2),
    # 14 Eki (Caner: adım sesleri uyuşmuyor; inşa sesleri daha tok, rahatsız etmeyen, tarzımıza uygun)
    'g2_step_foot': ('one single footstep of a roman legionary in hobnailed leather sandals on packed dirt, soft crunch with a tiny metal tick, close, dry, no music', 0.5, 6),
    'g2_step_bone': ('one single step of a skeleton bony foot on packed dirt, soft hollow wooden clack with a faint bone rattle, quiet, close, dry, no music', 0.5, 6),
    'g2_step_gallop': ('a single galloping stride of a warhorse on packed dirt, four muffled hoof thuds, close, dry, no music', 0.6, 4),
    'g2_build': ('dark fantasy tower construction: a heavy stone tower settles into the earth with a deep soft thud and a low rumble, gravel and dirt trickling, warm and muted, no metal, no high pitched sounds, no music', 1.5, 4),
    # 14 Eki (Caner: "atların sesleri yok; eksikleri belirle, her sesi üret"): sesi hiç olmayan birim ve yetenekler
    'g3_horse': ('a warhorse neighs and snorts, short, no music', 1.5, 3),
    'g3_dog': ('a fierce war dog barks twice aggressively, short, no music', 1.0, 3),
    'g3_dogbite': ('a war dog snarls and bites with a vicious snap, short, no music', 0.7, 2),
    'g3_eagle': ('a large eagle screeches, single sharp cry, no music', 1.0, 2),
    'g3_wheels': ('heavy wooden siege cart wheels rolling and creaking on a dirt road, short, no music', 1.5, 2),
    'g3_bell': ('a heavy church bell tolls once, deep resonant ring with a long decay, no music', 2.0, 2),
    'g3_whip': ('a leather whip cracks sharply through the air, short, no music', 0.5, 3),
    'g3_heal': ('a holy healing spell, soft angelic choir chime with a warm golden shimmer, short, no music', 1.2, 2),
    'g3_volley': ('a volley of many arrows released at once, bowstrings snapping and a rushing whoosh overhead, short, no music', 1.5, 2),
    'g3_shout': ('a roman general shouts a rallying battle command to his troops, powerful commanding yell, no words, short, no music', 1.5, 2),
    'g3_herodie': ('a heroic undead warrior falls in battle, deep pained groan and a ghostly exhale, no words, short, no music', 1.5, 2),
    # 14 Eki (Caner: arsaya ilk dokunuştaki 2 sesi beğenmedi; arayüz sesleri farklı kemik seslerinden olsun)
    'g4_select': ('a few small dry bones shuffle and settle softly on wood, hollow gentle clack, very short, game ui, no music', 0.5, 4),
    'g4_pick': ('one small bone taps against another bone, crisp hollow wooden click, very short, game ui, no music', 0.5, 4),
    'g4_open': ('a small bundle of hanging bones rattles gently like a wind chime, soft hollow clinks, short, game ui, no music', 0.8, 3),
    'g4_error': ('a dull muted bone knock on thick wood, low and soft, very short, game ui, no music', 0.5, 2),
    # 14 Eki (Caner: düşman ayak seslerini beğenmedi; Roma askeri, ortaçağ asker yürüyüşü gibi olsun)
    'g5_step_foot': ('a single firm footstep of a marching roman legionary in hobnailed leather caligae sandals on a packed dirt road, solid heel thud with a light gravel crunch and a faint rustle of leather armor, close, dry, no music', 0.5, 8),
    'g2_upgrade': ('a dark stone tower grows stronger: deep muffled stone grinding and a low magical hum swelling then settling, warm and soft, no metal clangs, no high pitched sounds, no music', 1.5, 3),
}


def main():
    k = key(); os.makedirs(OUT, exist_ok=True)
    for name, (text, dur, n) in SFX.items():
        for i in range(1, n + 1):
            p = os.path.join(OUT, f'{name}_{i}.mp3')
            if os.path.exists(p) and '--yeniden' not in sys.argv: continue
            a = req('POST', '/sound-generation?output_format=mp3_44100_128', k, {'text': text, 'duration_seconds': dur, 'prompt_influence': 0.5}, raw=True)
            open(p, 'wb').write(a); print(name, i, len(a))


if __name__ == '__main__':
    main()
