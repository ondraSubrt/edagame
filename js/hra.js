// ===================== Kreslení spritů =====================
// x, y jsou pixely herní plochy (střed spritu); poloha se zaokrouhlí,
// aby pixely spritu ležely přesně na pixelech plátna.
function spr(s, x, y, bily = false, g = ctx) {
  g.drawImage(bily ? s.bila : s.c, Math.round(x - s.w / 2), Math.round(y - s.h / 2));
}
function sprRoh(s, x, y, g = ctx) { g.drawImage(s.c, Math.round(x), Math.round(y)); }
function pixel(x, y, barva, w = 1, h = 1, g = ctx) {
  g.fillStyle = barva;
  g.fillRect(Math.round(x), Math.round(y), w, h);
}
// číslo z pixelových číslic (zarovnání: -1 vlevo, 0 na střed, 1 vpravo)
function kresliCislo(t, x, y, sada = SPR_CISLICE, zarovnani = 0, g = ctx, mezera = 0) {
  t = String(t);
  const krok = sada['0'].w - 1 + mezera, sirka = krok * t.length + 1;
  let x0 = zarovnani < 0 ? x : zarovnani > 0 ? x - sirka : x - sirka / 2;
  for (const z of t) { g.drawImage(sada[z].c, Math.round(x0), Math.round(y - sada[z].h / 2)); x0 += krok; }
}
// plameny z trysek lodi
function kresliPlameny(s, px, py, sada, delka, nahoru) {
  const x0 = Math.round(px - s.w / 2), y0 = Math.round(py - s.h / 2);
  s.trysky.forEach((t, i) => {
    const L = Math.max(2, Math.min(10, Math.round(delka + Math.random() * 2)));
    const v = sada[L][(Math.floor(cas * 24) + i) % 3];
    const img = nahoru ? v.nahoru : v.dolu;
    ctx.drawImage(img.c, x0 + Math.floor(t.x - 1), nahoru ? y0 + t.y - L : y0 + t.y + 1);
  });
}

// ===================== Vesmírné pozadí =====================
// tmavý přechod s ditheringem
const pozadiZaklad = (() => {
  const m = mapa(PW, PH), r = prechod(['#160a3a', '#0e0c36', '#081232'], 6);
  maluj(m, 0, 0, (dx, dy, x, y) => odstin(r, y / PH, x, y));
  return naSprite(m).c;
})();

// mlhovina: barevné obláčky + šum, průhlednost ve stupních s ditheringem
const MLHA_H = 1200, MLHA_PH = MLHA_H * MER;
const mlha = document.createElement('canvas');
mlha.width = PW; mlha.height = MLHA_PH;
(function vytvorMlhu() {
  const g = mlha.getContext('2d');
  const barvy = ['#6b2fbf', '#2f5fbf', '#bf2f8a', '#2fa6bf', '#4a2fbf'];
  for (let i = 0; i < 14; i++) {
    const x = nahoda(0, PW), y = nahoda(0, MLHA_PH), r = nahoda(48, 112);
    const b = barvy[i % barvy.length];
    for (const dy of [-MLHA_PH, 0, MLHA_PH]) {
      const gr = g.createRadialGradient(x, y + dy, 0, x, y + dy, r);
      gr.addColorStop(0, b + 'aa');
      gr.addColorStop(0.5, b + '44');
      gr.addColorStop(1, b + '00');
      g.fillStyle = gr;
      g.fillRect(x - r, y + dy - r, r * 2, r * 2);
    }
  }
  const sum = sum2(7);
  const img = g.getImageData(0, 0, PW, MLHA_PH), d = img.data;
  for (let y = 0; y < MLHA_PH; y++) for (let x = 0; x < PW; x++) {
    const i = (y * PW + x) * 4;
    const t = y / MLHA_PH; // šum navazuje nahoře a dole (mlha se opakuje)
    const n = sum(x / 26, y / 26) * (1 - t) + sum(x / 26, (y - MLHA_PH) / 26) * t;
    let a = d[i + 3] / 255 * (0.25 + n * 1.25) * 0.62;
    a = Math.floor(a * 6 + bayer(x, y)) / 6; // stupně průhlednosti
    d[i + 3] = Math.max(0, Math.min(255, a * 255));
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 160; i++) { // vzdálený prach
    g.fillStyle = `rgba(255,255,255,${nahoda(0.1, 0.35)})`;
    g.fillRect(Math.floor(nahoda(0, PW)), Math.floor(nahoda(0, MLHA_PH)), 1, 1);
  }
})();
let mlhaY = 0;

const BARVY_HVEZD = ['#ffffff', '#cfe3ff', '#fff1c4', '#ffd6f5'].map(b => [0.3, 0.5, 0.75, 1].map(t => smichej('#0c0c30', b, t)));
const hvezdy = [];
for (let i = 0; i < 110; i++) {
  const vrstva = Math.random();
  hvezdy.push({
    x: nahoda(0, W), y: nahoda(0, H), v: 0.3 + vrstva * 1.6, r: 0.6 + vrstva * 1.8,
    faze: nahoda(0, 6), mrk: nahoda(1, 4),
    barvy: BARVY_HVEZD[Math.floor(nahoda(0, 4))],
  });
}

// planety: předkreslené po pixelech (koule s pruhy, prstenec vpředu i vzadu)
function planetaSprite(p) {
  const r = p.r * MER, rx = r * 1.7, ry = r * 0.45, uhel = 0.35;
  const w = Math.ceil((p.prstenec ? rx : r) * 2 + 4), h = Math.ceil(r * 2 + 4);
  const m = mapa(w, h);
  const rampa = prechod([smichej(p.b, '#05041a', 0.6), p.b, p.a, smichej(p.a, '#ffffff', 0.5)], 7);
  const rPrst = prechod(['#4a3058', '#a07ca8', '#e8c8e0', '#fff0f8'], 5);
  maluj(m, w / 2, h / 2, (dx, dy, x, y) => {
    const d = Math.hypot(dx, dy) / r;
    let prst = null;
    if (p.prstenec) {
      const X = dx * Math.cos(uhel) + dy * Math.sin(uhel), Y = -dx * Math.sin(uhel) + dy * Math.cos(uhel);
      const q = Math.sqrt((X / rx) ** 2 + (Y / ry) ** 2);
      if (q > 0.7 && q < 1 && Math.abs(q - 0.84) > 0.03) prst = { vpredu: Y > 0, v: 0.75 - X / rx * 0.35 - (q > 0.84 ? 0.15 : 0) };
    }
    if (prst && (prst.vpredu || d >= 1)) return odstin(rPrst, prst.v, x, y);
    if (d < 1) {
      const z = Math.sqrt(1 - d * d);
      let v = -0.55 * dx / r - 0.5 * dy / r + 0.67 * z;
      v += 0.09 * Math.sin(dy / r * 8 + Math.sin(dx / r * 3) * 1.5);
      return odstin(rampa, v * 0.85 + 0.12, x, y);
    }
  });
  return naSprite(m);
}
const planety = [
  { x: 140, y: 110, r: 62, a: '#ffc2e2', b: '#8a3a8f', v: 0.18, prstenec: true },
  { x: 660, y: -320, r: 38, a: '#b8f2ff', b: '#2a6a9a', v: 0.26, prstenec: false },
];
for (const p of planety) p.spr = planetaSprite(p);

function posunPozadi() {
  mlhaY = (mlhaY + 0.15 * k) % MLHA_H;
  for (const p of planety) {
    p.y += p.v * k;
    if (p.y - p.r * 2 > H) { p.y = -p.r * 2 - nahoda(100, 500); p.x = nahoda(60, W - 60); }
  }
  for (const s of hvezdy) {
    s.y += s.v * k;
    if (s.y > H) { s.y -= H + 4; s.x = nahoda(0, W); }
  }
}

function kresliPozadi() {
  ctx.drawImage(pozadiZaklad, 0, 0);
  const my = Math.round(P(mlhaY));
  ctx.drawImage(mlha, 0, my - MLHA_PH);
  ctx.drawImage(mlha, 0, my);
  for (const p of planety) spr(p.spr, P(p.x), P(p.y));
  for (const s of hvezdy) {
    const jas = 0.55 + Math.sin(cas * s.mrk + s.faze) * 0.35;
    const i = Math.max(0, Math.min(3, Math.floor(jas * 4 * (s.r > 1.2 ? 1 : 0.7))));
    const x = Math.round(P(s.x)), y = Math.round(P(s.y));
    pixel(x, y, s.barvy[i]);
    if (s.r > 2 && i >= 1) { // velké hvězdy jako křížek
      ctx.fillStyle = s.barvy[i - 1];
      ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
      if (i === 3) { ctx.fillStyle = s.barvy[0]; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); ctx.fillStyle = s.barvy[3]; ctx.fillRect(x, y, 1, 1); }
    }
  }
}

// ===================== Stav hry =====================
let stav = 'menu'; // menu, hra, pauza, konec, vyhra
let hrac, strely, nepratele, strelyNepratel, predmety, castice, vlny, cisla;
let skore, uroven, zabito, dalsiVlna, boss, otresy, ohnostroj, varovani, zablesk;
let vrak = null;   // hořící vrak bosse (jen na efekt)
let konecT = 0;    // jak dlouho je konec/výhra (plynulé ztmavení)

function novaHra() {
  hrac = { x: W / 2, y: H - 90, vx: 0, vy: 0, r: 20, zivoty: 5, sila: 1, nesmrtelny: 0, kadence: 0, trysk: 0, zablesk: 0 };
  strely = []; nepratele = []; strelyNepratel = []; predmety = []; castice = []; vlny = []; cisla = [];
  skore = 0; uroven = 1; zabito = 0; dalsiVlna = 60; boss = null; otresy = 0; ohnostroj = 0; varovani = 0; zablesk = 0;
  vrak = null; konecT = 0;
  stav = 'hra';
  ukazCislo(1);
  if (zvuk.bossHudba) zvuk.bossHudba(false);
  zvuk.krok = 0;
  zvuk.spustHudbu();
}

function stisknuto(klav) {
  if (klav === 'm' || klav === 'M') { zvuk.hudbaZap = !zvuk.hudbaZap; return; }
  const pauzaKlavesa = klav === 'p' || klav === 'P' || klav === 'Escape';
  if (stav === 'hra' && pauzaKlavesa) { stav = 'pauza'; zvuk.zastavHudbu(); zvuk.pauza(); return; }
  if (stav === 'pauza' && (pauzaKlavesa || klav === ' ')) { stav = 'hra'; zvuk.dal(); zvuk.spustHudbu(); return; }
  if (klav === ' ' && (stav === 'menu' || stav === 'konec' || stav === 'vyhra')) novaHra();
}

// velké číslo úrovně uprostřed obrazovky (místo textu)
function ukazCislo(n) { cisla.push({ n, zivot: 100 }); }

// ===================== Výbuchy a částice =====================
// výbuch = několik snímkových ohnivých koulí + jiskry + trosky + kouř
function pridejOhen(sady, x, y, zpozdeni, rychlost) {
  const snimky = sady[Math.floor(nahoda(0, sady.length))];
  const zivot = zpozdeni + snimky.length * rychlost;
  castice.push({ typ: 'ohen', x, y, vx: 0, vy: 0, snimky, zpozdeni, rychlost, zivot, max: zivot });
}
function pridejKour(x, y, zpozdeni = 0) {
  const zivot = zpozdeni + nahoda(24, 36);
  castice.push({ typ: 'kour', x, y, vx: nahoda(-0.4, 0.4), vy: nahoda(-0.6, 0), zpozdeni, zivot, max: zivot });
}
function vybuch(x, y, vel = 1) {
  const sq = Math.sqrt(vel);
  pridejOhen(vel >= 2.5 ? SPR_VYBUCH.velky : SPR_VYBUCH.stredni, x, y, 0, 3);
  const n = Math.round(1 + vel * 1.6);
  for (let i = 0; i < n; i++) {
    const u = nahoda(0, 7), d = nahoda(14, 34) * sq;
    pridejOhen(vel >= 2.5 && i % 2 ? SPR_VYBUCH.stredni : SPR_VYBUCH.maly, x + Math.cos(u) * d, y + Math.sin(u) * d, nahoda(2, 6 + vel * 5), nahoda(2.5, 3.5));
  }
  for (let i = 0; i < 2 + vel * 2; i++) pridejKour(x + nahoda(-20, 20) * sq, y + nahoda(-20, 20) * sq, nahoda(10, 22));
  for (let i = 0; i < Math.min(40, 10 * vel); i++) {
    const u = nahoda(0, 7), v = nahoda(3, 7);
    castice.push({ typ: 'jiskra', x, y, vx: Math.cos(u) * v, vy: Math.sin(u) * v, zivot: nahoda(12, 24), max: 24 });
  }
  for (let i = 0; i < 3 * vel; i++) {
    const u = nahoda(0, 7), v = nahoda(1.5, 4);
    const zivot = nahoda(30, 50);
    castice.push({ typ: 'troska', x, y, vx: Math.cos(u) * v, vy: Math.sin(u) * v, rot: nahoda(0, 7), rotV: nahoda(-0.3, 0.3), spr: SPR_TROSKY[i % SPR_TROSKY.length], kourT: nahoda(0, 4), zivot, max: zivot });
  }
  vlny.push({ x, y, r: 6, zivot: 16, max: 16, sila: vel });
}

function ohnostrojBum(x, y) {
  const barva = ['#ffe66d', '#ff6bd6', '#7CFF6B', '#4fc3f7', '#ff8a3c'][Math.floor(nahoda(0, 5))];
  for (let i = 0; i < 40; i++) {
    const u = i / 40 * Math.PI * 2, v = nahoda(2.5, 4.5);
    castice.push({ typ: 'jiskra', x, y, vx: Math.cos(u) * v, vy: Math.sin(u) * v, zivot: 45, max: 45, barva });
  }
}

function jiskricky(x, y, barva, pocet = 6) {
  for (let i = 0; i < pocet; i++) {
    const u = nahoda(0, 7), v = nahoda(1.5, 4);
    castice.push({ typ: 'jiskra', x, y, vx: Math.cos(u) * v, vy: Math.sin(u) * v, zivot: nahoda(10, 20), max: 20, barva });
  }
}

function posunCastice() {
  const nove = [];
  for (const c of castice) {
    const tlum = Math.pow(c.typ === 'kour' ? 0.97 : c.typ === 'jiskra' ? 0.94 : 0.92, k);
    c.vx *= tlum; c.vy *= tlum;
    c.x += c.vx * k; c.y += (c.vy + 0.35) * k; // 0.35 = pomalý posun s vesmírem
    if (c.rot !== undefined) c.rot += c.rotV * k;
    c.zivot -= k;
    if (c.typ === 'troska' && (c.kourT -= k) <= 0) { // trosky za sebou nechávají kouř
      c.kourT = 5;
      nove.push({ typ: 'kour', x: c.x, y: c.y, vx: 0, vy: 0, zpozdeni: 0, zivot: 18, max: 18 });
    }
  }
  castice = castice.filter(c => c.zivot > 0).concat(nove);
  for (const v of vlny) { v.r += (3 + v.sila) * k; v.zivot -= k; }
  vlny = vlny.filter(v => v.zivot > 0);
  for (const c of cisla) c.zivot -= k;
  cisla = cisla.filter(c => c.zivot > 0);
  if (otresy > 0) otresy = Math.max(0, otresy - k);
  // hořící vrak bosse: řada výbuchů a nakonec velký
  if (vrak) {
    vrak.t += k; vrak.y += 0.3 * k;
    vrak.dalsi -= k;
    if (vrak.dalsi <= 0) {
      vrak.dalsi = nahoda(5, 9);
      vybuch(vrak.x + nahoda(-95, 95), vrak.y + nahoda(-55, 55), nahoda(1, 1.8));
      otresy = Math.max(otresy, 6);
    }
    if (vrak.t > 100) {
      vybuch(vrak.x, vrak.y, 4);
      for (let i = 0; i < 4; i++) vybuch(vrak.x + nahoda(-80, 80), vrak.y + nahoda(-40, 40), 2.5);
      otresy = 25; zablesk = 1;
      if (zvuk.bum) zvuk.bum(3);
      vrak = null;
    }
  }
}

const BARVY_JISKER = ['#a02a10', '#ff7a1a', '#ffd23a', '#fffbe0'];
function kresliCastice() {
  // kouř
  for (const c of castice) if (c.typ === 'kour') {
    const vek = c.max - c.zivot - c.zpozdeni;
    if (vek < 0) continue;
    const f = Math.min(SPR_KOUR.length - 1, Math.floor(vek / (c.max - c.zpozdeni) * SPR_KOUR.length));
    spr(SPR_KOUR[f], P(c.x), P(c.y));
  }
  // trosky
  for (const c of castice) if (c.typ === 'troska') spr(c.spr, P(c.x), P(c.y), Math.floor(c.rot * 2) % 2 === 0);
  // ohnivé koule
  for (const c of castice) if (c.typ === 'ohen') {
    const vek = c.max - c.zivot - c.zpozdeni;
    if (vek < 0) continue;
    spr(c.snimky[Math.min(c.snimky.length - 1, Math.floor(vek / c.rychlost))], P(c.x), P(c.y));
  }
  // jiskry a stopa motorů
  for (const c of castice) {
    const t = c.zivot / c.max;
    if (c.typ === 'jiskra') {
      const x = P(c.x), y = P(c.y);
      const hlava = c.barva ? (t > 0.3 ? c.barva : smichej(c.barva, '#000000', 0.5)) : BARVY_JISKER[Math.min(3, Math.floor(t * 4.5))];
      const ocas = c.barva ? smichej(c.barva, '#000000', 0.55) : BARVY_JISKER[Math.max(0, Math.min(3, Math.floor(t * 4.5)) - 1)];
      pixel(x - c.vx * MER * 1.6, y - c.vy * MER * 1.6, ocas);
      pixel(x - c.vx * MER * 0.8, y - c.vy * MER * 0.8, ocas);
      pixel(x, y, hlava);
      if (c.barva && t > 0.55) pixel(x, y + 1, hlava); // ohňostroj svítí víc
    } else if (c.typ === 'trysk') {
      const barva = t > 0.7 ? '#e6fbff' : t > 0.45 ? '#5ac8ff' : t > 0.2 ? '#2a78d8' : '#1a3c8a';
      pixel(P(c.x), P(c.y), barva, t > 0.5 ? 2 : 1, 1);
    }
  }
  // tlakové vlny (kroužek z pixelů)
  for (const v of vlny) {
    const r = P(v.r), t = v.zivot / v.max;
    ctx.fillStyle = t > 0.5 ? '#fff2d0' : '#ffb45a';
    const n = Math.max(8, Math.floor(r * 4));
    for (let i = 0; i < n; i++) {
      if (t < 0.35 && i % 2) continue; // dohasíná
      const u = i / n * Math.PI * 2;
      ctx.fillRect(Math.round(P(v.x) + Math.cos(u) * r), Math.round(P(v.y) + Math.sin(u) * r), 1, 1);
    }
  }
}

// ===================== Nepřátelé =====================
const DRUHY = {
  stihacka: { typ: 'stihacka', r: 20, zivoty: 1, body: 10 },
  dron:     { typ: 'dron', r: 24, zivoty: 2, body: 20 },
  kamen:    { typ: 'kamen', r: 26, zivoty: 3, body: 15 },
};

function pridejFormaci() {
  const pocet = 3 + Math.min(2, Math.floor(uroven / 2));
  const x = nahoda(130, W - 130), amp = nahoda(40, 90);
  const vy = 1.4 * RYCHLOST_NEPRATEL * (1 + uroven * 0.08);
  const rozestup = 50;
  for (let i = 0; i < pocet; i++) {
    nepratele.push({
      ...DRUHY.stihacka, x, zakladX: x, y: -30 - i * rozestup, vy, amp,
      faze: -i * 0.04 * rozestup / vy, // aby letěly za sebou jako had
      zasah: 0,
    });
  }
}
function pridejDron() {
  const x = nahoda(100, W - 100);
  nepratele.push({ ...DRUHY.dron, x, zakladX: x, y: -40, vy: 0.9 * RYCHLOST_NEPRATEL, faze: nahoda(0, 6), strelba: nahoda(60, 120), zasah: 0 });
}
function pridejKamen() {
  nepratele.push({
    ...DRUHY.kamen, x: nahoda(60, W - 60), y: -40, vx: nahoda(-0.4, 0.4),
    vy: nahoda(1, 1.5) * RYCHLOST_NEPRATEL, rot: nahoda(0, 7), rotV: nahoda(-0.03, 0.03),
    spr: SPR_KAMENY[Math.floor(nahoda(0, 3))], zasah: 0,
  });
}

function pridejBosse() {
  const zivoty = 30 + uroven * 12;
  boss = { x: W / 2, y: -120, zivoty, max: zivoty, faze: 0, zasah: 0, strelba: 90, strana: 0 };
  varovani = 150;
  zvuk.sirena();
  if (zvuk.bossHudba) zvuk.bossHudba(true);
}

function kresliNepritele(n) {
  const x = P(n.x), y = P(n.y), bily = n.zasah > 0;
  if (n.typ === 'stihacka') {
    const dx = n.amp * Math.cos(n.faze) * 0.04;
    const s = SPR_STIHACKA[dx > 0.6 ? 1 : dx < -0.6 ? -1 : 0];
    kresliPlameny(s, x, y, PLAMEN_ORANZ, 3, true);
    spr(s, x, y, bily);
  } else if (n.typ === 'dron') {
    const s = SPR_DRON[Math.floor(cas * 10) % 4];
    spr(s, x, y - s.oy, bily);
    const oko = n.strelba < 30 ? 1 + Math.floor(cas * 16) % 2 : 0;
    if (!bily) spr(SPR_OKO[oko], x, y);
  } else {
    const f = Math.floor(((n.rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * 16) % 16;
    spr(n.spr[f], x, y, bily);
  }
}

function kresliBosse(b) {
  const x = P(b.x), y = P(b.y), bily = b.zasah > 0;
  const znic = b.zivoty < b.max / 2;
  // motory vzadu
  [-10, 0, 10].forEach((ex, i) => {
    const v = PLAMEN_ORANZ[6 + Math.floor(Math.random() * 3)][(Math.floor(cas * 20) + i) % 3];
    ctx.drawImage(v.nahoru.c, Math.round(x + ex - 1), Math.round(y - 33 - v.nahoru.h));
    ctx.drawImage(v.nahoru.c, Math.round(x + ex - 3), Math.round(y - 33 - v.nahoru.h + 2));
    ctx.drawImage(v.nahoru.c, Math.round(x + ex + 1), Math.round(y - 33 - v.nahoru.h + 2));
  });
  const s = znic ? SPR_BOSS_ZNIC : SPR_BOSS;
  spr(s, x, y - s.oy, bily);
  if (!bily) {
    spr(SPR_JADRO[Math.floor(cas * 10) % 4], x, y + 2);
    // blikající světla na gondolách
    const sviti = Math.floor(cas * 4) % 2;
    for (const sx of [-1, 1]) {
      if (sviti) spr(halo('#ffd23a', 4), x + sx * 35, y - 12);
      pixel(Math.round(x + sx * 35) - 1, Math.round(y - 13), sviti ? '#fff6a0' : '#8a6a10', 2, 2);
    }
  }
  // poškozený boss kouří a jiskří
  if (znic && stav === 'hra' && Math.random() < 0.12 * k) {
    pridejKour(b.x + nahoda(-80, 80), b.y + nahoda(-40, 40));
    if (Math.random() < 0.4) jiskricky(b.x + nahoda(-60, 60), b.y + nahoda(-30, 40), '#ffd23a', 3);
  }
}

function kresliVrak() {
  if (!vrak) return;
  const bily = Math.floor(vrak.t / 3) % 3 === 0;
  spr(SPR_BOSS_ZNIC, P(vrak.x) + Math.round(Math.sin(vrak.t * 1.7)), P(vrak.y) - SPR_BOSS_ZNIC.oy, bily);
}

// ===================== Hráč =====================
function kresliLod(x, y, naklon = 0, vy = 0, bily = false) {
  const s = SPR_HRAC[naklon];
  kresliPlameny(s, x, y, PLAMEN_MODRY, 4 + (vy < -1 ? 3 : vy > 1 ? -1 : 0), false);
  spr(s, x, y, bily);
}

function kresliHrace() {
  const v = hrac.vx / RYCHLOST_HRACE;
  const naklon = v > 0.55 ? 2 : v > 0.18 ? 1 : v < -0.55 ? -2 : v < -0.18 ? -1 : 0;
  const x = P(hrac.x), y = P(hrac.y);
  kresliLod(x, y, naklon, hrac.vy, hrac.nesmrtelny > 138 && Math.floor(cas * 20) % 2 === 0);
  if (hrac.zablesk > 0) { // záblesky z hlavní
    const z = SPR_ZABLESK[Math.floor(hrac.zablesk) % 2];
    spr(z, x, y - 15);
    if (hrac.sila >= 2) { spr(z, x - 9, y - 7); spr(z, x + 9, y - 7); }
  }
  if (hrac.nesmrtelny > 0 && (hrac.nesmrtelny > 40 || Math.floor(cas * 12) % 2)) {
    spr(SPR_STIT[Math.floor(cas * 12) % 4], x, y);
  }
}

// ===================== Předměty =====================
function pustPredmet(x, y) {
  const r = Math.random();
  if (r < 0.35) predmety.push({ druh: 'hvezda', x, y });
  else if (r < 0.44) predmety.push({ druh: 'sila', x, y });
  else if (r < 0.49) predmety.push({ druh: 'srdce', x, y });
}

const BARVY_PREDMETU = { hvezda: '#ffd84d', sila: '#5ad8ff', srdce: '#ff4d6d' };

function kresliPredmet(p) {
  const x = P(p.x), y = P(p.y);
  spr(halo(BARVY_PREDMETU[p.druh], 9 + Math.floor(cas * 6) % 2), x, y);
  if (p.druh === 'hvezda') {
    spr(SPR_HVEZDA[Math.floor(cas * 14) % 12], x, y);
  } else if (p.druh === 'sila') {
    const f = Math.floor(cas * 10) % 14; // lesk přejede a chvíli se čeká
    spr(SPR_SILA[Math.min(5, f)], x, y + Math.round(Math.sin(cas * 4)));
  } else {
    spr(Math.floor(cas * 5) % 3 === 0 ? SPR_SRDCE_VELKE : SPR_SRDCE, x, y);
  }
}

// ===================== Aktualizace =====================
function zraneniHrace() {
  if (hrac.nesmrtelny > 0) return;
  hrac.zivoty--;
  hrac.nesmrtelny = 150;
  hrac.sila = Math.max(1, hrac.sila - 1);
  otresy = 12;
  zvuk.au();
  vybuch(hrac.x, hrac.y, 1);
  if (hrac.zivoty <= 0) {
    vybuch(hrac.x, hrac.y, 3);
    stav = 'konec';
    konecT = 0;
    zvuk.zastavHudbu();
    zvuk.konec();
  }
}

function zasahNepritele(n, dmg = 1) {
  n.zivoty -= dmg; n.zasah = 5;
  if (n.zivoty <= 0) {
    n.mrtvy = true;
    skore += n.body; zabito++;
    vybuch(n.x, n.y, n.typ === 'stihacka' ? 1 : 1.5);
    zvuk.bum(1);
    pustPredmet(n.x, n.y);
  } else {
    jiskricky(n.x, n.y + 10, '#ffe9a0', 5);
    zvuk.zasah();
  }
}

function aktualizuj() {
  // pohyb hráče
  let cilX = 0, cilY = 0;
  if (klavesy['ArrowLeft']) cilX -= RYCHLOST_HRACE;
  if (klavesy['ArrowRight']) cilX += RYCHLOST_HRACE;
  if (klavesy['ArrowUp']) cilY -= RYCHLOST_HRACE;
  if (klavesy['ArrowDown']) cilY += RYCHLOST_HRACE;
  const plynulost = 1 - Math.pow(0.78, k);
  hrac.vx += (cilX - hrac.vx) * plynulost;
  hrac.vy += (cilY - hrac.vy) * plynulost;
  hrac.x = Math.max(40, Math.min(W - 40, hrac.x + hrac.vx * k));
  hrac.y = Math.max(50, Math.min(H - 50, hrac.y + hrac.vy * k));
  if (hrac.nesmrtelny > 0) hrac.nesmrtelny -= k;
  if (hrac.zablesk > 0) hrac.zablesk -= k;

  // stopa z motorů
  hrac.trysk -= k;
  while (hrac.trysk <= 0) {
    hrac.trysk += 1.5;
    for (const s of [-1, 1]) {
      castice.push({ typ: 'trysk', x: hrac.x + s * 12 + nahoda(-2, 2), y: hrac.y + 40, vx: -hrac.vx * 0.2, vy: nahoda(2, 3.5), zivot: 16, max: 16 });
    }
  }

  // střelba
  hrac.kadence -= k;
  if (klavesy[' '] && hrac.kadence <= 0) {
    hrac.kadence = 10;
    hrac.zablesk = 4;
    const lvl = hrac.sila; // jen vzhled střely
    strely.push({ x: hrac.x, y: hrac.y - 40, vx: 0, lvl });
    if (hrac.sila >= 2) { strely.push({ x: hrac.x - 22, y: hrac.y - 12, vx: 0, lvl }); strely.push({ x: hrac.x + 22, y: hrac.y - 12, vx: 0, lvl }); }
    if (hrac.sila >= 3) { strely.push({ x: hrac.x - 22, y: hrac.y - 12, vx: -1.8, lvl }); strely.push({ x: hrac.x + 22, y: hrac.y - 12, vx: 1.8, lvl }); }
    zvuk.strela();
  }
  for (const s of strely) { s.y -= RYCHLOST_STREL * k; s.x += s.vx * k; }
  strely = strely.filter(s => s.y > -30 && !s.pryc);

  // vlny nepřátel
  if (!boss && zabito < ZABIT_NA_BOSSE * uroven) {
    dalsiVlna -= k;
    if (dalsiVlna <= 0) {
      const r = Math.random();
      if (r < 0.5) { pridejFormaci(); dalsiVlna = Math.max(90, 150 - uroven * 12); }
      else if (r < 0.75 || uroven === 1) { pridejKamen(); dalsiVlna = Math.max(45, 75 - uroven * 6); }
      else { pridejDron(); dalsiVlna = Math.max(60, 90 - uroven * 6); }
    }
  } else if (!boss && nepratele.length === 0) {
    pridejBosse();
  }

  for (const n of nepratele) {
    n.y += n.vy * k;
    if (n.typ === 'stihacka') {
      n.faze += 0.04 * k;
      n.x = n.zakladX + Math.sin(n.faze) * n.amp;
    } else if (n.typ === 'dron') {
      n.faze += 0.02 * k;
      n.x = n.zakladX + Math.sin(n.faze) * 60;
      n.strelba -= k;
      if (n.strelba <= 0 && n.y > 0 && n.y < H - 250) {
        n.strelba = nahoda(130, 200) - uroven * 8;
        strelyNepratel.push({ x: n.x, y: n.y + 30, vx: 0, vy: RYCHLOST_STREL_NEPRATEL });
      }
    } else {
      n.x += n.vx * k;
      n.rot += n.rotV * k;
    }
    if (n.zasah > 0) n.zasah -= k;
    for (const s of strely) {
      if (!s.pryc && vzdal(s, n) < n.r + 6) { s.pryc = true; zasahNepritele(n); if (n.mrtvy) break; }
    }
    if (!n.mrtvy && vzdal(n, hrac) < n.r + hrac.r - 4) { zasahNepritele(n, 99); zraneniHrace(); }
    if (n.y > H + 60) n.mrtvy = true;
  }
  nepratele = nepratele.filter(n => !n.mrtvy);

  // boss
  if (varovani > 0) varovani -= k;
  if (boss) {
    boss.faze += 0.012 * k;
    if (boss.y < 165) boss.y += 1.0 * k;
    else boss.x = W / 2 + Math.sin(boss.faze) * 220;
    if (boss.zasah > 0) boss.zasah -= k;
    if (boss.y >= 165) boss.strelba -= k;
    if (boss.strelba <= 0) {
      boss.strelba = Math.max(55, 90 - uroven * 8);
      boss.strana = (boss.strana + 1) % 3;
      if (boss.strana === 2) {
        for (let i = -1; i <= 1; i++) strelyNepratel.push({ x: boss.x, y: boss.y + 78, vx: i * 1.1, vy: RYCHLOST_STREL_NEPRATEL });
      } else {
        const s = boss.strana === 0 ? -1 : 1;
        strelyNepratel.push({ x: boss.x + s * 88, y: boss.y + 72, vx: 0, vy: RYCHLOST_STREL_NEPRATEL });
      }
    }
    for (const s of strely) {
      if (!s.pryc && Math.abs(s.x - boss.x) < 110 && Math.abs(s.y - boss.y) < 60) {
        s.pryc = true; boss.zivoty--; boss.zasah = 4;
        jiskricky(s.x, s.y, '#ffe9a0', 3);
        if (Math.random() < 0.3) zvuk.zasah();
      }
    }
    if (Math.abs(hrac.x - boss.x) < 105 && Math.abs(hrac.y - boss.y) < 70) zraneniHrace();
    if (boss.zivoty <= 0) {
      // první výbuchy hned, zbytek obstará hořící vrak (jen efekt)
      vybuch(boss.x, boss.y, 2.5);
      for (let i = 0; i < 2; i++) vybuch(boss.x + nahoda(-90, 90), boss.y + nahoda(-50, 50), 1.5);
      vrak = { x: boss.x, y: boss.y, t: 0, dalsi: 4 };
      otresy = 25;
      skore += 200;
      zvuk.bum(3);
      for (let i = 0; i < 6; i++) predmety.push({ druh: i < 4 ? 'hvezda' : (i === 4 ? 'srdce' : 'sila'), x: boss.x + nahoda(-70, 70), y: boss.y + nahoda(-30, 30) });
      boss = null;
      if (zvuk.bossHudba) zvuk.bossHudba(false);
      uroven++;
      strelyNepratel = [];
      if (uroven > 5) {
        stav = 'vyhra';
        konecT = 0;
        zvuk.zastavHudbu();
        zvuk.vyhra();
      } else {
        ukazCislo(uroven);
        setTimeout(() => zvuk.uroven(), 400);
      }
    }
  }

  // nepřátelské střely
  for (const s of strelyNepratel) {
    s.x += s.vx * k; s.y += s.vy * k;
    if (vzdal(s, hrac) < hrac.r) { s.pryc = true; zraneniHrace(); }
  }
  strelyNepratel = strelyNepratel.filter(s => !s.pryc && s.y < H + 20);

  // předměty (s magnetem)
  const tah = 1 - Math.pow(0.92, k);
  for (const p of predmety) {
    p.y += 1.1 * k;
    const d = vzdal(p, hrac);
    if (d < 130) { p.x += (hrac.x - p.x) * tah; p.y += (hrac.y - p.y) * tah; }
    if (d < hrac.r + 18) {
      p.pryc = true;
      if (p.druh === 'hvezda') { skore += 25; zvuk.hvezda(); }
      if (p.druh === 'sila') { hrac.sila = Math.min(3, hrac.sila + 1); zvuk.power(); }
      if (p.druh === 'srdce') { hrac.zivoty = Math.min(5, hrac.zivoty + 1); zvuk.srdce(); }
      jiskricky(p.x, p.y, BARVY_PREDMETU[p.druh], 14);
      vlny.push({ x: p.x, y: p.y, r: 8, zivot: 14, max: 14, sila: 0 });
    }
  }
  predmety = predmety.filter(p => !p.pryc && p.y < H + 30);
}

// ===================== Kreslení hry =====================
function kresliHru() {
  ctx.save();
  if (otresy > 0) ctx.translate(Math.round(Math.sin(cas * 60) * otresy * 0.16), Math.round(Math.cos(cas * 53) * otresy * 0.16));

  for (const p of predmety) kresliPredmet(p);
  kresliVrak();
  for (const n of nepratele) kresliNepritele(n);
  if (boss) kresliBosse(boss);

  // laserové střely hráče (barva podle síly zbraně)
  for (const s of strely) spr(SPR_LASER[s.lvl || 1][s.vx < 0 ? 0 : s.vx > 0 ? 2 : 1], P(s.x), P(s.y + 2));
  // plazmové koule nepřátel
  const fp = Math.floor(cas * 12) % 4;
  for (const s of strelyNepratel) spr(SPR_PLAZMA[fp], P(s.x), P(s.y));

  if (stav === 'hra' || stav === 'pauza') kresliHrace();
  kresliCastice();
  ctx.restore();

  // bílý záblesk při velkém výbuchu
  if (zablesk > 0) {
    ctx.fillStyle = `rgba(255,240,220,${Math.round(zablesk * 4) / 4 * 0.6})`;
    ctx.fillRect(0, 0, PW, PH);
    zablesk = Math.max(0, zablesk - 0.04 * k);
  }
  // varování před bossem: červeně blikající okraj a výstražný trojúhelník
  if (varovani > 0 && Math.floor(cas * 6) % 2 === 0) {
    ctx.globalAlpha = Math.min(1, varovani / 30);
    ctx.fillStyle = '#ff2a2a';
    ctx.fillRect(0, 0, PW, 4); ctx.fillRect(0, PH - 4, PW, 4); ctx.fillRect(0, 0, 4, PH); ctx.fillRect(PW - 4, 0, 4, PH);
    ctx.fillStyle = '#8a0a0a';
    ctx.fillRect(4, 4, PW - 8, 1); ctx.fillRect(4, PH - 5, PW - 8, 1); ctx.fillRect(4, 4, 1, PH - 8); ctx.fillRect(PW - 5, 4, 1, PH - 8);
    spr(SPR_VYSTRAHA, PW / 2, PH / 2 - 16);
    ctx.globalAlpha = 1;
  }
  // velké číslo nové úrovně (spadne shora a odskočí)
  for (const c of cisla) {
    const vek = 100 - c.zivot;
    if (c.zivot < 24 && Math.floor(c.zivot / 3) % 2) continue; // mizí blikáním
    let dy = 0;
    if (vek < 14) dy = -(1 - vek / 14) * 90;
    else if (vek < 24) dy = -Math.sin((vek - 14) / 10 * Math.PI) * 8;
    kresliCislo(c.n, PW / 2, PH / 2 - 14 + dy, VELKE_CISLICE);
  }
}

// ===================== Boční panely (bez textu, jen obrázky a čísla) =====================
function kresliPanely() {
  octx.drawImage(PANELY, 0, 0);
  const g = octx, xp = SW - PANEL;
  const blik = Math.floor(cas * 2) % 2;
  // kontrolky nahoře
  pixel(PANEL - 9, 2, blik ? '#7cff6b' : '#1e5a1e', 2, 1, g);
  pixel(xp + 7, 2, blik ? '#1e5a1e' : '#7cff6b', 2, 1, g);
  // hudba (M) - ukazuje se vždy
  const [nx, ny] = OKNA_L.nota;
  spr(SPR_NOTA[zvuk.hudbaZap ? 0 : 1], nx + 15, ny + 15, false, g);
  if (!zvuk.hudbaZap) for (let i = 0; i < 16; i++) pixel(nx + 7 + i, ny + 22 - i, '#ff3a3a', 1, 1, g);
  if (!hrac || stav === 'menu') { // v menu jen zhasnuté ikony
    g.globalAlpha = 0.25;
    spr(SPR_SRDCE, OKNA_L.srdce[0] + 15, OKNA_L.srdce[1] + 36, false, g);
    spr(SPR_BLESK, OKNA_L.sila[0] + 15, OKNA_L.sila[1] + 35, false, g);
    spr(SPR_HVEZDA[0], xp + OKNA_P.skore[0] + 16, OKNA_P.skore[1] + 20, false, g);
    spr(SPR_PUNTIK[1], xp + OKNA_P.uroven[0] + 16, OKNA_P.uroven[1] + 52, false, g);
    spr(SPR_BOSS_IKONA, xp + OKNA_P.boss[0] + 16, OKNA_P.boss[1] + 35, false, g);
    g.globalAlpha = 1;
    return;
  }
  // --- vlevo: srdíčka ---
  const [sx, sy] = OKNA_L.srdce;
  for (let i = 0; i < 5; i++) {
    const s = i < hrac.zivoty ? ((i === hrac.zivoty - 1 && Math.floor(cas * 3) % 3 === 0) ? SPR_SRDCE_VELKE : SPR_SRDCE) : SPR_SRDCE_PRAZDNE;
    spr(s, sx + 15, sy + 66 - i * 14, false, g); // plní se odspodu
  }
  // --- vlevo: síla zbraně ---
  const [wx, wy] = OKNA_L.sila;
  spr(SPR_BLESK, wx + 15, wy + 10, false, g);
  for (let i = 0; i < 3; i++) {
    spr(SPR_DILEK[i < hrac.sila ? i + 1 : 0], wx + 15, wy + 60 - i * 13, false, g);
  }
  // --- vpravo: skóre ---
  const [kx, ky] = OKNA_P.skore;
  spr(SPR_HVEZDA[Math.floor(cas * 14) % 48 < 12 ? Math.floor(cas * 14) % 12 : 0], xp + kx + 16, ky + 12, false, g); // občas se protočí
  kresliCislo(skore, xp + kx + 16, ky + 30, SPR_CISLICE, 0, g);
  // --- vpravo: úroveň (puntíky odspodu, nahoře číslo) ---
  const [ux, uy] = OKNA_P.uroven;
  kresliCislo(Math.min(uroven, 5), xp + ux + 16, uy + 10, SPR_CISLICE_BILE, 0, g);
  for (let i = 0; i < 5; i++) {
    const ted = i === uroven - 1, hotovo = i < uroven - 1;
    const s = ted ? (Math.floor(cas * 4) % 2 ? SPR_PUNTIK[2] : SPR_PUNTIK[1]) : hotovo ? SPR_PUNTIK[1] : SPR_PUNTIK[0];
    spr(s, xp + ux + 16, uy + 92 - i * 16, false, g);
  }
  // --- vpravo: život bosse ---
  const [bx, by, , bh] = OKNA_P.boss;
  const jeBoss = !!boss;
  g.globalAlpha = jeBoss ? (varovani > 0 && Math.floor(cas * 6) % 2 ? 0.4 : 1) : 0.3;
  spr(SPR_BOSS_IKONA, xp + bx + 16, by + 8, false, g);
  g.globalAlpha = 1;
  const vy0 = by + 18, vyska = bh - 24, x0 = xp + bx + 12;
  pixel(x0 - 1, vy0 - 1, '#03030a', 10, vyska + 2, g);
  if (jeBoss) {
    const plne = Math.ceil(vyska * Math.max(0, boss.zivoty) / boss.max);
    for (let y = 0; y < plne; y++) {
      const yy = vy0 + vyska - 1 - y;
      const barva = y % 3 === 2 ? '#3a0a10' : smichej('#ff2a3a', '#ffb14a', y / vyska);
      pixel(x0, yy, barva, 8, 1, g);
      if (y % 3 !== 2) { pixel(x0, yy, smichej(barva, '#ffffff', 0.35), 2, 1, g); pixel(x0 + 7, yy, smichej(barva, '#000000', 0.4), 1, 1, g); }
    }
  }
}

// ===================== Obrazovky (bez textu - jen obrázky) =====================
function kresliKlavesu(x, y, w, h, stisk = 0) {
  const s = SPR_KLAVESA(w, h, stisk);
  const x0 = Math.round(x - w / 2) - 1, y0 = Math.round(y - h / 2) - 1;
  ctx.drawImage(s.c, x0, y0);
  return { x: x0 + 1 + w / 2, y: y0 + 1 + h / 2 + (stisk ? 2 : 0) - 1 }; // střed horní plochy
}

function kresliSipky(cx, cy) {
  const s = 21;
  const klavesy4 = [[0, -1, 0, 'ArrowUp'], [-1, 0, 3, 'ArrowLeft'], [0, 0, 2, 'ArrowDown'], [1, 0, 1, 'ArrowRight']];
  for (const [dx, dy, sm, kl] of klavesy4) {
    const st = kresliKlavesu(cx + dx * s, cy + dy * s, 18, 16, klavesy[kl] ? 1 : 0);
    spr(SPR_SIPKA[sm], st.x, st.y);
  }
}

function kresliMys(cx, cy) {
  const klik = Math.sin(cas * 5) > 0;
  spr(SPR_MYS[klik ? 1 : 0], cx, cy);
  if (klik) { // "kliknutí" čárky
    for (const [x, y, dx, dy] of [[-13, -15, -1, -1], [-15, -7, -1, 0], [-6, -18, 0, -1]]) {
      for (let i = 0; i < 4; i++) pixel(cx + x + dx * i, cy + y + dy * i, '#7cff6b', 2, 2);
    }
  }
}

// výzva ke startu: buď blikající mezerník s ▶, nebo myš (když hra nemá klávesnici)
function kresliVyzvu(cx, cy) {
  if (!maFokus()) { kresliMys(cx, cy); return; }
  const stisk = Math.sin(cas * 5) > 0.3 ? 1 : 0;
  kresliKlavesu(cx - 12, cy, 70, 14, stisk);
  spr(SPR_HRAJ[Math.floor(cas * 5) % 2], cx + 38, cy + 1);
}

function kresliNadpis(cx, y) {
  const t = 'Edova hra';
  const krok = 21, sirka = krok * (t.length - 1) - 9 + NADPIS_ZNAKY.E.w;
  let x = cx - sirka / 2;
  [...t].forEach((z, i) => {
    if (z === ' ') { x += 12; return; }
    const dy = Math.round(Math.sin(cas * 3 - i * 0.45) * 1.6);
    sprRoh(NADPIS_STINY[z], x + 2, y + dy + 3);
    sprRoh(NADPIS_ZNAKY[z], x, y + dy);
    x += krok;
  });
}

function kresliMenu() {
  kresliNadpis(PW / 2, 10);
  const u = Math.round(Math.sin(cas * 1.3) * 2);
  kresliLod(PW / 2, 92 + Math.round(Math.sin(cas * 2) * 3), u);
  // ovládání jako obrázky
  kresliSipky(66, 172);
  // mezerník + střely nad ním
  kresliKlavesu(160, 178, 56, 14, klavesy[' '] ? 1 : 0);
  for (const dx of [-12, 12]) {
    const y = 160 - ((cas * 30) % 26);
    if (y > 140) spr(SPR_LASER[1][1], 160 + dx, y);
  }
  // P + ikona pauzy
  const st = kresliKlavesu(256, 178, 18, 16, klavesy['p'] ? 1 : 0);
  spr(SPR_P, st.x, st.y);
  spr(SPR_PAUZA_MALA, 256, 152);

  kresliVyzvu(PW / 2, 220);
}

function ztmav(sila) {
  ctx.drawImage(SACHOVNICE, 0, 0);
  ctx.fillStyle = `rgba(6,4,18,${sila})`;
  ctx.fillRect(0, 0, PW, PH);
}

function kresliPauzu() {
  ztmav(0.35);
  spr(SPR_PAUZA, PW / 2, PH / 2 - 28);
  kresliVyzvu(PW / 2, PH / 2 + 44);
}

function kresliKonec() {
  if (!vrak) konecT += k;
  if (konecT < 30) return; // nejdřív dohoří výbuchy
  ztmav(Math.min(0.45, (konecT - 30) / 60));
  if (stav === 'vyhra') {
    ohnostroj -= k;
    if (ohnostroj <= 0) { ohnostroj = 14; ohnostrojBum(nahoda(100, W - 100), nahoda(80, 380)); }
    kresliCastice(); // ohňostroj nad ztmavením
    spr(SPR_POHAR_S, PW / 2, 62 + Math.round(Math.sin(cas * 2) * 2));
    spr(SPR_HVEZDA[0], PW / 2, 48 + Math.round(Math.sin(cas * 2) * 2));
  } else {
    kresliLod(PW / 2, 66 + Math.round(Math.sin(cas * 2) * 2), 0);
  }
  // počet hvězdiček
  const cislo = String(skore);
  const sirka = cislo.length * (VELKE_CISLICE['0'].w - 1) + SPR_HVEZDA[0].w + 6;
  const x0 = PW / 2 - sirka / 2;
  spr(SPR_HVEZDA[Math.floor(cas * 10) % 12], x0 + SPR_HVEZDA[0].w / 2, 132);
  kresliCislo(cislo, x0 + SPR_HVEZDA[0].w + 6, 132, VELKE_CISLICE, -1);
  kresliVyzvu(PW / 2, 196);
}

// ===================== Hlavní smyčka =====================
let posledni = performance.now();
function smycka(ted) {
  const dt = Math.max(0, Math.min(ted - posledni, 50));
  posledni = ted;
  k = dt / (1000 / 60);
  cas += dt / 1000;
  requestAnimationFrame(smycka); // i kdyby se něco pokazilo, hra nezamrzne

  if (stav === 'hra' && !maFokus()) ztrataOkna();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  if (stav !== 'pauza') posunPozadi();
  kresliPozadi();
  if (stav === 'menu') {
    kresliMenu();
  } else {
    if (stav === 'hra') aktualizuj();
    if (stav !== 'pauza') posunCastice();
    kresliHru();
    if (stav === 'pauza') kresliPauzu();
    else if (stav !== 'hra') kresliKonec();
  }
  // složení obrazu: hra mezi dva kovové panely, pak zvětšení bez vyhlazení
  octx.drawImage(plocha, PANEL, 0);
  kresliPanely();
  obrazovka.imageSmoothingEnabled = false;
  obrazovka.drawImage(obraz, 0, 0, canvas.width, canvas.height);
}
requestAnimationFrame(smycka);
