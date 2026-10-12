# 12 Eki gece: çeviri taramasında (tarayıcıda window.tr ile) 6 dilde de Türkçe kalan metinler. python3 tools/dil/ceviri_12eki_e.py && node tools/dil/build.js
import json, os
D = os.path.dirname(os.path.abspath(__file__))
L = ['en', 'de', 'es', 'fr', 'ru', 'zh']
EX = {
 'Tabut Duvarı': ['Coffin Wall', 'Sargwall', 'Muro de ataúdes', 'Mur de cercueils', 'Стена гробов', '棺材之墙'],
 'Ruh Biçimi': ['Soul Reaping', 'Seelenernte', 'Siega de almas', 'Moisson des âmes', 'Жатва душ', '灵魂收割'],
 'Kılıçlar': ['Swords', 'Schwerter', 'Espadas', 'Épées', 'Мечи', '剑'],
 'YENİ OYUNCU': ['NEW PLAYER', 'NEUER SPIELER', 'JUGADOR NUEVO', 'NOUVEAU JOUEUR', 'НОВЫЙ ИГРОК', '新玩家'],
 'GERÇEK': ['REAL', 'ECHT', 'REAL', 'RÉEL', 'РЕАЛЬНЫЙ', '真实'],
 'Kalkan Duvarı!': ['Shield Wall!', 'Schildwall!', '¡Muro de escudos!', 'Mur de boucliers !', 'Стена щитов!', '盾墙！'],
 'KUTSAL ENGİZİSYON': ['HOLY INQUISITION', 'HEILIGE INQUISITION', 'SANTA INQUISICIÓN', 'SAINTE INQUISITION', 'СВЯТАЯ ИНКВИЗИЦИЯ', '神圣宗教裁判所'],
 'Bütün dalgaları durdur. Can kaybetmeden bitirirsen 3 yıldız.': ['Stop every wave. Finish without losing a life for 3 stars.', 'Halte alle Wellen auf. Ohne Lebensverlust gibt es 3 Sterne.', 'Detén todas las oleadas. Termina sin perder vidas y obtendrás 3 estrellas.', 'Arrête toutes les vagues. Termine sans perdre de vie pour 3 étoiles.', 'Останови все волны. Пройди без потерь — получишь 3 звезды.', '挡住所有波次。不失一命即可获得3星。'],
 'Bütün dalgaları durdur, kaleyi koru. Az can kaybedersen çok yıldız.': ['Stop every wave and guard the castle. Lose fewer lives, earn more stars.', 'Halte alle Wellen auf und schütze die Burg. Je weniger Leben du verlierst, desto mehr Sterne.', 'Detén todas las oleadas y protege el castillo. Cuantas menos vidas pierdas, más estrellas.', 'Arrête toutes les vagues et protège le château. Moins tu perds de vies, plus tu gagnes d\'étoiles.', 'Останови все волны и защити замок. Чем меньше потеряешь жизней, тем больше звёзд.', '挡住所有波次，守住城堡。失去的生命越少，星星越多。'],
 'Bölümü bir kez bitir, Sonsuz Gece açılır': ['Beat the level once to unlock Endless Night', 'Schaffe das Level einmal, um die Endlose Nacht freizuschalten', 'Supera el nivel una vez para desbloquear la Noche Eterna', 'Termine le niveau une fois pour débloquer la Nuit sans fin', 'Пройди уровень один раз, чтобы открыть Бесконечную ночь', '通关一次即可解锁无尽之夜'],
 'Altın Güneş Arabası': ['Golden Sun Chariot', 'Goldener Sonnenwagen', 'Carro del Sol Dorado', 'Char du Soleil d\'or', 'Золотая солнечная колесница', '黄金太阳战车'],
 '+%15 dayanıklı · +0,75 sn': ['+15% tougher · +0.75 s', '+15 % zäher · +0,75 s', '+15% más resistente · +0,75 s', '+15 % plus résistant · +0,75 s', '+15% прочнее · +0,75 с', '耐久+15% · +0.75秒'],
 '+%40 dayanıklı · +2 sn': ['+40% tougher · +2 s', '+40 % zäher · +2 s', '+40% más resistente · +2 s', '+40 % plus résistant · +2 s', '+40% прочнее · +2 с', '耐久+40% · +2秒'],
 'Güneş Formu': ['Sun Form', 'Sonnengestalt', 'Forma Solar', 'Forme solaire', 'Солнечная форма', '太阳形态'],
}
TPL = {
 'İlk görüldü: {}. bölüm · {}': ['First seen: level {} · {}', 'Zuerst gesehen: Level {} · {}', 'Visto por primera vez: nivel {} · {}', 'Vu pour la première fois : niveau {} · {}', 'Впервые: уровень {} · {}', '首次出现：第{}关 · {}'],
 'İlk {} bölüm ücretsiz': ['First {} levels free', 'Die ersten {} Level gratis', 'Primeros {} niveles gratis', '{} premiers niveaux gratuits', 'Первые {} уровней бесплатно', '前{}关免费'],
 '+%{} dayanıklı': ['+{}% tougher', '+{}% zäher', '+{}% más resistente', '+{}% plus résistant', '+{}% прочнее', '耐久+{}%'],
}
for i, l in enumerate(L):
    p = os.path.join(D, f'{l}_extra.json'); J = json.load(open(p)) if os.path.exists(p) else {'exact': {}, 'tpl': []}
    J.setdefault('exact', {}); J.setdefault('tpl', [])
    for k, v in EX.items(): J['exact'][k] = v[i]
    have = {t[0] for t in J['tpl']}
    for k, v in TPL.items():
        if k not in have: J['tpl'].append([k, v[i]])
    json.dump(J, open(p, 'w'), ensure_ascii=False, indent=0)
print('tamam')
