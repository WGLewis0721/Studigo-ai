from PIL import Image, ImageDraw
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
out=root/'dist/assets'
out.mkdir(exist_ok=True)
bg=Image.open(root/'art-source/observatory.png').convert('RGB')
# A shared 480 x 270 art grid, enlarged by nearest-neighbor in the game.
bg.resize((480,270),Image.Resampling.NEAREST).save(out/'observatory.png',optimize=True)
bg.crop((580,719,820,767)).resize((120,24),Image.Resampling.NEAREST).save(out/'platform.png',optimize=True)
specs={
 'dragon': {'size':128,'scale':.30,'baseline':122,'rects':[(0,0,370,340),(374,0,749,340),(752,0,1107,340),(1111,0,1480,340),(1485,0,1849,340),(1111,0,1480,340),(0,363,360,724),(380,340,745,724),(744,350,1060,724),(1060,379,1412,724),(1490,405,1855,724),(1855,345,2172,724)]},
 'guardian':{'size':256,'scale':.48,'baseline':243,'rects':[(0,0,468,442),(469,0,888,443),(889,0,1336,443),(1336,0,1774,443),(0,443,518,887),(520,443,901,887),(902,443,1388,887),(1389,443,1774,887)],'cores':[(189,201),(632,239),(1206,238),(1515,207),(204,596),(673,652),(1127,692),(1530,636)]}}
meta={}
for name,spec in specs.items():
 src=Image.open(root/f'art-source/{name}.png').convert('RGBA');size=spec['size'];sheet=Image.new('RGBA',(size*len(spec['rects']),size));frames=[]
 for i,rect in enumerate(spec['rects']):
  part=src.crop(rect);
  if name=='dragon' and i==10:
   # Exclude the previous frame's detached projectile spill from this slot.
   ImageDraw.Draw(part).rectangle((0,0,65,158),fill=(0,0,0,0))
  bbox=part.getbbox();part=part.crop(bbox);scale=spec['scale'];w,h=round(part.width*scale),round(part.height*scale);part=part.resize((w,h),Image.Resampling.NEAREST);x=(size-w)//2;y=spec['baseline']-h
  sheet.alpha_composite(part,(i*size+x,y))
  item={'index':i}
  if 'cores' in spec:
   cx,cy=spec['cores'][i];item['coreX']=x+(cx-rect[0]-bbox[0])*scale;item['coreY']=y+(cy-rect[1]-bbox[1])*scale
  frames.append(item)
 sheet.save(out/f'{name}.png',optimize=True);meta[name]=frames
(out/'frames.json').write_text(json.dumps(meta))
# Small alpha-backed original effect textures; geometric effects are code-native.
im=Image.new('RGBA',(16,16));d=ImageDraw.Draw(im);d.polygon([(7,0),(9,5),(15,7),(10,10),(8,15),(5,10),(0,8),(5,5)],fill='#ffffff');im.save(out/'spark.png')
im=Image.new('RGBA',(32,32));d=ImageDraw.Draw(im);d.polygon([(15,1),(28,14),(28,18),(16,30),(3,18),(3,14)],fill='#112a39');d.polygon([(15,3),(26,14),(26,18),(16,28),(5,18),(5,14)],fill='#7bcba0');d.polygon([(15,7),(23,16),(16,24),(9,16)],fill='#e5efaf');d.line([(15,7),(15,18),(9,16)],fill='#ffffff',width=2);im.save(out/'core.png')
