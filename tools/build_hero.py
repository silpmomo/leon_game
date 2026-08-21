"""사진 → 32px 얼굴 스프라이트.

sips 는 HEIC→PNG 변환에만 쓴다. sips 의 크롭은 표시 방향 기준으로 동작하지만
출력 픽셀은 센서 방향으로 남아서, 표준 리더로 읽으면 90도 돌아간다.
그래서 회전·크롭·양자화를 여기서 직접 한다.
"""

import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from png import read_png, rot90cw, write_png   # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, 'tools')
OUT_DIR = os.path.join(ROOT, 'public', 'sprites')
BUILD = os.path.join(TOOLS, '.build')

cfg = json.load(open(os.path.join(TOOLS, 'faces.json'), encoding='utf-8'))
photos = os.environ.get('LEON_PHOTOS', os.path.expanduser('~/Downloads'))
src_heic = os.path.join(photos, cfg['source'])

if not os.path.exists(src_heic):
    sys.exit(
        f'원본 사진이 없다: {src_heic}\n'
        f'사진을 {photos} 에 두거나, LEON_PHOTOS 환경변수로 경로를 주거나,\n'
        f'tools/faces.json 의 source 를 고쳐라.'
    )

os.makedirs(BUILD, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)
full_png = os.path.join(BUILD, 'full.png')

subprocess.run(
    ['sips', '-s', 'format', 'png', src_heic, '--out', full_png],
    check=True, capture_output=True,
)

w, h, ch, px = read_png(full_png)
print(f'원본 픽셀 {w}x{h} ch={ch}')

if cfg['rotateCw'] == 90:
    w, h, px = rot90cw(w, h, ch, px)
    print(f'90도 CW 회전 → {w}x{h}')

c = cfg['crop']
if c['x'] + c['w'] > w or c['y'] + c['h'] > h:
    sys.exit(f"크롭 {c} 이 이미지 {w}x{h} 를 벗어난다")

target_w = cfg['targetWidth']
target_h = round(c['h'] * target_w / c['w'])
levels = cfg['posterizeLevels']
step = 256 // levels


def posterize(v):
    return min(255, (v // step) * step + step // 2)


def box_average(x0, y0, bw, bh):
    total_r = total_g = total_b = count = 0
    for yy in range(y0, min(y0 + bh, h)):
        for xx in range(x0, min(x0 + bw, w)):
            o = (yy * w + xx) * ch
            total_r += px[o]
            total_g += px[o + 1]
            total_b += px[o + 2]
            count += 1
    if count == 0:
        return 0, 0, 0
    return total_r // count, total_g // count, total_b // count


mask = cfg.get('mask', {})
feather = mask.get('feather', 0)


def alpha_at(x, y):
    """타원 밖은 투명. 배경(벽)을 잘라낸다.

    머리 실루엣은 도트로 덧그리므로 타원이 머리끝을 조금 깎아도 문제없다.
    """
    if mask.get('type') != 'ellipse':
        return 255
    cx = (target_w - 1) / 2
    cy = (target_h - 1) / 2
    # 가로는 꽉 채우고 세로는 살짝 여유를 준다 (얼굴이 세로로 길다)
    rx = target_w / 2
    ry = target_h / 2
    d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
    if d <= 1.0:
        return 255
    if feather <= 0:
        return 0
    # 경계 바깥 feather 픽셀만큼 부드럽게 떨어뜨린다
    over = (d ** 0.5 - 1.0) * min(rx, ry)
    if over >= feather:
        return 0
    return int(255 * (1 - over / feather))


sx = c['w'] / target_w
sy = c['h'] / target_h
rgba = bytearray()
colors = set()
opaque = 0

for y in range(target_h):
    for x in range(target_w):
        a = alpha_at(x, y)
        if a == 0:
            rgba += bytes((0, 0, 0, 0))
            continue
        r, g, b = box_average(
            c['x'] + int(x * sx), c['y'] + int(y * sy),
            max(1, int(sx)), max(1, int(sy)),
        )
        pr, pg, pb = posterize(r), posterize(g), posterize(b)
        colors.add((pr, pg, pb))
        opaque += 1
        rgba += bytes((pr, pg, pb, a))

dst = os.path.join(OUT_DIR, 'face.png')
write_png(dst, target_w, target_h, bytes(rgba))
print(f'얼굴 스프라이트 {target_w}x{target_h}, 색 {len(colors)}종, '
      f'불투명 {opaque}/{target_w * target_h}px → '
      f'{os.path.relpath(dst, ROOT)} ({os.path.getsize(dst)} bytes)')

# 눈으로 확인할 8배 확대본
preview = os.path.join(BUILD, 'face_preview.png')
subprocess.run(
    ['sips', '-z', str(target_h * 8), str(target_w * 8), dst, '--out', preview],
    check=True, capture_output=True,
)
print(f'미리보기: {os.path.relpath(preview, ROOT)} — 8배 확대')
