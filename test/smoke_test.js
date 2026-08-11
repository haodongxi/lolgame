/* 逻辑冒烟测试：加载全部源码并在模拟上下文中跑完整生涯流程
   Created by haodongsheng
   用法: node test/smoke_test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['js/sim_config.js', 'js/players.js', 'js/heroes.js', 'js/teams.js', 'js/core.js'];
let src = files.map(function(f) {
  return fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
}).join('\n;\n');
// 暴露内部状态供测试读取
src += '\n;\nglobalThis.__T = {\n  getState: function(){ return STATE; },\n  buildSchedule: buildLoLSchedule,\n  teamPlayers: getTeamPlayers,\n  teamPower: calcTeamPower,\n  simSeries: simulateSeries,\n  genStats: generatePlayerStats,\n  awards: calcAwards,\n  initPO: initPlayoffs,\n  simPORound: simPlayoffRound,\n  nextSeason: startNextSeason,\n  simRound: simRound,\n  endRS: endRegularSeason,\n};';

const localStorage = (function() {
  const m = {};
  return {
    getItem: function(k) { return k in m ? m[k] : null; },
    setItem: function(k, v) { m[k] = String(v); },
    removeItem: function(k) { delete m[k]; },
  };
})();

const documentStub = {
  addEventListener: function() {},
  getElementById: function() { return null; },
  querySelector: function() { return null; },
  querySelectorAll: function() { return []; },
  createElement: function() { return { getContext: function() { return {}; }, style: {}, classList: { add: function(){}, remove: function(){}, toggle: function(){} } }; },
  body: { appendChild: function() {}, insertAdjacentHTML: function() {} },
};

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
let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('✅ ' + name);
  } else {
    failures++;
    console.log('❌ ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''));
  }
}

// 1. 数据完整性
const sched = T.buildSchedule();
check('赛程共273场（14队三循环）', sched.length === 273, sched.length);
const perTeam = {};
sched.forEach(function(g) {
  perTeam[g.home] = (perTeam[g.home] || 0) + 1;
  perTeam[g.away] = (perTeam[g.away] || 0) + 1;
});
check('每队39场', Object.keys(perTeam).length === 14 && Object.values(perTeam).every(function(v) { return v === 39; }), perTeam);
check('每队≥5名选手且首发5人', SIM_CONFIG_TEAM_COUNT());

function SIM_CONFIG_TEAM_COUNT() {
  const teams = ['AL', 'BLG', 'EDG', 'IG', 'JDG', 'LGD', 'LNG', 'NIP', 'OMG', 'TES', 'TT', 'UP', 'WBG', 'WE'];
  return teams.every(function(t) {
    const roster = sandbox.__T.teamPlayers(t);
    if (roster.length < 5) return false;
    const posSet = {};
    roster.forEach(function(p) { posSet[p.pos] = true; });
    return ['TOP', 'JG', 'MID', 'ADC', 'SUP'].every(function(pos) { return posSet[pos]; });
  });
}

// 2. 状态初始化 + 模拟一局
const st = T.getState();
st.mode = 'current';
st.position = 'MID';
st.careerTeam = 'JDG';
st.finalOVR = 88;
st.finalPosition = 'MID';
st.attrs = { TANK: 40, FIGHTER: 55, AD_ASN: 90, AP_ASN: 92, MAGE: 88, MARK: 80, ENGAGE: 45, ENCH: 40, LANE: 85, MECH: 92, TEAM: 80, ROAM: 82, CLU: 90 };
const powA = T.teamPower('JDG');
const powB = T.teamPower('BLG');
check('战队实力为数值', [powA.offense, powA.defense, powA.macro, powA.clutch, powA.overall].every(function(v) { return typeof v === 'number' && v > 0; }), powA);

const series = T.simSeries('JDG', 'BLG', false);
check('BO3 比分合法', (series.score === '2-0' || series.score === '2-1' || series.score === '1-2' || series.score === '0-2') && series.games.length >= 2, series.score);
const stats = T.genStats(series, false);
check('个人数据为正数', ['kills', 'deaths', 'assists', 'cs', 'dmg', 'vision', 'games'].every(function(k) { return stats[k] > 0; }), stats);

// 3. 完整常规赛
const sim = sandbox.__T.getState();
sim.season = { round: 0, wins: 0, losses: 0, series: [], stats: { kills: 0, deaths: 0, assists: 0, cs: 0, dmg: 0, vision: 0, games: 0 }, playoffStats: { kills: 0, deaths: 0, assists: 0, cs: 0, dmg: 0, vision: 0, games: 0 }, bestSeries: null, standings: {}, schedule: [], isPlayoffs: false, playoffBracket: null, playoffResult: null, awards: [], champion: null, fmvp: null, events: { storyTimeline: [], injuryGamesLeft: 0, suspensionGamesLeft: 0, injuryReason: null, suspensionReason: null, lastTriggerGameNum: null, playoffEventCount: 0 } };
sim.career = { seasonCount: 0, currentAge: 18, seasons: [], totalStats: { kills: 0, deaths: 0, assists: 0, cs: 0, dmg: 0, vision: 0, games: 0 }, honors: [], championships: [], seasonHistory: [], achievements: [], profile: { fame: 0, popularity: 0, businessValue: 0, legacy: 0 }, retired: false, finalSummary: null, transferHistory: [], rosterOverride: null };
sim.position = 'MID';
sim.careerTeam = 'JDG';
sim.finalOVR = 88;
sim.attrs = st.attrs;
// 重建赛程：直接用 buildLoLSchedule 构造（与内部一致）
sim.season.schedule = sandbox.__T.buildSchedule().map(function(g, i) {
  return { round: g.round + 1, gameNum: g.gameNum, home: g.home, away: g.away, isMine: g.home === sim.careerTeam || g.away === sim.careerTeam, simulated: false };
});
// 初始化积分榜（直接内联，避免依赖未导出函数）
const sts = {};
sim.season.standings = sts;
['AL','BLG','EDG','IG','JDG','LGD','LNG','NIP','OMG','TES','TT','UP','WBG','WE'].forEach(function(t) { sts[t] = { wins: 0, losses: 0, streak: 0, streakType: null }; });

for (let r = 1; r <= 39; r++) {
  T.simRound(r);
}
const s1 = T.getState().season;
check('常规赛打完39轮', s1.round === 39, s1.round);
check('我的战绩+缺阵合计39场', (s1.wins + s1.losses + s1.series.filter(function(s) { return s.skipReason; }).length) === 39, s1.wins + 'W-' + s1.losses + 'L+缺阵' + s1.series.filter(function(s) { return s.skipReason; }).length);
let totalGames = 0;
Object.values(s1.standings).forEach(function(x) { totalGames += x.wins + x.losses; });
check('积分榜共546场', totalGames === 546, totalGames);

// 4. 奖项
T.awards();
check('奖项已生成', Array.isArray(s1.awards) && s1.awards.length > 0, s1.awards.length);

// 5. 季后赛
T.initPO();
T.simPORound(); // qf
check('四分之一决赛完成', T.getState().season.playoffBracket.currentRound === 'sf');
T.simPORound(); // sf
check('半决赛完成', T.getState().season.playoffBracket.currentRound === 'final');
T.simPORound(); // final
const br = T.getState().season.playoffBracket;
check('季后赛打完且有冠军', br.done === true && !!br.champion, br.champion);

// 6. 新赛季
const beforeAge = T.getState().career.currentAge;
T.nextSeason();
check('新赛季年龄+1、赛季数+1', T.getState().career.currentAge === beforeAge + 1 && T.getState().career.seasonCount === 1, T.getState().career);

console.log('\n结果: ' + (failures === 0 ? '全部通过 🎉' : failures + ' 项失败'));
process.exit(failures === 0 ? 0 : 1);
