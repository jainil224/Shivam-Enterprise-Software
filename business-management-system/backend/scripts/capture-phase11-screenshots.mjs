import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\51faf6aa-c94e-40b0-8b9a-fa7671edae13';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9225;
const STATIC_PORT = 5183;

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

function launchChrome(debugPort) {
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${debugPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--window-size=1280,850',
    'about:blank',
  ], { detached: true, stdio: 'ignore' });
  chromeProc.unref();
  return chromeProc;
}

async function connectCDP(debugPort) {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
      const tabs = await res.json();
      if (tabs && tabs.length > 0) {
        const wsUrl = tabs[0].webSocketDebuggerUrl;
        const ws = new globalThis.WebSocket(wsUrl);
        await new Promise((resolve, reject) => {
          ws.onopen = resolve;
          ws.onerror = reject;
        });
        return ws;
      }
    } catch {
      await sleep(300);
    }
  }
  throw new Error('Failed to connect to Chrome CDP.');
}

let nextCdpId = 1;
function sendCdpCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextCdpId++;
    const handler = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      } catch (err) {
        reject(err);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function captureScreenshot(ws, filename) {
  const res = await sendCdpCommand(ws, 'Page.captureScreenshot', { format: 'png' });
  const outPath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
  console.log(`Saved screenshot: ${filename} (${Math.round(res.data.length * 0.75 / 1024)} KB)`);
}

async function run() {
  const distDir = 'd:\\SIVAM Enterprise Software\\business-management-system\\frontend\\dist';
  const staticServer = await startStaticServer(distDir, STATIC_PORT);
  launchChrome(DEBUG_PORT);
  await sleep(1500);

  const ws = await connectCDP(DEBUG_PORT);
  await sendCdpCommand(ws, 'Page.enable');
  await sendCdpCommand(ws, 'Runtime.enable');

  const setupStorage = async () => {
    await sendCdpCommand(ws, 'Runtime.evaluate', {
      expression: `
        localStorage.setItem('bms_active_company_id', 'b5f484da-fc82-46c0-8ea2-b171dcc0c78c');
        localStorage.setItem('bms_active_fy_id', 'd6f33296-1c4a-4c2a-968b-08b4929604f1');
        localStorage.setItem('bms_active_company', JSON.stringify({
          id: 'b5f484da-fc82-46c0-8ea2-b171dcc0c78c',
          companyName: 'SHIVAM ENTERPRISE',
          gstin: '24AABCS1234F1Z8',
          state: 'Gujarat',
          city: 'Surat'
        }));
        localStorage.setItem('bms_active_financial_year', JSON.stringify({
          id: 'd6f33296-1c4a-4c2a-968b-08b4929604f1',
          yearName: '2026 - 2027',
          startDate: '2026-04-01T00:00:00.000Z',
          endDate: '2027-03-31T23:59:59.999Z',
          isLocked: false
        }));
        sessionStorage.setItem('bms_selected_production_book_id', 'aa477d9f-a037-4b26-96cb-d31c1d1a3733');
      `,
    });
  };

  try {
    // 1. New Purchase Bill - GSTIN Input Screen
    console.log('\n[1] Capturing Purchase Bill GSTIN Input...');
    await sendCdpCommand(ws, 'Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/transactions/purchase/new` });
    await sleep(1000);
    await setupStorage();
    await sendCdpCommand(ws, 'Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/transactions/purchase/new` });
    await sleep(1500);
    await captureScreenshot(ws, 'screenshot_p11_01_purchase_bill_gstin_input.png');

    // 2. GSTIN Verified Details with External / Local Data
    console.log('[2] Capturing Verified GSTIN Details...');
    await sendCdpCommand(ws, 'Runtime.evaluate', {
      expression: `
        const gstinInput = document.querySelector('input[placeholder="24AAAAA0000A1Z5"]');
        if (gstinInput) {
          gstinInput.value = '24AAAAR1234A1Z9';
          gstinInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      `,
    });
    await sleep(300);
    // Click verify button
    await sendCdpCommand(ws, 'Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Verify GSTIN'));
        if (btn) btn.click();
      `,
    });
    await sleep(1500);
    await captureScreenshot(ws, 'screenshot_p11_02_verified_gstin_details.png');

    // 3. Purchase Bill without Party Master (Unregistered Supplier Snapshot)
    console.log('[3] Capturing Purchase Bill without Party Master...');
    await sendCdpCommand(ws, 'Runtime.evaluate', {
      expression: `
        const gstinInput = document.querySelector('input[placeholder="24AAAAA0000A1Z5"]');
        if (gstinInput) {
          gstinInput.value = '24UNREG9876A1Z3';
          gstinInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const nameInput = document.querySelector('input[placeholder="Supplier Company / Firm Name"]');
        if (nameInput) {
          nameInput.value = 'MODERN SPINNERS GUJARAT LLP';
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const addrInput = document.querySelector('input[placeholder="Plot / Street / GIDC Industrial Area"]');
        if (addrInput) {
          addrInput.value = 'Plot 44, GIDC Sachin, Surat';
          addrInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      `,
    });
    await sleep(500);
    await captureScreenshot(ws, 'screenshot_p11_03_purchase_bill_no_party_master.png');

    // 4. Optional Save Supplier to Party Master Checkbox & Button
    console.log('[4] Capturing Optional Save to Party Master...');
    await sendCdpCommand(ws, 'Runtime.evaluate', {
      expression: `
        const cb = document.querySelector('input[type="checkbox"]');
        if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
      `,
    });
    await sleep(500);
    await captureScreenshot(ws, 'screenshot_p11_04_save_supplier_to_party_master.png');

    // 5. Challan Detail Page with "Create Purchase Bill" Action Button
    console.log('[5] Capturing Challan Detail page with Create Purchase Bill action...');
    await sendCdpCommand(ws, 'Page.navigate', {
      url: `http://127.0.0.1:${STATIC_PORT}/manufacturing/production-receive/records/ch-89-demo-guid`,
    });
    await sleep(1500);
    await captureScreenshot(ws, 'screenshot_p11_05_challan_detail_create_purchase_bill.png');

    // 6. Purchase Bill Populated from Production Challan
    console.log('[6] Capturing Purchase Bill populated from Challan...');
    await sendCdpCommand(ws, 'Page.navigate', {
      url: `http://127.0.0.1:${STATIC_PORT}/transactions/purchase/create-from-challan/ch-89-demo-guid`,
    });
    await sleep(1500);
    await captureScreenshot(ws, 'screenshot_p11_06_purchase_bill_from_challan.png');

    // 7. Commercial & GST Calculations (Quantity, Rate, Intra-state CGST/SGST, Round Off)
    console.log('[7] Capturing Commercial & GST Calculations...');
    await sendCdpCommand(ws, 'Runtime.evaluate', {
      expression: `
        window.scrollTo(0, document.body.scrollHeight);
      `,
    });
    await sleep(500);
    await captureScreenshot(ws, 'screenshot_p11_07_commercial_gst_calculations.png');

    // 8. Purchase Bill Register with New Entries
    console.log('[8] Capturing Purchase Register...');
    await sendCdpCommand(ws, 'Page.navigate', {
      url: `http://127.0.0.1:${STATIC_PORT}/transactions/purchase`,
    });
    await sleep(1500);
    await captureScreenshot(ws, 'screenshot_p11_08_purchase_bill_saved_detail.png');

    // 9. Challan Edit Mode after fixing company_id error
    console.log('[9] Capturing Challan Edit Mode after fix...');
    await sendCdpCommand(ws, 'Page.navigate', {
      url: `http://127.0.0.1:${STATIC_PORT}/manufacturing/production-receive/entry?edit=ch-89-demo-guid&bookId=aa477d9f-a037-4b26-96cb-d31c1d1a3733`,
    });
    await sleep(1500);
    await captureScreenshot(ws, 'screenshot_p11_09_challan_edit_mode_fixed.png');

    console.log('\nAll 9 Phase 11 screenshots successfully captured!\n');
  } finally {
    ws.close();
    staticServer.close();
  }
}

run().catch((err) => {
  console.error('Screenshot runner failed:', err);
  process.exit(1);
});

