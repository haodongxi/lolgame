/* 移动端布局审计：逐屏检查横向溢出/元素出屏/零尺寸文本
   Created by haodongsheng
   用法: node test/layout_audit.js <remoteDebugPort> */
const PORT = process.argv[2] || '9223';
const URL = 'file:///Users/haodongsheng/Documents/github/guessMoney/lol-career/app.html';

async function main() {
  const target = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' }).then(function(r) { return r.json(); });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function(res, rej) { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = {};
  const exceptions = [];
  ws.onmessage = function(ev) {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; }
    else if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.text);
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

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaljs('localStorage.clear(); location.reload();');
  await sleep(2500);

  async function audit(name) {
    const r = await evaljs(`(function(){
      const doc = document.documentElement;
      const vw = window.innerWidth;
      const issues = [];
      const all = document.querySelectorAll('body *');
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const text = (el.textContent || '').trim();
        if (rect.width === 0 && text.length > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
          issues.push('零宽文本: ' + el.tagName + '.' + (el.className || '') + ' "' + text.slice(0, 20) + '"');
        }
        if (rect.width > vw + 1 && text.length > 0) {
          issues.push('超宽: ' + el.tagName + '.' + (el.className || '') + ' w=' + Math.round(rect.width) + ' "' + text.slice(0, 20) + '"');
        }
      }
      return {
        name: '${name}',
        activeScreen: document.querySelector('.screen.active') ? document.querySelector('.screen.active').id : 'none',
        scrollW: doc.scrollWidth,
        clientW: doc.clientWidth,
        scrollH: doc.scrollHeight,
        viewportH: window.innerHeight,
        hOverflow: doc.scrollWidth > doc.clientWidth + 1,
        issues: issues.slice(0, 8),
      };
    })()`);
    return r;
  }

  const report = [];
  report.push(await audit('menu'));
  await evaljs("(document.querySelector('.fc-btn').click(), 'ok')");
  await sleep(250);
  report.push(await audit('position'));
  await evaljs("(document.querySelectorAll('.pos-card')[4].click(), confirmPosition(), 'ok')");
  await sleep(300);
  report.push(await audit('build-empty'));
  await evaljs("pullHandle()");
  await sleep(3400);
  await evaljs("(document.querySelector('.br-player').click(), 'ok')");
  await sleep(200);
  report.push(await audit('build-selected'));
  await evaljs("(document.querySelector('#bl-attrs .ba-slot.clickable').click(), 'ok')");
  await sleep(900);

  // 完成锁定到揭幕
  let guard = 0;
  while (guard < 70) {
    guard++;
    if ((await evaljs("STATE.lockedCount")) >= 13) break;
    const br = await evaljs("document.querySelectorAll('.br-player').length");
    const team = await evaljs("STATE.currentTeam");
    const rerolls = await evaljs("STATE._rerollsLeft");
    if (br > 0) {
      await evaljs("(document.querySelector('.br-player').click(), 'ok')");
      await sleep(100);
      const c = await evaljs("document.querySelectorAll('#bl-attrs .ba-slot.clickable').length");
      if (c > 0) { await evaljs("(document.querySelector('#bl-attrs .ba-slot.clickable').click(), 'ok')"); await sleep(800); }
      else { await evaljs("STATE.selectedChamp = null; STATE.currentTeam = null; STATE._shownThisTeam = []; document.getElementById('br-roster-area').innerHTML='';"); }
    } else if (rerolls > 0 && team) { await evaljs("rerollTeamPlayers()"); await sleep(150); }
    else { await evaljs("pullHandle()"); await sleep(3400); }
  }
  await sleep(900);
  report.push(await audit('reveal'));

  await evaljs("goToCareer()");
  await sleep(250);
  await evaljs("selectCareerTeam('TES')");
  await sleep(250);
  report.push(await audit('career-team'));
  await evaljs("startSeason()");
  await sleep(250);
  await evaljs("simAllRounds()");
  await sleep(400);
  report.push(await audit('awards'));
  await evaljs("goToPlayoffs()");
  await sleep(250);
  report.push(await audit('playoffs'));
  for (let i = 0; i < 3; i++) { await evaljs("STATE._pendingStrategy = 'auto'; simPlayoffRound()"); await sleep(250); }
  report.push(await audit('playoffs-done'));
  await evaljs("showSeasonResult()");
  await sleep(250);
  report.push(await audit('result'));
  await evaljs("showCareerStats()");
  await sleep(250);
  report.push(await audit('career-stats'));
  await evaljs("showHelpModal()");
  await sleep(250);
  report.push(await audit('help-modal'));
  await evaljs("closeHelpModal()");
  await sleep(100);
  await evaljs("startNextSeason()");
  await sleep(300);
  report.push(await audit('next-season'));

  console.log(JSON.stringify({ report: report, exceptions: exceptions }, null, 2));
  ws.close();
  process.exit(0);
}
main().catch(function(e) { console.error(e); process.exit(1); });
