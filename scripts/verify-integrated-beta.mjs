import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
import { mkdir,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const base=process.env.STUDIGO_BETA_URL??'http://localhost:3000';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('This harness uses synthetic local sessions only.');
const output=fileURLToPath(new URL('../.local-beta/verification/',import.meta.url));await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
const failures=[];const checks=[];
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',error=>failures.push(error.message));
  await page.goto(base+'/api/local-beta/open',{waitUntil:'networkidle',timeout:60000});
  await page.locator('a[href="/app/rooms/math"]').last().click();
  await page.getByRole('textbox',{name:'Message Studigo'}).waitFor();
  const send=async text=>{const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/chat'&&r.request().method()==='POST');await page.getByRole('textbox',{name:'Message Studigo'}).fill(text);await page.getByRole('button',{name:'Send to Studigo'}).click();const r=await pending;assert.equal(r.status(),200,await r.text());await page.getByRole('textbox',{name:'Message Studigo'}).waitFor({state:'visible'});};
  await send('Coach me through: Equivalent fractions');await page.getByText('Which equals 1/2?',{exact:false}).waitFor();
  await send('Give me a hint');await send('A');checks.push('existing Coach UI issues, helps, grades, and refreshes authoritative state');
  await page.goto(base+'/app/rooms/math?mode=quiz');
  const built=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/quiz'&&r.request().method()==='POST');await page.getByRole('button',{name:'Start quiz'}).click();
  const quiz=await (await built).json();assert.equal(quiz.questions.length,5);
  for(let index=0;index<5;index++) {
    const q=quiz.questions[index];
    const choice=q.topic_id==='fractions'?0:1;
    await page.getByRole('radio').nth(choice).click();
    const graded=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/quiz/attempt');await page.getByRole('button',{name:'Confident',exact:false}).click();
    assert.equal((await (await graded).json()).isCorrect,true);
    await page.getByRole('button',{name:index===4?'See results':'Next question',exact:false}).click();
  }
  checks.push('existing five-question Quiz UI completes against persisted issued encounters');
  await page.goto(base+'/app/rooms/math?mode=mastery');await page.screenshot({path:output+'/desktop-main-ui.png',fullPage:true});
  const stateBefore=await (await context.request.get(base+'/api/local-beta')).json();assert.equal(stateBefore.topics[0].stage,'independent');
  for(const mode of ['weak','plan','cram','materials']){await page.goto(base+'/app/rooms/math?mode='+mode,{waitUntil:'networkidle'});const alerts=(await page.getByRole('alert').allTextContents()).filter(text=>text.trim());assert.equal(alerts.length,0,mode+': '+alerts.join(' '));}
  checks.push('unchanged Progress, Weak Areas, Plan, Cram and Materials render the shared persisted evidence');
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose files',exact:false}).click();
  await (await chooser).setFiles({name:'local-reading.txt',mimeType:'text/plain',buffer:Buffer.from('Clouds form when water vapor cools and condenses into droplets.')});
  await page.getByText('local-reading.txt',{exact:true}).first().waitFor();
  await page.reload();await page.getByText('local-reading.txt',{exact:true}).first().waitFor();checks.push('existing upload workflow persists bounded text material and survives reload');
  const pdf=await context.request.get(base+'/api/study-guide/download?roomId=math');assert.equal(pdf.status(),200);assert.equal((await pdf.body()).subarray(0,4).toString(),'%PDF');
  const source=await context.request.get(base+'/api/documents/download?documentId=math-guide&inline=1');assert.equal(source.status(),200);assert.ok((await source.text()).includes('Equivalent fractions'));
  checks.push('study-guide PDF and original-source citation links open through existing endpoints');
  await page.goto(base+'/app/rooms/math?mode=cards');const generated=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/flashcards'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Add 10 cards',exact:false}).click();assert.equal((await (await generated).json()).cards.length,2);
  await page.getByRole('button',{name:'Show answer',exact:false}).click();const reviewed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/flashcards/review');
  await page.getByRole('button',{name:'Got it',exact:false}).click();assert.equal((await reviewed).status(),200);
  const stateAfter=await (await context.request.get(base+'/api/local-beta')).json();assert.equal(stateAfter.topics[0].independentSuccesses,stateBefore.topics[0].independentSuccesses);
  checks.push('existing Flashcards UI records self-report without adding independent successes');
  const api=async(path,body)=>{const r=await context.request.post(base+path,{data:body});assert.equal(r.status(),200,await r.text());return r.json();};
  const {testId}=await api('/api/practice-tests',{roomId:'math',count:2});const opened=await (await context.request.get(base+'/api/practice-tests?testId='+testId)).json();
  const answers=Object.fromEntries(opened.questions.map(q=>[q.id,{selectedChoice:null,response:q.topic_id==='fractions'?'3':'12'}]));
  // Autosave uses PATCH in the unchanged client.
  const saved=await context.request.patch(base+'/api/practice-tests',{data:{testId,answers}});assert.equal(saved.status(),200);
  const result=await api('/api/practice-tests/submit',{testId,answers});assert.equal(result.result.score,100);
  await page.goto(base+'/app/rooms/math?mode=test');await page.getByRole('button',{name:/Review completed test/}).click();await page.getByText('Every answer, with its evidence.',{exact:true}).waitFor();checks.push('practice-test drafts and whole-test results round-trip into the existing UI');
  const isolated=await browser.newContext();await isolated.request.get(base+'/api/local-beta/open');const other=await (await isolated.request.get(base+'/api/local-beta')).json();assert.equal(other.eventCount,0);await isolated.close();checks.push('two browser sessions remain isolated');
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/app/rooms/math?mode=mastery');await page.screenshot({path:output+'/phone-main-ui.png',fullPage:true});
  assert.equal(failures.length,0,failures.join('\n'));
  await writeFile(output+'/results.json',JSON.stringify({checks,pageErrors:failures,synthetic:true,liveProvider:false},null,2));
  console.log(JSON.stringify({checks,output},null,2));
} finally {await browser.close();}

