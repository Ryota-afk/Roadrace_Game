"""現在のPixelBikeモデル(12コマ)をPNGへ書き出す。ユーザーが描き直すための参照用。
pixelBike.jsx の BIKE / BIKE_B から文字列配列を正規表現で抜き出して描画する。

    python3 tools/render_bike_sheet.py [出力パス]

スプライトを差し替えた後も同じスクリプトで現行モデルを書き出せる（データ側の形式を
変えたときだけ extract_table の正規表現を直す）。"""
import os
import re
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src/components/sprites/pixelBike.jsx")
OUT_SHEET = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "pixelbike_current.png")

src = open(SRC, encoding="utf-8").read()

# チーム色は動的なので、見やすい代表色（青系）を仮に当てる
TEAM = (79, 143, 232)


def shade(rgb, f):
    return tuple(max(0, min(255, round(c * f))) for c in rgb)


LEGEND = {
    "K": (0x16, 0x16, 0x16), "D": (0x3e, 0x3e, 0x3e), "M": (0x70, 0x70, 0x70),
    "R": (0xa8, 0xa8, 0xa8), "W": (0xd8, 0xd8, 0xd8),
    "J": TEAM, "j": shade(TEAM, 0.68),
    "S": (0xf2, 0xc1, 0x8e), "s": (0xcd, 0x92, 0x60), "H": (0x46, 0x32, 0x23),
}


def extract_table(name):
    """const NAME = { key: [ "...", ... ], ... };  を辞書へ"""
    m = re.search(r"const %s = \{(.*?)\n\};" % name, src, re.S)
    body = m.group(1)
    out = {}
    for km in re.finditer(r"(\w+):\s*\[(.*?)\]", body, re.S):
        key = km.group(1)
        rows = re.findall(r'"([^"]*)"', km.group(2))
        out[key] = rows
    return out


A = extract_table("BIKE")
B = extract_table("BIKE_B")

POSES = ["normal_SE", "normal_NE", "dancing_SE", "dancing_NE", "sprint_SE", "sprint_NE"]
SCALE = 7          # 1マス=7px
PAD = 14
LABEL_H = 22
COLS = 6

# 最大サイズを求める
maxw = max(len(r[0]) for t in (A, B) for r in t.values())
maxh = max(len(r) for t in (A, B) for r in t.values())
cell_w = maxw * SCALE + PAD * 2
cell_h = maxh * SCALE + PAD * 2 + LABEL_H

sheet = Image.new("RGB", (cell_w * COLS, cell_h * 2), (24, 26, 32))
d = ImageDraw.Draw(sheet)

for row_i, (table, tname) in enumerate(((A, "A"), (B, "B"))):
    for col_i, pose in enumerate(POSES):
        rows = table.get(pose)
        if not rows:
            continue
        ox = col_i * cell_w
        oy = row_i * cell_h
        # ラベル
        d.text((ox + PAD, oy + 5), f"{pose}  (table {tname})", fill=(200, 205, 215))
        # 市松の下地（透明部分をわかりやすく）
        for gy in range(maxh):
            for gx in range(maxw):
                if (gx // 4 + gy // 4) % 2 == 0:
                    c = (32, 35, 42)
                else:
                    c = (28, 31, 38)
                x0 = ox + PAD + gx * SCALE
                y0 = oy + PAD + LABEL_H + gy * SCALE
                d.rectangle([x0, y0, x0 + SCALE - 1, y0 + SCALE - 1], fill=c)
        # ドット
        for gy, line in enumerate(rows):
            for gx, ch in enumerate(line):
                if ch == "." or ch not in LEGEND:
                    continue
                x0 = ox + PAD + gx * SCALE
                y0 = oy + PAD + LABEL_H + gy * SCALE
                d.rectangle([x0, y0, x0 + SCALE - 1, y0 + SCALE - 1], fill=LEGEND[ch])

sheet.save(OUT_SHEET)
print("saved", OUT_SHEET, sheet.size)
print("grid sizes:")
for tname, t in (("A", A), ("B", B)):
    for pose in POSES:
        if pose in t:
            print(f"  BIKE{'_B' if tname=='B' else ''}.{pose}: {len(t[pose][0])} x {len(t[pose])}")
