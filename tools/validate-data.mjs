#!/usr/bin/env node
// Validates data/*.json against data/schema/*.json and the cross-file rules in docs/spec/20-data-schema.md.
// Plain Node (22+), no dependencies. Exit code 1 on any error.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function load(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) { err(`${rel}: file missing`); return null; }
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { err(`${rel}: invalid JSON (${e.message})`); return null; }
}

// ---- minimal JSON Schema (2020-12 subset: type, enum, const, required, properties,
// additionalProperties:false, items, minItems, maxItems, uniqueItems, minimum, maximum,
// minLength, maxLength, pattern, $ref to #/$defs/...) ----
function typeOk(t, v) {
  switch (t) {
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
    case 'array': return Array.isArray(v);
    case 'string': return typeof v === 'string';
    case 'integer': return Number.isInteger(v);
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    case 'null': return v === null;
    default: return false;
  }
}
function check(schema, v, path, root0, out) {
  if (schema.$ref) {
    const parts = schema.$ref.replace(/^#\//, '').split('/');
    let t = root0; for (const p of parts) t = t?.[p];
    if (!t) { out.push(`${path}: unresolved $ref ${schema.$ref}`); return; }
    return check(t, v, path, root0, out);
  }
  if (schema.type && !typeOk(schema.type, v)) { out.push(`${path}: expected ${schema.type}`); return; }
  if ('const' in schema && v !== schema.const) out.push(`${path}: must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(v)) out.push(`${path}: "${v}" not in [${schema.enum.join(', ')}]`);
  if (typeof v === 'number') {
    if (schema.minimum !== undefined && v < schema.minimum) out.push(`${path}: ${v} < ${schema.minimum}`);
    if (schema.maximum !== undefined && v > schema.maximum) out.push(`${path}: ${v} > ${schema.maximum}`);
  }
  if (typeof v === 'string') {
    if (schema.minLength !== undefined && v.length < schema.minLength) out.push(`${path}: shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && v.length > schema.maxLength) out.push(`${path}: longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(v)) out.push(`${path}: "${v}" does not match ${schema.pattern}`);
  }
  if (Array.isArray(v)) {
    if (schema.minItems !== undefined && v.length < schema.minItems) out.push(`${path}: ${v.length} items, need >= ${schema.minItems}`);
    if (schema.maxItems !== undefined && v.length > schema.maxItems) out.push(`${path}: ${v.length} items, need <= ${schema.maxItems}`);
    if (schema.uniqueItems && new Set(v.map((x) => JSON.stringify(x))).size !== v.length) out.push(`${path}: items not unique`);
    if (schema.items) v.forEach((x, i) => check(schema.items, x, `${path}[${i}]`, root0, out));
  } else if (v !== null && typeof v === 'object') {
    for (const r of schema.required ?? []) if (!(r in v)) out.push(`${path}: missing "${r}"`);
    const props = schema.properties ?? {};
    for (const k of Object.keys(v)) {
      if (k in props) check(props[k], v[k], `${path}.${k}`, root0, out);
      else if (schema.additionalProperties === false) out.push(`${path}: unknown field "${k}"`);
    }
  }
}
function validateFile(name) {
  const data = load(`data/${name}.json`);
  const schema = load(`data/schema/${name}.schema.json`);
  if (!data || !schema) return data;
  const out = [];
  check(schema, data, name, schema, out);
  const label = (o) => out.length;
  for (const m of out.slice(0, 40)) err(`schema ${m}`);
  if (out.length > 40) err(`schema ${name}: ... ${out.length - 40} more`);
  return data;
}

const heroes = validateFile('heroes');
const court = validateFile('court');
const rivals = validateFile('rivals');
const skills = validateFile('skills');
const map = validateFile('map');
const triggers = validateFile('triggers');

// ---- map ----
const prefIds = new Set();
let capital = null, marsh = null;
if (map?.prefectures) {
  for (const p of map.prefectures) {
    if (prefIds.has(p.id)) err(`map: duplicate prefecture id ${p.id}`);
    prefIds.add(p.id);
    if (p.special?.includes('capital')) { if (capital) err('map: more than one capital'); capital = p.id; }
    if (p.special?.includes('liangshan-marsh')) { if (marsh) err('map: more than one liangshan-marsh'); marsh = p.id; if (p.terrain !== 'marsh') err(`map: ${p.id} has liangshan-marsh but terrain ${p.terrain}`); }
    // pos must follow lon/lat with the documented projection
    const x = (p.lon - 106.0) / (122.5 - 106.0), y = (41.0 - p.lat) / (41.0 - 27.5);
    if (Math.abs(x - p.pos.x) > 0.002 || Math.abs(y - p.pos.y) > 0.002) err(`map: ${p.id} pos does not match lon/lat (expected ${x.toFixed(3)}, ${y.toFixed(3)})`);
  }
  if (!capital) err('map: no prefecture tagged capital');
  if (!marsh) err('map: no prefecture tagged liangshan-marsh');
  const adj = new Map([...prefIds].map((i) => [i, new Set()]));
  const seen = new Set();
  for (const l of map.links ?? []) {
    if (!prefIds.has(l.a)) err(`map: link refers to unknown prefecture ${l.a}`);
    if (!prefIds.has(l.b)) err(`map: link refers to unknown prefecture ${l.b}`);
    if (l.a === l.b) err(`map: self link ${l.a}`);
    const key = [l.a, l.b].sort().join('|');
    if (seen.has(key)) err(`map: duplicate link ${key}`);
    seen.add(key);
    adj.get(l.a)?.add(l.b); adj.get(l.b)?.add(l.a);
  }
  const bfs = (s) => {
    const d = new Map([[s, 0]]); const q = [s];
    while (q.length) { const c = q.shift(); for (const n of adj.get(c) ?? []) if (!d.has(n)) { d.set(n, d.get(c) + 1); q.push(n); } }
    return d;
  };
  if (marsh) {
    const d = bfs(marsh);
    const lost = [...prefIds].filter((i) => !d.has(i));
    if (lost.length) err(`map: not connected, unreachable from ${marsh}: ${lost.join(', ')}`);
    if (capital && d.has(capital) && d.get(capital) < 3) err(`map: capital is only ${d.get(capital)} links from Liangshan, need >= 3`);
    globalThis.__capDist = d.get(capital);
  }
  globalThis.__links = (map.links ?? []).length;
}

// ---- skills ----
const skillIds = new Set();
if (Array.isArray(skills)) for (const s of skills) { if (skillIds.has(s.id)) err(`skills: duplicate ${s.id}`); skillIds.add(s.id); }

// ---- people ----
const allIds = new Map();
function claimId(file, id) {
  if (allIds.has(id)) err(`${file}: id ${id} already used in ${allIds.get(id)}`);
  allIds.set(id, file);
}
function checkPerson(file, p, i) {
  const at = `${file}[${i}] ${p.id}`;
  claimId(file, p.id);
  for (const s of p.skills ?? []) if (!skillIds.has(s)) err(`${at}: unknown skill ${s}`);
  if (p.start && !prefIds.has(p.start.prefecture)) err(`${at}: start.prefecture ${p.start.prefecture} not on the map`);
  if (p.joinsLate && !p.joinTrigger) err(`${at}: joinsLate true needs joinTrigger`);
  if (!p.joinsLate && p.joinTrigger) err(`${at}: joinTrigger set but joinsLate is false`);
  if (p.id && p.name && p.id !== p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') && !/^[a-z0-9-]+-[a-z]+$/.test(p.id)) {
    warn(`${at}: id does not follow name "${p.name}"`);
  }
}
if (Array.isArray(heroes)) {
  const ranks = new Set(), starZh = new Set(), nameZh = new Set();
  let heavenly = 0, earthly = 0;
  heroes.forEach((h, i) => {
    checkPerson('heroes', h, i);
    if (h.star) {
      if (h.star.rank !== i + 1) err(`heroes[${i}] ${h.id}: star.rank ${h.star.rank}, expected ${i + 1} (star order)`);
      if (ranks.has(h.star.rank)) err(`heroes: duplicate star rank ${h.star.rank}`);
      ranks.add(h.star.rank);
      const want = h.star.rank <= 36 ? 'heavenly' : 'earthly';
      if (h.star.group !== want) err(`heroes[${i}] ${h.id}: rank ${h.star.rank} must be ${want}`);
      h.star.group === 'heavenly' ? heavenly++ : earthly++;
      if (starZh.has(h.star.nameZh)) err(`heroes: duplicate star nameZh ${h.star.nameZh}`);
      starZh.add(h.star.nameZh);
      const pre = h.star.group === 'heavenly' ? '天' : '地';
      if (!h.star.nameZh.startsWith(pre) || !h.star.nameZh.endsWith('星')) err(`heroes[${i}] ${h.id}: star.nameZh ${h.star.nameZh} should start with ${pre} and end with 星`);
    }
    if (nameZh.has(h.nameZh)) err(`heroes: duplicate nameZh ${h.nameZh}`);
    nameZh.add(h.nameZh);
  });
  if (heroes.length === 108 && (heavenly !== 36 || earthly !== 72)) err(`heroes: ${heavenly} heavenly / ${earthly} earthly, need 36 / 72`);
  // spread: the 108 must differ meaningfully
  for (const k of ['might', 'command', 'cunning', 'vigour']) {
    const v = heroes.map((h) => h.abilities?.[k]).filter(Number.isFinite);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
    const top = v.filter((x) => x >= 90).length;
    const distinct = new Set(v).size;
    if (sd < 12) err(`heroes: ${k} spread too narrow (sd ${sd.toFixed(1)}, need >= 12)`);
    if (top < 2 || top > 12) err(`heroes: ${k} has ${top} heroes at 90+, want 2-12 (a handful)`);
    if (distinct < 20) err(`heroes: ${k} has only ${distinct} distinct values`);
    globalThis['__' + k] = `${k} sd ${sd.toFixed(0)} top ${top}`;
  }
  for (const k of ['righteousness', 'compassion', 'daring']) {
    const distinct = new Set(heroes.map((h) => h.virtues?.[k])).size;
    if (distinct < 7) err(`heroes: ${k} uses only ${distinct} of 10 values`);
  }
  const used = new Set(heroes.flatMap((h) => h.skills ?? []));
  for (const s of skillIds) if (!used.has(s)) err(`heroes: skill ${s} is used by no hero`);
  globalThis.__late = heroes.filter((h) => h.joinsLate).length;
}
if (Array.isArray(court)) {
  court.forEach((c, i) => checkPerson('court', c, i));
  for (const need of ['gao-qiu', 'cai-jing', 'tong-guan', 'yang-jian', 'gao-lian', 'gao-yanei'])
    if (!court.some((c) => c.id === need)) err(`court: missing ${need}`);
  if (court.length < 16 || court.length > 26) err(`court: ${court.length} records, want 16-26 (6 named + 10-20)`);
}
if (Array.isArray(rivals)) {
  rivals.forEach((r, i) => {
    checkPerson('rivals', r, i);
    if (r.stronghold && !prefIds.has(r.stronghold)) err(`rivals[${i}] ${r.id}: stronghold ${r.stronghold} not on the map`);
  });
  for (const need of ['shi-wengong', 'luan-tingyu'])
    if (!rivals.some((c) => c.id === need)) err(`rivals: missing ${need}`);
}

// ---- triggers (RULING Q-5): one row per joinsLate hero, kinds closed, references exist ----
if (triggers && heroes && map?.prefectures) {
  const hid = new Set(heroes.map((h) => h.id));
  const late = new Set(heroes.filter((h) => h.joinsLate).map((h) => h.id));
  const seenT = new Set();
  for (const t of triggers) {
    if (!late.has(t.hero)) err(`triggers: ${t.hero} is not a joinsLate hero`);
    if (seenT.has(t.hero)) err(`triggers: duplicate row for ${t.hero}`);
    seenT.add(t.hero);
    const need = { renown: ['min'], own: ['prefecture'], 'battle-won-at': ['prefecture'], attacked: ['prefecture'], 'defeated-hero': ['target'], brother: ['target'], 'campaign-announced': [] }[t.kind] ?? [];
    for (const f of need) if (t[f] === undefined) err(`triggers: ${t.hero} (${t.kind}) needs "${f}"`);
    if (t.prefecture && !prefIds.has(t.prefecture)) err(`triggers: ${t.hero} refers to unknown prefecture ${t.prefecture}`);
    if (t.target && !hid.has(t.target)) err(`triggers: ${t.hero} refers to unknown hero ${t.target}`);
    if (t.target === t.hero) err(`triggers: ${t.hero} waits for itself`);
  }
  for (const id of late) if (!seenT.has(id)) err(`triggers: joinsLate hero ${id} has no row`);
}

// ---- hygiene: forbidden words and private paths in every data/ and spec file I own ----
const rev = (s) => [...s].reverse().join('');
const banned = ['ibihc', 'DSGM', 'DS', 'demrofed-repus', 'madnuG', 'odironeN', 'etuc', 'iiwak', 'yot', 'ynootrac', 'ybbuts', 'sgel ynit'].map(rev);
const koei = ['Bandit' + ' Kings', 'Ten' + 'mei'];
const privacy = [new RegExp('/ho' + 'me/'), new RegExp('/ro' + 'ot/'), new RegExp('@g' + 'mail', 'i')];
function scan(rel) {
  const text = readFileSync(join(root, rel), 'utf8');
  for (const w of banned) if (new RegExp(`(^|[^A-Za-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z])`, w === w.toUpperCase() ? '' : 'i').test(text)) err(`${rel}: contains a banned word`);
  for (const w of koei) if (text.includes(w)) err(`${rel}: contains "${w}" (allowed only under docs/research/)`);
  for (const r of privacy) if (r.test(text)) err(`${rel}: contains a private path or address (${r})`);
}
for (const f of readdirSync(dataDir, { recursive: true })) {
  if (/\.json$/.test(f)) scan(relative(root, join(dataDir, f)));
}
if (existsSync(join(root, 'docs/spec/20-data-schema.md'))) scan('docs/spec/20-data-schema.md');
else err('docs/spec/20-data-schema.md missing');
scan('tools/validate-data.mjs');

// ---- report ----
for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
const n = (a) => (Array.isArray(a) ? a.length : 0);
console.log(
  `validate-data: ${errors.length ? 'FAILED' : 'OK'} | heroes ${n(heroes)} (late ${globalThis.__late ?? 0}) | court ${n(court)} | rivals ${n(rivals)} | skills ${n(skills)} | prefectures ${map?.prefectures?.length ?? 0}, links ${globalThis.__links ?? 0}, capital ${globalThis.__capDist ?? '?'} links from Liangshan | ${errors.length} errors, ${warnings.length} warnings`
);
process.exit(errors.length ? 1 : 0);
