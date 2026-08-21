"""tools/dot/*.json + public/sprites/face.png → sprites.png + atlas.json"""

import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from png import read_png, write_png   # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 시트를 public/ 이 아니라 src/ 에 둔다.
# public/ 은 파일명 그대로 배포되어 해시가 붙지 않는다. 시트가 바뀌어도
# URL 이 같아서 브라우저가 옛 시트를 캐시에서 꺼내고, 번들에 박힌 새
# atlas.json 과 짝이 어긋나 모든 프레임이 엉뚱한 영역을 읽는다.
OUT_DIR = os.path.join(ROOT, 'src', 'assets', 'sprites')
PAD = 1


def parse_hex(s):
    s = s.lstrip('#')
    if len(s) == 6:
        s += 'ff'
    assert len(s) == 8, f'색 표기가 잘못됐다: {s}'
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4, 6))


def load_dots():
    """[(name, w, h, rgba_bytes)] 목록"""
    out = []
    for path in sorted(glob.glob(os.path.join(ROOT, 'tools', 'dot', '*.json'))):
        d = json.load(open(path, encoding='utf-8'))
        pal = [parse_hex(c) for c in d['palette']]
        w, h = d['w'], d['h']
        names = d.get('frameNames') or [f'{d["name"]}{i}' for i in range(len(d['frames']))]
        for i, frame in enumerate(d['frames']):
            assert len(frame) == h, f'{path} 프레임 {i} 행 수 {len(frame)} != {h}'
            buf = bytearray()
            for y, row in enumerate(frame):
                assert len(row) == w, f'{path} 프레임 {i} {y}행 길이 {len(row)} != {w}'
                for cch in row:
                    idx = int(cch, 36)
                    assert idx < len(pal), f'{path} 프레임 {i}: 팔레트 인덱스 {idx} 없음'
                    buf += bytes(pal[idx])
            out.append((names[i], w, h, bytes(buf)))
    return out


items = load_dots()
if not items:
    sys.exit('tools/dot/*.json 이 없다. python3 tools/make_dots.py 를 먼저 돌려라.')

face_path = os.path.join(ROOT, 'tools', '.build', 'face.png')
if os.path.exists(face_path):
    fw, fh, fch, fpx = read_png(face_path)
    buf = bytearray()
    for i in range(fw * fh):
        o = i * fch
        a = fpx[o + 3] if fch == 4 else 255
        buf += bytes((fpx[o], fpx[o + 1], fpx[o + 2], a))
    items.append(('face', fw, fh, bytes(buf)))
else:
    print('경고: face.png 가 없다. build_hero.py 를 먼저 돌려라.')

# 한 줄로 늘어놓는 단순 배치 — 프레임 수가 적어 최적화가 필요 없다
sheet_w = sum(w + PAD for _, w, _, _ in items) + PAD
sheet_h = max(h for _, _, h, _ in items) + PAD * 2
sheet = bytearray(sheet_w * sheet_h * 4)
frames = {}
cursor = PAD

for name, w, h, px in items:
    assert name not in frames, f'프레임 이름 중복: {name}'
    for y in range(h):
        src = y * w * 4
        dst = ((y + PAD) * sheet_w + cursor) * 4
        sheet[dst:dst + w * 4] = px[src:src + w * 4]
    frames[name] = {'x': cursor, 'y': PAD, 'w': w, 'h': h}
    cursor += w + PAD

os.makedirs(OUT_DIR, exist_ok=True)
write_png(os.path.join(OUT_DIR, 'sprites.png'), sheet_w, sheet_h, bytes(sheet))
with open(os.path.join(OUT_DIR, 'atlas.json'), 'w', encoding='utf-8') as fp:
    json.dump({'sheet': 'sprites.png', 'frames': frames}, fp, indent=2, ensure_ascii=False)
    fp.write('\n')

size = os.path.getsize(os.path.join(OUT_DIR, 'sprites.png'))
print(f'시트 {sheet_w}x{sheet_h}, 프레임 {len(frames)}개, {size} bytes')
print('프레임:', ', '.join(sorted(frames)))
