"""18 Eki: gelişme ağacı (5 kademe, Lanet Kuleleri) ve büyük bölüm kartı metinleri (6 dil)."""
import json
T = {
 'Bölümlerden kazandığın yıldızlarla kalıcı güç satın al · her sütun yukarıdan aşağı açılır': {'en': 'Spend the stars you earn on permanent power · each column unlocks from top to bottom', 'de': 'Kaufe mit verdienten Sternen dauerhafte Stärke · jede Spalte öffnet sich von oben nach unten', 'es': 'Gasta las estrellas ganadas en poder permanente · cada columna se abre de arriba abajo', 'fr': 'Dépense tes étoiles en pouvoir permanent · chaque colonne se débloque de haut en bas', 'ru': 'Трать заработанные звёзды на постоянную силу · каждый столбец открывается сверху вниз', 'zh': '用获得的星星购买永久强化 · 每列从上到下解锁'},
 'Lanet Kuleleri': {'en': 'Curse Towers', 'de': 'Fluchtürme', 'es': 'Torres de maldición', 'fr': 'Tours de malédiction', 'ru': 'Башни проклятия', 'zh': '诅咒塔'},
 '+%12 atış hızı': {'en': '+12% attack speed', 'de': '+12 % Angriffstempo', 'es': '+12% velocidad de ataque', 'fr': '+12 % vitesse d’attaque', 'ru': '+12% скорость атаки', 'zh': '+12% 攻击速度'},
 'Kurma ve yükseltme %10 ucuz': {'en': 'Building and upgrading 10% cheaper', 'de': 'Bau und Ausbau 10 % günstiger', 'es': 'Construir y mejorar 10% más barato', 'fr': 'Construction et amélioration 10 % moins chères', 'ru': 'Постройка и улучшение на 10% дешевле', 'zh': '建造和升级便宜 10%'},
 '+%15 iskelet canı ve hasarı': {'en': '+15% skeleton health and damage', 'de': '+15 % Skelett-Leben und -Schaden', 'es': '+15% vida y daño de esqueletos', 'fr': '+15 % vie et dégâts des squelettes', 'ru': '+15% здоровья и урона скелетов', 'zh': '+15% 骷髅生命与伤害'},
 '+%10 lanet menzili': {'en': '+10% curse range', 'de': '+10 % Fluchreichweite', 'es': '+10% alcance de la maldición', 'fr': '+10 % portée de malédiction', 'ru': '+10% дальность проклятия', 'zh': '+10% 诅咒范围'},
 'Lanet +%3 daha güçlü': {'en': 'Curse 3% stronger', 'de': 'Fluch 3 % stärker', 'es': 'Maldición un 3% más fuerte', 'fr': 'Malédiction 3 % plus forte', 'ru': 'Проклятие сильнее на 3%', 'zh': '诅咒增强 3%'},
 'İskelet ve okçulara +%4 hasar': {'en': '+4% damage for skeletons and archers', 'de': '+4 % Schaden für Skelette und Bogenschützen', 'es': '+4% daño a esqueletos y arqueros', 'fr': '+4 % dégâts pour squelettes et archers', 'ru': '+4% урона скелетам и лучникам', 'zh': '骷髅与弓箭手 +4% 伤害'},
 'Lanet %12 daha sık': {'en': 'Curse 12% more often', 'de': 'Fluch 12 % häufiger', 'es': 'Maldición un 12% más frecuente', 'fr': 'Malédiction 12 % plus fréquente', 'ru': 'Проклятие на 12% чаще', 'zh': '诅咒频率 +12%'},
 'Delici oklar ve cıvatalar': {'en': 'Piercing arrows and bolts', 'de': 'Durchschlagende Pfeile und Bolzen', 'es': 'Flechas y virotes perforantes', 'fr': 'Flèches et carreaux perforants', 'ru': 'Пробивающие стрелы и болты', 'zh': '穿刺箭矢与弩箭'},
 'Yolu tutan iskeletler': {'en': 'Skeletons that hold the road', 'de': 'Skelette, die den Weg halten', 'es': 'Esqueletos que bloquean el camino', 'fr': 'Squelettes qui tiennent la route', 'ru': 'Скелеты держат дорогу', 'zh': '守住道路的骷髅'},
 'Zırh delen ruh ışını': {'en': 'Armor-piercing soul beam', 'de': 'Rüstungsbrechender Seelenstrahl', 'es': 'Rayo de almas que perfora armadura', 'fr': 'Rayon d’âme perce-armure', 'ru': 'Пробивающий броню луч душ', 'zh': '破甲灵魂光束'},
 'Alan hasarı, veba': {'en': 'Area damage, plague', 'de': 'Flächenschaden, Seuche', 'es': 'Daño en área, peste', 'fr': 'Dégâts de zone, peste', 'ru': 'Урон по области, чума', 'zh': '范围伤害，瘟疫'},
 'Lanet ve destek': {'en': 'Curse and support', 'de': 'Fluch und Unterstützung', 'es': 'Maldición y apoyo', 'fr': 'Malédiction et soutien', 'ru': 'Проклятие и поддержка', 'zh': '诅咒与辅助'},
 'ÖNCE ÜSTTEKİ': {'en': 'TOP ONE FIRST', 'de': 'ERST DAS OBERE', 'es': 'PRIMERO EL DE ARRIBA', 'fr': 'D’ABORD CELUI DU HAUT', 'ru': 'СНАЧАЛА ВЕРХНИЙ', 'zh': '先解锁上一级'},
 'ALINDI ✓': {'en': 'OWNED ✓', 'de': 'GEKAUFT ✓', 'es': 'COMPRADO ✓', 'fr': 'ACQUIS ✓', 'ru': 'КУПЛЕНО ✓', 'zh': '已获得 ✓'},
 'Önce üstteki kademeyi al': {'en': 'Buy the tier above first', 'de': 'Kaufe zuerst die obere Stufe', 'es': 'Compra primero el nivel de arriba', 'fr': 'Achète d’abord le niveau du dessus', 'ru': 'Сначала купи уровень выше', 'zh': '请先购买上一级'},
}
TPL = {
 '{} · {}. kademe': {'en': '{} · tier {}', 'de': '{} · Stufe {}', 'es': '{} · nivel {}', 'fr': '{} · niveau {}', 'ru': '{} · уровень {}', 'zh': '{} · 第 {} 级'},
 'AL · ★{}': {'en': 'BUY · ★{}', 'de': 'KAUFEN · ★{}', 'es': 'COMPRAR · ★{}', 'fr': 'ACHETER · ★{}', 'ru': 'КУПИТЬ · ★{}', 'zh': '购买 · ★{}'},
 '★{} GEREK': {'en': 'NEED ★{}', 'de': '★{} NÖTIG', 'es': 'FALTAN ★{}', 'fr': 'IL FAUT ★{}', 'ru': 'НУЖНО ★{}', 'zh': '需要 ★{}'},
}
for L in ('en', 'de', 'es', 'fr', 'ru', 'zh'):
    p = f'{L}_extra.json'; d = json.load(open(p)); d.setdefault('tpl', [])
    for k, v in T.items(): d['exact'][k] = v[L]
    have = {a for a, _ in d['tpl']}
    for k, v in TPL.items():
        if k not in have: d['tpl'].append([k, v[L]])
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('tamam')
