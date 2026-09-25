"""Writes the built-in pieces the dacapo project encodes itself to src/pieces/library/.

    python3 scripts/pieces/generate.py            # every piece in sources/
    python3 scripts/pieces/generate.py <id> ...   # only these
    python3 scripts/pieces/generate.py --check    # fail if a committed file differs

Each sources/<id>.py defines PIECE, the input of musicxml_gen.build().
"""

import importlib.util
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from musicxml_gen import build  # noqa: E402

LIBRARY = HERE.parents[1] / 'src' / 'pieces' / 'library'


def load(path):
    spec = importlib.util.spec_from_file_location(path.stem.replace('-', '_'), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.PIECE


def main(args):
    check = '--check' in args
    ids = [a for a in args if not a.startswith('--')]
    sources = sorted((HERE / 'sources').glob('*.py'))
    if ids:
        sources = [s for s in sources if s.stem in ids]
    stale = []
    for source in sources:
        xml = build(load(source))
        target = LIBRARY / f'{source.stem}.musicxml'
        if check:
            if not target.exists() or target.read_text(encoding='utf-8') != xml:
                stale.append(target.name)
            continue
        target.write_text(xml, encoding='utf-8')
        print('wrote', target.relative_to(HERE.parents[1]))
    if stale:
        sys.exit('out of date: ' + ', '.join(stale))
    if check:
        print('up to date:', ', '.join(s.stem for s in sources))


if __name__ == '__main__':
    main(sys.argv[1:])
