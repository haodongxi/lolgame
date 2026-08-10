/* 新功能测试：突发事件/缺阵跳过/比赛详情/休赛期训练营加点
   Created by haodongsheng
   用法: node test/new_features.js <remoteDebugPort> <outDir> */
const PORT = process.argv[2] || '9223';
const OUTDIR = process.argv[3] || '/tmp/lol_new_shots';
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
    else if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.text + ' @' + (msg.params.exceptionDetails.url || ''));
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') consoleErrors.push(msg.params.args.map(function(a) { return a.value !== undefined ? a.value : a.description; }).join(' '));
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
  async function shot(name) {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    if (r.result && r.result.data) {
      const f = OUTDIR + '/' + String(++shotId).padStart(2, '0') + '-' + name + '.png';
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'));
      console.log('📸', f);
    }
  }
  const sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaljs('localStorage.clear(); location.reload();');
  await sleep(2500);

  const out = {};

  // 1. 直接初始化一个生涯：MID / TES / 全 80 属性
  await evaljs(`(function(){
    initGame();
    STATE.position = 'MID';
    STATE.finalOVR = 80;
    STATE.careerTeam = 'TES';
    ['LANE','MECH','TEAM','DPS','BURST','TANK','CC','ROAM','VISION','FARM','MOB','CLU','SPLIT'].forEach(function(k){ STATE.attrs[k] = 80; });
    STATE.career.seasonCount = 0;
    STATE.career.currentAge = 18;
    return 'ok';
  })()`);

  // 2. 开始常规赛，模拟前 3 轮（正常）
  await evaljs("startSeason()");
  await sleep(250);
  for (let i = 0; i < 3; i++) { await evaljs("simNextRound()"); await sleep(350); }
  out.after3 = await evaljs("({ round: STATE.season.round, series: STATE.season.series.length, events: STATE.season.events.storyTimeline.length })");

  // 3. 强制触发一次事件（直接调用事件检测，把概率改为必然）
  const evResult = await evaljs(`(function(){
    const ev = STATE.season.events;
    ev.lastTriggerGameNum = null;
    const ctx = { game: { round: STATE.season.round, isMine: true, home: STATE.careerTeam, away: 'BLG' }, result: { won: true, games: [{ aWon: true, killsA: 15, killsB: 8 }], score: '2-0' }, stats: { kills: 6, deaths: 2, assists: 8, cs: 260, dmg: 12000, vision: 30 } };
    const orig = Math.random;
    Math.random = function() { return 0.0; };
    let d = null;
    try { d = checkRandomEvents(ctx.game, ctx.result, ctx.stats); } catch (e) { d = { error: e.message }; }
    Math.random = orig;
    return d;
  })()`);
  out.event = evResult ? { title: evResult.title, consequence: evResult._consequence || null, games: evResult._games || null, attrDelta: evResult._attrDelta || null } : null;
  await shot('event-modal');
  await evaljs("closeEventModal()");
  await sleep(150);
  out.eventStatus = await evaljs("document.getElementById('event-status').innerText");

  // 4. 强制伤病缺阵：设置伤病剩余 2 场，模拟 2 轮验证跳过
  await evaljs("STATE.season.events.injuryGamesLeft = 2; STATE.season.events.injuryReason = '测试伤病';");
  await evaljs("simNextRound()"); await sleep(350);
  await evaljs("simNextRound()"); await sleep(350);
  out.skip = await evaljs("({ left: STATE.season.events.injuryGamesLeft, skipped: STATE.season.series.filter(function(s){return s.skipReason;}).length, last: STATE.season.series[STATE.season.series.length-1] ? STATE.season.series[STATE.season.series.length-1].skipReason : null })");

  // 5. 比赛详情弹窗：点击第一轮圆点
  await evaljs("showSeriesDetail(1)");
  await sleep(150);
  out.seriesModal = await evaljs("(document.getElementById('series-modal-body').innerText||'').slice(0, 200)");
  await shot('series-detail');
  await evaljs("closeSeriesModal()");

  // 6. 一键模拟剩余轮次（验证 bulk 模式无弹窗卡死）
  await evaljs("simAllRounds()");
  await sleep(500);
  out.seasonDone = await evaljs("({ round: STATE.season.round, wins: STATE.season.wins, losses: STATE.season.losses, events: STATE.season.events.storyTimeline.length, modalActive: document.getElementById('event-modal').classList.contains('active') })");
  await shot('season-awards');

  // 7. 季后赛
  await evaljs("goToPlayoffs()");
  await sleep(200);
  for (let i = 0; i < 3; i++) { await evaljs("simPlayoffRound()"); await sleep(300); }
  // 关闭可能弹出的事件弹窗
  await evaljs("if (document.getElementById('event-modal').classList.contains('active')) closeEventModal();");
  await sleep(150);
  out.playoffs = await evaljs("({ done: STATE.season.playoffBracket.done, champion: STATE.season.champion })");
  await evaljs("showSeasonResult()");
  await sleep(250);
  await shot('season-result');

  // 8. 休赛期训练营
  await evaljs("beginOffseason()");
  await sleep(300);
  out.training = await evaljs("({ screen: document.getElementById('screen-training').classList.contains('active'), pointsText: document.getElementById('tp-points').textContent, breakdown: STATE._offseasonDrift || [], rows: document.querySelectorAll('.tp-row').length })");
  await shot('training-camp');

  // 9. 加点：DPS +3、FARM +2，然后确认
  await evaljs("addTrainingPoint('DPS'); addTrainingPoint('DPS'); addTrainingPoint('DPS'); addTrainingPoint('FARM'); addTrainingPoint('FARM');");
  await sleep(150);
  out.afterAdd = await evaljs("({ pending: STATE._tpPending, dps: STATE.attrs.DPS, farm: STATE.attrs.FARM })");
  await shot('training-added');
  await evaljs("confirmTraining()");
  await sleep(400);
  out.nextSeason = await evaljs("({ season: STATE.career.seasonCount, age: STATE.career.currentAge, dps: STATE.attrs.DPS, farm: STATE.attrs.FARM, screen: document.querySelector('.screen.active') ? document.querySelector('.screen.active').id : null })");

  out.exceptions = exceptions;
  out.consoleErrors = consoleErrors.slice(0, 10);
  console.log(JSON.stringify(out, null, 2));
  ws.close();
  process.exit(0);
}
main().catch(function(e) { console.error(e); process.exit(1); });
