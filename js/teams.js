/* ============================================================
   战队与赛程模块：2026 赛季 LPL 14 支战队阵容
   每个位置可有多人：数组首位为首发，其余为替补（轮换）
   Created by haodongsheng
   ============================================================ */
const TEAM_ROSTERS = {
  AL:   { TOP: ['Flandre'], JG: ['Tarzan'], MID: ['Shanks'], ADC: ['Hope'], SUP: ['Kael'] },
  BLG:  { TOP: ['Bin'], JG: ['Xun'], MID: ['Knight'], ADC: ['Viper'], SUP: ['ON'] },
  EDG:  { TOP: ['Zdz'], JG: ['Xiaohao'], MID: ['Angel', 'Sinian'], ADC: ['Leave'], SUP: ['Parukia'] },
  IG:   { TOP: ['Soboro', 'Breathe'], JG: ['Wei'], MID: ['Rookie', 'Renard', 'Nia'], ADC: ['Photic'], SUP: ['Jwei', 'Meiko'] },
  JDG:  { TOP: ['Xiaoxu'], JG: ['Junjia'], MID: ['HongQ'], ADC: ['GALA'], SUP: ['Vampire'] },
  LGD:  { TOP: ['sasi', 'Burdol'], JG: ['Heng'], MID: ['Tangyuan'], ADC: ['Shaoye'], SUP: ['ycx'] },
  LNG:  { TOP: ['sheer'], JG: ['Croco'], MID: ['BuLLDoG'], ADC: ['1xn'], SUP: ['MISSING'] },
  NIP:  { TOP: ['HOYA'], JG: ['Guwon'], MID: ['Care'], ADC: ['Assum'], SUP: ['zhuo'] },
  OMG:  { TOP: ['Hery'], JG: ['re0', 'Juhan'], MID: ['haichao'], ADC: ['Starry'], SUP: ['Moham'] },
  TES:  { TOP: ['369', 'ZUIAN'], JG: ['naiyou', 'Tian'], MID: ['Creme'], ADC: ['JiaQi', 'JackeyLove'], SUP: ['Fengyue'] },
  TT:   { TOP: ['Keshi'], JG: ['Junhao'], MID: ['Heru'], ADC: ['Ryan3', 'Ahn'], SUP: ['Feather'] },
  UP:   { TOP: ['Liangchen'], JG: ['Grizzly', 'Climber'], MID: ['Saber'], ADC: ['Hena'], SUP: ['Xiaoxia'] },
  WBG:  { TOP: ['zika'], JG: ['jiejie'], MID: ['Xiaohu'], ADC: ['Elk'], SUP: ['erha', 'Hang', 'TheHank'] },
  WE:   { TOP: ['Cube'], JG: ['Monki', 'Tyrion'], MID: ['Karis'], ADC: ['About'], SUP: ['yaoyao'] },
};

// 初始阵容深拷贝：运行时转会/阵容变动都基于它叠加，保证可回退
const BASE_TEAM_ROSTERS = JSON.parse(JSON.stringify(TEAM_ROSTERS));

// 选手 -> 所属战队（反向索引）
const PLAYER_TEAM = {};
SIM_CONFIG.TEAMS.forEach(function(team) {
  const roster = TEAM_ROSTERS[team];
  SIM_CONFIG.POS_LIST.forEach(function(pos) {
    (roster[pos] || []).forEach(function(id) { PLAYER_TEAM[id] = team; });
  });
});

/** 生成 14 队三循环赛程：每队 39 场，共 13 轮 × 3 */
function buildLoLSchedule() {
  const teams = SIM_CONFIG.TEAMS.slice();
  const schedule = [];
  const n = teams.length;
  const arr = teams.slice();
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a === b) continue;
      schedule.push({ round: r, gameNum: i + 1, home: r % 2 === 1 ? b : a, away: r % 2 === 1 ? a : b });
    }
    const last = arr.pop();
    arr.splice(1, 0, last);
  }
  const total = schedule.length;
  for (let i = 0; i < total; i++) {
    const g = schedule[i];
    schedule.push({ round: g.round + (n - 1), gameNum: g.gameNum, home: g.away, away: g.home });
  }
  for (let i = 0; i < total; i++) {
    const g = schedule[i];
    schedule.push({ round: g.round + (n - 1) * 2, gameNum: g.gameNum, home: g.home, away: g.away });
  }
  return schedule;
}

/** 获取某支战队的 5 名首发选手 */
function getTeamPlayers(team) {
  const roster = TEAM_ROSTERS[team] || {};
  const ids = [];
  SIM_CONFIG.POS_LIST.forEach(function(pos) {
    (roster[pos] || []).forEach(function(id) { ids.push(id); });
  });
  return ids.map(function(id) {
    return PLAYERS.find(function(p) { return p.id === id; }) || null;
  }).filter(Boolean);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TEAM_ROSTERS, BASE_TEAM_ROSTERS, PLAYER_TEAM, buildLoLSchedule, getTeamPlayers };
}
