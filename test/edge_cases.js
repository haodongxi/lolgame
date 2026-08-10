/* 边缘功能测试：换人按钮 / 跨位置衰减 / 海报导出 / 重置
   Created by haodongsheng
   用法: node test/edge_cases.js <remoteDebugPort> */
const PORT = process.argv[2] || '9223';
const URL = 'file:///Users/haodongsheng/Documents/github/guessMoney/lol-career/app.html';

async function main() {
  const target = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' }).then(function(r) { return r.json(); });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function(res, rej) { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = {};
  const exceptions = [];
  let dialogHandled = false;
  ws.onmessage = function(ev) {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; }
    else if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.text + ' @' + (msg.params.exceptionDetails.url || ''));
    else if (msg.method === 'Page.javascriptDialogOpening') {
      dialogHandled = true;
      send('Page.handleJavaScriptDialog', { accept: true });
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
    if (r.result && r.result.exceptionDetails) return { error: r.result.exceptionDetails.text };
    return r.result && r.result.result ? r.result.result.value : undefined;
  }
  const sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
  async function spinAndWait() {
    await evaljs("pullHandle()");
    for (let i = 0; i < 40; i++) {
      await sleep(200);
      if ((await evaljs("STATE.currentTeam")) && (await evaljs("document.querySelectorAll('.br-player').length")) > 0) return;
    }
  }
  const log = function(s) { console.log('[edge]', s); };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: '/tmp/lol_downloads' });
  require('fs').mkdirSync('/tmp/lol_downloads', { recursive: true });
  require('fs').readdirSync('/tmp/lol_downloads').forEach(function(f) { require('fs').unlinkSync('/tmp/lol_downloads/' + f); });
  await evaljs('localStorage.clear(); location.reload();');
  await sleep(2500);

  const out = {};
  await evaljs("(document.querySelector('.fc-btn').click(), 'ok')");
  await sleep(200);
  await evaljs("(document.querySelectorAll('.pos-card')[0].click(), confirmPosition(), 'ok')");
  await sleep(200);

  // 1. 换人按钮
  log('reroll test');
  await spinAndWait();
  const before = await evaljs("({ rerolls: STATE._rerollsLeft, team: STATE.currentTeam, shown: Array.from(document.querySelectorAll('.bp-name')).map(function(e){return e.textContent;}) })");
  await evaljs("rerollTeamPlayers()");
  await sleep(200);
  const after = await evaljs("({ rerolls: STATE._rerollsLeft, team: STATE.currentTeam, shown: Array.from(document.querySelectorAll('.bp-name')).map(function(e){return e.textContent;}) })");
  out.reroll = { before: before, after: after, ok: after.rerolls === before.rerolls - 1 && after.shown.length > 0 };
  log('reroll ok=' + out.reroll.ok);

  // 2. 跨位置衰减：选个非 TOP 选手看属性
  log('cross-position test');
  await evaljs("STATE.selectedChamp = null; STATE.currentTeam = null; STATE._shownThisTeam = []; STATE._mustLockAfterSpin = false; document.getElementById('br-roster-area').innerHTML='';");
  let found = false;
  for (let i = 0; i < 10 && !found; i++) {
    await spinAndWait();
    found = await evaljs(`(function(){
      const rows = Array.from(document.querySelectorAll('.br-player'));
      for (const el of rows) {
        const detail = el.querySelector('.bp-detail');
        if (detail && /下路|打野|中单|辅助/.test(detail.textContent)) { el.click(); return true; }
      }
      return false;
    })()`);
  }
  await sleep(150);
  out.crossPos = await evaljs(`({
    found: ${found},
    picked: STATE.selectedChamp ? (STATE.selectedChamp.id + '/' + STATE.selectedChamp.pos) : null,
    attrSample: Array.from(document.querySelectorAll('#bl-attrs .ba-slot.clickable .ba-owner')).slice(0, 3).map(function(e){return e.textContent;}),
    penaltyShown: document.querySelectorAll('#bl-attrs .ba-slot.clickable .ba-owner[style]').length > 0
  })`);
  log('cross=' + JSON.stringify(out.crossPos));

  // 3. 锁完 13 项 -> 揭幕 -> 赛季 -> 海报
  log('build completion');
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
      if (c > 0) { await evaljs("(document.querySelector('#bl-attrs .ba-slot.clickable').click(), 'ok')"); await sleep(800); }
      else { await evaljs("STATE.selectedChamp = null; STATE.currentTeam = null; STATE._shownThisTeam = []; STATE._mustLockAfterSpin = false; document.getElementById('br-roster-area').innerHTML='';"); }
    } else if (rerolls > 0 && team) { await evaljs("rerollTeamPlayers()"); await sleep(150); }
    else { await spinAndWait(); }
    if (guard % 10 === 0) log('locked=' + (await evaljs("STATE.lockedCount")));
  }
  await sleep(900);
  out.build = { locked: await evaljs("STATE.lockedCount"), ovr: await evaljs("STATE.finalOVR") };
  log('build done ' + JSON.stringify(out.build));

  await evaljs("goToCareer()");
  await sleep(200);
  await evaljs("selectCareerTeam('BLG')");
  await sleep(200);
  await evaljs("startSeason()");
  await sleep(200);
  await evaljs("simAllRounds()");
  await sleep(400);
  log('season done');

  // 4. 海报导出
  await evaljs("generatePoster()");
  await sleep(1500);
  const downloads = require('fs').readdirSync('/tmp/lol_downloads');
  const dlen = downloads.length > 0 ? require('fs').statSync('/tmp/lol_downloads/' + downloads[0]).size : 0;
  out.poster = { downloads: downloads, fileSize: dlen };
  log('poster=' + JSON.stringify(out.poster));

  // 5. 重置
  await evaljs("saveGame()");
  const savedBefore = await evaljs("localStorage.getItem('lol_career_save_v1') !== null");
  await evaljs("resetGame()");
  await sleep(300);
  out.reset = {
    savedBefore: savedBefore,
    stateFresh: (await evaljs("STATE.career.seasonCount")) === 0 && (await evaljs("STATE.lockedCount")) === 0,
    saveCleared: (await evaljs("localStorage.getItem('lol_career_save_v1')")) === null,
    dialogShown: dialogHandled,
  };
  log('reset=' + JSON.stringify(out.reset));

  out.exceptions = exceptions;
  console.log(JSON.stringify(out, null, 2));
  ws.close();
  process.exit(0);
}
main().catch(function(e) { console.error(e); process.exit(1); });
