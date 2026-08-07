"""自転車ドット絵JSONを検査・プレビュー・JSX変換する。

【経緯】当初は「AIに12コマを新規に描かせる」ための検査ツールとして作ったが、その方式は
破棄した（AIに白紙から描かせると形が崩れる。詳細はDEVLOGの該当項目）。ただし本ツールが
検査する規約（SE=前輪左/NE=前輪右の向き、下余白1行=接地、A/Bで車輪不動、行長の一致）は
スプライトの出所を問わず有効なので、参考画像から抽出した新データの検査用に残してある。
CANVAS/CONTENT定数は破棄した仕様の数値なので、新しいデータに合わせて更新してから使うこと。

    python3 tools/bike_sprites.py validate candidate.json   # 全ルールを機械検査
    python3 tools/bike_sprites.py preview  candidate.json   # PNG化して目視確認
    python3 tools/bike_sprites.py tojs     candidate.json   # 合格後、pixelBike.jsx用のJSへ変換

発注仕様は tools/BIKE_SPRITE_SPEC.md（tools/make_sprite_spec.py が生成）。
仕様の数値を変えたら、こちらの SPEC 定数も必ず合わせること。
"""
import json
import os
import re
import sys
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

LEGAL = set(".KDMRWJjSsH")
TABLES = ["BIKE", "BIKE_B"]
POSES = ["normal_SE", "normal_NE", "dancing_SE", "dancing_NE", "sprint_SE", "sprint_NE"]
ANCHOR_KEYS = ["head", "hip", "saddle", "hand", "crank", "front_wheel", "rear_wheel"]

# 仕様書 §2-3 / §5 と一致させること
CANVAS = {"normal": (38, 50), "dancing": (38, 56), "sprint": (48, 44)}
CONTENT = {                      # (h_min, h_max, w_min, w_max)  None=制約なし
    "normal":  (46, 48, 33, 37),
    "dancing": (52, None, None, 37),
    "sprint":  (None, 42, 42, None),
}

TEAM = (79, 143, 232)


def _shade(c, f):
    return tuple(max(0, min(255, round(v * f))) for v in c)


PALETTE = {
    "K": (0x16, 0x16, 0x16), "D": (0x3e, 0x3e, 0x3e), "M": (0x70, 0x70, 0x70),
    "R": (0xa8, 0xa8, 0xa8), "W": (0xd8, 0xd8, 0xd8),
    "J": TEAM, "j": _shade(TEAM, 0.68),
    "S": (0xf2, 0xc1, 0x8e), "s": (0xcd, 0x92, 0x60), "H": (0x46, 0x32, 0x23),
}


def load(path):
    """AIの出力はコードフェンスで囲まれていることが多いので剥がしてから読む。"""
    raw = open(path, encoding="utf-8").read().strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", raw, re.S)
    if m:
        raw = m.group(1).strip()
    return json.loads(raw)


def occupied(rows):
    return [(y, x) for y, r in enumerate(rows) for x, c in enumerate(r) if c != "."]


def bbox(rows):
    occ = occupied(rows)
    if not occ:
        return None
    ys = [y for y, _ in occ]
    xs = [x for _, x in occ]
    return min(ys), max(ys), min(xs), max(xs)


def islands(rows):
    """8近傍で連結成分を数え、最大成分に属さない画素数を返す（浮いたゴミの検出）。"""
    occ = set(occupied(rows))
    if not occ:
        return 0, 0
    seen = set()
    best = 0
    for start in occ:
        if start in seen:
            continue
        q = deque([start])
        seen.add(start)
        n = 0
        while q:
            y, x = q.popleft()
            n += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    p = (y + dy, x + dx)
                    if p in occ and p not in seen:
                        seen.add(p)
                        q.append(p)
        best = max(best, n)
    return len(occ) - best, len(occ)


def validate(data):
    errors, warns = [], []

    def E(m):
        errors.append(m)

    def W(m):
        warns.append(m)

    for t in TABLES:
        if t not in data:
            E(f"テーブル {t} が無い")
    if errors:
        return errors, warns

    for t in TABLES:
        for p in POSES:
            if p not in data[t]:
                E(f"{t}.{p} が無い")
    if errors:
        return errors, warns

    for t in TABLES:
        for p in POSES:
            tag = f"{t}.{p}"
            entry = data[t][p]
            if "rows" not in entry:
                E(f"{tag}: rows が無い")
                continue
            rows = entry["rows"]
            pose = p.split("_")[0]
            direction = p.split("_")[1]

            # --- 文字と行長 ---
            lens = {len(r) for r in rows}
            if len(lens) != 1:
                E(f"{tag}: 行の長さが不揃い {sorted(lens)}")
                continue
            w, h = len(rows[0]), len(rows)
            bad = sorted({c for r in rows for c in r} - LEGAL)
            if bad:
                E(f"{tag}: 使用できない文字 {bad}")

            # --- キャンバスサイズ ---
            cw, chh = CANVAS[pose]
            if (w, h) != (cw, chh):
                E(f"{tag}: キャンバスが {w}x{h}、仕様は {cw}x{chh}")

            bb = bbox(rows)
            if bb is None:
                E(f"{tag}: 空のフレーム")
                continue
            y0, y1, x0, x1 = bb
            ch, cwid = y1 - y0 + 1, x1 - x0 + 1

            # --- 接地・余白・中心 ---
            if any(c != "." for c in rows[h - 1]):
                E(f"{tag}: 最下行が空でない（接地規約：最下行は全て '.'）")
            if y1 != h - 2:
                E(f"{tag}: 最下端の描画が row={y1}、規約は row={h - 2}（下から2行目に接地）")
            if y0 == 0:
                E(f"{tag}: 最上行 row=0 に描画がある（1行以上空ける）")
            center_off = (x0 + x1) / 2 - w / 2
            if abs(center_off) > 1.0:
                E(f"{tag}: 水平中心が {center_off:+.1f} マスずれ（許容±1.0）")

            # --- 描画内容のシルエット寸法 ---
            hmin, hmax, wmin, wmax = CONTENT[pose]
            if hmin is not None and ch < hmin:
                E(f"{tag}: 内容の高さ {ch} が下限 {hmin} 未満（シルエットの描き分け不足）")
            if hmax is not None and ch > hmax:
                E(f"{tag}: 内容の高さ {ch} が上限 {hmax} 超過")
            if wmin is not None and cwid < wmin:
                E(f"{tag}: 内容の幅 {cwid} が下限 {wmin} 未満")
            if wmax is not None and cwid > wmax:
                E(f"{tag}: 内容の幅 {cwid} が上限 {wmax} 超過")

            # --- パレットの使われ方 ---
            chars = {c for r in rows for c in r}
            if "J" not in chars:
                E(f"{tag}: チームカラー J が未使用（ジャージ・ヘルメット・フレームに使う）")
            if "K" not in chars:
                E(f"{tag}: 輪郭線 K が未使用")

            # --- 浮いたゴミ ---
            stray, total = islands(rows)
            if stray > max(4, total * 0.03):
                W(f"{tag}: 本体から離れた画素が {stray}/{total} 個（描き残し・ゴミの可能性）")

            # --- アンカー ---
            anc = entry.get("anchors")
            if not isinstance(anc, dict):
                E(f"{tag}: anchors が無い")
                continue
            missing = [k for k in ANCHOR_KEYS if k not in anc]
            if missing:
                E(f"{tag}: anchors に {missing} が無い")
                continue
            ok = True
            for k in ANCHOR_KEYS:
                v = anc[k]
                if not (isinstance(v, (list, tuple)) and len(v) == 2):
                    E(f"{tag}: anchors.{k} が [row, col] 形式でない")
                    ok = False
                    continue
                ry, rx = v
                if not (0 <= ry < h and 0 <= rx < w):
                    E(f"{tag}: anchors.{k} = {v} がキャンバス外")
                    ok = False
            if not ok:
                continue
            for k in ("head", "hip"):
                ry, rx = anc[k]
                if rows[ry][rx] == ".":
                    E(f"{tag}: anchors.{k} = {anc[k]} が透明画素を指している（申告と絵が不一致）")

            head, hip, saddle = anc["head"], anc["hip"], anc["saddle"]
            fw, rw = anc["front_wheel"], anc["rear_wheel"]

            # --- 向き（最重要） ---
            if direction == "SE" and not fw[1] < rw[1]:
                E(f"{tag}: SEは前輪が左でなければならない（front_wheel.col={fw[1]} >= rear_wheel.col={rw[1]}）")
            if direction == "NE" and not fw[1] > rw[1]:
                E(f"{tag}: NEは前輪が右でなければならない（front_wheel.col={fw[1]} <= rear_wheel.col={rw[1]}）")

            # --- 姿勢ごとの必須条件 ---
            if pose == "normal":
                if abs(hip[0] - saddle[0]) > 2:
                    E(f"{tag}: normalは腰がサドル上（|hip.row-saddle.row|={abs(hip[0]-saddle[0])} > 2）")
            elif pose == "dancing":
                if hip[0] > saddle[0] - 4:
                    E(f"{tag}: dancingは腰がサドルより4マス以上高いこと（hip.row={hip[0]}, saddle.row={saddle[0]}）")
            elif pose == "sprint":
                if head[0] < hip[0] - 8:
                    E(f"{tag}: sprintは背中が水平寄り（head.row={head[0]} が hip.row-8={hip[0]-8} より高い）")
                if abs(head[1] - hip[1]) < 8:
                    E(f"{tag}: sprintは頭が前に出ること（|head.col-hip.col|={abs(head[1]-hip[1])} < 8）")

    # --- A/B の整合 ---
    for p in POSES:
        try:
            a, b = data["BIKE"][p], data["BIKE_B"][p]
        except KeyError:
            continue
        if "rows" not in a or "rows" not in b:
            continue
        if (len(a["rows"][0]), len(a["rows"])) != (len(b["rows"][0]), len(b["rows"])):
            E(f"{p}: A と B でキャンバスサイズが違う")
        aa, ba = a.get("anchors"), b.get("anchors")
        if isinstance(aa, dict) and isinstance(ba, dict):
            for k in ("front_wheel", "rear_wheel", "saddle"):
                if k in aa and k in ba and list(aa[k]) != list(ba[k]):
                    E(f"{p}: A と B で {k} が動いている {aa[k]} -> {ba[k]}（車輪・サドルは不動）")
        if a.get("rows") == b.get("rows"):
            E(f"{p}: A と B が完全に同一（ペダリングが動かない）")

    return errors, warns


def render(data, out):
    from PIL import Image, ImageDraw
    S, PAD, LH = 7, 14, 22
    mw = max(len(data[t][p]["rows"][0]) for t in TABLES for p in POSES)
    mh = max(len(data[t][p]["rows"]) for t in TABLES for p in POSES)
    cw, chh = mw * S + PAD * 2, mh * S + PAD * 2 + LH
    img = Image.new("RGB", (cw * len(POSES), chh * 2), (24, 26, 32))
    d = ImageDraw.Draw(img)
    for ri, t in enumerate(TABLES):
        for ci, p in enumerate(POSES):
            rows = data[t][p]["rows"]
            ox, oy = ci * cw, ri * chh
            d.text((ox + PAD, oy + 5), f"{p}  ({t})  {len(rows[0])}x{len(rows)}", fill=(205, 210, 220))
            for gy in range(mh):
                for gx in range(mw):
                    c = (33, 36, 44) if (gx // 4 + gy // 4) % 2 == 0 else (28, 31, 38)
                    x0, y0 = ox + PAD + gx * S, oy + PAD + LH + gy * S
                    d.rectangle([x0, y0, x0 + S - 1, y0 + S - 1], fill=c)
            for gy, line in enumerate(rows):
                for gx, c in enumerate(line):
                    if c in PALETTE:
                        x0, y0 = ox + PAD + gx * S, oy + PAD + LH + gy * S
                        d.rectangle([x0, y0, x0 + S - 1, y0 + S - 1], fill=PALETTE[c])
    img.save(out)
    return img.size


def tojs(data):
    def tbl(name, key):
        lines = [f"const {name} = {{"]
        for p in POSES:
            lines.append(f"  {p}: [")
            for r in data[key][p]["rows"]:
                lines.append(f'    "{r}",')
            lines.append("  ],")
        lines.append("};")
        return "\n".join(lines)
    return tbl("BIKE", "BIKE") + "\n\n" + tbl("BIKE_B", "BIKE_B")


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    cmd, path = sys.argv[1], sys.argv[2]
    data = load(path)
    if cmd == "validate":
        errors, warns = validate(data)
        for m in warns:
            print("WARN  " + m)
        for m in errors:
            print("NG    " + m)
        if errors:
            print(f"\n✗ 不合格：{len(errors)}件のエラー（警告{len(warns)}件）")
            return 1
        print(f"\n✓ 全項目合格（警告{len(warns)}件）")
        return 0
    if cmd == "preview":
        out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ROOT, "candidate_preview.png")
        print("saved", out, render(data, out))
        return 0
    if cmd == "tojs":
        print(tojs(data))
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
