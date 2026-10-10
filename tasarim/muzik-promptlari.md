# Müzik promptları (Gemini / Lyria)

Oyun üç parça çalar (`sinir-kalesi/ses/`):

| Dosya | Ne zaman | Durum |
|---|---|---|
| `muzik_menu.mp3` | başlık, harita, menüler | var (Banquet for the Uninvited) |
| `muzik_savas.mp3` | bölüm içi | var (The Gates Tremble; albüm: `varliklar/muzik_albumu/`) |
| `muzik_boss.mp3` | boss sahadayken (yoksa savaş parçası çalar) | var (Bones on the Battlements) |

Dosyayı bu adla `ses/` klasörüne koymak yeterli; kod kendisi bulur, yoksa sessiz kalır.
Parçalar döngüyle çalar: başı ve sonu yumuşak / birbirine bağlanabilir olmalı. Sözsüz (enstrümantal) olmalı,
efekt seslerinin altında kalacağı için orta frekanslar çok kalabalık olmamalı. Promptlar İngilizce (model İngilizcede daha iyi).

## Savaş müziği (`muzik_savas.mp3`)
```
Instrumental loopable background music for a cartoon dark-fantasy tower defense game, in the style of Kingdom Rush and Danny Elfman.
Mood: spooky but playful and mischievous, a grumpy old necromancer defending his tower from a pompous golden empire.
Tempo 120 BPM, minor key, steady marching pulse.
Instruments: pizzicato strings and plucky harpsichord carrying a sneaky bouncing melody, bassoon and tuba oom-pah bass line,
xylophone and bone-like marimba accents, celesta sparkles, a small choir of low "ooh" voices in the background,
snare and timpani march rhythm, occasional pipe organ swells and a theremin-like whistle for humor.
Energetic enough for battle but not overwhelming; leave space for sound effects. No vocals, no lyrics.
Smooth seamless loop: the ending flows naturally back into the beginning, no fade out, no big final hit.
```

## Boss müziği (`muzik_boss.mp3`)
```
Instrumental loopable boss battle music for a cartoon dark-fantasy tower defense game, in the style of Kingdom Rush boss themes and Danny Elfman.
A vain golden general on a white horse arrives to crush a grumpy necromancer: epic, tense and a little bit comically pompous.
Tempo 140 BPM, minor key, driving and heroic-villainous.
Instruments: pounding taiko and timpani, low brass (trombones, tuba) playing a heavy menacing riff,
pompous trumpet fanfares that sound slightly ridiculous, racing staccato strings, dramatic pipe organ,
a dark Latin-style choir chanting wordless syllables, cymbal crashes and church bells.
Big and intense but still leaving room for sound effects. No vocals with lyrics.
Smooth seamless loop: the ending flows naturally back into the beginning, no fade out.
```

## İpuçları
- Birkaç deneme üretip en iyisini seç. Çok "korku filmi" gibi olursa promptun başına `whimsical, cartoonish, fun` ekle;
  çok neşeli olursa `darker, more menacing` ekle.
- Parça kısa çıkarsa (ör. 30 sn) sorun değil, döngüyle çalar; 1,5–3 dk ideal.
- MP3 değilse (WAV vb.) bana gönder ya da `ffmpeg -i girdi.wav -b:a 160k muzik_savas.mp3` ile çevir.
- Ses düzeyleri kodda ayarlı (`game.js` MUSIC.tracks `gain`); çok yüksek/kısık gelirse oradan değiştirilir.

## Sefer 2 "Cadı Avı" (10 Eki)
Dosyalar: `ses/muzik_savas2.mp3` (bölüm içi), `ses/muzik_boss2.mp3` (boss). Yoksa 1. seferin parçaları çalar.
Ham dosyayı bana gönder: başını/sonunu dikişsiz döngü için ben harmanlarım.

### Savaş (`muzik_savas2.mp3`)
```
Instrumental loopable background music for a cartoon dark-fantasy tower defense game, in the style of Kingdom Rush and Danny Elfman.
Mood: a grumpy old necromancer defends his haunted lands at night against a fanatical holy inquisition of witch hunters with torches, lanterns and church bells.
Spooky, mischievous and tense, with a gothic cathedral atmosphere. Tempo 115 BPM, minor key, steady marching pulse.
Instruments: pipe organ playing a sneaky minor-key melody, tolling church bells, a dark wordless monk choir humming low,
pizzicato strings and harpsichord, bassoon and tuba bass line, snare drum and timpani march, bone-like marimba accents, celesta sparkles.
Leave space for sound effects. No vocals with lyrics.
Smooth seamless loop: the ending flows naturally back into the beginning, no fade out, no big final hit.
```

### Boss (`muzik_boss2.mp3`)
```
Instrumental loopable boss battle music for a cartoon dark-fantasy tower defense game, in the style of Kingdom Rush boss themes and Danny Elfman.
A fanatical Grand Inquisitor arrives on a giant walking cathedral to burn the necromancer's teapot: epic, frantic and a little comically pompous.
Tempo 140 BPM, minor key, driving. Instruments: thundering full pipe organ, massive church bells, a powerful Latin-style choir chanting wordless syllables,
pounding taiko and timpani, low brass riff, racing staccato strings, cymbal crashes.
Big and intense but leaving room for sound effects. No vocals with lyrics.
Smooth seamless loop: the ending flows naturally back into the beginning, no fade out.
```
