/* 回归测试：个人战绩与日历圆点的胜/负判定必须与积分榜一致
   覆盖修复：客场作战时误用 result.won（主队胜负）导致个人战绩/日历点翻转
   Created by haodongsheng
   用法: node test/repro_homeaway.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['js/sim_config.js', 'js/players.js', 'js/teams.js', 'js/core.js'];
let src = files.map(function(f) {
  return fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
}).join('\n;\n');
// 关闭随机事件（伤病/禁赛），保证「个人战绩」与「战队积分」可直接对等
src += '\n;\nfunction checkRandomEvents(){ return null; }\n';
src += '\n;\nglobalThis.__T = {\n  getState: function(){ return STATE; },\n  buildSchedule: buildLoLSchedule,\n  simRound: simRound,\n};';

const els = {};
const documentStub = {
  addEventListener: function() {},
  getElementById: function(id) {
    if (id === 'simDotGrid') {
      if (!els.simDotGrid) els.simDotGrid = { innerHTML: '' };
      return els.simDotGrid;
    }
    return null;
  },
  querySelector: function() { return null; },
  querySelectorAll: function() { return []; },
  createElement: function() { return { getContext: function() { return {}; }, style: {}, classList: { add: function(){}, remove: function(){}, toggle: function(){} } }; },
  body: { appendChild: function() {}, insertAdjacentHTML: function() {} },
};
const localStorage = (function() {
  const m = {};
  return {
    getItem: function(k) { return k in m ? m[k] : null; },
    setItem: function(k, v) { m[k] = String(v); },
    removeItem: function(k) { delete m[k]; },
  };
})();

const sandbox = {
  document: documentStub,
  localStorage: localStorage,
  confirm: function() { return true; },
  console: console,
  Math: Math,
  JSON: JSON,
  Date: Date,
  setTimeout: function(fn) { fn(); return 0; },
  clearTimeout: function() {},
  Promise: Promise,
  Array: Array,
  Object: Object,
  String: String,
  Number: Number,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  globalThis: null,
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'lol-game.js' });

const T = sandbox.__T;
const sim = T.getState();
sim.mode = 'current';
sim.position = 'MID';
sim.careerTeam = 'WBG';
sim.finalOVR = 88;
sim.finalPosition = 'MID';
sim.attrs = { LANE: 85, MECH: 92, TEAM: 80, DPS: 86, BURST: 90, TANK: 38, CC: 70, ROAM: 82, VISION: 60, FARM: 82, MOB: 88, CLU: 90, SPLIT: 42 };
sim.career = { seasonCount: 0, currentAge: 16, seasons: [], totalStats: { kills: 0, deaths: 0, assists: 0, cs: 0, dmg: 0, vision: 0, games: 0 }, honors: [], championships: [], seasonHistory: [], achievements: [], profile: { fame: 0, popularity: 0, businessValue: 0, legacy: 0 }, retired: false, finalSummary: null, transferHistory: [], rosterOverride: null };
sim.season = { round: 0, wins: 0, losses: 0, series: [], stats: { kills: 0, deaths: 0, assists: 0, cs: 0, dmg: 0, vision: 0, games: 0 }, playoffStats: { kills: 0, deaths: 0, assists: 0, cs: 0, dmg: 0, vision: 0, games: 0 }, bestSeries: null, standings: {}, schedule: [], isPlayoffs: false, playoffBracket: null, playoffResult: null, awards: [], champion: null, fmvp: null, events: { storyTimeline: [], injuryGamesLeft: 0, suspensionGamesLeft: 0, injuryReason: null, suspensionReason: null, lastTriggerGameNum: null, playoffEventCount: 0 } };

// 重建赛程 + 初始化积分榜（与 startSeason 内部逻辑一致）
sim.season.schedule = T.buildSchedule().map(function(g) {
  return { round: g.round + 1, gameNum: g.gameNum, home: g.home, away: g.away, isMine: g.home === sim.careerTeam || g.away === sim.careerTeam, simulated: false };
});
['AL','BLG','EDG','IG','JDG','LGD','LNG','NIP','OMG','TES','TT','UP','WBG','WE'].forEach(function(t) {
  sim.season.standings[t] = { wins: 0, losses: 0, streak: 0, streakType: null };
});

for (let r = 1; r <= 26; r++) {
  T.simRound(r);
}

const s = T.getState().season;
const team = s.standings[sim.careerTeam];
let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('✅ ' + name);
  } else {
    failures++;
    console.log('❌ ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''));
  }
}

check('常规赛打完26轮', s.round === 26, s.round);
check('个人战绩 == 战队积分（' + s.wins + '胜' + s.losses + '负 vs ' + team.wins + '胜' + team.losses + '负）',
  s.wins === team.wins && s.losses === team.losses,
  { personal: s.wins + '-' + s.losses, team: team.wins + '-' + team.losses });

// 日历圆点：每个已打轮次的「胜/负」必须与 series 记录一致
const dotResult = {};
const re = /title="第(\d+)轮 (胜|负) /g;
let m;
while ((m = re.exec(els.simDotGrid.innerHTML)) !== null) {
  dotResult[Number(m[1])] = m[2];
}
s.series.forEach(function(entry) {
  if (entry.skipReason) return;
  check('第' + entry.round + '轮日历点: ' + (entry.won ? '胜' : '负'),
    dotResult[entry.round] === (entry.won ? '胜' : '负'),
    { dot: dotResult[entry.round], series: entry.won ? '胜' : '负' });
});

if (failures > 0) {
  console.log('\n共 ' + failures + ' 项失败');
  process.exit(1);
}
console.log('\n全部通过');
