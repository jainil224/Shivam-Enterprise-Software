import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\51faf6aa-c94e-40b0-8b9a-fa7671edae13';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;

const COMPANY_ID = 'b5f484da-fc82-46c0-8ea2-b171dcc0c78c';
const FY_ID = 'd6f33296-1c4a-4c2a-968b-08b4929604f1';
const BOOK_ID = 'aa477d9f-a037-4b26-96cb-d31c1d1a3733';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function startStaticServer(distDir, port) {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || !path.extname(reqPath)) {
      reqPath = '/index.html';
    }
    const filePath = path.join(distDir, reqPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(filePath));
    } else {
      const indexPath = path.join(distDir, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(indexPath));
    }
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`Static server running on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

function startMockApiServer(port) {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = req.url || '';
    let responseData = { success: true, data: {} };

    if (url.includes('/validate-context/')) {
      responseData = {
        success: true,
        data: {
          company: {
            id: COMPANY_ID,
            companyName: 'SHIVAM ENTERPRISE',
            companyCode: 'SHIVAM01',
          },
          financialYear: {
            id: FY_ID,
            yearName: '2026 - 2027',
            isLocked: false,
          },
        },
      };
    } else if (url.includes('/production-receive/books/') && url.includes('/validate')) {
      responseData = {
        success: true,
        data: {
          valid: true,
          productionBook: {
            id: BOOK_ID,
            bookName: 'YARN SALES',
            prefix: 'PR-25',
            openingBalance: '7264159.77',
            isActive: true,
            companyId: COMPANY_ID,
            financialYearId: FY_ID,
          },
        },
      };
    } else if (url.includes('/masters/parties')) {
      responseData = {
        success: true,
        data: [
          { id: 'p1', partyName: 'SHREE GANESH FABRICS', partyCode: 'P-01' },
          { id: 'p2', partyName: 'PATEL TEXTILES', partyCode: 'P-02' },
        ],
      };
    } else if (url.includes('/masters/machines')) {
      responseData = {
        success: true,
        data: [
          { id: 'm1', machineName: 'TEXTURISING 01', machineCode: 'M-01' },
          { id: 'm2', machineName: 'TEXTURISING 02', machineCode: 'M-02' },
        ],
      };
    } else if (url.includes('/masters/operators')) {
      responseData = {
        success: true,
        data: [
          { id: 'o1', operatorName: 'RAMESH BHAI', operatorCode: 'OP-01' },
          { id: 'o2', operatorName: 'SURESH PATEL', operatorCode: 'OP-02' },
        ],
      };
    } else if (url.includes('/masters/yarn-qualities')) {
      responseData = {
        success: true,
        data: [
          { id: 'q1', qualityName: '80/72 DTY NIM', denier: '80/72' },
          { id: 'q2', qualityName: '150/48 DTY HIM', denier: '150/48' },
        ],
      };
    } else if (url.includes('/masters/yarn-grades')) {
      responseData = {
        success: true,
        data: [
          { id: 'g1', gradeName: 'A' },
          { id: 'g2', gradeName: 'B' },
          { id: 'g3', gradeName: 'FRESH' },
        ],
      };
    } else if (url.includes('/masters/locations')) {
      responseData = {
        success: true,
        data: [
          { id: 'l1', locationName: 'GODOWN A', locationCode: 'L-01' },
          { id: 'l2', locationName: 'WAREHOUSE 02', locationCode: 'L-02' },
        ],
      };
    } else if (url.includes('/production-receive/next-numbers/')) {
      responseData = {
        success: true,
        data: {
          nextChallanNumber: '89',
          nextCartonNumber: '1460',
        },
      };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseData));
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`Mock API server running on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

async function main() {
  console.log('[1] Starting static server (5180) & mock API server (5000)...');
  const distDir = path.resolve('business-management-system', 'frontend', 'dist');
  const staticServer = await startStaticServer(distDir, 5180);
  const apiServer = await startMockApiServer(5000);

  console.log('[2] Launching headless Chrome...');
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1366,768',
      '--user-data-dir=' + path.join(ARTIFACT_DIR, 'scratch', 'chrome_profile_p10'),
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

    // Set localStorage context and navigate
    console.log('[3] Initializing origin context and opening Production Receive Entry...');
    await send('Page.navigate', { url: 'http://127.0.0.1:5180/' });
    await sleep(1000);

    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('bms_active_company_id', '${COMPANY_ID}');
        localStorage.setItem('bms_active_fy_id', '${FY_ID}');
        sessionStorage.setItem('bms_selected_production_book_id', '${BOOK_ID}');
        location.href = 'http://127.0.0.1:5180/manufacturing/production-receive/entry?bookId=${BOOK_ID}';
      `,
    });
    await sleep(2500);

    // Helper injected into page
    await send('Runtime.evaluate', {
      expression: `
        window.setReactInput = function(input, value) {
          if (!input) return;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, value);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        };
      `,
    });

    // 1. Screenshot 1: First carton with four manual inputs entered (Carton Number: 1460, Carton Weight: 1.000, Cops: 24, Gross Weight: 31.620)
    console.log('[4] Screenshot 1: First carton with four manually entered fields...');
    await send('Runtime.evaluate', {
      expression: `
        const inputs = document.querySelectorAll('table tbody tr:first-child input');
        if (inputs.length >= 4) {
          window.setReactInput(inputs[0], '1460');
          window.setReactInput(inputs[1], '1.000');
          window.setReactInput(inputs[2], '24');
          window.setReactInput(inputs[3], '31.620');
          inputs[3].focus();
        }
      `,
    });
    await sleep(800);
    await capture('screenshot_p10_01_first_carton_four_inputs.png');

    // 2. Screenshot 2: First carton with automatic calculations (press Enter on grossWeight)
    console.log('[5] Screenshot 2: First carton with automatic calculations...');
    await send('Runtime.evaluate', {
      expression: `
        const grossInput = document.querySelectorAll('table tbody tr:first-child input')[3];
        if (grossInput) {
          grossInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        }
      `,
    });
    await sleep(1000);
    await capture('screenshot_p10_02_first_carton_calculations.png');

    // 3. Screenshot 3: Second carton (1461) with inherited fields ready for Gross Weight
    console.log('[6] Screenshot 3: Second carton with inherited fields ready for Gross Weight...');
    await sleep(500);
    await capture('screenshot_p10_03_second_carton_inherited.png');

    // 4. Screenshot 4: Second carton with only Gross Weight entered (32.400)
    console.log('[7] Screenshot 4: Second carton with only Gross Weight entered...');
    await send('Runtime.evaluate', {
      expression: `
        const row2Inputs = document.querySelectorAll('table tbody tr')[1]?.querySelectorAll('input');
        if (row2Inputs && row2Inputs.length >= 4) {
          window.setReactInput(row2Inputs[3], '32.400');
          row2Inputs[3].focus();
        }
      `,
    });
    await sleep(800);
    await capture('screenshot_p10_04_second_carton_gross_entered.png');

    // 5. Screenshot 5: Press enter on second carton -> Third carton (1462) ready
    console.log('[8] Screenshot 5: Third carton ready for Gross Weight entry...');
    await send('Runtime.evaluate', {
      expression: `
        const row2Gross = document.querySelectorAll('table tbody tr')[1]?.querySelectorAll('input')[3];
        if (row2Gross) {
          row2Gross.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        }
      `,
    });
    await sleep(1000);
    await capture('screenshot_p10_05_third_carton_ready.png');

    // 6. Screenshot 6: Enter third carton (33.100) and observe totals
    console.log('[9] Screenshot 6: Multiple cartons with correctly calculated totals...');
    await send('Runtime.evaluate', {
      expression: `
        const row3Inputs = document.querySelectorAll('table tbody tr')[2]?.querySelectorAll('input');
        if (row3Inputs && row3Inputs.length >= 4) {
          window.setReactInput(row3Inputs[3], '33.100');
          row3Inputs[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        }
      `,
    });
    await sleep(1200);
    await capture('screenshot_p10_06_multiple_cartons_totals.png');

    console.log('All 6 Phase 10 screenshots captured successfully!');
    ws.close();
  } finally {
    chromeProcess.kill();
    staticServer.close();
    apiServer.close();
  }
}

main().catch((err) => {
  console.error('Phase 10 screenshot capture failed:', err);
  process.exit(1);
});
