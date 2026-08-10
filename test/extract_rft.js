/* 从 rft.gg 页面 HTML 中提取选手统计 JSON
   Created by haodongsheng
   用法: node test/extract_rft.js <inputHtml> <outputJson> */
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || '/tmp/rft_players.html', 'utf8');

function extractBalanced(text, startIdx) {
  let i = startIdx;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return null;
}

// flight data 中的 payload 是 JSON 字符串，先反转义成可读文本
let stats = null;
let teams = null;
const pushMarker = 'self.__next_f.push([1,"';
let from = 0;
while (stats === null) {
  const s = html.indexOf(pushMarker, from);
  if (s < 0) break;
  const end = html.indexOf('"])', s + pushMarker.length);
  if (end < 0) break;
  const raw = html.slice(s + pushMarker.length, end);
  let text = null;
  try { text = JSON.parse('"' + raw + '"'); } catch (e) { /* 继续下一个 */ }
  if (text) {
    const statsStart = text.indexOf('"stats":[');
    if (statsStart >= 0) {
      const statsJson = extractBalanced(text, statsStart + '"stats":'.length);
      if (statsJson) stats = JSON.parse(statsJson);
      const teamsStart = text.indexOf('"teams":[');
      if (teamsStart >= 0) {
        const teamsJson = extractBalanced(text, teamsStart + '"teams":'.length);
        if (teamsJson) teams = JSON.parse(teamsJson);
      }
    }
  }
  from = end + 2;
}

if (!stats) {
  console.error('stats array not found');
  process.exit(1);
}

fs.writeFileSync(process.argv[3] || '/tmp/rft_stats.json', JSON.stringify({ stats: stats, teams: teams }, null, 2));
console.log('players:', stats.length, 'teams:', teams.length);
// 位置分布
const roles = {};
stats.forEach(function(p) { roles[p.role] = (roles[p.role] || 0) + 1; });
console.log('roles:', JSON.stringify(roles));
