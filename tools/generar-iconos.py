#!/usr/bin/env python3
"""Regenera icons/material-symbols.woff con SOLO los iconos que usa la app.
Hay que ejecutarlo cada vez que se añade un icono nuevo (si no, se ve el nombre en texto).
Uso: python3 tools/generar-iconos.py RUTA/material-design-icons/variablefont
(clon de https://github.com/google/material-design-icons; basta con la carpeta variablefont)."""
import re, glob, sys, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

base = sys.argv[1]
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ttf = os.path.join(base, 'MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].ttf')
nombres = [l.split()[0] for l in open(os.path.join(base, 'MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].codepoints'))]
src = ''
for f in [raiz + '/index.html'] + glob.glob(raiz + '/js/**/*.js', recursive=True):
    src += open(f, encoding='utf8').read() + '\n'
palabras = set(re.findall(r'[a-z][a-z0-9_]*', src))
usados = {n for n in nombres if n in palabras}
f = instancer.instantiateVariableFont(TTFont(ttf), {'FILL': 0, 'GRAD': 0, 'opsz': 24, 'wght': 400})
rc = {v: chr(k) for k, v in f.getBestCmap().items()}
need = set()
for l in f['GSUB'].table.LookupList.Lookup:
    for st in l.SubTable:
        s = st.ExtSubTable if hasattr(st, 'ExtSubTable') else st
        for first in list(s.ligatures):
            keep = []
            for lg in s.ligatures[first]:
                if ''.join(rc.get(x, '?') for x in [first] + lg.Component) in usados:
                    keep.append(lg); need.add(lg.LigGlyph)
            if keep: s.ligatures[first] = keep
            else: del s.ligatures[first]
o = subset.Options(); o.layout_features = ['*']; o.hinting = False; o.notdef_outline = True; o.name_IDs = []
sub = subset.Subsetter(o)
sub.populate(glyphs=list(need), unicodes=[ord(c) for c in sorted(set(''.join(usados)))])
sub.subset(f)
f.flavor = 'woff'
f.save(raiz + '/icons/material-symbols.woff')
print(len(usados), 'iconos')
