// Oyun verisi: kuleler, düşmanlar, kahraman, büyüler, bölümler.
// Denge değerleri burada; revizeler çoğunlukla bu dosyada yapılır.

const W = 960, H = 540;
// bölümlerin toplam düşman sayısı çarpanı (10 Eki, Caner: her bölümde %20 daha çok düşman); TOTAL / TOTAL2 bununla çarpılır
const MORE_FOES = 1.2;

const TOWERS = {
  archer: {
    name: 'Okçu Kulesi', icon: 'archer', dmgType: 'phys', air: true,
    desc: 'Hızlı atış, havayı da vurur',
    levels: [
      // rate: kulenin iki atışı arası (sn). Seviye atladıkça atışlar belirgin hızlanır.
      { cost: 70,  range: 135, dmg: [4, 6],   rate: 1.15, perk: 'Uçanları da vurur' },
      { cost: 110, range: 158, dmg: [8, 12],  rate: 0.8,  perk: 'Daha hızlı atış · delici ok: %25 şansla zırhı yok sayar · +menzil' },
      { cost: 160, range: 192, dmg: [13, 19], rate: 0.55, perk: '3 okçu, çok hızlı atış · %15 kritik vuruş (2 kat) · çok daha uzun menzil' },
    ],
    // Son seviyede açılan, ayrı ayrı geliştirilen yetenekler (her biri 3 kademe)
    abilities: [
      // 4. kademe yol seçimi (11 Eki, Caner): okçular (sık, az hasar, yüksek kavisli ok) ya da ağır arbaletçiler (seyrek, ağır, zırh delen cıvata)
      { id: 'bow', name: 'Hayalet Okçular', desc: (r) => `Kule 3 kızıl hayalet okçuya dönüşür: çok sık, yüksek kavisli oklar (ok başına az hasar), uçanlara +%30 · her ${r.every}. ok zehirli: 3 sn boyunca saniyede ${r.poison} hasar`,
        ranks: [{ cost: 150, every: 4, poison: 4 }, { cost: 200, every: 3, poison: 6 }, { cost: 260, every: 2, poison: 9 }] },
      { id: 'fan', name: 'Ağır Arbaletçiler', desc: (r) => `Kule 2 kızıl ağır arbaletçiye dönüşür: yavaş ama ağır cıvata, zırhın %${Math.round(r.pen * 100)} kadarını deler, vurduğunu geri iter · %${Math.round(r.crit * 100)} şansla 3 kat hasar`,
        ranks: [{ cost: 160, pen: 0.4, crit: 0.1 }, { cost: 220, pen: 0.6, crit: 0.15 }, { cost: 280, pen: 0.8, crit: 0.2 }] },
    ],
  },
  barracks: {
    name: 'Kışla', icon: 'barracks', dmgType: 'phys', air: false,
    desc: 'Askerler yolu keser',
    levels: [
      { cost: 70,  range: 120, hp: 50,  dmg: [3, 5],  armor: 0,    respawn: 10, perk: 'Deri zırhlı 3 asker yolu keser' },
      { cost: 110, range: 130, hp: 100, dmg: [5, 8],  armor: 0.15, respawn: 9,  perk: 'Çelik zırh, sorguçlu miğfer, keskin kılıç' },
      { cost: 150, range: 140, hp: 150, dmg: [8, 13], armor: 0.3,  respawn: 8,  perk: 'Altın şövalye zırhı · vuruşlar %15 can çalar' },
    ],
    abilities: [
      { id: 'shield', name: 'Kalkan Duvarı', desc: (r) => `+%${Math.round(r.armor * 100)} zırh, +${r.hp} can · darbeleri savuşturur, kalkanla sersemletir · ağır ve yavaş vurur · 4. iskelet`,
        ranks: [{ cost: 140, armor: 0.1, hp: 30 }, { cost: 190, armor: 0.18, hp: 60 }, { cost: 240, armor: 0.25, hp: 100 }] },
      { id: 'blade', name: 'Kılıç Ustası', desc: (r) => `Hasar x${r.mult} · %${Math.round(r.crit * 100)} kritik · hızlı vurur, savurması yandakine de işler · 4. iskelet`,
        ranks: [{ cost: 160, mult: 1.3, crit: 0.1 }, { cost: 220, mult: 1.6, crit: 0.15 }, { cost: 280, mult: 2, crit: 0.2 }] },
      // okçu yolu kaldırıldı (11 Eki): okçuluk artık Arbaletçi Kulesinin işi
    ],
  },
  mage: {
    name: 'Büyücü Kulesi', icon: 'mage', dmgType: 'magic', air: true,
    desc: 'Yıldırım atar, zırhı deler',
    levels: [
      { cost: 100, range: 128, dmg: [10, 18], rate: 2.1, perk: 'Yıldırım: büyü hasarı zırhı deler' },
      { cost: 160, range: 140, dmg: [24, 44], rate: 1.7, perk: 'Daha hızlı yükleme · şok: vurduğunu 1 sn %30 yavaşlatır' },
      { cost: 240, range: 152, dmg: [42, 76], rate: 1.3, perk: 'Hızlı yükleme · zincir yıldırım: yakındaki ikinci düşmana %60 hasar' },
    ],
    abilities: [
      // Ruh Emici: vuruş yakındaki iskeletleri iyileştirir · Hayalet Çağırıcı: yolda geriye süzülen hayalet, değdiğini korkutup yakar
      { id: 'drain', name: 'Ruh Emici', desc: (r) => `kule Ruh Emiciye dönüşür: ışın aynı hedefe art arda vurdukça %60'a kadar güçlenir · Işın canı emer: hedefin yakınındaki iskeletler hasarın %${Math.round(r.heal * 100)}'i kadar iyileşir`,
        ranks: [{ cost: 160, heal: 0.35 }, { cost: 220, heal: 0.55 }, { cost: 280, heal: 0.8 }] },
      { id: 'ghost', name: 'Ruh Kafesi', desc: (r) => `Kule Ruh Kafesine dönüşür: 8 sn'de bir en güçlü düşmanı 2 sn kafese kapatır · ${r.cd} sn'de bir yolda düşmanlara doğru hayalet salar: değdiğine ${r.dmg} hasar, ${r.fear} sn korku`,
        ranks: [{ cost: 200, cd: 9, dmg: 40, fear: 1.2 }, { cost: 260, cd: 8, dmg: 70, fear: 1.6 }, { cost: 320, cd: 7, dmg: 110, fear: 2 }] },
    ],
  },
  artillery: {
    name: 'Top Kulesi', icon: 'artillery', dmgType: 'phys', air: false,
    desc: 'Kısa menzil, en ağır vuruş, alan hasarı',
    levels: [
      { cost: 125, range: 112, dmg: [16, 26], rate: 3.0, splash: 54, perk: 'Ağır gülle, geniş alan hasarı' },
      { cost: 220, range: 120, dmg: [38, 60], rate: 2.9, splash: 62, perk: 'Daha ağır gülle, daha geniş patlama' },
      { cost: 320, range: 128, dmg: [66, 98], rate: 2.7, splash: 72, perk: 'Sarsıcı gülle: %30 şansla 0.6 sn sersemletir' },
    ],
    abilities: [
      // Ceset Mancınığı: menzildeki cesedi cephane yapar · Kara Veba: vurduğu düşman ölünce veba yanındakilere bulaşır
      // necro (10 Eki, Caner): bir seferde n zombi cesedi atar; cesetler çarptığını savurur, sonra veba saçan zombi olarak kalkar (hp, zdmg, dps vuruş zehri, life sn)
      { id: 'corpse', name: 'Ceset Mancınığı', desc: (r) => `Kule Ceset Mancınığına dönüşür: veba yerine bir seferde ${r.n} zombi cesedi fırlatır · Cesetler çarptığı düşmanları savurur, sonra ayağa kalkıp ${r.life} sn savaşır, vuruşları veba bulaştırır`,
        ranks: [{ cost: 170, mult: 1.6, n: 2, hp: 70, zdmg: [5, 9], dps: 4, life: 10 }, { cost: 230, mult: 1.9, n: 3, hp: 90, zdmg: [7, 11], dps: 6, life: 12 }, { cost: 290, mult: 2.3, n: 3, hp: 120, zdmg: [9, 14], dps: 8, life: 15 }] },
      { id: 'plague', name: 'Kara Veba', desc: (r) => `Kule Kara Veba Kazanına dönüşür: mor-yeşil veba, daha büyük gaz bulutu · Vurulanlar vebalı olur (saniyede ${r.dps} zehir): vebalı ölünce veba yanındakilere bulaşır`,
        ranks: [{ cost: 200, dps: 7 }, { cost: 260, dps: 12 }, { cost: 320, dps: 18 }] },
    ],
  },
};
const TOWER_ORDER = ['archer', 'barracks', 'mage', 'artillery'];
const SELL_RATIO = 0.6;

// speed: px/sn (ağır, tok bir tempo için düşük tutulur), armor/mr: 0..1 hasar azaltma, lives: kaçarsa giden can
const ENEMIES = {
  goblin:  { name: 'Goblin',        hp: 25,   speed: 25, armor: 0,    mr: 0,   gold: 4,   dmg: [1, 3],   rate: 1,   lives: 1, r: 8 },
  wolf:    { name: 'Kurt',          hp: 37,   speed: 42, armor: 0,    mr: 0,   gold: 5,   dmg: [1, 3],   rate: 1,   lives: 1, r: 8 },
  // ranged: menzilli saldırı (yalnız kahramanlara; yol dışında duran kahramanları da vurur). r menzil, rate sn
  bandit:  { name: 'Haydut',        hp: 86,   speed: 24, armor: 0,    mr: 0,   gold: 9,   dmg: [4, 8],   rate: 1,   lives: 1, r: 9, ranged: { r: 95, dmg: [5, 9], rate: 3.2, proj: 'knife' } },
  orc:     { ranged: { r: 105, dmg: [7, 12], rate: 1.6, proj: 'axe', ammo: 3, any: true }, name: 'Ork',           hp: 99,   speed: 19, armor: 0.3,  mr: 0,   gold: 11,   dmg: [3, 7],   rate: 1,   lives: 1, r: 10 },
  bat:     { name: 'Yarasa',        hp: 37,   speed: 33, armor: 0,    mr: 0,   gold: 7,   dmg: [0, 0],   rate: 1,   lives: 1, r: 8, flying: true },
  shaman:  { name: 'Şaman',         hp: 108,   speed: 20, armor: 0,    mr: 0.6, gold: 15,  dmg: [2, 4],   rate: 1,   lives: 1, r: 9, heals: true, ranged: { r: 125, dmg: [8, 13], rate: 2.6, proj: 'hex' } },
  knight:  { name: 'Kara Şövalye',  hp: 292,  speed: 16, armor: 0.75, mr: 0,   gold: 28,  dmg: [8, 14],  rate: 1.2, lives: 1, r: 11 },
  troll:   { name: 'Dağ Trolü',     hp: 1950, speed: 11, armor: 0.3,  mr: 0.2, gold: 200, dmg: [30, 50], rate: 2,   lives: 5, r: 18, boss: true },
};

// Kahramanlar: aynı anda en fazla 2 tanesi savaşa çıkar. Bölüm içinde seviye atlarlar (en fazla 6);
// seviye 2-6 arasında her seviyede 1 yetenek puanı kazanılır. Yetenek ağacının iki yolu vardır, her yolda 3 yetenek
// sırayla açılır; 5 puanla 6 yeteneğin hepsi alınamaz, oyuncu hangi yola ağırlık vereceğini seçer.
// unlock: kahramanın açılması için bitirilmesi gereken bölüm numarası (null: baştan açık).
const HERO_MAX = 4;
const HEROES = {
  commander: {
    name: 'Komutan', role: 'Yakın dövüş · Lider', sprite: 'hero', h: 29, aura: '255,210,90',
    hp: 320, dmg: [12, 20], armor: 0.3, rate: 1, speed: 80, respawn: 15, regen: 10, engage: 70, unlock: null,
    paths: [
      { name: 'Kalkan Yolu', col: '#6ab4ff', skills: [
        { id: 'bash',  name: 'Kalkan Darbesi', cd: 7,  desc: 'Hedefi 2 sn sersemletir, ek hasar verir' },
        { id: 'cry',   name: 'Savaş Narası',   cd: 16, desc: 'Yakındaki askerleri iyileştirir, 6 sn hasarlarını %50 artırır' },
        { id: 'iron',  name: 'Demir Duruş', passive: true, desc: 'Kalıcı: +%25 zırh ve iki kat can yenilenmesi' },
      ] },
      { name: 'Kılıç Yolu', col: '#ff8a4a', skills: [
        { id: 'whirl',  name: 'Kasırga',          cd: 10, desc: 'Etrafındaki tüm düşmanlara hasar verir' },
        { id: 'bolt',   name: 'Yıldırım',         cd: 12, desc: '4 düşmana zincirleme yıldırım (uçanlar dahil)' },
        { id: 'charge', name: 'Kahraman Hamlesi', cd: 18, desc: 'Kaleye en yakın düşmana atılıp ağır darbe vurur' },
      ] },
    ],
  },
  zeynep: {
    name: 'Zeynep', role: 'Okçu · Çok uzun menzil', sprite: 'hero_zeynep', h: 29, aura: '140,255,160',
    hp: 200, dmg: [10, 15], armor: 0.1, rate: 0.9, speed: 85, respawn: 13, regen: 8, engage: 60, ranged: 215, proj: 'harrow', splash: 26, unlock: 2,
    paths: [
      { name: 'Patlayıcı Oklar', col: '#ffb347', skills: [
        { id: 'volley',    name: 'Ok Yağmuru',    cd: 10, desc: 'Kalabalığın üstüne 12 ok yağdırır (alan hasarı)' },
        { id: 'blastarrow',name: 'Patlayan Ok',   cd: 8,  desc: 'Çarptığı yerde büyük patlama yapan ok' },
        { id: 'fireaim',   name: 'Ateşli Uçlar', passive: true, desc: 'Kalıcı: okların alan hasarı %60 büyür ve yakar' },
      ] },
      { name: 'Keskin Göz', col: '#9fe8ff', skills: [
        { id: 'multishot', name: 'Çoklu Atış',    cd: 7,  desc: 'Aynı anda 4 farklı düşmana ok atar' },
        { id: 'pierce',    name: 'Delici Atış',   cd: 11, desc: 'Yol boyunca bütün düşmanları delip geçen güçlü ok' },
        { id: 'eagle',     name: 'Kartal Gözü', passive: true, desc: 'Kalıcı: +%20 menzil, %25 kritik vuruş' },
      ] },
    ],
  },
};
const HERO_ORDER = ['commander', 'zeynep'];

// Paralı askerler: ilk dalgadan sonra kale her dakika (every sn) kapısından count asker çıkarır. Yol boyunca
// yavaşça yürürler (march), ilk karşılaştıkları düşmanla dövüşürler; düşman yoksa kaleden guard px ötede nöbet tutarlar.
// life: en çok kaç sn kalırlar (sonra çekilip giderler). first: ilk çıkışa kadar geçen süre.
const MERCS = { every: 60, first: 20, count: 2, hp: 120, dmg: [7, 11], armor: 0.25, life: 90, march: 48, guard: 170 };
// Kale okçuları: kale de ok atar; kaleye dokunup yükseltilir (3 seviye, her seviyede bir okçu daha).
// rate: her okçunun kendi atış aralığı (sn). spots: okçuların durduğu kule tepeleri (kale görselinde oran olarak).
const CASTLE = {
  range: 150,
  spots: [[0.492, 0.6], [0.867, 0.43], [0.14, 0.44]],
  levels: [
    { title: 'Kale Okçuları',    dmg: [5, 8],   rate: 1.4, archers: 1, perk: 'Kale bir okçuyla kendini savunur' },
    { title: 'Kale Nişancıları', cost: 180, dmg: [8, 12],  rate: 1.2, archers: 2, perk: 'İki okçu, daha sert oklar' },
    { title: 'Kale Muhafızları', cost: 280, dmg: [11, 17], rate: 1.0, archers: 3, crit: 0.15, perk: 'Üç usta okçu, %15 kritik vuruş' },
  ],
};
// Kahraman gücü: takımdaki her kahramanın sol altta kendi düğmesi vardır; dokunup haritada hedef seçilir.
// r: etki yarıçapı, cd: bekleme (sn), dmg: tek vuruş hasarı (kahraman seviyesiyle %15 artar).
const HERO_ULT = {
  commander: { name: 'Kılıç Yağmuru',      cd: 55, r: 62, dmg: [20, 28], n: 9, stun: 1, desc: 'Gökten 9 kılıç saplanır: hasar ve 1 sn sersemletme' },
  zeynep:    { name: 'Zehirli Ok Yağmuru', cd: 55, r: 70, dmg: [10, 15], n: 22, poison: 9, poisonT: 5, desc: '22 zehirli ok yağar, vurulanlar 5 sn zehirlenir' },
};

// Hava: bölümde weather: 'rain' | 'snow' | 'sand' | 'night'. speed: tüm birimlerin (düşman, asker, kahraman) yürüme hızı çarpanı.
// rain.lightning: iki şimşek arası süre aralığı (sn).
// sand: kum fırtınası (range: kule menzili çarpanı), night: gece (karanlık; kuleler, kale ve kahramanlar ışık saçar)
const WEATHER = {
  rain: { speed: 1, lightning: [5, 12] },
  snow: { speed: 0.8 },
  sand: { speed: 1, range: 0.85 },
  night: { speed: 1 },
};

// Dalga: { t: tür, n: adet, gap: sn aralık, at: dalga başından gecikme, p: yol no }
// paths: önce girişler, sonra alternatif kollar; routes: { giriş: [kullanabileceği yollar] } (düşmanlar kollara sırayla dağılır).
// Kale kendiliğinden ilk yolun bittiği yere, kapısı tam yolun ucuna gelecek şekilde konur (bütün yollar orada biter).
// plots: kule arsaları; tools/arsa-uret.js yola göre otomatik yerleştirir. Yolun çizilen kenarına taşmasın: __game.plotAudit() denetler (true: düzeltir).
// 15 bölümün yol ve arsa düzeni (oynanış sırasıyla)
const LEVELS = [
  { paths: [[[-40,250],[110,250],[210,170],[340,150],[450,210],[470,310],[400,390],[470,460],[610,450],[700,400],[760,370],[862,290]]], plots: [[514,384],[316,216],[796,432],[382,258],[88,150],[598,375],[238,246],[691,315],[388,498]] },
  { paths: [[[420,-40],[420,70],[300,110],[170,160],[180,250],[330,280],[520,240],[620,170],[690,230],[640,320],[480,350],[400,415],[540,480],[690,450],[770,390],[862,300]]], plots: [[544,408],[310,204],[742,318],[478,174],[640,396],[352,348],[394,192],[772,252],[88,234],[382,498]] },
  { paths: [[[-40,120],[150,120],[330,100],[520,120],[640,170],[650,250],[560,290],[400,280],[260,300],[200,327],[270,355],[491,470],[600,450],[730,420],[862,320]]], plots: [[508,222],[292,222],[520,402],[712,348],[400,348],[190,210],[442,174],[610,378],[106,222],[238,420],[808,462]] },
  { paths: [[[-40,330],[100,330],[200,300],[300,200],[450,170],[580,210],[650,310],[740,380],[862,300]],[[-40,330],[100,330],[200,300],[300,379],[467,440],[580,410],[650,310],[740,380],[862,300]]], plots: [[544,324],[316,294],[748,288],[202,402],[460,312],[670,426],[106,228],[400,240],[802,438],[382,492],[520,258]], routes: {"0":[0,1]} },
  { paths: [[[-40,387],[120,387],[230,360],[330,300],[460,290],[560,330],[660,350],[750,360],[862,280]],[[560,-40],[560,80],[440,120],[340,180],[330,300],[460,290],[560,330],[660,350],[750,360],[862,280]]], plots: [[424,216],[340,378],[712,288],[514,204],[202,294],[664,420],[106,288],[430,360],[622,156],[796,420],[244,222]] },
  { paths: [[[-40,130],[150,130],[300,180],[430,270],[560,370],[680,420],[760,390],[862,300]],[[-40,387],[150,387],[300,350],[430,270],[560,170],[660,160],[700,250],[690,330],[760,390],[862,300]]], plots: [[586,300],[298,270],[790,456],[112,264],[604,234],[418,366],[214,270],[700,486],[430,174],[862,414],[484,408],[772,210]] },
  { paths: [[[380,-40],[380,80],[260,130],[170,220],[220,320],[360,340],[480,280],[600,250],[680,320],[760,340],[862,260]],[[600,580],[600,470],[650,400],[680,320],[760,340],[862,260]]], plots: [[580,336],[316,228],[691,228],[526,396],[394,186],[748,408],[262,408],[130,138],[718,474],[460,144],[175,378]] },
  { paths: [[[-40,220],[120,220],[220,260],[330,180],[470,150],[600,180],[680,260],[700,350],[770,380],[862,300]],[[520,-40],[520,60],[470,150],[600,180],[680,260],[700,350],[770,380],[862,300]],[[-40,220],[120,220],[220,260],[330,340],[480,380],[620,390],[700,350],[770,380],[862,300]]], plots: [[562,288],[370,246],[865,408],[184,324],[460,252],[712,438],[100,318],[226,168],[448,444],[802,444],[658,132],[244,372]], routes: {"0":[0,2]} },
  { paths: [[[-40,250],[120,250],[220,170],[340,160],[420,230],[440,300],[560,300],[680,360],[760,370],[862,290]],[[560,-40],[560,80],[490,130],[420,230],[440,300],[560,300],[680,360],[760,370],[862,290]],[[520,580],[520,480],[620,440],[680,360],[760,370],[862,290]]], plots: [[508,228],[718,438],[304,225],[538,366],[100,150],[691,285],[586,186],[346,288],[238,264],[454,408],[802,432],[88,354]] },
  { paths: [[[-40,320],[90,320],[160,220],[270,140],[430,110],[590,130],[690,200],[700,300],[610,390],[470,420],[425,470],[500,500],[660,490],[770,430],[862,330]]], plots: [[598,276],[280,216],[808,492],[502,180],[448,354],[70,198],[364,186],[556,336],[580,210],[868,444],[226,276],[352,498]] },
  { paths: [[[340,-40],[340,80],[220,140],[180,230],[300,270],[450,250],[520,290],[620,250],[700,320],[770,380],[862,300]],[[461,580],[461,480],[340,385],[320,360],[450,330],[520,290],[620,250],[700,320],[770,380],[862,300]]], plots: [[508,384],[328,198],[610,336],[244,336],[772,282],[400,162],[268,420],[526,204],[832,432],[130,132],[556,444],[664,390]] },
  { paths: [[[-40,200],[100,200],[200,250],[320,180],[460,150],[580,200],[620,300],[700,400],[780,410],[862,330]],[[640,-40],[640,80],[580,200],[620,300],[700,400],[780,410],[862,330]],[[-40,200],[100,200],[200,250],[320,330],[470,370],[600,420],[700,400],[780,410],[862,330]]], plots: [[544,324],[340,252],[838,459],[508,252],[160,318],[694,474],[424,246],[76,294],[220,156],[778,480],[682,234]], routes: {"0":[0,2]} },
  { paths: [[[-40,300],[120,300],[220,230],[350,200],[480,240],[560,320],[680,380],[770,380],[862,300]],[[400,-40],[400,90],[330,140],[350,200],[480,240],[560,320],[680,380],[770,380],[862,300]],[[640,580],[640,470],[680,380],[770,380],[862,300]],[[-40,300],[120,300],[220,370],[360,410],[500,400],[560,320],[680,380],[770,380],[862,300]]], plots: [[412,294],[244,300],[691,300],[538,462],[472,153],[124,402],[748,456],[328,288],[118,198],[634,267],[220,156],[832,432],[382,480]], routes: {"0":[0,3]} },
  { paths: [[[-40,160],[130,160],[240,120],[380,140],[480,220],[560,300],[680,370],[770,380],[862,300]],[[480,580],[480,480],[400,420],[380,300],[560,300],[680,370],[770,380],[862,300]],[[-40,160],[130,160],[240,120],[260,230],[380,300],[560,300],[680,370],[770,380],[862,300]],[[480,580],[480,480],[600,450],[680,370],[770,380],[862,300]]], plots: [[514,372],[364,216],[691,291],[166,252],[706,450],[577,207],[292,342],[340,498],[82,264],[796,444],[520,153],[307,408],[640,255],[868,408]], routes: {"0":[0,2],"1":[1,3]} },
  { paths: [[[-40,240],[120,240],[230,170],[380,150],[520,190],[600,280],[700,360],[770,370],[862,290]],[[640,-40],[640,80],[560,130],[520,190],[600,280],[700,360],[770,370],[862,290]],[[435,580],[435,480],[520,440],[620,430],[700,360],[770,370],[862,290]],[[-40,240],[120,240],[230,320],[360,360],[480,340],[600,280],[700,360],[770,370],[862,290]]], plots: [[580,366],[274,252],[472,264],[736,294],[124,342],[634,198],[352,432],[388,240],[724,438],[112,138],[712,150],[652,492],[808,432]], routes: {"0":[0,3]} },
];

// Sefer 2 (Cadı Avı) yol ve arsa düzeni: aynı biçim; data.js sonunda LEVELS'a eklenir (arsa-uret.js sırayla yazar)
const LEVELS2_GEO = [
  { paths: [[[-40,300],[120,300],[220,210],[360,180],[460,240],[450,340],[540,420],[680,410],[760,340],[862,310]]], plots: [[322,252],[586,354],[778,426],[100,198],[364,312],[556,492],[250,288],[772,270],[106,402],[538,294],[718,474],[436,132]] },
  { paths: [[[300,-40],[300,80],[180,150],[150,260],[260,330],[400,300],[520,220],[640,240],[660,340],[580,430],[690,470],[790,400],[862,320]]], plots: [[562,336],[286,222],[742,342],[478,336],[796,492],[184,378],[352,174],[544,498],[742,270],[94,144],[274,402],[574,150]] },
  { paths: [[[-40,180],[130,180],[250,250],[380,230],[500,300],[620,330],[740,330],[862,300]],[[-40,387],[130,387],[250,370],[380,390],[500,300],[620,330],[740,330],[862,300]]], plots: [[346,312],[118,288],[514,378],[742,402],[508,222],[268,180],[760,264],[340,462],[598,396],[460,432],[826,420],[352,162]] },
  { paths: [[[-40,387],[100,387],[200,340],[180,230],[280,150],[420,150],[520,230],[480,330],[580,410],[720,410],[790,340],[862,300]]], plots: [[622,348],[292,222],[100,288],[424,234],[808,432],[592,282],[274,288],[712,306],[382,294],[232,420],[616,486],[886,402]] },
  { paths: [[[-40,150],[140,150],[250,220],[400,220],[520,160],[650,190],[700,280],[780,330],[862,300]],[[-40,387],[140,387],[260,330],[400,350],[520,430],[640,420],[700,350],[780,330],[862,300]]], plots: [[562,306],[202,276],[754,402],[430,288],[100,276],[760,234],[502,252],[292,396],[514,498],[304,156],[706,462],[586,240]] },
  { paths: [[[480,-40],[480,70],[360,120],[240,180],[200,290],[300,360],[460,330],[580,250],[700,230],[760,320],[700,420],[790,440],[862,340]]], plots: [[340,252],[652,342],[472,198],[832,498],[538,156],[244,414],[424,258],[694,498],[178,132],[772,192],[886,438],[172,378]] },
  { paths: [[[-40,240],[90,240],[160,140],[300,110],[420,170],[400,280],[300,350],[350,391],[500,460],[620,390],[640,280],[740,250],[862,300]]], plots: [[280,204],[712,330],[448,366],[700,402],[208,246],[532,372],[112,336],[346,474],[490,138],[796,414],[508,306],[256,420]] },
  { paths: [[[260,-40],[260,90],[380,170],[520,170],[640,250],[750,310],[862,300]],[[435,580],[435,470],[435,400],[520,400],[640,330],[750,310],[862,300]]], plots: [[556,294],[724,378],[472,288],[328,228],[532,468],[760,234],[178,144],[682,192],[244,210],[796,414],[328,420],[388,282]] },
  { paths: [[[-40,330],[120,330],[200,240],[320,180],[460,200],[540,290],[460,380],[560,460],[700,440],[760,360],[862,310]],[[-40,330],[120,330],[200,240],[320,180],[460,200],[600,170],[700,240],[760,360],[862,310]]], plots: [[604,348],[418,264],[808,432],[292,270],[616,264],[88,234],[394,330],[754,492],[238,324],[472,498],[688,132],[154,420]], routes: {"0":[0,1]} },
  { paths: [[[-40,140],[150,140],[260,200],[250,300],[140,380],[220,409],[380,409],[470,370],[580,300],[700,330],[780,330],[862,300]]], plots: [[310,348],[130,234],[598,372],[754,396],[394,330],[736,258],[112,306],[526,420],[298,132],[340,486],[70,414],[838,420]] },
  { paths: [[[-40,200],[140,200],[260,260],[400,260],[540,300],[680,330],[862,300]],[[400,-40],[400,90],[460,180],[540,300],[680,330],[862,300]],[[-40,393],[140,393],[300,410],[440,400],[540,300],[680,330],[862,300]]], plots: [[400,330],[568,384],[118,294],[346,192],[730,270],[238,336],[580,228],[304,132],[754,414],[340,480],[514,438],[670,402]] },
  { paths: [[[620,-40],[620,70],[500,110],[360,110],[230,170],[200,270],[300,340],[440,330],[560,380],[660,450],[760,400],[862,320]]], plots: [[334,228],[670,372],[484,216],[790,468],[460,414],[640,174],[388,174],[208,378],[532,450],[742,330],[154,144],[706,132]] },
  { paths: [[[-40,260],[100,260],[180,180],[300,140],[400,200],[380,300],[260,350],[300,355],[491,470],[560,400],[600,300],[700,250],[790,280],[862,310]]], plots: [[268,270],[454,372],[712,318],[178,324],[670,378],[352,480],[82,144],[472,306],[754,396],[442,132],[586,498],[106,360]] },
  { paths: [[[-40,160],[120,160],[240,100],[380,120],[480,200],[600,250],[720,320],[862,300]],[[435,580],[435,470],[435,420],[460,400],[600,360],[720,320],[862,300]]], plots: [[538,306],[724,396],[298,168],[532,462],[742,252],[226,204],[460,270],[124,258],[370,204],[808,420],[334,420],[640,420]] },
  { paths: [[[-40,300],[110,300],[220,260],[340,280],[460,300],[600,300],[740,310],[862,300]],[[300,-40],[300,90],[400,180],[460,300],[600,300],[740,310],[862,300]],[[435,580],[435,460],[435,400],[460,300],[600,300],[740,310],[862,300]]], plots: [[532,378],[256,192],[502,222],[742,390],[346,354],[94,204],[532,450],[766,246],[208,132],[118,396],[616,372],[250,330]] },
];

// 10 Eki: her sefer 20 bölüm. Her bölgenin finalinden önce eklenen yeni bölümlerin yol ve arsa düzeni
// (arsalar arsa-uret.js algoritmasıyla bir kez hesaplandı; arsa-uret.js metin sırasıyla yazdığı için bunları atlamaz, dikkat)
const LEVELS_EK1_GEO = [
  { paths: [[[-40,180],[130,180],[250,250],[390,220],[520,150],[650,170],[700,260],[620,350],[480,380],[470,450],[600,480],[740,430],[862,320]]], plots: [[556,270],[268,180],[772,300],[478,300],[766,498],[112,276],[412,498],[394,294],[832,456],[718,132],[190,306],[394,372]] },
  { paths: [[[-40,330],[110,330],[220,280],[340,320],[460,380],[600,360],[700,300],[770,320],[862,300]],[[340,-40],[340,80],[440,130],[540,120],[640,170],[700,240],[700,300],[770,320],[862,300]]], plots: [[616,258],[244,354],[508,264],[730,384],[352,204],[100,228],[772,210],[424,252],[274,162],[562,204],[496,450],[148,420]] },
  { paths: [[[-40,240],[120,240],[230,180],[360,200],[440,280],[560,300],[680,350],[770,360],[862,290]],[[420,-40],[420,80],[330,130],[230,180],[360,200],[440,280],[560,300],[680,350],[770,360],[862,290]]], plots: [[304,258],[712,288],[454,180],[226,288],[568,378],[100,144],[790,426],[484,360],[514,132],[94,342],[358,312],[706,426]] },
  { paths: [[[-40,150],[140,150],[260,210],[400,190],[520,240],[600,330],[700,380],[780,370],[862,300]],[[560,580],[560,480],[520,400],[600,330],[700,380],[780,370],[862,300]]], plots: [[652,438],[448,288],[178,252],[712,306],[364,264],[94,246],[640,264],[460,498],[796,438],[268,138],[430,354],[868,396]] },
  { paths: [[[-40,280],[120,280],[240,220],[380,210],[500,260],[600,320],[700,370],[780,360],[862,300]],[[460,-40],[460,80],[400,150],[380,210],[500,260],[600,320],[700,370],[780,360],[862,300]],[[680,580],[680,480],[700,370],[780,360],[862,300]]], plots: [[508,180],[784,438],[316,276],[700,294],[94,186],[400,300],[586,402],[316,138],[124,378],[508,348],[856,402],[568,132]] },
];
const LEVELS_EK2_GEO = [
  { paths: [[[-40,260],[120,260],[220,330],[360,350],[470,280],[560,200],[680,210],[740,300],[862,300]],[[300,-40],[300,90],[420,170],[560,200],[680,210],[740,300],[862,300]]], plots: [[586,270],[364,264],[118,366],[646,318],[292,228],[772,204],[532,324],[232,168],[340,420],[88,156],[790,378],[196,396]] },
  { paths: [[[-40,200],[100,200],[200,280],[330,330],[470,320],[560,250],[640,180],[730,220],[760,310],[862,300]],[[620,580],[620,470],[700,400],[760,310],[862,300]]], plots: [[658,318],[358,264],[106,318],[802,384],[586,366],[256,228],[532,420],[730,132],[772,450],[364,402],[202,150],[526,174]] },
  { paths: [[[-40,330],[130,330],[230,260],[340,170],[480,140],[600,190],[640,290],[560,370],[600,450],[720,430],[862,330]]], plots: [[682,360],[514,228],[154,228],[394,222],[748,318],[70,240],[520,300],[334,270],[742,498],[532,492],[274,318],[826,450]] },
  { paths: [[[-40,170],[140,170],[260,240],[380,300],[520,310],[620,250],[720,300],[862,300]],[[420,-40],[420,90],[500,170],[620,250],[720,300],[862,300]],[[540,580],[540,470],[600,400],[720,300],[862,300]]], plots: [[478,246],[736,372],[166,270],[478,384],[724,222],[388,204],[82,264],[688,432],[334,150],[652,186],[640,498],[820,372]] },
  { paths: [[[-40,240],[120,240],[240,300],[380,330],[500,280],[560,190],[680,160],[740,240],[760,330],[862,310]],[[300,-40],[300,90],[420,150],[560,190],[680,160],[740,240],[760,330],[862,310]],[[660,580],[660,470],[700,400],[760,330],[862,310]]], plots: [[658,294],[394,228],[274,222],[796,402],[118,342],[574,312],[772,468],[232,162],[766,132],[394,396],[76,138],[880,378]] },
];

// ----- seferler -----
// Bölümler seferlere ayrılır; her sefer bir ülkede geçer ve haritada kendi sayfası olur.
// Bir sefer, bir önceki seferin son bölümü bitince açılır. bg: harita arka planı.
// nodes: bölüm haritasında bölüm bayraklarının yeri (960x540 ekran koordinatı; harita görseli ekranı kaplar).
// Bayraklar bu sırayla, aralarındaki noktalı patikayla birbirine bağlanır.
const EPISODES = [];

// ----- 2. sefer: Kızılkum düşmanları -----
// Özel yetenekler: dismount (ölünce yerine yaya çıkar), burrow (up sn yüzeyde, down sn kumun altında:
// gömülüyken vurulamaz ve durdurulamaz, daha hızlı ilerler), revive (bir kez yarı canla dirilir; top/göktaşı
// gibi patlama hasarıyla ölürse dirilmez), blink (ileri ışınlanır), ward (yakındaki dostlarına kısa kalkan),
// stoneskin (sersemlemez, en fazla %20 yavaşlar)
Object.assign(ENEMIES, {
  raider:   { name: 'Çöl Akıncısı',  h: 27, hp: 110, speed: 26, armor: 0,    mr: 0,   gold: 11,  dmg: [6, 10],  rate: 1,   lives: 1, r: 9 },
  scorpion: { name: 'Kum Akrebi',    h: 23, hp: 120, speed: 30, armor: 0.5, mr: 0,   gold: 14, dmg: [5, 9],   rate: 0.9, lives: 1, r: 9 },
  vulture:  { name: 'Akbaba',        h: 27, hp: 60,  speed: 40, armor: 0,    mr: 0,   gold: 11,  dmg: [0, 0],   rate: 1,   lives: 1, r: 9, flying: true },
  camel:    { name: 'Deve Süvarisi', h: 37, hp: 260, speed: 30, armor: 0.1,  mr: 0,   gold: 22, dmg: [8, 14],  rate: 1.1, lives: 2, r: 12, dismount: 'raider' },
  sandworm: { name: 'Kum Solucanı',  h: 31, hp: 200, speed: 22, armor: 0.2,  mr: 0,   gold: 20, dmg: [9, 14],  rate: 1.2, lives: 1, r: 11, burrow: { up: 4, down: 2, speed: 1 } },
  mummy:    { name: 'Mumya',         h: 28, hp: 280, speed: 15, armor: 0.1,  mr: 0.2, gold: 21, dmg: [8, 12],  rate: 1.2, lives: 1, r: 10, revive: 0.5 },
  djinn:    { name: 'Kum Cini',      h: 32, hp: 150, speed: 30, armor: 0,    mr: 0.35, gold: 24, dmg: [0, 0],   rate: 1,   lives: 1, r: 10, flying: true, blink: { cd: 12, d: 45 }, ward: { cd: 11, r: 75, t: 1.2, n: 3 } },
  golem:    { name: 'Taş Muhafız',   h: 38, hp: 900, speed: 12, armor: 0.8,  mr: 0,   gold: 46, dmg: [18, 28], rate: 1.4, lives: 2, r: 15, stoneskin: true },
});

// ----- bosslar -----
// Her bölümün son dalgasının sonunda bir boss gelir. Görselleri temel düşman görselinin yeniden renklendirilmiş,
// büyütülmüş ve taçlandırılmış hâlidir. ab: özel yetenekler (summon: asker çağırır, howl: yakındakileri hızlandırır,
// slam: yere vurup askerleri sersemletir, shield: kısa süre hasar almaz, heal: yakındakileri iyileştirir,
// blink: yolda ileri ışınlanır, regen: sürekli can yeniler).
Object.assign(ENEMIES, {
  goblin_king:  { name: 'Goblin Kral', base: 'goblin', h: 40, hp: 700, speed: 14.2, armor: 0.15, mr: 0.1, gold: 80, dmg: [10, 18], rate: 1.2, lives: 5, r: 14, boss: true, chief: true, hpK: 1,
    desc: 'Goblin çağırır, kulelere bomba atıp susturur, savaş narasıyla hızlandırır', ab: { summon: { t: 'goblin', n: 3, cd: 11 }, bomb: { cd: 10, stun: 3, r: 170 }, howl: { cd: 14, r: 110 } } },
  wolf_alpha:   { name: 'Kara Kurt Alfa', base: 'wolf', h: 38, hp: 850, speed: 22.5, armor: 0.1, mr: 0.1, gold: 90, dmg: [12, 20], rate: 0.9, lives: 5, r: 14, boss: true, chief: true, hpK: 0.8,
    desc: 'Ulur (yakındakiler hızlanır), sürüsünü çağırır, yolda ileri atılır', ab: { howl: { cd: 10, r: 110 }, summon: { t: 'wolf', n: 3, cd: 12 }, pounce: { cd: 8, d: 70 } } },
  orc_warlord:  { ranged: { r: 130, dmg: [20, 30], rate: 2.4, proj: 'axe', ammo: 3, any: true }, name: 'Ork Savaş Ağası', base: 'orc', h: 50, hp: 1500, speed: 11.2, armor: 0.4, mr: 0.1, gold: 130, dmg: [20, 32], rate: 1.4, lives: 6, r: 16, boss: true, chief: true, hpK: 1.05,
    desc: 'Yeri dövüp askerleri sersemletir, ork çağırır, öfkelenince 5 sn yarı hasar alır', ab: { slam: { cd: 7, r: 62, stun: 2, dmg: 25 }, summon: { t: 'orc', n: 2, cd: 13 }, rage: { cd: 15, t: 5 } } },
  dark_shaman:  { name: 'Kara Büyücü', base: 'shaman', ranged: { r: 160, dmg: [22, 32], rate: 2.2, proj: 'hex' }, h: 46, hp: 1300, speed: 12, armor: 0.1, mr: 0.7, gold: 140, dmg: [10, 16], rate: 1.2, lives: 6, r: 15, boss: true, chief: true, hpK: 0.95,
    desc: 'Kalkan açar, yakındakileri iyileştirir, haydut çağırır, kara yıldırımla kuleyi susturur', ab: { shield: { cd: 13, t: 3 }, heal: { cd: 7, amt: 70, r: 90 }, summon: { t: 'bandit', n: 2, cd: 13 }, hex: { cd: 11, t: 3.5, r: 190 } } },
  death_knight: { name: 'Ölüm Şövalyesi', base: 'knight', h: 50, hp: 2000, speed: 10.5, armor: 0.7, mr: 0.15, gold: 170, dmg: [22, 34], rate: 1.3, lives: 7, r: 16, boss: true, chief: true, hpK: 1.05,
    desc: 'Işınlanır, haydut çağırır, yakındaki askerlerin canını emer', ab: { blink: { cd: 10, d: 85 }, summon: { t: 'bandit', n: 2, cd: 16 }, drain: { cd: 9, r: 85, dmg: 24 } } },
  troll_king:   { name: 'Troll Kral', base: 'troll', h: 66, hp: 3400, speed: 7.5, armor: 0.35, mr: 0.25, gold: 260, dmg: [35, 55], rate: 2, lives: 8, r: 22, boss: true, chief: true, hpK: 1.15,
    desc: 'Can yeniler, yeri döver, ork çağırır, kulelere kaya fırlatıp sersemletir', ab: { regen: 0.005, slam: { cd: 9, r: 70, stun: 1.5, dmg: 40 }, summon: { t: 'orc', n: 2, cd: 14 }, boulder: { cd: 10, stun: 3, r: 200 } } },
  // Sefer sonu bossu: dev boy, iki bar (önce zırh erir, sonra can). Zırh varken sersemlemez; zırh kırılınca
  // 2. evreye geçer: lejyon çağırır, hızlanır, yetenekleri sıklaşır. Canı yarıya inince ikinci bir lejyon gelir.
  overlord:     { name: 'Kara Lord', base: 'knight', h: 86, hp: 4600, speed: 8.2, armor: 0.35, mr: 0.3, gold: 500, dmg: [45, 70], rate: 1.5, lives: 20, r: 26, boss: true, chief: true, hpK: 1.25,
    plate: 2600, phase2: { speed: 1.3, cd: 0.7 }, legion: [['knight', 2], ['orc', 3], ['bandit', 3], ['bat', 3]],
    desc: 'Son düşman: önce zırhı kırılmalı. Zırhı düşünce öfkelenir ve lejyonunu çağırır', ab: { summon: { t: ['knight', 'orc', 'bandit'], n: 3, cd: 12 }, shield: { cd: 17, t: 2.5 }, slam: { cd: 9, r: 75, stun: 1.5, dmg: 45 }, hex: { cd: 11, t: 3.5, r: 220 }, rage: { cd: 20, t: 4 } } },
});
// Bosslar yalnız gelmez: yanında muhafızlarıyla birlikte yürür
const BOSS_ESCORT = {
  goblin_king: [['goblin', 4]],
  wolf_alpha: [['wolf', 4]],
  orc_warlord: [['orc', 3]],
  dark_shaman: [['shaman', 1], ['bandit', 3]],
  death_knight: [['knight', 2], ['bandit', 2]],
  troll_king: [['orc', 4]],
  overlord: [['knight', 3], ['orc', 3], ['shaman', 1]],
};
// 2. sefer bossları: Çöl Şeyhi, Akrep Kraliçe ve Mumya Kral, Taş Titan (yeniden renklendirilmiş / kendi görselleri),
// Dev Kum Solucanı (kuma dalar), sefer sonu Fırtına Cini (iki bar, kum fırtınası, lejyon)
Object.assign(ENEMIES, {
  raider_chief:   { name: 'Çöl Şeyhi', base: 'raider', h: 42, hp: 1000, speed: 15, armor: 0.2, mr: 0.1, gold: 120, dmg: [16, 26], rate: 1.1, lives: 5, r: 15, boss: true, chief: true, hpK: 0.9,
    desc: 'Akıncı çağırır, savaş narasıyla çevresini hızlandırır, kulelere ateş testisi atıp susturur', ab: { summon: { t: 'raider', n: 3, cd: 11 }, howl: { cd: 13, r: 110 }, bomb: { cd: 11, stun: 3, r: 180 } } },
  scorpion_queen: { name: 'Akrep Kraliçe', h: 46, hp: 1000, speed: 14, armor: 0.55, mr: 0.1, gold: 150, dmg: [18, 28], rate: 1.2, lives: 6, r: 17, boss: true, chief: true, hpK: 1,
    desc: 'Yavru akrep çağırır, kuyruğuyla yere vurup askerleri sersemletir, zehir püskürtür', ab: { summon: { t: 'scorpion', n: 3, cd: 11 }, slam: { cd: 8, r: 64, stun: 1.8, dmg: 30 }, venom: { cd: 10, r: 85, dmg: 22, stun: 1 } } },
  worm_king:      { name: 'Dev Kum Solucanı', h: 54, hp: 1000, speed: 11, armor: 0.3, mr: 0.2, gold: 180, dmg: [26, 40], rate: 1.5, lives: 7, r: 20, boss: true, chief: true, hpK: 1.05,
    burrow: { up: 6, down: 3, speed: 1.8 }, desc: 'Kuma dalar (vurulamaz), çıkarken yeri sarsar, solucan çağırır, kulelere kaya tükürür', ab: { slam: { cd: 9, r: 72, stun: 1.5, dmg: 38 }, summon: { t: 'sandworm', n: 2, cd: 15 }, boulder: { cd: 11, stun: 3, r: 200 } } },
  mummy_king:     { name: 'Mumya Kral', base: 'mummy', h: 46, hp: 1000, speed: 11, armor: 0.25, mr: 0.4, gold: 170, dmg: [22, 34], rate: 1.3, lives: 7, r: 17, boss: true, chief: true, hpK: 1.05, revive: 0.4,
    desc: 'Mumya çağırır, dostlarını iyileştirir, bir kez dirilir (ateşle ölürse dirilmez)', ab: { summon: { t: 'mummy', n: 2, cd: 13 }, heal: { cd: 8, amt: 80, r: 90 }, hex: { cd: 12, t: 3, r: 190 } } },
  golem_titan:    { name: 'Taş Titan', base: 'golem', h: 60, hp: 1000, speed: 8, armor: 0.75, mr: 0.1, gold: 220, dmg: [40, 60], rate: 2, lives: 8, r: 22, boss: true, chief: true, hpK: 1.1, stoneskin: true,
    desc: 'Sersemlemez, yeri döver, kulelere kaya fırlatır, can yeniler', ab: { regen: 0.004, slam: { cd: 9, r: 75, stun: 1.5, dmg: 45 }, boulder: { cd: 10, stun: 3, r: 210 } } },
  storm_djinn:    { name: 'Fırtına Cini', h: 82, hp: 1000, speed: 8.5, armor: 0.3, mr: 0.4, gold: 600, dmg: [45, 70], rate: 1.5, lives: 20, r: 26, boss: true, chief: true, hpK: 1.3, float: true,
    plate: 3000, phase2: { speed: 1.3, cd: 0.7 }, legion: [['djinn', 3], ['mummy', 3], ['raider', 4], ['vulture', 3]],
    desc: 'Sefer sonu: önce zırhı kırılmalı. Kum fırtınası çağırır (kule menzili düşer), lejyon getirir', ab: { summon: { t: ['raider', 'mummy', 'scorpion'], n: 3, cd: 12 }, storm: { cd: 16, t: 6 }, hex: { cd: 11, t: 3.5, r: 220 }, shield: { cd: 17, t: 2.5 }, rage: { cd: 20, t: 4 } } },
});
Object.assign(BOSS_ESCORT, {
  raider_chief: [['raider', 4]], scorpion_queen: [['scorpion', 4]], worm_king: [['sandworm', 2], ['raider', 2]],
  mummy_king: [['mummy', 3]], golem_titan: [['golem', 1], ['raider', 3]], storm_djinn: [['djinn', 2], ['golem', 1], ['mummy', 2]],
});
// =====================================================================================
// DON'T MESS WITH THE NECROMANCER — Sefer 1: Lanetli Sınır (tasarım: tasarim/necromancer-gdd.md)
// Mekanik aynı; kuleler, askerler, düşmanlar, kahramanlar ve bölümler yeni temaya göre. Eski seferlerin verisi
// yukarıda duruyor ama oyunda yalnız bu sefer görünür (LEVELS/EPISODES aşağıda yeniden kurulur).
// =====================================================================================
const NECRO = true;
Object.assign(ENEMIES, {
  // Solarian İmparatorluğu askerleri
  legion:    { name: 'Lejyoner',            h: 30, hp: 60,  speed: 24, armor: 0.15, mr: 0,    gold: 8,  dmg: [2, 5],   rate: 1,   lives: 1, r: 9 },
  solarcher: { name: 'Solarian Okçusu',     h: 30, hp: 45,  speed: 26, armor: 0,    mr: 0,    gold: 9,  dmg: [1, 3],   rate: 1,   lives: 1, r: 9, ranged: { r: 130, dmg: [4, 7], rate: 1.8, proj: 'harrow', any: true, hold: true } },
  gladiator: { name: 'Gladyatör',           h: 31, hp: 120, speed: 30, armor: 0,    mr: 0,    gold: 14, dmg: [6, 10],  rate: 0.8, lives: 1, r: 9 },
  assassin:  { name: 'Suikastçı',           h: 30, hp: 80,  speed: 38, armor: 0,    mr: 0.25, gold: 15, dmg: [5, 9],   rate: 0.8, lives: 1, r: 9, blink: { cd: 9, d: 55 } },
  priest:    { name: 'Savaş Rahibi',        h: 30, hp: 140, speed: 19, armor: 0,    mr: 0.5,  gold: 20, dmg: [2, 4],   rate: 1,   lives: 1, r: 10, heals: true },
  heavy:     { name: 'Ağır Piyade',         h: 33, hp: 380, speed: 14, armor: 0.7,  mr: 0,    gold: 32, dmg: [9, 15],  rate: 1.3, lives: 1, r: 12 },
  cavalry:   { name: 'Solarian Süvarisi',   h: 42, hp: 280, speed: 34, armor: 0.3,  mr: 0,    gold: 28, dmg: [10, 16], rate: 1.1, lives: 2, r: 13 },
  ram:       { name: 'Koçbaşı',             h: 40, hp: 700, speed: 9,  armor: 0.45, mr: 0.1,  gold: 55, dmg: [2, 4],   rate: 2,   lives: 3, r: 16, machine: true },
  catapult:  { name: 'Mancınık Arabası',    h: 40, hp: 420, speed: 12, armor: 0.2,  mr: 0,    gold: 38, dmg: [2, 4],   rate: 2,   lives: 2, r: 14, machine: true,
    desc: 'Durup kulelerimize taş atar, 3 sn susturur', ab: { bomb: { cd: 12, stun: 3, r: 200 } } },
  // yeni birlikler (9 Eki): mevcut görsellerden türer (base + game.js BOSS_LOOK renkleri ve kodla çizilen eşyalar)
  // noblock: iskeletler durduramaz (kemik duvar durdurur). ranged.moving: yürürken atar. split: ölünce dağılır.
  // purify: çevredeki cesetleri yakar, diriltilmiş ölülere vurur. aura: çevredekilere zırh (armor) ya da hız (speed).
  horsearcher: { name: 'Atlı Okçu', base: 'cavalry', h: 42, hp: 220, speed: 30, armor: 0.1, mr: 0, gold: 24, dmg: [4, 7], rate: 1, lives: 2, r: 13, noblock: true,
    ranged: { r: 125, dmg: [5, 9], rate: 1.7, proj: 'harrow', any: true, moving: true } },
  testudo:   { name: 'Testudo Bölüğü', base: 'legion', h: 30, hp: 640, speed: 12, armor: 0.75, mr: 0, gold: 36, dmg: [6, 10], rate: 1.2, lives: 2, r: 15, formation: true, split: ['legion', 3] },
  sunpriest: { name: 'Güneş Rahibesi', base: 'priest', h: 30, hp: 170, speed: 19, armor: 0, mr: 0.55, gold: 24, dmg: [2, 4], rate: 1, lives: 1, r: 10, purify: { r: 95, every: 4, dmg: 22 } },
  signifer:  { name: 'Sancaktar', base: 'legion', h: 31, hp: 150, speed: 21, armor: 0.2, mr: 0, gold: 18, dmg: [3, 6], rate: 1, lives: 1, r: 10, aura: { r: 85, armor: 0.25 }, prop: 'banner' },
  // 1. bölgenin son dört türü (görseller FLUX Kontext ile, Kaggle'da): trample: iskeletleri ezip geçer (kemik duvar durdurur)
  wardog:    { name: 'Savaş Köpeği', h: 15, hp: 70, speed: 46, armor: 0, mr: 0, gold: 6, dmg: [3, 6], rate: 0.7, lives: 1, r: 9 },
  chariot:   { name: 'Savaş Arabası', h: 36, hp: 360, speed: 34, armor: 0.3, mr: 0, gold: 34, dmg: [6, 10], rate: 1, lives: 2, r: 16, noblock: true, machine: true, trample: { dmg: 22, r: 16 } },
  siegetower:{ name: 'Kuşatma Kulesi', h: 62, hp: 1100, speed: 8, armor: 0.45, mr: 0.1, gold: 60, dmg: [2, 4], rate: 2, lives: 3, r: 20, machine: true, noblock: true, split: ['legion', 6] },
  eagle:     { name: 'İmparatorluk Kartalı', h: 24, hp: 95, speed: 31, armor: 0, mr: 0.1, gold: 10, dmg: [0, 0], rate: 1, lives: 1, r: 10, flying: true },
  // leş akbabası: sürüyle uçar; altındaki cesetleri yer (diriltilemez olur) ve kendini iyileştirir
  vulture:   { name: 'Leş Akbabası', h: 33, hp: 120, speed: 27, armor: 0, mr: 0, gold: 11, dmg: [0, 0], rate: 1, lives: 1, r: 11, flying: true, scavenge: { r: 60, every: 2.5, heal: 35 } },
  // savaş fili (mini boss): iskeletleri ezip geçer, sırtındaki okçu yürürken ok atar (ranged.top: okun çıktığı yükseklik, boy oranı)
  elephant:  { name: 'Savaş Fili', h: 70, hp: 1500, speed: 11, armor: 0.35, mr: 0.15, gold: 75, dmg: [14, 22], rate: 1.5, lives: 4, r: 20, noblock: true, noraise: true,
    trample: { dmg: 40, r: 22 }, ranged: { r: 140, dmg: [6, 10], rate: 1.5, proj: 'harrow', any: true, moving: true, top: 0.92 } },
  drummer:   { name: 'Davulcu', h: 32, hp: 110, speed: 22, armor: 0.1, mr: 0, gold: 16, dmg: [2, 4], rate: 1, lives: 1, r: 10, aura: { r: 85, speed: 1.25 }, prop: 'drum' },
  // bölüm sonu komutanları (rütbeli subaylar) ve sefer sonu: General Gloriosus
  centurion:    { name: 'Yüzbaşı Lucius', base: 'legion', h: 40, hp: 700, speed: 15, armor: 0.3, mr: 0.1, gold: 80, dmg: [10, 18], rate: 1.2, lives: 5, r: 14, boss: true, chief: true, hpK: 1,
    desc: 'Lejyoner çağırır, borusuyla çevresini hızlandırır', ab: { summon: { t: 'legion', n: 3, cd: 11 }, howl: { cd: 13, r: 110 } } },
  champion:     { name: 'Arena Şampiyonu Maximus', base: 'gladiator', h: 42, hp: 850, speed: 20, armor: 0.1, mr: 0.1, gold: 90, dmg: [14, 22], rate: 0.9, lives: 5, r: 14, boss: true, chief: true, hpK: 0.9,
    desc: 'Yere vurup askerleri sersemletir, kalabalığı coşturup hızlandırır', ab: { slam: { cd: 8, r: 64, stun: 1.6, dmg: 30 }, howl: { cd: 12, r: 110 } } },
  shadowmaster: { name: 'Gölge Usta', base: 'assassin', h: 40, hp: 900, speed: 20, armor: 0, mr: 0.3, gold: 110, dmg: [12, 20], rate: 0.8, lives: 5, r: 14, boss: true, chief: true, hpK: 0.95,
    desc: 'Gölgeden gölgeye atlar, suikastçı çağırır', ab: { pounce: { cd: 7, d: 70 }, summon: { t: 'assassin', n: 2, cd: 12 } } },
  cavcaptain:   { name: 'Süvari Kaptanı Aurelius', base: 'cavalry', h: 50, hp: 1300, speed: 22, armor: 0.35, mr: 0.1, gold: 140, dmg: [16, 26], rate: 1.1, lives: 5, r: 16, boss: true, chief: true, hpK: 0.75,
    desc: 'Hücumla ileri atılır, lejyoner çağırır, borusuyla hızlandırır', ab: { pounce: { cd: 12, d: 60 }, howl: { cd: 14, r: 110 }, summon: { t: 'legion', n: 2, cd: 16 } } },
  gloriosus:    { name: 'General Gloriosus', h: 60, hp: 3000, speed: 10, armor: 0.4, mr: 0.3, gold: 400, dmg: [30, 48], rate: 1.4, lives: 20, r: 22, boss: true, chief: true, hpK: 1.2,
    desc: 'Kendini çok beğenir. Kalkan açar, lejyon çağırır, kulelere mancınık ateşi yağdırır, öfkelenince yayan saldırır',
    ab: { summon: { t: ['legion', 'heavy', 'gladiator'], n: 3, cd: 11 }, shield: { cd: 16, t: 2.5 }, howl: { cd: 12, r: 130 }, bomb: { cd: 12, stun: 3, r: 220 } } },
});
Object.assign(ENEMIES, {
  hierophant:   { name: 'Başrahip Sollemnis', base: 'priest', h: 42, hp: 800, speed: 13, armor: 0.05, mr: 0.55, gold: 100, dmg: [8, 14], rate: 1.1, lives: 5, r: 14, boss: true, chief: true, hpK: 0.85,
    desc: 'Yakındakileri iyileştirir, kısa süre kalkan açar, rahip ve lejyoner çağırır', ab: { heal: { cd: 8, amt: 60, r: 90 }, shield: { cd: 15, t: 2.5 }, summon: { t: ['priest', 'legion'], n: 2, cd: 13 } } },
  ironwarden:   { name: 'Demir Muhafız Brutus', base: 'heavy', h: 46, hp: 1400, speed: 10, armor: 0.75, mr: 0.05, gold: 150, dmg: [18, 28], rate: 1.4, lives: 6, r: 16, boss: true, chief: true, hpK: 0.9,
    desc: 'Kalkanıyla yeri döver (iskeletler sersemler), öfkelenince yarı hasar alır, ağır piyade çağırır', ab: { slam: { cd: 8, r: 64, stun: 1.6, dmg: 30 }, rage: { cd: 15, t: 4 }, summon: { t: 'heavy', n: 1, cd: 15 } } },
});
Object.assign(BOSS_ESCORT, { hierophant: [['priest', 1], ['legion', 3]], ironwarden: [['heavy', 2]] });
Object.assign(BOSS_ESCORT, { centurion: [['legion', 4]], champion: [['gladiator', 2]], shadowmaster: [['assassin', 3]], cavcaptain: [['cavalry', 2]], gloriosus: [['heavy', 2], ['legion', 4]] });

// Bölümler (Lanetli Sınır, 15 bölüm): Ölü Orman (1-3) → Sisli Bataklık (4-6) → Mezarlık (7-9) → Kara Göl (10-12) → Mortimer'ın Kapısı (13-15).
// Yeni düşman sırası: 3 gladyatör, 6 suikastçı, 7 rahip, 9 ağır piyade, 10 süvari ve koçbaşı, 13 mancınık.
{
  const old = LEVELS.slice(0, 15).map(l => ({ paths: l.paths, plots: l.plots, routes: l.routes }));
  const W_ = (t, n, gap, at) => (at == null ? { t, n, gap } : { t, n, gap, at });
  const L = [
    { name: 'Ölü Orman', theme: 'cursed', gold: 300, bossT: 'centurion', waves: [
      [{ t: 'legion', n: 5, gap: 1.6 }],
      [{ t: 'legion', n: 8, gap: 1.2 }],
      [{ t: 'legion', n: 6, gap: 1.1 }, { t: 'solarcher', n: 3, gap: 2, at: 5 }],
      [{ t: 'legion', n: 8, gap: 0.9 }, { t: 'solarcher', n: 4, gap: 1.5, at: 6 }],
      [{ t: 'legion', n: 10, gap: 0.8 }, { t: 'solarcher', n: 5, gap: 1.2, at: 6 }],
      [{ t: 'solarcher', n: 6, gap: 1 }, { t: 'legion', n: 12, gap: 0.7, at: 4 }],
      [{ t: 'legion', n: 10, gap: 0.8 }, { t: 'solarcher', n: 6, gap: 1, at: 5 }],
      [{ t: 'legion', n: 12, gap: 0.7 }, { t: 'solarcher', n: 6, gap: 1, at: 4 }, { t: 'legion', n: 8, gap: 0.6, at: 12 }],
    ] },
    { name: 'Kuzgun Tepesi', theme: 'cursed', gold: 320, bossT: 'champion', waves: [
      [W_('legion', 6, 1.4)],
      [W_('legion', 6, 1.1), W_('solarcher', 3, 1.8, 4)],
      [W_('solarcher', 4, 1.3), W_('legion', 6, 1, 5)],
      [W_('legion', 8, 0.9), W_('solarcher', 4, 1.3, 6)],
      [W_('legion', 8, 0.9), W_('solarcher', 5, 1.1, 5), W_('legion', 4, 0.8, 12)],
      [W_('solarcher', 6, 1), W_('legion', 10, 0.7, 4)],
      [W_('legion', 10, 0.8), W_('solarcher', 6, 1, 6), W_('gladiator', 2, 2, 12)],
      [W_('legion', 12, 0.7), W_('solarcher', 6, 1, 4), W_('gladiator', 3, 1.6, 10)],
    ] },
    { name: 'Çürük Kökler', theme: 'cursed', gold: 350, bossT: 'centurion', waves: [
      [W_('legion', 6, 1.3)],
      [W_('gladiator', 2, 2), W_('legion', 6, 1, 4)],
      [W_('legion', 8, 0.9), W_('solarcher', 4, 1.2, 5)],
      [W_('gladiator', 4, 1.5), W_('legion', 6, 1, 5)],
      [W_('legion', 10, 0.8), W_('solarcher', 5, 1.1, 6)],
      [W_('gladiator', 5, 1.2), W_('legion', 8, 0.8, 5), W_('solarcher', 4, 1.2, 10)],
      [W_('solarcher', 6, 1), W_('gladiator', 5, 1.2, 4), W_('legion', 10, 0.7, 9)],
      [W_('legion', 12, 0.6), W_('gladiator', 6, 1, 5), W_('solarcher', 6, 1, 11)],
    ] },
    { name: 'Sisli Bataklık', theme: 'bog', gold: 380, weather: 'rain', bossT: 'champion', waves: [
      [{ t: 'legion', n: 6, gap: 1.3 }],
      [{ t: 'gladiator', n: 3, gap: 2 }, { t: 'legion', n: 6, gap: 1, at: 4 }],
      [{ t: 'solarcher', n: 5, gap: 1.2 }, { t: 'legion', n: 6, gap: 1, at: 5 }],
      [{ t: 'gladiator', n: 5, gap: 1.5 }, { t: 'legion', n: 8, gap: 0.9, at: 6 }],
      [{ t: 'legion', n: 10, gap: 0.8 }, { t: 'gladiator', n: 5, gap: 1.2, at: 6 }, { t: 'solarcher', n: 4, gap: 1.2, at: 10 }],
      [{ t: 'gladiator', n: 8, gap: 1 }, { t: 'legion', n: 10, gap: 0.7, at: 6 }, { t: 'solarcher', n: 6, gap: 1, at: 12 }],
      [{ t: 'gladiator', n: 6, gap: 1.2 }, { t: 'solarcher', n: 6, gap: 1, at: 5 }, { t: 'legion', n: 10, gap: 0.7, at: 9 }],
      [{ t: 'legion', n: 12, gap: 0.6 }, { t: 'gladiator', n: 8, gap: 1, at: 5 }, { t: 'solarcher', n: 6, gap: 1, at: 12 }],
    ] },
    { name: 'Sülük Gölcükleri', theme: 'bog', gold: 400, weather: 'rain', hpMul: 0.95, bossT: 'hierophant', waves: [
      [W_('legion', 8, 1.1)],
      [W_('gladiator', 4, 1.6), W_('legion', 6, 1, 5)],
      [W_('solarcher', 5, 1.2), W_('gladiator', 4, 1.4, 5)],
      [W_('legion', 10, 0.8), W_('solarcher', 5, 1.1, 6)],
      [W_('gladiator', 6, 1.1), W_('legion', 8, 0.8, 5), W_('solarcher', 4, 1.2, 10)],
      [W_('legion', 12, 0.7), W_('gladiator', 5, 1.1, 6)],
      [W_('solarcher', 6, 1), W_('gladiator', 7, 1, 4), W_('legion', 10, 0.7, 10)],
      [W_('gladiator', 8, 0.9), W_('legion', 12, 0.6, 5), W_('solarcher', 6, 1, 12)],
    ] },
    { name: 'Batık Köprü', theme: 'bog', gold: 430, weather: 'rain', hpMul: 0.92, bossT: 'centurion', waves: [
      [W_('legion', 8, 1)],
      [W_('assassin', 3, 1.8), W_('legion', 6, 1, 4)],
      [W_('gladiator', 5, 1.3), W_('solarcher', 4, 1.2, 5)],
      [W_('assassin', 5, 1.3), W_('legion', 8, 0.9, 5)],
      [W_('legion', 10, 0.8), W_('gladiator', 5, 1.2, 5), W_('assassin', 4, 1.2, 10)],
      [W_('solarcher', 6, 1), W_('assassin', 6, 1, 5), W_('legion', 8, 0.8, 10)],
      [W_('gladiator', 8, 1), W_('assassin', 6, 1, 5), W_('solarcher', 5, 1.1, 11)],
      [W_('legion', 12, 0.6), W_('assassin', 8, 0.8, 5), W_('gladiator', 6, 1, 11)],
    ] },
    { name: 'Unutulmuş Mezarlık', theme: 'graveyard', gold: 470, hpMul: 0.9, bossT: 'shadowmaster', waves: [
      [{ t: 'legion', n: 8, gap: 1.1 }],
      [{ t: 'assassin', n: 4, gap: 1.6 }, { t: 'legion', n: 6, gap: 1, at: 5 }],
      [{ t: 'priest', n: 2, gap: 3 }, { t: 'gladiator', n: 5, gap: 1.3, at: 2 }],
      [{ t: 'assassin', n: 6, gap: 1.2 }, { t: 'solarcher', n: 5, gap: 1.2, at: 6 }],
      [{ t: 'legion', n: 10, gap: 0.8 }, { t: 'priest', n: 3, gap: 2.5, at: 4 }, { t: 'assassin', n: 5, gap: 1, at: 9 }],
      [{ t: 'gladiator', n: 8, gap: 1 }, { t: 'priest', n: 3, gap: 2, at: 4 }, { t: 'assassin', n: 8, gap: 0.8, at: 10 }],
      [{ t: 'legion', n: 12, gap: 0.6 }, { t: 'assassin', n: 6, gap: 0.9, at: 5 }, { t: 'solarcher', n: 6, gap: 1, at: 12 }],
      [{ t: 'priest', n: 3, gap: 2.5 }, { t: 'gladiator', n: 8, gap: 1, at: 3 }, { t: 'assassin', n: 8, gap: 0.8, at: 9 }, { t: 'legion', n: 10, gap: 0.6, at: 14 }],
    ] },
    { name: 'Kemik Tarlası', theme: 'graveyard', gold: 490, hpMul: 0.9, bossT: 'hierophant', waves: [
      [W_('legion', 8, 1), W_('priest', 1, 2, 6)],
      [W_('assassin', 5, 1.4), W_('gladiator', 4, 1.3, 5)],
      [W_('priest', 2, 3), W_('legion', 8, 0.9, 2), W_('solarcher', 4, 1.2, 8)],
      [W_('gladiator', 6, 1.1), W_('assassin', 6, 1, 6)],
      [W_('legion', 10, 0.8), W_('priest', 3, 2.4, 4), W_('solarcher', 5, 1.1, 9)],
      [W_('assassin', 8, 0.9), W_('gladiator', 6, 1, 5), W_('priest', 2, 2.5, 9)],
      [W_('legion', 12, 0.6), W_('solarcher', 6, 1, 5), W_('assassin', 6, 0.9, 11)],
      [W_('priest', 3, 2.4), W_('gladiator', 8, 0.9, 3), W_('legion', 12, 0.6, 9), W_('assassin', 6, 0.8, 14)],
    ] },
    { name: 'Yıkık Kilise', theme: 'graveyard', gold: 520, hpMul: 0.9, bossT: 'ironwarden', waves: [
      [W_('legion', 8, 1), W_('heavy', 1, 1, 8)],
      [W_('gladiator', 5, 1.3), W_('assassin', 4, 1.4, 4)],
      [W_('heavy', 2, 2.6), W_('priest', 2, 3, 3), W_('legion', 8, 0.9, 6)],
      [W_('solarcher', 6, 1.1), W_('assassin', 6, 1, 5)],
      [W_('heavy', 3, 2.2), W_('legion', 10, 0.8, 3), W_('priest', 2, 2.5, 8)],
      [W_('gladiator', 8, 1), W_('assassin', 6, 0.9, 5), W_('solarcher', 5, 1.1, 10)],
      [W_('heavy', 4, 2), W_('priest', 3, 2.4, 3), W_('legion', 12, 0.6, 8)],
      [W_('heavy', 3, 2.2), W_('gladiator', 8, 0.9, 4), W_('assassin', 8, 0.8, 9), W_('priest', 3, 2.4, 13)],
    ] },
    { name: 'Kara Göl Geçidi', theme: 'blacklake', gold: 560, hpMul: 0.92, bossT: 'cavcaptain', waves: [
      [{ t: 'legion', n: 8, gap: 1 }, { t: 'heavy', n: 1, gap: 1, at: 8 }],
      [{ t: 'cavalry', n: 3, gap: 2 }, { t: 'legion', n: 6, gap: 1, at: 5 }],
      [{ t: 'heavy', n: 3, gap: 2.4 }, { t: 'priest', n: 2, gap: 3, at: 3 }, { t: 'solarcher', n: 5, gap: 1.2, at: 7 }],
      [{ t: 'ram', n: 1, gap: 1 }, { t: 'legion', n: 10, gap: 0.8, at: 2 }, { t: 'gladiator', n: 4, gap: 1.2, at: 10 }],
      [{ t: 'cavalry', n: 5, gap: 1.5 }, { t: 'assassin', n: 6, gap: 1, at: 6 }, { t: 'heavy', n: 2, gap: 3, at: 10 }],
      [{ t: 'heavy', n: 4, gap: 2 }, { t: 'priest', n: 3, gap: 2.5, at: 3 }, { t: 'cavalry', n: 4, gap: 1.6, at: 10 }, { t: 'legion', n: 10, gap: 0.7, at: 14 }],
      [{ t: 'ram', n: 2, gap: 6 }, { t: 'gladiator', n: 8, gap: 0.9, at: 3 }, { t: 'cavalry', n: 4, gap: 1.5, at: 12 }],
      [{ t: 'heavy', n: 4, gap: 2 }, { t: 'cavalry', n: 6, gap: 1.4, at: 4 }, { t: 'priest', n: 3, gap: 2.5, at: 8 }, { t: 'legion', n: 12, gap: 0.6, at: 12 }],
    ] },
    { name: 'Boğulmuşlar İskelesi', theme: 'blacklake', gold: 600, hpMul: 0.68, bossT: 'shadowmaster', waves: [
      [W_('legion', 10, 0.9), W_('cavalry', 2, 2, 8)],
      [W_('heavy', 3, 2.2), W_('solarcher', 6, 1.1, 4)],
      [W_('cavalry', 4, 1.6), W_('assassin', 6, 1, 5)],
      [W_('ram', 1, 1), W_('legion', 10, 0.8, 2), W_('priest', 2, 3, 8)],
      [W_('heavy', 4, 2), W_('gladiator', 6, 1, 4), W_('cavalry', 3, 1.6, 10)],
      [W_('assassin', 8, 0.8), W_('priest', 3, 2.4, 4), W_('solarcher', 6, 1, 9)],
      [W_('ram', 1, 1), W_('cavalry', 5, 1.4, 3), W_('heavy', 3, 2.2, 8), W_('legion', 10, 0.6, 12)],
      [W_('heavy', 5, 1.8), W_('cavalry', 6, 1.3, 5), W_('priest', 3, 2.4, 8), W_('gladiator', 8, 0.8, 12)],
    ] },
    { name: 'Kara Su Değirmeni', theme: 'blacklake', gold: 600, hpMul: 0.72, bossT: 'ironwarden', waves: [
      [W_('legion', 10, 0.9), W_('heavy', 2, 2, 7)],
      [W_('cavalry', 4, 1.5), W_('solarcher', 6, 1, 5)],
      [W_('ram', 1, 1), W_('heavy', 3, 2.2, 2), W_('priest', 2, 3, 6)],
      [W_('assassin', 8, 0.9), W_('gladiator', 6, 1, 6)],
      [W_('cavalry', 6, 1.3), W_('legion', 10, 0.7, 5), W_('priest', 3, 2.4, 10)],
      [W_('heavy', 5, 1.8), W_('solarcher', 8, 0.9, 4), W_('assassin', 6, 0.9, 10)],
      [W_('ram', 2, 6), W_('gladiator', 10, 0.8, 3), W_('cavalry', 5, 1.3, 11)],
      [W_('heavy', 6, 1.6), W_('cavalry', 8, 1.1, 5), W_('priest', 4, 2, 9), W_('legion', 12, 0.6, 13)],
    ] },
    { name: 'Kemik Kapı', theme: 'necrogate', gold: 620, hpMul: 0.64, bossT: 'cavcaptain', waves: [
      [W_('legion', 10, 0.9), W_('solarcher', 4, 1.4, 5)],
      [W_('catapult', 1, 1), W_('gladiator', 6, 1.1, 3), W_('legion', 6, 1, 9)],
      [W_('cavalry', 5, 1.4), W_('priest', 2, 3, 5), W_('assassin', 5, 1, 9)],
      [W_('heavy', 4, 2), W_('solarcher', 8, 0.9, 4)],
      [W_('catapult', 1, 1), W_('ram', 1, 1, 3), W_('legion', 12, 0.6, 4), W_('gladiator', 6, 1, 10)],
      [W_('cavalry', 6, 1.2), W_('heavy', 4, 1.8, 5), W_('priest', 3, 2.4, 9)],
      [W_('assassin', 10, 0.7), W_('gladiator', 8, 0.9, 5), W_('catapult', 1, 1, 10)],
      [W_('heavy', 6, 1.6), W_('cavalry', 6, 1.2, 5), W_('priest', 3, 2.4, 8), W_('legion', 14, 0.6, 12)],
    ] },
    { name: 'Lanet Kuyusu', theme: 'necrogate', gold: 660, hpMul: 0.54, bossT: 'hierophant', waves: [
      [W_('legion', 12, 0.8), W_('solarcher', 6, 1.1, 5)],
      [W_('catapult', 1, 1), W_('heavy', 4, 2, 3), W_('gladiator', 6, 1, 8)],
      [W_('cavalry', 6, 1.3), W_('assassin', 8, 0.9, 5), W_('priest', 2, 3, 10)],
      [W_('ram', 2, 6), W_('legion', 12, 0.6, 2), W_('solarcher', 6, 1, 9)],
      [W_('heavy', 5, 1.8), W_('priest', 3, 2.4, 4), W_('cavalry', 5, 1.3, 10)],
      [W_('catapult', 2, 8), W_('gladiator', 10, 0.8, 3), W_('assassin', 8, 0.8, 10)],
      [W_('ram', 2, 6), W_('heavy', 5, 1.8, 3), W_('cavalry', 6, 1.2, 9), W_('legion', 12, 0.6, 13)],
      [W_('heavy', 6, 1.6), W_('cavalry', 8, 1.1, 5), W_('assassin', 10, 0.7, 10), W_('priest', 4, 2, 13), W_('gladiator', 8, 0.8, 16)],
    ] },
    { name: "Mortimer'ın Kapısı", theme: 'necrogate', gold: 650, hpMul: 0.57, bossT: 'gloriosus', waves: [
      [{ t: 'legion', n: 10, gap: 0.9 }, { t: 'solarcher', n: 4, gap: 1.4, at: 5 }],
      [{ t: 'catapult', n: 1, gap: 1 }, { t: 'heavy', n: 3, gap: 2, at: 3 }, { t: 'legion', n: 8, gap: 0.9, at: 8 }],
      [{ t: 'cavalry', n: 5, gap: 1.4 }, { t: 'assassin', n: 6, gap: 1, at: 6 }, { t: 'priest', n: 2, gap: 3, at: 10 }],
      [{ t: 'ram', n: 1, gap: 1 }, { t: 'heavy', n: 4, gap: 2, at: 2 }, { t: 'gladiator', n: 8, gap: 0.9, at: 8 }],
      [{ t: 'catapult', n: 2, gap: 8 }, { t: 'legion', n: 14, gap: 0.6, at: 2 }, { t: 'solarcher', n: 8, gap: 0.9, at: 8 }],
      [{ t: 'cavalry', n: 6, gap: 1.2 }, { t: 'heavy', n: 5, gap: 1.8, at: 5 }, { t: 'priest', n: 3, gap: 2.4, at: 8 }, { t: 'assassin', n: 8, gap: 0.8, at: 12 }],
      [{ t: 'ram', n: 2, gap: 6 }, { t: 'catapult', n: 1, gap: 1, at: 4 }, { t: 'gladiator', n: 10, gap: 0.8, at: 6 }, { t: 'legion', n: 14, gap: 0.6, at: 12 }],
      [{ t: 'heavy', n: 6, gap: 1.6 }, { t: 'cavalry', n: 8, gap: 1.1, at: 6 }, { t: 'assassin', n: 10, gap: 0.7, at: 12 }, { t: 'priest', n: 4, gap: 2, at: 14 }],
    ] },
  ];
  // 10 Eki: her sefer 20 bölüm. Her bölgenin finalinden önce bir yeni bölüm (bölge başına 4 bölüm, finaller yerinde)
  const EK1 = [
    { name: 'Dikenli Patika', theme: 'cursed', gold: 330, bossT: 'centurion', comic: 'patika', waves: [
      [W_('legion', 8, 1)], [W_('legion', 6, 1), W_('solarcher', 3, 1.8, 5)], [W_('gladiator', 3, 1.4), W_('legion', 6, 1, 4)],
      [W_('legion', 10, 0.8), W_('solarcher', 4, 1.4, 6)], [W_('gladiator', 5, 1.1), W_('legion', 8, 0.9, 5)], [W_('solarcher', 6, 1), W_('legion', 10, 0.8, 4)],
      [W_('gladiator', 6, 1), W_('solarcher', 5, 1.2, 5), W_('legion', 8, 0.8, 9)], [W_('legion', 12, 0.7), W_('gladiator', 6, 1, 5), W_('solarcher', 6, 1, 9)] ] },
    { name: 'Kurbağa Adası', theme: 'bog', gold: 420, bossT: 'champion', comic: 'kurbaga', waves: [
      [W_('legion', 8, 1), W_('assassin', 2, 1.5, 6)], [W_('gladiator', 5, 1.1), W_('solarcher', 4, 1.4, 4)], [W_('assassin', 5, 1), W_('legion', 8, 0.9, 4)],
      [W_('legion', 10, 0.8), W_('gladiator', 4, 1.2, 6)], [W_('assassin', 6, 0.9), W_('solarcher', 6, 1, 5)], [W_('gladiator', 6, 1), W_('legion', 10, 0.8, 5)],
      [W_('assassin', 8, 0.8), W_('solarcher', 6, 1, 6), W_('legion', 8, 0.8, 10)], [W_('legion', 12, 0.7), W_('gladiator', 8, 0.9, 5), W_('assassin', 8, 0.8, 10)] ] },
    { name: 'Fener Bekçisinin Mezarı', theme: 'graveyard', gold: 500, bossT: 'shadowmaster', comic: 'bekci', waves: [
      [W_('legion', 10, 0.9), W_('priest', 1, 1, 6)], [W_('heavy', 2, 2.4), W_('solarcher', 5, 1.2, 4)], [W_('assassin', 6, 1), W_('gladiator', 5, 1.1, 5)],
      [W_('priest', 2, 3), W_('legion', 10, 0.8, 3)], [W_('heavy', 3, 2.2), W_('assassin', 6, 0.9, 6)], [W_('gladiator', 8, 0.9), W_('priest', 2, 3, 6)],
      [W_('heavy', 4, 2), W_('solarcher', 8, 0.9, 4), W_('legion', 10, 0.7, 10)], [W_('assassin', 10, 0.7), W_('heavy', 4, 2, 5), W_('priest', 3, 2.4, 9), W_('gladiator', 8, 0.8, 12)] ] },
    { name: 'Sazlık Kıyı', theme: 'blacklake', gold: 580, bossT: 'cavcaptain', comic: 'sazlik', waves: [
      [W_('legion', 10, 0.9), W_('cavalry', 2, 2, 7)], [W_('heavy', 3, 2.2), W_('solarcher', 6, 1.1, 4)], [W_('cavalry', 4, 1.6), W_('assassin', 6, 1, 5)],
      [W_('ram', 1, 1), W_('legion', 10, 0.8, 2), W_('priest', 2, 3, 8)], [W_('gladiator', 8, 0.9), W_('cavalry', 4, 1.5, 6)], [W_('heavy', 4, 2), W_('priest', 3, 2.4, 4), W_('assassin', 6, 0.9, 9)],
      [W_('ram', 1, 1), W_('cavalry', 5, 1.4, 3), W_('legion', 12, 0.6, 8)], [W_('heavy', 5, 1.8), W_('cavalry', 6, 1.3, 5), W_('priest', 3, 2.4, 8), W_('gladiator', 8, 0.8, 12)] ] },
    { name: 'Kemik Köprü', theme: 'necrogate', gold: 640, bossT: 'ironwarden', comic: 'kopru', waves: [
      [W_('legion', 12, 0.8), W_('solarcher', 6, 1.1, 5)], [W_('catapult', 1, 1), W_('gladiator', 8, 0.9, 3)], [W_('cavalry', 6, 1.3), W_('priest', 2, 3, 6)],
      [W_('heavy', 5, 1.8), W_('assassin', 8, 0.9, 5)], [W_('ram', 2, 6), W_('legion', 14, 0.6, 2), W_('solarcher', 6, 1, 9)], [W_('catapult', 2, 8), W_('heavy', 5, 1.8, 3), W_('cavalry', 6, 1.2, 9)],
      [W_('assassin', 10, 0.7), W_('gladiator', 10, 0.8, 5), W_('priest', 3, 2.4, 10)], [W_('heavy', 6, 1.6), W_('cavalry', 8, 1.1, 5), W_('legion', 14, 0.6, 10), W_('priest', 4, 2, 14)] ] },
  ];
  [14, 11, 8, 5, 2].forEach((at, k) => { L.splice(at, 0, EK1[4 - k]); old.splice(at, 0, LEVELS_EK1_GEO[4 - k]); });
  const M1 = (i) => 4 * Math.floor(i / 3) + (i % 3 < 2 ? i % 3 : 3); // eski 15'lik sıradan yeni 20'lik sıraya
  // yeni birlikler dalgalara: ilk geldikleri bölümden itibaren belli dalgalarda küçük gruplar halinde (yer kaplamasın diye geç 'at')
  // görseli henüz hazır olmayan yeni türler dalgalara girmez
  const NEW_ART_WAIT = [];
  // davulcu ve sancaktar burada değil: yalnız kalabalık piyade bölüklerinin içinde yürürler (aşağıda SUPPORT)
  const NEWCOMERS = [['testudo', 7, [3, 6], 1], ['sunpriest', 8, [4, 7], 1], ['horsearcher', 10, [2, 5, 7], 2],
    ['wardog', 3, [1, 4, 6], 5], ['eagle', 5, [2, 5, 7], 3], ['chariot', 9, [3, 6], 1], ['siegetower', 12, [5, 7], 1], ['elephant', 11, [6], 1], ['vulture', 6, [3, 6], 4]].filter(([t]) => !NEW_ART_WAIT.includes(t));
  for (const [t, from, ws, n] of NEWCOMERS) L.forEach((l, i) => {
    if (i < M1(from)) return;
    ws.forEach((k, j) => { const w = l.waves[k]; if (w) w.push(W_(t, n + (i >= M1(from) + 5 && j === ws.length - 1 ? 1 : 0), 3, 7 + j * 2)); });
  });
  // dalga düzeni (8 Eki): her bölüm 8 dalga, her dalga öncekinden %30 kalabalık; total = bölümün boss hariç düşman sayısı
  // (önceki düzenin ~2,1 katı: 56, 64, 74, 74, 119 -> aşağıdakiler)
  // 10 Eki: yollar v2 sonrası denge (tarayıcı botu): geç bölümlerde düşman sayısı azaltıldı (çok kalabalık, çok zayıf yerine)
  const TOTAL = [184, 193, 196, 199, 209, 218, 223, 228, 234, 206, 220, 234, 242, 242, 226, 211, 211, 265, 273, 281]; // 20 bölüm (10 Eki): yeni bölümler komşularının arası // 10 Eki: önce %30, sonra %20 daha kalabalık (Caner: kuleler güçlü kaldı); ilk değerler 1,56'ya bölünerek bulunur
  // düşman canı çarpanı: tarayıcı botuyla ölçüldü (hedef: bot 1. bölümü ~19, 15. bölümü ~7 canla bitirir; 1-3 öğretici, tavanlı)
  // 10 Eki akşam: fil, akbaba ve karışık yürüyüş sonrası yeniden ölçüldü (tools/denge-sayfa.js, bölüm başına 4 tur)
  const HPMUL = [1, 1.3, 1.188, 1.612, 1.012, 1.491, 0.574, 0.98, 0.398, 0.525, 0.818, 0.316, 1.267, 0.804, 0.42, 0.352, 0.194, 0.673, 0.24, 0.334]; // 10 Eki: hasar türü × zırh sınıfı, Kemik Kulesi yolları ve silah büyüleriyle bot ayarı (2 tur)
  L.forEach((l, i) => Object.assign(l, old[i], { lives: 20, ep: 1, total: Math.round(TOTAL[i] * MORE_FOES), grow: 1.3, hpMul: HPMUL[i] }));
  // bölüme özel mekanikler (game.js MECH)
  [null, null, null, null, 'mud', 'mud', null, null, 'graves', null, null, 'graves', 'lake', null, 'lake', 'lake', 'sunbeam', null, null, 'sunbeam'].forEach((m, i) => { if (m) L[i].mech = m; });
  LEVELS.splice(0, LEVELS.length, ...L);
  // bölge (eski adıyla sefer): haritası game.js drawRegionMap ile çizilir; zones: haritada soldan sağa mekânlar
  // name: bölgenin (episode) adı, haritanın başlığı. zones: soldan sağa mekânlar (zemin teması).
  // nodes: bölüm işaretleri (960x540), yol bunların içinden kıvrılarak geçer: start'tan girer, end'de şapelin kapısında biter.
  EPISODES.splice(0, EPISODES.length, { name: 'Davetsiz Misafirler',
    zones: [['cursed', 'Ölü Orman'], ['bog', 'Sisli Bataklık'], ['graveyard', 'Unutulmuş Mezarlık'], ['blacklake', 'Kara Göl'], ['necrogate', "Mortimer'ın Kapısı"]],
    start: [-40, 470], end: [852, 264],
    nodes: [[70, 450], [150, 372], [92, 282], [192, 194], [292, 250], [252, 352], [334, 442], [444, 392], [424, 290],
      [504, 200], [612, 232], [592, 342], [690, 420], [782, 352], [742, 262]].reduce((a, n, i, all) => { // 20 bölüm: her bölgenin 3. işareti öncesine ara işaret
      if (i % 3 === 2) { const p = all[i - 1]; a.push([Math.round((p[0] + n[0]) / 2 + (n[1] - p[1]) * 0.18), Math.round((p[1] + n[1]) / 2 - (n[0] - p[0]) * 0.18)]); }
      a.push(n); return a; }, []) });
}

// =====================================================================================
// SEFER 2: CADI AVI (tasarim/sefer2.md). Kutsal Engizisyon: ölü avcıları. 15 bölüm, 15 can, daha zor.
// Özellikler: light (fener ışığı: içindeki düşmana iskelet hasarı azalır, ceset diriltilemez, lanet tutmaz),
// frenzy (canı azaldıkça hızlanır ve sertleşir), elite (dalga ölçeklenirken çoğalmaz), ranged.splash (şişe: isabet yerindeki askerlere alan hasarı),
// nocurse (lanet işlemez), ab.slam.say / ab.hex.say: yetenek yazısı (çan, sorgu, tuzak...).
// =====================================================================================
if (NECRO) {
  Object.assign(ENEMIES, {
    hunter:     { name: 'Cadı Avcısı', h: 31, hp: 110, speed: 24, armor: 0.15, mr: 0, gold: 12, dmg: [3, 6], rate: 1, lives: 1, r: 9,
      ranged: { r: 140, dmg: [9, 14], rate: 2, proj: 'harrow', any: true, hold: true } },
    torch:      { name: 'Meşaleci', h: 31, hp: 130, speed: 22, armor: 0.1, mr: 0.1, gold: 13, dmg: [5, 9], rate: 1, lives: 1, r: 10, purify: { r: 80, every: 3, dmg: 18, fire: true } },
    hound:      { name: 'Ak Tazı', h: 17, hp: 85, speed: 48, armor: 0, mr: 0, gold: 7, dmg: [4, 7], rate: 0.7, lives: 1, r: 9 },
    holywater:  { name: 'Kutsal Su Taşıyıcı', h: 32, hp: 160, speed: 18, armor: 0, mr: 0.3, gold: 16, dmg: [2, 4], rate: 1, lives: 1, r: 10,
      ranged: { r: 120, dmg: [10, 14], rate: 3, proj: 'flask', any: true, hold: true, splash: 30 } },
    flagellant: { name: 'Kırbaçlı Tövbekâr', h: 31, hp: 220, speed: 22, armor: 0, mr: 0, gold: 16, dmg: [6, 10], rate: 0.8, lives: 1, r: 10, frenzy: { spd: 0.9, dmg: 1.2 } },
    lantern:    { name: 'Fener Arabası', h: 40, hp: 650, speed: 10, armor: 0.35, mr: 0.1, gold: 45, dmg: [2, 4], rate: 2, lives: 2, r: 16, machine: true, light: { r: 85, k: 0.7 } },
    bellpriest: { name: 'Çan Rahibi', h: 32, hp: 170, speed: 18, armor: 0, mr: 0.4, gold: 18, dmg: [2, 4], rate: 1, lives: 1, r: 10,
      ab: { slam: { cd: 7, r: 80, stun: 1.4, dmg: 4, say: 'Çan!', bell: true } } },
    paladin:    { name: 'Paladin', h: 36, hp: 520, speed: 13, armor: 0.5, mr: 0.45, gold: 36, dmg: [10, 16], rate: 1.2, lives: 2, r: 12, elite: true },
    inquisitor: { name: 'Engizitör', h: 34, hp: 300, elite: true, speed: 16, armor: 0.1, mr: 0.45, gold: 30, dmg: [5, 9], rate: 1, lives: 1, r: 10,
      ab: { hex: { cd: 11, r: 180, t: 4, say: 'Sorgu!', col: '255,210,110' } } },
    saint:      { name: 'Aziz Heykeli', h: 40, hp: 900, speed: 9, armor: 0.6, mr: 0.2, gold: 50, dmg: [12, 18], rate: 1.6, lives: 3, r: 15, nocurse: true },
    // bölüm sonu komutanları ve final
    malleus:  { name: 'Avcıbaşı Malleus', h: 46, hp: 1000, speed: 15, armor: 0.2, mr: 0.2, gold: 120, dmg: [12, 18], rate: 1, lives: 5, r: 14, boss: true, chief: true, hpK: 0.9,
      desc: 'İki arbaletle iskeletleri avlar, tuzak kurar, tazı salar',
      ranged: { r: 150, dmg: [14, 20], rate: 1.6, proj: 'harrow', any: true, hold: true }, ab: { summon: { t: 'hound', n: 2, cd: 12 }, slam: { cd: 9, r: 60, stun: 2, dmg: 10, say: 'Tuzak!' } } },
    campanus: { name: 'Çan Ustası Campanus', h: 50, hp: 1200, speed: 11, armor: 0.35, mr: 0.2, gold: 150, dmg: [16, 24], rate: 1.4, lives: 6, r: 16, boss: true, chief: true, hpK: 1,
      desc: 'Dev çanını çalar: çevresindeki bütün iskeletler sersemler. Çan rahibi çağırır',
      ab: { slam: { cd: 8, r: 130, stun: 2, dmg: 14, say: 'ÇAN!', bell: true }, summon: { t: 'bellpriest', n: 1, cd: 14 } } },
    ignis:    { name: 'Rahibe Ignis', h: 46, hp: 1100, speed: 14, armor: 0.1, mr: 0.4, gold: 160, dmg: [14, 20], rate: 1, lives: 6, r: 14, boss: true, chief: true, hpK: 0.9,
      desc: 'Alev saçar: yerdeki bütün cesetleri yakar, çevresindeki iskeletleri tutuşturur. Meşaleci çağırır',
      purify: { r: 130, every: 4, dmg: 30, fire: true }, ab: { slam: { cd: 7, r: 75, stun: 0.8, dmg: 22, say: 'Alev!' }, summon: { t: 'torch', n: 2, cd: 13 } } },
    colossus: { name: 'Aziz Kolos', h: 66, hp: 2400, speed: 8, armor: 0.6, mr: 0.2, gold: 220, dmg: [24, 36], rate: 1.6, lives: 10, r: 20, boss: true, chief: true, hpK: 1.4,
      desc: 'Canlanan katedral heykeli: iskeletleri ezip geçer, lanet tutmaz. Adımlarıyla yeri sarsar',
      nocurse: true, noblock: true, trample: { dmg: 50, r: 24 }, ab: { slam: { cd: 9, r: 100, stun: 1.5, dmg: 20, say: 'Taş Adım!' } } },
    severus:  { name: 'Büyük Engizitör Severus', h: 50, hp: 2000, speed: 12, armor: 0.3, mr: 0.5, gold: 300, dmg: [20, 30], rate: 1.2, lives: 15, r: 15, boss: true, chief: true, hpK: 1.1,
      desc: 'Çaydanlığı elinde. Kuleleri sorguya çeker, dostlarını iyileştirir, kalkan açar, paladin ve tövbekâr çağırır',
      ab: { hex: { cd: 9, r: 200, t: 4, say: 'Sorgu!', col: '255,210,110' }, heal: { cd: 8, amt: 120, r: 100 }, shield: { cd: 15, t: 2.5 }, summon: { t: ['paladin', 'flagellant'], n: 2, cd: 13 } } },
    cathedral:{ name: 'Yürüyen Katedral', h: 80, hp: 3000, speed: 6, armor: 0.5, mr: 0.3, gold: 300, dmg: [4, 6], rate: 2, lives: 10, r: 26, boss: true, chief: true, hpK: 1.15,
      desc: 'Rahiplerin ittiği dev kuşatma katedrali. Çanı iskeletleri sersemletir, içinden asker döker. Yıkılınca Severus iner',
      machine: true, noblock: true, split: ['severus', 1], light: { r: 110, k: 0.7 },
      ab: { summon: { t: ['paladin', 'inquisitor', 'hunter'], n: 3, cd: 14 }, slam: { cd: 10, r: 140, stun: 2, dmg: 10, say: 'Katedral Çanı!', bell: true } } },
  });
  Object.assign(BOSS_ESCORT, { malleus: [['hunter', 2], ['hound', 2]], campanus: [['bellpriest', 1], ['legion', 4]], ignis: [['torch', 2], ['flagellant', 2]],
    colossus: [['saint', 1], ['paladin', 1]], cathedral: [['paladin', 2], ['inquisitor', 1]] });
  const W_ = (t, n, gap, at) => (at == null ? { t, n, gap } : { t, n, gap, at });
  // dalga üretici: pool (bölümün temel düşmanları) her dalgada döner, intro (yeni ve öne çıkan türler) 2. dalgadan itibaren eklenir,
  // geç dalgalarda üçüncü ve dördüncü grup gelir; sayıları shapeWaves bölümün toplamına göre ölçekler
  const mk = (pool, intro, extra = []) => {
    const waves = [];
    for (let k = 0; k < 8; k++) {
      const w = [], a = pool[k % pool.length];
      w.push(W_(a[0], a[1], a[2]));
      if (k >= 1) { const b = intro[k % intro.length]; w.push(W_(b[0], b[1], b[2], 3 + k % 3)); }
      if (k >= 4) { const c = pool[(k + 2) % pool.length]; w.push(W_(c[0], c[1], c[2], 7 + k % 4)); }
      if (k >= 5 && extra.length) { const d = extra[k % extra.length]; w.push(W_(d[0], d[1], d[2], 10)); }
      waves.push(w);
    }
    return waves;
  };
  const L2 = [
    { name: 'Darağacı Yolu', theme: 'ravenwood', gold: 320, waves: mk([['legion', 8, 1], ['solarcher', 4, 1.3]], [['hunter', 3, 1.6]]) },
    { name: 'Yanık Kazıklar', theme: 'ravenwood', gold: 340, waves: mk([['legion', 8, 0.9], ['hunter', 4, 1.4], ['gladiator', 5, 1]], [['torch', 2, 2.4]]) },
    { name: 'Kuzgun Tepesi', theme: 'ravenwood', gold: 380, bossT: 'malleus', waves: mk([['legion', 8, 0.9], ['hunter', 4, 1.3]], [['hound', 5, 0.7], ['torch', 3, 2]], [['heavy', 2, 2.4]]) },
    { name: 'Karantina Kapısı', theme: 'plague', gold: 420, weather: 'rain', waves: mk([['legion', 10, 0.8], ['torch', 3, 2], ['hunter', 4, 1.3]], [['holywater', 2, 2.6]], [['heavy', 2, 2.4]]) },
    { name: 'Boş Pazar', theme: 'plague', gold: 440, waves: mk([['gladiator', 6, 1], ['hunter', 5, 1.2], ['hound', 6, 0.7]], [['flagellant', 3, 1.6], ['holywater', 2, 2.4]], [['heavy', 3, 2.2]]) },
    { name: 'Ölüler Kuyusu', theme: 'plague', gold: 480, bossT: 'campanus', weather: 'rain', waves: mk([['legion', 10, 0.8], ['flagellant', 3, 1.6], ['hunter', 5, 1.2]], [['lantern', 1, 1], ['torch', 3, 2]], [['heavy', 3, 2.2], ['holywater', 3, 2]]) },
    { name: 'Sazlık Şapel', theme: 'monastery', gold: 500, waves: mk([['legion', 10, 0.8], ['holywater', 3, 2], ['hound', 6, 0.7]], [['bellpriest', 2, 2.6], ['lantern', 1, 1]], [['heavy', 3, 2.2]]) },
    { name: 'Su Basmış Avlu', theme: 'monastery', gold: 520, waves: mk([['hunter', 6, 1.1], ['flagellant', 4, 1.4], ['legion', 10, 0.8]], [['paladin', 2, 2.6], ['bellpriest', 2, 2.4]], [['torch', 3, 2]]) },
    { name: 'Çan Kulesi', theme: 'monastery', gold: 560, bossT: 'ignis', waves: mk([['hunter', 6, 1.1], ['paladin', 2, 2.6], ['holywater', 3, 2]], [['inquisitor', 1, 1], ['bellpriest', 2, 2.4]], [['lantern', 1, 1], ['flagellant', 4, 1.3]]) },
    { name: 'Kafatası Kapısı', theme: 'ossuary', gold: 580, waves: mk([['flagellant', 5, 1.3], ['hunter', 6, 1], ['paladin', 3, 2.4]], [['saint', 1, 1], ['inquisitor', 1, 1]], [['lantern', 1, 1], ['torch', 3, 2]]) },
    { name: 'Kemik Avize Salonu', theme: 'ossuary', gold: 600, waves: mk([['legion', 12, 0.7], ['hound', 8, 0.6], ['holywater', 4, 1.8], ['paladin', 3, 2.4]], [['saint', 1, 1], ['bellpriest', 2, 2.2], ['inquisitor', 1, 1]], [['lantern', 1, 1], ['flagellant', 5, 1.2]]) },
    { name: 'Kripta', theme: 'ossuary', gold: 640, bossT: 'colossus', waves: mk([['paladin', 3, 2.2], ['hunter', 6, 1], ['flagellant', 5, 1.2]], [['saint', 2, 4], ['inquisitor', 2, 3]], [['lantern', 1, 1], ['torch', 4, 1.8]]) },
    { name: 'Sis Yolu', theme: 'bloodmoon', gold: 660, waves: mk([['legion', 12, 0.7], ['cavalry', 5, 1.3], ['hunter', 6, 1], ['heavy', 3, 2]], [['paladin', 3, 2.2], ['flagellant', 5, 1.2], ['holywater', 4, 1.8]], [['saint', 1, 1], ['lantern', 1, 1]]) },
    { name: 'Yıkık Kule', theme: 'bloodmoon', gold: 680, waves: mk([['hound', 10, 0.5], ['hunter', 8, 0.9], ['paladin', 3, 2.2], ['torch', 4, 1.6]], [['lantern', 2, 5], ['inquisitor', 2, 3], ['bellpriest', 3, 2]], [['saint', 1, 1], ['siegetower', 1, 1]]) },
    { name: 'Ay Sunağı', theme: 'bloodmoon', gold: 720, bossT: 'cathedral', waves: mk([['legion', 14, 0.6], ['paladin', 4, 2], ['flagellant', 6, 1.1], ['hunter', 8, 0.9]], [['lantern', 1, 1], ['saint', 1, 1], ['inquisitor', 2, 3], ['holywater', 4, 1.8]], [['heavy', 4, 2], ['bellpriest', 3, 2]]) },
  ];
  // 10 Eki: 20 bölüm. Her bölgenin finalinden önce yeni bir bölüm
  const EK2 = [
    { name: 'Avcı Kampı', theme: 'ravenwood', gold: 360, comic: 'kamp', waves: mk([['legion', 8, 0.9], ['hunter', 4, 1.3], ['gladiator', 4, 1.1]], [['hound', 5, 0.7], ['torch', 2, 2.2]], [['heavy', 2, 2.4]]) },
    { name: 'Veba Hendeği', theme: 'plague', gold: 460, weather: 'rain', comic: 'hendek', waves: mk([['legion', 10, 0.8], ['holywater', 3, 2], ['flagellant', 3, 1.5]], [['hound', 6, 0.7], ['lantern', 1, 1]], [['heavy', 3, 2.2], ['torch', 3, 2]]) },
    { name: 'Mum Işığı Koridoru', theme: 'monastery', gold: 540, comic: 'koridor', waves: mk([['hunter', 6, 1.1], ['bellpriest', 2, 2.4], ['legion', 10, 0.8]], [['paladin', 2, 2.6], ['lantern', 1, 1]], [['flagellant', 4, 1.3], ['holywater', 3, 2]]) },
    { name: 'Kemik Mahzeni', theme: 'ossuary', gold: 620, comic: 'mahzen', waves: mk([['paladin', 3, 2.2], ['flagellant', 5, 1.2], ['hunter', 6, 1]], [['saint', 1, 1], ['inquisitor', 1, 1], ['bellpriest', 2, 2.2]], [['lantern', 1, 1], ['torch', 4, 1.8]]) },
    { name: 'Kızıl Sur', theme: 'bloodmoon', gold: 700, comic: 'sur', waves: mk([['legion', 14, 0.6], ['paladin', 3, 2], ['hound', 8, 0.5]], [['saint', 1, 1], ['inquisitor', 2, 3], ['lantern', 1, 1]], [['cavalry', 5, 1.3], ['flagellant', 6, 1.1], ['holywater', 4, 1.8]]) },
  ];
  const GEO2 = LEVELS2_GEO.slice();
  [14, 11, 8, 5, 2].forEach((at, k) => { L2.splice(at, 0, EK2[4 - k]); GEO2.splice(at, 0, LEVELS_EK2_GEO[4 - k]); });
  // toplam düşman (boss hariç) ve can çarpanı: denge botuyla ayarlanır (tools/denge-sayfa.js, hedef __T2)
  const TOTAL2 = [172, 184, 188, 193, 203, 212, 215, 218, 218, 224, 227, 230, 234, 242, 240, 242, 250, 257, 265, 274]; // 20 bölüm (10 Eki) // 10 Eki: önce %30, sonra %20 daha kalabalık (Caner: kuleler güçlü kaldı); ilk değerler 1,56'ya bölünerek bulunur
  const HPMUL2 = [1.311, 1.531, 0.787, 1.114, 1.545, 0.854, 0.638, 1.737, 2.166, 1.357, 2.5, 1.931, 1.206, 1.269, 0.911, 1.479, 0.874, 1.632, 1.09, 0.395]; // 10 Eki: hasar türü × zırh sınıfı, Kemik Kulesi yolları ve silah büyüleriyle bot ayarı (2 tur)
  // her bölüm bir komutanla biter (1. seferdeki gibi): büyük bosslar 3, 6, 9, 12, 15'te; aralarda lejyon subayları ve eski bosslar
  const BOSS2 = ['centurion', 'shadowmaster', 'champion', 'malleus', 'hierophant', 'champion', 'malleus', 'campanus', 'malleus', 'ironwarden', 'campanus', 'ignis',
    'campanus', 'cavcaptain', 'ignis', 'colossus', 'ignis', 'severus', 'colossus', 'cathedral'];
  L2.forEach((l, i) => { l.bossT = BOSS2[i]; Object.assign(l, GEO2[i], { lives: 15, ep: 2, total: Math.round(TOTAL2[i] * MORE_FOES), grow: 1.3, hpMul: HPMUL2[i] }); if (!l.weather) delete l.weather; });
  LEVELS.push(...L2);
  EPISODES.push({ name: 'Cadı Avı',
    zones: [['ravenwood', 'Kuzgun Ormanı'], ['plague', 'Veba Köyü'], ['monastery', 'Batık Manastır'], ['ossuary', 'Kemik Katedrali'], ['bloodmoon', 'Kızıl Ay Tepesi']],
    start: [-40, 110], end: [852, 276],
    nodes: [[70, 130], [150, 208], [92, 298], [192, 386], [292, 330], [252, 228], [334, 138], [444, 188], [424, 290],
      [504, 380], [612, 348], [592, 238], [690, 160], [782, 228], [742, 318]].reduce((a, n, i, all) => { // 20 bölüm: ara işaretler
      if (i % 3 === 2) { const p = all[i - 1]; a.push([Math.round((p[0] + n[0]) / 2 + (n[1] - p[1]) * 0.18), Math.round((p[1] + n[1]) / 2 - (n[0] - p[0]) * 0.18)]); }
      a.push(n); return a; }, []) });
}
// kuleler: Mortimer'ın yapıları
Object.assign(TOWERS.archer, { name: 'Kemik Kulesi', desc: 'Tepedeki iskelet okçular kemik ok atar, havayı da vurur · 2. kademede okçu ya da arbaletçi yolunu seçersin' });
Object.assign(TOWERS.barracks, { name: 'Mahzen', desc: 'Mahzenin kapısından çıkan iskelet savaşçılar yolu keser' }); // 11 Eki: Savaşçı Mezarlığı'ndan yeniden Mahzen'e (Caner)
Object.assign(TOWERS.mage, { name: 'Ruh Feneri', desc: 'Ruh ışını: zırhı deler, yavaşlatır · menzilinde ölenlerin ruhunu toplar, büyüler çabuk dolar' }); // Ruh Hasadı: game.js SOUL
Object.assign(TOWERS.artillery, { name: 'Veba Kazanı', desc: 'Veba fırlatır: alan hasarı, zehirli gaz, zırhı çürütür' });
TOWERS.barracks.levels[0].perk = 'Tencere miğferli 3 iskelet acemi yolu keser';
TOWERS.barracks.levels[1].perk = 'İskelet muhafızlar: zincir zırh, kalkan, uzun kılıç';
TOWERS.barracks.levels[2].perk = 'Kemik şövalyeler: kara zırh · vuruşlar %15 can çalar';
TOWERS.artillery.levels[0].perk = 'Veba bulamacı: alan hasarı, yerde zehirli gaz, zırh yarıya iner';
TOWERS.artillery.levels[1].perk = 'Daha ağır veba, daha geniş gaz bulutu';
TOWERS.artillery.levels[2].perk = 'Kaynayan veba: %30 şansla 0.6 sn sersemletir';
TOWERS.mage.levels[0].perk = 'Ruh ışını: büyü hasarı zırhı deler';
const NAMES = { poison: 'Veba Kemiği', snipe: 'Kemik Mızrak', shield: 'Mezar Bekçisi', blade: 'Ölüm Şövalyesi', frost: 'Lanet', blast: 'Ruh Fırtınası', napalm: 'Çürüme Bulutu', double: 'Çifte Kazan' };
for (const k in TOWERS) for (const a of TOWERS[k].abilities || []) if (NAMES[a.id]) a.name = NAMES[a.id];
// komutanlar (tek seçilir): Kont Drakula (eski komutanın yetenekleri; 11 Eki Vladrik'in yerine). Wailing Wren 11 Eki'de çıkarıldı (HERO_ORDER'da yok)
Object.assign(HEROES.commander, { name: 'Kont Drakula', role: 'Vampir · Yakın dövüş', sprite: 'hero_drakula', h: 31, aura: '220,40,60' });
Object.assign(HEROES.zeynep, { name: 'Wailing Wren', role: 'Banshee · Uzun menzil', sprite: 'hero_wren', h: 30, aura: '150,255,190', unlock: 2 });
// 10 Eki: Mortimer'a düelloda yenilip onun komutanı olan ünlü savaşçılar (tasarim/komutanlar-golemler.md).
// unlock: bitirilmesi gereken bölüm (15: 1. seferin sonu; 21: Cadı Avı'nın 6. bölümü)
Object.assign(HEROES, {
  spartacus: { name: 'Spartaküs', role: 'Zincirsiz · Yakın dövüş', sprite: 'hero_spartacus', h: 32, aura: '255,90,80',
    hp: 360, dmg: [16, 24], armor: 0.2, rate: 0.9, speed: 82, respawn: 15, regen: 10, engage: 75, unlock: 20,
    paths: [{ name: 'Yetenekler', col: '#ffd34d', skills: [
      { id: 'whirl', name: 'Zincir Savurma', cd: 9, desc: 'Zincirlerini savurur: çevresindeki bütün düşmanlara hasar' },
      { id: 'bash', name: 'Gladyatör Ağı', cd: 8, desc: 'Hedefine ağ atar: 2 sn kımıldayamaz, ek hasar alır' },
      { id: 'charge', name: 'Arena Hamlesi', cd: 16, desc: 'Kaleye en yakın düşmana atılıp ağır darbe vurur' },
    ] }] },
  leonidas: { name: 'Leonidas', role: 'Kemik Kalkan · Tank', sprite: 'hero_leonidas', h: 33, aura: '200,150,255',
    hp: 480, dmg: [12, 18], armor: 0.5, rate: 1.1, speed: 72, respawn: 16, regen: 12, engage: 70, unlock: 28,
    paths: [{ name: 'Yetenekler', col: '#ffd34d', skills: [
      { id: 'bash', name: 'Sparta Tekmesi', cd: 7, desc: '"Bu Sparta!": hedefi tekmeyle sersemletir, ek hasar verir' },
      { id: 'cry', name: 'Sparta Narası', cd: 15, desc: 'Yakındaki iskeletleri iyileştirir, 6 sn hasarlarını %50 artırır' },
      { id: 'iron', name: 'Bronz Kalkan', passive: true, desc: 'Kalıcı: +%25 zırh ve iki kat can yenilenmesi' },
    ] }] },
});
Object.assign(HERO_ULT, {
  spartacus: { name: 'Zincir Fırtınası', cd: 50, r: 70, dps: [22, 30], dur: 3, slow: 0.35, chains: true,
    desc: 'Seçtiğin alanda zincirler döner: 3 sn hasar verir, yavaşlatır', short: 'Alanda dönen zincirler: 3 sn hasar ve yavaşlatma' },
  leonidas: { name: 'Falanks', cd: 55, hp: 900, life: 6, phalanx: true,
    desc: 'Yolun seçtiğin yerinde kalkanlı üç iskelet hoplit duvar örer: 6 sn yolu kapatır', short: 'Yola kalkan duvarı: 6 sn yolu kapatır' },
});
HERO_ORDER.splice(0, HERO_ORDER.length, 'commander', 'spartacus', 'leonidas');
Object.assign(HERO_ULT.commander, { name: 'Yarasa Sürüsü', bats: true, dps: [14, 18], dur: 3, slow: 0.4, heal: 0.3, n: 14,
  desc: 'Vampir yarasalar alana üşüşür: 3 sn ısırır, yavaşlatır, Drakula ısırıklarla iyileşir',
  short: 'Seçtiğin alana yarasa sürüsü: 3 sn ısırık, yavaşlatma, Drakula iyileşir' });
Object.assign(HERO_ULT.zeynep, { name: 'Ölüm Çığlığı', cd: 50, r: 82, dmg: [26, 36], stun: 1.6, desc: 'Wren çığlık atar: alandaki düşmanlar hasar alır ve 1,6 sn sersemler' });
// kale yerine Mortimer'ın kulesi: balkonda Mortimer durur, okçular pencere önlerinde
Object.assign(CASTLE, { spots: [[0.21, 0.385], [0.67, 0.41], [0.46, 0.16]] }); // şapel: iki kulenin çıkıntısı ve alınlık tepesi
// Mortimer'ın büyüleri (sol altta, bekleme süreli). raise: hedefsiz, süre boyunca ölen düşmanlar iskelet minyon olur.
// fear: hedefli alan, düşmanlar kavgayı bırakıp yolda geri kaçar (bosslar yarı süre).
const NECRO_SPELLS = {
  // cesetler ölümden sonra corpse sn yerde yatar; büyü o an yerdeki cesetleri iskelet minyon olarak kaldırır
  nm_raise: { name: 'Ölüleri Diriltme', cd: 45, corpse: 6, col: '120,255,140', max: 10, minion: { hp: 80, dmg: [4, 8], armor: 0.1, life: 30 },
    desc: 'Yerde yatan düşman cesetleri (ölümden sonra 10 sn) çürümüş ölüler olarak kalkar, düşmanın geldiği yöne yürüyüp senin için savaşır · 30 sn yaşarlar',
    short: 'Yerdeki cesetler çürümüş ölüler olarak kalkar, düşmana yürüyüp 30 sn senin için savaşır' },
  nm_wall:  { name: 'Kemik Duvarı', cd: 30, hp: 420, life: 7, col: '235,225,200',
    desc: 'Yolun seçtiğin yerinde kemikten duvar yükselir: düşmanları 7 sn durdurur, vurularak kırılabilir',
    short: 'Yola kemik duvar diker: düşmanlar 7 sn takılır (kırılabilir)' },
  nm_fear:  { name: 'Korku', cd: 40, r: 120, t: 4, col: '190,120,255', ghosts: 10, desc: 'Ruhlar alandaki düşmanların peşine düşer: korkudan 4 sn geri kaçarlar. Büyü direnci olanlar ve bosslar daha az korkar, makineler korkmaz', short: 'Ruhlar düşmanları kovalar: 4 sn panikle geri kaçarlar' },
  // 5. büyü (10 Eki): 2. seferin 9. bölümü kazanılınca (Kemik Katedrali) açılır. Sahadaki bütün cesetler tek golemde birleşir
  nm_golem: { name: 'Ceset Golemi', cd: 55, min: 3, max: 14, life: 20, hp: 220, hpPer: 85, dmg: [14, 22], dmgPer: 0.06, col: '150,255,110', unlock: 31,
    desc: 'Sahadaki bütün cesetler seçtiğin yerde tek bir golemde birleşir: ceset ne kadar çoksa o kadar iri ve güçlü. 20 sn düşmanın üstüne yürür, alan vuruşu yapar',
    short: 'Cesetler birleşip golem olur (en az 3 ceset): 20 sn savaşır' },
  // 4. büyü: 1. bölge bitince (son bölüm kazanılınca) açılır. Cesedi diriltmek ya da patlatmak arasında seçim.
  nm_burst: { name: 'Ceset Patlatma', cd: 35, r: 110, blast: 58, dmg: 70, pct: 0.08, poison: [8, 3], col: '170,255,90', unlock: 19,
    desc: 'Seçtiğin alandaki cesetler patlar: her biri çevresine ağır hasar verir ve zehirler (bosslara yüzdelik hasar yarım)',
    short: 'Alandaki cesetleri patlatır: çevresine ağır hasar ve zehir' },
};
// şapel ağacı (10 Eki): okçular yerine kapıyı tutan Kemik Devi; son kademede Kemik Kolos
Object.assign(CASTLE.levels[0], { title: 'Kara Şapel', perk: 'Mortimer çayını içiyor. Yükselt: kapıya Kemik Devi', archers: 0 });
Object.assign(CASTLE.levels[1], { title: 'Kemik Devi', cost: 200, perk: 'Kapıyı Kemik Devi korur: alan vuruşu, 3 düşmanı birden durdurur; ölürse 30 sn sonra kalkar', archers: 0,
  giant: { hp: 900, dmg: [22, 34], armor: 0.45, block: 3, respawn: 30 } });
Object.assign(CASTLE.levels[2], { title: 'Kemik Kolos', cost: 300, perk: 'Dev büyür: daha çok can ve hasar, 4 düşmanı durdurur, yeri döverek sersemletir, 15 sn\'de kalkar', archers: 0,
  giant: { hp: 1300, dmg: [32, 48], armor: 0.5, block: 4, stomp: true, k: 1.18, respawn: 15 } }); // Mortimer saldırmaz (Caner: ana karakter)

const LEVEL_BOSS = ['goblin_king', 'wolf_alpha', 'orc_warlord', 'dark_shaman', 'death_knight', 'troll_king', 'wolf_alpha', 'dark_shaman', 'death_knight', 'overlord',
  'raider_chief', 'raider_chief', 'scorpion_queen', 'scorpion_queen', 'mummy_king', 'worm_king', 'mummy_king', 'mummy_king', 'golem_titan', 'storm_djinn'];
// boss gücü kademesi: 1. seferde bölüm sırası; 2. sefer 1. seferin sonlarından başlar, yavaşça yükselir
// 2. sefer 1. seferin sonlarından (kademe 3) başlar, 6'ya çıkar
LEVELS.forEach((lv, i) => { lv.ep = lv.ep || 1; const k = LEVELS.filter((o, j) => j < i && o.ep === lv.ep).length; lv.tier = lv.ep === 2 ? 3 + k * 3 / 14 : k * 4 / 14; });
// ----- dalga düzeni -----
// Her dalga bir öncekinden WAVE_GROW, son dalga LAST_GROW kat kalabalık. Bölümün toplam düşman sayısı
// yaklaşık WAVE_TOTAL katında kalır (yuvarlama ve ağır birimlerle biraz artar) ve dalgalara bu oranla dağıtılır (ilk dalgalar hafifler, sonrakiler büyür).
// Ağır birimler (canı HEAVY_HP üstü) çoğaltılmaz; artış hafif birimlerle yapılır.
// Karışım: aynı yoldaki iki grup bazen tek karma akışa dönüşür (ör. ork-goblin-ork...), büyük gruplar bazen
// 3-4'lük paketler halinde gelir. Dağılım her bölüm için sabittir (tohumlu rastgele).
// DENSITY: hafif düşman sayısı çarpanı; dalga süresi aynı kalır, düşmanlar zamana daha seyrek yayılır.
const WAVE_GROW = 1.2, LAST_GROW = 1.3, WAVE_TOTAL = 0.85, DENSITY = 0.8, HEAVY_HP = 600, MIX_CHANCE = 0.5, PACK_CHANCE = 0.4;
function shapeWaves(lv, li) {
  let seed = ((li + 1) * 2654435761) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const heavy = (g) => ENEMIES[g.t].hp >= HEAVY_HP || ENEMIES[g.t].elite; // seçkinler (paladin, engizitör) dalga büyüdükçe çoğalmaz
  const count = (w) => w.reduce((a, g) => a + g.n, 0);
  // hızlılar (süvari, köpek, suikastçı, tazı) kalabalıklaşan dalgada yarı oranda çoğalır: hızlı sürü kaleyi bir anda eritmesin
  const fast = (g) => ENEMIES[g.t].speed >= 34;
  const N = lv.waves.length, orig = lv.waves.map(count);
  // lv.total + lv.grow (necro bölümleri): toplam düşman sayısı ve dalga büyümesi doğrudan verilir
  const GROW = lv.grow || WAVE_GROW, LGROW = lv.grow || LAST_GROW, DENS = lv.total ? 1 : DENSITY;
  const shape = [1];
  for (let k = 1; k < N; k++) shape.push(shape[k - 1] * (k === N - 1 ? LGROW : GROW));
  const A = (lv.total || orig.reduce((a, b) => a + b) * WAVE_TOTAL) / shape.reduce((a, b) => a + b);
  let prev = 0;
  lv.waves.forEach((w, k) => {
    let target = Math.max(4, Math.round(A * shape[k]));
    if (k) target = Math.max(target, Math.ceil(prev * (k === N - 1 ? LGROW : GROW)));
    const light = w.filter(g => !heavy(g)), hc = count(w.filter(heavy)), lc = count(light);
    if (lc) {
      const f = Math.max(0.15, (target - hc) / lc);
      // aralık kısmen kısalır: kalabalık dalga daha sık gelir ama süresi de uzar (kuleler bir anda boğulmasın)
      for (const g of light) { const fg = fast(g) && f > 1 ? 1 + (f - 1) * 0.5 : f, n2 = Math.max(1, Math.round(g.n * fg)); g.gap = Math.max(0.4, g.gap * Math.sqrt(g.n / n2)); g.n = n2; }
      let diff = target - count(w);
      const slow = light.filter(g => !fast(g)), big = (slow.length ? slow : light).reduce((a, g) => (g.n > a.n ? g : a), (slow.length ? slow : light)[0]);
      if (slow.length || diff < 0) big.n = Math.max(1, big.n + diff); // yalnız hızlılardan oluşan dalga küçük kalır
      // kalabalıklaşan dalgada hafif düşmanlar biraz zayıflar, seyrelen dalgada güçlenir (karekök oranında):
      // iki kat kalabalık dalga her biri %30 daha az canlı, toplamda yine %40 daha güçlü
      const r = (count(w) - hc) / lc;
      for (const g of light) g.hpK = Math.min(1.4, Math.max(0.6, 1 / Math.sqrt(r)));
    }
    prev = count(w);
    for (const g of light) { const n2 = Math.max(1, Math.round(g.n * DENS)); g.gap = g.gap * g.n / n2; g.n = n2; }
    // karma akış: aynı yoldaki iki hafif grup birleşir, türler sırayla karışık gelir
    const byPath = {};
    for (const g of light) (byPath[g.p || 0] = byPath[g.p || 0] || []).push(g);
    for (const gs of Object.values(byPath)) {
      if (gs.length < 2 || rnd() > MIX_CHANCE) continue;
      const [a, b] = gs.sort((x, y) => y.n - x.n);
      const n = a.n + b.n, types = [];
      for (let i = 0, ia = 0, ib = 0; i < n; i++) {
        const takeA = ib >= b.n || (ia < a.n && ia / a.n <= ib / b.n);
        types.push(takeA ? a.t : b.t); takeA ? ia++ : ib++;
      }
      a.types = types; a.n = n; a.gap = Math.max(0.28, Math.min(a.gap, b.gap) * 0.9); a.at = Math.min(a.at || 0, b.at || 0);
      w.splice(w.indexOf(b), 1);
    }
    // paketler: büyük grup 3-4'lük kümeler halinde gelir (küme içi sık, kümeler arası boşluk)
    for (const g of w) if (!heavy(g) && g.n >= 6 && rnd() < PACK_CHANCE) g.pack = rnd() < 0.5 ? 3 : 4;
  });
}
// Yolun son kısmı: kapıdan 60 px yakındaki noktalar atılır, yol şapelin önüne inip kapıya alttan girer
function gateApproach(pts) {
  const E = pts[pts.length - 1];
  const keep = pts.slice(0, -1).filter(p => Math.hypot(p[0] - E[0], p[1] - E[1]) > 60);
  return keep.concat([[E[0] - 38, E[1] + 50], [E[0] - 14, E[1] + 36], E]);
}
// Yol düzeni: giriş sayısı, kale yeri (yolun ucunda kapı) ve dalga gruplarının girişlere dağıtımı
LEVELS.forEach((lv) => {
  const alts = new Set();
  for (const k in lv.routes || {}) for (const i of lv.routes[k]) if (i !== +k) alts.add(i);
  lv.entr = lv.paths.length - alts.size;
  const end = lv.paths[0][lv.paths[0].length - 1];
  // şapelin kapısı önden açılır: yol son kısımda şapelin önüne iner, çitin açıklığından geçip kapıya alttan girer
  lv.paths = lv.paths.map(gateApproach);
  lv.castle = [end[0], end[1]]; // kapı eşiği = yolun ucu (game.js castlePlace şapeli buna göre koyar)
  lv.waves.forEach((w, k) => w.forEach((g, j) => { g.p = lv.entr > 1 ? (g.p != null ? g.p % lv.entr : (k + j) % lv.entr) : 0; }));
});
LEVELS.forEach((lv, i) => shapeWaves(lv, i));
// Destek birlikleri (davulcu, sancaktar) tek başına gelmez: yalnız kalabalık piyade bölüğünün (en az SUPPORT.min kişi) ortasında,
// bölükle aynı yoldan ve aynı anda yürür. Bölük büyükse (2 x min) ikisi birden; tür sırası bölükten bölüğe değişir.
const SUPPORT = { min: 10, inf: ['legion', 'legion_k', 'legion_y', 'heavy', 'gladiator'], units: [['drummer', 2], ['signifer', 4]] };
LEVELS.forEach((lv, li) => {
  if (!lv.ep || lv.ep !== 1) return;
  const avail = SUPPORT.units.filter(([, from]) => li >= from).map(([t]) => t);
  if (!avail.length) return;
  let turn = li;
  lv.waves.forEach((w) => {
    for (const g of w.slice()) {
      const kinds = g.types || [g.t], inf = kinds.filter(t => SUPPORT.inf.includes(t)).length;
      if (g.n < SUPPORT.min || inf < kinds.length * 0.6) continue; // kalabalık ve çoğu piyade olan bölük
      const m = Math.min(avail.length, g.n >= SUPPORT.min * 2 ? 2 : 1);
      for (let j = 0; j < m; j++) {
        const t = avail[(turn + j) % avail.length];
        w.push({ t, n: 1, gap: 1, at: (g.at || 0) + g.gap * g.n * (0.35 + 0.3 * j), p: g.p, hpK: g.hpK, escort: true });
      }
      turn++;
    }
  });
});
LEVELS.forEach((lv, i) => {
  lv.boss = lv.bossT || LEVEL_BOSS[i];
  const w = lv.waves[lv.waves.length - 1];
  const end = Math.max(...w.map(g => (g.at || 0) + g.gap * (g.n - 1)));
  w.push({ t: lv.boss, n: 1, gap: 1, at: Math.round(end + 6), p: 0 });
});

// Düşmanların hasar kaynaklarına göre zayıflık (>1) ve dirençleri (<1): ok, büyü (yıldırım), top (patlama/ateş), kılıç (askerler)
// Zırh ve büyü direnci bunlara ek olarak ayrıca uygulanır. Kahraman hasarı bundan etkilenmez.
const ENEMY_WK = {
  goblin:  { blast: 1.4, melee: 1.2 },
  wolf:    { arrow: 1.3, blast: 0.6 },
  bandit:  { melee: 0.7, magic: 1.3 },
  orc:     { arrow: 0.7, magic: 1.25 },
  bat:     { arrow: 1.4 },
  shaman:  { arrow: 1.3, melee: 1.3 },
  knight:  { magic: 1.4, blast: 0.75, arrow: 0.8 },
  troll:   { blast: 1.4, arrow: 0.6 },
  goblin_king:  { blast: 1.3, melee: 1.2 },
  wolf_alpha:   { arrow: 1.25, blast: 0.6 },
  orc_warlord:  { arrow: 0.6, melee: 0.8, magic: 1.3 },
  dark_shaman:  { magic: 0.5, arrow: 1.3 },
  death_knight: { magic: 1.35, arrow: 0.6, blast: 0.7 },
  troll_king:   { blast: 1.4, arrow: 0.6 },
  overlord:     { magic: 0.75, arrow: 0.75, melee: 0.85, blast: 1.15 },
};
for (const k in ENEMY_WK) if (ENEMIES[k]) ENEMIES[k].wk = ENEMY_WK[k];
const WK_NAME = { arrow: 'Ok', magic: 'Yıldırım', blast: 'Top', melee: 'Kılıç' };

// yeni düşman tanıtım kartları için kısa açıklamalar
Object.assign(ENEMY_WK, {
  raider: { melee: 1.2, blast: 1.2 }, scorpion: { magic: 1.35, arrow: 0.75 }, vulture: { arrow: 1.4 }, camel: { melee: 1.3, arrow: 1.15 },
  sandworm: { blast: 1.4, arrow: 0.8 }, mummy: { blast: 1.3, magic: 1.15, arrow: 0.8 }, djinn: { arrow: 1.35, magic: 0.85 }, golem: { magic: 1.45, arrow: 0.6, melee: 0.7 },
  raider_chief: { melee: 1.1 }, scorpion_queen: { magic: 1.3, arrow: 0.7 }, worm_king: { blast: 1.3, arrow: 0.8 }, mummy_king: { blast: 1.3 }, golem_titan: { magic: 1.35, arrow: 0.6 },
  storm_djinn: { arrow: 1.15, magic: 0.8, blast: 0.9 },
});
const ENEMY_DESC = {
  raider: 'Kalabalık gelen çöl piyadesi', scorpion: 'Zırhlı ve hızlı: büyücü kulesi kullan', vulture: 'Uçar: yalnızca okçu ve büyücü vurur',
  camel: 'Hızlı ve dayanıklı; ölünce süvarisi yaya devam eder', sandworm: 'Kuma gömülür: gömülüyken vurulamaz, top yüzeye çıkınca iyi vurur',
  mummy: 'Bir kez dirilir; top ve göktaşıyla ölürse dirilmez', djinn: 'Uçan cin: ileri ışınlanır, yakındakilere kalkan verir',
  golem: 'Taş muhafız: çok kalın zırh, sersemlemez. Büyü kullan',
  goblin: 'Zayıf ama kalabalık gelir', wolf: 'Çok hızlı koşar, askerlerin yanından kaçabilir', bandit: 'Dayanıklı yakın dövüşçü',
  orc: 'Zırhlı: büyü ve top hasarı işe yarar', bat: 'Uçar: yalnızca okçu ve büyücü kulesi vurur', shaman: 'Yakındaki düşmanları iyileştirir, büyüye dirençli',
  knight: 'Çok kalın zırh: büyücü kulesi kullan', troll: 'Dev boss: kaleden 5 can götürür',
};

// ----- yıldız gelişmeleri (bölüm haritasındaki GELİŞMELER ekranı) -----
// Toplanan yıldızlarla kalıcı güçlendirmeler alınır; her satırda 3 kademe sırayla açılır. İstenince sıfırlanabilir.
// Yıldız gelişmeleri: kademe fiyatı 2 + 3 + 5 = 10 yıldız; hepsi 60 yıldız = bölgenin bütün yıldızları (3 yıldız + Kahramanlık)
const UPGRADES = [
  { id: 'archer',   name: 'Okçular',   ranks: [{ cost: 2, desc: '+%10 hasar' }, { cost: 3, desc: '+%10 menzil' }, { cost: 5, desc: '+%15 hasar' }] },
  { id: 'barracks', name: 'Kışla',     ranks: [{ cost: 2, desc: '+%20 asker canı' }, { cost: 3, desc: '+%20 asker hasarı' }, { cost: 5, desc: '+%15 zırh, hızlı doğma' }] },
  { id: 'mage',     name: 'Büyücüler', ranks: [{ cost: 2, desc: '+%10 hasar' }, { cost: 3, desc: '+%10 menzil' }, { cost: 5, desc: '+%15 hasar' }] },
  { id: 'artillery',name: 'Toplar',    ranks: [{ cost: 2, desc: '+%10 hasar' }, { cost: 3, desc: '+%15 patlama alanı' }, { cost: 5, desc: '+%15 hasar' }] },
  { id: 'spells',   name: 'Güçler',    ranks: [{ cost: 2, desc: '+%20 kahraman gücü hasarı' }, { cost: 3, desc: '+1 paralı asker' }, { cost: 5, desc: 'Güçler ve paralı askerler %25 hızlı' }] },
  { id: 'castle',   name: 'Kale',      ranks: [{ cost: 2, desc: '+3 can' }, { cost: 3, desc: '+60 altın' }, { cost: 5, desc: '+3 can, +60 altın' }] },
];
// Oyun tek, sabit zorlukta oynanır
// gold: başlangıç altını çarpanı, bounty: düşman ödülü ve erken çağrı bonusu çarpanı (kazanç)
const GAME_DIFF = { hp: 1.0, gold: 1, bounty: 0.8, lives: 20 }; // tek kahramana geçince düşman canı 1.15'ten 1.0'a indi

// Her kahramanın 3 yeteneği vardır (sade tutmak için); kahraman 4. seviyeye kadar çıkar, her seviyede 1 puan kazanır.
const HERO_SKILLS = {
  commander: ['bash', 'whirl', 'cry'],
  zeynep: ['volley', 'multishot', 'blastarrow'],
};
// (spartacus ve leonidas yollarını kendileri tanımlar: aynı yetenek kimlikleri, kendi adları)
for (const id in HERO_SKILLS) {
  const all = HEROES[id].paths.flatMap(p => p.skills);
  HEROES[id].paths = [{ name: 'Yetenekler', col: '#ffd34d', skills: HERO_SKILLS[id].map(k => all.find(s => s.id === k)) }];
}

// Kingdom Rush usulü: kule her seviyede yeni bir ad alır
const TOWER_TITLES = {'archer': ['Okçu Kulesi', 'Nişancı Kulesi', 'Keskin Nişancı Kalesi'], 'barracks': ['Milis Kışlası', 'Piyade Kışlası', 'Şövalye Kışlası'], 'mage': ['Çırak Kulesi', 'Büyücü Kulesi', 'Yıldırım Ustası Kulesi'], 'artillery': ['Topçu Kulesi', 'Ağır Topçu', 'Büyük Bombard']};
for (const k in TOWER_TITLES) TOWERS[k].levels.forEach((L, i) => { L.title = TOWER_TITLES[k][i]; });
// Uzmanlık: son seviyede iki yetenekten biri seçilir (ilk alınan yetenek yolu belirler, diğeri kapanır).
// Seçilen yol kulenin adını ve görünüşünü değiştirir: askerlerin kostümü, okçuların kıyafeti, kule süsleri.
// 4. kademe dönüşümlerinin ikinci gücü (10 Eki): uzmanlık seçildikten sonra tek seferlik alınır, bekleme süresiyle kendiliğinden çalışır
const TOWER_EXTRA = {
  bow:    { name: 'Ok Yağmuru',       cost: 220, cd: 11, desc: 'Okçular göğe 18 ok salar, kalabalığın üstüne yağar' },
  fan:    { name: 'Delici Cıvata',    cost: 240, cd: 10, desc: 'Dev bir cıvata hattaki bütün düşmanları delip geçer: ağır hasar, zırhı yok sayar' },
  drain:  { name: 'Ruh Dalgası',      cost: 230, cd: 8,  desc: 'En güçlü düşmanın çevresinde ruh patlar; yakındaki iskeletler iyileşir' },
  ghost:  { name: 'Hayalet Zincirler', cost: 240, cd: 9, desc: '4 düşmanı hayalet zincirleriyle bağlar: 1,6 sn sersemletir' },
  corpse: { name: 'Ceset Yağmuru',    cost: 250, cd: 11, desc: '3 ek ceset yığını fırlatır, her biri çevresine de vurur' },
  plague: { name: 'Veba Sisi',        cost: 230, cd: 10, desc: 'Kalabalığın üstüne veba sisi çöker: 5 sn güçlü zehir' },
  rite:   { name: 'Kan Ayini',        cost: 220, cd: 14, desc: 'Menzildeki iskeletler %40 iyileşir, 6 sn %50 sert vurur' },
  blight: { name: 'Çürük Dokunuş',    cost: 240, cd: 9,  desc: 'Menzildeki herkes 5 sn ağır lanetlenir ve zehirlenir' },
};
const SPEC = {
  fan:    { title: 'Ağır Arbaletçiler', who: 'İki kızıl arbaletçi: yavaş, ağır, zırh delen cıvata' }, // 11 Eki: okçu / arbaletçi yolu
  bow:    { title: 'Hayalet Okçular', who: 'Üç kızıl okçu: çok sık, yüksek kavisli oklar' },
  drain:  { title: 'Ruh Emici', who: 'Kristalden ışın: aynı hedefe güçlenir, canı iskeletlere aktarır' }, // 10 Eki: 4. kademe
  ghost:  { title: 'Ruh Kafesi', who: 'En güçlüyü kafese kapatır, kafesten hayaletler salar' },
  corpse: { title: 'Ceset Mancınığı', who: 'Cesetleri cephane yapan kazan' },
  plague: { title: 'Kara Veba Kazanı', who: 'Ölümle yayılan kara veba' },
  shield: { title: 'Muhafız Kışlası', who: 'Muhafızlar: ağır plaka zırh, kule kalkanı' },
  blade:  { title: 'Akıncı Ocağı',    who: 'Akıncılar: hafif zırh, çift kılıç' },
  poison: { title: 'Zehir Avcıları',  who: 'Maskeli avcılar, yeşil zehirli oklar' },
  snipe:  { title: 'Kartal Göz Kalesi', who: 'Şapkalı nişancılar, uzun kara yay' },
  frost:  { title: 'Ayaz Kulesi',     who: 'Buz kristalleri, mavi küre' },
  blast:  { title: 'Arkan Kulesi',    who: 'Mor arkan küre, dönen rünler' },
  napalm: { title: 'Ateş Bataryası',  who: 'Kızgın namlu, alevli sancaklar' },
  double: { title: 'İkiz Toplar',     who: 'Yan yana iki top' },
};

// Necromancer seferi: zayıflık / direnç
Object.assign(ENEMY_WK, {
  legion: { magic: 1.2 }, solarcher: { melee: 1.3, arrow: 1.2 }, gladiator: { arrow: 1.2, blast: 1.2 }, assassin: { blast: 1.3, melee: 0.8 },
  priest: { arrow: 1.3 }, heavy: { magic: 1.4, arrow: 0.6 }, cavalry: { melee: 0.8, blast: 1.2 }, ram: { blast: 1.4, arrow: 0.5, magic: 0.8 },
  catapult: { blast: 1.3, melee: 1.2 },
  wardog: { blast: 1.4, melee: 1.2 }, chariot: { magic: 1.3, melee: 0.6 }, siegetower: { blast: 1.3, arrow: 0.5 }, eagle: { arrow: 1.4, magic: 1.1 }, vulture: { arrow: 1.4, magic: 1.1 }, elephant: { magic: 1.3, arrow: 0.7, melee: 0.8 },
  horsearcher: { arrow: 1.2, magic: 1.2 }, testudo: { arrow: 0.3, blast: 1.8, magic: 1.1 }, sunpriest: { arrow: 1.3, melee: 1.2 },
  signifer: { magic: 1.2, melee: 1.2 }, drummer: { arrow: 1.2, blast: 1.2 }, centurion: { magic: 1.2 }, champion: { arrow: 1.2 }, shadowmaster: { blast: 1.3 }, cavcaptain: { blast: 1.2 },
  gloriosus: { magic: 0.85, arrow: 0.85, blast: 1.1 },
});

// Necromancer seferi: düşman açıklamaları (tanıtım kartı ve dokununca açılan panel)
Object.assign(ENEMY_DESC, {
  legion: 'Kalkanlı piyade, kalabalık gelir. Ruh ışını kalkanını deler',
  solarcher: 'Durup iskeletlere ok atar. Zırhsız: oklar ve kılıç iyi işler',
  gladiator: 'Çevik arena dövüşçüsü, iskeletleri hızla keser. Ok ve veba işler',
  assassin: 'Çok hızlı, ara ara gölgeye dalıp ileri atlar. Vebanın alanından kaçamaz',
  priest: 'Yakınındakileri iyileştirir, büyüye dirençli. Önce onu okla vur',
  heavy: 'Kalkan duvarı: oklar seker. Ruh ışını zırhını deler',
  cavalry: 'Hızlı atlı, kuleye 2 can götürür. Veba atı ürkütür',
  ram: 'Çok yavaş, çok canlı; kapıya varırsa 3 can götürür. Veba kazanı kullan',
  catapult: 'Durup kulelerimize taş atar, 3 sn susturur. Önce onu durdur',
  wardog: 'Sürüyle gelir, çok hızlıdır ama canı azdır. Veba kazanı sürüyü dağıtır',
  chariot: 'Çok hızlı; iskeletleri ezip geçer, durduramazlar. Kemik duvar durdurur',
  siegetower: 'Ağır ve yavaş; yıkılınca içinden 6 lejyoner dökülür. Yolun başında yık',
  eagle: 'Uçar: iskeletler ve kazanlar vuramaz. Kemik Kulesi ve Ruh Feneri vurur',
  horsearcher: 'Koşarken iskeletlere ok atar, iskeletler onu durduramaz. Kemik duvar durdurur',
  testudo: 'Kalkan çatısı: oklar neredeyse işlemez. Veba kazanı dağıtır; ölünce 3 lejyonere ayrılır',
  sunpriest: 'Çevresindeki cesetleri yakar (diriltilemez), dirilen ölülere ışıkla vurur. Önce onu indir',
  signifer: 'Sancağı çevresindeki düşmanlara zırh verir. Ruh ışını ve iskeletler iyi işler',
  vulture: 'Sürüyle uçar, cesetleri yer: yediği ölü diriltilemez, akbaba iyileşir. Kemik Kulesi ve Ruh Feneri vurur',
  elephant: 'Dev ve zırhlı: iskeletleri ezip geçer, sırtındaki okçu yürürken ok atar. Kemik duvar durdurur, ruh ışını iyi işler',
  drummer: 'Davuluyla çevresindekileri gaza getirir: daha hızlı yürür, daha sert vururlar. Zırhsız, ok ve veba iyi işler',
});
// Sefer 2 düşmanlarının zayıflıkları ve açıklamaları (tanımlar yukarıda, SEFER 2 bölümünde)
if (NECRO) {
  Object.assign(ENEMY_WK, {
    hunter: { melee: 1.3, arrow: 1.2 }, torch: { arrow: 1.2, blast: 1.2 }, hound: { blast: 1.4, melee: 1.2 }, holywater: { arrow: 1.3, melee: 1.2 },
    flagellant: { magic: 1.3, arrow: 1.1 }, lantern: { blast: 1.3, magic: 1.2, arrow: 0.6 }, bellpriest: { arrow: 1.3 }, paladin: { arrow: 0.7, blast: 1.2, melee: 0.8 },
    inquisitor: { melee: 1.3, arrow: 1.2 }, saint: { arrow: 0.4, blast: 1.4, magic: 1.1 },
    malleus: { melee: 1.2 }, campanus: { arrow: 1.2 }, ignis: { arrow: 1.2 }, colossus: { arrow: 0.5, blast: 1.3 }, severus: { melee: 1.2 }, cathedral: { blast: 1.3, arrow: 0.5 },
  });
  Object.assign(ENEMY_DESC, {
    hunter: 'Gümüş arbaletle iskeletleri uzaktan avlar. Zırhı ince: iskeletlerle üstüne bas',
    torch: 'Geçtiği yerdeki cesetleri yakar (diriltilemez), dirilen ölüleri ateşe verir. Önce onu indir',
    hound: 'Sürüyle ve çok hızlı koşar, canı azdır. Veba kazanı sürüyü dağıtır',
    holywater: 'Kutsal su şişesi atar: çarptığı yerdeki iskeletlere alan hasarı. Okla erken vur',
    flagellant: 'Canı azaldıkça hızlanır ve sertleşir. Ruh ışınıyla tek seferde bitir',
    lantern: 'Fenerin ışığında iskeletler zayıflar, ceset diriltilemez, lanet tutmaz. Önce feneri söndür',
    bellpriest: 'Çanını çalar: çevresindeki iskeletler sersemler. Menzilden vur',
    paladin: 'Ağır zırh, büyüye dirençli, kalkanıyla iskeletleri durdurur. Kazan ve lanet iyi işler',
    inquisitor: 'Bir kuleyi sorguya çeker: 4 sn susar. İskeletler ve ok iyi işler',
    saint: 'Canlanan taş heykel: oklar seker, lanet tutmaz. Veba kazanı ve büyüler işler',
  });
}
// Özel saldırılar (10 Eki): orta güçteki düşmanların alternatif saldırısı (alt) ve bossların ek yetenekleri (ab).
// game.js doAlt / bossAbilities. Rütbeli kopyalar (kıdemli, yüzbaşı) bunları devralır (aşağıda kopyalanırlar).
if (NECRO) {
  const ALT = {
    gladiator: { kind: 'net', cd: 9, stun: 2.5, note: 'Ara ara iskelete ağ atar (2,5 sn kımıldayamaz)' },
    heavy: { kind: 'bash', cd: 7, stun: 1.2, mul: 1.3, note: 'Kalkan darbesiyle iskeleti sersemletir' },
    assassin: { kind: 'poison', cd: 8, dps: 6, t: 4, note: 'Zehirli hançer: iskelet bir süre zehirlenir' },
    cavalry: { kind: 'charge', cd: 8, d: 26, stun: 0.9, mul: 1.2, note: 'Hücumla iskeleti geri savurur' },
    solarcher: { kind: 'burn', ranged: true, cd: 7, dps: 5, t: 3, note: 'Ateşli ok atar: iskelet yanar' },
    hunter: { kind: 'net', ranged: true, cd: 10, stun: 1.8, note: 'Gümüş ağ fırlatır' },
    torch: { kind: 'burn', cd: 6, dps: 7, t: 3, note: 'Meşalesiyle iskeleti tutuşturur' },
    flagellant: { kind: 'whirl', cd: 7, r: 34, mul: 0.8, note: 'Kırbacını savurur: çevresindeki bütün iskeletlere vurur' },
    paladin: { kind: 'bash', cd: 6, stun: 1.4, mul: 1.2, note: 'Kalkan darbesiyle sersemletir' },
    hound: { kind: 'charge', cd: 6, d: 16, stun: 0.6, mul: 1, note: 'Atılıp iskeleti devirir' },
    saint: { kind: 'bash', cd: 8, stun: 1.5, mul: 1.5, note: 'Taş kılıcıyla ezer, sersemletir' },
  };
  for (const t in ALT) { const { note, ...a } = ALT[t]; ENEMIES[t].alt = a; if (ENEMY_DESC[t]) ENEMY_DESC[t] += '. ' + note; }
  const AB = {
    centurion: { volley: { cd: 10, n: 3, dmg: 14, stun: 0.8, r: 150, say: 'Pilum!' } },
    champion: { net: { cd: 9, n: 2, stun: 3, r: 120, say: 'Arena Ağı!' } },
    shadowmaster: { burn: { cd: 11, r: 70, dps: 8, t: 4, poison: true, say: 'Zehir Bulutu!' } },
    cavcaptain: { charge: { cd: 9, d: 30, dmg: 25, stun: 1.2, say: 'Süvari Hücumu!' } },
    hierophant: { smite: { cd: 9, r: 160, dmg: 45, say: 'İlahi Ceza!' } },
    ironwarden: { whirl: { cd: 8, r: 50, dmg: 28, say: 'Kalkan Fırtınası!' } },
    gloriosus: { volley: { cd: 9, n: 5, dmg: 18, stun: 1, r: 170, say: 'Lejyon, Atış!' } },
    malleus: { net: { cd: 10, n: 2, stun: 2.5, r: 140, say: 'Gümüş Ağ!' } },
    campanus: { whirl: { cd: 9, r: 55, dmg: 30, say: 'Çekiç Savurma!' } },
    ignis: { burn: { cd: 9, r: 80, dps: 10, t: 4, say: 'Arınma Ateşi!' } },
    colossus: { charge: { cd: 10, d: 34, dmg: 40, stun: 1.5, say: 'Taş Hücum!' } },
    severus: { smite: { cd: 8, r: 200, dmg: 55, say: 'Hüküm!' } },
  };
  for (const t in AB) ENEMIES[t].ab = Object.assign({}, ENEMIES[t].ab, AB[t]);
}

// Necromancer: kule seviye unvanları ve uzmanlık adları
if (NECRO) {
  Object.assign(TOWER_TITLES, { archer: ['Kemik Kulesi', 'Kemik Nişancılar', 'Ölüm Nişancıları'], barracks: ['Mahzen', 'Kemik Mahzeni', 'Kara Türbe'],
    mage: ['Ruh Feneri', 'Ruh Kafesi', 'Ruhlar Feneri'], artillery: ['Veba Kazanı', 'Kaynayan Veba Kazanı', 'Büyük Veba Kazanı'] });
  for (const k in TOWER_TITLES) TOWERS[k].levels.forEach((L, i) => { L.title = TOWER_TITLES[k][i]; });
  Object.assign(SPEC.shield, { title: 'Mezar Bekçileri', who: 'Tabut kalkanlı, dev topuzlu iskeletler' });
  Object.assign(SPEC.blade, { title: 'Ölüm Şövalyeleri', who: 'Yeşil alevli çift kemik kılıç' });
  Object.assign(SPEC.poison, { title: 'Veba Kemiği', who: 'Zehirli yeşil kıymıklar' });
  Object.assign(SPEC.snipe, { title: 'Kemik Mızrak', who: 'Uzun menzilli dev kemik mızrak' });
  Object.assign(SPEC.frost, { title: 'Lanet Feneri', who: 'Düşmanları donduran soğuk lanet' });
  Object.assign(SPEC.blast, { title: 'Ruh Fırtınası', who: 'Kalabalığa patlayan ruh dalgası' });
  Object.assign(SPEC.napalm, { title: 'Çürüme Bulutu', who: 'Daha büyük, uzun süren gaz' });
  Object.assign(SPEC.double, { title: 'Çifte Kazan', who: 'Her atışta ikinci veba' });
  TOWERS.archer.levels[0].perk = '1 iskelet okçu kemik ok atar · uçanları da vurur';
  TOWERS.archer.levels[1].perk = '2. kademede yolunu seç: okçular (hızlı, hafif) ya da arbaletçiler (yavaş, ağır)';
  TOWERS.archer.levels[2].perk = '3 nişancı, çok hızlı atış · %15 kritik vuruş · çok daha uzun menzil';
  TOWERS.mage.levels[1].perk = 'Daha hızlı yükleme · ruh soğuğu: vurduğunu 1 sn %30 yavaşlatır';
  TOWERS.mage.levels[2].perk = 'Hızlı yükleme · ruh zinciri: yakındaki ikinci düşmana %60 hasar';
}

// ----- Lanet Kulesi (3. bölümde açılır; eski Kan Sunağı yuvası 'altar'): saldırmaz; haritada YALNIZ BİR tane kurulur -----
// 10 Eki (Caner, 2. tasarım): menzilindeki
//   düşmanlar: lanetlenir (curse: her kaynaktan fazla hasar · res: zırh ve dirençler kırılır · weak: saldırıları yavaşlar),
//     yürürken yavaşlar (slow), girişte belli bir şansla korkuya kapılıp geri kaçar (fear). Alandan çıkınca lanet 10 sn daha sürer (linger).
//   iskeletler (mahzen askerleri, dirilen ölüler): daha sert vurur (ally), daha az hasar alır (allyArm);
//   menzildeki Kemik Kuleleri: okçu/arbaletçiler daha sert vurur (ally). rise: lanetli ölürse çürümüş ölü olarak dirilme şansı.
if (NECRO) {
  TOWERS.altar = {
    name: 'Lanet Kulesi', icon: 'altar', dmgType: 'none', air: false, support: true, unlockLevel: 2, unique: true,
    desc: 'Haritada tek kurulur. Düşmanları lanetler (fazla hasar alır, savunması düşer, saldırısı yavaşlar, korkabilir), iskeletleri ve okçuları güçlendirir',
    levels: [
      { cost: 110, range: 130, every: 1.2, linger: 10, curse: 0.1,  res: 0.3,  weak: 0.12, slow: 0.12, fear: 0.06, ally: 0.1,  allyArm: 0.08, rise: 0.08, title: 'Lanet Kulesi',
        perk: 'Düşmanlar %10 fazla hasar alır, savunması %30 düşer, saldırısı %12 yavaşlar · %6 korku · iskelet ve okçulara +%10 hasar · lanet 10 sn sürer' },
      { cost: 150, range: 150, every: 1.2, linger: 10, curse: 0.14, res: 0.4,  weak: 0.16, slow: 0.15, fear: 0.09, ally: 0.14, allyArm: 0.12, rise: 0.12, title: 'Lanet Sütunu',
        perk: '%14 fazla hasar · savunma %40 düşer · saldırı %16 yavaş · %9 korku · iskelet ve okçulara +%14 hasar, iskeletlere +%12 zırh' },
      { cost: 200, range: 170, every: 1.2, linger: 10, curse: 0.18, res: 0.5,  weak: 0.2,  slow: 0.18, fear: 0.12, ally: 0.18, allyArm: 0.15, rise: 0.16, title: 'Kara Lanet Mabedi',
        perk: '%18 fazla hasar · savunma %50 düşer · saldırı %20 yavaş · %12 korku · iskelet ve okçulara +%18 hasar, iskeletlere +%15 zırh · ölürse %16 dirilir' },
    ],
    abilities: [
      { id: 'rite', name: 'Kan Ayini', desc: (r) => `Kule Kan Mabedine dönüşür: kâseden kızıl bağlar · Menzildeki kulelere +%${Math.round(r.rate * 100)} atış hızı ve +%${Math.round(r.dmg * 100)} hasar`,
        ranks: [{ cost: 150, rate: 0.15, dmg: 0.1 }, { cost: 200, rate: 0.25, dmg: 0.18 }, { cost: 260, rate: 0.35, dmg: 0.25 }] },
      { id: 'blight', name: 'Kara Lanet', desc: (r) => `Kule Kara Lanet Mabedine dönüşür: lanetliler ölünce +%10 kalkma şansı · Lanetli ölünce lanet en yakın ${r.n} düşmana sıçrar (menzil dışında da, 4 sn)`,
        ranks: [{ cost: 140, n: 2 }, { cost: 190, n: 3 }, { cost: 240, n: 4 }] },
    ],
  };
  TOWER_ORDER.push('altar');
  Object.assign(SPEC, { rite: { title: 'Kan Ayini Mabedi', who: 'Kulelere hız ve güç veren kan ritüeli' }, blight: { title: 'Kara Lanet Mabedi', who: 'Ölümle yayılan lanet' } });
}

// necro teması: yıldız gelişmeleri ve hasar türü adları (eski kule/kale adlarının yerine)
if (NECRO) {
  const U = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
  U.archer.name = 'Kemik Kuleleri'; U.barracks.name = 'Mahzenler'; U.mage.name = 'Ruh Fenerleri'; U.artillery.name = 'Veba Kazanları';
  U.barracks.ranks[0].desc = '+%20 iskelet canı'; U.barracks.ranks[1].desc = '+%20 iskelet hasarı';
  U.artillery.ranks[1].desc = '+%15 veba alanı';
  U.spells.name = 'Büyüler';
  U.spells.ranks[0].desc = '+%20 komutan gücü hasarı'; U.spells.ranks[1].desc = 'Dirilen ölüler %25 dayanıklı'; U.spells.ranks[2].desc = 'Büyüler %25 hızlı dolar';
  UPGRADES.splice(UPGRADES.indexOf(U.castle), 1); // şapel yükseltilmez (Caner, 10 Eki): yıldızları iade olur
  Object.assign(WK_NAME, { arrow: 'Delici', magic: 'Ruh', blast: 'Veba/Ateş', melee: 'Kesici' }); // hasar türleri (10 Eki)
}

// ----- Necromancer: zayıflık/direnç bağlama + düşman rütbeleri -----
// Necro düşmanlarının ENEMY_WK değerleri yukarıdaki bağlama döngüsünden sonra eklendiği için burada yeniden bağlanır.
for (const k in ENEMY_WK) if (ENEMIES[k]) ENEMIES[k].wk = ENEMY_WK[k];
// ----- Hasar türleri × zırh sınıfları (10 Eki, Caner onayı) -----
// Dört hasar türü: Delici (ok, cıvata: src 'arrow'), Kesici (iskelet, komutan: 'melee'), Ruh (Ruh Feneri: 'magic'), Veba/Ateş (kazan, yanma: 'blast').
// Her düşmanın bir zırh sınıfı vardır; çarpanlar bu tablodan gelir (eski düşmana özel çarpanların yerine). Zırh/büyü direnci ayrıca işler.
const ARMOR_CLASS = {
  hafif:   { name: 'Hafif',         mult: { arrow: 1.25, melee: 1, magic: 1, blast: 1 } },
  agir:    { name: 'Ağır zırh',     mult: { arrow: 0.6, melee: 0.8, magic: 1.35, blast: 1 } },
  kalkan:  { name: 'Kalkan duvarı', mult: { arrow: 0.5, melee: 1, magic: 1, blast: 1.4 } },
  kutsal:  { name: 'Kutsal',        mult: { arrow: 1, melee: 1.15, magic: 0.6, blast: 1.1 } },
  kusatma: { name: 'Kuşatma',       mult: { arrow: 0.5, melee: 1, magic: 0.8, blast: 1.5 }, immune: ['poison', 'bleed'] }, // makine: zehirlenmez, kanamaz
  canavar: { name: 'Canavar',       mult: { arrow: 1, melee: 0.8, magic: 1, blast: 1.2 } },
};
const CLASS_OF = {
  legion: 'kalkan', testudo: 'kalkan', signifer: 'kalkan', centurion: 'kalkan',
  heavy: 'agir', paladin: 'agir', ironwarden: 'agir', gloriosus: 'agir', cavcaptain: 'agir',
  priest: 'kutsal', sunpriest: 'kutsal', holywater: 'kutsal', bellpriest: 'kutsal', inquisitor: 'kutsal', saint: 'kutsal',
  hierophant: 'kutsal', ignis: 'kutsal', severus: 'kutsal', campanus: 'kutsal', colossus: 'kutsal',
  ram: 'kusatma', catapult: 'kusatma', siegetower: 'kusatma', lantern: 'kusatma', chariot: 'kusatma', cathedral: 'kusatma',
  cavalry: 'canavar', horsearcher: 'canavar', elephant: 'canavar', eagle: 'canavar', vulture: 'canavar',
};
if (NECRO) for (const k in ENEMIES) {
  const d = ENEMIES[k];
  d.acl = CLASS_OF[k] || (d.base && CLASS_OF[d.base]) || (d.machine ? 'kusatma' : d.flying ? 'canavar' : d.armor >= 0.5 ? 'agir' : d.mr >= 0.4 ? 'kutsal' : 'hafif');
  d.wk = Object.assign({}, ARMOR_CLASS[d.acl].mult);
}
// ----- Silah büyüleri (10 Eki): kemik kulesi ve mahzen son kademede tek bir büyü seçer; her vuruş düşmana durum etkisi bırakır -----
const IMBUE_ORDER = ['fire', 'poison', 'frost']; // 10 Eki (Caner): lanet büyüsü yok (Lanet Kulesi var), kanama yok
const IMBUE = {
  fire:   { name: 'Alev',  arrow: 'Alevli Oklar',   melee: 'Alevli Kılıçlar',   col: '255,140,50',  cost: 220, dps: 12, t: 3,
    desc: 'Vurduğu düşman 3 sn yanar: saniyede 12 hasar. Yanan düşman iyileşemez · kuşatma makinelerine +%50' },
  poison: { name: 'Zehir', arrow: 'Zehirli Oklar',  melee: 'Zehirli Kılıçlar',  col: '140,255,90',  cost: 220, dps: 9, t: 5,
    desc: 'Vurduğu düşman 5 sn zehirlenir: saniyede 9 hasar (toplam 45) · makineler zehirlenmez' },
  frost:  { name: 'Buz',   arrow: 'Buzlu Oklar',    melee: 'Buzlu Kılıçlar',    col: '150,215,255', cost: 220, slow: 0.35, t: 1.6, // slow: donana kadarki vuruşlarda (game.js FREEZE)
    desc: 'Vurduğu düşman 2 sn donar · iri düşmanlar 2, komutanlar 3 vuruşta donar' },
};
// ----- Kemik Kulesi yolları (10 Eki, Caner: A seçeneği): 1. kademe iskelet okçu; 2. kademeye yükseltirken okçu ya da arbaletçi yolu seçilir.
// Yol 4. kademe uzmanlığını da belirler (okçu -> Hayalet Okçular, arbaletçi -> Ağır Arbaletçiler). rate/dmg: kademe değerlerine çarpan.
const ARCHER_PATH = {
  bow:  { name: 'Okçu Yolu',      spec: 'bow', rate: 0.65, dmg: 0.68, fly: 1.3, titles: ['Kemik Kulesi', 'Kemik Okçular', 'Ölüm Okçuları'],
    desc: 'Hızlı ve hafif: sık ok, uçanlara +%30 · 4. kademede Hayalet Okçular',
    perks: [null, '2 iskelet okçu, sık atış · uçanlara +%30 · +menzil', '3 okçu, çok sık atış · %15 kritik · çok daha uzun menzil'] },
  xbow: { name: 'Arbaletçi Yolu', spec: 'fan', rate: 1.45, dmg: 1.5, pen: 0.35, titles: ['Kemik Kulesi', 'Kemik Arbaletçiler', 'Ölüm Arbaletçileri'],
    desc: 'Yavaş ve ağır: sert cıvata, zırhın %35 kadarını deler · 4. kademede Ağır Arbaletçiler',
    perks: [null, '2 iskelet arbaletçi, ağır cıvata · zırhın %35 kadarını deler · +menzil', '3 arbaletçi, ağır atış · %15 kritik · çok daha uzun menzil'] },
};
// Rütbeler (tasarim/necromancer-gdd.md): Er (sıradan), Kıdemli (koyu çelik zırh, şarap kırmızısı kumaş, kırmızı sorguç),
// Yüzbaşı (altın kumaş ve sorguç, biraz iri, borazanla çevresini hızlandırır). Görsel aynı resmin yeniden renklendirilmesi (game.js RANK_LOOK).
// Rütbeli türler ayrı düşman kaydıdır: legion_k (Kıdemli Lejyoner), legion_y (Lejyoner Yüzbaşı); base ile asıl türün resmini ve iskeletini kullanır.
const RANKS = [null,
  { id: 'k', name: 'Kıdemli', hp: 1.6, gold: 1.5, dmg: 1.25, armor: 0.05, h: 1.05 },
  { id: 'y', name: 'Yüzbaşı', hp: 2.5, gold: 2.3, dmg: 1.5, armor: 0.1, h: 1.13 },
];
const RANKED = ['legion', 'solarcher', 'gladiator', 'assassin', 'priest', 'heavy', 'cavalry'];
// zaten güçlü olan ağır piyade ve süvarinin rütbelileri yalnız son bölümde (bölüm sırası, 0'dan)
const RANK_FROM = { heavy: 3.5, cavalry: 3.5 }; // ilerleme (lp) cinsinden: 14. bölümden itibaren
if (NECRO) {
  for (const t of RANKED) for (let r = 1; r <= 2; r++) {
    const d = ENEMIES[t], R = RANKS[r];
    ENEMIES[t + '_' + R.id] = Object.assign({}, d, {
      name: r === 1 ? `Kıdemli ${d.name}` : `${d.name} Yüzbaşı`, base: t, rank: r,
      hp: Math.round(d.hp * R.hp), gold: Math.round(d.gold * R.gold), dmg: d.dmg.map(v => Math.round(v * R.dmg)),
      armor: Math.min(0.8, d.armor + R.armor), h: Math.round(d.h * R.h), r: d.r + r,
      wk: d.wk, desc: r === 1 ? `Kıdemli: %60 daha canlı, daha sert vurur. ${ENEMY_DESC[t] || ''}`
        : `Yüzbaşı: 2,5 kat canlı, borazanıyla yakındakileri hızlandırır. ${ENEMY_DESC[t] || ''}`,
    });
    if (r === 2) ENEMIES[t + '_y'].ab = Object.assign({}, d.ab, { howl: { cd: 11, r: 85, say: 'Borazan!', soft: true } });
  }
  // dalgalara rütbe dağıtımı (tohumlu, her oynanışta aynı): 2. bölümden itibaren kıdemliler, 5. bölümde yüzbaşılar.
  // Kıdemli oranı bölüm ve dalga ilerledikçe artar; yüzbaşı her dalgada 1-3 tane.
  LEVELS.forEach((lv, idx) => {
    const li = idx * 4 / 14; // ilerleme: 15 bölüm eski 5 bölümlük eğriye yayılır
    if (idx < 1) return;
    let seed = ((idx + 7) * 2246822519) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    lv.waves.forEach((w, k) => {
      // sırayla rütbe verilecek yerler: [grup, sıra]
      const slots = [];
      for (const g of w) {
        if (ENEMIES[g.t] && ENEMIES[g.t].chief) continue;
        if (!g.types) g.types = Array(g.n).fill(g.t);
        g.types.forEach((t, i) => { if (RANKED.includes(t) && li >= (RANK_FROM[t] || 0.25)) slots.push([g, i]); });
      }
      if (!slots.length) return;
      const kid = Math.round(slots.length * Math.min(0.4, 0.04 * li + 0.03 * k)), cap = li >= 3 && k >= 1 ? 1 + Math.floor(k / 3) : 0;
      // eşit aralıklı seçim (küçük kaydırmayla): rütbeliler dalgaya yayılır
      const pick = (n, r) => {
        if (n <= 0) return;
        const step = slots.length / n, off = rnd() * step;
        for (let j = 0; j < n; j++) {
          const [g, i] = slots[Math.min(slots.length - 1, Math.floor(off + j * step))];
          if (!/_[ky]$/.test(g.types[i])) g.types[i] = g.types[i] + '_' + RANKS[r].id;
        }
      };
      pick(cap, 2); pick(kid, 1);
    });
  });
}
