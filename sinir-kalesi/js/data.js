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
  orc:     { name: 'Ork',           hp: 99,   speed: 19, armor: 0.3,  mr: 0,   gold: 11,   dmg: [3, 7],   rate: 1,   lives: 1, r: 10 },
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

const SPELLS = {
  meteor:    { name: 'Ateş Yağmuru', cd: 60, count: 3, dmg: [35, 60], radius: 55 },
  reinforce: { name: 'Takviye',      cd: 24, count: 2, hp: 40, dmg: [2, 4], life: 20 },
};

// Hava: bölümde weather: 'rain' | 'snow'. speed: tüm birimlerin (düşman, asker, kahraman) yürüme hızı çarpanı.
// rain.lightning: iki şimşek arası süre aralığı (sn).
const WEATHER = {
  rain: { speed: 1, lightning: [5, 12] },
  snow: { speed: 0.8 },
};

// Dalga: { t: tür, n: adet, gap: sn aralık, at: dalga başından gecikme, p: yol no }
// castle: [x, y] kalenin taban ortası; yollar kalenin kapısında (yolun son noktası) biter.
const LEVELS = [
  {
    name: 'Çayır Geçidi', gold: 300, lives: 20, theme: 'meadow', mapPos: [190, 330], castle: [912, 228],
    paths: [
      [[-40, 290], [130, 290], [210, 200], [360, 170], [460, 240], [490, 370], [600, 430], [730, 380], [790, 250], [862, 214]],
    ],
    plots: [[110, 215], [250, 265], [290, 100], [400, 310], [560, 340], [660, 320], [680, 480], [835, 318], [760, 160]],
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
    name: 'Kara Orman', gold: 380, lives: 20, theme: 'forest', mapPos: [470, 230], castle: [914, 352],
    paths: [
      [[620, -40], [620, 90], [460, 135], [300, 115], [170, 175], [150, 285], [280, 335], [450, 300], [600, 330], [700, 420], [850, 420], [874, 342]],
    ],
    plots: [[690, 165], [530, 60], [380, 200], [240, 230], [70, 230], [220, 410], [370, 390], [520, 240], [620, 450], [770, 340], [780, 490]],
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
    name: 'Kale Kapısı', gold: 600, lives: 20, theme: 'rocky', mapPos: [760, 330], castle: [912, 276],
    paths: [
      [[-40, 150], [120, 150], [220, 230], [380, 250], [420, 380], [560, 440], [700, 400], [760, 280], [868, 262]],
      [[480, -40], [480, 100], [400, 180], [380, 250], [420, 380], [560, 440], [700, 400], [760, 280], [868, 262]],
    ],
    plots: [[110, 80], [150, 240], [300, 170], [330, 330], [560, 120], [400, 80], [500, 330], [620, 350], [480, 500], [650, 500], [800, 370], [680, 230], [805, 180]],
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
    name: 'Gün Batımı Tepesi', gold: 420, lives: 20, theme: 'dusk', castle: [905, 400], hpMul: 2.1,
    paths: [
      [[-40, 200], [120, 200], [200, 120], [330, 110], [410, 200], [360, 320], [420, 430], [560, 450], [640, 360], [600, 250], [680, 160], [800, 170], [850, 280], [855, 386]],
    ],
    plots: [[734, 232], [286, 184], [510, 376], [438, 320], [662, 264], [566, 320], [102, 112], [318, 256], [206, 192], [486, 200]],
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
    name: 'Bataklık Sınırı', gold: 520, lives: 20, theme: 'swamp', weather: 'rain', castle: [905, 250], hpMul: 1.3,
    paths: [
      [[-40, 100], [140, 110], [260, 190], [420, 170], [520, 250], [640, 300], [740, 240], [855, 236]],
      [[-40, 430], [150, 420], [270, 340], [420, 330], [520, 250], [640, 300], [740, 240], [855, 236]],
    ],
    plots: [[590, 216], [414, 248], [670, 200], [526, 320], [742, 304], [334, 240], [598, 352], [678, 352], [526, 168], [262, 280], [742, 160]],
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
    name: 'Kayalık Boğaz', gold: 560, lives: 20, theme: 'rocky', weather: 'rain', castle: [905, 230], hpMul: 1.4,
    paths: [
      [[300, 580], [300, 460], [170, 430], [120, 340], [230, 280], [430, 300], [540, 400], [690, 420], [760, 330], [650, 240], [560, 170], [660, 100], [790, 130], [855, 216]],
    ],
    plots: [[702, 184], [622, 320], [254, 368], [766, 232], [550, 272], [342, 344], [494, 208], [374, 424], [422, 360], [814, 296], [590, 64]],
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
    name: 'Karlı Geçit', gold: 630, lives: 20, theme: 'winter', weather: 'snow', castle: [905, 330], hpMul: 1.2,
    paths: [
      [[260, -40], [260, 90], [380, 170], [520, 150], [620, 210], [700, 250], [780, 330], [855, 316]],
      [[-40, 330], [110, 330], [220, 420], [400, 440], [540, 380], [620, 300], [700, 250], [780, 330], [855, 316]],
    ],
    plots: [[694, 328], [758, 216], [574, 256], [670, 168], [750, 384], [366, 80], [502, 224], [630, 376], [830, 384], [238, 352], [454, 360], [310, 384]],
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
    name: 'Kül Vadisi', gold: 700, lives: 20, theme: 'volcano', castle: [905, 270], hpMul: 0.9,
    paths: [
      [[-40, 150], [130, 150], [220, 80], [380, 90], [470, 180], [620, 160], [720, 230], [855, 256]],
      [[-40, 420], [160, 430], [280, 340], [400, 390], [540, 450], [660, 380], [720, 300], [855, 256]],
    ],
    plots: [[638, 256], [742, 176], [758, 344], [278, 128], [558, 360], [310, 408], [470, 88], [838, 320], [134, 72], [550, 96], [358, 144], [558, 224]],
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
    name: 'Donmuş Nehir', gold: 790, lives: 20, theme: 'winter', weather: 'snow', castle: [905, 420], hpMul: 1.8,
    paths: [
      [[480, -40], [480, 80], [340, 140], [220, 220], [320, 320], [500, 300], [620, 380], [760, 420], [855, 406]],
      [[-40, 250], [100, 250], [220, 220], [320, 320], [500, 300], [620, 380], [760, 420], [855, 406]],
    ],
    plots: [[358, 200], [422, 248], [694, 344], [438, 360], [526, 384], [230, 328], [606, 304], [158, 296], [638, 448], [774, 360], [718, 472], [502, 224]],
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
    name: 'Son Kale', gold: 960, lives: 20, theme: 'volcano', castle: [905, 300], hpMul: 0.62,
    paths: [
      [[-40, 90], [200, 100], [320, 200], [480, 180], [600, 100], [740, 130], [800, 230], [855, 286]],
      [[-40, 460], [180, 450], [300, 360], [460, 400], [600, 460], [740, 420], [800, 330], [855, 286]],
    ],
    plots: [[726, 224], [646, 168], [686, 48], [726, 304], [830, 160], [766, 80], [510, 88], [566, 192], [374, 280], [294, 296], [870, 344], [454, 272], [646, 384], [210, 326], [504, 338], [150, 380], [60, 386]],
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
];

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
  orc_warlord:  { name: 'Ork Savaş Ağası', base: 'orc', h: 50, hp: 1500, speed: 11.2, armor: 0.4, mr: 0.1, gold: 130, dmg: [20, 32], rate: 1.4, lives: 6, r: 16, boss: true, chief: true, hpK: 1.05,
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
const LEVEL_BOSS = ['goblin_king', 'wolf_alpha', 'orc_warlord', 'dark_shaman', 'death_knight', 'troll_king', 'wolf_alpha', 'dark_shaman', 'death_knight', 'overlord'];
LEVELS.forEach((lv, i) => {
  lv.boss = LEVEL_BOSS[i];
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
const ENEMY_DESC = {
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
  { id: 'spells',   name: 'Büyüler',   ranks: [{ cost: 1, desc: '+1 göktaşı' }, { cost: 2, desc: '+1 takviye askeri' }, { cost: 3, desc: '%25 hızlı dolma' }] },
  { id: 'castle',   name: 'Kale',      ranks: [{ cost: 1, desc: '+3 can' }, { cost: 2, desc: '+60 altın' }, { cost: 3, desc: '+3 can, +60 altın' }] },
];
// Oyun tek, sabit zorlukta oynanır
const GAME_DIFF = { hp: 1.15, gold: 1, lives: 20 };

// Her kahramanın 3 yeteneği vardır (sade tutmak için); kahraman 4. seviyeye kadar çıkar, her seviyede 1 puan kazanır.
const HERO_SKILLS = {
  commander: ['bash', 'whirl', 'cry'],
  caner: ['holy', 'shieldthrow', 'quake'],
  zeynep: ['volley', 'multishot', 'blastarrow'],
  tarcin: ['shadowstep', 'clawstorm', 'dodge'],
  sage: ['flamering', 'icelance', 'meteor2'],
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
