const assert = require('node:assert/strict');
const { copyFile, readFile, writeFile } = require('node:fs/promises');
const { basename, dirname, join } = require('node:path');
const { createRequire } = require('node:module');

// Resolve the Sharp dependency installed by Next, including under pnpm.
const sharp = createRequire(require.resolve('next/package.json'))('sharp');

async function render(stem, width) {
  const source = await readFile(stem + '.svg');
  if (basename(stem) === 'icon') {
    for (const size of [16, 32]) {
      await sharp(source).resize(size, size).png().toFile(join(dirname(stem), 'favicon-' + size + '.png'));
    }
  }
  for (const size of [512, 1024]) {
    const padding = width === 48 ? 0 : size / 16;
    const contentWidth = size - padding * 2;
    const contentHeight = Math.round(contentWidth * 48 / width);
    const verticalPadding = (size - contentHeight) / 2;
    const { data, info } = await sharp(source, { density: Math.ceil(72 * contentWidth / width) })
      .resize(contentWidth, contentHeight, { fit: 'fill' })
      .ensureAlpha()
      .extend({
        top: Math.floor(verticalPadding),
        bottom: Math.ceil(verticalPadding),
        left: padding,
        right: padding,
        background: '#00000000',
      })
      .png()
      .toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height, info.channels], [size, size, 4]);
    const file = stem + '-' + size + '.png';
    await writeFile(file, data);
    if (basename(stem) === 'logo-full') {
      await copyFile(file, join(dirname(stem), 'logo-' + size + '.png'));
    }
  }
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin.setEncoding('utf8')) input += chunk;
  const exports = JSON.parse(input);
  for (const [stem, width] of exports) {
    await render(stem, width);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

