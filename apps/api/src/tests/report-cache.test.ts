import { expect,test } from 'bun:test';
import { ReportCache } from '../services/report-cache';

test('coalesce simultaneous requests, clone reports and expire completed values',async()=>{
 let now=0,calls=0,finish!:(value:{amount:number})=>void;
 const cache=new ReportCache(60,2,()=>now),load=()=>{calls++;return new Promise<{amount:number}>(resolve=>finish=resolve)};
 const first=cache.get('same',load),second=cache.get('same',load);
 await Promise.resolve();expect(calls).toBe(1);finish({amount:10});
 const [a,b]=await Promise.all([first,second]);a.amount=999;expect(b.amount).toBe(10);
 expect(await cache.get('same',async()=>({amount:30}))).toEqual({amount:10});
 now=61;expect(await cache.get('same',async()=>({amount:30}))).toEqual({amount:30});
});
test('failed reads retry; configuration keys and connector caches stay separate',async()=>{
 const cache=new ReportCache(),otherCompany=new ReportCache();
 await expect(cache.get('report',async()=>{throw new Error('Odoo unavailable')})).rejects.toThrow();
 expect(await cache.get('report',async()=>10)).toBe(10);
 expect(await cache.get('changed-config',async()=>20)).toBe(20);
 expect(await otherCompany.get('report',async()=>30)).toBe(30);
});
test('evicts the oldest completed value at the memory bound',async()=>{
 const cache=new ReportCache(60,2,()=>0);
 await cache.get('a',async()=>1);await cache.get('b',async()=>2);await cache.get('c',async()=>3);
 expect(await cache.get('a',async()=>4)).toBe(4);
});
