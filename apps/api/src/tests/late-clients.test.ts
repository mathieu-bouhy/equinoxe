import {expect,test} from 'bun:test';import type {AgedInvoice} from '@equinoxe/shared';import {lateClientFollowup} from '../services/late-clients';
test('follow-up keeps >90 and >60 days separate, nets credits, excludes non-matched payments and creditor-only clients',()=>{
 const row=(id:number,partnerId:number,daysLate:number,residual:number,kind:AgedInvoice['kind']='invoice')=>({id,partnerId,partner:`Client ${partnerId}`,daysLate,residual,kind,dueDate:'2026-01-01'}) as AgedInvoice;
 const result=lateClientFollowup([row(1,1,91,100),row(2,1,91,-20,'credit'),row(3,1,61,30),row(4,1,100,-1000,'other'),row(5,2,90,40),row(6,3,120,-10,'credit'),row(7,4,60,999)]);
 expect(result).toHaveLength(2);expect(result[0]).toMatchObject({partnerId:1,over90:80,days61to90:30,over60:110,invoiceCount:2});expect(result[1]).toMatchObject({partnerId:2,over90:0,over60:40});
});
