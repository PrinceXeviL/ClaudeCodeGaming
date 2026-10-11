# 12 Eki (4): kalenin yanındaki mezar (Ceset Golemi)
import json, os
D = os.path.dirname(os.path.abspath(__file__)); L = ['en', 'es', 'de', 'fr', 'ru', 'zh']
EX = {
 'YENİ: MEZAR BEKÇİSİ': ['NEW: GRAVE KEEPER', 'NUEVO: GUARDIÁN DE LA TUMBA', 'NEU: GRABWÄCHTER', 'NOUVEAU : GARDIEN DE LA TOMBE', 'НОВОЕ: СТРАЖ МОГИЛЫ', '新：守墓者'],
 'Kalk bakalım, nöbet senin.': ['Up you get, your watch now.', 'Arriba, te toca la guardia.', 'Hoch mit dir, du hast Wache.', 'Debout, c\'est ton tour de garde.', 'Подъём, твоя смена.', '起来吧，该你站岗了。'],
 'Mezarında rahat yatıyordun, biliyorum. Kusura bakma.': ['You were resting comfortably in your grave, I know. Sorry.', 'Estabas cómodo en tu tumba, lo sé. Perdona.', 'Du lagst gemütlich in deinem Grab, ich weiß. Tut mir leid.', 'Tu reposais tranquille dans ta tombe, je sais. Désolé.', 'Знаю, тебе удобно лежалось в могиле. Прости.', '我知道你在墓里躺得正舒服。抱歉。'],
 'Kapıya kimse girmeyecek. Kimse.': ['Nobody gets through that gate. Nobody.', 'Nadie cruza esa puerta. Nadie.', 'Durch dieses Tor kommt keiner. Keiner.', 'Personne ne passe cette porte. Personne.', 'Никто не пройдёт в ворота. Никто.', '谁也别想进这道门。谁也别想。'],
}
TPL = {
 'Kalenin yanındaki mezara dokun: {} altına Ceset Golemi kalkar, kapıyı tutar.': ['Tap the grave by the castle: for {} gold a Corpse Golem rises and holds the gate.', 'Toca la tumba junto al castillo: por {} de oro se alza un Gólem de Cadáveres y guarda la puerta.', 'Tippe auf das Grab an der Burg: für {} Gold erhebt sich ein Leichengolem und hält das Tor.', 'Touche la tombe près du château : pour {} or, un golem de cadavres se lève et garde la porte.', 'Нажми на могилу у замка: за {} золота встанет трупный голем и удержит ворота.', '点击城堡旁的坟墓：花{}金币唤起尸骸魔像守住城门。'],
 'Mezar — {} altın': ['Grave — {} gold', 'Tumba — {} de oro', 'Grab — {} Gold', 'Tombe — {} or', 'Могила — {} золота', '坟墓 — {}金币'],
 'Ceset Golemi kalkar (Can {} · Hasar {}-{} · Zırh %{}), kalenin kapısını tutar; ölürse {} sn sonra yeniden kalkar.': ['A Corpse Golem rises (HP {} · Damage {}-{} · Armor {}%) and holds the castle gate; if it dies it rises again after {} s.', 'Se alza un Gólem de Cadáveres (Vida {} · Daño {}-{} · Armadura {}%) y guarda la puerta; si muere, vuelve a alzarse tras {} s.', 'Ein Leichengolem erhebt sich (LP {} · Schaden {}-{} · Rüstung {} %) und hält das Burgtor; fällt er, erhebt er sich nach {} s erneut.', 'Un golem de cadavres se lève (PV {} · Dégâts {}-{} · Armure {} %) et garde la porte ; s\'il meurt, il se relève après {} s.', 'Встаёт трупный голем (Здоровье {} · Урон {}-{} · Броня {}%), держит ворота замка; если погибнет, встанет снова через {} с.', '尸骸魔像起身（生命{} · 伤害{}-{} · 护甲{}%），守住城门；阵亡后{}秒再次站起。'],
}
for i, l in enumerate(L):
    p = os.path.join(D, l + '_extra.json'); X = json.load(open(p))
    for k, v in EX.items(): X['exact'][k] = v[i]
    keys = {t[0] for t in X['tpl']}
    for k, v in TPL.items():
        if k not in keys: X['tpl'].append([k, v[i]])
    json.dump(X, open(p, 'w'), ensure_ascii=False, indent=0)
