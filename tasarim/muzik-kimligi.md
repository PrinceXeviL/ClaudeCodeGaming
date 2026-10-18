# Müzik kimliği: Mortimer teması (18 Eki 2026)

Caner: "Kalıcı müzik kimliği neden yok? Müziklerimiz 10 numara, akılda kalıcı olacak."
Sorun: parçalar ayrı ayrı Gemini (Lyria) üretimi, aralarında ortak ezgi yoktu. KR'de ana tema menü, harita, zafer ve boss'ta aynı motifle döner.

Çözüm: ana tema "Banquet for the Uninvited"ın (01, menü müziği) kancası her önemli anda aynı ezgiyle çalar.
- Kanca: kroma öz-benzerliğiyle (2 ölçülük pencereler, en çok tekrarlanan + yüksek enerji) bulundu: nakarat 52,44. sn (ikinci nakarat 148,4 sn'de aynı). Tempo 112 BPM.
- `ses/tema.mp3` (0 sn) zafer — 4 ölçü, yankıyla söner (zafer ekranı).
- yenilgi (10,32 sn) — 2 ölçü, asetrate 0,84 (-3 yarım ton, %16 yavaş), lowpass 2200 (yenilgi).
- boss (16,58 sn) — 1,5 ölçü, asetrate 0,749 (-5 yarım ton), lowpass 1600 + bas, uzun yankı (boss girişi, bossSting).
- kısa (21,86 sn) — ilk ölçü, parlak (gizli sürpriz bulununca).
Kod: game.js THEME / themeSting (müzik ayarı ve düzeyiyle; boss/kısa çalarken müzik kısılır).

Sonraki adım (isteğe bağlı): Caner Gemini'de yeni parça yaparken promptuna bu motifi tarif etsin ("the same main melody as Banquet for the Uninvited" + referans ses), böylece savaş/boss parçaları da temayı taşır.
