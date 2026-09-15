// Opération ponctuelle, jamais appelée par le serveur.
// Depuis apps/api : bun --env-file=.env.local src/scripts/initialize-gimi-allocations.ts [--apply]
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnalyticAllocationCode } from '@equinoxe/shared';
import { config } from '../config';
import { Store } from '../repositories/store';
import { accountSection, departmentLabels, normalizeAllocationLabel, suggestAccountDepartment, suggestEmployeeDepartment, type Department } from '../services/analytic-allocation';

if (!config.databaseUrl) throw new Error('Une connexion PostgreSQL explicite est obligatoire.');
const apply = process.argv.includes('--apply');
const store = new Store(config.dataDir, config.databaseUrl);
const company = (await store.companies.read()).find(row => row.slug === 'gimi');
if (!company) throw new Error('Société Gimi introuvable.');
const companyId = company.id, now = new Date().toISOString();
const sections = (await store.pnlSections.read()).filter(row => row.companyId === companyId);
const departments = Object.keys(departmentLabels) as Department[];
function ensureKeys(current: AnalyticAllocationCode[]) {
  const values = [...current];
  const ids = {} as Record<Department, string>;
  for (const department of departments) {
    const existing = values.find(row => row.companyId === companyId && normalizeAllocationLabel(row.label) === normalizeAllocationLabel(departmentLabels[department]));
    if (existing && departments.some(field => existing[field] !== (field === department ? 100 : 0))) {
      throw new Error(`La clé ${departmentLabels[department]} possède déjà une répartition personnalisée : opération interrompue.`);
    }
    const key = existing ?? {id: crypto.randomUUID(), companyId, label: departmentLabels[department], intrusion: 0, fireInstallation: 0, fireMaintenance: 0, led: 0, [department]: 100, order: Math.max(-1, ...values.filter(row => row.companyId === companyId).map(row => row.order)) + 1, createdAt: now, updatedAt: now};
    if (!existing) values.push(key);
    ids[department] = key.id;
  }
  return {values, result: ids};
}
const [oldKeys, oldAccounts, oldEmployees] = await Promise.all([store.analyticAllocationCodes.read(), store.accountAnalyticAllocations.read(), store.employeeAnalyticAllocations.read()]);
const initialKeys = ensureKeys(oldKeys);
const candidateAccounts = oldAccounts.filter(row => {
  if (row.companyId !== companyId || row.analyticAllocationCodeId) return false;
  const section = accountSection(row.accountCode, sections);
  return section && /^(chiffre d affaires|marchandises)$/.test(normalizeAllocationLabel(section.label)) && suggestAccountDepartment(row.accountCode, row.accountLabel);
});
const candidateEmployees = oldEmployees.filter(row => row.companyId === companyId && suggestEmployeeDepartment(row.function) && row.analyticAllocationCodeId !== initialKeys.result[suggestEmployeeDepartment(row.function)!]);
console.log(JSON.stringify({mode: apply ? 'application' : 'simulation', newKeys: initialKeys.values.length - oldKeys.length, accounts: candidateAccounts.map(row => ({code: row.accountCode, department: suggestAccountDepartment(row.accountCode, row.accountLabel)})), employeeChanges: candidateEmployees.length}));
if (apply) {
  // Sauvegarde des seuls champs modifiés : ni salaires, ni secrets, ni données utilisateurs.
  await mkdir(config.dataDir, {recursive: true});
  const backupPath = join(config.dataDir, `allocation-backup-${now.replace(/[:.]/g, '-')}.json`);
  await Bun.write(backupPath, JSON.stringify({companyId, savedAt: now, keys: oldKeys.filter(row => row.companyId === companyId), accounts: candidateAccounts.map(row => ({id: row.id, analyticAllocationCodeId: row.analyticAllocationCodeId})), employees: candidateEmployees.map(row => ({id: row.id, analyticAllocationCodeId: row.analyticAllocationCodeId}))}, null, 2));
  const ids = await store.analyticAllocationCodes.mutate(ensureKeys);
  const accountIds = new Set(candidateAccounts.map(row => row.id));
  const accountCount = await store.accountAnalyticAllocations.mutate(rows => {
    let count = 0;
    const values = rows.map(row => {
      const department = suggestAccountDepartment(row.accountCode, row.accountLabel);
      if (row.companyId !== companyId || !accountIds.has(row.id) || row.analyticAllocationCodeId || !department) return row;
      count++;
      return {...row, analyticAllocationCodeId: ids[department], updatedAt: now};
    });
    return {values, result: count};
  });
  const previousEmployees = new Map(candidateEmployees.map(row => [row.id, row]));
  const employeeCount = await store.employeeAnalyticAllocations.mutate(rows => {
    let count = 0;
    const values = rows.map(row => {
      const previous = previousEmployees.get(row.id), department = suggestEmployeeDepartment(row.function);
      // Respecte toute modification concurrente faite depuis la lecture initiale.
      if (row.companyId !== companyId || !previous || !department || previous.updatedAt !== row.updatedAt || previous.analyticAllocationCodeId !== row.analyticAllocationCodeId) return row;
      count++;
      return {...row, analyticAllocationCodeId: ids[department], updatedAt: now};
    });
    return {values, result: count};
  });
  console.log(JSON.stringify({saved: true, accountCount, employeeCount, backupPath}));
}
process.exit(0);
