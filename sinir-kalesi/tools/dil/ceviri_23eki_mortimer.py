# 23 Eki (Caner: kahve motifi abartılmasın, Mortimer havalı/egolu/güçlü): kahve geçen 7 Mortimer repliği yenilendi; 6 dil. Sonra: node tools/dil/build.js
import json, os
D = os.path.dirname(__file__)
T = {  # + 4 eksik çeviri (Severus / 2. sefer açılışı)
 "O ibrikle beni mi yıkayacak? Ben zaten temizim.": ["He means to wash me with that jug? I'm already clean.", "¿Va a lavarme con esa jarra? Ya estoy limpio.", "Mit dem Krug will er mich waschen? Ich bin schon sauber.", "Il compte me laver avec cette cruche ? Je suis déjà propre.", "Он хочет умыть меня из этого кувшина? Я и так чистый.", "他想用那个壶给我洗澡？我已经很干净了。"],
 "Kutsal suyuna biraz lanet kattım. Afiyet olsun.": ["I added a little curse to your holy water. Enjoy.", "Le añadí una pizca de maldición a tu agua bendita. Que aproveche.", "Ich habe deinem Weihwasser etwas Fluch beigemischt. Wohl bekomm’s.", "J’ai ajouté un peu de malédiction à ton eau bénite. Bon appétit.", "Я подмешал немного проклятия в твою святую воду. Приятного аппетита.", "我在你的圣水里加了点诅咒。请慢用。"],
 "Söylemiştim: ölülerle oynanmaz.": ["I told you: you don't play with the dead.", "Te lo dije: con los muertos no se juega.", "Ich hab’s dir gesagt: Mit den Toten spielt man nicht.", "Je te l’avais dit : on ne joue pas avec les morts.", "Я же говорил: с мёртвыми не шутят.", "我早说过：别拿死者开玩笑。"],
 "Beni yakmaya mı geldiniz? Islak odun getirmişsiniz.": ["You came to burn me? You brought wet firewood.", "¿Vinisteis a quemarme? Habéis traído leña mojada.", "Ihr wollt mich verbrennen? Ihr habt nasses Holz mitgebracht.", "Vous êtes venus me brûler ? Vous avez apporté du bois mouillé.", "Пришли меня сжечь? Вы принесли сырые дрова.", "你们是来烧我的？带的可是湿柴火。"],

 "Şşş. Efendiniz dinleniyor.": ["Shh. Your master is resting.", "Shh. Vuestro amo descansa.", "Psst. Euer Meister ruht.", "Chut. Votre maître se repose.", "Тсс. Ваш господин отдыхает.", "嘘。你们的主人在休息。"],
 "Parlıyor. Mezarlığımı aydınlattığın için teşekkürler.": ["Shiny. Thanks for lighting up my graveyard.", "Qué brillo. Gracias por iluminar mi cementerio.", "Glänzend. Danke, dass du meinen Friedhof beleuchtest.", "Ça brille. Merci d’éclairer mon cimetière.", "Блестит. Спасибо, что осветил моё кладбище.", "真亮。谢谢你照亮我的墓地。"],
 "Yine mi misafir? Bu topraklar benim, unuttunuz mu?": ["Guests again? These lands are mine, did you forget?", "¿Visitas otra vez? Estas tierras son mías, ¿lo olvidasteis?", "Schon wieder Gäste? Dieses Land gehört mir, vergessen?", "Encore des invités ? Ces terres sont à moi, vous avez oublié ?", "Опять гости? Эти земли мои, забыли?", "又来客人了？这片土地是我的，忘了吗？"],
 "Kalabalık geldiler. Ne güzel, ordum büyüyecek.": ["They came in numbers. Lovely, my army will grow.", "Vienen en masa. Qué bien, mi ejército crecerá.", "Sie kommen in Scharen. Schön, mein Heer wird wachsen.", "Ils viennent en nombre. Parfait, mon armée va grandir.", "Их много. Прекрасно, моя армия вырастет.", "来了一大群。很好，我的军队要壮大了。"],
 "Kapımı izinsiz açtın. Bu kişisel oldu.": ["You opened my gate uninvited. Now it is personal.", "Abriste mi puerta sin permiso. Ahora es personal.", "Du hast mein Tor ungefragt geöffnet. Jetzt ist es persönlich.", "Tu as ouvert ma porte sans permission. C’est personnel, maintenant.", "Ты открыл мои ворота без спроса. Теперь это личное.", "你擅自打开了我的大门。这下是私人恩怨了。"],
 "Kaleme dokunan, mezarını kendi kazar.": ["Whoever touches my keep digs their own grave.", "Quien toca mi torre cava su propia tumba.", "Wer meine Burg berührt, gräbt sein eigenes Grab.", "Qui touche à mon donjon creuse sa propre tombe.", "Кто тронет мою крепость, сам роет себе могилу.", "谁敢碰我的城堡，就是在给自己挖坟。"],
 "Tertemiz. Mezarların efendisi yine kazandı.": ["Spotless. The Lord of Graves wins again.", "Impecable. El Señor de las Tumbas gana otra vez.", "Makellos. Der Herr der Gräber siegt erneut.", "Impeccable. Le Seigneur des Tombes l’emporte encore.", "Безупречно. Повелитель могил снова победил.", "干净利落。墓地之主又赢了。"],
}
for i, L in enumerate(['en', 'es', 'de', 'fr', 'ru', 'zh']):
    p = os.path.join(D, L + '_extra.json'); d = json.load(open(p))
    for tr, v in T.items(): d['exact'][tr] = v[i]
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('eklendi', len(T))
