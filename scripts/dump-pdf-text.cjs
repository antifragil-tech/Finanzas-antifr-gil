// Extrae texto legible de un PDF de @react-pdf inflando los streams FlateDecode.
// Uso: node scripts/dump-pdf-text.cjs <ruta.pdf>
const fs = require('fs');
const zlib = require('zlib');

const file = process.argv[2];
const s = fs.readFileSync(file);
const texts = [];
let idx = 0;
while ((idx = s.indexOf('stream', idx)) !== -1) {
  let start = idx + 6;
  while (s[start] === 0x0d || s[start] === 0x0a) start++;
  const end = s.indexOf('endstream', start);
  if (end === -1) break;
  const chunk = s.subarray(start, end);
  idx = end + 9;
  try {
    const inf = zlib.inflateSync(chunk).toString('latin1');
    if (!/Tj|TJ/.test(inf)) continue; // saltar imágenes y no-texto
    // @react-pdf codifica el texto como glyph IDs en hex: <56><69>... = "Vi"
    const hex = inf.match(/<([0-9a-fA-F]+)>/g);
    if (hex) {
      const line = hex
        .map((h) => {
          const inner = h.slice(1, -1);
          let str = '';
          for (let i = 0; i + 1 < inner.length; i += 2) str += String.fromCharCode(parseInt(inner.substr(i, 2), 16));
          return str;
        })
        .join('');
      texts.push(line);
    }
  } catch (e) {
    /* no es un stream comprimido */
  }
}
const all = texts.join('\n');
const clean = all
  .replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
  .replace(/\\(.)/g, '$1');
process.stdout.write(clean);
