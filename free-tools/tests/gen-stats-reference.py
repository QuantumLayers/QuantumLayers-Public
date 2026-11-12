# Regenerates fixtures/stats-reference.json from SciPy. Requires numpy + scipy.
import json, numpy as np
from scipy import stats
rng=np.random.default_rng(7)
out={}
x=rng.normal(size=60); y=0.4*x+rng.normal(size=60); y2=np.round(y,0)
out['x']=x.tolist(); out['y']=y.tolist(); out['y2']=y2.tolist()
out['pearson']=list(stats.pearsonr(x,y)); out['spearman']=list(stats.spearmanr(x,y2))
out['normInv']=[stats.norm.ppf(p) for p in [1e-10,0.001,0.025,0.5,0.8,0.975,0.999999]]
out['normSf']=[stats.norm.sf(z) for z in [0,1.96,5,9,12]]
out['tInv']=stats.t.ppf(0.975,7.3)
out['tp']=[2*stats.t.sf(abs(t),df) for t,df in [(2.1,5),(0.3,40),(8,100),(3,2.5)]]
out['chi2']=[stats.chi2.sf(x,k) for x,k in [(3.84,1),(10,3),(50,1)]]
a=rng.normal(10,2,35); b=rng.normal(11,3,28); b[:5]=np.round(b[:5])
out['a']=a.tolist(); out['b']=b.tolist()
w=stats.ttest_ind(b,a,equal_var=False); out['welch']=[w.statistic,w.pvalue]
mw=stats.mannwhitneyu(a,b,alternative='two-sided',method='asymptotic'); out['mw']=[mw.statistic,mw.pvalue]
# two prop: chi2 no yates == pooled z
t=np.array([[10000-500,500],[10000-560,560]]); c=stats.chi2_contingency(t,correction=False); out['twoprop']=c.pvalue
out['gof']=stats.chisquare([5050,4950],[5000,5000]).pvalue
json.dump(out,open(__import__('os').path.join(__import__('os').path.dirname(__file__),'fixtures','stats-reference.json'),'w'))
