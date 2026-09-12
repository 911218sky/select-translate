#!/usr/bin/env python3
"""Generate a simple Material-style translation mark."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

BLUE = (26, 115, 232)
WHITE = (255, 255, 255)


def png_chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, pixels: list[list[tuple[int, int, int, int]]]) -> None:
    height = len(pixels)
    width = len(pixels[0])
    raw = b""
    for row in pixels:
        raw += b"\x00"
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )


def mix(fg: tuple[int, int, int], bg: tuple[int, int, int, int], alpha: float) -> tuple[int, int, int, int]:
    a = max(0.0, min(1.0, alpha))
    inv = 1.0 - a
    return (
        round(fg[0] * a + bg[0] * inv),
        round(fg[1] * a + bg[1] * inv),
        round(fg[2] * a + bg[2] * inv),
        round(255 * a + bg[3] * inv),
    )


def cover(dist: float, width: float = 0.85) -> float:
    return max(0.0, min(1.0, 0.5 - dist / width))


def rounded_rect(px: float, py: float, x0: float, y0: float, x1: float, y1: float, radius: float) -> float:
    cx = min(max(px, x0 + radius), x1 - radius)
    cy = min(max(py, y0 + radius), y1 - radius)
    if x0 + radius <= px <= x1 - radius or y0 + radius <= py <= y1 - radius:
        inside = x0 <= px <= x1 and y0 <= py <= y1
        edge = min(px - x0, x1 - px, py - y0, y1 - py)
        return 1.0 if inside and edge > 0.6 else cover(-edge)
    return cover(math.hypot(px - cx, py - cy) - radius)


def capsule(px: float, py: float, x0: float, y0: float, x1: float, y1: float, radius: float) -> float:
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy) or 1.0
    t = max(0.0, min(1.0, ((px - x0) * dx + (py - y0) * dy) / (length * length)))
    return cover(math.hypot(px - (x0 + dx * t), py - (y0 + dy * t)) - radius)


def draw(size: int) -> list[list[tuple[int, int, int, int]]]:
    pixels = [[(0, 0, 0, 0) for _ in range(size)] for _ in range(size)]
    pad = size * 0.06
    radius = size * 0.22
    stroke = size * (0.075 if size >= 32 else 0.09)
    for y in range(size):
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            alpha = rounded_rect(px, py, pad, pad, size - pad, size - pad, radius)
            if alpha <= 0:
                continue
            color = mix(BLUE, (0, 0, 0, 0), alpha)
            u = size / 16
            glyph = 0.0
            glyph = max(glyph, capsule(px, py, 3.6 * u, 5.1 * u, 7.6 * u, 5.1 * u, stroke * 0.55))
            glyph = max(glyph, capsule(px, py, 5.6 * u, 5.1 * u, 5.6 * u, 11.1 * u, stroke * 0.55))
            glyph = max(glyph, capsule(px, py, 3.8 * u, 8.2 * u, 7.4 * u, 8.2 * u, stroke * 0.5))
            glyph = max(glyph, capsule(px, py, 8.6 * u, 5.1 * u, 12.4 * u, 5.1 * u, stroke * 0.55))
            glyph = max(glyph, capsule(px, py, 10.5 * u, 5.1 * u, 10.5 * u, 11.1 * u, stroke * 0.55))
            if size >= 32:
                glyph = max(glyph, capsule(px, py, 7.4 * u, 10.6 * u, 8.8 * u, 12.0 * u, stroke * 0.28))
            pixels[y][x] = mix(WHITE, color, glyph)
    return pixels


def main() -> None:
    icon_dir = Path(__file__).resolve().parent.parent / "icons"
    icon_dir.mkdir(exist_ok=True)
    for size in (16, 32, 48, 128):
        path = icon_dir / f"icon{size}.png"
        write_png(path, draw(size))
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
