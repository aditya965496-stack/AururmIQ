import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
const base='http://127.0.0.1:3000';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let importedId=null;let existed=false;let createdRunId=null;
const nav=label=>page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:label,exact:true});
await mkdir('artifacts',{recursive:true});
try {
  await page.goto(base);await page.getByText('Market at a glance',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Dataset'}).count();
  assert.equal(await page.locator('.market-card').count(),4);
  assert.equal(await page.locator('.pair-table tbody tr').count(),6);
  await page.screenshot({path:'artifacts/overview-desktop.png',fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Watch GOLDTEN GOLDGUINEA',exact:true}).click();
  await page.reload();await page.getByText('Market at a glance',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Unwatch GOLDTEN GOLDGUINEA',exact:true}).waitFor();
  await nav('Contract comparison').click();
  await page.getByRole('combobox',{name:'First contract'}).selectOption('GOLDTEN-2026-10-30');
  await page.getByRole('combobox',{name:'Second contract'}).selectOption('GOLDGUINEA-2026-10-30');
  await page.getByRole('button',{name:'Z-score',exact:true}).click();
  assert.equal(await page.locator('.comparison-panel .chart-summary').count(),1);
  await page.getByRole('button',{name:'1M',exact:true}).click();
  await page.getByRole('button',{name:'Normalized price',exact:true}).click();
  await page.screenshot({path:'artifacts/comparison-desktop.png',fullPage:true,animations:'disabled'});
  await nav('Research lab').click();
  const researchResponse=page.waitForResponse(r=>r.url().endsWith('/api/research')&&r.request().method()==='POST'&&r.ok());
  await page.getByRole('button',{name:'Run research',exact:true}).click();
  createdRunId=(await (await researchResponse).json()).id;
  await page.locator('.run-verdict').waitFor();
  const ledger=page.locator('table').first();assert.ok(await ledger.locator('tbody tr').count()>0);
  assert.ok(await page.getByText('Reconciliation error',{exact:true}).count());
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export run',exact:true}).click();
  const file=await downloaded;assert.match(file.suggestedFilename(),/^aurumiq-run-.*\.json$/);
  await page.screenshot({path:'artifacts/research-desktop.png',fullPage:true,animations:'disabled'});
  await page.reload();await page.getByRole('heading',{name:'Research configuration',exact:true}).waitFor();
  const history=page.getByRole('combobox',{name:'Restore research run'});
  await history.locator('option').nth(1).waitFor({state:'attached'});
  await history.selectOption(await history.locator('option').nth(1).getAttribute('value'));
  await page.locator('.run-verdict').waitFor();
  await nav('Lifecycle calendar').click();await page.getByRole('button',{name:'Next month',exact:true}).click();
  assert.ok(await page.getByRole('heading',{name:'November 2026',exact:true}).count());
  await nav('Data health').click();await page.getByText('What’s verified, what isn’t',{exact:true}).waitFor();
  assert.ok(await page.getByText('Raw file SHA-256 recorded',{exact:true}).count()===0);
  const invalid='trade_date,requested_date,symbol,expiry,tender_start,open,high,low,close,volume,open_interest\n2026-09-30,2026-10-02,GOLDTEN,2026-10-30,2026-10-28,140000,141000,139000,140500,100,300\n';
  await page.getByRole('button',{name:'Import data',exact:true}).click();await page.getByRole('textbox',{name:'Or paste CSV'}).fill(invalid);
  await page.getByRole('button',{name:'Validate & import',exact:true}).click();await page.locator('.import-error').waitFor();
  assert.match(await page.locator('.import-error').innerText(),/DATA_DATE_MISMATCH/);
  const valid=invalid.replace('2026-09-30,2026-10-02','2026-09-30,2026-09-30')+'2026-09-30,2026-09-30,GOLDGUINEA,2026-10-30,2026-10-28,112000,113000,111000,112500,100,300\n';
  const before=await context.request.get(`${base}/api/datasets`);const ids=(await before.json()).map(d=>d.id);
  await page.getByRole('textbox',{name:'Or paste CSV'}).fill(valid);
  const response=page.waitForResponse(r=>r.url().endsWith('/api/datasets')&&r.request().method()==='POST'&&r.status()===201);
  await page.getByRole('button',{name:'Validate & import',exact:true}).click();const result=await (await response).json();importedId=result.id;existed=ids.includes(importedId);
  await page.getByText('Raw file SHA-256 recorded',{exact:true}).waitFor();
  await page.reload();await page.getByText('Raw file SHA-256 recorded',{exact:true}).waitFor();
  assert.equal(await page.getByRole('combobox',{name:'Dataset'}).inputValue(),importedId);
  await page.getByRole('combobox',{name:'Dataset'}).selectOption('demo');await page.getByText('Deterministic generator · not an exchange hash',{exact:true}).waitFor();
  await page.route('**/api/workspace?*',route=>route.abort());
  await page.getByRole('combobox',{name:'Dataset'}).selectOption(importedId);
  await page.getByRole('heading',{name:'Workspace unavailable',exact:true}).waitFor();
  await page.unroute('**/api/workspace?*');
  await page.getByRole('button',{name:'Reload sample workspace',exact:true}).click();
  await page.getByText('Deterministic generator · not an exchange hash',{exact:true}).waitFor();
  const hostile=await context.request.post(`${base}/api/research`,{headers:{Origin:'https://untrusted.example'},data:{datasetId:'demo',params:{}}});assert.equal(hostile.status(),403);
  const traversal=await context.request.get(`${base}/api/workspace?dataset=..%2F..%2Fpackage.json`);assert.equal(traversal.status(),404);
  const huge=await context.request.post(`${base}/api/research`,{headers:{Origin:base},data:{datasetId:'demo',params:{a:'GOLDTEN-2026-10-30',b:'GOLDGUINEA-2026-10-30',lookback:99999}}});assert.equal(huge.status(),422);
  for(const width of [360,390,768]) {
    await page.setViewportSize({width,height:900});
    if(width<761){await page.getByRole('button',{name:'Open navigation',exact:true}).click();}
    await nav('Overview').click();await page.getByText('Market at a glance',{exact:true}).waitFor();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false,`unexpected overflow at ${width}px`);
    await page.screenshot({path:`artifacts/overview-${width}.png`,fullPage:true,animations:'disabled'});
    if(width<761)await page.getByRole('button',{name:'Open navigation',exact:true}).click();
    await nav('Research lab').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`research overflow at ${width}px`);
  }
  assert.deepEqual(errors,[]);
  await page.setViewportSize({width:1440,height:1100});await nav('Overview').click();
  const cdp=await context.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:200,downloadThroughput:128000,uploadThroughput:64000,connectionType:'cellular3g'});
  await page.reload();await page.getByText('Market at a glance',{exact:true}).waitFor();
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await page.getByRole('button',{name:'Unwatch GOLDTEN GOLDGUINEA',exact:true}).click();
  await unlink('artifacts/browser-failure.png').catch(()=>{});
  console.log(JSON.stringify({status:'passed',checks:['desktop overview','pair controls and futures curve','persisted watchlist','research ledger','run download','saved run retrieval','calendar navigation','data provenance','invalid import rejection','valid import and reload','failed read and retry recovery','hostile origin denied','traversal denied','oversized lookback denied','360/390/768 overflow checks','200ms / 1Mbps throttled reload','no uncaught browser errors'],screenshots:'artifacts/'},null,2));
} catch(e) {
  await page.screenshot({path:'artifacts/browser-failure.png',fullPage:true});
  console.log('Failure state:',await page.locator('main').innerText());
  throw e;
} finally {
  if(importedId&&!existed&&/^[a-f0-9]{64}$/.test(importedId)) {
    const allowed=path.resolve('.data/datasets');
    for(const extension of ['csv','json']){const target=path.resolve(allowed,`${importedId}.${extension}`);if(path.dirname(target)!==allowed)throw new Error('Unexpected cleanup path');await unlink(target).catch(()=>{});}
  }
  if(createdRunId&&/^[a-f0-9-]{36}$/.test(createdRunId)) {
    const allowed=path.resolve('.data/runs');const target=path.resolve(allowed,`${createdRunId}.json`);
    if(path.dirname(target)!==allowed)throw new Error('Unexpected run cleanup path');
    await unlink(target).catch(()=>{});
  }
  await browser.close();
}
