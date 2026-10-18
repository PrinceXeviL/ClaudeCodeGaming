"""18 Eki (gece): tarama sonrası kalan şablonlar (Ceset Golemi kapağı, uzmanlık düğmesi, AÇ/Zırh etiketleri). Sonra: node tools/dil/build.js"""
import json, os
D = os.path.dirname(os.path.abspath(__file__))
L6 = ('en', 'de', 'es', 'fr', 'ru', 'zh')
def r(*v): return dict(zip(L6, v))
TPL = {
 'Kapağa dokun: {} altına Ceset Golemi çıkar, yolu tutar. Meşaleciler kapağı mühürler!': r(
  'Tap the hatch: raise a Corpse Golem for {} gold, it holds the road. Torchbearers seal the hatch!',
  'Tippe auf die Luke: Für {} Gold erhebt sich ein Leichengolem und hält die Straße. Fackelträger versiegeln die Luke!',
  'Toca la trampilla: por {} de oro sale un Gólem de Cadáveres que bloquea el camino. ¡Los portadores de antorchas sellan la trampilla!',
  'Touche la trappe : pour {} or, un Golem de cadavres surgit et tient la route. Les porte-torches scellent la trappe !',
  'Коснись люка: за {} золота поднимется Трупный голем и перекроет дорогу. Факельщики запечатывают люк!',
  '点击地窖门：花费{}金币召唤尸体魔像，它会守住道路。火把手会封住地窖门！'),
 'Ceset Golemi çıkar (Can {} · Hasar {}-{} · Zırh %{}), yolu tutar; ölürse {} sn sonra yeniden çıkar. Meşaleciler kapağı mühürler!': r(
  'Raises a Corpse Golem (HP {} · Damage {}-{} · Armor {}%), it holds the road; if it dies it rises again after {} s. Torchbearers seal the hatch!',
  'Erhebt einen Leichengolem (LP {} · Schaden {}-{} · Rüstung {} %), er hält die Straße; stirbt er, erhebt er sich nach {} s erneut. Fackelträger versiegeln die Luke!',
  'Levanta un Gólem de Cadáveres (Vida {} · Daño {}-{} · Armadura {}%), bloquea el camino; si muere, vuelve a alzarse a los {} s. ¡Los portadores de antorchas sellan la trampilla!',
  'Fait surgir un Golem de cadavres (PV {} · Dégâts {}-{} · Armure {} %), il tient la route ; s\'il meurt, il revient après {} s. Les porte-torches scellent la trappe !',
  'Поднимает Трупного голема (Здоровье {} · Урон {}-{} · Броня {}%), он держит дорогу; если погибнет, встанет снова через {} с. Факельщики запечатывают люк!',
  '召唤尸体魔像（生命{} · 伤害{}-{} · 护甲{}%），守住道路；阵亡后{}秒重新站起。火把手会封住地窖门！'),
 'Uzmanlık: yukarıdaki düğme ({})': r('Specialization: the button above ({})', 'Spezialisierung: die Taste oben ({})', 'Especialización: el botón de arriba ({})',
  'Spécialisation : le bouton du dessus ({})', 'Специализация: кнопка сверху ({})', '专精：上方按钮（{}）'),
 'AÇ · {}': r('UNLOCK · {}', 'FREISCHALTEN · {}', 'DESBLOQUEAR · {}', 'DÉBLOQUER · {}', 'ОТКРЫТЬ · {}', '解锁 · {}'),
 'Zırh: {}': r('Armor: {}', 'Rüstung: {}', 'Armadura: {}', 'Armure : {}', 'Броня: {}', '护甲：{}'),
}
for L in L6:
    p = os.path.join(D, f'{L}_extra.json'); d = json.load(open(p))
    tp = {t[0]: t for t in d['tpl']}
    for k, v in TPL.items(): tp[k] = [k, v[L]]
    d['tpl'] = list(tp.values())
    json.dump(d, open(p, 'w'), ensure_ascii=False, indent=1)
print('tamam', len(TPL))
