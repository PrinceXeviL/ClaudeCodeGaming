# 23 Eki: 40. bölüm final sahnesi (end2: cine_final_a + cine_final_b) altyazıları, 6 dil. Sonra: node tools/dil/build.js
import json, os
D = os.path.dirname(__file__)
T = {
 "Büyük Engizitör düştü. Kendi ışığı onu yaktı.": {
  "en": "The Grand Inquisitor has fallen. His own light burned him.",
  "es": "El Gran Inquisidor ha caído. Su propia luz lo quemó.",
  "de": "Der Großinquisitor ist gefallen. Sein eigenes Licht hat ihn verbrannt.",
  "fr": "Le Grand Inquisiteur est tombé. Sa propre lumière l’a consumé.",
  "ru": "Великий инквизитор пал. Его сжёг собственный свет.",
  "zh": "大审判官倒下了。他被自己的圣光焚尽。"},
 "Mitresi yuvarlandı... tam Mortimer'ın terliğinin önüne.": {
  "en": "His mitre rolled... right up to Mortimer’s slipper.",
  "es": "Su mitra rodó... justo hasta la zapatilla de Mortimer.",
  "de": "Seine Mitra rollte ... genau vor Mortimers Pantoffel.",
  "fr": "Sa mitre a roulé... jusqu’à la pantoufle de Mortimer.",
  "ru": "Его митра покатилась... прямо к тапочку Мортимера.",
  "zh": "他的主教冠滚了过去……正好停在莫提默的拖鞋前。"},
 "Şafak. Topraklar yine Mortimer'ın.": {
  "en": "Dawn. The land is Mortimer’s once more.",
  "es": "Amanece. La tierra vuelve a ser de Mortimer.",
  "de": "Morgengrauen. Das Land gehört wieder Mortimer.",
  "fr": "L’aube. La terre appartient de nouveau à Mortimer.",
  "ru": "Рассвет. Земля снова принадлежит Мортимеру.",
  "zh": "黎明。这片土地再次属于莫提默。"},
 "\"İmparatorluğa söyleyin: bir dahaki sefere randevu alsınlar.\"": {
  "en": "\"Tell the Empire: next time, make an appointment.\"",
  "es": "\"Decidle al Imperio: la próxima vez, que pidan cita.\"",
  "de": "\"Sagt dem Imperium: Nächstes Mal bitte mit Termin.\"",
  "fr": "\"Dites à l’Empire : la prochaine fois, prenez rendez-vous.\"",
  "ru": "\"Передайте Империи: в следующий раз — по записи.\"",
  "zh": "“告诉帝国：下次来之前，先预约。”"},
}
for L in ['en', 'es', 'de', 'fr', 'ru', 'zh']:
    p = os.path.join(D, L + '_extra.json'); d = json.load(open(p))
    for tr, v in T.items(): d['exact'][tr] = v[L]
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('eklendi', len(T))
