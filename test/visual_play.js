/* 目视游玩：移动端视口 + 分步截图，逐屏检查渲染与交互
   Created by haodongsheng
   用法: node test/visual_play.js <remoteDebugPort> <outDir> */
const PORT = process.argv[2] || '9223';
const OUTDIR = process.argv[3] || '/tmp/lol_shots';
const URL = 'file:///Users/haodongsheng/Documents/github/guessMoney/lol-career/app.html';
const fs = require('fs');
fs.mkdirSync(OUTDIR, { recursive: true });

async function main() {
  const target = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' }).then(function(r) { return r.json(); });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function(res, rej) { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = {};
  const exceptions = [];
  const consoleErrors = [];
  let shotId = 0;
  ws.onmessage = function(ev) {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; }
    else if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails.text + ' @' + (msg.params.exceptionDetails.url || '') + ':' + (msg.params.exceptionDetails.lineNumber || 0));
    }
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map(function(a) { return a.value !== undefined ? a.value : a.description; }).join(' '));
    }
  };
  function send(method, params) {
    return new Promise(function(res) {
      const id = ++msgId;
      pending[id] = res;
      ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
    });
  }
  async function evaljs(expression) {
    const r = await send('Runtime.evaluate', { expression: expression, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) {
      exceptions.push('eval: ' + r.result.exceptionDetails.text);
      return undefined;
    }
    return r.result && r.result.result ? r.result.result.value : undefined;
  }
  async function shot(name) {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const data = r.result && r.result.data;
    if (data) {
      const file = OUTDIR + '/' + String(++shotId).padStart(2, '0') + '-' + name + '.png';
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      console.log('📸', file);
    }
  }
  const sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaljs('localStorage.clear(); location.reload();');
  await sleep(2500);

  // 1. 菜单
  await shot('menu');
  await evaljs("(document.querySelector('.fc-btn').click(), 'ok')");
  await sleep(250);
  await shot('position');

  // 2. 选辅助（跨位置衰减最多的位置之一）
  await evaljs("(document.querySelectorAll('.pos-card')[4].click(), confirmPosition(), 'ok')");
  await sleep(300);
  await shot('build-empty');

  // 3. 抽队 -> 展示名单
  await evaljs("pullHandle()");
  await sleep(3400);
  await shot('roster');
  await evaljs("(document.querySelector('.br-player').click(), 'ok')");
  await sleep(200);
  await shot('selected-attrs');

  // 4. 锁一项属性
  await evaljs("(document.querySelector('#bl-attrs .ba-slot.clickable').click(), 'ok')");
  await sleep(900);
  await shot('after-lock');

  // 5. 完成剩余 12 项锁定
  let guard = 0;
  while (guard < 70) {
    guard++;
    const locked = await evaljs("STATE.lockedCount");
    if (locked >= 13) break;
    const br = await evaljs("document.querySelectorAll('.br-player').length");
    const team = await evaljs("STATE.currentTeam");
    const rerolls = await evaljs("STATE._rerollsLeft");
    if (br > 0) {
      await evaljs("(document.querySelector('.br-player').click(), 'ok')");
      await sleep(100);
      const c = await evaljs("document.querySelectorAll('#bl-attrs .ba-slot.clickable').length");
      if (c > 0) {
        await evaljs("(document.querySelector('#bl-attrs .ba-slot.clickable').click(), 'ok')");
        await sleep(800);
      } else {
        await evaljs("STATE.selectedChamp = null; STATE.currentTeam = null; STATE._shownThisTeam = []; document.getElementById('br-roster-area').innerHTML='';");
      }
    } else if (rerolls > 0 && team) {
      await evaljs("rerollTeamPlayers()");
      await sleep(150);
    } else {
      await evaljs("pullHandle()");
      await sleep(3400);
    }
  }
  await sleep(900);
  await shot('reveal');

  // 6. 生涯选队
  await evaljs("goToCareer()");
  await sleep(250);
  await shot('career-spin');
  await evaljs("selectCareerTeam('TES')");
  await sleep(250);
  await shot('career-team');

  // 7. 常规赛
  await evaljs("startSeason()");
  await sleep(250);
  await shot('season-start');
  await evaljs("simAllRounds()");
  await sleep(400);
  await shot('awards');
  await evaljs("goToPlayoffs()");
  await sleep(250);
  await shot('playoffs');
  for (let i = 0; i < 3; i++) { await evaljs("simPlayoffRound()"); await sleep(250); }
  await shot('playoffs-done');
  await evaljs("showSeasonResult()");
  await sleep(250);
  await shot('result');

  // 8. 生涯数据 + 帮助
  await evaljs("showCareerStats()");
  await sleep(250);
  await shot('career-stats');
  await evaljs("backToResult()");
  await sleep(150);
  await evaljs("showHelpModal()");
  await sleep(250);
  await shot('help-modal');

  // 9. 新赛季
  await evaljs("closeHelpModal()");
  await sleep(100);
  await evaljs("startNextSeason()");
  await sleep(300);
  await shot('next-season');

  console.log(JSON.stringify({
    locked: await evaljs("STATE.lockedCount"),
    ovr: await evaljs("STATE.finalOVR"),
    team: await evaljs("STATE.careerTeam"),
    season: await evaljs("STATE.season.round"),
    champion: await evaljs("STATE.season.champion"),
    age: await evaljs("STATE.career.currentAge"),
    exceptions: exceptions,
    consoleErrors: consoleErrors.slice(0, 10),
  }, null, 2));
  ws.close();
  process.exit(0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
