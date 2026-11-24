import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
const require = createRequire(import.meta.url);
const fontkit = await import(process.env.FONTKIT_MODULE_PATH || 'fontkit');
const sharp = require('sharp');
const font = fontkit.openSync('public/fonts/AlbertSans-Variable.ttf').getVariation({ wght: 650 });
const run = font.layout('Orvanta');
const size = 46, scale = size / font.unitsPerEm;
let x = 66;
const glyphs = run.glyphs.map((glyph, i) => {
  const position = run.positions[i];
  const shape = `<path transform="translate(${x + position.xOffset * scale} ${51 - position.yOffset * scale}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
  x += position.xAdvance * scale - 1.2;
  return shape;
}).join('');
const mark = `<g fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"><path d="M35.3 12.7a16 16 0 1 0 0 22.6"/><path d="M24 24h18"/></g>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
for (const [variant, ink] of [['dark', '#f3f6fb'], ['light', '#08111f']]) {
  const wordmark = svg(258, 72, `<title>Orvanta</title><g color="${variant === 'dark' ? '#79dac3' : '#08111f'}" transform="translate(0 12)">${mark}</g><g fill="${ink}">${glyphs}</g>`);
  await fs.writeFile(`public/brand/wordmark-${variant}.svg`, wordmark);
  await sharp(Buffer.from(wordmark)).resize(1032, 288).png().toFile(`public/brand/wordmark-${variant}.png`);
  const icon = svg(48, 48, `<title>Orvanta</title><g color="${variant === 'dark' ? '#79dac3' : '#08111f'}">${mark}</g>`);
  await fs.writeFile(`public/brand/icon-${variant}.svg`, icon);
  await sharp(Buffer.from(icon)).resize(512, 512).png().toFile(`public/brand/icon-${variant}.png`);
}
const favicon = svg(64, 64, `<rect width="64" height="64" rx="14" fill="#08111f"/><g transform="translate(8 8)" color="#79dac3">${mark}</g>`);
await fs.writeFile('public/favicon.svg', favicon);
for (const [name, size] of [['apple-touch-icon.png',180], ['icon-192.png',192], ['icon-512.png',512]]) await sharp(Buffer.from(favicon)).resize(size,size).png().toFile(`public/${name}`);
const png32 = await sharp(Buffer.from(favicon)).resize(32,32).png().toBuffer();
const ico = Buffer.alloc(22); ico.writeUInt16LE(1,2); ico.writeUInt16LE(1,4); ico[6]=32; ico[7]=32; ico.writeUInt16LE(1,10); ico.writeUInt16LE(32,12); ico.writeUInt32LE(png32.length,14); ico.writeUInt32LE(22,18);
await fs.writeFile('public/favicon.ico',Buffer.concat([ico,png32]));
const wordmark = await fs.readFile('public/brand/wordmark-dark.svg','utf8');
const inner = wordmark.replace(/<svg[^>]+>|<\/svg>/g,'');
for (const [name,width,height] of [['social-preview',1200,630],['repository-preview',1280,640]]) {
  // All text is outlined with the bundled licensed font so exports are portable.
  const regular = fontkit.openSync('public/fonts/AlbertSans-Variable.ttf').getVariation({wght:500});
  function line(text, x, y, size, color) {
    const run=regular.layout(text), s=size/regular.unitsPerEm; let pen=x;
    return `<g fill="${color}">`+run.glyphs.map((g,i)=>{const p=`<path d="${g.path.toSVG()}" transform="translate(${pen} ${y}) scale(${s} ${-s})"/>`;pen+=run.positions[i].xAdvance*s;return p;}).join('')+'</g>';
  }
  const graphic=svg(width,height,`<rect width="${width}" height="${height}" fill="#08111f"/><g transform="translate(72 52)">${inner}</g><path d="M72 165H${width-72}" stroke="#324451"/>${line('Keep customer',72,285,76,'#f3f6fb')}${line('enquiries moving.',72,375,76,'#f3f6fb')}${line('AI receptionist setup for cleaning companies',72,470,30,'#b7c9d5')}${line('Websites and connected enquiry workflows',72,515,30,'#b7c9d5')}<g transform="translate(${width-170} ${height-120}) scale(1.4)" color="#79dac3">${mark}</g>`);
  await fs.writeFile(`public/brand/${name}.svg`,graphic);
  await sharp(Buffer.from(graphic)).png().toFile(`public/brand/${name}.png`);
}
console.log('Exported original vector and PNG brand assets, favicon and social graphics.');
