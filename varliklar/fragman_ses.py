"""Fragman seslendirmesi (22 Eki): Mortimer'ın sesi (ElevenLabs Callum, oyundaki replikler gibi), TR + EN.
    python3 varliklar/fragman_ses.py   -> varliklar/ham/fragman/vo_<dil>_<n>.mp3"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import elevenlabs_seslendir as E
OUT = os.path.join(E.ROOT, 'varliklar', 'ham', 'fragman')
LINES = {
    'tr': ["Tek istediğim... sessizce bir fincan kahveydi.", "Ama İmparatorluk yine kapımda.", "Peki. Kemik kuleler, veba kazanları... biraz da şimşek.",
           "Ve birkaç eski dost.", "Büyük hata.", "Necromancer'a bulaşma!"],
    'en': ["All I wanted... was a quiet cup of coffee.", "But the Empire is at my door. Again.", "Fine. Bone towers, plague cauldrons... a little lightning.",
           "And a few old friends.", "Big mistake.", "Don't mess with the Necromancer!"],
}
k = E.key()
vs = E.req('GET', '/voices', k)['voices']
v = next(x for x in vs if x['name'].startswith('Callum'))
print('ses', v['name'], v['voice_id'])
for lang, lines in LINES.items():
    for i, t in enumerate(lines):
        p = os.path.join(OUT, f'vo_{lang}_{i + 1}.mp3')
        if os.path.exists(p): continue
        a = E.req('POST', f"/text-to-speech/{v['voice_id']}?output_format=mp3_44100_128", k, {'text': t, 'model_id': E.MODEL, 'voice_settings': E.SETTINGS}, raw=True)
        open(p, 'wb').write(a); print(p, len(a))
