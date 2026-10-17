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
      { id: 'shield', name: 'Kalkan Duvarı', desc: (r) => `+%${Math.round(r.armor * 100)} zırh, +${r.hp} can · darbeleri savuşturur, kalkanla sersemletir · ağır ve yavaş vurur · 4. iskelet · Tabut Duvarı: hasarın %60'ını emer · Kalkan Hamlesi: düşmana atılıp sersemletir`,
        ranks: [{ cost: 140, armor: 0.1, hp: 30 }, { cost: 190, armor: 0.18, hp: 60 }, { cost: 240, armor: 0.25, hp: 100 }] },
      { id: 'blade', name: 'Kılıç Ustası', desc: (r) => `Hasar x${r.mult} · %${Math.round(r.crit * 100)} kritik · hızlı vurur, savurması yandakine de işler · 4. iskelet · Ruh Biçimi: iki kılıçla döner, çevresine vurur, iyileşir`,
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
      // 16 Eki (Caner): Ceset Mancınığı yerine Kemik Gülle (id 'corpse' kayıt uyumu için kaldı): içi veba dolu dev kemik gülle;
      // çarptığı yerdekileri havaya savurur (h: savrulma yüksekliği px), gülle kırılır, yerde zehirli veba gölü kalır (pool: göl gücü çarpanı)
      { id: 'corpse', name: 'Kemik Gülle', desc: (r) => `Kule Kemik Gülle Mancınığına dönüşür: içi veba dolu dev kemik gülle atar (x${r.mult} hasar) · Çarptığı yerdeki düşmanlar havaya savrulup dağılır, gülle kırılır, yerde zehirli veba gölü kalır` + (r.stun ? ` · Savrulanlar ${r.stun} sn sersemler` : ''),
        ranks: [{ cost: 170, mult: 2.0, h: 30, pool: 1, stun: 0 }, { cost: 230, mult: 2.5, h: 36, pool: 1.3, stun: 0 }, { cost: 290, mult: 3.0, h: 44, pool: 1.6, stun: 1 }] },
      // 16 Eki (Caner): sinek sürüsü: kazanın sinekleri bölük bölük düşmana saldırır (sw: aynı anda kaç sürü), ısırdığını zehirler ve vebalar
      { id: 'plague', name: 'Kara Veba', desc: (r) => `Kule Kara Veba Kazanına dönüşür: mor-yeşil veba, daha büyük gaz bulutu · Vurulanlar vebalı olur (saniyede ${r.dps} zehir): vebalı ölünce veba yanındakilere bulaşır · Veba Sinekleri: aynı anda ${r.sw} sinek sürüsü düşmana saldırır (uçanlara da), ısırdıklarını zehirler ve vebalar`,
        ranks: [{ cost: 200, dps: 7, sw: 1 }, { cost: 260, dps: 12, sw: 2 }, { cost: 320, dps: 18, sw: 3 }] },
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
const HERO_MAX = 20; // 11 Eki (Caner): komutan seviyesi kalıcı, 1→20 (her bölümde sıfırlanmaz)
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
  snow: { speed: 0.9 }, // 16 Eki (Caner: sis iptal, 1-2 karlı bölüm): Kara Göl Geçidi ve Yıkık Kule karlı; 0,8 → 0,9 (denge az oynasın)
  sand: { speed: 1, range: 0.85 },
  night: { speed: 1 },
  fog: { speed: 1, range: 0.9 }, // 16 Eki (Caner: sisli bölümler): ağır sis sürüklenir, görüş kısa: kule menzili %10 az. Aynı gün iptal (Caner): hiçbir bölümde yok, kod duruyor
};

// Dalga: { t: tür, n: adet, gap: sn aralık, at: dalga başından gecikme, p: yol no }
// paths: önce girişler, sonra alternatif kollar; routes: { giriş: [kullanabileceği yollar] } (düşmanlar kollara sırayla dağılır).
// Kale kendiliğinden ilk yolun bittiği yere, kapısı tam yolun ucuna gelecek şekilde konur (bütün yollar orada biter).
// plots: kule arsaları; tools/arsa-uret.js yola göre otomatik yerleştirir. Yolun çizilen kenarına taşmasın: __game.plotAudit() denetler (true: düzeltir).
// 15 bölümün yol ve arsa düzeni (oynanış sırasıyla)
const LEVELS = [
  { paths: [[[-40,242],[110,242],[210,172],[340,154],[450,207],[470,295],[400,365],[470,427],[610,418],[700,374],[760,348],[897,277]]], plots: [[514,360],[312,218],[788,409],[382,249],[88,154],[598,352],[238,238],[691,299],[344,417]] },
  { paths: [[[420,-40],[420,84],[300,119],[170,163],[180,242],[330,268],[520,233],[620,172],[690,224],[640,304],[480,330],[400,387],[540,444],[690,418],[770,365],[897,286]]], plots: [[520,508],[309,196],[742,302],[478,175],[679,492],[341,334],[394,191],[772,244],[88,228],[338,411]] },
  { paths: [[[-40,128],[150,128],[330,110],[520,128],[640,172],[650,242],[560,277],[400,268],[260,286],[200,310],[270,334],[491,436],[600,418],[730,392],[897,304]]], plots: [[502,210],[298,211],[520,370],[712,328],[424,335],[190,207],[438,182],[604,348],[106,217],[242,394],[811,439]] },
  { paths: [[[-40,312],[100,312],[200,286],[300,198],[450,172],[580,207],[650,295],[740,356],[897,286]],[[-40,312],[100,312],[200,286],[300,356],[467,409],[580,383],[650,295],[740,356],[862,286]]], plots: [[544,307],[316,281],[748,275],[202,376],[460,297],[670,397],[106,223],[403,245],[808,419],[490,475],[516,250]], routes: {"0":[0,1]} },
  { paths: [[[-40,363],[120,363],[230,339],[330,286],[460,277],[560,312],[660,330],[750,339],[897,268]],[[560,-40],[560,92],[440,128],[340,180],[330,286],[460,277],[560,312],[660,330],[750,339],[862,268]]], plots: [[427,206],[342,358],[715,271],[514,202],[204,278],[660,397],[106,275],[426,346],[622,159],[795,401],[244,217]] },
  { paths: [[[-40,136],[150,136],[300,180],[430,260],[560,348],[680,392],[760,365],[897,286]],[[-40,363],[150,363],[300,330],[430,260],[560,172],[660,163],[700,242],[690,312],[760,365],[862,286]]], plots: [[586,286],[296,260],[789,431],[112,254],[604,228],[421,348],[214,260],[689,458],[430,175],[859,406],[484,381],[772,207]] },
  { paths: [[[380,-40],[380,92],[260,136],[170,216],[220,304],[360,321],[480,268],[600,242],[680,304],[760,321],[897,251]],[[600,580],[600,436],[650,374],[680,304],[760,321],[862,251]]], plots: [[580,318],[316,223],[691,223],[526,370],[394,186],[747,387],[256,386],[119,167],[718,439],[460,149],[175,355]] },
  { paths: [[[-40,216],[120,216],[220,251],[330,180],[470,154],[600,180],[680,251],[700,330],[770,356],[897,286]],[[520,-40],[520,75],[470,154],[600,180],[680,251],[700,330],[770,356],[862,286]],[[-40,216],[120,216],[220,251],[330,321],[480,356],[620,365],[700,330],[770,356],[862,286]]], plots: [[562,275],[370,238],[875,401],[178,317],[460,244],[713,413],[100,302],[226,170],[440,417],[804,420],[662,133],[244,349]], routes: {"0":[0,2]} },
  { paths: [[[-40,242],[120,242],[220,172],[340,163],[420,224],[440,286],[560,286],[680,339],[760,348],[897,277]],[[560,-40],[560,92],[490,136],[420,224],[440,286],[560,286],[680,339],[760,348],[862,277]],[[520,580],[520,444],[620,409],[680,339],[760,348],[862,277]]], plots: [[507,217],[717,414],[302,224],[533,351],[100,154],[691,267],[586,186],[346,275],[238,254],[454,381],[806,409],[88,340]] },
  { paths: [[[-40,304],[90,304],[160,216],[270,145],[430,119],[590,136],[690,198],[700,286],[610,365],[470,392],[425,436],[500,462],[660,453],[770,400],[897,312]]], plots: [[598,265],[283,220],[809,464],[499,200],[441,317],[70,196],[365,198],[533,300],[574,209],[886,438],[226,265],[351,401]] },
  { paths: [[[340,-40],[340,92],[220,145],[180,224],[300,260],[450,242],[520,277],[620,242],[700,304],[770,356],[897,286]],[[461,580],[461,444],[340,361],[320,339],[450,312],[520,277],[620,242],[700,304],[770,356],[862,286]]], plots: [[508,360],[331,188],[610,318],[245,320],[772,270],[400,165],[268,392],[526,200],[839,414],[122,158],[556,413],[664,365]] },
  { paths: [[[-40,198],[100,198],[200,242],[320,180],[460,154],[580,198],[620,286],[700,374],[780,383],[897,312]],[[640,-40],[640,92],[580,198],[620,286],[700,374],[780,383],[862,312]],[[-40,198],[100,198],[200,242],[320,312],[470,348],[600,392],[700,374],[780,383],[862,312]]], plots: [[542,304],[340,244],[853,436],[508,244],[160,302],[696,447],[424,238],[84,290],[220,159],[782,455],[682,228]], routes: {"0":[0,2]} },
  { paths: [[[-40,286],[120,286],[220,224],[350,198],[480,233],[560,304],[680,356],[770,356],[897,286]],[[400,-40],[400,101],[330,145],[350,198],[480,233],[560,304],[680,356],[770,356],[862,286]],[[640,580],[640,436],[680,356],[770,356],[862,286]],[[-40,286],[120,286],[220,348],[360,383],[500,374],[560,304],[680,356],[770,356],[862,286]]], plots: [[411,288],[244,286],[702,281],[538,429],[472,157],[124,376],[751,430],[328,275],[118,196],[634,257],[193,157],[830,413],[480,467]], routes: {"0":[0,3]} },
  { paths: [[[-40,163],[130,163],[240,128],[380,145],[480,216],[560,286],[680,348],[770,356],[897,286]],[[480,580],[480,444],[400,392],[380,286],[560,286],[680,348],[770,356],[862,286]],[[-40,163],[130,163],[240,128],[260,224],[380,286],[560,286],[680,348],[770,356],[862,286]],[[480,580],[480,444],[600,418],[680,348],[770,356],[862,286]]], plots: [[567,501],[645,484],[710,272],[166,244],[711,430],[577,204],[279,329],[210,305],[96,258],[795,428],[526,158],[307,381],[644,238],[879,412]], routes: {"0":[0,2],"1":[1,3]} },
  { paths: [[[-40,233],[120,233],[230,172],[380,154],[520,189],[600,268],[700,339],[770,348],[897,277]],[[640,-40],[640,92],[560,136],[520,189],[600,268],[700,339],[770,348],[862,277]],[[435,580],[435,444],[520,409],[620,400],[700,339],[770,348],[862,277]],[[-40,233],[120,233],[230,304],[360,339],[480,321],[600,268],[700,339],[770,348],[862,277]]], plots: [[584,478],[274,244],[472,253],[739,275],[124,323],[634,196],[356,405],[388,233],[724,414],[109,154],[712,154],[662,453],[806,410]], routes: {"0":[0,3]} },
];

// Sefer 2 (Cadı Avı) yol ve arsa düzeni: aynı biçim; data.js sonunda LEVELS'a eklenir (arsa-uret.js sırayla yazar)
const LEVELS2_GEO = [
  { paths: [[[-40,286],[120,286],[220,207],[360,180],[460,233],[450,321],[540,392],[680,383],[760,321],[897,295]]], plots: [[318,252],[584,332],[778,397],[100,196],[364,297],[553,468],[250,275],[781,249],[106,376],[538,281],[718,439],[432,132]] },
  { paths: [[[300,-40],[300,92],[180,154],[150,251],[260,312],[400,286],[520,216],[640,233],[660,321],[580,400],[690,436],[790,374],[897,304]]], plots: [[562,318],[286,217],[742,323],[478,318],[796,455],[183,358],[352,175],[544,460],[742,260],[101,156],[277,380],[569,146]] },
  { paths: [[[-40,180],[130,180],[250,242],[380,224],[500,286],[620,312],[740,312],[897,286]],[[-40,363],[130,363],[250,348],[380,365],[500,286],[620,312],[740,312],[862,286]]], plots: [[346,297],[118,275],[512,359],[741,380],[510,218],[269,176],[760,248],[278,419],[597,381],[460,402],[818,404],[349,158]] },
  { paths: [[[-40,363],[100,363],[200,321],[180,224],[280,154],[420,154],[520,224],[480,312],[580,383],[720,383],[790,321],[897,286]]], plots: [[623,325],[290,221],[100,275],[424,228],[808,402],[592,270],[274,275],[712,291],[382,281],[232,392],[605,456],[884,404]] },
  { paths: [[[-40,154],[140,154],[250,216],[400,216],[520,163],[650,189],[700,268],[780,312],[897,286]],[[-40,363],[140,363],[260,312],[400,330],[520,400],[640,392],[700,330],[780,312],[862,286]]], plots: [[562,291],[190,267],[757,379],[382,394],[100,265],[760,228],[502,244],[292,382],[518,467],[303,152],[706,429],[575,231]] },
  { paths: [[[480,-40],[480,84],[360,128],[240,180],[200,277],[300,339],[460,312],[580,242],[700,224],[760,304],[700,392],[790,409],[897,321]]], plots: [[340,244],[652,323],[472,196],[840,468],[538,159],[239,389],[424,249],[690,464],[173,157],[772,191],[898,432],[172,355]] },
  { paths: [[[-40,233],[90,233],[160,145],[300,119],[420,172],[400,268],[300,330],[350,366],[500,427],[620,365],[640,268],[740,242],[897,286]]], plots: [[280,202],[712,312],[448,344],[700,376],[208,238],[532,349],[112,318],[495,499],[490,143],[796,386],[508,291],[256,392]] },
  { paths: [[[260,-40],[260,101],[380,172],[520,172],[640,242],[750,295],[897,286]],[[435,580],[435,436],[435,374],[520,374],[640,312],[750,295],[862,286]]], plots: [[556,281],[721,360],[472,275],[322,223],[527,440],[764,224],[388,327],[684,190],[248,215],[790,398],[328,392],[388,270]] },
  { paths: [[[-40,312],[120,312],[200,233],[320,180],[460,198],[540,277],[460,356],[560,427],[700,409],[760,339],[897,295]],[[-40,312],[120,312],[200,233],[320,180],[460,198],[600,172],[700,233],[760,339],[862,295]]], plots: [[604,328],[427,262],[809,416],[292,260],[616,254],[88,228],[394,312],[754,455],[238,307],[489,470],[688,138],[154,392]], routes: {"0":[0,1]} },
  { paths: [[[-40,145],[150,145],[260,198],[250,286],[140,356],[220,382],[380,382],[470,348],[580,286],[700,312],[780,312],[897,286]]], plots: [[314,316],[130,228],[595,352],[761,377],[398,308],[736,240],[113,283],[526,392],[301,143],[487,442],[70,386],[834,400]] },
  { paths: [[[-40,198],[140,198],[260,251],[400,251],[540,286],[680,312],[897,286]],[[400,-40],[400,101],[460,180],[540,286],[680,312],[862,286]],[[-40,368],[140,368],[300,383],[440,374],[540,286],[680,312],[862,286]]], plots: [[389,318],[564,365],[118,281],[350,182],[727,253],[225,310],[579,218],[304,138],[752,395],[257,180],[514,407],[668,377]] },
  { paths: [[[620,-40],[620,84],[500,119],[360,119],[230,172],[200,260],[300,321],[440,312],[560,356],[660,418],[760,374],[897,304]]], plots: [[334,223],[670,347],[484,212],[793,434],[460,386],[640,175],[394,188],[211,363],[532,418],[740,311],[148,164],[706,138]] },
  { paths: [[[-40,251],[100,251],[180,180],[300,145],[400,198],[380,286],[260,330],[300,334],[491,436],[560,374],[600,286],[700,242],[790,268],[897,295]]], plots: [[271,254],[454,349],[718,309],[178,307],[670,355],[313,417],[74,154],[472,291],[754,370],[442,138],[586,460],[106,339]] },
  { paths: [[[-40,163],[120,163],[240,110],[380,128],[480,198],[600,242],[720,304],[897,286]],[[435,580],[435,436],[435,392],[460,374],[600,339],[720,304],[862,286]]], plots: [[406,312],[721,383],[498,121],[533,436],[745,228],[226,202],[452,267],[124,249],[369,207],[804,411],[334,392],[643,403]] },
  { paths: [[[-40,286],[110,286],[220,251],[340,268],[460,286],[600,286],[740,295],[897,286]],[[300,-40],[300,101],[400,180],[460,286],[600,286],[740,295],[862,286]],[[435,580],[435,427],[435,374],[460,286],[600,286],[740,295],[862,286]]], plots: [[531,359],[172,194],[502,210],[737,366],[343,341],[94,202],[532,418],[768,228],[185,338],[118,370],[618,358],[256,325]] },
];

// 10 Eki: her sefer 20 bölüm. Her bölgenin finalinden önce eklenen yeni bölümlerin yol ve arsa düzeni
// (arsalar arsa-uret.js algoritmasıyla bir kez hesaplandı; arsa-uret.js metin sırasıyla yazdığı için bunları atlamaz, dikkat)
const LEVELS_EK1_GEO = [
  { paths: [[[-40,180],[130,180],[250,242],[390,216],[520,154],[650,172],[700,251],[620,330],[480,356],[470,418],[600,444],[740,400],[897,304]]], plots: [[556,260],[269,177],[772,286],[485,282],[772,459],[112,265],[400,415],[398,289],[845,432],[718,138],[190,291],[394,349]] },
  { paths: [[[-40,312],[110,312],[220,268],[340,304],[460,356],[600,339],[700,286],[770,304],[897,286]],[[340,-40],[340,92],[440,136],[540,128],[640,172],[700,233],[700,286],[770,304],[862,286]]], plots: [[616,249],[238,342],[508,254],[725,364],[352,202],[100,223],[772,207],[424,244],[274,165],[559,209],[495,424],[148,392]] },
  { paths: [[[-40,233],[120,233],[230,180],[360,198],[440,268],[560,286],[680,330],[770,339],[897,277]],[[420,-40],[420,92],[330,136],[230,180],[360,198],[440,268],[560,286],[680,330],[770,339],[862,277]]], plots: [[300,254],[707,268],[454,180],[226,275],[565,357],[102,157],[796,404],[491,345],[514,138],[94,323],[358,297],[705,402]] },
  { paths: [[[-40,154],[140,154],[260,207],[400,189],[520,233],[600,312],[700,356],[780,348],[897,286]],[[560,580],[560,444],[520,374],[600,312],[700,356],[780,348],[862,286]]], plots: [[651,415],[448,275],[176,250],[712,291],[366,258],[94,238],[637,251],[480,470],[789,414],[307,136],[430,334],[876,405]] },
  { paths: [[[-40,268],[120,268],[240,216],[380,207],[500,251],[600,304],[700,348],[780,339],[897,286]],[[460,-40],[460,92],[400,154],[380,207],[500,251],[600,304],[700,348],[780,339],[862,286]],[[680,580],[680,444],[700,348],[780,339],[862,286]]], plots: [[508,180],[784,407],[317,271],[700,276],[94,186],[401,293],[586,376],[320,138],[124,355],[504,327],[861,403],[568,138]] },
];
const LEVELS_EK2_GEO = [
  { paths: [[[-40,251],[120,251],[220,312],[360,330],[470,268],[560,198],[680,207],[740,286],[897,286]],[[300,-40],[300,101],[420,172],[560,198],[680,207],[740,286],[862,286]]], plots: [[584,266],[364,254],[118,344],[646,302],[292,223],[772,202],[532,307],[208,194],[340,399],[88,159],[780,392],[197,374]] },
  { paths: [[[-40,198],[100,198],[200,268],[330,312],[470,304],[560,242],[640,180],[730,216],[760,295],[897,286]],[[620,580],[620,436],[700,374],[760,295],[862,286]]], plots: [[658,302],[351,248],[106,302],[847,402],[586,344],[259,216],[532,392],[737,133],[772,418],[372,382],[202,154],[526,175]] },
  { paths: [[[-40,312],[130,312],[230,251],[340,172],[480,145],[600,189],[640,277],[560,348],[600,418],[720,400],[897,312]]], plots: [[712,240],[521,229],[146,220],[400,235],[748,302],[70,233],[503,287],[340,266],[751,469],[528,463],[281,306],[831,455]] },
  { paths: [[[-40,172],[140,172],[260,233],[380,286],[520,295],[620,242],[720,286],[897,286]],[[420,-40],[420,101],[500,172],[620,242],[720,286],[862,286]],[[540,580],[540,436],[600,374],[720,286],[862,286]]], plots: [[466,229],[760,386],[166,260],[478,371],[725,214],[388,202],[91,258],[688,402],[334,154],[657,180],[640,460],[833,406]] },
  { paths: [[[-40,233],[120,233],[240,286],[380,312],[500,268],[560,189],[680,163],[740,233],[760,312],[897,295]],[[300,-40],[300,101],[420,154],[560,189],[680,163],[740,233],[760,312],[862,295]],[[660,580],[660,436],[700,374],[760,312],[862,295]]], plots: [[658,281],[394,223],[274,217],[845,415],[118,323],[574,297],[772,434],[217,173],[760,133],[385,378],[73,156],[922,393]] },
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
  assassin:  { name: 'Suikastçı',           h: 27, hp: 80,  speed: 38, armor: 0,    mr: 0.25, gold: 15, dmg: [5, 9],   rate: 0.8, lives: 1, r: 9, blink: { cd: 9, d: 55 } },
  priest:    { name: 'Savaş Rahibi',        h: 30, hp: 140, speed: 19, armor: 0,    mr: 0.5,  gold: 20, dmg: [2, 4],   rate: 1,   lives: 1, r: 10, heals: true, purify: { r: 70, every: 5, dmg: 0, bless: true } }, // 15 Eki: cesetleri kutsar
  heavy:     { name: 'Ağır Piyade',         h: 33, hp: 380, speed: 14, armor: 0.7,  mr: 0,    gold: 32, dmg: [9, 15],  rate: 1.3, lives: 1, r: 12 },
  cavalry:   { name: 'Solarian Süvarisi',   h: 42, hp: 260, speed: 31, armor: 0.3,  mr: 0,    gold: 28, dmg: [10, 16], rate: 1.1, lives: 2, r: 13 },
  ram:       { name: 'Koçbaşı',             h: 49, hp: 700, speed: 9,  armor: 0.45, mr: 0.1,  gold: 55, dmg: [2, 4],   rate: 2,   lives: 3, r: 18, machine: true, noblock: true, escort: [['legion', 2]], bash: { r: 78, dmg: 70, rate: 2 } }, // 15 Eki: yol kenarındaki kulelere vurur // 16 Eki (Caner): koçbaşı iskeletlere saldırmaz, durdurulamaz (iskeletler vurur), iki lejyoner korur
  catapult:  { name: 'Mancınık Arabası',    h: 40, hp: 420, speed: 12, armor: 0.2,  mr: 0,    gold: 38, dmg: [2, 4],   rate: 2,   lives: 2, r: 14, machine: true, noblock: true, escort: [['legion', 2]],
    desc: 'Durup kulelerimize taş atar, 3 sn susturur ve hasar verir', ab: { bomb: { cd: 12, stun: 3, r: 200, dmg: 90 } } },
  // 15 Eki (Caner): Güneş Topu. İki lejyonerin ittiği aslan ağızlı top (Veo şeritleri, varliklar/top_veo_isle.py); iten askerler lejyonerle aynı boy
  cannon:    { name: 'Güneş Topu',          h: 49, hp: 520, speed: 10, armor: 0.3,  mr: 0,    gold: 46, dmg: [2, 4],   rate: 2,   lives: 2, r: 18, machine: true, noblock: true, escort: [['legion', 2]],
    desc: 'Durup kulelerimize gülle atar, 2,5 sn susturur', ab: { bomb: { cd: 10, stun: 2.5, r: 240, cannon: true, dmg: 120 } } },
  // yeni birlikler (9 Eki): mevcut görsellerden türer (base + game.js BOSS_LOOK renkleri ve kodla çizilen eşyalar)
  // noblock: iskeletler durduramaz (kemik duvar durdurur). ranged.moving: yürürken atar. split: ölünce dağılır.
  // purify: çevredeki cesetleri yakar, diriltilmiş ölülere vurur. aura: çevredekilere zırh (armor) ya da hız (speed).
  horsearcher: { name: 'Atlı Okçu', base: 'cavalry', h: 42, hp: 185, speed: 27, armor: 0.1, mr: 0, gold: 24, dmg: [4, 7], rate: 1, lives: 1, r: 13, noblock: true,
    ranged: { r: 125, dmg: [5, 9], rate: 1.7, proj: 'harrow', any: true, moving: true } },
  testudo:   { name: 'Testudo Bölüğü', base: 'legion', h: 30, hp: 640, speed: 12, armor: 0.75, mr: 0, gold: 36, dmg: [6, 10], rate: 1.2, lives: 2, r: 15, formation: true, split: ['legion', 3] },
  sunpriest: { name: 'Güneş Rahibesi', base: 'priest', h: 30, hp: 170, speed: 19, armor: 0, mr: 0.55, gold: 24, dmg: [2, 4], rate: 1, lives: 1, r: 10, purify: { r: 95, every: 4, dmg: 22 } },
  signifer:  { name: 'Sancaktar', base: 'legion', h: 31, hp: 150, speed: 21, armor: 0.2, mr: 0, gold: 18, dmg: [3, 6], rate: 1, lives: 1, r: 10, aura: { r: 85, armor: 0.25 }, prop: 'banner' },
  // 1. bölgenin son dört türü (görseller FLUX Kontext ile, Kaggle'da): trample: iskeletleri ezip geçer (kemik duvar durdurur)
  wardog:    { name: 'Savaş Köpeği', h: 15, hp: 70, speed: 46, armor: 0, mr: 0, gold: 6, dmg: [3, 6], rate: 0.7, lives: 1, r: 9 },
  chariot:   { name: 'Savaş Arabası', h: 36, hp: 300, speed: 28, armor: 0.3, mr: 0, gold: 34, dmg: [6, 10], rate: 1, lives: 1, r: 16, noblock: true, machine: true, trample: { dmg: 22, r: 16 }, strike: { r: 34, rate: 1.3, dmg: [12, 18], dur: 1, hit: 0.5 } }, // 17 Eki: sürerken mızrakla vurur (game.js strike)
  // 15 Eki (Caner): yeni Güneş Kuşatma Kulesi; tepede 4 güçlü okçu ok yağdırır, yıkılınca içinden onlarca asker yarı canın biraz üstünde (bazıları tam canla) dökülür
  siegetower:{ name: 'Kuşatma Kulesi', h: 89, hp: 1250, speed: 8, armor: 0.45, mr: 0.1, gold: 70, dmg: [2, 4], rate: 2, lives: 3, r: 26, machine: true, noblock: true,
    ranged: { r: 165, dmg: [7, 11], rate: 0.55, proj: 'harrow', any: true, moving: true, top: 0.95 },
    crew: { top: ['solarcher', 4], in: [['legion', 6], ['legion_k', 3], ['heavy', 2]], hp: [0.55, 0.68], full: 0.3 } },
  eagle:     { name: 'İmparatorluk Kartalı', h: 24, hp: 95, speed: 31, armor: 0, mr: 0.1, gold: 10, dmg: [0, 0], rate: 1, lives: 1, r: 10, flying: true, dive: { cd: 7, r: 60, rT: 90, dmg: [10, 16], dur: 1.5, hit: 0.3 } }, // 15 Eki: iskeletlere ve kuledeki okçulara pike (Veo _atk); rT: kuleye uzaklık
  // leş akbabası: sürüyle uçar; altındaki cesetleri yer (diriltilemez olur) ve kendini iyileştirir
  vulture:   { name: 'Leş Akbabası', h: 33, hp: 120, speed: 27, armor: 0, mr: 0, gold: 11, dmg: [0, 0], rate: 1, lives: 1, r: 11, flying: true, scavenge: { r: 60, every: 2.5, heal: 35 }, dive: { cd: 8, r: 60, rT: 90, dmg: [8, 12], dur: 1.5, hit: 0.32 } },
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
    { name: 'Yıkık Kilise', theme: 'graveyard', gold: 520, hpMul: 0.84, bossT: 'ironwarden', waves: [
      [W_('legion', 8, 1), W_('heavy', 1, 1, 8)],
      [W_('gladiator', 5, 1.3), W_('assassin', 4, 1.4, 4)],
      [W_('heavy', 2, 2.6), W_('priest', 2, 3, 3), W_('legion', 8, 0.9, 6)],
      [W_('solarcher', 6, 1.1), W_('assassin', 6, 1, 5)],
      [W_('heavy', 3, 2.2), W_('legion', 10, 0.8, 3), W_('priest', 2, 2.5, 8)],
      [W_('gladiator', 8, 1), W_('assassin', 6, 0.9, 5), W_('solarcher', 5, 1.1, 10)],
      [W_('heavy', 4, 2), W_('priest', 3, 2.4, 3), W_('legion', 12, 0.6, 8)],
      [W_('heavy', 3, 2.2), W_('gladiator', 8, 0.9, 4), W_('assassin', 8, 0.8, 9), W_('priest', 3, 2.4, 13)],
    ] },
    { name: 'Kara Göl Geçidi', theme: 'blacklake', weather: 'snow', gold: 560, hpMul: 0.88, bossT: 'cavcaptain', waves: [
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
      [{ t: 'cannon', n: 2, gap: 8 }, { t: 'legion', n: 14, gap: 0.6, at: 2 }, { t: 'solarcher', n: 8, gap: 0.9, at: 8 }],
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
    { name: 'Fener Bekçisinin Mezarı', theme: 'graveyard', gold: 500, hpMul: 0.64, bossT: 'shadowmaster', comic: 'bekci', waves: [
      [W_('legion', 10, 0.9), W_('priest', 1, 1, 6)], [W_('heavy', 2, 2.4), W_('solarcher', 5, 1.2, 4)], [W_('assassin', 6, 1), W_('gladiator', 5, 1.1, 5)],
      [W_('priest', 2, 3), W_('legion', 10, 0.8, 3)], [W_('heavy', 3, 2.2), W_('assassin', 6, 0.9, 6)], [W_('gladiator', 8, 0.9), W_('priest', 2, 3, 6)],
      [W_('heavy', 4, 2), W_('solarcher', 8, 0.9, 4), W_('legion', 10, 0.7, 10)], [W_('assassin', 10, 0.7), W_('heavy', 4, 2, 5), W_('priest', 3, 2.4, 9), W_('gladiator', 8, 0.8, 12)] ] },
    { name: 'Sazlık Kıyı', theme: 'blacklake', gold: 580, bossT: 'cavcaptain', comic: 'sazlik', waves: [
      [W_('legion', 10, 0.9), W_('cavalry', 2, 2, 7)], [W_('heavy', 3, 2.2), W_('solarcher', 6, 1.1, 4)], [W_('cavalry', 4, 1.6), W_('assassin', 6, 1, 5)],
      [W_('ram', 1, 1), W_('legion', 10, 0.8, 2), W_('priest', 2, 3, 8)], [W_('gladiator', 8, 0.9), W_('cavalry', 4, 1.5, 6)], [W_('heavy', 4, 2), W_('priest', 3, 2.4, 4), W_('assassin', 6, 0.9, 9)],
      [W_('ram', 1, 1), W_('cavalry', 5, 1.4, 3), W_('legion', 12, 0.6, 8)], [W_('heavy', 5, 1.8), W_('cavalry', 6, 1.3, 5), W_('priest', 3, 2.4, 8), W_('gladiator', 8, 0.8, 12)] ] },
    { name: 'Kemik Köprü', theme: 'necrogate', gold: 640, bossT: 'ironwarden', comic: 'kopru', waves: [
      [W_('legion', 12, 0.8), W_('solarcher', 6, 1.1, 5)], [W_('catapult', 1, 1), W_('gladiator', 8, 0.9, 3)], [W_('cavalry', 6, 1.3), W_('priest', 2, 3, 6)],
      [W_('heavy', 5, 1.8), W_('assassin', 8, 0.9, 5)], [W_('ram', 2, 6), W_('legion', 14, 0.6, 2), W_('solarcher', 6, 1, 9)], [W_('cannon', 2, 8), W_('heavy', 5, 1.8, 3), W_('cavalry', 6, 1.2, 9)],
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
  // 13 Eki: ilk 4 bölüm büyüsüz/az büyülü sıradan oyuncuya göre (sim: tools yok, scratchpad sade.js) yumuşatıldı: 1.512,1.052,1.174,2.344 -> 0.8,0.6,0.68,1.5
  // 15 Eki (Caner: "oyun kolay, iki seferi oyna, zorluğu ayarla"): botun hiç can kaybetmeden geçtiği bölümler 1. seferde ×1,12, 2. seferde ×1,15 (öğretici 1-3 ve zorlanılanlar hariç); 2. turda hâlâ tam canla geçilenler 1. seferde ×1,15, 2. seferde ×1,1; 21. bölüm geri (2,5: bot kaybetti); 3. turda üç turda da tam canla geçilenler +%10 / +%8, 23 (1,7) gevşedi; 4. tur: 14 (0,947), 15 (0,659), 31 (2,657) geri (bot kaybetti/zorlandı)
  // 15 Eki (Caner: "oyun kolay, iki seferi oyna, zorluğu ayarla"): botun hiç can kaybetmeden geçtiği bölümler 1. seferde ×1,12, 2. seferde ×1,15 (öğretici 1-3 ve zorlanılanlar hariç); 2. turda hâlâ tam canla geçilenler 1. seferde ×1,15, 2. seferde ×1,1; 21. bölüm geri (2,5: bot kaybetti); 3. turda üç turda da tam canla geçilenler +%10 / +%8, 23 (1,7) gevşedi; 4. tur: 14 (0,947), 15 (0,659), 31 (2,657) geri (bot kaybetti/zorlandı)
  const HPMUL = [0.5, 0.6, 0.68, 1.932, 1.044, 1.73, 0.976, 0.511, 0.449, 0.594, 0.602, 1.035, 0.624, 0.947, 0.659, 0.422, 0.572, 0.801, 0.364, 0.501]; // 15 Eki (Caner: 18-20'yi kolay geçti, oyun kolay): bot için yapılan 14/18/19 indirimleri geri alındı. Eski not: 14. bölüm 0.947→0.78 (muhafızlı kuşatma sonrası bot sınırda); 18 ve 19 kuşatma (yıkılabilir kule, 15 askerli kuşatma kulesi) sonrası botta kayıp: 0.801→0.62, 0.257→0.22. 11 Eki (2): kalıcı gelişimle (komutan seviyesi + büyü XP'si, denge-sayfa __prog) botla 3 tur ayarlandı (hedef 19→7 can)
  // 13 Eki (Caner): ilk 3 bölüm öğretici: Kingdom Rush'taki gibi kısa ve seyrek (140/150/165 -> ~80/90/100 düşman)
  const TOTK1 = [0.57, 0.6, 0.6, 0.8, 0.9]; // 4-5. bölüm ara basamak
  L.forEach((l, i) => Object.assign(l, old[i], { lives: 20, ep: 1, total: Math.round(TOTAL[i] * MORE_FOES), grow: 1.3, hpMul: HPMUL[i], totK: TOTK1[i] || 1 }));
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
      ranged: { r: 120, dmg: [10, 14], rate: 3, proj: 'flask', any: true, hold: true, splash: 30, noTower: true } }, // 16 Eki (Caner): kuledeki iskeletlere atmaz (durup yolu tıkıyordu)
    flagellant: { name: 'Kırbaçlı Tövbekâr', h: 31, hp: 220, speed: 22, armor: 0, mr: 0, gold: 16, dmg: [6, 10], rate: 0.8, lives: 1, r: 10, frenzy: { spd: 0.9, dmg: 1.2 } },
    lantern:    { name: 'Fener Arabası', h: 40, hp: 520, speed: 10, armor: 0.35, mr: 0.1, gold: 45, dmg: [2, 4], rate: 2, lives: 2, r: 16, machine: true, light: { r: 85, k: 0.7 }, purify: { r: 95, every: 5, dmg: 0, bless: true } }, // 15 Eki: fener cesetleri kutsar · 16 Eki (Caner): can 650 → 520 (-%20)
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
    { name: 'Yıkık Kule', theme: 'bloodmoon', weather: 'snow', gold: 680, waves: mk([['hound', 10, 0.5], ['hunter', 8, 0.9], ['paladin', 3, 2.2], ['torch', 4, 1.6]], [['lantern', 2, 5], ['inquisitor', 2, 3], ['bellpriest', 3, 2]], [['saint', 1, 1], ['siegetower', 1, 1]]) },
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
  // ek dalga ve düşman sayısı çarpanı (restructureWaves eğrisinin üstüne; 11 Eki: 21, 22, 28, 31 can ×3'te bile kayıpsız geçiliyordu.
  // Sebep 5. kademe büyüler: kısa bölümde bekleme süreleri her dalgaya yetiyor. Daha uzun bölüm, dalga başına aynı kalabalık)
  const ADDN2 = [1, 1, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 0, -2, 0, 0, 0, 0]; // 13 Eki (Caner): 21-22 yumuşak giriş (3 -> 1), 20 dk'yı aşan 28, 31, 33, 36 birkaç dalga kısa
  const GOLDK2 = [0.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.3, 1, 1, 1.3, 1, 1, 1, 1, 1]; // 32 ve 35: ilk dalgalar (çan rahibi, kırbaççı seli) için kule kurmaya yetsin // 16 Eki: 22, 28, 31'de az altın kalktı (yeni botla ilk dalgalarda çöküyordu) // tek girişli kolay bölümlerde başlangıç altını az (ilk dalgalar gerilsin)
  const TOTK2 = ADDN2.map((a, i) => 1 + a / (6 + Math.round(i / 19 * 6) + (i % 4 === 3 ? 2 : 0)));
  // 16 Eki (Caner: "bütün bölümleri botla oyna, dengesizlikleri düzelt"): tools/denge-botu2.js (gerçekçi oyuncu: yıldızlar, Büyü Kitabı, komutan puanı
  // harcanmış, kuleler yolu en çok gören yerlere, büyüler yerinde). Eski değerlerle 22, 25, 26, 28, 31, 35 kaybediliyor, 24, 34, 37 1-3 canla geçiliyordu.
  const HPMUL2 = [2.5, 2.53, 1.7, 1.438, 0.751, 0.683, 0.608, 2.415, 2.186, 1.25, 2.657, 2.415, 2.035, 1.725, 1.201, 1.174, 1.161, 1.834, 1.018, 0.801]; // 11 Eki (2): kalıcı gelişimle botla 3 tur (hedef 13→4 can). 11 Eki (3): 21, 22, 28, 31 ek dalga + az altın; 28 ve 31 can ×3,1/×3,9 (bot eşiği keskin: 31'de ×3 kayıpsız, ×4,5 kayıp)
  // her bölüm bir komutanla biter (1. seferdeki gibi): büyük bosslar 3, 6, 9, 12, 15'te; aralarda lejyon subayları ve eski bosslar
  const BOSS2 = ['centurion', 'shadowmaster', 'champion', 'malleus', 'hierophant', 'champion', 'malleus', 'campanus', 'malleus', 'ironwarden', 'campanus', 'ignis',
    'campanus', 'cavcaptain', 'ignis', 'colossus', 'ignis', 'severus', 'colossus', 'cathedral'];
  L2.forEach((l, i) => { l.bossT = BOSS2[i]; Object.assign(l, GEO2[i], { lives: 15, ep: 2, total: Math.round(TOTAL2[i] * MORE_FOES), grow: 1.3, hpMul: HPMUL2[i], totK: TOTK2[i], addN: ADDN2[i], gold: Math.round(l.gold * GOLDK2[i] / 5) * 5 }); if (!l.weather) delete l.weather; });
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
Object.assign(TOWERS.mage, { unlockLevel: 1, name: 'Ruh Feneri', desc: 'Ruh ışını: zırhı deler, yavaşlatır · menzilinde ölenlerin ruhunu toplar, büyüler çabuk dolar' }); // Ruh Hasadı: game.js SOUL
Object.assign(TOWERS.artillery, { unlockLevel: 1, name: 'Veba Kazanı', desc: 'Veba fırlatır: hafif alan hasarı, sonra her saniye zehir; vurulanlar yavaşlar, zırhı çürür' });
TOWERS.barracks.levels[0].perk = 'Tencere miğferli 3 iskelet acemi yolu keser';
TOWERS.barracks.levels[1].perk = 'İskelet muhafızlar: zincir zırh, kalkan, uzun kılıç';
TOWERS.barracks.levels[2].perk = 'Kemik şövalyeler: kara zırh · vuruşlar %15 can çalar';
TOWERS.artillery.levels[0].perk = 'Veba bulamacı: hafif alan hasarı, 4 sn zehir, %35 yavaşlatma, zırh yarıya iner';
TOWERS.artillery.levels[1].perk = 'Daha ağır veba, daha geniş gaz bulutu';
TOWERS.artillery.levels[2].perk = 'Kaynayan veba: %30 şansla 0.6 sn sersemletir';
TOWERS.mage.levels[0].perk = 'Ruh ışını: büyü hasarı zırhı deler';
const NAMES = { poison: 'Veba Kemiği', snipe: 'Kemik Mızrak', shield: 'Mezar Bekçisi', blade: 'Ölüm Şövalyesi', frost: 'Lanet', blast: 'Ruh Fırtınası', napalm: 'Çürüme Bulutu', double: 'Çifte Kazan' };
for (const k in TOWERS) for (const a of TOWERS[k].abilities || []) if (NAMES[a.id]) a.name = NAMES[a.id];
// komutanlar (tek seçilir). Wailing Wren 11 Eki'de, eski komutan 14 Eki'de (Caner) çıkarıldı: HERO_ORDER'da yok, başlangıç komutanı Spartaküs
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
// 15 Eki (Caner: "Merlin ölüm büyücüsünü yapalım, çok ihtişamlı"): Mortimer'a düelloda yenilen efsanevi büyücü; menzilli büyü ve kalabalık kontrolü.
// Görsel: varliklar/ham/nm_merlin.jpg (boynuz taçlı lich; h boynuz ve alevle birlikte, ihtişam için öbür komutanlardan uzun).
HEROES.merlin = { name: 'Merlin', role: 'Ölüm Büyücüsü · Menzilli büyü', sprite: 'hero_merlin', h: 44, halo: '190,150,255', aura: '160,110,255', cost: 45,
  hp: 210, dmg: [18, 26], armor: 0, rate: 1.3, speed: 70, respawn: 18, regen: 8, engage: 0, ranged: 185, proj: 'fireball', float: true, splash: 22, magic: true,
  // 14 Eki (Caner: "Merlin saf bir büyücü: ateş, buz, elektrik"): ateş topu atar; pasifleri Zaman Kapısı ve Kurbağaya Çevirme, aktifleri Meteor ve Zincir Şimşek
  paths: [{ name: 'Yetenekler', col: '#ffd34d', skills: [
    { id: 'timegate', name: 'Zaman Kapısı', cd: 16, desc: 'Kalabalığın altında zaman kapısı açılır: düşmanlar yolun gerisine fırlar, hasar alır, 1 sn sersemler (boss yarı yol)' },
    { id: 'frog', name: 'Kurbağaya Çevirme', cd: 15, desc: 'En güçlü düşmanı 30 sn kurbağa yapar: saldıramaz, yavaş zıplar, 3 kat hasar alır (boss olmaz)' },
  ] }] };
// 16 Eki (Caner: "elinden yeşil bir şey çıkıp kayboluyor, sonra sarı bir top çıkıyor"): saldırı şeridindeki yeşil ruh topu atılır (soul), elinden çıkar (shotAt);
// atış anı şeridin bırakma karesine denk gelir (anim.json hero_merlin_atk.order)
Object.assign(HEROES.merlin, { soul: true, shotAt: [0.38, 0.79] });
// 16 Eki (Caner: "ok ve bıçak fırlatmada uzman, ihtişamlı, ölü"): Robin, Ölü Orman'ın Hayaleti. Okçu + suikastçı + biraz druid; yanında Ruh Kurdu (görseli gelince).
HEROES.robin = { name: 'Robin', role: "Ölü Orman'ın Hayaleti · Okçu", sprite: 'hero_robin', h: 41, aura: '110,255,150', halo: '150,255,170', cost: 60, pet: 'wolf',
  hp: 260, dmg: [20, 30], armor: 0.15, rate: 1.0, speed: 88, respawn: 16, regen: 9, engage: 0, ranged: 205, proj: 'harrow',
  paths: [{ name: 'Yetenekler', col: '#ffd34d', skills: [
    { id: 'knives', name: 'Bıçak Yelpazesi', cd: 8, desc: 'Yakınındaki 5 düşmana yeşil alevli bıçak fırlatır' },
    { id: 'bonearrow', name: 'Kemik Ok', cd: 12, desc: 'Yol boyunca önündeki bütün düşmanları delip geçen kemik ok' },
    { id: 'hunter', name: 'Gölge Avcı', passive: true, desc: 'Kalıcı: %25 kritik vuruş, bosslara +%20 hasar' },
  ] }] };
// 16 Eki (Caner: "blood magic yapan ihtişamlı, korkunç, sıra dışı büyücü"): Erzsébet Báthory, Kan Kontesi. Menzilli kan büyüsü, can çalma, iskeletlere kan feda eder.
HEROES.bathory = { name: 'Báthory', role: 'Kan Kontesi · Kan büyüsü', sprite: 'hero_bathory', h: 42, aura: '220,30,50', halo: '255,90,90', cost: 70,
  hp: 240, dmg: [15, 22], armor: 0.1, rate: 1.15, speed: 72, respawn: 18, regen: 6, engage: 0, ranged: 180, proj: 'fireball', blood: true, magic: true, splash: 16, share: { r: 130, k: 0.5, kThirst: 0.8 }, /* 16 Eki (Caner): pasif: çaldığı can yakındaki iskeletleri de iyileştirir (k: çalınan canın payı) */ // 16 Eki (Caner: fazla güçlü): hasar 17-25 → 15-22
  paths: [{ name: 'Yetenekler', col: '#ffd34d', skills: [
    { id: 'bloodlink', name: 'Kan Bağı', cd: 12, desc: '4 düşmanı kan iplikleriyle bağlar: 5 sn canlarını emer, yavaşlatır; emilen can Báthory\'ye akar' },
    { id: 'sacrifice', name: 'Kan Fedası', cd: 16, desc: 'Canının %15\'ini feda eder: yakındaki iskeletler iyileşir, 6 sn %50 sert vurur' },
    { id: 'thirst', name: 'Kana Susamışlık', passive: true, desc: 'Kalıcı: kan okları %30 can çalar (normalde %15), +%10 hasar; çalınan can yakındaki iskeletleri %80 iyileştirir (normalde %50)' },
  ] }] };
Object.assign(HERO_ULT, {
  bathory: { name: 'Kan Gölü', cd: 60, anim: 2.0, r: 72, dps: [18, 24.3], dur: 5, bloodpool: true, heal: 12.6, // 16 Eki: 26-34 → 20-27; 16 Eki (2, Caner: "%10 düşür"): 18-24,3, iskelet iyileştirme 14 → 12,6
    desc: 'Seçtiğin yerde 5 sn kaynayan bir kan gölü açılır: düşmanların canını emer ve yavaşlatır, içindeki iskeletler iyileşir', short: 'Can emen, iskeletleri iyileştiren kan gölü' },
  robin: { name: 'Ok Yağmuru', cd: 55, anim: 2.6, r: 78, dmg: [16, 22], n: 36, dur: 3.5, rain: true,
    desc: 'Seçtiğin alana 3,5 sn yeşil ruh ateşli oklar yağar: hasar verir, zehirler', short: 'Alana 3,5 sn zehirli ok yağmuru' },
  merlin: { name: 'Meteor', cd: 60, anim: 1.8, r: 80, dmg: [110, 150], burn: 14, burnT: 4, meteor: true,
    desc: 'Gökten ruh ateşli demir bilyeler yağar: dağınık patlamalar, ufak kraterler ve 4 sn yanan zemin', short: 'Meteor yağmuru: dağınık patlamalar, yanan zemin' },
  spartacus: { name: 'Zincir Fırtınası', cd: 50, r: 70, dps: [22, 30], dur: 3, slow: 0.35, chains: true,
    desc: 'Seçtiğin alanda zincirler döner: 3 sn hasar verir, yavaşlatır', short: 'Alanda dönen zincirler: 3 sn hasar ve yavaşlatma' },
  leonidas: { name: 'Falanks', cd: 55, hp: 900, life: 6, phalanx: true,
    desc: 'Yolun seçtiğin yerinde kalkanlı üç iskelet hoplit duvar örer: 6 sn yolu kapatır', short: 'Yola kalkan duvarı: 6 sn yolu kapatır' },
});
HERO_ORDER.splice(0, HERO_ORDER.length, 'spartacus', 'leonidas', 'merlin', 'robin', 'bathory');
// 13 Eki (Caner): her komutanın 2 aktif gücü (savaşa yalnız biri götürülür, Komutanlar ekranında seçilir) ve kendi kendine kullandığı
// 2 pasif yeteneği var. İkinci aktifler: HERO_ULT2 (kademe tablosu HERO_TREE.ult2), pasifler: HEROES[id].passives (ağaçta yalnız bunlar).
const HERO_ULT2 = {
  spartacus: { name: 'Arena Kükremesi', cd: 45, r: 84, dmg: [18, 26], stun: 1.5, scream: true, col: '255,170,90',
    desc: 'Spartaküs arenayı inletir: alandaki düşmanlar hasar alır ve 1,5 sn sersemler', short: 'Alanda kükreme: hasar ve 1,5 sn sersemletme' },
  leonidas: { name: 'Mızrak Yağmuru', cd: 50, r: 72, dmg: [22, 30], n: 24, dur: 2.2, rain: true, poison: 0, gold: true,
    desc: 'Seçtiğin alana bronz uçlu mızraklar yağar: 2,2 sn ağır hasar', short: 'Alana 2,2 sn mızrak yağmuru' },
  // 16 Eki (Caner: "tornadolu fırtına olabilir; tornadoya kapılan düşman dönerek etrafa saçılır, savrulur"): Zincir Şimşek yerine Kasırga Fırtınası (game.js TORNADO)
  merlin: { name: 'Kasırga Fırtınası', cd: 45, anim: 1.5, r: 70, dmg: [40, 55], dur: 4, n: 12, tornado: true,
    desc: 'Fırtına bulutundan kasırga iner, yolda geriye ilerler: kapılan düşmanlar dönerek havalanır, hasar alıp etrafa savrulur (ağırlar ve boss yere devrilir), buluttan şimşek çakar', short: 'Yolda ilerleyen kasırga: kapılanı döndürüp savurur' },
  robin: { name: 'Kurt Uluması', cd: 45, anim: 2.2, r: 86, dmg: [14, 20], stun: 1.3, scream: true, col: '150,255,170',
    desc: 'Ruh kurtlarının uluması alanı sarar: düşmanlar hasar alır ve 1,3 sn korkudan donar', short: 'Alanda uluma: hasar ve 1,3 sn sersemletme' },
  bathory: { name: 'Kan Yarasaları', cd: 50, anim: 2.2, r: 70, dps: [13, 18], dur: 3, slow: 0.35, heal: 0.3, n: 14, bats: true, // 16 Eki: 16-22 → 13-18, iyileşme %40 → %30
    desc: 'Kan yarasaları alana üşüşür: 3 sn ısırır, yavaşlatır, Báthory ısırıklarla iyileşir', short: 'Alana kan yarasaları: ısırık, yavaşlatma, iyileşme' },
};
// pasifler: komutanın kendi kendine kullandığı iki yetenek (ötekiler ağaçta görünmez, öğrenilmiş puanları iade edilir)
const HERO_PASSIVES = { spartacus: ['whirl', 'bash'], leonidas: ['bash', 'iron'], merlin: ['timegate', 'frog'], robin: ['bonearrow', 'hunter'], bathory: ['bloodlink', 'thirst'] };
for (const id in HERO_PASSIVES) if (HEROES[id]) HEROES[id].passives = HERO_PASSIVES[id];
Object.assign(HERO_ULT.zeynep, { name: 'Ölüm Çığlığı', cd: 50, r: 82, dmg: [26, 36], stun: 1.6, desc: 'Wren çığlık atar: alandaki düşmanlar hasar alır ve 1,6 sn sersemler' });
// kale yerine Mortimer'ın kulesi: balkonda Mortimer durur, okçular pencere önlerinde
Object.assign(CASTLE, { spots: [[0.21, 0.385], [0.67, 0.41], [0.46, 0.16]] }); // şapel: iki kulenin çıkıntısı ve alınlık tepesi
// Mortimer'ın büyüleri (sol altta, bekleme süreli). raise: hedefsiz, süre boyunca ölen düşmanlar iskelet minyon olur.
// fear: hedefli alan, düşmanlar kavgayı bırakıp yolda geri kaçar (bosslar yarı süre).
// Büyü Kitabı (11 Eki; Kingdom Rush 6: Genesis modeli): her büyü KULLANILDIKÇA XP kazanır (yalnız yapılınca), seviye atlar,
// her seviye o büyüye 1 puan verir; puan, büyünün 5 kademesinden sıradakini açar. Her kademe beklemeyi %4 kısaltır, 5. kademe yeni etki.
// lv: seviye eşikleri (toplam XP; 2..6. seviye), cast: büyü başına XP + per × etkilenen düşman (en çok 10). ~55 XP/bölüm: 1. seferin
// sonunda 5. kademe. Sonradan açılan büyü geç kalmasın: açıldığı bölüm × catchup XP ile başlar (Genesis: geç açılanlar ek XP'li gelir).
const RAISE_MAX = [4, 7, 10, 13, 16, 20]; // Ölüleri Diriltme: kademeye göre aynı anda en çok dirilen (game.js spellStats)
const GRIM = {
  lv: [0, 60, 180, 380, 680, 1100], cast: 20, per: 3, catchup: 45, cd: 0.04,
  nm_raise: ['+3 dirilen · +%10 güç · ceset +2 sn', '+3 dirilen · +%10 güç · ceset +2 sn', '+3 dirilen · +%10 güç · ceset +2 sn', '+3 dirilen · +%10 güç · ceset +2 sn', '+4 dirilen · +%25 can ve hasar · ceset +2 sn · 2 ayrı grup'], // 16 Eki (Caner): en çok 4/7/10/13/16/20 dirilen (RAISE_MAX), ceset %30 uzun // 16 Eki: her kademe cesetlerin yerde kalma süresini de uzatır (game.js CORPSE_T)
  nm_fear:  ['+0,3 sn · alan +%8', '+0,3 sn · alan +%8', '+0,3 sn · alan +%8', '+0,3 sn · alan +%8', '+0,3 sn · korkan %20 fazla hasar alır'],
  nm_wall:  ['+%15 dayanıklı · +0,75 sn', '+%15 dayanıklı · +0,75 sn', '+%15 dayanıklı · +0,75 sn', '+%15 dayanıklı · +0,75 sn', '+%40 dayanıklı · +2 sn'],
  nm_burst: ['+%12 hasar · alan +%5', '+%12 hasar · alan +%5', '+%12 hasar · alan +%5', '+%12 hasar · alan +%5', 'Patlama 1 sn sersemletir'],
  nm_golem: ['+3 sn · +%10 can', '+3 sn · +%10 can', '+3 sn · +%10 can', '+3 sn · +%10 can', 'Golem %30 sert vurur'],
};
// Komutan yetenek ağacı (11 Eki): her seviyede 1 puan (1. seviyede de); yetenekler 5 kademe, komutan gücü 1→5 kademe. Kademe şu seviyede açılır:
// 11 Eki (denge): her seviye 1 puan, 1. seviye dahil (komutan yeteneksiz başlamasın; ilk puanla bir yetenek seçilir)
const HERO_TREE = { sk: [0, 1, 4, 8, 12, 16], ult: [0, 1, 4, 8, 12, 16], ult2: [0, 3, 6, 10, 14, 18], dmg: 0.15, cd: 0.05, ultK: 0.15 }; // ult2: ikinci aktif (13 Eki) // 11 Eki denge: kademe başı %15 (önce %25: komutan bölümleri tek başına taşıyordu)
const NECRO_SPELLS = {
  // cesetler ölümden sonra corpse sn yerde yatar; büyü o an yerdeki cesetleri iskelet minyon olarak kaldırır
  nm_raise: { name: 'Ölüleri Diriltme', cd: 41.8, /* 16 Eki (2, Caner: "cooldown %10 uzasın"; önce %20 kısa denmişti): 38 → 41,8 */ /* 16 Eki (Caner): 45 → 38, biraz daha sık */ corpse: 6, col: '190,80,255', max: 4, /* 13 Eki: 1. seviyede 3, kademe başına +1 (en çok 8); 16 Eki (Caner: "en son seviyede 20"): kademelere göre RAISE_MAX */ r: 95, minion: { hp: 80, dmg: [4, 8], armor: 0.1, life: Infinity }, // 15 Eki (Caner): dirilenler bölüm sonuna dek, ölene kadar savaşır
    desc: 'Dokununca sahadaki cesetler, güçlüler önce, kademene göre kalkar ve ölene dek senin için savaşır · İri düşmanın ölüsü daha güçlü kalkar (kızıl parlayanlar) · Rahipler ve fenerler cesetleri kutsar, diriltilemez olur',
    short: 'Sahadaki cesetler kalkar, güçlüler önce · iri düşmanın ölüsü daha güçlü' },
  nm_wall:  { name: 'Kemik Duvarı', cd: 30, hp: 420, life: 7, col: '235,225,200',
    desc: 'Yolun seçtiğin yerinde kemikten duvar yükselir: düşmanları 7 sn durdurur, vurularak kırılabilir',
    short: 'Yola kemik duvar diker: düşmanlar 7 sn takılır (kırılabilir)' },
  nm_fear:  { name: 'Korku', cd: 40, r: 120, t: 3, col: '190,120,255', ghosts: 10, desc: 'Ruhlar alandaki düşmanların peşine düşer: korkudan 3 sn geri kaçarlar. Büyü direnci olanlar ve bosslar daha az korkar; makineler korkmaz ama savaş arabalarının atları ürküp yavaşlar', short: 'Ruhlar düşmanları kovalar: 4 sn panikle geri kaçarlar' },
  // 5. büyü (10 Eki): 2. seferin 9. bölümü kazanılınca (Kemik Katedrali) açılır. Sahadaki bütün cesetler tek golemde birleşir
  nm_golem: { name: 'Ceset Golemi', cd: 55, min: 3, max: 14, life: 20, hp: 220, hpPer: 85, dmg: [14, 22], dmgPer: 0.06, col: '150,255,110', unlock: 31,
    desc: 'Sahadaki bütün cesetler seçtiğin yerde tek bir golemde birleşir: ceset ne kadar çoksa o kadar iri ve güçlü. 20 sn düşmanın üstüne yürür, alan vuruşu yapar',
    short: 'Cesetler birleşip golem olur (en az 3 ceset): 20 sn savaşır' },
  // 4. büyü: 1. bölge bitince (son bölüm kazanılınca) açılır. Cesedi diriltmek ya da patlatmak arasında seçim.
  nm_burst: { name: 'Ceset Patlatma', cd: 35, min: 3, r: 110, blast: 58, dmg: 70, pct: 0.08, poison: [8, 3], col: '170,255,90', unlock: 19,
    desc: 'Seçtiğin alandaki cesetler patlar (en az 3 ceset): her biri çevresine ağır hasar verir ve zehirler (bosslara yüzdelik hasar yarım)',
    short: 'Alandaki cesetleri patlatır: çevresine ağır hasar ve zehir' },
};
// şapel ağacı (10 Eki): kapıyı tutan Kemik Devi; 15 Eki (Caner): kale kuleler gibi 3 kez yükselir, balkona en çok 2 iskelet okçu
Object.assign(CASTLE.levels[0], { title: 'Kara Şapel', perk: 'Mortimer çayını içiyor. Yükselt: kapıya Kemik Devi, balkona iskelet okçu', archers: 0 });
Object.assign(CASTLE.levels[1], { title: 'Kemik Devi', cost: 200, dmg: [6, 9], rate: 1.6, archers: 2, // 15 Eki: ilk yükseltmede de 2 okçu (hasar biraz düşük)
  perk: 'Kapıyı Kemik Devi korur (3 düşmanı durdurur, ölürse 30 sn\'de kalkar); balkonda 2 iskelet okçu',
  giant: { hp: 900, dmg: [22, 34], armor: 0.45, block: 3, respawn: 30 } });
Object.assign(CASTLE.levels[2], { title: 'Kemik Kolos', cost: 300, dmg: [9, 14], rate: 1.35, archers: 2, crit: 0,
  perk: 'Dev büyür: 4 düşmanı durdurur, yeri döverek sersemletir, 15 sn\'de kalkar; balkonda 2 iskelet okçu',
  giant: { hp: 1300, dmg: [32, 48], armor: 0.5, block: 4, stomp: true, k: 1.18, respawn: 15 } }); // Mortimer saldırmaz (Caner: ana karakter)
CASTLE.levels[3] = { title: 'Kemik Hisarı', cost: 400, dmg: [13, 20], rate: 1.15, archers: 2, crit: 0.15,
  perk: 'Kolos daha dayanıklı; usta okçular: daha sert oklar, %15 kritik vuruş',
  giant: { hp: 1600, dmg: [36, 54], armor: 0.55, block: 4, stomp: true, k: 1.24, respawn: 12 } };

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
  let shape = [1];
  for (let k = 1; k < N; k++) shape.push(shape[k - 1] * (k === N - 1 ? LGROW : GROW));
  if (lv.shape) shape = lv.shape; // dalga yapısı v2: testere dişi (restructureWaves)
  const fixedN = lv.waves.reduce((a, w) => a + (w.some(g => g.fixed) ? count(w) : 0), 0);
  const A = Math.max(1, (lv.total || orig.reduce((a, b) => a + b) * WAVE_TOTAL) - fixedN) / shape.reduce((a, b, k) => a + (lv.waves[k].some(g => g.fixed) ? 0 : b), 0);
  let prev = 0;
  lv.waves.forEach((w, k) => {
    if (w.some(g => g.fixed)) return; // nefes dalgası: sayıları elle, ölçeklenmez
    let target = Math.max(4, Math.round(A * shape[k]));
    if (k && !lv.shape) target = Math.max(target, Math.ceil(prev * (k === N - 1 ? LGROW : GROW)));
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
// Yolun son kısmı: kapıdan 60 px yakındaki noktalar atılır, yol şapelin önüne inip kapıya alttan girer.
// 16 Eki: kale artık her yerde olabilir (LAYOUT3): yol, geldiği yandan (sağ/sol) kapıya yaklaşır; alttaki kalede dalış sığ (ekrandan taşmasın)
function gateApproach(pts) {
  const E = pts[pts.length - 1];
  const keep = pts.slice(0, -1).filter(p => Math.hypot(p[0] - E[0], p[1] - E[1]) > 60);
  const P = keep[keep.length - 1] || [E[0] - 100, E[1]], s = Math.sign(P[0] - E[0]) || -1, dip = E[1] > 430 ? 0.45 : 1;
  return keep.concat([[E[0] + s * 38, E[1] + 50 * dip], [E[0] + s * 14, E[1] + 36 * dip], E]);
}
// 16 Eki (Caner: "bölümler sıkıcı mı, birbirinin kopyası mı?"): 40 bölümün 40'ında kale sağ kenardaydı, her harita soldan sağa okunuyordu;
// 29 ile 37'nin yolu neredeyse aynıydı, 10-16 ve 34-35 benzerdi. Bu bölümlerde kale solda (L), altta (B), üstte (T) ya da ortada (C);
// düşman sağdan da gelir. Arsalar tools/arsa-uret.js ile (--json) bu yollara göre üretildi. routes (kol) yok: her yol ayrı giriş ya da birleşir.
// 16 Eki: 2. seferin mekânlarına çevre mekaniği (game.js MECH): Kuzgun Ormanı darağaçları, Veba Köyü karantina kapısı, Manastır çan kulesi, Kemik Mahzeni kemik yığınları
const MECH2 = { ravenwood: 'gallows', plague: 'quarantine', monastery: 'chime', ossuary: 'bonepile' };
for (const lv of LEVELS) if (lv.ep === 2 && !lv.mech && MECH2[lv.theme]) lv.mech = MECH2[lv.theme];
const LAYOUT3 = {
  'Kurbağa Adası': { k: 0.6,  // B
    paths: [[[-40,240],[120,240],[220,170],[360,140],[470,200],[460,300],[500,380],[520,450],[580,472],[640,488]], [[700,-40],[700,90],[800,170],[810,290],[790,400],[740,470],[640,488]]], plots: [[358,216],[730,234],[94,144],[826,492],[418,390],[274,228],[376,282],[664,192],[886,342],[112,342],[610,132],[868,414]] },
  'Kemik Tarlası': { // L
    paths: [[[1000,140],[850,140],[740,200],[620,170],[500,210],[420,280],[300,260],[200,250],[105,300]], [[1000,380],[860,380],[760,330],[640,360],[520,390],[380,370],[250,340],[105,300]], [[560,-40],[560,90],[520,170],[420,280],[300,260],[200,250],[105,300]]], plots: [[550,276],[796,264],[622,240],[880,270],[340,198],[76,396],[508,462],[256,180],[442,132],[742,420],[592,450],[832,474]] },
  'Lanet Kuyusu': { // C
    paths: [[[-40,180],[120,180],[200,270],[300,380],[420,392],[480,365]], [[1000,180],[850,180],[760,270],[660,380],[540,392],[480,365]], [[240,-40],[240,90],[160,170],[200,270],[300,380],[420,392],[480,365]], [[740,580],[740,470],[660,400],[540,392],[480,365]]], plots: [[598,456],[256,210],[844,294],[352,318],[118,288],[784,366],[604,318],[322,144],[502,486],[202,396],[826,426],[724,186],[334,252],[664,264]] },
  'Yanık Kazıklar': { // L
    paths: [[[1000,180],[860,180],[760,240],[640,200],[520,150],[410,190],[390,280],[480,345],[370,395],[250,365],[180,300],[105,300]]], plots: [[496,264],[310,312],[730,162],[856,294],[220,240],[580,252],[502,426],[304,240],[76,396],[772,306],[556,318],[364,132]] },
  'Kuzgun Tepesi': { ep: 2, k: 0.6, g: 1.3,  // B
    paths: [[[260,-40],[260,90],[200,170],[260,250],[400,270],[480,340],[500,420],[560,470],[640,488]], [[700,-40],[700,90],[790,160],[760,250],[620,250],[480,340],[500,420],[560,470],[640,488]]], plots: [[394,354],[640,174],[304,192],[484,234],[778,318],[352,132],[190,288],[868,210],[574,132],[742,498],[556,198],[136,228]] },
  'Karantina Kapısı': { // C
    paths: [[[-40,250],[120,250],[220,330],[330,392],[420,398],[480,365]], [[1000,240],[840,240],[740,320],[620,395],[540,398],[480,365]]], plots: [[592,330],[346,324],[844,348],[112,354],[574,468],[280,282],[718,240],[118,150],[658,288],[190,396],[778,162],[658,456]] },
  'Veba Hendeği': { k: 0.75, g: 1.3,  // T
    paths: [[[-40,330],[110,330],[210,250],[320,230],[380,300],[440,310],[500,240]], [[700,580],[700,460],[780,380],[720,300],[620,300],[560,290],[500,240]]], plots: [[646,372],[286,306],[508,354],[82,234],[400,198],[808,492],[634,228],[232,360],[604,432],[814,282],[412,378],[154,198]] },
  'Ölüler Kuyusu': { // L
    paths: [[[1000,380],[860,380],[760,300],[780,190],[660,140],[520,170],[460,260],[540,340],[440,390],[320,350],[240,270],[105,290]]], plots: [[400,312],[640,246],[232,372],[868,276],[550,246],[346,258],[820,468],[508,444],[88,396],[862,204],[724,384],[442,138]] },
  'Su Basmış Avlu': { k: 0.75, g: 1.2,  // B
    paths: [[[-40,150],[140,150],[260,220],[380,200],[460,280],[480,370],[520,450],[580,472],[640,488]], [[1000,260],[880,260],[780,210],[650,190],[540,230],[470,290],[480,370],[520,450],[580,472],[640,488]]], plots: [[382,300],[688,258],[124,246],[478,180],[760,306],[406,396],[268,144],[832,348],[568,138],[292,288],[742,498],[64,294]] },
  'Çan Kulesi': { k: 0.88, // C
    paths: [[[-40,170],[110,170],[200,250],[160,330],[240,390],[360,398],[430,385],[480,365]], [[1000,170],[860,170],[760,250],[800,330],[720,390],[600,398],[530,385],[480,365]]], plots: [[256,318],[700,318],[502,486],[94,270],[868,276],[586,474],[352,330],[772,444],[724,168],[244,174],[112,396],[604,330]] },
  'Kafatası Kapısı': { // L
    paths: [[[700,580],[700,450],[800,370],[840,260],[760,170],[620,130],[480,160],[420,250],[500,320],[400,380],[280,350],[200,290],[105,300]]], plots: [[358,306],[754,276],[544,210],[214,396],[820,468],[694,216],[568,276],[292,264],[604,426],[886,378],[76,396],[502,420]] },
  'Kemik Mahzeni': { // T (Kemik Avize Salonu'na benziyordu)
    paths: [[[-40,300],[120,300],[230,360],[340,330],[420,300],[500,240]], [[1000,300],[840,300],[730,360],[620,330],[560,300],[500,240]], [[620,580],[620,450],[560,400],[520,330],[500,240]]], plots: [[448,366],[718,432],[244,288],[850,402],[610,246],[100,396],[520,492],[364,396],[718,288],[400,234],[94,198],[880,198]] },
  'Sis Yolu': { // B (Sazlık Şapel'in neredeyse aynısıydı)
    paths: [[[420,-40],[420,80],[300,130],[180,190],[200,290],[320,330],[420,280],[520,200],[660,160],[800,200],[830,300],[790,400],[740,460],[640,488]]], plots: [[322,216],[748,264],[574,252],[808,498],[676,228],[280,396],[862,432],[514,300],[130,132],[196,372],[880,180],[454,348]] },
  'Yıkık Kule': { k: 0.85,  // L
    paths: [[[1000,150],[840,150],[720,210],[560,180],[420,230],[300,220],[200,260],[105,290]], [[760,580],[760,450],[640,400],[500,380],[360,370],[240,330],[105,290]]], plots: [[352,294],[592,306],[844,252],[634,474],[436,300],[88,396],[676,288],[208,174],[520,270],[718,132],[856,426],[298,150]] },
  'Kızıl Sur': { k: 0.58,  // C
    paths: [[[-40,200],[120,200],[220,300],[330,392],[420,398],[480,365]], [[1000,200],[840,200],[740,300],[630,392],[540,398],[480,365]], [[250,-40],[250,100],[180,170],[160,260],[220,300],[330,392],[420,398],[480,365]]], plots: [[256,228],[592,330],[364,330],[844,306],[88,294],[574,468],[340,138],[784,360],[160,348],[718,210],[322,270],[658,456]] },
};
// ekrandaki yol uzunluğu (çerçeve dışı giriş payı sayılmaz): yeni yol kısaysa düşman kulelerin önünde daha az kalır → can çarpanı orana göre (LAYOUT3.k ile ince ayar)
const scrLen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) { const c = (v, m) => Math.max(0, Math.min(m, v)); s += Math.hypot(c(p[i][0], 960) - c(p[i - 1][0], 960), c(p[i][1], 540) - c(p[i - 1][1], 540)); } return s; };
for (const lv of LEVELS) { const Lo = LAYOUT3[lv.name]; if (!Lo || (Lo.ep && Lo.ep !== (lv.ep || 1))) continue;
  const avg = (P) => P.reduce((a, p) => a + scrLen(p), 0) / P.length, r = avg(Lo.paths) / avg(lv.paths), n0 = lv.paths.length;
  lv.paths = Lo.paths.map(p => p.map(q => q.slice())); delete lv.routes; if (Lo.plots) lv.plots = Lo.plots.map(q => q.slice()); lv.layout3 = true;
  lv.hpMul *= Math.pow(Math.max(0.4, Math.min(1.15, r)), 1.1) * (Lo.k || 1); lv.gold = Math.round(lv.gold * (lv.paths.length > n0 ? 1.15 : 1) * (Lo.g || 1) / 5) * 5; } // k: can, g: başlangıç altını ince ayarı (denge botu)
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
// ----- Dalga yapısı v2 (11 Eki, Kingdom Rush karşılaştırması: arastirma/dalga-analizi.md) -----
// 1) dalga sayısı bölüme göre: 6'dan 12'ye, her bölgenin son bölümü +2 (14'e kadar)
// 2) toplam düşman seferde ~3,5 kat büyür (1. seferde 140 -> 470, 2. seferde 180 -> 500)
// 3) testere dişi: her 4. dalga "nefes": az sayıda seçkin düşman (sayıları ölçeklenmez, canı x1,5); sonra yükseliş sürer
// 4) tanıtım: bir tür seferde ilk kez geldiği dalgada yalnız gelir; tema: ortadaki dalga tek fikirli (hızlı / zırhlı / uçan / menzilli)
// 5) iki ve daha çok girişli haritada tek gruplu dalgalar girişlere bölünür, bir dalga ters taraftan "baskın" olarak gelir
const WAVES_V2 = { foesK: 1.1, n0: 6, n1: 12, fin: 2, tot: { 1: [140, 470], 2: [180, 500] }, growK: 6, breathEvery: 4, breathW: 0.35, eliteHp: 1.5 };
const waveCat = (t) => { const d = ENEMIES[t] || {}; return d.flying ? 'fly' : d.speed >= 34 ? 'fast' : d.armor >= 0.4 ? 'armor' : d.ranged ? 'ranged' : null; };
function restructureWaves() {
  const seen = new Set(['legion']), epIdx = {};
  LEVELS.forEach((lv) => {
    const ep = lv.ep || 1, k = epIdx[ep] = (epIdx[ep] ?? -1) + 1, p = k / 19, fin = k % 4 === 3;
    const N = WAVES_V2.n0 + Math.round(p * (WAVES_V2.n1 - WAVES_V2.n0)) + (fin ? WAVES_V2.fin : 0) + (lv.addN || 0);
    const [t0, t1] = WAVES_V2.tot[ep] || WAVES_V2.tot[1];
    lv.total = Math.round(t0 * Math.pow(t1 / t0, p) * (lv.totK || 1) * WAVES_V2.foesK); // 15 Eki (Caner): bölüm başı %10 daha çok düşman
    const T = lv.waves, clone = (w) => w.map(g => Object.assign({}, g));
    const W = []; for (let j = 0; j < N; j++) W.push(clone(T[Math.round(j * (T.length - 1) / (N - 1))]));
    const heavyG = (g) => (ENEMIES[g.t] || {}).hp >= HEAVY_HP || (ENEMIES[g.t] || {}).elite;
    const shape = [], breath = [];
    let v = 1; const g = Math.pow(WAVES_V2.growK, 1 / (N - 1));
    for (let j = 0; j < N; j++) { const b = j % WAVES_V2.breathEvery === WAVES_V2.breathEvery - 1 && j < N - 1; breath.push(b); shape.push(b ? v * WAVES_V2.breathW : v); v *= g; }
    W.forEach((w, j) => {
      if (breath[j]) { // nefes dalgası: dalganın en güçlü türleri, az sayıda, sert
        let el = w.filter(heavyG); if (!el.length) el = [w.slice().sort((a, b) => (ENEMIES[b.t].hp || 0) - (ENEMIES[a.t].hp || 0))[0]];
        W[j] = el.slice(0, 2).map(x => Object.assign({}, x, { n: Math.max(1, Math.min(x.n, heavyG(x) ? x.n : 3 + Math.floor(k / 5))), at: 0, gap: Math.max(x.gap, 1.6), hpK: heavyG(x) ? 1 : WAVES_V2.eliteHp, fixed: true }));
        return;
      }
      const fresh = w.filter(x => !seen.has(x.t) && !(ENEMIES[x.t] || {}).chief);
      if (fresh.length && j > 0) { W[j] = fresh.map(x => Object.assign({}, x, { at: 0 })); W[j].intro = true; } // tanıtım: yeni tür yalnız
      for (const x of W[j]) seen.add(x.t);
    });
    // tema dalgası: ortadaki sıradan dalga tek fikre iner (bölümde o kategoride tür varsa)
    const cats = ['fast', 'armor', 'fly', 'ranged'], pool = T.flat();
    const tj = Math.floor(N / 2) + (breath[Math.floor(N / 2)] || W[Math.floor(N / 2)].intro ? 1 : 0);
    for (let c = 0; c < cats.length; c++) {
      const cat = cats[(k + c) % cats.length], grp = pool.filter(x => waveCat(x.t) === cat && !(ENEMIES[x.t] || {}).chief);
      if (!grp.length || !W[tj] || breath[tj] || W[tj].intro) continue;
      const seenT = new Set(); W[tj] = grp.filter(x => !seenT.has(x.t) && seenT.add(x.t)).map(x => Object.assign({}, x, { at: 0 })); W[tj].theme = cat; break;
    }
    // girişler: tek gruplu dalga iki girişe bölünür; sondan üçüncü dalga tümden ikinci girişten (baskın)
    if (lv.entr > 1) W.forEach((w, j) => {
      if (breath[j]) return;
      if (j === N - 3) { for (const x of w) x.p = 1 % lv.entr; return; }
      if (w.length === 1 && w[0].n >= 2 && !heavyG(w[0])) { const a = w[0], n = a.n, b = Object.assign({}, a, { p: (a.p + 1) % lv.entr }); a.n = Math.ceil(n / 2); b.n = n - a.n; w.push(b); }
    });
    lv.waves = W; lv.shape = shape; lv.breath = breath;
  });
}
restructureWaves();
LEVELS.forEach((lv, i) => shapeWaves(lv, i));
// 16 Eki (Caner: "10 koçbaşı göndermene gerek yok, az az gönder, yanlarında lejyonerler korusun"): bir grupta en çok SIEGE_CAP.n kuşatma
// makinesi, aralıklı gelir; fazlasının yerine (makine başı SIEGE_CAP.swap) lejyoner aynı yoldan gelir. Her makine ayrıca 2 muhafız lejyonerle doğar (def.escort).
const SIEGE_CAP = { types: ['ram', 'catapult', 'cannon', 'siegetower'], n: 2, gap: 8, swap: 2 };
// 15 Eki (Caner: "ağ atan Van Helsing gibi adam baya güçlü, çok kalabalık gelmesine gerek yok"): Cadı Avcısı bir grupta en çok UNIT_CAP.n tane;
// fazlası Meşaleci olur (toplam sayı korunur). Önce bir dalgada 45-84 avcı geliyordu.
const UNIT_CAP = { hunter: { n: 3, swap: 'torch' } };
LEVELS.forEach((lv) => lv.waves.forEach((w) => {
  for (const g of w.slice()) {
    for (const t in UNIT_CAP) { const C = UNIT_CAP[t];
      if (g.types) { let k = 0; g.types = g.types.map(x => (x === t && ++k > C.n ? C.swap : x)); }
      else if (g.t === t && g.n > C.n) { const extra = g.n - C.n; g.n = C.n; w.push({ t: C.swap, n: extra, gap: g.gap, p: g.p, at: g.at || 0, hpK: g.hpK || 1 }); }
    }
    if (g.types) { // karışık grup: ilk n makine kalır, gerisi lejyoner olur
      let k = 0; g.types = g.types.flatMap(t => SIEGE_CAP.types.includes(t) && ++k > SIEGE_CAP.n ? Array(SIEGE_CAP.swap).fill('legion') : [t]); g.n = g.types.length;
      if (k) g.gap = Math.max(g.gap, 1.4); continue;
    }
    if (!SIEGE_CAP.types.includes(g.t)) continue;
    g.gap = Math.max(g.gap, SIEGE_CAP.gap);
    if (g.n <= SIEGE_CAP.n) continue;
    const extra = g.n - SIEGE_CAP.n; g.n = SIEGE_CAP.n;
    w.push({ t: 'legion', n: extra * SIEGE_CAP.swap, gap: 1.1, p: g.p, at: (g.at || 0) + 2, hpK: g.hpK || 1 });
  }
}));
// Destek birlikleri (davulcu, sancaktar) tek başına gelmez: yalnız kalabalık piyade bölüğünün (en az SUPPORT.min kişi) ortasında,
// bölükle aynı yoldan ve aynı anda yürür. Bölük büyükse (2 x min) ikisi birden; tür sırası bölükten bölüğe değişir.
// 16 Eki (Caner: "ışık arabası feneri yalnız başına gelmesin, düşman birlikleri arasında gelsin"): fener arabası iki tövbekâr + iki meşaleci
// muhafızla doğar (def.escort) ve dalganın en kalabalık bölüğünün ortasında, aynı yoldan yürür. Dalgada başka bölük yoksa (tanıtım, nefes)
// yanına bir piyade bölüğü eklenir.
ENEMIES.lantern.escort = [['flagellant', 2], ['torch', 2]];
LEVELS.forEach((lv) => lv.waves.forEach((w) => {
  for (const g of w.filter(x => x.t === 'lantern')) {
    let host = w.filter(x => x !== g && x.t !== 'lantern' && (x.types ? !x.types.includes('lantern') : !(ENEMIES[x.t] || {}).chief && (ENEMIES[x.t] || {}).hp < HEAVY_HP)).sort((a, b) => b.n - a.n)[0];
    if (!host) { host = { t: 'legion', n: 6 + 2 * g.n, gap: 0.9, p: g.p, at: g.at || 0, hpK: 1 }; w.push(host); }
    g.p = host.p; g.at = (host.at || 0) + host.gap * Math.min(host.n * 0.4, 8); g.gap = Math.max(g.gap || 0, host.gap * 3);
  }
}));
const SUPPORT = { min: 6, inf: ['legion', 'legion_k', 'legion_y', 'heavy', 'gladiator'], units: [['drummer', 1], ['signifer', 4]] }; // 15 Eki: davulcu daha sık (6+ kişilik bölük, 2. bölümden)
LEVELS.forEach((lv, li) => {
  if (!lv.ep || lv.ep !== 1) return;
  const avail = SUPPORT.units.filter(([, from]) => li >= from).map(([t]) => t);
  if (!avail.length) return;
  let turn = li;
  lv.waves.forEach((w) => {
    for (const g of w.slice()) {
      const kinds = g.types || [g.t], inf = kinds.filter(t => SUPPORT.inf.includes(t)).length;
      if (g.n < SUPPORT.min || inf < kinds.length * 0.6) continue; // kalabalık ve çoğu piyade olan bölük
      // 15 Eki (Caner): davulcu her uygun bölüğün başında (önden 2. sıra); sancaktar yalnız büyük bölüğün ortasında
      const pick = avail.includes('drummer') ? ['drummer'].concat(g.n >= SUPPORT.min * 2 && avail.includes('signifer') ? ['signifer'] : []) : avail.slice(0, 1);
      pick.forEach((t, j) => w.push({ t, n: 1, gap: 1, at: (g.at || 0) + g.gap * (t === 'drummer' ? 1.5 : g.n * 0.5), p: g.p, hpK: g.hpK, escort: true }));
      turn++;
    }
  });
});
const BOSS_EVERY = 4; // 17 Eki: her mekân 4 bölüm; boss mekânın son bölümünde
const CLASS_OF_EXTRA = {}; // sonradan eklenen bossların zırh sınıfı (CLASS_OF'a katılır)
// 1. sefer bossları (11 Eki, Caner: "bosslar dikkat çekici olsun, 20. bölümdeki ultra güçlü"; arastirma/boss-analizi.md):
// altı komutanın kendi çizimi (varliklar/ham/nm_boss_A/B.jpg), %25 iri; her mekânın kendi komutanı; 17-19'da ikili generaller;
// 20. bölümde üç evreli General Gloriosus (nm_boss_C.jpg: aslanlı altın araba → yayan → Güneş Formu).
if (NECRO) {
  for (const t of ['centurion', 'champion', 'hierophant', 'shadowmaster', 'ironwarden', 'cavcaptain']) ENEMIES[t].h = Math.round(ENEMIES[t].h * 1.25);
  // kendi çizimi ve animasyonu hazır olanlar artık temel düşmanın renklendirilmiş kopyası değil (base kalkar)
  for (const t of ['centurion', 'champion', 'hierophant', 'shadowmaster', 'ironwarden', 'cavcaptain']) delete ENEMIES[t].base;
  // evreler: canı at oranına inince to türüne dönüşür (bossPhase, game.js); toplam can ilk evrenin canıdır
  const GL = ENEMIES.gloriosus;
  ENEMIES.gloriosus1 = Object.assign({}, GL, { name: 'General Gloriosus', title: 'Altın Güneş Arabası', h: 84, hp: 6000, hpK: 2.45, // komutan canı kademe × hpK: eski tek evreli Gloriosus'un 2,2 katı; 16 Eki: 2,64 → 2,45 (oyun alanı sıkışınca yol kısaldı, bot 4'te 2 kaybetti)
    speed: 11, r: 30, gold: 600, noblock: true, trample: { dmg: 45, r: 30, stun: 1 },
    desc: 'İki zırhlı aslanın çektiği altın arabasıyla gelir: askerler onu durduramaz, ezilip sersemler. Kulelere mancınık ateşi yağdırır. Araba kırılınca yayan, en sonunda güneşin gücüyle savaşır',
    ab: { bomb: { cd: 10, stun: 3, r: 240 }, howl: { cd: 12, r: 140 }, summon: { t: ['legion', 'heavy'], n: 3, cd: 12 } },
    phases: [
      { at: 0.55, to: 'gloriosus2', title: 'Araba parçalandı!', sub: 'Gloriosus yayan kaldı: muhafızlarını çağırıyor, kuleleri fermanla susturuyor', say: 'Muhafızlar!', mort: 'glor2' },
      { at: 0.25, to: 'gloriosus3', title: 'GÜNEŞ FORMU', sub: 'Güneşin gücü Gloriosus\'u sardı: hızlandı, kılıcı yakıyor', say: 'GÜNEŞ BENİMLE!', mort: 'glor3' }] });
  ENEMIES.gloriosus2 = Object.assign({}, GL, { name: 'General Gloriosus', title: 'Yayan', h: 62, hp: 6000, speed: 13, armor: 0.45, dmg: [34, 52], rate: 1.2, r: 22,
    desc: 'Arabası kırılınca öfkeyle yayan savaşır: kalkan açar, Pretoryen muhafız çağırır, İmparatorluk Fermanı ile üç kuleyi birden susturur',
    legion: [['heavy', 2], ['legion', 4]],
    ab: { shield: { cd: 14, t: 2.5 }, summon: { t: ['heavy', 'legion', 'gladiator'], n: 3, cd: 10 }, volley: { cd: 9, n: 5, dmg: 18, stun: 1, r: 170, say: 'Lejyon, Atış!' },
      hex: { cd: 13, t: 4, r: 260, n: 3, warn: 1.3, say: 'İmparatorluk Fermanı!', col: '255,200,90' } } });
  ENEMIES.gloriosus3 = Object.assign({}, GL, { name: 'General Gloriosus', title: 'Güneş Formu', h: 66, hp: 6000, speed: 19, armor: 0.3, mr: 0.45, dmg: [46, 66], rate: 0.9, r: 22, glow: '255,200,90',
    desc: 'Güneşin gücüyle alev zırha bürünür: hızlanır, kılıcı çevresini yakar. Kaleye ulaşırsa her şey biter',
    ab: { whirl: { cd: 6, r: 62, dmg: 42, say: 'Güneş Kılıcı!' }, burn: { cd: 8, r: 95, dps: 12, t: 4, say: 'Güneş Gazabı!' }, rage: { cd: 13, t: 3 } } });
  BOSS_ESCORT.gloriosus1 = BOSS_ESCORT.gloriosus;
  // imza hareketleri (AB tablosu sonra eklenir; bunlar onun yerine geçer)
  ENEMIES.hierophant.sig = { hex: { cd: 12, t: 4, r: 230, n: 1, warn: 1.3, say: 'Güneş Hükmü!', col: '255,215,120' } };
  ENEMIES.shadowmaster.sig = { blink: { cd: 9, d: 120, col: '170,90,255', say: 'Gölgeye Karış!' } };
  ENEMIES.ironwarden.sig = { guard: { cd: 13, t: 4, k: 0.15, vs: ['arrow', 'blast'], say: 'Kalkan Duvarı!' } };
  ENEMIES.hierophant.desc = 'Yakındakileri iyileştirir. Güneş Hükmü: bir kuleyi 4 sn susturur (önce kulenin üstünde altın halka belirir)';
  ENEMIES.shadowmaster.desc = 'Gölgeye karışıp yolun ilerisinde belirir, zehir bulutu saçar, suikastçı çağırır';
  ENEMIES.ironwarden.desc = 'Kalkan Duvarı: 4 sn ok ve top hasarının çoğunu karşılar (büyü ve askerler işler). Yeri döver, ağır piyade çağırır';
  // her mekânın kendi komutanı (bölüm 1-20); 17-19 ikili
  // 16 Eki (Caner: "bölümler tekrar etmesin"): aynı komutan iki bölüm üst üste gelmez; her bölgenin son bölümünde (4, 8, 12, 16, 20) o bölgenin büyük komutanı
  const B1 = ['centurion', 'champion', 'centurion', 'champion', 'hierophant', 'centurion', 'champion', 'hierophant', 'shadowmaster', 'hierophant',
    'champion', 'shadowmaster', 'cavcaptain', 'shadowmaster', 'ironwarden', 'cavcaptain', 'ironwarden', 'shadowmaster', 'cavcaptain', 'gloriosus1'];
  const B2 = { 16: 'hierophant', 17: 'champion', 18: 'ironwarden' };
  // 17 Eki (Caner: "her bölüm sonunda boss gelmesin, 4 bölümde bir mekân değişiyor, 4 bölümde bir gelsin"): boss yalnız mekân sonlarında
  // (4, 8, 12, 16, 20). Ara bölümlerin komutanları boşa gitmesin: mekân sonunda büyük bossun yanında ikinci general olarak gelir (BOSS_PAIR1).
  const BOSS_PAIR1 = { 7: 'centurion', 15: 'ironwarden' }; // ilk boss (4. bölüm) tek: yeni oyuncuya ikili general ağır geliyordu (bot kaybetti)
  LEVELS.filter(l => (l.ep || 1) === 1).forEach((l, i) => { delete l.boss2; if ((i + 1) % BOSS_EVERY) { l.bossT = null; l.noBoss = true; return; } l.bossT = B1[i]; if (BOSS_PAIR1[i]) l.boss2 = BOSS_PAIR1[i]; });
}
// 2. sefer bossları (12 Eki, Caner): engizisyonun kendi komutanları (varliklar/ham/nm_boss_D.jpg; haç yerine güneş amblemi),
// her mekânın kendi komutanı, 17-19 ikili; 20. bölüm üç evre: Yürüyen Katedral → çaydanlıklı Severus → Lanetli Severus (nm_boss_E.jpg).
if (NECRO) {
  const OFF = { boss: true, chief: true, rate: 1.1, r: 15 };
  Object.assign(ENEMIES, {
    hubertus: Object.assign({}, OFF, { name: 'Tazı Ustası Hubertus', h: 56, hp: 1000, speed: 16, armor: 0.2, mr: 0.1, gold: 120, dmg: [12, 20], lives: 5, hpK: 0.9,
      desc: 'Zincirli beyaz tazılarını salar: tazılar yolda iskeletlerin üstüne atılır. Avcı borusuyla sürüyü hızlandırır',
      ab: { summon: { t: 'hound', n: 3, cd: 11 }, howl: { cd: 13, r: 120 } } }),
    agnes: Object.assign({}, OFF, { name: 'Kırbaç Rahibesi Agnes', h: 56, hp: 1050, speed: 15, armor: 0.1, mr: 0.3, gold: 130, dmg: [14, 22], lives: 5, hpK: 0.95,
      desc: 'Zincir kırbacıyla çevresindeki bütün iskeletleri döver, çığlığıyla kırbaççıları coşturur (hızlanırlar), kırbaççı çağırır',
      ab: { whirl: { cd: 7, r: 52, dmg: 26, say: 'Kırbaç!' }, howl: { cd: 10, r: 140 }, summon: { t: 'flagellant', n: 2, cd: 13 } } }),
    lucia: Object.assign({}, OFF, { name: 'Şeytan Kovucu Lucia', h: 54, hp: 950, speed: 13, armor: 0.05, mr: 0.6, gold: 140, dmg: [10, 16], lives: 5, hpK: 0.9,
      desc: 'Şeytan Kovma: yakındaki dirilmiş ölüleri yok eder, oradaki cesetler artık diriltilemez. Yakındakileri iyileştirir',
      ab: { exorcise: { cd: 10, r: 150, n: 5, say: 'Şeytan Kovma!' }, heal: { cd: 9, amt: 60, r: 90 } } }),
    godfrey: Object.assign({}, OFF, { name: 'Tapınak Komutanı Godfrey', h: 58, hp: 1500, speed: 11, armor: 0.6, mr: 0.15, gold: 160, dmg: [20, 30], lives: 6, hpK: 1,
      desc: 'Kutsanmış Toprak: alevli kılıcını yere saplar, çevresindeki iskeletleri yakar. Yere vurup sersemletir, paladin çağırır',
      ab: { burn: { cd: 9, r: 75, dps: 12, t: 4, say: 'Kutsanmış Toprak!' }, slam: { cd: 8, r: 64, stun: 1.4, dmg: 30 }, summon: { t: 'paladin', n: 1, cd: 15, max: 5 } } }),
  });
  Object.assign(BOSS_ESCORT, { hubertus: [['hound', 2]], agnes: [['flagellant', 2]], lucia: [['holywater', 1], ['bellpriest', 1]], godfrey: [['paladin', 2]] });
  // final: Katedral (1. evre, kendi çizimi) → Severus (mevcut çizim, çaydanlıklı) → Lanetli Severus
  const CT = ENEMIES.cathedral;
  CT.hpK = +(CT.hpK * 2.2).toFixed(2);
  CT.desc = 'Tepesinde Büyük Engizitör Severus ile gelir. Katedral yıkılınca Severus çaydanlıkla iner, en sonunda çaydanlığın laneti onu ele geçirir';
  CT.phases = [
    { at: 0.55, to: 'severus', title: 'Katedral yıkıldı!', sub: 'Severus çaydanlığı kaldırıp iniyor: kulelere hüküm yağdırıyor', say: 'Çaydanlık benim!', mort: 'sev2' },
    { at: 0.25, to: 'severus3', title: 'LANETLİ SEVERUS', sub: 'Çaydanlığın laneti Severus\'u ele geçirdi: ölüm yeşili alev saçıyor', say: 'BU GÜÇ... BENİM!', mort: 'sev3' }];
  ENEMIES.severus.legion = [['paladin', 2], ['inquisitor', 1]];
  ENEMIES.severus3 = { name: 'Lanetli Severus', h: 58, hp: 2000, speed: 14, armor: 0.25, mr: 0.6, gold: 400, dmg: [26, 40], rate: 1, lives: 20, r: 16, boss: true, chief: true, hpK: 1.1, final: true, glow: '120,255,140', float: true,
    desc: 'Çaydanlığın laneti onu ele geçirdi: iskeletlerden can emer, yeşil veba alevi saçar, öfkelenince yarı hasar alır. Kaleye ulaşırsa her şey biter',
    ab: { drain: { cd: 7, r: 95, dmg: 18 }, burn: { cd: 8, r: 100, dps: 12, t: 4, poison: true, say: 'Lanetli Çay!' }, rage: { cd: 13, t: 3 } } };
  for (const t of ['hubertus', 'agnes', 'lucia', 'godfrey', 'severus3']) CLASS_OF_EXTRA[t] = t === 'godfrey' ? 'agir' : t === 'hubertus' ? 'hafif' : 'kutsal';
  // her mekânın kendi komutanı (2. sefer bölüm 1-20); 17-19 ikili
  // 16 Eki: üst üste aynı komutan yok; bölge sonları (4, 8, 12, 16, 20) büyük bosslar (Malleus, Campanus, Ignis, Colossus, Katedral)
  const B2 = ['hubertus', 'agnes', 'hubertus', 'malleus', 'agnes', 'hubertus', 'lucia', 'campanus', 'lucia', 'agnes', 'godfrey', 'ignis',
    'godfrey', 'lucia', 'agnes', 'colossus', 'godfrey', 'malleus', 'campanus', 'cathedral'];
  const B2b = { 16: 'lucia', 17: 'agnes', 18: 'ignis' };
  const BOSS_PAIR2 = { 3: 'hubertus', 7: 'agnes', 11: 'lucia', 15: 'godfrey' }; // 17 Eki: ara bölüm komutanları mekân sonunda ikinci general
  LEVELS.filter(l => l.ep === 2).forEach((l, i) => { delete l.boss2; if ((i + 1) % BOSS_EVERY) { l.bossT = null; l.noBoss = true; return; } l.bossT = B2[i]; if (BOSS_PAIR2[i]) l.boss2 = BOSS_PAIR2[i]; });
}
LEVELS.forEach((lv, i) => {
  const w = lv.waves[lv.waves.length - 1];
  const end = Math.max(...w.map(g => (g.at || 0) + g.gap * (g.n - 1)));
  // boss gelmeyen bölüm: son dalganın sonunda kristal ve eşya taşıyan Yüzbaşı (boss değil: ağır çekim, boss müziği yok; ödülü boss ödülüyle aynı)
  if (lv.noBoss) { lv.boss = null; w.push({ t: 'legion_y', n: 1, gap: 1, at: Math.round(end + 6), p: 0, loot: true }); return; }
  lv.boss = lv.bossT || LEVEL_BOSS[i];
  w.push({ t: lv.boss, n: 1, gap: 1, at: Math.round(end + 6), p: 0, hpK: lv.boss2 ? 0.75 : undefined });
  if (lv.boss2) w.push({ t: lv.boss2, n: 1, gap: 1, at: Math.round(end + 10), p: (lv.entr || 1) > 1 ? 1 : 0, hpK: 0.75 }); // ikili generaller: ikisi de biraz zayıf
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
const ENEMY_NOTE = {}; // özel saldırı notu (açıklamanın ikinci cümlesi; enemyDesc birleştirir)
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
  // 'spells' (Güçler) satırı 11 Eki'de Büyü Kitabı'na taşındı (GRIM); yıldızları kendiliğinden geri döner
  { id: 'castle',   name: 'Kale',      ranks: [{ cost: 2, desc: '+3 can' }, { cost: 3, desc: '+60 altın' }, { cost: 5, desc: '+3 can, +60 altın' }] },
];
// Oyun tek, sabit zorlukta oynanır
// gold: başlangıç altını çarpanı, bounty: düşman ödülü ve erken çağrı bonusu çarpanı (kazanç)
const GAME_DIFF = { hp: 1.323, // 11 Eki (Caner: oyun çok kolay): düşman ve boss canı +%20 (önce +%30 denendi, fazla geldi); 14 Eki: +%5 daha (1,2 → 1,26); 15 Eki (Caner: "oyun kolay, skil kullanmaya gerek kalmıyor"): +%5 daha (1,323)
  gold: 1, bounty: 0.8, lives: 20 }; // tek kahramana geçince düşman canı 1.15'ten 1.0'a indi

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
  corpse: { name: 'Gülle Yağmuru',    cost: 250, cd: 11, desc: '3 küçük kemik gülle fırlatır, her biri çevresine de vurur' },
  plague: { name: 'Veba Sisi',        cost: 230, cd: 10, desc: 'Kalabalığın üstüne veba sisi çöker: 5 sn güçlü zehir' },
  rite:   { name: 'Kan Ayini',        cost: 220, cd: 14, desc: 'Menzildeki iskeletler %40 iyileşir, 6 sn %50 sert vurur' },
  blight: { name: 'Çürük Dokunuş',    cost: 240, cd: 9,  desc: 'Menzildeki herkes 5 sn ağır lanetlenir ve zehirlenir' },
};
const SPEC = {
  fan:    { title: 'Ağır Arbaletçiler', who: 'İki kızıl arbaletçi: yavaş, ağır, zırh delen cıvata' }, // 11 Eki: okçu / arbaletçi yolu
  bow:    { title: 'Hayalet Okçular', who: 'Üç kızıl okçu: çok sık, yüksek kavisli oklar' },
  drain:  { title: 'Ruh Emici', who: 'Kristalden ışın: aynı hedefe güçlenir, canı iskeletlere aktarır' }, // 10 Eki: 4. kademe
  ghost:  { title: 'Ruh Kafesi', who: 'En güçlüyü kafese kapatır, kafesten hayaletler salar' },
  corpse: { title: 'Kemik Gülle Mancınığı', who: 'Veba dolu kemik gülleler atan kazan' },
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
  catapult: { blast: 1.3, melee: 1.2 }, cannon: { blast: 1.3, melee: 1.2 },
  wardog: { blast: 1.4, melee: 1.2 }, chariot: { magic: 1.3, melee: 0.6 }, siegetower: { blast: 1.3, arrow: 0.5 }, eagle: { arrow: 1.4, magic: 1.1 }, vulture: { arrow: 1.4, magic: 1.1 }, elephant: { magic: 1.3, arrow: 0.7, melee: 0.8 },
  horsearcher: { arrow: 1.2, magic: 1.2 }, testudo: { arrow: 0.3, blast: 1.8, magic: 1.1 }, sunpriest: { arrow: 1.3, melee: 1.2 },
  signifer: { magic: 1.2, melee: 1.2 }, drummer: { arrow: 1.2, blast: 1.2 }, centurion: { magic: 1.2 }, champion: { arrow: 1.2 }, shadowmaster: { blast: 1.3 }, cavcaptain: { blast: 1.2 },
  gloriosus: { magic: 0.85, arrow: 0.85, blast: 1.1 }, gloriosus1: { magic: 0.85, arrow: 0.85, blast: 1.1 }, gloriosus2: { magic: 0.85, arrow: 0.85, blast: 1.1 }, gloriosus3: { magic: 0.85, arrow: 0.85, blast: 1.1 },
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
  ram: 'Yol kenarındaki kulelere durup vurur, yıkabilir; sonra kapıya yürür. Önce onu durdur',
  catapult: 'Durup kulelerimize taş atar, 3 sn susturur. Önce onu durdur',
  cannon: 'İki lejyoner iter; durup kulelerimize gülle atar, 2,5 sn susturur. Önce onu durdur',
  wardog: 'Sürüyle gelir, çok hızlıdır ama canı azdır. Veba kazanı sürüyü dağıtır',
  chariot: 'Çok hızlı; iskeletleri ezip geçer, sürerken mızrakla vurur. Durduramazlar, kemik duvar durdurur',
  siegetower: 'Tepesinden 4 okçu ok yağdırır; yıkılınca içinden 15 asker dökülür. Yolun başında yık',
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
  for (const t in ALT) { const { note, ...a } = ALT[t]; ENEMIES[t].alt = a; if (ENEMY_DESC[t]) ENEMY_NOTE[t] = note; } // not ayrı: çeviri cümle cümle bulunsun (12 Eki)
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
  for (const t in ENEMIES) if (ENEMIES[t].sig) { const ab = ENEMIES[t].ab; if (t === 'hierophant') { delete ab.smite; delete ab.shield; } if (t === 'shadowmaster') delete ab.pounce; if (t === 'ironwarden') delete ab.rage; Object.assign(ab, ENEMIES[t].sig); }
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
    name: 'Lanet Kulesi', icon: 'altar', dmgType: 'none', air: false, support: true, unlockLevel: 3, /* 13 Eki: 3. bölüm komutan ve büyülere ayrıldı */ unique: true,
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
      // Kan Ayini (11 Eki, Caner: "kırmızı versiyon drain life ile uyumlu"): drain sn başına her düşmandan çekilen can, heal: emilenin iskeletlere giden oranı
      // 16 Eki (Caner): Kan Sülüğü: düşmandan can çalar, iskeletlere verir; menzildeki iskeletlerin canı sürekli yenilenir (regen: saniyede azami canın payı)
      { id: 'rite', name: 'Kan Sülüğü', desc: (r) => `Kule Kan Sülüğüne dönüşür: her düşmandan saniyede ${r.drain} can çeker, iskeletlere verir · Menzildeki iskeletlerin canı saniyede %${Math.round(r.regen * 100)} yenilenir · Menzildeki kulelere +%${Math.round(r.rate * 100)} atış hızı ve +%${Math.round(r.dmg * 100)} hasar`,
        ranks: [{ cost: 150, rate: 0.15, dmg: 0.1, drain: 5, heal: 0.6, regen: 0.02 }, { cost: 200, rate: 0.25, dmg: 0.18, drain: 8, heal: 0.6, regen: 0.03 }, { cost: 260, rate: 0.35, dmg: 0.25, drain: 12, heal: 0.6, regen: 0.045 }] },
      // 16 Eki (Caner): Kara Lanet: daha güçlü lanetler, düşmanı her alanda zayıflatır (boost: bütün lanet etkileri bu kadar güçlü)
      { id: 'blight', name: 'Kara Lanet', desc: (r) => `Kule Kara Lanet Mabedine dönüşür: bütün lanetler %${Math.round(r.boost * 100)} daha güçlü (hasar, savunma, yavaşlatma, korku) · Lanetli ölünce lanet en yakın ${r.n} düşmana sıçrar · ölenlerin kalkma şansı +%10`,
        ranks: [{ cost: 140, n: 2, boost: 0.35 }, { cost: 190, n: 3, boost: 0.5 }, { cost: 240, n: 4, boost: 0.7 }] },
    ],
  };
  TOWER_ORDER.push('altar');
  Object.assign(SPEC, { rite: { title: 'Kan Sülüğü Mabedi', who: 'Düşmandan can çalıp iskeletleri sürekli yenileyen kan sülüğü' }, blight: { title: 'Kara Lanet Mabedi', who: 'Düşmanı her alanda zayıflatan güçlü lanetler' } }); // 16 Eki (Caner): Lanet Kulesi yeniden
}

// necro teması: yıldız gelişmeleri ve hasar türü adları (eski kule/kale adlarının yerine)
if (NECRO) {
  const U = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
  U.archer.name = 'Kemik Kuleleri'; U.barracks.name = 'Mahzenler'; U.mage.name = 'Ruh Fenerleri'; U.artillery.name = 'Veba Kazanları';
  U.barracks.ranks[0].desc = '+%20 iskelet canı'; U.barracks.ranks[1].desc = '+%20 iskelet hasarı';
  U.artillery.ranks[1].desc = '+%15 veba alanı';
  // Büyüler satırı 11 Eki'de Büyü Kitabı'na taşındı (GRIM)
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
  heavy: 'agir', paladin: 'agir', ironwarden: 'agir', gloriosus: 'agir', gloriosus1: 'agir', gloriosus2: 'agir', gloriosus3: 'agir', cavcaptain: 'agir',
  priest: 'kutsal', sunpriest: 'kutsal', holywater: 'kutsal', bellpriest: 'kutsal', inquisitor: 'kutsal', saint: 'kutsal',
  hierophant: 'kutsal', ignis: 'kutsal', severus: 'kutsal', campanus: 'kutsal', colossus: 'kutsal',
  ram: 'kusatma', catapult: 'kusatma', cannon: 'kusatma', siegetower: 'kusatma', lantern: 'kusatma', chariot: 'kusatma', cathedral: 'kusatma',
  cavalry: 'canavar', horsearcher: 'canavar', elephant: 'canavar', eagle: 'canavar', vulture: 'canavar',
};Object.assign(CLASS_OF, CLASS_OF_EXTRA);

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
  ENEMIES.legion_k.desc = 'Her dört lejyonerin kıdemlisi: önde yürür, komut verir. Çevresindeki lejyonerler %15 sert vurur ve %15 az hasar alır. Ok gelince "Kalkanlar!" der: kalkanlılar 3 sn kalkan duvarı kurar, oklar %50-80 az işler ya da seker, ama yavaş yürürler. O ölünce bu avantajlar kaybolur'; // 17 Eki: bölük komutanı (game.js CAPTAIN)
  ENEMIES.heavy_y.hp = Math.round(ENEMIES.heavy_y.hp * 0.7); // 16 Eki (Caner): Ağır Piyade Yüzbaşı %30 daha az canlı
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

// Boss kristali (12 Eki, Caner): yalnız bosslardan düşer, satılmaz (parayla güç yok). Kilitli komutanları ve tek kullanımlık
// savaş eşyalarını açar. Komutan: final sefer sonu bossu; heroic/usta çarpanı.
const CRYSTAL = { boss: 2, final: 8, heroic: 2, usta: 1.5 };
// 16 Eki (Caner: "bölüm bitince kalan altının anlamı olmuyor"; araştırma: PvZ kalan savunma bonusu + BTD6 tekrar oynamada %20): Mortimer'ın Kasası.
// Zaferde kalan altın Ruh Kristali'ne döner: per altın = 1 kristal, bölüm başına en çok cap; boss'tan düşüp harcanmayan altın boss kat sayılır;
// bölüm (o modda) daha önce kazanıldıysa replay oranı. Günün Sınavı ve Sonsuz Gece'de yok.
const VAULT = { per: 200, cap: 3, replay: 0.2, boss: 2, keep: 400 }; // keep: kasada biriken en çok altın (16 Eki: birikim) // 150/5 kristal ekonomisini 2-3 katlıyordu (boss 2, komutan 60): 40 bölümde en çok 120
// 16 Eki (Caner: "bana özel bir bölüm, 2 dalga oynayınca bitsin, son güncellemeleri orada denerim; yayında kaldırırız"): Deneme Alanı.
// Haritada yalnız TEST_OPEN açıkken görünür (game.js chal 'a'); ilerleme, yıldız, başarım ve kristal kaydedilmez.
const ADMIN_TEST = { level: 'Kara Göl Geçidi', gold: 1500, lives: 20, waves: [
  [{ t: 'legion', n: 10, gap: 0.7 }, { t: 'holywater', n: 3, gap: 1.8, at: 4 }, { t: 'heavy', n: 3, gap: 2, at: 8 },
   { t: 'lantern', n: 1, gap: 1, at: 12 }, { t: 'flagellant', n: 2, gap: 1.2, at: 12.5 }, { t: 'torch', n: 2, gap: 1.4, at: 13 }],
  [{ t: 'heavy_y', n: 2, gap: 3, at: 0 }, { t: 'legion_y', n: 1, gap: 1, at: 2 }, { t: 'hound', n: 6, gap: 0.6, at: 3 },
   { t: 'cavalry', n: 3, gap: 1.4, at: 6 }, { t: 'lantern', n: 1, gap: 1, at: 9 }, { t: 'legion', n: 8, gap: 0.6, at: 10 }, { t: 'centurion', n: 1, gap: 1, at: 15 }],
] };
for (const t of ['gloriosus3', 'cathedral']) if (ENEMIES[t]) ENEMIES[t].final = true;
Object.assign(HEROES.spartacus, { cost: 0, unlock: null }); // 14 Eki: başlangıç komutanı (ücretsiz) // komutan kristalle açılır (eski unlock bölümü yerine)
Object.assign(HEROES.leonidas, { cost: 30 });
// tek kullanımlık savaş eşyaları: dükkânda kristalle alınır, savaşta sağ alttaki çantadan kullanılır (KR'deki eşyalar gibi)
const ITEMS = {
  bomb:   { name: 'Kemik Bombası',    cost: 3, desc: 'Seçtiğin yerde patlar, ağır alan hasarı', target: true, r: 85, dmg: 320 },
  freeze: { name: 'Zaman Kum Saati',  cost: 4, desc: 'Bütün düşmanlar 5 sn donar', t: 5 },
  tea:    { name: "Mortimer'ın Çayı", cost: 3, desc: '+5 can, bütün iskeletler ve komutan iyileşir', lives: 5 },
  purse:  { name: 'Lanetli Kese',     cost: 2, desc: 'Hemen +250 altın', gold: 250 },
};
const ITEM_ORDER = ['bomb', 'freeze', 'tea', 'purse'];
// 15 Eki (Caner): günlük giriş hediyesi. 7 günlük döngü; bir gün kaçırılırsa seri sıfırlanmaz, kaldığı yerden sürer.
// c: kristal, item: savaş eşyası (ITEMS). Haftada ~8 kristal + 4 eşya (komutanlar 15/30 kristal: bossların payını ezmesin).
// 14 Eki (Caner): komutan eşyaları. Bosslar düşürür (save.gear), Komutanlar ekranındaki EŞYALAR panosunda komutanın üstüne takılır
// (save.equip[komutan][yuva] = eşya no). 4 yuva; silah komutana özeldir (Spartaküs kılıç, Leonidas mızrak, Merlin asa, Robin ok, Báthory hançer).
// Nadirlik 0..3; değerler game.js heroStats'ta uygulanır. Eşya {id, s: yuva, k: silah türü, r: nadirlik}.
const EQUIP = {
  slots: ['weapon', 'armor', 'ring', 'amulet'],
  slotName: { weapon: 'SİLAH', armor: 'ZIRH', ring: 'YÜZÜK', amulet: 'TILSIM' },
  rar: [
    { name: 'Sıradan',  col: '#e2dccd', rgb: '226,220,205', w: 50, melt: 1 },
    { name: 'Nadir',    col: '#5cb4ff', rgb: '92,180,255',  w: 32, melt: 2 },
    { name: 'Destansı', col: '#c77dff', rgb: '199,125,255', w: 14, melt: 4 },
    { name: 'Efsanevi', col: '#ffa834', rgb: '255,168,52',  w: 4,  melt: 8 },
  ],
  // nadirliğe göre: silah hasar, zırh can + zırh, yüzük güç bekleme süresi (-), tılsım saldırı hızı + can yenileme
  stat: { weapon: { dmg: [0.08, 0.15, 0.24, 0.35] }, armor: { hp: [0.1, 0.18, 0.28, 0.4], armor: [0.02, 0.04, 0.07, 0.1] },
    ring: { cd: [0.05, 0.09, 0.14, 0.2] }, amulet: { spd: [0.05, 0.09, 0.14, 0.2], regen: [0.2, 0.35, 0.55, 0.8] } },
  wpn: { spartacus: 'sword', leonidas: 'spear', merlin: 'staff', robin: 'arrow', bathory: 'dagger' },
  // 16 Eki (Caner): eşyalar komutanın sınıfına göre; düşen eşya doğrudan savaştaki komutanın çantasına gider (eşya.h = sahibi, eşya.c = sınıf)
  cls: { spartacus: 'warrior', leonidas: 'warrior', merlin: 'mage', bathory: 'bloodmage', robin: 'ranger' },
  clsName: { warrior: 'Savaşçı', mage: 'Büyücü', bloodmage: 'Kan Büyücüsü', ranger: 'Suikastçı Okçu' },
  clsNames: { // savaşçı names'teki zırh/yüzük/tılsımı kullanır
    mage: { armor: ['Keten Cübbe', 'Yıldızlı Cübbe', 'Fırtına Cübbesi', 'Avalon Cübbesi'], ring: ['Bakır Mühür', 'Ay Taşı Yüzüğü', 'Rün Yüzüğü', "Merlin'in Mührü"],
      amulet: ['Baykuş Tüyü', 'Kristal Kolye', 'Ejder Gözü', 'Avalon Tılsımı'] },
    bloodmage: { armor: ['Kadife Elbise', 'Kan Korsesi', 'Gece Pelerini', 'Csejte Elbisesi'], ring: ['Yakut Yüzük', 'Kan Damlası Yüzüğü', 'Yarasa Yüzüğü', 'Kontesin Mührü'],
      amulet: ['Kemik Broş', 'Kan Kolyesi', 'Yarasa Tılsımı', 'Kızıl Ay Kolyesi'] },
    ranger: { armor: ['Deri Yelek', 'Yeşil Pelerin', 'Gölge Pelerini', 'Sherwood Pelerini'], ring: ['Okçu Yüzüğü', 'Kurt Pençesi Yüzüğü', 'Avcı Mührü', 'Sherwood Yüzüğü'],
      amulet: ['Tüy Tılsım', 'Kurt Dişi Kolye', 'Gölge Tılsımı', 'Orman Ruhu Tılsımı'] },
  },
  names: {
    sword: ['Paslı Gladius', 'Arena Kılıcı', 'Zincirkıran', 'Özgürlüğün Kılıcı'],
    spear: ['Bronz Mızrak', 'Sparta Mızrağı', 'Falanks Dişi', 'Termopylai Mızrağı'],
    staff: ['Meşe Asa', 'Kristal Asa', 'Fırtına Asası', 'Avalon Asası'],
    arrow: ['Kaz Tüylü Oklar', 'Kemik Uçlu Oklar', 'Gölge Okları', 'Sherwood Okları'],
    dagger: ['Gümüş Hançer', 'Kan Hançeri', 'Kontesin Dişi', 'Csejte Hançeri'],
    armor: ['Deri Zırh', 'Zincir Zırh', 'Kemik Zırh', 'Ejder Pulu Zırh'],
    ring: ['Bakır Yüzük', 'Gümüş Yüzük', 'Ruh Yüzüğü', "Mortimer'ın Mührü"],
    amulet: ['Kemik Tılsım', 'Kurt Dişi Tılsım', 'Ay Tılsımı', 'Kara Ay Tılsımı'],
  },
  drop: { boss: 1, final: 2, heroic: 1 }, // boss başına eşya; Kahramanlık meydan okumasında +1
  luck: { final: 1, usta: 1, heroic: 1 }, // nadirlik zarı bu kadar kez atılır, en iyisi alınır
  bag: 40, // komutan başına envanter sınırı (16 Eki): dolunca o komutanın en düşük nadirlikteki takılı olmayan eşyası kristale erir
};
const DAILY_LOGIN = [{ c: 1 }, { item: 'purse' }, { c: 1 }, { item: 'freeze' }, { c: 2 }, { item: 'tea' }, { c: 4, item: 'bomb' }];
// 15 Eki (Caner): sefer haritaları dikey: yol alttan girer, kıvrıla kıvrıla yukarı çıkar, Mortimer'ın şapeli en üstte; ilerleyen bölümler yukarıda.
// Her mekân 960x540'lık bir dilim, alttan üste dizilir (zones[0] en altta). game.js drawRegionMap / regionBg (E.vert) bu düzeni kullanır.
const MAP_V = { h: 540, x: 480, amp: 150, top: 250, bot: 110, jit: 36, step: 250, ax: 0.5 }; // 13 Eki (Caner): bölümler %50 sık: mekânlar 250 aralıkla üst üste biner (dilim yine 540), kıvrım yarı genişlikte
function vertEpisode(E, ph, flip) {
  const n = E.nodes.length, MH = (E.zones.length - 1) * MAP_V.step + MAP_V.h, ax = MAP_V.ax;
  let s = Math.round(ph * 1000) + 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  E.vert = true; E.mapH = MH;
  E.nodes = Array.from({ length: n }, (_, k) => {
    // doğal kıvrım (Caner: hep aynı zikzak olmasın): iki farklı dalganın toplamı + küçük sapma; bazen aynı yana birkaç bölüm sürer
    const t = k / (n - 1), y = MH - MAP_V.bot - t * (MH - MAP_V.bot - MAP_V.top) + (r() - 0.5) * 50 * ax;
    const x = MAP_V.x + flip * ax * (105 * Math.sin(0.62 * k + ph) + 48 * Math.sin(1.47 * k + 2.3 * ph)) + (r() - 0.5) * 40 * ax;
    return [Math.round(Math.max(300, Math.min(660, x))), Math.round(y)];
  });
  E.start = [MAP_V.x + flip * 40, MH + 70]; E.end = [MAP_V.x, 150];
}
if (typeof NECRO !== 'undefined' && NECRO && EPISODES.length) { vertEpisode(EPISODES[0], 0.4, 1); if (EPISODES[1]) vertEpisode(EPISODES[1], 1.9, -1); }
// 16 Eki (Caner: "sefer haritası tek parça olsun, 20. bölümden sonra şapel görünmesin, direkt 21'e geçsin"): son sefer dışında yol şapelde bitmez,
// haritanın üst kenarından çıkıp sonraki seferin girişine bağlanır (sonraki sefer üstte; dünyada 1700 yukarıda: ext.h). Şapel yalnız en sonda.
if (typeof NECRO !== 'undefined' && NECRO) for (let i = 0; i < EPISODES.length - 1; i++) { const A = EPISODES[i], B = EPISODES[i + 1];
  if (A.vert && B.vert) { A.through = true; A.end = [B.start[0], B.start[1] - (A.mapH + 160)]; } }
// 15 Eki (Caner): kulelerin menzili ortalama %5 daraldı (bütün kademeler)
const TOWER_RANGE_K = 0.95;
for (const T of Object.values(TOWERS)) for (const L of T.levels || []) if (L.range) L.range = Math.round(L.range * TOWER_RANGE_K);
// 15 Eki (Caner): bütün yeteneklerin bekleme süresi %10 uzun (komutan yetenekleri, komutan güçleri, Mortimer'ın büyüleri)
const SKILL_CD_K = 1.1;
{ const up = (o) => { if (o && o.cd) o.cd = Math.round(o.cd * SKILL_CD_K * 10) / 10; };
  for (const H of Object.values(HEROES)) for (const P of H.paths || []) for (const sk of P.skills || []) up(sk);
  for (const T of [HERO_ULT, HERO_ULT2, NECRO_SPELLS]) for (const k in T) up(T[k]);
  for (const k in HERO_SKILLS) { const v = HERO_SKILLS[k]; if (Array.isArray(v)) v.forEach(up); else up(v); } }
// ----- Denge turu (16 Eki, Caner: "2 gelişmiş kule + birkaç mahzenle rahat geçiyorum; en güçlü/güçsüz kuleleri bul, denge kur") -----
// tools/denge-deney.js ile 10 strateji × 16 bölüm (iki sefer): "2 Ruh Feneri + mahzen" 16/16 ve ort. 17 canla geçiyordu (en güçlü),
// Veba Kazanı tek başına 8/16 (en zayıf hasar kulesi; karışık oyunda öldürmelerin %1'i), karışık oyunda bölüm sonunda ort. 2650 altın artıyordu.
// BAL.tower: kule hasar çarpanı (tüm kademeler), BAL.hp: düşman canı çarpanı, BAL.bounty: düşman ödülü ve erken çağrı bonusu çarpanı.
const BAL = { tower: { mage: 0.85, artillery: 1.5, archer: 0.9 }, hp: 1.25, bounty: 0.875, hero: { bathory: 0.95 }, heroCd: { merlin: 1.15, bathory: 1.15 } }; // 6. tur: Zaman Kapısı zayıfladı (game.js MERLIN_GATE), Merlin beklemesi 1,3 → 1,15; // 5. tur: Merlin'in gücü yeteneklerinde (Zaman Kapısı kalabalığı geri atar, Kurbağa): saldırı kesintisi geri, yetenek beklemesi %30 uzun; Báthory saldırı %5, yetenek beklemesi %15
for (const t in BAL.tower) for (const L of TOWERS[t].levels) if (L.dmg) L.dmg = L.dmg.map(v => Math.round(v * BAL.tower[t]));
GAME_DIFF.hp *= BAL.hp; GAME_DIFF.bounty *= BAL.bounty;
for (const h in BAL.hero) if (HEROES[h] && HEROES[h].dmg) HEROES[h].dmg = HEROES[h].dmg.map(v => Math.round(v * BAL.hero[h]));
for (const h in BAL.heroCd) for (const P of (HEROES[h] && HEROES[h].paths) || []) for (const sk of P.skills || []) if (sk.cd) sk.cd = Math.round(sk.cd * BAL.heroCd[h] * 10) / 10;
// 16 Eki (7. tur): 40 bölüm × 3 yapılandırma tam test (karışık+Spartaküs, karışık+Merlin, 2 Ruh Feneri+mahzen+Merlin). Üçünün de tam canla geçtiği
// bölümlerde can artar, karışık oyunun kaybettiklerinde azalır (BAL.lvl: bölüm sırası → can çarpanı). Kuzgun Tepesi (1): ödül kesintisinden sonra
// bot 2-3 kule kurabiliyordu, üç yapılandırma da kaybetti: can %20 az, +60 başlangıç altını.
BAL.lvl = { 1: 0.8, 2: 1.25, 3: 1.2, 5: 1.15, 7: 1.2, 8: 1.05, 10: 1.05, 11: 0.9, 12: 1.25, 13: 0.92, 14: 1.2, 16: 1.2, 17: 0.92, 18: 1.25,
  20: 1.15, 24: 1.1, 26: 1.25, 27: 1.05, 28: 1.05, 30: 1.15, 31: 0.95, 32: 0.9 };
for (const i in BAL.lvl) if (LEVELS[i]) LEVELS[i].hpMul = (LEVELS[i].hpMul || 1) * BAL.lvl[i];
if (LEVELS[1]) LEVELS[1].gold += 60;
// 8. tur: bölüm canı "2 Ruh Feneri + mahzen" stratejisini etkilemedi (hâlâ ort. 16 can): asıl güç mahzenlerin düşmanı kapıda tutması.
// Mahzen iskeletlerinin canı %20 az (BAL.barracksHp); Tabut Duvarı emişi %80 → %60 (game.js ELITE_SK.shield.red)
// 16 Eki: aynı tür kule fazlalığı pahalanır (game.js stackK): ilk 2 normal, sonra her biri +%15, en çok 2 kat (mahzen yığmayı frenler)
const TOWER_STACK = { free: 2, k: 0.15, max: 2 };
// 14. tur (16 Eki, fiyat artışıyla): altını tam harcayan "2 Ruh Feneri + mahzen" (Caner'in tarzı) 1. seferin 10-20. bölümlerini hâlâ 20/20 canla geçiyordu
// (karışık bot altın biriktirdiği için kaybediyor; ölçüt gerçek oyuncu). Bu bölümler güçlenir (14 ve 18 karışıkta da kayıp: az). 2. seferde fiyat artışından
// sonra birden çok stratejinin kaybettiği bölümler biraz kolaylaşır.
// 15. tur: asıl neden tam kademe Ruh Feneri çıktı: 14., 18. ve 20. bölümde 2 tam Ruh Feneri tek başına 20/20 (4700-8300 altın artıyor), aynı yerde
// 2 tam Kemik Kulesi ve karışık oyun kaybediyor. Can artışı o üç bölümden kalktı; tam kademe Ruh Feneri kırpıldı (3. kademe hasarı ×0,88,
// game.js mage_drain rampMax 0,6 → 0,4, mage_ghost kafes 8 sn → 10 sn ve 2,2 → 1,8 sn).
// 16-17. tur: Ruh Feneri kırpması ve +%28 can odaklı oyunu değiştirmedi (yine 20/20, binlerce altın artıyor), yalnız karışık oyunu düşürdü: ölçülü değerde kaldı.
// Odaklı ve altını tam harcayan oyuncu için zorluk: Usta (DIFFS, can ×1,4).
BAL.lvl3 = { 9: 1.1, 10: 1.1, 11: 1.05, 12: 1.15, 14: 1.15, 15: 1.15, 16: 1.1, 18: 1.15, 24: 0.92, 29: 0.92, 30: 0.92, 31: 0.92, 33: 0.92 };
TOWERS.mage.levels[2].dmg = TOWERS.mage.levels[2].dmg.map(v => Math.round(v * 0.88));
// 16 Eki (Caner): Ruh Feneri yeniden. 1-2. kademe tek saldırı: ruh hırsızları uçar, düşmanın ruhunu emer (büyü hasarı, yavaşlatır), ruh küresini
// fenere taşır; ruhlar fenerde birikir. 3. kademede ikinci saldırı: biriken ruhlarla şimşek (eski ruh ışını görünümünde) (çarpılan 1 sn röntgen iskelet olur).
// Uzmanlık: Ruh Emici +1 hırsız/kademe ve emilen can iskeletlere; Ruh Kafesi şimşeği 1/2/3 düşmana sıçratır. Mantık game.js updateSoulLamp.
// 16 Eki (Caner: "hayaletlerin ruh çalması saçma, eski haline al, sonra baştan yapacağız"): on: false, kule eski ruh ışınıyla saldırır
const SOUL_LAMP = { on: false, thieves: [1, 2, 2], speed: 140, drainT: 0.75, slow: 0.3, share3: 0.55, cap: 10,
  zap: { cost: 2, cd: 1.4, dmgK: 0.95, jumpR: 75, jumpK: 0.7, xray: 0.9 } };
if (SOUL_LAMP.on) { Object.assign(TOWERS.mage, { desc: 'Ruh hırsızları düşmanın ruhunu emer: zırhı deler, yavaşlatır · 3. kademede biriken ruhlarla şimşek çarpar' });
TOWERS.mage.levels[0].perk = 'Ruh hırsızı: düşmanın ruhunu emer, büyü hasarı zırhı deler';
TOWERS.mage.levels[1].perk = 'İki ruh hırsızı · emilen düşman %30 yavaşlar';
TOWERS.mage.levels[2].perk = 'Biriken ruhlarla ruh şimşeği: çarpılan düşmanın iskeleti görünür'; }
if (SOUL_LAMP.on) { const A = TOWERS.mage.abilities, dr = A.find(a => a.id === 'drain'), gh = A.find(a => a.id === 'ghost');
  if (dr) dr.desc = (r) => `Kule Ruh Emiciye dönüşür: +${dr.ranks.indexOf(r) + 1} ruh hırsızı · emilen canın %${Math.round(r.heal * 100)}'i yakındaki iskeletleri iyileştirir`;
  if (gh) { gh.ranks.forEach((r, i) => { r.jumps = i + 1; });
    gh.desc = (r) => `Kule Ruh Kafesine dönüşür: şimşek ${r.jumps} düşmana daha sıçrar · 8 sn'de bir en güçlü düşmanı 2 sn kafese kapatır · ${r.cd} sn'de bir hayalet salar: ${r.dmg} hasar, ${r.fear} sn korku`; } }
BAL.barracksHp = 0.9; // 9. tur: 0,8 güçlü stratejiyi etkilemedi, karışık oyunu zayıflattı
for (const L of TOWERS.barracks.levels) L.hp = Math.round(L.hp * BAL.barracksHp);
// 9. tur: tam testte her stratejiyle (Merlin'li karışık dahil) tam canla geçilen bölümler: eski can çarpanları zayıf bota göre çok düşük kalmış
BAL.lvl2 = { 2: 1.5, 3: 1.4, 4: 1.2, 5: 1.1, 6: 1.2, 7: 1.4, 10: 1.1, 12: 1.1, 14: 1.05, 16: 1.3, 18: 1.6, 21: 1.1, 24: 1.3, 25: 1.05, 26: 1.5, 27: 1.2, 29: 1.2, 31: 1.1, 33: 1.3 };
for (const i in BAL.lvl2) if (LEVELS[i]) LEVELS[i].hpMul = (LEVELS[i].hpMul || 1) * BAL.lvl2[i];
for (const i in BAL.lvl3) if (LEVELS[i]) LEVELS[i].hpMul = (LEVELS[i].hpMul || 1) * BAL.lvl3[i];
// 10. tur: Spartaküs (ücretsiz başlangıç komutanı) karışık oyunda 40'ta 20 kazanıyor, ort. 5,5 can (Merlin 35/40, 11,7): güçlenir
BAL.spartacus = { dmg: 1.35, hp: 1.3, cd: 0.85, ult: 1.4 }; // 11. tur: 1,2/1,15/1,2 ile 22/40, ort. 7 can (yetmedi)
{ const S = HEROES.spartacus, B = BAL.spartacus; S.dmg = S.dmg.map(v => Math.round(v * B.dmg)); S.hp = Math.round(S.hp * B.hp);
  for (const P of S.paths || []) for (const sk of P.skills || []) if (sk.cd) sk.cd = Math.round(sk.cd * B.cd * 10) / 10;
  const U = HERO_ULT.spartacus; if (U && U.dps) U.dps = U.dps.map(v => Math.round(v * B.ult)); }
// 16 Eki (Caner: "kalabalık gruplar yolda sıkışıyor; gerekirse yolu %10-15 genişlet"): doğuş sırasından (game.js SPAWN_LANE) sonra hâlâ en
// sıkışık dört bölümde yol %12 geniş (tools/kalabalik-tara.js: bir düşmanın 12 px yakınında 7-9 komşu kalıyordu)
BAL.wideRoad = { 12: 1.12, 17: 1.12, 30: 1.12, 37: 1.12 };
for (const i in BAL.wideRoad) if (LEVELS[i]) LEVELS[i].roadWide = BAL.wideRoad[i]; // game.js ROAD_K ile çarpılır (lv.roadK)
