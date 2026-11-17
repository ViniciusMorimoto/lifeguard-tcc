"""Extract the turquoise artwork from page 3 of the original brand book."""
from pathlib import Path
import sys
import pypdfium2 as pdfium
from PIL import Image

page = pdfium.PdfDocument(sys.argv[1])[2]
art = page.render(scale=2).to_pil().convert('RGB')
target = Path(__file__).resolve().parents[1] / 'assets' / 'brand' / 'elements'
target.mkdir(parents=True, exist_ok=True)
# Coordinates refer to the complete page displayed at 2048 x 1024.
regions = {
    'shield': (35, 255, 327, 607),
    'heart': (270, 640, 690, 1008),
    'care': (830, 610, 1089, 862),
    'pulse': (1015, 254, 1639, 607),
}
for name, bounds in regions.items():
    crop = art.crop(tuple(round(v * art.width / 2048) for v in bounds))
    # The source draws turquoise paths on a dark panel. Recover their coverage
    # from the red channel (panel ~38, artwork ~49), rejecting the background.
    alpha = Image.new('L', crop.size)
    alpha.putdata([round(255 * max(0, min(1, (g - 95) / 85)))
                   if g > r * 2 and b > r * 2 and abs(g - b) < 45 else 0
                   for r, g, b in crop.getdata()])
    icon = Image.new('RGBA', crop.size, (53, 184, 200, 0))
    icon.putalpha(alpha)
    icon = icon.crop(alpha.getbbox())
    icon.thumbnail((512, 512), Image.Resampling.LANCZOS)
    icon.save(target / f'{name}.png')
print('Extracted:', ', '.join(regions))
