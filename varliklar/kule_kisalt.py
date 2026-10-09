"""Kuleyi gövdesinden dilim çıkararak kısaltır (ölçeklemeden; üst platform ve kaide aynı kalır).
python3 varliklar/kule_kisalt.py <girdi.webp> <çıktı.webp> <y0> <y1> [harman=14]
y0..y1 arası satırlar çıkarılır; dikiş y0 öncesi ve y1 sonrası şeritler harmanlanarak gizlenir."""
import sys
import numpy as np
from PIL import Image
src, dst, y0, y1 = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
B = int(sys.argv[5]) if len(sys.argv) > 5 else 14
A = np.array(Image.open(src).convert('RGBA')).astype(np.float32)
top, bot = A[:y0].copy(), A[y1:].copy()
# harman: üst parçanın son B satırı ile alt parçanın (y1-B..y1) satırları yumuşakça birbirine geçer
w = np.linspace(0, 1, B)[:, None, None]
top[-B:] = top[-B:] * (1 - w) + A[y1 - B:y1] * w
out = np.concatenate([top, bot], 0)
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst, 'WEBP', quality=92)
print(out.shape[1], out.shape[0])
