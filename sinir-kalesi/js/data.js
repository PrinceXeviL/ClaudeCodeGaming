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
      { id: 'poison', name: 'Zehirli Oklar', desc: (r) => `Oklar 3 sn boyunca saniyede ${r.dps} zehir hasarı verir`,
        ranks: [{ cost: 150, dps: 4 }, { cost: 200, dps: 8 }, { cost: 260, dps: 13 }] },
      { id: 'snipe', name: 'Keskin Nişancı', desc: (r) => `${r.cd} sn'de bir en güçlü düşmana ${r.dmg} zırh delen kritik atış · menzil +${r.range}`,
        ranks: [{ cost: 180, cd: 9, dmg: 70, range: 12 }, { cost: 240, cd: 7.5, dmg: 120, range: 22 }, { cost: 300, cd: 6, dmg: 180, range: 32 }] },
    ],
  },
  barracks: {
    name: 'Kışla', icon: 'barracks', dmgType: 'phys', air: false,
    desc: 'Askerler yolu keser',
    levels: [
      { cost: 70,  range: 120, hp: 50,  dmg: [1, 3],  armor: 0,    respawn: 10, perk: 'Deri zırhlı 3 asker yolu keser' },
      { cost: 110, range: 130, hp: 100, dmg: [3, 5],  armor: 0.15, respawn: 9,  perk: 'Çelik zırh, sorguçlu miğfer, keskin kılıç' },
      { cost: 150, range: 140, hp: 150, dmg: [6, 10], armor: 0.3,  respawn: 8,  perk: 'Altın şövalye zırhı · vuruşlar %15 can çalar' },
    ],
    abilities: [
      { id: 'shield', name: 'Kalkan Duvarı', desc: (r) => `Askerlere +%${Math.round(r.armor * 100)} zırh ve +${r.hp} can`,
        ranks: [{ cost: 140, armor: 0.1, hp: 30 }, { cost: 190, armor: 0.18, hp: 60 }, { cost: 240, armor: 0.25, hp: 100 }] },
      { id: 'blade', name: 'Kılıç Ustası', desc: (r) => `Hasar x${r.mult} · %${Math.round(r.crit * 100)} kritik vuruş`,
        ranks: [{ cost: 160, mult: 1.3, crit: 0.1 }, { cost: 220, mult: 1.6, crit: 0.15 }, { cost: 280, mult: 2, crit: 0.2 }] },
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
      { id: 'frost', name: 'Buz Küresi', desc: (r) => `Vurduğunu ${r.t} sn %${Math.round(r.k * 100)} yavaşlatır`,
        ranks: [{ cost: 160, k: 0.45, t: 2 }, { cost: 220, k: 0.55, t: 2.5 }, { cost: 280, k: 0.65, t: 3 }] },
      { id: 'blast', name: 'Arkan Patlama', desc: (r) => `${r.cd} sn'de bir kalabalığa ${r.dmg} alan büyü hasarı`,
        ranks: [{ cost: 200, cd: 10, dmg: 60 }, { cost: 260, cd: 9, dmg: 100 }, { cost: 320, cd: 8, dmg: 150 }] },
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
      { id: 'napalm', name: 'Napalm', desc: (r) => `Patlama yeri 3 sn yanar: saniyede ${r.dps} ateş hasarı`,
        ranks: [{ cost: 170, dps: 10 }, { cost: 230, dps: 18 }, { cost: 290, dps: 28 }] },
      { id: 'double', name: 'Çifte Atış', desc: (r) => `Her atışta ikinci bir gülle (%${Math.round(r.mult * 100)} hasar)`,
        ranks: [{ cost: 200, mult: 0.5 }, { cost: 260, mult: 0.75 }, { cost: 320, mult: 1 }] },
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
  caner: {
    name: 'Caner', role: 'Zırhlı şövalye · Tank', sprite: 'hero_caner', base: 'enemy_knight', h: 32, aura: '200,230,255',
    hp: 520, dmg: [12, 18], armor: 0.55, rate: 1.15, speed: 66, respawn: 18, regen: 14, engage: 68, unlock: null,
    paths: [
      { name: 'Kutsal Yol', col: '#ffe27a', skills: [
        { id: 'holy',       name: 'Kutsal Işık', cd: 14, desc: 'Kendini ve yakındaki askerleri büyük oranda iyileştirir' },
        { id: 'consecrate', name: 'Kutsal Alan', cd: 15, desc: 'Ayağının altı 4 sn kutsanır, düşmanlar yanar' },
        { id: 'revive',     name: 'Diriliş', passive: true, desc: 'Kalıcı: her bölümde bir kez, ölünce yarı canla dirilir' },
      ] },
      { name: 'Çelik Yol', col: '#8fd0ff', skills: [
        { id: 'shieldthrow', name: 'Kalkan Fırlatma', cd: 9,  desc: 'Kalkan 3 düşmana seker, her birini 1 sn sersemletir' },
        { id: 'quake',       name: 'Yer Sarsıntısı', cd: 13, desc: 'Çevresindeki düşmanları sarsıp 1.2 sn sersemletir' },
        { id: 'judgment',    name: 'Ceza Kılıcı',    cd: 11, desc: 'Üç kat hasarlı darbe; canı %25 altındaki düşmanı bitirir' },
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
  tarcin: {
    name: 'Tarçın', role: 'Kedi suikastçı · Çok hızlı', sprite: 'hero_cat', h: 27, aura: '255,170,80',
    hp: 240, dmg: [11, 17], armor: 0.15, rate: 0.55, speed: 135, respawn: 10, regen: 12, engage: 75, unlock: 4,
    paths: [
      { name: 'Gölge Yolu', col: '#b8a0ff', skills: [
        { id: 'shadowstep', name: 'Gölge Adımı', cd: 8,  desc: 'En güçlü düşmanın arkasına ışınlanıp 3 kat hasarlı bıçak vurur' },
        { id: 'bleed',      name: 'Kanatan Pençe', passive: true, desc: 'Kalıcı: her vuruş 3 sn kanatır' },
        { id: 'ninelives',  name: 'Dokuz Can', passive: true, desc: 'Kalıcı: ölünce yarı canla dirilir (bölümde 2 kez), yeniden doğma yarı sürede' },
      ] },
      { name: 'Çeviklik Yolu', col: '#ffd34d', skills: [
        { id: 'clawstorm', name: 'Pençe Fırtınası', cd: 9,  desc: 'Etrafında dönerek çevresindeki herkesi art arda keser' },
        { id: 'dodge',     name: 'Kedi Çevikliği', passive: true, desc: 'Kalıcı: saldırıların %35’inden kaçar' },
        { id: 'mark',      name: 'Ölüm İşareti', cd: 12, desc: 'Hedefi işaretler: 6 sn boyunca herkesten %60 fazla hasar alır' },
      ] },
    ],
  },
  sage: {
    name: 'Ateş Bilgesi', role: 'Menzilli büyü · Alan', sprite: 'hero_sage', base: 'enemy_shaman', h: 29, aura: '255,140,60',
    hp: 190, dmg: [14, 22], armor: 0, rate: 1.4, speed: 70, respawn: 16, regen: 8, engage: 60, ranged: 145, proj: 'fireball', magic: true, unlock: 6,
    paths: [
      { name: 'Alev Yolu', col: '#ff9a4a', skills: [
        { id: 'flamering', name: 'Alev Halkası',   cd: 10, desc: 'Çevresindeki düşmanları yakar' },
        { id: 'inferno',   name: 'Cehennem Ateşi', passive: true, desc: 'Kalıcı: ateş topları küçük bir alanda patlar' },
        { id: 'meteor2',   name: 'Gök Taşı',       cd: 18, desc: 'En kalabalık yere büyük bir göktaşı düşürür' },
      ] },
      { name: 'Buz Yolu', col: '#9fdcff', skills: [
        { id: 'icelance',   name: 'Buz Mızrağı', cd: 7,  desc: 'Ağır büyü hasarı, hedefi 2.5 sn %60 yavaşlatır' },
        { id: 'freeze',     name: 'Dondurma',    cd: 16, desc: 'Kalabalığı 2 sn dondurur' },
        { id: 'frostarmor', name: 'Buz Zırhı', passive: true, desc: 'Kalıcı: yakınındaki askerler %20 daha az hasar alır' },
      ] },
    ],
  },
};
const HERO_ORDER = ['commander', 'caner', 'zeynep', 'tarcin', 'sage'];

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
  caner:     { name: 'Kutsal Çekiç',       cd: 60, r: 66, dmg: [80, 110], stun: 2, heal: 0.5, desc: 'Dev ışık çekici iner: ağır hasar, 2 sn sersemletme, askerleri iyileştirir' },
  zeynep:    { name: 'Zehirli Ok Yağmuru', cd: 55, r: 70, dmg: [10, 15], n: 22, poison: 9, poisonT: 5, desc: '22 zehirli ok yağar, vurulanlar 5 sn zehirlenir' },
  tarcin:    { name: 'Gölge Kediler',      cd: 55, r: 72, dmg: [18, 26], n: 5, hits: 3, mark: 5, desc: '5 gölge kedi sıçrar, her biri 3 kez pençeler; hedefler 5 sn fazla hasar alır' },
  sage:      { name: 'Alev Sütunları',     cd: 60, r: 70, dmg: [34, 48], n: 5, burn: 13, burnT: 4, desc: '5 alev sütunu fışkırır, yerde 4 sn yanan alev kalır' },
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
// plots: kule arsaları; tools/arsa-uret.js yola göre otomatik yerleştirir.
const LEVELS = [
  {
    name: 'Çayır Geçidi', gold: 300, lives: 20, theme: 'meadow', mapPos: [190, 330],
    paths: [
      [[-40, 300], [120, 300], [230, 210], [380, 190], [480, 280], [520, 400], [650, 440], [760, 380], [790, 290], [862, 270]],
    ],
    plots: [[634, 360], [346, 258], [88, 228], [694, 312], [400, 312], [250, 294], [856, 360], [544, 498], [136, 372]],
    waves: [
      [{ t: 'goblin', n: 5, gap: 1.6 }],
      [{ t: 'goblin', n: 8, gap: 1.2 }],
      [{ t: 'goblin', n: 6, gap: 1.1 }, { t: 'orc', n: 2, gap: 2.5, at: 6 }],
      [{ t: 'wolf', n: 6, gap: 0.9 }, { t: 'goblin', n: 6, gap: 1, at: 5 }],
      [{ t: 'orc', n: 4, gap: 1.8 }, { t: 'bandit', n: 3, gap: 1.8, at: 4 }, { t: 'goblin', n: 8, gap: 0.8, at: 9 }],
      [{ t: 'bandit', n: 5, gap: 1.4 }, { t: 'wolf', n: 8, gap: 0.7, at: 6 }, { t: 'orc', n: 6, gap: 1.4, at: 11 }],
    ],
  },
  {
    name: 'Kara Orman', gold: 380, lives: 20, theme: 'forest', mapPos: [470, 230],
    paths: [
      [[560, -40], [560, 90], [420, 140], [260, 120], [150, 200], [160, 320], [300, 380], [470, 330], [620, 380], [740, 440], [860, 400]],
      [[560, -40], [560, 90], [420, 140], [400, 240], [470, 330], [620, 380], [740, 440], [860, 400]],
    ],
    routes: {0: [0, 1]},
    plots: [[502, 252], [286, 264], [736, 360], [454, 408], [544, 192], [268, 198], [586, 450], [166, 420], [616, 150], [820, 498]],
    waves: [
      [{ t: 'goblin', n: 8, gap: 1 }],
      [{ t: 'wolf', n: 8, gap: 0.7 }, { t: 'goblin', n: 5, gap: 0.9, at: 5 }],
      [{ t: 'bat', n: 6, gap: 1.1 }],
      [{ t: 'orc', n: 5, gap: 1.5 }, { t: 'shaman', n: 2, gap: 3, at: 4 }],
      [{ t: 'bandit', n: 8, gap: 1.1 }, { t: 'bat', n: 5, gap: 1.1, at: 6 }],
      [{ t: 'orc', n: 8, gap: 1.1 }, { t: 'shaman', n: 3, gap: 2.5, at: 3 }, { t: 'wolf', n: 10, gap: 0.6, at: 10 }],
      [{ t: 'knight', n: 2, gap: 4 }, { t: 'goblin', n: 12, gap: 0.6, at: 2 }],
      [{ t: 'knight', n: 3, gap: 3.5 }, { t: 'bat', n: 8, gap: 0.9, at: 4 }, { t: 'shaman', n: 3, gap: 2, at: 8 }, { t: 'orc', n: 7, gap: 1.1, at: 12 }],
    ],
  },
  {
    name: 'Kale Kapısı', gold: 600, lives: 20, theme: 'rocky', mapPos: [760, 330],
    paths: [
      [[-40, 200], [130, 200], [260, 260], [380, 250], [470, 320], [600, 330], [720, 280], [862, 250]],
      [[440, 580], [440, 470], [500, 390], [600, 330], [720, 280], [862, 250]],
    ],
    plots: [[406, 372], [640, 396], [142, 288], [754, 348], [550, 456], [346, 324], [250, 174], [718, 204], [526, 258], [64, 318], [364, 432]],
    waves: [
      [{ t: 'goblin', n: 6, gap: 1, p: 0 }, { t: 'goblin', n: 6, gap: 1, p: 1, at: 2 }],
      [{ t: 'orc', n: 5, gap: 1.5, p: 0 }, { t: 'wolf', n: 8, gap: 0.7, p: 1, at: 3 }],
      [{ t: 'bat', n: 8, gap: 0.9, p: 1 }, { t: 'bandit', n: 6, gap: 1.1, p: 0, at: 2 }],
      [{ t: 'knight', n: 2, gap: 3, p: 0 }, { t: 'shaman', n: 2, gap: 2, p: 1, at: 2 }, { t: 'orc', n: 6, gap: 1.1, p: 1, at: 6 }],
      [{ t: 'wolf', n: 12, gap: 0.6, p: 0 }, { t: 'wolf', n: 12, gap: 0.6, p: 1, at: 1 }],
      [{ t: 'knight', n: 4, gap: 2.5, p: 1 }, { t: 'bandit', n: 10, gap: 0.9, p: 0, at: 2 }, { t: 'bat', n: 8, gap: 0.8, p: 0, at: 8 }],
      [{ t: 'orc', n: 13, gap: 0.8, p: 0 }, { t: 'orc', n: 13, gap: 0.8, p: 1, at: 1 }, { t: 'shaman', n: 5, gap: 2, p: 0, at: 6 }],
      [{ t: 'knight', n: 4, gap: 2.5, p: 0 }, { t: 'knight', n: 4, gap: 2.5, p: 1, at: 3 }, { t: 'bat', n: 10, gap: 0.8, p: 1, at: 6 }],
      [{ t: 'goblin', n: 22, gap: 0.35, p: 0 }, { t: 'bandit', n: 10, gap: 0.9, p: 1, at: 2 }, { t: 'shaman', n: 5, gap: 1.5, p: 1, at: 6 }, { t: 'knight', n: 5, gap: 2, p: 0, at: 10 }],
      [{ t: 'troll', n: 1, gap: 1, p: 0 }, { t: 'orc', n: 10, gap: 1, p: 1, at: 2 }, { t: 'knight', n: 4, gap: 2.5, p: 1, at: 8 }, { t: 'troll', n: 1, gap: 1, p: 1, at: 22 }],
    ],
  },
  {
    name: 'Gün Batımı Tepesi', gold: 420, lives: 20, theme: 'dusk', hpMul: 2.1,
    paths: [
      [[-40, 150], [200, 140], [480, 150], [640, 180], [700, 260], [620, 320], [420, 300], [260, 330], [230, 400], [360, 460], [520, 460], [700, 440], [800, 380], [862, 330]],
    ],
    plots: [[376, 384], [556, 234], [310, 216], [502, 384], [790, 480], [142, 216], [472, 222], [778, 294], [226, 234], [64, 246], [148, 420]],
    waves: [
      [{t: 'goblin', n: 15, gap: 0.9, p: 0}],
      [{t: 'shaman', n: 3, gap: 2, at: 0, p: 0}, {t: 'orc', n: 3, gap: 1.2, at: 6, p: 0}],
      [{t: 'wolf', n: 6, gap: 0.6, at: 0, p: 0}, {t: 'goblin', n: 8, gap: 0.85, at: 3, p: 0}, {t: 'bandit', n: 3, gap: 1.05, at: 10, p: 0}],
      [{t: 'orc', n: 3, gap: 1.2, at: 0, p: 0}, {t: 'orc', n: 3, gap: 1.2, at: 6, p: 0}, {t: 'bandit', n: 4, gap: 1.05, at: 14, p: 0}],
      [{t: 'orc', n: 4, gap: 1.2, at: 0, p: 0}, {t: 'orc', n: 4, gap: 1.2, at: 7, p: 0}, {t: 'bandit', n: 5, gap: 1.05, at: 7, p: 0}],
      [{t: 'bat', n: 7, gap: 0.85, at: 0, p: 0}, {t: 'bandit', n: 5, gap: 1.05, at: 7, p: 0}, {t: 'goblin', n: 12, gap: 0.85, at: 11, p: 0}],
      [{t: 'bandit', n: 6, gap: 1.05, at: 0, p: 0}, {t: 'wolf', n: 11, gap: 0.6, at: 4, p: 0}, {t: 'orc', n: 5, gap: 1.2, at: 7, p: 0}],
      [{t: 'bat', n: 9, gap: 0.85, at: 0, p: 0}, {t: 'orc', n: 5, gap: 1.2, at: 3, p: 0}, {t: 'bandit', n: 7, gap: 1.05, at: 7, p: 0}],
      [{t: 'bandit', n: 5, gap: 1.05, at: 0, p: 0}, {t: 'orc', n: 4, gap: 1.2, at: 7, p: 0}, {t: 'orc', n: 4, gap: 1.2, at: 7, p: 0}, {t: 'shaman', n: 3, gap: 2, at: 18, p: 0}],
      [{t: 'wolf', n: 18, gap: 0.6, at: 0, p: 0}, {t: 'shaman', n: 6, gap: 2, at: 4, p: 0}, {t: 'bat', n: 13, gap: 0.85, at: 12, p: 0}],
    ],
  },
  {
    name: 'Bataklık Sınırı', gold: 520, lives: 20, theme: 'swamp', weather: 'rain', hpMul: 1.1,
    paths: [
      [[-40, 270], [140, 270], [260, 200], [420, 150], [580, 170], [680, 250], [760, 300], [862, 300]],
      [[-40, 270], [140, 270], [260, 350], [420, 400], [580, 380], [680, 320], [760, 300], [862, 300]],
    ],
    routes: {0: [0, 1]},
    plots: [[298, 282], [592, 282], [124, 348], [742, 378], [418, 288], [508, 276], [130, 192], [772, 222], [436, 222], [346, 462], [184, 396], [676, 420]],
    waves: [
      [{t: 'goblin', n: 17, gap: 0.9, p: 0}, {t: 'goblin', n: 8, gap: 0.9, p: 1, at: 2}],
      [{t: 'knight', n: 2, gap: 2.4, at: 0, p: 1}, {t: 'bandit', n: 5, gap: 1.05, at: 4, p: 0}],
      [{t: 'orc', n: 5, gap: 1.2, at: 0, p: 0}, {t: 'bandit', n: 6, gap: 1.05, at: 5, p: 1}],
      [{t: 'wolf', n: 8, gap: 0.6, at: 0, p: 1}, {t: 'knight', n: 2, gap: 2.4, at: 7, p: 0}, {t: 'orc', n: 4, gap: 1.2, at: 11, p: 1}],
      [{t: 'knight', n: 3, gap: 2.4, at: 0, p: 0}, {t: 'shaman', n: 5, gap: 2, at: 6, p: 1}],
      [{t: 'orc', n: 5, gap: 1.2, at: 0, p: 1}, {t: 'goblin', n: 14, gap: 0.85, at: 5, p: 0}, {t: 'shaman', n: 4, gap: 2, at: 11, p: 1}],
      [{t: 'wolf', n: 13, gap: 0.6, at: 0, p: 0}, {t: 'knight', n: 2, gap: 2.4, at: 5, p: 1}, {t: 'knight', n: 2, gap: 2.4, at: 9, p: 0}],
      [{t: 'bat', n: 7, gap: 0.85, at: 0, p: 1}, {t: 'orc', n: 5, gap: 1.2, at: 4, p: 0}, {t: 'bandit', n: 6, gap: 1.05, at: 8, p: 1}, {t: 'bandit', n: 6, gap: 1.05, at: 15, p: 0}],
      [{t: 'shaman', n: 4, gap: 2, at: 0, p: 0}, {t: 'wolf', n: 11, gap: 0.6, at: 6, p: 1}, {t: 'orc', n: 5, gap: 1.2, at: 8, p: 0}, {t: 'bandit', n: 6, gap: 1.05, at: 12, p: 1}],
      [{t: 'bat', n: 12, gap: 0.85, at: 0, p: 1}, {t: 'shaman', n: 6, gap: 2, at: 3, p: 0}, {t: 'bat', n: 12, gap: 0.85, at: 14, p: 1}],
      [{t: 'shaman', n: 7, gap: 2, at: 0, p: 0}, {t: 'bandit', n: 12, gap: 1.05, at: 4, p: 1}, {t: 'knight', n: 4, gap: 2.4, at: 12, p: 0}],
    ],
  },
  {
    name: 'Kayalık Boğaz', gold: 560, lives: 20, theme: 'rocky', weather: 'rain', hpMul: 1.15,
    paths: [
      [[300, -40], [300, 90], [420, 170], [540, 230], [660, 190], [770, 230], [760, 330], [790, 400], [862, 390]],
      [[-40, 410], [120, 410], [260, 360], [420, 290], [540, 230], [660, 190], [770, 230], [760, 330], [790, 400], [862, 390]],
    ],
    plots: [[640, 276], [364, 228], [118, 336], [664, 342], [292, 264], [532, 150], [784, 474], [250, 156], [196, 306], [520, 324], [706, 426], [310, 420]],
    waves: [
      [{t: 'goblin', n: 19, gap: 0.9, p: 0}],
      [{t: 'knight', n: 2, gap: 2.4, at: 0, p: 0}, {t: 'wolf', n: 10, gap: 0.6, at: 5, p: 0}],
      [{t: 'shaman', n: 3, gap: 2, at: 0, p: 0}, {t: 'orc', n: 4, gap: 1.2, at: 7, p: 0}, {t: 'bandit', n: 5, gap: 1.05, at: 6, p: 0}],
      [{t: 'wolf', n: 14, gap: 0.6, at: 0, p: 0}, {t: 'bandit', n: 8, gap: 1.05, at: 5, p: 0}],
      [{t: 'knight', n: 3, gap: 2.4, at: 0, p: 0}, {t: 'goblin', n: 21, gap: 0.85, at: 3, p: 0}],
      [{t: 'knight', n: 3, gap: 2.4, at: 0, p: 0}, {t: 'wolf', n: 19, gap: 0.6, at: 5, p: 0}],
      [{t: 'goblin', n: 18, gap: 0.85, at: 0, p: 0}, {t: 'orc', n: 6, gap: 1.2, at: 3, p: 0}, {t: 'goblin', n: 18, gap: 0.85, at: 7, p: 0}],
      [{t: 'bat', n: 11, gap: 0.85, at: 0, p: 0}, {t: 'shaman', n: 5, gap: 2, at: 6, p: 0}, {t: 'shaman', n: 5, gap: 2, at: 10, p: 0}],
      [{t: 'bat', n: 12, gap: 0.85, at: 0, p: 0}, {t: 'wolf', n: 17, gap: 0.6, at: 4, p: 0}, {t: 'orc', n: 8, gap: 1.2, at: 11, p: 0}],
      [{t: 'orc', n: 6, gap: 1.2, at: 0, p: 0}, {t: 'bat', n: 10, gap: 0.85, at: 3, p: 0}, {t: 'shaman', n: 5, gap: 2, at: 13, p: 0}, {t: 'bandit', n: 8, gap: 1.05, at: 12, p: 0}],
      [{t: 'troll', n: 1, gap: 1, at: 0, p: 0}, {t: 'shaman', n: 6, gap: 2, at: 0, p: 0}, {t: 'knight', n: 3, gap: 2.4, at: 5, p: 0}, {t: 'shaman', n: 6, gap: 2, at: 12, p: 0}],
    ],
  },
  {
    name: 'Karlı Geçit', gold: 630, lives: 20, theme: 'winter', weather: 'snow', hpMul: 1.2,
    paths: [
      [[180, -40], [180, 120], [300, 170], [600, 150], [740, 200], [700, 280], [500, 290], [300, 300], [200, 370], [300, 440], [560, 440], [700, 420], [862, 380]],
    ],
    plots: [[346, 372], [580, 366], [244, 234], [772, 324], [496, 372], [100, 144], [742, 486], [814, 162], [178, 276], [154, 204], [826, 234], [130, 420], [826, 468]],
    waves: [
      [{t: 'goblin', n: 21, gap: 0.9, p: 0}, {t: 'goblin', n: 11, gap: 0.9, p: 1, at: 2}],
      [{t: 'knight', n: 2, gap: 2.4, at: 0, p: 1}, {t: 'wolf', n: 11, gap: 0.6, at: 6, p: 0}],
      [{t: 'knight', n: 2, gap: 2.4, at: 0, p: 0}, {t: 'bat', n: 6, gap: 0.85, at: 4, p: 1}, {t: 'wolf', n: 9, gap: 0.6, at: 12, p: 0}],
      [{t: 'orc', n: 5, gap: 1.2, at: 0, p: 1}, {t: 'wolf', n: 11, gap: 0.6, at: 4, p: 0}, {t: 'goblin', n: 13, gap: 0.85, at: 14, p: 1}],
      [{t: 'wolf', n: 12, gap: 0.6, at: 0, p: 0}, {t: 'orc', n: 6, gap: 1.2, at: 5, p: 1}, {t: 'orc', n: 6, gap: 1.2, at: 7, p: 0}],
      [{t: 'knight', n: 4, gap: 2.4, at: 0, p: 1}, {t: 'goblin', n: 26, gap: 0.85, at: 6, p: 0}],
      [{t: 'bandit', n: 13, gap: 1.05, at: 0, p: 0}, {t: 'wolf', n: 24, gap: 0.6, at: 5, p: 1}],
      [{t: 'wolf', n: 13, gap: 0.6, at: 0, p: 1}, {t: 'knight', n: 2, gap: 2.4, at: 7, p: 0}, {t: 'bandit', n: 7, gap: 1.05, at: 10, p: 1}, {t: 'knight', n: 2, gap: 2.4, at: 15, p: 0}],
      [{t: 'knight', n: 3, gap: 2.4, at: 0, p: 0}, {t: 'knight', n: 3, gap: 2.4, at: 5, p: 1}, {t: 'knight', n: 3, gap: 2.4, at: 11, p: 0}, {t: 'knight', n: 3, gap: 2.4, at: 17, p: 1}],
      [{t: 'knight', n: 4, gap: 2.4, at: 0, p: 1}, {t: 'bat', n: 15, gap: 0.85, at: 3, p: 0}, {t: 'shaman', n: 7, gap: 2, at: 11, p: 1}],
      [{t: 'shaman', n: 8, gap: 2, at: 0, p: 0}, {t: 'bandit', n: 13, gap: 1.05, at: 5, p: 1}, {t: 'knight', n: 4, gap: 2.4, at: 7, p: 0}],
      [{t: 'troll', n: 1, gap: 1, at: 0, p: 0}, {t: 'knight', n: 3, gap: 2.4, at: 0, p: 1}, {t: 'knight', n: 3, gap: 2.4, at: 3, p: 0}, {t: 'bat', n: 12, gap: 0.85, at: 13, p: 1}, {t: 'knight', n: 3, gap: 2.4, at: 17, p: 0}],
    ],
  },
  {
    name: 'Kül Vadisi', gold: 700, lives: 20, theme: 'volcano', hpMul: 0.9,
    paths: [
      [[-40, 250], [150, 250], [300, 290], [460, 290], [600, 300], [720, 260], [862, 280]],
      [[420, -40], [430, 90], [480, 190], [460, 290], [600, 300], [720, 260], [862, 280]],
      [[640, 580], [640, 460], [620, 370], [600, 300], [720, 260], [862, 280]],
    ],
    plots: [[562, 228], [706, 348], [388, 216], [142, 324], [532, 378], [724, 414], [226, 348], [364, 150], [424, 366], [790, 342], [124, 174], [550, 444], [304, 216]],
    waves: [
      [{t: 'goblin', n: 24, gap: 0.9, p: 0}, {t: 'goblin', n: 12, gap: 0.9, p: 1, at: 2}],
      [{t: 'knight', n: 2, gap: 2.4, at: 0, p: 1}, {t: 'goblin', n: 15, gap: 0.85, at: 3, p: 0}],
      [{t: 'goblin', n: 19, gap: 0.85, at: 0, p: 0}, {t: 'knight', n: 3, gap: 2.4, at: 6, p: 1}],
      [{t: 'orc', n: 5, gap: 1.2, at: 0, p: 1}, {t: 'knight', n: 2, gap: 2.4, at: 6, p: 0}, {t: 'wolf', n: 12, gap: 0.6, at: 6, p: 1}],
      [{t: 'knight', n: 2, gap: 2.4, at: 0, p: 0}, {t: 'orc', n: 6, gap: 1.2, at: 6, p: 1}, {t: 'goblin', n: 17, gap: 0.85, at: 6, p: 0}],
      [{t: 'wolf', n: 24, gap: 0.6, at: 0, p: 1}, {t: 'knight', n: 4, gap: 2.4, at: 6, p: 0}],
      [{t: 'knight', n: 5, gap: 2.4, at: 0, p: 0}, {t: 'orc', n: 12, gap: 1.2, at: 5, p: 1}],
      [{t: 'shaman', n: 6, gap: 2, at: 0, p: 1}, {t: 'orc', n: 9, gap: 1.2, at: 4, p: 0}, {t: 'bandit', n: 11, gap: 1.05, at: 9, p: 1}],
      [{t: 'shaman', n: 7, gap: 2, at: 0, p: 0}, {t: 'wolf', n: 21, gap: 0.6, at: 7, p: 1}, {t: 'bat', n: 15, gap: 0.85, at: 13, p: 0}],
      [{t: 'shaman', n: 8, gap: 2, at: 0, p: 1}, {t: 'knight', n: 4, gap: 2.4, at: 7, p: 0}, {t: 'knight', n: 4, gap: 2.4, at: 14, p: 1}],
      [{t: 'knight', n: 3, gap: 2.4, at: 0, p: 0}, {t: 'shaman', n: 6, gap: 2, at: 4, p: 1}, {t: 'shaman', n: 6, gap: 2, at: 11, p: 0}, {t: 'shaman', n: 6, gap: 2, at: 17, p: 1}],
      [{t: 'troll', n: 1, gap: 1, at: 0, p: 0}, {t: 'troll', n: 1, gap: 1, at: 14, p: 1}, {t: 'bat', n: 9, gap: 0.85, at: 0, p: 1}, {t: 'knight', n: 2, gap: 2.4, at: 7, p: 0}, {t: 'shaman', n: 4, gap: 2, at: 8, p: 1}, {t: 'shaman', n: 4, gap: 2, at: 11, p: 0}],
    ],
  },
  {
    name: 'Donmuş Nehir', gold: 790, lives: 20, theme: 'winter', weather: 'snow', hpMul: 1.2,
    paths: [
      [[-40, 130], [150, 130], [350, 200], [500, 320], [620, 420], [760, 430], [862, 380]],
      [[-40, 430], [150, 430], [350, 360], [500, 250], [620, 170], [760, 200], [800, 300], [862, 380]],
    ],
    plots: [[652, 312], [328, 282], [736, 360], [454, 384], [142, 204], [124, 360], [460, 180], [682, 246], [244, 288], [850, 474], [64, 234], [508, 438], [64, 312], [340, 450]],
    waves: [
      [{t: 'goblin', n: 26, gap: 0.9, p: 0}, {t: 'goblin', n: 13, gap: 0.9, p: 1, at: 2}],
      [{t: 'knight', n: 2, gap: 2.4, at: 0, p: 1}, {t: 'knight', n: 2, gap: 2.4, at: 5, p: 0}],
      [{t: 'bandit', n: 6, gap: 1.05, at: 0, p: 0}, {t: 'goblin', n: 14, gap: 0.85, at: 4, p: 1}, {t: 'wolf', n: 11, gap: 0.6, at: 8, p: 0}],
      [{t: 'wolf', n: 20, gap: 0.6, at: 0, p: 1}, {t: 'goblin', n: 24, gap: 0.85, at: 6, p: 0}],
      [{t: 'knight', n: 3, gap: 2.4, at: 0, p: 0}, {t: 'shaman', n: 5, gap: 2, at: 3, p: 1}, {t: 'shaman', n: 5, gap: 2, at: 11, p: 0}],
      [{t: 'wolf', n: 26, gap: 0.6, at: 0, p: 1}, {t: 'goblin', n: 26, gap: 0.85, at: 3, p: 0}],
      [{t: 'bandit', n: 11, gap: 1.05, at: 0, p: 0}, {t: 'bat', n: 14, gap: 0.85, at: 4, p: 1}, {t: 'orc', n: 9, gap: 1.2, at: 11, p: 0}],
      [{t: 'troll', n: 1, gap: 1, at: 0, p: 0}, {t: 'shaman', n: 4, gap: 2, at: 0, p: 1}, {t: 'bat', n: 9, gap: 0.85, at: 6, p: 0}, {t: 'orc', n: 6, gap: 1.2, at: 11, p: 1}],
      [{t: 'shaman', n: 8, gap: 2, at: 0, p: 0}, {t: 'knight', n: 4, gap: 2.4, at: 3, p: 1}, {t: 'knight', n: 4, gap: 2.4, at: 13, p: 0}],
      [{t: 'wolf', n: 25, gap: 0.6, at: 0, p: 1}, {t: 'wolf', n: 25, gap: 0.6, at: 7, p: 0}, {t: 'bandit', n: 14, gap: 1.05, at: 7, p: 1}],
      [{t: 'orc', n: 9, gap: 1.2, at: 0, p: 0}, {t: 'bat', n: 15, gap: 0.85, at: 6, p: 1}, {t: 'shaman', n: 7, gap: 2, at: 11, p: 0}, {t: 'bandit', n: 11, gap: 1.05, at: 20, p: 1}],
      [{t: 'bat', n: 21, gap: 0.85, at: 0, p: 1}, {t: 'orc', n: 13, gap: 1.2, at: 4, p: 0}, {t: 'bat', n: 21, gap: 0.85, at: 8, p: 1}],
      [{t: 'troll', n: 1, gap: 1, at: 0, p: 0}, {t: 'troll', n: 1, gap: 1, at: 14, p: 1}, {t: 'shaman', n: 8, gap: 2, at: 0, p: 0}, {t: 'bat', n: 17, gap: 0.85, at: 6, p: 1}, {t: 'knight', n: 4, gap: 2.4, at: 11, p: 0}],
    ],
  },
  {
    name: 'Son Kale', gold: 960, lives: 20, theme: 'volcano', hpMul: 0.62,
    paths: [
      [[-40, 200], [140, 200], [280, 140], [440, 150], [560, 230], [640, 330], [760, 350], [862, 300]],
      [[700, -40], [700, 90], [600, 140], [560, 230], [640, 330], [760, 350], [862, 300]],
      [[-40, 200], [140, 200], [240, 300], [400, 350], [640, 330], [760, 350], [862, 300]],
    ],
    routes: {0: [0, 2]},
    plots: [[484, 270], [274, 222], [688, 258], [112, 282], [400, 252], [664, 192], [622, 408], [772, 264], [70, 342], [742, 162], [340, 414], [760, 426], [154, 342], [538, 414], [844, 402], [430, 426]],
    waves: [
      [{t: 'goblin', n: 28, gap: 0.9, p: 0}, {t: 'goblin', n: 14, gap: 0.9, p: 1, at: 2}],
      [{t: 'knight', n: 3, gap: 2.4, at: 0, p: 1}, {t: 'shaman', n: 5, gap: 2, at: 6, p: 0}],
      [{t: 'orc', n: 8, gap: 1.2, at: 0, p: 0}, {t: 'wolf', n: 18, gap: 0.6, at: 5, p: 0}],
      [{t: 'knight', n: 3, gap: 2.4, at: 0, p: 0}, {t: 'orc', n: 6, gap: 1.2, at: 6, p: 1}, {t: 'knight', n: 3, gap: 2.4, at: 11, p: 0}],
      [{t: 'knight', n: 4, gap: 2.4, at: 0, p: 1}, {t: 'knight', n: 4, gap: 2.4, at: 5, p: 0}],
      [{t: 'wolf', n: 15, gap: 0.7, at: 0, p: 0}, {t: 'bandit', n: 9, gap: 1.1, at: 4, p: 0}, {t: 'wolf', n: 15, gap: 0.7, at: 10, p: 1}],
      [{t: 'bat', n: 17, gap: 1, at: 0, p: 0}, {t: 'shaman', n: 10, gap: 2, at: 7, p: 1}],
      [{t: 'shaman', n: 7, gap: 2, at: 0, p: 1}, {t: 'knight', n: 4, gap: 2.4, at: 5, p: 0}],
      [{t: 'troll', n: 1, gap: 1, at: 0, p: 0}, {t: 'orc', n: 8, gap: 1.2, at: 0, p: 0}, {t: 'knight', n: 3, gap: 2.4, at: 5, p: 0}, {t: 'wolf', n: 17, gap: 0.6, at: 13, p: 1}],
      [{t: 'orc', n: 7, gap: 1.3, at: 0, p: 0}, {t: 'orc', n: 7, gap: 1.3, at: 5, p: 1}, {t: 'orc', n: 6, gap: 1.3, at: 15, p: 0}],
      [{t: 'shaman', n: 10, gap: 2, at: 0, p: 1}, {t: 'knight', n: 5, gap: 2.4, at: 6, p: 0}, {t: 'bandit', n: 17, gap: 1.05, at: 11, p: 0}],
      [{t: 'shaman', n: 11, gap: 2, at: 0, p: 0}, {t: 'shaman', n: 11, gap: 2, at: 6, p: 0}, {t: 'bandit', n: 18, gap: 1.05, at: 6, p: 1}],
      [{t: 'orc', n: 16, gap: 1.2, at: 0, p: 0}, {t: 'bat', n: 25, gap: 0.85, at: 3, p: 1}, {t: 'bandit', n: 19, gap: 1.05, at: 10, p: 0}],
      [{t: 'troll', n: 1, gap: 1, at: 0, p: 0}, {t: 'troll', n: 1, gap: 1, at: 14, p: 1}, {t: 'troll', n: 1, gap: 1, at: 28, p: 0}, {t: 'shaman', n: 5, gap: 2, at: 0, p: 1}, {t: 'bat', n: 12, gap: 0.85, at: 3, p: 0}, {t: 'knight', n: 3, gap: 2.4, at: 9, p: 0}, {t: 'knight', n: 3, gap: 2.4, at: 19, p: 1}],
    ],
  },
  // ===== 2. SEFER: KIZILKUM SULTANLIĞI =====
  {
    ep: 2, name: 'Kızılkum Kapısı', gold: 650, lives: 20, theme: 'desert', hpMul: 1.0,
    paths: [
      [[-40, 380], [140, 380], [260, 300], [260, 200], [380, 140], [540, 170], [620, 260], [560, 360], [660, 430], [790, 400], [862, 330]],
      [[-40, 380], [140, 380], [260, 300], [420, 300], [560, 360], [660, 430], [790, 400], [862, 330]],
    ],
    routes: {0: [0, 1]},
    plots: [[484, 240], [694, 354], [154, 276], [388, 222], [292, 384], [532, 450], [82, 312], [802, 480], [472, 402], [622, 132]],
    waves: [
      [{t: 'raider', n: 10, gap: 1.0, p: 0}],
      [{t: 'raider', n: 8, gap: 1.0, p: 0}, {t: 'scorpion', n: 4, gap: 1.4, at: 5.0, p: 0}],
      [{t: 'scorpion', n: 8, gap: 1.0, p: 0}],
      [{t: 'raider', n: 12, gap: 0.8, p: 0}, {t: 'scorpion', n: 5, gap: 1.2, at: 6.0, p: 0}],
      [{t: 'scorpion', n: 8, gap: 0.9, p: 0}, {t: 'raider', n: 10, gap: 0.8, at: 4.0, p: 0}],
      [{t: 'raider', n: 16, gap: 0.7, p: 0}, {t: 'scorpion', n: 8, gap: 1.0, at: 5.0, p: 0}],
      [{t: 'scorpion', n: 12, gap: 0.8, p: 0}, {t: 'raider', n: 14, gap: 0.7, at: 6.0, p: 0}],
      [{t: 'raider', n: 18, gap: 0.6, p: 0}, {t: 'scorpion', n: 12, gap: 0.8, at: 4.0, p: 0}],
    ],
  },
  {
    ep: 2, name: 'Vaha Yolu', gold: 700, lives: 20, theme: 'oasis', hpMul: 1.0,
    paths: [
      [[200, -40], [200, 100], [330, 170], [480, 140], [640, 170], [730, 260], [862, 280]],
      [[200, -40], [200, 100], [300, 260], [460, 340], [640, 340], [730, 290], [862, 280]],
    ],
    routes: {0: [0, 1]},
    plots: [[616, 264], [406, 234], [148, 192], [760, 360], [490, 258], [766, 186], [196, 264], [106, 132], [508, 420], [694, 402], [262, 330]],
    waves: [
      [{t: 'raider', n: 12, gap: 0.9, p: 0}],
      [{t: 'vulture', n: 6, gap: 1.1, p: 0}],
      [{t: 'scorpion', n: 8, gap: 1.0, p: 0}, {t: 'raider', n: 8, gap: 0.9, at: 4.0, p: 0}],
      [{t: 'vulture', n: 8, gap: 0.9, p: 0}, {t: 'raider', n: 10, gap: 0.8, at: 3.0, p: 0}],
      [{t: 'scorpion', n: 12, gap: 0.8, p: 0}, {t: 'vulture', n: 6, gap: 1.0, at: 6.0, p: 0}],
      [{t: 'raider', n: 16, gap: 0.7, p: 0}, {t: 'scorpion', n: 8, gap: 0.9, at: 5.0, p: 0}],
      [{t: 'vulture', n: 12, gap: 0.7, p: 0}, {t: 'scorpion', n: 10, gap: 0.8, at: 4.0, p: 0}],
      [{t: 'raider', n: 20, gap: 0.6, p: 0}, {t: 'vulture', n: 10, gap: 0.8, at: 5.0, p: 0}, {t: 'scorpion', n: 10, gap: 0.8, at: 9.0, p: 0}],
      [{t: 'scorpion', n: 16, gap: 0.7, p: 0}, {t: 'raider', n: 16, gap: 0.7, at: 3.0, p: 0}, {t: 'vulture', n: 12, gap: 0.7, at: 8.0, p: 0}],
    ],
  },
  {
    ep: 2, name: 'Akrep Vadisi', gold: 750, lives: 20, theme: 'canyon', hpMul: 1.0,
    paths: [
      [[320, -40], [320, 90], [200, 170], [300, 250], [480, 250], [620, 200], [740, 250], [862, 300]],
      [[560, 580], [560, 470], [420, 420], [340, 340], [480, 250], [620, 200], [740, 250], [862, 300]],
    ],
    plots: [[466, 342], [340, 180], [634, 282], [544, 372], [724, 324], [256, 318], [406, 138], [778, 180], [412, 498], [172, 264], [502, 156], [652, 492]],
    waves: [
      [{t: 'raider', n: 10, gap: 0.9, at: 0.0, p: 0}, {t: 'raider', n: 10, gap: 0.9, at: 3.0, p: 1}],
      [{t: 'scorpion', n: 8, gap: 1.0, at: 0.0, p: 0}, {t: 'vulture', n: 6, gap: 1.0, at: 3.0, p: 1}],
      [{t: 'scorpion', n: 10, gap: 0.9, at: 0.0, p: 1}, {t: 'raider', n: 10, gap: 0.8, at: 4.0, p: 0}],
      [{t: 'vulture', n: 10, gap: 0.8, at: 0.0, p: 0}, {t: 'scorpion', n: 10, gap: 0.9, at: 2.0, p: 1}],
      [{t: 'raider', n: 16, gap: 0.7, at: 0.0, p: 0}, {t: 'scorpion', n: 12, gap: 0.8, at: 3.0, p: 1}],
      [{t: 'scorpion', n: 14, gap: 0.7, at: 0.0, p: 0}, {t: 'scorpion', n: 14, gap: 0.7, at: 3.0, p: 1}],
      [{t: 'vulture', n: 14, gap: 0.7, at: 0.0, p: 1}, {t: 'raider', n: 16, gap: 0.7, at: 2.0, p: 0}],
      [{t: 'scorpion', n: 18, gap: 0.6, at: 0.0, p: 0}, {t: 'raider', n: 16, gap: 0.7, at: 3.0, p: 1}, {t: 'vulture', n: 10, gap: 0.8, at: 8.0, p: 0}],
      [{t: 'raider', n: 20, gap: 0.6, at: 0.0, p: 0}, {t: 'scorpion', n: 18, gap: 0.6, at: 2.0, p: 1}, {t: 'vulture', n: 14, gap: 0.7, at: 8.0, p: 1}],
    ],
  },
  {
    ep: 2, name: 'Tuz Gölü', gold: 800, lives: 20, theme: 'salt', hpMul: 1.05,
    paths: [
      [[-40, 300], [120, 300], [220, 190], [400, 130], [600, 140], [720, 220], [700, 350], [560, 430], [380, 440], [300, 360], [400, 290], [560, 300], [700, 320], [862, 310]],
    ],
    plots: [[448, 372], [622, 234], [304, 234], [766, 396], [544, 204], [88, 222], [388, 210], [706, 450], [220, 324], [808, 222], [592, 498], [112, 378]],
    waves: [
      [{t: 'raider', n: 14, gap: 0.8, p: 0}],
      [{t: 'camel', n: 3, gap: 2.5, p: 0}, {t: 'raider', n: 8, gap: 0.9, at: 4.0, p: 0}],
      [{t: 'scorpion', n: 12, gap: 0.8, p: 0}, {t: 'vulture', n: 6, gap: 1.0, at: 5.0, p: 0}],
      [{t: 'camel', n: 5, gap: 2.0, p: 0}, {t: 'scorpion', n: 8, gap: 0.9, at: 3.0, p: 0}],
      [{t: 'raider', n: 18, gap: 0.6, p: 0}, {t: 'camel', n: 4, gap: 2.0, at: 6.0, p: 0}],
      [{t: 'vulture', n: 14, gap: 0.7, p: 0}, {t: 'scorpion', n: 10, gap: 0.8, at: 4.0, p: 0}],
      [{t: 'camel', n: 7, gap: 1.6, p: 0}, {t: 'raider', n: 14, gap: 0.7, at: 4.0, p: 0}],
      [{t: 'scorpion', n: 16, gap: 0.6, p: 0}, {t: 'camel', n: 6, gap: 1.6, at: 5.0, p: 0}, {t: 'vulture', n: 10, gap: 0.8, at: 9.0, p: 0}],
      [{t: 'raider', n: 20, gap: 0.6, p: 0}, {t: 'camel', n: 8, gap: 1.4, at: 4.0, p: 0}, {t: 'scorpion', n: 14, gap: 0.7, at: 8.0, p: 0}],
      [{t: 'camel', n: 10, gap: 1.2, p: 0}, {t: 'vulture', n: 16, gap: 0.6, at: 4.0, p: 0}, {t: 'raider', n: 18, gap: 0.6, at: 8.0, p: 0}],
    ],
  },
  {
    ep: 2, name: 'Yıkık Şehir', gold: 850, lives: 20, theme: 'ruins', weather: 'sand', hpMul: 0.58,
    paths: [
      [[-40, 290], [150, 290], [450, 290], [760, 300], [862, 300]],
      [[-40, 290], [150, 290], [240, 150], [420, 130], [600, 150], [700, 230], [760, 300], [862, 300]],
      [[-40, 290], [150, 290], [240, 430], [420, 450], [600, 430], [700, 360], [760, 300], [862, 300]],
    ],
    routes: {0: [0, 1, 2]},
    plots: [[112, 378], [550, 366], [316, 216], [562, 216], [292, 366], [784, 390], [112, 204], [418, 378], [796, 222], [478, 210], [724, 444], [748, 162], [634, 498]],
    waves: [
      [{t: 'raider', n: 10, gap: 0.9, at: 0.0, p: 0}, {t: 'scorpion', n: 6, gap: 1.0, at: 3.0, p: 1}],
      [{t: 'sandworm', n: 4, gap: 2.0, at: 0.0, p: 1}, {t: 'raider', n: 10, gap: 0.8, at: 3.0, p: 0}],
      [{t: 'camel', n: 4, gap: 2.0, at: 0.0, p: 0}, {t: 'vulture', n: 8, gap: 0.9, at: 3.0, p: 1}],
      [{t: 'sandworm', n: 6, gap: 1.6, at: 0.0, p: 0}, {t: 'scorpion', n: 10, gap: 0.8, at: 3.0, p: 1}],
      [{t: 'raider', n: 16, gap: 0.7, at: 0.0, p: 1}, {t: 'camel', n: 5, gap: 1.8, at: 4.0, p: 0}],
      [{t: 'sandworm', n: 8, gap: 1.4, at: 0.0, p: 1}, {t: 'vulture', n: 10, gap: 0.8, at: 4.0, p: 0}],
      [{t: 'scorpion', n: 16, gap: 0.6, at: 0.0, p: 0}, {t: 'sandworm', n: 6, gap: 1.5, at: 4.0, p: 1}],
      [{t: 'camel', n: 8, gap: 1.4, at: 0.0, p: 0}, {t: 'raider', n: 16, gap: 0.7, at: 3.0, p: 1}, {t: 'sandworm', n: 6, gap: 1.5, at: 8.0, p: 0}],
      [{t: 'sandworm', n: 10, gap: 1.2, at: 0.0, p: 0}, {t: 'scorpion', n: 16, gap: 0.6, at: 3.0, p: 1}, {t: 'vulture', n: 12, gap: 0.7, at: 8.0, p: 0}],
      [{t: 'camel', n: 10, gap: 1.2, at: 0.0, p: 1}, {t: 'sandworm', n: 10, gap: 1.2, at: 3.0, p: 0}, {t: 'raider', n: 20, gap: 0.6, at: 8.0, p: 1}],
    ],
  },
  {
    ep: 2, name: 'Kum Denizi', gold: 900, lives: 20, theme: 'dunes', weather: 'sand', hpMul: 0.95,
    paths: [
      [[-40, 180], [200, 180], [380, 260], [520, 380], [680, 420], [800, 370], [862, 320]],
      [[620, -40], [620, 90], [480, 140], [340, 230], [300, 340], [420, 440], [580, 450], [680, 420], [800, 370], [862, 320]],
    ],
    plots: [[472, 228], [226, 264], [628, 342], [364, 498], [712, 324], [136, 246], [592, 186], [526, 282], [316, 138], [682, 498], [250, 414], [676, 150], [790, 462]],
    waves: [
      [{t: 'scorpion', n: 10, gap: 0.9, at: 0.0, p: 0}, {t: 'raider', n: 8, gap: 0.9, at: 3.0, p: 1}],
      [{t: 'sandworm', n: 6, gap: 1.6, at: 0.0, p: 0}, {t: 'vulture', n: 6, gap: 1.0, at: 3.0, p: 1}],
      [{t: 'camel', n: 5, gap: 1.8, at: 0.0, p: 1}, {t: 'raider', n: 12, gap: 0.8, at: 3.0, p: 0}],
      [{t: 'sandworm', n: 8, gap: 1.4, at: 0.0, p: 1}, {t: 'scorpion', n: 10, gap: 0.8, at: 3.0, p: 0}],
      [{t: 'vulture', n: 14, gap: 0.7, at: 0.0, p: 0}, {t: 'camel', n: 5, gap: 1.8, at: 4.0, p: 1}],
      [{t: 'raider', n: 18, gap: 0.6, at: 0.0, p: 0}, {t: 'sandworm', n: 8, gap: 1.4, at: 3.0, p: 1}],
      [{t: 'scorpion', n: 16, gap: 0.6, at: 0.0, p: 1}, {t: 'camel', n: 7, gap: 1.5, at: 4.0, p: 0}],
      [{t: 'sandworm', n: 10, gap: 1.2, at: 0.0, p: 0}, {t: 'vulture', n: 12, gap: 0.7, at: 3.0, p: 1}, {t: 'raider', n: 14, gap: 0.7, at: 8.0, p: 0}],
      [{t: 'camel', n: 10, gap: 1.2, at: 0.0, p: 0}, {t: 'scorpion', n: 18, gap: 0.6, at: 3.0, p: 1}, {t: 'sandworm', n: 8, gap: 1.4, at: 8.0, p: 1}],
      [{t: 'sandworm', n: 12, gap: 1.1, at: 0.0, p: 1}, {t: 'raider', n: 20, gap: 0.6, at: 3.0, p: 0}, {t: 'vulture', n: 14, gap: 0.7, at: 8.0, p: 1}],
      [{t: 'camel', n: 12, gap: 1.1, at: 0.0, p: 0}, {t: 'sandworm', n: 12, gap: 1.1, at: 3.0, p: 1}, {t: 'scorpion', n: 18, gap: 0.6, at: 8.0, p: 0}],
    ],
  },
  {
    ep: 2, name: 'Gece Kervanı', gold: 950, lives: 20, theme: 'desert', weather: 'night', hpMul: 0.95,
    paths: [
      [[-40, 130], [220, 130], [420, 170], [460, 270], [300, 320], [220, 400], [360, 460], [600, 450], [720, 380], [700, 270], [760, 200], [860, 260]],
      [[-40, 130], [220, 130], [420, 170], [560, 230], [700, 270], [760, 200], [860, 260]],
    ],
    routes: {0: [0, 1]},
    plots: [[352, 228], [622, 336], [364, 384], [796, 312], [142, 204], [532, 354], [268, 216], [448, 390], [652, 186], [526, 132], [64, 234], [814, 378], [136, 420]],
    waves: [
      [{t: 'raider', n: 14, gap: 0.8, p: 0}],
      [{t: 'djinn', n: 3, gap: 2.5, p: 0}, {t: 'scorpion', n: 8, gap: 0.9, at: 4.0, p: 0}],
      [{t: 'camel', n: 5, gap: 1.8, p: 0}, {t: 'vulture', n: 8, gap: 0.9, at: 5.0, p: 0}],
      [{t: 'djinn', n: 5, gap: 2.0, p: 0}, {t: 'raider', n: 12, gap: 0.8, at: 3.0, p: 0}],
      [{t: 'sandworm', n: 8, gap: 1.4, p: 0}, {t: 'scorpion', n: 10, gap: 0.8, at: 5.0, p: 0}],
      [{t: 'djinn', n: 6, gap: 1.8, p: 0}, {t: 'camel', n: 6, gap: 1.6, at: 4.0, p: 0}],
      [{t: 'vulture', n: 16, gap: 0.6, p: 0}, {t: 'raider', n: 14, gap: 0.7, at: 5.0, p: 0}],
      [{t: 'djinn', n: 8, gap: 1.5, p: 0}, {t: 'sandworm', n: 8, gap: 1.4, at: 4.0, p: 0}, {t: 'scorpion', n: 12, gap: 0.7, at: 9.0, p: 0}],
      [{t: 'camel', n: 10, gap: 1.2, p: 0}, {t: 'djinn', n: 8, gap: 1.5, at: 4.0, p: 0}, {t: 'raider', n: 18, gap: 0.6, at: 8.0, p: 0}],
      [{t: 'sandworm', n: 12, gap: 1.1, p: 0}, {t: 'vulture', n: 14, gap: 0.7, at: 4.0, p: 0}, {t: 'djinn', n: 8, gap: 1.5, at: 9.0, p: 0}],
      [{t: 'djinn', n: 10, gap: 1.3, p: 0}, {t: 'camel', n: 10, gap: 1.2, at: 4.0, p: 0}, {t: 'scorpion', n: 18, gap: 0.6, at: 9.0, p: 0}],
      [{t: 'raider', n: 24, gap: 0.5, p: 0}, {t: 'djinn', n: 10, gap: 1.3, at: 4.0, p: 0}, {t: 'sandworm', n: 12, gap: 1.1, at: 9.0, p: 0}],
    ],
  },
  {
    ep: 2, name: 'Mezarlar Vadisi', gold: 1000, lives: 20, theme: 'tombs', weather: 'night', hpMul: 0.95,
    paths: [
      [[-40, 170], [160, 170], [320, 230], [480, 220], [620, 280], [740, 330], [862, 330]],
      [[-40, 420], [160, 420], [320, 360], [480, 380], [620, 280], [740, 330], [862, 330]],
      [[-40, 170], [160, 170], [300, 100], [500, 90], [640, 160], [620, 280], [740, 330], [862, 330]],
    ],
    routes: {0: [0, 2]},
    plots: [[472, 294], [718, 234], [202, 270], [118, 300], [622, 378], [340, 438], [730, 402], [718, 132], [424, 456], [802, 258], [562, 426], [814, 408], [646, 444], [778, 180]],
    waves: [
      [{t: 'mummy', n: 4, gap: 2.0, at: 0.0, p: 0}, {t: 'raider', n: 10, gap: 0.8, at: 3.0, p: 1}],
      [{t: 'mummy', n: 6, gap: 1.6, at: 0.0, p: 1}, {t: 'scorpion', n: 8, gap: 0.9, at: 3.0, p: 0}],
      [{t: 'djinn', n: 4, gap: 2.0, at: 0.0, p: 0}, {t: 'mummy', n: 6, gap: 1.6, at: 3.0, p: 1}],
      [{t: 'camel', n: 5, gap: 1.8, at: 0.0, p: 1}, {t: 'mummy', n: 6, gap: 1.6, at: 3.0, p: 0}],
      [{t: 'mummy', n: 8, gap: 1.4, at: 0.0, p: 0}, {t: 'vulture', n: 10, gap: 0.8, at: 3.0, p: 1}],
      [{t: 'sandworm', n: 8, gap: 1.4, at: 0.0, p: 1}, {t: 'mummy', n: 8, gap: 1.4, at: 3.0, p: 0}],
      [{t: 'djinn', n: 8, gap: 1.5, at: 0.0, p: 0}, {t: 'raider', n: 16, gap: 0.7, at: 3.0, p: 1}],
      [{t: 'mummy', n: 10, gap: 1.2, at: 0.0, p: 0}, {t: 'mummy', n: 10, gap: 1.2, at: 3.0, p: 1}, {t: 'scorpion', n: 12, gap: 0.7, at: 8.0, p: 0}],
      [{t: 'camel', n: 10, gap: 1.2, at: 0.0, p: 1}, {t: 'djinn', n: 8, gap: 1.5, at: 3.0, p: 0}, {t: 'mummy', n: 8, gap: 1.4, at: 8.0, p: 1}],
      [{t: 'mummy', n: 12, gap: 1.1, at: 0.0, p: 0}, {t: 'sandworm', n: 10, gap: 1.2, at: 3.0, p: 1}, {t: 'vulture', n: 12, gap: 0.7, at: 8.0, p: 0}],
      [{t: 'djinn', n: 10, gap: 1.3, at: 0.0, p: 1}, {t: 'mummy', n: 12, gap: 1.1, at: 3.0, p: 0}, {t: 'camel', n: 8, gap: 1.4, at: 8.0, p: 1}],
      [{t: 'mummy', n: 14, gap: 1.0, at: 0.0, p: 0}, {t: 'mummy', n: 14, gap: 1.0, at: 3.0, p: 1}, {t: 'djinn', n: 10, gap: 1.3, at: 8.0, p: 0}],
    ],
  },
  {
    ep: 2, name: 'Güneş Tapınağı', gold: 1060, lives: 20, theme: 'temple', hpMul: 0.9,
    paths: [
      [[-40, 250], [160, 250], [300, 320], [460, 330], [600, 280], [720, 300], [862, 330]],
      [[460, -40], [460, 100], [380, 180], [460, 330], [600, 280], [720, 300], [862, 330]],
      [[460, -40], [460, 100], [580, 150], [700, 200], [720, 300], [862, 330]],
    ],
    routes: {1: [1, 2]},
    plots: [[508, 216], [796, 240], [304, 240], [652, 360], [130, 318], [412, 408], [730, 390], [118, 168], [496, 402], [742, 132], [286, 174], [328, 402], [814, 402], [64, 360]],
    waves: [
      [{t: 'golem', n: 1, gap: 1.0, at: 0.0, p: 0}, {t: 'raider', n: 12, gap: 0.8, at: 3.0, p: 1}],
      [{t: 'mummy', n: 6, gap: 1.6, at: 0.0, p: 1}, {t: 'scorpion', n: 10, gap: 0.8, at: 3.0, p: 0}],
      [{t: 'golem', n: 2, gap: 4.0, at: 0.0, p: 0}, {t: 'vulture', n: 10, gap: 0.8, at: 3.0, p: 1}],
      [{t: 'djinn', n: 6, gap: 1.8, at: 0.0, p: 1}, {t: 'camel', n: 6, gap: 1.6, at: 3.0, p: 0}],
      [{t: 'golem', n: 2, gap: 4.0, at: 0.0, p: 1}, {t: 'mummy', n: 8, gap: 1.4, at: 3.0, p: 0}],
      [{t: 'sandworm', n: 10, gap: 1.2, at: 0.0, p: 0}, {t: 'raider', n: 16, gap: 0.7, at: 3.0, p: 1}],
      [{t: 'golem', n: 3, gap: 3.5, at: 0.0, p: 0}, {t: 'djinn', n: 8, gap: 1.5, at: 3.0, p: 1}],
      [{t: 'mummy', n: 12, gap: 1.1, at: 0.0, p: 1}, {t: 'scorpion', n: 16, gap: 0.6, at: 3.0, p: 0}, {t: 'vulture', n: 10, gap: 0.8, at: 8.0, p: 1}],
      [{t: 'golem', n: 3, gap: 3.5, at: 0.0, p: 1}, {t: 'camel', n: 10, gap: 1.2, at: 3.0, p: 0}, {t: 'djinn', n: 8, gap: 1.5, at: 8.0, p: 0}],
      [{t: 'sandworm', n: 12, gap: 1.1, at: 0.0, p: 0}, {t: 'mummy', n: 12, gap: 1.1, at: 3.0, p: 1}, {t: 'raider', n: 18, gap: 0.6, at: 8.0, p: 0}],
      [{t: 'golem', n: 4, gap: 3.0, at: 0.0, p: 0}, {t: 'djinn', n: 10, gap: 1.3, at: 3.0, p: 1}, {t: 'scorpion', n: 18, gap: 0.6, at: 8.0, p: 1}],
      [{t: 'golem', n: 4, gap: 3.0, at: 0.0, p: 1}, {t: 'mummy', n: 14, gap: 1.0, at: 3.0, p: 0}, {t: 'camel', n: 10, gap: 1.2, at: 8.0, p: 1}],
    ],
  },
  {
    ep: 2, name: 'Kızıl Saray', gold: 1190, lives: 20, theme: 'palace', weather: 'sand', hpMul: 0.85,
    paths: [
      [[-40, 300], [150, 300], [280, 240], [420, 250], [540, 300], [680, 300], [862, 290]],
      [[380, -40], [380, 90], [300, 170], [280, 240], [420, 250], [540, 300], [680, 300], [862, 290]],
      [[600, 580], [600, 460], [500, 400], [540, 300], [680, 300], [862, 290]],
      [[-40, 300], [150, 300], [230, 380], [380, 430], [500, 400], [540, 300], [680, 300], [862, 290]],
    ],
    routes: {0: [0, 3]},
    plots: [[382, 324], [622, 378], [292, 324], [118, 378], [418, 174], [706, 372], [502, 492], [142, 222], [556, 216], [802, 366], [226, 132], [64, 192], [484, 132], [682, 438], [748, 222], [640, 222]],
    waves: [
      [{t: 'raider', n: 12, gap: 0.8, at: 0.0, p: 0}, {t: 'scorpion', n: 8, gap: 0.9, at: 3.0, p: 1}],
      [{t: 'vulture', n: 10, gap: 0.8, at: 0.0, p: 2}, {t: 'camel', n: 5, gap: 1.8, at: 3.0, p: 0}],
      [{t: 'mummy', n: 8, gap: 1.4, at: 0.0, p: 1}, {t: 'djinn', n: 5, gap: 2.0, at: 3.0, p: 2}],
      [{t: 'sandworm', n: 8, gap: 1.4, at: 0.0, p: 0}, {t: 'raider', n: 14, gap: 0.7, at: 3.0, p: 1}],
      [{t: 'golem', n: 2, gap: 4.0, at: 0.0, p: 2}, {t: 'scorpion', n: 14, gap: 0.7, at: 3.0, p: 0}],
      [{t: 'camel', n: 8, gap: 1.4, at: 0.0, p: 1}, {t: 'mummy', n: 10, gap: 1.2, at: 3.0, p: 0}, {t: 'vulture', n: 10, gap: 0.8, at: 8.0, p: 2}],
      [{t: 'djinn', n: 10, gap: 1.3, at: 0.0, p: 2}, {t: 'sandworm', n: 10, gap: 1.2, at: 3.0, p: 1}],
      [{t: 'golem', n: 3, gap: 3.5, at: 0.0, p: 0}, {t: 'raider', n: 20, gap: 0.6, at: 3.0, p: 1}, {t: 'scorpion', n: 14, gap: 0.7, at: 8.0, p: 2}],
      [{t: 'mummy', n: 14, gap: 1.0, at: 0.0, p: 0}, {t: 'camel', n: 10, gap: 1.2, at: 3.0, p: 1}, {t: 'djinn', n: 8, gap: 1.5, at: 8.0, p: 2}],
      [{t: 'sandworm', n: 12, gap: 1.1, at: 0.0, p: 1}, {t: 'golem', n: 3, gap: 3.5, at: 3.0, p: 0}, {t: 'vulture', n: 16, gap: 0.6, at: 8.0, p: 2}],
      [{t: 'djinn', n: 12, gap: 1.2, at: 0.0, p: 2}, {t: 'mummy', n: 14, gap: 1.0, at: 3.0, p: 1}, {t: 'scorpion', n: 18, gap: 0.6, at: 8.0, p: 0}],
      [{t: 'golem', n: 4, gap: 3.0, at: 0.0, p: 0}, {t: 'camel', n: 12, gap: 1.1, at: 3.0, p: 1}, {t: 'raider', n: 24, gap: 0.5, at: 8.0, p: 2}],
      [{t: 'sandworm', n: 14, gap: 1.0, at: 0.0, p: 0}, {t: 'djinn', n: 12, gap: 1.2, at: 3.0, p: 2}, {t: 'mummy', n: 14, gap: 1.0, at: 8.0, p: 1}],
      [{t: 'golem', n: 5, gap: 2.6, at: 0.0, p: 1}, {t: 'scorpion', n: 20, gap: 0.5, at: 3.0, p: 0}, {t: 'vulture', n: 18, gap: 0.6, at: 6.0, p: 2}, {t: 'camel', n: 12, gap: 1.1, at: 10.0, p: 0}],
    ],
  },
];

// ----- seferler -----
// Bölümler seferlere ayrılır; her sefer bir ülkede geçer ve haritada kendi sayfası olur.
// Bir sefer, bir önceki seferin son bölümü bitince açılır. bg: harita arka planı.
// nodes: bölüm haritasında bölüm bayraklarının yeri (960x540 ekran koordinatı; harita görseli ekranı kaplar).
// Bayraklar bu sırayla, aralarındaki noktalı patikayla birbirine bağlanır.
const EPISODES = [
  { name: 'Ardan Krallığı', bg: 'title_bg',
    nodes: [[96, 470], [190, 428], [292, 458], [392, 486], [468, 436], [574, 452], [680, 418], [774, 366], [700, 318], [512, 376]] },
  { name: 'Kızılkum Sultanlığı', bg: 'title_bg_2',
    nodes: [[178, 470], [280, 412], [407, 404], [540, 430], [667, 427], [776, 369], [782, 302], [704, 257], [649, 221], [746, 190]] },
];

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
  solarcher: { name: 'Solarian Okçusu',     h: 30, hp: 45,  speed: 26, armor: 0,    mr: 0,    gold: 9,  dmg: [1, 3],   rate: 1,   lives: 1, r: 9, ranged: { r: 115, dmg: [4, 7], rate: 2, proj: 'knife' } },
  gladiator: { name: 'Gladyatör',           h: 31, hp: 120, speed: 30, armor: 0,    mr: 0,    gold: 14, dmg: [6, 10],  rate: 0.8, lives: 1, r: 9 },
  assassin:  { name: 'Suikastçı',           h: 30, hp: 80,  speed: 38, armor: 0,    mr: 0.25, gold: 15, dmg: [5, 9],   rate: 0.8, lives: 1, r: 9, blink: { cd: 9, d: 55 } },
  priest:    { name: 'Savaş Rahibi',        h: 30, hp: 140, speed: 19, armor: 0,    mr: 0.5,  gold: 20, dmg: [2, 4],   rate: 1,   lives: 1, r: 10, heals: true },
  heavy:     { name: 'Ağır Piyade',         h: 33, hp: 380, speed: 14, armor: 0.7,  mr: 0,    gold: 32, dmg: [9, 15],  rate: 1.3, lives: 1, r: 12 },
  cavalry:   { name: 'Solarian Süvarisi',   h: 42, hp: 280, speed: 34, armor: 0.3,  mr: 0,    gold: 28, dmg: [10, 16], rate: 1.1, lives: 2, r: 13 },
  ram:       { name: 'Koçbaşı',             h: 40, hp: 700, speed: 9,  armor: 0.45, mr: 0.1,  gold: 55, dmg: [2, 4],   rate: 2,   lives: 3, r: 16 },
  catapult:  { name: 'Mancınık Arabası',    h: 40, hp: 420, speed: 12, armor: 0.2,  mr: 0,    gold: 38, dmg: [2, 4],   rate: 2,   lives: 2, r: 14,
    desc: 'Durup kulelerimize taş atar, 3 sn susturur', ab: { bomb: { cd: 12, stun: 3, r: 200 } } },
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
Object.assign(BOSS_ESCORT, { centurion: [['legion', 4]], champion: [['gladiator', 2]], shadowmaster: [['assassin', 3]], cavcaptain: [['cavalry', 2]], gloriosus: [['heavy', 2], ['legion', 4]] });

// Bölümler: yol ve arsa düzeni eski ilk 5 bölümden; ortam, dalgalar ve boss yeni
{
  const old = LEVELS.slice(0, 5).map(l => ({ paths: l.paths, plots: l.plots, routes: l.routes }));
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
    { name: 'Kara Göl Geçidi', theme: 'blacklake', gold: 560, hpMul: 0.75, bossT: 'cavcaptain', waves: [
      [{ t: 'legion', n: 8, gap: 1 }, { t: 'heavy', n: 1, gap: 1, at: 8 }],
      [{ t: 'cavalry', n: 3, gap: 2 }, { t: 'legion', n: 6, gap: 1, at: 5 }],
      [{ t: 'heavy', n: 3, gap: 2.4 }, { t: 'priest', n: 2, gap: 3, at: 3 }, { t: 'solarcher', n: 5, gap: 1.2, at: 7 }],
      [{ t: 'ram', n: 1, gap: 1 }, { t: 'legion', n: 10, gap: 0.8, at: 2 }, { t: 'gladiator', n: 4, gap: 1.2, at: 10 }],
      [{ t: 'cavalry', n: 5, gap: 1.5 }, { t: 'assassin', n: 6, gap: 1, at: 6 }, { t: 'heavy', n: 2, gap: 3, at: 10 }],
      [{ t: 'heavy', n: 4, gap: 2 }, { t: 'priest', n: 3, gap: 2.5, at: 3 }, { t: 'cavalry', n: 4, gap: 1.6, at: 10 }, { t: 'legion', n: 10, gap: 0.7, at: 14 }],
      [{ t: 'ram', n: 2, gap: 6 }, { t: 'gladiator', n: 8, gap: 0.9, at: 3 }, { t: 'cavalry', n: 4, gap: 1.5, at: 12 }],
      [{ t: 'heavy', n: 4, gap: 2 }, { t: 'cavalry', n: 6, gap: 1.4, at: 4 }, { t: 'priest', n: 3, gap: 2.5, at: 8 }, { t: 'legion', n: 12, gap: 0.6, at: 12 }],
    ] },
    { name: "Mortimer'ın Kapısı", theme: 'necrogate', gold: 650, hpMul: 0.7, bossT: 'gloriosus', waves: [
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
  // dalga düzeni (8 Eki): her bölüm 8 dalga, her dalga öncekinden %30 kalabalık; total = bölümün boss hariç düşman sayısı
  // (önceki düzenin ~2,1 katı: 56, 64, 74, 74, 119 -> aşağıdakiler)
  const TOTAL = [118, 134, 155, 155, 250];
  L.forEach((l, i) => Object.assign(l, old[i], { lives: 20, ep: 1, total: TOTAL[i], grow: 1.3 }));
  LEVELS.splice(0, LEVELS.length, ...L);
  EPISODES.splice(0, EPISODES.length, { name: 'Lanetli Sınır', bg: 'nm_title', nodes: [[150, 450], [300, 420], [450, 450], [600, 410], [760, 360]] });
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
const NAMES = { poison: 'Veba Kemiği', snipe: 'Kemik Mızrak', shield: 'Mezar Bekçisi', blade: 'Ölüm Şövalyesi', frost: 'Lanet', blast: 'Ruh Fırtınası', napalm: 'Çürüme Bulutu', double: 'Çifte Kazan' };
for (const k in TOWERS) for (const a of TOWERS[k].abilities || []) if (NAMES[a.id]) a.name = NAMES[a.id];
// komutanlar (tek seçilir): Kont Vladrik (eski komutanın yetenekleri), Wailing Wren (eski okçunun yetenekleri)
Object.assign(HEROES.commander, { name: 'Kont Vladrik', role: 'Vampir · Yakın dövüş', sprite: 'hero_vladrik', h: 31, aura: '220,40,60' });
Object.assign(HEROES.zeynep, { name: 'Wailing Wren', role: 'Banshee · Uzun menzil', sprite: 'hero_wren', h: 30, aura: '150,255,190', unlock: 2 });
HERO_ORDER.splice(0, HERO_ORDER.length, 'commander', 'zeynep');
Object.assign(HERO_ULT.commander, { name: 'Kan Kılıçları' });
Object.assign(HERO_ULT.zeynep, { name: 'Ölüm Çığlığı', cd: 50, r: 82, dmg: [26, 36], stun: 1.6, desc: 'Wren çığlık atar: alandaki düşmanlar hasar alır ve 1,6 sn sersemler' });
// kale yerine Mortimer'ın kulesi: balkonda Mortimer durur, okçular pencere önlerinde
Object.assign(CASTLE, { spots: [[0.21, 0.385], [0.67, 0.41], [0.46, 0.16]] }); // şapel: iki kulenin çıkıntısı ve alınlık tepesi
// Mortimer'ın büyüleri (sol altta, bekleme süreli). raise: hedefsiz, süre boyunca ölen düşmanlar iskelet minyon olur.
// fear: hedefli alan, düşmanlar kavgayı bırakıp yolda geri kaçar (bosslar yarı süre).
const NECRO_SPELLS = {
  // cesetler ölümden sonra corpse sn yerde yatar; büyü o an yerdeki cesetleri iskelet minyon olarak kaldırır
  nm_raise: { name: 'Ölüleri Diriltme', cd: 45, corpse: 4, col: '120,255,140', max: 10, minion: { hp: 80, dmg: [4, 8], armor: 0.1, life: 30 },
    desc: 'Yerde yatan düşman cesetleri (ölümden sonra 4 sn) iskelet minyonun olarak kalkar · 30 sn yaşarlar' },
  nm_fear:  { name: 'Korku', cd: 40, r: 120, t: 3.5, col: '190,120,255', desc: 'Seçilen alandaki düşmanlar korkuyla 3,5 sn geri kaçar' },
};
Object.assign(CASTLE.levels[0], { title: 'Şapel Okçuları', perk: 'Şapel bir iskelet okçuyla kendini savunur' });
Object.assign(CASTLE.levels[1], { title: 'Kemik Nişancılar', perk: 'İki iskelet okçu, daha sert kemik oklar' });
Object.assign(CASTLE.levels[2], { title: 'Ölüm Muhafızları', perk: 'Üç usta iskelet okçu, %15 kritik vuruş' });

const LEVEL_BOSS = ['goblin_king', 'wolf_alpha', 'orc_warlord', 'dark_shaman', 'death_knight', 'troll_king', 'wolf_alpha', 'dark_shaman', 'death_knight', 'overlord',
  'raider_chief', 'raider_chief', 'scorpion_queen', 'scorpion_queen', 'mummy_king', 'worm_king', 'mummy_king', 'mummy_king', 'golem_titan', 'storm_djinn'];
// boss gücü kademesi: 1. seferde bölüm sırası; 2. sefer 1. seferin sonlarından başlar, yavaşça yükselir
LEVELS.forEach((lv, i) => { lv.ep = lv.ep || 1; lv.tier = lv.ep === 2 ? 7 + 0.5 * (i - 10) : i; });
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
// Yol düzeni: giriş sayısı, kale yeri (yolun ucunda kapı) ve dalga gruplarının girişlere dağıtımı
LEVELS.forEach((lv) => {
  const alts = new Set();
  for (const k in lv.routes || {}) for (const i of lv.routes[k]) if (i !== +k) alts.add(i);
  lv.entr = lv.paths.length - alts.size;
  const end = lv.paths[0][lv.paths[0].length - 1];
  lv.castle = [end[0] + 35, end[1] + 5]; // kale görselinin kapısı (oranla 0.27, 0.86) yolun ucuna gelir
  lv.waves.forEach((w, k) => w.forEach((g, j) => { g.p = lv.entr > 1 ? (g.p != null ? g.p % lv.entr : (k + j) % lv.entr) : 0; }));
});
LEVELS.forEach((lv, i) => shapeWaves(lv, i));
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
const UPGRADES = [
  { id: 'archer',   name: 'Okçular',   ranks: [{ cost: 1, desc: '+%10 hasar' }, { cost: 2, desc: '+%10 menzil' }, { cost: 3, desc: '+%15 hasar' }] },
  { id: 'barracks', name: 'Kışla',     ranks: [{ cost: 1, desc: '+%20 asker canı' }, { cost: 2, desc: '+%20 asker hasarı' }, { cost: 3, desc: '+%15 zırh, hızlı doğma' }] },
  { id: 'mage',     name: 'Büyücüler', ranks: [{ cost: 1, desc: '+%10 hasar' }, { cost: 2, desc: '+%10 menzil' }, { cost: 3, desc: '+%15 hasar' }] },
  { id: 'artillery',name: 'Toplar',    ranks: [{ cost: 1, desc: '+%10 hasar' }, { cost: 2, desc: '+%15 patlama alanı' }, { cost: 3, desc: '+%15 hasar' }] },
  { id: 'spells',   name: 'Güçler',    ranks: [{ cost: 1, desc: '+%20 kahraman gücü hasarı' }, { cost: 2, desc: '+1 paralı asker' }, { cost: 3, desc: 'Güçler ve paralı askerler %25 hızlı' }] },
  { id: 'castle',   name: 'Kale',      ranks: [{ cost: 1, desc: '+3 can' }, { cost: 2, desc: '+60 altın' }, { cost: 3, desc: '+3 can, +60 altın' }] },
];
// Oyun tek, sabit zorlukta oynanır
// gold: başlangıç altını çarpanı, bounty: düşman ödülü ve erken çağrı bonusu çarpanı (kazanç)
const GAME_DIFF = { hp: 1.0, gold: 1, bounty: 0.8, lives: 20 }; // tek kahramana geçince düşman canı 1.15'ten 1.0'a indi

// Her kahramanın 3 yeteneği vardır (sade tutmak için); kahraman 4. seviyeye kadar çıkar, her seviyede 1 puan kazanır.
const HERO_SKILLS = {
  commander: ['bash', 'whirl', 'cry'],
  caner: ['holy', 'shieldthrow', 'quake'],
  zeynep: ['volley', 'multishot', 'blastarrow'],
  tarcin: ['shadowstep', 'clawstorm', 'dodge'],
  sage: ['flamering', 'icelance', 'freeze'],
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
  catapult: { blast: 1.3, melee: 1.2 }, centurion: { magic: 1.2 }, champion: { arrow: 1.2 }, shadowmaster: { blast: 1.3 }, cavcaptain: { blast: 1.2 },
  gloriosus: { magic: 0.85, arrow: 0.85, blast: 1.1 },
});

// Necromancer: kule seviye unvanları ve uzmanlık adları
if (NECRO) {
  Object.assign(TOWER_TITLES, { archer: ['Kemik Dikilitaşı', 'Dikenli Dikilitaş', 'Omurga Dikilitaşı'], barracks: ['Mahzen', 'Kemik Mahzeni', 'Kara Türbe'],
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
  TOWERS.archer.levels[0].perk = 'Hızla kemik kıymığı fırlatır · uçanları da vurur';
  TOWERS.archer.levels[1].perk = 'Daha hızlı · delici kıymık: %25 şansla zırhı yok sayar · +menzil';
  TOWERS.archer.levels[2].perk = 'Çok hızlı kıymık yağmuru · %15 kritik vuruş · çok daha uzun menzil';
  TOWERS.mage.levels[1].perk = 'Daha hızlı yükleme · ruh soğuğu: vurduğunu 1 sn %30 yavaşlatır';
  TOWERS.mage.levels[2].perk = 'Hızlı yükleme · ruh zinciri: yakındaki ikinci düşmana %60 hasar';
}

// ----- Kan Sunağı (yeni kule, 3. bölümde açılır): saldırmaz, menzilindeki kuleleri hızlandırır -----
if (NECRO) {
  TOWERS.altar = {
    name: 'Kan Sunağı', icon: 'altar', dmgType: 'none', air: false, support: true, unlockLevel: 2,
    desc: 'Saldırmaz: çevresindeki kulelerin atış hızını artırır',
    levels: [
      { cost: 90,  range: 110, buff: 0.2, title: 'Kan Sunağı', perk: 'Menzildeki kuleler %20 daha hızlı atar' },
      { cost: 130, range: 122, buff: 0.3, title: 'Kan Kadehi', perk: 'Menzildeki kuleler %30 daha hızlı atar · +menzil' },
      { cost: 180, range: 135, buff: 0.4, title: 'Kanlı Kalp Tapınağı', perk: 'Menzildeki kuleler %40 daha hızlı atar · geniş menzil' },
    ],
    abilities: [
      { id: 'rite', name: 'Kan Ayini', desc: (r) => `Güçlendirdiği kulelere +%${Math.round(r.dmg * 100)} hasar`,
        ranks: [{ cost: 150, dmg: 0.1 }, { cost: 200, dmg: 0.18 }, { cost: 260, dmg: 0.25 }] },
      { id: 'ward', name: 'Kan Kalkanı', desc: (r) => `Menzildeki iskeletler saniyede ${r.hps} can yeniler`,
        ranks: [{ cost: 140, hps: 4 }, { cost: 190, hps: 8 }, { cost: 240, hps: 13 }] },
    ],
  };
  TOWER_ORDER.push('altar');
  Object.assign(SPEC, { rite: { title: 'Kan Ayini Tapınağı', who: 'Kulelere ek hasar veren kan ritüeli' }, ward: { title: 'Kan Kalkanı Tapınağı', who: 'İskeletleri iyileştiren kan halesi' } });
}

// necro teması: yıldız gelişmeleri ve hasar türü adları (eski kule/kale adlarının yerine)
if (NECRO) {
  const U = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
  U.archer.name = 'Dikilitaşlar'; U.barracks.name = 'Mahzen'; U.mage.name = 'Ruh Fenerleri'; U.artillery.name = 'Veba Kazanları';
  U.barracks.ranks[0].desc = '+%20 iskelet canı'; U.barracks.ranks[1].desc = '+%20 iskelet hasarı';
  U.artillery.ranks[1].desc = '+%15 veba alanı';
  U.spells.name = 'Büyüler';
  U.spells.ranks[0].desc = '+%20 komutan gücü hasarı'; U.spells.ranks[1].desc = '+1 şapel iskeleti'; U.spells.ranks[2].desc = 'Güçler ve iskeletler %25 hızlı';
  U.castle.name = 'Şapel';
  Object.assign(WK_NAME, { arrow: 'Kemik', magic: 'Ruh', blast: 'Veba', melee: 'Kılıç' });
}
