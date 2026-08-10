/* 诊断建号抽队/选人流程
   Created by haodongsheng */
const PORT = process.argv[2] || '9223';
const URL = 'file:///Users/haodongsheng/Documents/github/guessMoney/lol-career/app.html';

async function main() {
  const target = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' }).then(function(r) { return r.json(); });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function(res, rej) { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = {};
  ws.onmessage = function(ev) {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; }
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
  await evaljs('localStorage.clear(); location.reload();');
  await sleep(2500);
  await evaljs("(document.querySelector('.fc-btn').click(), 'ok')");
  await sleep(200);
  await evaljs("(document.querySelectorAll('.pos-card')[2].click(), confirmPosition(), 'ok')");
  await sleep(200);
  console.log('before spin:', JSON.stringify(await evaljs("({team: STATE.currentTeam, br: document.querySelectorAll('.br-player').length, spinning: _slotSpinning})")));
  await evaljs("pullHandle()");
  await sleep(3500);
  const diag = await evaljs(`({
    team: STATE.currentTeam,
    br: document.querySelectorAll('.br-player').length,
    brHtml: (document.getElementById('br-roster-area')||{}).innerHTML ? document.getElementById('br-roster-area').innerHTML.slice(0, 400) : null,
    spinning: _slotSpinning,
    sel: STATE.selectedChamp ? STATE.selectedChamp.id : null,
    clickable: document.querySelectorAll('#bl-attrs .ba-slot.clickable').length,
    attrsHtml: (document.getElementById('bl-attrs')||{}).innerHTML ? document.getElementById('bl-attrs').innerHTML.slice(0, 200) : null
  })`);
  console.log('after spin:', JSON.stringify(diag, null, 2));
  if (diag.br > 0) {
    console.log('click result:', JSON.stringify(await evaljs(`(function(){
      const el = document.querySelector('.br-player');
      const name = el.textContent;
      el.click();
      return { name: name, sel: STATE.selectedChamp ? STATE.selectedChamp.id : null, clickable: document.querySelectorAll('#bl-attrs .ba-slot.clickable').length };
    })()`)));
  }
  ws.close();
  process.exit(0);
}
main().catch(function(e) { console.error(e); process.exit(1); });
