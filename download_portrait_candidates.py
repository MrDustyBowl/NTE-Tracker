#!/usr/bin/env python3
"""One-time collection only. Does NOT modify the game's installed assets.

Run from this package: py -3 download_portrait_candidates.py
Requires Pillow: py -3 -m pip install Pillow
Images are downloaded to .staging_portraits/originals, and only that local copy
is used to build the report. All artist/character identity matches require review.
"""
import csv, json, hashlib, io, urllib.request, urllib.error
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parent
staging=root/'.staging_portraits'
raw=staging/'originals'
raw.mkdir(parents=True,exist_ok=True)
rows=list(csv.DictReader((root/'assets/large_portrait_candidates.csv').open(encoding='utf-8')))
results=[]
for row in rows:
    name=Path(row['upstream_filename']).name
    target=raw/name
    try:
        if not target.exists():
            request=urllib.request.Request(row['source_url'],headers={'User-Agent':'NTE-Tracker-Asset-Staging/1.0'})
            with urllib.request.urlopen(request,timeout=25) as response:
                blob=response.read(15*1024*1024+1)
            if len(blob)>15*1024*1024:raise ValueError('File exceeds 15 MB limit')
            with Image.open(io.BytesIO(blob)) as img:
                if img.format!='PNG': raise ValueError('Not a PNG')
                img.verify()
            target.write_bytes(blob)
        with Image.open(target) as img:
            im=img.convert('RGBA'); dim=list(img.size); has_alpha='A' in img.getbands(); bbox=im.getbbox()
        results.append({**row,'status':'downloaded_unreviewed','dimensions':dim,'has_alpha':has_alpha,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'file':str(target.relative_to(root)),'bbox':list(bbox) if bbox else None})
        print('OK  ',name,dim,'alpha' if has_alpha else 'opaque')
    except Exception as exc:
        results.append({**row,'status':'download_failed','error':str(exc)})
        print('FAIL',name,str(exc))
(staging/'review_report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
N=4;CARD_W=260;CARD_H=310
sheetsize=(N*CARD_W,((len(results)+N-1)//N)*CARD_H)
sheet=Image.new('RGB',sheetsize,(20,24,35));draw=ImageDraw.Draw(sheet)
try:font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14)
except OSError:font=ImageFont.load_default()
for i,r in enumerate(results):
    x=(i%N)*CARD_W;y=(i//N)*CARD_H
    imgpath=root/r['file'] if r.get('file') else None
    if imgpath and imgpath.is_file():
        with Image.open(imgpath) as im:
            image=im.convert('RGBA');image.thumbnail((CARD_W-24,CARD_H-90),Image.Resampling.LANCZOS)
            checker=Image.new('RGB',image.size,(56,60,71))
            checker.paste(image,mask=image.getchannel('A'))
            sheet.paste(checker,(x+(CARD_W-image.width)//2,y+(CARD_H-90-image.height)//2))
    draw.text((x+9,y+CARD_H-79),r['proposed_character']+' / '+r['confidence'],fill=(239,245,249),font=font)
    draw.text((x+9,y+CARD_H-55),r['upstream_filename'],fill=(181,196,208),font=font)
    draw.text((x+9,y+CARD_H-31),r['status'],fill=(132,218,164) if r['status']=='downloaded_unreviewed' else (246,137,130),font=font)
sheet.save(staging/'CANDIDATES_REVIEW.png')
print('\nCandidate contact sheet:',staging/'CANDIDATES_REVIEW.png')
print('Do not move any image into src/assets/characters/portraits until verified!')
