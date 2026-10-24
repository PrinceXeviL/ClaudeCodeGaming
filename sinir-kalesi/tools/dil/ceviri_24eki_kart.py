# 24 Eki: bölüm kartı v3 (2. komutan yuvası, tavsiye şeridi, mod kutusu) + Merlin kasırga kademeleri, 6 dil. Sonra: node tools/dil/build.js
import json, os
D = os.path.dirname(__file__)
R = [
 ("2. KOMUTAN", "2ND COMMANDER", "2.º COMANDANTE", "2. KOMMANDANT", "2E COMMANDANT", "2-Й КОМАНДИР", "第二指挥官"),
 ("kilitli", "locked", "bloqueado", "gesperrt", "verrouillé", "закрыто", "未解锁"),
 ("ücretsiz", "free", "gratis", "gratis", "gratuit", "бесплатно", "免费"),
 ("▶ reklam izle", "▶ watch ad", "▶ ver anuncio", "▶ Werbung ansehen", "▶ voir une pub", "▶ смотреть рекламу", "▶ 观看广告"),
 ("Önce ikinci bir komutan aç", "Unlock a second commander first", "Desbloquea primero un segundo comandante", "Schalte zuerst einen zweiten Kommandanten frei", "Débloque d'abord un deuxième commandant", "Сначала открой второго командира", "请先解锁第二位指挥官"),
 ("KOMUTANLAR", "COMMANDERS", "COMANDANTES", "KOMMANDANTEN", "COMMANDANTS", "КОМАНДИРЫ", "指挥官"),
 ("Hikâye", "Story", "Historia", "Geschichte", "Histoire", "Сюжет", "剧情"),
 ("yıldız", "stars", "estrellas", "Sterne", "étoiles", "звёзд", "星"),
 ("Rekorun", "Your record", "Tu récord", "Dein Rekord", "Ton record", "Твой рекорд", "你的纪录"),
 ("Henüz rekor yok", "No record yet", "Aún sin récord", "Noch kein Rekord", "Pas encore de record", "Рекорда пока нет", "暂无纪录"),
 ("SIRALAMA", "RANKING", "RANKING", "RANGLISTE", "CLASSEMENT", "РЕЙТИНГ", "排行"),
 ("değiştir ▸", "change ▸", "cambiar ▸", "ändern ▸", "changer ▸", "сменить ▸", "更换 ▸"),
 ("kapat ▾", "close ▾", "cerrar ▾", "schließen ▾", "fermer ▾", "закрыть ▾", "关闭 ▾"),
]
OLD = "Fırtına bulutundan kasırga iner, yolda geriye ilerler: kapılan düşmanlar dönerek havalanır, hasar alıp etrafa savrulur (ağırlar ve boss yere devrilir), buluttan şimşek çakar"
ADD = ("Güç kademesi arttıkça yanına 1-3 küçük hortum katılır; son kademede hortumların içinde kızıl-mor şimşekler çakar",
  "As the power rank rises, 1-3 small twisters join it; at the top rank crimson-violet lightning flashes inside them",
  "Al subir el rango, se le unen 1-3 tornados pequeños; en el rango máximo destellan rayos carmesí y violeta en su interior",
  "Mit steigender Stufe gesellen sich 1-3 kleine Wirbel dazu; auf der höchsten Stufe zucken purpurrote und violette Blitze darin",
  "Plus le rang monte, plus 1 à 3 petites tornades la rejoignent ; au rang maximal, des éclairs pourpres et violets jaillissent à l'intérieur",
  "С ростом ранга к нему присоединяются 1-3 малых смерча; на высшем ранге внутри сверкают алые и фиолетовые молнии",
  "随着能力等级提升，会有1-3个小龙卷风加入；最高等级时龙卷风内闪烁红紫色闪电")
for i, L in enumerate(['en', 'es', 'de', 'fr', 'ru', 'zh']):
    p = os.path.join(D, L + '_extra.json'); d = json.load(open(p))
    for row in R: d['exact'][row[0]] = row[i + 1]
    tr = d['exact'].get(OLD)
    if tr: d['exact'][OLD + '. ' + ADD[0]] = tr.rstrip('.。 ') + ('。' if L == 'zh' else '. ') + ADD[i + 1]
    else: print('eski kasırga çevirisi yok', L)
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('eklendi', len(R))
