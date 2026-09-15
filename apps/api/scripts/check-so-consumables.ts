import postgres from 'postgres';
import { deepStrictEqual, ok } from 'node:assert';
import { config } from '../src/config';
import { SoConsumablesRepository } from '../src/repositories/so-consumables';
import { soConsumablesYears } from '@equinoxe/shared';

// Explicit real-data verification. Retirement additionally requires --retire-previous.
if(!config.databaseUrl)throw new Error('PostgreSQL requis.');
const companyId='531a4887-3cdd-43a6-9ad7-1e98fd848b71';
const url=new URL(config.databaseUrl),sql=postgres(config.databaseUrl,{max:1,ssl:url.searchParams.get('sslmode')==='require'||url.hostname.endsWith('.render.com')?'require':undefined});
const repo=new SoConsumablesRepository(undefined,sql);
try{
  const snapshot=await repo.read(companyId);ok(snapshot,'Calcul absent : aucune opération possible.');
  const key=`so-consumables:${companyId}`;
  const totals=await sql`SELECT (o->>'year')::int AS year,o->>'department' AS department,
    sum((o->>'amount')::numeric)::text AS amount,count(*)::int AS orders
    FROM equinoxe_documents d CROSS JOIN LATERAL jsonb_array_elements(d.data->'orders') o
    WHERE d.key=${key} AND o->>'department' IS NOT NULL GROUP BY 1,2 ORDER BY 1,2`;
  for(const y of soConsumablesYears(snapshot)){
    for(const [department,amount] of [['fireInstallation',y.installation],['fireMaintenance',y.maintenance]] as const){
      const row=totals.find(r=>r.year===y.year&&r.department===department);
      if(amount!==null)ok(Math.abs(Number(row?.amount??0)-amount)<.001);
    }
    if(y.installationShare!==null&&y.maintenanceShare!==null)ok(Math.abs(y.installationShare+y.maintenanceShare-1)<1e-12);
  }
  const configuration=await sql`SELECT key,data FROM equinoxe_documents WHERE key IN ('account-analytic-allocations.json','analytic-allocation-codes.json') ORDER BY key`;
  ok(configuration.length===2,'Configuration absente.');
  ok(!JSON.stringify(configuration).includes('system:purchase-so:'),'Une affectation utilise encore l’ancienne clé : retrait refusé.');
  let retired=false;
  if(process.argv.includes('--retire-previous')){
    retired=await repo.archivePreviousAnalysis(companyId);
    const previous=await sql`SELECT key FROM equinoxe_documents WHERE key=${`purchase-so:${companyId}`}`;
    ok(previous.length===0);
    const archives=await sql`SELECT key FROM equinoxe_documents WHERE key LIKE ${`purchase-so:${companyId}:retired:%`}`;
    ok(archives.length>0);
    deepStrictEqual(await repo.read(companyId),snapshot);
    deepStrictEqual(await sql`SELECT key,data FROM equinoxe_documents WHERE key IN ('account-analytic-allocations.json','analytic-allocation-codes.json') ORDER BY key`,configuration);
  }
  const lines=snapshot.orders.flatMap(o=>o.lines),discrepancies=lines.filter(l=>l.sourceAmount!==undefined&&Math.abs(l.amount-l.sourceAmount)>.011);
  console.log(JSON.stringify({through:snapshot.through,importedAt:snapshot.importedAt,orders:snapshot.orders.length,lines:lines.length,excluded:snapshot.orders.filter(o=>!o.department).length,unlinkedInvoiceLines:snapshot.unlinkedInvoiceLines,years:soConsumablesYears(snapshot),discrepancies:discrepancies.length,sourceDifference:discrepancies.reduce((sum,l)=>sum+l.amount-l.sourceAmount!,0),retired,checks:'SQL totals, 100% shares, configuration unchanged'},null,2));
}finally{await repo.close();}
