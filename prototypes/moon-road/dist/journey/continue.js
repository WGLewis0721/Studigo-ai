// Connection only: original POC VII code and comparison route stay unchanged.
const next=document.createElement('button');next.className='primary';next.textContent='NEXT · GRAVEYARD 1·2·3 ▸';next.onclick=()=>location.assign('../poc-viii/');
const boss=document.querySelector('#enter-boss');boss.before(next);boss.classList.remove('primary');boss.style.cssText='display:block;margin:14px auto;font-size:12px;padding:9px 15px';boss.textContent='CORE CLASH · BOSS CONTROL';
document.querySelector('#finish h2').innerHTML='THE GRAVEYARD<br>AWAITS';document.querySelector('.title p').textContent='The trail → Graveyard 1·2·3 → Core Clash';

new MutationObserver(()=>{if(!document.querySelector('#finish').hidden)document.querySelector('#finish-copy').textContent='Continue into Graveyard 1·2·3, or revisit the original boss.'}).observe(document.querySelector('#finish'),{attributes:true,attributeFilter:['hidden']});
