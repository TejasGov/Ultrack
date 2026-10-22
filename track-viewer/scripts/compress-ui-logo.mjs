import sharp from 'sharp';
await sharp('assets/brand/ultrack_logo_alpha.png').webp({lossless:true}).toFile('assets/brand/ultrack_logo_alpha.webp');
