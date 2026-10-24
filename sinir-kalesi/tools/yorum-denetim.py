"""24 Eki: satır ortasındaki // yorumun arkasındaki kodu yutması (ZOMBIE_X'in yarısı yorum oldu, diriltme çöktü) için denetim.
git diff'te eklenen satırlarda, string dışındaki ilk // 'dan sonra kod gibi görünen bir şey (; ) } => const let if, ': değer') varsa yazar ve 1 ile çıkar.
    python3 sinir-kalesi/tools/yorum-denetim.py   (gonder betiği yayından önce çalıştırır)"""
import re, subprocess, sys
d = subprocess.run(['git', 'diff', 'HEAD', '-U0', '--', 'sinir-kalesi/js/game.js', 'sinir-kalesi/js/data.js'], capture_output=True, text=True).stdout
def comment_at(s):
    q = None; i = 0
    while i < len(s) - 1:
        c = s[i]
        if q:
            if c == '\\': i += 2; continue
            if c == q: q = None
        elif c in '\'"`': q = c
        elif s[i:i + 2] == '//': return i
        elif s[i:i + 2] == '/*': j = s.find('*/', i + 2); i = len(s) if j < 0 else j + 2; continue
        i += 1
    return -1
bad = []
for l in d.splitlines():
    if not l.startswith('+') or l.startswith('+++'): continue
    s = l[1:]; i = comment_at(s)
    if i < 0 or not s[:i].strip(): continue  # yalnız yorum olan satır kod yutamaz
    tail = s[i + 2:]
    if re.search(r'([\w\]]\([^)]*\)\s*;|\}\s*[;,)]\s*\S|=>\s*[{(]|\bconst \w+ =|\blet \w+ =|\bif \(\w|\breturn [\w(]|\w+: (\d|\'|\[|\{|true|false)[^,]*,\s*\w+:)', tail): bad.append(s.strip()[:200])
if bad:
    print('SATIR İÇİ YORUM KODU YUTUYOR OLABİLİR:'); [print('  ', b) for b in bad]; sys.exit(1)
print('yorum denetimi temiz')
