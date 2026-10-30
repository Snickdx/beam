import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const englishPath = path.join(root, "data", "english-4.txt");

const TARGET = "BEAM";

// Slurs and a short list of words that should not show up as ladder steps.
const BLOCK = new Set([
  "COON", "CUNT", "DAGO", "DYKE", "FAGS", "FUCK", "GOOK", "HEIL", "JIZZ",
  "KIKE", "NAZI", "PAKI", "PUTA", "RAPE", "SHIT", "SPIC", "TWAT", "WOPS",
]);

// Trinidad and Tobago words that are exactly 4 letters: slang, food, kinship,
// places, brands, acronyms, and spellings people actually use. Longer
// favourites (doubles, pelau, tabanca) cannot sit on a 4-letter ladder.
const TRINI = [
  // Glossary headwords
  "AAJI", "ALOO", "BAAP", "BAHU", "BAKE", "BEBE", "BETA", "BETI", "BHAI", "BODI",
  "BAWL", "BOIS", "BONE", "BONX", "BOOF", "BULL", "BUSS", "CACA", "CHIP", "CHUP", "COCO",
  "CRIX", "CYAH", "CYAT", "DADA", "DADI", "DAHI", "DIDI", "DONG", "DOSE",
  "DROP", "EHEH", "FETE", "FLIM", "GOSO", "GRIP", "GYAL", "GYUL", "HOPS",
  "HORN", "HOSS", "IMPS", "JADU", "JETH", "JOCK", "JOOK", "KALA", "LIME",
  "LOYA", "MACO", "MAMU", "MATA", "MOOK", "MUCK", "NANA", "NANI", "NATO",
  "OKRO", "PATI", "PITA", "POAN", "PONE", "PREE", "REAL", "REHL", "RENK",
  "ROTE", "ROTI", "SAME", "SEIM", "SIVE", "SNAT", "SOUR", "TATU", "TAWA",
  "TEEF", "TING", "TOUT", "TUTU", "VAPS", "WHAM", "WHEY", "WINE", "WOOD",
  "WWGD", "YENG", "YING", "ZESS",
  // Spellings, food, and talk the glossaries list under a longer form
  "ABIR", "ARTI", "BABA", "BARA", "BESS", "BRED", "BRUK", "CAAN", "CHAG",
  "CHOW", "CUFF", "CUSS", "CUSH", "CYAN", "CYAR", "DAAL", "DAHL", "DESE",
  "DEVI", "DEYA", "DHAL", "DHOL", "DIYA", "DOUX", "DUNG", "EDDO", "FASS",
  "GHEE", "HOLI", "JUKE", "KALI", "LAFF", "LASH", "LICK", "MALA", "MAMA",
  "MAMI", "MAXI", "MEHN", "MOKO", "PAPA", "PARD", "PELT", "POUI", "PUJA",
  "RAMA", "SADA", "SAGA", "SHUT", "SITA", "SOCA", "SUSU", "TADJ", "TAWK", "TEIF",
  "TIEF", "YOUT", "JUMP", "ZOUK",
  // Places people say in four letters
  "BOCA", "BREA", "DEBE", "ERIN", "MAYO", "SOBO", "TOCO",
  // Brands and acronyms
  "ANSA", "BOMB", "BWIA", "CAPE", "CBTT", "CNMG", "COKE", "CRIX", "CSEC",
  "DIGI", "FLOW", "GATE", "HFLE", "HILO", "JMMB", "LIAT", "LOOP", "MCAL",
  "NAPA", "NESC", "NLCB", "NPMC", "ODPM", "OWTU", "PATT", "PTSC", "RBTT",
  "SAPA", "SBCS", "SFGH", "SOLO", "STAG", "TATT", "TEMA", "TTCG", "TTDF",
  "TTPS", "TSTT", "TTEC", "TUCO", "WACK", "WASA", "WEFM", "XTRA", "YUMA",
];

function lettersOnly(word) {
  return typeof word === "string" && /^[A-Z]{4}$/.test(word);
}

function loadEnglish() {
  const words = [];
  const seen = new Set();
  for (const line of fs.readFileSync(englishPath, "utf8").split(/\r?\n/)) {
    const word = line.trim().toUpperCase();
    if (!lettersOnly(word) || !/[AEIOUY]/.test(word) || BLOCK.has(word) || seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  return words;
}

function neighborsOf(word, dict) {
  const found = [];
  const chars = word.split("");
  for (let i = 0; i < 4; i++) {
    const orig = chars[i];
    for (let code = 65; code <= 90; code++) {
      const ch = String.fromCharCode(code);
      if (ch === orig) continue;
      chars[i] = ch;
      const next = chars.join("");
      if (dict.has(next)) found.push(next);
    }
    chars[i] = orig;
  }
  return found;
}

function searchFromTarget(dict) {
  const parent = new Map();
  const dist = new Map([[TARGET, 0]]);
  const queue = [TARGET];
  let qi = 0;
  while (qi < queue.length) {
    const word = queue[qi++];
    const step = dist.get(word) + 1;
    for (const next of neighborsOf(word, dict)) {
      if (dist.has(next)) continue;
      dist.set(next, step);
      parent.set(next, word);
      queue.push(next);
    }
  }
  return { parent, dist };
}

function analyze(dict) {
  const { dist } = searchFromTarget(dict);
  const hist = [];
  for (const d of dist.values()) hist[d] = (hist[d] || 0) + 1;
  const reachable = [...dist.keys()].filter((w) => w !== TARGET);
  const band = reachable.filter((w) => {
    const d = dist.get(w);
    return d >= 4 && d <= 8;
  });
  const sorted = reachable.map((w) => dist.get(w)).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  return { dist, hist, reachable: reachable.length, band: band.length, median };
}

function degree(word, dict) {
  return neighborsOf(word, dict).length;
}

const english = loadEnglish();
const bad = [...new Set(TRINI)].filter((word) => !lettersOnly(word) || BLOCK.has(word));
if (bad.length) throw new Error(`Bad Trini entry: ${bad.join(",")}`);
const trini = [...new Set(TRINI)];

const dict = new Set(english);
dict.add(TARGET);
for (const word of trini) dict.add(word);

// A few ordinary English joins that keep local words on the ladder.
const EXTRAS = ["BRUH", "BAAL", "HAJI", "AMPS"];
for (const word of EXTRAS) {
  if (lettersOnly(word) && !BLOCK.has(word)) dict.add(word);
}

const chosen = {
  n: english.length,
  dict,
  stats: analyze(dict),
  missing: [],
};

const mustOn = ["ALOO", "DEYA", "DIYA", "CRIX", "MOKO", "YUMA", "JUMP", "DROP", "CUFF", "EDDO", "PUJA", "ROTI", "WASA", "GYAL", "SOCA", "MACO", "LIME", "STAG", "FETE", "CYAH", "ERIN", "BOMB", "BARA", "HOLI", "HOPS", "BAKE", "PONE", "NANI", "BODI", "CHOW", "MAXI", "BESS", "BAWL", "CHUP", "SUSU"];
chosen.missing = mustOn.filter((word) => !chosen.stats.dist.has(word));

const connectors = {};
for (const word of trini) {
  if (chosen.stats.dist.has(word)) continue;
  const hits = [];
  for (const bridge of neighborsOf(word, new Set(english))) {
    const onward = neighborsOf(bridge, chosen.dict).filter((item) => chosen.stats.dist.has(item));
    if (onward.length) hits.push(`${bridge}(${onward.slice(0, 3).join("/")})`);
  }
  if (hits.length) connectors[word] = hits.slice(0, 6);
}
const bridged = [];

chosen.stats = analyze(chosen.dict);
const isolated = trini.filter((word) => degree(word, chosen.dict) === 0);
const offLadder = trini.filter((word) => !chosen.stats.dist.has(word) && word !== TARGET);
const watch = ["LIME", "MACO", "ROTI", "GYAL", "BUSS", "SOCA", "STAG", "SOLO", "WASA", "CYAH", "FETE", "HOPS", "BAKE", "PONE", "CHOW", "MAXI", "BODI", "DHAL", "NANI", "DEYA", "TING", "TEEF", "BESS", "YUMA", "CRIX", "POUI", "SADA", "GHEE", "MOKO", "FLOW", "DIGI", "TSTT", "TTPS", "TTEC", "BWIA", "BAWL", "CHUP", "SUSU", "BYTE", "AJAR", "OMIT", "QUAY", "WISP", "CRUX"];
const watchReport = Object.fromEntries(watch.map((word) => {
  const d = chosen.stats.dist.get(word);
  return [word, d == null ? "off" : d];
}));

const words = [...chosen.dict].sort();
const out = `/* Generated by tools/build-words.mjs. English Scrabble 4-letter words plus Trini entries. */\nwindow.BEAM_PACK = ${JSON.stringify({ words, local: trini.sort() })};\n`;
fs.mkdirSync(path.join(root, "js"), { recursive: true });
fs.writeFileSync(path.join(root, "js", "words.js"), out);

const must = ["BEAM", "BAWL", "BEBE", "CHUP", "SUSU", "LIME", "MACO", "ROTI", "BARA", "GYAL", "BUSS", "SOCA", "STAG", "SOLO", "WASA", "TTEC", "HOPS", "BAKE", "CYAH", "TEEF", "FETE", "PONE", "CHOW", "MAXI", "BODI", "ALOO", "DHAL", "NANI", "DEYA", "CRIX", "YUMA", "BWIA", "TTPS", "MOKO", "BESS", "ZESS", "VAPS", "RENK", "PREE", "TOCO", "DEBE", "ERIN", "SADA", "GHEE", "POUI", "BYTE", "AJAR", "OMIT", "QUAY", "WISP", "CRUX", "WORD", "LOVE", "TIME", "HOME"];
const missing = must.filter((word) => !chosen.dict.has(word));
if (missing.length) throw new Error(`Missing ${missing.join(",")}`);

console.log(JSON.stringify({
  englishPool: english.length,
  usedEnglish: chosen.n,
  missingMustOnLadder: chosen.missing,
  dict: words.length,
  trini: trini.length,
  reachable: chosen.stats.reachable,
  band4to8: chosen.stats.band,
  median: chosen.stats.median,
  hist: chosen.stats.hist,
  bridged,
  isolated,
  offLadder,
  connectors,
  watchReport,
}, null, 2));
