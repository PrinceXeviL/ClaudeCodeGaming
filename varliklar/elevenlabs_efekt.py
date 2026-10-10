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
    'xbow': ('crossbow firing, sharp taut string twang and bolt release, wooden stock clack, short close recording, no music', 0.6, 3),
    'xbowh': ('heavy siege crossbow firing, loud thick string thump, heavy mechanism clunk, bolt whooshing away, short, no music', 0.9, 2),
    'armorhit': ('crossbow bolt striking steel plate armor, short sharp metallic clang and ricochet ping, no music', 0.5, 3),
    'rattle': ('skeleton warrior stepping out of a stone crypt, dry bones rattling and clattering, short, no music', 0.9, 2),
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
