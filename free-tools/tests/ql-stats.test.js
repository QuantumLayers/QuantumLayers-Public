// Run: node free-tools/tests/ql-stats.test.js — compares ql-stats.js with SciPy reference values
// (regenerate them with: python3 free-tools/tests/gen-stats-reference.py).
const S=require('../ql-stats.js');const R=require('./fixtures/stats-reference.json');
let bad=0;const ck=(n,a,b,tol=1e-6)=>{const rel=Math.abs(a-b)/Math.max(1e-300,Math.abs(b));const ok=Math.abs(a-b)<tol||rel<tol;if(!ok)bad++;console.log((ok?'ok  ':'FAIL')+' '+n+' js='+a+' ref='+b);};
let c=S.correlate(R.x,R.y,'pearson');ck('pearson r',c.r,R.pearson[0]);ck('pearson p',c.p,R.pearson[1]);
c=S.correlate(R.x,R.y2,'spearman');ck('spearman r',c.r,R.spearman[0]);ck('spearman p',c.p,R.spearman[1]);
[1e-10,0.001,0.025,0.5,0.8,0.975,0.999999].forEach((p,i)=>ck('normInv '+p,S.normInv(p),R.normInv[i],1e-9));
[0,1.96,5,9,12].forEach((z,i)=>ck('normSf '+z,S.normSf(z),R.normSf[i],1e-8));
ck('tInv',S.tInv(0.975,7.3),R.tInv,1e-8);
[[2.1,5],[0.3,40],[8,100],[3,2.5]].forEach(([t,d],i)=>ck('t p '+t+','+d,S.tTwoSidedP(t,d),R.tp[i]));
[[3.84,1],[10,3],[50,1]].forEach(([x,k],i)=>ck('chi2 '+x,S.chi2Sf(x,k),R.chi2[i]));
const da=S.describe(R.a),db=S.describe(R.b);const w=S.welch(da.mean,da.sd,da.n,db.mean,db.sd,db.n);ck('welch t',w.t,R.welch[0]);ck('welch p',w.p,R.welch[1]);
const mw=S.mannWhitney(R.a,R.b);ck('mw U',mw.u,R.mw[0]);ck('mw p',mw.p,R.mw[1]);
ck('twoprop p',S.twoProportion(10000,500,10000,560).p,R.twoprop);
ck('gof p',S.chiSquareGof([5050,4950],[1,1]).p,R.gof);
// sample size: known ref (Evan Miller-ish / G*Power): p1=.05 p2=.06 alpha .05 power .8 -> 8158
console.log('n per group 5%->6%:',S.sampleSizeTwoProportion(0.05,0.06,0.05,0.8));
console.log('holm',S.holm([0.01,0.04,0.03,NaN,0.005]));
console.log('inferType',[S.inferType(['1','2','3'],'x_val'),S.inferType(['1','2','3'],'customer_id'),S.inferType(['2020','2021'],'Year'),S.inferType(['2024-01','2024-02'],'p'),S.inferType([1.5,2,3],'v'),S.inferType(['02134','06037'],'z'),S.inferType(['2024-01-01 10:00'],'t')].join(' '));
console.log(bad?bad+' FAILURES':'ALL OK'); process.exit(bad?1:0);
