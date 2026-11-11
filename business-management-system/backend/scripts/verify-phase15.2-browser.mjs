/**
 * Phase 15.2 - end-to-end browser verification of the Sales & Purchase Bill Base
 * report module, the Phase 15.2 report masters and the entry-form master links.
 *
 * Requires:
 *   - backend API on http://127.0.0.1:5000
 *   - frontend dev server on http://127.0.0.1:5173
 *   - Playwright resolvable from the script directory, plus system Chrome
 *     (npm i playwright && npx playwright install chrome)
 *
 * Run: node verify-phase15.2-browser.mjs
 * Writes phase15.2-browser-report.json next to this file. Exit code 0 means every
 * check passed and the browser console stayed clean.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:5000/api';
const COMPANY = '902a42ff-ee15-4437-af80-d649a06faabd';
const FY = '0ad77610-eefc-44a3-8a5f-a3a7b61f14f5';
const STAMP = String(Date.now()).slice(-6);

const results = [];
const consoleIssues = [];
const failedRequests = [];
const runRequests = [];

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log((ok ? 'PASS' : 'FAIL') + ' :: ' + name + (detail ? ' :: ' + detail : ''));
}

function attach(page, label) {
  page.on('console', (msg) => { if (msg.type() === 'error') consoleIssues.push('[' + label + '] ' + msg.text()); });
  page.on('pageerror', (err) => consoleIssues.push('[' + label + '] pageerror: ' + err.message));
  page.on('requestfailed', (req) => failedRequests.push('[' + label + '] ' + req.method() + ' ' + req.url()));
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/api/reports/bill-base/run')) {
      try { runRequests.push(JSON.parse(req.postData() || '{}')); } catch { runRequests.push({}); }
    }
  });
}

const API_HEADERS = {
  'x-company-id': COMPANY,
  'x-financial-year-id': FY,
  'Content-Type': 'application/json',
};

async function apiGet(path) {
  const response = await fetch(API + path, { headers: API_HEADERS });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function apiPatch(path, payload) {
  const response = await fetch(API + path, {
    method: 'PATCH',
    headers: API_HEADERS,
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

// Field(label) wraps a label plus its control in one div.
const fieldBox = (page, label) => page.locator('label', { hasText: label }).first().locator('..');
const selectFor = (page, label) => fieldBox(page, label).locator('select').first();
const ssButton = (page, label) => fieldBox(page, label).locator('button[aria-haspopup="listbox"]').first();
const ssPanel = (page, label) => fieldBox(page, label).locator('div[role="listbox"]');

async function ssOpen(page, label) {
  await ssButton(page, label).click();
  const panel = ssPanel(page, label);
  await panel.waitFor({ state: 'visible', timeout: 5000 });
  return panel;
}

async function ssPick(page, label, optionText) {
  const panel = await ssOpen(page, label);
  await panel.locator('button', { hasText: optionText }).first().click();
  await page.waitForTimeout(250);
}

async function ssAll(page, label) {
  const panel = await ssOpen(page, label);
  await panel.locator('button').first().click();
  await page.waitForTimeout(250);
}

async function ssValue(page, label) {
  const text = await ssButton(page, label).innerText();
  return text.split('\n')[0].trim();
}

const chipButtons = (page) => page.locator('button[title="Remove this filter"]');

const browser = await chromium.launch({ channel: 'chrome' });
let createdBrokerId = null;
let createdGroupId = null;
const cleanup = [];

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
  await ctx.addInitScript(([c, f]) => {
    localStorage.setItem('bms_active_company_id', c);
    localStorage.setItem('bms_active_fy_id', f);
  }, [COMPANY, FY]);
  const page = await ctx.newPage();
  attach(page, 'desktop');

  // Repeatable runs: retire QA fixture masters left behind by an earlier run so
  // the empty-state assertions describe the current database, not history.
  for (const [path, nameKey] of [
    ['/masters/brokers', 'brokerName'],
    ['/masters/party-groups', 'groupName'],
    ['/masters/item-groups', 'groupName'],
  ]) {
    const list = await apiGet(path);
    for (const row of list.body?.data ?? []) {
      if (String(row[nameKey] || '').startsWith('QA ') && row.isActive) {
        await apiPatch(path + '/' + row.id + '/status', { isActive: false });
      }
    }
  }

  // ============================================================
  // A. Report masters screen (7 masters, full CRUD, company scoped)
  // ============================================================
  await page.goto(BASE + '/masters/report-masters', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const mastersText = await page.locator('body').innerText();
  check('Report Masters screen is reachable', mastersText.includes('Report Masters'));

  const tabTitles = ['Party Groups', 'Areas', 'Brokers', 'Transporters', 'Sales Persons', 'Item Groups', 'Purchase Books'];
  const tabCount = await page.getByRole('button', { name: new RegExp('^(' + tabTitles.join('|') + ')$') }).count();
  check('All 7 report masters have a tab', tabCount === 7, 'tabs=' + tabCount);

  await page.getByRole('button', { name: 'Brokers', exact: true }).click();
  await page.waitForTimeout(800);
  check('Empty broker list shows an honest empty state', (await page.locator('body').innerText()).includes('No brokers found'));

  // Validation must block a broker without a code.
  await page.getByRole('button', { name: 'Add Broker' }).click();
  await page.waitForTimeout(300);
  check('New Broker form opens', (await page.locator('body').innerText()).includes('New Broker'));
  await page.getByPlaceholder('e.g. Mahesh Broker').fill('QA Broker ' + STAMP);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(500);
  const validationText = await page.locator('body').innerText();
  check('Broker without a code is rejected', /Broker code is required/i.test(validationText), validationText.split('\n').find((line) => /required/i.test(line)) || '');

  await page.getByPlaceholder('e.g. BR-01').fill('QA' + STAMP);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(1400);
  const brokerListText = await page.locator('body').innerText();
  check('Broker is created from the UI and listed', brokerListText.includes('QA Broker ' + STAMP));

  const brokersApi = await apiGet('/masters/brokers');
  const createdBroker = (brokersApi.body?.data ?? []).find((row) => row.brokerName === 'QA Broker ' + STAMP);
  createdBrokerId = createdBroker?.id ?? null;
  check('The created broker is really stored in PostgreSQL', Boolean(createdBrokerId), String(createdBrokerId));

  // Rename through the edit dialog.
  const brokerRow = page.locator('tr', { hasText: 'QA Broker ' + STAMP }).first();
  await brokerRow.locator('button[title="Edit record"]').click();
  await page.waitForTimeout(300);
  check('Edit Broker form opens with the stored values', (await page.locator('body').innerText()).includes('Edit Broker'));
  await page.getByPlaceholder('e.g. Mahesh Broker').fill('QA Broker Renamed ' + STAMP);
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await page.waitForTimeout(1400);
  check('Renamed broker is listed with the new name', (await page.locator('body').innerText()).includes('QA Broker Renamed ' + STAMP));

  // Search narrows the list.
  await page.getByPlaceholder('Search brokers...').fill('Renamed ' + STAMP);
  await page.waitForTimeout(900);
  const searchText = await page.locator('body').innerText();
  check('Master search narrows the list to the match', searchText.includes('Showing 1 brokers'), searchText.split('\n').find((line) => line.includes('Showing')) || '');
  await page.getByPlaceholder('Search brokers...').fill('');
  await page.waitForTimeout(800);

  // Deactivate and reactivate.
  const activeRow = page.locator('tr', { hasText: 'QA Broker Renamed ' + STAMP }).first();
  await activeRow.getByRole('button', { name: 'Deactivate' }).click();
  await page.waitForTimeout(1200);
  check('Deactivated broker leaves the active list', !(await page.locator('body').innerText()).includes('QA Broker Renamed ' + STAMP));
  await page.getByLabel('Show inactive').check();
  await page.waitForTimeout(1200);
  const inactiveText = await page.locator('body').innerText();
  check('Show inactive reveals the deactivated broker', inactiveText.includes('QA Broker Renamed ' + STAMP) && inactiveText.includes('Inactive'));
  const inactiveRow = page.locator('tr', { hasText: 'QA Broker Renamed ' + STAMP }).first();
  await inactiveRow.getByRole('button', { name: 'Activate' }).click();
  await page.waitForTimeout(1200);
  check('Broker can be reactivated', (await page.locator('body').innerText()).includes('Active'));
  await page.getByLabel('Show inactive').uncheck();
  await page.waitForTimeout(800);

  // Party group + item group used by the config screen.
  await page.getByRole('button', { name: 'Party Groups', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Add Party Group' }).click();
  await page.waitForTimeout(300);
  await page.getByPlaceholder('e.g. Yarn Suppliers').fill('QA Group ' + STAMP);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(1400);
  check('Party group is created from the UI', (await page.locator('body').innerText()).includes('QA Group ' + STAMP));
  const groupsApi = await apiGet('/masters/party-groups');
  createdGroupId = (groupsApi.body?.data ?? []).find((row) => row.groupName === 'QA Group ' + STAMP)?.id ?? null;
  check('The created party group is really stored in PostgreSQL', Boolean(createdGroupId), String(createdGroupId));

  await page.getByRole('button', { name: 'Item Groups', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Add Item Group' }).click();
  await page.waitForTimeout(300);
  await page.getByPlaceholder('e.g. Polyester Yarn').fill('QA Item Group ' + STAMP);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForTimeout(1400);
  check('Item group is created from the UI', (await page.locator('body').innerText()).includes('QA Item Group ' + STAMP));

  await page.getByRole('button', { name: 'Purchase Books', exact: true }).click();
  await page.waitForTimeout(900);
  const booksText = await page.locator('body').innerText();
  check('Purchase book tab lists only the active financial year books', booksText.includes('Purchase Books'));

  // Mobile usability of the masters screen.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  check('Masters screen has no page-level horizontal overflow on mobile', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.waitForTimeout(400);
  // ============================================================
  // B. Report configuration screen (filters, chips, columns)
  // ============================================================
  await page.goto(BASE + '/reports/sales-purchase/bill-base', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const configText = await page.locator('body').innerText();

  check('Config header uses the required title', /SALE\/PUR BILL BASE - REPORT CONFIGURATION/i.test(configText));
  const aside = page.locator('aside');
  check('Desktop sidebar is visible', await aside.isVisible());
  const asideText = await aside.innerText();
  check('Sidebar heading and count are shown', /REPORT NAME/i.test(asideText) && asideText.includes('20'));
  check('Sidebar lists all 20 reports', (await aside.getByRole('button').count()) === 20);
  check('Sidebar shows READY, PARTIAL and N/A', asideText.includes('READY') && asideText.includes('PARTIAL') && asideText.includes('N/A'));
  const selectedRow = aside.getByRole('button', { name: /Bill No Wise/ }).first();
  const selectedBg = await selectedRow.evaluate((el) => getComputedStyle(el).backgroundColor);
  check('Selected report row is dark teal', selectedBg === 'rgb(44, 95, 87)', selectedBg);

  const fromValue = await page.locator('input[type="date"]').first().inputValue();
  const toValue = await page.locator('input[type="date"]').nth(1).inputValue();
  check('Default bill dates use the real FY range', fromValue === '2026-04-01' && toValue >= fromValue && toValue <= '2027-03-31', fromValue + ' -> ' + toValue);

  const numbered = ['1. Sales / Purchase','2. Company Selection','3. Book','4. Schedule','5. Party Group','5.1 Area','6. Party','7. Delivery Party','8. Item','8.1 Item Group','9. Broker','10. Detail / Summary','11. Sales Person','16. Quantity Columns','17. Column Selection','18. Transporter','18.1 Vehicle','13. Print Item Details?','14. Rate Column','14.1 Rate Filter From','14.1 Rate Filter To','15. Wise Type','Attrib 1','Attrib 2','Attrib 3','City','Quality','Include Cancelled'];
  const upperConfigText = configText.toUpperCase();
  const missing = numbered.filter((label) => !upperConfigText.includes(label.toUpperCase()));
  check('Every numbered filter label is present', missing.length === 0, missing.join(' | '));

  const disabledLabels = ['4. Schedule','16. Quantity Columns','15. Wise Type','Attrib 1','Attrib 2','Attrib 3'];
  const disabledOk = [];
  for (const label of disabledLabels) disabledOk.push(await selectFor(page, label).isDisabled());
  check('Controls without a business model stay disabled', disabledOk.every(Boolean), disabledOk.join(','));
  const scheduleReason = await selectFor(page, '4. Schedule').getAttribute('title');
  check('Disabled controls carry the exact dependency reason', Boolean(scheduleReason) && scheduleReason.length > 20, scheduleReason || '');
  check('Quantity Columns states the stored-quantity limitation', (await selectFor(page, '16. Quantity Columns').locator('option').first().innerText()).includes('Stored quantity'));

  const masterFilters = ['3. Book','5. Party Group','5.1 Area','6. Party','7. Delivery Party','8. Item','8.1 Item Group','9. Broker','11. Sales Person','18. Transporter','18.1 Vehicle','City'];
  const enabled = [];
  for (const label of masterFilters) enabled.push(!(await ssButton(page, label).isDisabled()));
  check('Every Phase 15.2 master filter is enabled', enabled.every(Boolean), masterFilters.filter((label, index) => !enabled[index]).join(', '));
  check('Master filters are searchable selects, not native dropdowns', (await page.locator('button[aria-haspopup="listbox"]').count()) >= 13);

  const optionsApi = await apiGet('/reports/bill-base/options');
  const optionData = optionsApi.body?.data ?? {};
  const expectedCounts = {
    '3. Book': optionData.books?.length ?? 0,
    '5. Party Group': optionData.partyGroups?.length ?? 0,
    '5.1 Area': optionData.areas?.length ?? 0,
    '6. Party': optionData.parties?.length ?? 0,
    '9. Broker': optionData.brokers?.length ?? 0,
    '11. Sales Person': optionData.salespersons?.length ?? 0,
    '18. Transporter': optionData.transporters?.length ?? 0,
    '18.1 Vehicle': optionData.vehicles?.length ?? 0,
  };
  const qualityMasterCount = optionData.qualities?.length ?? 0;
  check('Quality filter is enabled only when the Yarn Quality master has records', (await ssButton(page, 'Quality').isDisabled()) === (qualityMasterCount === 0), 'masters=' + qualityMasterCount);

  const brokerPanel = await ssOpen(page, '9. Broker');
  const brokerOptionCount = await brokerPanel.locator('button[role="option"]').count();
  check('Broker filter lists exactly the real master rows', brokerOptionCount === expectedCounts['9. Broker'], 'ui=' + brokerOptionCount + ' api=' + expectedCounts['9. Broker']);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const areaPanel = await ssOpen(page, '5.1 Area');
  const areaPanelText = await areaPanel.innerText();
  check('Empty master list explains itself instead of inventing options', /No areas yet/i.test(areaPanelText), areaPanelText.replace(/\n/g, ' | '));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // Searchable dropdown: search then pick.
  const partyPanel = await ssOpen(page, '6. Party');
  await fieldBox(page, '6. Party').locator('input[placeholder="Search..."]').fill('ganesh');
  await page.waitForTimeout(300);
  const partyMatches = await partyPanel.locator('button[role="option"]').count();
  check('Searching inside the party dropdown narrows the options', partyMatches === 1, 'matches=' + partyMatches);
  await partyPanel.locator('button[role="option"]').first().click();
  await page.waitForTimeout(400);
  check('Picked party is shown in the control', (await ssValue(page, '6. Party')) === 'Shree Ganesh Textiles', await ssValue(page, '6. Party'));
  check('Picking a filter adds an active filter chip', (await chipButtons(page).count()) === 1 && (await chipButtons(page).first().innerText()).includes('Party: Shree Ganesh Textiles'));

  await chipButtons(page).first().click();
  await page.waitForTimeout(300);
  check('A chip can be removed on its own', (await chipButtons(page).count()) === 0 && (await ssValue(page, '6. Party')) === 'All Parties');

  // Dependent narrowing: a party group with no parties empties the party list.
  await ssPick(page, '5. Party Group', 'QA Group ' + STAMP);
  await page.waitForTimeout(300);
  check('Selecting a party group narrows the party list', (await ssValue(page, '6. Party')) === 'No parties in this group / area', await ssValue(page, '6. Party'));
  const narrowedPanel = await ssOpen(page, '6. Party');
  check('Narrowed party list shows the dependent empty state', /No parties in this group \/ area/i.test(await narrowedPanel.innerText()));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await ssAll(page, '5. Party Group');
  await page.waitForTimeout(300);
  check('Clearing the party group restores the full party list', (await ssValue(page, '6. Party')) === 'All Parties');

  // Clear all.
  await ssPick(page, '9. Broker', 'QA Broker Renamed ' + STAMP);
  await ssPick(page, '3. Book', 'DEBIT NOTE');
  await page.waitForTimeout(300);
  check('Multiple filters show multiple chips', (await chipButtons(page).count()) === 2, 'chips=' + (await chipButtons(page).count()));
  check('Active filter counter matches the chips', /active filters \(2\)/i.test(await page.locator('body').innerText()));
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.waitForTimeout(400);
  check('Clear all removes every chip and resets the controls', (await chipButtons(page).count()) === 0 && (await ssValue(page, '9. Broker')) === 'All Brokers' && (await ssValue(page, '3. Book')) === 'All Books');

  // Column selector: new columns, add/remove, reorder.
  await page.getByRole('button', { name: '3. New' }).click();
  await page.waitForTimeout(600);
  const selectorText = await page.locator('body').innerText();
  check('Column selector opens in New mode', selectorText.includes('All Columns') && selectorText.includes('Selected Columns'));
  const newColumnLabels = ['Party Group', 'Area', 'Broker', 'Transporter', 'Salesperson', 'Vehicle', 'Due Days', 'Grade', 'Lot', 'HSN/SAC', 'Item Group', 'Delivery Party', 'Book'];
  const selectorMissing = newColumnLabels.filter((label) => !selectorText.includes(label));
  check('Column selector offers every Phase 15.2 bill field', selectorMissing.length === 0, selectorMissing.join(', '));
  check('Column selector exposes the full button set', (await page.getByRole('button', { name: 'Add All', exact: true }).count()) === 1 && (await page.getByRole('button', { name: 'Remove All', exact: true }).count()) === 1 && (await page.getByRole('button', { name: 'Up', exact: true }).count()) === 1 && (await page.getByRole('button', { name: 'Down', exact: true }).count()) === 1);

  const selectedBefore = Number(((await page.locator('body').innerText()).match(/(\d+) selected/) || [])[1] || 0);
  await page.getByPlaceholder('Search columns...').fill('Vehicle');
  await page.waitForTimeout(300);
  const vehicleOption = page.getByText('Vehicle', { exact: true }).first().locator('..');
  await vehicleOption.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForTimeout(300);
  const afterAdd = await page.locator('body').innerText();
  check('A new column can be added to the selection', Number((afterAdd.match(/(\d+) selected/) || [])[1]) === selectedBefore + 1 && afterAdd.includes('Vehicle'), (afterAdd.match(/(\d+) selected/) || [''])[0]);
  await page.getByRole('button', { name: 'Cancel' }).last().click();
  await page.waitForTimeout(400);

  // Layout of the config screen.
  const previewBox = await page.getByRole('button', { name: /Preview/ }).first().boundingBox();
  check('Bottom action bar stays inside the viewport', Boolean(previewBox) && previewBox.y + previewBox.height <= 950, JSON.stringify(previewBox));
  check('Desktop config has no page-level horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));

  // Switching report format keeps the configured filters.
  await ssPick(page, '6. Party', 'Rajkot Cotton Traders');
  const partyBefore = await ssValue(page, '6. Party');
  await aside.getByRole('button', { name: /Party Wise/ }).first().click();
  await page.waitForTimeout(600);
  check('Switching format keeps valid filters', (await ssValue(page, '6. Party')) === partyBefore && partyBefore !== 'All Parties');
  check('Switching format updates the selected report info', (await page.locator('body').innerText()).includes('Report: Party Wise'));
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.waitForTimeout(500);
  check('Reset restores the default filters', (await ssValue(page, '6. Party')) === 'All Parties' && (await page.locator('body').innerText()).includes('Report: Bill No Wise'));
  // ============================================================
  // C. A displayed master filter must really reach the backend
  // ============================================================
  await ssPick(page, '9. Broker', 'QA Broker Renamed ' + STAMP);
  const brokerChipText = await chipButtons(page).first().innerText();
  check('Broker selection is reflected in the active filter chip', brokerChipText.includes('Broker: QA Broker Renamed ' + STAMP), brokerChipText);
  runRequests.length = 0;
  await page.getByRole('button', { name: /Preview/ }).first().click();
  await page.waitForTimeout(3000);
  const brokerRun = runRequests[runRequests.length - 1] ?? {};
  check('Preview sends the selected broker id to the backend', brokerRun.brokerId === createdBrokerId, String(brokerRun.brokerId));
  const emptyResultsText = await page.locator('body').innerText();
  check('A filter that matches nothing reports 0 documents', emptyResultsText.includes('0 documents match'), (emptyResultsText.match(/\d+ documents match/) || [''])[0]);
  check('Empty result set shows the honest empty state', /No document matches the current date range and filters/.test(emptyResultsText));
  check('Export and print stay disabled with no rows', await page.getByRole('button', { name: /Print \/ PDF/ }).first().isDisabled());

  await page.goto(BASE + '/reports/sales-purchase/bill-base', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('Returning to the configuration restores the saved filters', (await ssValue(page, '9. Broker')) === 'QA Broker Renamed ' + STAMP, await ssValue(page, '9. Broker'));
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.waitForTimeout(400);
  check('Clear all resets the restored filters', (await chipButtons(page).count()) === 0 && (await ssValue(page, '9. Broker')) === 'All Brokers');

  // ============================================================
  // D. Results and A4 print preview
  // ============================================================
  await ssPick(page, '6. Party', 'Shree Ganesh Textiles');
  await page.getByRole('button', { name: /Preview/ }).first().click();
  await page.waitForTimeout(3000);
  const resultsText = await page.locator('body').innerText();
  check('Party filter narrows the dataset to 2 documents', resultsText.includes('2 documents match'), (resultsText.match(/\d+ documents match/) || [''])[0]);
  check('Filtered total matches the stored bills', resultsText.includes('54,075.00'), (resultsText.match(/54,075\.00/g) || ['']).join(','));

  await page.getByRole('button', { name: /Print \/ PDF/ }).first().click();
  await page.waitForTimeout(2000);
  check('Print action opens the A4 preview route', page.url().includes('/bill-base/print'), page.url());
  const printText = await page.locator('body').innerText();

  const workspaceBg = await page.locator('.print-workspace').evaluate((el) => getComputedStyle(el).backgroundColor);
  check('Preview workspace is neutral grey', workspaceBg === 'rgb(139, 145, 141)', workspaceBg);
  const sheet = page.locator('.print-sheet').first();
  const sheetBox = await sheet.boundingBox();
  check('A4 portrait sheet uses real A4 width', Boolean(sheetBox) && sheetBox.width >= 780 && sheetBox.width <= 810, String(sheetBox && sheetBox.width));
  const sheetBorder = await sheet.evaluate((el) => getComputedStyle(el).borderTopColor);
  check('A4 paper has the thin gold border', sheetBorder === 'rgb(201, 162, 39)', sheetBorder);
  check('A4 paper has a shadow', (await sheet.evaluate((el) => getComputedStyle(el).boxShadow)) !== 'none');
  check('Company header uses the real company name', printText.includes('OTHER TEXTILES LTD'));
  check('Company header uses the real GSTIN and phone', printText.includes('27AABCS9999F1Z1') && /Phone/i.test(printText));
  check('Print header shows FY, from and to dates', printText.includes('2026 - 2027') && printText.includes('2026-04-01') && /To: 2026-\d{2}-\d{2}/.test(printText));
  check('Report title uses the selected format and mode', /BILL NO WISE/i.test(printText) && /PURCHASE/i.test(printText) && /DETAIL/i.test(printText));
  check('Printed filter summary lists the applied party filter', /Party: Shree Ganesh Textiles/.test(printText));
  check('Printed filter summary states the cancelled-document policy', /Cancelled documents: excluded/i.test(printText), (printText.match(/Cancelled documents: [a-z]+/) || [''])[0]);
  check('Page numbering is real', /Page 1 of \d+/.test(printText), (printText.match(/Page 1 of \d+/) || [''])[0]);
  check('Print totals match the results grid', printText.includes('54,075.00') && printText.includes('TOTAL'));
  const styleText = (await page.locator('style').allInnerTexts()).join('\n');
  check('Browser print CSS declares A4 portrait', styleText.includes('A4 portrait'));

  const prev = page.getByRole('button', { name: 'Previous page' });
  const next = page.getByRole('button', { name: 'Next page' });
  check('Previous is disabled on the first page', await prev.isDisabled());
  const totalSheets = Number((printText.match(/Page 1 of (\d+)/) || [])[1] || 0);
  check('Toolbar reports the real sheet count', totalSheets > 0, 'sheets=' + totalSheets);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(400);
  const printedSheets = await page.locator('.print-sheet:visible').count();
  check('Browser printing renders every A4 sheet', printedSheets === totalSheets, printedSheets + '/' + totalSheets);
  await page.emulateMedia({ media: 'screen' });
  await page.waitForTimeout(300);

  // Zoom and fit-to-page controls.
  const zoomPercent = async () =>
    Number(((await page.locator('button[aria-label="Zoom in"]').locator('xpath=preceding-sibling::span[1]').innerText()).match(/(\d+)/) || [])[1] || 0);
  const fitPercent = await zoomPercent();
  check('Preview opens in fit-to-page mode', fitPercent > 0, fitPercent + '%');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForTimeout(300);
  const zoomedIn = await zoomPercent();
  check('Zoom in enlarges the A4 preview', zoomedIn === fitPercent + 20, fitPercent + '% -> ' + zoomedIn + '%');
  const zoomedSheet = await page.locator('.print-sheet').first().boundingBox();
  check('Zoom really changes the rendered sheet size', Boolean(zoomedSheet) && zoomedSheet.width > sheetBox.width, String(sheetBox.width) + ' -> ' + String(zoomedSheet && zoomedSheet.width));
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.waitForTimeout(300);
  check('Zoom out shrinks the A4 preview', (await zoomPercent()) === zoomedIn - 10, String(await zoomPercent()));
  await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await page.waitForTimeout(300);
  check('Fit restores the fitted zoom', (await zoomPercent()) === fitPercent, String(await zoomPercent()));

  await page.getByRole('button', { name: 'Portrait' }).click();
  await page.waitForTimeout(700);
  const landscapeBox = await page.locator('.print-sheet').first().boundingBox();
  check('Landscape uses real A4 landscape width', Boolean(landscapeBox) && landscapeBox.width >= 1100 && landscapeBox.width <= 1140, String(landscapeBox && landscapeBox.width));
  check('Landscape print CSS is applied', (await page.locator('style').allInnerTexts()).join('\n').includes('A4 landscape'));
  check('Paging resets after an orientation change', (await page.locator('body').innerText()).includes('1 of '));
  const clipped = await page.locator('.print-sheet').first().locator('table').evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  check('Print table values are not clipped', !clipped);
  await page.getByRole('button', { name: 'Landscape' }).click();
  await page.waitForTimeout(400);

  // WhatsApp share is genuine text, no attachment claim.
  await page.evaluate(() => { window.__wa = null; window.open = (url) => { window.__wa = String(url); return null; }; });
  await page.getByRole('button', { name: 'WhatsApp' }).click();
  await page.waitForTimeout(300);
  const waUrl = await page.evaluate(() => window.__wa);
  const waText = waUrl ? decodeURIComponent(waUrl.split('text=')[1] || '') : '';
  check('WhatsApp opens a real share URL', Boolean(waUrl) && waUrl.startsWith('https://wa.me/?text='), String(waUrl));
  check('WhatsApp text carries the title and date range', /Bill No Wise/i.test(waText) && /2026-04-01 to 2026-\d{2}-\d{2}/.test(waText), waText.split('\n')[2]);
  check('WhatsApp does not claim a file attachment', !/attached|attachment:/i.test(waText));

  // Excel export.
  const xlsxPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.getByRole('button', { name: 'Excel' }).first().click();
  const xlsx = await xlsxPromise;
  const xlsxBuffer = readFileSync(await xlsx.path());
  check('Print preview Excel is a real .xlsx', xlsx.suggestedFilename().toLowerCase().endsWith('.xlsx') && xlsxBuffer[0] === 0x50 && xlsxBuffer[1] === 0x4b);

  // PDF export.
  const pdfPromise = page.waitForEvent('download', { timeout: 90000 });
  await page.getByRole('button', { name: /Save \/ Download/ }).click();
  const pdf = await pdfPromise;
  const pdfBuffer = readFileSync(await pdf.path());
  const pdfText = pdfBuffer.toString('latin1');
  check('Print preview PDF is genuine and paginated', pdfBuffer.subarray(0, 8).toString('latin1') === '%PDF-1.4' && /Page 1 of \d+/.test(pdfText));
  check('PDF carries the same company and title', pdfText.includes('OTHER TEXTILES LTD') && pdfText.includes('Bill No Wise'));
  check('PDF carries the applied party filter', pdfText.includes('Party: Shree Ganesh Textiles'));

  // ============================================================
  // E. Mobile configuration (390px)
  // ============================================================
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/reports/sales-purchase/bill-base', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  check('Mobile config has no page-level horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
  check('Mobile hides the fixed sidebar', !(await page.locator('aside').isVisible()));
  const reportsButton = page.getByRole('button', { name: /Reports \(20\)/ });
  check('Mobile offers the report drawer control', await reportsButton.isVisible());
  await reportsButton.click();
  await page.waitForTimeout(400);
  check('Mobile report drawer is usable', await page.getByRole('button', { name: /City Wise/ }).last().isVisible());
  await page.getByRole('button', { name: /City Wise/ }).last().click();
  await page.waitForTimeout(600);
  check('Mobile drawer selects a report and closes', (await page.locator('body').innerText()).includes('Report: City Wise'));

  const fieldA = await selectFor(page, '1. Sales / Purchase').boundingBox();
  const fieldB = await ssButton(page, '3. Book').boundingBox();
  check('Mobile filters use one column', Boolean(fieldA) && Boolean(fieldB) && Math.abs(fieldA.x - fieldB.x) < 1 && fieldB.y > fieldA.y, JSON.stringify([fieldA, fieldB]));

  await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll('div'));
    const scroller = panels.find((el) => el.scrollHeight > el.clientHeight + 40 && getComputedStyle(el).overflowY === 'auto');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  await page.waitForTimeout(400);
  const mobilePreview = await page.getByRole('button', { name: /Preview/ }).first().boundingBox();
  const lastField = await page.locator('label', { hasText: 'Include Cancelled' }).first().locator('..').boundingBox().catch(() => null);
  check('Mobile bottom bar does not overlap the last filter', !lastField || (mobilePreview && mobilePreview.y >= lastField.y + lastField.height), JSON.stringify([lastField, mobilePreview]));

  await ssButton(page, '9. Broker').scrollIntoViewIfNeeded();
  const chipsBeforeMobile = await chipButtons(page).count();
  await ssPick(page, '9. Broker', 'QA Broker Renamed ' + STAMP);
  check('Searchable master filter works on mobile', (await chipButtons(page).count()) === chipsBeforeMobile + 1, 'chips=' + (await chipButtons(page).count()));
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.waitForTimeout(300);

  await page.setViewportSize({ width: 1440, height: 950 });
  await page.waitForTimeout(400);
  // ============================================================
  // F. Entry forms capture the new master references (optional)
  // ============================================================
  await page.goto(BASE + '/transactions/purchase/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const pbText = await page.locator('body').innerText();
  check('Purchase bill entry exposes the report master block', /report master references/i.test(pbText));
  check('Purchase bill entry exposes the item line master block', /item line master references/i.test(pbText));

  const pbLabels = ['Purchase Book :', 'Broker :', 'Transporter :', 'Sales Person :', 'Delivery Party :', 'Vehicle No :'];
  const pbMissing = [];
  for (const label of pbLabels) {
    if ((await page.locator('label', { hasText: label }).count()) === 0) pbMissing.push(label);
  }
  check('Purchase bill entry has every Phase 15.2 master selector', pbMissing.length === 0, pbMissing.join(', '));

  const pbDefaults = [];
  for (const label of ['Purchase Book :', 'Broker :', 'Transporter :', 'Sales Person :']) {
    pbDefaults.push(await page.locator('label', { hasText: label }).first().locator('..').locator('select').first().inputValue());
  }
  check('Purchase master selectors default to Unassigned', pbDefaults.every((value) => value === ''), JSON.stringify(pbDefaults));
  const pbVehicle = await page.locator('label', { hasText: 'Vehicle No :' }).first().locator('..').locator('input').first().inputValue();
  check('Purchase vehicle field is free text and empty by default', pbVehicle === '', pbVehicle);

  const lineDefaults = [];
  for (const label of ['Item :', 'Yarn Quality :', 'Yarn Grade :']) {
    lineDefaults.push(await page.locator('label', { hasText: label }).first().locator('..').locator('select').first().inputValue());
  }
  check('Item line master selectors default to Not linked', lineDefaults.every((value) => value === ''), JSON.stringify(lineDefaults));
  const pbBookFirst = await page.locator('label', { hasText: 'Purchase Book :' }).first().locator('..').locator('select').first().locator('option').first().innerText();
  check('Purchase book selector offers an explicit Unassigned default', /unassigned/i.test(pbBookFirst), pbBookFirst);

  await page.goto(BASE + '/transactions/debit-notes/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const dnLabels = ['Broker :', 'Transporter :', 'Sales Person :', 'Vehicle No :'];
  const dnMissing = [];
  for (const label of dnLabels) {
    if ((await page.locator('label', { hasText: label }).count()) === 0) dnMissing.push(label);
  }
  check('Debit note entry has every Phase 15.2 master selector', dnMissing.length === 0, dnMissing.join(', '));
  const dnDefaults = [];
  for (const label of ['Broker :', 'Transporter :', 'Sales Person :']) {
    dnDefaults.push(await page.locator('label', { hasText: label }).first().locator('..').locator('select').first().inputValue());
  }
  check('Debit note master selectors default to Unassigned', dnDefaults.every((value) => value === ''), JSON.stringify(dnDefaults));
  const dnVehicle = await page.locator('label', { hasText: 'Vehicle No :' }).first().locator('..').locator('input').first().inputValue();
  check('Debit note vehicle field is empty by default', dnVehicle === '', dnVehicle);

  // ============================================================
  // G. Cleanup the QA fixture masters (deactivate; no deletes exist)
  // ============================================================
  if (createdBrokerId) {
    const res = await apiPatch('/masters/brokers/' + createdBrokerId + '/status', { isActive: false });
    cleanup.push('broker=' + res.status);
    check('QA broker is deactivated through the master API', res.status === 200, String(res.status));
  }
  if (createdGroupId) {
    const res = await apiPatch('/masters/party-groups/' + createdGroupId + '/status', { isActive: false });
    cleanup.push('partyGroup=' + res.status);
    check('QA party group is deactivated through the master API', res.status === 200, String(res.status));
  }
  const itemGroupsApi = await apiGet('/masters/item-groups');
  const createdItemGroup = (itemGroupsApi.body?.data ?? []).find((row) => row.groupName === 'QA Item Group ' + STAMP);
  if (createdItemGroup) {
    const res = await apiPatch('/masters/item-groups/' + createdItemGroup.id + '/status', { isActive: false });
    cleanup.push('itemGroup=' + res.status);
    check('QA item group is deactivated through the master API', res.status === 200, String(res.status));
  }
  const finalBrokers = await apiGet('/masters/brokers');
  check('The QA broker is no longer in the active master list', !(finalBrokers.body?.data ?? []).some((row) => row.id === createdBrokerId));

} catch (err) {
  check('Suite ran without throwing', false, err && err.message ? err.message : String(err));
} finally {
  await browser.close();
}

const passed = results.filter((r) => r.ok).length;
const report = {
  stamp: STAMP,
  generatedAt: new Date().toISOString(),
  passed,
  total: results.length,
  consoleIssues,
  failedRequests,
  cleanup,
  results,
};
writeFileSync(new URL('./phase15.2-browser-report.json', import.meta.url), JSON.stringify(report, null, 2), 'utf8');
console.log('\n' + passed + '/' + results.length + ' checks passed');
if (consoleIssues.length > 0) {
  console.log('Console issues:');
  consoleIssues.slice(0, 15).forEach((entry) => console.log('  ' + entry));
}
if (failedRequests.length > 0) {
  console.log('Failed requests:');
  failedRequests.slice(0, 15).forEach((entry) => console.log('  ' + entry));
}
process.exit(passed === results.length && consoleIssues.length === 0 ? 0 : 1);