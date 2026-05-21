import { createServer, type Server, type ServerResponse } from 'node:http';

export function startDemoSiteServer(port = 0): Promise<Server> {
  const server = createServer((request, response) => {
    const url = request.url ?? '/';

    if (url === '/') {
      sendHtml(response, homePage());
      return;
    }

    if (url === '/console-error') {
      sendHtml(response, issuePage('Console error', `<button onclick="console.error('demo console error')">Trigger console error</button>`));
      return;
    }

    if (url === '/page-error') {
      sendHtml(response, issuePage('Page error', `<button onclick="setTimeout(() => { throw new Error('demo page error'); }, 0)">Trigger page error</button>`));
      return;
    }

    if (url === '/network-error') {
      sendHtml(response, issuePage('Network error', `<button onclick="fetch('/network-fail').catch(() => {})">Trigger network error</button>`));
      return;
    }

    if (url === '/server-error') {
      response.writeHead(500, { 'content-type': 'text/plain' });
      response.end('demo server error');
      return;
    }

    if (url === '/server-error-page') {
      sendHtml(response, issuePage('Server error', `<button onclick="fetch('/server-error').catch(() => {})">Trigger server error</button>`));
      return;
    }

    if (url === '/slow-api') {
      setTimeout(() => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end('{"ok":true}');
      }, 150);
      return;
    }

    if (url === '/slow-api-page') {
      sendHtml(response, issuePage('Slow API', `<button onclick="fetch('/slow-api').catch(() => {})">Trigger slow API</button>`));
      return;
    }

    if (url === '/blank') {
      sendHtml(response, issuePage('Blank page', `<button aria-label="Trigger blank page" onclick="document.body.innerHTML = '<main></main>'">Blank page</button>`));
      return;
    }

    if (url === '/form') {
      sendHtml(response, formPage());
      return;
    }

    if (url === '/network-fail') {
      request.socket.destroy();
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

function homePage(): string {
  return page('Bug Hunter Replay Demo', `<main>
    <h1>Bug Hunter Replay Demo</h1>
    <p>This local demo site triggers stable browser, network, action, and blank-page issues.</p>
    <nav>
      <a href="/console-error">Console error page</a>
      <a href="/page-error">Page error page</a>
      <a href="/network-error">Network error page</a>
      <a href="/server-error-page">Server error page</a>
      <a href="/slow-api-page">Slow API page</a>
      <a href="/blank">Blank route</a>
      <a href="/form">Form page</a>
    </nav>
    <section aria-label="Safe triggers">
      <button onclick="console.error('demo console error')">Trigger console error</button>
      <button onclick="setTimeout(() => { throw new Error('demo page error'); }, 0)">Trigger page error</button>
      <button onclick="fetch('/network-fail').catch(() => {})">Trigger network error</button>
      <button onclick="fetch('/server-error').catch(() => {})">Trigger server error</button>
      <button onclick="fetch('/slow-api').catch(() => {})">Trigger slow API</button>
      <input type="text" aria-label="Email" oninput="console.error('demo email filled')" />
      <select aria-label="Plan" onchange="console.error('demo plan selected')"><option value="">Choose</option><option value="free">Free</option></select>
      <textarea aria-label="Message"></textarea>
      <input type="submit" value="Safe form submit" />
      <button aria-label="Trigger blank page" onclick="document.body.innerHTML = '<main></main>'">Blank page</button>
    </section>
  </main>`);
}

function issuePage(title: string, body: string): string {
  return page(title, `<main><h1>${title}</h1><p>Use the button below to trigger this demo issue.</p>${body}<p><a href="/">Back home</a></p></main>`);
}

function formPage(): string {
  return page('Form page', `<main>
    <h1>Safe form page</h1>
    <form onsubmit="console.error('demo form submit skipped if clicked'); return false">
      <label>Email <input type="text" aria-label="Form Email" /></label>
      <label>Plan <select aria-label="Form Plan"><option value="">Choose</option><option value="free">Free</option></select></label>
      <textarea aria-label="Form Message"></textarea>
      <input type="submit" value="Save form" />
    </form>
    <p><a href="/">Back home</a></p>
  </main>`);
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; }
      nav, section, form { display: grid; gap: 0.75rem; max-width: 36rem; }
      button, input, select, textarea, a { font: inherit; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function sendHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end(html);
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: pnpm demo-site [-- --port <port>]');
    console.log('Starts the local Bug Hunter Replay demo site.');
    return;
  }

  const portIndex = process.argv.indexOf('--port');
  const port = portIndex === -1 ? 3000 : Number.parseInt(process.argv[portIndex + 1] ?? '', 10);
  const server = await startDemoSiteServer(Number.isInteger(port) ? port : 3000);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected demo server to listen on a port');
  }

  console.log(`Demo site listening at http://127.0.0.1:${address.port}/`);
}

if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  void main();
}
