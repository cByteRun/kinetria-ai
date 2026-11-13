#!/usr/bin/env python3
"""Encode the Playwright videos; inspect dimensions, duration and frame count."""
import argparse,hashlib,json,subprocess
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--ffmpeg');p.add_argument('--force',action='store_true');args=p.parse_args()
if args.ffmpeg:ffmpeg=args.ffmpeg
else:
 import imageio_ffmpeg
 ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
source=Path('docs/evidence/demo-recording');out=Path('docs/demos');out.mkdir(exist_ok=True)
report=[]
for video in sorted(source.glob('demo-*.webm')):
 target=out/(video.stem+'.gif')
 width=1152 if 'telegram' in video.stem else 1280
 if args.force or not target.exists() or target.stat().st_mtime < video.stat().st_mtime:
  rate=4 if 'telegram' in video.stem else 6
  colors=32 if 'telegram' in video.stem else 64
  filters=f'fps={rate},mpdecimate,scale={width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors={colors}:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle'
  subprocess.run([ffmpeg,'-y','-loglevel','error','-i',str(video),'-filter_complex',filters,'-fps_mode','vfr','-final_delay','160','-loop','0',str(target)],check=True)
 with Image.open(target) as im:
  duration=0
  for i in range(im.n_frames):im.seek(i);duration+=im.info.get('duration',0)
  assert im.n_frames>10 and im.width==width
  report.append({'file':str(target),'width':im.width,'height':im.height,'frames':im.n_frames,'durationSeconds':round(duration/1000,2),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
print(json.dumps(report,indent=2));(out/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
