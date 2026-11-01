from pathlib import Path
from fontTools import subset
root=Path(__file__).resolve().parent.parent
text=''.join(p.read_text() for p in [root/'index.html',root/'print/menu.html',root/'src/menu.json',root/'src/catalog.json',root/'storybook.html'])+''.join(chr(n) for n in range(32,256))+'↻↗↓↑←’—·'
for source,dest in [('CormorantGaramond.ttf','cormorant.woff2'),('NotoSansSC.ttf','noto-menu.woff2')]:
    opts=subset.Options();opts.flavor='woff2'
    font=subset.load_font(str(root/'assets/fonts'/source),opts)
    sub=subset.Subsetter(options=opts);sub.populate(text=text);sub.subset(font)
    subset.save_font(font,str(root/'assets/fonts'/dest),opts)
    print(dest,(root/'assets/fonts'/dest).stat().st_size)
from fontTools.varLib.instancer import instantiateVariableFont
for family,source in [('cormorant','CormorantGaramond.ttf'),('noto','NotoSansSC.ttf')]:
    for weight in [400,500]:
        opts=subset.Options()
        font=subset.load_font(str(root/'assets/fonts'/source),opts)
        font=instantiateVariableFont(font,{'wght':weight},inplace=True)
        sub=subset.Subsetter(options=opts);sub.populate(text=text);sub.subset(font)
        font.save(str(root/'assets/fonts'/f'{family}-print-{weight}.ttf'))
