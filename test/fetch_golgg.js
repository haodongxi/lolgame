/* 通过 CDP 驱动无头 Chrome 渲染 gol.gg 页面，抓取选手数据表
   Created by haodongsheng
   用法: node test/fetch_golgg.js <remoteDebugPort> <url> <outfile> */
const PORT = process.argv[2] || '9224';
const URL = process.argv[3] || 'https://gol.gg/players/list/season-S16/split-Spring/tournament-LPL%202026%20Split%201/';
const OUT = process.argv[4] || '/tmp/golgg_players.json';

async function main() {
  const target = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL), { method: 'PUT' }).then(function(r) { return r.json(); });
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function(res, rej) { ws.onopen = res; ws.onerror = rej; });

  let msgId = 0;
  const pending = {};
  const requests = [];
  ws.onmessage = function(ev) {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; }
    else if (msg.method === 'Network.requestWillBeSent') {
      const r = msg.params.request;
      if (r.url.indexOf('gol.gg') !== -1) requests.push(r.method + ' ' + r.url);
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
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    platform: 'MacIntel'
  });
  await send('Page.navigate', { url: URL });

  // 等待页面加载 + AJAX 数据渲染
  let rows = 0;
  let diag = null;
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    rows = await evaljs("document.querySelectorAll('.playerslist tbody tr').length") || 0;
    if (rows > 0) break;
    if (i === 5) {
      diag = await evaljs(`JSON.stringify({
        title: document.title,
        href: location.href,
        readyState: document.readyState,
        htmlLen: document.documentElement.outerHTML.length,
        htmlHead: document.documentElement.outerHTML.slice(0, 600),
        thead: document.querySelectorAll('.playerslist thead th').length,
        tbody: document.querySelectorAll('.playerslist tbody tr').length,
        tables: document.querySelectorAll('table').length,
        hasTable: !!document.querySelector('.playerslist'),
        bodyText: (document.body && document.body.innerText || '').slice(0, 300)
      })`);
      console.log('diag:', diag);
    }
  }
  console.log('requests:', requests.slice(0, 30).join('\n'));
  console.log('rows:', rows);

  const data = await evaljs(`(function(){
    const table = document.querySelector('.playerslist');
    if (!table) return [];
    const heads = Array.from(table.querySelectorAll('thead th')).map(function(th){ return th.textContent.trim(); });
    return Array.from(table.querySelectorAll('tbody tr')).map(function(tr){
      const tds = Array.from(tr.querySelectorAll('td')).map(function(td){ return td.textContent.trim(); });
      const obj = {};
      heads.forEach(function(h, i){ obj[h] = tds[i] !== undefined ? tds[i] : ''; });
      return obj;
    });
  })()`);

  require('fs').writeFileSync(OUT, JSON.stringify(data, null, 2));
  console.log('saved:', OUT, 'entries:', Array.isArray(data) ? data.length : 'n/a');
  ws.close();
  process.exit(0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
