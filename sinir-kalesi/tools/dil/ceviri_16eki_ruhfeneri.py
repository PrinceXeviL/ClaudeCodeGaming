# 16 Eki: Ruh Feneri yeniden (ruh hırsızları, şimşek) metinleri
import json, sys, os
D = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(__file__)
L = ['en', 'de', 'es', 'fr', 'ru', 'zh']
EX = [
("Ruh hırsızları düşmanın ruhunu emer: zırhı deler, yavaşlatır", ["Soul thieves drain the enemy's soul: pierces armor, slows", "Seelendiebe saugen die Seele des Feindes aus: durchdringt Rüstung, verlangsamt", "Los ladrones de almas absorben el alma del enemigo: perfora armaduras, ralentiza", "Les voleurs d’âmes aspirent l’âme de l’ennemi : perce l’armure, ralentit", "Похитители душ высасывают душу врага: пробивают броню, замедляют", "窃魂者吸取敌人的灵魂：穿透护甲并减速"]),
("3. kademede biriken ruhlarla şimşek çarpar", ["at tier 3, stored souls strike as lightning", "ab Stufe 3 schlagen gesammelte Seelen als Blitz ein", "en el nivel 3, las almas reunidas caen como rayo", "au rang 3, les âmes accumulées frappent en éclair", "на 3-й ступени накопленные души бьют молнией", "第3级时，积攒的灵魂化作闪电"]),
("Ruh hırsızı: düşmanın ruhunu emer, büyü hasarı zırhı deler", ["Soul thief: drains the enemy's soul, magic damage pierces armor", "Seelendieb: saugt die Seele des Feindes aus, Magieschaden durchdringt Rüstung", "Ladrón de almas: absorbe el alma del enemigo, el daño mágico perfora armaduras", "Voleur d’âmes : aspire l’âme de l’ennemi, les dégâts magiques percent l’armure", "Похититель душ: высасывает душу врага, магический урон пробивает броню", "窃魂者：吸取敌人灵魂，魔法伤害穿透护甲"]),
("İki ruh hırsızı", ["Two soul thieves", "Zwei Seelendiebe", "Dos ladrones de almas", "Deux voleurs d’âmes", "Два похитителя душ", "两名窃魂者"]),
("emilen düşman %30 yavaşlar", ["drained enemies are slowed by %30", "ausgesaugte Feinde werden um %30 verlangsamt", "los enemigos absorbidos se ralentizan un %30", "les ennemis aspirés sont ralentis de %30", "истощаемые враги замедляются на %30", "被吸取的敌人减速%30"]),
("Biriken ruhlarla ruh şimşeği: çarpılan düşmanın iskeleti görünür", ["Soul lightning from stored souls: the struck enemy's skeleton shows", "Seelenblitz aus gesammelten Seelen: das Skelett des Getroffenen wird sichtbar", "Rayo de almas con las almas reunidas: se ve el esqueleto del enemigo alcanzado", "Éclair d’âmes des âmes accumulées : le squelette de l’ennemi frappé apparaît", "Молния душ из накопленных душ: у поражённого врага виден скелет", "以积攒的灵魂释放灵魂闪电：被击中的敌人会显出骨架"]),
("8 sn'de bir en güçlü düşmanı 2 sn kafese kapatır", ["every 8 s cages the strongest enemy for 2 s", "sperrt alle 8 s den stärksten Feind 2 s in einen Käfig", "cada 8 s enjaula 2 s al enemigo más fuerte", "toutes les 8 s, enferme l’ennemi le plus fort 2 s dans une cage", "каждые 8 с запирает сильнейшего врага в клетку на 2 с", "每8秒将最强的敌人囚禁2秒"]),
("Ruh!", ["Soul!", "Seele!", "¡Alma!", "Âme !", "Душа!", "灵魂！"]),
]
TP = [
("Kule Ruh Emiciye dönüşür: +{} ruh hırsızı", ["Tower becomes a Soul Drainer: +{} soul thief", "Turm wird zum Seelensauger: +{} Seelendieb", "La torre se convierte en Absorbealmas: +{} ladrón de almas", "La tour devient Suceur d’âmes : +{} voleur d’âmes", "Башня становится Пожирателем душ: +{} похититель душ", "塔变为噬魂者：+{}名窃魂者"]),
("emilen canın %{}'i yakındaki iskeletleri iyileştirir", ["{}% of drained life heals nearby skeletons", "{} % des ausgesaugten Lebens heilen nahe Skelette", "el {}% de la vida absorbida cura a los esqueletos cercanos", "{} % de la vie aspirée soigne les squelettes proches", "{}% высосанного здоровья лечит ближних скелетов", "吸取生命的{}%治疗附近骷髅"]),
("Kule Ruh Kafesine dönüşür: şimşek {} düşmana daha sıçrar", ["Tower becomes a Soul Cage: lightning jumps to {} more enemies", "Turm wird zum Seelenkäfig: Blitz springt auf {} weitere Feinde über", "La torre se convierte en Jaula de Almas: el rayo salta a {} enemigos más", "La tour devient Cage d’âmes : l’éclair rebondit sur {} ennemis de plus", "Башня становится Клеткой душ: молния перескакивает ещё на {} врагов", "塔变为灵魂之笼：闪电额外弹跳{}名敌人"]),
("{} sn'de bir hayalet salar: {} hasar, {} sn korku", ["every {} s releases a ghost: {} damage, {} s fear", "alle {} s entlässt er einen Geist: {} Schaden, {} s Furcht", "cada {} s suelta un fantasma: {} de daño, {} s de miedo", "toutes les {} s libère un fantôme : {} dégâts, {} s de peur", "каждые {} с выпускает призрака: {} урона, {} с страха", "每{}秒放出幽灵：{}伤害，恐惧{}秒"]),
]
for li, l in enumerate(L):
    p = f'{D}/{l}_extra.json'; d = json.load(open(p))
    for k, v in EX: d['exact'][k] = v[li]
    d.setdefault('tpl', [])
    have = {t[0] for t in d['tpl']}
    for k, v in TP:
        if k not in have: d['tpl'].append([k, v[li]])
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('ok')
