// Generates the animated SVGs in ../assets. Run: node scripts/gen.mjs
// Pixel-terminal look borrowed from Applarchy: Departure Mono, square corners,
// hard shadows and a "decrypt" reveal like the TerminalTextEffects one.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const font = readFileSync(join(root, 'scripts/DepartureMono-subset.woff2')).toString('base64');

// Departure Mono: 350 advance / 550 units per em.
const ADV = 350 / 550;

const C = {
  bg: '#0e0b16',
  bar: '#1a1426',
  edge: '#e8e4f4',
  shadow: '#8a00a8',
  text: '#e8e4f4',
  dim: '#8b84a8',
  cyan: '#00d1ff',
  purple: '#c04cff',
};

// Seeded PRNG so regenerating gives the same output (and a clean git diff).
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (s) => s[Math.floor(rand() * s.length)];
const GLYPHS = '!@#$%&*+=?<>/\\|{}[]0123456789ABCDEFGHJKLMNPQRSTUVWXYZ░▒▓█';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const t = (n) => `${n.toFixed(2)}s`;

const head = (w, h, label, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
<style>
@font-face{font-family:DM;src:url(data:font/woff2;base64,${font}) format('woff2')}
text{font-family:DM,ui-monospace,Menlo,monospace;white-space:pre}
</style>
<defs>
<linearGradient id="grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${w}" y2="0">
<stop offset="0" stop-color="${C.purple}"/><stop offset="0.55" stop-color="${C.cyan}"/>
</linearGradient>
${defs}
</defs>`;

// A window with a hard shadow and a title bar; returns the body's top edge.
function frame(x, y, w, h, title, sh = 8) {
  return `<rect x="${x + sh}" y="${y + sh}" width="${w}" height="${h}" fill="${C.shadow}"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.bg}" stroke="${C.edge}" stroke-width="2"/>
<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="28" fill="${C.bar}"/>
<rect x="${x + 1}" y="${y + 29}" width="${w - 2}" height="2" fill="${C.edge}" opacity="0.25"/>
${['#ff5f57', '#febc2e', '#28c840'].map((c, i) => `<rect x="${x + 14 + i * 16}" y="${y + 10}" width="10" height="10" fill="${c}"/>`).join('')}
<text x="${x + w / 2}" y="${y + 20}" font-size="13" fill="${C.dim}" text-anchor="middle">${esc(title)}</text>`;
}

// Each character flickers through random glyphs, then locks into place.
function decrypt(x, y, text, size, start, { stagger = 0.08, frame = 0.055, fill = 'url(#grad)' } = {}) {
  const cw = size * ADV;
  let out = '';
  [...text].forEach((ch, i) => {
    if (ch === ' ') return;
    const cx = (x + i * cw).toFixed(1);
    const frames = 5 + Math.floor(rand() * 5);
    const t0 = start + i * stagger;
    for (let k = 0; k < frames; k++) {
      out += `<text x="${cx}" y="${y}" font-size="${size}" fill="${k % 3 ? C.cyan : C.purple}" opacity="0.8" visibility="hidden">${esc(pick(GLYPHS))}<set attributeName="visibility" to="visible" begin="${t(t0 + k * frame)}" dur="${t(frame)}"/></text>`;
    }
    out += `<text x="${cx}" y="${y}" font-size="${size}" fill="${fill}" visibility="hidden">${esc(ch)}<set attributeName="visibility" to="visible" begin="${t(t0 + frames * frame)}" fill="freeze"/></text>`;
  });
  return out;
}

// Typewriter: a clip rectangle widens one character at a time.
let clipN = 0;
function typed(x, y, text, size, start, { cps = 28, fill = C.text } = {}) {
  const cw = size * ADV;
  const n = [...text].length;
  const id = `type${clipN++}`;
  const values = Array.from({ length: n + 1 }, (_, k) => (k * cw).toFixed(1)).join(';');
  const keyTimes = Array.from({ length: n + 1 }, (_, k) => (k / (n + 1)).toFixed(4)).join(';');
  return {
    end: start + n / cps,
    width: n * cw,
    svg: `<clipPath id="${id}"><rect x="${x}" y="${y - size}" width="0" height="${size * 1.4}"><animate attributeName="width" values="${values}" keyTimes="${keyTimes}" calcMode="discrete" begin="${t(start)}" dur="${t(n / cps)}" fill="freeze"/></rect></clipPath>
<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" clip-path="url(#${id})">${esc(text)}</text>`,
  };
}

function cursor(x, y, size, begin) {
  return `<rect x="${x}" y="${y - size * 0.8}" width="${size * ADV}" height="${size}" fill="${C.cyan}" visibility="hidden"><set attributeName="visibility" to="visible" begin="${t(begin)}" fill="freeze"/><animate attributeName="opacity" values="1;0" dur="1s" calcMode="discrete" begin="${t(begin)}" repeatCount="indefinite"/></rect>`;
}

// Columns of glyphs falling forever, like the Matrix effect.
function rain(x0, x1, top, bottom, size = 14) {
  let out = '';
  const span = bottom - top;
  for (let x = x0; x < x1; x += size * 1.4) {
    const len = 6 + Math.floor(rand() * 10);
    const dur = 5 + rand() * 9;
    let col = '';
    for (let k = 0; k < len; k++) {
      const op = k === len - 1 ? 1 : 0.15 + (0.6 * k) / len;
      col += `<text x="${x.toFixed(1)}" y="${(k * size * 1.2).toFixed(1)}" font-size="${size}" fill="${k === len - 1 ? C.text : C.cyan}" opacity="${op.toFixed(2)}">${esc(pick(GLYPHS))}</text>`;
    }
    out += `<g>${col}<animateTransform attributeName="transform" type="translate" from="0 ${top - len * size * 1.2}" to="0 ${bottom + size}" dur="${t(dur)}" begin="${t(-rand() * dur)}" repeatCount="indefinite"/></g>`;
  }
  return out;
}

function chips(x, y, labels, size = 12) {
  let cx = x;
  return labels
    .map((l) => {
      const w = l.length * size * ADV + 16;
      const s = `<rect x="${cx}" y="${y - size - 4}" width="${w.toFixed(1)}" height="${size + 10}" fill="none" stroke="${C.cyan}" stroke-width="1.5" opacity="0.7"/><text x="${cx + 8}" y="${y}" font-size="${size}" fill="${C.cyan}">${esc(l)}</text>`;
      cx += w + 8;
      return s;
    })
    .join('');
}

// ---------- header ----------
{
  const W = 900, H = 282, w = 884, h = 266;
  const lines = [];
  const p1 = typed(56, 84, 'whoami', 18, 0.3, { fill: C.text });
  lines.push(`<text x="32" y="84" font-size="18" fill="${C.cyan}">❯</text>`, p1.svg);
  lines.push(decrypt(32, 156, 'ADAM SAMKO', 64, p1.end + 0.2));
  const after = p1.end + 0.2 + 9 * 0.08 + 0.6;
  const l1 = typed(32, 198, 'frontend engineer · angular · react · prague', 18, after, { fill: C.dim, cps: 60 });
  lines.push(l1.svg);
  lines.push(`<text x="32" y="234" font-size="18" fill="${C.cyan}" visibility="hidden">❯<set attributeName="visibility" to="visible" begin="${t(l1.end + 0.1)}" fill="freeze"/></text>`);
  const l2 = typed(56, 234, 'building pixel-perfect things for the web & mac', 18, l1.end + 0.3, { cps: 36 });
  lines.push(l2.svg, cursor(56 + l2.width + 6, 234, 18, l2.end));

  const defs = `<clipPath id="body"><rect x="3" y="33" width="${w - 2}" height="${h - 33}"/></clipPath>
<linearGradient id="fade" x1="0" x2="1"><stop offset="0.25" stop-color="#fff" stop-opacity="0"/><stop offset="0.75" stop-color="#fff" stop-opacity="0.55"/></linearGradient>
<mask id="rainmask"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>`;
  const svg = `${head(W, H, 'Adam Samko — frontend engineer in Prague', defs)}
${frame(2, 2, w, h, 'adam@prague: ~')}
<g clip-path="url(#body)" mask="url(#rainmask)">${rain(300, w, 33, h)}</g>
${lines.join('\n')}
</svg>`;
  writeFileSync(join(root, 'assets/header.svg'), svg);
}

// ---------- stats ----------
{
  const W = 900, H = 136, tw = 204, gap = 16;
  const tiles = [
    ['37', 'text effects shipped', '★'],
    ['v2.7.2', 'latest app release', '■'],
    ['42', 'public repos', '✦'],
    ['2018', 'on github since', '❯'],
  ];
  const body = tiles
    .map(([v, label, icon], i) => {
      const x = 2 + i * (tw + gap);
      return `<rect x="${x + 6}" y="8" width="${tw}" height="118" fill="${C.shadow}"/>
<rect x="${x}" y="2" width="${tw}" height="118" fill="${C.bg}" stroke="${C.edge}" stroke-width="2"/>
<text x="${x + tw - 26}" y="30" font-size="14" fill="${C.dim}">${icon}</text>
${decrypt(x + 20, 70, v, 36, 0.2 + i * 0.35, { stagger: 0.07 })}
<text x="${x + 20}" y="100" font-size="13" fill="${C.dim}">${esc(label)}</text>`;
    })
    .join('\n');
  writeFileSync(join(root, 'assets/stats.svg'), `${head(W, H, 'Highlights: 37 effects shipped, v2.7.2 latest release, 42 public repos, on GitHub since 2018')}\n${body}\n</svg>`);
}

// ---------- project cards ----------
function wrap(s, max) {
  const out = [''];
  for (const word of s.split(' ')) {
    const cur = out[out.length - 1];
    if ((cur + ' ' + word).trim().length > max) out.push(word);
    else out[out.length - 1] = (cur + ' ' + word).trim();
  }
  return out;
}

function card(file, { path, name, desc, tags, foot }) {
  const W = 448, H = 236, w = 438, h = 226;
  const desc_ = wrap(desc, 46)
    .map((l, i) => `<text x="24" y="${108 + i * 21}" font-size="14" fill="${C.text}" opacity="0.85">${esc(l)}</text>`)
    .join('');
  const svg = `${head(W, H, `${name}: ${desc}`)}
${frame(2, 2, w, h, path, 8)}
<text x="24" y="70" font-size="14" fill="${C.cyan}">❯</text>
${decrypt(44, 74, name, 30, 0.2, { stagger: 0.06 })}
${desc_}
${chips(24, 192, tags)}
<text x="${w - 18}" y="${h - 10}" font-size="13" fill="${C.dim}" text-anchor="end">${esc(foot)}</text>
</svg>`;
  writeFileSync(join(root, `assets/${file}`), svg);
}

card('card-applarchy.svg', {
  path: '~/applarchy',
  name: 'applarchy',
  desc: "Omarchy's terminal-art screensaver, reborn on macOS. 37 pixel-art effects as a screensaver or a live wallpaper.",
  tags: ['Rust', 'Swift', 'WASM', 'macOS'],
  foot: 'v2.7.2 · open →',
});

card('card-decision-arena.svg', {
  path: '~/decision-arena',
  name: 'decision-arena',
  desc: 'A 9B decision model vs a chat LLM on five everyday decisions: accuracy, calibration, stability and cost.',
  tags: ['Next.js', 'React 19', 'TypeScript', 'LLM evals'],
  foot: 'open →',
});
