"""18 Eki: erişilebilirlik, Sonsuz Gece rekorları, kozmetik görünümler, Ölüler Gecesi etkinliği metinleri (6 dil)."""
import json
L6 = ('en', 'de', 'es', 'fr', 'ru', 'zh')
def r(*v): return dict(zip(L6, v))
T = {
 'Sarsıntı ve parlama': r('Shake and flashes', 'Wackeln und Blitze', 'Temblor y destellos', 'Secousses et flashs', 'Тряска и вспышки', '震动与闪光'),
 'Renk körü modu': r('Colorblind mode', 'Farbenblind-Modus', 'Modo daltónico', 'Mode daltonien', 'Режим для дальтоников', '色盲模式'),
 'DÜNYA SIRALAMASI': r('WORLD RANKING', 'WELTRANGLISTE', 'CLASIFICACIÓN MUNDIAL', 'CLASSEMENT MONDIAL', 'МИРОВОЙ РЕЙТИНГ', '世界排行'),
 'Sonsuz Gece · Rekorların': r('Endless Night · Your records', 'Endlose Nacht · Deine Rekorde', 'Noche Eterna · Tus récords', 'Nuit sans fin · Tes records', 'Бесконечная ночь · Твои рекорды', '无尽之夜 · 你的纪录'),
 'Henüz deneme yok. İlk rekoru sen kır.': r('No runs yet. Set the first record.', 'Noch kein Versuch. Stell den ersten Rekord auf.', 'Aún no hay intentos. Bate el primer récord.', 'Aucune tentative. Établis le premier record.', 'Попыток ещё нет. Установи первый рекорд.', '还没有记录，来创造第一个吧。'),
 'GÖRÜNÜM': r('LOOKS', 'AUSSEHEN', 'ASPECTO', 'APPARENCE', 'ОБЛИК', '外观'),
 'Sade': r('Plain', 'Schlicht', 'Sencillo', 'Simple', 'Простой', '朴素'),
 'Altın Rün': r('Golden Rune', 'Goldrune', 'Runa dorada', 'Rune d’or', 'Золотая руна', '黄金符文'),
 'Ruh Ateşi': r('Soul Fire', 'Seelenfeuer', 'Fuego de almas', 'Feu d’âme', 'Огонь душ', '灵魂之火'),
 'Kan Sisi': r('Blood Mist', 'Blutnebel', 'Niebla de sangre', 'Brume de sang', 'Кровавый туман', '血雾'),
 'Ayaz': r('Frost', 'Frost', 'Escarcha', 'Givre', 'Иней', '霜冻'),
 'Balkabağı': r('Pumpkin', 'Kürbis', 'Calabaza', 'Citrouille', 'Тыква', '南瓜'),
 'Kor İzi': r('Ember Trail', 'Glutspur', 'Rastro de brasas', 'Traînée de braises', 'След углей', '余烬之迹'),
 'Yarasa Sürüsü': r('Bat Swarm', 'Fledermausschwarm', 'Enjambre de murciélagos', 'Nuée de chauves-souris', 'Стая летучих мышей', '蝙蝠群'),
 'Altın Taç': r('Golden Crown', 'Goldene Krone', 'Corona dorada', 'Couronne d’or', 'Золотая корона', '黄金王冠'),
 'Hayalet İz': r('Ghost Trail', 'Geisterspur', 'Rastro fantasmal', 'Traînée spectrale', 'Призрачный след', '幽灵之迹'),
 'TAKILI': r('EQUIPPED', 'AUSGERÜSTET', 'EQUIPADO', 'ÉQUIPÉ', 'НАДЕТО', '已装备'),
 'TAK': r('EQUIP', 'ANLEGEN', 'EQUIPAR', 'ÉQUIPER', 'НАДЕТЬ', '装备'),
 'Etkinlik ödülü': r('Event reward', 'Event-Belohnung', 'Premio del evento', 'Récompense d’événement', 'Награда события', '活动奖励'),
 'Bu görünüm etkinlik ödülü': r('This look is an event reward', 'Dieses Aussehen ist eine Event-Belohnung', 'Este aspecto es un premio de evento', 'Cette apparence est une récompense d’événement', 'Этот облик — награда события', '此外观为活动奖励'),
 'Kristal yetmiyor': r('Not enough crystals', 'Nicht genug Kristalle', 'No tienes suficientes cristales', 'Pas assez de cristaux', 'Не хватает кристаллов', '水晶不足'),
 'KULE GÖRÜNÜMÜ · bütün kulelerin tabanında': r('TOWER LOOK · at the base of every tower', 'TURM-AUSSEHEN · am Fuß jedes Turms', 'ASPECTO DE TORRE · en la base de cada torre', 'APPARENCE DES TOURS · à la base de chaque tour', 'ОБЛИК БАШЕН · у основания каждой башни', '塔外观 · 每座塔的底座'),
 'KOMUTAN GÖRÜNÜMÜ · savaştaki komutanlarda': r('COMMANDER LOOK · on commanders in battle', 'KOMMANDANTEN-AUSSEHEN · im Kampf', 'ASPECTO DE COMANDANTE · en batalla', 'APPARENCE DES COMMANDANTS · en combat', 'ОБЛИК КОМАНДИРА · в бою', '指挥官外观 · 战斗中'),
 'Ölüler Gecesi': r('Night of the Dead', 'Nacht der Toten', 'Noche de los Muertos', 'Nuit des Morts', 'Ночь мёртвых', '亡者之夜'),
 'ÖLÜLER GECESİ': r('NIGHT OF THE DEAD', 'NACHT DER TOTEN', 'NOCHE DE LOS MUERTOS', 'NUIT DES MORTS', 'НОЧЬ МЁРТВЫХ', '亡者之夜'),
 'Balkabakları yandı, ölüler dans ediyor. İmparatorluk bu gece de durmuyor.': r('The pumpkins are lit, the dead are dancing. The Empire won’t rest tonight either.', 'Die Kürbisse leuchten, die Toten tanzen. Das Imperium ruht auch heute Nacht nicht.', 'Las calabazas arden, los muertos bailan. El Imperio tampoco descansa esta noche.', 'Les citrouilles brillent, les morts dansent. L’Empire ne se repose pas cette nuit non plus.', 'Тыквы горят, мёртвые пляшут. Империя не дремлет и этой ночью.', '南瓜点亮，亡者起舞。帝国今夜也不罢休。'),
 'Balkabağı Tarlası': r('Pumpkin Patch', 'Kürbisfeld', 'Campo de calabazas', 'Champ de citrouilles', 'Тыквенное поле', '南瓜田'),
 'Hayaletli Yol': r('Haunted Road', 'Spukweg', 'Camino embrujado', 'Route hantée', 'Призрачная дорога', '闹鬼之路'),
 'Kabak Kralın Gecesi': r('Night of the Pumpkin King', 'Nacht des Kürbiskönigs', 'Noche del Rey Calabaza', 'Nuit du Roi Citrouille', 'Ночь Тыквенного короля', '南瓜王之夜'),
 'Düşmanlar %15 hızlı': r('Enemies 15% faster', 'Feinde 15 % schneller', 'Enemigos un 15% más rápidos', 'Ennemis 15 % plus rapides', 'Враги на 15% быстрее', '敌人速度 +15%'),
 'Düşmanlar %25 dayanıklı · az altın': r('Enemies 25% tougher · less gold', 'Feinde 25 % zäher · weniger Gold', 'Enemigos un 25% más duros · menos oro', 'Ennemis 25 % plus résistants · moins d’or', 'Враги на 25% крепче · меньше золота', '敌人耐久 +25% · 金币减少'),
 'Büyü yok · düşmanlar güçlü': r('No spells · strong enemies', 'Keine Zauber · starke Feinde', 'Sin hechizos · enemigos fuertes', 'Pas de sorts · ennemis forts', 'Без заклинаний · сильные враги', '无法术 · 敌人强大'),
 'ÖDÜL': r('REWARD', 'BELOHNUNG', 'PREMIO', 'RÉCOMPENSE', 'НАГРАДА', '奖励'),
 'TAMAM ✓': r('DONE ✓', 'ERLEDIGT ✓', 'HECHO ✓', 'FAIT ✓', 'ГОТОВО ✓', '完成 ✓'),
 'OYNA': r('PLAY', 'SPIELEN', 'JUGAR', 'JOUER', 'ИГРАТЬ', '开始'),
 'KİLİTLİ': r('LOCKED', 'GESPERRT', 'BLOQUEADO', 'VERROUILLÉ', 'ЗАКРЫТО', '未解锁'),
 'Önce önceki bölümü bitir': r('Finish the previous stage first', 'Beende zuerst die vorige Stufe', 'Termina primero la fase anterior', 'Termine d’abord l’étape précédente', 'Сначала пройди предыдущий этап', '请先完成上一关'),
 'Şu an açık etkinlik yok': r('No event right now', 'Gerade kein Event', 'No hay ningún evento ahora', 'Aucun événement en ce moment', 'Сейчас нет событий', '当前没有活动'),
 'ETKİNLİĞE DÖN': r('BACK TO EVENT', 'ZUM EVENT', 'VOLVER AL EVENTO', 'RETOUR À L’ÉVÉNEMENT', 'К СОБЫТИЮ', '返回活动'),
 'gün': r('days', 'Tage', 'días', 'jours', 'дн.', '天'),
}
TPL = {
 '{} dalga': r('{} waves', '{} Wellen', '{} oleadas', '{} vagues', '{} волн', '{} 波'),
 'En iyi: {} dalga': r('Best: {} waves', 'Bestwert: {} Wellen', 'Mejor: {} oleadas', 'Meilleur : {} vagues', 'Лучший: {} волн', '最佳：{} 波'),
 '{} · {} öldürme · {}': r('{} · {} kills · {}', '{} · {} Kills · {}', '{} · {} bajas · {}', '{} · {} éliminations · {}', '{} · {} убийств · {}', '{} · {} 击杀 · {}'),
 'Kristalin: {}': r('Your crystals: {}', 'Deine Kristalle: {}', 'Tus cristales: {}', 'Tes cristaux : {}', 'Твои кристаллы: {}', '你的水晶：{}'),
 '{}  ·  Bitişe {} gün': r('{}  ·  {} days left', '{}  ·  noch {} Tage', '{}  ·  quedan {} días', '{}  ·  encore {} jours', '{}  ·  осталось {} дн.', '{}  ·  剩余 {} 天'),
 'Yeni görünüm: {}': r('New look: {}', 'Neues Aussehen: {}', 'Nuevo aspecto: {}', 'Nouvelle apparence : {}', 'Новый облик: {}', '新外观：{}'),
}
for L in L6:
    p = f'{L}_extra.json'; d = json.load(open(p)); d.setdefault('tpl', [])
    for k, v in T.items(): d['exact'][k] = v[L]
    have = {a for a, _ in d['tpl']}
    for k, v in TPL.items():
        if k not in have: d['tpl'].append([k, v[L]])
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('tamam')
