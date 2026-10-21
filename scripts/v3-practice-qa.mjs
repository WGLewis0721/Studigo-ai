import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const origin=process.env.PHASE3_VISUAL_BASE_URL??'http://127.0.0.1:3000';
const output='artifacts/phase3-visual/v3';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--disable-gpu']}: {})});
const report={provenance:'Synthetic API responses; real components. Not hosted persistence, iOS hardware or VoiceOver.',cases:[]};
try {
 for(const [width,height] of [[320,700],[390,844],[820,1180],[1440,900]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const shot=async name=>{
   await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);document.querySelector(".modeSurface")?.scrollTo(0,0);});
   assert.equal(await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)),0,`${name}: horizontal overflow at ${width}`);
   const overlaps=await page.evaluate(async()=>{
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const host=document.querySelector('.cmp[data-state="window"]:not([hidden])');
    if(!(host instanceof HTMLElement)||!host.getClientRects().length)return [];
    const a=host.getBoundingClientRect();
    return Array.from(document.querySelectorAll('.answerChoices:not(:disabled) .choiceItem')).filter(el=>{const b=el.getBoundingClientRect();return b.top<innerHeight&&b.bottom>0&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}).map(el=>el.textContent);
   });
   assert.deepEqual(overlaps,[],`${name}: companion must clear entire native answer labels`);
   const file=`${output}/${width}-${name}.png`;await page.screenshot({path:file,fullPage:true,animations:'disabled'});report.cases.push({width,name,screenshot:file});
  };
  const go=mode=>page.goto(`${origin}/dev/study?shell=1&mode=${mode}&ui=phase3`,{waitUntil:'networkidle'});
  // Quiz: exactly five returned questions, native arrow-key selection, explicit
  // submission, failed save stays on the same question, then all five results.
  const questions=Array.from({length:5},(_,i)=>({id:`q${i}`,kind:'multiple_choice',prompt:`Which description matches inherited traits? Question ${i+1}.`,choices:['A characteristic passed from parents to offspring.','A behavior learned through practice.'],difficulty:'easy',topic_id:'inherited-environment'}));
  let grades=0;let failGrade=true;
  await context.route('**/api/quiz',async route=>{assert.equal(route.request().postDataJSON().count,5);assert.deepEqual(route.request().postDataJSON().kinds,['multiple_choice','true_false']);assert.deepEqual(route.request().postDataJSON().topicIds,['instinct-learned','inherited-environment']);await route.fulfill({json:{questions}});});
  await context.route('**/api/quiz/attempt',async route=>{grades++;if(failGrade){failGrade=false;await route.fulfill({status:503,json:{error:'Temporary interruption. Retry your answer.'}});return;}assert.equal(route.request().postDataJSON().selectedChoice,0);await route.fulfill({json:{isCorrect:true,score:100,confidence:3,correctChoice:0,feedback:'Correct. Traits can pass from parents to offspring.',explanation:'',expectedAnswer:null,citations:[]}});});
  await go('quiz');await shot('quiz-setup');
  const quizTopics=page.locator('.topicReadout:visible input[type="checkbox"]');
  assert.equal(await quizTopics.count(),8);await quizTopics.first().uncheck();
  assert.equal(await page.locator('.topicReadout:visible .trCount').innerText(),'7 of 8 topics selected');
  await page.getByRole('button',{name:'Select all'}).click();assert.equal(await quizTopics.first().isChecked(),true);
  for(let i=7;i>=2;i--)await quizTopics.nth(i).uncheck();
  assert.equal(await page.locator('.topicReadout:visible .trCount').innerText(),'2 of 8 topics selected');
  await page.getByRole('combobox',{name:'Number of quiz questions'}).selectOption('10');
  await page.getByRole('combobox',{name:'Number of quiz questions'}).selectOption('5');
  await page.getByRole('checkbox',{name:'Fill in the Blank'}).uncheck();
  await page.getByRole('button',{name:'Start quiz'}).click();
  await page.getByRole('button',{name:'Read to me'}).waitFor();
  const radio=page.getByRole('radio').first();await page.locator(".choiceItem").first().click();await radio.focus();await page.keyboard.press('ArrowDown');await page.getByRole('radio').nth(1).waitFor();assert.equal(await page.getByRole('radio').nth(1).isChecked(),true);await page.keyboard.press('ArrowUp');assert.equal(await radio.isChecked(),true);
  await page.getByRole('button',{name:'Confident',exact:false}).click();assert.equal(grades,0,'choice and confidence must not grade in Phase 3');
  await shot('quiz-answer');
  await page.getByRole('button',{name:'Submit answer'}).click();await page.getByRole('alert').filter({hasText:'Temporary interruption'}).waitFor();assert.equal(await radio.isChecked(),true,'failed save preserves answer');
  await page.getByRole('button',{name:'Submit answer'}).click();await page.locator('.quizFeedback').waitFor();await shot('quiz-feedback');
  for(let i=1;i<5;i++){await page.getByRole('button',{name:'Next question',exact:false}).click();await page.locator('.choiceItem').first().click();await page.getByRole('button',{name:'Confident',exact:false}).click();await page.getByRole('button',{name:'Submit answer'}).click();await page.locator('.quizFeedback').waitFor();}
  await page.getByRole('button',{name:'See results'}).click();assert.match(await page.locator('.quizScoreCard').innerText(),/5 of 5 right/);assert.equal(grades,6);await shot('quiz-results');
  // Cards: reveal/rate does not advance until the review is saved; retry has
  // the same durable request id. This is not a database persistence test.
  const card={id:'card-1',front:'What is an inherited trait?',back:'A characteristic passed from parents to offspring.',citations:[],repetitions:0,topic_id:'inherited-environment'};
  const reviews=[];
  await context.route('**/api/flashcards?*',r=>r.fulfill({json:{cards:[card]}}));
  await context.route('**/api/flashcards/review',async r=>{reviews.push(r.request().postDataJSON());await r.fulfill(reviews.length===1?{status:503,json:{error:'Offline'}}:{json:{ok:true}});});
  await go('cards');await page.locator('.flashcard').waitFor();await shot('cards-front');
  await page.getByRole('button',{name:/Show answer/}).click();await shot('cards-answer');
  await page.getByRole('button',{name:/Got it/}).click();await page.getByRole('alert').filter({hasText:"review didn't save"}).waitFor();assert.equal(await page.locator('.flashcardFlipped').count(),1);
  await page.getByRole('button',{name:/Retry review/}).click();await page.locator('.quizScoreCard').waitFor();assert.equal(reviews[0].requestId,reviews[1].requestId);
  const cardTopics=page.locator('.topicReadout:visible input[type="checkbox"]');
  for(let i=7;i>=2;i--)await cardTopics.nth(i).uncheck();
  await context.route('**/api/flashcards',async r=>{const body=r.request().postDataJSON();assert.deepEqual(body.topicIds,['instinct-learned','inherited-environment']);assert.equal(body.count,10);await r.fulfill({json:{cards:[card]}});});
  await page.getByRole('button',{name:'Add 10 cards'}).click();await page.locator('.flashcard').waitFor();
  await page.getByRole('button',{name:'Choose topics or add cards'}).click();
  assert.equal(await page.locator('.topicReadout:visible .trCount').innerText(),'2 of 8 topics selected');
  // Full test: requested ten questions, draft save, explicit final confirmation,
  // result review and reopening a server-returned submitted attempt.
  const testQuestions=Array.from({length:10},(_,i)=>({
   ...questions[0],id:`test-q${i}`,
   kind:i===1?'short_answer':i===2?'true_false':i===3?'fill_blank':'multiple_choice',
   choices:i===2?['True','False']:i===3?[]:questions[0].choices,
   prompt:i===3?'A ____ can take part in an election.':i===0?'Which **description** matches inherited traits?':questions[0].prompt
  }));
  const result={score:75,questionCount:10,topics:[{topic_id:'inherited-environment',title:'Inherited traits and environment',questions:10,score:75,misses:1}],reviews:[
    {...testQuestions[0],score:100,is_correct:true,feedback:'**Correct.** The source explains this idea.',explanation:'',expected_answer:null,correct_choice:0,citations:[],response:null,selected_choice:0},
    {...testQuestions[1],score:100,is_correct:true,feedback:'Good explanation.',explanation:'',expected_answer:'Traits come from parents.',correct_choice:null,citations:[],response:'Traits pass from parents to offspring.',selected_choice:null},
    {...testQuestions[2],score:0,is_correct:false,feedback:'**Review:** The claim was false.',explanation:'See the source.',expected_answer:null,correct_choice:1,citations:[],response:null,selected_choice:0},
    {...testQuestions[3],score:100,is_correct:true,feedback:'Correct spelling.',explanation:'',expected_answer:'voter',correct_choice:null,citations:[],response:'voter',selected_choice:null}
  ]};
  let submitted=false;let saves=0;
  const test=()=>({id:'test-1',status:submitted?'submitted':'draft',created_at:'2026-10-17T12:00:00Z',draft_answers:{},result:submitted?result:null,topic_snapshot:[{id:'inherited-environment',title:'Inherited traits',questions:10}]});
  await context.route(/\/api\/practice-tests(?:\?|\/|$)/,async r=>{
   if(r.request().url().endsWith('/submit')){assert.equal(Object.keys(r.request().postDataJSON().answers).length,4);submitted=true;await r.fulfill({json:{result}});}
   else if(r.request().method()==='POST'){assert.equal(r.request().postDataJSON().count,10);assert.deepEqual(r.request().postDataJSON().kinds,['multiple_choice','fill_blank','true_false']);assert.deepEqual(r.request().postDataJSON().topicIds,['instinct-learned','inherited-environment']);await r.fulfill({json:{testId:'test-1'}});}
   else if(r.request().method()==='PATCH'){saves++;await r.fulfill({json:{ok:true}});}
   else await r.fulfill({json:r.request().url().includes('testId=')?{test:test(),questions:testQuestions}:{tests:[test()]}});
  });
  await go('test');const testTopics=page.locator('.topicReadout:visible input[type="checkbox"]');
  for(let i=7;i>=2;i--)await testTopics.nth(i).uncheck();
  await page.getByRole('button',{name:'Build practice test'}).click();await page.locator('.choiceItem').first().click();await page.getByRole('button',{name:'Next question',exact:false}).click();await page.getByRole('textbox',{name:'Your answer',exact:true}).fill('Traits pass from parents to offspring.');
  await page.getByRole('button',{name:'Next question',exact:false}).click();
  await page.locator('.testQuestion .choiceItem').first().click();assert.equal(await page.getByRole('radio',{name:'True'}).isChecked(),true);
  await page.getByRole('button',{name:'Next question',exact:false}).click();
  await page.getByRole('textbox',{name:'Fill in the blank'}).fill('voter');
  await page.getByRole('status').filter({hasText:'Draft saved'}).waitFor();assert.ok(saves>=1);
  await shot('test-draft');await page.getByRole('button',{name:'Review and submit entire test'}).click();assert.equal(submitted,false);await page.getByRole('button',{name:'Submit all answers'}).click();await page.locator('.testResults').waitFor();
  const reviewCards=page.locator('details.testReview');
  assert.equal(await reviewCards.count(),4,'all four response types are reviewable');
  assert.equal(await page.locator('details.testReview[open]').count(),1,'missed question opens by default');
  const reviewStyles=await page.evaluate(()=>{
    const cards=Array.from(document.querySelectorAll('details.testReview'));
    const title=cards[0].querySelector('.testReviewSummaryTitle strong');
    const preview=cards[0].querySelector('.testReviewPromptPreview');
    const result=cards[0].querySelector('.testReviewSummaryStatus');
    const wrong=cards[2].querySelector('.testReviewSummaryStatus');
    const page=document.querySelector('#studigo-test-print');
    return {
      correctClass:cards[0].classList.contains('testReviewCorrect'),
      wrongClass:cards[2].classList.contains('testReviewIncorrect'),
      green:getComputedStyle(result).backgroundColor,
      red:getComputedStyle(wrong).backgroundColor,
      cardGreen:getComputedStyle(cards[0]).borderLeftColor,
      cardRed:getComputedStyle(cards[2]).borderLeftColor,
      fontSize:parseFloat(getComputedStyle(title).fontSize),
      fontWeight:parseInt(getComputedStyle(title).fontWeight,10),
      previewSize:parseFloat(getComputedStyle(preview).fontSize),
      previewText:preview.textContent,
      previewDisplay:getComputedStyle(preview).display,
      backdrop:getComputedStyle(page).backgroundColor
    };
  });
  assert.equal(reviewStyles.correctClass,true,'right cards use correct modifier');
  assert.equal(reviewStyles.wrongClass,true,'missed cards use incorrect modifier');
  assert.notEqual(reviewStyles.green,reviewStyles.red,'correct and missed badges use distinct colors');
  assert.notEqual(reviewStyles.cardGreen,reviewStyles.cardRed,'card borders show result color');
  assert.ok(reviewStyles.fontSize>=19,'question number is easily readable');
  assert.ok(reviewStyles.fontWeight>=700,'question number uses strong weight');
  assert.ok(reviewStyles.previewSize>=16,'collapsed question prompt is legible');
  assert.match(reviewStyles.previewText,/Which description matches/,'collapsed card identifies the actual question');
  assert.notEqual(reviewStyles.previewDisplay,'none','collapsed prompt must be visible');
  assert.notEqual(reviewStyles.backdrop,'rgb(255, 255, 255)','review uses a soft local backdrop');
  await page.getByRole('button',{name:'Expand all'}).click();
  assert.equal(await reviewCards.first().locator('.testReviewPromptPreview').evaluate(el=>getComputedStyle(el).display),'none','expanded question does not duplicate prompt');
  assert.equal(await page.locator('details.testReview[open]').count(),4);
  assert.equal(await reviewCards.first().locator('.testReviewContent .testQuestionPrompt strong',{hasText:'description'}).count(),1,'expanded question Markdown is rendered');
  assert.equal(await reviewCards.first().locator('.testQuestionPrompt').innerText().then(text=>text.includes('**')),false,'no raw Markdown');
  assert.equal(await reviewCards.first().locator('.choiceItem').count(),2,'same answer choices as test');
  assert.equal(await reviewCards.first().locator('.choiceSelected').count(),0,'graded state replaces draft selection');
  assert.equal(await reviewCards.first().locator('.choiceCorrect').count(),1,'correct answer highlighted');
  assert.equal(await reviewCards.nth(1).locator('.shortAnswer').innerText().then(text=>text.includes('Traits pass')),true);
  assert.equal(await reviewCards.nth(2).locator('.choiceWrong').count(),1,'incorrect selection remains visible');
  assert.equal(await reviewCards.nth(3).locator('.blankInput').innerText(),'voter');
  await shot('test-results-expanded');
  await page.getByRole('button',{name:'Collapse all'}).click();
  assert.equal(await page.locator('details.testReview[open]').count(),0);
  await reviewCards.nth(1).locator('summary').click();
  assert.equal(await page.locator('details.testReview[open]').count(),1,'individual question opens');
  // The printable result is a standalone body-level document. Its content
  // must survive PDF pagination even if the interactive cards are collapsed
  // inside a scrolled, clipped Study Room.
  await page.evaluate(()=>{window.print=()=>{};});
  await page.getByRole('button',{name:'Print results'}).click();
  assert.equal(await page.locator('details.testReview[open]').count(),1,'printing preserves the interactive expansion state');
  assert.equal(await page.locator('#studigo-print-sheet .studigoPrintQuestion').count(),4,'print contains all reviewed questions');
  await page.emulateMedia({media:'print'});
  const printed=await page.evaluate(()=>({
    toolbar:getComputedStyle(document.querySelector('.testReviewToolbar')).display,
    sheet:getComputedStyle(document.querySelector('#studigo-print-sheet')).display,
    sheetVisible:getComputedStyle(document.querySelector('#studigo-print-sheet')).visibility,
    shell:getComputedStyle(document.querySelector('.appShell')).display,
    preview:getComputedStyle(document.querySelector('.testReviewPromptPreview')).display
  }));
  assert.equal(printed.toolbar,'none','print hides screen controls');
  assert.equal(printed.sheet,'block','print-only sheet is in normal document flow');
  assert.equal(printed.sheetVisible,'visible','print-only sheet is not hidden by sitewide print rules');
  assert.equal(printed.shell,'none','print hides the Study Room shell');
  assert.equal(printed.preview,'none','print does not duplicate collapsed previews');
  const pdf=await page.pdf({format:'A4',printBackground:true});
  await writeFile(`${output}/${width}-test-results.pdf`,pdf);
  const text=execFileSync('python3',['-c',
    "import fitz,sys; doc=fitz.open(stream=sys.stdin.buffer.read(),filetype='pdf'); print(' '.join(page.get_text() for page in doc))"
  ],{input:pdf,encoding:'utf8'}).replace(/\s+/g,' ');
  assert.ok(text.trim().length>250,`printed PDF must not be blank at ${width}px; got ${text.length} chars`);
  for(const expected of ['Practice test results','Question 1','Question 2','Question 3','Question 4','Which description matches inherited traits','Traits pass from parents','voter','Needs review']) {
    assert.ok(text.includes(expected),`printed PDF missing "${expected}" at ${width}px`);
  }
  await page.emulateMedia({media:'screen'});
  assert.equal(await page.locator('details.testReview[open]').count(),1,'print leaves the screen review state untouched');
  await shot('test-results');
  await go('test');await page.getByRole('button',{name:/Review completed test/}).click();await page.locator('.testResults').waitFor();assert.match(await page.locator('.testScore').innerText(),/10 questions/);
  // Cram: the timer never submits a response; pause remains available.
  await go('cram');await page.getByRole('button',{name:'15 min',exact:true}).click();await shot('cram-setup');await page.getByRole('button',{name:/Start 15-minute session/}).click();await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByRole('button',{name:'Resume',exact:true}).waitFor();await shot('cram-paused');
  // Coach topic sheet: keyboard containment, Escape and return to invoker.
  await go('coach');const topics=page.getByRole('button',{name:/^Topics/}).filter({visible:true});await topics.click();const dialog=page.getByRole('dialog',{name:'Choose one or more topics'});await dialog.waitFor();assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);await page.keyboard.press('Shift+Tab');assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true);await shot('coach-topics');await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);assert.equal(await topics.evaluate(e=>e===document.activeElement),true);
  assert.deepEqual(errors,[],`page errors at ${width}`);await context.close();
 }
} finally {await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(`V3: ${report.cases.length} rendered states; four widths; quiz, card, test, Cram and Coach interactions passed.`);
