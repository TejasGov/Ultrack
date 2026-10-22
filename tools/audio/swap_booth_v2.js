// node swap_booth_v2.js   one-off (2026-10-19): replaces Enzo v1 with v2 and adds Kavya, only if the v2 set is complete.
// Old Enzo files were copied to announcers/_archive/enzo_v1, which the user had deleted afterwards; voice_manifest.json gets the new voices and seconds.
const fs = require('fs'), path = require('path');
const ROOT = 'D:/RaceUltimate/assets/audio/announcers', V2 = path.join(ROOT, '_v2');
const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'script.json'), 'utf8'));
const seconds = JSON.parse(fs.readFileSync(path.join(V2, 'ogg_seconds.json'), 'utf8'));
const want = script.lines.filter((l) => l.speaker !== 'alastair');
const missing = want.filter((l) => !fs.existsSync(path.join(V2, 'ogg', l.id + '.ogg')) || !fs.existsSync(path.join(V2, 'src', l.id + '.mp3')) || !seconds[l.id]);
if (missing.length) throw new Error('v2 set incomplete: ' + missing.map((l) => l.id).join(' '));
if (JSON.parse(fs.readFileSync(path.join(ROOT, 'voice_manifest.json'), 'utf8')).voices.enzo === 'yowh82B72eMNrxcxHgBh') throw new Error('already swapped (manifest has the v2 Enzo voice)');

// copy, not rename: a directory rename hit EPERM (a handle is open on enzo/); v2 overwrites the same file names
fs.cpSync(path.join(ROOT, 'enzo'), path.join(ROOT, '_archive/enzo_v1'), { recursive: true });
for (const sp of ['enzo', 'kavya']) {
  fs.mkdirSync(path.join(ROOT, sp, 'src'), { recursive: true });
  for (const l of want.filter((x) => x.speaker === sp)) {
    fs.copyFileSync(path.join(V2, 'ogg', l.id + '.ogg'), path.join(ROOT, sp, l.id + '.ogg'));
    fs.copyFileSync(path.join(V2, 'src', l.id + '.mp3'), path.join(ROOT, sp, 'src', l.id + '.mp3'));
  }
}

const mf = path.join(ROOT, 'voice_manifest.json');
const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
const a = m.approved;
const lines = {};
for (const l of script.lines) {
  if (l.speaker === 'alastair') { lines[l.id] = m.lines[l.id]; continue; }
  lines[l.id] = { file: `${l.speaker}/${l.id}.ogg`, seconds: seconds[l.id], speaker: l.speaker, category: l.category };
}
const missingLines = script.lines.filter((l) => !lines[l.id]).map((l) => l.id);
const out = {
  version: m.version, format: m.format, model: m.model,
  voices: { enzo: a.enzo.voice_id, alastair: m.voices.alastair, kavya: a.kavya.voice_id },
  voice_notes: {
    enzo: `${a.enzo.name}, ${a.enzo.source}. Approved by ear 2026-10-19; replaced ${a.enzo.replaces}. v1 files deleted 2026-10-19 (Recycle Bin).`,
    kavya: `${a.kavya.name}, ${a.kavya.source}. Approved by ear 2026-10-19.`,
    settings: a.settings,
  },
  lines, missing: missingLines,
};
fs.writeFileSync(mf, JSON.stringify(out, null, 2) + '\n');
const count = (sp) => Object.values(lines).filter((x) => x && x.speaker === sp).length;
console.log(`swapped: enzo ${count('enzo')}, alastair ${count('alastair')}, kavya ${count('kavya')}, missing ${missingLines.length}`);
