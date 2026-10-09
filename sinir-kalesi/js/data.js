// Oyun verisi: kuleler, düşmanlar, kahraman, büyüler, bölümler.
// Denge değerleri burada; revizeler çoğunlukla bu dosyada yapılır.

const W = 960, H = 540;

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
      // Kemik Yelpazesi: her atışta yanındaki düşmanlara da kıymık · Ruh Çivisi: çivilenen ölünce cesedi uzun yatar, kendiliğinden dirilebilir
      { id: 'fan', name: 'Kemik Yelpazesi', desc: (r) => `Her atışta ${r.n} ek kıymık yakındaki düşmanlara (%${Math.round(r.mult * 100)} hasar) · kalabalığa iyi`,
        ranks: [{ cost: 150, n: 1, mult: 0.6 }, { cost: 200, n: 2, mult: 0.7 }, { cost: 260, n: 2, mult: 0.9 }] },
      { id: 'nail', name: 'Ruh Çivisi', desc: (r) => `Vurulan 4 sn çivilenir: ölürse cesedi +4 sn yatar ve %${Math.round(r.rise * 100)} şansla kendiliğinden dirilir`,
        ranks: [{ cost: 160, rise: 0.15 }, { cost: 220, rise: 0.25 }, { cost: 280, rise: 0.35 }] },
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
      // okçu yolu: askerler yolu kesmez, toplanma yerinden ok atar (uçanları da vurur); canları %25 düşük
      { id: 'bow', name: 'Okçular', desc: (r) => `${r.r} menzilden ok atarlar, havayı da vururlar · hasar x${r.mult} · canları düşük · 4. iskelet`,
        ranks: [{ cost: 150, r: 115, mult: 1.1, rate: 1.1 }, { cost: 200, r: 130, mult: 1.4, rate: 1 }, { cost: 260, r: 145, mult: 1.75, rate: 0.85 }] },
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
      { id: 'drain', name: 'Ruh Emici', desc: (r) => `Işın canı emer: hedefin yakınındaki iskeletler hasarın %${Math.round(r.heal * 100)}'i kadar iyileşir`,
        ranks: [{ cost: 160, heal: 0.35 }, { cost: 220, heal: 0.55 }, { cost: 280, heal: 0.8 }] },
      { id: 'ghost', name: 'Hayalet Çağırıcı', desc: (r) => `${r.cd} sn'de bir yolda düşmanlara doğru hayalet salar: değdiğine ${r.dmg} hasar, ${r.fear} sn korku`,
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
      { id: 'corpse', name: 'Ceset Mancınığı', desc: (r) => `Menzilde ceset varsa onu fırlatır: x${r.mult} hasar, geniş alan`,
        ranks: [{ cost: 170, mult: 1.6 }, { cost: 230, mult: 1.9 }, { cost: 290, mult: 2.3 }] },
      { id: 'plague', name: 'Kara Veba', desc: (r) => `Vurulanlar vebalı olur (saniyede ${r.dps} zehir): vebalı ölünce veba yanındakilere bulaşır`,
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
  { paths: [[[420,-40],[420,70],[300,110],[170,160],[180,250],[330,280],[520,240],[620,170],[690,230],[640,320],[480,350],[400,430],[540,480],[690,450],[770,390],[862,300]]], plots: [[544,408],[310,204],[835,423],[478,174],[640,396],[355,348],[394,192],[691,123],[88,234],[364,498]] },
  { paths: [[[-40,120],[150,120],[330,100],[520,120],[640,170],[650,250],[560,290],[400,280],[260,300],[200,370],[270,440],[430,470],[600,450],[730,420],[862,320]]], plots: [[511,219],[346,384],[634,372],[262,174],[460,399],[691,348],[190,210],[442,180],[544,390],[106,222],[577,210]] },
  { paths: [[[-40,330],[100,330],[200,300],[300,200],[450,170],[580,210],[650,310],[740,380],[862,300]],[[-40,330],[100,330],[200,300],[300,400],[450,440],[580,410],[650,310],[740,380],[862,300]]], plots: [[544,324],[313,297],[691,231],[190,408],[394,312],[670,426],[520,258],[106,228],[463,369],[802,438],[400,240]], routes: {"0":[0,1]} },
  { paths: [[[-40,420],[120,420],[230,360],[330,300],[460,290],[560,330],[660,350],[750,360],[862,280]],[[560,-40],[560,80],[440,120],[340,180],[330,300],[460,290],[560,330],[660,350],[750,360],[862,280]]], plots: [[418,216],[334,378],[691,285],[502,216],[100,324],[628,414],[238,264],[622,156],[796,420],[268,420],[505,384]] },
  { paths: [[[-40,130],[150,130],[300,180],[430,270],[560,370],[680,420],[760,390],[862,300]],[[-40,400],[150,400],[300,350],[430,270],[560,170],[660,160],[700,250],[690,330],[760,390],[862,300]]], plots: [[586,300],[298,270],[790,456],[604,234],[214,276],[94,276],[430,366],[703,486],[424,171],[154,228],[862,414],[316,420]] },
  { paths: [[[380,-40],[380,80],[260,130],[170,220],[220,320],[360,340],[480,280],[600,250],[680,320],[760,340],[862,260]],[[600,580],[600,470],[650,400],[680,320],[760,340],[862,260]]], plots: [[580,336],[316,228],[691,228],[526,396],[394,186],[748,408],[262,408],[130,138],[718,474],[460,144],[175,378]] },
  { paths: [[[-40,220],[120,220],[220,260],[330,180],[470,150],[600,180],[680,260],[700,350],[770,380],[862,300]],[[520,-40],[520,60],[470,150],[600,180],[680,260],[700,350],[770,380],[862,300]],[[-40,220],[120,220],[220,260],[330,340],[480,380],[620,390],[700,350],[770,380],[862,300]]], plots: [[562,288],[370,246],[865,408],[184,324],[460,252],[712,438],[100,318],[226,168],[448,444],[802,444],[658,132],[244,372]], routes: {"0":[0,2]} },
  { paths: [[[-40,250],[120,250],[220,170],[340,160],[420,230],[440,300],[560,300],[680,360],[760,370],[862,290]],[[560,-40],[560,80],[490,130],[420,230],[440,300],[560,300],[680,360],[760,370],[862,290]],[[520,580],[520,480],[620,440],[680,360],[760,370],[862,290]]], plots: [[508,228],[718,438],[304,225],[538,366],[100,150],[691,285],[586,186],[346,288],[238,264],[454,408],[802,432],[88,354]] },
  { paths: [[[-40,320],[90,320],[160,220],[270,140],[430,110],[590,130],[690,200],[700,300],[610,390],[470,420],[410,470],[500,500],[660,490],[770,430],[862,330]]], plots: [[610,288],[280,216],[508,180],[808,492],[418,363],[70,198],[601,216],[358,186],[550,333],[868,444],[226,276],[352,414]] },
  { paths: [[[340,-40],[340,80],[220,140],[180,230],[300,270],[450,250],[520,290],[620,250],[700,320],[770,380],[862,300]],[[460,580],[460,480],[340,440],[320,360],[450,330],[520,290],[620,250],[700,320],[770,380],[862,300]]], plots: [[328,198],[502,390],[610,336],[244,333],[691,201],[400,162],[238,408],[661,390],[115,156],[520,204],[835,432],[556,444]] },
  { paths: [[[-40,200],[100,200],[200,250],[320,180],[460,150],[580,200],[620,300],[700,400],[780,410],[862,330]],[[640,-40],[640,80],[580,200],[620,300],[700,400],[780,410],[862,330]],[[-40,200],[100,200],[200,250],[320,330],[470,370],[600,420],[700,400],[780,410],[862,330]]], plots: [[544,324],[340,252],[838,459],[508,252],[160,318],[694,474],[424,246],[76,294],[220,156],[778,480],[682,234]], routes: {"0":[0,2]} },
  { paths: [[[-40,300],[120,300],[220,230],[350,200],[480,240],[560,320],[680,380],[770,380],[862,300]],[[400,-40],[400,90],[330,140],[350,200],[480,240],[560,320],[680,380],[770,380],[862,300]],[[640,580],[640,470],[680,380],[770,380],[862,300]],[[-40,300],[120,300],[220,370],[360,410],[500,400],[560,320],[680,380],[770,380],[862,300]]], plots: [[412,294],[244,300],[691,300],[538,462],[472,153],[124,402],[748,456],[328,288],[118,198],[634,267],[220,156],[832,432],[382,480]], routes: {"0":[0,3]} },
  { paths: [[[-40,160],[130,160],[240,120],[380,140],[480,220],[560,300],[680,370],[770,380],[862,300]],[[480,580],[480,480],[400,420],[380,300],[560,300],[680,370],[770,380],[862,300]],[[-40,160],[130,160],[240,120],[260,230],[380,300],[560,300],[680,370],[770,380],[862,300]],[[480,580],[480,480],[600,450],[680,370],[770,380],[862,300]]], plots: [[514,372],[364,216],[691,291],[166,252],[706,450],[577,207],[292,342],[340,498],[82,264],[796,444],[520,153],[307,408],[640,255],[868,408]], routes: {"0":[0,2],"1":[1,3]} },
  { paths: [[[-40,240],[120,240],[230,170],[380,150],[520,190],[600,280],[700,360],[770,370],[862,290]],[[640,-40],[640,80],[560,130],[520,190],[600,280],[700,360],[770,370],[862,290]],[[420,580],[420,480],[520,440],[620,430],[700,360],[770,370],[862,290]],[[-40,240],[120,240],[230,320],[360,360],[480,340],[600,280],[700,360],[770,370],[862,290]]], plots: [[580,366],[274,252],[469,261],[691,249],[124,342],[634,198],[337,426],[388,240],[724,438],[112,138],[652,492],[808,432],[202,384]], routes: {"0":[0,3]} },
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
  // yeni birlikler dalgalara: ilk geldikleri bölümden itibaren belli dalgalarda küçük gruplar halinde (yer kaplamasın diye geç 'at')
  // görseli henüz hazır olmayan yeni türler dalgalara girmez
  const NEW_ART_WAIT = [];
  // davulcu ve sancaktar burada değil: yalnız kalabalık piyade bölüklerinin içinde yürürler (aşağıda SUPPORT)
  const NEWCOMERS = [['testudo', 7, [3, 6], 1], ['sunpriest', 8, [4, 7], 1], ['horsearcher', 10, [2, 5, 7], 2],
    ['wardog', 3, [1, 4, 6], 5], ['eagle', 5, [2, 5, 7], 3], ['chariot', 9, [3, 6], 1], ['siegetower', 12, [5, 7], 1]].filter(([t]) => !NEW_ART_WAIT.includes(t));
  for (const [t, from, ws, n] of NEWCOMERS) L.forEach((l, i) => {
    if (i < from) return;
    ws.forEach((k, j) => { const w = l.waves[k]; if (w) w.push(W_(t, n + (i >= from + 4 && j === ws.length - 1 ? 1 : 0), 3, 7 + j * 2)); });
  });
  // dalga düzeni (8 Eki): her bölüm 8 dalga, her dalga öncekinden %30 kalabalık; total = bölümün boss hariç düşman sayısı
  // (önceki düzenin ~2,1 katı: 56, 64, 74, 74, 119 -> aşağıdakiler)
  const TOTAL = [118, 124, 128, 134, 140, 146, 155, 158, 162, 155, 165, 172, 185, 205, 250];
  L.forEach((l, i) => Object.assign(l, old[i], { lives: 20, ep: 1, total: TOTAL[i], grow: 1.3 }));
  // bölüme özel mekanikler (game.js MECH)
  [null, null, null, 'mud', 'mud', null, 'graves', null, 'graves', 'lake', null, 'lake', 'sunbeam', null, 'sunbeam'].forEach((m, i) => { if (m) L[i].mech = m; });
  LEVELS.splice(0, LEVELS.length, ...L);
  // bölge (eski adıyla sefer): haritası game.js drawRegionMap ile çizilir; zones: haritada soldan sağa mekânlar
  // name: bölgenin (episode) adı, haritanın başlığı. zones: soldan sağa mekânlar (zemin teması).
  // nodes: bölüm işaretleri (960x540), yol bunların içinden kıvrılarak geçer: start'tan girer, end'de şapelin kapısında biter.
  EPISODES.splice(0, EPISODES.length, { name: 'Davetsiz Misafirler',
    zones: [['cursed', 'Ölü Orman'], ['bog', 'Sisli Bataklık'], ['graveyard', 'Unutulmuş Mezarlık'], ['blacklake', 'Kara Göl'], ['necrogate', "Mortimer'ın Kapısı"]],
    start: [-40, 470], end: [852, 264],
    nodes: [[70, 450], [150, 372], [92, 282], [192, 194], [292, 250], [252, 352], [334, 442], [444, 392], [424, 290],
      [504, 200], [612, 232], [592, 342], [690, 420], [782, 352], [742, 262]] });
}
// kuleler: Mortimer'ın yapıları
Object.assign(TOWERS.archer, { name: 'Kemik Dikilitaşı', desc: 'Hızla kemik kıymığı fırlatır, havayı da vurur' });
Object.assign(TOWERS.barracks, { name: 'Mahzen', desc: 'İskelet savaşçılar yolu keser' });
Object.assign(TOWERS.mage, { name: 'Ruh Feneri', desc: 'Ruh ışını: zırhı deler, yavaşlatır' });
Object.assign(TOWERS.artillery, { name: 'Veba Kazanı', desc: 'Veba fırlatır: alan hasarı, zehirli gaz, zırhı çürütür' });
TOWERS.barracks.levels[0].perk = 'Tencere miğferli 3 iskelet acemi yolu keser';
TOWERS.barracks.levels[1].perk = 'İskelet muhafızlar: zincir zırh, kalkan, uzun kılıç';
TOWERS.barracks.levels[2].perk = 'Kemik şövalyeler: kara zırh · vuruşlar %15 can çalar';
TOWERS.artillery.levels[0].perk = 'Veba bulamacı: alan hasarı, yerde zehirli gaz, zırh yarıya iner';
TOWERS.artillery.levels[1].perk = 'Daha ağır veba, daha geniş gaz bulutu';
TOWERS.artillery.levels[2].perk = 'Kaynayan veba: %30 şansla 0.6 sn sersemletir';
TOWERS.mage.levels[0].perk = 'Ruh ışını: büyü hasarı zırhı deler';
const NAMES = { poison: 'Veba Kemiği', snipe: 'Kemik Mızrak', shield: 'Mezar Bekçisi', blade: 'Ölüm Şövalyesi', bow: 'Kemik Okçular', frost: 'Lanet', blast: 'Ruh Fırtınası', napalm: 'Çürüme Bulutu', double: 'Çifte Kazan' };
for (const k in TOWERS) for (const a of TOWERS[k].abilities || []) if (NAMES[a.id]) a.name = NAMES[a.id];
// komutanlar (tek seçilir): Kont Vladrik (eski komutanın yetenekleri), Wailing Wren (eski okçunun yetenekleri)
Object.assign(HEROES.commander, { name: 'Kont Vladrik', role: 'Vampir · Yakın dövüş', sprite: 'hero_vladrik', h: 31, aura: '220,40,60' });
Object.assign(HEROES.zeynep, { name: 'Wailing Wren', role: 'Banshee · Uzun menzil', sprite: 'hero_wren', h: 30, aura: '150,255,190', unlock: 2 });
HERO_ORDER.splice(0, HERO_ORDER.length, 'commander', 'zeynep');
Object.assign(HERO_ULT.commander, { name: 'Kan Kılıçları', short: 'Seçtiğin yere 9 kan kılıcı saplanır, düşmanlar sersemler' });
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
  nm_wall:  { name: 'Kemik Duvarı', cd: 30, hp: 420, life: 6, col: '235,225,200',
    desc: 'Yolun seçtiğin yerinde kemikten duvar yükselir: düşmanları 6 sn durdurur, vurularak kırılabilir',
    short: 'Yola kemik duvar diker: düşmanlar 6 sn takılır (kırılabilir)' },
  nm_fear:  { name: 'Korku', cd: 40, r: 120, t: 3.5, col: '190,120,255', desc: 'Seçilen alandaki düşmanlar korkuyla 3,5 sn geri kaçar', short: 'Seçtiğin alandaki düşmanlar 3,5 sn geri kaçar' },
  // 4. büyü: 1. bölge bitince (son bölüm kazanılınca) açılır. Cesedi diriltmek ya da patlatmak arasında seçim.
  nm_burst: { name: 'Ceset Patlatma', cd: 35, r: 110, blast: 58, dmg: 70, pct: 0.08, poison: [8, 3], col: '170,255,90', unlock: 14,
    desc: 'Seçtiğin alandaki cesetler patlar: her biri çevresine ağır hasar verir ve zehirler (bosslara yüzdelik hasar yarım)',
    short: 'Alandaki cesetleri patlatır: çevresine ağır hasar ve zehir' },
};
Object.assign(CASTLE.levels[0], { title: 'Şapel Okçuları', perk: 'Şapel bir iskelet okçuyla kendini savunur' });
Object.assign(CASTLE.levels[1], { title: 'Kemik Nişancılar', perk: 'İki iskelet okçu, daha sert kemik oklar' });
Object.assign(CASTLE.levels[2], { title: 'Ölüm Muhafızları', perk: 'Üç usta iskelet okçu, %15 kritik vuruş' });

const LEVEL_BOSS = ['goblin_king', 'wolf_alpha', 'orc_warlord', 'dark_shaman', 'death_knight', 'troll_king', 'wolf_alpha', 'dark_shaman', 'death_knight', 'overlord',
  'raider_chief', 'raider_chief', 'scorpion_queen', 'scorpion_queen', 'mummy_king', 'worm_king', 'mummy_king', 'mummy_king', 'golem_titan', 'storm_djinn'];
// boss gücü kademesi: 1. seferde bölüm sırası; 2. sefer 1. seferin sonlarından başlar, yavaşça yükselir
LEVELS.forEach((lv, i) => { lv.ep = lv.ep || 1; lv.tier = i * 4 / 14; });
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
  const heavy = (g) => ENEMIES[g.t].hp >= HEAVY_HP;
  const count = (w) => w.reduce((a, g) => a + g.n, 0);
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
      for (const g of light) { const n2 = Math.max(1, Math.round(g.n * f)); g.gap = Math.max(0.4, g.gap * Math.sqrt(g.n / n2)); g.n = n2; }
      let diff = target - count(w);
      const big = light.reduce((a, g) => (g.n > a.n ? g : a), light[0]);
      big.n = Math.max(1, big.n + diff);
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
for (const id in HERO_SKILLS) {
  const all = HEROES[id].paths.flatMap(p => p.skills);
  HEROES[id].paths = [{ name: 'Yetenekler', col: '#ffd34d', skills: HERO_SKILLS[id].map(k => all.find(s => s.id === k)) }];
}

// Kingdom Rush usulü: kule her seviyede yeni bir ad alır
const TOWER_TITLES = {'archer': ['Okçu Kulesi', 'Nişancı Kulesi', 'Keskin Nişancı Kalesi'], 'barracks': ['Milis Kışlası', 'Piyade Kışlası', 'Şövalye Kışlası'], 'mage': ['Çırak Kulesi', 'Büyücü Kulesi', 'Yıldırım Ustası Kulesi'], 'artillery': ['Topçu Kulesi', 'Ağır Topçu', 'Büyük Bombard']};
for (const k in TOWER_TITLES) TOWERS[k].levels.forEach((L, i) => { L.title = TOWER_TITLES[k][i]; });
// Uzmanlık: son seviyede iki yetenekten biri seçilir (ilk alınan yetenek yolu belirler, diğeri kapanır).
// Seçilen yol kulenin adını ve görünüşünü değiştirir: askerlerin kostümü, okçuların kıyafeti, kule süsleri.
const SPEC = {
  fan:    { title: 'Kemik Yelpazesi', who: 'Yelpaze gibi saçılan kemik kıymıkları' },
  nail:   { title: 'Ruh Çivisi Dikilitaşı', who: 'Ruhu bedene çivileyen kara kıymık' },
  drain:  { title: 'Ruh Emici Fener', who: 'Canı emip iskeletlere aktaran yeşil ışın' },
  ghost:  { title: 'Hayalet Feneri', who: 'Yola salınan çığlık atan hayaletler' },
  corpse: { title: 'Ceset Mancınığı', who: 'Cesetleri cephane yapan kazan' },
  plague: { title: 'Kara Veba Kazanı', who: 'Ölümle yayılan kara veba' },
  shield: { title: 'Muhafız Kışlası', who: 'Muhafızlar: ağır plaka zırh, kule kalkanı' },
  blade:  { title: 'Akıncı Ocağı',    who: 'Akıncılar: hafif zırh, çift kılıç' },
  bow:    { title: 'Okçu Ocağı',      who: 'Okçular: deri zırh, uzun yay' },
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
  wardog: { blast: 1.4, melee: 1.2 }, chariot: { magic: 1.3, melee: 0.6 }, siegetower: { blast: 1.3, arrow: 0.5 }, eagle: { arrow: 1.4, magic: 1.1 },
  horsearcher: { arrow: 1.2, magic: 1.2 }, testudo: { arrow: 0.3, blast: 1.8, magic: 1.1 }, sunpriest: { arrow: 1.3, melee: 1.2 },
  signifer: { magic: 1.2, melee: 1.2 }, drummer: { arrow: 1.2, blast: 1.2 }, centurion: { magic: 1.2 }, champion: { arrow: 1.2 }, shadowmaster: { blast: 1.3 }, cavcaptain: { blast: 1.2 },
  gloriosus: { magic: 0.85, arrow: 0.85, blast: 1.1 },
});

// Necromancer seferi: düşman açıklamaları (tanıtım kartı ve dokununca açılan panel)
Object.assign(ENEMY_DESC, {
  legion: 'Kalkanlı piyade, kalabalık gelir. Ruh ışını kalkanını deler',
  solarcher: 'Durup iskeletlere ok atar. Zırhsız: kemik kıymığı ve kılıç iyi işler',
  gladiator: 'Çevik arena dövüşçüsü, iskeletleri hızla keser. Kıymık ve veba işler',
  assassin: 'Çok hızlı, ara ara gölgeye dalıp ileri atlar. Vebanın alanından kaçamaz',
  priest: 'Yakınındakileri iyileştirir, büyüye dirençli. Önce onu kıymıkla vur',
  heavy: 'Kalkan duvarı: kıymıklar seker. Ruh ışını zırhını deler',
  cavalry: 'Hızlı atlı, kuleye 2 can götürür. Veba atı ürkütür',
  ram: 'Çok yavaş, çok canlı; kapıya varırsa 3 can götürür. Veba kazanı kullan',
  catapult: 'Durup kulelerimize taş atar, 3 sn susturur. Önce onu durdur',
  wardog: 'Sürüyle gelir, çok hızlıdır ama canı azdır. Veba kazanı sürüyü dağıtır',
  chariot: 'Çok hızlı; iskeletleri ezip geçer, durduramazlar. Kemik duvar durdurur',
  siegetower: 'Ağır ve yavaş; yıkılınca içinden 6 lejyoner dökülür. Yolun başında yık',
  eagle: 'Uçar: iskeletler ve kazanlar vuramaz. Dikilitaş ve Ruh Feneri vurur',
  horsearcher: 'Koşarken iskeletlere ok atar, iskeletler onu durduramaz. Kemik duvar durdurur',
  testudo: 'Kalkan çatısı: kıymıklar neredeyse işlemez. Veba kazanı dağıtır; ölünce 3 lejyonere ayrılır',
  sunpriest: 'Çevresindeki cesetleri yakar (diriltilemez), dirilen ölülere ışıkla vurur. Önce onu indir',
  signifer: 'Sancağı çevresindeki düşmanlara zırh verir. Ruh ışını ve iskeletler iyi işler',
  drummer: 'Davuluyla çevresindekileri gaza getirir: daha hızlı yürür, daha sert vururlar. Zırhsız, kıymık ve veba iyi işler',
});

// Necromancer: kule seviye unvanları ve uzmanlık adları
if (NECRO) {
  Object.assign(TOWER_TITLES, { archer: ['Kemik Dikilitaşı', 'Dikenli Dikilitaş', 'Omurga Dikilitaşı'], barracks: ['Mahzen', 'Kemik Mahzeni', 'Kara Türbe'],
    mage: ['Ruh Feneri', 'Ruh Kafesi', 'Ruhlar Feneri'], artillery: ['Veba Kazanı', 'Kaynayan Veba Kazanı', 'Büyük Veba Kazanı'] });
  for (const k in TOWER_TITLES) TOWERS[k].levels.forEach((L, i) => { L.title = TOWER_TITLES[k][i]; });
  Object.assign(SPEC.shield, { title: 'Mezar Bekçileri', who: 'Tabut kalkanlı, dev topuzlu iskeletler' });
  Object.assign(SPEC.blade, { title: 'Ölüm Şövalyeleri', who: 'Yeşil alevli çift kemik kılıç' });
  Object.assign(SPEC.bow, { title: 'Kemik Okçular', who: 'Kapüşonlu, deri zırhlı iskeletler, kemik yay' });
  Object.assign(SPEC.poison, { title: 'Veba Kemiği', who: 'Zehirli yeşil kıymıklar' });
  Object.assign(SPEC.snipe, { title: 'Kemik Mızrak', who: 'Uzun menzilli dev kemik mızrak' });
  Object.assign(SPEC.frost, { title: 'Lanet Feneri', who: 'Düşmanları donduran soğuk lanet' });
  Object.assign(SPEC.blast, { title: 'Ruh Fırtınası', who: 'Kalabalığa patlayan ruh dalgası' });
  Object.assign(SPEC.napalm, { title: 'Çürüme Bulutu', who: 'Daha büyük, uzun süren gaz' });
  Object.assign(SPEC.double, { title: 'Çifte Kazan', who: 'Her atışta ikinci veba' });
  TOWERS.archer.levels[0].perk = 'Hızla kemik kıymığı fırlatır · uçanları da vurur';
  TOWERS.archer.levels[1].perk = 'Daha hızlı · delici kıymık: %25 şansla zırhı yok sayar · +menzil';
  TOWERS.archer.levels[2].perk = 'Çok hızlı kıymık yağmuru · %15 kritik vuruş · çok daha uzun menzil';
  TOWERS.mage.levels[1].perk = 'Daha hızlı yükleme · ruh soğuğu: vurduğunu 1 sn %30 yavaşlatır';
  TOWERS.mage.levels[2].perk = 'Hızlı yükleme · ruh zinciri: yakındaki ikinci düşmana %60 hasar';
}

// ----- Lanet Kulesi (3. bölümde açılır; eski Kan Sunağı yuvası 'altar'): saldırmaz, menzilindeki düşmanları lanetler -----
// lanetli: fazla hasar alır, yavaşlar, ölürse rise şansıyla çürümüş ölü olarak kendiliğinden dirilir
if (NECRO) {
  TOWERS.altar = {
    name: 'Lanet Kulesi', icon: 'altar', dmgType: 'none', air: false, support: true, unlockLevel: 2,
    desc: 'Lanet dalgası yayar: menzildekilere hasar, fazla hasar alma, yavaşlık, ölünce dirilme şansı',
    levels: [
      { cost: 90,  range: 100, pulse: 9,  every: 1.2, curse: 0.15, slow: 0.12, rise: 0.12, title: 'Lanet Kulesi', perk: 'Lanet dalgası: menzildekilere 1,2 sn\'de bir 9 hasar · lanetliler %15 fazla hasar alır · ölürse %12 dirilir' },
      { cost: 130, range: 110, pulse: 18, every: 1.2, curse: 0.22, slow: 0.16, rise: 0.18, title: 'Lanet Sütunu', perk: 'Lanet dalgası 18 hasar · lanetliler %22 fazla hasar alır · ölürse %18 dirilir' },
      { cost: 180, range: 120, pulse: 30, every: 1.2, curse: 0.3,  slow: 0.2,  rise: 0.25, title: 'Kara Lanet Mabedi', perk: 'Lanet dalgası 30 hasar · lanetliler %30 fazla hasar alır · ölürse %25 dirilir' },
    ],
    abilities: [
      { id: 'rite', name: 'Kan Ayini', desc: (r) => `Menzildeki kulelere +%${Math.round(r.rate * 100)} atış hızı ve +%${Math.round(r.dmg * 100)} hasar`,
        ranks: [{ cost: 150, rate: 0.15, dmg: 0.1 }, { cost: 200, rate: 0.25, dmg: 0.18 }, { cost: 260, rate: 0.35, dmg: 0.25 }] },
      { id: 'blight', name: 'Kara Lanet', desc: (r) => `Lanetli ölünce lanet en yakın ${r.n} düşmana sıçrar (menzil dışında da, 4 sn)`,
        ranks: [{ cost: 140, n: 2 }, { cost: 190, n: 3 }, { cost: 240, n: 4 }] },
    ],
  };
  TOWER_ORDER.push('altar');
  Object.assign(SPEC, { rite: { title: 'Kan Ayini Mabedi', who: 'Kulelere hız ve güç veren kan ritüeli' }, blight: { title: 'Kara Lanet Mabedi', who: 'Ölümle yayılan lanet' } });
}

// necro teması: yıldız gelişmeleri ve hasar türü adları (eski kule/kale adlarının yerine)
if (NECRO) {
  const U = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
  U.archer.name = 'Dikilitaşlar'; U.barracks.name = 'Mahzen'; U.mage.name = 'Ruh Fenerleri'; U.artillery.name = 'Veba Kazanları';
  U.barracks.ranks[0].desc = '+%20 iskelet canı'; U.barracks.ranks[1].desc = '+%20 iskelet hasarı';
  U.artillery.ranks[1].desc = '+%15 veba alanı';
  U.spells.name = 'Büyüler';
  U.spells.ranks[0].desc = '+%20 komutan gücü hasarı'; U.spells.ranks[1].desc = 'Dirilen ölüler %25 dayanıklı'; U.spells.ranks[2].desc = 'Büyüler %25 hızlı dolar';
  U.castle.name = 'Şapel';
  Object.assign(WK_NAME, { arrow: 'Kemik', magic: 'Ruh', blast: 'Veba', melee: 'Kılıç' });
}

// ----- Necromancer: zayıflık/direnç bağlama + düşman rütbeleri -----
// Necro düşmanlarının ENEMY_WK değerleri yukarıdaki bağlama döngüsünden sonra eklendiği için burada yeniden bağlanır.
for (const k in ENEMY_WK) if (ENEMIES[k]) ENEMIES[k].wk = ENEMY_WK[k];
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
