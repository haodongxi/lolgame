/* ============================================================
   完美选手生涯 - 核心游戏逻辑（英雄联盟版 MVP）
   Created by haodongsheng
   ============================================================ */

// ==================== 游戏状态 ====================
const SAVE_KEY = 'lol_career_save_v1';

const STATE = {
  mode: null,
  position: null,
  attrs: {},
  attrSlots: {},
  lockedCount: 0,
  usedChamps: [],
  _mustLockAfterSpin: false,
  buildStep: 'select',
  currentTeam: null,
  currentRoster: [],
  _shownThisTeam: [],
  _rerollsLeft: 3,
  _teamsVisited: [],
  selectedChamp: null,
  _locking: false,
  _pendingStrategy: null,
  finalOVR: 0,
  finalPosition: null,
  finalArchetype: null,
  similarChamps: [],
  careerTeam: null,
  gameId: null,
  season: null,
  career: null,
};

function createFreshCareer() {
  return {
    seasonCount: 0,
    currentAge: 16,
    seasons: [],
    totalStats: { kills: 0, deaths: 0, assists: 0, cs: 0, dmg: 0, vision: 0, games: 0 },
    honors: [],       // { season, type, label, team }
    championships: [], // { season, team, fmvp, record }
    seasonHistory: [],
    transferHistory: [],  // { season, type, text }
    rosterOverride: null, // { 队伍: { 位置: [选手id...] } }
    achievements: [],     // 已解锁成就 [{ id, label, emoji, season }]
    profile: { fame: 0, popularity: 0, businessValue: 0, legacy: 0 }, // 声望/人气/身价/遗产
    retired: false,
    finalSummary: null,   // 退役结算
  };
}

function createFreshSeason() {
  return {
    round: 0,
    wins: 0, losses: 0,
    series: [],
    stats: { kills: 0, deaths: 0, assists: 0, cs: 0, dmg: 0, vision: 0, games: 0 },
    playoffStats: { kills: 0, deaths: 0, assists: 0, cs: 0, dmg: 0, vision: 0, games: 0 },
    bestSeries: null,   // 赛季最佳表现
    standings: {},
    schedule: [],
    isPlayoffs: false,
    playoffBracket: null,
    playoffResult: null,
    awards: [],
    champion: null,
    fmvp: null,
    events: {
      storyTimeline: [],
      injuryGamesLeft: 0,
      suspensionGamesLeft: 0,
      injuryReason: null,
      suspensionReason: null,
      lastTriggerGameNum: null,
      playoffEventCount: 0,
    },
  };
}

// ==================== UI 工具 ====================
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function showScreen(id) {
  $$('.screen').forEach(function(s) { s.classList.remove('active'); });
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}
function html(id, content) {
  const el = document.getElementById(id);
  if (el && content !== undefined) el.innerHTML = content;
  return el;
}
function trackEvent() { /* MVP 无埋点后端 */ }
function getSeasonLabel(seasonNum) {
  const n = Math.max(1, parseInt(seasonNum) || 1);
  return '第' + n + '赛季';
}
function getTeamName(team) { return SIM_CONFIG.TEAM_NAMES[team] || team; }
function getPosName(pos) { return SIM_CONFIG.POSITIONS[pos] || pos; }
function getDisplayName() { return '我的选手'; }

// ==================== 属性工具 ====================
const ATTR_KEYS = SIM_CONFIG.ATTR_LIST;
function attrCN(key) { return SIM_CONFIG.ATTR_CN[key] || key; }
function attrDesc(key) { return SIM_CONFIG.ATTR_DESC[key] || ''; }
function getGrade(val) { return SIM_CONFIG.GRADE.getGrade(val); }
function getOvrGrade(ovr) { return SIM_CONFIG.GRADE.getOvrGrade(ovr); }
function getMainPos(ch) {
  const pos = String(ch.pos || 'MID').split('/')[0].trim();
  return SIM_CONFIG.POS_LIST.indexOf(pos) >= 0 ? pos : 'MID';
}
function getPosPenalty(userPos, srcPos, attrKey) {
  const srcAvg = SIM_CONFIG.POS_AVG[srcPos] && SIM_CONFIG.POS_AVG[srcPos][attrKey];
  const userAvg = SIM_CONFIG.POS_AVG[userPos] && SIM_CONFIG.POS_AVG[userPos][attrKey];
  if (!srcAvg || srcAvg <= 0) return 1.0;
  return Math.min(1.0, userAvg / srcAvg);
}

// ==================== 存档 ====================
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(STATE));
  } catch (e) {}
}
function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.gameId) return false;
    Object.keys(STATE).forEach(function(k) { delete STATE[k]; });
    Object.assign(STATE, data);
    return true;
  } catch (e) { return false; }
}
function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

function initGame() {
  Object.assign(STATE, {
    mode: null, position: null,
    attrs: {}, attrSlots: {}, lockedCount: 0,
    usedChamps: [], _mustLockAfterSpin: false,
    buildStep: 'select', currentTeam: null, currentRoster: [],
    _shownThisTeam: [], _rerollsLeft: 3, _teamsVisited: [],
    selectedChamp: null, _locking: false,
    _pendingStrategy: null,
    finalOVR: 0, finalPosition: null, finalArchetype: null,
    similarChamps: [], careerTeam: null,
    gameId: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    season: createFreshSeason(),
    career: createFreshCareer(),
  });
  ATTR_KEYS.forEach(function(k) { STATE.attrs[k] = null; STATE.attrSlots[k] = null; });
  resetRosters();
  clearSave();
  showScreen('screen-menu');
  renderModeSelect();
}

function resetRosters() {
  Object.keys(TEAM_ROSTERS).forEach(function(t) { delete TEAM_ROSTERS[t]; });
  Object.assign(TEAM_ROSTERS, JSON.parse(JSON.stringify(BASE_TEAM_ROSTERS)));
}

function boot() {
  const saved = loadGame();
  normalizeState();
  showScreen('screen-menu');
  renderModeSelect();
  if (saved) {
    const btn = document.getElementById('continue-btn');
    if (btn) btn.style.display = '';
  }
}

/** 状态兜底：确保 13 项属性槽都有明确的 null 值，防止空对象被误判为已锁定 */
function normalizeState() {
  ATTR_KEYS.forEach(function(k) {
    if (!(k in STATE.attrs) || STATE.attrs[k] === undefined) STATE.attrs[k] = null;
    if (!(k in STATE.attrSlots) || STATE.attrSlots[k] === undefined) STATE.attrSlots[k] = null;
  });
  if (!STATE.season) STATE.season = createFreshSeason();
  if (!STATE.career) STATE.career = createFreshCareer();
  // —— career 子对象全面兜底（兼容任何旧档） ——
  const c = STATE.career;
  if (!c.seasonHistory) c.seasonHistory = [];
  if (!c.honors) c.honors = [];
  if (!c.championships) c.championships = [];
  if (!c.totalStats) c.totalStats = { kills: 0, deaths: 0, assists: 0, cs: 0, dmg: 0, vision: 0, games: 0 };
  if (!c.transferHistory) c.transferHistory = [];
  if (!c.rosterOverride) c.rosterOverride = null;
  if (!c.achievements) c.achievements = [];
  if (!c.profile) c.profile = { fame: 0, popularity: 0, businessValue: 0, legacy: 0 };
  if (c.retired === undefined) c.retired = false;
  if (c.finalSummary === undefined) c.finalSummary = null;
  if (c.seasonCount === undefined) c.seasonCount = 0;
  if (c.currentAge === undefined) c.currentAge = 16;
  if (c.peakOVR === undefined) c.peakOVR = 0;
  // —— season 子对象全面兜底 ——
  const s = STATE.season;
  if (!s.stats) s.stats = { kills: 0, deaths: 0, assists: 0, cs: 0, dmg: 0, vision: 0, games: 0 };
  if (!s.playoffStats) s.playoffStats = { kills: 0, deaths: 0, assists: 0, cs: 0, dmg: 0, vision: 0, games: 0 };
  if (!s.series) s.series = [];
  if (!s.awards) s.awards = [];
  if (!s.schedule) s.schedule = [];
  if (!s.standings) s.standings = {};
  // 旧存档积分榜可能缺队（老版本队伍表不一致）：补齐，避免排序/排名崩溃
  SIM_CONFIG.TEAMS.forEach(function(t) {
    if (!s.standings[t]) s.standings[t] = { wins: 0, losses: 0, streak: 0, streakType: null };
  });
  if (!s.events) s.events = { storyTimeline: [], injuryGamesLeft: 0, suspensionGamesLeft: 0, injuryReason: null, suspensionReason: null, lastTriggerGameNum: null, playoffEventCount: 0 };
  if (!s.events.storyTimeline) s.events.storyTimeline = [];
  if (s.bestSeries === undefined) s.bestSeries = null;
  if (s.playoffResult === undefined) s.playoffResult = null;
  if (s.champion === undefined) s.champion = null;
  if (s.fmvp === undefined) s.fmvp = null;
  if (s.isPlayoffs === undefined) s.isPlayoffs = false;
  if (s.round === undefined) s.round = 0;
  if (s.wins === undefined) s.wins = 0;
  if (s.losses === undefined) s.losses = 0;
  if (s.goal === undefined) s.goal = null;
  // 自动模拟卡死兜底：上次异常中断后重置状态，避免“点了没反应”
  STATE._autoSimming = false;
  STATE._bulkSim = false;
  STATE._pendingStrategy = null;
  applyRosterOverrides();
  if (!STATE.position && STATE.finalPosition) STATE.position = STATE.finalPosition;
}

// ==================== 玩法说明 ====================
var _helpPage = 0;
var _helpPages = [
  { title: '建选手', content: '选择位置后随机抽战队，从队内选手身上锁定一项属性。跨位置选选手会触发属性衰减，集满 13 项属性后揭晓总评、模板和相似选手。每局限换 3 次选手。' },
  { title: '常规赛', content: '14 支战队三循环共 39 轮，每轮 BO3 系列赛。逐轮模拟（每次赛前可选战术）或一键模拟到底，点赛程圆点可查看每局的击杀/经济/时长和关键事件。你的个人数据由属性决定：输出、爆发决定击杀，视野、游走决定助攻与视野分。' },
  { title: '奖项', content: '常规赛结束后评选：MVP（顶级选手+战绩加权）、每个位置的最佳（最佳上单/打野/中单/射手/辅助，按各位置核心数据排名）、最佳新秀（按位置，首个赛季且带队进季后赛、数据达标、同位置排名前二）。' },
  { title: '季后赛', content: '前 6 名进入季后赛：第 1、2 名直通半决赛，第 3-6 名打四分之一决赛。全部 BO5，一路赢下去就是冠军+FMVP。' },
  { title: '突发事件', content: '赛季中会随机遇到突发事件：伤病、禁赛会让你缺席比赛；手感火热/低迷、版本更新、教练战术会临时改变你的属性；还有绝杀名场面、交易新闻、广告代言、恋情八卦、季后赛压力等几十种故事事件。事件会记录在赛季页的时间线里。' },
  { title: '休赛期', content: '赛季结束后先进入转会窗口：各队会互换替补、官宣引援，你也有可能收到其他战队的报价（打得好更容易被豪门挖角），可以选择留队或转会。之后进入训练营：根据季后赛成绩、个人数据和荣誉获得训练点数，把点数分配到 13 项属性上养成选手。属性越高加点越贵，年轻时还有成长红利，年龄大了身体会自然下滑。' },
  { title: 'My Card', content: '赛季中随时可以打开 My Card 查看本赛季场均数据、季后赛数据、当前属性和生涯影响力（声望/人气/商业价值/年薪）。成就墙记录你达成的各种里程碑，荣誉墙按赛季汇总你的奖杯。' },
  { title: '退役', content: '16 岁开启职业生涯。25 岁起每个休赛期都会弹出退役抉择：可以再战一年，也可以正式退役；最晚 27 岁必须退役。退役时会生成生涯总结（赛季数、胜场、冠军、荣誉、生涯声望和最终评级），然后可以重开新档。' },
];
function showHelpModal() {
  _helpPage = 0;
  const modal = document.getElementById('helpModal');
  if (modal) modal.style.display = 'flex';
  renderHelpPage();
}
function closeHelpModal() { const m = document.getElementById('helpModal'); if (m) m.style.display = 'none'; }
function helpGoTo(idx) { _helpPage = idx; renderHelpPage(); }
function renderHelpPage() {
  const page = _helpPages[_helpPage];
  const body = document.getElementById('helpBody');
  const ind = document.getElementById('helpPageIndicator');
  const prev = document.getElementById('helpPrevBtn');
  const next = document.getElementById('helpNextBtn');
  if (body) body.innerHTML = '<div style="line-height:1.8;font-size:14px;">' + page.content + '</div>';
  if (ind) ind.textContent = (_helpPage + 1) + '/' + _helpPages.length;
  if (prev) prev.disabled = _helpPage === 0;
  if (next) next.disabled = _helpPage >= _helpPages.length - 1;
}
function helpPrevPage() { if (_helpPage > 0) { _helpPage--; renderHelpPage(); } }
function helpNextPage() { if (_helpPage < _helpPages.length - 1) { _helpPage++; renderHelpPage(); } }

// ==================== 1. 模式选择 ====================
function renderModeSelect() {
  const container = document.getElementById('feature-grid');
  if (!container) return;
  container.innerHTML = '';
  const cards = [
    { tag: 'CURRENT', tagClass: 'gold', title: '生涯模式', sub: '从 LPL 职业选手身上夺取属性，打造我的选手', btn: '🎮 进入生涯', mode: 'current' },
    { tag: 'NEW', tagClass: 'new', title: '传奇模式', sub: '从历史传奇选手组建我的阵容', btn: '即将上线', mode: 'legend', disabled: true },
  ];
  cards.forEach(function(c) {
    const card = document.createElement('div');
    card.className = 'feature-card' + (c.disabled ? ' disabled-card' : '');
    card.innerHTML = '<span class="fc-tag ' + c.tagClass + '">' + c.tag + '</span>' +
      '<div class="fc-title">' + c.title + '</div>' +
      '<div class="fc-sub">' + c.sub + '</div>' +
      '<button class="fc-btn"' + (c.disabled ? ' disabled' : '') + '>' + c.btn + '</button>';
    const btn = card.querySelector('.fc-btn');
    if (!c.disabled) {
      btn.onclick = function() { startNewCareer(c.mode); };
    }
    container.appendChild(card);
  });
  const cont = document.getElementById('continue-btn');
  if (cont) cont.style.display = hasSave() ? '' : 'none';
}

// 开始新生涯：先重置状态并清掉旧档，避免上一次游戏的已锁定属性卡住新档
function startNewCareer(mode) {
  initGame();
  STATE.mode = mode;
  startGame();
}

function startGame() {
  showScreen('screen-position');
  renderPositionSelect();
}

function continueCareer() {
  if (!STATE.careerTeam) { loadGame(); }
  if (STATE.season && STATE.season.isPlayoffs) {
    // 旧存档可能只有 isPlayoffs 而没有 playoffBracket，进来时自动补建
    if (!STATE.season.playoffBracket) initPlayoffs();
    showScreen('screen-playoffs');
    renderPlayoffBracket();
  } else if (STATE.season && STATE.season.round > 0) {
    showScreen('screen-season');
    renderSeasonUI();
  } else if (!STATE.careerTeam && STATE.finalOVR > 0 && STATE.lockedCount >= 13) {
    // 建选手已完成但还没选生涯战队：回到揭幕页
    revealPlayer();
  } else if (!STATE.careerTeam && STATE.lockedCount > 0) {
    // 建选手进行中：回到建号页继续锁定属性
    showScreen('screen-build');
    renderBuildUI();
    renderTeamPicker();
  } else {
    showScreen('screen-season');
    renderSeasonUI();
  }
}

// ==================== 2. 位置选择 ====================
function renderPositionSelect() {
  const grid = document.getElementById('pos-grid');
  if (!grid) return;
  grid.innerHTML = '';
  SIM_CONFIG.POS_LIST.forEach(function(pos) {
    const card = document.createElement('div');
    card.className = 'pos-card';
    card.innerHTML = '<div class="pos-icon">' + (SIM_CONFIG.POS_ICONS[pos] || '') + '</div>' +
      '<div class="pos-label">' + SIM_CONFIG.POSITIONS[pos] + '</div><div class="pos-en">' + pos + '</div>';
    card.onclick = function() {
      $$('.pos-card').forEach(function(c) { c.classList.remove('selected'); });
      card.classList.add('selected');
      STATE.position = pos;
    };
    grid.appendChild(card);
  });
}

function confirmPosition() {
  if (!STATE.position) return;
  STATE.selectedChamp = null;
  STATE.currentTeam = null;
  showScreen('screen-build');
  renderBuildUI();
  renderTeamPicker();
}

// ==================== 3. 建选手 ====================
function renderBuildUI() {
  const pi = document.getElementById('build-pos-indicator');
  if (pi) pi.textContent = '我选择的位置：' + getPosName(STATE.position) + '（' + STATE.position + '）';
  renderLeftAttrs();
  renderProgress();
}

function renderProgress() {
  const p = document.getElementById('build-progress-area');
  if (!p) return;
  const pct = Math.round((STATE.lockedCount / 13) * 100);
  p.innerHTML = '<div class="build-progress"><div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
    '<div class="progress-text">' + STATE.lockedCount + '/13</div></div>';
}

function renderLeftAttrs() {
  const ovrEl = document.getElementById('bl-ovr');
  if (ovrEl) {
    let ovr = STATE.finalOVR || 0;
    if (!ovr && STATE.position) {
      const w = SIM_CONFIG.OVR_WEIGHTS[STATE.position];
      let lockedSum = 0, lockedWeight = 0;
      ATTR_KEYS.forEach(function(k) {
        const val = STATE.attrs[k];
        const weight = w[k] || 0.07;
        if (val !== null) { lockedSum += val * weight; lockedWeight += weight; }
      });
      if (lockedWeight > 0) {
        const fillAvg = lockedSum / lockedWeight;
        let c = 0;
        ATTR_KEYS.forEach(function(k) {
          const val = STATE.attrs[k] !== null ? STATE.attrs[k] : Math.round(fillAvg);
          c += val * (w[k] || 0.07);
        });
        ovr = Math.round(c);
      }
    }
    ovrEl.textContent = ovr > 0 ? ovr : '--';
  }

  const container = document.getElementById('bl-attrs');
  if (!container) return;
  container.innerHTML = '';
  ATTR_KEYS.forEach(function(key) {
    const val = STATE.attrs[key];
    const isLocked = val !== null && val !== undefined;
    const div = document.createElement('div');
    let cls = 'ba-slot';
    if (isLocked) cls += ' locked';
    else if (STATE.selectedChamp) { cls += ' clickable'; div.onclick = function() { lockAttr(key); }; }
    div.className = cls;
    div.title = attrDesc(key);
    if (isLocked) {
      const g = getGrade(val);
      const slot = STATE.attrSlots[key];
      const hadPenalty = slot && slot.penalty < 1.0;
      div.innerHTML = '<span class="ba-label">' + attrCN(key) + '</span>' +
        '<span class="ba-grade" style="color:' + g.color + '">' + g.letter + '</span>' +
        '<span class="ba-owner" title="' + (hadPenalty ? '原始' + slot.raw + ' × ' + slot.penalty.toFixed(2) : '') + '" style="' + (hadPenalty ? 'color:var(--accent);' : '') + '">' + (slot ? slot.champ : '') + '</span>';
    } else if (STATE.selectedChamp) {
      const pv = parseInt(STATE.selectedChamp[key]) || 50;
      const srcPos = getMainPos(STATE.selectedChamp);
      const penalty = getPosPenalty(STATE.position, srcPos, key);
      const adjustedVal = Math.round(pv * penalty);
      const hasPenalty = penalty < 1.0;
      const pg = getGrade(adjustedVal);
      div.innerHTML = '<span class="ba-label">' + attrCN(key) + '</span>' +
        '<span class="ba-grade" style="color:' + pg.color + '">' + pg.letter + '</span>' +
        '<span class="ba-owner"' + (hasPenalty ? ' style="color:var(--accent);font-size:10px;"' : '') + '>' + (hasPenalty ? adjustedVal + '▼' : adjustedVal) + '</span>';
    } else {
      div.innerHTML = '<span class="ba-label">' + attrCN(key) + '</span><span class="ba-empty">+</span>';
    }
    container.appendChild(div);
  });
}

function renderTeamPicker() {
  const slotArea = document.getElementById('br-slot-area');
  if (!slotArea) return;
  const sorted = SIM_CONFIG.TEAMS.slice().sort();
  const copies = 5;
  const allItems = [];
  for (let c = 0; c < copies; c++) {
    sorted.forEach(function(t) { allItems.push(t); });
  }
  let itemsHtml = '';
  allItems.forEach(function(t) { itemsHtml += '<div class="br-slot-item" data-team="' + t + '">' + getTeamName(t) + '</div>'; });
  slotArea.innerHTML = buildSlotHTML(itemsHtml);
  const reel = document.getElementById('slot-reel');
  if (reel) {
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(-' + (sorted.length * 38) + 'px)';
    void reel.offsetHeight;
    reel.style.transition = '';
  }
  const rosterArea = document.getElementById('br-roster-area');
  if (rosterArea) rosterArea.innerHTML = '';
}

function buildSlotHTML(itemsHtml) {
  const canSpin = !STATE._mustLockAfterSpin && !_slotSpinning;
  return '<div class="br-slot-label">🎰 随机选队</div>' +
    '<div class="br-slot-wrapper"><div class="br-slot-machine"><div class="br-slot-reel" id="slot-reel">' + itemsHtml + '</div></div></div>' +
    '<div class="br-slot-actions">' +
    '<button class="btn btn-sm slot-btn" onclick="pullHandle()" style="background:var(--orange);color:#fff;' + (canSpin ? '' : 'opacity:0.35;') + '"' + (canSpin ? '' : ' disabled') + '>🎲 随机战队</button>' +
    getRerollButtonHtml() +
    '</div>' +
    '<div class="br-slot-warn">' + (STATE._mustLockAfterSpin ? '⚠️ 先锁定一项属性才能再次随机' : '') + '</div>';
}

function getRerollButtonHtml() {
  const hasTeam = !!STATE.currentTeam;
  if (STATE._rerollsLeft > 0) {
    return '<button class="btn btn-sm slot-btn" onclick="rerollTeamPlayers()"' + (hasTeam ? '' : ' disabled style="opacity:0.3;"') + '>👥 更换选手 (' + STATE._rerollsLeft + ')</button>';
  }
  return '<button class="btn btn-sm slot-btn" disabled style="opacity:0.3;">👥 换人次数已用完</button>';
}

function updateSlotButtons() {
  const slotArea = document.getElementById('br-slot-area');
  if (!slotArea) return;
  const actionsEl = slotArea.querySelector('.br-slot-actions');
  const warnEl = slotArea.querySelector('.br-slot-warn');
  const canSpin = !STATE._mustLockAfterSpin && !_slotSpinning;
  if (actionsEl) {
    actionsEl.innerHTML =
      '<button class="btn btn-sm slot-btn" onclick="pullHandle()" style="background:var(--orange);color:#fff;' + (canSpin ? '' : 'opacity:0.35;') + '"' + (canSpin ? '' : ' disabled') + '>🎲 随机战队</button>' +
      getRerollButtonHtml();
  }
  if (warnEl) warnEl.textContent = STATE._mustLockAfterSpin ? '⚠️ 先锁定一项属性才能再次随机' : '';
}

let _slotSpinning = false;

function pullHandle() {
  if (_slotSpinning || STATE._mustLockAfterSpin) return;
  const reel = document.getElementById('slot-reel');
  if (reel) reel.classList.add('spinning');
  setTimeout(spinSlotMachine, 200);
}

function spinSlotMachine() {
  if (_slotSpinning) return;
  _slotSpinning = true;
  const reel = document.getElementById('slot-reel');
  if (!reel) { _slotSpinning = false; return; }
  const sorted = SIM_CONFIG.TEAMS.slice().sort();
  const teamCount = sorted.length;
  const itemH = 38;
  const copyLen = teamCount * itemH;
  const targetIdx = Math.floor(Math.random() * teamCount);
  const targetTeam = sorted[targetIdx];
  const snapIdx = (targetIdx - 1 + teamCount) % teamCount;
  const targetY = copyLen * 2 + snapIdx * itemH;
  const curMatch = reel.style.transform.match(/([\d.]+)/);
  const curY = curMatch ? parseFloat(curMatch[0]) : copyLen;
  let finalY = targetY;
  const minSpin = copyLen * 0.5;
  while (finalY <= curY + minSpin) finalY += copyLen;
  const maxY = copyLen * 4 - itemH * 2;
  if (finalY > maxY) {
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(-' + copyLen + 'px)';
    void reel.offsetHeight;
    reel.style.transition = '';
    finalY = targetY + copyLen;
  }
  reel.classList.add('spinning');
  reel.style.transform = 'translateY(-' + finalY + 'px)';
  setTimeout(function() {
    reel.classList.remove('spinning');
    const exactY = copyLen * 3 + snapIdx * itemH;
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(-' + exactY + 'px)';
    void reel.offsetHeight;
    reel.style.transition = '';
    const middleIdx = teamCount * 3 + snapIdx + 1;
    highlightSlotItem('slot-reel', middleIdx);
    STATE.currentTeam = targetTeam;
    if (STATE._teamsVisited.indexOf(targetTeam) === -1) STATE._teamsVisited.push(targetTeam);
    STATE.selectedChamp = null;
    STATE._shownThisTeam = [];
    STATE._mustLockAfterSpin = true;
    _slotSpinning = false;
    renderLeftAttrs();
    updateSlotButtons();
    showTeamRoster(targetTeam);
  }, 2600);
}

function showTeamRoster(team) {
  const rosterArea = document.getElementById('br-roster-area');
  if (!rosterArea) return;
  const players = getTeamPlayers(team);
  const available = players.filter(function(p) { return STATE.usedChamps.indexOf(p.id) === -1; });
  if (available.length === 0) { rosterArea.innerHTML = '<div class="br-hint">❌ 都已选过</div>'; return; }
  const notShown = available.filter(function(p) { return STATE._shownThisTeam.indexOf(p.id) === -1; });
  const pool = notShown.length > 0 ? notShown : available;
  const shuffled = shuffleArr(pool.slice());
  const shown = shuffled.slice(0, Math.min(3, shuffled.length));
  shown.forEach(function(p) { if (STATE._shownThisTeam.indexOf(p.id) === -1) STATE._shownThisTeam.push(p.id); });
  renderRosterPlayers(team, shown);
}

function renderRosterPlayers(team, shown) {
  const rosterArea = document.getElementById('br-roster-area');
  if (!rosterArea) return;
  let listHtml = '<div class="br-team-line"><span class="br-team-name">' + getTeamName(team) + '</span>' +
    '<span class="br-team-sub">展示 ' + shown.length + ' 名选手</span></div><div class="br-roster-list">';
  shown.forEach(function(p) {
    const sel = STATE.selectedChamp && STATE.selectedChamp.id === p.id;
    const srcPos = getMainPos(p);
    const ovrGrade = getOvrGrade(parseInt(p.ovr) || 50);
    listHtml += '<div class="br-player' + (sel ? ' selected' : '') + '" onclick="pickPlayer(\'' + p.id.replace(/'/g, "\\'") + '\')">' +
      '<div class="bp-left"><div class="bp-icon">' + (SIM_CONFIG.POS_ICONS[srcPos] || '⭐') + '</div>' +
      '<div><div class="bp-name">' + p.id + '</div><div class="bp-detail">' + getPosName(srcPos) + ' · ' + p.t + '</div></div></div>' +
      '<div class="bp-meta"><span class="bp-ovr">' + p.ovr + '</span></div></div>';
  });
  listHtml += '</div>';
  const hasAnyPenalty = shown.some(function(p) { return getMainPos(p) !== STATE.position; });
  listHtml += '<div class="br-tips"><span>' + (hasAnyPenalty ? '⚠️ 跨位置衰减生效' : '✅ 同位置属性无衰减') + '</span>' +
    '<span style="color:var(--accent);font-weight:600;">👆 选选手 → 点左侧属性锁定</span></div>';
  rosterArea.innerHTML = listHtml;
}

function rerollTeamPlayers() {
  if (STATE._rerollsLeft <= 0 || !STATE.currentTeam) return;
  const players = getTeamPlayers(STATE.currentTeam);
  const available = players.filter(function(p) { return STATE.usedChamps.indexOf(p.id) === -1; });
  const notShown = available.filter(function(p) { return STATE._shownThisTeam.indexOf(p.id) === -1; });
  if (notShown.length === 0) return;
  STATE._rerollsLeft--;
  const shown = shuffleArr(notShown.slice()).slice(0, Math.min(3, notShown.length));
  shown.forEach(function(p) { if (STATE._shownThisTeam.indexOf(p.id) === -1) STATE._shownThisTeam.push(p.id); });
  STATE.selectedChamp = null;
  renderLeftAttrs();
  updateSlotButtons();
  renderRosterPlayers(STATE.currentTeam, shown);
}

function pickPlayer(name) {
  if (STATE._locking || !STATE.currentTeam) return;
  const p = PLAYERS.find(function(c) { return c.id === name; });
  if (!p) return;
  STATE.selectedChamp = p;
  document.querySelectorAll('.br-player').forEach(function(r) {
    r.classList.toggle('selected', r.textContent.indexOf(p.id) >= 0);
  });
  renderLeftAttrs();
}

function lockAttr(key) {
  if (STATE._locking || !STATE.selectedChamp || STATE.attrs[key] !== null) return;
  STATE._locking = true;
  const p = STATE.selectedChamp;
  const rawVal = parseInt(p[key]) || 50;
  const srcPos = getMainPos(p);
  const penalty = getPosPenalty(STATE.position, srcPos, key);
  const adjustedVal = Math.round(rawVal * penalty);
  STATE.attrs[key] = adjustedVal;
  STATE.attrSlots[key] = { champ: p.id, team: PLAYER_TEAM[p.id] || STATE.currentTeam, value: adjustedVal, raw: rawVal, penalty: penalty };
  STATE.lockedCount++;
  STATE.usedChamps.push(p.id);
  STATE.selectedChamp = null;
  STATE._mustLockAfterSpin = false;
  saveGame();
  if (STATE.lockedCount >= 13) {
    renderLeftAttrs();
    renderProgress();
    setTimeout(function() { STATE._locking = false; revealPlayer(); }, 500);
    return;
  }
  setTimeout(function() {
    STATE._locking = false;
    STATE.currentTeam = null;
    STATE._shownThisTeam = [];
    const rosterArea = document.getElementById('br-roster-area');
    if (rosterArea) rosterArea.innerHTML = '';
    renderLeftAttrs();
    updateSlotButtons();
    renderProgress();
  }, 600);
}

// ==================== 4. 相似选手匹配 ====================
const POS_GROUP = {
  TOP: ['TOP'],
  JG: ['JG'],
  MID: ['MID'],
  ADC: ['ADC'],
  SUP: ['SUP'],
};

function matchSimilarPlayers(attrs, pos, topN) {
  const ATTRS = ATTR_KEYS;
  const allowedPositions = POS_GROUP[pos] || [pos];
  const userVec = ATTRS.map(function(k) { return attrs[k] || 50; });
  const userNorm = Math.sqrt(userVec.reduce(function(s, v) { return s + v * v; }, 1));
  const scores = [];
  PLAYERS.forEach(function(p) {
    if (allowedPositions.indexOf(getMainPos(p)) === -1) return;
    const vec = ATTRS.map(function(k) { return parseInt(p[k]) || 50; });
    const norm = Math.sqrt(vec.reduce(function(s, v) { return s + v * v; }, 1));
    let dot = 0;
    for (let i = 0; i < ATTRS.length; i++) dot += userVec[i] * vec[i];
    scores.push({ p: p, sim: Math.round((dot / (userNorm * norm)) * 1000) / 10 });
  });
  scores.sort(function(a, b) { return b.sim - a.sim; });
  return scores.slice(0, topN || 3);
}

function findTieredPlayers(attrs, pos) {
  const userVec = ATTR_KEYS.map(function(k) { return attrs[k] || 50; });
  const userNorm = Math.sqrt(userVec.reduce(function(s, v) { return s + v * v; }, 1));
  const tiers = [
    { min: 88, max: 100, label: '顶级', result: null, bestSim: -1 },
    { min: 80, max: 88, label: '一线', result: null, bestSim: -1 },
    { min: 0, max: 80, label: '轮换', result: null, bestSim: -1 },
  ];
  PLAYERS.forEach(function(p) {
    const ovr = parseInt(p.ovr) || 0;
    const tier = tiers.find(function(t) { return ovr >= t.min && ovr < t.max; });
    if (!tier) return;
    const vec = ATTR_KEYS.map(function(k) { return parseInt(p[k]) || 50; });
    const norm = Math.sqrt(vec.reduce(function(s, v) { return s + v * v; }, 1));
    let dot = 0;
    for (let i = 0; i < ATTR_KEYS.length; i++) dot += userVec[i] * vec[i];
    const sim = Math.round((dot / (userNorm * norm)) * 100);
    if (sim > tier.bestSim) { tier.bestSim = sim; tier.result = { p: p, sim: sim, ovr: ovr }; }
  });
  return tiers.map(function(t) { return t.result; }).filter(Boolean);
}

// ==================== 5. 揭幕 ====================
function revealPlayer() {
  const weights = SIM_CONFIG.OVR_WEIGHTS[STATE.position];
  let ovr = 0;
  ATTR_KEYS.forEach(function(k) { ovr += (STATE.attrs[k] || 50) * (weights[k] || 0.07); });
  STATE.finalOVR = Math.round(ovr);
  STATE.finalPosition = STATE.position;
  const best = matchSimilarPlayers(STATE.attrs, STATE.position, 1)[0];
  STATE.finalArchetype = best ? best.p.t : '全能型';
  const tiered = findTieredPlayers(STATE.attrs, STATE.position);
  STATE.similarChamps = tiered;
  showScreen('screen-reveal');
  let statsHtml = '';
  ATTR_KEYS.forEach(function(k, i) {
    const val = STATE.attrs[k] || 50;
    const g = getGrade(val);
    statsHtml += '<div class="reveal-stat" style="animation-delay:' + (0.4 + i * 0.05) + 's">' +
      '<div class="label">' + attrCN(k) + '</div><div class="value" style="color:' + g.color + '">' + g.letter + '</div></div>';
  });
  let tierHtml = '';
  tiered.forEach(function(item) {
    tierHtml += '<div class="rv-sim-row"><span class="rv-sim-icon">' + (SIM_CONFIG.POS_ICONS[getMainPos(item.p)] || '⭐') + '</span>' +
      '<span class="rv-sim-name">' + item.p.id + '</span><span class="rv-sim-ovr">' + item.p.ovr + ' OVR</span></div>';
  });
  const cont = document.getElementById('reveal-content');
  if (cont) {
    cont.innerHTML =
      '<div class="reveal-card"><div class="reveal-label">我的选手</div>' +
      '<div class="big-cname">' + getDisplayName() + '</div>' +
      '<div class="big-ovr">' + STATE.finalOVR + '</div>' +
      '<div class="big-pos">' + getPosName(STATE.position) + ' · ' + getOvrGrade(STATE.finalOVR) + '</div></div>' +
      '<div class="reveal-stats">' + statsHtml + '</div>' +
      '<div class="section-card"><div class="sec-title">🎭 模板风格</div>' +
      '<div class="rv-arch">' + STATE.finalArchetype + '</div></div>' +
      '<div class="section-card"><div class="sec-title">🔍 相似选手</div>' + tierHtml + '</div>';
  }
  saveGame();
}

function goToCareer() {
  showScreen('screen-career');
  renderCareerSpin();
}

// ==================== 6. 生涯战队 ====================
function renderCareerSpin() {
  // 生涯战队从全部队伍里选，不受建选手阶段抽到过的队伍限制
  const pool = SIM_CONFIG.TEAMS.slice();
  const sorted = pool.slice().sort();
  const copies = 5;
  const allItems = [];
  for (let c = 0; c < copies; c++) sorted.forEach(function(t) { allItems.push(t); });
  let itemsHtml = '';
  allItems.forEach(function(t) { itemsHtml += '<div class="br-slot-item" data-team="' + t + '">' + getTeamName(t) + '</div>'; });
  const area = document.getElementById('career-area');
  if (area) {
    area.innerHTML = '<div class="career-wrap"><div class="br-slot-label">🎰 选择我的生涯战队</div>' +
      '<div class="br-slot-wrapper"><div class="br-slot-machine career-slot"><div class="br-slot-reel" id="career-slot-reel">' + itemsHtml + '</div></div></div>' +
      '<div class="br-slot-actions"><button class="btn btn-sm slot-btn" onclick="pullCareerHandle()" style="background:var(--orange);color:#fff;">🎲 随机战队</button>' +
      '<button class="btn btn-sm slot-btn" onclick="showCareerTeamPicker()" style="background:var(--bg-card);color:var(--text);">🎯 自选战队</button></div></div>';
  }
  const reel = document.getElementById('career-slot-reel');
  if (reel) {
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(-' + (sorted.length * 38 + 38) + 'px)';
    void reel.offsetHeight;
    reel.style.transition = '';
  }
}

function pullCareerHandle() { setTimeout(spinCareerSlot, 200); }

function spinCareerSlot() {
  const reel = document.getElementById('career-slot-reel');
  if (!reel) return;
  const pool = SIM_CONFIG.TEAMS.slice();
  const sorted = pool.slice().sort();
  const teamCount = sorted.length;
  const itemH = 38;
  const copyLen = teamCount * itemH;
  const targetIdx = Math.floor(Math.random() * teamCount);
  const targetTeam = sorted[targetIdx];
  const snapIdx = (targetIdx - 2 + teamCount) % teamCount;
  const targetY = copyLen * 2 + snapIdx * itemH;
  const curMatch = reel.style.transform.match(/([\d.]+)/);
  const curY = curMatch ? parseFloat(curMatch[0]) : copyLen + 38;
  let finalY = targetY;
  while (finalY <= curY + copyLen * 0.5) finalY += copyLen;
  const maxY = copyLen * 4 - itemH * 4;
  if (finalY > maxY) {
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(-' + copyLen + 'px)';
    void reel.offsetHeight;
    reel.style.transition = '';
    finalY = targetY + copyLen;
  }
  reel.classList.add('spinning');
  reel.style.transform = 'translateY(-' + finalY + 'px)';
  setTimeout(function() {
    reel.classList.remove('spinning');
    const exactY = copyLen * 3 + snapIdx * itemH;
    reel.style.transition = 'none';
    reel.style.transform = 'translateY(-' + exactY + 'px)';
    void reel.offsetHeight;
    reel.style.transition = '';
    const middleIdx = teamCount * 3 + snapIdx + 2;
    highlightSlotItem('career-slot-reel', middleIdx);
    selectCareerTeam(targetTeam);
  }, 3200);
}

function showCareerTeamPicker() {
  let allTeams = SIM_CONFIG.TEAMS.slice();
  allTeams = shuffleArr(allTeams);
  let gridHtml = '';
  allTeams.forEach(function(t) {
    gridHtml += '<div class="team-pick-card" onclick="selectCareerTeamFromPicker(\'' + t + '\')"><div class="tpc-logo">🛡️</div>' +
      '<span class="tpc-name">' + getTeamName(t) + '</span></div>';
  });
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'team-picker-overlay';
  overlay.innerHTML = '<div class="modal"><div class="modal-header"><span>🎯 选择生涯战队</span><button class="modal-close" onclick="closeCareerTeamPicker()">✕</button></div>' +
    '<div class="modal-sub">可选 ' + allTeams.length + ' 支战队</div>' +
    '<div class="team-picker-grid">' + gridHtml + '</div></div>';
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeCareerTeamPicker(); });
  document.body.appendChild(overlay);
}

function closeCareerTeamPicker() {
  const el = document.getElementById('team-picker-overlay');
  if (el) el.remove();
}
function selectCareerTeamFromPicker(team) { closeCareerTeamPicker(); selectCareerTeam(team); }

function selectCareerTeam(team) {
  STATE.careerTeam = team;
  const lineup = calcTeamLineup(team);
  const area = document.getElementById('career-area');
  if (!area) return;
  let rosterHtml = '<div class="roster-sec-title">🏀 首发阵容</div>';
  lineup.starters.forEach(function(p, i) {
    const isUser = p._isUser;
    rosterHtml += '<div class="roster-row' + (isUser ? ' me' : '') + '">' +
      '<span class="rr-icon">' + (SIM_CONFIG.POS_ICONS[p.pos] || '⭐') + '</span>' +
      '<span class="rr-pos">' + getPosName(p.pos) + '</span>' +
      '<span class="rr-name">' + p.id + (isUser ? ' ⭐' : '') + '</span>' +
      '<span class="rr-ovr">' + p.ovr + '</span></div>';
  });
  area.innerHTML = '<div class="career-wrap">' +
    '<div class="reveal-card" style="margin-bottom:10px;"><div class="reveal-label">我的生涯战队</div>' +
    '<div class="big-cname">' + getTeamName(team) + '</div>' +
    '<div class="big-pos">' + getPosName(STATE.position) + ' · OVR ' + STATE.finalOVR + '</div>' +
    '<button class="btn btn-primary" onclick="startSeason()">🏆 开始常规赛</button></div>' +
    '<div class="section-card">' + rosterHtml + '</div></div>';
  saveGame();
}

// ==================== 7. 阵容与战队实力 ====================
function calcTeamLineup(team) {
  const players = getTeamPlayers(team).map(function(p) {
    return { id: p.id, pos: getMainPos(p), ovr: parseInt(p.ovr) || 50, attrs: p, _isUser: false };
  });
  if (team === STATE.careerTeam && STATE.finalOVR) {
    const user = { id: getDisplayName(), pos: STATE.position, ovr: STATE.finalOVR, attrs: STATE.attrs, _isUser: true };
    players.push(user);
  }
  // 每位置只留一人：用户顶掉同位置原选手
  const byPos = {};
  players.forEach(function(p) {
    if (!byPos[p.pos] || p._isUser) byPos[p.pos] = p;
  });
  const starters = SIM_CONFIG.POS_LIST.map(function(pos) { return byPos[pos]; }).filter(Boolean);
  return { starters: starters, allPlayers: players };
}

function calcTeamPower(team) {
  const lineup = calcTeamLineup(team);
  const roster = lineup.starters;
  if (roster.length === 0) return { offense: 50, defense: 50, macro: 50, clutch: 50, overall: 50 };
  const cfg = SIM_CONFIG.TEAM_POWER;
  function calcDim(weights) {
    let sum = 0, totalW = 0;
    Object.keys(weights).forEach(function(attr) {
      const w = weights[attr];
      roster.forEach(function(p) {
        sum += (parseInt(p.attrs[attr]) || 50) * w;
        totalW += w;
      });
    });
    return totalW > 0 ? sum / totalW : 50;
  }
  const overall = roster.reduce(function(s, p) { return s + (parseInt(p.ovr) || 50); }, 0) / roster.length;
  return {
    offense: calcDim(cfg.offense),
    defense: calcDim(cfg.defense),
    macro: calcDim(cfg.macro),
    clutch: calcDim(cfg.clutch),
    overall: overall,
  };
}

// 属性→效率系数：低属性几乎没用，高属性才有显著收益
function attrFactor(val) {
  const v = Math.max(25, Math.min(99, val || 50));
  return Math.pow((v - 25) / 74, 0.85);
}
function af(val) { return Math.pow(attrFactor(val), 1.5); }

// ==================== 8. 比赛模拟 ====================
function simulateSeries(teamA, teamB, isPlayoff, strategy) {
  const powerA = calcTeamPower(teamA);
  const powerB = calcTeamPower(teamB);
  // 赛前战术：只影响我的队伍纸面实力
  if (strategy && strategy.id && (teamA === STATE.careerTeam || teamB === STATE.careerTeam)) {
    const mine = teamA === STATE.careerTeam ? powerA : powerB;
    const other = teamA === STATE.careerTeam ? powerB : powerA;
    if (strategy.id === 'stable') { mine.offense += 1; mine.defense += 2.5; mine.clutch += 1; }
    else if (strategy.id === 'aggressive') { mine.offense += 3; mine.clutch += 2.5; if (other.overall > mine.overall) mine.offense += 2; }
    else if (strategy.id === 'scale') { mine.offense += 0.5; mine.macro += 2.5; mine.clutch += 1.5; }
  }
  const netRating = (powerA.offense - powerB.offense) * 0.35 +
    (powerA.defense - powerB.defense) * 0.25 +
    (powerA.macro - powerB.macro) * 0.25 +
    (powerA.clutch - powerB.clutch) * 0.15;
  let winProb = 0.5 + netRating / 25;
  winProb = Math.max(0.18, Math.min(0.82, winProb));
  const bestOf = isPlayoff ? 5 : 3;
  const need = Math.ceil(bestOf / 2);
  let winsA = 0, winsB = 0;
  const games = [];
  let momentumA = 1, momentumB = 1;
  while (winsA < need && winsB < need) {
    let p = winProb * momentumA / Math.max(1, momentumB);
    p = Math.max(0.12, Math.min(0.88, p));
    const aWon = Math.random() < p;
    if (aWon) winsA++; else winsB++;
    // 简单动量：赢一局下一局概率小幅波动
    if (aWon) { momentumA *= 1.12; momentumB = 1; } else { momentumB *= 1.12; momentumA = 1; }
    // —— 详细比分：击杀/经济/时长/关键事件 ——
    let killsA = Math.round(7 + Math.random() * 9);
    let killsB = Math.round(7 + Math.random() * 9);
    if (aWon && killsB >= killsA) killsA = killsB + 1 + Math.floor(Math.random() * 4);
    if (!aWon && killsA >= killsB) killsB = killsA + 1 + Math.floor(Math.random() * 4);
    const duration = Math.round(24 + Math.random() * 22);
    const goldA = Math.round(killsA * 350 + duration * 980 * (0.92 + Math.random() * 0.16));
    const goldB = Math.round(killsB * 350 + duration * 980 * (0.92 + Math.random() * 0.16));
    const keyEvents = [];
    let highlight = false;
    const close = Math.abs(killsA - killsB) <= 3;
    if (close && Math.random() < 0.45) {
      highlight = true;
      keyEvents.push((aWon ? '⚡ 绝境翻盘拿下比赛' : '💔 被翻盘痛失好局'));
    }
    if (Math.random() < 0.2) {
      keyEvents.push('🔥 中期团战' + (aWon ? '大获全胜' : '溃败') + '，' + (Math.random() < 0.5 ? '小龙' : '大龙') + '易主');
      highlight = true;
    }
    if (Math.random() < 0.12) {
      keyEvents.push('🏆 远古龙决战，' + (aWon ? '一锤定音' : '功亏一篑'));
      highlight = true;
    }
    if (Math.random() < 0.18) {
      keyEvents.push((Math.random() < 0.5 ? '🎯 单人线' : '🛡️ 打野') + '产生单杀');
      highlight = true;
    }
    if (Math.random() < 0.08) {
      keyEvents.push('👑 五杀名场面！');
      highlight = true;
    }
    games.push({ aWon: aWon, killsA: killsA, killsB: killsB, goldA: goldA, goldB: goldB, duration: duration, keyEvents: keyEvents, highlight: highlight });
  }
  const won = winsA > winsB;
  // 爆冷检测（与纸面实力相反）
  const avgA = (powerA.offense + powerA.defense + powerA.macro) / 3;
  const avgB = (powerB.offense + powerB.defense + powerB.macro) / 3;
  const upset = won !== (avgA > avgB) && Math.abs(avgA - avgB) > 3;
  const highlight = games.some(function(g) { return g.highlight; }) || upset;
  return {
    won: won,
    winsA: winsA, winsB: winsB,
    games: games,
    score: winsA + '-' + winsB,
    powerA: powerA, powerB: powerB,
    isPlayoff: !!isPlayoff,
    strategy: strategy || null,
    upset: !!upset,
    highlight: !!highlight,
  };
}

function generatePlayerStats(result, isPlayoff, strategy) {
  const cfg = SIM_CONFIG.PLAYER_STATS;
  const pos = STATE.position || 'MID';
  const posScale = cfg.POS_SCALE[pos] || cfg.POS_SCALE.MID;
  const usage = cfg.USAGE[pos] || 0.18;
  const gameCount = result.games.length;
  const totalKills = result.games.reduce(function(s, g) { return s + g.killsA; }, 0);
  const totalKillsB = result.games.reduce(function(s, g) { return s + g.killsB; }, 0);
  const offAvg = af(((STATE.attrs.DPS || 50) + (STATE.attrs.BURST || 50) + (STATE.attrs.MECH || 50)) / 3);
  const winBoost = result.won ? 1.1 : 0.9;
  let kills = Math.round(totalKills * usage * (0.15 + offAvg * 0.85) * posScale.kills * winBoost);
  const survivability = af(((STATE.attrs.TANK || 50) + (STATE.attrs.MOB || 50)) / 2);
  let deaths = Math.max(1, Math.round((2.4 - survivability * 1.4) * posScale.deaths * (result.won ? 0.85 : 1.15) * gameCount));
  const supportFactor = af(((STATE.attrs.ROAM || 50) + (STATE.attrs.CC || 50) + (STATE.attrs.TEAM || 50)) / 3);
  const assists = Math.round(totalKills * 1.1 * supportFactor * posScale.assists * winBoost);
  const csPerGame = Math.round(190 + af(STATE.attrs.FARM || 50) * 130 + Math.random() * 40);
  let cs = csPerGame * gameCount;
  const dmgFactor = af((STATE.attrs.DPS || 50) * 0.7 + (STATE.attrs.BURST || 50) * 0.3);
  let dmg = Math.round((5000 + dmgFactor * 9000) * (isPlayoff ? 1.2 : 1.0) * gameCount * winBoost);
  const vision = Math.round((15 + af(STATE.attrs.VISION || 50) * 45) * posScale.vision * gameCount);
  if (strategy && strategy.id) {
    if (strategy.id === 'stable') { kills = Math.round(kills * 0.92); deaths = Math.max(1, Math.round(deaths * 0.82)); dmg = Math.round(dmg * 0.95); }
    else if (strategy.id === 'aggressive') { kills = Math.round(kills * 1.15); deaths = Math.round(deaths * 1.2); dmg = Math.round(dmg * 1.08); cs = Math.round(cs * 0.9); }
    else if (strategy.id === 'scale') { kills = Math.round(kills * 0.9); cs = Math.round(cs * 1.25); dmg = Math.round(dmg * 1.05); }
  }
  return { kills: kills, deaths: deaths, assists: assists, cs: cs, dmg: dmg, vision: vision, games: gameCount };
}

function addStats(target, stats) {
  if (!target || !stats) return;
  ['kills', 'deaths', 'assists', 'cs', 'dmg', 'vision', 'games'].forEach(function(k) {
    target[k] = (target[k] || 0) + (stats[k] || 0);
  });
}

// ==================== 8.5 突发事件 ====================
function getSeasonEvents() {
  if (!STATE.season) STATE.season = createFreshSeason();
  if (!STATE.season.events) {
    STATE.season.events = {
      storyTimeline: [], injuryGamesLeft: 0, suspensionGamesLeft: 0,
      injuryReason: null, suspensionReason: null, lastTriggerGameNum: null, playoffEventCount: 0,
    };
  }
  if (!STATE.season.events.storyTimeline) STATE.season.events.storyTimeline = [];
  return STATE.season.events;
}

const EVENT_REGISTRY = [
  // —— 禁赛类 ——
  { id: 'ban_rift_clash', name: '峡谷冲突', weight: 12, execute: function(ctx) {
    return { emoji: '💢', title: '峡谷冲突被禁赛', desc: '冲突禁赛',
      body: '一场焦灼的团战后，对手打野在公屏挑衅。你回了一句狠话，双方在河道爆发肢体冲突（游戏内）。裁判介入后给了你警告，但联盟回看录像认为行为过激，追加禁赛。',
      _consequence: 'suspension', _games: 1 + Math.floor(Math.random() * 2) };
  } },
  { id: 'ban_stream_rub', name: '直播口嗨', weight: 8, execute: function(ctx) {
    return { emoji: '🔇', title: '直播口嗨被处罚', desc: '直播言论处罚',
      body: '训练结束你开了直播，复盘时吐槽队友“这波纯送”。切片被顶到热搜，俱乐部连夜开会，联盟以不当言论对你禁赛。',
      _consequence: 'suspension', _games: 1 };
  } },
  { id: 'ban_bench_clear', name: '板凳席冲突', weight: 6, execute: function(ctx) {
    return { emoji: '🌪️', title: '赛后冲突禁赛', desc: '赛后冲突禁赛',
      body: '赛后握手环节，对方选手阴阳怪气，你推了他一把，双方替补席瞬间冲上来。安保把两队隔开，联盟开出重罚，你被禁赛多场。',
      _consequence: 'suspension', _games: 2 + Math.floor(Math.random() * 2) };
  } },
  // —— 伤病类 ——
  { id: 'inj_wrist', name: '手腕不适', weight: 12, execute: function(ctx) {
    const restGames = 2 + Math.floor(Math.random() * 3);
    return { emoji: '🩹', title: '手腕旧伤复发', desc: '手腕伤病',
      body: '连续高强度的对线让你的右手手腕开始刺痛，队医建议休战观察。你咬牙想坚持，但复诊结果不理想，只能暂别赛场。',
      _consequence: 'injury', _games: restGames,
      choices: [
        { id: 'play', label: '⚡ 咬牙坚持上场', desc: '不缺席比赛，但操作 -1，有加重风险', _attrDelta: { key: 'MECH', delta: -1 } },
        { id: 'rest', label: '🛌 遵医嘱休战', desc: '安心养伤，缺席 ' + restGames + ' 场', _games: restGames }
      ] };
  } },
  { id: 'inj_back', name: '腰伤发作', weight: 9, execute: function(ctx) {
    return { emoji: '🏥', title: '腰伤发作休战', desc: '腰伤休战',
      body: '一次训练赛的极限操作后，你的腰突然使不上力。理疗师说这是疲劳累积，强制你休战。你躺在理疗床上，看着队友们在训练，心里干着急。',
      _consequence: 'injury', _games: 3 + Math.floor(Math.random() * 3) };
  } },
  { id: 'inj_fever', name: '高烧', weight: 6, execute: function(ctx) {
    const restGames = 1 + Math.floor(Math.random() * 2);
    return { emoji: '🤒', title: '高烧休战', desc: '高烧休战',
      body: '换季降温，你半夜发起了高烧。队医直接把你摁在医院，禁止你上场。你裹着被子看比赛直播，弹幕全在刷“快好起来”。',
      _consequence: 'injury', _games: restGames,
      choices: [
        { id: 'play', label: '💪 轻伤不下火线', desc: '强行上场，机动 -1，状态很差', _attrDelta: { key: 'MOB', delta: -1 } },
        { id: 'rest', label: '🛌 好好休息', desc: '缺席 ' + restGames + ' 场，尽快恢复', _games: restGames }
      ] };
  } },
  // —— 版本类 ——
  { id: 'patch_buff', name: '版本加强', weight: 10, execute: function(ctx) {
    const keys = ['DPS', 'MECH', 'BURST', 'SPLIT'];
    const k = keys[Math.floor(Math.random() * keys.length)];
    return { emoji: '🛠️', title: '版本更新：英雄加强', desc: '版本红利',
      body: '新版本更新公告里，你本命英雄的核心装备被加强。排位胜率一路走高，教练也给你安排了更多战术倾斜。',
      _attrDelta: { key: k, delta: 1 } };
  } },
  { id: 'patch_nerf', name: '版本削弱', weight: 10, execute: function(ctx) {
    return { emoji: '📉', title: '版本更新：英雄削弱', desc: '版本逆风',
      body: '你的招牌英雄被一刀砍在命门上，胜率暴跌。你连夜加练新英雄，但手感还需要时间磨合。',
      _attrDelta: { key: 'MECH', delta: -1 } };
  } },
  // —— 故事类 ——
  { id: 'story_coach', name: '教练谈心', weight: 10, execute: function(ctx) {
    return { emoji: '☕', title: '教练深夜谈心', desc: '教练谈话',
      body: '深夜训练室只剩你和教练。他给你倒了一杯热茶，聊了聊你的瓶颈：“你的操作没问题，差的是把团队放第一位。”这句话你记了很久。' };
  } },
  { id: 'story_interview', name: '连胜采访', weight: 8, execute: function(ctx) {
    return { emoji: '🎙️', title: '连胜被采访', desc: '媒体采访',
      body: '你们打出了一波连胜，赛后采访轮到你。主持人问你赢球秘诀，你挠挠头：“少死几次，多听指挥。”弹幕笑疯。',
      choices: [
        { id: 'humble', label: '🙇 低调谦虚', desc: '“都是队友带飞”，人气 +1', _popularity: 1 },
        { id: 'confident', label: '😎 自信放话', desc: '“我们的目标就是冠军”，人气 +3', _popularity: 3 }
      ] };
  } },
  { id: 'story_solo_clip', name: '被单杀集锦', weight: 8, execute: function(ctx) {
    return { emoji: '😅', title: '被单杀上了集锦', desc: '下饭集锦',
      body: '解说席疯狂回放你被对位单杀的画面，“这波有点下饭啊”。你刷到视频，默默点了个举报，然后开了一把训练模式。' };
  } },
  { id: 'story_penta', name: '五杀名场面', weight: 5, execute: function(ctx) {
    return { emoji: '👑', title: '操作五杀名场面', desc: '高光时刻',
      body: '一波团战你像战神一样收割，五杀播报响彻全场，观众席彻底沸腾。赛后集锦标题：《这个操作值多少万？》。' };
  } },
  { id: 'story_allstar', name: '全明星票选', weight: 7, execute: function(ctx) {
    return { emoji: '⭐', title: '全明星票选领先', desc: '人气飙升',
      body: '全明星周末票选开启，你暂时排在同位置第一。你转发拉票时手一抖发错了群，但人气反而更高了。' };
  } },
  { id: 'story_netizen', name: '键盘侠网暴', weight: 7, execute: function(ctx) {
    return { emoji: '🌧️', title: '被键盘侠围攻', desc: '舆论压力',
      body: '一场失利后，超话里全是“退役吧”的帖子。你关掉手机睡了一觉，第二天照常训练——职业选手的抗压，是用一场场败仗练出来的。',
      choices: [
        { id: 'reply', label: '📢 正面回应', desc: '直播里回应质疑，人气 +2', _popularity: 2 },
        { id: 'silent', label: '🤐 沉默是金', desc: '不理会，专注比赛，关键 +1', _attrDelta: { key: 'CLU', delta: 1 } }
      ] };
  } },
  { id: 'story_rookie', name: '带新人', weight: 6, execute: function(ctx) {
    return { emoji: '🧑‍🎓', title: '带青训新人', desc: '传帮带',
      body: '青训营来了个天才少年，经理让你带他打训练赛。你教他卡线，他教你新梗。队内气氛前所未有的好。' };
  } },
  { id: 'story_contract', name: '续约谈判', weight: 6, execute: function(ctx) {
    return { emoji: '📄', title: '俱乐部续约谈判', desc: '合同传闻',
      body: '转会期传闻满天飞，俱乐部提前找你谈续约。经纪人列了一堆条款，你只关心一件事：能不能涨训练基地的网速。' };
  } },
  { id: 'story_form', name: '状态起伏', weight: 8, execute: function(ctx) {
    return { emoji: '🎢', title: '状态起伏期', desc: '状态波动',
      body: '最近几场你的操作明显变形，鼠标都握不稳。你给自己放了个短假，去看了场电影，回来手感才慢慢回来。' };
  } },
  { id: 'story_stream', name: '直播整活', weight: 6, execute: function(ctx) {
    return { emoji: '🎮', title: '直播整活破圈', desc: '人气破圈',
      body: '休赛日你直播玩了会云顶，结果连跪八把，节目效果拉满，粉丝涨了一截。经理发消息：要不转型主播？你回：再让我赢一把。' };
  } },
  // —— 转会新闻类（故事事件，不影响比赛） ——
  { id: 'transfer_rumor', name: '转会传闻', weight: 6, execute: function(ctx) {
    return { emoji: '📰', title: '转会流言四起', desc: '转会传闻',
      body: '转会期还没到，圈内已经传疯了：据说有支豪门队伍对你的表现很感兴趣，已经开始接触你的经纪人。你装作没看到，训练完还是自己加练到深夜。',
      choices: [
        { id: 'focus', label: '🎯 专注比赛', desc: '用表现说话，关键 +1', _attrDelta: { key: 'CLU', delta: 1 } },
        { id: 'talk', label: '🎙️ 回应传闻', desc: '“打完这个赛季再说”，人气 +2', _popularity: 2 }
      ] };
  } },
  { id: 'transfer_signing', name: '强队官宣引援', weight: 6, execute: function(ctx) {
    return { emoji: '📝', title: '对手官宣引援', desc: '引援新闻',
      body: '联盟官宣了一笔重磅引援：一支竞争对手签下了强力选手补强短板。解说评论：这队今年的目标是奔着冠军去的。教练在战术会上把这条新闻投到屏幕上，意思很明确。' };
  } },
  { id: 'transfer_promo', name: '二队选手提拔', weight: 5, execute: function(ctx) {
    return { emoji: '🌱', title: '二队新人被提拔', desc: '新人提拔',
      body: '转会窗口期，多支队伍把二队的潜力新秀提上一队。你队里的青训经理也找了你：如果状态不好，位置随时可能被新人顶掉。这话像一盆冷水，也像一针鸡血。' };
  } },
  { id: 'transfer_release', name: '自由人市场', weight: 5, execute: function(ctx) {
    return { emoji: '🧳', title: '自由人市场开启', desc: '自由人动态',
      body: '多名选手与队伍合同到期成为自由人，其中不乏老将。各队经理疯狂打电话，你的经纪人提醒你：好好打完这个赛季，你的身价只会更高。' };
  } },
  // —— 状态类（手感/心态，影响属性） ——
  { id: 'hot_streak', name: '手感火热', weight: 9, execute: function(ctx) {
    return { emoji: '🔥', title: '手感火热：版本答案', desc: '状态巅峰',
      body: '最近训练赛你的状态好得离谱，教练说你现在就是版本答案。对线压制、团战收割，连韩服王者局都在研究你的打法。',
      choices: [
        { id: 'push', label: '⚔️ 乘胜追击', desc: '趁热打铁，操作 +1', _attrDelta: { key: 'MECH', delta: 1 } },
        { id: 'steady', label: '🛡️ 保持冷静', desc: '不骄不躁，团战配合 +1', _attrDelta: { key: 'TEAM', delta: 1 } }
      ] };
  } },
  { id: 'cold_streak', name: '状态低迷', weight: 8, execute: function(ctx) {
    return { emoji: '🥶', title: '状态跌入冰点', desc: '状态低迷',
      body: '不知道从哪天起，你的操作开始变形：技能空得离谱，走位像在逛街。你加练到凌晨三点，可越急越打不好。',
      choices: [
        { id: 'train', label: '🏋️ 加练找回手感', desc: '苦练操作 +1', _attrDelta: { key: 'MECH', delta: 1 } },
        { id: 'break', label: '🎬 放个短假', desc: '调整心态，关键属性 +1', _attrDelta: { key: 'CLU', delta: 1 } }
      ] };
  } },
  { id: 'coach_tactics', name: '教练新战术', weight: 7, execute: function(ctx) {
    return { emoji: '🧠', title: '教练制定新战术', desc: '战术倾斜',
      body: '教练组连夜复盘后决定把战术重心往你这边倾斜：野区资源优先让给你，团战围绕你来打。这是信任，也是压力。',
      choices: [
        { id: 'accept', label: '🤝 全力配合', desc: '融入新战术，团战 +1', _attrDelta: { key: 'TEAM', delta: 1 } },
        { id: 'own', label: '🎯 坚持自己的打法', desc: '关键时刻更自信，关键 +1', _attrDelta: { key: 'CLU', delta: 1 } }
      ] };
  } },
  { id: 'fan_power', name: '粉丝应援', weight: 7, execute: function(ctx) {
    return { emoji: '📣', title: '粉丝应援团出动', desc: '人气加成',
      body: '主场观众席拉起了你的巨幅应援横幅，荧光棒连成一片星海。解说感叹：这待遇，顶流选手才有的排面。',
      choices: [
        { id: 'carry', label: '🔥 为粉丝拼一把', desc: '关键属性 +1', _attrDelta: { key: 'CLU', delta: 1 } },
        { id: 'photo', label: '📸 赛后合影', desc: '人气 +2', _popularity: 2 }
      ] };
  } },
  { id: 'sleep_deprived', name: '失眠困扰', weight: 6, execute: function(ctx) {
    return { emoji: '😵', title: '连续失眠状态下滑', desc: '作息崩了',
      body: '连续三晚失眠，白天训练哈欠连天，反应肉眼可见地变慢。队医给你开了褪黑素，经理让你少刷点手机。',
      choices: [
        { id: 'doctor', label: '🩺 遵医嘱调整作息', desc: '早点睡，恢复机动 +1', _attrDelta: { key: 'MOB', delta: 1 } },
        { id: 'push', label: '☕ 咖啡硬扛', desc: '白天硬撑，操作 -1', _attrDelta: { key: 'MECH', delta: -1 } }
      ] };
  } },
  // —— 比赛名场面类（故事事件，不影响属性） ——
  { id: 'miracle_comeback', name: '奇迹翻盘', weight: 7, execute: function(ctx) {
    return { emoji: '⚡', title: '落后一万经济奇迹翻盘', desc: '绝境名场面',
      body: '高地被破、经济落后一万，所有人都以为没了。你在一波团战里打出惊天操作，团灭对手一波推平基地。解说嗓子都喊哑了：“这都能翻？！”' };
  } },
  { id: 'baron_steal', name: '抢龙逆转', weight: 7, execute: function(ctx) {
    return { emoji: '🐉', title: '抢下大龙逆转战局', desc: '关键先生',
      body: '大龙血量见底，对方打野惩戒即将出手的瞬间，你的技能穿过人群精准抢下大龙。弹幕瞬间刷屏：“这就是主角吗？”' };
  } },
  { id: 'solo_king', name: '对线打穿', weight: 6, execute: function(ctx) {
    return { emoji: '🗡️', title: '对线直接打穿', desc: '对线压制',
      body: '这一场你对位完全碾压：单杀两次、压刀一百，对面打野来抓都被你一打二反杀。赛后对面选手在社交平台沉默了。' };
  } },
  { id: 'carry_1v9', name: '一拖四带队', weight: 6, execute: function(ctx) {
    return { emoji: '🦸', title: '一拖四带队取胜', desc: '孤胆英雄',
      body: '队友状态集体低迷，你一个人扛着队伍走：输出全场最高，团战把把救火。赛后数据图里，你的头像旁边是四个灰色的头像。' };
  } },
  { id: 'rookie_breakout', name: '新人爆发', weight: 6, execute: function(ctx) {
    return { emoji: '🌱', title: '青训新人爆发', desc: '新人高光',
      body: '你带过的青训小将首次登上 LPL 就打出惊人表现，赛后采访他说：“是他教我的，我欠他一个饭。”你笑着转发：这顿饭记上了。' };
  } },
  { id: 'clip_viral', name: '集锦上热门', weight: 6, execute: function(ctx) {
    return { emoji: '📺', title: '操作集锦破圈', desc: '视频爆火',
      body: '你的一场极限操作被剪成集锦，连不打游戏的朋友都在转发。评论区全是“这就是职业选手吗”“建议出教学”。' };
  } },
  // —— 联盟动态类（交易/重建新闻） ——
  { id: 'trade_big_move', name: '亿元引援', weight: 6, execute: function(ctx) {
    return { emoji: '💰', title: '豪门亿元引援', desc: '重磅交易',
      body: '一支豪门直接砸下天价签字费签下全明星选手，阵容纸面实力直接拉满。你的经纪人看到新闻后默默给你发了条消息：“下一份合同，你的数字只会更大。”' };
  } },
  { id: 'trade_rebuild', name: '摆烂重建', weight: 5, execute: function(ctx) {
    return { emoji: '🧱', title: '有队伍开始摆烂重建', desc: '重建信号',
      body: '联盟垫底的队伍宣布进入重建：核心选手挂牌出售，二队新人全部提上一队。解说评价：这赛季他们志在状元签（其实是高顺位选秀权）。' };
  } },
  { id: 'trade_superteam', name: '银河战舰', weight: 5, execute: function(ctx) {
    return { emoji: '🌟', title: '银河战舰组建', desc: '超级阵容',
      body: '转会窗传出惊人消息：三支队伍的明星选手可能在新赛季同队，组成“银河战舰”。你队里讨论了一整天，最后教练说：纸面再强，也得打过才知道。' };
  } },
  // —— 场外生活类 ——
  { id: 'life_endorsement', name: '广告代言', weight: 6, execute: function(ctx) {
    return { emoji: '📸', title: '签下品牌代言', desc: '商业价值',
      body: '一个电竞外设品牌找上门来，想请你拍广告。拍摄现场你被要求“表现出职业选手的专注”，结果导演说你的眼神像在盯野怪。',
      choices: [
        { id: 'accept', label: '🤝 接下代言', desc: '商业价值 +3，但占用一点训练时间', _businessValue: 3 },
        { id: 'decline', label: '🙅 婉拒', desc: '专注训练，团战 +1', _attrDelta: { key: 'TEAM', delta: 1 } }
      ] };
  } },
  { id: 'life_variety', name: '综艺通告', weight: 5, execute: function(ctx) {
    return { emoji: '🎬', title: '受邀参加综艺', desc: '跨界出圈',
      body: '一档热门综艺邀请你录节目，节目组希望你展示“电竞选手的一天”。录完你只想说：还是打比赛轻松。' };
  } },
  { id: 'life_romance', name: '恋情曝光', weight: 5, execute: function(ctx) {
    return { emoji: '💘', title: '恋情被拍到', desc: '八卦头条',
      body: '有人拍到你和圈外朋友一起吃饭的照片，标题：《电竞选手疑似恋情曝光》。你哭笑不得：那是我表哥。俱乐部官微默默点了个赞又取消了。' };
  } },
  { id: 'life_charity', name: '公益活动', weight: 5, execute: function(ctx) {
    return { emoji: '🤝', title: '参加公益活动', desc: '正能量',
      body: '俱乐部组织了一场公益校园行，你和队友去山区小学教孩子们打篮球、讲电竞故事。有个孩子说长大也要打职业，你摸了摸他的头：先好好读书。' };
  } },
  // —— 季后赛专属 ——
  { id: 'po_pressure', name: '季后赛压力', weight: 7, execute: function(ctx) {
    return { emoji: '😰', title: '季后赛压力拉满', desc: '大赛心态',
      body: '季后赛的聚光灯比常规赛刺眼十倍，每输一场都像被审判。你在赛前深呼吸，告诉自己：训练了这么久，就是为了此刻。',
      choices: [
        { id: 'calm', label: '🧘 调整心态', desc: '越是关键越冷静，关键 +1', _attrDelta: { key: 'CLU', delta: 1 } },
        { id: 'grind', label: '😤 加练到深夜', desc: '用汗水换自信，操作 +1', _attrDelta: { key: 'MECH', delta: 1 } }
      ],
      condition: function() { return !!(STATE.season && STATE.season.isPlayoffs); } };
  } },
  { id: 'po_veteran', name: '老将回春', weight: 6, execute: function(ctx) {
    return { emoji: '🧓', title: '对手老将季后赛回春', desc: '老将发威',
      body: '对面那位常规赛平平无奇的老将，到了季后赛像换了个人，操作流畅得让人怀疑他是不是隐瞒了年龄。解说：季后赛的老将，最可怕。',
      condition: function() { return !!(STATE.season && STATE.season.isPlayoffs); } };
  } },
  { id: 'po_film', name: '对手研究你', weight: 6, execute: function(ctx) {
    return { emoji: '🎥', title: '被对手连夜研究', desc: '战术针对',
      body: '有消息说对手战队连夜研究你的录像到凌晨，针对你的习惯做了三套方案。你笑了笑：研究我的人多了，你算老几。',
      condition: function() { return !!(STATE.season && STATE.season.isPlayoffs); } };
  } },
  { id: 'po_bo5_fatigue', name: '决胜局疲劳', weight: 6, execute: function(ctx) {
    return { emoji: '😩', title: 'BO5 决胜局体力告急', desc: '体能考验',
      body: '五局大战打到决胜局，你的手已经开始发酸。你灌了一口水，看了一眼教练：相信我，最后一局。',
      choices: [
        { id: 'rest', label: '💆 抓紧休息', desc: '平复心率，稳住状态' },
        { id: 'film', label: '🎥 熬夜研究对手', desc: '摸透套路更好打，但机动 -1', _attrDelta: { key: 'MOB', delta: -1 } }
      ],
      condition: function() { return !!(STATE.season && STATE.season.isPlayoffs); } }; } },
  { id: 'po_spotlight', name: '聚光灯下爆发', weight: 6, execute: function(ctx) {
    return { emoji: '🔦', title: '聚光灯下状态爆发', desc: '大场面选手',
      body: '越是关键局你越兴奋，越大的舞台你越放得开。队友都说你是“大场面选手”，你纠正：这是平时练得够多。',
      _attrDelta: { key: 'CLU', delta: 1 },
      condition: function() { return !!(STATE.season && STATE.season.isPlayoffs); } };
  } },
  { id: 'po_legacy', name: '为自己而战', weight: 5, execute: function(ctx) {
    return { emoji: '🏆', title: '这是证明自己的舞台', desc: '生涯之战',
      body: '打进季后赛的那一刻，你想起自己第一次看比赛时的样子。弹幕刷着你的名字，你对自己说：这一战，不为别的，为自己。',
      condition: function() { return !!(STATE.season && STATE.season.isPlayoffs); } }; } },
  // —— 常规赛专属 ——
  { id: 'rs_schedule', name: '魔鬼赛程', weight: 6, execute: function(ctx) {
    return { emoji: '🗓️', title: '魔鬼赛程来袭', desc: '赛程压力',
      body: '接下来的赛程堪称魔鬼：连续对阵联盟前四，中间只有一天的休息。经理拍拍你的肩膀：扛过去，你就是真金。',
      condition: function() { return !(STATE.season && STATE.season.isPlayoffs); } };
  } },
  { id: 'rs_back2back', name: '背靠背作战', weight: 5, execute: function(ctx) {
    return { emoji: '🎒', title: '背靠背连轴转', desc: '体能消耗',
      body: '赛程安排了一场背靠背：今天打完，明天还要飞客场。你在飞机上补觉，梦见自己在野区被四个人追。',
      condition: function() { return !(STATE.season && STATE.season.isPlayoffs); } };
  } },
];

function pickWeightedEvent(candidates) {
  const total = candidates.reduce(function(s, e) { return s + (e.weight || 10); }, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= candidates[i].weight || 10;
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function checkRandomEvents(game, result, stats) {
  const ev = getSeasonEvents();
  if (ev.suspensionGamesLeft > 0 || ev.injuryGamesLeft > 0) return null;
  const isPO = !!(STATE.season && STATE.season.isPlayoffs);
  // 常规赛最多 2 个伤病/禁赛事件；季后赛最多 4 个事件
  const storyLen = ev.storyTimeline.length;
  const consequenceCount = ev.storyTimeline.filter(function(t) { return t._consequence; }).length;
  if (!isPO && consequenceCount >= 2) return null;
  if (isPO && ev.playoffEventCount >= 4) return null;
  // 冷却：距上次事件至少 2 场
  if (ev.lastTriggerGameNum != null && STATE.season.games) {
    const gamesSince = STATE.season.games.length - ev.lastTriggerGameNum;
    if (gamesSince < 2) return null;
  }
  // 同一事件一个赛季内不重复，保证事件多样性
  const usedIds = {};
  ev.storyTimeline.forEach(function(t) { if (t._id) usedIds[t._id] = true; });
  const candidates = EVENT_REGISTRY.filter(function(e) {
    if (usedIds[e.id]) return false;
    try { return !e.condition || e.condition({ game: game, result: result, stats: stats }); } catch (ex) { return false; }
  });
  if (candidates.length === 0) return null;
  // 事件概率：常规赛约 25%，季后赛约 30%
  const rate = isPO ? 0.30 : 0.25;
  if (Math.random() >= rate) return null;
  const picked = pickWeightedEvent(candidates);
  if (!picked || !picked.execute) return null;
  const d = picked.execute({ game: game, result: result, stats: stats });
  if (!d) return null;
  d._id = picked.id;
  d._name = picked.name;
  ev.storyTimeline.push({ gameNum: STATE.season.games ? STATE.season.games.length : 0, title: d.title, desc: d.desc || '', emoji: d.emoji || '📰', _consequence: d._consequence || null, _id: d._id || null, choices: d.choices || null });
  ev.lastTriggerGameNum = STATE.season.games ? STATE.season.games.length : 0;
  if (isPO) ev.playoffEventCount++;
  // 有选项的决策事件：不自动结算，等玩家选择后再生效
  if (!d.choices || d.choices.length === 0) {
    if (d._consequence === 'injury' && d._games) {
      ev.injuryGamesLeft = (ev.injuryGamesLeft || 0) + d._games;
      ev.injuryReason = d.desc;
    } else if (d._consequence === 'suspension' && d._games) {
      ev.suspensionGamesLeft = (ev.suspensionGamesLeft || 0) + d._games;
      ev.suspensionReason = d.desc;
    }
    if (d._attrDelta && d._attrDelta.key && ATTR_KEYS.indexOf(d._attrDelta.key) >= 0) {
      const cur = STATE.attrs[d._attrDelta.key] || 50;
      STATE.attrs[d._attrDelta.key] = Math.max(25, Math.min(99, cur + (d._attrDelta.delta || 0)));
    }
  }
  return d;
}

function renderEventStatus() {
  const ev = getSeasonEvents();
  let html = '';
  if (ev.suspensionGamesLeft > 0) {
    html += '<span class="ev-badge ev-bad">🔇 禁赛中 · 还剩 ' + ev.suspensionGamesLeft + ' 场</span>';
  }
  if (ev.injuryGamesLeft > 0) {
    html += '<span class="ev-badge ev-bad">🏥 伤病中 · 还剩 ' + ev.injuryGamesLeft + ' 场</span>';
  }
  const recent = (ev.storyTimeline || []).slice(-2);
  recent.forEach(function(t) {
    html += '<span class="ev-badge">' + (t.emoji || '📰') + ' ' + t.title + '</span>';
  });
  const bar = document.getElementById('event-status');
  if (bar) bar.innerHTML = html || '<span class="ev-badge ev-none">暂无突发事件</span>';
  return html;
}

function renderEventTimeline() {
  const box = document.getElementById('event-timeline-box');
  if (!box) return;
  const ev = getSeasonEvents();
  const tl = ev.storyTimeline || [];
  let html = '<div class="sec-title">📰 赛季事件时间线</div>';
  if (tl.length === 0) {
    html += '<div style="text-align:center;color:var(--text-dim);font-size:12px;padding:8px;">本赛季风平浪静，暂无突发事件</div>';
  } else {
    html += '<div class="ev-timeline">' + tl.map(function(t, i) {
      return '<div class="ev-item"><span class="ev-dot">' + (t.emoji || '📰') + '</span>' +
        '<div class="ev-item-body"><div class="ev-item-title">' + t.title + '</div>' +
        '<div class="ev-item-meta">第 ' + (t.gameNum || i + 1) + ' 场后' + (t._consequence === 'injury' ? ' · 🏥 伤病' : t._consequence === 'suspension' ? ' · 🔇 禁赛' : '') + '</div>' +
        (t._result ? '<div class="ev-item-result" style="color:var(--orange);font-size:11px;margin-top:2px;">→ 我的选择：' + t._result + '</div>' : '') +
        '</div></div>';
    }).join('') + '</div>';
  }
  box.innerHTML = html;
}

function showEventModal(data, callback) {
  const modal = document.getElementById('event-modal');
  if (!modal) { if (callback) callback(); return; }
  document.getElementById('event-modal-title').textContent = (data.emoji || '📰') + ' ' + data.title;
  document.getElementById('event-modal-body').textContent = data.body || data.desc || '';
  let footer = '';
  if (data.choices && data.choices.length > 0) {
    // 决策型事件：让玩家选择
    footer = '<div class="ev-choices">' + data.choices.map(function(ch, i) {
      return '<button class="strat-opt" onclick="chooseEventChoice(' + i + ')"><b>' + ch.label + '</b><span>' + (ch.desc || '') + '</span></button>';
    }).join('') + '</div>';
  } else {
    footer = '<button class="btn btn-primary btn-sm" onclick="closeEventModal()">知道了</button>';
    if (data._consequence === 'injury') footer = '<div class="ev-conseq">🏥 伤病：休战 ' + data._games + ' 场</div>' + footer;
    if (data._consequence === 'suspension') footer = '<div class="ev-conseq">🔇 禁赛：' + data._games + ' 场</div>' + footer;
    if (data._attrDelta) footer = '<div class="ev-conseq">📈 属性变化：' + attrCN(data._attrDelta.key) + (data._attrDelta.delta > 0 ? '+' : '') + data._attrDelta.delta + '</div>' + footer;
  }
  document.getElementById('event-modal-footer').innerHTML = footer;
  window._eventModalData = data;
  modal.classList.add('active');
  modal.style.display = 'flex';
  window._eventModalCallback = callback || null;
}

function chooseEventChoice(idx) {
  const data = window._eventModalData;
  const modal = document.getElementById('event-modal');
  if (!data || !data.choices || !data.choices[idx]) { closeEventModal(); return; }
  const ch = data.choices[idx];
  // 应用选项效果
  if (ch._attrDelta && ch._attrDelta.key && ATTR_KEYS.indexOf(ch._attrDelta.key) >= 0) {
    const cur = STATE.attrs[ch._attrDelta.key] || 50;
    STATE.attrs[ch._attrDelta.key] = Math.max(25, Math.min(99, cur + (ch._attrDelta.delta || 0)));
  }
  const prof = STATE.career.profile || (STATE.career.profile = { fame: 0, popularity: 0, businessValue: 0, legacy: 0 });
  if (ch._fame) prof.fame = Math.max(0, (prof.fame || 0) + ch._fame);
  if (ch._popularity) prof.popularity = Math.max(0, (prof.popularity || 0) + ch._popularity);
  if (ch._businessValue) prof.businessValue = Math.max(0, (prof.businessValue || 0) + ch._businessValue);
  if (ch._games && data._consequence === 'injury') {
    STATE.season.events.injuryGamesLeft = (STATE.season.events.injuryGamesLeft || 0) + ch._games;
  }
  if (ch._games && data._consequence === 'suspension') {
    STATE.season.events.suspensionGamesLeft = (STATE.season.events.suspensionGamesLeft || 0) + ch._games;
  }
  // 更新时间线里对应的事件记录，显示玩家的选择
  const ev = getSeasonEvents();
  const tl = ev.storyTimeline;
  for (let i = tl.length - 1; i >= 0; i--) {
    if (tl[i]._id === data._id) { tl[i]._result = ch.label; break; }
  }
  saveGame();
  closeEventModal();
}

function closeEventModal() {
  const modal = document.getElementById('event-modal');
  if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
  window._eventModalData = null;
  if (window._eventModalCallback) {
    const cb = window._eventModalCallback;
    window._eventModalCallback = null;
    cb();
  }
}

// ==================== 8.6 赛前战术决策 ====================
const STRATEGY_LABELS = { stable: '🛡️ 稳健运营', aggressive: '⚔️ 激进进攻', scale: '🌱 发育后期', auto: '⚙️ 自动' };

function showStrategyModal(match, callback) {
  const modal = document.getElementById('strategy-modal');
  if (!modal) { if (callback) callback('auto'); return; }
  const sub = document.getElementById('strategy-modal-sub');
  if (sub) {
    if (match) {
      const opp = match.home === STATE.careerTeam ? match.away : match.home;
      sub.textContent = '对手：' + getTeamName(opp) + '（第 ' + match.round + ' 轮 · BO3）';
    } else {
      sub.textContent = '季后赛关键战，选择你的战术：';
    }
  }
  window._strategyCallback = callback || null;
  modal.classList.add('active');
  modal.style.display = 'flex';
}

function chooseStrategy(id) {
  const modal = document.getElementById('strategy-modal');
  if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
  const cb = window._strategyCallback;
  window._strategyCallback = null;
  STATE._pendingStrategy = id || 'auto';
  if (cb) cb(STATE._pendingStrategy);
}

// ==================== 9. 常规赛 ====================
function buildSeasonSchedule() {
  const all = buildLoLSchedule();
  return all.map(function(g, i) {
    const isMine = g.home === STATE.careerTeam || g.away === STATE.careerTeam;
    return { round: g.round + 1, gameNum: g.gameNum, home: g.home, away: g.away, isMine: isMine, simulated: false };
  });
}

function initStandings() {
  const st = {};
  SIM_CONFIG.TEAMS.forEach(function(t) { st[t] = { wins: 0, losses: 0, streak: 0, streakType: null }; });
  STATE.season.standings = st;
}

function getMyRank() {
  const st = STATE.season.standings;
  if (!st) return SIM_CONFIG.TEAMS.length;
  const sorted = SIM_CONFIG.TEAMS.slice().sort(function(a, b) {
    const sa = st[a] || { wins: 0, losses: 0 };
    const sb = st[b] || { wins: 0, losses: 0 };
    return (sb.wins - sb.losses) - (sa.wins - sa.losses) || sb.wins - sa.wins;
  });
  return sorted.indexOf(STATE.careerTeam) + 1;
}

function pickSeasonGoal() {
  const c = STATE.career;
  const hist = c.seasonHistory || [];
  const prev = hist[hist.length - 1];
  let type = 'playoffs', label = '打进季后赛';
  if (prev) {
    if (prev.champion === STATE.careerTeam) { type = 'champion'; label = '卫冕夺冠'; }
    else if ((prev.playoffDepth || 0) >= 3) { type = 'champion'; label = '冲击总冠军'; }
    else if ((prev.playoffDepth || 0) >= 1) { type = 'semifinal'; label = '冲击四强'; }
  }
  STATE.season.goal = { type: type, label: label, met: null };
}

function goalProgressText() {
  const goal = STATE.season && STATE.season.goal;
  if (!goal) return '';
  if (goal.met === true) return '✅ 已达成';
  if (goal.met === false) return '❌ 未达成';
  if (goal.type === 'playoffs') return '当前第 ' + getMyRank() + ' 名（前 ' + SIM_CONFIG.SEASON.PLAYOFF_TEAMS + ' 进季后赛）';
  return getMyRank() <= SIM_CONFIG.SEASON.PLAYOFF_TEAMS ? '当前第 ' + getMyRank() + ' 名 · 已进季后赛' : '当前第 ' + getMyRank() + ' 名';
}

function startSeason() {
  STATE.season = createFreshSeason();
  initStandings();
  STATE.season.schedule = buildSeasonSchedule();
  pickSeasonGoal();
  showScreen('screen-season');
  renderSeasonUI();
  saveGame();
}

function myNextMatch() {
  const sched = STATE.season.schedule;
  if (!sched) return null;
  for (let i = 0; i < sched.length; i++) {
    if (sched[i].isMine && !sched[i].simulated) return sched[i];
  }
  return null;
}

function simRound(roundNum) {
  const sched = (STATE.season.schedule || []).filter(function(g) { return g.round === roundNum && !g.simulated; });
  const ev = getSeasonEvents();
  const pendingEvents = [];
  const strategy = STATE._pendingStrategy || null;
  STATE._pendingStrategy = null;
  sched.forEach(function(g) {
    const isMine = g.isMine;
    const myStrategy = isMine && strategy ? { id: strategy } : null;
    const result = simulateSeries(g.home, g.away, false, myStrategy);
    g.simulated = true;
    g.result = result;
    const winner = result.won ? g.home : g.away;
    const loser = result.won ? g.away : g.home;
    STATE.season.standings[winner].wins++;
    STATE.season.standings[loser].losses++;
    STATE.season.standings[winner].streak = STATE.season.standings[winner].streakType === 'W' ? STATE.season.standings[winner].streak + 1 : 1;
    STATE.season.standings[winner].streakType = 'W';
    STATE.season.standings[loser].streak = STATE.season.standings[loser].streakType === 'L' ? STATE.season.standings[loser].streak + 1 : 1;
    STATE.season.standings[loser].streakType = 'L';
    if (isMine) {
      // ★ 伤病/禁赛跳过：不产生个人数据
      let skipReason = null;
      if (ev.suspensionGamesLeft > 0) skipReason = 'suspension';
      else if (ev.injuryGamesLeft > 0) skipReason = 'injury';
      const myOpp = g.home === STATE.careerTeam ? g.away : g.home;
      if (skipReason) {
        if (skipReason === 'suspension') ev.suspensionGamesLeft--;
        else ev.injuryGamesLeft--;
        g.skipReason = skipReason;
        STATE.season.series.push({ round: roundNum, opp: myOpp, result: result, stats: null, skipReason: skipReason });
      } else {
        if (result.won === (g.home === STATE.careerTeam)) STATE.season.wins++; else STATE.season.losses++;
        const stats = generatePlayerStats(result, false, myStrategy);
        addStats(STATE.season.stats, stats);
        STATE.season.series.push({ round: roundNum, opp: myOpp, result: result, stats: stats, won: result.won === (g.home === STATE.careerTeam), strategy: myStrategy });
        // 赛季最佳表现追踪
        const perfScore = stats.kills * 3 + stats.assists * 2 - stats.deaths + stats.dmg / 5000 + stats.cs / 80;
        if (!STATE.season.bestSeries || perfScore > STATE.season.bestSeries.score) {
          STATE.season.bestSeries = { round: roundNum, opp: winner === g.home ? g.away : g.home, result: result, stats: stats, score: perfScore };
        }
        // ★ 赛后检测随机事件
        try {
          const evData = checkRandomEvents(g, result, stats);
          if (evData) pendingEvents.push(evData);
        } catch (e) { /* 事件异常不影响比赛 */ }
      }
    }
  });
  STATE.season.round = roundNum;
  renderSeasonUI();
  saveGame();
  checkAchievements('game');
  // ★ 事件弹窗：单轮模拟时展示；一键模拟只记录到时间线
  const choiceEvs = pendingEvents.filter(function(e) { return e && e.choices && e.choices.length > 0; });
  if (choiceEvs.length > 0 && STATE._bulkSim) {
    // 决策型事件：中断自动模拟，弹出选择
    stopAutoSim();
    showEventModal(choiceEvs[0], function() {
      // 选择完成后自动继续自动模拟（除非常规赛已打完）
      if (myNextMatch() === null) endRegularSeason();
      else simAllRounds();
    });
    return;
  }
  if (pendingEvents.length > 0 && !STATE._bulkSim) {
    showEventModal(pendingEvents[0], function() {
      if (myNextMatch() === null) endRegularSeason();
    });
    return;
  }
  if (myNextMatch() === null) endRegularSeason();
}

function stopAutoSim() {
  STATE._autoSimming = false;
  STATE._bulkSim = false;
  if (_autoSimTimer) { clearTimeout(_autoSimTimer); _autoSimTimer = null; }
  const btn = document.getElementById('sim-all-btn');
  if (btn) { btn.disabled = false; btn.textContent = '⏩ 自动模拟'; }
}

function simNextRound() {
  if (STATE._autoSimming) return;
  const m = myNextMatch();
  if (!m) { endRegularSeason(); return; }
  // 我的比赛：赛前先选战术
  if (m.isMine) {
    showStrategyModal(m, function() { simRound(m.round); });
    return;
  }
  simRound(m.round);
}

let _autoSimTimer = null;
function simAllRounds() {
  if (STATE._autoSimming) return;
  STATE._autoSimming = true;
  const btn = document.getElementById('sim-all-btn');
  if (btn) { btn.disabled = true; btn.textContent = '▶ 模拟中…'; }
  const step = function() {
    const m = myNextMatch();
    if (!m) {
      STATE._autoSimming = false;
      STATE._bulkSim = false;
      if (btn) { btn.disabled = false; btn.textContent = '⏩ 自动模拟'; }
      renderEventStatus();
      return;
    }
    STATE._bulkSim = true;
    try {
      simRound(m.round);
      // 若决策事件中断了模拟（stopAutoSim 置 _autoSimming=false），不再续跑
      if (STATE._autoSimming) _autoSimTimer = setTimeout(step, 480);
    } catch (e) {
      // 单轮异常不能卡死自动模拟：复位状态并把错误显示出来
      STATE._autoSimming = false;
      STATE._bulkSim = false;
      if (btn) { btn.disabled = false; btn.textContent = '⏩ 自动模拟'; }
      const info = document.getElementById('simStatus');
      if (info) info.innerHTML = '<span style="color:var(--red);font-weight:700;">⚠️ 自动模拟中断：' + (e && e.message ? e.message : e) + '</span>';
      if (window.console && console.error) console.error('simAllRounds error:', e);
    }
  };
  _autoSimTimer = setTimeout(step, 300);
}

function showHint(text) {
  const info = document.getElementById('simStatus');
  if (info) {
    info.innerHTML = '<span style="color:var(--orange);font-weight:700;">⚠️ ' + text + '</span>';
    setTimeout(function() { renderSeasonUI(); }, 1600);
  }
}

function endRegularSeason() {
  calcAwards();
  // 没进季后赛 → 赛季目标判负
  if (STATE.season.goal && STATE.season.goal.met === null && getMyRank() > SIM_CONFIG.SEASON.PLAYOFF_TEAMS) {
    STATE.season.goal.met = false;
  }
  showAwardsScreen();
  saveGame();
}

// ==================== 10.5 位置最佳评选 ====================
const POSITION_AWARD_LABELS = { TOP: '最佳上单', JG: '最佳打野', MID: '最佳中单', ADC: '最佳射手', SUP: '最佳辅助' };
const POSITION_SCORE_CFG = {
  // 各位置的数据权重：上单偏承伤对线、打野偏游走助攻、中单偏输出爆发、射手偏输出补刀、辅助偏视野助攻
  TOP: { kills: 0.30, assists: 0.08, cs: 0.16, dmg: 0.22, deathPen: 0.12 },
  JG:  { kills: 0.18, assists: 0.32, cs: 0.05, dmg: 0.15, deathPen: 0.10 },
  MID: { kills: 0.36, assists: 0.14, cs: 0.15, dmg: 0.28, deathPen: 0.09 },
  ADC: { kills: 0.40, assists: 0.06, cs: 0.26, dmg: 0.24, deathPen: 0.12 },
  SUP: { kills: 0.04, assists: 0.50, cs: 0.02, dmg: 0.05, deathPen: 0.07 },
};

function calcPositionScore(stats, games, pos, wins, losses) {
  const g = Math.max(1, games || 1);
  const w = POSITION_SCORE_CFG[pos] || POSITION_SCORE_CFG.MID;
  const kpg = (stats.kills || 0) / g;
  const apg = (stats.assists || 0) / g;
  const cpg = (stats.cs || 0) / g / 100;
  const dpg = (stats.dmg || 0) / g / 10000;
  const deaths = (stats.deaths || 0) / g;
  const score = kpg * w.kills * 10 + apg * w.assists * 6 + cpg * w.cs * 40 + dpg * w.dmg * 25 -
    deaths * w.deathPen * 7 + ((wins || 0) - (losses || 0)) * 0.5;
  return Math.round(score * 10) / 10;
}

// ==================== 10. 奖项 ====================
function estimatePlayerStats(p) {
  const pos = getMainPos(p);
  const ovr = parseInt(p.ovr) || 50;
  const off = af((parseInt(p.DPS) || 50) * 0.7 + (parseInt(p.BURST) || 50) * 0.3);
  const kills = 2.0 + off * 3.5;
  const deaths = 2.6 - af((parseInt(p.TANK) || 50) + (parseInt(p.MOB) || 50)) * 0.8;
  const assists = 2.0 + af((parseInt(p.ROAM) || 50) + (parseInt(p.CC) || 50)) * 3.0;
  const dmg = 5000 + af((parseInt(p.DPS) || 50)) * 9000;
  const cs = Math.round(180 + af((parseInt(p.FARM) || 50)) * 140 + Math.random() * 30);
  return { kills: kills, deaths: Math.max(1, deaths), assists: assists, cs: cs, dmg: dmg, ovr: ovr, pos: pos };
}

function calcAwards() {
  const awards = [];
  const st = STATE.season.standings;
  const rankList = SIM_CONFIG.TEAMS.slice().sort(function(a, b) {
    const sa = st[a] || { wins: 0, losses: 0 };
    const sb = st[b] || { wins: 0, losses: 0 };
    return (sb.wins - sb.losses) - (sa.wins - sa.losses) || sb.wins - sa.wins;
  });
  const rankOf = {};
  rankList.forEach(function(t, i) { rankOf[t] = i + 1; });
  const seasonYear = STATE.career.seasonCount + 1;

  // MVP 抽签
  const mvpTickets = [];
  PLAYERS.forEach(function(p) {
    const ovr = parseInt(p.ovr) || 0;
    if (ovr < 88) return;
    const team = PLAYER_TEAM[p.id];
    let tickets = 1;
    if (rankOf[team] <= 3) tickets += 2;
    if (rankOf[team] <= 6) tickets += 1;
    for (let i = 0; i < tickets; i++) mvpTickets.push(p);
  });
  if ((STATE.finalOVR || 0) >= 88) {
    let tickets = 1;
    if (rankOf[STATE.careerTeam] <= 3) tickets += 2;
    if (rankOf[STATE.careerTeam] <= 6) tickets += 1;
    const userTickets = Math.max(0, Math.round((STATE.finalOVR - 87) / 3)) + tickets;
    for (let i = 0; i < userTickets; i++) mvpTickets.push({ _isUser: true, id: getDisplayName() });
  }
  const mvpPick = mvpTickets.length > 0 ? mvpTickets[Math.floor(Math.random() * mvpTickets.length)] : null;
  const mvpWon = !!(mvpPick && mvpPick._isUser);
  const mvpName = mvpPick ? (mvpPick._isUser ? getDisplayName() : mvpPick.id) : '—';
  const mvpTeam = mvpPick ? (mvpPick._isUser ? STATE.careerTeam : PLAYER_TEAM[mvpPick.id]) : null;
  awards.push({ act: 'mvp', label: '常规赛 MVP', winner: mvpName, team: mvpTeam, isUser: mvpWon, season: seasonYear });

  const userStats = STATE.season.stats;
  const userGames = Math.max(1, userStats.games || 1);

  // 每个位置评选“最佳”（最佳上单/打野/中单/射手/辅助）
  const posCandidates = {};
  SIM_CONFIG.POS_LIST.forEach(function(pos) {
    const cands = PLAYERS.filter(function(p) { return getMainPos(p) === pos; }).map(function(p) {
      const est = estimatePlayerStats(p);
      const rec = st[PLAYER_TEAM[p.id]] || { wins: 0, losses: 0 };
      return { id: p.id, team: PLAYER_TEAM[p.id], pos: pos, score: calcPositionScore(est, 1, pos, rec.wins, rec.losses), isUser: false };
    });
    if (STATE.position === pos) {
      cands.push({ id: getDisplayName(), team: STATE.careerTeam, pos: pos, score: calcPositionScore(userStats, userGames, pos, (st[STATE.careerTeam] || {}).wins, (st[STATE.careerTeam] || {}).losses), isUser: true });
    }
    cands.sort(function(a, b) { return b.score - a.score; });
    posCandidates[pos] = cands;
    if (cands.length > 0) {
      const top = cands[0];
      awards.push({ act: 'posbest_' + pos, label: POSITION_AWARD_LABELS[pos] || ('最佳' + pos), winner: top.id, team: top.team, isUser: !!top.isUser, season: seasonYear });
    }
  });

  // 最佳新秀·位置：首个赛季 + 进季后赛 + 数据达标 + 同位置排名前二
  if (STATE.career.seasonCount === 0) {
    const rookieRank = getMyRank();
    const rps = STATE.season.stats || {};
    const rgp = Math.max(1, rps.games || 1);
    const rookieKpg = (rps.kills || 0) / rgp;
    const rookieApg = (rps.assists || 0) / rgp;
    const rookieQualified = rookieRank <= SIM_CONFIG.SEASON.PLAYOFF_TEAMS && rookieKpg >= 2.5 && rookieApg >= 3.0;
    if (rookieQualified) {
      const cands = posCandidates[STATE.position] || [];
      const userIdx = cands.findIndex(function(c) { return c.isUser; });
      if (userIdx >= 0 && userIdx <= 1) {
        awards.push({ act: 'rookie', label: '最佳新秀·' + (SIM_CONFIG.POSITIONS[STATE.position] || STATE.position), winner: getDisplayName(), team: STATE.careerTeam, isUser: true, season: seasonYear });
      }
    }
  }

  STATE.season.awards = awards;
  checkAchievements('awards');
}

// ==================== 11. 赛季 UI ====================
function renderSeasonUI() {
  const header = document.getElementById('season-header');
  if (header) {
    const st = STATE.season.standings[STATE.careerTeam] || { wins: 0, losses: 0 };
    const ps = STATE.season.stats || {};
    const g = Math.max(1, ps.games || 1);
    const skipped = (STATE.season.series || []).filter(function(x) { return x.skipReason; }).length;
    const myW = STATE.season.wins || 0;
    const myL = STATE.season.losses || 0;
    header.innerHTML = '<div class="sh-top">' +
      '<div class="sh-team"><div class="sh-team-name">' + getTeamName(STATE.careerTeam) + '</div>' +
      '<div class="sh-season">' + getSeasonLabel(STATE.career.seasonCount + 1) + '</div></div>' +
      '<div class="sh-record"><span class="sh-wins">' + st.wins + '</span><span class="sh-dash">-</span><span class="sh-losses">' + st.losses + '</span>' +
      '<div class="sh-pct">' + (st.wins + st.losses > 0 ? Math.round(st.wins / (st.wins + st.losses) * 100) + '%' : '—') + '</div></div></div>' +
      '<div class="sh-info"><span>' + getPosName(STATE.position) + ' · OVR ' + STATE.finalOVR + '</span>' +
      '<span>场均 ' + (ps.kills / g).toFixed(1) + '杀 ' + (ps.deaths / g).toFixed(1) + '死 ' + (ps.assists / g).toFixed(1) + '助</span>' +
      '<span>第 ' + (STATE.season.round || 0) + ' 轮</span>' +
      (skipped > 0 ? '<span style="color:var(--accent);">我出战 ' + (ps.games || 0) + ' 场 · ' + myW + '胜' + myL + '负（缺 ' + skipped + ' 场）</span>' : '') +
      '</div>';
  }
  renderEventStatus();
  renderEventTimeline();
  renderCalendar();
  renderStandings();
  // 最近赛果
  const lastEl = document.getElementById('sim-last');
  const series = STATE.season.series || [];
  const last = series[series.length - 1];
  if (lastEl) {
    if (!last) {
      lastEl.innerHTML = '';
    } else if (last.skipReason) {
      lastEl.innerHTML = '<div class="sim-last-card sim-skip">' + (last.skipReason === 'injury' ? '🏥' : '🔇') + ' 第 ' + last.round + ' 轮 ' +
        (last.skipReason === 'injury' ? '伤病缺阵' : '禁赛缺阵') + ' · 对阵 ' + getTeamName(last.opp) + '</div>';
    } else {
      const gLast = (STATE.season.schedule || []).find(function(x) { return x.isMine && x.round === last.round; });
      const userScore = gLast && gLast.home !== STATE.careerTeam && last.result.score.indexOf('-') >= 0
        ? last.result.score.split('-').reverse().join('-')
        : last.result.score;
      lastEl.innerHTML = '<div class="sim-last-card ' + (last.won ? 'sim-win' : 'sim-loss') + '">' +
        (last.won ? '✅ 胜' : '❌ 负') + ' 第 ' + last.round + ' 轮 · ' + userScore + ' · ' + getTeamName(last.opp) +
        (last.strategy ? ' · ' + (STRATEGY_LABELS[last.strategy.id] || last.strategy.id) : '') +
        (last.result.upset ? ' · 💥 爆冷' : '') +
        (last.stats ? ' · 我的数据 ' + last.stats.kills + '杀/' + last.stats.deaths + '死/' + last.stats.assists + '助' : '') +
        '</div>';
    }
  }
  // 状态提示 + 按钮开关
  const info = document.getElementById('simStatus');
  if (info) {
    const m = myNextMatch();
    if (m) {
      info.innerHTML = '📅 下一轮：' + getTeamName(m.home) + ' vs ' + getTeamName(m.away) + '（第 ' + m.round + ' 轮 · BO3）<br>' +
        '<span style="color:var(--accent);">▶ 点「模拟下一轮」或「自动模拟」逐场观看</span>';
    } else if (!STATE.season.isPlayoffs) {
      info.innerHTML = '🏁 常规赛全部打完！前往「📊 奖项」查看评选，再进「🎯 季后赛」。';
    } else if (STATE.season.playoffBracket && STATE.season.playoffBracket.done) {
      info.innerHTML = '🏆 季后赛结束！前往「📊 赛季总结」查看赛季成果。';
    }
    if (STATE.season.goal) {
      info.innerHTML += '<div style="margin-top:5px;">🎯 赛季目标：' + STATE.season.goal.label + '（' + goalProgressText() + '）</div>';
    }
    const finished = myNextMatch() === null;
    const awardsBtn = document.getElementById('awards-btn');
    const poBtn = document.getElementById('po-btn');
    const qualified = finished && getMyRank() <= SIM_CONFIG.SEASON.PLAYOFF_TEAMS;
    if (awardsBtn) { awardsBtn.disabled = !finished; awardsBtn.style.opacity = finished ? 1 : 0.4; awardsBtn.title = finished ? '' : '常规赛打完才能评奖'; }
    if (poBtn) {
      poBtn.disabled = !qualified;
      poBtn.style.opacity = qualified ? 1 : 0.4;
      poBtn.title = !finished ? '常规赛打完才能进入季后赛' : (qualified ? '' : '排名前 ' + SIM_CONFIG.SEASON.PLAYOFF_TEAMS + ' 才能进季后赛');
    }
  }
}

function renderCalendar() {
  const cal = document.getElementById('simDotGrid');
  if (!cal) return;
  let html = '';
  const sched = STATE.season.schedule || [];
  const maxRound = Math.max.apply(null, sched.map(function(g) { return g.round; }));
  for (let r = 1; r <= maxRound; r++) {
    const g = sched.find(function(x) { return x.isMine && x.round === r; });
    let cls = 'dot-pending';
    let title = '第' + r + '轮';
    if (g && g.simulated) {
      if (g.skipReason === 'injury') { cls = 'dot-x'; title = '第' + r + '轮 🏥 伤病休战（点开查看详情）'; }
      else if (g.skipReason === 'suspension') { cls = 'dot-x'; title = '第' + r + '轮 🔇 禁赛（点开查看详情）'; }
      else {
        const myWon = g.result.won === (g.home === STATE.careerTeam);
        const winnerTeam = g.result.won ? g.home : g.away;
        cls = myWon ? 'dot-w' : 'dot-l';
        title = '第' + r + '轮 ' + (myWon ? '胜' : '负') + ' ' + getTeamName(winnerTeam) + ' ' + g.result.score + '（点开查看详情）';
      }
      if (r === STATE.season.round) cls += ' just';
      html += '<span class="dot ' + cls + '" title="' + title + '" onclick="showSeriesDetail(' + r + ')">' + (g.skipReason ? '✕' : r) + '</span>';
    } else if (g && r === (STATE.season.round || 0) + 1) {
      cls = 'dot-next';
      title = '第' + r + '轮（下一场）';
      html += '<span class="dot ' + cls + '" title="' + title + '" onclick="simNextRound()">' + r + '</span>';
    } else {
      html += '<span class="dot ' + cls + '" title="' + title + '">' + r + '</span>';
    }
    if (r % 9 === 0) html += '<br>';
  }
  cal.innerHTML = html;
}

function showSeriesDetail(roundNum) {
  const modal = document.getElementById('series-modal');
  if (!modal) return;
  const g = (STATE.season.schedule || []).find(function(x) { return x.isMine && x.round === roundNum; });
  const entry = (STATE.season.series || []).find(function(s) { return s.round === roundNum; });
  let html = '';
  if (!g) {
    html = '<div style="color:var(--text-dim);text-align:center;padding:16px;">该轮没有我的比赛</div>';
  } else if (!entry) {
    html = '<div style="color:var(--text-dim);text-align:center;padding:16px;">该轮还没有模拟</div>';
  } else if (entry.skipReason) {
    html = '<div class="ev-conseq" style="margin-bottom:8px;">' + (entry.skipReason === 'injury' ? '🏥 伤病休战' : '🔇 禁赛') + '</div>' +
      '<div style="color:var(--text-dim);text-align:center;padding:8px;">对阵 ' + getTeamName(g.home === STATE.careerTeam ? g.away : g.home) + '，本场轮休。</div>';
  } else {
    const r = entry.result;
    const myTeam = STATE.careerTeam;
    const homeName = getTeamName(g.home);
    const awayName = getTeamName(g.away);
    const winnerName = r.won ? homeName : awayName;
    const loserName = r.won ? awayName : homeName;
    html = '<div class="sd-scoreline">' + winnerName + ' <b>' + r.score + '</b> ' + loserName + '</div>';
    if (r.upset) html += '<div class="ev-conseq">💥 爆冷！</div>';
    html += '<div class="sd-games">';
    (r.games || []).forEach(function(gg, i) {
      const homeWonGame = gg.aWon;
      const myWonGame = (homeWonGame && g.home === myTeam) || (!homeWonGame && g.away === myTeam);
      const gameWinnerName = homeWonGame ? homeName : awayName;
      html += '<div class="sd-game' + (gg.highlight ? ' sd-hot' : '') + '">' +
        '<div class="sd-game-head">G' + (i + 1) + ' · ' + gameWinnerName + ' 胜' + (myWonGame ? ' ⭐' : '') +
        (gg.duration ? ' · ' + gg.duration + '分钟' : '') + '</div>' +
        '<div class="sd-kills">击杀 ' + gg.killsA + ' : ' + gg.killsB + '</div>' +
        '<div class="sd-gold">经济 ' + Math.round(gg.goldA / 1000) + 'k : ' + Math.round(gg.goldB / 1000) + 'k</div>' +
        (gg.keyEvents && gg.keyEvents.length ? '<div class="sd-events">' + gg.keyEvents.map(function(ke) { return '<span>' + ke + '</span>'; }).join('') + '</div>' : '') +
        '</div>';
    });
    html += '</div>';
    if (entry.stats) {
      const s = entry.stats;
      html += '<div class="sd-mystats">我的数据：' + s.kills + '杀 ' + s.deaths + '死 ' + s.assists + '助 · CS ' + s.cs + ' · 伤害 ' + Math.round(s.dmg / 1000) + 'k · 视野 ' + s.vision + '</div>';
    }
  }
  document.getElementById('series-modal-body').innerHTML = html;
  modal.classList.add('active');
  modal.style.display = 'flex';
}

function closeSeriesModal() {
  const modal = document.getElementById('series-modal');
  if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
}

function renderStandings() {
  const box = document.getElementById('standings-box');
  if (!box) return;
  const st = STATE.season.standings;
  if (!st) return;
  const sorted = SIM_CONFIG.TEAMS.slice().sort(function(a, b) {
    const sa = st[a] || { wins: 0, losses: 0 };
    const sb = st[b] || { wins: 0, losses: 0 };
    return (sb.wins - sb.losses) - (sa.wins - sa.losses) || sb.wins - sa.wins;
  });
  let html = '<div class="sec-title">🏆 积分榜</div><div class="st-hdr"><span>#</span><span>战队</span><span>胜</span><span>负</span><span>近况</span></div>';
  sorted.forEach(function(t, i) {
    const s = st[t] || { wins: 0, losses: 0, streak: 0, streakType: null };
    const isMy = t === STATE.careerTeam;
    html += '<div class="st-row' + (isMy ? ' st-my' : '') + '"><span>' + (i + 1) + '</span>' +
      '<span>' + getTeamName(t) + (isMy ? ' ⭐' : '') + '</span>' +
      '<span class="st-w">' + s.wins + '</span><span class="st-l">' + s.losses + '</span>' +
      '<span class="st-streak">' + (s.streakType ? s.streakType + s.streak : '-') + '</span></div>';
  });
  box.innerHTML = html;
}

// ==================== 12. 奖项页 ====================
function showAwardsScreen() {
  if (myNextMatch()) { showHint('常规赛还没打完，先把 39 轮打完！'); return; }
  showScreen('screen-awards');
  const box = document.getElementById('awards-box');
  if (!box) return;
  let html = '';
  (STATE.season.awards || []).forEach(function(a) {
    html += '<div class="award-card' + (a.isUser ? ' won' : '') + '">' +
      '<div class="award-badge">' + (a.act === 'mvp' ? '🏆' : a.act.indexOf('posbest') === 0 ? '🏅' : a.act === 'allteam' ? '⭐' : a.act === 'rookie' ? '🌱' : '🌟') + '</div>' +
      '<div class="award-info"><div class="award-label">' + a.label + '</div>' +
      '<div class="award-winner">' + a.winner + (a.team ? ' · ' + getTeamName(a.team) : '') + '</div></div>' +
      (a.isUser ? '<div class="award-tag">我的选手</div>' : '') + '</div>';
  });
  box.innerHTML = html || '<div style="text-align:center;color:var(--text-dim);padding:24px;">本赛季暂无奖项</div>';
  // 底部按钮：进季后赛或直接看赛季总结（避免没进季后赛时无路可走）
  const actionBtn = document.getElementById('awards-action-btn');
  if (actionBtn) {
    const qualified = getMyRank() <= SIM_CONFIG.SEASON.PLAYOFF_TEAMS;
    actionBtn.textContent = qualified ? '🎯 进入季后赛' : '📊 查看赛季总结';
    actionBtn.onclick = qualified ? goToPlayoffs : showSeasonResult;
  }
}

function goToPlayoffs() {
  if (myNextMatch()) { showHint('常规赛还没打完，先把 39 轮打完！'); return; }
  if (getMyRank() > SIM_CONFIG.SEASON.PLAYOFF_TEAMS) {
    showHint('常规赛排名第 ' + getMyRank() + '，无缘季后赛。前 ' + SIM_CONFIG.SEASON.PLAYOFF_TEAMS + ' 名才能晋级，下赛季加油！');
    return;
  }
  // 已有赛程（季后赛进行中/已打完）不重置；旧存档缺 bracket 时自动补建
  if (!STATE.season || !STATE.season.playoffBracket) initPlayoffs();
  showScreen('screen-playoffs');
  renderPlayoffBracket();
  saveGame();
}

// ==================== 13. 季后赛 ====================
function initPlayoffs() {
  const st = STATE.season.standings;
  const sorted = SIM_CONFIG.TEAMS.slice().sort(function(a, b) {
    const sa = st[a] || { wins: 0, losses: 0 };
    const sb = st[b] || { wins: 0, losses: 0 };
    return (sb.wins - sb.losses) - (sa.wins - sa.losses) || sb.wins - sa.wins;
  });
  STATE.season.isPlayoffs = true;
  STATE.season.playoffBracket = {
    seeds: sorted,
    qf: [
      { id: 'qf1', a: sorted[2], b: sorted[5], result: null },
      { id: 'qf2', a: sorted[3], b: sorted[4], result: null },
    ],
    sf: [
      { id: 'sf1', a: sorted[0], b: null, result: null }, // vs qf2 winner
      { id: 'sf2', a: sorted[1], b: null, result: null }, // vs qf1 winner
    ],
    final: { a: null, b: null, result: null },
    champion: null,
    fmvp: null,
    currentRound: 'qf',
    done: false,
  };
}

function renderPlayoffBracket() {
  const box = document.getElementById('playoff-box');
  const act = document.getElementById('playoff-actions');
  const detail = document.getElementById('playoff-detail');
  const br = STATE.season && STATE.season.playoffBracket;
  if (!br) {
    // 缺 bracket（旧存档/新赛季残留）时把三个卡片全部清空，避免出现“盒子空但按钮残留”
    if (box) box.innerHTML = '';
    if (act) act.innerHTML = '';
    if (detail) detail.innerHTML = '';
    return;
  }
  let html = '<div class="sec-title">🎯 季后赛对阵（BO5）</div>';
  html += '<div class="po-round-title">四分之一决赛</div>';
  br.qf.forEach(function(m) {
    html += '<div class="po-match' + (m.a === STATE.careerTeam || m.b === STATE.careerTeam ? ' po-mine' : '') + '">' +
      '<span class="po-team">' + getTeamName(m.a) + '</span><span class="po-score">' + (m.result ? m.result.score : 'vs') + '</span>' +
      '<span class="po-team">' + getTeamName(m.b) + '</span></div>';
  });
  html += '<div class="po-round-title">半决赛</div>';
  br.sf.forEach(function(m) {
    const b = m.b ? getTeamName(m.b) : '待定';
    html += '<div class="po-match' + (m.a === STATE.careerTeam || m.b === STATE.careerTeam ? ' po-mine' : '') + '">' +
      '<span class="po-team">' + getTeamName(m.a) + '</span><span class="po-score">' + (m.result ? m.result.score : 'vs') + '</span>' +
      '<span class="po-team">' + b + '</span></div>';
  });
  html += '<div class="po-round-title">总决赛</div>';
  if (br.final.a) {
    html += '<div class="po-match po-final' + (br.final.a === STATE.careerTeam || br.final.b === STATE.careerTeam ? ' po-mine' : '') + '">' +
      '<span class="po-team">' + getTeamName(br.final.a) + '</span><span class="po-score">' + (br.final.result ? br.final.result.score : 'vs') + '</span>' +
      '<span class="po-team">' + getTeamName(br.final.b) + '</span></div>';
  }
  if (act) {
    if (br.done) {
      const champ = getTeamName(br.champion);
      act.innerHTML = '<div class="champ-banner">🏆 冠军：' + champ + (br.fmvp === STATE.careerTeam ? ' · 我的选手 FMVP！' : '') + '</div>' +
        '<button class="btn btn-primary" onclick="showSeasonResult()">📊 赛季总结</button>';
    } else {
      const label = br.currentRound === 'qf' ? '模拟四分之一决赛' : br.currentRound === 'sf' ? '模拟半决赛' : '模拟总决赛';
      act.innerHTML = '<button class="btn btn-primary" onclick="simPlayoffRound()">▶ ' + label + '</button>';
    }
  }
  if (br.done) {
    if (detail) detail.innerHTML = renderMyPlayoffSeries();
  }
  box.innerHTML = html;
}

function renderMyPlayoffSeries() {
  const br = STATE.season.playoffBracket;
  const mySeries = [].concat(br.qf, br.sf, [br.final]).filter(function(m) {
    return m && m.result && (m.a === STATE.careerTeam || m.b === STATE.careerTeam);
  });
  let html = '';
  mySeries.forEach(function(m, i) {
    const won = m.result.won === (m.a === STATE.careerTeam);
    html += '<div class="sec-card">' +
      '<div class="po-round-title">' + (i === 0 ? '四分之一决赛' : i === 1 ? '半决赛' : '总决赛') + (won ? ' ✅' : ' ❌') + '</div>' +
      '<div class="po-result">' + getTeamName(m.a) + ' ' + m.result.score + ' ' + getTeamName(m.b) + '</div>' +
      '<div class="po-games">' + m.result.games.map(function(g) { return '<span class="po-game' + (g.aWon ? ' won' : '') + '">' + (m.a === STATE.careerTeam ? (g.aWon ? '胜' : '负') : (g.aWon ? '负' : '胜')) + '</span>'; }).join('') + '</div>' +
      '<div class="po-stats">' + (m.stats ? '我的数据：' + m.stats.kills + '杀 ' + m.stats.deaths + '死 ' + m.stats.assists + '助 · CS ' + m.stats.cs + ' · 伤害 ' + Math.round(m.stats.dmg / 1000) + 'k' : '') + '</div></div>';
  });
  return html;
}

function simPlayoffRound() {
  const br = STATE.season && STATE.season.playoffBracket;
  if (!br || br.done) return;
  // 季后赛关键战：先选战术再打
  if (!STATE._pendingStrategy && hasPendingMyPlayoffMatch(br)) {
    showStrategyModal(null, function() { simPlayoffRound(); });
    return;
  }
  const strategy = STATE._pendingStrategy || null;
  STATE._pendingStrategy = null;
  const pendingEvents = [];
  if (br.currentRound === 'qf') {
    br.qf.forEach(function(m) {
      if (!m.result) {
        const s = (m.a === STATE.careerTeam || m.b === STATE.careerTeam) && strategy ? { id: strategy } : null;
        m.result = simulateSeries(m.a, m.b, true, s);
        if (m.a === STATE.careerTeam || m.b === STATE.careerTeam) {
          m.stats = generatePlayerStats(m.result, true, s);
          addStats(STATE.season.playoffStats, m.stats);
          const g = { home: m.a, away: m.b };
          try { const evData = checkRandomEvents(g, m.result, m.stats); if (evData) pendingEvents.push(evData); } catch (e) {}
        }
      }
    });
    br.sf[0].b = br.qf[1].result.won ? br.qf[1].a : br.qf[1].b;
    br.sf[1].b = br.qf[0].result.won ? br.qf[0].a : br.qf[0].b;
    br.currentRound = 'sf';
  } else if (br.currentRound === 'sf') {
    br.sf.forEach(function(m) {
      if (!m.result) {
        const s = (m.a === STATE.careerTeam || m.b === STATE.careerTeam) && strategy ? { id: strategy } : null;
        m.result = simulateSeries(m.a, m.b, true, s);
        if (m.a === STATE.careerTeam || m.b === STATE.careerTeam) {
          m.stats = generatePlayerStats(m.result, true, s);
          addStats(STATE.season.playoffStats, m.stats);
          const g = { home: m.a, away: m.b };
          try { const evData = checkRandomEvents(g, m.result, m.stats); if (evData) pendingEvents.push(evData); } catch (e) {}
        }
      }
    });
    br.final.a = br.sf[0].result.won ? br.sf[0].a : br.sf[0].b;
    br.final.b = br.sf[1].result.won ? br.sf[1].a : br.sf[1].b;
    br.currentRound = 'final';
  } else if (br.currentRound === 'final') {
    if (!br.final.result) {
      const s = (br.final.a === STATE.careerTeam || br.final.b === STATE.careerTeam) && strategy ? { id: strategy } : null;
      br.final.result = simulateSeries(br.final.a, br.final.b, true, s);
      if (br.final.a === STATE.careerTeam || br.final.b === STATE.careerTeam) {
        br.final.stats = generatePlayerStats(br.final.result, true, s);
        addStats(STATE.season.playoffStats, br.final.stats);
        const g = { home: br.final.a, away: br.final.b };
        try { const evData = checkRandomEvents(g, br.final.result, br.final.stats); if (evData) pendingEvents.push(evData); } catch (e) {}
      }
    }
    br.champion = br.final.result.won ? br.final.a : br.final.b;
    const userWon = br.champion === STATE.careerTeam;
    br.fmvp = userWon ? STATE.careerTeam : br.final.result.won ? br.final.a : br.final.b;
    br.done = true;
    STATE.season.champion = br.champion;
    STATE.season.fmvp = br.fmvp;
    // 赛季目标判定
    if (STATE.season.goal) {
      const myChamp = STATE.season.champion === STATE.careerTeam;
      const inFinal = br.final.a === STATE.careerTeam || br.final.b === STATE.careerTeam;
      const inSF = br.sf.some(function(m) { return m.a === STATE.careerTeam || m.b === STATE.careerTeam; });
      if (STATE.season.goal.type === 'champion') STATE.season.goal.met = myChamp;
      else if (STATE.season.goal.type === 'semifinal') STATE.season.goal.met = inSF || inFinal || myChamp;
      else STATE.season.goal.met = true;
    }
    if (userWon) {
      STATE.career.championships.push({ season: STATE.career.seasonCount + 1, team: STATE.careerTeam, fmvp: true });
      STATE.career.honors.push({ season: STATE.career.seasonCount + 1, type: 'champion', label: '总冠军', team: STATE.careerTeam });
      STATE.career.honors.push({ season: STATE.career.seasonCount + 1, type: 'fmvp', label: '总决赛 FMVP', team: STATE.careerTeam });
    } else {
      const userInFinal = br.final.a === STATE.careerTeam || br.final.b === STATE.careerTeam;
      if (userInFinal) {
        STATE.career.honors.push({ season: STATE.career.seasonCount + 1, type: 'runnerup', label: '亚军', team: STATE.careerTeam });
      }
    }
  }
  renderPlayoffBracket();
  saveGame();
  checkAchievements('playoffs');
  if (pendingEvents.length > 0) showEventModal(pendingEvents[0], function() {});
}

function hasPendingMyPlayoffMatch(br) {
  const matches = br.currentRound === 'qf' ? br.qf : br.currentRound === 'sf' ? br.sf : [br.final];
  return matches.some(function(m) { return m && !m.result && (m.a === STATE.careerTeam || m.b === STATE.careerTeam); });
}

// ==================== 14. 赛季总结 / 生涯 ====================
function showSeasonResult() {
  showScreen('screen-result');
  const ps = STATE.season.stats || {};
  const g = Math.max(1, ps.games || 1);
  const st = STATE.season.standings[STATE.careerTeam] || {};
  const box = document.getElementById('result-box');
  if (!box) return;
  let honorsHtml = '';
  (STATE.season.awards || []).concat((STATE.career.honors || []).filter(function(h) { return h.season === STATE.career.seasonCount + 1; })).forEach(function(a) {
    honorsHtml += '<div class="honor-chip">' + a.label + '</div>';
  });
  box.innerHTML =
    '<div class="reveal-card"><div class="reveal-label">' + getSeasonLabel(STATE.career.seasonCount + 1) + ' 总结</div>' +
    '<div class="big-cname">' + getDisplayName() + '</div>' +
    '<div class="big-pos">' + STATE.season.wins + '胜 ' + STATE.season.losses + '负 · OVR ' + STATE.finalOVR + '</div>' +
    (st.streakType ? '<div class="big-pos" style="font-size:13px;">' + (st.streakType === 'W' ? '🔥 ' + st.streak + ' 连胜' : '❄️ ' + st.streak + ' 连败') + '</div>' : '') +
    (STATE.season.champion === STATE.careerTeam
      ? '<div class="champ-banner">🏆 总冠军' + (STATE.season.fmvp === STATE.careerTeam ? ' + FMVP！' : '') + '</div>'
      : (STATE.season.champion ? '<div class="big-pos" style="color:var(--gold);font-size:14px;">🏆 冠军：' + getTeamName(STATE.season.champion) + '</div>' : '')) +
    '</div>' +
    (STATE.season.goal ? '<div class="section-card"><div class="sec-title">🎯 赛季目标</div><div style="font-size:14px;padding:4px 0;">' + STATE.season.goal.label + '：' + (STATE.season.goal.met === true ? '✅ 达成（训练点 +3）' : STATE.season.goal.met === false ? '❌ 未达成（训练点 -1）' : '⏳ 进行中') + '</div></div>' : '') +
    '<div class="section-card"><div class="sec-title">📊 场均数据</div><div class="avg-grid">' +
    '<div class="avg-item"><b>' + (ps.kills / g).toFixed(1) + '</b><span>击杀</span></div>' +
    '<div class="avg-item"><b>' + (ps.deaths / g).toFixed(1) + '</b><span>死亡</span></div>' +
    '<div class="avg-item"><b>' + (ps.assists / g).toFixed(1) + '</b><span>助攻</span></div>' +
    '<div class="avg-item"><b>' + Math.round(ps.cs / g) + '</b><span>补刀</span></div>' +
    '<div class="avg-item"><b>' + Math.round(ps.dmg / g / 1000) + 'k</b><span>伤害</span></div>' +
    '<div class="avg-item"><b>' + Math.round(ps.vision / g) + '</b><span>视野分</span></div>' +
    '</div></div>' +
    (STATE.season.bestSeries ? (function() {
      const b = STATE.season.bestSeries;
      return '<div class="section-card"><div class="sec-title">🔥 赛季最佳表现</div>' +
        '<div class="best-series">对阵 ' + getTeamName(b.opp) + ' · 第' + b.round + '轮：' +
        b.stats.kills + '杀 ' + b.stats.deaths + '死 ' + b.stats.assists + '助 · CS ' + b.stats.cs +
        ' · 伤害 ' + Math.round(b.stats.dmg / 1000) + 'k</div></div>';
    })() : '') +
    ((STATE.season.playoffStats && STATE.season.playoffStats.games > 0) ? (function() {
      const pos = STATE.season.playoffStats;
      const gp2 = Math.max(1, pos.games);
      return '<div class="section-card"><div class="sec-title">🏆 季后赛数据</div><div class="avg-grid">' +
        '<div class="avg-item"><b>' + (pos.kills / gp2).toFixed(1) + '</b><span>击杀</span></div>' +
        '<div class="avg-item"><b>' + (pos.deaths / gp2).toFixed(1) + '</b><span>死亡</span></div>' +
        '<div class="avg-item"><b>' + (pos.assists / gp2).toFixed(1) + '</b><span>助攻</span></div>' +
        '<div class="avg-item"><b>' + Math.round(pos.dmg / gp2 / 1000) + 'k</b><span>伤害</span></div>' +
        '</div></div>';
    })() : '') +
    '<div class="section-card"><div class="sec-title">🏅 荣誉</div><div class="honor-wrap">' + (honorsHtml || '<span style="color:var(--text-dim)">暂无</span>') + '</div></div>' +
    '<div style="text-align:center;padding:8px;"><button class="btn btn-primary" onclick="openTransferWindow()">🔄 转会窗口 → 休赛期</button>' +
    '<button class="btn" style="margin-left:8px;" onclick="showCareerStats()">📋 生涯数据</button>' +
    '<button class="btn" style="margin-left:8px;" onclick="generatePoster()">🖼️ 生成海报</button></div>';
}

function advanceCareerSeason() {
  const c = STATE.career;
  if (!c.seasonHistory) c.seasonHistory = [];
  c.seasonCount++;
  c.currentAge++;
  STATE.career.peakOVR = Math.max(STATE.career.peakOVR || 0, STATE.finalOVR || 0);
  // 记录季后赛深度（1=八强 2=四强 3=决赛 4=冠军）
  const br = STATE.season.playoffBracket;
  let playoffDepth = 0;
  if (br && br.done) {
    if (STATE.season.champion === STATE.careerTeam) playoffDepth = 4;
    else if (br.final && (br.final.a === STATE.careerTeam || br.final.b === STATE.careerTeam)) playoffDepth = 3;
    else if (br.sf && br.sf.some(function(m) { return m.a === STATE.careerTeam || m.b === STATE.careerTeam; })) playoffDepth = 2;
    else if (br.qf && br.qf.some(function(m) { return m.a === STATE.careerTeam || m.b === STATE.careerTeam; })) playoffDepth = 1;
  }
  // 记录上赛季
  STATE.career.seasonHistory.push({
    season: c.seasonCount,
    wins: STATE.season.wins, losses: STATE.season.losses,
    stats: STATE.season.stats,
    champion: STATE.season.champion,
    awards: STATE.season.awards,
    playoffDepth: playoffDepth,
    goalMet: STATE.season.goal ? STATE.season.goal.met : null,
  });
  checkAchievements('season');
}

function startNextSeason() {
  advanceCareerSeason();
  startSeason();
}

// ==================== 15. 休赛期训练营（加点） ====================
function clampAttrVal(v) {
  return Math.max(25, Math.min(99, Math.round(v)));
}

function applyAnnualAttributeDrift() {
  const c = STATE.career;
  if (!c) return [];
  const seasonKey = c.seasonCount || 0;
  if (c.annualChangeSeason === seasonKey) return c.lastAnnualChanges || [];
  const age = c.currentAge || 18;
  const changes = [];
  const fastDecline = ['TANK', 'MOB', 'SPLIT'];
  const midDecline = ['DPS', 'BURST', 'LANE'];
  const slowTech = ['TEAM', 'CC', 'VISION', 'ROAM', 'CLU'];
  function applyList(list, minDelta, maxDelta, label) {
    list.forEach(function(k) {
      const delta = minDelta + Math.floor(Math.random() * (maxDelta - minDelta + 1));
      if (delta !== 0) {
        STATE.attrs[k] = clampAttrVal((STATE.attrs[k] || 50) + delta);
        changes.push((delta > 0 ? '+' : '') + delta + ' ' + attrCN(k) + (label ? '（' + label + '）' : ''));
      }
    });
  }
  if (age <= 20) {
    applyList(slowTech.concat(['MECH', 'LANE']), 0, 1, '涨球期成长');
  } else if (age <= 26) {
    ATTR_KEYS.forEach(function(k) {
      if (Math.random() < 0.25) {
        const d = Math.random() < 0.5 ? 1 : -1;
        STATE.attrs[k] = clampAttrVal((STATE.attrs[k] || 50) + d);
        changes.push((d > 0 ? '+' : '') + d + ' ' + attrCN(k) + '（状态波动）');
      }
    });
  } else if (age <= 32) {
    applyList(fastDecline, -2, -1, '身体下滑');
    applyList(slowTech, 0, 1, '经验增长');
  } else {
    applyList(fastDecline, -3, -2, '年龄下滑');
    applyList(midDecline, -2, -1, '年龄影响');
    applyList(slowTech, -1, 0, '技术维持');
  }
  STATE.finalOVR = calcOVRFromAttrs();
  c.annualChangeSeason = seasonKey;
  c.lastAnnualChanges = changes;
  return changes;
}

function calcOVRFromAttrs() {
  const weights = SIM_CONFIG.OVR_WEIGHTS[STATE.position] || {};
  let ovr = 0;
  ATTR_KEYS.forEach(function(k) { ovr += (STATE.attrs[k] || 50) * (weights[k] || 0.07); });
  return Math.round(ovr);
}

function calcTrainingPoints() {
  const s = STATE.season;
  if (!s) return 1;
  let pts = 0;
  // 季后赛成绩
  if (s.playoffBracket) {
    const mySeries = [].concat(s.playoffBracket.qf || [], s.playoffBracket.sf || [], s.playoffBracket.final ? [s.playoffBracket.final] : [])
      .filter(function(m) { return m && m.result && (m.a === STATE.careerTeam || m.b === STATE.careerTeam); });
    if (mySeries.length > 0) {
      const last = mySeries[mySeries.length - 1];
      const isFinal = last === s.playoffBracket.final;
      const userWon = last.result.won ? (last.a === STATE.careerTeam) : (last.b === STATE.careerTeam);
      if (isFinal) pts = Math.max(pts, userWon ? 6 : 5);
      else if (last === s.playoffBracket.sf[0] || last === s.playoffBracket.sf[1]) pts = Math.max(pts, 4);
      else pts = Math.max(pts, 3);
    }
  }
  // 个人数据与荣誉
  const ps = s.stats || {};
  const g = Math.max(1, ps.games || 1);
  let personal = 0;
  if ((ps.kills || 0) / g >= 4) personal++;
  if ((ps.assists || 0) / g >= 8) personal++;
  if ((ps.cs || 0) / g >= 250) personal++;
  const awards = (s.awards || []).map(function(a) { return a.label || ''; });
  if (awards.some(function(l) { return l.indexOf('MVP') >= 0; })) personal++;
  if (awards.some(function(l) { return l.indexOf('最佳阵容') >= 0; })) personal++;
  if (awards.some(function(l) { return l.indexOf('最佳新秀') >= 0; })) personal++;
  if (awards.some(function(l) { return l.indexOf('FMVP') >= 0; })) personal++;
  if (awards.some(function(l) { return l.indexOf('全明星') >= 0; })) personal++;
  const base = Math.max(pts, personal) || 1;
  // 赛季目标奖惩：达成 +3 训练点，未达成 -1（保底 1 点）
  const goal = STATE.season && STATE.season.goal;
  if (goal && goal.met === true) return base + 3;
  if (goal && goal.met === false) return Math.max(1, base - 1);
  return base;
}

function getPointCost(val) {
  if (val >= 96) return 4;
  if (val >= 90) return 2;
  return 1;
}

function beginOffseason() {
  updateCareerProfile();
  const c = STATE.career;
  // 今年已选过“再战一年”则不再弹退役框（避免同一年循环弹）
  if (c.flags && c.flags.playOneMoreAge === c.currentAge) {
    c.flags.playOneMoreAge = null;
  } else if (checkRetirement()) {
    return;
  }
  const changes = applyAnnualAttributeDrift();
  STATE._offseasonDrift = changes;
  renderTrainingCamp();
}

function renderTrainingCamp() {
  showScreen('screen-training');
  const c = STATE.career;
  const tp = calcTrainingPoints();
  if (!STATE._tpPending) STATE._tpPending = {};
  const sub = document.getElementById('training-sub');
  if (sub) sub.textContent = getSeasonLabel(c.seasonCount + 1) + ' 休赛期 · 年龄 ' + c.currentAge;
  const driftBox = document.getElementById('training-drift');
  if (driftBox) {
    const changes = STATE._offseasonDrift || [];
    driftBox.innerHTML = changes.length
      ? '<div class="tp-drift-title">📈 赛季属性自然变化</div><div class="tp-drift-list">' + changes.map(function(x) { return '<span>' + x + '</span>'; }).join('') + '</div>'
      : '<div class="tp-drift-title">📈 赛季属性自然变化</div><div class="tp-drift-list"><span style="color:var(--text-dim)">本赛季没有明显变化</span></div>';
  }
  renderTrainingAttrs(tp);
}

function renderTrainingAttrs(tp) {
  const attrsEl = document.getElementById('tp-attrs');
  if (!attrsEl) return;
  const pending = STATE._tpPending || {};
  let used = 0;
  Object.keys(pending).forEach(function(k) { used += pending[k] || 0; });
  const remaining = tp - used;
  const header = document.getElementById('tp-points');
  if (header) header.textContent = used + ' / ' + tp + ' 训练点数 · 剩余 ' + remaining;
  let html = '';
  ATTR_KEYS.forEach(function(k) {
    const cur = STATE.attrs[k] || 50;
    const added = pending[k] || 0;
    const after = Math.min(99, cur + added);
    const cost = getPointCost(after);
    const disabled = added >= 8 || remaining < cost || cur >= 99;
    const pct = Math.min(100, cur);
    const addPct = after > cur ? Math.min(100, after) - pct : 0;
    const curGrade = getGrade(cur).letter;
    const afterGrade = getGrade(after).letter;
    const gradeShown = afterGrade !== curGrade ? '<span style="color:var(--gold);font-weight:700;">' + curGrade + '→' + afterGrade + '</span>' : curGrade;
    html += '<div class="tp-row' + (added > 0 ? ' tp-added' : '') + '">' +
      '<span class="tp-label">' + attrCN(k) + '</span>' +
      '<div class="tp-bar-wrap"><div class="tp-bar-fill" style="width:' + pct + '%"></div>' +
      (addPct > 0 ? '<div class="tp-bar-add" style="width:' + addPct + '%;left:' + pct + '%"></div>' : '') + '</div>' +
      '<span class="tp-val' + (added > 0 ? ' tp-preview' : '') + '">' + cur + (added > 0 ? '→' + after : '') + '</span>' +
      '<span class="tp-grade">' + gradeShown + '</span>' +
      '<button class="tp-btn" id="tp-btn-' + k + '" ' + (disabled ? 'disabled' : '') + ' onclick="addTrainingPoint(\'' + k + '\')">+</button>' +
      (cost > 1 ? '<span style="font-size:9px;color:var(--text-dim);min-width:22px;">×' + cost + '</span>' : '<span style="min-width:22px;"></span>') +
      '</div>';
  });
  attrsEl.innerHTML = html;
}

function addTrainingPoint(key) {
  if (!STATE._tpPending) STATE._tpPending = {};
  const tp = calcTrainingPoints();
  let used = 0;
  Object.keys(STATE._tpPending).forEach(function(k) { used += STATE._tpPending[k] || 0; });
  const cur = STATE.attrs[key] || 50;
  const added = STATE._tpPending[key] || 0;
  const after = Math.min(99, cur + added);
  const cost = getPointCost(after);
  if (added >= 8 || used + cost > tp || cur >= 99) return;
  STATE._tpPending[key] = added + 1;
  renderTrainingAttrs(tp);
}

function resetTraining() {
  STATE._tpPending = {};
  renderTrainingAttrs(calcTrainingPoints());
}

function confirmTraining() {
  const pending = STATE._tpPending || {};
  Object.keys(pending).forEach(function(k) {
    STATE.attrs[k] = clampAttrVal((STATE.attrs[k] || 50) + (pending[k] || 0));
  });
  STATE._tpPending = {};
  STATE.finalOVR = calcOVRFromAttrs();
  advanceCareerSeason();
  saveGame();
  showRosterReview();
}

// ==================== 16. 转会窗口 ====================
function applyRosterOverrides() {
  if (!STATE || !STATE.career) return;
  const ov = STATE.career.rosterOverride;
  if (!ov || typeof ov !== 'object') return;
  SIM_CONFIG.TEAMS.forEach(function(team) {
    const over = ov[team];
    if (!over || typeof over !== 'object') return;
    SIM_CONFIG.POS_LIST.forEach(function(pos) {
      if (Array.isArray(over[pos])) TEAM_ROSTERS[team][pos] = over[pos].slice();
    });
  });
}

function persistRosterOverride() {
  STATE.career.rosterOverride = JSON.parse(JSON.stringify(TEAM_ROSTERS));
  saveGame();
}

function addTransferHistory(type, text) {
  STATE.career.transferHistory.push({ season: STATE.career.seasonCount + 1, type: type, text: text });
}

function getBenchCandidates(team, pos) {
  const list = TEAM_ROSTERS[team] && TEAM_ROSTERS[team][pos] ? TEAM_ROSTERS[team][pos] : [];
  return list.slice(1); // 数组首位是首发，其余为替补
}

function openTransferWindow() {
  showScreen('screen-transfer');
  const c = STATE.career;
  if (!STATE._transferDone || STATE._transferDone !== c.seasonCount) {
    STATE._transferNews = generateTransferMoves();
    STATE._transferOffer = rollTransferOffer();
    STATE._transferDone = c.seasonCount;
  }
  renderTransferWindow();
  saveGame();
}

function generateTransferMoves() {
  const news = [];
  const seasonKey = STATE.career.seasonCount + 1;
  const positions = ['TOP', 'JG', 'MID', 'ADC', 'SUP'];
  // 1~2 笔 AI 队替补互换（同位置）
  const moveCount = Math.random() < 0.4 ? 2 : 1;
  for (let i = 0; i < moveCount; i++) {
    const pos = positions[Math.floor(Math.random() * positions.length)];
    const teamsWithBench = SIM_CONFIG.TEAMS.filter(function(t) { return getBenchCandidates(t, pos).length > 0; });
    if (teamsWithBench.length < 2) continue;
    const a = teamsWithBench[Math.floor(Math.random() * teamsWithBench.length)];
    let b = a;
    let guard = 0;
    while (b === a && guard < 10) { b = teamsWithBench[Math.floor(Math.random() * teamsWithBench.length)]; guard++; }
    if (b === a) continue;
    const benchA = getBenchCandidates(a, pos);
    const benchB = getBenchCandidates(b, pos);
    const pa = benchA[Math.floor(Math.random() * benchA.length)];
    const pb = benchB[Math.floor(Math.random() * benchB.length)];
    const listA = TEAM_ROSTERS[a][pos].slice();
    const listB = TEAM_ROSTERS[b][pos].slice();
    const ia = listA.indexOf(pa), ib = listB.indexOf(pb);
    if (ia < 0 || ib < 0) continue;
    listA[ia] = pb; listB[ib] = pa;
    TEAM_ROSTERS[a][pos] = listA;
    TEAM_ROSTERS[b][pos] = listB;
    const text = pa + ' 与 ' + pb + ' 互换东家：' + getTeamName(a) + ' ↔ ' + getTeamName(b) + '（' + SIM_CONFIG.POSITIONS[pos] + '）';
    news.push({ emoji: '🔄', title: '互换转会', text: text });
    addTransferHistory('trade', text);
  }
  // 有时我的队会引进一名其他队的替补
  if (Math.random() < 0.5) {
    const myTeam = STATE.careerTeam;
    const others = SIM_CONFIG.TEAMS.filter(function(t) { return t !== myTeam; });
    const shuffled = shuffleArr(others);
    let moved = false;
    for (let s = 0; s < shuffled.length && !moved; s++) {
      const from = shuffled[s];
      const posList = SIM_CONFIG.POS_LIST.slice();
      shuffleArr(posList);
      for (let p = 0; p < posList.length && !moved; p++) {
        const pos = posList[p];
        const bench = getBenchCandidates(from, pos);
        if (bench.length === 0) continue;
        const pb = bench[Math.floor(Math.random() * bench.length)];
        const myList = TEAM_ROSTERS[myTeam][pos] || [];
        if (myList.indexOf(pb) >= 0) continue;
        TEAM_ROSTERS[from][pos] = TEAM_ROSTERS[from][pos].filter(function(x) { return x !== pb; });
        if (!TEAM_ROSTERS[myTeam][pos]) TEAM_ROSTERS[myTeam][pos] = [];
        TEAM_ROSTERS[myTeam][pos].push(pb);
        const text = getTeamName(myTeam) + ' 官宣签下 ' + pb + '（' + SIM_CONFIG.POSITIONS[pos] + '），离队自 ' + getTeamName(from);
        news.push({ emoji: '📝', title: '引援补强', text: text });
        addTransferHistory('sign', text);
        moved = true;
      }
    }
  }
  persistRosterOverride();
  return news;
}

function rollTransferOffer() {
  const c = STATE.career;
  if (!c) return null;
  let chance = 0.4;
  const st = STATE.season.standings;
  const rankList = SIM_CONFIG.TEAMS.slice().sort(function(a, b) {
    const sa = st[a] || { wins: 0, losses: 0 };
    const sb = st[b] || { wins: 0, losses: 0 };
    return (sb.wins - sb.losses) - (sa.wins - sa.losses) || sb.wins - sa.wins;
  });
  const myRank = rankList.indexOf(STATE.careerTeam) + 1;
  if (myRank <= 4) chance += 0.15;   // 打得好被豪门挖
  if (myRank >= 10) chance += 0.15;  // 队太烂，球员想走
  if (STATE.season.champion === STATE.careerTeam) chance += 0.1;
  if (Math.random() >= chance) return null;
  const candidates = rankList.filter(function(t) { return t !== STATE.careerTeam; }).slice(0, 6);
  if (candidates.length === 0) return null;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  return { team: target, season: c.seasonCount + 1 };
}

function renderTransferWindow() {
  const box = document.getElementById('transfer-box');
  if (!box) return;
  let html = '<div class="section-card"><div class="sec-title">🔄 ' + getSeasonLabel(STATE.career.seasonCount + 1) + ' 转会窗口</div>';
  const news = STATE._transferNews || [];
  if (news.length === 0) {
    html += '<div style="text-align:center;color:var(--text-dim);font-size:12px;padding:8px;">转会窗口风平浪静，没有发生交易。</div>';
  } else {
    html += '<div class="ev-timeline">' + news.map(function(n) {
      return '<div class="ev-item"><span class="ev-dot">' + n.emoji + '</span>' +
        '<div class="ev-item-body"><div class="ev-item-title">' + n.title + '</div>' +
        '<div class="ev-item-meta">' + n.text + '</div></div></div>';
    }).join('') + '</div>';
  }
  html += '</div>';
  // 我的转会报价
  if (STATE._transferOffer && STATE._transferOffer.team) {
    const t = STATE._transferOffer.team;
    html += '<div class="section-card offer-card">' +
      '<div class="sec-title">📨 转会报价</div>' +
      '<div style="font-size:14px;line-height:1.8;margin-bottom:10px;">' + getTeamName(t) + ' 向你发出邀请：<b>' + getTeamName(t) + '</b> 开出了更高的战术地位和夺冠前景，你愿意加盟吗？</div>' +
      '<div style="display:flex;gap:10px;justify-content:center;">' +
      '<button class="btn btn-primary btn-sm" onclick="acceptTransferOffer()">✅ 转会加盟</button>' +
      '<button class="btn btn-sm" onclick="rejectTransferOffer()">🤝 留在 ' + getTeamName(STATE.careerTeam) + '</button>' +
      '</div></div>';
  } else {
    html += '<div class="section-card"><div class="sec-title">📨 转会报价</div>' +
      '<div style="text-align:center;color:var(--text-dim);font-size:12px;padding:6px;">本赛季没有收到报价，你继续留队。</div></div>';
  }
  // 历史
  const hist = (STATE.career.transferHistory || []).slice(-8);
  html += '<div class="section-card"><div class="sec-title">📖 转会历史</div>';
  if (hist.length === 0) {
    html += '<div style="text-align:center;color:var(--text-dim);font-size:12px;padding:6px;">暂无转会记录</div>';
  } else {
    html += '<div class="ev-timeline">' + hist.map(function(h) {
      return '<div class="ev-item"><span class="ev-dot">' + (h.type === 'user' ? '🌟' : h.type === 'sign' ? '📝' : '🔄') + '</span>' +
        '<div class="ev-item-body"><div class="ev-item-meta">第' + h.season + '赛季 · ' + h.text + '</div></div></div>';
    }).join('') + '</div>';
  }
  html += '</div>';
  html += '<div style="text-align:center;padding:8px;"><button class="btn btn-primary" onclick="beginOffseason()">🏋️ 进入休赛期训练</button></div>';
  box.innerHTML = html;
}

function acceptTransferOffer() {
  const off = STATE._transferOffer;
  if (!off || !off.team) return;
  const from = getTeamName(STATE.careerTeam);
  const to = getTeamName(off.team);
  STATE.careerTeam = off.team;
  addTransferHistory('user', '我转会加盟 ' + to);
  STATE._transferOffer = null;
  saveGame();
  renderTransferWindow();
}

function rejectTransferOffer() {
  STATE._transferOffer = null;
  saveGame();
  renderTransferWindow();
}

// ==================== 17. 成就系统 ====================
const ACHIEVEMENT_DEFS = [
  { id: 'first_win', label: '首胜', emoji: '🎉', desc: '赢下生涯第一场系列赛' },
  { id: 'streak5', label: '五连胜', emoji: '🔥', desc: '常规赛取得 5 连胜' },
  { id: 'streak10', label: '十连胜', emoji: '⚡', desc: '常规赛取得 10 连胜' },
  { id: 'win20', label: '单赛季 20 胜', emoji: '🏔️', desc: '单个常规赛赢下 20 场' },
  { id: 'full_attendance', label: '赛季全勤', emoji: '💯', desc: '单赛季 39 轮全部出战' },
  { id: 'allstar', label: '全明星', emoji: '⭐', desc: '入选全明星' },
  { id: 'allteam', label: '最佳阵容', emoji: '🛡️', desc: '入选赛季最佳阵容' },
  { id: 'rookie', label: '最佳新秀', emoji: '🌱', desc: '获得最佳新秀' },
  { id: 'mvp', label: '常规赛 MVP', emoji: '👑', desc: '获得常规赛 MVP' },
  { id: 'champion', label: '总冠军', emoji: '🏆', desc: '随队夺得总冠军' },
  { id: 'fmvp', label: '总决赛 FMVP', emoji: '🌟', desc: '总决赛 FMVP' },
  { id: 'career100', label: '生涯百胜', emoji: '📜', desc: '生涯常规赛累计 100 胜' },
];

function unlockAchievement(id, season) {
  const def = ACHIEVEMENT_DEFS.find(function(a) { return a.id === id; });
  if (!def) return false;
  STATE.career.achievements = STATE.career.achievements || [];
  if (STATE.career.achievements.some(function(a) { return a.id === id; })) return false;
  STATE.career.achievements.push({ id: id, label: def.label, emoji: def.emoji, season: season || (STATE.career.seasonCount + 1) });
  showAchievementToast(def);
  saveGame();
  return true;
}

function showAchievementToast(def) {
  const toast = document.getElementById('ach-toast');
  if (!toast) return;
  toast.innerHTML = '<div class="ach-toast-icon">' + def.emoji + '</div>' +
    '<div><div class="ach-toast-title">成就解锁：' + def.label + '</div>' +
    '<div class="ach-toast-desc">' + def.desc + '</div></div>';
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, 3200);
}

function checkAchievements(phase) {
  const c = STATE.career;
  const s = STATE.season;
  const season = c.seasonCount + 1;
  c.achievements = c.achievements || [];
  if (phase === 'game') {
    if (s.wins + s.losses === 1 && s.wins === 1) unlockAchievement('first_win', season);
    const streak = s.standings[STATE.careerTeam] || {};
    if (streak.streak >= 5 && streak.streakType === 'W') unlockAchievement('streak5', season);
    if (streak.streak >= 10 && streak.streakType === 'W') unlockAchievement('streak10', season);
  } else if (phase === 'awards') {
    const labels = (s.awards || []).map(function(a) { return a.label || ''; });
    if (labels.some(function(l) { return l.indexOf('MVP') >= 0; })) unlockAchievement('mvp', season);
    if (labels.some(function(l) { return l.indexOf('最佳阵容') >= 0; })) unlockAchievement('allteam', season);
    if (labels.some(function(l) { return l.indexOf('最佳新秀') >= 0; })) unlockAchievement('rookie', season);
    if (labels.some(function(l) { return l.indexOf('全明星') >= 0; })) unlockAchievement('allstar', season);
  } else if (phase === 'playoffs') {
    if (s.champion === STATE.careerTeam) {
      unlockAchievement('champion', season);
      if (s.fmvp === STATE.careerTeam) unlockAchievement('fmvp', season);
    }
  } else if (phase === 'season') {
    if (s.wins >= 20) unlockAchievement('win20', season);
    const skipped = (s.series || []).filter(function(x) { return x.skipReason; }).length;
    if (s.wins + s.losses + skipped === 39) unlockAchievement('full_attendance', season);
    const careerWins = (c.seasonHistory || []).reduce(function(sum, h) { return sum + (h.wins || 0); }, 0);
    if (careerWins >= 100) unlockAchievement('career100', season);
  }
}

function renderAchievementsScreen() {
  showScreen('screen-achievements');
  const box = document.getElementById('ach-content');
  if (!box) return;
  const unlocked = STATE.career.achievements || [];
  const unlockedIds = {};
  unlocked.forEach(function(a) { unlockedIds[a.id] = a; });
  let html = '<div class="ach-grid">';
  ACHIEVEMENT_DEFS.forEach(function(def) {
    const got = unlockedIds[def.id];
    html += '<div class="ach-card' + (got ? ' ach-got' : '') + '">' +
      '<div class="ach-emoji">' + (got ? def.emoji : '🔒') + '</div>' +
      '<div class="ach-label">' + def.label + '</div>' +
      '<div class="ach-desc">' + def.desc + '</div>' +
      (got ? '<div class="ach-season">第' + got.season + '赛季</div>' : '<div class="ach-season">未解锁</div>') +
      '</div>';
  });
  html += '</div>';
  box.innerHTML = html;
}

// ==================== 18. My Card / 荣誉墙 / 阵容预览 ====================
function getSalary() {
  const p = STATE.career.profile || {};
  return Math.round((STATE.finalOVR - 50) * 18 + p.fame * 26 + p.businessValue * 4);
}

function showMyCard() {
  showScreen('screen-mycard');
  const box = document.getElementById('mycard-content');
  if (!box) return;
  const s = STATE.season;
  const ps = s.stats || {};
  const g = Math.max(1, ps.games || 1);
  const pos = getPosName(STATE.position);
  const p = STATE.career.profile || {};
  let html = '<div class="reveal-card"><div class="reveal-label">📊 My Card</div>' +
    '<div class="big-cname">' + getDisplayName() + '</div>' +
    '<div class="big-pos">' + pos + ' · OVR ' + STATE.finalOVR + ' · ' + getOvrGrade(STATE.finalOVR) + '</div>' +
    '<div class="mc-team">' + getTeamName(STATE.careerTeam) + ' · ' + STATE.career.currentAge + '岁 · 第' + (STATE.career.seasonCount + 1) + '赛季</div></div>';
  html += '<div class="section-card"><div class="sec-title">📊 本赛季场均</div><div class="avg-grid">' +
    '<div class="avg-item"><b>' + (ps.kills / g).toFixed(1) + '</b><span>击杀</span></div>' +
    '<div class="avg-item"><b>' + (ps.deaths / g).toFixed(1) + '</b><span>死亡</span></div>' +
    '<div class="avg-item"><b>' + (ps.assists / g).toFixed(1) + '</b><span>助攻</span></div>' +
    '<div class="avg-item"><b>' + Math.round(ps.cs / g) + '</b><span>补刀</span></div>' +
    '<div class="avg-item"><b>' + Math.round(ps.dmg / g / 1000) + 'k</b><span>伤害</span></div>' +
    '<div class="avg-item"><b>' + Math.round(ps.vision / g) + '</b><span>视野分</span></div>' +
    '</div></div>';
  const pos2 = s.playoffStats || {};
  const gp2 = Math.max(1, pos2.games || 1);
  if ((pos2.games || 0) > 0) {
    html += '<div class="section-card"><div class="sec-title">🏆 季后赛数据</div><div class="avg-grid">' +
      '<div class="avg-item"><b>' + (pos2.kills / gp2).toFixed(1) + '</b><span>击杀</span></div>' +
      '<div class="avg-item"><b>' + (pos2.deaths / gp2).toFixed(1) + '</b><span>死亡</span></div>' +
      '<div class="avg-item"><b>' + (pos2.assists / gp2).toFixed(1) + '</b><span>助攻</span></div>' +
      '<div class="avg-item"><b>' + Math.round(pos2.dmg / gp2 / 1000) + 'k</b><span>伤害</span></div>' +
      '</div></div>';
  }
  let attrHtml = '';
  ATTR_KEYS.forEach(function(k) {
    const v = STATE.attrs[k] || 50;
    const gr = getGrade(v);
    attrHtml += '<div class="mc-attr"><span>' + attrCN(k) + '</span><b style="color:' + gr.color + '">' + v + ' ' + gr.letter + '</b></div>';
  });
  html += '<div class="section-card"><div class="sec-title">🏷️ 当前属性</div><div class="mc-attrs">' + attrHtml + '</div></div>';
  html += '<div class="section-card"><div class="sec-title">🌟 生涯影响力</div><div class="profile-grid">' +
    '<div class="profile-item"><b>' + p.fame + '</b><span>声望</span></div>' +
    '<div class="profile-item"><b>' + p.popularity + '</b><span>人气</span></div>' +
    '<div class="profile-item"><b>' + p.businessValue + '</b><span>商业价值</span></div>' +
    '<div class="profile-item"><b>' + getSalary() + '万</b><span>年薪</span></div>' +
    '</div></div>';
  html += '<div style="text-align:center;padding:8px;"><button class="btn btn-primary" onclick="showCareerStats()">📋 生涯数据</button>' +
    '<button class="btn" style="margin-left:8px;" onclick="renderAchievementsScreen()">🏅 成就墙</button>' +
    '<button class="btn" style="margin-left:8px;" onclick="showCareerHonors()">🏆 荣誉墙</button></div>';
  box.innerHTML = html;
}

function showCareerHonors() {
  showScreen('screen-career-honors');
  const box = document.getElementById('honors-content');
  if (!box) return;
  const c = STATE.career;
  let html = '<div class="section-card"><div class="sec-title">🏆 荣誉墙 · 共 ' + c.honors.length + ' 项</div>';
  if (c.honors.length === 0) {
    html += '<div style="text-align:center;color:var(--text-dim);padding:16px;">暂无荣誉，快去打比赛吧</div>';
  } else {
    const bySeason = {};
    c.honors.forEach(function(h) {
      const k = h.season || 1;
      (bySeason[k] = bySeason[k] || []).push(h);
    });
    Object.keys(bySeason).sort(function(a, b) { return b - a; }).forEach(function(season) {
      html += '<div class="honor-season"><div class="honor-season-title">📅 第' + season + '赛季</div><div class="honor-wrap">' +
        bySeason[season].map(function(h) { return '<div class="honor-chip">' + h.label + '</div>'; }).join('') + '</div></div>';
    });
    const counts = {};
    c.honors.forEach(function(h) { counts[h.label] = (counts[h.label] || 0) + 1; });
    html += '<div class="honor-summary">📊 生涯总计：' + Object.keys(counts).map(function(k) { return counts[k] + '×' + k; }).join(' · ') + '</div>';
  }
  html += '</div>';
  html += '<div style="text-align:center;padding:8px;"><button class="btn btn-primary" onclick="showMyCard()">📊 My Card</button>' +
    '<button class="btn" style="margin-left:8px;" onclick="showCareerStats()">📋 生涯数据</button></div>';
  box.innerHTML = html;
}

function showRosterReview() {
  showScreen('screen-roster-review');
  const box = document.getElementById('roster-review-content');
  if (!box) return;
  const c = STATE.career;
  const lineup = calcTeamLineup(STATE.careerTeam);
  const prev = c.seasonHistory[c.seasonHistory.length - 1];
  const prevRecord = prev ? (prev.wins + '-' + prev.losses) : '新赛季';
  let html = '<div class="reveal-card"><div class="reveal-label">' + getSeasonLabel(c.seasonCount + 1) + '</div>' +
    '<div class="big-cname">' + getTeamName(STATE.careerTeam) + '</div>' +
    '<div class="big-pos">' + getPosName(STATE.position) + ' · OVR ' + STATE.finalOVR + ' · ' + c.currentAge + '岁</div>' +
    '<div style="font-size:12px;color:var(--text-dim);">上赛季 ' + prevRecord + '</div></div>';
  html += '<div class="section-card"><div class="sec-title">⚔️ 首发阵容</div>';
  (lineup.starters || []).forEach(function(p) {
    html += '<div class="roster-row' + (p._isUser ? ' me' : '') + '">' +
      '<span class="rr-icon">' + (SIM_CONFIG.POS_ICONS[p.pos] || '⭐') + '</span>' +
      '<span class="rr-pos">' + getPosName(p.pos) + '</span>' +
      '<span class="rr-name">' + p.id + (p._isUser ? ' ⭐' : '') + '</span>' +
      '<span class="rr-ovr">' + p.ovr + '</span></div>';
  });
  html += '</div>';
  const bench = (lineup.allPlayers || []).filter(function(p) { return !(lineup.starters || []).some(function(s) { return s.id === p.id && s.pos === p.pos; }); });
  if (bench.length > 0) {
    html += '<div class="section-card"><div class="sec-title">🔄 替补席</div>';
    bench.forEach(function(p) {
      html += '<div class="roster-row"><span class="rr-icon">' + (SIM_CONFIG.POS_ICONS[p.pos] || '⭐') + '</span>' +
        '<span class="rr-pos">' + getPosName(p.pos) + '</span>' +
        '<span class="rr-name">' + p.id + '</span><span class="rr-ovr">' + p.ovr + '</span></div>';
    });
    html += '</div>';
  }
  html += '<div style="text-align:center;padding:8px;"><button class="btn btn-primary" onclick="startNewSeasonBtn()">🏆 开始新赛季</button>' +
    '<button class="btn" style="margin-left:8px;" onclick="showCareerStats()">📋 生涯数据</button></div>';
  box.innerHTML = html;
}

function startNewSeasonBtn() {
  STATE._pendingSeasonStart = false;
  startSeason();
}

// ==================== 19. 退役与生涯结算 ====================
function updateCareerProfile() {
  const p = STATE.career.profile;
  const s = STATE.season;
  const labels = (s.awards || []).map(function(a) { return a.label || ''; });
  let fame = 1;
  if (labels.some(function(l) { return l.indexOf('MVP') >= 0; })) fame += 3;
  if (labels.some(function(l) { return l.indexOf('FMVP') >= 0; })) fame += 2;
  if (s.champion === STATE.careerTeam) fame += 2;
  if (labels.some(function(l) { return l.indexOf('全明星') >= 0; })) fame += 1;
  if (labels.some(function(l) { return l.indexOf('最佳阵容') >= 0; })) fame += 1;
  if (labels.some(function(l) { return l.indexOf('最佳新秀') >= 0; })) fame += 1;
  p.fame += fame;
  p.popularity = Math.max(0, p.popularity + Math.round(s.wins * 0.4 + fame * 2));
  p.businessValue = Math.max(0, p.businessValue + Math.round(s.wins * 0.2 + fame));
  if (s.champion === STATE.careerTeam) p.legacy += 2;
  if (labels.some(function(l) { return l.indexOf('MVP') >= 0; })) p.legacy += 2;
  if (labels.some(function(l) { return l.indexOf('FMVP') >= 0; })) p.legacy += 2;
}

function checkRetirement() {
  const c = STATE.career;
  if (c.retired) return true;
  const age = c.currentAge;
  // 25、26 岁每年弹出退役抉择；27 岁起强制退役（不可再延迟）
  if (age >= 27) {
    showRetirementChoice(true);
    return true;
  }
  if (age >= 25) {
    showRetirementChoice(false);
    return true;
  }
  return false;
}

function showRetirementChoice(forced) {
  showScreen('screen-retirement');
  const box = document.getElementById('retirement-box');
  if (!box) return;
  box.innerHTML = '<div class="reveal-card"><div class="reveal-label">🕊️ 生涯抉择</div>' +
    '<div class="big-cname">' + getDisplayName() + '</div>' +
    '<div class="big-pos">' + STATE.career.currentAge + '岁 · OVR ' + STATE.finalOVR + '</div>' +
    '<div style="font-size:13px;color:var(--text-dim);line-height:1.8;margin-top:8px;">' +
    '你已经在这个赛场上奔跑了 ' + (STATE.career.seasonCount + 1) + ' 个赛季。身体开始跟不上意识，训练后的恢复越来越慢。<br><br>是再战一年，还是就此转身？</div></div>' +
    '<div style="text-align:center;padding:12px;display:flex;gap:10px;justify-content:center;">' +
    (forced ? '' : '<button class="btn" onclick="playOneMoreSeason()">🔥 再战一年</button>') +
    '<button class="btn btn-primary" onclick="retireNow()">🕊️ 退役</button></div>';
}

function playOneMoreSeason() {
  STATE.career.flags = STATE.career.flags || {};
  STATE.career.flags.playOneMoreAge = STATE.career.currentAge;
  saveGame();
  openTransferWindow();
}

function retireNow() {
  const c = STATE.career;
  c.retired = true;
  const totalWins = (c.seasonHistory || []).reduce(function(sum, h) { return sum + (h.wins || 0); }, 0) + STATE.season.wins;
  const grade = c.profile.legacy >= 8 ? '传奇' : c.profile.legacy >= 4 ? '名宿' : c.profile.fame >= 10 ? '全明星级' : '优秀职业选手';
  c.finalSummary = {
    seasons: c.seasonCount + 1,
    wins: totalWins,
    honors: c.honors.length,
    championships: c.championships.length,
    finalOVR: STATE.finalOVR,
    peakOVR: Math.max(STATE.career.peakOVR || 0, STATE.finalOVR || 0),
    fame: c.profile.fame,
    grade: grade,
  };
  renderRetirementSummary();
  saveGame();
}

function renderRetirementSummary() {
  showScreen('screen-retirement');
  const box = document.getElementById('retirement-box');
  if (!box) return;
  const s = STATE.career.finalSummary;
  box.innerHTML = '<div class="reveal-card"><div class="reveal-label">🕊️ 正式退役</div>' +
    '<div class="big-cname">' + getDisplayName() + '</div>' +
    '<div class="big-pos">' + getPosName(STATE.position) + ' · 生涯定评：' + s.grade + '</div>' +
    '<div class="ret-stats">' +
    '<div class="ret-stat"><b>' + s.seasons + '</b><span>赛季</span></div>' +
    '<div class="ret-stat"><b>' + s.wins + '</b><span>常规赛胜场</span></div>' +
    '<div class="ret-stat"><b>' + s.championships + '</b><span>总冠军</span></div>' +
    '<div class="ret-stat"><b>' + s.honors + '</b><span>荣誉</span></div>' +
    '<div class="ret-stat"><b>' + s.finalOVR + '</b><span>最终 OVR</span></div>' +
    '<div class="ret-stat"><b>' + s.fame + '</b><span>生涯声望</span></div>' +
    '</div></div>' +
    '<div style="text-align:center;padding:14px;"><button class="btn btn-primary" onclick="showCareerStats()">📋 生涯总结</button>' +
    '<button class="btn" style="margin-left:8px;" onclick="resetGame()">🔄 重开新档</button></div>';
}

function showCareerStats() {
  showScreen('screen-career-stats');
  const c = STATE.career;
  const t = c.totalStats;
  ATTR_KEYS.forEach(function(k) { t[k] = STATE.attrs[k] || 50; });
  const g = Math.max(1, t.games || 1);
  const box = document.getElementById('career-stats-box');
  if (!box) return;
  let attrHtml = '';
  ATTR_KEYS.forEach(function(k) {
    const val = STATE.attrs[k] || 50;
    const gr = getGrade(val);
    attrHtml += '<div class="cs-attr"><span>' + attrCN(k) + '</span><div class="cs-bar"><div style="width:' + val + '%;background:' + gr.color + '"></div></div><b style="color:' + gr.color + '">' + val + '</b></div>';
  });
  let honorHtml = '';
  c.honors.forEach(function(h) {
    honorHtml += '<div class="honor-chip">第' + h.season + '赛季 · ' + h.label + (h.team ? ' · ' + getTeamName(h.team) : '') + '</div>';
  });
  box.innerHTML =
    '<div class="section-card"><div class="sec-title">👤 生涯档案</div>' +
    '<div class="cs-line">' + getDisplayName() + ' · ' + getPosName(STATE.position) + ' · ' + c.currentAge + '岁 · OVR ' + STATE.finalOVR + ' · ' + getOvrGrade(STATE.finalOVR) + (c.retired ? ' · 🕊️ 已退役' : '') + '</div>' +
    '<div class="cs-line">生涯 ' + c.seasonCount + ' 季 · 累计 ' + t.kills + '杀 ' + t.deaths + '死 ' + t.assists + '助 · 场均 ' + (t.kills / g).toFixed(1) + '杀</div>' +
    '<div class="cs-line">声望 ' + (c.profile.fame) + ' · 人气 ' + (c.profile.popularity) + ' · 身价 ' + getSalary() + '万/年</div></div>' +
    '<div class="section-card"><div class="sec-title">📈 当前属性</div>' + attrHtml + '</div>' +
    '<div class="section-card"><div class="sec-title">🏅 荣誉墙</div><div class="honor-wrap">' + (honorHtml || '<span style="color:var(--text-dim)">暂无荣誉</span>') + '</div></div>' +
    '<div class="section-card"><div class="sec-title">🏆 冠军记录</div>' +
    ((c.championships || []).map(function(ch) { return '<div class="cs-line">🏆 第' + ch.season + '赛季 · ' + getTeamName(ch.team) + (ch.fmvp ? ' · FMVP' : '') + '</div>'; }).join('') || '<span style="color:var(--text-dim)">暂无冠军</span>') +
    '</div><div style="text-align:center;padding:8px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
    '<button class="btn btn-primary" onclick="backToResult()">返回</button>' +
    '<button class="btn" onclick="showMyCard()">📊 My Card</button>' +
    '<button class="btn" onclick="renderAchievementsScreen()">🏅 成就</button>' +
    '<button class="btn" onclick="showCareerHonors()">🏆 荣誉墙</button></div>';
}

function backToResult() { showScreen('screen-result'); showSeasonResult(); }

function resetGame() {
  if (confirm('确定要重置并删除存档吗？')) initGame();
}

// ==================== 15. 海报 ====================
function generatePoster() {
  const ps = STATE.season.stats || {};
  const g = Math.max(1, ps.games || 1);
  const W = 620, H = 860;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0b1020');
  grad.addColorStop(0.6, '#1a2340');
  grad.addColorStop(1, '#2b1a3d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd43b';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏆', W / 2, 120);
  ctx.font = 'bold 42px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(getDisplayName(), W / 2, 190);
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#ffd43b';
  ctx.fillText(getPosName(STATE.position) + ' · ' + STATE.finalArchetype, W / 2, 230);
  ctx.font = 'bold 130px sans-serif';
  ctx.fillStyle = '#ff6b35';
  ctx.fillText(String(STATE.finalOVR), W / 2, 370);
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#cdd5ff';
  ctx.fillText('总评 OVR', W / 2, 400);
  ctx.font = '26px sans-serif';
  ctx.fillStyle = '#fff';
  const lines = [
    getSeasonLabel(STATE.career.seasonCount + 1) + '：' + STATE.season.wins + '胜 ' + STATE.season.losses + '负',
    '场均 ' + (ps.kills / g).toFixed(1) + '杀 ' + (ps.deaths / g).toFixed(1) + '死 ' + (ps.assists / g).toFixed(1) + '助',
    '场均补刀 ' + Math.round(ps.cs / g) + ' · 伤害 ' + Math.round(ps.dmg / g / 1000) + 'k',
    '战队：' + getTeamName(STATE.careerTeam),
    STATE.season.champion === STATE.careerTeam
      ? '🏆 总冠军' + (STATE.season.fmvp === STATE.careerTeam ? ' + FMVP' : '')
      : (STATE.season.champion ? '🏆 冠军：' + getTeamName(STATE.season.champion) : '继续前行'),
  ];
  lines.forEach(function(line, i) {
    ctx.fillText(line, W / 2, 470 + i * 42);
  });
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('本活动为玩家自制，非官方项目', W / 2, H - 40);
  const a = document.createElement('a');
  a.download = '完美选手生涯-海报.png';
  a.href = canvas.toDataURL('image/png');
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ==================== 通用 ====================
function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function highlightSlotItem(reelId, index) {
  const reel = document.getElementById(reelId);
  if (!reel) return;
  Array.prototype.forEach.call(reel.children, function(c, i) {
    c.classList.toggle('hit', i === index);
  });
}

// ==================== 启动 ====================
document.addEventListener('DOMContentLoaded', function() {
  boot();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STATE, SIM_CONFIG, PLAYERS, buildLoLSchedule, getTeamPlayers, calcTeamPower, simulateSeries, generatePlayerStats, calcAwards, initPlayoffs, simPlayoffRound, createFreshSeason, createFreshCareer, initStandings };
}
