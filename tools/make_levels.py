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

SOLID_CH = set('#BbH?@*p|S')

#: 달리기 점프로 넘을 수 있는 최대 구덩이 폭. engine/tuning.ts 의 derive()에서
#: 계산되는 값(7타일)보다 한 칸 좁게 잡아 여유를 둔다.
MAX_PIT = 6

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

stage1 = stage(1, '1탄', 'day', STAGE1_SECS, goal_back=8)


# ── 2탄 — 점프대 소개 ────────────────────────────────────────
stage2 = stage(2, '2탄', 'day', [
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
stage3 = stage(3, '3탄', 'day', [
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
stage4 = stage(4, '4탄', 'underground', [
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
stage5 = stage(5, '5탄', 'underground', [
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
stage6 = stage(6, '6탄', 'night', [
    coins(20, [8, 10, 12]).e('flyer', 5, y=6).e('flyer', 15, y=4),
    blocks(22, [(5, 'B'), (6, '@'), (7, 'B'), (15, '?')]).e('broccoli', 18),
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
stage7 = stage(7, '7탄', 'night', [
    flat(18).e('broccoli', 14),
    blocks(20, [(6, '*'), (13, '?')]),
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
stage8 = stage(8, '8탄', 'castle', [
    ceiling(18, [(0, 18)], row=2).e('broccoli', 14),
    blocks(20, [(6, '@'), (13, '*')]),
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
stage9 = stage(9, '9탄', 'castle', [
    ceiling(18, [(0, 18)], row=2).e('broccoli', 14).e('flyer', 8, y=5),
    blocks(20, [(6, '@'), (12, '*')]),
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
stage10 = stage(10, '10탄', 'castle', [
    ceiling(18, [(0, 18)], row=2).e('broccoli', 14),
    blocks(20, [(6, '@'), (12, '*')]),
    lava(24, [(8, 7)]),
    spikes(20, [6, 7, 13, 14]).e('flyer', 10, y=5),
    lava(26, [(7, 8), (18, 5)]),
    # 보스 전 축구공 보급 — 두 개 두어 하나를 놓쳐도 잡을 수 있다
    blocks(22, [(5, '*'), (15, '*')]),
    # 보스 투기장. 평지 40타일에 보스와 나는 적
    flat(40).e('boss', 20, y=9).e('flyer', 6, y=4).e('flyer', 33, y=4),
    flat(14),
], flag_top=3)


STAGES = [stage1, stage2, stage3, stage4, stage5, stage6, stage7, stage8, stage9, stage10]

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
