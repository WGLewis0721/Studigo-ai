import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { buildCases } from './cases.mjs';
import { scoreRun,selectArchitecture,hash } from './score.mjs';
const [command,...paths]=process.argv.slice(2);
const json=async p=>JSON.parse(await readFile(p,'utf8'));
if(command==='fixtures') {
  const cases=buildCases();await mkdir(new URL('./results/',import.meta.url),{recursive:true});
  await writeFile(new URL('./results/cases.json',import.meta.url),JSON.stringify(cases,null,2));
  console.log(JSON.stringify({cases:cases.length,corpusHash:hash(cases),reviewed:0,liveMeasurements:false}));
} else if(command==='compare'&&paths.length===5) {
  const [cases,a,b,reviewsA,reviewsB]=await Promise.all(paths.map(json));
  const scores=[scoreRun(cases,a,reviewsA),scoreRun(cases,b,reviewsB)];console.log(JSON.stringify({scores,decision:selectArchitecture(...scores)},null,2));
} else throw new Error('Use fixtures, or compare CASES TS_RUN PYTHON_RUN TS_REVIEWS PYTHON_REVIEWS');
