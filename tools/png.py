"""순수 표준 라이브러리 PNG 코덱.

Pillow를 쓰지 않는다. 이 머신의 Pillow는 이미지 코어(_imaging)가 x86_64로
설치되어 arm64 Python에서 ImportError를 던진다. zlib + struct 만으로 충분하다.
"""

import struct
import zlib


def read_png(path):
    """비인터레이스 8비트 PNG를 (w, h, channels, pixels) 로 읽는다."""
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', f'{path} 는 PNG가 아니다'

    i, idat, hdr = 8, b'', None
    while i < len(data):
        length = struct.unpack('>I', data[i:i + 4])[0]
        ctype = data[i + 4:i + 8]
        chunk = data[i + 8:i + 8 + length]
        if ctype == b'IHDR':
            hdr = struct.unpack('>IIBBBBB', chunk)
        elif ctype == b'IDAT':
            idat += chunk
        i += 12 + length

    assert hdr is not None, 'IHDR 청크가 없다'
    w, h, depth, color, _comp, _filt, interlace = hdr
    assert depth == 8, f'8비트만 지원 (depth={depth})'
    assert interlace == 0, '인터레이스 PNG는 지원하지 않는다'
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]

    raw = zlib.decompress(idat)
    stride = w * ch
    out = bytearray(h * stride)
    prev = bytearray(stride)
    pos = 0

    for y in range(h):
        ftype = raw[pos]
        pos += 1
        line = bytearray(raw[pos:pos + stride])
        pos += stride

        if ftype == 1:                                    # Sub
            for x in range(ch, stride):
                line[x] = (line[x] + line[x - ch]) & 255
        elif ftype == 2:                                  # Up
            for x in range(stride):
                line[x] = (line[x] + prev[x]) & 255
        elif ftype == 3:                                  # Average
            for x in range(stride):
                a = line[x - ch] if x >= ch else 0
                line[x] = (line[x] + ((a + prev[x]) >> 1)) & 255
        elif ftype == 4:                                  # Paeth
            for x in range(stride):
                a = line[x - ch] if x >= ch else 0
                b = prev[x]
                c = prev[x - ch] if x >= ch else 0
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pred) & 255

        out[y * stride:(y + 1) * stride] = line
        prev = line

    return w, h, ch, bytes(out)


def write_png(path, w, h, rgba):
    """RGBA8 바이트열을 PNG로 쓴다."""
    assert len(rgba) == w * h * 4, f'RGBA 길이 {len(rgba)} != {w}*{h}*4'

    def chunk(ctype, payload):
        return (struct.pack('>I', len(payload)) + ctype + payload
                + struct.pack('>I', zlib.crc32(ctype + payload) & 0xffffffff))

    raw = b''.join(b'\x00' + rgba[y * w * 4:(y + 1) * w * 4] for y in range(h))
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)


def rot90cw(w, h, ch, px):
    """시계방향 90도 회전.

    sips 는 표시 방향 기준으로 크롭하지만 출력 PNG의 픽셀은 센서 방향으로
    남는다. sips -g orientation 도 <nil> 을 보고해 판별이 안 되므로,
    회전을 여기서 명시적으로 굽는다.
    """
    nw, nh = h, w
    out = bytearray(nw * nh * ch)
    for y in range(nh):
        for x in range(nw):
            src = ((h - 1 - x) * w + y) * ch
            dst = (y * nw + x) * ch
            out[dst:dst + ch] = px[src:src + ch]
    return nw, nh, bytes(out)
