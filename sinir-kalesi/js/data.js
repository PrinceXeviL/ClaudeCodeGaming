// Oyun verisi: kuleler, düşmanlar, kahraman, büyüler, bölümler.
// Denge değerleri burada; revizeler çoğunlukla bu dosyada yapılır.

const W = 960, H = 540;

const TOWERS = {
  archer: {
    name: 'Okçu Kulesi', icon: 'archer', dmgType: 'phys', air: true,
    desc: 'Hızlı atış, havayı da vurur',
    levels: [
      { cost: 70,  range: 140, dmg: [4, 6],   rate: 0.8, perk: 'Hızlı atış, uçanları da vurur' },
      { cost: 110, range: 155, dmg: [7, 11],  rate: 0.6, perk: 'Delici ok: %25 şansla zırhı yok sayar' },
      { cost: 160, range: 170, dmg: [11, 17], rate: 0.5, perk: '3 okçu · %15 kritik vuruş (2 kat hasar)' },
    ],
    // Son seviyede açılan, ayrı ayrı geliştirilen yetenekler (her biri 3 kademe)
    abilities: [
      { id: 'poison', name: 'Zehirli Oklar', desc: (r) => `Oklar 3 sn boyunca saniyede ${r.dps} zehir hasarı verir`,
        ranks: [{ cost: 150, dps: 4 }, { cost: 200, dps: 8 }, { cost: 260, dps: 13 }] },
      { id: 'snipe', name: 'Keskin Nişancı', desc: (r) => `${r.cd} sn'de bir en güçlü düşmana ${r.dmg} zırh delen atış`,
        ranks: [{ cost: 180, cd: 9, dmg: 70 }, { cost: 240, cd: 7.5, dmg: 120 }, { cost: 300, cd: 6, dmg: 180 }] },
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
    desc: 'Büyü hasarı zırhı deler',
    levels: [
      { cost: 100, range: 130, dmg: [9, 17],  rate: 1.5, perk: 'Büyü hasarı zırhı deler' },
      { cost: 160, range: 140, dmg: [23, 43], rate: 1.5, perk: 'Buz dokunuşu: vurduğunu 1 sn %30 yavaşlatır' },
      { cost: 240, range: 150, dmg: [40, 74], rate: 1.5, perk: 'Zincir büyü: yakındaki ikinci düşmana %60 hasar' },
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
    desc: 'Alan hasarı, yavaş',
    levels: [
      { cost: 125, range: 140, dmg: [8, 15],  rate: 3.0, splash: 50, perk: 'Alan hasarı, yavaş atış' },
      { cost: 220, range: 150, dmg: [20, 40], rate: 3.0, splash: 58, perk: 'Ağır gülle: daha geniş patlama alanı' },
      { cost: 320, range: 165, dmg: [30, 60], rate: 2.7, splash: 64, perk: 'Sarsıcı gülle: %30 şansla 0.6 sn sersemletir' },
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
  bandit:  { name: 'Haydut',        hp: 86,   speed: 24, armor: 0,    mr: 0,   gold: 9,   dmg: [4, 8],   rate: 1,   lives: 1, r: 9 },
  orc:     { name: 'Ork',           hp: 99,   speed: 19, armor: 0.3,  mr: 0,   gold: 11,   dmg: [3, 7],   rate: 1,   lives: 1, r: 10 },
  bat:     { name: 'Yarasa',        hp: 37,   speed: 33, armor: 0,    mr: 0,   gold: 7,   dmg: [0, 0],   rate: 1,   lives: 1, r: 8, flying: true },
  shaman:  { name: 'Şaman',         hp: 108,   speed: 20, armor: 0,    mr: 0.6, gold: 15,  dmg: [2, 4],   rate: 1,   lives: 1, r: 9, heals: true },
  knight:  { name: 'Kara Şövalye',  hp: 292,  speed: 16, armor: 0.75, mr: 0,   gold: 28,  dmg: [8, 14],  rate: 1.2, lives: 1, r: 11 },
  troll:   { name: 'Dağ Trolü',     hp: 1950, speed: 11, armor: 0.3,  mr: 0.2, gold: 200, dmg: [30, 50], rate: 2,   lives: 5, r: 18, boss: true },
};

const HERO = {
  name: 'Komutan', hp: 320, dmg: [12, 20], armor: 0.3, rate: 1, speed: 80,
  respawn: 15, regen: 10, engage: 70, maxLevel: 5,
  // Seviye atladıkça açılan, kendiliğinden kullanılan yetenekler
  skills: [
    { id: 'bash',  lvl: 2, name: 'Kalkan Darbesi', cd: 7,  desc: 'Hedefi 2 sn sersemletir, ek hasar verir' },
    { id: 'cry',   lvl: 3, name: 'Savaş Narası',   cd: 16, desc: 'Yakındaki askerleri iyileştirir, 6 sn hasarlarını %50 artırır' },
    { id: 'whirl', lvl: 4, name: 'Kasırga',        cd: 10, desc: 'Etrafındaki tüm düşmanlara hasar verir' },
    { id: 'bolt',  lvl: 5, name: 'Yıldırım',       cd: 12, desc: '4 düşmana zincirleme yıldırım (uçanlar dahil)' },
  ],
};

const SPELLS = {
  meteor:    { name: 'Ateş Yağmuru', cd: 45, count: 3, dmg: [35, 60], radius: 55 },
  reinforce: { name: 'Takviye',      cd: 15, count: 2, hp: 40, dmg: [2, 4], life: 20 },
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
];
