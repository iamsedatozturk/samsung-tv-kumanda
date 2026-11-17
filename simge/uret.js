// Uygulama simgelerini (PNG) üretir: node simge/uret.js. Bağımlılık yok.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const crcTablo = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTablo[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const parca = (tur, veri) => { const u = Buffer.alloc(4); u.writeUInt32BE(veri.length); const tv = Buffer.concat([Buffer.from(tur), veri]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(tv)); return Buffer.concat([u, tv, c]); };
function png(boyut, maskeli) {
  const satirlar = [];
  for (let y = 0; y < boyut; y++) {
    const s = Buffer.alloc(1 + boyut * 4);
    for (let x = 0; x < boyut; x++) {
      const u = (x + 0.5) / boyut, v = (y + 0.5) / boyut;
      let r = 11, g = 13, b = 17;                                   // zemin
      // kumanda gövdesi (yuvarlak köşeli dikdörtgen)
      const gx = Math.max(Math.abs(u - 0.5) - 0.14, 0), gy = Math.max(Math.abs(v - 0.5) - 0.24, 0);
      if (Math.hypot(gx, gy) < 0.1) { r = 38; g = 44; b = 55; }
      if (Math.hypot(u - 0.5, v - 0.42) < 0.12) { r = 76; g = 154; b = 255; }   // yön halkası
      if (Math.hypot(u - 0.5, v - 0.42) < 0.06) { r = 38; g = 44; b = 55; }
      if (Math.hypot(u - 0.5, v - 0.24) < 0.035) { r = 229; g = 72; b = 77; }  // güç
      for (const [cx, cy] of [[0.42, 0.62], [0.58, 0.62], [0.42, 0.72], [0.58, 0.72]]) if (Math.hypot(u - cx, v - cy) < 0.035) { r = 139; g = 149; b = 163; }
      let a = 255;
      if (!maskeli) { const kx = Math.max(Math.abs(u - 0.5) - 0.3, 0), ky = Math.max(Math.abs(v - 0.5) - 0.3, 0); if (Math.hypot(kx, ky) > 0.2) a = 0; }
      s.set([r, g, b, a], 1 + x * 4);
    }
    satirlar.push(s);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(boyut, 0); ihdr.writeUInt32BE(boyut, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), parca('IHDR', ihdr), parca('IDAT', zlib.deflateSync(Buffer.concat(satirlar))), parca('IEND', Buffer.alloc(0))]);
}
for (const [ad, boyut, maskeli] of [['simge-192.png', 192, false], ['simge-512.png', 512, false], ['simge-maskeli-512.png', 512, true], ['apple-touch-icon.png', 180, true]])
  fs.writeFileSync(path.join(__dirname, ad), png(boyut, maskeli));
