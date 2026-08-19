// @ts-nocheck
import { Card } from '../components/ui';
import './capex-report.css';

type CapexValues = {
  acquisitionInitial: number | null;
  acquisitions: number | null;
  disposals: number | null;
  transfers: number | null;
  acquisitionEnd: number | null;
  revaluationEnd: number | null;
  amortizationInitial: number | null;
  amortizationBooked: number | null;
  amortizationReversals: number | null;
  amortizationAcquired: number | null;
  amortizationCancelled: number | null;
  amortizationTransfers: number | null;
  amortizationEnd: number | null;
  netBookValue: number | null;
};

type CapexCategory = { code: string; label: string; values: Record<number, CapexValues> };

const empty = (): CapexValues => ({ acquisitionInitial: null, acquisitions: null, disposals: null, transfers: null, acquisitionEnd: null, revaluationEnd: null, amortizationInitial: null, amortizationBooked: null, amortizationReversals: null, amortizationAcquired: null, amortizationCancelled: null, amortizationTransfers: null, amortizationEnd: null, netBookValue: null });
const row = (values: Partial<CapexValues>): CapexValues => ({ ...empty(), ...values });
const years = [2023, 2024, 2025, 2026];

// BNB Consult A-cap/M-app 6.1.x values, expressed in thousands of euros.
// BNB publishes 22/27 as an aggregate; the supplied GIMI amortisation
// schedule provides a 2025 split for categories 23, 24 and 26.
const data: Record<string, CapexCategory[]> = {
  gimi: [
    { code: '21', label: 'Immobilisations incorporelles', values: { 2023: row({ acquisitionInitial: 52245, acquisitions: 92392, acquisitionEnd: 144637, amortizationInitial: 16976, amortizationBooked: 35200, amortizationEnd: 52176, netBookValue: 92461 }), 2024: row({ acquisitionInitial: 144637, acquisitions: 21033, acquisitionEnd: 165670, amortizationInitial: 52176, amortizationBooked: 46079, amortizationEnd: 98255, netBookValue: 67416 }), 2025: row({ acquisitionInitial: 165670, acquisitions: 59325, acquisitionEnd: 224996, amortizationInitial: 98255, amortizationBooked: 45124, amortizationEnd: 143379, netBookValue: 81617 }), 2026: row({ acquisitionInitial: 224996, acquisitionEnd: 224996, amortizationInitial: 143379, amortizationBooked: 31000, amortizationEnd: 174379, netBookValue: 50617 }) } },
    { code: '22', label: 'Terrains et constructions', values: { 2023: empty(), 2024: empty(), 2025: empty(), 2026: empty() } },
    { code: '22/27', label: 'Immobilisations corporelles (agrégat BNB)', values: { 2023: row({ acquisitionInitial: 1724573, acquisitions: 199892, disposals: 81504, acquisitionEnd: 1842961, amortizationInitial: 1014694, amortizationBooked: 183651, amortizationCancelled: 51073, amortizationEnd: 1147272, netBookValue: 695689 }), 2024: row({ acquisitionInitial: 1842961, acquisitions: 213845, disposals: 1373112, acquisitionEnd: 683694, amortizationInitial: 1147272, amortizationBooked: 105663, amortizationCancelled: 923757, amortizationEnd: 329179, netBookValue: 354515 }), 2025: empty(), 2026: empty() } },
    { code: '23', label: 'Installations, machines et outillage', values: { 2023: empty(), 2024: row({ acquisitionInitial: 26701, acquisitionEnd: 26701, amortizationInitial: 24597, amortizationBooked: 2104, amortizationEnd: 24597, netBookValue: 2104 }), 2025: row({ acquisitionInitial: 26701, acquisitionEnd: 26701, amortizationInitial: 24597, amortizationBooked: 2104, amortizationEnd: 26701, netBookValue: 0 }), 2026: row({ acquisitionInitial: 26701, acquisitionEnd: 26701, amortizationInitial: 26701, amortizationEnd: 26701, netBookValue: 0 }) } },
    { code: '24', label: 'Mobilier et matériel roulant', values: { 2023: empty(), 2024: row({ acquisitionInitial: 659873, acquisitionEnd: 659873, amortizationInitial: 319878, amortizationBooked: 34000, amortizationEnd: 319878, netBookValue: 339995 }), 2025: row({ acquisitionInitial: 659873, acquisitions: 310165, disposals: 142952, acquisitionEnd: 827086, amortizationInitial: 319878, amortizationBooked: 151777, amortizationCancelled: 114831, amortizationEnd: 356823, netBookValue: 470262 }), 2026: row({ acquisitionInitial: 827086, acquisitions: 8750, acquisitionEnd: 835836, amortizationInitial: 356823, amortizationBooked: 82177, amortizationEnd: 439000, netBookValue: 396836 }) } },
    { code: '26', label: 'Autres immobilisations corporelles', values: { 2023: empty(), 2024: row({ acquisitionInitial: 17952, acquisitionEnd: 17952, amortizationInitial: 5536, amortizationBooked: 1000, amortizationEnd: 5536, netBookValue: 12416 }), 2025: row({ acquisitionInitial: 17952, acquisitionEnd: 17952, amortizationInitial: 5536, amortizationBooked: 1800, amortizationEnd: 7336, netBookValue: 10616 }), 2026: row({ acquisitionInitial: 17952, acquisitionEnd: 17952, amortizationInitial: 7336, amortizationBooked: 1000, amortizationEnd: 8336, netBookValue: 9616 }) } },
    { code: '25', label: 'Autres immobilisations corporelles', values: { 2023: empty(), 2024: empty(), 2025: empty(), 2026: empty() } },
    { code: '27', label: 'Immobilisations corporelles diverses', values: { 2023: empty(), 2024: empty(), 2025: empty(), 2026: empty() } },
    { code: '28', label: 'Immobilisations financières', values: { 2023: row({ acquisitionInitial: 35916, acquisitions: 83626, disposals: 53758, acquisitionEnd: 65784, netBookValue: 65784 }), 2024: row({ acquisitionInitial: 65784, acquisitions: 64985, disposals: 28175, acquisitionEnd: 102594, netBookValue: 102594 }), 2025: row({ acquisitionInitial: 102594, acquisitions: 29485, acquisitionEnd: 132079, netBookValue: 132079 }), 2026: empty() } },
  ],
  lonneux: [
    { code: '21', label: 'Immobilisations incorporelles', values: { 2023: empty(), 2024: empty(), 2025: empty(), 2026: empty() } },
    { code: '22/27', label: 'Immobilisations corporelles (agrégat BNB/Odoo)', values: { 2023: row({ acquisitionInitial: 39052, acquisitions: 28000, acquisitionEnd: 67052, amortizationInitial: 39052, amortizationBooked: 4782, amortizationEnd: 43834, netBookValue: 23218 }), 2024: row({ acquisitionInitial: 67052, acquisitions: 8700, disposals: 12000, acquisitionEnd: 63752, amortizationInitial: 43834, amortizationBooked: 6969, amortizationCancelled: 6993, amortizationEnd: 43810, netBookValue: 19942 }), 2025: empty(), 2026: row({ netBookValue: -20 }) } },
    { code: '28', label: 'Immobilisations financières', values: { 2023: row({ acquisitionInitial: 25, acquisitionEnd: 25, amortizationInitial: 25, amortizationEnd: 25, netBookValue: 0 }), 2024: row({ acquisitionInitial: 25, acquisitionEnd: 25, amortizationInitial: 25, amortizationEnd: 25, netBookValue: 0 }), 2025: empty(), 2026: empty() } },
  ],
};

const amount = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 }).format(value);

export function CapexDashboard({ companySlug }: { companySlug: string }) {
  const categories = data[companySlug] ?? [];
  const line = (category: CapexCategory, label: string, key: keyof CapexValues, emphasis = false) => <tr className={emphasis ? 'calculation-row key-calculation' : ''} key={`${category.code}-${label}`}><td>{label}</td>{years.map(year => <td key={year}>{amount(category.values[year][key])}</td>)}</tr>;
  return <div className="capex-dashboard"><Card className="capex-card"><div className="profit-loss-heading"><div><p className="eyebrow">BNB Consult · annexe 6.1</p><h2>Investissements – CAPEX</h2><p>Résumé des immobilisations par catégorie, selon les annexes BNB et le tableau d’amortissement fourni. Les montants sont exprimés en milliers d’euros.</p></div><div className="balance-years">{years.map(year => <strong key={year}>{year}</strong>)}</div></div><div className="report-table"><table className="report-matrix capex-matrix"><thead><tr><th>Rubrique</th>{years.map(year => <th key={year}>{year}</th>)}</tr></thead><tbody>{categories.flatMap(category => [<tr className="capex-category" key={`${category.code}-category`}><td colSpan={5}><strong>{category.code}</strong> · {category.label}</td></tr>, <tr className="capex-subheading" key={`${category.code}-acq`}><td colSpan={5}>Valeur d’acquisition</td></tr>, line(category, 'Valeur d’acquisition initiale', 'acquisitionInitial'), line(category, 'Acquisitions, y compris production immobilisée', 'acquisitions'), line(category, 'Cessions et désaffectations', 'disposals'), line(category, 'Transferts d’une rubrique à une autre', 'transfers'), line(category, 'Plus-values au terme de l’exercice', 'revaluationEnd'), line(category, 'Valeur d’acquisition au terme de l’exercice', 'acquisitionEnd', true), <tr className="capex-subheading" key={`${category.code}-amort`}><td colSpan={5}>Amortissements et réductions de valeur</td></tr>, line(category, 'Au terme de l’exercice précédent', 'amortizationInitial'), line(category, 'Actés', 'amortizationBooked'), line(category, 'Repris', 'amortizationReversals'), line(category, 'Acquis de tiers', 'amortizationAcquired'), line(category, 'Annulés à la suite de cessions et désaffectations', 'amortizationCancelled'), line(category, 'Transférés d’une rubrique à une autre', 'amortizationTransfers'), line(category, 'Au terme de l’exercice', 'amortizationEnd'), line(category, 'Valeur comptable nette au terme de l’exercice', 'netBookValue', true)])}</tbody></table></div><p className="report-note">Les comptes annuels abrégés BNB publient les immobilisations corporelles sous la rubrique agrégée 22/27. La ventilation 23/24/26 affichée pour GIMI 2025 provient du tableau d’amortissement fourni. Les valeurs absentes sont affichées « — » et ne sont pas remplacées par des zéros. Les exercices non encore récupérés dans Odoo restent à compléter après connexion.</p></Card></div>;
}
