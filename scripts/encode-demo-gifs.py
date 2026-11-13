#!/usr/bin/env python3
"""Encode readable GIFs from original recordings with a stable global palette."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('--ffmpeg')
parser.add_argument('--force', action='store_true')
parser.add_argument('--only', help='Encode one demo stem without changing the other entries')
args = parser.parse_args()
if args.ffmpeg:
    ffmpeg = args.ffmpeg
else:
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

source = Path('docs/evidence/demo-recording')
out = Path('docs/demos')
out.mkdir(exist_ok=True)
manifest = out / 'manifest.json'
report = {entry['file']: entry for entry in json.loads(manifest.read_text())} if manifest.exists() else {}
videos = sorted(source.glob('demo-*.webm'))
if args.only:
    videos = [video for video in videos if video.stem == args.only]
if not videos:
    raise SystemExit('No source recordings found')

for video in videos:
    target = out / (video.stem + '.gif')
    width = 1152 if 'telegram' in video.stem else 1280
    # Playwright recordings are 25 fps. GIF can represent 40 ms exactly; adding
    # duplicate frames to claim 30/60 fps would not recover additional motion.
    rate = 25
    scale = f'fps={rate},scale={width}:-1:flags=lanczos'
    key = str(target)
    previous = report.get(key, {})
    if (args.force or not target.exists() or target.stat().st_mtime < video.stat().st_mtime
            or previous.get('encodingVersion') != 2):
        print(f'Encoding {video.stem}: {rate} fps, 256-color global palette', flush=True)
        with tempfile.TemporaryDirectory(prefix='idearoute-gif-') as tmp:
            palette = Path(tmp) / 'palette.png'
            # Two passes avoid buffering the whole video while generating a
            # single palette. No per-frame palette changes or temporal dither.
            subprocess.run([
                ffmpeg, '-y', '-loglevel', 'error', '-i', str(video),
                '-vf', scale + ',palettegen=max_colors=256:stats_mode=full',
                '-frames:v', '1', '-update', '1', str(palette),
            ], check=True)
            encoded = Path(tmp) / 'encoded.gif'
            subprocess.run([
                ffmpeg, '-y', '-loglevel', 'error', '-i', str(video), '-i', str(palette),
                '-filter_complex', f'[0:v]{scale}[v];[v][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
                '-fps_mode', 'cfr', '-final_delay', '200', '-loop', '0', str(encoded),
            ], check=True)
            # Validate before replacing the previous deliverable.
            with Image.open(encoded) as im:
                assert im.width == width and im.n_frames > 10
                assert im.info.get('loop') == 0
                for index in range(im.n_frames):
                    im.seek(index)
                    im.load()
            target.write_bytes(encoded.read_bytes())
    with Image.open(target) as im:
        duration = 0
        delays = []
        for index in range(im.n_frames):
            im.seek(index)
            im.load()
            delay = im.info.get('duration', 0)
            duration += delay
            delays.append(delay)
        assert im.n_frames > 10 and im.width == width and im.info.get('loop') == 0
        # Encoders may combine identical images into a longer hold. Moving
        # frames retain the source's 40 ms cadence; final frame pauses 2 sec.
        assert min(delays) == 40 and all(delay >= 40 for delay in delays)
        report[key] = {
            'file': key, 'width': im.width, 'height': im.height,
            'frames': im.n_frames, 'durationSeconds': round(duration / 1000, 2),
            'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
            'encodingVersion': 2, 'targetFps': rate, 'paletteColors': 256,
            'palette': 'global/full', 'dither': 'ordered Bayer scale 4',
            'minFrameDelayMs': min(delays), 'finalFrameDelayMs': delays[-1],
            'sourceSha256': hashlib.sha256(video.read_bytes()).hexdigest(),
        }
    # Persist each completed result so an interrupted batch can resume.
    manifest.write_text(json.dumps([report[key] for key in sorted(report)], indent=2) + '\n')
    print(f'Validated {target}: {report[key]["frames"]} frames, '
          f'{report[key]["durationSeconds"]} s, {target.stat().st_size / 1048576:.2f} MiB', flush=True)
