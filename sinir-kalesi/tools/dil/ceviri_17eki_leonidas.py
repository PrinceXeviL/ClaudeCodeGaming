"""17 Eki: Leonidas v2 (Ölü Sparta Kralı) yetenek metinleri (6 dil)."""
import json
T = {
 'Ölü Sparta Kralı · Savaşçı': {'en': 'Undead King of Sparta · Warrior', 'de': 'Untoter König Spartas · Krieger', 'es': 'Rey no muerto de Esparta · Guerrero', 'fr': 'Roi mort-vivant de Sparte · Guerrier', 'ru': 'Мёртвый царь Спарты · Воин', 'zh': '亡灵斯巴达王 · 战士'},
 'Kalkan Hücumu': {'en': 'Shield Charge', 'de': 'Schildansturm', 'es': 'Carga de escudo', 'fr': 'Charge au bouclier', 'ru': 'Натиск щитом', 'zh': '盾牌冲锋'},
 'Kalkan Hücumu!': {'en': 'Shield Charge!', 'de': 'Schildansturm!', 'es': '¡Carga de escudo!', 'fr': 'Charge au bouclier !', 'ru': 'Натиск щитом!', 'zh': '盾牌冲锋！'},
 'Kalkanıyla kalabalığa atılır: yolundaki düşmanlara vurur, geri savurur ve 1 sn sersemletir': {'en': 'Charges into the crowd behind his shield: hits every enemy in his path, knocks them back and stuns them for 1 s', 'de': 'Stürmt mit dem Schild in die Menge: trifft jeden Feind auf dem Weg, wirft ihn zurück und betäubt 1 s', 'es': 'Carga contra la multitud con su escudo: golpea a los enemigos a su paso, los empuja y los aturde 1 s', 'fr': 'Fonce dans la foule derrière son bouclier : frappe les ennemis sur son passage, les repousse et les étourdit 1 s', 'ru': 'Врывается в толпу со щитом: бьёт врагов на пути, отбрасывает и оглушает на 1 с', 'zh': '举盾冲入敌群：击中路径上的敌人，将其击退并眩晕 1 秒'},
 'Mızrak Dansı': {'en': 'Spear Dance', 'de': 'Speertanz', 'es': 'Danza de lanza', 'fr': 'Danse de la lance', 'ru': 'Танец копья', 'zh': '长矛之舞'},
 'Mızrak Dansı!': {'en': 'Spear Dance!', 'de': 'Speertanz!', 'es': '¡Danza de lanza!', 'fr': 'Danse de la lance !', 'ru': 'Танец копья!', 'zh': '长矛之舞！'},
 'Mızrağını iki tur çevirir: çevresindeki bütün düşmanlara iki kez vurur': {'en': 'Spins his spear twice: hits every enemy around him two times', 'de': 'Wirbelt den Speer zweimal: trifft jeden Feind um ihn herum zweimal', 'es': 'Gira su lanza dos veces: golpea dos veces a todos los enemigos a su alrededor', 'fr': 'Fait tournoyer sa lance deux fois : frappe deux fois chaque ennemi autour de lui', 'ru': 'Дважды вращает копьё: дважды бьёт всех врагов вокруг', 'zh': '长矛旋转两圈：对周围所有敌人造成两次伤害'},
 'Termopylae Falanksı': {'en': 'Phalanx of Thermopylae', 'de': 'Phalanx der Thermopylen', 'es': 'Falange de las Termópilas', 'fr': 'Phalange des Thermopyles', 'ru': 'Фаланга Фермопил', 'zh': '温泉关方阵'},
 'Termopylae Falanksı!': {'en': 'Phalanx of Thermopylae!', 'de': 'Phalanx der Thermopylen!', 'es': '¡Falange de las Termópilas!', 'fr': 'Phalange des Thermopyles !', 'ru': 'Фаланга Фермопил!', 'zh': '温泉关方阵！'},
 'Beş hayalet hoplit yolda kalkan duvarı örer: 6 sn yolu kapatır, duvara vuran hasar yer; sonunda hepsi birden mızrak saplar': {'en': 'Five ghost hoplites raise a shield wall on the road: it blocks the road for 6 s, attackers take damage, and at the end they all thrust their spears', 'de': 'Fünf Geisterhopliten bilden einen Schildwall: 6 s gesperrt, Angreifer nehmen Schaden, am Ende stoßen alle die Speere vor', 'es': 'Cinco hoplitas fantasma forman un muro de escudos: bloquea el camino 6 s, quien lo golpea recibe daño y al final todos clavan sus lanzas', 'fr': 'Cinq hoplites fantômes dressent un mur de boucliers : route bloquée 6 s, les assaillants subissent des dégâts, puis tous frappent de la lance', 'ru': 'Пять призрачных гоплитов ставят стену щитов: дорога перекрыта на 6 с, атакующие получают урон, в конце все разом бьют копьями', 'zh': '五名幽灵重装步兵在路上筑起盾墙：封路 6 秒，攻击者受到伤害，最后一齐刺出长矛'},
 'Kalkan duvarı: yolu kapatır, sonunda mızrak saplar': {'en': 'Shield wall: blocks the road, ends with a spear thrust', 'de': 'Schildwall: sperrt die Straße, endet mit Speerstoß', 'es': 'Muro de escudos: bloquea el camino y termina con lanzas', 'fr': 'Mur de boucliers : bloque la route, finit par un coup de lance', 'ru': 'Стена щитов: перекрывает дорогу, в конце удар копьями', 'zh': '盾墙：封路，最后长矛突刺'},
 'SPARTA!': {'en': 'SPARTA!', 'de': 'SPARTA!', 'es': '¡ESPARTA!', 'fr': 'SPARTE !', 'ru': 'СПАРТА!', 'zh': '斯巴达！'},
 'Kalkan!': {'en': 'Shield!', 'de': 'Schild!', 'es': '¡Escudo!', 'fr': 'Bouclier !', 'ru': 'Щит!', 'zh': '格挡！'},
}
for L in ('en', 'de', 'es', 'fr', 'ru', 'zh'):
    p = f'{L}_extra.json'; d = json.load(open(p))
    for k, v in T.items(): d['exact'][k] = v[L]
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('tamam')
