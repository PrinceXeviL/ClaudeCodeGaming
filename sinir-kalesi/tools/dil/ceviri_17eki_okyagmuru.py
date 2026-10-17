"""17 Eki: Robin'in ok yağmuru (40 ok sağanak, saplanır) metinleri (6 dil)."""
import json
T = {
 'Seçtiğin alana 40 yeşil ruh ateşli ok sağanak gibi yağar: hasar verir, zehirler, oklar yere saplanır': {
  'en': '40 green soul-fire arrows pour down on the chosen area: they deal damage, poison, and stick into the ground',
  'de': '40 grüne Seelenfeuer-Pfeile prasseln auf das gewählte Gebiet: Schaden, Gift, die Pfeile bleiben im Boden stecken',
  'es': '40 flechas de fuego de almas verde caen como un aguacero en la zona elegida: dañan, envenenan y se clavan en el suelo',
  'fr': '40 flèches de feu d’âme vertes s’abattent en averse sur la zone choisie : dégâts, poison, et elles se plantent au sol',
  'ru': '40 зелёных стрел душ обрушиваются ливнем на выбранную область: наносят урон, отравляют и вонзаются в землю',
  'zh': '40 支绿色魂火箭如暴雨般落在所选区域：造成伤害、中毒，箭会插在地上'},
 'Alana 40 okluk zehirli sağanak': {'en': 'A 40-arrow poison downpour', 'de': 'Giftiger Schauer aus 40 Pfeilen', 'es': 'Aguacero venenoso de 40 flechas',
  'fr': 'Averse empoisonnée de 40 flèches', 'ru': 'Ядовитый ливень из 40 стрел', 'zh': '40 支毒箭暴雨'},
}
for L in ('en', 'de', 'es', 'fr', 'ru', 'zh'):
    p = f'{L}_extra.json'; d = json.load(open(p))
    for k, v in T.items(): d['exact'][k] = v[L]
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('tamam')
