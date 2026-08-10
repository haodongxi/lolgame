/* 验证一键满配按钮：建号→揭幕→生涯
   Created by haodongsheng
   用法: node test/quick_fill_test.js <remoteDebugPort> */
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
    return r.result && r.result.result ? r.result.result.value : undefined;
  }
  const sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

  await send('Runtime.enable');
  await send('Page.enable');
  await evaljs('localStorage.clear(); location.reload();');
  await sleep(2500);

  await evaljs("(document.querySelector('.fc-btn').click(), 'ok')");
  await sleep(200);
  await evaljs("(document.querySelectorAll('.pos-card')[2].click(), confirmPosition(), 'ok')");
  await sleep(250);
  const btn = await evaljs("({ exists: !!document.querySelector('.dev-btn'), text: document.querySelector('.dev-btn') ? document.querySelector('.dev-btn').textContent : null })");
  await evaljs('quickFillBuild()');
  await sleep(700);
  const after = await evaljs("({ locked: STATE.lockedCount, ovr: STATE.finalOVR, reveal: document.getElementById('screen-reveal').classList.contains('active'), revealOvr: (document.querySelector('#reveal-content .big-ovr')||{}).textContent, attrs: Object.values(STATE.attrs).join(','), similar: document.querySelectorAll('#reveal-content .rv-sim-row').length })");
  await evaljs('goToCareer()');
  await sleep(200);
  await evaljs("selectCareerTeam('BLG')");
  await sleep(200);
  const career = await evaljs("({ team: STATE.careerTeam, rows: document.querySelectorAll('#career-area .roster-row').length, screen: document.querySelector('.screen.active').id })");
  console.log(JSON.stringify({ btn: btn, after: after, career: career, exceptions: exceptions }, null, 2));
  ws.close();
  process.exit(0);
}
main().catch(function(e) { console.error(e); process.exit(1); });
