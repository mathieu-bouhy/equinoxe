type Reader = (model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>) => Promise<unknown>;
type Relation = [number, string] | false;
type AuditLine = { id: number; date: string; name: string | false; account_id: Relation; move_id: Relation; company_id: Relation; journal_id: Relation; debit: number; credit: number };

/** Bounded accounting evidence for local audits; always through the connector's read-only gateway. */
export async function loadCashAudit(read: Reader, accountIds: number[], moveIds: number[], through: string) {
  const validIds = (ids: number[], max: number) => ids.length > 0 && ids.length <= max && ids.every(id => Number.isSafeInteger(id) && id > 0);
  if (!validIds(accountIds, 1000) || !validIds(moveIds, 100) || !/^20\d{2}-\d{2}-\d{2}$/.test(through)) throw new Error('Périmètre d’audit invalide.');
  const groups = await read('account.move.line', 'read_group', [[['parent_state', '=', 'posted'], ['account_id', 'in', accountIds], ['date', '<=', through]], ['debit', 'credit', 'balance'], ['company_id', 'journal_id']], { lazy: false }) as Array<{ company_id: Relation; journal_id: Relation; debit: number; credit: number; balance: number }>;
  const moves = await read('account.move', 'search_read', [[['id', 'in', moveIds], ['state', '=', 'posted'], ['date', '<=', through]]], { fields: ['name', 'ref', 'date', 'company_id', 'journal_id'], limit: 100, order: 'date asc, id asc' });
  const lines: AuditLine[] = [];
  let after = 0;
  while (true) {
    const page = await read('account.move.line', 'search_read', [[['move_id', 'in', moveIds], ['parent_state', '=', 'posted'], ['date', '<=', through], ['id', '>', after]]], { fields: ['date', 'name', 'account_id', 'move_id', 'company_id', 'journal_id', 'debit', 'credit'], order: 'id asc', limit: 500 }) as AuditLine[];
    if (!page.length) break;
    for (const line of page) {
      if (line.id <= after || !Number.isFinite(line.debit) || !Number.isFinite(line.credit)) throw new Error('Évidence comptable incomplète.');
      after = line.id; lines.push(line);
    }
  }
  const journalIds = [...new Set(groups.flatMap(group => group.journal_id ? [group.journal_id[0]] : []))];
  const journals = journalIds.length ? await read('account.journal', 'read', [journalIds], { fields: ['name', 'type', 'company_id', 'default_account_id', 'suspense_account_id'] }) : [];
  return { readAt: new Date().toISOString(), through, groups, journals, moves, lines };
}
