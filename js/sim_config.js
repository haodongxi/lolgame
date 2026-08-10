/* ============================================================
   完美选手生涯 - 模拟配置模块
   所有可调参数集中在此，方便调整游戏平衡
   Created by haodongsheng
   ============================================================ */
const SIM_CONFIG = {
  BUILD: {
    TOTAL_ATTRS: 13,
    REROLLS: 3,          // 建选手阶段全局换人次数
    ROSTER_SHOW_MAX: 3,  // 每队展示的英雄数量
    ATTR_MIN: 25,
    ATTR_MAX: 99,
  },

  // 各位置属性平均值（用于跨位置衰减）
  // 衰减系数 = min(1.0, 你的位置该属性均值 / 来源位置该属性均值)
  POS_AVG: {
    TOP: { LANE: 85, MECH: 75, TEAM: 72, DPS: 70, BURST: 65, TANK: 85, CC: 70, ROAM: 55, VISION: 50, FARM: 80, MOB: 60, CLU: 75, SPLIT: 85 },
    JG:  { LANE: 60, MECH: 80, TEAM: 78, DPS: 65, BURST: 75, TANK: 65, CC: 80, ROAM: 92, VISION: 80, FARM: 65, MOB: 88, CLU: 78, SPLIT: 55 },
    MID: { LANE: 82, MECH: 90, TEAM: 75, DPS: 85, BURST: 88, TANK: 40, CC: 72, ROAM: 82, VISION: 60, FARM: 82, MOB: 85, CLU: 88, SPLIT: 55 },
    ADC: { LANE: 80, MECH: 82, TEAM: 85, DPS: 95, BURST: 80, TANK: 30, CC: 45, ROAM: 45, VISION: 50, FARM: 92, MOB: 78, CLU: 85, SPLIT: 50 },
    SUP: { LANE: 72, MECH: 75, TEAM: 88, DPS: 45, BURST: 55, TANK: 70, CC: 90, ROAM: 80, VISION: 95, FARM: 45, MOB: 72, CLU: 80, SPLIT: 35 },
  },

  ATTR_CN: {
    LANE: '对线', MECH: '操作', TEAM: '团战', DPS: '输出', BURST: '爆发',
    TANK: '坦度', CC: '控制', ROAM: '游走', VISION: '视野', FARM: '补刀',
    MOB: '机动', CLU: '关键', SPLIT: '带线',
  },

  ATTR_DESC: {
    LANE: '对线压制与换血能力', MECH: '极限操作与微操', TEAM: '团战走位与作用',
    DPS: '持续输出能力', BURST: '爆发秒人能力', TANK: '承伤与抗压',
    CC: '控制技能命中率', ROAM: '游走支援频率', VISION: '视野布控',
    FARM: '补刀与发育', MOB: '机动性与位移', CLU: '关键局大心脏', SPLIT: '单带牵扯',
  },

  ATTR_LIST: ['LANE','MECH','TEAM','DPS','BURST','TANK','CC','ROAM','VISION','FARM','MOB','CLU','SPLIT'],

  GRADE: {
    getGrade(val) {
      if (val >= 95) return { letter: 'A+', color: '#ff6b6b' };
      if (val >= 90) return { letter: 'A', color: '#ff8787' };
      if (val >= 85) return { letter: 'A-', color: '#ffa07a' };
      if (val >= 80) return { letter: 'B+', color: '#ffd43b' };
      if (val >= 75) return { letter: 'B', color: '#ffd43b' };
      if (val >= 70) return { letter: 'B-', color: '#ffd43b' };
      if (val >= 65) return { letter: 'C+', color: '#69db7c' };
      if (val >= 60) return { letter: 'C', color: '#69db7c' };
      if (val >= 55) return { letter: 'C-', color: '#69db7c' };
      if (val >= 50) return { letter: 'D+', color: '#74c0fc' };
      if (val >= 45) return { letter: 'D', color: '#74c0fc' };
      if (val >= 40) return { letter: 'D-', color: '#74c0fc' };
      return { letter: 'F', color: '#868e96' };
    },
    getOvrGrade(ovr) {
      if (ovr >= 95) return '神级选手';
      if (ovr >= 85) return '顶级选手';
      if (ovr >= 75) return '一线选手';
      if (ovr >= 65) return '轮换选手';
      return '青训选手';
    },
  },

  POSITIONS: { TOP: '上单', JG: '打野', MID: '中单', ADC: '下路', SUP: '辅助' },
  POS_LIST: ['TOP', 'JG', 'MID', 'ADC', 'SUP'],
  POS_ICONS: { TOP: '🛡️', JG: '🗡️', MID: '⭐', ADC: '🎯', SUP: '🛟' },

  OVR_WEIGHTS: {
    TOP: { LANE: 0.12, MECH: 0.08, TEAM: 0.08, DPS: 0.06, BURST: 0.04, TANK: 0.14, CC: 0.06, ROAM: 0.04, VISION: 0.04, FARM: 0.08, MOB: 0.06, CLU: 0.08, SPLIT: 0.12 },
    JG:  { LANE: 0.04, MECH: 0.10, TEAM: 0.10, DPS: 0.06, BURST: 0.08, TANK: 0.08, CC: 0.12, ROAM: 0.14, VISION: 0.10, FARM: 0.04, MOB: 0.10, CLU: 0.08, SPLIT: 0.02 },
    MID: { LANE: 0.10, MECH: 0.14, TEAM: 0.08, DPS: 0.12, BURST: 0.12, TANK: 0.02, CC: 0.06, ROAM: 0.08, VISION: 0.04, FARM: 0.06, MOB: 0.08, CLU: 0.10, SPLIT: 0.02 },
    ADC: { LANE: 0.08, MECH: 0.10, TEAM: 0.10, DPS: 0.18, BURST: 0.10, TANK: 0.02, CC: 0.04, ROAM: 0.02, VISION: 0.04, FARM: 0.12, MOB: 0.08, CLU: 0.10, SPLIT: 0.02 },
    SUP: { LANE: 0.06, MECH: 0.08, TEAM: 0.14, DPS: 0.02, BURST: 0.04, TANK: 0.10, CC: 0.16, ROAM: 0.10, VISION: 0.16, FARM: 0.02, MOB: 0.06, CLU: 0.10, SPLIT: 0.02 },
  },

  SEASON: {
    GAMES: 18,             // 每队常规赛场数（10队双循环）
    PLAYOFF_TEAMS: 6,      // 前6进季后赛（1-2 直通半决赛，3-6 打八强）
    SERIES_WIN_REQUIRED: 3, // 季后赛 BO5
  },

  // 战队实力维度
  TEAM_POWER: {
    offense:  { DPS: 0.20, BURST: 0.15, LANE: 0.15, FARM: 0.10, MECH: 0.15, TEAM: 0.15, MOB: 0.10 },
    defense:  { TANK: 0.25, CC: 0.20, VISION: 0.20, TEAM: 0.20, MOB: 0.15 },
    macro:    { ROAM: 0.25, VISION: 0.25, SPLIT: 0.15, TEAM: 0.20, CLU: 0.15 },
    clutch:   { CLU: 0.40, BURST: 0.20, MECH: 0.20, TEAM: 0.20 },
    depth:    {},
  },

  // 个人数据生成系数
  PLAYER_STATS: {
    USAGE: { TOP: 0.16, JG: 0.18, MID: 0.22, ADC: 0.20, SUP: 0.14 },
    POS_SCALE: {
      TOP: { kills: 1.0, deaths: 1.1, assists: 0.6, cs: 1.0, dmg: 0.9, vision: 0.8 },
      JG:  { kills: 1.0, deaths: 1.0, assists: 1.0, cs: 0.7, dmg: 0.7, vision: 1.0 },
      MID: { kills: 1.1, deaths: 0.9, assists: 0.8, cs: 1.0, dmg: 1.15, vision: 0.7 },
      ADC: { kills: 1.2, deaths: 1.0, assists: 0.5, cs: 1.15, dmg: 1.3, vision: 0.6 },
      SUP: { kills: 0.5, deaths: 1.2, assists: 1.5, cs: 0.35, dmg: 0.4, vision: 1.5 },
    },
  },

  AWARDS: {
    ALL_TEAM_COUNTS: { first: 1, second: 2, third: 2 }, // 每位置一阵1人、二阵2人、三阵2人
  },

  TEAM_NAMES: {
    AL: 'AL', BLG: 'BLG', EDG: 'EDG', IG: 'IG', JDG: 'JDG', LGD: 'LGD',
    LNG: 'LNG', NIP: 'NIP', OMG: 'OMG', TES: 'TES', TT: 'TT', UP: 'UP',
    WBG: 'WBG', WE: 'WE',
  },
  TEAM_CN: {
    AL: 'AL', BLG: '哔哩哔哩', EDG: 'EDG', IG: 'IG', JDG: '京东', LGD: 'LGD',
    LNG: '李宁', NIP: 'NIP', OMG: 'OMG', TES: '滔搏', TT: 'TT', UP: 'UP',
    WBG: '微博', WE: 'WE',
  },
  TEAM_ABBR: { AL: 'AL', BLG: 'BLG', EDG: 'EDG', IG: 'IG', JDG: 'JDG', LGD: 'LGD', LNG: 'LNG', NIP: 'NIP', OMG: 'OMG', TES: 'TES', TT: 'TT', UP: 'UP', WBG: 'WBG', WE: 'WE' },
  TEAMS: ['AL', 'BLG', 'EDG', 'IG', 'JDG', 'LGD', 'LNG', 'NIP', 'OMG', 'TES', 'TT', 'UP', 'WBG', 'WE'],
};

if (typeof module !== 'undefined' && module.exports) module.exports = SIM_CONFIG;
