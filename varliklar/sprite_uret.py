"""Sınır Kalesi sprite üretici.

Tüm oyun görsellerini elle tasarlanmış SVG olarak üretir ve varliklar/cikti/ içine yazar.
Ortak stil: kalın koyu kontur, sol üstten ışık (gradyan), çizgi film oranları.
Çalıştır:  python3 varliklar/sprite_uret.py
"""
import json
import math
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
OUT_DIR = os.path.join(ROOT, 'varliklar', 'cikti')  # canlı img/ manifestini ezmesin
OUT = '#2a1c12'  # kontur rengi

# ---------------------------------------------------------------- ortak tanımlar
GRADS = {
    'wood':      ['#c98a4b', '#93602f', '#5e3a1a'],
    'woodDark':  ['#8b5a2b', '#6a421e', '#432812'],
    'stone':     ['#cfc8b8', '#a39b8b', '#716a5d'],
    'stoneDark': ['#9a9385', '#77705f', '#4f4a40'],
    'roof':      ['#e8714f', '#b8402a', '#7a2214'],
    'roofDark':  ['#b8402a', '#8a2a18', '#5a160a'],
    'purple':    ['#9d7fd6', '#6f50a8', '#432c6e'],
    'purpleDark': ['#6f50a8', '#4a3378', '#2c1c4a'],
    'metal':     ['#7b7f8c', '#41444e', '#1f2026'],
    'gold':      ['#fff0a8', '#e0b33a', '#946c10'],
    'green':     ['#5fae45', '#3c7f2c', '#24521a'],
    'blue':      ['#6e9cf0', '#3466c4', '#1c3f86'],
    'red':       ['#ef5a4a', '#bf2a22', '#7e1410'],
    'skin':      ['#ffe0bd', '#f0bf8f', '#c98f5f'],
    'goblin':    ['#9be06a', '#6cb543', '#3f7a22'],
    'orc':       ['#7cb85a', '#4c8a36', '#2c5a1e'],
    'troll':     ['#a9bccb', '#7590a6', '#4a6274'],
    'grey':      ['#b6b8c0', '#85878f', '#55575e'],
    'black':     ['#5a5e6c', '#30323b', '#15161b'],
    'brown':     ['#b98b5c', '#8a6038', '#5a3a1e'],
    'leaf1':     ['#7fcf5a', '#4f9a35', '#2c6420'],
    'leaf2':     ['#6ab84c', '#3f852c', '#22541a'],
    'pine':      ['#4fa06a', '#2f7448', '#1a4a2c'],
    'robe':      ['#a46ad0', '#7240a0', '#45206a'],
}


def defs(extra=''):
    g = []
    for name, (a, b, c) in GRADS.items():
        g.append(f'<linearGradient id="{name}" x1="0" y1="0" x2="1" y2="0.35">'
                 f'<stop offset="0" stop-color="{a}"/><stop offset="0.55" stop-color="{b}"/>'
                 f'<stop offset="1" stop-color="{c}"/></linearGradient>')
    g.append('<radialGradient id="orb" cx="0.4" cy="0.35" r="0.65"><stop offset="0" stop-color="#ffffff"/>'
             '<stop offset="0.35" stop-color="#e2c8ff"/><stop offset="1" stop-color="#8a4dff"/></radialGradient>')
    g.append('<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#d7b4ff" stop-opacity="0.9"/>'
             '<stop offset="1" stop-color="#9a5cff" stop-opacity="0"/></radialGradient>')
    g.append('<radialGradient id="glowGreen" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#d4ffb0" stop-opacity="0.95"/>'
             '<stop offset="1" stop-color="#5cff5c" stop-opacity="0"/></radialGradient>')
    g.append('<radialGradient id="ball" cx="0.35" cy="0.3" r="0.7"><stop offset="0" stop-color="#7a7d88"/>'
             '<stop offset="1" stop-color="#121216"/></radialGradient>')
    return '<defs>' + ''.join(g) + extra + '</defs>'


def svg(w, h, body, extra_defs=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
            + defs(extra_defs) + f'<g stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


_uid = [0]


def uid(p='c'):
    _uid[0] += 1
    return f'{p}{_uid[0]}'


def stroke(sw=4):
    return f'stroke="{OUT}" stroke-width="{sw}"'


def path_bbox(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def poly_d(pts):
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + ' Z'


def bricks(pts, fill, rowh=12, bw=22, line='rgba(40,25,10,0.38)', sw=4):
    """Taş örgülü çokgen: dolgu + kesik harç çizgileri + kontur."""
    d = poly_d(pts)
    cid = uid()
    x0, y0, x1, y1 = path_bbox(pts)
    lines = []
    row = 0
    y = y1 - rowh
    while y > y0:
        lines.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}"/>')
        off = (bw / 2) if row % 2 else 0
        x = x0 + off
        while x < x1:
            lines.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x:.1f}" y2="{y + rowh:.1f}"/>')
            x += bw
        y -= rowh
        row += 1
    # en üst sıra dikeyleri
    return (f'<clipPath id="{cid}"><path d="{d}"/></clipPath><path d="{d}" fill="{fill}"/>'
            f'<g clip-path="url(#{cid})" stroke="{line}" stroke-width="1.8">{"".join(lines)}'
            f'<rect x="{x0}" y="{y0}" width="{(x1 - x0) * 0.22:.1f}" height="{y1 - y0}" fill="rgba(255,255,255,0.10)" stroke="none"/>'
            f'</g><path d="{d}" fill="none" {stroke(sw)}/>')


def planks(pts, fill, step=12, braces=True, sw=4):
    d = poly_d(pts)
    cid = uid()
    x0, y0, x1, y1 = path_bbox(pts)
    lines = [f'<line x1="{x:.1f}" y1="{y0}" x2="{x:.1f}" y2="{y1}"/>' for x in frange(x0 + step, x1, step)]
    br = ''
    if braces:
        br = (f'<line x1="{x0}" y1="{y0 + 8}" x2="{x1}" y2="{y1 - 6}" stroke="#4a2c12" stroke-width="5"/>'
              f'<line x1="{x1}" y1="{y0 + 8}" x2="{x0}" y2="{y1 - 6}" stroke="#4a2c12" stroke-width="5"/>')
    return (f'<clipPath id="{cid}"><path d="{d}"/></clipPath><path d="{d}" fill="{fill}"/>'
            f'<g clip-path="url(#{cid})" stroke="rgba(40,20,5,0.45)" stroke-width="1.8">{"".join(lines)}{br}'
            f'<rect x="{x0}" y="{y0}" width="{(x1 - x0) * 0.2:.1f}" height="{y1 - y0}" fill="rgba(255,255,255,0.12)" stroke="none"/></g>'
            f'<path d="{d}" fill="none" {stroke(sw)}/>')


def frange(a, b, s):
    v = a
    while v < b:
        yield v
        v += s


def base_platform(rx=80):
    out = [f'<ellipse cx="100" cy="218" rx="{rx}" ry="19" fill="url(#stoneDark)" {stroke()}/>',
           f'<ellipse cx="100" cy="212" rx="{rx - 5}" ry="15" fill="url(#stone)" {stroke(3)}/>']
    for i in range(14):
        a = math.pi * (i / 13)
        x = 100 + math.cos(a) * (rx - 4)
        y = 214 + math.sin(a) * 15
        out.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="7" ry="4.5" fill="#d8d1c2" stroke="{OUT}" stroke-width="1.6"/>')
    return ''.join(out)


def door(cx, by, w=26, h=30):
    r = w / 2
    return (f'<path d="M{cx - r} {by} V{by - h + r} A{r} {r} 0 0 1 {cx + r} {by - h + r} V{by} Z" fill="#2a1a10" {stroke(3)}/>'
            f'<path d="M{cx - r + 5} {by} V{by - h + r + 3} A{r - 5} {r - 5} 0 0 1 {cx + r - 5} {by - h + r + 3} V{by}" fill="#4a2e18"/>')


def window(cx, cy, w=12, h=16, glow='#ffd977'):
    r = w / 2
    return (f'<path d="M{cx - r} {cy + h / 2} V{cy - h / 2 + r} A{r} {r} 0 0 1 {cx + r} {cy - h / 2 + r} V{cy + h / 2} Z" '
            f'fill="{glow}" {stroke(2.5)}/>')


def flag(x, y, h=34, col='url(#blue)', w=26, wave=1):
    return (f'<line x1="{x}" y1="{y}" x2="{x}" y2="{y - h}" stroke="{OUT}" stroke-width="5"/>'
            f'<line x1="{x}" y1="{y}" x2="{x}" y2="{y - h}" stroke="#8a6a3a" stroke-width="2.5"/>'
            f'<path d="M{x} {y - h} Q{x + w * 0.5} {y - h - 5 * wave} {x + w} {y - h + 2} L{x + w - 4} {y - h + 9} '
            f'L{x + w} {y - h + 16} Q{x + w * 0.5} {y - h + 12} {x} {y - h + 16} Z" fill="{col}" {stroke(2.5)}/>'
            f'<circle cx="{x}" cy="{y - h - 2}" r="3" fill="url(#gold)" {stroke(1.5)}/>')


def banner(x, y, w=18, h=36, col='url(#red)', emblem=True):
    e = (f'<path d="M{x} {y + h * 0.35} l4 6 l-4 6 l-4 -6 Z" fill="url(#gold)" stroke="{OUT}" stroke-width="1.2"/>'
         if emblem else '')
    return (f'<path d="M{x - w / 2} {y} H{x + w / 2} V{y + h} L{x} {y + h - 8} L{x - w / 2} {y + h} Z" fill="{col}" {stroke(2.5)}/>'
            f'<rect x="{x - w / 2 - 3}" y="{y - 3}" width="{w + 6}" height="5" rx="2" fill="url(#gold)" {stroke(1.5)}/>' + e)


def merlons(x0, x1, y, h=12, w=14, gap=8, fill='url(#stone)'):
    out = []
    x = x0
    while x + w <= x1 + 0.1:
        out.append(f'<rect x="{x:.1f}" y="{y - h}" width="{w}" height="{h + 2}" rx="2" fill="{fill}" {stroke(3)}/>')
        x += w + gap
    return ''.join(out)


def archer_fig(cx, cy, s=1.0, hood='url(#green)'):
    """Korkuluk arkasında duran okçu (bel üstü)."""
    return (f'<g transform="translate({cx} {cy}) scale({s})">'
            f'<path d="M-13 18 Q-12 0 0 -2 Q12 0 13 18 Z" fill="{hood}" {stroke(3)}/>'
            f'<path d="M-12 -6 Q-12 -24 0 -25 Q13 -24 12 -6 Q12 2 0 3 Q-12 2 -12 -6 Z" fill="{hood}" {stroke(3)}/>'
            f'<ellipse cx="3" cy="-6" rx="7.5" ry="7" fill="url(#skin)" stroke="{OUT}" stroke-width="2"/>'
            f'<circle cx="6" cy="-7" r="1.6" fill="{OUT}"/>'
            f'<path d="M14 -20 Q24 -4 14 12" fill="none" stroke="#6a3a14" stroke-width="3.5"/>'
            f'<line x1="14" y1="-20" x2="14" y2="12" stroke="#eee" stroke-width="1.2"/>'
            f'</g>')


def rail(x0, x1, y, h=16, fill='url(#wood)'):
    out = [f'<rect x="{x0}" y="{y}" width="{x1 - x0}" height="7" rx="2" fill="{fill}" {stroke(3)}/>']
    for x in frange(x0, x1 + 1, (x1 - x0) / 5):
        out.append(f'<rect x="{x - 3:.1f}" y="{y}" width="6" height="{h}" rx="1.5" fill="{fill}" {stroke(2.5)}/>')
    return ''.join(out)


# ---------------------------------------------------------------- kuleler (200x240)
def tower_archer(lvl):
    b = [base_platform(76 + lvl * 4)]
    if lvl == 1:
        b.append(planks([(66, 210), (134, 210), (126, 116), (74, 116)], 'url(#wood)'))
        b.append(door(100, 210, 24, 30))
        b.append(f'<path d="M58 118 L72 108 H128 L142 118 Z" fill="url(#woodDark)" {stroke(3)}/>')
        b.append(f'<rect x="54" y="100" width="92" height="18" rx="3" fill="url(#wood)" {stroke()}/>')
        b.append(archer_fig(82, 80))
        b.append(archer_fig(118, 80))
        b.append(rail(56, 144, 84))
    elif lvl == 2:
        b.append(bricks([(60, 210), (140, 210), (136, 158), (64, 158)], 'url(#stone)', 12, 20))
        b.append(planks([(66, 160), (134, 160), (128, 108), (72, 108)], 'url(#wood)'))
        b.append(door(100, 210, 26, 34))
        b.append(f'<rect x="50" y="92" width="100" height="18" rx="3" fill="url(#wood)" {stroke()}/>')
        b.append(archer_fig(80, 72, 1.08))
        b.append(archer_fig(120, 72, 1.08))
        b.append(rail(52, 148, 76))
        b.append(flag(146, 80, 40, 'url(#red)'))
    else:
        b.append(bricks([(56, 210), (144, 210), (138, 104), (62, 104)], 'url(#stone)', 13, 22))
        b.append(banner(78, 118, 16, 40))
        b.append(banner(122, 118, 16, 40))
        b.append(door(100, 210, 28, 38))
        b.append(f'<path d="M48 108 L58 92 H142 L152 108 Z" fill="url(#stoneDark)" {stroke(3)}/>')
        b.append(archer_fig(76, 64, 1.12, 'url(#red)'))
        b.append(archer_fig(100, 58, 1.12))
        b.append(archer_fig(124, 64, 1.12, 'url(#red)'))
        b.append(f'<rect x="46" y="82" width="108" height="14" rx="3" fill="url(#stone)" {stroke()}/>')
        b.append(merlons(46, 154, 82, 12, 16, 7))
        b.append(f'<rect x="46" y="94" width="108" height="5" fill="url(#gold)" {stroke(2)}/>')
        b.append(flag(152, 72, 44, 'url(#red)'))
    return svg(200, 240, ''.join(b))


def roof(x0, x1, y_eave, y_ridge, inset, fill='url(#roof)', tiles=True):
    pts = [(x0, y_eave), (x0 + inset, y_ridge), (x1 - inset, y_ridge), (x1, y_eave)]
    d = poly_d(pts)
    cid = uid()
    lines = []
    if tiles:
        for y in frange(y_ridge + 9, y_eave, 9):
            lines.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}"/>')
        for i, y in enumerate(frange(y_ridge, y_eave, 9)):
            off = 7 if i % 2 else 0
            for x in frange(x0 + off, x1, 14):
                lines.append(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x:.1f}" y2="{y + 9:.1f}"/>')
    return (f'<clipPath id="{cid}"><path d="{d}"/></clipPath><path d="{d}" fill="{fill}"/>'
            f'<g clip-path="url(#{cid})" stroke="rgba(60,10,0,0.4)" stroke-width="1.6">{"".join(lines)}</g>'
            f'<path d="{d}" fill="none" {stroke()}/>'
            f'<line x1="{x0 + inset}" y1="{y_ridge}" x2="{x1 - inset}" y2="{y_ridge}" stroke="{OUT}" stroke-width="5"/>')


def shield_emblem(cx, cy, s=1, col='url(#blue)'):
    return (f'<g transform="translate({cx} {cy}) scale({s})"><path d="M-9 -10 H9 V0 Q9 9 0 13 Q-9 9 -9 0 Z" fill="{col}" {stroke(2.5)}/>'
            f'<path d="M0 -6 V8 M-5 0 H5" stroke="#f3e3b0" stroke-width="2.5"/></g>')


def tower_barracks(lvl):
    b = [base_platform(80 + lvl * 3)]
    if lvl == 1:
        b.append(bricks([(52, 210), (148, 210), (148, 150), (52, 150)], 'url(#stone)', 12, 22))
        b.append(roof(40, 160, 154, 104, 26))
        b.append(door(100, 210, 28, 38))
        b.append(window(68, 178))
        b.append(window(132, 178))
        b.append(flag(100, 104, 34))
    elif lvl == 2:
        b.append(bricks([(46, 210), (154, 210), (154, 144), (46, 144)], 'url(#stone)', 12, 22))
        b.append(f'<rect x="118" y="88" width="16" height="30" fill="url(#stoneDark)" {stroke(3)}/>')
        b.append(roof(34, 166, 148, 96, 28, 'url(#roofDark)'))
        b.append(door(100, 210, 30, 42))
        b.append(window(66, 172))
        b.append(window(134, 172))
        b.append(shield_emblem(66, 196, 0.9))
        b.append(shield_emblem(134, 196, 0.9))
        b.append(flag(100, 96, 38))
    else:
        b.append(bricks([(36, 210), (70, 210), (70, 110), (36, 110)], 'url(#stoneDark)', 12, 16))
        b.append(f'<path d="M30 112 L53 70 L76 112 Z" fill="url(#roofDark)" {stroke()}/>')
        b.append(bricks([(64, 210), (160, 210), (160, 138), (64, 138)], 'url(#stone)', 12, 22))
        b.append(roof(54, 170, 142, 92, 26, 'url(#roofDark)'))
        b.append(f'<rect x="64" y="138" width="96" height="6" fill="url(#gold)" {stroke(2)}/>')
        b.append(door(112, 210, 32, 46))
        b.append(window(82, 168))
        b.append(window(142, 168))
        b.append(window(53, 140, 10, 14))
        b.append(banner(82, 186, 14, 22, 'url(#blue)', False))
        b.append(banner(142, 186, 14, 22, 'url(#blue)', False))
        b.append(flag(53, 72, 30))
        b.append(flag(112, 92, 42))
    return svg(200, 240, ''.join(b))


def crystal(cx, cy, s=1.0, kind='orb'):
    glow = f'<circle cx="{cx}" cy="{cy}" r="{34 * s}" fill="url(#glow)"/>'
    if kind == 'orb':
        return glow + (f'<circle cx="{cx}" cy="{cy}" r="{14 * s}" fill="url(#orb)" {stroke(3)}/>'
                       f'<ellipse cx="{cx - 4 * s}" cy="{cy - 5 * s}" rx="{4 * s}" ry="{3 * s}" fill="#fff" opacity="0.85"/>')
    h, w = 24 * s, 12 * s
    return glow + (f'<path d="M{cx} {cy - h} L{cx + w} {cy} L{cx} {cy + h} L{cx - w} {cy} Z" fill="url(#orb)" {stroke(3)}/>'
                   f'<path d="M{cx} {cy - h} L{cx} {cy + h} M{cx - w} {cy} L{cx + w} {cy}" stroke="#fff" stroke-width="1.4" opacity="0.7"/>')


def runes(xs, y):
    out = []
    for i, x in enumerate(xs):
        d = ['M-4 -5 L4 5 M4 -5 L-4 5', 'M-4 -6 L1 0 L-4 6 M4 -6 V6', 'M-4 5 L0 -5 L4 5', 'M-4 -4 H4 L-4 4 H4'][i % 4]
        out.append(f'<path transform="translate({x} {y})" d="{d}" stroke="#e9d4ff" stroke-width="2.4" fill="none"/>')
    return ''.join(out)


def tower_mage(lvl):
    b = [base_platform(70 + lvl * 4)]
    if lvl == 1:
        b.append(bricks([(76, 210), (124, 210), (118, 102), (82, 102)], 'url(#purple)', 12, 16))
        b.append(f'<path d="M70 104 L78 92 H122 L130 104 Z" fill="url(#purpleDark)" {stroke(3)}/>')
        b.append(f'<rect x="76" y="140" width="48" height="5" fill="url(#gold)" {stroke(2)}/>')
        b.append(window(100, 124, 12, 18, '#d9b8ff'))
        b.append(door(100, 210, 22, 30))
        b.append(f'<path d="M88 92 L100 76 L112 92 Z" fill="url(#purpleDark)" {stroke(3)}/>')
        b.append(crystal(100, 58, 1.0))
    elif lvl == 2:
        b.append(bricks([(72, 210), (128, 210), (121, 88), (79, 88)], 'url(#purple)', 12, 16))
        b.append(f'<path d="M64 90 L74 76 H126 L136 90 Z" fill="url(#purpleDark)" {stroke(3)}/>')
        b.append(f'<rect x="72" y="150" width="56" height="5" fill="url(#gold)" {stroke(2)}/>')
        b.append(f'<rect x="76" y="110" width="48" height="5" fill="url(#gold)" {stroke(2)}/>')
        b.append(runes([86, 100, 114], 134))
        b.append(window(100, 176, 12, 16, '#d9b8ff'))
        b.append(door(100, 210, 22, 26))
        b.append(f'<path d="M84 76 L100 60 L116 76 Z" fill="url(#gold)" {stroke(3)}/>')
        b.append(crystal(100, 36, 0.95, 'diamond'))
    else:
        b.append(bricks([(46, 210), (70, 210), (68, 140), (48, 140)], 'url(#purpleDark)', 11, 12))
        b.append(f'<path d="M42 142 L58 112 L74 142 Z" fill="url(#gold)" {stroke(3)}/>')
        b.append(bricks([(130, 210), (154, 210), (152, 140), (132, 140)], 'url(#purpleDark)', 11, 12))
        b.append(f'<path d="M126 142 L142 112 L158 142 Z" fill="url(#gold)" {stroke(3)}/>')
        b.append(bricks([(70, 210), (130, 210), (122, 80), (78, 80)], 'url(#purple)', 12, 16))
        b.append(f'<path d="M62 82 L72 66 H128 L138 82 Z" fill="url(#purpleDark)" {stroke(3)}/>')
        for y in (100, 150):
            b.append(f'<rect x="{72 if y == 150 else 76}" y="{y}" width="{56 if y == 150 else 48}" height="6" fill="url(#gold)" {stroke(2)}/>')
        b.append(runes([86, 100, 114], 124))
        b.append(runes([88, 112], 172))
        b.append(door(100, 210, 24, 26))
        b.append(f'<path d="M80 66 L100 44 L120 66 Z" fill="url(#gold)" {stroke(3)}/>')
        b.append(f'<ellipse cx="100" cy="22" rx="30" ry="9" fill="none" stroke="#c9a2ff" stroke-width="2.5" opacity="0.8"/>')
        b.append(crystal(100, 20, 1.15, 'diamond'))
    return svg(200, 240, ''.join(b))


def mortar(cx, cy, s=1.0, gold=False):
    band = 'url(#gold)' if gold else 'url(#metal)'
    return (f'<g transform="translate({cx} {cy}) scale({s}) rotate(-28)">'
            f'<rect x="-20" y="-58" width="40" height="62" rx="9" fill="url(#metal)" {stroke()}/>'
            f'<rect x="-23" y="-62" width="46" height="12" rx="5" fill="{band}" {stroke(3)}/>'
            f'<rect x="-22" y="-24" width="44" height="8" rx="3" fill="{band}" {stroke(2.5)}/>'
            f'<ellipse cx="0" cy="-61" rx="15" ry="5" fill="#0b0b0e"/>'
            f'<rect x="-14" y="-52" width="6" height="44" rx="3" fill="rgba(255,255,255,0.18)"/>'
            f'</g>')


def ball_pile(x, y, s=1.0):
    out = []
    for dx, dy in [(-8, 0), (8, 0), (0, -11)]:
        out.append(f'<circle cx="{x + dx * s}" cy="{y + dy * s}" r="{7.5 * s}" fill="url(#ball)" {stroke(2.5)}/>')
    return ''.join(out)


def tower_artillery(lvl):
    b = [base_platform(80 + lvl * 3)]
    w = 48 + lvl * 4
    top = 168 - lvl * 8
    b.append(bricks([(100 - w - 2, 210), (100 + w + 2, 210), (100 + w - 4, top), (100 - w + 4, top)], 'url(#stone)', 12, 22))
    b.append(f'<ellipse cx="100" cy="{top}" rx="{w - 2}" ry="13" fill="url(#stoneDark)" {stroke()}/>')
    b.append(f'<ellipse cx="100" cy="{top - 2}" rx="{w - 12}" ry="8" fill="#6a6255"/>')
    if lvl >= 2:
        b.append(merlons(100 - w + 4, 100 + w - 4, top + 2, 10, 13, 9))
    b.append(f'<path d="M78 {top} L84 {top - 22} H116 L122 {top} Z" fill="url(#woodDark)" {stroke(3)}/>')
    b.append(mortar(102, top - 14, 0.9 + lvl * 0.12, lvl == 3))
    b.append(ball_pile(100 + w - 10, top + 30, 0.9))
    if lvl == 3:
        b.append(f'<rect x="{100 - w + 2}" y="{top + 14}" width="{2 * w - 4}" height="6" fill="url(#gold)" {stroke(2)}/>')
        b.append(flag(100 + w - 14, top - 2, 30, 'url(#red)', 22))
    b.append(door(100, 210, 22, 24))
    return svg(200, 240, ''.join(b))


# ---------------------------------------------------------------- yazma
def write_all():
    os.makedirs(OUT_DIR, exist_ok=True)
    files = {}
    for lvl in (1, 2, 3):
        files[f'tower_archer_{lvl}.svg'] = tower_archer(lvl)
        files[f'tower_barracks_{lvl}.svg'] = tower_barracks(lvl)
        files[f'tower_mage_{lvl}.svg'] = tower_mage(lvl)
        files[f'tower_artillery_{lvl}.svg'] = tower_artillery(lvl)
    files.update(characters())
    files.update(environment())
    for name, content in files.items():
        with open(os.path.join(OUT_DIR, name), 'w') as f:
            f.write(content)
    extra = [f for f in sorted(os.listdir(OUT_DIR)) if f.endswith('.png')]
    with open(os.path.join(OUT_DIR, 'manifest.json'), 'w') as f:
        json.dump(sorted(files) + extra, f, indent=0)
    print(len(files), 'svg +', len(extra), 'png')


def leg(x, y0, y1, fill='url(#brown)', boot='#3a2614', w=11):
    return (f'<rect x="{x - w / 2}" y="{y0}" width="{w}" height="{y1 - y0}" rx="4" fill="{fill}" {stroke(3)}/>'
            f'<path d="M{x - w / 2 - 1} {y1 - 6} H{x + w / 2 + 6} Q{x + w / 2 + 8} {y1 + 3} {x + w / 2 + 2} {y1 + 3} H{x - w / 2 - 1} Z" fill="{boot}" {stroke(3)}/>')


def eye(x, y, r=4.5, iris='#2a1c12', white='#fff'):
    return (f'<ellipse cx="{x}" cy="{y}" rx="{r * 0.85}" ry="{r}" fill="{white}" stroke="{OUT}" stroke-width="2"/>'
            f'<circle cx="{x + r * 0.3}" cy="{y + 0.5}" r="{r * 0.48}" fill="{iris}"/>'
            f'<circle cx="{x + r * 0.45}" cy="{y - r * 0.25}" r="{r * 0.18}" fill="#fff"/>')


def brow(x, y, w=9, angle=12):
    return f'<path d="M{x - w / 2} {y - angle * 0.25} L{x + w / 2} {y + angle * 0.25}" stroke="{OUT}" stroke-width="3.5"/>'


def sword(x, y, length=34, angle=-35, blade='url(#grey)', s=1.0):
    return (f'<g transform="translate({x} {y}) rotate({angle}) scale({s})">'
            f'<path d="M-3.5 0 V{-length} L0 {-length - 7} L3.5 {-length} V0 Z" fill="{blade}" {stroke(2.5)}/>'
            f'<line x1="0" y1="-3" x2="0" y2="{-length + 2}" stroke="#fff" stroke-width="1.2" opacity="0.6"/>'
            f'<rect x="-9" y="-1" width="18" height="5" rx="2" fill="url(#gold)" {stroke(2)}/>'
            f'<rect x="-2.5" y="3" width="5" height="10" rx="2" fill="#5a3a1e" {stroke(2)}/>'
            f'</g>')


def hand(x, y, fill='url(#skin)', r=5.5):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" {stroke(2.5)}/>'


def goblin():
    b = [leg(50, 88, 110, 'url(#brown)'), leg(66, 88, 112, 'url(#brown)'),
         f'<path d="M40 92 Q38 66 58 64 Q78 64 78 90 Q60 98 40 92 Z" fill="url(#brown)" {stroke()}/>',
         f'<path d="M42 90 L46 96 L50 90 L55 97 L60 91 L66 97 L72 90 L76 95" fill="none" stroke="{OUT}" stroke-width="2.5"/>',
         f'<line x1="44" y1="78" x2="76" y2="78" stroke="#4a2c12" stroke-width="4"/>',
         # kulaklar
         f'<path d="M40 44 L8 30 L38 58 Z" fill="url(#goblin)" {stroke()}/>',
         f'<path d="M84 44 L114 28 L86 58 Z" fill="url(#goblin)" {stroke()}/>',
         f'<path d="M36 40 L18 34 L36 50" fill="#e48a8a" opacity="0.5"/>',
         f'<circle cx="62" cy="48" r="26" fill="url(#goblin)" {stroke()}/>',
         eye(66, 44, 6, '#1a1a0a', '#ffe94a'), eye(81, 44, 5.5, '#1a1a0a', '#ffe94a'),
         brow(66, 35, 11, 14), brow(82, 35, 9, 10),
         f'<path d="M86 52 Q92 54 88 58" fill="none" stroke="{OUT}" stroke-width="2.5"/>',
         f'<path d="M62 60 Q74 68 84 60 Z" fill="#5a1a10" {stroke(2.5)}/>',
         f'<path d="M66 61 l3 4 l2 -4 M74 62 l2 4 l2 -4" fill="#fff" stroke="#fff" stroke-width="1.5"/>',
         sword(84, 82, 18, -20, 'url(#grey)', 1),
         hand(84, 82, 'url(#goblin)')]
    return svg(120, 120, ''.join(b))


def wolf():
    b = [f'<path d="M30 70 Q8 60 6 40 Q18 56 34 60 Z" fill="url(#grey)" {stroke()}/>',
         leg(34, 76, 110, 'url(#grey)', '#3a3c42', 9), leg(48, 78, 112, 'url(#grey)', '#3a3c42', 9),
         f'<ellipse cx="56" cy="70" rx="36" ry="20" fill="url(#grey)" {stroke()}/>',
         f'<path d="M30 56 L38 48 L44 56 L52 47 L58 55 L66 46 L72 55" fill="url(#grey)" stroke="{OUT}" stroke-width="3"/>',
         f'<path d="M36 82 Q56 90 80 82" fill="none" stroke="#d6d8de" stroke-width="5" opacity="0.7"/>',
         leg(70, 80, 112, 'url(#grey)', '#3a3c42', 9), leg(84, 78, 110, 'url(#grey)', '#3a3c42', 9),
         # kafa
         f'<path d="M74 50 L78 26 L90 42 Z" fill="url(#grey)" {stroke()}/>',
         f'<path d="M78 40 L80 30 L86 40 Z" fill="#e48a8a"/>',
         f'<path d="M70 58 Q72 38 92 40 Q104 44 116 54 Q114 64 100 66 Q86 72 72 66 Z" fill="url(#grey)" {stroke()}/>',
         f'<path d="M100 66 Q108 70 114 60" fill="#ddd" stroke="{OUT}" stroke-width="2.5"/>',
         f'<ellipse cx="115" cy="54" rx="4" ry="3.5" fill="#1a1a1a"/>',
         f'<path d="M86 48 L96 46 L94 52 Z" fill="#ff3a2a" stroke="{OUT}" stroke-width="2"/>',
         f'<path d="M102 66 l2 4 l2 -4" fill="#fff" stroke="#fff" stroke-width="1.5"/>']
    return svg(120, 120, ''.join(b))


def bandit():
    b = [leg(50, 86, 110, 'url(#black)'), leg(66, 86, 112, 'url(#black)'),
         sword(46, 80, 30, -150, 'url(#grey)', 0.9),
         f'<path d="M40 92 Q38 62 60 60 Q82 62 80 92 Z" fill="#e8d6b0" {stroke()}/>',
         f'<path d="M40 92 Q38 62 52 61 L56 92 Z M80 92 Q82 62 68 61 L66 92 Z" fill="url(#brown)" {stroke(3)}/>',
         f'<rect x="40" y="82" width="40" height="6" fill="#3a2614" {stroke(2)}/>',
         f'<circle cx="62" cy="44" r="22" fill="url(#skin)" {stroke()}/>',
         f'<path d="M40 42 Q40 18 62 18 Q86 18 86 40 Q64 32 40 42 Z" fill="url(#red)" {stroke()}/>',
         f'<path d="M42 32 Q26 30 22 40 Q30 36 40 40 M42 34 Q30 44 28 52 Q36 44 42 40" fill="url(#red)" {stroke(2.5)}/>',
         f'<path d="M44 42 H86 V50 H44 Z" fill="#2a2a30" {stroke(2.5)}/>',
         f'<circle cx="70" cy="46" r="2.6" fill="#fff"/><circle cx="80" cy="46" r="2.4" fill="#fff"/>',
         f'<path d="M66 58 Q74 61 82 57" fill="none" stroke="{OUT}" stroke-width="2.5"/>',
         f'<path d="M58 56 Q60 66 70 66" fill="none" stroke="#8a5a2a" stroke-width="3" opacity="0.6"/>',
         sword(84, 80, 32, -40, 'url(#grey)', 1), hand(84, 80)]
    return svg(120, 120, ''.join(b))


def orc():
    b = [leg(46, 90, 112, 'url(#brown)', '#2a1a0c', 14), leg(70, 90, 114, 'url(#brown)', '#2a1a0c', 14),
         f'<path d="M28 96 Q22 56 58 52 Q96 54 92 96 Z" fill="url(#orc)" {stroke()}/>',
         f'<path d="M36 94 Q34 66 58 64 Q84 66 82 94 Z" fill="url(#metal)" {stroke(3)}/>',
         f'<circle cx="44" cy="72" r="2.4" fill="#ccc"/><circle cx="72" cy="72" r="2.4" fill="#ccc"/>'
         f'<circle cx="44" cy="86" r="2.4" fill="#ccc"/><circle cx="72" cy="86" r="2.4" fill="#ccc"/>',
         f'<path d="M26 64 Q24 50 42 52 L44 66 Z" fill="url(#metal)" {stroke(3)}/>',
         f'<circle cx="62" cy="38" r="21" fill="url(#orc)" {stroke()}/>',
         f'<path d="M42 34 L32 26 L42 44 Z" fill="url(#orc)" {stroke(3)}/>',
         eye(66, 34, 4.2, '#2a0a0a', '#ffd23a'), eye(78, 34, 4, '#2a0a0a', '#ffd23a'),
         f'<path d="M58 26 L72 31 M74 30 L86 27" stroke="{OUT}" stroke-width="4"/>',
         f'<path d="M60 50 Q72 56 84 49" fill="#3a0a0a" {stroke(2.5)}/>',
         f'<path d="M64 50 L66 40 L69 50 Z M78 50 L80 40 L83 49 Z" fill="#fffbe6" {stroke(1.8)}/>',
         # sopa
         f'<g transform="translate(100 86) rotate(-14)"><path d="M-5 4 L-8 -42 Q0 -54 8 -42 L5 4 Z" fill="url(#wood)" {stroke(3)}/>'
         f'<path d="M-7 -30 l-6 -2 M-6 -40 l-6 -4 M7 -32 l6 -2 M6 -42 l5 -5" stroke="#ddd" stroke-width="3"/></g>',
         hand(100, 86, 'url(#orc)', 7)]
    return svg(120, 120, ''.join(b))


def bat():
    wing = 'M60 58 Q44 34 8 30 Q14 44 10 56 Q20 52 24 62 Q32 56 38 68 Q46 60 60 66 Z'
    b = [f'<path d="{wing}" fill="url(#purpleDark)" {stroke()}/>',
         f'<path d="{wing}" transform="translate(120 0) scale(-1 1)" fill="url(#purpleDark)" {stroke()}/>',
         f'<path d="M58 40 L14 33 M58 46 L18 54 M58 52 L30 64" stroke="#2a1840" stroke-width="2"/>',
         f'<path d="M62 40 L106 33 M62 46 L102 54 M62 52 L90 64" stroke="#2a1840" stroke-width="2"/>',
         f'<path d="M48 40 L46 20 L56 32 Z M72 40 L74 20 L64 32 Z" fill="#4a3366" {stroke(3)}/>',
         f'<ellipse cx="60" cy="58" rx="16" ry="20" fill="#4a3366" {stroke()}/>',
         f'<circle cx="60" cy="44" r="14" fill="#5a4078" {stroke()}/>',
         f'<ellipse cx="54" cy="42" rx="3.5" ry="4" fill="#ff3a3a"/><ellipse cx="66" cy="42" rx="3.5" ry="4" fill="#ff3a3a"/>',
         f'<path d="M55 51 l2 5 l2 -5 M61 51 l2 5 l2 -5" fill="#fff" stroke="#fff" stroke-width="1.4"/>',
         f'<path d="M54 76 l-3 8 M66 76 l3 8" stroke="{OUT}" stroke-width="3"/>']
    return svg(120, 120, ''.join(b))


def shaman():
    b = [f'<line x1="92" y1="112" x2="96" y2="26" stroke="{OUT}" stroke-width="8"/>',
         f'<line x1="92" y1="112" x2="96" y2="26" stroke="#8a5a2a" stroke-width="4.5"/>',
         f'<circle cx="96" cy="22" r="20" fill="url(#glowGreen)"/>',
         f'<circle cx="96" cy="22" r="8" fill="#9dff7a" {stroke(2.5)}/>',
         f'<path d="M88 30 Q96 36 104 30" fill="none" stroke="{OUT}" stroke-width="2.5"/>',
         f'<path d="M30 112 Q36 70 60 60 Q84 70 88 112 Z" fill="url(#robe)" {stroke()}/>',
         f'<path d="M44 112 Q50 84 60 76 Q70 84 74 112" fill="none" stroke="#3a1858" stroke-width="2.5"/>',
         f'<path d="M44 72 Q60 84 76 72" fill="none" stroke="#f3ead2" stroke-width="4" stroke-dasharray="3 5"/>',
         f'<path d="M36 48 L14 38 L34 60 Z" fill="url(#goblin)" {stroke(3)}/>',
         f'<circle cx="60" cy="48" r="20" fill="url(#goblin)" {stroke()}/>',
         f'<path d="M36 52 Q34 20 60 8 Q86 20 84 46 Q72 34 60 34 Q48 34 36 52 Z" fill="url(#robe)" {stroke()}/>',
         eye(64, 48, 4, '#1a1a0a', '#c9ff7a'), eye(76, 48, 3.8, '#1a1a0a', '#c9ff7a'),
         f'<path d="M64 60 Q72 63 78 59" fill="none" stroke="{OUT}" stroke-width="2.5"/>',
         hand(92, 76, 'url(#goblin)')]
    return svg(120, 120, ''.join(b))


def knight():
    b = [leg(48, 88, 112, 'url(#black)', '#15161b', 13), leg(68, 88, 114, 'url(#black)', '#15161b', 13),
         sword(40, 80, 40, -160, 'url(#grey)', 1),
         f'<path d="M34 94 Q30 58 60 56 Q90 58 86 94 Z" fill="url(#black)" {stroke()}/>',
         f'<path d="M44 66 Q60 74 76 66 M46 80 Q60 86 74 80" fill="none" stroke="#6a6e7c" stroke-width="2.5"/>',
         f'<path d="M30 68 Q26 52 46 54 L46 68 Z M90 68 Q94 52 74 54 L74 68 Z" fill="url(#black)" {stroke(3)}/>',
         # miğfer
         f'<path d="M58 14 Q48 -2 40 4 Q50 6 54 18 Z" fill="url(#red)" {stroke(2.5)}/>',
         f'<path d="M40 50 Q38 16 62 14 Q86 16 84 50 Q62 58 40 50 Z" fill="url(#black)" {stroke()}/>',
         f'<path d="M58 34 H84 V40 H58 Z" fill="#15161b" {stroke(2)}/>',
         f'<rect x="64" y="35.5" width="16" height="3" fill="#ff5a2a"/>',
         f'<line x1="62" y1="16" x2="62" y2="54" stroke="#6a6e7c" stroke-width="2.5"/>',
         # kalkan
         f'<path d="M70 62 H100 V82 Q100 102 85 108 Q70 102 70 82 Z" fill="url(#black)" {stroke()}/>',
         f'<path d="M74 66 H96 V82 Q96 98 85 103 Q74 98 74 82 Z" fill="url(#red)" {stroke(2)}/>',
         f'<circle cx="85" cy="80" r="7" fill="#f0ead8" {stroke(2)}/>'
         f'<circle cx="82.5" cy="79" r="1.8" fill="{OUT}"/><circle cx="87.5" cy="79" r="1.8" fill="{OUT}"/>']
    return svg(120, 120, ''.join(b))


def troll():
    b = [leg(44, 92, 114, 'url(#troll)', '#3a4a58', 18), leg(74, 92, 116, 'url(#troll)', '#3a4a58', 18),
         f'<path d="M14 70 Q6 100 20 104 Q28 100 26 78 Z" fill="url(#troll)" {stroke()}/>',
         f'<path d="M20 98 Q10 46 50 38 Q84 34 98 60 Q104 80 100 98 Z" fill="url(#troll)" {stroke()}/>',
         f'<path d="M36 96 Q34 66 60 62 Q86 66 84 96 Z" fill="#c9d6e0" opacity="0.45"/>',
         f'<path d="M30 96 L36 84 H86 L92 96 L80 104 L70 96 L58 106 L46 96 L38 104 Z" fill="url(#brown)" {stroke(3)}/>',
         f'<circle cx="84" cy="44" r="17" fill="url(#troll)" {stroke()}/>',
         eye(86, 39, 3.6, '#2a0a00', '#ffb03a'), eye(96, 39, 3.4, '#2a0a00', '#ffb03a'),
         f'<path d="M80 31 L91 35 M93 34 L101 31" stroke="{OUT}" stroke-width="4"/>',
         f'<path d="M92 43 Q104 45 98 53 Q92 53 92 47" fill="url(#troll)" {stroke(2.5)}/>',
         f'<path d="M80 56 Q90 61 98 54" fill="#2a1010" {stroke(2.5)}/>',
         f'<path d="M83 57 L84 49 L87 57 Z M93 57 L94 49 L96 56 Z" fill="#fffbe6" {stroke(1.5)}/>',
         # büyük sopa
         f'<g transform="translate(104 84) rotate(-8)"><path d="M-6 6 L-10 -56 Q0 -72 12 -56 L6 6 Z" fill="url(#wood)" {stroke()}/>'
         f'<path d="M-8 -40 l-8 -2 M-8 -52 l-7 -6 M10 -44 l8 -2 M9 -56 l6 -6" stroke="#ddd" stroke-width="3.5"/></g>',
         hand(104, 84, 'url(#troll)', 10)]
    return svg(120, 120, ''.join(b))


def soldier(militia=False):
    body = 'url(#brown)' if militia else 'url(#blue)'
    b = [leg(50, 86, 110, 'url(#brown)' if militia else 'url(#black)'), leg(66, 86, 112, 'url(#brown)' if militia else 'url(#black)')]
    if militia:
        b.append(f'<g transform="translate(88 96) rotate(-12)"><line x1="0" y1="10" x2="0" y2="-70" stroke="{OUT}" stroke-width="7"/>'
                 f'<line x1="0" y1="10" x2="0" y2="-70" stroke="#b08850" stroke-width="3.5"/>'
                 f'<path d="M-9 -70 V-88 M0 -70 V-92 M9 -70 V-88 M-9 -70 H9" fill="none" stroke="{OUT}" stroke-width="5"/>'
                 f'<path d="M-9 -70 V-88 M0 -70 V-92 M9 -70 V-88 M-9 -70 H9" fill="none" stroke="#c9ccd4" stroke-width="2.5"/></g>')
    else:
        b.append(sword(84, 80, 34, -30))
    b += [f'<path d="M40 92 Q38 62 60 60 Q82 62 80 92 Z" fill="{body}" {stroke()}/>',
          f'<rect x="40" y="80" width="40" height="6" fill="#4a2c12" {stroke(2)}/>',
          f'<circle cx="62" cy="44" r="21" fill="url(#skin)" {stroke()}/>',
          eye(68, 44, 4), eye(79, 44, 3.8),
          f'<path d="M68 56 Q74 59 80 55" fill="none" stroke="{OUT}" stroke-width="2.5"/>']
    if militia:
        b.append(f'<ellipse cx="62" cy="30" rx="34" ry="8" fill="#e6c26a" {stroke()}/>'
                 f'<path d="M44 30 Q46 10 62 10 Q78 10 80 30 Z" fill="#e6c26a" {stroke()}/>'
                 f'<path d="M44 28 H80" stroke="#b8402a" stroke-width="4"/>')
        b.append(hand(88, 82))
    else:
        b.append(f'<path d="M40 42 Q38 16 62 16 Q86 16 84 42 Z" fill="url(#grey)" {stroke()}/>'
                 f'<rect x="38" y="38" width="48" height="6" rx="3" fill="url(#grey)" {stroke(2.5)}/>'
                 f'<rect x="73" y="40" width="5" height="16" rx="2" fill="url(#grey)" {stroke(2)}/>')
        b.append(hand(84, 80))
        b.append(f'<circle cx="74" cy="80" r="17" fill="url(#blue)" {stroke()}/>'
                 f'<circle cx="74" cy="80" r="12" fill="none" stroke="url(#gold)" stroke-width="3.5"/>'
                 f'<circle cx="74" cy="80" r="4" fill="url(#gold)" {stroke(2)}/>')
    return svg(120, 120, ''.join(b))


def hero():
    b = [f'<path d="M48 58 Q20 70 14 112 Q36 104 50 110 Q50 84 60 64 Z" fill="url(#red)" {stroke()}/>',
         leg(50, 86, 112, 'url(#black)', '#3a2614', 12), leg(68, 86, 114, 'url(#black)', '#3a2614', 12),
         f'<path d="M38 94 Q36 60 60 58 Q84 60 82 94 Z" fill="url(#gold)" {stroke()}/>',
         f'<path d="M52 64 L60 84 L68 64" fill="none" stroke="#946c10" stroke-width="3"/>',
         f'<rect x="38" y="84" width="44" height="7" fill="#5a3a1e" {stroke(2)}/>'
         f'<rect x="56" y="83" width="9" height="9" fill="url(#gold)" {stroke(2)}/>',
         f'<path d="M34 66 Q30 52 48 54 L48 68 Z M86 66 Q90 52 72 54 L72 68 Z" fill="url(#gold)" {stroke(3)}/>',
         f'<circle cx="62" cy="40" r="21" fill="url(#skin)" {stroke()}/>',
         eye(68, 40, 4), eye(79, 40, 3.8),
         brow(68, 33, 8, -8), brow(79, 33, 7, -6),
         f'<path d="M68 52 Q74 55 80 50" fill="none" stroke="{OUT}" stroke-width="2.5"/>',
         f'<path d="M40 38 Q38 12 62 10 Q86 12 84 38 Q72 30 62 30 Q50 30 40 38 Z" fill="url(#grey)" {stroke()}/>',
         f'<rect x="40" y="30" width="44" height="6" rx="3" fill="url(#gold)" {stroke(2)}/>',
         f'<path d="M60 10 Q54 -6 70 -2 Q62 2 66 10 Z" fill="#f3f3ff" {stroke(2.5)}/>',
         sword(86, 78, 46, -18, 'url(#grey)', 1.05), hand(86, 78)]
    return svg(120, 120, ''.join(b))


def characters():
    return {'enemy_goblin.svg': goblin(), 'enemy_wolf.svg': wolf(), 'enemy_bandit.svg': bandit(),
            'enemy_orc.svg': orc(), 'enemy_bat.svg': bat(), 'enemy_shaman.svg': shaman(),
            'enemy_knight.svg': knight(), 'enemy_troll.svg': troll(),
            'soldier.svg': soldier(), 'militia.svg': soldier(True), 'hero.svg': hero()}


def plot():
    rnd = random.Random(3)
    b = [f'<ellipse cx="80" cy="52" rx="72" ry="38" fill="#5a4026" {stroke()}/>',
         f'<ellipse cx="80" cy="50" rx="64" ry="32" fill="url(#brown)"/>',
         f'<ellipse cx="74" cy="44" rx="40" ry="16" fill="#c79a66" opacity="0.5"/>']
    for _ in range(18):
        x, y = 80 + rnd.uniform(-50, 50), 50 + rnd.uniform(-22, 22)
        if ((x - 80) / 58) ** 2 + ((y - 50) / 28) ** 2 < 1:
            b.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rnd.uniform(1.2, 2.6):.1f}" fill="#5a3a1e" opacity="0.6"/>')
    for i in range(16):
        a = i / 16 * math.tau
        x, y = 80 + math.cos(a) * 68, 52 + math.sin(a) * 35
        b.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rnd.uniform(7, 10):.1f}" ry="{rnd.uniform(5, 7):.1f}" '
                 f'fill="url(#stone)" stroke="{OUT}" stroke-width="2.5"/>')
    return svg(160, 104, ''.join(b))


def tree(kind):
    rnd = random.Random(kind * 11)
    b = [f'<path d="M54 140 L58 96 H70 L74 140 Z" fill="url(#woodDark)" {stroke()}/>']
    if kind == 1:  # yuvarlak yapraklı
        blobs = [(64, 70, 36, 'leaf2'), (40, 84, 24, 'leaf2'), (88, 84, 24, 'leaf2'), (52, 56, 26, 'leaf1'), (78, 52, 24, 'leaf1'), (64, 38, 22, 'leaf1')]
    elif kind == 2:  # çam
        b = [f'<path d="M58 142 L60 112 H68 L70 142 Z" fill="url(#woodDark)" {stroke()}/>']
        for i, (y, w) in enumerate([(118, 52), (92, 44), (66, 34), (42, 24)]):
            b.append(f'<path d="M{64 - w} {y} Q64 {y + 8} {64 + w} {y} L64 {y - 44} Z" fill="url(#pine)" {stroke()}/>')
            b.append(f'<path d="M64 {y - 40} L{64 - w * 0.55} {y - 6}" stroke="#7fd09a" stroke-width="3" opacity="0.5"/>')
        return svg(128, 150, ''.join(b))
    else:  # geniş meşe
        blobs = [(64, 74, 40, 'leaf2'), (30, 80, 24, 'leaf2'), (98, 80, 24, 'leaf2'), (44, 56, 26, 'leaf1'), (84, 56, 26, 'leaf1'), (64, 42, 24, 'leaf1')]
    for x, y, r, g in blobs:
        b.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#{g})" {stroke()}/>')
    for x, y, r, g in blobs[3:]:
        b.append(f'<ellipse cx="{x - r * 0.3:.1f}" cy="{y - r * 0.35:.1f}" rx="{r * 0.45:.1f}" ry="{r * 0.3:.1f}" fill="#b6ec84" opacity="0.45"/>')
    for _ in range(6):
        x, y = 64 + rnd.uniform(-34, 34), 70 + rnd.uniform(-26, 20)
        b.append(f'<path d="M{x:.0f} {y:.0f} q4 -3 8 0" fill="none" stroke="#24541a" stroke-width="2" opacity="0.6"/>')
    return svg(128, 150, ''.join(b))


def rock(kind):
    if kind == 1:
        parts = [(46, 58, 36, 26), (82, 64, 26, 20), (24, 70, 18, 14)]
    else:
        parts = [(56, 60, 42, 28), (30, 72, 20, 14)]
    b = []
    for x, y, rx, ry in parts:
        b.append(f'<path d="M{x - rx} {y + ry * 0.6} Q{x - rx} {y - ry} {x - rx * 0.2} {y - ry} Q{x + rx} {y - ry * 1.1} {x + rx} {y + ry * 0.4} '
                 f'Q{x + rx * 0.6} {y + ry} {x} {y + ry} Q{x - rx * 0.7} {y + ry} {x - rx} {y + ry * 0.6} Z" fill="url(#stone)" {stroke()}/>')
        b.append(f'<path d="M{x - rx * 0.6} {y - ry * 0.55} Q{x} {y - ry * 1.05} {x + rx * 0.5} {y - ry * 0.7}" fill="none" stroke="#fff" stroke-width="3" opacity="0.45"/>')
        b.append(f'<path d="M{x - rx * 0.7} {y - ry * 0.3} Q{x - rx * 0.2} {y - ry * 0.95} {x + rx * 0.2} {y - ry * 0.85} Q{x - rx * 0.1} {y - ry * 0.4} {x - rx * 0.7} {y - ry * 0.3} Z" fill="#6fa84a" opacity="0.8"/>')
    return svg(112, 92, ''.join(b))


def environment():
    return {'plot.svg': plot(), 'tree_1.svg': tree(1), 'tree_2.svg': tree(2), 'tree_3.svg': tree(3),
            'rock_1.svg': rock(1), 'rock_2.svg': rock(2)}


if __name__ == '__main__':
    write_all()
