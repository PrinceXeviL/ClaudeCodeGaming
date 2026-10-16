# Veo yeniden çekim listesi (16 Eki, Caner: "animasyonda bozukluk, kopukluk var; bu tarz şeyleri sıradaki işlere ekleyelim")

Tarama: şerit karelerinde karakter kadraj kenarına değiyor (kesik). Komut: anim.json'daki her şerit için kenar 2 px'te opak oranı > %4.
Kural: referans görsel büyük beyaz tuvale küçük konur, kadraj uzak (bkz. bellek veo-genis-kadraj). Her kare, ~24 kare/sn.

## Öncelik 1: komutanlar (hep ekranda)
1. hero_merlin_atk: yeşil ateş topu 17-21. karelerde kenardan kesiliyor. Geçici çözüm yayın 685: o kareler atlanıyor, oyun topu bırakma karesinde yeşil ruh topu atıyor. Yeniden çek: top elinde büyüsün, ileri itsin, kadrajdan çıkmasın.
2. hero_merlin_skill (Meteor, 16-27 kesik) ve hero_merlin_skill2 (10-19 kesik).
3. hero_merlin_cast_timegate (29/34 kare kesik); hero_merlin_cast (35/35: büyük ihtimalle sis/aura kenara taşıyor, gözle bak).
4. hero_merlin_die (19-34), hero_merlin_cast_frog (22-27).
5. Báthory: hero_bathory_die (16-27), _skill (10-29), _cast (7-18).
6. Robin: hero_robin_skill (25-30), _cast (36-37); Leonidas _skill (6).

## Öncelik 2: sık görülen düşmanlar
enemy_cavalry_skill (16/32), enemy_hunter_skill (11/32), enemy_heavy_atk2 (10/32), enemy_lantern_die (10/33), enemy_flagellant_die (27-32),
enemy_holywater_die, enemy_solarcher_skill/_idle, enemy_centurion_idle, enemy_torch_skill.

## Öncelik 3: bosslar ve kuşatma
enemy_ram_die (41/67), enemy_siegetower_die (22/65), enemy_cannon_atk/_die, enemy_severus3_skill, enemy_severus_skill, enemy_ignis_atk/_skill,
enemy_agnes/hubertus/champion/malleus/cavcaptain/hierophant_skill, enemy_lucia_atk, enemy_elephant_atk, enemy_eagle_atk, enemy_gloriosus1_die.

## Öncelik 4: Mortimer, kule, iskeletler
mortimer_dirilt (33/42), mortimer_buyu (10/32), mortimer_don; tower_archer_nail_atk, tower_artillery_boneball_atk; unit_skel_1/3 (atk2, idle; 1-3 kare).

castle_keep_2/3_idle tam kare (kale görseli kadrajı dolduruyor): sorun değil.
Bekleyen öteki Veo işleri: Báthory yaralı yürüyüş + zafer pozu, mancınık, kule darbe/yıkılma (bkz. bellek kusatma-ve-komutan-yenileme).
