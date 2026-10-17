"""17 Eki: serbest mod, yeni hediye penceresi, ikinci komutan yuvası metinleri (6 dil)."""
import json
T = {
 'SERBEST MOD': {'en': 'SANDBOX', 'de': 'SANDKASTEN', 'es': 'MODO LIBRE', 'fr': 'MODE LIBRE', 'ru': 'ПЕСОЧНИЦА', 'zh': '沙盒模式'},
 'Serbest': {'en': 'Sandbox', 'de': 'Sandkasten', 'es': 'Libre', 'fr': 'Libre', 'ru': 'Песочница', 'zh': '沙盒'},
 'Sınırsız altın ve can · istediğin düşmanı çağır · kayıt yok': {'en': 'Unlimited gold and lives · summon any enemy · nothing is saved', 'de': 'Unbegrenzt Gold und Leben · rufe jeden Feind · nichts wird gespeichert', 'es': 'Oro y vidas ilimitados · invoca cualquier enemigo · no se guarda nada', 'fr': 'Or et vies illimités · invoque n’importe quel ennemi · rien n’est sauvegardé', 'ru': 'Бесконечное золото и жизни · вызывай любых врагов · ничего не сохраняется', 'zh': '无限金币和生命 · 召唤任意敌人 · 不保存进度'},
 'Sınırsız altın ve can · soldaki panelden düşman çağır': {'en': 'Unlimited gold and lives · summon enemies from the left panel', 'de': 'Unbegrenzt Gold und Leben · rufe Feinde über das linke Feld', 'es': 'Oro y vidas ilimitados · invoca enemigos desde el panel izquierdo', 'fr': 'Or et vies illimités · invoque des ennemis depuis le panneau de gauche', 'ru': 'Бесконечное золото и жизни · вызывай врагов в левой панели', 'zh': '无限金币和生命 · 在左侧面板召唤敌人'},
 'Sınırsız altın ve can, dalga yok. İstediğin düşmanı çağır, kulelerini ve komutanını dene. Hiçbir şey kaydedilmez.': {'en': 'Unlimited gold and lives, no waves. Summon any enemy and test your towers and commander. Nothing is saved.', 'de': 'Unbegrenzt Gold und Leben, keine Wellen. Rufe jeden Feind und teste Türme und Kommandanten. Nichts wird gespeichert.', 'es': 'Oro y vidas ilimitados, sin oleadas. Invoca cualquier enemigo y prueba tus torres y tu comandante. No se guarda nada.', 'fr': 'Or et vies illimités, pas de vagues. Invoque n’importe quel ennemi et teste tes tours et ton commandant. Rien n’est sauvegardé.', 'ru': 'Бесконечное золото и жизни, без волн. Вызывай любых врагов и испытывай башни и командира. Ничего не сохраняется.', 'zh': '无限金币和生命，没有波次。召唤任意敌人，测试你的塔和指挥官。不保存任何进度。'},
 'Bölümü bir kez bitir, Serbest Mod açılsın.': {'en': 'Finish the level once to unlock Sandbox.', 'de': 'Schließe das Level einmal ab, um den Sandkasten freizuschalten.', 'es': 'Completa el nivel una vez para desbloquear el modo libre.', 'fr': 'Termine le niveau une fois pour débloquer le mode libre.', 'ru': 'Пройди уровень один раз, чтобы открыть песочницу.', 'zh': '通关一次即可解锁沙盒模式。'},
 'SERBEST ▲': {'en': 'SANDBOX ▲', 'de': 'SANDKASTEN ▲', 'es': 'LIBRE ▲', 'fr': 'LIBRE ▲', 'ru': 'ПЕСОЧНИЦА ▲', 'zh': '沙盒 ▲'},
 'SERBEST ▼': {'en': 'SANDBOX ▼', 'de': 'SANDKASTEN ▼', 'es': 'LIBRE ▼', 'fr': 'LIBRE ▼', 'ru': 'ПЕСОЧНИЦА ▼', 'zh': '沙盒 ▼'},
 'DÜŞMAN ÇAĞIR': {'en': 'SUMMON ENEMY', 'de': 'FEIND RUFEN', 'es': 'INVOCAR ENEMIGO', 'fr': 'INVOQUER', 'ru': 'ВЫЗВАТЬ ВРАГА', 'zh': '召唤敌人'},
 'SİL': {'en': 'CLEAR', 'de': 'LEEREN', 'es': 'BORRAR', 'fr': 'EFFACER', 'ru': 'ОЧИСТИТЬ', 'zh': '清除'},
 'Temizlendi': {'en': 'Cleared', 'de': 'Geleert', 'es': 'Despejado', 'fr': 'Effacé', 'ru': 'Очищено', 'zh': '已清除'},
 'Büyüler beklemesiz': {'en': 'No spell cooldowns', 'de': 'Zauber ohne Abklingzeit', 'es': 'Hechizos sin espera', 'fr': 'Sorts sans recharge', 'ru': 'Заклинания без перезарядки', 'zh': '法术无冷却'},
 'Büyü beklemesi açık': {'en': 'Spell cooldowns on', 'de': 'Abklingzeiten an', 'es': 'Espera de hechizos activada', 'fr': 'Recharge des sorts activée', 'ru': 'Перезарядка включена', 'zh': '法术冷却已开启'},
 'BUGÜN': {'en': 'TODAY', 'de': 'HEUTE', 'es': 'HOY', 'fr': 'AUJOURD’HUI', 'ru': 'СЕГОДНЯ', 'zh': '今天'},
 'Kristallerle dükkândan komutan ve eşya alınır': {'en': 'Spend crystals in the shop on commanders and items', 'de': 'Mit Kristallen kaufst du im Laden Kommandanten und Gegenstände', 'es': 'Con cristales compras comandantes y objetos en la tienda', 'fr': 'Les cristaux achètent commandants et objets à la boutique', 'ru': 'За кристаллы в лавке покупают командиров и предметы', 'zh': '水晶可在商店购买指挥官和道具'},
 'Bugünkü hediyen hazır. Ben cömert bir iskeletim.': {'en': 'Today’s gift is ready. I am a generous skeleton.', 'de': 'Dein Geschenk ist bereit. Ich bin ein großzügiges Skelett.', 'es': 'Tu regalo de hoy está listo. Soy un esqueleto generoso.', 'fr': 'Ton cadeau du jour est prêt. Je suis un squelette généreux.', 'ru': 'Сегодняшний подарок готов. Я щедрый скелет.', 'zh': '今天的礼物准备好了。我是个大方的骷髅。'},
 'Gel bakalım, bugün de eli boş dönmeyeceksin.': {'en': 'Come here, you won’t leave empty-handed today either.', 'de': 'Komm her, auch heute gehst du nicht leer aus.', 'es': 'Ven, hoy tampoco te irás con las manos vacías.', 'fr': 'Approche, tu ne repartiras pas les mains vides aujourd’hui non plus.', 'ru': 'Подходи, сегодня тоже не уйдёшь с пустыми руками.', 'zh': '过来吧，今天也不会让你空手而归。'},
 'Her gün uğra, kasam dolu.': {'en': 'Drop by every day, my vault is full.', 'de': 'Komm jeden Tag vorbei, meine Truhe ist voll.', 'es': 'Pasa cada día, mi cofre está lleno.', 'fr': 'Passe chaque jour, mon coffre est plein.', 'ru': 'Заходи каждый день, сундук полон.', 'zh': '每天都来吧，我的宝库满满的。'},
 'Yedinci gün sandığı açıyoruz. Kaçırma!': {'en': 'On day seven we open the chest. Don’t miss it!', 'de': 'Am siebten Tag öffnen wir die Truhe. Verpass es nicht!', 'es': 'El séptimo día abrimos el cofre. ¡No te lo pierdas!', 'fr': 'Le septième jour, on ouvre le coffre. Ne le rate pas !', 'ru': 'На седьмой день открываем сундук. Не пропусти!', 'zh': '第七天我们开宝箱。别错过！'},
 'BAŞ KOMUTAN': {'en': 'LEADER', 'de': 'ANFÜHRER', 'es': 'LÍDER', 'fr': 'CHEF', 'ru': 'ГЛАВНЫЙ', 'zh': '主将'},
 'YARDIMCI': {'en': 'SECOND', 'de': 'ZWEITER', 'es': 'APOYO', 'fr': 'SECOND', 'ru': 'ПОМОЩНИК', 'zh': '副将'},
 'BAŞA GEÇİR': {'en': 'MAKE LEADER', 'de': 'ZUM ANFÜHRER', 'es': 'HACER LÍDER', 'fr': 'NOMMER CHEF', 'ru': 'СДЕЛАТЬ ГЛАВНЫМ', 'zh': '设为主将'},
}
TPL = {
 'YOL {}': {'en': 'PATH {}', 'de': 'WEG {}', 'es': 'RUTA {}', 'fr': 'VOIE {}', 'ru': 'ПУТЬ {}', 'zh': '路线 {}'},
 'Yarın: {}': {'en': 'Tomorrow: {}', 'de': 'Morgen: {}', 'es': 'Mañana: {}', 'fr': 'Demain : {}', 'ru': 'Завтра: {}', 'zh': '明天：{}'},
 '{} kristal + {}': {'en': '{} crystals + {}', 'de': '{} Kristalle + {}', 'es': '{} cristales + {}', 'fr': '{} cristaux + {}', 'ru': '{} кристалла + {}', 'zh': '{} 水晶 + {}'},
}
for L in ('en', 'de', 'es', 'fr', 'ru', 'zh'):
    p = f'{L}_extra.json'; d = json.load(open(p)); d.setdefault('tpl', [])
    for k, v in T.items(): d['exact'][k] = v[L]
    have = {a for a, _ in d['tpl']}
    for k, v in TPL.items():
        if k not in have: d['tpl'].append([k, v[L]])
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('tamam')
