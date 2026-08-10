/* 调试季后赛页面为空
   Created by haodongsheng */
const PORT = process.argv[2] || '9223';
const URL = 'file:///Users/haodongsheng/Documents/github/guessMoney/lol-career/app.html';

async function main() {
  const target = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' }).then(function(r) { return r.json(); });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function(res, rej) { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = {};
  const errors = [];
  ws.onmessage = function(ev) {
    const m = JSON.parse(ev.data);
    if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(function(a) { return a.value !== undefined ? a.value : a.description; }).join(' '));
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
    if (r.result && r.result.exceptionDetails) return { __evalErr: r.result.exceptionDetails.text };
    return r.result && r.result.result ? r.result.result.value : undefined;
  }
  const sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

  await send('Runtime.enable');
  await send('Page.enable');
  await evaljs('localStorage.clear(); location.reload();');
  await sleep(2500);
  console.log('probe:', JSON.stringify(await evaljs('1 + 1')));
  await evaljs("(function(){ initGame(); STATE.position='MID'; STATE.finalOVR=85; STATE.careerTeam='TES'; ['LANE','MECH','TEAM','DPS','BURST','TANK','CC','ROAM','VISION','FARM','MOB','CLU','SPLIT'].forEach(function(k){STATE.attrs[k]=85;}); startSeason(); })()");
  await sleep(200);
  await evaljs('simAllRounds()');
  await sleep(15000);
  console.log('state:', JSON.stringify(await evaljs("({ round: STATE.season.round, active: document.querySelector('.screen.active').id, hasGo: typeof goToPlayoffs })")));
  const r1 = await evaljs("(function(){ try { goToPlayoffs(); return { ok: true }; } catch (e) { return { ok: false, err: e.message }; } })()");
  console.log('goToPlayoffs:', JSON.stringify(r1));
  await sleep(200);
  const r2 = await evaljs("(function(){ try { renderPlayoffBracket(); var el = document.getElementById('playoff-box'); return { ok: true, len: el ? el.innerHTML.length : -1, html: el ? el.innerHTML.slice(0, 120) : null }; } catch (e) { return { ok: false, err: e.message }; } })()");
  console.log('render:', JSON.stringify(r2));
  console.log('errors:', JSON.stringify(errors));
  ws.close();
  process.exit(0);
}
main().catch(function(e) { console.error(e); process.exit(1); });
