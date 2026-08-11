/* 真人游玩剧本：通过 CDP 驱动真实页面完整通关，收集 JS 异常与 UI 状态
   Created by haodongsheng
   用法: node test/playthrough.js <remoteDebugPort> */
const PORT = process.argv[2] || '9223';
const URL = 'file:///Users/haodongsheng/Documents/github/guessMoney/lol-career/app.html';

async function main() {
  const target = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' }).then(function(r) { return r.json(); });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function(res, rej) { ws.onopen = res; ws.onerror = rej; });

  let msgId = 0;
  const pending = {};
  const exceptions = [];
  const consoleErrors = [];
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
  const sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

  await send('Runtime.enable');
  await send('Page.enable');

  // 清理存档并重新加载
  await evaljs('localStorage.clear(); location.reload();');
  await sleep(2500);

  const report = { steps: {}, seenPlayers: [], benchSeen: [] };
  const seen = new Set();
  function trackPlayers() {
    return evaljs("Array.from(document.querySelectorAll('.bp-name')).map(function(e){return e.textContent;})");
  }

  // 1. 菜单 -> 开始
  report.steps.menuCards = await evaljs("document.querySelectorAll('.feature-card').length");
  await evaljs("(document.querySelector('.fc-btn').click(), 'ok')");
  await sleep(200);
  report.steps.posCards = await evaljs("document.querySelectorAll('.pos-card').length");

  // 2. 选择 MID
  await evaljs("(document.querySelectorAll('.pos-card')[2].click(), confirmPosition(), 'ok')");
  await sleep(200);
  report.steps.buildScreen = await evaljs("document.getElementById('screen-build').classList.contains('active')");

  // 3. 建号：反复抽队 -> 选人 -> 锁属性，直到 13 项锁定
  let guard = 0;
  while (guard < 80) {
    guard++;
    const locked = await evaljs("STATE.lockedCount");
    if (locked >= 13) break;
    const currentTeam = await evaljs("STATE.currentTeam");
    const brPlayers = await evaljs("Array.from(document.querySelectorAll('.br-player')).map(function(e){return e.getAttribute('onclick');})");
    const clickable = await evaljs("document.querySelectorAll('#bl-attrs .ba-slot.clickable').length");
    const rerolls = await evaljs("STATE._rerollsLeft");
    const shown = await trackPlayers();
    shown.forEach(function(n) { if (n) seen.add(n); });
    if (guard % 5 === 1 || guard > 70) {
      console.log('loop', guard, JSON.stringify({ locked: locked, team: currentTeam, br: brPlayers && brPlayers.length, clickable: clickable, rerolls: rerolls, spinning: await evaljs("_slotSpinning"), shown: shown }));
    }
    if (brPlayers && brPlayers.length > 0) {
      // 先选人，再锁第一个可锁属性（每次抽队只能锁一项）
      const picked = await evaljs("(function(){ const el = document.querySelector('.br-player'); if(!el) return 'none'; const name = el.textContent; el.click(); return name; })()");
      await sleep(100);
      const clickableAfter = await evaljs("document.querySelectorAll('#bl-attrs .ba-slot.clickable').length");
      if (clickableAfter > 0) {
        await evaljs("(function(){ const el = document.querySelector('#bl-attrs .ba-slot.clickable'); if(!el) return 'none'; el.click(); return 'ok'; })()");
        report.steps.lastLock = { player: picked, locked: await evaljs("STATE.lockedCount") };
        await sleep(800); // 等游戏重置当前队伍/名单
      } else {
        await evaljs("STATE.selectedChamp = null; STATE.currentTeam = null; STATE._shownThisTeam = []; document.getElementById('br-roster-area').innerHTML='';");
      }
    } else if (rerolls > 0 && currentTeam) {
      await evaljs("rerollTeamPlayers()");
      await sleep(150);
    } else {
      await evaljs("pullHandle()");
      await sleep(3100);
    }
  }
  report.steps.lockedCount = await evaljs("STATE.lockedCount");
  report.steps.finalOVR = await evaljs("STATE.finalOVR");
  report.seenPlayers = Array.from(seen);
  report.benchSeen = report.seenPlayers.filter(function(n) { return ['Breathe', 'Meiko', 'Renard', 'Nia', 'JackeyLove', 'Tian', 'ZUIAN', 'Hang', 'TheHank', 'Sinian', 'Burdol', 'Juhan', 'Ahn', 'Climber', 'Tyrion'].indexOf(n) >= 0; });

  // 4. 揭幕页
  await sleep(900);
  report.steps.revealActive = await evaljs("document.getElementById('screen-reveal').classList.contains('active')");
  report.steps.revealOvr = await evaljs("(document.querySelector('#reveal-content .big-ovr')||{}).textContent");
  report.steps.similarCount = await evaljs("document.querySelectorAll('#reveal-content .rv-sim-row').length");
  report.steps.revealHasNaN = await evaljs("(document.getElementById('reveal-content').innerText.match(/NaN|undefined/g)||[]).length");

  // 5. 生涯选队
  await evaljs("goToCareer()");
  await sleep(200);
  await evaljs("selectCareerTeam('JDG')");
  await sleep(200);
  report.steps.careerTeam = await evaljs("STATE.careerTeam");
  report.steps.rosterRows = await evaljs("document.querySelectorAll('#career-area .roster-row').length");
  report.steps.careerHasNaN = await evaljs("(document.getElementById('career-area').innerText.match(/NaN|undefined/g)||[]).length");

  // 6. 常规赛一键模拟
  await evaljs("startSeason()");
  await sleep(300);
  await evaljs("simAllRounds()");
  await sleep(400);
  report.steps.seasonRound = await evaljs("STATE.season.round");
  report.steps.myWins = await evaljs("STATE.season.wins");
  report.steps.myLosses = await evaljs("STATE.season.losses");
  report.steps.standingsTotal = await evaljs("Object.values(STATE.season.standings).reduce(function(s, t){return s + t.wins + t.losses;}, 0)");
  report.steps.awardsCount = await evaljs("(STATE.season.awards||[]).length");
  report.steps.awardsScreen = await evaljs("document.getElementById('screen-awards').classList.contains('active')");
  report.steps.awardsHasNaN = await evaljs("(document.getElementById('awards-box').innerText.match(/NaN|undefined/g)||[]).length");

  // 7. 季后赛
  await evaljs("goToPlayoffs()");
  await sleep(200);
  for (let i = 0; i < 3; i++) {
    await evaljs("STATE._pendingStrategy = 'auto'; simPlayoffRound()");
    await sleep(250);
  }
  report.steps.playoffDone = await evaljs("STATE.season.playoffBracket && STATE.season.playoffBracket.done");
  report.steps.champion = await evaljs("STATE.season.champion");
  report.steps.fmvp = await evaljs("STATE.season.fmvp");
  report.steps.playoffHasNaN = await evaljs("(document.getElementById('playoff-box').innerText.match(/NaN|undefined/g)||[]).length");

  // 8. 赛季总结
  await evaljs("showSeasonResult()");
  await sleep(200);
  report.steps.resultActive = await evaljs("document.getElementById('screen-result').classList.contains('active')");
  report.steps.resultHasNaN = await evaljs("(document.getElementById('result-box').innerText.match(/NaN|undefined/g)||[]).length");

  // 9. 生涯数据
  await evaljs("showCareerStats()");
  await sleep(200);
  report.steps.statsHasNaN = await evaljs("(document.getElementById('career-stats-box').innerText.match(/NaN|undefined/g)||[]).length");

  // 10. 新赛季
  await evaljs("backToResult()");
  await sleep(150);
  const before = await evaljs("({ season: STATE.career.seasonCount, age: STATE.career.currentAge, ovr: STATE.finalOVR })");
  await evaljs("startNextSeason()");
  await sleep(300);
  const after = await evaljs("({ season: STATE.career.seasonCount, age: STATE.career.currentAge, ovr: STATE.finalOVR })");
  report.steps.nextSeason = { before: before, after: after };
  report.steps.nextSeasonHasNaN = await evaljs("(document.getElementById('standings-box').innerText.match(/NaN|undefined/g)||[]).length");

  // 11. 存档 -> 重载 -> 读档
  await evaljs("saveGame()");
  const savedRaw = await evaljs("localStorage.getItem('lol_career_save_v1')");
  report.steps.saveSize = savedRaw ? savedRaw.length : 0;
  await evaljs("location.reload()");
  await sleep(2500);
  report.steps.continueVisible = await evaljs("document.getElementById('continue-btn') ? getComputedStyle(document.getElementById('continue-btn')).display !== 'none' : false");
  if (report.steps.continueVisible) {
    await evaljs("continueCareer()");
    await sleep(300);
    report.steps.loadedTeam = await evaljs("STATE.careerTeam");
    report.steps.loadedSeason = await evaljs("STATE.career.seasonCount");
  }

  report.exceptions = exceptions;
  report.consoleErrors = consoleErrors.slice(0, 20);
  console.log(JSON.stringify(report, null, 2));
  ws.close();
  process.exit(0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
