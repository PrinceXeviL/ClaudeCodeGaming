"""23 Eki (Caner: "bütün konuşan karakterler ElevenLabs'te en kaliteli stüdyo kaydı ve oyuncu sesleriyle, hem Türkçe hem İngilizce"):
kütüphanedeki profesyonel ses oyuncularından (PVC) aday sesler, her karaktere aynı replik. Çıktı ~/Downloads/GameLab/ses_oyuncu/<karakter>/<dil>_<n>_<ad>.mp3
    SSL_CERT_FILE=/etc/ssl/cert.pem .venv/bin/python3 varliklar/oyuncu_ses_aday.py"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.argv = [sys.argv[0]]
import elevenlabs_seslendir as E
k = E.key(); OUT = os.path.expanduser('~/Downloads/GameLab/ses_oyuncu')
LINE = {
  'mortimer': ('Bu topraklar benim. Ölüleri de... sessizliği de. Kalkın dostlarım, misafirlerimiz var.', 'These lands are mine. The dead... and the silence. Rise, my friends. We have guests.'),
  'leonidas': ('Emrindeyim! Sparta asla diz çökmez. Mızraklar, gökyüzünü karartın!', 'At your command! Sparta never kneels. Spears, darken the sky!'),
  'merlin': ('Hımm... bir büyü mü lazım? Yıldızlar bugün kanlı konuşuyor. Caelum, cade!', 'Hmm... in need of a spell? The stars speak of blood tonight. Caelum, cade!'),
  'robin': ('Hedefi göster, gerisi bende. Zenginden alırım... ölüden de.', 'Show me the mark, I will do the rest. I rob the rich... and the dead.'),
  'bathory': ('Emret bakalım, ölümlü. Güzelliğim ebedi... sabrım değil.', 'Command me, mortal. My beauty is eternal... my patience is not.'),
}
CAST = {  # (dil, ad, ses kimliği) — 0: şimdiki ses (karşılaştırma)
  'mortimer': [('tr', 'simdiki_Callum', 'N2lVS1w4EtoT3dr4eOWO'), ('tr', 'Derin_Roman', None), ('tr', 'Adam_Derin_Ciddi', 'J17lijyP1BHYcM7ld0Rg'), ('tr', 'Arthur_Bas', 'OMPrkDOvnYasPecb05Rb'), ('tr', 'Hakan_Yayla', '23juXLe6iBUtKIH1h9iH'),
               ('en', 'simdiki_Callum', 'N2lVS1w4EtoT3dr4eOWO'), ('en', 'Medraut', 'dG7SBJDxDoZkQUrwvqrD'), ('en', 'Jerry_B', 'NxGA8X3YhTrnf3TRQf6Q'), ('en', 'Monty', 'tUVMjP56ZNYXlKLsRXbo'), ('en', 'Edward_British', 'goT3UYdM9bhm0n2lmKQx')],
  'leonidas': [('tr', 'simdiki_Harry', 'SOYHLrjzK2X1ezoPC6cr'), ('tr', 'Cavit_Pancar', 'Y2T2O1csKPgWgyuKcU0a'), ('tr', 'Cem_Kahraman', 'D1xRw7f8ZHedI7xJgfvz'), ('tr', 'Mert_Aksoy', 'z2ObNnp0E5ZGeTlSXkX0'),
               ('en', 'simdiki_Harry', 'SOYHLrjzK2X1ezoPC6cr'), ('en', 'Samuel', 'NV8D9kv4W21bIe2GkOiE'), ('en', 'Keith', 'u38fdtX4yQwE9e1F0vPp'), ('en', 'Leonidas_Spartan', 'YKrm0N1EAM9Bw27j8kuD')],
  'merlin':   [('tr', 'simdiki_George', 'JBFqnCBsd6RMkjVDRZzb'), ('tr', 'Seyfullah_Kartal', 'mF7tIc9VLrznhGooGjaT'), ('tr', 'Emin_Destan', 'j9K9HnBcmgA6xNWqjlX0'), ('tr', 'Emrullah_Uzun', 'DpEiQMnL9WxMsymCsjPY'),
               ('en', 'simdiki_George', 'JBFqnCBsd6RMkjVDRZzb'), ('en', 'Eldrin', 'LvmvHEBEmMJBJw9UuhwO'), ('en', 'Myrrdin', 'oR4uRy4fHDUGGISL0Rev'), ('en', 'Grandfather_Joe', '0lp4RIz96WD1RUtvEu3Q')],
  'robin':    [('tr', 'simdiki_Callum', 'N2lVS1w4EtoT3dr4eOWO'), ('tr', 'Doga', 'IuRRIAcbQK5AQk1XevPj'), ('tr', 'Ozan_Karaca', '5nr6ATQepuidiLb6OT3B'), ('tr', 'Metehan', 'cPBqJ26VaZXIGAxXxtvc'),
               ('en', 'simdiki_Callum', 'N2lVS1w4EtoT3dr4eOWO'), ('en', 'Cyrien_Rogue', 'AFkIMdmeB0MMrr1tgGds'), ('en', 'Alistair_Drake', 'mNDAlXbiDkuVNwYWVP7R'), ('en', 'Miles', 'uk7wwhXdWYHKKZ8KTCVw')],
  'bathory':  [('tr', 'simdiki_Lily', None), ('tr', 'Irem_Otoriter', 'uvU9jrgGLWNPeNA4NgNT'), ('tr', 'Sultan_Tiyatro', 'gyxPK6bLXQAkBSCeAKvk'), ('tr', 'Hurrem', 'TASY7VCrU29rEMoYFTGG'),
               ('en', 'simdiki_Lily', None), ('en', 'Ilinca_Vampir', 'FcZStbCG9g9QxDlJioSD'), ('en', 'Bella_Elegant', 'hbB2qXyS2GMyyZIZyhAH'), ('en', 'Elariel_Kralice', 'ksryVoNAGZT8GxWCTiVm')],
}
mine = {v['name'].split(' - ')[0].split(' ')[0].lower(): v['voice_id'] for v in E.req('GET', '/voices', k)['voices']}
mine_full = {v['name']: v['voice_id'] for v in E.req('GET', '/voices', k)['voices']}
def find(prefix): return next(vid for n, vid in mine_full.items() if n.startswith(prefix))
ST = {'stability': 0.42, 'similarity_boost': 0.85, 'style': 0.4, 'use_speaker_boost': True}
for ch, L in CAST.items():
    d = os.path.join(OUT, ch); os.makedirs(d, exist_ok=True)
    for n, (lang, name, vid) in enumerate([c for c in L], 1):
        if vid is None: vid = find('Derin Roman') if name == 'Derin_Roman' else find('Lily')
        p = os.path.join(d, f'{lang}_{n:02d}_{name}.mp3')
        if os.path.exists(p): continue
        text = LINE[ch][0 if lang == 'tr' else 1]
        try:
            open(p, 'wb').write(E.req('POST', f'/text-to-speech/{vid}?output_format=mp3_44100_128', k, {'text': text, 'model_id': 'eleven_multilingual_v2', 'language_code': lang, 'voice_settings': ST}, raw=True)); print('ok', ch, lang, name)
        except Exception as e: print('HATA', ch, name, str(e)[:160])
print(E.req('GET', '/user/subscription', k)['character_count'], 'karakter kullanıldı')
