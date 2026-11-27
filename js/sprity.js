// =====================================================================
//  Pixelová grafika
//  Všechno je kreslené po jednotlivých pixelech: buď ručně (mřížky znaků
//  + paleta), nebo programem pixel po pixelu (asteroidy, výbuchy, boss,
//  panely). Sprity se kreslí 1:1 do malého plátna (320×240 + boční panely)
//  a to se nakonec zvětší celým násobkem bez vyhlazení -> všechny pixely
//  jsou stejně velké, jako ve starých DOSových hrách.
// =====================================================================
const OBRYS = '#0a0912';

// ---------------- barvy ----------------
const rgbCache = {};
function rgb(h) {
  if (rgbCache[h]) return rgbCache[h];
  const n = h.slice(1);
  return (rgbCache[h] = [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16), n.length >= 8 ? parseInt(n.slice(6, 8), 16) : 255]);
}
const hex2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
function smichej(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return '#' + hex2(A[0] + (B[0] - A[0]) * t) + hex2(A[1] + (B[1] - A[1]) * t) + hex2(A[2] + (B[2] - A[2]) * t);
}
function prechod(kotvy, n) { // n barev plynule přes kotvy
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) * (kotvy.length - 1), j = Math.min(kotvy.length - 2, Math.floor(t));
    out.push(smichej(kotvy[j], kotvy[j + 1], t - j));
  }
  return out;
}

// Bayerova matice 4×4 pro "DOSový" dithering přechodů
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
function odstin(r, v, x, y) { // odstín z rampy s ditheringem
  const t = Math.max(0, Math.min(1, v)) * (r.length - 1);
  const i = Math.floor(t);
  return r[Math.min(r.length - 1, i + ((t - i) > bayer(x, y) ? 1 : 0))];
}
function stupen(r, v) { return r[Math.max(0, Math.min(r.length - 1, Math.round(v * (r.length - 1))))]; }

// ---------------- rampy (od nejtmavší po nejsvětlejší) ----------------
const R_OCEL   = ['#161a28', '#262e42', '#3c4860', '#5a6a86', '#8294b0', '#b4c4da', '#eef4fc'];
const R_CERV   = ['#5a0e14', '#9a1c1c', '#d8382a', '#ff7a48'];
const R_SKLO   = ['#0c2050', '#1a5ab0', '#38a4ee', '#b8f2ff'];
const R_FIAL   = ['#1c0a2a', '#36154e', '#572478', '#7c38a2', '#a65ccc', '#d496ec', '#f6d8ff'];
const R_JANTAR = ['#6a2a06', '#b25a0e', '#f0961e', '#ffd65a'];
const R_ZELSKL = ['#0c3a1a', '#1e7a2a', '#4cc83a', '#c4ff8a'];
const R_BRONZ  = ['#1e120a', '#3e240e', '#663c16', '#945c22', '#be8636', '#e6b860', '#fff0b8'];
const R_KAMEN  = ['#1a130e', '#30241a', '#4a3a2a', '#66523e', '#846c54', '#a68e72', '#c8b496'];
const R_ZLATO  = ['#4a2604', '#8a4e08', '#c8800e', '#f0b222', '#ffe060', '#fffbe0'];
const R_SRDCE  = ['#4e0818', '#8e1028', '#d0203e', '#ff4e6a', '#ff9aac', '#fff0f4'];
const R_TMKOV  = ['#0e1018', '#181c28', '#262c3c', '#384054', '#4e586e', '#6a768e', '#909cb4', '#c4ccdc'];
const R_OHEN   = ['#2a2026', '#46383e', '#6a2414', '#b03c12', '#ee7414', '#ffb428', '#ffe67a', '#fffbe6'];
const R_MODRA  = ['#0a1640', '#1a3c8a', '#2a78d8', '#5ac8ff', '#c0f2ff'];

function pal(znaky, rampa) { const p = {}; [...znaky].forEach((z, i) => (p[z] = rampa[i])); return p; }

// ---------------- pixelová mapa ----------------
function mapa(w, h) { return { w, h, d: new Array(w * h).fill(null) }; }
function bod(m, x, y, c) {
  x = Math.floor(x); y = Math.floor(y);
  if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.d[y * m.w + x] = c;
}
function cti(m, x, y) { return (x >= 0 && y >= 0 && x < m.w && y < m.h) ? m.d[y * m.w + x] : null; }
// fn(dx, dy, x, y, stara) dostane souřadnice středu pixelu vůči (cx, cy); vrátí barvu nebo undefined
function maluj(m, cx, cy, fn) {
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const c = fn(x + 0.5 - cx, y + 0.5 - cy, x, y, m.d[y * m.w + x]);
    if (c !== undefined) m.d[y * m.w + x] = c;
  }
}
function vMnohouhelniku(x, y, b) {
  let uvnitr = false;
  for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
    const [xi, yi] = b[i], [xj, yj] = b[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) uvnitr = !uvnitr;
  }
  return uvnitr;
}
// obrys kolem všech neprázdných pixelů (mapa se zvětší o 1 px na každé straně)
function obrys(m, barva = OBRYS) {
  const n = mapa(m.w + 2, m.h + 2);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) n.d[(y + 1) * n.w + x + 1] = m.d[y * m.w + x];
  const p = n.d.slice();
  const plny = (x, y) => x >= 0 && y >= 0 && x < n.w && y < n.h && p[y * n.w + x];
  for (let y = 0; y < n.h; y++) for (let x = 0; x < n.w; x++) {
    if (!p[y * n.w + x] && (plny(x - 1, y) || plny(x + 1, y) || plny(x, y - 1) || plny(x, y + 1))) n.d[y * n.w + x] = barva;
  }
  return n;
}
function kopieMapy(m) { return { w: m.w, h: m.h, d: m.d.slice() }; }
function prevratMapu(m) { // svisle
  const n = mapa(m.w, m.h);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) n.d[(m.h - 1 - y) * m.w + x] = m.d[y * m.w + x];
  return n;
}

// mapa -> sprite (plátno + bílá verze pro bliknutí po zásahu)
function naSprite(m, bilaSila = 1) { // bilaSila < 1: jen zesvětlená verze (pro velké lodě)
  const c = document.createElement('canvas'), b = document.createElement('canvas');
  c.width = b.width = m.w; c.height = b.height = m.h;
  const g = c.getContext('2d'), gb = b.getContext('2d');
  const img = g.createImageData(m.w, m.h), imgB = gb.createImageData(m.w, m.h);
  for (let i = 0; i < m.d.length; i++) {
    if (!m.d[i]) continue;
    const [r, gg, bb, a] = rgb(m.d[i]);
    img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = bb; img.data[i * 4 + 3] = a;
    imgB.data[i * 4] = r + (255 - r) * bilaSila; imgB.data[i * 4 + 1] = gg + (255 - gg) * bilaSila;
    imgB.data[i * 4 + 2] = bb + (255 - bb) * bilaSila; imgB.data[i * 4 + 3] = a;
  }
  g.putImageData(img, 0, 0); gb.putImageData(imgB, 0, 0);
  return { c, bila: b, w: m.w, h: m.h };
}

// ---------------- mřížky znaků ----------------
// zrcadlo: řádky jsou levá polovina včetně prostředního sloupce
function mrizka(radky, zrcadlo) {
  const g = radky.map(r => { const a = [...r]; return zrcadlo ? a.concat(a.slice(0, -1).reverse()) : a; });
  const w = Math.max(...g.map(r => r.length));
  return g.map(r => r.concat(Array(w - r.length).fill('.')));
}
function zMrizky(g, paleta) {
  const m = mapa(g[0].length, g.length);
  g.forEach((r, y) => r.forEach((ch, x) => { if (paleta[ch]) m.d[y * m.w + x] = paleta[ch]; }));
  return m;
}
// posun odstínů po rampách (světlo zleva, náklon lodi)
function posunOdstiny(g, rampy, fn) {
  return g.map((r, y) => r.map((ch, x) => {
    const d = fn(x, y);
    if (!d) return ch;
    for (const rp of rampy) {
      const i = rp.indexOf(ch);
      if (i >= 0) return rp[Math.max(0, Math.min(rp.length - 1, i + d))];
    }
    return ch;
  }));
}
// náklon: z křídla na straně, která klesá, se vyhodí víc sloupců (zkrácení),
// střed lodi zůstává na místě
function naklon(g, smer, uroven, kraj) {
  const w = g[0].length;
  const pryc = new Set();
  const vyber = (pocet, zleva) => {
    for (let i = 0; i < pocet; i++) {
      const s = Math.floor((i + 0.5) * kraj / pocet);
      pryc.add(zleva ? s : w - 1 - s);
    }
  };
  const nL = smer > 0 ? uroven : uroven * 2, nP = smer > 0 ? uroven * 2 : uroven;
  vyber(nL, true); vyber(nP, false);
  return g.map(r => Array(nL).fill('.').concat(r.filter((_, x) => !pryc.has(x)), Array(nP).fill('.')));
}
// najde trysky ('n' v nejspodnějším/nejhořejším řádku, kde jsou)
function najdiTrysky(g, odspodu) {
  const radky = g.map((r, y) => y).filter(y => g[y].includes('n'));
  if (!radky.length) return [];
  const y = odspodu ? radky[radky.length - 1] : radky[0];
  const out = [];
  let zac = -1;
  g[y].concat('.').forEach((ch, x) => {
    if (ch === 'n' && zac < 0) zac = x;
    if (ch !== 'n' && zac >= 0) { out.push({ x: (zac + x - 1) / 2 + 1, y: y + 1, sirka: x - zac }); zac = -1; }
  });
  return out;
}
// loď se snímky náklonu -urovne..+urovne
const RAMPY_LODI = ['1234567', 'abcd', 'ghij'];
function lodSnimky(radky, paleta, kraj, urovne, trysky_odspodu) {
  const zaklad = mrizka(radky, true);
  const stred = (zaklad[0].length - 1) / 2;
  const snimky = {};
  for (let u = -urovne; u <= urovne; u++) {
    const smer = Math.sign(u), uu = Math.abs(u);
    let g = uu ? naklon(zaklad, smer, uu, kraj) : zaklad;
    g = posunOdstiny(g, RAMPY_LODI, x => {
      const vpravo = x > stred, vlevo = x < stred;
      let d = vpravo ? -1 : 0; // světlo zleva
      if (smer > 0) d += vpravo ? -uu : vlevo ? uu - 1 : 0;
      if (smer < 0) d += vlevo ? -uu : vpravo ? uu : 0;
      return d;
    });
    const s = naSprite(obrys(zMrizky(g, paleta)));
    s.trysky = najdiTrysky(g, trysky_odspodu); // souřadnice ve spritu (včetně obrysu)
    snimky[u] = s;
  }
  return snimky;
}

// ===================== Edova stíhačka =====================
const PAL_HRAC = { ...pal('1234567', R_OCEL), ...pal('abcd', R_CERV), ...pal('ghij', R_SKLO), n: '#05050a', k: '#141a2a' };
const SPR_HRAC = lodSnimky([
  '.............6',
  '.............6',
  '............56',
  '............46',
  '............cd',
  '...........bcd',
  '...........4ij',
  '....j......4ij',
  '....i......3hi',
  '....4......3hi',
  '....4.....43gh',
  '....4....543gh',
  '....4...5443gg',
  '....4..54443k5',
  '....4.544443k6',
  '....45444433k6',
  '...d444443k456',
  '..dc44443k3456',
  '.dcb4443k23456',
  'dcbb333k523456',
  'cba2222k543456',
  'ba....k5643k56',
  '......k5543k45',
  '......k4432.45',
  '.......nnn..cd',
  '............bc',
  '.............b',
], PAL_HRAC, 9, 2, true);

// ===================== nepřátelská stíhačka (letí dolů) =====================
const PAL_STIH = { ...pal('1234567', R_FIAL), ...pal('abcd', R_JANTAR), ...pal('ghij', R_ZELSKL), n: '#05050a', k: '#12081c' };
const SPR_STIHACKA = lodSnimky([
  '......nn...',
  '......35..4',
  '2.....35.46',
  '32....35246',
  '432...35246',
  'c432..35246',
  'dc432335246',
  '5dc43335246',
  '.5dc4335246',
  '..5dc335hij',
  '...5c4352hi',
  '...354352gh',
  '...2.5352gh',
  '...3..23246',
  '...d...k2k6',
  '........246',
  '........246',
  '.........45',
  '.........3d',
], PAL_STIH, 6, 1, false);

// ---- plameny motorů (snímky podle délky) ----
function plameny(rampa) { // rampa: od jádra ke špičce
  const out = [];
  for (let L = 2; L <= 10; L++) {
    const varianty = [];
    for (let v = 0; v < 3; v++) {
      const m = mapa(3, L);
      for (let y = 0; y < L; y++) {
        const t = y / L;
        bod(m, 1, y, rampa[Math.min(rampa.length - 1, Math.floor(t * rampa.length))]);
        const bok = L * (0.45 + v * 0.12);
        if (y < bok) {
          const c = rampa[Math.min(rampa.length - 1, Math.floor(t * rampa.length) + 1)];
          if (v !== 1 || y > 0) bod(m, 0, y, c);
          if (v !== 2 || y > 0) bod(m, 2, y, c);
        }
      }
      varianty.push({ dolu: naSprite(m), nahoru: naSprite(prevratMapu(m)) });
    }
    out[L] = varianty;
  }
  return out;
}
const PLAMEN_MODRY = plameny(['#ffffff', '#b8f2ff', '#5ac8ff', '#2a78d8', '#1a3c8a']);
const PLAMEN_ORANZ = plameny(['#ffffff', '#ffe67a', '#ffb428', '#ee5a14', '#8a2410']);

// ===================== dron s kanónem =====================
function dronSnimek(rot) {
  const m = mapa(28, 30), cx = 14, cy = 13, R = 12.6;
  // hlaveň (pod tělem)
  maluj(m, cx, cy, (dx, dy) => {
    if (Math.abs(dx) < 2 && dy > 6 && dy < 16) return dy > 14 ? '#ff9a3a' : dx < -0.5 ? R_OCEL[4] : dx < 0.5 ? R_OCEL[3] : R_OCEL[1];
    if (Math.abs(dx) < 3 && dy > 12 && dy < 14) return R_OCEL[2];
  });
  maluj(m, cx, cy, (dx, dy, x, y) => {
    const d = Math.hypot(dx, dy) / R;
    if (d > 1) return;
    if (d > 0.7) { // obruč s otáčejícími se pláty
      const nx = dx / (d * R), ny = dy / (d * R);
      let v = 0.5 + 0.42 * (-0.6 * nx - 0.8 * ny);
      const a = ((Math.atan2(dy, dx) + rot) % (Math.PI / 4) + Math.PI / 4) % (Math.PI / 4);
      if (a < 0.16) return R_BRONZ[1];
      if (d < 0.78) v -= 0.35;
      if (d > 0.93) v -= 0.12;
      return odstin(R_BRONZ, v, x, y);
    }
    if (d > 0.62) return R_BRONZ[0];
    const s = d / 0.62, z = Math.sqrt(1 - s * s);
    const v = (-0.45 * dx / (0.62 * R) - 0.6 * dy / (0.62 * R) + 0.66 * z) * 0.85 + 0.05;
    if (d < 0.34) return '#0a0408';
    return odstin(R_OCEL, v, x, y);
  });
  const s = naSprite(obrys(m));
  s.oy = cy + 1 - s.h / 2; // střed disku vůči středu spritu
  return s;
}
const SPR_DRON = [0, 1, 2, 3].map(i => dronSnimek(i * Math.PI / 16));
// oko dronu: 0 = klid, 1 = nabíjí, 2 = svítí
const SPR_OKO = [['#5a0a10', '#b01c1c', '#ff5a3a'], ['#a01818', '#ff4a2a', '#ffb070'], ['#ff4a2a', '#ffc070', '#ffffff']].map(r => {
  const m = mapa(7, 7);
  maluj(m, 3.5, 3.5, (dx, dy, x, y) => {
    const d = Math.hypot(dx, dy);
    if (d > 3.4) return;
    return odstin(r, 1 - d / 3.4 + (-dx - dy) * 0.05, x, y);
  });
  bod(m, 2, 2, '#ffffff');
  return naSprite(m);
});

// ===================== asteroidy (3 tvary × 16 natočení) =====================
function sum1(seed) { // hladký šum na kružnici
  const a = [];
  for (let i = 0; i < 9; i++) a.push(Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453 % 1);
  return u => {
    const t = ((u / (Math.PI * 2)) % 1 + 1) % 1 * 9, i = Math.floor(t), f = t - i;
    const p = Math.abs(a[i]), q = Math.abs(a[(i + 1) % 9]);
    return p + (q - p) * (f * f * (3 - 2 * f));
  };
}
function kamenSnimky(seed) {
  const tvar = sum1(seed + 1), krat = [];
  for (let i = 0; i < 4; i++) krat.push({ u: nahoda(0, 7), d: nahoda(0.15, 0.6), r: nahoda(0.16, 0.28) });
  const out = [];
  for (let f = 0; f < 16; f++) {
    const rot = f / 16 * Math.PI * 2, R = 12;
    const m = mapa(28, 28);
    maluj(m, 14, 14, (dx, dy, x, y) => {
      const u = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
      const okraj = R * (0.74 + 0.26 * tvar(u - rot));
      if (d > okraj) return;
      const s = Math.min(0.99, d / okraj), z = Math.sqrt(1 - s * s);
      let nx = dx / okraj, ny = dy / okraj, nz = z;
      for (const c of krat) { // krátery se otáčejí s kamenem
        const kx = Math.cos(c.u + rot) * c.d * R, ky = Math.sin(c.u + rot) * c.d * R;
        const kd = Math.hypot(dx - kx, dy - ky) / (c.r * R);
        if (kd < 1) { nx -= (dx - kx) / (c.r * R) * 1.2; ny -= (dy - ky) / (c.r * R) * 1.2; }
      }
      const v = (-0.5 * nx - 0.6 * ny + 0.62 * nz) * 0.75 + 0.18;
      return odstin(R_KAMEN, v, x, y);
    });
    out.push(naSprite(obrys(m)));
  }
  return out;
}
const SPR_KAMENY = [0, 1, 2].map(kamenSnimky);

// ===================== mateřská loď (boss) =====================
const BOSS_W = 104, BOSS_H = 72, BOSS_CX = 52, BOSS_CY = 34;
const BOSS_TRUP = [[-16, -28], [16, -28], [22, -9], [17, 21], [0, 30], [-17, 21], [-22, -9]];
function bossMapa() {
  const m = mapa(BOSS_W, BOSS_H);
  const zmapuj = (dx, dy) => [Math.floor(dx + BOSS_CX), Math.floor(dy + BOSS_CY)];
  // motory vzadu (nahoře)
  for (const ex of [-10, 0, 10]) {
    maluj(m, BOSS_CX, BOSS_CY, (dx, dy, x, y) => {
      if (Math.abs(dx - ex) < 3.5 && dy > -33 && dy < -26) {
        if (dy < -31) return '#05050a';
        return odstin(R_TMKOV, 0.7 - Math.abs(dx - ex + 1) / 4, x, y);
      }
    });
  }
  for (const s of [-1, 1]) {
    // křídla
    const kr = [[s * 12, -13], [s * 29, -9], [s * 29, 9], [s * 12, 16]];
    maluj(m, BOSS_CX, BOSS_CY, (dx, dy, x, y) => {
      if (!vMnohouhelniku(dx, dy, kr)) return;
      if (Math.abs(Math.abs(dx) - 17.5) < 0.6 || Math.abs(Math.abs(dx) - 23.5) < 0.6) return R_TMKOV[1];
      let v = 0.45 - dy * 0.012 + (s < 0 ? 0.08 : -0.08);
      if (!vMnohouhelniku(dx, dy + 2, kr)) v += 0.25; // horní hrana
      if (!vMnohouhelniku(dx, dy - 2, kr)) v -= 0.25;
      return odstin(R_TMKOV, v, x, y);
    });
    // fialové ostny za gondolami
    const osten = [[s * 41, -12], [s * 50, -26], [s * 47, -8], [s * 51, 2], [s * 41, 6]];
    maluj(m, BOSS_CX, BOSS_CY, (dx, dy, x, y) => {
      if (!vMnohouhelniku(dx, dy, osten)) return;
      let v = 0.55 - dy * 0.015 + (s < 0 ? 0.1 : -0.05);
      if (!vMnohouhelniku(dx - s * 1.5, dy + 1.5, osten)) v += 0.3;
      return odstin(R_FIAL, v, x, y);
    });
    // gondoly s kanóny
    const gx = s * 35;
    maluj(m, BOSS_CX, BOSS_CY, (dx, dy, x, y) => {
      // hlaveň
      if (Math.abs(dx - gx) < 3 && dy >= 19 && dy < 31) {
        if (dy > 29) return '#05050a';
        if (Math.floor(dy) % 4 === 0) return R_TMKOV[5];
        return stupen(R_TMKOV, 0.55 - (dx - gx + 1) * 0.12);
      }
      const ox = dx - gx, oy = dy - 1;
      const rx = 8.5, ry = 19.5;
      const kx = Math.max(0, Math.abs(ox) - rx + 4), ky = Math.max(0, Math.abs(oy) - ry + 4);
      if (Math.hypot(kx, ky) > 4) return;
      let v = 0.92 - Math.abs(ox + 2.5) / 8.5 * 0.75;
      if (oy > 16) v -= 0.2;
      if (oy < -12) return odstin(R_FIAL, v + (oy < -17 ? 0.15 : 0), x, y); // fialový pancíř nahoře
      if (Math.abs(oy + 12) < 0.6) return R_FIAL[0];
      if (oy > -8 && oy < -4) return stupen(['#5a0a1a', '#a8142a', '#f03a3a', '#ff9a7a'], v + 0.1); // červený pruh
      if (Math.abs(oy - 8) < 0.6) return R_TMKOV[1];
      return odstin(R_TMKOV, v, x, y);
    });
    // nýty na gondolách
    for (const ny of [-15, 4, 14]) { const [x, y] = zmapuj(gx - 4, ny); bod(m, x, y, R_TMKOV[7]); bod(m, x, y + 1, R_TMKOV[0]); }
  }
  // hlavní trup
  maluj(m, BOSS_CX, BOSS_CY, (dx, dy, x, y) => {
    if (!vMnohouhelniku(dx, dy, BOSS_TRUP)) return;
    let v = 0.82 - Math.abs(dx + 5) / 26 * 0.7 - dy * 0.004;
    if (!vMnohouhelniku(dx - 2, dy - 2, BOSS_TRUP)) v += 0.28;
    if (!vMnohouhelniku(dx + 2, dy + 2, BOSS_TRUP)) v -= 0.3;
    // spáry mezi pláty
    if (Math.abs(dy + 9) < 0.6 || Math.abs(dy - 13) < 0.6) return R_TMKOV[1];
    if ((Math.abs(dy + 8) < 0.6 || Math.abs(dy - 14) < 0.6)) v += 0.2;
    if (Math.abs(Math.abs(dx) - 8.5) < 0.6 && dy < -9) return R_TMKOV[1];
    // fialové boční pancéřování
    if (dy > -8 && dy < 12 && (!vMnohouhelniku(dx - 4, dy, BOSS_TRUP) || !vMnohouhelniku(dx + 4, dy, BOSS_TRUP))) {
      if (!vMnohouhelniku(dx - 5, dy, BOSS_TRUP) && vMnohouhelniku(dx - 3, dy, BOSS_TRUP) || !vMnohouhelniku(dx + 5, dy, BOSS_TRUP) && vMnohouhelniku(dx + 3, dy, BOSS_TRUP)) return R_FIAL[1];
      return odstin(R_FIAL, v - 0.05, x, y);
    }
    // fialové šipky vpředu
    const sv = Math.abs(dx) * 0.7 + dy;
    if (dy > 14 && (Math.abs(sv - 22) < 1.2 || Math.abs(sv - 26) < 1.2)) return odstin(R_FIAL.slice(2), v + 0.1, x, y);
    return odstin(R_TMKOV, v, x, y);
  });
  // můstek s okny
  maluj(m, BOSS_CX, BOSS_CY, (dx, dy, x, y) => {
    const ex = dx / 6, ey = (dy + 20) / 4.5;
    const d = ex * ex + ey * ey;
    if (d > 1) return;
    if (d > 0.7) return R_TMKOV[1];
    if (Math.abs(dy + 20) < 1.5 && Math.abs(dx) < 4.5) return Math.floor(dx + 10) % 2 ? '#ff5a7a' : '#ffd0e0';
    return odstin(R_TMKOV, 0.9 - (dx + dy + 20) * 0.08, x, y);
  });
  // komora jádra
  maluj(m, BOSS_CX, BOSS_CY, (dx, dy, x, y) => {
    const d = Math.hypot(dx, dy - 2);
    if (d > 10.5) return;
    if (d > 8.5) return odstin(R_TMKOV, 0.5 + (dx + dy - 2) / d * 0.3, x, y); // obruba
    if (d > 7.5) return R_TMKOV[0];
    return '#08040a';
  });
  // přední kanón
  maluj(m, BOSS_CX, BOSS_CY, (dx, dy, x, y) => {
    if (Math.abs(dx) < 3.5 && dy >= 22 && dy < 33) {
      if (dy > 31) return '#05050a';
      if (Math.floor(dy) % 3 === 0) return R_TMKOV[6];
      return stupen(R_TMKOV, 0.6 - (dx + 1) * 0.1);
    }
  });
  // nýty na trupu
  for (const [nx, ny] of [[-12, -25], [12, -25], [-18, -6], [18, -6], [-14, 17], [14, 17], [-4, -12], [4, -12]]) {
    const [x, y] = zmapuj(nx, ny); bod(m, x, y, R_TMKOV[7]); bod(m, x, y + 1, R_TMKOV[1]);
  }
  return obrys(m);
}
const BOSS_MAPA = bossMapa();
const SPR_BOSS = naSprite(BOSS_MAPA, 0.6);
SPR_BOSS.oy = BOSS_CY + 1 - SPR_BOSS.h / 2;
// poškozená verze: spáleniny a žhnoucí praskliny
const SPR_BOSS_ZNIC = (() => {
  const m = kopieMapy(BOSS_MAPA);
  for (let i = 0; i < 9; i++) {
    const bx = nahoda(18, BOSS_W - 18), by = nahoda(12, BOSS_H - 16), br = nahoda(2, 4.5);
    maluj(m, bx, by, (dx, dy, x, y, c) => {
      if (!c || c === OBRYS) return;
      const d = Math.hypot(dx, dy);
      if (d < br) return d < br * 0.35 && bayer(x, y) > 0.4 ? '#ff7a2a' : smichej(c, '#0a0608', d < br * 0.6 ? 0.7 : 0.4);
    });
  }
  const s = naSprite(m, 0.6);
  s.oy = SPR_BOSS.oy;
  return s;
})();
// pulzující jádro (4 snímky)
const SPR_JADRO = [0, 1, 2, 3].map(f => {
  const m = mapa(17, 17), r = 5.5 + [0, 0.8, 1.4, 0.8][f];
  maluj(m, 8.5, 8.5, (dx, dy, x, y) => {
    const d = Math.hypot(dx, dy);
    if (d > r + 1.6) return;
    if (d > r) return bayer(x, y) > 0.5 ? '#ff2a4a' : undefined; // dithrovaná záře
    return odstin(['#8a0a1a', '#e02a2a', '#ff7a2a', '#ffd07a', '#ffffff'], 1.05 - d / r - (dx + dy) * 0.03, x, y);
  });
  return naSprite(m);
});

// ===================== střely =====================
// laser hráče podle síly zbraně (1 modrý, 2 zelený, 3 zlatý) a sklonu (-1, 0, 1)
function laser(sirka, delka, rampa, sklon) {
  const m = mapa(sirka + 4, delka);
  for (let y = 0; y < delka; y++) {
    const t = y / delka, posun = Math.round(-(y - delka / 2) * sklon * 0.2) + 2;
    const w = t < 0.15 ? sirka - 2 : t > 0.7 ? Math.max(1, sirka - 2) : sirka;
    for (let x = 0; x < w; x++) {
      const okraj = Math.abs(x - (w - 1) / 2) / Math.max(1, w / 2);
      const v = (1 - okraj) * 1.1 - t * 0.55 + 0.2;
      bod(m, x + posun + Math.floor((sirka - w) / 2), y, stupen(rampa, v));
    }
  }
  return naSprite(m);
}
const SPR_LASER = [null,
  [-1, 0, 1].map(s => laser(3, 9, ['#1a3c8a', '#2a78d8', '#5ac8ff', '#c0f2ff', '#ffffff'], s)),
  [-1, 0, 1].map(s => laser(4, 11, ['#0e4a2a', '#1e9a3a', '#5aea5a', '#c8ffb0', '#ffffff'], s)),
  [-1, 0, 1].map(s => laser(5, 12, ['#7a2a06', '#e07a14', '#ffc63a', '#fff09a', '#ffffff'], s)),
];
// záblesk z hlavně
const SPR_ZABLESK = [0, 1].map(f => {
  const m = mapa(9, 9);
  maluj(m, 4.5, 4.5, (dx, dy) => {
    const d = Math.abs(dx) + Math.abs(dy) * (f ? 0.7 : 1.3);
    if (d < 1.2) return '#ffffff';
    if (d < 2.6) return '#c0f2ff';
    if (d < 4 && (dx === 0.5 * Math.sign(dx) || Math.abs(dx) < 1 || Math.abs(dy) < 1)) return '#5ac8ff';
  });
  return naSprite(m);
});
// plazmová koule nepřátel (velká, růžová, dobře vidět)
const SPR_PLAZMA = [0, 1, 2, 3].map(f => {
  const m = mapa(20, 20), r = 5.2 + [0, 0.6, 1, 0.6][f];
  maluj(m, 10, 10, (dx, dy, x, y) => {
    const d = Math.hypot(dx, dy);
    if (d > r + 3.2) return;
    if (d > r + 1.2) return ((x + y + f) & 1) ? '#ff2a8a' : undefined; // dithrovaný lem
    if (d > r) return '#8a0a4a';
    return odstin(['#c8106a', '#ff3a9a', '#ff9ad0', '#ffe8f4', '#ffffff'], 1.08 - d / r - (dx + dy) * 0.035, x, y);
  });
  return naSprite(m);
});

// ===================== výbuchy (snímkové animace) =====================
function sum2(seed) { // hodnotový šum 2D
  const h = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y) => n(x, y) * 0.65 + n(x * 2.1 + 5, y * 2.1 + 3) * 0.35;
}
function vybuchSnimky(vel, pocet, seed) {
  const sum = sum2(seed), out = [];
  for (let f = 0; f < pocet; f++) {
    const t = f / (pocet - 1);
    const R = vel / 2 * (0.3 + 0.7 * (1 - Math.pow(1 - t, 2.2)));
    const m = mapa(vel, vel);
    maluj(m, vel / 2, vel / 2, (dx, dy, x, y) => {
      const d = Math.hypot(dx, dy) / R;
      const n = sum(x * 6 / vel + f * 0.15, y * 6 / vel - f * 0.25);
      if (d > 1 + (n - 0.5) * 0.7) return;
      if (t > 0.45 && n < (t - 0.45) * 1.9 + d * 0.25) return; // díry v kouři
      const teplo = (1 - d) * 1.35 + (n - 0.5) * 0.9 - t * 1.25 + 0.25;
      return odstin(R_OHEN, teplo, x, y);
    });
    out.push(naSprite(m));
  }
  return out;
}
const SPR_VYBUCH = {
  maly: [vybuchSnimky(18, 8, 1), vybuchSnimky(18, 8, 2)],
  stredni: [vybuchSnimky(28, 9, 3), vybuchSnimky(28, 9, 4)],
  velky: [vybuchSnimky(44, 11, 5), vybuchSnimky(44, 11, 6)],
};
const SPR_KOUR = vybuchSnimky(10, 6, 9).slice(3).concat(vybuchSnimky(12, 6, 10).slice(4)); // obláček kouře
// trosky (malé kousky plechu)
const SPR_TROSKY = [
  ['34', '23'], ['345', '12.'], ['4', '3', '2'], ['.4', '43', '2.'],
].map(g => naSprite(obrys(zMrizky(mrizka(g, false), pal('1234567', R_OCEL)))));

// ===================== předměty =====================
// hvězda (otáčí se jako mince)
function hvezdaMapa(sx, rampa, R = 7.5, r = 3.3) {
  const w = 17, m = mapa(w, 17);
  const body = [];
  for (let i = 0; i < 10; i++) {
    const u = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
    body.push([Math.cos(u) * rr * Math.abs(sx), Math.sin(u) * rr + 0.6]);
  }
  maluj(m, 8.5, 8.5, (dx, dy, x, y) => {
    if (!vMnohouhelniku(dx, dy, body)) return;
    // každé rameno má světlou a tmavou plošku
    const u = Math.atan2(dy - 0.6, dx / Math.max(0.2, Math.abs(sx)));
    const a = ((u + Math.PI / 2) / (Math.PI * 2 / 5) % 1 + 1) % 1;
    let v = (a < 0.5) === (sx > 0) ? 0.85 : 0.5;
    v -= dy * 0.025;
    if (Math.hypot(dx, dy - 0.6) < 1.5) v = 1;
    return stupen(rampa, v);
  });
  return obrys(m, '#3a1a02');
}
const SPR_HVEZDA = [...Array(12)].map((_, i) => { let sx = Math.cos(i * Math.PI / 6); if (Math.abs(sx) < 0.15) sx = 0.15 * (i < 6 ? 1 : -1); return naSprite(hvezdaMapa(sx, R_ZLATO)); });
const SPR_HVEZDA_MALA = naSprite(obrys(zMrizky(mrizka([
  '..5..', '..4..', '54443', '.433.', '.3.3.', '2...2',
], false), pal('12345', R_ZLATO.slice(1))), '#3a1a02'));

// srdce (tluče)
const SRDCE_MRIZKA = [
  '.bcc...ccb.',
  'bdfed.cddcb',
  'cefddcddddc',
  'cdeddddddcb',
  'bcddddddcba',
  '.bcdddddcb.',
  '..bcdddcb..',
  '...bcdcb...',
  '....bcb....',
  '.....a.....',
];
const PAL_SRDCE = pal('abcdef', R_SRDCE);
const SPR_SRDCE = naSprite(obrys(zMrizky(mrizka(SRDCE_MRIZKA, false), PAL_SRDCE), '#2a0410'));
const SPR_SRDCE_VELKE = (() => { // o kousek větší (úder srdce)
  const g = mrizka(SRDCE_MRIZKA, false);
  const v = [];
  g.forEach((r, y) => { const rr = []; r.forEach((ch, x) => { rr.push(ch); if (x === 2 || x === 8) rr.push(ch); }); v.push(rr); if (y === 3) v.push(rr.slice()); });
  return naSprite(obrys(zMrizky(v, PAL_SRDCE), '#2a0410'));
})();
const SPR_SRDCE_PRAZDNE = naSprite(obrys(zMrizky(mrizka(SRDCE_MRIZKA, false), pal('abcdef', ['#141626', '#1c1f34', '#23273e', '#262a44', '#2c3150', '#343a5c'])), '#05060c'));

// vylepšení zbraně: modrá kapsle s bleskem (6 snímků lesku)
const BLESK = ['...yy', '..yy.', '.yy..', 'yyyyy', '..yy.', '.yy..', 'yy...'];
const SPR_SILA = [0, 1, 2, 3, 4, 5].map(f => {
  const m = mapa(14, 16);
  maluj(m, 7, 8, (dx, dy, x, y) => {
    const kx = Math.max(0, Math.abs(dx) - 2.5), ky = Math.max(0, Math.abs(dy) - 4.5);
    if (Math.hypot(kx, ky) > 4.5) return;
    let v = 0.95 - Math.abs(dx + 1.5) / 6.5 * 0.8 - dy * 0.02;
    const lesk = dx * 0.6 + dy - (f * 5 - 12);
    if (Math.abs(lesk) < 1.2) v += 0.45;
    return odstin(R_MODRA, v, x, y);
  });
  BLESK.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'y') bod(m, x + 4, y + 4, y < 3 ? '#fff6a0' : '#ffc62a'); }));
  // tmavý lem kolem blesku
  const o = kopieMapy(m);
  BLESK.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch !== 'y') return;
    for (const [ax, ay] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const bx = x + ax, by = y + ay;
      if (!(BLESK[by] && BLESK[by][bx] === 'y')) bod(o, bx + 4, by + 4, '#5a2a00');
    }
  }));
  return naSprite(obrys(o, '#06102a'));
});
const SPR_BLESK = naSprite(obrys(zMrizky(mrizka([
  '....dcc',
  '...dcc.',
  '...cb..',
  '..dcb..',
  '.dccccb',
  '.....cb',
  '....cb.',
  '...cb..',
  '..cb...',
  '.cb....',
  'cb.....',
], false), pal('bcd', ['#c8800e', '#ffd23a', '#fff6b0'])), '#3a1a00'));

// dithrovaná záře (kroužek z pixelů v šachovnici)
const haloCache = {};
function halo(barva, r) {
  const klic = barva + r;
  if (haloCache[klic]) return haloCache[klic];
  const m = mapa(r * 2 + 1, r * 2 + 1);
  maluj(m, r + 0.5, r + 0.5, (dx, dy, x, y) => {
    const d = Math.hypot(dx, dy) / r;
    if (d > 1) return;
    if (d < 0.5) return bayer(x, y) < 0.45 ? barva : undefined;
    return bayer(x, y) < (1 - d) * 0.8 ? barva : undefined;
  });
  return (haloCache[klic] = naSprite(m));
}

// štít hráče (otáčející se jiskry na dithrovaném kruhu)
const SPR_STIT = [0, 1, 2, 3].map(f => {
  const m = mapa(45, 45), R = 20;
  maluj(m, 22.5, 22.5, (dx, dy, x, y) => {
    const d = Math.hypot(dx, dy);
    const u = Math.atan2(dy, dx) + f * Math.PI / 8;
    if (Math.abs(d - R) < 0.8) {
      const a = ((u % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
      return a < 0.35 ? '#ffffff' : '#5ac8ff';
    }
    if (d < R - 0.8 && d > R - 3 && ((x + y) & 1)) return '#2a78d8';
  });
  return naSprite(m);
});

// ===================== písmo (jen číslice a nadpis) =====================
const PISMO = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '#.#..', '..#..', '..#..', '..#..', '#####'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'd': ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  'o': ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  'v': ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  'a': ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  'h': ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  'r': ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
};
// malé číslice pro panel (zlaté se stínováním)
function malyZnak(z, rampa, obrysBarva = '#1a0c00') {
  const m = mapa(5, 7);
  PISMO[z].forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') bod(m, x, y, stupen(rampa, 1 - y / 7)); }));
  return naSprite(obrys(m, obrysBarva));
}
const SPR_CISLICE = {}, SPR_CISLICE_BILE = {};
for (const z of '0123456789') {
  SPR_CISLICE[z] = malyZnak(z, R_ZLATO.slice(2));
  SPR_CISLICE_BILE[z] = malyZnak(z, ['#7a8aa8', '#c8d4e8', '#ffffff'], '#0a0c18');
}
// velké znaky: každý pixel písma = kostička 4×4 se zkosenými hranami
function velkyZnak(z, rampa, kostka = 4) {
  const v = PISMO[z], m = mapa(5 * kostka, 7 * kostka);
  const plne = (x, y) => v[y] && v[y][x] === '#';
  for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) {
    if (!plne(x, y)) continue;
    const zakl = 0.85 - y / 7 * 0.6;
    for (let j = 0; j < kostka; j++) for (let i = 0; i < kostka; i++) {
      let s = zakl;
      if (j === 0 && !plne(x, y - 1)) s += 0.25;
      if (i === 0 && !plne(x - 1, y)) s += 0.12;
      if (j === kostka - 1 && !plne(x, y + 1)) s -= 0.3;
      if (i === kostka - 1 && !plne(x + 1, y)) s -= 0.15;
      bod(m, x * kostka + i, y * kostka + j, stupen(rampa, s));
    }
  }
  return naSprite(obrys(obrys(m, '#3a0c00'), '#0a0418'));
}
const VELKE_CISLICE = {};
for (const z of '0123456789') VELKE_CISLICE[z] = velkyZnak(z, R_ZLATO);
const NADPIS_ZNAKY = {}, NADPIS_STINY = {};
for (const z of 'Edovahr') {
  NADPIS_ZNAKY[z] = velkyZnak(z, R_ZLATO);
  const st = NADPIS_ZNAKY[z]; // stín = tmavě fialová silueta
  NADPIS_STINY[z] = { c: (() => { const c = document.createElement('canvas'); c.width = st.w; c.height = st.h; const g = c.getContext('2d'); g.drawImage(st.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#1a0838'; g.fillRect(0, 0, st.w, st.h); return c; })(), w: st.w, h: st.h };
}

// ===================== obrázky pro obrazovky =====================
// klávesa (víčko s hloubkou), stisk = posunutá dolů
const R_KLAV = ['#3a4258', '#6a7690', '#98a4bc', '#c8d0e0', '#e8ecf4', '#ffffff'];
function klavesaMapa(w, h, stisk) {
  const m = mapa(w, h + 3), hl = stisk ? 2 : 0;
  for (let y = hl; y < h + 3; y++) for (let x = 0; x < w; x++) {
    const kraj = x === 0 || x === w - 1;
    if (kraj && (y === hl || y === h + 2)) continue;
    if (y >= hl + h) { bod(m, x, y, kraj ? R_TMKOV[2] : R_TMKOV[3]); continue; }
    const yy = y - hl;
    let v = 0.85 - yy / h * 0.3;
    if (yy === 0) v = 1;
    if (x === 0) v += 0.08;
    if (x === w - 1) v -= 0.2;
    if (yy === h - 1) v -= 0.3;
    bod(m, x, y, stupen(R_KLAV, v));
  }
  return obrys(m, '#0a0c18');
}
const klavesaCache = {};
function SPR_KLAVESA(w, h, stisk) {
  const k = w + 'x' + h + (stisk ? 's' : '');
  return klavesaCache[k] || (klavesaCache[k] = naSprite(klavesaMapa(w, h, stisk)));
}
// šipka na klávese (směr: 0 nahoru, 1 vpravo, 2 dolů, 3 vlevo)
const SPR_SIPKA = [0, 1, 2, 3].map(sm => {
  const g = ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..'];
  const m = mapa(7, 7);
  g.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch !== '#') return;
    const [X, Y] = [[x, y], [6 - y, x], [x, 6 - y], [y, x]][sm];
    bod(m, X, Y, '#2a3248');
  }));
  return naSprite(m);
});
const SPR_P = (() => { const m = mapa(5, 7); PISMO.P.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') bod(m, x, y, '#2a3248'); })); return naSprite(m); })();

// ikona pauzy (dva kovové sloupky)
function pauzaMapa(w, h, mezera) {
  const m = mapa(w * 2 + mezera, h);
  for (const ox of [0, w + mezera]) {
    maluj(m, ox, 0, (dx, dy, x, y) => {
      if (dx < 0 || dx > w) return;
      let v = 0.9 - dx / w * 0.6;
      if (dy < 1.5) v += 0.2;
      if (dy > h - 1.5) v -= 0.3;
      return stupen(R_MODRA, v);
    });
  }
  return obrys(m, '#06102a');
}
const SPR_PAUZA = naSprite(pauzaMapa(9, 30, 7));
const SPR_PAUZA_MALA = naSprite(pauzaMapa(4, 12, 3));

// ▶ (hrát)
const SPR_HRAJ = [0, 1].map(f => {
  const m = mapa(16, 18);
  maluj(m, 0, 9, (dx, dy, x, y) => {
    if (dx < 1 || Math.abs(dy) > (15 - dx) * 0.58) return;
    return stupen(R_ZELSKL, 0.95 - dy * 0.05 - dx * 0.02 + (f ? 0.15 : 0));
  });
  return naSprite(obrys(m, '#06200a'));
});

// myš (levé tlačítko bliká)
const SPR_MYS = [false, true].map(klik => {
  const m = mapa(20, 28);
  maluj(m, 10, 14, (dx, dy) => {
    const kx = Math.max(0, Math.abs(dx) - 2), ky = Math.max(0, Math.abs(dy) - 6);
    if (Math.hypot(kx, ky) > 8) return;
    if (Math.abs(dy + 2) < 0.6 || (Math.abs(dx) < 0.6 && dy < -2)) return '#3a4258';
    const v = 0.9 - (dx + dy * 0.6) * 0.025;
    if (dx < 0 && dy < -2) return stupen(klik ? ['#1e7a2a', '#4cc83a', '#8aff6a', '#d8ffc8'] : R_KLAV, v);
    return stupen(R_KLAV, v - Math.max(0, dy) * 0.02);
  });
  return naSprite(obrys(m, '#0a0c18'));
});

// pohár pro vítěze
const SPR_POHAR = (() => {
  const m = mapa(40, 44);
  maluj(m, 20, 0, (dx, dy, x, y) => {
    const v = 0.95 - Math.abs(dx + 4) / 16 * 0.8;
    // ucha
    for (const s of [-1, 1]) {
      const d = Math.hypot(dx - s * 14, dy - 11);
      if (d < 6.5 && d > 3.8 && dx * s > 14) return stupen(R_ZLATO, 0.75 - s * 0.2 - (dy - 11) * 0.03);
    }
    // miska
    if (dy >= 2 && dy < 24) {
      const sirka = 14 - Math.pow((dy - 2) / 22, 2.2) * 11;
      if (Math.abs(dx) < sirka) return dy < 4 ? stupen(R_ZLATO, 1 - Math.abs(dx) / 30) : odstin(R_ZLATO, v + (dy < 7 ? 0.1 : 0), x, y);
    }
    // nožka
    if (dy >= 24 && dy < 33 && Math.abs(dx) < 2.5 + (dy > 30 ? (dy - 30) * 1.5 : 0)) return stupen(R_ZLATO, v);
    // podstavec
    if (dy >= 33 && dy < 40 && Math.abs(dx) < 11) return stupen(R_ZLATO, dy < 34 ? 0.9 : v - 0.15);
    if (dy >= 40 && dy < 43 && Math.abs(dx) < 13) return stupen(R_BRONZ, 0.45 - Math.abs(dx) / 40);
  });
  return obrys(m, '#3a1a02');
})();
const SPR_POHAR_S = naSprite(SPR_POHAR);

// výstražný trojúhelník s vykřičníkem
const SPR_VYSTRAHA = (() => {
  const m = mapa(41, 36);
  maluj(m, 20.5, 0, (dx, dy, x, y) => {
    if (dy < 1 || dy > 35 || Math.abs(dx) > dy * 0.58) return;
    const vnitrni = dy > 6 && dy < 32 && Math.abs(dx) < (dy - 4) * 0.58 - 2.2;
    if (!vnitrni) return stupen(['#5a0a0a', '#b81818', '#ff3a2a', '#ff8a6a'], 0.9 - dy / 50 - dx * 0.02);
    // vykřičník
    if (Math.abs(dx) < 2.2 && dy > 11 && dy < 24) return '#1a0404';
    if (Math.abs(dx) < 2.2 && dy > 26 && dy < 30) return '#1a0404';
    return stupen(['#c88a0a', '#ffd23a', '#fff09a'], 0.9 - dy / 60);
  });
  return naSprite(obrys(m, '#1a0404'));
})();

// nota (hudba zapnutá / vypnutá)
const SPR_NOTA = [true, false].map(zap => {
  const g = ['....bbbb', '..bbbaab', '..baa..b', '..b....b', '..b....b', '..b..bbb', '.bb.babb', 'babb.bb.', 'bbb.....', '.b......'];
  const m = zMrizky(mrizka(g, false), zap ? { a: '#c8ffb0', b: '#4ce03a' } : { a: '#4a5470', b: '#3a4258' });
  return naSprite(obrys(m, '#05060c'));
});

// malá ikona bosse pro panel
const SPR_BOSS_IKONA = naSprite(obrys(zMrizky(mrizka([
  'p.......',
  'pp..4555',
  'pp344455',
  '.p34rrr4',
  '..344444',
  '...3434r',
  '....3333',
  '.....3.3',
], true), { ...pal('345', R_TMKOV.slice(3)), p: R_FIAL[3], r: '#ff3a3a' })));

// ===================== kovové boční panely (HUD) =====================
// okna v panelech: [x, y, w, h] v souřadnicích panelu
const OKNA_L = { srdce: [4, 5, 30, 72], sila: [4, 87, 30, 70], nota: [4, 205, 30, 30] };
const OKNA_P = { skore: [5, 5, 32, 40], uroven: [5, 52, 32, 104], boss: [5, 166, 32, 70] };
function panelMapa(vpravo) {
  const m = mapa(PANEL, SH);
  const svy = [82, 162];
  maluj(m, 0, 0, (x0, y0, x, y) => {
    const xx = vpravo ? PANEL - 1 - x : x; // vzdálenost od kraje obrazovky
    // lišta u herní plochy
    if (xx === PANEL - 1) return '#04050a';
    if (xx === PANEL - 2) return R_TMKOV[vpravo ? 4 : 6];
    if (xx === PANEL - 3) return R_TMKOV[4];
    if (xx === PANEL - 4) return R_TMKOV[1];
    if (xx === 0) return R_TMKOV[1];
    for (const s of svy) {
      if (y === s) return R_TMKOV[0];
      if (y === s + 1) return R_TMKOV[6];
      if (y === s - 1) return R_TMKOV[2];
    }
    if (y === 0) return R_TMKOV[6];
    if (y === SH - 1) return R_TMKOV[1];
    let v = 0.42 + 0.2 * Math.sin(Math.PI * (x + 2) / (PANEL + 2)) - x * 0.002;
    if (x === 1) v += 0.15;
    if (x === PANEL - 2 - (vpravo ? PANEL - 4 : 0)) v -= 0.1;
    return odstin(R_TMKOV, v, x, y);
  });
  // nýty
  const nyt = (x, y) => { bod(m, x, y, R_TMKOV[7]); bod(m, x + 1, y, R_TMKOV[5]); bod(m, x, y + 1, R_TMKOV[4]); bod(m, x + 1, y + 1, R_TMKOV[1]); };
  const x1 = vpravo ? 6 : 2, x2 = vpravo ? PANEL - 4 : PANEL - 8;
  for (const y of [79, 85, 159, 165]) { nyt(x1, y - 1); nyt(x2, y - 1); }
  // větrací štěrbiny (levý panel dole)
  if (!vpravo) for (let i = 0; i < 6; i++) {
    const y = 170 + i * 5;
    for (let x = 8; x < 30; x++) { bod(m, x, y, R_TMKOV[0]); bod(m, x, y + 1, R_TMKOV[0]); bod(m, x, y + 2, R_TMKOV[5]); }
  }
  // zapuštěná okna (displeje)
  for (const [ox, oy, w, h] of Object.values(vpravo ? OKNA_P : OKNA_L)) {
    for (let y = oy - 1; y <= oy + h; y++) for (let x = ox - 1; x <= ox + w; x++) {
      let c;
      if (y === oy - 1 || x === ox - 1) c = R_TMKOV[0];
      else if (y === oy + h || x === ox + w) c = R_TMKOV[6];
      else if (y === oy || x === ox) c = '#03030a';
      else c = (y & 1) ? '#080a1e' : '#0b0e26'; // řádky jako na starém monitoru
      bod(m, x, y, c);
    }
  }
  return m;
}
const PANELY = (() => {
  const c = document.createElement('canvas');
  c.width = SW; c.height = SH;
  const g = c.getContext('2d');
  g.drawImage(naSprite(panelMapa(false)).c, 0, 0);
  g.drawImage(naSprite(panelMapa(true)).c, SW - PANEL, 0);
  return c;
})();
// dílky ukazatele síly zbraně (1 modrá, 2 zelená, 3 zlatá) a zhasnutý
function dilekMapa(rampa) {
  const m = mapa(20, 9);
  maluj(m, 0, 0, (x0, y0, x, y) => {
    let v = 0.75 - y / 9 * 0.5;
    if (y === 0) v = 1;
    if (y === 8) v = 0.1;
    if (x === 0) v += 0.1;
    if (x === 19) v -= 0.15;
    return stupen(rampa, v);
  });
  return naSprite(obrys(m, '#03030a'));
}
const SPR_DILEK = [dilekMapa(['#101626', '#161e34', '#1c2640', '#222e4a']),
  dilekMapa(R_MODRA), dilekMapa(['#0a3018', '#1e7a2a', '#4cc83a', '#a8ff7a', '#e8ffd0']), dilekMapa(R_ZLATO.slice(1))];
// puntíky úrovní: 0 budoucí, 1 hotová, 2 právě teď
const SPR_PUNTIK = [
  ['#10142a', '#1a2040', '#262e56'], R_ZLATO.slice(1, 6), ['#2a78d8', '#5ac8ff', '#c0f2ff', '#ffffff'],
].map(r => {
  const m = mapa(9, 9);
  maluj(m, 4.5, 4.5, (dx, dy, x, y) => {
    const d = Math.hypot(dx, dy);
    if (d > 4.3) return;
    return stupen(r, 0.95 - d / 4.3 * 0.6 - (dx + dy) * 0.06);
  });
  return naSprite(obrys(m, '#03030a'));
});
// šachovnice pro ztmavení obrazovky (pauza, konec)
const SACHOVNICE = (() => {
  const c = document.createElement('canvas');
  c.width = PW; c.height = PH;
  const g = c.getContext('2d');
  g.fillStyle = '#04030c';
  for (let y = 0; y < PH; y++) for (let x = y & 1; x < PW; x += 2) g.fillRect(x, y, 1, 1);
  return c;
})();
