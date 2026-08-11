/* 用 rft.gg LPL 2026 真实统计生成 players.js（Split 1 首发 + Split 2 替补）
   数据源: https://rft.gg/event/lpl-2026-split-1/players
           https://rft.gg/event/lpl-2026-split-2/players
   Created by haodongsheng
   用法: node test/gen_players.js <rftS1Json> <rftS2Json> <outPlayersJs> */
const fs = require('fs');
const dataS1 = JSON.parse(fs.readFileSync(process.argv[2] || '/tmp/rft_stats.json', 'utf8'));
const dataS2 = JSON.parse(fs.readFileSync(process.argv[3] || '/tmp/rft_stats_s2.json', 'utf8'));
const OUT = process.argv[4] || '/Users/haodongsheng/Documents/github/guessMoney/lol-career/js/players.js';

const SIM_CONFIG = require('/Users/haodongsheng/Documents/github/guessMoney/lol-career/js/sim_config.js');
const ATTR_LIST = SIM_CONFIG.ATTR_LIST;
const OVR_WEIGHTS = SIM_CONFIG.OVR_WEIGHTS;
const POS_AVG = SIM_CONFIG.POS_AVG;

// 旧版属性映射到新版前，先用旧版位置均值归一化
const OLD_POS_AVG = {
  TOP: { LANE: 85, MECH: 75, TEAM: 72, DPS: 70, BURST: 65, TANK: 85, CC: 70, ROAM: 55, VISION: 50, FARM: 80, MOB: 60, CLU: 75, SPLIT: 85 },
  JG:  { LANE: 60, MECH: 80, TEAM: 78, DPS: 65, BURST: 75, TANK: 65, CC: 80, ROAM: 92, VISION: 80, FARM: 65, MOB: 88, CLU: 78, SPLIT: 55 },
  MID: { LANE: 82, MECH: 90, TEAM: 75, DPS: 85, BURST: 88, TANK: 40, CC: 72, ROAM: 82, VISION: 60, FARM: 82, MOB: 85, CLU: 88, SPLIT: 55 },
  ADC: { LANE: 80, MECH: 82, TEAM: 85, DPS: 95, BURST: 80, TANK: 30, CC: 45, ROAM: 45, VISION: 50, FARM: 92, MOB: 78, CLU: 85, SPLIT: 50 },
  SUP: { LANE: 72, MECH: 75, TEAM: 88, DPS: 45, BURST: 55, TANK: 70, CC: 90, ROAM: 80, VISION: 95, FARM: 45, MOB: 72, CLU: 80, SPLIT: 35 },
};

// 旧版 13 项属性 → 新版 8 精通 + 5 个人能力的映射
function mapToNewAttrs(o) {
  const clamp = function(v) { return Math.max(25, Math.min(99, Math.round(v))); };
  return {
    TANK:   clamp(o.TANK * 0.55 + o.CC * 0.25 + o.TEAM * 0.20),
    FIGHTER: clamp(o.TANK * 0.35 + o.DPS * 0.25 + o.MECH * 0.20 + o.SPLIT * 0.20),
    AD_ASN: clamp(o.BURST * 0.45 + o.MECH * 0.25 + o.MOB * 0.20 + o.DPS * 0.10),
    AP_ASN: clamp(o.BURST * 0.35 + o.DPS * 0.20 + o.MECH * 0.20 + o.MOB * 0.15 + o.FARM * 0.10),
    MAGE:   clamp(o.DPS * 0.35 + o.BURST * 0.20 + o.FARM * 0.20 + o.MECH * 0.15 + o.LANE * 0.10),
    MARK:   clamp(o.DPS * 0.40 + o.FARM * 0.20 + o.MECH * 0.20 + o.MOB * 0.10 + o.LANE * 0.10),
    ENGAGE: clamp(o.CC * 0.40 + o.TANK * 0.20 + o.TEAM * 0.20 + o.ROAM * 0.20),
    ENCH:   clamp(o.VISION * 0.35 + o.TEAM * 0.30 + o.CC * 0.20 + o.LANE * 0.15),
    LANE:   clamp(o.LANE),
    MECH:   clamp(o.MECH),
    TEAM:   clamp(o.TEAM),
    ROAM:   clamp(o.ROAM),
    CLU:    clamp(o.CLU),
  };
}

// 2026 LPL 14 队首发（Split 1 实际出场阵容）
const ROSTER = {
  AL:   { TOP: 'Flandre', JG: 'Tarzan', MID: 'Shanks', ADC: 'Hope', SUP: 'Kael' },
  BLG:  { TOP: 'Bin', JG: 'Xun', MID: 'Knight', ADC: 'Viper', SUP: 'ON' },
  EDG:  { TOP: 'Zdz', JG: 'Xiaohao', MID: 'Angel', ADC: 'Leave', SUP: 'Parukia' },
  IG:   { TOP: 'Soboro', JG: 'Wei', MID: 'Rookie', ADC: 'Photic', SUP: 'Jwei' },
  JDG:  { TOP: 'Xiaoxu', JG: 'Junjia', MID: 'HongQ', ADC: 'GALA', SUP: 'Vampire' },
  LGD:  { TOP: 'sasi', JG: 'Heng', MID: 'Tangyuan', ADC: 'Shaoye', SUP: 'ycx' },
  LNG:  { TOP: 'sheer', JG: 'Croco', MID: 'BuLLDoG', ADC: '1xn', SUP: 'MISSING' },
  NIP:  { TOP: 'HOYA', JG: 'Guwon', MID: 'Care', ADC: 'Assum', SUP: 'zhuo' },
  OMG:  { TOP: 'Hery', JG: 're0', MID: 'haichao', ADC: 'Starry', SUP: 'Moham' },
  TES:  { TOP: '369', JG: 'naiyou', MID: 'Creme', ADC: 'JiaQi', SUP: 'Fengyue' },
  TT:   { TOP: 'Keshi', JG: 'Junhao', MID: 'Heru', ADC: 'Ryan3', SUP: 'Feather' },
  UP:   { TOP: 'Liangchen', JG: 'Grizzly', MID: 'Saber', ADC: 'Hena', SUP: 'Xiaoxia' },
  WBG:  { TOP: 'zika', JG: 'jiejie', MID: 'Xiaohu', ADC: 'Elk', SUP: 'erha' },
  WE:   { TOP: 'Cube', JG: 'Monki', MID: 'Karis', ADC: 'About', SUP: 'yaoyao' },
};

// 替补（Split 2 出场的新面孔/回归选手），归属出场更多的队伍
const BENCH = {
  IG:  ['Breathe', 'Meiko', 'Renard', 'Nia'],
  TES: ['JackeyLove', 'Tian', 'ZUIAN'],
  WBG: ['Hang', 'TheHank'],
  EDG: ['Sinian'],
  LGD: ['Burdol'],
  OMG: ['Juhan'],
  TT:  ['Ahn'],
  UP:  ['Climber'],
  WE:  ['Tyrion'],
};

// 风格标签
const TAGS = {
  Flandre: '老将上单', Tarzan: '野区大脑', Shanks: '全能中单', Hope: '稳健大核', Kael: '指挥辅助',
  Bin: '世界级上单', Xun: '节奏打野', Knight: '国产第一中单', Viper: '韩援大核', ON: '操作型辅助',
  Zdz: '对线凶悍', Xiaohao: '新生打野', Angel: '老牌中单', Leave: '激进射手', Parukia: '最佳新秀辅助',
  Soboro: '韩援新星', Wei: '节奏大师', Rookie: '传奇老将', Photic: '稳健输出', Jwei: '团队辅助',
  Xiaoxu: '天赋新星', Junjia: '稳定打野', HongQ: '操作新星', GALA: '团战AD', Vampire: '团队大脑',
  sasi: '抗压上单', Heng: '新人打野', Tangyuan: '进攻中单', Shaoye: '输出射手', ycx: '稳定辅助',
  sheer: '新生代上单', Croco: '韩援打野', BuLLDoG: '韩援新秀', '1xn': '新生代射手', MISSING: '回归老将',
  HOYA: '韩援抗压', Guwon: '韩援新人', Care: '操作型中单', Assum: '对线强势', zhuo: '节奏辅助',
  Hery: '战士上单', re0: '新人打野', haichao: '全面中单', Starry: '输出核心', Moham: '韩援辅助',
  '369': '全能上单', naiyou: '新生代打野', Creme: '刺客中单', JiaQi: '输出射手', Fengyue: '游走辅助',
  Keshi: '新人上单', Junhao: '新人打野', Heru: '进攻中单', Ryan3: '新人射手', Feather: '稳定辅助',
  Liangchen: '新人上单', Grizzly: '韩援新人', Saber: '老练中单', Hena: '韩援射手', Xiaoxia: '新人辅助',
  zika: '全能上单', jiejie: '冠军打野', Xiaohu: '传奇中单', Elk: '全能射手', erha: '团队辅助',
  Cube: '老将上单', Monki: '新人打野', Karis: '韩援中单', About: '韩援射手', yaoyao: '老将辅助',
  Breathe: '顶级上单', Meiko: '传奇辅助', Renard: '轮换中单', Nia: '新人中单',
  JackeyLove: '传奇射手', Tian: '冠军打野', ZUIAN: '新人上单', Hang: '游走辅助',
  TheHank: '新人辅助', Sinian: '新人中单', Burdol: '韩援上单', Juhan: '韩援打野',
  Ahn: '老将射手', Climber: '新人打野', Tyrion: '新人打野',
};

const ROLE_MAP = { TOP: 'TOP', JUNGLE: 'JG', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUP' };

function norm(name) { return String(name).toLowerCase().replace(/[^a-z0-9]/g, ''); }
const byNameS1 = {};
dataS1.stats.forEach(function(p) { byNameS1[norm(p.playerName)] = p; });
const byNameS2 = {};
dataS2.stats.forEach(function(p) { byNameS2[norm(p.playerName)] = p; });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(v))); }

function collectRaw(pool) {
  const raw = {};
  pool.forEach(function(p) {
    const role = ROLE_MAP[p.role];
    if (!raw[role]) raw[role] = {};
    const m = raw[role];
    const invDeath = 1 / (p.deaths + 1);
    (m.cs = m.cs || []).push(p.csPerMinute);
    (m.kda = m.kda || []).push(p.kda);
    (m.kills = m.kills || []).push(p.kills);
    (m.deaths = m.deaths || []).push(p.deaths);
    (m.assists = m.assists || []).push(p.assists);
    (m.dpm = m.dpm || []).push(p.damagePerMinute);
    (m.kp = m.kp || []).push(p.killParticipation);
    (m.wr = m.wr || []).push(p.winRate);
    (m.rating = m.rating || []).push(p.rftRating);
    (m.pool = m.pool || []).push(p.championPool);
    (m.invDeath = m.invDeath || []).push(invDeath);
  });
  return raw;
}
const rawS1 = collectRaw(dataS1.stats);
const rawS2 = collectRaw(dataS2.stats);

function zscore(arr, v) {
  const n = arr.length;
  const mean = arr.reduce(function(a, b) { return a + b; }, 0) / n;
  const sd = Math.sqrt(arr.reduce(function(a, b) { return a + (b - mean) * (b - mean); }, 0) / n) || 1;
  return (v - mean) / sd;
}

function makeAttr(base, arr, v) { return clamp(base + zscore(arr, v) * 6.5, 25, 99); }

function buildPlayer(id, pos, byName, raw) {
  const p = byName[norm(id)];
  if (!p) throw new Error('未找到选手统计: ' + id);
  const r = raw[pos];
  const invDeath = 1 / (p.deaths + 1);
  const oldAttrs = {
    LANE:   makeAttr(OLD_POS_AVG[pos].LANE,   r.cs,   p.csPerMinute) * 0.6 +
            makeAttr(OLD_POS_AVG[pos].LANE,   r.kda,  p.kda) * 0.4,
    MECH:   makeAttr(OLD_POS_AVG[pos].MECH,   r.rating, p.rftRating) * 0.5 +
            makeAttr(OLD_POS_AVG[pos].MECH,   r.kills, p.kills) * 0.3 +
            makeAttr(OLD_POS_AVG[pos].MECH,   r.dpm,  p.damagePerMinute) * 0.2,
    TEAM:   makeAttr(OLD_POS_AVG[pos].TEAM,   r.kp,   p.killParticipation) * 0.4 +
            makeAttr(OLD_POS_AVG[pos].TEAM,   r.wr,   p.winRate) * 0.3 +
            makeAttr(OLD_POS_AVG[pos].TEAM,   r.assists, p.assists) * 0.3,
    DPS:    makeAttr(OLD_POS_AVG[pos].DPS,    r.dpm,  p.damagePerMinute),
    BURST:  makeAttr(OLD_POS_AVG[pos].BURST,  r.kills, p.kills) * 0.6 +
            makeAttr(OLD_POS_AVG[pos].BURST,  r.dpm,  p.damagePerMinute) * 0.4,
    TANK:   makeAttr(OLD_POS_AVG[pos].TANK,   r.invDeath, invDeath) * 0.6 +
            makeAttr(OLD_POS_AVG[pos].TANK,   r.wr,   p.winRate) * 0.4,
    CC:     makeAttr(OLD_POS_AVG[pos].CC,     r.assists, p.assists) * 0.7 +
            makeAttr(OLD_POS_AVG[pos].CC,     r.kp,   p.killParticipation) * 0.3,
    ROAM:   makeAttr(OLD_POS_AVG[pos].ROAM,   r.kp,   p.killParticipation) * 0.5 +
            makeAttr(OLD_POS_AVG[pos].ROAM,   r.assists, p.assists) * 0.5,
    VISION: makeAttr(OLD_POS_AVG[pos].VISION, r.assists, p.assists) * 0.6 +
            makeAttr(OLD_POS_AVG[pos].VISION, r.kp,   p.killParticipation) * 0.4,
    FARM:   makeAttr(OLD_POS_AVG[pos].FARM,   r.cs,   p.csPerMinute),
    MOB:    makeAttr(OLD_POS_AVG[pos].MOB,    r.kills, p.kills) * 0.5 +
            makeAttr(OLD_POS_AVG[pos].MOB,    r.invDeath, invDeath) * 0.5,
    CLU:    makeAttr(OLD_POS_AVG[pos].CLU,    r.rating, p.rftRating) * 0.5 +
            makeAttr(OLD_POS_AVG[pos].CLU,    r.kda,  p.kda) * 0.2 +
            makeAttr(OLD_POS_AVG[pos].CLU,    r.wr,   p.winRate) * 0.3,
    SPLIT:  makeAttr(OLD_POS_AVG[pos].SPLIT,  r.cs,   p.csPerMinute) * 0.6 +
            makeAttr(OLD_POS_AVG[pos].SPLIT,  r.kills, p.kills) * 0.4,
  };
  const attrs = mapToNewAttrs(oldAttrs);
  ATTR_LIST.forEach(function(k) { attrs[k] = clamp(attrs[k], 25, 99); });
  let ovr = 0;
  ATTR_LIST.forEach(function(k) { ovr += attrs[k] * (OVR_WEIGHTS[pos][k] || 0.07); });
  const anchored = ovr * 0.7 + (50 + p.rftRating * 0.55) * 0.3;
  return { id: id, pos: pos, t: TAGS[id] || '职业选手', ovr: Math.round(anchored), attrs: attrs, raw: p };
}

const players = [];
SIM_CONFIG.TEAMS.forEach(function(team) {
  SIM_CONFIG.POS_LIST.forEach(function(pos) {
    players.push(buildPlayer(ROSTER[team][pos], pos, byNameS1, rawS1));
  });
  (BENCH[team] || []).forEach(function(id) {
    const s2 = byNameS2[norm(id)];
    if (!s2) throw new Error('替补未找到 Split 2 统计: ' + id);
    players.push(buildPlayer(id, ROLE_MAP[s2.role], byNameS2, rawS2));
  });
});

const lines = [];
lines.push('/* ============================================================');
lines.push('   选手数据：2026 LPL 14 支战队阵容（Split 1 首发 + Split 2 替补）');
lines.push('   数据源: rft.gg LPL 2026 Split 1 / Split 2 选手统计');
lines.push('   （KDA/DPM/CSM/参团率/胜率/综合评分，属性按位置归一化后映射为 8 精通 + 5 个人能力）');
lines.push('   Created by haodongsheng');
lines.push('   ============================================================ */');
lines.push('const PLAYERS = [');
players.forEach(function(p, i) {
  const attrStr = ATTR_LIST.map(function(k) { return k + ': ' + p.attrs[k]; }).join(', ');
  lines.push('  { id: \'' + p.id + '\', pos: \'' + p.pos + '\', t: \'' + p.t + '\', ovr: ' + p.ovr + ', ' + attrStr + ' }' + (i < players.length - 1 ? ',' : ''));
});
lines.push('];');
lines.push('');
lines.push('if (typeof module !== \'undefined\' && module.exports) module.exports = PLAYERS;');
fs.writeFileSync(OUT, lines.join('\n') + '\n');

console.log('players:', players.length);
console.log('OVR min/max:', Math.min.apply(null, players.map(function(p) { return p.ovr; })), '/', Math.max.apply(null, players.map(function(p) { return p.ovr; })));
