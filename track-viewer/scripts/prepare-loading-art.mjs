import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
const dir = new URL('../../assets/loading/', import.meta.url);
await mkdir(dir, { recursive: true });
for (const [source, target] of [
  [new URL('broadcast-source.png', dir), 'broadcast.webp'],
  [new URL('../shots/trackside_after_main.png', import.meta.url), 'starting-line.webp'],
  [new URL('../shots/trackside_after_hairpin.png', import.meta.url), 'hairpin.webp'],
]) {
  const info = await sharp(source.pathname.replace(/^\/([A-Za-z]:)/, '$1')).resize(1920, 1080, { fit: 'cover' }).webp({ quality: 86 }).toFile(new URL(target, dir).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  console.log(target, info.size, 'bytes');
}
