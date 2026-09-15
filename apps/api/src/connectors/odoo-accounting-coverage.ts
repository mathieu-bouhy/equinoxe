type Read = (model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>) => Promise<unknown>;
type Group = { __count?: number; date_count?: number; balance?: number; debit?: number; credit?: number; __range?: { 'date:month'?: { from?: string } } };

/** Counts and date bounds only, through the connector's read-only gateway. */
export async function loadAccountingCoverage(read: Read, years: number[]) {
  if (!years.length || years.length > 5 || years.some(year => !Number.isInteger(year) || year < 2000 || year > 2100)) throw new Error('Années invalides.');
  const accounts = await read('account.account', 'search_read', [[['code', '=like', '6%']]], { fields: ['code'], context: { active_test: false } }) as Array<{ id: number }>;
  const income = await read('account.account', 'search_read', [[['code', '=like', '7%']]], { fields: ['code'], context: { active_test: false } }) as Array<{ id: number }>;
  const pnlIds = [...accounts, ...income].map(account => account.id);
  const output = [];
  for (const year of years) {
    const domain = [['parent_state', '=', 'posted'], ['date', '>=', `${year}-01-01`], ['date', '<=', `${year}-12-31`]];
    const [first, last, allMonths, pnlMonths, expenseMonths, incomeMonths] = await Promise.all([
      read('account.move.line', 'search_read', [domain], { fields: ['date'], order: 'date asc,id asc', limit: 1 }) as Promise<Array<{ date: string }>>,
      read('account.move.line', 'search_read', [domain], { fields: ['date'], order: 'date desc,id desc', limit: 1 }) as Promise<Array<{ date: string }>>,
      read('account.move.line', 'read_group', [domain, ['debit', 'credit'], ['date:month']], { lazy: false }) as Promise<Group[]>,
      read('account.move.line', 'read_group', [[...domain, ['account_id', 'in', pnlIds]], ['balance'], ['date:month']], { lazy: false }) as Promise<Group[]>,
      read('account.move.line', 'read_group', [[...domain, ['account_id', 'in', accounts.map(account => account.id)]], ['balance'], ['date:month']], { lazy: false }) as Promise<Group[]>,
      read('account.move.line', 'read_group', [[...domain, ['account_id', 'in', income.map(account => account.id)]], ['balance'], ['date:month']], { lazy: false }) as Promise<Group[]>,
    ]);
    const summarize = (groups: Group[]) => groups.map(group => ({ month: group.__range?.['date:month']?.from?.slice(0, 7), entries: group.__count ?? group.date_count ?? null, ...(group.balance !== undefined ? { balance: group.balance } : {}) })).sort((a,b) => (a.month ?? '').localeCompare(b.month ?? ''));
    output.push({ year, firstDate: first[0]?.date ?? null, lastDate: last[0]?.date ?? null, allMonths: summarize(allMonths), profitLossMonths: summarize(pnlMonths), expenseMonths: summarize(expenseMonths), incomeMonths: summarize(incomeMonths) });
  }
  return output;
}
