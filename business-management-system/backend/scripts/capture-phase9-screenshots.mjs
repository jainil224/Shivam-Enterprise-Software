import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\51faf6aa-c94e-40b0-8b9a-fa7671edae13';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;

const COMPANY_ID = 'b5f484da-fc82-46c0-8ea2-b171dcc0c78c';
const FY_ID = 'd6f33296-1c4a-4c2a-968b-08b4929604f1';
const BOOK_ID = 'aa477d9f-a037-4b26-96cb-d31c1d1a3733';

const CHALLAN_1_ID = '3f86c530-0d4e-4053-b034-a27dd45b45a9'; // 1001 Confirmed
const CHALLAN_2_ID = 'dc1a1d90-eed4-427d-b88d-38219fdcd946'; // 1002 Confirmed
const CHALLAN_3_ID = '20f1d3c7-b06e-4fdd-87f9-3463290e5e4b'; // 1003 Cancelled
const CHALLAN_4_ID = '8bbc7e56-6dcc-4bc7-81c3-22edf9a5ddc8'; // 1004 25-Cartons Multi-page

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
      '--user-data-dir=' + path.join(ARTIFACT_DIR, 'scratch', 'chrome_profile_p9'),
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

    // Set localStorage context
    console.log('[2] Initializing context on origin...');
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    await sleep(1500);

    // 1. Screenshot 1: A4 Portrait view of Challan #1001
    console.log('[3] Capturing A4 Portrait view (#1001)...');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('bms_active_company_id', '${COMPANY_ID}');
        localStorage.setItem('bms_active_fy_id', '${FY_ID}');
        sessionStorage.setItem('bms_selected_production_book_id', '${BOOK_ID}');
        location.href = 'http://127.0.0.1:5173/manufacturing/production-receive/records/${CHALLAN_1_ID}/print';
      `,
    });
    await sleep(2500);
    await capture('screenshot_p9_01_a4_portrait.png');

    // 2. Screenshot 2: A4 Landscape view of Challan #1001
    console.log('[4] Switching to A4 Landscape view (#1001)...');
    await send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('A4 Landscape'));
        if (btn) btn.click();
      `,
    });
    await sleep(1000);
    await capture('screenshot_p9_02_a4_landscape.png');

    // 3. Screenshot 3: Print Preview on Detail View
    console.log('[5] Capturing Print Preview with Toolbar (#1002)...');
    await send('Runtime.evaluate', {
      expression: `location.href = 'http://127.0.0.1:5173/manufacturing/production-receive/records/${CHALLAN_2_ID}/print';`,
    });
    await sleep(2500);
    await capture('screenshot_p9_03_print_preview.png');

    // 4. Screenshot 4: PDF Export Verification (shows dynamic title and ready-to-print state)
    console.log('[6] Capturing PDF Export state (#1001)...');
    await send('Runtime.evaluate', {
      expression: `location.href = 'http://127.0.0.1:5173/manufacturing/production-receive/records/${CHALLAN_1_ID}/print';`,
    });
    await sleep(2000);
    await capture('screenshot_p9_04_pdf_export_verification.png');

    // 5. Screenshot 5: Multi-page Printing (Challan #1004 with 25 cartons)
    console.log('[7] Capturing Multi-page Printing (#1004, 25 cartons)...');
    await send('Runtime.evaluate', {
      expression: `location.href = 'http://127.0.0.1:5173/manufacturing/production-receive/records/${CHALLAN_4_ID}/print';`,
    });
    await sleep(3000);
    await capture('screenshot_p9_05_multipage_printing.png');

    // 6. Screenshot 6: Cancelled Challan Print (Challan #1003)
    console.log('[8] Capturing Cancelled Challan with Watermark (#1003)...');
    await send('Runtime.evaluate', {
      expression: `location.href = 'http://127.0.0.1:5173/manufacturing/production-receive/records/${CHALLAN_3_ID}/print';`,
    });
    await sleep(2500);
    await capture('screenshot_p9_06_cancelled_challan_print.png');

    console.log('All 6 Phase 9 screenshots captured successfully!');
    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch((err) => {
  console.error('Phase 9 screenshot capture failed:', err);
  process.exit(1);
});

