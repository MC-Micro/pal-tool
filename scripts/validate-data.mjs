import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.cwd());
const requiredFiles = [
  'index.html',
  'app.css',
  'app.js',
  'data-passives.js',
  'data-overrides.js',
  'manifest.webmanifest',
  'sw.js',
  'icon-192.png',
  'icon-512.png'
];

const errors = [];
const fail = message => errors.push(message);

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`Pflichtdatei fehlt: ${file}`);
}

for (const file of ['app.js', 'sw.js', 'data-passives.js', 'data-overrides.js']) {
  if (!fs.existsSync(path.join(root, file))) continue;
  try {
    new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
  } catch (error) {
    fail(`JavaScript-Syntaxfehler in ${file}: ${error.message}`);
  }
}

const context = { window: {} };
vm.createContext(context);
try {
  vm.runInContext(fs.readFileSync(path.join(root, 'data-passives.js'), 'utf8'), context, { filename: 'data-passives.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'data-overrides.js'), 'utf8'), context, { filename: 'data-overrides.js' });
} catch (error) {
  fail(`Datenmodule konnten nicht ausgeführt werden: ${error.message}`);
}

const data = context.window.PALWORLD_PASSIVES_DATA;
if (!data) {
  fail('PALWORLD_PASSIVES_DATA wurde nicht geladen.');
} else {
  if (data.meta?.project_version !== 'v1.0.0') fail(`Unerwartete Projektversion: ${data.meta?.project_version}`);
  if (!Array.isArray(data.passives)) fail('passives ist kein Array.');
  if (data.passives?.length !== 102) fail(`Erwartet 102 Passives, gefunden: ${data.passives?.length}`);

  const allowedStatuses = new Set(['Aktuell', 'Neu', 'Geändert', 'Korrigiert', 'Entfernt']);
  const allowedPriorities = new Set(data.prio_order || []);
  const allowedRoles = new Set(data.roles || []);
  const seenNr = new Set();
  const seenDe = new Set();
  const seenEn = new Set();

  for (const passive of data.passives || []) {
    const label = `${passive.nr ?? '?'} / ${passive.de ?? '?'}`;
    for (const field of ['nr', 'de', 'en', 'effect_de', 'effect_en', 'explain', 'status', 'rank', 'rank_label', 'rank_symbol', 'role_priorities']) {
      if (passive[field] === undefined || passive[field] === null || passive[field] === '') fail(`${label}: Pflichtfeld fehlt: ${field}`);
    }
    if (seenNr.has(passive.nr)) fail(`Doppelte Nummer: ${passive.nr}`); else seenNr.add(passive.nr);
    if (seenDe.has(passive.de)) fail(`Doppelter deutscher Name: ${passive.de}`); else seenDe.add(passive.de);
    if (seenEn.has(passive.en)) fail(`Doppelter englischer Name: ${passive.en}`); else seenEn.add(passive.en);
    if (!allowedStatuses.has(passive.status)) fail(`${label}: ungültiger Status: ${passive.status}`);
    if (![1, 2, 3, 4].includes(passive.rank)) fail(`${label}: ungültiger Rang: ${passive.rank}`);

    for (const [role, priority] of Object.entries(passive.role_priorities || {})) {
      if (!allowedRoles.has(role)) fail(`${label}: unbekannte Rolle: ${role}`);
      if (!allowedPriorities.has(priority)) fail(`${label}: unbekannte Priorität: ${priority}`);
      if (role === 'Negativ / Meiden' && priority !== 'Meiden') fail(`${label}: Negativ / Meiden muss Priorität Meiden besitzen.`);
    }
  }

  const byName = new Map((data.passives || []).map(passive => [passive.de, passive]));
  const musclehead = byName.get('Mehr Kraft als Verstand');
  if (musclehead?.role_priorities?.['Kampf / Angriff'] !== 'S+' || musclehead?.role_priorities?.['Base / Arbeit'] !== 'Meiden') {
    fail('Tradeoff-Referenz Mehr Kraft als Verstand ist inkonsistent.');
  }
  const workSlave = byName.get('Arbeitsvieh');
  if (workSlave?.role_priorities?.['Base / Arbeit'] !== 'S' || workSlave?.role_priorities?.['Kampf / Angriff'] !== 'Meiden') {
    fail('Tradeoff-Referenz Arbeitsvieh ist inkonsistent.');
  }
}

try {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  for (const icon of manifest.icons || []) {
    if (!fs.existsSync(path.join(root, icon.src))) fail(`Manifest verweist auf fehlendes Icon: ${icon.src}`);
  }
} catch (error) {
  fail(`Manifest ist ungültig: ${error.message}`);
}

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const source of ['app.css', 'data-passives.js', 'data-overrides.js', 'app.js', 'manifest.webmanifest', 'icon-192.png']) {
  if (!index.includes(source)) fail(`index.html referenziert ${source} nicht.`);
}

const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
for (const file of requiredFiles.filter(file => !file.startsWith('scripts/'))) {
  if (file === 'sw.js') continue;
  if (!serviceWorker.includes(`./${file}`)) fail(`sw.js cached ${file} nicht.`);
}

if (errors.length) {
  console.error('\nValidierung fehlgeschlagen:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Validierung erfolgreich: 102 Passives, Datenstruktur, PWA-Dateien und Cache-Verweise sind konsistent.');
