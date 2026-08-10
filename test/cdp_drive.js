/* 通过 Chrome DevTools 协议驱动真实页面，复现「选人后属性评级」流程
   Created by haodongsheng
   用法: node test/cdp_drive.js */
const PORT = 9223;
const URL = 'file:///Users/haodongsheng/Documents/github/guessMoney/lol-career/app.html';

async function main() {
  const target = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' }).then(function(r) { return r.json(); });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function(res, rej) { ws.onopen = res; ws.onerror = rej; });

  let msgId = 0;
  const pending = {};
  const events = [];
  ws.onmessage = function(ev) {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; }
    else if (msg.method === 'Runtime.exceptionThrown') {
      events.push('EXCEPTION: ' + (msg.params.exceptionDetails && msg.params.exceptionDetails.text));
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

  await send('Runtime.enable');
  await sleep(1500); // 等页面加载

  const report = {};
  report.step0_menu = await evaljs("document.querySelectorAll('.feature-card').length");
  report.step1_clickStart = await evaljs("(document.querySelector('.fc-btn')||{}).click ? (document.querySelector('.fc-btn').click(), 'ok') : 'no-btn'");
  await sleep(150);
  report.step2_cards = await evaljs("document.querySelectorAll('.pos-card').length");
  report.step3_clickMid = await evaljs("(document.querySelectorAll('.pos-card')[2].click(), 'ok')");
  report.step4_position = await evaljs("STATE.position");
  report.step5_confirm = await evaljs("(confirmPosition(), 'ok')");
  report.step6_buildActive = await evaljs("document.getElementById('screen-build').classList.contains('active')");
  report.step7_pull = await evaljs("(pullHandle(), 'ok')");
  await sleep(3500); // 等老虎机动画完成
  report.step8_team = await evaljs("STATE.currentTeam");
  report.step9_rosterCount = await evaljs("document.querySelectorAll('.br-player').length");
  report.step10_pick = await evaljs("(document.querySelectorAll('.br-player')[0] ? (document.querySelectorAll('.br-player')[0].click(), 'ok') : 'no-player')");
  report.step11_selected = await evaljs("STATE.selectedChamp ? STATE.selectedChamp.id : null");
  report.step12_grades = await evaljs("Array.from(document.querySelectorAll('#bl-attrs .ba-grade')).map(function(e){return e.textContent;}).join(',')");
  report.step13_values = await evaljs("Array.from(document.querySelectorAll('#bl-attrs .ba-owner')).map(function(e){return e.textContent;}).join(',')");
  report.events = events;

  console.log(JSON.stringify(report, null, 2));
  ws.close();
  process.exit(0);
}

main().catch(function(e) { console.error('FATAL', e); process.exit(1); });
