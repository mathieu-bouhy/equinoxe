import type { CashEvolutionReport, CashHistorySnapshot, CashDay, CashMonth } from '@equinoxe/shared';

export function cashCutoff(month: string): string {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month) || month < '2024-01') throw new Error('Sélectionnez un mois à partir de janvier 2024.');
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
}
const cents = (value: number) => {
  if (!Number.isFinite(value)) throw new Error('Montant de trésorerie invalide.');
  return Math.round(value * 100);
};

/** EUR cents internally; calendar days and closing balances, not intraday extrema. */
export function buildCashEvolution(snapshot: CashHistorySnapshot, requestedThrough: string): CashEvolutionReport {
  if (requestedThrough < snapshot.from || !/^\d{4}-\d{2}-\d{2}$/.test(requestedThrough)) throw new Error('Période de trésorerie invalide.');
  const through = requestedThrough < snapshot.through ? requestedThrough : snapshot.through;
  const daily = new Map<string, number>(), ids = new Set<number>(), accounts = new Set(snapshot.accounts.map(a => a.id));
  for (const row of snapshot.movements) {
    if (ids.has(row.id)) throw new Error('Mouvement de trésorerie dupliqué.');
    ids.add(row.id);
    if (!accounts.has(row.accountId) || row.date < snapshot.from || row.date > snapshot.through) throw new Error('Mouvement hors périmètre.');
    if (row.date > through) continue;
    daily.set(row.date, (daily.get(row.date) ?? 0) + cents(row.debit) - cents(row.credit));
  }
  const opening = snapshot.accounts.reduce((sum, row) => sum + cents(row.opening), 0);
  let balance = opening;
  const days: CashDay[] = [], months: CashMonth[] = [];
  const date = new Date(`${snapshot.from}T00:00:00Z`);
  let sum = 0;
  while (date.toISOString().slice(0, 10) <= through) {
    const key = date.toISOString().slice(0, 10), month = key.slice(0, 7), movement = daily.get(key) ?? 0;
    let row = months.at(-1);
    if (!row || row.month !== month) {
      row = { month, days: 0, opening: balance / 100, closing: 0, movement: 0, average: 0,
        minimum: Infinity, maximum: -Infinity, minimumDate: key, maximumDate: key, difference: 0 };
      months.push(row); sum = 0;
    }
    balance += movement; sum += balance; row.days++;
    row.closing = balance / 100; row.movement = (balance - cents(row.opening)) / 100;
    row.average = sum / row.days / 100;
    if (row.closing < row.minimum) { row.minimum = row.closing; row.minimumDate = key; }
    if (row.closing > row.maximum) { row.maximum = row.closing; row.maximumDate = key; }
    days.push({ date: key, movement: movement / 100, closing: row.closing });
    date.setUTCDate(date.getUTCDate() + 1);
  }
  for (const month of months) {
    const control = snapshot.monthlyControls.find(row => row.month === month.month);
    if (!control) throw new Error('Contrôle mensuel Odoo manquant.');
    month.difference = (cents(month.closing) - cents(control.closing)) / 100;
  }
  return { companyId: snapshot.companyId, from: snapshot.from, through, requestedThrough,
    importedAt: snapshot.importedAt, needsSync: requestedThrough > snapshot.through,
    opening: opening / 100, closing: balance / 100,
    movementCount: snapshot.movements.filter(row => row.date <= through).length,
    accounts: snapshot.accounts.map(account => ({ ...account, closing: (cents(account.opening) + snapshot.movements.filter(row => row.accountId === account.id && row.date <= through).reduce((sum,row) => sum + cents(row.debit) - cents(row.credit), 0)) / 100 })),
    days, months };
}

export function cashMonthlyCsv(report: CashEvolutionReport): string {
  const money = (value: number) => value.toFixed(2).replace('.', ',');
  return '\uFEFF' + [
    'Mois;Jours calendaires;Ouverture EUR;Moyenne EUR;Minimum EUR;Date minimum;Maximum EUR;Date maximum;Clôture EUR;Mouvements nets EUR;Écart contrôle Odoo EUR',
    ...report.months.map(row => [row.month, row.days, money(row.opening), money(row.average), money(row.minimum), row.minimumDate,
      money(row.maximum), row.maximumDate, money(row.closing), money(row.movement), money(row.difference)].join(';')),
  ].join('\r\n');
}
