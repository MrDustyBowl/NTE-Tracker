from pathlib import Path
from PIL import Image
import json,hashlib
r=Path(__file__).resolve().parent
m=json.loads((r/'assets/character_image_manifest.json').read_text(encoding='utf-8'))
assert len(m['assets']) == 24
for a in m['assets']:
 p=r/'src/assets'/a['avatar_file']
 assert p.is_file(),p
 with Image.open(p) as im: assert im.size==(192,192) and 'A' in im.convert('RGBA').getbands(),p
 assert hashlib.sha256(p.read_bytes()).hexdigest()==a['sha256'],p
assert (r/'src/assets/roster-icons/linko.png').read_bytes() != (r/'src/assets/characters/avatars/skia.png').read_bytes()
print('PASS: 24 standardized avatars, fixed Linko, correct Skia, verified checksums')
