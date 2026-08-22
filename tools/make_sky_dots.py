"""리온의 하늘전투 도트 정의를 만든다 → tools/dot/sky*.json

기존 게임 스프라이트는 건드리지 않는다. build_atlas.py 가 tools/dot/*.json 을
전부 긁어가므로 여기서 만든 파일만 추가로 시트에 들어간다.

행을 손으로 찍는 대신 도형(타원·사각·선)을 래스터한다. 20장을 한 줄씩
치면 반드시 어긋난다 — 폭 assert 에 걸려 시간만 버린다.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_dots import dump, rows  # noqa: E402

# 하늘전투 공용 팔레트. 인덱스는 36진 한 글자
PAL = [
    '#00000000',  # 0 투명
    '#4bc0ae',    # 1 민트
    '#3aa294',    # 2 민트 어두움
    '#ffffff',    # 3 흰색
    '#ece3cf',    # 4 아이보리
    '#f0c9a4',    # 5 살색
    '#3c4460',    # 6 남색 (신발·기계 몸통)
    '#14110f',    # 7 외곽선
    '#e05c4a',    # 8 빨강
    '#a83a2c',    # 9 빨강 어두움
    '#ffd166',    # a 노랑
    '#c46b00',    # b 호박
    '#7fb6e8',    # c 하늘
    '#3d78b4',    # d 하늘 어두움
    '#9ad86b',    # e 연두
    '#6a4fa8',    # f 보라
]


class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.g = [['0'] * w for _ in range(h)]

    def px(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.g[y][x] = c

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.g[y][x]
        return '0'

    def rect(self, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.px(x, y, c)

    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(self.h):
            for x in range(self.w):
                dx = (x - cx) / max(rx, .01)
                dy = (y - cy) / max(ry, .01)
                if dx * dx + dy * dy <= 1.0:
                    self.px(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            t = i / n
            self.px(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, c)

    def tri(self, pts, c):
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        (ax, ay), (bx, by), (cx2, cy2) = pts
        det = (by - cy2) * (ax - cx2) + (cx2 - bx) * (ay - cy2)
        if det == 0:
            return
        for y in range(int(min(ys)), int(max(ys)) + 1):
            for x in range(int(min(xs)), int(max(xs)) + 1):
                w1 = ((by - cy2) * (x - cx2) + (cx2 - bx) * (y - cy2)) / det
                w2 = ((cy2 - ay) * (x - cx2) + (ax - cx2) * (y - cy2)) / det
                if w1 >= -.02 and w2 >= -.02 and w1 + w2 <= 1.02:
                    self.px(x, y, c)

    def outline(self, c='7'):
        """불투명 픽셀 바깥 한 겹에 외곽선을 두른다. 작은 스프라이트가
        배경에서 떨어져 보이려면 반드시 필요하다."""
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.g[y][x] != '0':
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if self.get(x + dx, y + dy) not in ('0', c):
                        add.append((x, y))
                        break
        for x, y in add:
            self.px(x, y, c)
        return self

    def rows(self):
        return rows(self.w, *[''.join(r) for r in self.g])


# ── 리온 비행 몸통 18x12 ─────────────────────────────────────
# 얼굴(atlas 'face')은 렌더러가 오른쪽 위에 따로 얹는다. 여기는 목 아래만.
def body(flap):
    """flap: 0,1,2 — 망토와 다리가 나부끼는 단계

    처음엔 18x12 에 선(line)으로 다리를 그렸더니 외곽선이 전부 삼켜
    검은 덩어리가 됐다. 크기를 20x14 로 올리고 1px 선을 없앴다.
    """
    g = Grid(20, 14)
    s = (-1, 0, 1)[flap]

    # 망토 — 뒤로 길게 나부낀다. 난다는 걸 이걸로 알린다
    g.tri([(0, 3 + s), (10, 2), (10, 9)], '8')
    g.tri([(0, 6 + s), (9, 5), (9, 10)], '9')

    # 다리 (뒤로 뻗음) — 두 칸 두께라야 외곽선을 두르고도 남는다
    g.rect(4, 7 + s, 9, 8 + s, '5')
    g.rect(4, 10 + s, 9, 11 + s, '5')
    g.rect(1, 7 + s, 4, 9 + s, '6')
    g.rect(1, 10 + s, 4, 12 + s, '6')

    # 반바지
    g.ellipse(8, 8.5, 3.0, 2.6, '4')

    # 몸통
    g.ellipse(12, 7, 5.4, 3.6, '1')
    g.ellipse(10.5, 8.4, 4.0, 2.2, '2')
    g.rect(15, 4, 17, 7, '3')                # 흰 카라

    # 앞으로 뻗은 팔 + 목
    g.rect(15, 3, 19, 4, '5')
    g.rect(14, 1, 17, 3, '5')

    g.outline()
    return g.rows()


# ── 새 12x10 ─────────────────────────────────────────────────
def bird(up):
    g = Grid(12, 10)
    g.ellipse(6, 5, 3.4, 2.4, 'c')
    g.ellipse(3, 5, 1.8, 1.6, 'd')          # 꼬리
    g.tri([(2, 2), (10, 1), (11, 4)], 'a')  # 부리 쪽 밝게
    if up:
        g.tri([(4, 4), (7, 0), (9, 4)], '3')
    else:
        g.tri([(4, 6), (7, 9), (9, 6)], '3')
    g.px(9, 4, '7')                          # 눈
    g.tri([(10, 4), (11, 5), (10, 6)], 'a')  # 부리
    g.outline()
    return g.rows()


# ── 벌 12x10 ─────────────────────────────────────────────────
def bee(up):
    """줄무늬를 세 줄 넣었더니 몸통이 거의 다 어두워졌다. 두 줄로 줄인다."""
    g = Grid(12, 10)
    g.ellipse(6, 6, 4.0, 2.8, 'a')
    for x in (5, 8):
        g.rect(x, 3, x, 9, '6')
    g.ellipse(9.5, 5.5, 1.6, 1.8, '6')
    g.px(10, 5, '3')
    if up:
        g.ellipse(4.5, 3, 2.6, 1.2, '3')
    else:
        g.ellipse(4.5, 8, 2.6, 1.2, '3')
    g.rect(1, 6, 2, 6, '6')
    g.outline()
    return g.rows()


# ── 연 14x14 ─────────────────────────────────────────────────
def kite(swing):
    """마름모 두 쪽 사이에 1px 틈이 생겨 외곽선이 파고들었다.
    한 덩어리로 칠하고 그 위에 살만 얹는다."""
    g = Grid(14, 14)
    g.tri([(9, 0), (13, 7), (9, 13)], 'f')
    g.tri([(9, 0), (3, 7), (9, 13)], 'f')
    g.tri([(8, 1), (3, 7), (8, 12)], '8')
    g.rect(8, 1, 9, 12, 'a')                 # 세로 살
    g.rect(4, 6, 12, 7, 'a')                 # 가로 살
    t = 1 if swing else -1
    g.rect(1, 7 + 2 * t, 3, 8 + 2 * t, '3')  # 꼬리
    g.px(11, 6, '3')
    g.px(11, 8, '3')
    g.outline()
    return g.rows()


# ── 접시 16x10 ───────────────────────────────────────────────
def ufo(lit):
    g = Grid(16, 10)
    g.ellipse(8, 6, 7.2, 2.2, 'd')
    g.ellipse(8, 5, 5.4, 2.0, 'c')
    g.ellipse(8, 3, 3.2, 2.2, '3')           # 돔
    g.ellipse(8, 3.4, 2.2, 1.4, 'f')
    for i, x in enumerate((2, 5, 8, 11, 14)):
        on = (i % 2 == 0) == lit
        g.px(x, 7, 'a' if on else 'b')
    g.outline()
    return g.rows()


# ── 로켓 16x8 ────────────────────────────────────────────────
def rocket(flame):
    g = Grid(16, 8)
    g.rect(4, 2, 12, 5, '3')
    g.tri([(12, 1), (15, 3.5), (12, 6)], '8')
    g.rect(6, 2, 7, 5, '9')
    g.tri([(6, 2), (3, 0), (6, 0)], '6')     # 꼬리날개
    g.tri([(6, 5), (3, 7), (6, 7)], '6')
    if flame:
        g.tri([(4, 2), (0, 3.5), (4, 5)], 'a')
        g.tri([(4, 3), (2, 3.5), (4, 4)], '3')
    else:
        g.tri([(4, 2.5), (1, 3.5), (4, 4.5)], 'b')
    g.outline()
    return g.rows()


# ── 포탑 16x12 ───────────────────────────────────────────────
def turret(fire):
    g = Grid(16, 12)
    g.rect(2, 8, 14, 11, '6')                # 받침
    g.rect(3, 9, 13, 10, 'b')
    g.ellipse(9, 7, 4.2, 3.2, 'd')
    g.ellipse(9, 6.4, 3.0, 2.2, 'c')
    g.rect(1, 6, 6, 7, '6')                  # 포신
    if fire:
        g.ellipse(0.5, 6.5, 2.0, 1.8, 'a')
        g.px(0, 6, '3')
    g.px(10, 6, 'a')
    g.outline()
    return g.rows()


# ── 비행선 28x16 ─────────────────────────────────────────────
def blimp(lit):
    g = Grid(28, 16)
    g.ellipse(14, 7, 12.5, 5.4, '4')
    g.ellipse(14, 5.5, 11.0, 3.2, '3')
    g.rect(9, 6, 19, 8, '8')                 # 띠
    g.tri([(2, 2), (1, 7), (2, 12)], '9')     # 꼬리날개 (뒤쪽=왼쪽)
    g.rect(10, 12, 18, 14, '6')              # 곤돌라
    g.rect(11, 13, 17, 13, 'b')
    for i, x in enumerate((11, 14, 17)):
        on = (i % 2 == 0) == lit
        g.px(x, 14, 'a' if on else '9')
    g.px(24, 6, 'a')                         # 앞 눈 (앞쪽=오른쪽)
    g.outline()
    return g.rows()


# ── 아이템 12x12 ─────────────────────────────────────────────
def item_power():
    g = Grid(12, 12)
    g.ellipse(6, 6, 5.4, 5.4, 'b')
    g.ellipse(6, 6, 4.2, 4.2, 'a')
    # 力 대신 위로 향한 화살표 — 아이가 바로 알아본다
    g.tri([(6, 2), (2, 6), (10, 6)], '8')
    g.rect(4, 6, 8, 9, '8')
    g.outline()
    return g.rows()


def item_bomb():
    g = Grid(12, 12)
    g.ellipse(6, 6, 5.4, 5.4, 'd')
    g.ellipse(6, 6, 4.2, 4.2, 'c')
    # 번개 — 궁극기가 번개라서 아이콘도 번개로 맞춘다
    g.tri([(7, 1), (3, 7), (7, 7)], 'a')
    g.tri([(5, 11), (9, 5), (5, 5)], 'a')
    g.outline()
    return g.rows()


def item_coin():
    g = Grid(12, 12)
    g.ellipse(6, 6, 5.2, 5.2, 'b')
    g.ellipse(6, 6, 4.0, 4.2, 'a')
    g.rect(5, 3, 6, 9, 'b')
    g.outline()
    return g.rows()


# ── 아군 탄 8x8 / 적탄은 절차적으로 그린다 ───────────────────
def shot_dot():
    """아군 탄. 적탄(둥근 색 구슬)과 절대 헷갈리면 안 되므로
    가로로 길쭉한 청록 대시로 만든다. 노란색은 적탄이 쓴다."""
    g = Grid(10, 6)
    g.ellipse(5, 3, 4.4, 1.4, 'c')
    g.ellipse(5.5, 3, 3.0, 0.9, '3')
    g.rect(1, 3, 3, 3, 'c')
    return g.rows()


def missile_dot():
    g = Grid(10, 6)
    g.rect(2, 2, 7, 3, '3')
    g.tri([(7, 1), (9, 2.5), (7, 4)], '8')
    g.tri([(2, 1), (0, 2.5), (2, 4)], 'a')
    g.outline()
    return g.rows()


if __name__ == '__main__':
    print('하늘전투 도트 생성:')
    dump('sky_body', 20, 14, PAL, [body(0), body(1), body(2)],
         ['skyBody0', 'skyBody1', 'skyBody2'])
    dump('sky_bird', 12, 10, PAL, [bird(True), bird(False)], ['skyBird0', 'skyBird1'])
    dump('sky_bee', 12, 10, PAL, [bee(True), bee(False)], ['skyBee0', 'skyBee1'])
    dump('sky_kite', 14, 14, PAL, [kite(True), kite(False)], ['skyKite0', 'skyKite1'])
    dump('sky_ufo', 16, 10, PAL, [ufo(True), ufo(False)], ['skyUfo0', 'skyUfo1'])
    dump('sky_rocket', 16, 8, PAL, [rocket(True), rocket(False)],
         ['skyRocket0', 'skyRocket1'])
    dump('sky_turret', 16, 12, PAL, [turret(False), turret(True)],
         ['skyTurret0', 'skyTurret1'])
    dump('sky_blimp', 28, 16, PAL, [blimp(True), blimp(False)],
         ['skyBlimp0', 'skyBlimp1'])
    dump('sky_item', 12, 12, PAL, [item_power(), item_bomb(), item_coin()],
         ['skyPower', 'skyBomb', 'skyCoin'])
    dump('sky_shot', 10, 6, PAL, [shot_dot()], ['skyShot'])
    dump('sky_missile', 10, 6, PAL, [missile_dot()], ['skyMissile'])
    print('완료')
