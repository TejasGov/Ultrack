// node map_sessions.js <transcript.jsonl> <context prefix> <out sessions.json>
// Rebuilds {session_id: line id} from a Claude Code transcript: each creative_generate_speech call whose context is
// "<prefix><line id>" is paired with the session_id in its tool result, so no id is copied by hand.
// It also checks the prompt sent equals the script text, so a typo in a call cannot slip through.
const fs = require('fs');
const [file, prefix, out] = process.argv.slice(2);
const script = Object.fromEntries(require('D:/RaceUltimate/assets/audio/announcers/script.json').lines.map((l) => [l.id, l.text]));
const calls = new Map(), sessions = {}, problems = [];
for (const row of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!row.includes('creative_generate_speech') && !row.includes('tool_result')) continue;
  let j; try { j = JSON.parse(row); } catch { continue; }
  for (const c of [].concat(j.message?.content || [])) {
    if (c.type === 'tool_use' && c.name?.endsWith('creative_generate_speech') && c.input?.context?.startsWith(prefix))
      calls.set(c.id, { id: c.input.context.slice(prefix.length).trim(), prompt: c.input.prompt });
    if (c.type === 'tool_result' && calls.has(c.tool_use_id)) {
      const call = calls.get(c.tool_use_id);
      const text = [].concat(c.content).map((x) => x.text || x).join('');
      const sid = /"session_id":"([^"]+)"/.exec(text)?.[1];
      if (!sid) { problems.push('no session for ' + call.id); continue; }
      if (script[call.id] !== call.prompt) problems.push('prompt differs from script: ' + call.id);
      if (Object.values(sessions).includes(call.id)) problems.push('recorded twice: ' + call.id);
      sessions[sid] = call.id;
    }
  }
}
fs.writeFileSync(out, JSON.stringify({ sessions }, null, 2) + '\n');
console.log(`${Object.keys(sessions).length} takes mapped${problems.length ? '\n' + problems.join('\n') : ''}`);
