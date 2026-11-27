// ===================== Zvuky a hudba =====================
// Retro zvuky ve stylu starých DOS/arkádových stříleček.
// Efekty se jednou vygenerují (jako sfxr) do AudioBufferů a pak se jen přehrávají.
// Hudba je vlastní chiptune "tracker": noty se plánují dopředu přes Web Audio.

const midi = n => 440 * Math.pow(2, (n - 69) / 12);

// ===================== Syntezátor efektů (styl sfxr) =====================
// Všechny časy v sekundách, posuny frekvence v oktávách za sekundu.
const ZAKLAD_EFEKTU = {
  vlna: 'ctverec',   // ctverec | pila | trojuhelnik | sinus | sum
  f: 440,            // počáteční frekvence
  fMin: 20,          // pod tuhle frekvenci nespadne
  posun: 0,          // klouzání frekvence (oktávy / s)
  zrychleni: 0,      // změna klouzání (oktávy / s²)
  vib: 0, vibF: 6,   // vibrato: hloubka (podíl frekvence) a rychlost (Hz)
  arpKdy: 0, arpNas: 1, // skok výšky: kdy a kolikrát
  strida: 0.5, stridaPosun: 0, // střída obdélníku a její změna za sekundu
  utok: 0.002, drz: 0.05, doz: 0.1, punc: 0, krivka: 1.5, // obálka
  dp: 0, dpPosun: 0, // dolní propust (Hz) a její klouzání (oktávy / s)
  hp: 0,             // horní propust (Hz)
  bity: 0,           // zmenšení bitové hloubky (0 = vypnuto)
  deleni: 1,         // snížení vzorkovací frekvence (drží každý n-tý vzorek)
  hl: 0.5,           // hlasitost vrstvy
  kdy: 0,            // zpoždění vrstvy v rámci efektu
};

function syntetizuj(p, sr) {
  const q = Object.assign({}, ZAKLAD_EFEKTU, p);
  q.doz = Math.max(0.001, q.doz);
  const n = Math.max(1, Math.ceil((q.utok + q.drz + q.doz) * sr));
  const out = new Float32Array(n);
  const dt = 1 / sr;
  let f = q.f, posun = q.posun, faze = 0, arpHotovo = false;
  let sumHodnota = 0, sumIndex = -1;
  let dp = q.dp, lp = 0;
  const dpKrok = Math.pow(2, q.dpPosun * dt);
  let dpA = 1 - Math.exp(-2 * Math.PI * dp * dt);
  const posunKrok = q.zrychleni ? 0 : Math.pow(2, posun * dt); // bez zrychlení stačí spočítat jednou
  const hpA = q.hp > 0 ? 1 / (1 + 2 * Math.PI * q.hp * dt) : 0;
  let hpY = 0, hpX = 0, drzena = 0;
  const urovne = q.bity > 0 ? Math.pow(2, q.bity - 1) : 0;
  // parametry do lokálních proměnných (smyčka běží pro každý vzorek)
  const VLNY = { ctverec: 0, pila: 1, trojuhelnik: 2, sinus: 3 };
  const vlna = q.vlna in VLNY ? VLNY[q.vlna] : 4;
  const zrychleni = q.zrychleni, fMin = q.fMin, vib = q.vib, vibW = 2 * Math.PI * q.vibF;
  const arpKdy = q.arpKdy, arpNas = q.arpNas, strida = q.strida, stridaPosun = q.stridaPosun;
  const utok = q.utok, konecDrz = q.utok + q.drz, drz = q.drz, doz = q.doz, punc = q.punc, krivka = q.krivka;
  const dpPosun = q.dpPosun, dpKrok16 = Math.pow(dpKrok, 16), hl = q.hl, deleni = q.deleni;
  const DVA_PI = 2 * Math.PI;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    if (!arpHotovo && arpKdy > 0 && t >= arpKdy) { f *= arpNas; arpHotovo = true; }
    if (zrychleni) { posun += zrychleni * dt; f *= Math.pow(2, posun * dt); }
    else if (posun) f *= posunKrok;
    if (f < fMin) f = fMin;
    else if (f > 20000) f = 20000;
    const fv = vib ? f * (1 + vib * Math.sin(vibW * t)) : f;
    faze += fv * dt;
    if (faze >= 1) faze -= Math.floor(faze);
    let x;
    if (vlna === 0) {
      let st = strida + stridaPosun * t;
      st = st < 0.05 ? 0.05 : st > 0.95 ? 0.95 : st;
      x = faze < st ? 0.8 : -0.8;
    } else if (vlna === 1) x = 2 * faze - 1;
    else if (vlna === 2) x = 1 - 4 * Math.abs(faze - 0.5);
    else if (vlna === 3) x = Math.sin(DVA_PI * faze);
    else { // šum s "výškou" jako v sfxr - 32 náhodných hodnot na periodu
      const k = (faze * 32) | 0;
      if (k !== sumIndex) { sumIndex = k; sumHodnota = Math.random() * 2 - 1; }
      x = sumHodnota;
    }
    let obal;
    if (t < utok) obal = t / utok;
    else if (t < konecDrz) obal = 1 + punc * (1 - (t - utok) / drz);
    else {
      const r = Math.max(0, 1 - (t - konecDrz) / doz);
      obal = krivka === 1.5 ? r * Math.sqrt(r) : Math.pow(r, krivka);
    }
    if (dp > 0) {
      if (dpPosun && (i & 15) === 0) { // koeficient filtru stačí přepočítat jednou za 16 vzorků
        dp = Math.min(20000, Math.max(30, dp * dpKrok16));
        dpA = 1 - Math.exp(-DVA_PI * dp * dt);
      }
      lp += dpA * (x - lp);
      x = lp;
    }
    if (hpA) { hpY = hpA * (hpY + x - hpX); hpX = x; x = hpY; }
    let v = x * obal * hl;
    if (deleni > 1) { if (i % deleni === 0) drzena = v; v = drzena; }
    if (urovne) v = Math.round(v * urovne) / urovne;
    out[i] = v;
  }
  return out;
}

// smíchá několik vrstev (každá může mít své zpoždění) do jednoho zvuku;
// `hotove` = už vygenerované vrstvy (při postupném předgenerování)
function smichej(vrstvy, sr, hotove = []) {
  const casti = vrstvy.map((v, i) => ({ od: Math.round((v.kdy || 0) * sr), data: hotove[i] || syntetizuj(v, sr) }));
  let n = 1;
  casti.forEach(c => { n = Math.max(n, c.od + c.data.length); });
  const out = new Float32Array(n);
  casti.forEach(c => { for (let i = 0; i < c.data.length; i++) out[c.od + i] += c.data[i]; });
  let spicka = 0;
  for (let i = 0; i < n; i++) spicka = Math.max(spicka, Math.abs(out[i]));
  if (spicka > 0.95) { const k = 0.95 / spicka; for (let i = 0; i < n; i++) out[i] *= k; }
  // krátké zeslabení na konci proti lupnutí
  const z = Math.min(n, Math.round(0.005 * sr));
  for (let i = 0; i < z; i++) out[n - 1 - i] *= i / z;
  return out;
}

// pomocník: z melodie [[midi, délka v krocích], ...] udělá vrstvy (0 = pauza)
function noty(seznam, krok, o = {}) {
  const vrstvy = [];
  let t = 0;
  for (const [m, d] of seznam) {
    if (m) vrstvy.push(Object.assign({ vlna: 'ctverec', strida: 0.25, utok: 0.004, dp: 5000, hl: 0.3 }, o, {
      f: midi(m + (o.transp || 0)), kdy: (o.kdy || 0) + t,
      drz: d * krok * 0.55, doz: d * krok * 0.6 + (o.dozNavic || 0),
      vib: d >= 3 ? (o.vib !== undefined ? o.vib : 0.012) : 0,
    }));
    t += d * krok;
  }
  return vrstvy;
}

// ---- recepty všech efektů (pořadí = pořadí předgenerování) ----
const EFEKTY = {
  // krátké "pjů" - obdélník 25 % rychle klouže dolů
  strela: [
    { vlna: 'ctverec', strida: 0.25, stridaPosun: 0.8, f: 1250, posun: -14, zrychleni: -30,
      utok: 0.001, drz: 0.012, doz: 0.075, dp: 5000, hp: 180, hl: 0.38, bity: 7 },
    { vlna: 'trojuhelnik', f: 2600, posun: -22, utok: 0.001, drz: 0.004, doz: 0.03, hl: 0.2 },
  ],
  // "cvak" - krátký šum a pípnutí
  zasah: [
    { vlna: 'sum', f: 1100, posun: -7, utok: 0.001, drz: 0.008, doz: 0.06, hl: 0.5, bity: 6, deleni: 2 },
    { vlna: 'ctverec', strida: 0.5, f: 700, posun: -10, utok: 0.001, drz: 0.005, doz: 0.045, hl: 0.22, dp: 3000 },
  ],
  // výbuchy: prásknutí + křupavý šum padající dolů + basové "bum"
  bum1: [
    { vlna: 'sum', f: 1600, posun: -4, utok: 0.001, drz: 0.01, doz: 0.07, hl: 0.45 },
    { vlna: 'sum', f: 320, posun: -2.4, utok: 0.002, drz: 0.05, doz: 0.38, punc: 0.5, hl: 0.7,
      dp: 5000, dpPosun: -3, bity: 6, deleni: 2 },
    { vlna: 'trojuhelnik', f: 170, posun: -5, utok: 0.001, drz: 0.02, doz: 0.16, hl: 0.55 },
  ],
  bum2: [
    { vlna: 'sum', f: 1400, posun: -3.5, utok: 0.001, drz: 0.01, doz: 0.09, hl: 0.5 },
    { vlna: 'sum', f: 240, posun: -1.7, utok: 0.002, drz: 0.09, doz: 0.65, punc: 0.6, hl: 0.75,
      dp: 4000, dpPosun: -2, bity: 6, deleni: 3 },
    { vlna: 'sum', f: 420, posun: -3, kdy: 0.12, drz: 0.02, doz: 0.3, hl: 0.45, bity: 6, deleni: 2 },
    { vlna: 'trojuhelnik', f: 140, posun: -4, utok: 0.001, drz: 0.03, doz: 0.3, hl: 0.6 },
  ],
  bum3: [ // velký výbuch bosse - několik dozvuků za sebou
    { vlna: 'sum', f: 1200, posun: -3, utok: 0.001, drz: 0.01, doz: 0.12, hl: 0.55 },
    { vlna: 'sum', f: 180, posun: -1, utok: 0.003, drz: 0.2, doz: 1.4, punc: 0.5, hl: 0.8,
      dp: 3500, dpPosun: -1.4, bity: 6, deleni: 3 },
    { vlna: 'sum', f: 450, posun: -2.8, kdy: 0.2, drz: 0.03, doz: 0.35, hl: 0.5, bity: 6, deleni: 2 },
    { vlna: 'sum', f: 380, posun: -2.5, kdy: 0.45, drz: 0.03, doz: 0.4, hl: 0.45, bity: 6, deleni: 2 },
    { vlna: 'sum', f: 330, posun: -2.2, kdy: 0.75, drz: 0.03, doz: 0.5, hl: 0.4, bity: 6, deleni: 3 },
    { vlna: 'trojuhelnik', f: 120, posun: -2.6, utok: 0.001, drz: 0.06, doz: 0.6, hl: 0.7 },
    { vlna: 'trojuhelnik', f: 100, posun: -3, kdy: 0.45, drz: 0.03, doz: 0.35, hl: 0.45 },
  ],
  // "cink-cink" - skok o kvintu nahoru a třpytka
  hvezda: [
    { vlna: 'ctverec', strida: 0.5, f: midi(84), utok: 0.002, drz: 0.045, doz: 0.22,
      arpKdy: 0.055, arpNas: 1.5, hl: 0.3, dp: 7000 },
    { vlna: 'trojuhelnik', f: midi(96), kdy: 0.05, utok: 0.002, drz: 0.03, doz: 0.28,
      arpKdy: 0.05, arpNas: 1.335, vib: 0.02, vibF: 20, hl: 0.25 },
  ],
  // stoupající arpeggio + kvílivé stoupání pod ním
  power: [
    ...noty([[72, 1], [76, 1], [79, 1], [84, 1], [88, 1], [91, 3]], 0.05, { hl: 0.26, posun: 0.8, vib: 0.02 }),
    { vlna: 'trojuhelnik', f: 220, posun: 4.5, utok: 0.01, drz: 0.28, doz: 0.12, vib: 0.05, vibF: 15, hl: 0.3 },
  ],
  // vřelá melodie nahoru
  srdce: [
    ...noty([[79, 1], [83, 1], [86, 1], [91, 4]], 0.075, { vlna: 'trojuhelnik', hl: 0.4, vib: 0.02 }),
    ...noty([[79, 1], [83, 1], [86, 1], [91, 4]], 0.075, { strida: 0.5, hl: 0.1, dp: 3000 }),
    { vlna: 'trojuhelnik', f: midi(103), kdy: 0.3, vib: 0.03, vibF: 22, drz: 0.05, doz: 0.3, hl: 0.12 },
  ],
  // "bvóóu" - legrační kvílivý pád, ne strašidelný
  au: [
    { vlna: 'ctverec', strida: 0.5, stridaPosun: -1, f: 620, posun: -3.2, vib: 0.07, vibF: 11,
      utok: 0.002, drz: 0.08, doz: 0.32, dp: 2400, hl: 0.42 },
    { vlna: 'sum', f: 500, posun: -3, utok: 0.001, drz: 0.02, doz: 0.16, hl: 0.32, bity: 6 },
  ],
  // poplach "uí-ou" třikrát
  sirena: (() => {
    const v = [];
    for (let i = 0; i < 3; i++) {
      const t = i * 0.42;
      v.push({ vlna: 'ctverec', strida: 0.5, f: 587, posun: 2.2, kdy: t, utok: 0.01, drz: 0.14, doz: 0.06, dp: 2600, hl: 0.24 });
      v.push({ vlna: 'trojuhelnik', f: 293, posun: 2.2, kdy: t, utok: 0.01, drz: 0.14, doz: 0.06, hl: 0.3 });
      v.push({ vlna: 'ctverec', strida: 0.5, f: 880, posun: -2.2, kdy: t + 0.2, utok: 0.01, drz: 0.14, doz: 0.06, dp: 2600, hl: 0.24 });
      v.push({ vlna: 'trojuhelnik', f: 440, posun: -2.2, kdy: t + 0.2, utok: 0.01, drz: 0.14, doz: 0.06, hl: 0.3 });
    }
    return v;
  })(),
  // fanfára po úrovni
  uroven: [
    ...noty([[67, 1], [72, 1], [76, 1], [79, 3], [76, 1], [79, 5]], 0.1, { hl: 0.3, dozNavic: 0.1 }),
    ...noty([[64, 1], [67, 1], [72, 1], [76, 3], [72, 1], [76, 5]], 0.1, { vlna: 'trojuhelnik', hl: 0.22 }),
    ...noty([[48, 3], [43, 3], [48, 6]], 0.1, { vlna: 'trojuhelnik', hl: 0.4, dp: 0 }),
    { vlna: 'trojuhelnik', f: midi(100), kdy: 0.75, vib: 0.03, vibF: 20, drz: 0.05, doz: 0.4, hl: 0.1 },
  ],
  // vítězná melodie (asi 3,6 s)
  vyhra: (() => {
    const mel = [[72, 2], [72, 1], [72, 1], [76, 2], [79, 2], [77, 2], [81, 2], [84, 4],
                 [83, 2], [79, 2], [86, 2], [84, 8]];
    return [
      ...noty(mel, 0.12, { hl: 0.28, dozNavic: 0.05 }),
      ...noty(mel, 0.12, { vlna: 'trojuhelnik', transp: -12, hl: 0.22 }),
      ...noty([[48, 8], [53, 8], [55, 6], [48, 8]], 0.12, { vlna: 'trojuhelnik', hl: 0.4, dp: 0 }),
      ...noty([[84, 1], [88, 1], [91, 1], [96, 3]], 0.05, { vlna: 'trojuhelnik', kdy: 2.64, hl: 0.12 }),
    ];
  })(),
  // konec hry - jemné, končí "doma" v durové tónině, nesmutní
  konec: [
    ...noty([[76, 2], [74, 2], [72, 2], [67, 2], [72, 6]], 0.14, { vlna: 'trojuhelnik', hl: 0.38, vib: 0.015 }),
    ...noty([[76, 2], [74, 2], [72, 2], [67, 2], [72, 6]], 0.14, { strida: 0.5, hl: 0.07, dp: 2000 }),
    ...noty([[48, 6], [43, 4], [48, 4]], 0.14, { vlna: 'trojuhelnik', hl: 0.3, dp: 0 }),
  ],
  pauza: noty([[79, 1], [72, 2]], 0.06, { strida: 0.5, hl: 0.22, dp: 3500 }),
  dal: noty([[72, 1], [79, 2]], 0.06, { strida: 0.5, hl: 0.22, dp: 3500 }),

  // ---- bicí pro hudbu ----
  buben: [
    { vlna: 'trojuhelnik', f: 150, posun: -9, fMin: 40, utok: 0.001, drz: 0.02, doz: 0.16, punc: 0.3, hl: 0.9, bity: 7 },
    { vlna: 'sum', f: 2000, utok: 0.0005, drz: 0.002, doz: 0.012, hl: 0.3 },
  ],
  virbl: [
    { vlna: 'sum', f: 1800, posun: -1, utok: 0.001, drz: 0.01, doz: 0.14, hl: 0.55, hp: 400, bity: 7 },
    { vlna: 'trojuhelnik', f: 220, posun: -4, utok: 0.001, drz: 0.005, doz: 0.07, hl: 0.45 },
  ],
  hihat: [{ vlna: 'sum', f: 9000, hp: 6000, utok: 0.0005, drz: 0.002, doz: 0.03, hl: 0.35 }],
  hihatOtevreny: [{ vlna: 'sum', f: 9000, hp: 6000, utok: 0.0005, drz: 0.01, doz: 0.14, hl: 0.25 }],
  cinel: [{ vlna: 'sum', f: 9000, hp: 3500, utok: 0.001, drz: 0.02, doz: 0.9, hl: 0.25, deleni: 2 }],
};

// ===================== Hudba =====================
// Akordy: [tónina 0-11, moll?]
const AKORD = { C: [0, 0], Am: [9, 1], F: [5, 0], G: [7, 0], Em: [4, 1], Bb: [10, 0], Ab: [8, 0], E: [4, 0] };

function jmenoNaMidi(s) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) { console.warn('Neznámá nota', s); return 60; }
  const zaklad = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return 12 * (Number(m[3]) + 1) + zaklad + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// Melodie jako v trackeru: jeden token = jedna šestnáctina.
// "C5" = nová nota, "-" = drží předchozí, "." = ticho.
function rozeberMelodii(text) {
  const t = text.trim().split(/\s+/);
  const out = new Array(t.length).fill(null);
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '-' || t[i] === '.') continue;
    let d = 1;
    while (t[i + d] === '-') d++;
    out[i] = { m: jmenoNaMidi(t[i]), d };
  }
  return out;
}

function vytvorPisen({ bpm, smycka, takty, melodie }) {
  const tk = takty.trim().split(/\s+/).map(s => {
    const [c, a] = s.split(':');
    return { c, a: a.split(',') };
  });
  const mel = rozeberMelodii(melodie.join(' '));
  if (mel.length !== tk.length * 16) console.warn('Melodie nesedí na takty', mel.length, tk.length * 16);
  return { bpm, smycka, takty: tk, mel, kroku: tk.length * 16 };
}

const TICHO = '. . . . . . . . . . . . . . . .';

// Hlavní písnička: 132 BPM, 26 taktů (~47 s), smyčka se vrací na takt 2 (část A).
// I = úvod, A = hlavní téma, B = druhé téma, C = klidnější mezihra, D = stoupající přechod zpět na A
const PISEN_HLAVNI = vytvorPisen({
  bpm: 132, smycka: 2,
  takty: 'I:C I:G ' +
    'A:C A:Am A:F A:G A:C A:Am A:F,G A:C ' +
    'B:F B:G B:Em B:Am B:F B:G B:Bb B:G ' +
    'C:Am C:F C:C C:G ' +
    'D:F D:G D:Ab D:Bb',
  melodie: [
    TICHO, TICHO,
    // A
    'G4 - C5 - E5 - G5 - - - E5 - G5 - C6 -',
    '- - - - B5 - A5 - - - E5 - A5 - B5 -',
    'C6 - - - A5 - F5 - - - A5 - C6 - D6 -',
    'B5 - - - - - G5 - A5 - B5 - D6 - - -',
    'E6 - - - D6 - C6 - - - G5 - E5 - G5 -',
    'A5 - - - C6 - - - B5 - A5 - E5 - - -',
    'F5 - A5 - C6 - A5 - G5 - B5 - D6 - B5 -',
    'C6 - - - - - - - . . E5 F5 G5 - A5 -',
    // B
    'C6 - - - F6 - - - E6 - C6 - A5 - C6 -',
    'D6 - - - - - B5 - G5 - - - B5 - D6 -',
    'E6 - - - G6 - - - E6 - D6 - B5 - - -',
    'C6 - - - - - - - A5 - B5 - C6 - E6 -',
    'F6 - - - E6 - - - C6 - - - A5 - C6 -',
    'D6 - - - B5 - - - G5 - A5 - B5 - D6 -',
    'F6 - - - D6 - - - Bb5 - - - D6 - F6 -',
    'G6 - - - - - - - - - - - . . . .',
    // C
    'A5 - - - - - - - E5 - - - A5 - - -',
    'C6 - - - - - - - A5 - - - F5 - - -',
    'G5 - - - - - - - E5 - - - G5 - C6 -',
    'B5 - - - - - - - D6 - - - G5 - - -',
    // D
    'A5 - C6 - F6 - C6 - A5 - C6 - F6 - A6 -',
    'G6 - - - D6 - B5 - G5 - B5 - D6 - G6 -',
    'Ab5 - - - Eb5 - C5 - Eb5 - - - Ab5 - C6 -',
    'Bb5 - - - - - D6 - - - F6 - - - G6 -',
  ],
});

// Napínavější (ale pořád veselá) hudba na bosse: 144 BPM, 8 taktů (~13 s) dokola.
const PISEN_BOSS = vytvorPisen({
  bpm: 144, smycka: 0,
  takty: 'X:Am X:F X:G X:E X:Am X:F X:G X:E',
  melodie: [
    'A5 - - - E5 - A5 - C6 - - - B5 - A5 -',
    'C6 - - - A5 - F5 - A5 - - - C6 - D6 -',
    'D6 - - - B5 - G5 - B5 - D6 - E6 - D6 -',
    'B5 - - - G#5 - E5 - G#5 - B5 - E6 - - -',
    'E6 - - - C6 - A5 - E6 - - - F6 - E6 -',
    'F6 - - - C6 - A5 - C6 - - - F6 - A6 -',
    'G6 - - - D6 - B5 - D6 - - - G6 - F6 -',
    'E6 - - - - - - - G#5 - B5 - D6 - E6 -',
  ],
});

const HUDBA_HL = 0.42; // hlasitost hudby (jasně pod efekty)

// obdélníková vlna s libovolnou střídou (jako NES/C64 "pulse")
function pulsVlna(ac, strida) {
  const N = 48, re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    re[n] = Math.sin(2 * Math.PI * n * strida) / (n * Math.PI);
    im[n] = (1 - Math.cos(2 * Math.PI * n * strida)) / (n * Math.PI);
  }
  return ac.createPeriodicWave(re, im);
}

const zvuk = {
  ac: null, hudbaHraje: false, krok: 0, dalsiNota: 0, casovac: null,
  pisen: PISEN_HLAVNI, cache: {}, naposledy: {}, uzly: [],
  _hudbaZap: true,
  get hudbaZap() { return this._hudbaZap; },
  set hudbaZap(v) {
    this._hudbaZap = !!v;
    if (this.ac && this.hudbaHraje) this.hlasitostHudby(this._hudbaZap ? HUDBA_HL : 0, 0.08);
  },

  odemkni() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ac = this.ac = new Ctx();
    if (ac.state === 'suspended') ac.resume();
    const komp = ac.createDynamicsCompressor();
    komp.threshold.value = -16; komp.knee.value = 12; komp.ratio.value = 4;
    komp.attack.value = 0.003; komp.release.value = 0.2;
    komp.connect(ac.destination);
    this.master = ac.createGain(); this.master.gain.value = 0.75; this.master.connect(komp);
    this.sfx = ac.createGain(); this.sfx.gain.value = 0.85; this.sfx.connect(this.master);
    this.hudba = ac.createGain(); this.hudba.gain.value = 0; this.hudba.connect(this.master);
    // ozvěna - zvuky pak znějí "vesmírně"; v zpětné smyčce tlumí výšky
    this.ozvena = ac.createDelay(1); this.ozvena.delayTime.value = 0.17;
    const tlum = ac.createBiquadFilter(); tlum.type = 'lowpass'; tlum.frequency.value = 2500;
    const zpetna = ac.createGain(); zpetna.gain.value = 0.3;
    const mix = ac.createGain(); mix.gain.value = 0.3;
    this.ozvena.connect(tlum); tlum.connect(zpetna); zpetna.connect(this.ozvena);
    tlum.connect(mix); mix.connect(this.master);
    // sběrnice melodie: lehce ztlumené výšky + trochu ozvěny
    this.leadBus = ac.createGain();
    const leadFiltr = ac.createBiquadFilter(); leadFiltr.type = 'lowpass'; leadFiltr.frequency.value = 4500;
    this.leadBus.connect(leadFiltr); leadFiltr.connect(this.hudba);
    const leadOzvena = ac.createGain(); leadOzvena.gain.value = 0.18;
    this.leadBus.connect(leadOzvena); leadOzvena.connect(this.ozvena);
    this.puls25 = pulsVlna(ac, 0.25);
    this.puls12 = pulsVlna(ac, 0.125);
    // efekty předgenerujeme postupně (jedna vrstva za tik), ať se hra nezasekne
    const fronta = Object.keys(EFEKTY);
    let hotove = [];
    const dalsi = () => {
      const j = fronta[0];
      if (!j) return;
      if (this.cache[j]) { fronta.shift(); hotove = []; }
      else if (hotove.length < EFEKTY[j].length) hotove.push(syntetizuj(EFEKTY[j][hotove.length], ac.sampleRate));
      else { this.buf(j, hotove); fronta.shift(); hotove = []; }
      setTimeout(dalsi, 0);
    };
    setTimeout(dalsi, 0);
  },

  // vrátí (a při prvním použití vyrobí) buffer efektu
  buf(jmeno, hotove) {
    if (!this.cache[jmeno]) {
      const sr = this.ac.sampleRate;
      const data = smichej(EFEKTY[jmeno], sr, hotove);
      const b = this.ac.createBuffer(1, data.length, sr);
      b.getChannelData(0).set(data);
      this.cache[jmeno] = b;
    }
    return this.cache[jmeno];
  },

  hraj(jmeno, { hl = 1, rozptyl = 0.03, ozvena = 0, odstup = 0 } = {}) {
    if (!this.ac) return;
    const now = this.ac.currentTime;
    const minule = this.naposledy[jmeno];
    if (odstup && minule !== undefined && now - minule < odstup) return;
    this.naposledy[jmeno] = now;
    const s = this.ac.createBufferSource();
    s.buffer = this.buf(jmeno);
    s.playbackRate.value = 1 + (Math.random() * 2 - 1) * rozptyl;
    const g = this.ac.createGain(); g.gain.value = hl;
    s.connect(g); g.connect(this.sfx);
    if (ozvena) { const e = this.ac.createGain(); e.gain.value = ozvena; g.connect(e); e.connect(this.ozvena); }
    s.start(now);
  },

  // --- efekty ---
  strela() { this.hraj('strela', { hl: 0.42, rozptyl: 0.05, odstup: 0.04 }); },
  zasah() { this.hraj('zasah', { hl: 0.5, rozptyl: 0.08, odstup: 0.035 }); },
  bum(vel = 1) {
    const v = Math.max(1, Math.min(3, Math.round(vel) || 1));
    this.hraj('bum' + v, { hl: [0, 0.7, 0.85, 1][v], rozptyl: v === 1 ? 0.08 : 0.04, odstup: v === 1 ? 0.03 : 0 });
  },
  hvezda() { this.hraj('hvezda', { hl: 0.55, rozptyl: 0.01, ozvena: 0.35 }); },
  power() { this.hraj('power', { hl: 0.6, rozptyl: 0, ozvena: 0.35 }); },
  srdce() { this.hraj('srdce', { hl: 0.6, rozptyl: 0, ozvena: 0.35 }); },
  au() { this.hraj('au', { hl: 0.6, rozptyl: 0.04 }); },
  sirena() { this.hraj('sirena', { hl: 0.5, rozptyl: 0 }); },
  uroven() { this.hraj('uroven', { hl: 0.6, rozptyl: 0, ozvena: 0.25 }); },
  vyhra() { this.hraj('vyhra', { hl: 0.6, rozptyl: 0, ozvena: 0.25 }); },
  konec() { this.hraj('konec', { hl: 0.6, rozptyl: 0, ozvena: 0.3 }); },
  pauza() { this.hraj('pauza', { hl: 0.5, rozptyl: 0 }); },
  dal() { this.hraj('dal', { hl: 0.5, rozptyl: 0 }); },

  // --- hudba (plánuje noty ~100 ms dopředu, aby hrála přesně) ---
  hlasitostHudby(cil, cas = 0.05) {
    const g = this.hudba.gain, now = this.ac.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(cil, now + cas);
  },
  spustHudbu() {
    if (!this.ac || this.hudbaHraje) return;
    this.hudbaHraje = true;
    this.dalsiNota = this.ac.currentTime + 0.06;
    this.hlasitostHudby(this._hudbaZap ? HUDBA_HL : 0, 0.03);
    this.casovac = setInterval(() => this.planuj(), 25);
    this.planuj();
  },
  zastavHudbu() {
    this.hudbaHraje = false;
    clearInterval(this.casovac); this.casovac = null;
    if (!this.ac) return;
    const now = this.ac.currentTime;
    this.hlasitostHudby(0, 0.03);
    this.uzly.forEach(u => { try { u.n.stop(now + 0.05); } catch (e) { /* už skončil */ } });
    this.uzly = [];
  },
  // volitelné: přepne na hudbu pro bosse (true) nebo zpět na hlavní (false)
  bossHudba(zap = true) {
    const nova = zap ? PISEN_BOSS : PISEN_HLAVNI;
    if (this.pisen === nova) return;
    this.pisen = nova;
    this.krok = 0;
  },
  planuj() {
    if (!this.hudbaHraje) return;
    const ac = this.ac, now = ac.currentTime;
    // po uspání záložky nedoháníme zameškané noty
    if (this.dalsiNota < now - 0.2) this.dalsiNota = now + 0.05;
    if (this.uzly.length > 300) this.uzly = this.uzly.filter(u => u.konec > now);
    while (this.dalsiNota < now + 0.1) {
      const p = this.pisen, delkaKroku = 60 / p.bpm / 4; // šestnáctiny
      if (!(this.krok >= 0 && this.krok < p.kroku)) this.krok = this.krok >= p.kroku ? p.smycka * 16 : 0;
      if (this._hudbaZap) this.nota(p, this.krok, this.dalsiNota, delkaKroku);
      this.krok++;
      this.dalsiNota += delkaKroku;
    }
  },
  sleduj(n, konec) { this.uzly.push({ n, konec }); },

  // melodie: obdélník 25 % s malým "nájezdem" výšky a zpožděným vibratem
  lead(f, dur, t) {
    const ac = this.ac, L = 0.2, konec = t + dur;
    const o = ac.createOscillator(); o.setPeriodicWave(this.puls25);
    o.frequency.setValueAtTime(f * 0.97, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(L, t + 0.006);
    g.gain.setTargetAtTime(L * 0.6, t + 0.006, 0.06);
    g.gain.setTargetAtTime(0, konec, 0.02);
    o.connect(g); g.connect(this.leadBus);
    o.start(t); o.stop(konec + 0.12);
    this.sleduj(o, konec + 0.12);
    if (dur > 0.3) {
      const lfo = ac.createOscillator(), hloubka = ac.createGain();
      lfo.frequency.value = 6;
      hloubka.gain.setValueAtTime(0, t);
      hloubka.gain.setValueAtTime(0, t + 0.12);
      hloubka.gain.linearRampToValueAtTime(f * 0.015, t + 0.3);
      lfo.connect(hloubka); hloubka.connect(o.frequency);
      lfo.start(t); lfo.stop(konec + 0.12);
      this.sleduj(lfo, konec + 0.12);
    }
  },
  // basa: trojúhelník + ztlumený obdélník pro "kousnutí"
  bas(m, dur, t) {
    const ac = this.ac, f = midi(m), L = 0.34, konec = t + dur;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(L, t + 0.004);
    g.gain.setTargetAtTime(L * 0.7, t + 0.004, 0.08);
    g.gain.setTargetAtTime(0, konec, 0.015);
    const tri = ac.createOscillator(); tri.type = 'triangle'; tri.frequency.value = f;
    const sq = ac.createOscillator(); sq.type = 'square'; sq.frequency.value = f;
    const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900;
    const sqG = ac.createGain(); sqG.gain.value = 0.22;
    tri.connect(g); sq.connect(fl); fl.connect(sqG); sqG.connect(g);
    g.connect(this.hudba);
    tri.start(t); sq.start(t);
    tri.stop(konec + 0.1); sq.stop(konec + 0.1);
    this.sleduj(tri, konec + 0.1); this.sleduj(sq, konec + 0.1);
  },
  // arpeggio: tenký obdélník 12,5 %, rychle doznívá
  arp(m, dur, t, L) {
    const ac = this.ac;
    const o = ac.createOscillator(); o.setPeriodicWave(this.puls12); o.frequency.value = midi(m);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(L, t + 0.003);
    g.gain.setTargetAtTime(0, t + 0.01, dur * 0.45);
    o.connect(g); g.connect(this.hudba);
    o.start(t); o.stop(t + dur * 2 + 0.02);
    this.sleduj(o, t + dur * 2 + 0.02);
  },
  buben(jmeno, t, hl) {
    const s = this.ac.createBufferSource(); s.buffer = this.buf(jmeno);
    const g = this.ac.createGain(); g.gain.value = hl;
    s.connect(g); g.connect(this.hudba);
    s.start(t);
    this.sleduj(s, t + s.buffer.duration);
  },

  // jedna šestnáctina písničky
  nota(p, krok, t, dk) {
    const takt = Math.floor(krok / 16), s = krok % 16, tk = p.takty[takt];
    const [pc, mol] = AKORD[tk.a[tk.a.length > 1 && s >= 8 ? 1 : 0]];
    const tony = [0, mol ? 3 : 4, 7, 12];
    const cast = tk.c;
    const konecCasti = takt + 1 >= p.takty.length || p.takty[takt + 1].c !== cast;
    const zacatekCasti = takt === 0 || p.takty[takt - 1].c !== cast;
    const koren = 40 + ((pc - 4 + 12) % 12); // basa E2..D#3
    const arpZaklad = 72 + ((pc - 4 + 12) % 12) - 12; // E4..D#5

    // melodie
    const n = p.mel[krok];
    if (n) this.lead(midi(n.m), n.d * dk * 0.92, t);

    // basa
    if (cast === 'I') {
      if (takt === 0) { if (s % 4 === 0) this.bas(koren, dk * 3, t); }
      else if (s % 2 === 0) this.bas(koren + (s % 4 === 2 ? 12 : 0), dk * 1.7, t);
    } else if (cast === 'C') {
      if (s === 0 || s === 8) this.bas(koren, dk * 5, t);
      if (s === 12) this.bas(koren + 7, dk * 3, t);
    } else if (cast === 'X') {
      this.bas(koren + [0, 0, 12, 0][s % 4], dk * 0.8, t);
    } else if (s % 2 === 0) {
      this.bas(koren + (s === 14 ? 7 : s % 4 === 2 ? 12 : 0), dk * 1.7, t);
    }

    // arpeggio akordu
    if (cast === 'C') {
      if (s % 2 === 0) this.arp(arpZaklad + tony[(s / 2) % 4], dk * 2, t, 0.035);
    } else if (cast !== 'I' || takt === 1) {
      this.arp(arpZaklad + 12 + tony[s % 4], dk, t, cast === 'I' ? 0.03 : 0.05);
    }

    // bicí
    if (zacatekCasti && s === 0 && cast !== 'I') this.buben('cinel', t, 0.5);
    if (cast === 'I') {
      if (s % 8 === 0) this.buben('buben', t, 0.55);
      if (s % 2 === 0 && !(takt === 1 && s >= 12)) this.buben('hihat', t, 0.25);
      if (takt === 1 && s >= 12) this.buben('virbl', t, 0.18 + (s - 12) * 0.07);
    } else if (cast === 'C') {
      if (s === 0 || s === 10) this.buben('buben', t, 0.5);
      if (s === 8) this.buben('virbl', t, 0.35);
      if (s % 4 === 2) this.buben('hihat', t, 0.18);
    } else {
      const vyplen = konecCasti && s >= 12;
      if (cast === 'X' ? s % 4 === 0 : (s === 0 || s === 8 || s === 10)) this.buben('buben', t, 0.6);
      if (vyplen) this.buben('virbl', t, 0.25 + (s - 12) * 0.06);
      else {
        if (s === 4 || s === 12) this.buben('virbl', t, 0.4);
        if (cast === 'X') this.buben('hihat', t, s % 2 === 0 ? 0.28 : 0.15);
        else if (s === 14) this.buben('hihatOtevreny', t, 0.25);
        else if (s % 2 === 0) this.buben('hihat', t, 0.28);
      }
    }
  },
};
