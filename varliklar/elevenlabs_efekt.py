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
