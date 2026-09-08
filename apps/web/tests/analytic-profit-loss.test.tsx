import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalyticDepartmentSelector, GimiProfitLoss } from '../src/components/AnalyticProfitLoss';

test('quatre cases dans l’ordre demandé et retour explicite à la société entière',()=>{
  const html=renderToStaticMarkup(<AnalyticDepartmentSelector value={['fireMaintenance','led']} onChange={()=>{}}/>);
  expect(html.match(/type="checkbox"/g)).toHaveLength(4);
  expect(html.match(/checked=""/g)).toHaveLength(2);
  const labels=['Incendie installation','Incendie maintenance','Intrusion','LED'];
  expect(labels.map(label=>html.indexOf(label))).toEqual(labels.map(label=>html.indexOf(label)).sort((a,b)=>a-b));
  expect(html).toContain('aria-pressed="false"');expect(html).toContain('Société entière');
});
for(const mode of ['annual','ltm','extrapolated'] as const)test(`${mode} conserve par défaut le composant global existant`,()=>{
  const html=renderToStaticMarkup(<GimiProfitLoss companyId="gimi" mode={mode} closed="2026-07"><div>Rapport global original</div></GimiProfitLoss>);
  expect(html).toContain('Rapport global original');expect(html).toContain('aria-pressed="true"');expect(html).not.toContain('checked=""');
});
