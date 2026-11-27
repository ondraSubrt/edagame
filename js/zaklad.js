// =====================================================================
//  Edova hra - vesmírná střílečka pro malé piloty
//  Ovládání: šipky = létání, MEZERNÍK = střelba, P/Esc = pauza, M = hudba
//  Všechny rychlosti jsou "pixely za snímek při 60 FPS" a násobí se `k`,
//  takže hra běží stejně rychle na 60Hz i 120Hz monitoru.
// =====================================================================
const canvas = document.getElementById('hra');
const obrazovka = canvas.getContext('2d');

// Herní svět (logika, rychlosti) má pořád 800×600 jednotek.
// Kreslí se ale do malého plátna 320×240 (měřítko 0.4) jako ve starých
// DOSových hrách, vedle jsou kovové panely a celé se to zvětší celým
// násobkem bez vyhlazení -> velké, stejně velké pixely.
const W = 800, H = 600;
const MER = 0.4;
const PW = 320, PH = 240;            // herní plocha v pixelech
const PANEL = 40;                    // šířka bočního panelu
const SW = PW + PANEL * 2, SH = PH;  // celý obraz 400×240
const P = v => v * MER;              // svět -> pixely

const plocha = document.createElement('canvas');
plocha.width = PW; plocha.height = PH;
const ctx = plocha.getContext('2d');           // sem se kreslí hra
const obraz = document.createElement('canvas');
obraz.width = SW; obraz.height = SH;
const octx = obraz.getContext('2d');           // hra + panely

// ---- Nastavení obtížnosti ----
const RYCHLOST_HRACE = 4.2;
const RYCHLOST_STREL = 9;
const RYCHLOST_NEPRATEL = 0.75;
const RYCHLOST_STREL_NEPRATEL = 2;
const ZABIT_NA_BOSSE = 15;

function prizpusobOkno() {
  if (!window.innerWidth || !window.innerHeight) return; // okno ještě nemá rozměr
  const dpr = window.devicePixelRatio || 1;
  const vejde = Math.min(window.innerWidth * dpr / SW, window.innerHeight * dpr / SH) * 0.97;
  // celý násobek, aby byly všechny pixely stejně velké; když by zbylo moc
  // místa, vezme se větší násobek a prohlížeč ho jen nepatrně zmenší
  const n = vejde < 1 ? 1 : (vejde - Math.floor(vejde) < 0.2 ? Math.floor(vejde) : Math.ceil(vejde));
  const css = vejde - Math.floor(vejde) < 0.2 && vejde >= 1 ? n : vejde;
  canvas.width = SW * n; canvas.height = SH * n;
  canvas.style.width = (SW * css / dpr) + 'px';
  canvas.style.height = (SH * css / dpr) + 'px';
  canvas.style.imageRendering = css === n ? 'pixelated' : 'auto';
  obrazovka.imageSmoothingEnabled = false;
}
window.addEventListener('resize', prizpusobOkno);
window.addEventListener('load', prizpusobOkno);
prizpusobOkno();

const nahoda = (a, b) => a + Math.random() * (b - a);
const vzdal = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
let k = 1;      // časový krok (1 = jeden snímek při 60 FPS)
let cas = 0;    // čas v sekundách, pro animace

// ===================== Ovládání =====================
const klavesy = {};
const jmenoKlavesy = e => (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') ? ' ' : e.key;
window.addEventListener('keydown', e => {
  const kl = jmenoKlavesy(e);
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(kl)) e.preventDefault();
  zvuk.odemkni();
  if (!klavesy[kl]) stisknuto(kl);
  klavesy[kl] = true;
});
window.addEventListener('keyup', e => { klavesy[jmenoKlavesy(e)] = false; });
canvas.addEventListener('mousedown', e => {
  e.preventDefault();
  window.focus();
  zvuk.odemkni();
  if (stav !== 'hra') stisknuto(' ');
});
const maFokus = () => document.hasFocus();
function ztrataOkna() {
  for (const kl in klavesy) klavesy[kl] = false;
  if (stav === 'hra') { stav = 'pauza'; zvuk.zastavHudbu(); }
}
window.addEventListener('blur', ztrataOkna);
document.addEventListener('visibilitychange', () => { if (document.hidden) ztrataOkna(); });
