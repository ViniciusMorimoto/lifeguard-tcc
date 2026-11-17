"""Extract original artwork from the supplied brand book; never redraw the logo."""
from pathlib import Path
import sys
from pypdf import PdfReader
from PIL import Image

source = PdfReader(sys.argv[1])
target = Path(__file__).resolve().parents[1] / 'assets' / 'brand'
target.mkdir(parents=True, exist_ok=True)
for page, index, name in [(0, 0, 'logo-dark'), (0, 1, 'logo-light'), (1, 0, 'symbol')]:
    artwork = source.pages[page].images[index].image.convert('RGBA')
    if name == 'symbol':
        # The PDF clips this square source: the unused lower half contains
        # another lockup. Match the actual clipping rectangle in page 2.
        artwork = artwork.crop((358, 216, 903, 756))
    bounds = artwork.getchannel('A').point(lambda value: 255 if value > 12 else 0).getbbox()
    artwork = artwork.crop(bounds)
    artwork.save(target / f'{name}.png')

symbol = Image.open(target / 'symbol.png').convert('RGBA')
for name, background, size in [('app-icon', '#26343D', 660), ('adaptive-icon', None, 620), ('splash', '#26343D', 800)]:
    canvas = Image.new('RGBA', (1024, 1024), background or (0, 0, 0, 0))
    artwork = symbol.copy()
    artwork.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(artwork, ((1024-artwork.width)//2, (1024-artwork.height)//2))
    canvas.save(target / f'{name}.png')
print('Brand artwork extracted to assets/brand.')
