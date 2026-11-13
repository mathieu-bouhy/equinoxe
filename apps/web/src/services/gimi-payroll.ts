/** Aggregate RH snapshot, verified against IN/OUT. No individual salary or name. */
export const payrollSource={
  url:'https://docs.google.com/spreadsheets/d/1Dy5qxLKCwZ-CfpzbkX_4ino7i1yKq4Pet8Wl2DFPSfU/edit?gid=0#gid=0',
  checkedAt:'2026-11-13',through:'2026-10',start:'2026-01',
};
export const payrollMovements2026=[
  {month:'2026-01',entrants:1,sortants:0},
  {month:'2026-02',entrants:2,sortants:0},
  {month:'2026-03',entrants:2,sortants:0},
  {month:'2026-04',entrants:1,sortants:0},
  {month:'2026-05',entrants:2,sortants:0},
  {month:'2026-06',entrants:2,sortants:1},
  {month:'2026-07',entrants:1,sortants:0},
  {month:'2026-08',entrants:2,sortants:0},
  {month:'2026-09',entrants:0,sortants:0},
  {month:'2026-10',entrants:1,sortants:1},
] as const;
export const payrollDepartments=[{name:'Opérations',entrants:7,sortants:2},{name:'SAV',entrants:4,sortants:0},{name:'Engineering',entrants:2,sortants:0},{name:'Management',entrants:1,sortants:0}];
export function payrollSummary(closed:string){
  const months=payrollMovements2026.filter(m=>m.month<=closed);
  let cumulative=0;
  const series=months.map(m=>({...m,net:m.entrants-m.sortants,cumulative:cumulative+=m.entrants-m.sortants,negativeOut:-m.sortants}));
  const entrants=months.reduce((sum,m)=>sum+m.entrants,0),sortants=months.reduce((sum,m)=>sum+m.sortants,0);
  return {series,entrants,sortants,net:entrants-sortants,available:closed>=payrollSource.start,complete:closed<=payrollSource.through,through:closed<payrollSource.through?closed:payrollSource.through};
}
