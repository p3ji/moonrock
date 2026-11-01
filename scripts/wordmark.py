from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
root=Path(__file__).resolve().parent.parent
font=TTFont(root/'assets/fonts/CormorantGaramond.ttf');glyphs=font.getGlyphSet();cmap=font.getBestCmap();x=0;paths=[]
for char in 'Moonrock.':
    name=cmap[ord(char)];pen=SVGPathPen(glyphs);glyphs[name].draw(pen)
    paths.append(f'<path transform="translate({x} 800) scale(1 -1)" d="{pen.getCommands()}"/>')
    x+=font['hmtx'][name][0]-12
(root/'assets/wordmark.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {x+40} 1000" role="img" aria-label="Moonrock"><g fill="#242a27">'+''.join(paths)+'</g></svg>')
