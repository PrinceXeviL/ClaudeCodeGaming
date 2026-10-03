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

// Kahramanlar: aynı anda en fazla 2 tanesi savaşa çıkar. Bölüm içinde seviye atlarlar (en fazla 6);
// seviye 2-6 arasında her seviyede 1 yetenek puanı kazanılır. Yetenek ağacının iki yolu vardır, her yolda 3 yetenek
// sırayla açılır; 5 puanla 6 yeteneğin hepsi alınamaz, oyuncu hangi yola ağırlık vereceğini seçer.
// unlock: kahramanın açılması için bitirilmesi gereken bölüm numarası (null: baştan açık).
const HERO_MAX = 6;
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
  paladin: {
    name: 'Ak Şövalye', role: 'Tank · Koruyucu', sprite: 'hero_paladin', base: 'enemy_knight', h: 31, aura: '200,230,255',
    hp: 480, dmg: [10, 16], armor: 0.5, rate: 1.2, speed: 65, respawn: 18, regen: 14, engage: 65, unlock: 2,
    paths: [
      { name: 'Kutsal Yol', col: '#ffe27a', skills: [
        { id: 'holy',       name: 'Kutsal Işık', cd: 14, desc: 'Kendini ve yakındaki askerleri büyük oranda iyileştirir' },
        { id: 'consecrate', name: 'Kutsal Alan', cd: 15, desc: 'Ayağının altı 4 sn kutsanır, düşmanlar yanar' },
        { id: 'revive',     name: 'Diriliş', passive: true, desc: 'Kalıcı: her bölümde bir kez, ölünce yarı canla dirilir' },
      ] },
      { name: 'Adalet Yolu', col: '#8fd0ff', skills: [
        { id: 'shieldthrow', name: 'Kalkan Fırlatma', cd: 9,  desc: 'Kalkan 3 düşmana seker, her birini 1 sn sersemletir' },
        { id: 'quake',       name: 'Yer Sarsıntısı', cd: 13, desc: 'Çevresindeki düşmanları sarsıp 1.2 sn sersemletir' },
        { id: 'judgment',    name: 'Ceza Kılıcı',    cd: 11, desc: 'Üç kat hasarlı darbe; canı %25 altındaki düşmanı bitirir' },
      ] },
    ],
  },
  rogue: {
    name: 'Gölge Avcı', role: 'Menzilli · Hızlı', sprite: 'hero_rogue', base: 'enemy_bandit', h: 28, aura: '120,255,170',
    hp: 210, dmg: [9, 14], armor: 0.1, rate: 0.75, speed: 100, respawn: 12, regen: 8, engage: 60, ranged: 135, proj: 'dagger', unlock: 4,
    paths: [
      { name: 'Bıçak Yolu', col: '#c0f0a0', skills: [
        { id: 'fan',    name: 'Bıçak Yelpazesi', cd: 8,  desc: 'Menzildeki 5 düşmana aynı anda bıçak fırlatır' },
        { id: 'venom',  name: 'Zehirli Bıçaklar', passive: true, desc: 'Kalıcı: her bıçak 3 sn zehirler' },
        { id: 'deadly', name: 'Ölümcül Atış',    cd: 14, desc: 'En güçlü düşmana zırh delen büyük hasar' },
      ] },
      { name: 'Gölge Yolu', col: '#b8a0ff', skills: [
        { id: 'smoke',  name: 'Duman Bombası', cd: 12, desc: 'Kalabalığı 3 sn %50 yavaşlatan duman' },
        { id: 'trap',   name: 'Diken Tuzağı',  cd: 10, desc: 'Yola tuzak kurar: basan düşman hasar alır, sersemler' },
        { id: 'shadow', name: 'Gölge Ustası', passive: true, desc: 'Kalıcı: %20 çifte hasar, %25 daha hızlı saldırı' },
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
const HERO_ORDER = ['commander', 'paladin', 'rogue', 'sage'];

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
  {
    name: 'Gün Batımı Tepesi', gold: 420, lives: 20, theme: 'dusk', castle: [905, 400], hpMul: 1.5,
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
    name: 'Bataklık Sınırı', gold: 490, lives: 20, theme: 'swamp', castle: [905, 250], hpMul: 1.25,
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
    name: 'Kayalık Boğaz', gold: 560, lives: 20, theme: 'rocky', castle: [905, 230], hpMul: 1.4,
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
    name: 'Karlı Geçit', gold: 630, lives: 20, theme: 'winter', castle: [905, 330], hpMul: 1.2,
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
    name: 'Kül Vadisi', gold: 700, lives: 20, theme: 'volcano', castle: [905, 270], hpMul: 1.0,
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
    name: 'Donmuş Nehir', gold: 770, lives: 20, theme: 'winter', castle: [905, 420], hpMul: 1.4,
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
    name: 'Son Kale', gold: 840, lives: 20, theme: 'volcano', castle: [905, 300], hpMul: 0.85,
    paths: [
      [[-40, 90], [200, 100], [320, 200], [480, 180], [600, 100], [740, 130], [800, 230], [855, 286]],
      [[-40, 460], [180, 450], [300, 360], [460, 400], [600, 460], [740, 420], [800, 330], [855, 286]],
    ],
    plots: [[726, 224], [646, 168], [686, 48], [726, 304], [830, 160], [766, 80], [510, 88], [566, 192], [374, 280], [294, 296], [870, 344], [454, 272], [646, 384]],
    waves: [
      [{t: 'goblin', n: 28, gap: 0.9, p: 0}, {t: 'goblin', n: 14, gap: 0.9, p: 1, at: 2}],
      [{t: 'knight', n: 3, gap: 2.4, at: 0, p: 1}, {t: 'shaman', n: 5, gap: 2, at: 6, p: 0}],
      [{t: 'orc', n: 8, gap: 1.2, at: 0, p: 0}, {t: 'wolf', n: 18, gap: 0.6, at: 5, p: 0}],
      [{t: 'knight', n: 3, gap: 2.4, at: 0, p: 0}, {t: 'orc', n: 6, gap: 1.2, at: 6, p: 1}, {t: 'knight', n: 3, gap: 2.4, at: 11, p: 0}],
      [{t: 'knight', n: 4, gap: 2.4, at: 0, p: 1}, {t: 'knight', n: 4, gap: 2.4, at: 5, p: 0}],
      [{t: 'wolf', n: 19, gap: 0.6, at: 0, p: 0}, {t: 'bandit', n: 10, gap: 1.05, at: 4, p: 0}, {t: 'wolf', n: 19, gap: 0.6, at: 10, p: 1}],
      [{t: 'bat', n: 22, gap: 0.85, at: 0, p: 0}, {t: 'shaman', n: 10, gap: 2, at: 7, p: 1}],
      [{t: 'shaman', n: 12, gap: 2, at: 0, p: 1}, {t: 'knight', n: 6, gap: 2.4, at: 5, p: 0}],
      [{t: 'troll', n: 1, gap: 1, at: 0, p: 0}, {t: 'orc', n: 8, gap: 1.2, at: 0, p: 0}, {t: 'knight', n: 3, gap: 2.4, at: 5, p: 0}, {t: 'wolf', n: 17, gap: 0.6, at: 13, p: 1}],
      [{t: 'orc', n: 9, gap: 1.2, at: 0, p: 0}, {t: 'orc', n: 9, gap: 1.2, at: 4, p: 1}, {t: 'orc', n: 9, gap: 1.2, at: 11, p: 0}, {t: 'orc', n: 9, gap: 1.2, at: 9, p: 0}],
      [{t: 'shaman', n: 10, gap: 2, at: 0, p: 1}, {t: 'knight', n: 5, gap: 2.4, at: 6, p: 0}, {t: 'bandit', n: 17, gap: 1.05, at: 11, p: 0}],
      [{t: 'shaman', n: 11, gap: 2, at: 0, p: 0}, {t: 'shaman', n: 11, gap: 2, at: 6, p: 0}, {t: 'bandit', n: 18, gap: 1.05, at: 6, p: 1}],
      [{t: 'orc', n: 16, gap: 1.2, at: 0, p: 0}, {t: 'bat', n: 25, gap: 0.85, at: 3, p: 1}, {t: 'bandit', n: 19, gap: 1.05, at: 10, p: 0}],
      [{t: 'troll', n: 1, gap: 1, at: 0, p: 0}, {t: 'troll', n: 1, gap: 1, at: 14, p: 1}, {t: 'troll', n: 1, gap: 1, at: 28, p: 0}, {t: 'shaman', n: 5, gap: 2, at: 0, p: 1}, {t: 'bat', n: 12, gap: 0.85, at: 3, p: 0}, {t: 'knight', n: 3, gap: 2.4, at: 9, p: 0}, {t: 'knight', n: 3, gap: 2.4, at: 19, p: 1}],
    ],
  },
];
