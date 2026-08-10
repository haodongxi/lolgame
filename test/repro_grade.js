const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['js/sim_config.js', 'js/players.js', 'js/teams.js', 'js/core.js'];
let src = files.map(function(f) {
  return fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
}).join('\n;\n');
src += '\n;\nglobalThis.__T = {\n' +
  '  setPos: function(v){ STATE.position = v; },\n' +
  '  scan: function(){\n' +
  '    const allF = [], hasNaN = [];\n' +
  '    SIM_CONFIG.POS_LIST.forEach(function(upos){\n' +
  '      PLAYERS.forEach(function(p){\n' +
  '        const vals = ATTR_KEYS.map(function(k){ const pv = parseInt(p[k]) || 50; const penalty = getPosPenalty(upos, getMainPos(p), k); return Math.round(pv * penalty); });\n' +
  '        const letters = vals.map(function(v){ return getGrade(v).letter; });\n' +
  '        if (letters.every(function(l){ return l === "F"; })) allF.push(upos + " x " + p.id);\n' +
  '        if (vals.some(function(v){ return isNaN(v); })) hasNaN.push(upos + " x " + p.id);\n' +
  '      });\n' +
  '    });\n' +
  '    return { allF: allF, hasNaN: hasNaN };\n' +
  '  },\n' +
  '  sim: function(pid){\n' +
  '    const p = PLAYERS.find(x => x.id === pid);\n' +
  '    STATE.selectedChamp = p;\n' +
  '    return ATTR_KEYS.map(k => {\n' +
  '      const pv = parseInt(p[k]) || 50;\n' +
  '      const srcPos = getMainPos(p);\n' +
  '      const penalty = getPosPenalty(STATE.position, srcPos, k);\n' +
  '      const adjustedVal = Math.round(pv * penalty);\n' +
  '      const g = getGrade(adjustedVal);\n' +
  '      return k + "=" + adjustedVal + "(" + g.letter + ")";\n' +
  '    });\n' +
  '  },\n' +
  '  getState: function(){ return STATE; },\n' +
  '};';

const sandbox = {
  document: { addEventListener: function(){}, getElementById: function(){ return null; }, querySelector: function(){ return null; }, querySelectorAll: function(){ return []; }, createElement: function(){ return { classList: { add: function(){}, remove: function(){}, toggle: function(){} }, style: {} }; }, body: { appendChild: function(){} } },
  localStorage: { getItem: function(){ return null; }, setItem: function(){}, removeItem: function(){} },
  confirm: function(){ return true; },
  console: console, Math: Math, JSON: JSON, Date: Date,
  setTimeout: function(fn){ fn(); }, clearTimeout: function(){},
  Promise: Promise, Array: Array, Object: Object, String: String, Number: Number,
  parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'lol-game.js' });

const T = sandbox.__T;
function show(label, pos, pid) {
  T.setPos(pos);
  console.log(label);
  console.log('  ' + T.sim(pid).join(' '));
}

show('位置=MID, 选Knight(同位置):', 'MID', 'Knight');
show('位置=MID, 选Jwei(跨位置SUP):', 'MID', 'Jwei');
show('位置=MID, 选Bin(跨位置TOP):', 'MID', 'Bin');
show('位置=null(异常场景模拟):', null, 'Knight');

const scan = T.scan();
console.log('\n全F组合数:', scan.allF.length, scan.allF.slice(0, 10).join(' | '));
console.log('出现NaN组合数:', scan.hasNaN.length, scan.hasNaN.slice(0, 10).join(' | '));
