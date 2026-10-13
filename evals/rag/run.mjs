import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { buildCases } from './cases.mjs';
import { scoreRun,selectArchitecture,hash } from './score.mjs';
import { buildReviewSlice,parseReviewJsonl,toReviewJsonl,validateReviewRows,summarizeReview } from './review.mjs';
const [command,...paths]=process.argv.slice(2);
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const SLICE=new URL('./review/slice-50.jsonl',import.meta.url);
const readSlice=async p=>parseReviewJsonl(await readFile(p??SLICE,'utf8'));
if(command==='fixtures') {
  const cases=buildCases();await mkdir(new URL('./results/',import.meta.url),{recursive:true});
  await writeFile(new URL('./results/cases.json',import.meta.url),JSON.stringify(cases,null,2));
  console.log(JSON.stringify({cases:cases.length,corpusHash:hash(cases),reviewed:0,liveMeasurements:false}));
} else if(command==='compare'&&paths.length===5) {
  const [cases,a,b,reviewsA,reviewsB]=await Promise.all(paths.map(json));
  const scores=[scoreRun(cases,a,reviewsA),scoreRun(cases,b,reviewsB)];console.log(JSON.stringify({scores,decision:selectArchitecture(...scores)},null,2));
} else if(command==='review-slice') {
  // Regenerating would discard a person's work, so it is refused once any row has been touched.
  const existing=await readFile(SLICE,'utf8').then(parseReviewJsonl,error=>{if(error.code==='ENOENT')return [];throw error;});
  if(existing.some(row=>row.review?.status!=='pending'||row.review?.reviewer!==null))throw new Error('review/slice-50.jsonl already holds review work; it was not regenerated');
  const rows=buildReviewSlice(buildCases());await mkdir(new URL('./review/',import.meta.url),{recursive:true});
  await writeFile(SLICE,toReviewJsonl(rows));console.log(JSON.stringify(summarizeReview(rows)));
} else if(command==='review-check') {
  const rows=await readSlice(paths[0]),problems=validateReviewRows(rows,buildCases());
  console.log(JSON.stringify({...summarizeReview(rows),problems},null,2));if(problems.length)process.exitCode=1;
} else throw new Error('Use fixtures, review-slice, review-check [SLICE], or compare CASES TS_RUN PYTHON_RUN TS_REVIEWS PYTHON_REVIEWS');
