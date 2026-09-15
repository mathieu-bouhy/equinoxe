import './ratio-legend.css';

export function RatioLegend({ basis = 'du chiffre d’affaires de la période' }: { basis?: string }) {
  return <p className="ratio-legend"><span aria-hidden="true">%</span> Pourcentages : part {basis}.</p>;
}

export function RatioLabel({ basis = 'du chiffre d’affaires' }: { basis?: string }) {
  return <td aria-label={`Pourcentage ${basis}`}/>;
}
