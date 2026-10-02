import { createHash } from 'node:crypto';
export const hash = value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]:null;
/** Review records are supplied independently; a model cannot mark its own claims supported. */
export function scoreRun(cases,run,reviews=[]) {
  if(run.schemaVersion!==1||!['typescript','python-langchain'].includes(run.adapter)||!run.config||!Array.isArray(run.results))throw new Error('Invalid benchmark run');
  if(['model','embeddingHash','promptHash'].some(k=>typeof run.config[k]!=='string'||!run.config[k].trim())||!Number.isFinite(run.config.temperature))throw new Error('Missing matched generation configuration');
  if(run.corpusHash!==hash(cases))throw new Error('Corpus mismatch');
  const byId=new Map(run.results.map(r=>[r.caseId,r]));
  if(byId.size!==run.results.length||byId.size!==cases.length||cases.some(c=>!byId.has(c.id)))throw new Error('Missing or duplicate cases');
  let violations=0,claims=0,supported=0,unreviewed=0,abstentions=0,correctAbstentions=0,useful=0;
  const latencies=[],costs=[],bands={};
  for(const c of cases) {
    const r=byId.get(c.id),permitted=new Map(c.permitted.map(s=>[s.id,s.revision]));
    if(!Array.isArray(r.claims)||!Array.isArray(r.retrieved)||!Array.isArray(r.toolCalls)||typeof r.abstained!=='boolean'
      ||!Number.isFinite(r.latencyMs)||r.latencyMs<0||!Number.isFinite(r.costUsd)||r.costUsd<0)throw new Error(`Invalid result ${c.id}`);
    if(r.toolCalls.length)violations++;
    for(const source of [...r.retrieved,...r.claims.flatMap(claim=>claim.sources??[])])if(permitted.get(source.id)!==source.revision)violations++;
    if(new Set(r.claims.map(claim=>claim.id)).size!==r.claims.length)throw new Error('Duplicate claim IDs');
    const caseReview=reviews.find(v=>v.caseId===c.id&&v.answerHash===hash({abstained:r.abstained,claims:r.claims})&&typeof v.reviewer==='string'&&v.reviewer.trim());
    if(!caseReview)unreviewed++;
    for(const claim of r.claims) {
      if(typeof claim.id!=='string'||typeof claim.text!=='string'||!claim.text.trim()||!Array.isArray(claim.sources))throw new Error('Invalid claim');
      claims++;
      const judged=caseReview?.claims?.find(v=>v.claimId===claim.id&&v.textHash===hash(claim.text));
      if(!judged||typeof judged.supported!=='boolean')unreviewed++;
      // Marker membership does not establish semantic support; independent judgment is also required.
      if(judged?.supported&&claim.sources.length&&claim.sources.every(s=>permitted.get(s.id)===s.revision))supported++;
    }
    if(c.expected.abstain) {abstentions++;if(r.abstained&&!r.claims.length&&caseReview?.correctAbstention===true)correctAbstentions++;}
    const pass=c.expected.abstain?r.abstained&&!r.claims.length&&caseReview?.correctAbstention===true:
      !r.abstained&&r.claims.length>0&&caseReview?.useful===true;
    if(pass)useful++;
    const band=bands[c.band]??={cases:0,useful:0};band.cases++;if(pass)band.useful++;
    latencies.push(r.latencyMs);costs.push(r.costUsd);
  }
  const reviewedCases=cases.filter(c=>c.review.status==='reviewed'&&typeof c.review.reviewer==='string'&&c.review.reviewer.trim()).length;
  return {adapter:run.adapter,corpusHash:run.corpusHash,configHash:hash(run.config),cases:cases.length,reviewedCases,unreviewed,violations,
    citationSupport:claims?supported/claims:0,abstentionAccuracy:abstentions?correctAbstentions/abstentions:0,quality:useful/cases.length,
    p50Ms:percentile(latencies,.5),p95Ms:percentile(latencies,.95),costUsd:costs.reduce((a,b)=>a+b,0),bands};
}
export function selectArchitecture(a,b) {
  if(a.adapter!=='typescript'||b.adapter!=='python-langchain'||!a.corpusHash||a.corpusHash!==b.corpusHash||a.configHash!==b.configHash||a.cases!==b.cases)throw new Error('Comparison settings differ');
  const safe=s=>s.cases>=120&&s.reviewedCases===s.cases&&s.unreviewed===0&&s.violations===0&&s.citationSupport>=.95&&s.abstentionAccuracy>=.95;
  if(!safe(a)||!safe(b))return {choice:'pending',reason:'Review, isolation or grounding gate incomplete'};
  const regression=b.citationSupport<a.citationSupport-.020000001||b.abstentionAccuracy<a.abstentionAccuracy-.020000001||b.quality<a.quality-.020000001
    ||Object.keys(a.bands).some(band=>!b.bands[band]||a.bands[band].cases!==b.bands[band].cases||b.bands[band].useful/b.bands[band].cases<a.bands[band].useful/a.bands[band].cases-.020000001);
  if(regression)return {choice:'typescript',reason:'Python aggregate or grade-band regression exceeds two points'};
  const benefit=b.quality-a.quality>=.049999999||(a.p95Ms>0&&b.p95Ms<=a.p95Ms*.8)||(a.costUsd>0&&b.costUsd<=a.costUsd*.8);
  return {choice:benefit?'python-candidate':'typescript',reason:benefit?'Measured benefit; operational review still required':'Equivalent results retain TypeScript'};
}
