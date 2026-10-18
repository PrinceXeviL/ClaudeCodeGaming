"""18 Eki: boss imza yetenekleri, GÜÇ barı, ara boss, +1 asker (6 dil). Sonra: node tools/dil/build.js"""
import json, os
D = os.path.dirname(os.path.abspath(__file__))
L6 = ('en', 'de', 'es', 'fr', 'ru', 'zh')
def r(*v): return dict(zip(L6, v))
N = {
 'Arena Kasırgası': r('Arena Whirlwind', 'Arena-Wirbel', 'Torbellino de la Arena', "Tourbillon de l'arène", 'Вихрь арены', '竞技场旋风'),
 'Gladyatör Ağı': r('Gladiator Net', 'Gladiatorennetz', 'Red de Gladiador', 'Filet du gladiateur', 'Сеть гладиатора', '角斗士之网'),
 'Kutsal Kalkan': r('Holy Shield', 'Heiliger Schild', 'Escudo Sagrado', 'Bouclier sacré', 'Святой щит', '神圣护盾'),
 'Arınma Işığı': r('Light of Purification', 'Licht der Läuterung', 'Luz Purificadora', 'Lumière purificatrice', 'Свет очищения', '净化之光'),
 'Lejyon Emri': r('Legion Command', 'Befehl der Legion', 'Orden de la Legión', 'Ordre de la légion', 'Приказ легиона', '军团号令'),
 'Ok Yağmuru': r('Arrow Rain', 'Pfeilregen', 'Lluvia de Flechas', 'Pluie de flèches', 'Град стрел', '箭雨'),
 'Gölge Adımı': r('Shadow Step', 'Schattenschritt', 'Paso Sombrío', "Pas de l'ombre", 'Шаг тени', '暗影步'),
 'Karanlık Dalga': r('Dark Wave', 'Dunkle Welle', 'Ola Oscura', 'Vague obscure', 'Тёмная волна', '黑暗浪潮'),
 'Süvari Hücumu': r('Cavalry Charge', 'Kavallerieangriff', 'Carga de Caballería', 'Charge de cavalerie', 'Кавалерийский натиск', '骑兵冲锋'),
 'Savaş Borusu': r('War Horn', 'Kriegshorn', 'Cuerno de Guerra', 'Cor de guerre', 'Боевой рог', '战争号角'),
 'Yer Yarığı': r('Earth Rift', 'Erdspalte', 'Grieta Terrestre', 'Faille terrestre', 'Разлом земли', '大地裂隙'),
 'Demir Duvar': r('Iron Wall', 'Eiserne Mauer', 'Muro de Hierro', 'Mur de fer', 'Железная стена', '钢铁之墙'),
 'Güneş Mızrakları': r('Sun Spears', 'Sonnenspeere', 'Lanzas Solares', 'Lances solaires', 'Солнечные копья', '烈日长矛'),
 'İmparatorluk Sancağı': r('Imperial Banner', 'Reichsbanner', 'Estandarte Imperial', 'Bannière impériale', 'Имперское знамя', '帝国战旗'),
 'Av Ağı': r('Hunting Net', 'Jagdnetz', 'Red de Caza', 'Filet de chasse', 'Охотничья сеть', '狩猎之网'),
 'Gümüş Cıvatalar': r('Silver Bolts', 'Silberbolzen', 'Virotes de Plata', "Carreaux d'argent", 'Серебряные болты', '银弩矢'),
 'Sürü Çağrısı': r('Call of the Pack', 'Ruf des Rudels', 'Llamada de la Jauría', 'Appel de la meute', 'Зов стаи', '兽群召唤'),
 'Av Borusu': r('Hunting Horn', 'Jagdhorn', 'Cuerno de Caza', 'Cor de chasse', 'Охотничий рог', '狩猎号角'),
 'Ölüm Çanı': r('Death Knell', 'Totenglocke', 'Campana de la Muerte', 'Glas funèbre', 'Похоронный звон', '丧钟'),
 'Çan Dalgası': r('Bell Wave', 'Glockenwelle', 'Onda de Campana', 'Onde de cloche', 'Волна колокола', '钟声冲击'),
 'Kırbaç Fırtınası': r('Whip Storm', 'Peitschensturm', 'Tormenta de Látigos', 'Tempête de fouets', 'Буря плетей', '鞭刃风暴'),
 'Kan Yemini': r('Blood Oath', 'Blutschwur', 'Juramento de Sangre', 'Serment de sang', 'Кровавая клятва', '血之誓约'),
 'Ateş Yağmuru': r('Fire Rain', 'Feuerregen', 'Lluvia de Fuego', 'Pluie de feu', 'Огненный дождь', '火雨'),
 'Alev Halkası': r('Ring of Flame', 'Flammenring', 'Anillo de Llamas', 'Anneau de flammes', 'Кольцо пламени', '火焰之环'),
 'Kutsal Patlama': r('Holy Burst', 'Heilige Explosion', 'Explosión Sagrada', 'Explosion sacrée', 'Святой взрыв', '神圣爆发'),
 'Şeytan Kovma': r('Exorcism', 'Exorzismus', 'Exorcismo', 'Exorcisme', 'Экзорцизм', '驱魔'),
 'Kolos Adımı': r("Colossus' Stride", 'Kolossschritt', 'Paso del Coloso', 'Pas du colosse', 'Шаг колосса', '巨像之步'),
 'Aziz Yürüyüşü': r("Saint's March", 'Marsch des Heiligen', 'Marcha del Santo', 'Marche du saint', 'Шествие святого', '圣徒行军'),
 'Tapınak Kalkanı': r('Temple Shield', 'Tempelschild', 'Escudo del Templo', 'Bouclier du temple', 'Щит храма', '圣殿护盾'),
 'Kutsal Mızraklar': r('Holy Spears', 'Heilige Speere', 'Lanzas Sagradas', 'Lances sacrées', 'Святые копья', '神圣长矛'),
 'Kutsal Ordu': r('Holy Host', 'Heilige Heerschar', 'Hueste Sagrada', 'Armée sacrée', 'Святое воинство', '神圣大军'),
 'Çan Kulesi': r('Bell Tower', 'Glockenturm', 'Campanario', 'Clocher', 'Колокольня', '钟楼'),
 'Engizisyon Ateşi': r('Inquisition Fire', 'Feuer der Inquisition', 'Fuego de la Inquisición', "Feu de l'Inquisition", 'Огонь инквизиции', '宗教审判之火'),
 'Aforoz': r('Excommunication', 'Exkommunikation', 'Excomunión', 'Excommunication', 'Отлучение', '绝罚'),
}
T = dict(N)
for k, v in N.items(): T[k + '!'] = {L: x + '!' for L, x in v.items()}
DESC = {
 'çevresine dalga: iskeletlere hasar ve sersemletme': r('wave around him: damages and stuns skeletons', 'Welle um ihn: Schaden und Betäubung für Skelette', 'onda a su alrededor: daña y aturde a los esqueletos', 'onde autour de lui : blesse et étourdit les squelettes', 'волна вокруг: урон и оглушение скелетам', '周身冲击波：伤害并眩晕骷髅'),
 'gökten yağmur: iskeletlere ve kulelere': r('rain from the sky: on skeletons and towers', 'Regen vom Himmel: auf Skelette und Türme', 'lluvia del cielo: sobre esqueletos y torres', 'pluie du ciel : sur les squelettes et les tours', 'дождь с неба: по скелетам и башням', '天降之雨：打击骷髅与塔'),
 'sancak: çevresindekiler hızlanır ve sertleşir': r('banner: nearby allies get faster and tougher', 'Banner: Verbündete in der Nähe werden schneller und zäher', 'estandarte: los aliados cercanos se vuelven más rápidos y duros', 'bannière : les alliés proches gagnent vitesse et robustesse', 'знамя: союзники рядом быстрее и крепче', '战旗：附近友军加速并更耐打'),
 'hücum: yolundaki iskeletleri ezer': r('charge: tramples skeletons in his way', 'Ansturm: zertrampelt Skelette auf dem Weg', 'carga: arrolla a los esqueletos a su paso', 'charge : piétine les squelettes sur son passage', 'натиск: топчет скелетов на пути', '冲锋：践踏沿途骷髅'),
 'yer yarığı: en yakın kuleyi susturur': r('earth rift: silences the nearest tower', 'Erdspalte: bringt den nächsten Turm zum Schweigen', 'grieta: silencia la torre más cercana', 'faille : réduit au silence la tour la plus proche', 'разлом: глушит ближайшую башню', '大地裂隙：使最近的塔沉默'),
 'ağ atar: iskeletleri bağlar': r('throws nets: binds skeletons', 'wirft Netze: fesselt Skelette', 'lanza redes: inmoviliza a los esqueletos', 'lance des filets : immobilise les squelettes', 'бросает сети: опутывает скелетов', '抛网：束缚骷髅'),
 'sürü çağırır': r('calls a pack', 'ruft ein Rudel', 'llama a una jauría', 'appelle une meute', 'призывает стаю', '召唤兽群'),
 'kalkan kubbesi: çevresindekiler yarı hasar alır': r('shield dome: nearby allies take half damage', 'Schildkuppel: Verbündete in der Nähe erleiden halben Schaden', 'cúpula de escudo: los aliados cercanos reciben la mitad del daño', 'dôme de bouclier : les alliés proches subissent moitié moins de dégâts', 'купол щита: союзники рядом получают половину урона', '护盾穹顶：附近友军受到伤害减半'),
 'çan: yakındaki kuleleri susturur': r('bell: silences nearby towers', 'Glocke: bringt Türme in der Nähe zum Schweigen', 'campana: silencia las torres cercanas', 'cloche : réduit au silence les tours proches', 'колокол: глушит башни рядом', '钟声：使附近的塔沉默'),
 'gölge adımı: ileri ışınlanır, patlar': r('shadow step: teleports ahead and bursts', 'Schattenschritt: teleportiert sich nach vorn und explodiert', 'paso sombrío: se teletransporta adelante y estalla', "pas de l'ombre : se téléporte en avant et explose", 'шаг тени: телепортируется вперёд и взрывается', '暗影步：向前传送并爆发'),
}
T.update(DESC)
T.update({
 'ARA KOMUTAN': r('MID-BOSS', 'ZWISCHENBOSS', 'JEFE INTERMEDIO', 'MINI-BOSS', 'ПОЛУБОСС', '中途头目'),
 'GÜÇ': r('POWER', 'KRAFT', 'PODER', 'PUISSANCE', 'СИЛА', '能量'),
 'Sustu!': r('Silenced!', 'Verstummt!', '¡Silenciada!', 'Réduite au silence !', 'Заглушена!', '被沉默！'),
 'Yarıldı!': r('Split!', 'Gespalten!', '¡Partida!', 'Fendue !', 'Расколота!', '裂开了！'),
 '+1 İskelet': r('+1 Skeleton', '+1 Skelett', '+1 Esqueleto', '+1 Squelette', '+1 скелет', '+1 骷髅'),
 '+1 Okçu': r('+1 Archer', '+1 Bogenschütze', '+1 Arquero', '+1 Archer', '+1 лучник', '+1 弓箭手'),
 '+1 İskelet!': r('+1 Skeleton!', '+1 Skelett!', '¡+1 Esqueleto!', '+1 Squelette !', '+1 скелет!', '+1 骷髅！'),
 '+1 Okçu!': r('+1 Archer!', '+1 Bogenschütze!', '¡+1 Arquero!', '+1 Archer !', '+1 лучник!', '+1 弓箭手！'),
 'Mahzenden bir iskelet daha kalkar, yolu tutar': r('One more skeleton rises from the crypt and holds the road', 'Ein weiteres Skelett erhebt sich aus der Gruft und hält die Straße', 'Un esqueleto más se alza de la cripta y bloquea el camino', 'Un squelette de plus surgit de la crypte et tient la route', 'Ещё один скелет встаёт из склепа и держит дорогу', '地穴再升起一具骷髅，守住道路'),
 'Kuleye bir okçu daha çıkar: kule daha sık atar': r('One more archer climbs the tower: it shoots more often', 'Ein weiterer Bogenschütze besteigt den Turm: er schießt öfter', 'Un arquero más sube a la torre: dispara más a menudo', 'Un archer de plus monte dans la tour : elle tire plus souvent', 'На башню поднимается ещё один лучник: она стреляет чаще', '塔上再添一名弓箭手：射击更频繁'),
})
TPL = {
 'ARA KOMUTAN · {}': r('MID-BOSS · {}', 'ZWISCHENBOSS · {}', 'JEFE INTERMEDIO · {}', 'MINI-BOSS · {}', 'ПОЛУБОСС · {}', '中途头目 · {}'),
 '★ {}: {}': r('★ {}: {}', '★ {}: {}', '★ {}: {}', '★ {} : {}', '★ {}: {}', '★ {}：{}'),
 '⚠ {}': r('⚠ {}', '⚠ {}', '⚠ {}', '⚠ {}', '⚠ {}', '⚠ {}'),
}
for L in L6:
    p = os.path.join(D, f'{L}_extra.json'); d = json.load(open(p))
    for k, v in T.items(): d['exact'][k] = v[L]
    tp = {t[0]: t for t in d['tpl']}
    for k, v in TPL.items(): tp[k] = [k, v[L]]
    d['tpl'] = list(tp.values()); json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('tamam', len(T), len(TPL))
