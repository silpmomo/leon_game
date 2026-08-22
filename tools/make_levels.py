"""스테이지 10개(src/levels/stage-01.json ~ stage-10.json)를 생성한다.

절대 좌표를 손으로 쓰지 않는다. 적·발판은 구간 안의 상대 좌표로 적고
조립할 때 오프셋을 더한다. 체크포인트는 완성된 격자에서 "설 수 있는 열"을
찾아 자동으로 뽑는다. 이 두 가지가 좌표를 손으로 세던 시절의 버그
(체크포인트가 계단 위, 발판이 구덩이를 안 덮음)를 원천 차단한다.

격자 규약
  높이 12행. row 10·11 이 기본 지면, row 0 이 하늘 맨 위.
  땅 위에 서는 적은 y=9.

타일 문자
  .  빈칸        #  땅          B  벽돌       b  벽돌+코인
  ?  코인블록    @  복숭아블록  *  축구공블록  H  단단블록
  p  파이프상단  |  파이프몸통  o  코인
  ^  가시        ~  용암        S  점프대
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'levels')
H = 12
GROUND = (10, 11)
D = '.'

SOLID_CH = set('#BbH?@*p|SEI')

#: 달리기 점프로 넘을 수 있는 최대 구덩이 폭. engine/tuning.ts 의 derive()에서
#: 계산되는 값(7타일)보다 한 칸 좁게 잡아 여유를 둔다.
MAX_PIT = 6

#: 도움닫기 없이(제자리·걷기) 뛰어 건널 수 있는 최대 폭.
#: derive().walkReach = 90px/s × 0.8s = 72px = 4.5타일 → 4.
#: 움직이는 발판 위에서는 3타일밖에 못 달리므로 달리기 거리(MAX_PIT)를
#: 쓰면 안 된다. 발판에서 출발하는 점프는 전부 이 값을 쓴다.
MAX_HOP = 4

#: 점프로 올라설 수 있는 최대 높이(타일). 최고 점프 73px / 타일 16px = 4.57
#: → 4타일. 높이 5 파이프는 80px 를 올라야 해서 넘을 수 없다.
MAX_CLIMB = 4


class Sec:
    """레벨의 한 구간. 적·발판을 구간 안의 상대 x로 담는다."""

    def __init__(self, rows, plats=None):
        self.rows = rows
        self.w = len(rows[0])
        for i, r in enumerate(rows):
            assert len(r) == self.w, f'{i}행 폭 {len(r)} != {self.w}'
        self.ents = []
        self.plats = list(plats or [])

    def e(self, kind, relx, y=9, d=-1):
        assert 0 <= relx < self.w, f'{kind} 상대 x {relx} 가 구간 폭 {self.w} 밖'
        self.ents.append((kind, relx, y, d))
        return self

    def p(self, relx, y, axis, rng, speed):
        self.plats.append((relx, y, axis, rng, speed))
        return self


def _rows(w, spec=None, floor=None):
    spec = spec or {}
    out = []
    for r in range(H):
        if r in spec:
            line = spec[r]
        elif r in GROUND:
            line = floor if floor is not None else '#' * w
        else:
            line = D * w
        assert len(line) == w, f'{r}행 폭 {len(line)} != {w}: {line!r}'
        out.append(line)
    return out


# ── 구간 빌더 ────────────────────────────────────────────────

def flat(w):
    return Sec(_rows(w))


def coins(w, xs, row=6):
    line = list(D * w)
    for x in xs:
        line[x] = 'o'
    return Sec(_rows(w, {row: ''.join(line)}))


def blocks(w, at, row=6):
    line = list(D * w)
    for x, ch in at:
        line[x] = ch
    return Sec(_rows(w, {row: ''.join(line)}))


def pit(w, gaps):
    """gaps: [(start, len)].

    폭이 MAX_PIT 를 넘는 구덩이에는 발판을 자동으로 깐다. 손으로 발판 좌표를
    적으면 구간 오프셋이 바뀔 때마다 구덩이를 빗나가서 통과 불가 레벨이 된다.
    """
    floor = list('#' * w)
    plats = []
    for start, n in gaps:
        for i in range(start, start + n):
            assert 0 <= i < w, f'구덩이 {start}+{n} 이 구간 폭 {w} 밖'
            floor[i] = D
        if n > MAX_PIT:
            plats += _stepping_stones(start, n)
    return Sec(_rows(w, floor=''.join(floor)), plats)


def _stepping_stones(start, n):
    """넓은 구덩이를 건널 고정 발판.

    움직이는 발판으로 깔면 사람도 봇도 타이밍이 어렵고 통과 가능성을
    보장할 수 없다. 4타일 간격 고정 발판이면 걷기 점프로도 건널 수 있다.
    """
    out = []
    x = start + 2
    row = 7
    while x < start + n - 1:
        out.append((x, row, 'x', 0, 0))
        row = 6 if row == 7 else 7
        x += 4
    return out


def pipes(w, specs):
    """specs: [(x, height)] — 파이프 폭 2. 지면 행은 건드리지 않는다."""
    spec = {r: list(D * w) for r in range(10)}
    for x, ht in specs:
        assert ht <= MAX_CLIMB, (
            f'파이프 높이 {ht} 는 점프로 오를 수 있는 {MAX_CLIMB} 타일을 넘는다'
        )
        top = 10 - ht
        for i in (0, 1):
            spec[top][x + i] = 'p'
            for r in range(top + 1, 10):
                spec[r][x + i] = '|'
    return Sec(_rows(w, {r: ''.join(v) for r, v in spec.items()}))


def stairs(w, x0, height):
    spec = {r: list(D * w) for r in range(10)}
    for i in range(height):
        col = x0 + i
        assert col < w, f'계단이 구간 폭 {w} 밖'
        for r in range(max(0, 10 - (i + 1)), 10):
            spec[r][col] = '#'
    return Sec(_rows(w, {r: ''.join(v) for r, v in spec.items()}))


def ceiling(w, at, row=6):
    line = list(D * w)
    for x, n in at:
        for i in range(x, x + n):
            line[i] = 'H'
    return Sec(_rows(w, {row: ''.join(line)}))


def bridge(w, x0, n, row=6, mid=None, floor=None):
    line = list(D * w)
    for i in range(x0, x0 + n):
        line[i] = 'B'
    if mid:
        line[x0 + n // 2] = mid
    return Sec(_rows(w, {row: ''.join(line)}, floor=floor))


def lava(w, spans):
    """용암은 지면 두 줄을 모두 채운다(규칙 8). 폭이 넓으면 발판을 깐다."""
    floor = list('#' * w)
    plats = []
    for start, n in spans:
        for i in range(start, start + n):
            assert 0 <= i < w, f'용암 {start}+{n} 이 구간 폭 {w} 밖'
            floor[i] = '~'
        if n > MAX_PIT:
            plats += _stepping_stones(start, n)
    return Sec(_rows(w, floor=''.join(floor)), plats)


def spikes(w, xs):
    """가시는 반드시 지면 위(row 9)에 붙인다(규칙 9)."""
    line = list(D * w)
    for x in xs:
        line[x] = '^'
    return Sec(_rows(w, {9: ''.join(line)}))


def spring(w, xs):
    line = list(D * w)
    for x in xs:
        line[x] = 'S'
    return Sec(_rows(w, {9: ''.join(line)}))


def _movers(start, n, row, rng, speed):
    """구덩이를 건널 움직이는 발판을 자동 배치한다.

    좌표를 손으로 적으면 구간 폭이 바뀔 때마다 발판이 구덩이를 빗나가
    통과 불가 레벨이 된다. 고정 디딤돌(_stepping_stones)과 같은 이유로
    여기서 계산한다. 발판 하나가 쓸고 가는 범위는 [x-rng, x+rng+2] 다
    (발판 폭 3타일).
    """
    out = []
    x = start + rng
    while True:
        out.append((x, row, 'x', rng, speed))
        row = 6 if row == 7 else 7
        # 발판에서 건너편으로 뛰는 마지막 점프는 도움닫기가 없다
        if (start + n) - (x + rng + 2) - 1 <= MAX_HOP:
            break
        # 앞 발판의 오른쪽 끝과 다음 발판의 왼쪽 끝 사이가 3타일이 되게
        x += 2 * rng + 6
    return out


def _assert_crossable(start, n, plats):
    """왼쪽 가장자리 → 발판들 → 오른쪽 가장자리가 점프 거리로 이어지는가.

    첫 점프만 땅에서 출발하므로 달리기 거리(MAX_PIT)를 쓰고, 발판에서
    출발하는 나머지 점프는 도움닫기가 없어 걷기 거리(MAX_HOP)를 쓴다.
    이 구분을 안 하면 3타일짜리 발판 위에서 6타일을 뛰라는 레벨이 나온다.
    """
    spans = sorted(((x - rng, x + rng + 2) for x, _r, _a, rng, _s in plats))
    cur = start - 1
    first = True
    for x0, x1 in spans:
        gap = x0 - cur - 1
        limit = MAX_PIT if first else MAX_HOP
        assert gap <= limit, (
            f'구덩이 {start}+{n}: 발판까지 {gap}타일 — '
            f'{"달려서" if first else "발판에서"} 뛸 수 있는 {limit} 를 넘는다'
        )
        cur = max(cur, x1)
        first = False
    gap = (start + n) - cur - 1
    assert gap <= MAX_HOP, (
        f'구덩이 {start}+{n}: 마지막 발판에서 건너편까지 {gap}타일 — '
        f'도움닫기 없이 뛸 수 있는 {MAX_HOP} 를 넘는다'
    )


def cross(w, gaps, fill=D, row=7, rng=3, speed=34):
    """움직이는 발판으로 건너는 구덩이(또는 용암).

    pit() 과 달리 고정 디딤돌을 깔지 않는다. 3월드의 새 요소다 —
    엔진은 처음부터 움직이는 발판을 지원했지만 1·2월드에서는 안 썼다.
    """
    floor = list('#' * w)
    plats = []
    for start, n in gaps:
        assert start >= 1, f'구덩이가 구간 맨 앞({start})에서 시작하면 발 디딜 데가 없다'
        assert start + n < w, f'구덩이 {start}+{n} 이 구간 폭 {w} 를 넘는다'
        for i in range(start, start + n):
            floor[i] = fill
        # 좁은 구덩이에 큰 왕복폭을 주면 발판이 땅 위까지 미끄러져 나온다
        r = max(1, min(rng, (n - 3) // 2))
        ps = _movers(start, n, row, r, speed)
        _assert_crossable(start, n, ps)
        plats += ps
    return Sec(_rows(w, floor=''.join(floor)), plats)


def lift(w, specs, ledge=None):
    """세로 승강기. specs: [(x, y, rng, speed)]

    ledge: (x0, n, row) — 승강기로 올라가 닿는 벽돌 선반. 코인을 얹는다.
    승강기 꼭대기가 지면에서 MAX_CLIMB 안에 있어야 도달성 검사를 통과한다.
    """
    spec = {r: list(D * w) for r in range(10)}
    if ledge:
        lx, ln, lrow = ledge
        for i in range(lx, lx + ln):
            assert 0 <= i < w, f'선반 {lx}+{ln} 이 구간 폭 {w} 밖'
            spec[lrow][i] = 'B'
        for i in range(lx + 1, lx + ln - 1, 2):
            spec[lrow - 1][i] = 'o'
    plats = []
    for x, y, rng, speed in specs:
        top = y - rng
        assert 9 - top <= MAX_CLIMB, (
            f'승강기 꼭대기 행 {top} 은 지면에서 {9 - top}타일 — '
            f'점프로 닿는 {MAX_CLIMB} 를 넘어 탈 수가 없다'
        )
        assert top >= 1, f'승강기가 화면 위로 나간다 (행 {top})'
        plats.append((x, y, 'y', rng, speed))
    return Sec(_rows(w, {r: ''.join(v) for r, v in spec.items()}), plats)


def ice(w, gaps=None):
    """지면 전체를 얼음으로. gaps 로 구덩이도 낼 수 있다."""
    floor = list('I' * w)
    plats = []
    for start, n in (gaps or []):
        for i in range(start, start + n):
            assert 0 <= i < w, f'구덩이 {start}+{n} 이 구간 폭 {w} 밖'
            floor[i] = D
        if n > MAX_PIT:
            plats += _stepping_stones(start, n)
    return Sec(_rows(w, floor=''.join(floor)), plats)


# ── 조립 ─────────────────────────────────────────────────────

def _floor_top(tiles, tx):
    """맨 아래부터 연속 solid 스택의 최상단 행. 바닥이 비면 None"""
    if tiles[H - 1][tx] not in SOLID_CH:
        return None
    ty = H - 1
    while ty - 1 >= 0 and tiles[ty - 1][tx] in SOLID_CH:
        ty -= 1
    return ty


def _can_stand(tiles, tx):
    top = _floor_top(tiles, tx)
    if top is None or top == 0:
        return False
    above = tiles[top - 1][tx]
    return above not in SOLID_CH and above != '^' and above != '~'


def auto_checkpoints(tiles, count=4):
    """레벨을 균등 분할한 지점 근처에서 설 수 있는 열을 찾는다."""
    w = len(tiles[0])
    out = []
    for k in range(1, count + 1):
        target = round(w * k / (count + 1))
        found = None
        for d in range(0, 40):
            for tx in (target + d, target - d):
                if 0 <= tx < w and _can_stand(tiles, tx):
                    found = tx
                    break
            if found is not None:
                break
        if found is not None and found not in out:
            out.append(found)
    return sorted(out)


def stage(num, name, theme, secs, goal_back=8, flag_top=4, spawn=(3, 9)):
    tiles = [''.join(s.rows[r] for s in secs) for r in range(H)]
    w = len(tiles[0])

    entities = []
    off = 0
    for s in secs:
        for kind, relx, y, d in s.ents:
            entities.append({'type': kind, 'x': off + relx, 'y': y, 'dir': d})
        for relx, y, axis, rng, speed in s.plats:
            entities.append({
                'type': 'platform', 'x': off + relx, 'y': y,
                'axis': axis, 'range': rng, 'speed': speed,
            })
        off += s.w

    goal_x = w - goal_back
    assert _can_stand(tiles, goal_x), f'{name}: 깃대 자리 {goal_x} 에 설 수 없다'
    assert _can_stand(tiles, spawn[0]), f'{name}: 스폰 자리 {spawn[0]} 에 설 수 없다'

    return {
        'name': name,
        'id': f'stage-{num:02d}',
        'theme': theme,
        'width': w,
        'height': H,
        'spawn': {'x': spawn[0], 'y': spawn[1]},
        'goal': {'x': goal_x, 'flagTop': flag_top},
        'tiles': tiles,
        'entities': entities,
        'checkpoints': auto_checkpoints(tiles),
    }


# ── 1탄 — 기존 1-1 을 타일 단위로 그대로 재현 ─────────────────
_s1_bridge = bridge(26, 5, 5, mid='*', floor='#' * 20 + '...' + '###')

STAGE1_SECS = [
    coins(24, [9, 11, 13]).e('broccoli', 18),
    blocks(24, [(6, 'B'), (7, 'B'), (8, '@'), (9, 'B'), (10, '?')]).e('broccoli', 18),
    pipes(22, [(4, 2), (14, 4)]).e('broccoli', 10),
    pit(22, [(6, 3), (14, 5)]),
    _s1_bridge.e('soup', 6).e('soup', 14),
    ceiling(24, [(3, 2), (16, 2)]).e('crocodile', 10),
    pit(26, [(6, 10)]),
    stairs(22, 12, 4).e('broccoli', 4).e('broccoli', 7).e('crocodile', 11).e('broccoli', 18),
    flat(10),
]

stage1 = stage(1, '1-1', 'day', STAGE1_SECS, goal_back=8)


# ── 2탄 — 점프대 소개 ────────────────────────────────────────
stage2 = stage(2, '1-2', 'day', [
    coins(20, [8, 10, 12]).e('broccoli', 16),
    spring(18, [6]),
    blocks(22, [(5, 'B'), (6, '@'), (7, 'B'), (14, '?')]).e('broccoli', 18),
    pit(24, [(8, 4)]),
    spring(22, [5, 14]).e('soup', 10),
    coins(20, [4, 6, 8, 10], row=3).e('broccoli', 16),
    pipes(22, [(5, 3), (15, 4)]).e('broccoli', 10),
    pit(26, [(6, 5), (16, 4)]),
    stairs(20, 10, 5).e('broccoli', 4).e('crocodile', 7),
    flat(14).e('broccoli', 3),
])


# ── 3탄 — 나는 적 소개 ──────────────────────────────────────
stage3 = stage(3, '1-3', 'day', [
    flat(20).e('broccoli', 14),
    blocks(22, [(6, 'B'), (7, '*'), (8, 'B')]).e('flyer', 14, y=6),
    pit(24, [(9, 4)]).e('flyer', 4, y=5),
    flat(22).e('soup', 8).e('flyer', 16, y=6),
    ceiling(24, [(4, 3), (16, 3)]).e('crocodile', 10),
    pit(26, [(7, 5), (17, 5)]).e('flyer', 3, y=5).e('flyer', 13, y=7),
    spring(20, [8]).e('broccoli', 14),
    stairs(22, 12, 5).e('broccoli', 4).e('flyer', 18, y=6),
    flat(20).e('broccoli', 4),
])


# ── 4탄 — 지하, 가시 소개 ───────────────────────────────────
stage4 = stage(4, '1-4', 'underground', [
    ceiling(20, [(0, 20)], row=2).e('broccoli', 16),
    spikes(20, [10, 11]),
    blocks(22, [(6, 'b'), (7, '@'), (8, 'b')]).e('broccoli', 18),
    pit(22, [(9, 4)]),
    spikes(24, [6, 7, 8, 16, 17]).e('soup', 12),
    ceiling(22, [(3, 4), (14, 5)]).e('crocodile', 9),
    pit(24, [(8, 5)]).e('flyer', 3, y=5),
    spikes(22, [5, 6, 14, 15, 16]).e('broccoli', 10),
    stairs(20, 9, 6).e('flyer', 17, y=6),
    flat(16).e('broccoli', 4),
])


# ── 5탄 — 지하, 넓은 구덩이 릴레이 ──────────────────────────
stage5 = stage(5, '1-5', 'underground', [
    ceiling(20, [(0, 20)], row=2).e('broccoli', 15),
    blocks(20, [(6, '*'), (12, '?')]),
    pit(26, [(6, 12)]),
    spikes(22, [4, 5, 15, 16]).e('flyer', 10, y=5),
    pit(26, [(7, 11)]),
    ceiling(22, [(5, 5), (14, 4)]).e('crocodile', 10),
    spikes(24, [8, 9, 10]).e('broccoli', 18),
    spring(22, [6, 15]).e('flyer', 11, y=6),
    stairs(18, 8, 5).e('broccoli', 3),
    flat(16).e('broccoli', 5),
])


# ── 6탄 — 밤, 나는 적 밀도 ──────────────────────────────────
stage6 = stage(6, '1-6', 'night', [
    coins(20, [8, 10, 12]).e('flyer', 5, y=6).e('flyer', 15, y=4),
    blocks(22, [(5, 'B'), (6, '@'), (7, 'B'), (15, 'E')]).e('broccoli', 18),
    pit(24, [(8, 5)]).e('flyer', 3, y=5).e('flyer', 18, y=7),
    flat(20).e('soup', 8).e('crocodile', 16),
    pit(26, [(6, 5), (16, 5)]).e('flyer', 12, y=5),
    spring(22, [6, 15]).e('flyer', 11, y=6),
    ceiling(24, [(4, 4), (16, 4)]).e('broccoli', 10).e('broccoli', 13),
    pit(24, [(9, 5)]).e('flyer', 3, y=4),
    stairs(20, 10, 6).e('broccoli', 4),
    flat(18).e('crocodile', 5),
])


# ── 7탄 — 밤, 발판 릴레이 ───────────────────────────────────
stage7 = stage(7, '1-7', 'night', [
    flat(18).e('broccoli', 14),
    blocks(20, [(6, '*'), (13, 'E')]),
    pit(28, [(5, 15)]),
    flat(18).e('flyer', 8, y=5),
    pit(28, [(5, 16)]),
    spikes(20, [8, 9, 10]).e('broccoli', 16),
    ceiling(22, [(5, 5), (14, 5)]).e('crocodile', 10),
    pit(24, [(8, 6)]).e('flyer', 3, y=6),
    stairs(20, 10, 6).e('broccoli', 4),
    flat(16).e('flyer', 6, y=5).e('broccoli', 11),
])


# ── 8탄 — 성, 용암 소개 ─────────────────────────────────────
stage8 = stage(8, '1-8', 'castle', [
    ceiling(18, [(0, 18)], row=2).e('broccoli', 14),
    blocks(20, [(6, '@'), (13, 'E')]),
    lava(24, [(8, 6)]),
    flat(20).e('flyer', 8, y=5),
    lava(26, [(6, 7), (17, 6)]),
    spikes(22, [5, 6, 15, 16]).e('broccoli', 11),
    lava(24, [(9, 7)]),
    ceiling(22, [(4, 5), (14, 5)]).e('crocodile', 10),
    stairs(20, 10, 6).e('flyer', 4, y=6),
    flat(18).e('broccoli', 6),
])


# ── 9탄 — 성, 총복습 ────────────────────────────────────────
stage9 = stage(9, '1-9', 'castle', [
    ceiling(18, [(0, 18)], row=2).e('broccoli', 14).e('flyer', 8, y=5),
    blocks(20, [(6, '@'), (12, 'E')]),
    lava(24, [(7, 7)]),
    spikes(20, [6, 7, 12, 13]).e('crocodile', 16),
    lava(26, [(6, 7), (17, 6)]),
    spring(20, [6, 14]).e('flyer', 10, y=4),
    ceiling(24, [(4, 5), (15, 5)]).e('broccoli', 10).e('broccoli', 13),
    lava(24, [(8, 8)]),
    stairs(20, 10, 6).e('flyer', 4, y=5),
    flat(18).e('crocodile', 6),
])


# ── 10탄 — 보스 성 ─────────────────────────────────────────
stage10 = stage(10, '1-10', 'castle', [
    ceiling(18, [(0, 18)], row=2).e('broccoli', 14),
    blocks(20, [(6, '@'), (12, '*')]),
    lava(24, [(8, 7)]),
    spikes(20, [6, 7, 13, 14]).e('flyer', 10, y=5),
    lava(26, [(7, 8), (18, 5)]),
    # 보스 전 축구공 보급 — 두 개 두어 하나를 놓쳐도 잡을 수 있다
    blocks(22, [(5, '*'), (15, 'E')]),
    # 보스 투기장. 평지 40타일에 보스와 나는 적
    flat(40).e('boss', 20, y=9).e('flyer', 6, y=4).e('flyer', 33, y=4),
    flat(14),
], flag_top=3)


STAGES = [stage1, stage2, stage3, stage4, stage5, stage6, stage7, stage8, stage9, stage10]

# ══════════════════════════════════════════════════════════════
# 2월드 — 얼음·가시 적·던지는 적
#
# 1월드를 다 깬 사람이 오는 곳이다. 새 요소를 2-1~2-3 에서 하나씩 소개하고
# 뒤로 갈수록 겹친다. 1월드보다 적 밀도와 위험 밀도가 높다.
# ══════════════════════════════════════════════════════════════

# ── 2-1 — 얼음 소개 (미끄러짐) ───────────────────────────────
stage21 = stage(11, '2-1', 'ice', [
    coins(20, [8, 10, 12]).e('broccoli', 16),
    ice(20),                                   # 첫 얼음 — 평지에서 미끄러짐만 배운다
    ice(22, [(9, 4)]),                         # 얼음 + 구덩이
    blocks(22, [(5, 'B'), (6, '@'), (7, 'B'), (15, '?')]).e('broccoli', 18),
    ice(24, [(8, 5)]).e('broccoli', 3),
    flat(20).e('soup', 8).e('broccoli', 16),
    ice(22, [(6, 4), (15, 4)]),
    pipes(20, [(5, 3), (14, 4)]).e('broccoli', 10),
    stairs(20, 10, 5).e('broccoli', 4),
    flat(16).e('broccoli', 5),
])

# ── 2-2 — 가시 적 소개 (밟을 수 없다) ────────────────────────
stage22 = stage(12, '2-2', 'ice', [
    flat(20).e('broccoli', 15),
    blocks(22, [(6, 'B'), (7, '*'), (8, 'B')]).e('spiky', 16),
    ice(24, [(9, 4)]).e('spiky', 4),
    flat(22).e('spiky', 8).e('broccoli', 17),
    ice(24, [(7, 5)]).e('spiky', 3),
    ceiling(22, [(4, 4), (14, 4)]).e('spiky', 10).e('broccoli', 18),
    ice(24, [(8, 5)]).e('spiky', 3),
    spring(20, [8]).e('spiky', 15),
    stairs(20, 10, 5).e('spiky', 4),
    flat(16).e('broccoli', 5),
])

# ── 2-3 — 던지는 적 소개 ─────────────────────────────────────
stage23 = stage(13, '2-3', 'ice', [
    coins(20, [7, 9, 11]).e('broccoli', 16),
    blocks(22, [(6, '@'), (14, '*')]),
    flat(24).e('thrower', 12),                 # 첫 던지는 적 — 평지에서 패턴을 본다
    ice(24, [(9, 4)]).e('spiky', 4),
    flat(22).e('thrower', 10).e('broccoli', 18),
    ice(26, [(7, 6)]).e('flyer', 15, y=5),
    ceiling(24, [(4, 5), (15, 5)]).e('thrower', 10),
    ice(24, [(8, 5)]).e('spiky', 3),
    stairs(20, 10, 6).e('broccoli', 4),
    flat(18).e('thrower', 6),
])

# ── 2-4 — 지하, 얼음 + 가시 타일 ────────────────────────────
stage24 = stage(14, '2-4', 'underground', [
    ceiling(20, [(0, 20)], row=2).e('broccoli', 16),
    spikes(20, [10, 11]),
    blocks(22, [(6, 'b'), (7, '@'), (8, 'b')]).e('spiky', 18),
    ice(22, [(9, 4)]),
    spikes(24, [6, 7, 8, 16, 17]).e('thrower', 12),
    ceiling(22, [(3, 4), (14, 5)]).e('spiky', 9),
    ice(24, [(8, 5)]).e('flyer', 3, y=5),
    spikes(22, [5, 6, 14, 15, 16]).e('spiky', 10),
    stairs(20, 9, 6).e('flyer', 17, y=6),
    flat(16).e('thrower', 5),
])

# ── 2-5 — 지하, 넓은 구덩이 + 던지는 적 ─────────────────────
stage25 = stage(15, '2-5', 'underground', [
    ceiling(20, [(0, 20)], row=2).e('broccoli', 15),
    blocks(20, [(6, 'E'), (12, '?')]),
    pit(26, [(6, 12)]).e('thrower', 22),
    spikes(22, [4, 5, 15, 16]).e('spiky', 10),
    pit(26, [(7, 11)]).e('flyer', 22, y=5),
    ceiling(22, [(5, 5), (14, 4)]).e('crocodile', 10),
    spikes(24, [8, 9, 10]).e('thrower', 18),
    spring(22, [6, 15]).e('flyer', 11, y=6),
    stairs(18, 8, 5).e('spiky', 3),
    flat(16).e('broccoli', 5),
])

# ── 2-6 — 밤, 나는 적 + 가시 적 밀도 ────────────────────────
stage26 = stage(16, '2-6', 'night', [
    coins(20, [8, 10, 12]).e('flyer', 5, y=6).e('flyer', 15, y=4),
    blocks(22, [(5, 'B'), (6, '@'), (7, 'E')]).e('spiky', 18),
    pit(24, [(8, 5)]).e('flyer', 3, y=5).e('flyer', 18, y=7),
    ice(22).e('spiky', 6).e('spiky', 16),
    pit(26, [(6, 5), (16, 5)]).e('flyer', 12, y=5),
    spring(22, [6, 15]).e('thrower', 11),
    ceiling(24, [(4, 4), (16, 4)]).e('spiky', 10).e('broccoli', 13),
    pit(24, [(9, 5)]).e('flyer', 3, y=4),
    stairs(20, 10, 6).e('spiky', 4),
    flat(18).e('crocodile', 5),
])

# ── 2-7 — 밤, 얼음 발판 릴레이 ──────────────────────────────
stage27 = stage(17, '2-7', 'night', [
    flat(18).e('broccoli', 14),
    blocks(20, [(6, '*'), (13, 'E')]),
    pit(28, [(5, 15)]).e('flyer', 24, y=5),
    ice(18).e('spiky', 8),
    pit(28, [(5, 16)]).e('flyer', 24, y=6),
    spikes(20, [8, 9, 10]).e('thrower', 16),
    ceiling(22, [(5, 5), (14, 5)]).e('crocodile', 10),
    ice(24, [(8, 6)]).e('flyer', 3, y=6),
    stairs(20, 10, 6).e('spiky', 4),
    flat(16).e('flyer', 6, y=5).e('broccoli', 11),
])

# ── 2-8 — 성, 용암 + 던지는 적 ──────────────────────────────
stage28 = stage(18, '2-8', 'castle', [
    ceiling(18, [(0, 18)], row=2).e('broccoli', 14),
    blocks(20, [(6, '@'), (13, 'E')]),
    lava(24, [(8, 6)]).e('thrower', 20),
    flat(20).e('flyer', 8, y=5).e('spiky', 16),
    lava(26, [(6, 7), (17, 6)]),
    spikes(22, [5, 6, 15, 16]).e('spiky', 11),
    lava(24, [(9, 7)]),
    ceiling(22, [(4, 5), (14, 5)]).e('crocodile', 10),
    stairs(20, 10, 6).e('thrower', 4),
    flat(18).e('spiky', 6),
])

# ── 2-9 — 성, 총복습 ────────────────────────────────────────
stage29 = stage(19, '2-9', 'castle', [
    ceiling(18, [(0, 18)], row=2).e('broccoli', 14).e('flyer', 8, y=5),
    blocks(20, [(6, '@'), (12, 'E')]),
    lava(24, [(7, 7)]).e('thrower', 20),
    spikes(20, [6, 7, 12, 13]).e('crocodile', 16),
    lava(26, [(6, 7), (17, 6)]),
    ice(20).e('spiky', 6).e('spiky', 14),
    ceiling(24, [(4, 5), (15, 5)]).e('thrower', 10).e('spiky', 18),
    lava(24, [(8, 8)]),
    stairs(20, 10, 6).e('flyer', 4, y=5),
    flat(18).e('crocodile', 6),
])

# ── 2-10 — 보스 재대결 (호위 포함) ──────────────────────────
stage210 = stage(20, '2-10', 'castle', [
    ceiling(18, [(0, 18)], row=2).e('spiky', 14),
    blocks(20, [(6, '@'), (12, 'E')]),
    lava(24, [(8, 7)]).e('thrower', 20),
    spikes(20, [6, 7, 13, 14]).e('flyer', 10, y=5),
    lava(26, [(7, 8), (18, 5)]),
    # 보스 전 보급 — 축구공과 전기 둘 다
    blocks(22, [(5, '*'), (15, 'E')]),
    # 투기장. 보스에 던지는 적 호위가 붙는다
    flat(44).e('boss', 22, y=9).e('thrower', 4).e('thrower', 38)
             .e('flyer', 12, y=4).e('flyer', 32, y=4),
    flat(14),
], flag_top=3)


STAGES += [stage21, stage22, stage23, stage24, stage25,
           stage26, stage27, stage28, stage29, stage210]


# ══════════════════════════════════════════════════════════════
# 3월드 — 움직이는 발판
#
# 엔진은 처음부터 움직이는 발판을 지원했지만 1·2월드에서는 한 번도 쓰지
# 않았다. 3월드의 새 요소가 이것이다. 3-1 에서 적 없이 하나만 놓고 배우게
# 하고, 뒤로 갈수록 용암 위·얼음 위로 옮겨 간다. 세로 승강기는 점프로는
# 절대 닿지 않는 선반(코인)을 열어 준다.
# ══════════════════════════════════════════════════════════════

# ── 3-1 — 구름 위, 움직이는 발판 소개 ───────────────────────
stage31 = stage(21, '3-1', 'cloud', [
    coins(20, [8, 10, 12]).e('broccoli', 16),
    cross(24, [(8, 9)]),                       # 첫 발판 — 적 없이 타는 법만
    blocks(22, [(5, 'B'), (6, '@'), (7, 'B'), (15, '?')]).e('broccoli', 18),
    cross(26, [(6, 12)]).e('flyer', 22, y=5),
    flat(20).e('soup', 8).e('broccoli', 16),
    lift(24, [(9, 7, 2, 30)], ledge=(13, 8, 4)),
    pipes(20, [(5, 3), (14, 4)]).e('broccoli', 10),
    cross(26, [(6, 8), (17, 6)]),
    stairs(20, 10, 5).e('broccoli', 4),
    flat(16).e('broccoli', 5),
])

# ── 3-2 — 구름 위, 발판 + 나는 적 ───────────────────────────
stage32 = stage(22, '3-2', 'cloud', [
    flat(20).e('broccoli', 15),
    blocks(22, [(6, 'B'), (7, '*'), (8, 'B')]).e('flyer', 16, y=5),
    cross(26, [(6, 12)]).e('flyer', 22, y=4),
    coins(20, [5, 7, 9], row=3).e('broccoli', 16),
    cross(28, [(6, 14)]).e('flyer', 24, y=6),
    lift(22, [(8, 7, 2, 34)], ledge=(12, 8, 4)).e('spiky', 4),
    ceiling(24, [(4, 4), (16, 4)]).e('crocodile', 10),
    cross(26, [(7, 10)]).e('flyer', 21, y=5),
    stairs(20, 10, 5).e('broccoli', 4),
    flat(16).e('flyer', 6, y=5).e('broccoli', 11),
])

# ── 3-3 — 구름 위, 승강기 + 가시 적 ─────────────────────────
stage33 = stage(23, '3-3', 'cloud', [
    coins(20, [7, 9, 11]).e('spiky', 16),
    blocks(22, [(6, '@'), (14, 'E')]),
    lift(24, [(7, 7, 2, 30), (16, 7, 2, 38)], ledge=(11, 5, 4)).e('spiky', 3),
    cross(26, [(6, 12)]).e('flyer', 22, y=5),
    flat(22).e('thrower', 10).e('spiky', 18),
    cross(28, [(6, 9), (18, 7)]).e('flyer', 3, y=4),
    lift(22, [(9, 7, 2, 40)], ledge=(13, 7, 4)).e('spiky', 4),
    ceiling(24, [(4, 5), (15, 5)]).e('thrower', 10),
    stairs(20, 10, 6).e('spiky', 4),
    flat(18).e('broccoli', 6),
])

# ── 3-4 — 지하, 발판 + 가시 타일 ────────────────────────────
stage34 = stage(24, '3-4', 'underground', [
    ceiling(20, [(0, 20)], row=2).e('broccoli', 16),
    spikes(20, [9, 10, 11]),
    blocks(22, [(6, 'b'), (7, '@'), (8, 'b')]).e('spiky', 18),
    cross(26, [(6, 11)]).e('flyer', 22, y=5),
    spikes(24, [5, 6, 7, 16, 17]).e('thrower', 12),
    cross(26, [(7, 12)]),
    ceiling(22, [(3, 4), (14, 5)]).e('spiky', 9),
    cross(24, [(6, 9)]).e('flyer', 20, y=6),
    spikes(22, [5, 6, 14, 15, 16]).e('spiky', 10),
    stairs(20, 9, 6).e('flyer', 17, y=6),
    flat(16).e('thrower', 5),
])

# ── 3-5 — 지하, 용암 위 발판 릴레이 ─────────────────────────
stage35 = stage(25, '3-5', 'underground', [
    ceiling(20, [(0, 20)], row=2).e('broccoli', 15),
    blocks(20, [(6, '*'), (12, 'E')]),
    cross(28, [(6, 14)], fill='~'),            # 첫 용암 위 발판
    spikes(22, [4, 5, 15, 16]).e('spiky', 10),
    cross(30, [(6, 16)], fill='~').e('flyer', 25, y=5),
    ceiling(22, [(5, 5), (14, 4)]).e('crocodile', 10),
    cross(26, [(6, 8), (17, 6)], fill='~').e('thrower', 3),
    spring(22, [6, 15]).e('flyer', 11, y=6),
    stairs(18, 8, 5).e('spiky', 3),
    flat(16).e('broccoli', 5),
])

# ── 3-6 — 얼음, 미끄러지며 발판 타기 ────────────────────────
stage36 = stage(26, '3-6', 'ice', [
    coins(20, [8, 10, 12]).e('broccoli', 16),
    ice(20).e('spiky', 14),
    cross(26, [(6, 12)]).e('flyer', 22, y=5),
    ice(22, [(9, 4)]).e('spiky', 3),
    cross(28, [(6, 14)]).e('flyer', 24, y=6),
    lift(22, [(9, 7, 2, 36)], ledge=(13, 7, 4)).e('spiky', 4),
    ice(24, [(7, 5)]).e('thrower', 17),
    cross(26, [(7, 10)]).e('flyer', 21, y=4),
    stairs(20, 10, 6).e('spiky', 4),
    flat(18).e('broccoli', 6),
])

# ── 3-7 — 밤, 발판 + 적 밀도 ────────────────────────────────
stage37 = stage(27, '3-7', 'night', [
    coins(20, [8, 10, 12]).e('flyer', 5, y=6).e('flyer', 15, y=4),
    blocks(22, [(5, 'B'), (6, '@'), (7, 'E')]).e('spiky', 18),
    cross(28, [(6, 14)]).e('flyer', 24, y=5),
    ice(22).e('spiky', 6).e('spiky', 16),
    cross(30, [(6, 16)]).e('flyer', 25, y=6),
    spring(22, [6, 15]).e('thrower', 11),
    lift(24, [(8, 7, 2, 42)], ledge=(12, 9, 4)).e('spiky', 4),
    cross(26, [(7, 11)]).e('flyer', 22, y=4),
    stairs(20, 10, 6).e('spiky', 4),
    flat(18).e('crocodile', 5),
])

# ── 3-8 — 성, 용암 위 발판 + 승강기 ─────────────────────────
stage38 = stage(28, '3-8', 'castle', [
    ceiling(18, [(0, 18)], row=2).e('broccoli', 14),
    blocks(20, [(6, '@'), (13, 'E')]),
    cross(28, [(6, 14)], fill='~').e('thrower', 24),
    flat(20).e('flyer', 8, y=5).e('spiky', 16),
    cross(30, [(6, 9), (19, 8)], fill='~'),
    lift(22, [(9, 7, 2, 44)], ledge=(13, 7, 4)).e('spiky', 4),
    cross(26, [(7, 12)], fill='~').e('flyer', 22, y=5),
    ceiling(22, [(4, 5), (14, 5)]).e('crocodile', 10),
    stairs(20, 10, 6).e('thrower', 4),
    flat(18).e('spiky', 6),
])

# ── 3-9 — 성, 총복습 ────────────────────────────────────────
stage39 = stage(29, '3-9', 'castle', [
    ceiling(18, [(0, 18)], row=2).e('broccoli', 14).e('flyer', 8, y=5),
    blocks(20, [(6, '@'), (12, 'E')]),
    cross(28, [(6, 14)], fill='~').e('thrower', 24),
    spikes(20, [6, 7, 12, 13]).e('crocodile', 16),
    cross(30, [(6, 16)], fill='~').e('flyer', 25, y=4),
    ice(20).e('spiky', 6).e('spiky', 14),
    lift(24, [(8, 7, 2, 46), (17, 7, 2, 34)], ledge=(12, 5, 4)),
    ceiling(24, [(4, 5), (15, 5)]).e('thrower', 10).e('spiky', 18),
    cross(26, [(7, 12)], fill='~'),
    stairs(20, 10, 6).e('flyer', 4, y=5),
    flat(18).e('crocodile', 6),
])

# ── 3-10 — 최종전. 보스 둘 ──────────────────────────────────
stage310 = stage(30, '3-10', 'castle', [
    ceiling(18, [(0, 18)], row=2).e('spiky', 14),
    blocks(20, [(6, '@'), (12, 'E')]),
    cross(28, [(6, 14)], fill='~').e('thrower', 24),
    spikes(20, [6, 7, 13, 14]).e('flyer', 10, y=5),
    cross(30, [(6, 9), (19, 8)], fill='~').e('flyer', 15, y=4),
    # 최종전 보급 — 축구공 둘, 전기 하나. 보스가 둘이라 넉넉히 준다
    blocks(24, [(4, '*'), (11, 'E'), (18, '*')]),
    # 투기장 1 — 첫 보스
    flat(34).e('boss', 18, y=9).e('flyer', 6, y=4).e('thrower', 30),
    # 중간 보급
    blocks(18, [(5, '*'), (12, 'E')]),
    # 투기장 2 — 두 번째 보스에 호위가 붙는다
    flat(38).e('boss', 20, y=9).e('spiky', 5).e('thrower', 34)
             .e('flyer', 11, y=4).e('flyer', 30, y=5),
    flat(14),
], flag_top=3)


STAGES += [stage31, stage32, stage33, stage34, stage35,
           stage36, stage37, stage38, stage39, stage310]


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    print('스테이지 생성:')
    for lv in STAGES:
        with open(os.path.join(OUT, f'{lv["id"]}.json'), 'w', encoding='utf-8') as fp:
            json.dump(lv, fp, indent=2, ensure_ascii=False)
            fp.write('\n')
        ents = [e for e in lv['entities'] if e['type'] != 'platform']
        plats = len(lv['entities']) - len(ents)
        hazards = sum(row.count('^') + row.count('~') for row in lv['tiles'])
        print(f'  {lv["id"]}  {lv["name"]:>4}  {lv["theme"]:<11} '
              f'폭 {lv["width"]:>3}  적 {len(ents):>2}  발판 {plats:>2}  '
              f'위험 {hazards:>2}  체크포인트 {lv["checkpoints"]}')
    print(f'\n총 {len(STAGES)}탄')
