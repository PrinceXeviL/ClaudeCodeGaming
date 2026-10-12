#!/bin/zsh
# Kaggle haftalık GPU kotası (Cumartesi 03:00 TR yenilenir) açılınca sıradaki animasyon işlerini iki hatta çalıştırır (13 Eki).
#   zsh varliklar/kota_sirasi.sh [bekle]   (bekle: Cumartesi 03:05'e kadar uyur)
cd "$(dirname "$0")/.."
L=varliklar/cikti/kota_sirasi.log; mkdir -p varliklar/cikti
if [ "$1" = bekle ]; then t=$(date -j -f "%Y-%m-%d %H:%M" "2026-10-17 03:05" +%s); while [ $(date +%s) -lt $t ]; do sleep 300; done; fi
echo "$(date) başladı" >> $L
( .venv/bin/python varliklar/kaggle_wan.py --isler varliklar/ham/anim/abarti/mortimer_mod.json --ad mortmod >> $L.a 2>&1
  .venv/bin/python varliklar/kaggle_wan.py --isler varliklar/ham/anim/abarti/idle_2.json --ad idle2 >> $L.a 2>&1 ) &
sleep 240
.venv/bin/python varliklar/kaggle_wan.py --isler varliklar/ham/anim/abarti/idle_1.json --ad idle1 >> $L.b 2>&1
wait; echo "$(date) bitti" >> $L
