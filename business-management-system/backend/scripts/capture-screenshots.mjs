import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\51faf6aa-c94e-40b0-8b9a-fa7671edae13';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;

const COMPANY_ID = 'b5f484da-fc82-46c0-8ea2-b171dcc0c78c';
const FY_ID = 'd6f33296-1c4a-4c2a-968b-08b4929604f1';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('[1] Launching headless Chrome...');
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1366,768',
      '--user-data-dir=' + path.join(ARTIFACT_DIR, 'scratch', 'chrome_profile'),
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  try {
    let versionData = null;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
        if (res.ok) {
          versionData = await res.json();
          break;
        }
      } catch {}
    }

    if (!versionData) throw new Error('Chrome remote debugging did not respond.');

    const targetsRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const resolve = pending.get(msg.id);
        pending.delete(msg.id);
        resolve(msg);
      }
    };

    await new Promise((r) => (ws.onopen = r));

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const reqId = id++;
        pending.set(reqId, resolve);
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false,
    });

    async function capture(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      const buffer = Buffer.from(res.result.data, 'base64');
      const outPath = path.join(ARTIFACT_DIR, filename);
      fs.writeFileSync(outPath, buffer);
      console.log(`Saved screenshot: ${outPath} (${buffer.length} bytes)`);
    }

    // Set localStorage and load Dashboard
    console.log('[2] Loading Dashboard with active company...');
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    await sleep(1500);
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('bms_active_company_id', '${COMPANY_ID}');
        localStorage.setItem('bms_active_fy_id', '${FY_ID}');
        location.href = 'http://127.0.0.1:5173/';
      `,
    });
    await sleep(2500);

    // 1. Screenshot of Manufacturing dropdown
    console.log('[3] Opening Manufacturing dropdown...');
    await send('Runtime.evaluate', {
      expression: `
        const mBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Manufacturing'));
        if (mBtn) mBtn.click();
      `,
    });
    await sleep(800);
    await capture('screenshot_01_manufacturing_dropdown.png');

    // 2. Screenshot of Production Receive submenu
    console.log('[4] Opening Production Receive submenu...');
    await send('Runtime.evaluate', {
      expression: `
        const prDiv = Array.from(document.querySelectorAll('.cursor-pointer')).find(el => el.textContent && el.textContent.trim().startsWith('1. Production Receive'));
        if (prDiv) prDiv.click();
      `,
    });
    await sleep(800);
    await capture('screenshot_02_production_receive_submenu.png');

    // 3. Screenshot of Production Book Selection page
    console.log('[5] Navigating to /manufacturing/production-receive/books...');
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/manufacturing/production-receive/books' });
    await sleep(2500);
    await capture('screenshot_03_production_book_selection.png');

    // 4. Screenshot of selected book
    console.log('[6] Selecting production book (clicking table Open button)...');
    await send('Runtime.evaluate', {
      expression: `
        // Click specifically the Open button inside the table row
        const tableBtn = Array.from(document.querySelectorAll('.grid.grid-cols-12 button')).find(b => b.textContent && b.textContent.includes('Open'));
        if (tableBtn) {
          tableBtn.click();
        } else {
          // Click the table row
          const row = document.querySelector('.grid.grid-cols-12.cursor-pointer');
          if (row) row.click();
        }
      `,
    });
    await sleep(2000);
    await capture('screenshot_04_selected_book.png');

    console.log('Finished capturing all 4 screenshots!');
    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
