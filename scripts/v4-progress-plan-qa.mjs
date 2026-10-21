import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin=process.env.PHASE3_VISUAL_BASE_URL??'http://127.0.0.1:3000';
const output='artifacts/phase3-visual/v4';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-gpu']}: {})});
const report={provenance:'Synthetic room/evidence and mocked plan save. Real components; no hosted learner writes.',cases:[]};
try{for(const [width,height] of [[320,700],[390,844],[820,1180],[1440,900]]){
 const c=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',deviceScaleFactor:1});const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const go=(mode,more='')=>p.goto(`${origin}/dev/study?shell=1&ui=phase3&mode=${mode}${more}`,{waitUntil:'networkidle'});
 const shot=async name=>{await p.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);document.querySelector('.modeSurface')?.scrollTo(0,0);});assert.equal(await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)),0,`${width} ${name}: no overflow`);const overlaps=await p.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const mascot=document.querySelector('.cmp[data-state="window"]:not([hidden])');if(!(mascot instanceof HTMLElement))return [];const a=mascot.getBoundingClientRect();return Array.from(document.querySelectorAll('.roomSectionIntro,.masteryHero,.weakSpots li,.mdTile')).filter(el=>{const b=el.getBoundingClientRect();return b.top<innerHeight&&b.bottom>0&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}).map(el=>el.className);});assert.deepEqual(overlaps,[],`${name}: companion clears evidence and headings`);const file=`${output}/${width}-${name}.png`;await p.screenshot({path:file,fullPage:true,animations:'disabled'});report.cases.push({width,name,screenshot:file});};
 await go('mastery');assert.match(await p.locator('.masteryHero').innerText(),/6 of 8 topics practiced/);assert.match(await p.locator('.progressRing').getAttribute('aria-label'),/75 percent of topics practiced/);assert.match(await p.locator('.statRow').innerText(),/8 \/ 12/);await shot('progress');
 await p.getByText('Where these numbers come from',{exact:true}).click();assert.match(await p.locator('.evidenceGuide').innerText(),/self-reported/);
 const action=p.getByRole('button',{name:'Practice Inherited traits and environment',exact:true}).first();await action.click();await p.locator('.quizSetup').waitFor();assert.equal(await p.getByRole('checkbox',{name:'Select Inherited traits and environment'}).isChecked(),true);assert.equal(await p.locator('.topicReadout:visible input:checked').count(),1);
 await go('mastery','&canonical=1');assert.match(await p.locator('.mdTiles').innerText(),/Independent recall/);assert.match(await p.locator('.mdTiles').innerText(),/Needs another check/);assert.match(await p.locator('.mdTiles').innerText(),/Source unavailable/);assert.doesNotMatch(await p.locator('.mdTiles').innerText(),/%/);await shot('canonical-stages');
 await p.getByRole('button',{name:/Balanced and unbalanced forces: Source unavailable/}).click();assert.match(p.url(),/mode=materials/);
 await go('weak');await shot('weak-areas');await p.locator('.weakAreaList > li').first().getByRole('button').click();assert.match(p.url(),/mode=learn/);
 let saves=0;await c.route('**/api/study-plan',async r=>{saves++;assert.equal(r.request().postDataJSON().status,'completed');await r.fulfill(saves===1?{status:503,json:{error:'Plan save interrupted. Retry.'}}:{json:{ok:true}});});
 await go('plan');assert.equal(await p.locator('.planDay[open]').count(),1);await shot('plan-today');
 const tomorrow=p.locator('.planDay').nth(1);await tomorrow.locator('summary').focus();await p.keyboard.press('Enter');assert.equal(await tomorrow.getAttribute('open'),'');await tomorrow.locator('summary').click();
 await p.getByRole('button',{name:/^Mark .* done$/}).first().click();await p.getByRole('alert').filter({hasText:'Plan save interrupted'}).waitFor();assert.equal(await p.getByRole('status').filter({hasText:'Plan marked done'}).count(),0);
 await p.getByRole('button',{name:/^Mark .* done$/}).first().click();await p.getByRole('status').filter({hasText:'Your learning evidence is unchanged'}).waitFor();
 await p.getByRole('button',{name:/^Start /}).first().click();assert.match(p.url(),/mode=learn/);
 await go('plan','&empty=1');await p.getByRole('button',{name:'Add materials',exact:false}).click();assert.match(p.url(),/mode=materials/);
 await go('mastery','&empty=1');assert.match(await p.locator('.progressRing').getAttribute('aria-label'),/No topics practiced/);await shot('progress-empty');
 assert.deepEqual(errors,[]);await c.close();
}}finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(`V4: ${report.cases.length} rendered states; evidence labels, empty states, save/retry and action routing passed at four widths.`);
