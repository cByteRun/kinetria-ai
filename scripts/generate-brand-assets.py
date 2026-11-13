"""Draw IdeaRoute vector artwork and export transparent PNGs."""
import json
from pathlib import Path
import subprocess

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]

PRECISION = """
<defs><linearGradient id="tile" x2="1" y2="1"><stop stop-color="#5B46F4"/><stop offset="1" stop-color="#3730A3"/></linearGradient></defs>
<path d="M17 1H31C42 1 47 6 47 17V31C47 42 42 47 31 47H17C6 47 1 42 1 31V17C1 6 6 1 17 1Z" fill="url(#tile)" stroke="#FFF" stroke-opacity=".2"/>
<path d="M13 15H21M27 33H35" fill="none" stroke="#DDD6FE" stroke-opacity=".75" stroke-width="2" stroke-linecap="round"/>
<path d="M34 14C25 14 29 24 24 24S23 34 14 34" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round"/>
<circle cx="34" cy="14" r="3" fill="#FFF"/><circle cx="14" cy="34" r="3" fill="#FFF"/>
"""

LOOP = """
<defs>
  <linearGradient id="route" x1="5" y1="13" x2="43" y2="34" gradientUnits="userSpaceOnUse"><stop stop-color="{blue}"/><stop offset="1" stop-color="{violet}"/></linearGradient>
  <linearGradient id="spark" x1="37" y1="5" x2="46" y2="15" gradientUnits="userSpaceOnUse"><stop stop-color="#3B82F6"/><stop offset="1" stop-color="#6D28D9"/></linearGradient>
</defs>
<path d="M30 19C26 21 22 30 17 33C11 37 5 32 5 26C5 20 11 15 17 19Q19 20 21 22" fill="none" stroke="url(#route)" stroke-width="5" stroke-linecap="round"/>
<path d="M27 29C30 33 34 36 39 32C43 29 44 24 40 20C37 17 33 17 30 19M30 19L34 13M30 19L37 21" fill="none" stroke="{violet}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="41" cy="9" r="6" fill="url(#spark)" opacity=".18"/>
<path d="M41 4Q42 8 46 9Q42 10 41 14Q40 10 36 9Q40 8 41 4Z" fill="url(#spark)"/>
"""

MONOGRAM = """
<defs><linearGradient id="ink" x1="19" y1="10" x2="41" y2="39" gradientUnits="userSpaceOnUse"><stop stop-color="{ink}"/><stop offset="1" stop-color="{violet}"/></linearGradient></defs>
<circle cx="8" cy="12" r="3" fill="{violet}"/>
<path d="M8 23V36M18 36V12H28C34 12 36 15 36 19C36 23 33 26 28 26H18M26 26L33 34Q36 37 39 33L43 28" fill="none" stroke="url(#ink)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="43" cy="28" r="3" fill="{violet}"/>
"""

VARIANTS = [
    ("variant-1-precision-route", PRECISION, "Inter.woff2", 600, -.03),
    ("variant-2-closed-loop", LOOP, "manrope-latin.woff2", 700, -.035),
    ("variant-3-monogram-ir", MONOGRAM, "Onest.woff2", 600, .04),
]

PALETTES = {
    "light": dict(ink="#111827", blue="#2563EB", violet="#6D28D9"),
    "dark": dict(ink="#F8FAFC", blue="#60A5FA", violet="#A78BFA"),
}


def wordmark(family, weight, tracking):
    with TTFont(ROOT / "public" / "fonts" / family) as font:
        glyphs = font.getGlyphSet(location={"wght": weight} if "fvar" in font else None)
        cmap = font.getBestCmap()
        scale = 29 / font["head"].unitsPerEm
        baseline = 24 + font["OS/2"].sCapHeight * scale / 2
        x = 59
        outlines = []
        for letter in "IdeaRoute":
            glyph = glyphs[cmap[ord(letter)]]
            pen = SVGPathPen(glyphs, ntos=lambda value: f"{value:.1f}".rstrip("0").rstrip("."))
            glyph.draw(pen)
            outlines.append((pen.getCommands(), f"translate({x:.3f} {baseline:.3f}) scale({scale:.8f} {-scale:.8f})"))
            x += glyph.width * scale + tracking * 29
    return outlines, round(x - tracking * 29 + 2)


def svg(width, drawing, paths="", label="Знак IdeaRoute"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 48" role="img" aria-label="{label}">\n'
            f'{drawing.strip()}\n{paths}</svg>\n')


def main():
    exports = []
    for slug, drawing, family, weight, tracking in VARIANTS:
        folder = ROOT / "brand-assets" / slug
        folder.mkdir(parents=True, exist_ok=True)
        outlines, width = wordmark(family, weight, tracking)
        for theme, palette in PALETTES.items():
            mark = drawing.format(**palette)
            colors = (palette["ink"],) * 2
            if drawing == PRECISION:
                colors = ("#0F172A", "#4F46E5") if theme == "light" else ("#F8FAFC", "#A5B4FC")
            paths = "".join(f'<path d="{path}" transform="{transform}" fill="{colors[index >= 4]}"/>\n'
                            for index, (path, transform) in enumerate(outlines))
            assets = [(f"icon-{theme}", 48, svg(48, mark)),
                      (f"logo-{theme}", width, svg(width, mark, paths, "IdeaRoute"))]
            if theme == "light":
                assets.extend((alias, w, source) for alias, (_, w, source) in
                              zip(("icon", "logo-full"), assets[:]))
            for stem, w, source in assets:
                (folder / f"{stem}.svg").write_text(source, encoding="utf-8", newline="\n")
                exports.append([str(folder / stem), w])
    subprocess.run(["node", str(ROOT / "scripts" / "rasterize-brand-assets.cjs")],
                   input=json.dumps(exports), text=True, check=True, cwd=ROOT)


if __name__ == "__main__":
    main()

