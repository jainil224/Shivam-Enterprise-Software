import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\51faf6aa-c94e-40b0-8b9a-fa7671edae13';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;

const COMPANY_ID = 'b5f484da-fc82-46c0-8ea2-b171dcc0c78c';
const FY_ID = 'd6f33296-1c4a-4c2a-968b-08b4929604f1';
const BOOK_ID = 'aa477d9f-a037-4b26-96cb-d31c1d1a3733';

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
      '--user-data-dir=' + path.join(ARTIFACT_DIR, 'scratch', 'chrome_profile_p7'),
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

    // Set localStorage and navigate to Entry page
    console.log('[2] Initializing context on origin...');
    await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
    await sleep(1500);
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('bms_active_company_id', '${COMPANY_ID}');
        localStorage.setItem('bms_active_fy_id', '${FY_ID}');
        sessionStorage.setItem('bms_selected_production_book_id', '${BOOK_ID}');
        location.href = 'http://127.0.0.1:5173/manufacturing/production-receive/entry?bookId=${BOOK_ID}';
      `,
    });
    await sleep(3000);

    // 1. Screenshot of Blank Production Receive Entry
    console.log('[3] Capturing Blank Production Receive Entry...');
    await capture('screenshot_p7_01_blank_entry.png');

    // 2. Fill in Header and 1 Carton Row using React input setter
    console.log('[4] Filling header and single carton with React state dispatch...');
    await send('Runtime.evaluate', {
      expression: `
        function setReactInput(input, value) {
          if (!input) return;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const inputs = Array.from(document.querySelectorAll('input'));
        const lotInput = inputs.find(i => i.placeholder && i.placeholder.includes('LOT'));
        setReactInput(lotInput, 'LOT-80/72-A');

        const twistInput = inputs.find(i => i.placeholder && i.placeholder.includes('80'));
        setReactInput(twistInput, '80');

        // Fill Gross Weight for row 1
        const grossInputs = Array.from(document.querySelectorAll('tbody input[placeholder="0.000"]'));
        setReactInput(grossInputs[0], '31.620');
      `,
    });
    await sleep(1000);
    console.log('[5] Capturing Filled Production Receive Entry...');
    await capture('screenshot_p7_02_filled_entry.png');

    // 3. Add 3 more carton rows
    console.log('[6] Adding 3 more cartons...');
    for (let i = 0; i < 3; i++) {
      await send('Runtime.evaluate', {
        expression: `
          const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Add Carton'));
          if (addBtn) addBtn.click();
        `,
      });
      await sleep(400);
    }

    // Set weights for rows 2, 3, 4
    await send('Runtime.evaluate', {
      expression: `
        function setReactInput(input, value) {
          if (!input) return;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const grossInputs = Array.from(document.querySelectorAll('tbody input[placeholder="0.000"]'));
        setReactInput(grossInputs[1], '30.850');
        setReactInput(grossInputs[2], '31.200');
        setReactInput(grossInputs[3], '32.100');
      `,
    });
    await sleep(1000);

    console.log('[7] Capturing Multiple-carton calculation screenshot...');
    await capture('screenshot_p7_03_multiple_carton_calculation.png');

    // 4. Screenshot of Totals footer
    console.log('[8] Capturing Totals footer screenshot...');
    await capture('screenshot_p7_04_totals_footer.png');

    // 5. Click Save (F10)
    console.log('[9] Clicking Save button...');
    await send('Runtime.evaluate', {
      expression: `
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Save'));
        if (saveBtn) saveBtn.click();
      `,
    });
    await sleep(2500);

    console.log('[10] Capturing Successful save confirmation screenshot...');
    await capture('screenshot_p7_05_successful_save.png');

    console.log('All 5 Phase 7 screenshots captured successfully!');
    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

main().catch((err) => {
  console.error('Phase 7 screenshot capture failed:', err);
  process.exit(1);
});
