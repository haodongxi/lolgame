/* ============================================================
   完美选手生涯 - 模拟配置模块
   所有可调参数集中在此，方便调整游戏平衡
   属性体系：8 类英雄精通 + 5 项个人能力（共 13 项）
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

  // 每局发牌：每位置刷出 6 个在场英雄，随机禁用 1 个，剩余 5 个供双方选择
  DRAFT: {
    HEROES_PER_POS: 10,  // 英雄池每位置英雄数（共 50）
    DEAL_PER_POS: 6,     // 每位置随机刷出的在场英雄
    BAN_PER_POS: 1,      // 每位置随机禁用数（共 5 ban）
    PICK_PER_POS: 1,     // 每位置双方各选 1 个
  },

  // 各位置属性平均值（用于跨位置衰减）
  // 衰减系数 = min(1.0, 你的位置该属性均值 / 来源位置该属性均值)
  POS_AVG: {
    TOP: { TANK: 79, FIGHTER: 80, AD_ASN: 68, AP_ASN: 69, MAGE: 74, MARK: 74, ENGAGE: 70, ENCH: 66, LANE: 85, MECH: 75, TEAM: 72, ROAM: 55, CLU: 75 },
    JG:  { TANK: 72, FIGHTER: 66, AD_ASN: 79, AP_ASN: 76, MAGE: 69, MARK: 70, ENGAGE: 79, ENCH: 77, LANE: 60, MECH: 81, TEAM: 79, ROAM: 93, CLU: 78 },
    MID: { TANK: 54, FIGHTER: 63, AD_ASN: 87, AP_ASN: 86, MAGE: 85, MARK: 84, ENGAGE: 68, ENCH: 70, LANE: 81, MECH: 89, TEAM: 75, ROAM: 82, CLU: 87 },
    ADC: { TANK: 45, FIGHTER: 61, AD_ASN: 82, AP_ASN: 84, MAGE: 88, MARK: 88, ENGAGE: 50, ENCH: 64, LANE: 80, MECH: 83, TEAM: 85, ROAM: 45, CLU: 85 },
    SUP: { TANK: 78, FIGHTER: 57, AD_ASN: 62, AP_ASN: 59, MAGE: 54, MARK: 56, ENGAGE: 83, ENCH: 88, LANE: 71, MECH: 75, TEAM: 88, ROAM: 80, CLU: 79 },
  },

  ATTR_CN: {
    TANK: '坦克精通', FIGHTER: '战士精通', AD_ASN: '物理刺客', AP_ASN: '法术刺客',
    MAGE: '法师精通', MARK: '射手精通', ENGAGE: '开团硬辅', ENCH: '保护软辅',
    LANE: '对线', MECH: '操作', TEAM: '团战', ROAM: '游走', CLU: '心态',
  },

  ATTR_DESC: {
    TANK: '坦克英雄熟练度：前排承伤与开团',
    FIGHTER: '战士英雄熟练度：近战对拼与单带',
    AD_ASN: '物理刺客熟练度：切入爆发与收割',
    AP_ASN: '法术刺客熟练度：AP 爆发与机动切入',
    MAGE: '法师英雄熟练度：远程炮台与团战输出',
    MARK: '射手英雄熟练度：持续输出与打前排',
    ENGAGE: '开团型辅助熟练度：先手控制与进场',
    ENCH: '保护型辅助熟练度：护盾治疗与保排',
    LANE: '对线压制、换血与补刀发育',
    MECH: '极限操作与微操',
    TEAM: '团战走位与作用',
    ROAM: '游走支援频率与视野意识',
    CLU: '关键局心态与发挥',
  },

  // 13 项能力：前 8 项为英雄类别精通，后 5 项为个人能力
  ATTR_LIST: ['TANK','FIGHTER','AD_ASN','AP_ASN','MAGE','MARK','ENGAGE','ENCH','LANE','MECH','TEAM','ROAM','CLU'],
  MASTERY_KEYS: ['TANK','FIGHTER','AD_ASN','AP_ASN','MAGE','MARK','ENGAGE','ENCH'],
  PERSONAL_KEYS: ['LANE','MECH','TEAM','ROAM','CLU'],

  CLS_CN: {
    TANK: '坦克', FIGHTER: '战士', AD_ASN: '物理刺客', AP_ASN: '法术刺客',
    MAGE: '法师', MARK: '射手', ENGAGE: '开团硬辅', ENCH: '保护软辅',
  },
  CLS_ICON: {
    TANK: '🛡️', FIGHTER: '⚔️', AD_ASN: '🗡️', AP_ASN: '✨',
    MAGE: '🔮', MARK: '🏹', ENGAGE: '⛓️', ENCH: '💚',
  },

  // 类别克制：A 克制 B 时，对位战力 +4（刺客克后排、坦克克刺客……）
  CLS_COUNTER: {
    TANK:    ['AD_ASN', 'AP_ASN'],
    FIGHTER: ['TANK', 'MARK'],
    AD_ASN:  ['MAGE', 'MARK'],
    AP_ASN:  ['MAGE', 'MARK'],
    MAGE:    ['FIGHTER', 'ENGAGE'],
    MARK:    ['TANK', 'FIGHTER'],
    ENGAGE:  ['MAGE', 'ENCH'],
    ENCH:    ['AD_ASN', 'AP_ASN'],
  },

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

  // 总评权重：精通决定你能把哪类英雄玩好，个人能力决定下限
  OVR_WEIGHTS: {
    TOP: { TANK: 0.15, FIGHTER: 0.15, AD_ASN: 0, AP_ASN: 0, MAGE: 0.02, MARK: 0, ENGAGE: 0.02, ENCH: 0, LANE: 0.20, MECH: 0.13, TEAM: 0.13, ROAM: 0.07, CLU: 0.13 },
    JG:  { TANK: 0.06, FIGHTER: 0.08, AD_ASN: 0.14, AP_ASN: 0.12, MAGE: 0.03, MARK: 0.02, ENGAGE: 0.10, ENCH: 0, LANE: 0, MECH: 0.12, TEAM: 0.08, ROAM: 0.18, CLU: 0.07 },
    MID: { TANK: 0.03, FIGHTER: 0.03, AD_ASN: 0.09, AP_ASN: 0.16, MAGE: 0.17, MARK: 0, ENGAGE: 0, ENCH: 0, LANE: 0.14, MECH: 0.14, TEAM: 0.06, ROAM: 0.08, CLU: 0.10 },
    ADC: { TANK: 0, FIGHTER: 0, AD_ASN: 0.02, AP_ASN: 0.02, MAGE: 0.02, MARK: 0.30, ENGAGE: 0, ENCH: 0, LANE: 0.20, MECH: 0.14, TEAM: 0.12, ROAM: 0.04, CLU: 0.14 },
    SUP: { TANK: 0.04, FIGHTER: 0, AD_ASN: 0.03, AP_ASN: 0, MAGE: 0.03, MARK: 0, ENGAGE: 0.20, ENCH: 0.16, LANE: 0.06, MECH: 0.06, TEAM: 0.16, ROAM: 0.14, CLU: 0.12 },
  },

  SEASON: {
    GAMES: 18,             // 每队常规赛场数（10队双循环）
    PLAYOFF_TEAMS: 6,      // 前6进季后赛（1-2 直通半决赛，3-6 打八强）
    SERIES_WIN_REQUIRED: 3, // 季后赛 BO5
  },

  // 战队实力维度：由“英雄类别精通 × 本局英雄”融合后的属性向量计算
  TEAM_POWER: {
    offense:  { AD_ASN: 0.12, AP_ASN: 0.12, MAGE: 0.10, MARK: 0.14, FIGHTER: 0.06, LANE: 0.12, MECH: 0.16, TEAM: 0.08, ROAM: 0.06, TANK: 0.02, ENGAGE: 0.02 },
    defense:  { TANK: 0.22, ENGAGE: 0.14, ENCH: 0.12, FIGHTER: 0.08, TEAM: 0.18, LANE: 0.08, CLU: 0.10, ROAM: 0.08 },
    macro:    { ROAM: 0.24, ENGAGE: 0.12, TEAM: 0.16, LANE: 0.10, MECH: 0.10, CLU: 0.12, TANK: 0.06, ENCH: 0.10 },
    clutch:   { CLU: 0.30, MECH: 0.20, TEAM: 0.16, AP_ASN: 0.10, AD_ASN: 0.08, MARK: 0.10, FIGHTER: 0.06 },
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
