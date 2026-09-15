import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BalanceReport, CashFlowReport } from '@equinoxe/shared';
import { api } from '../services/api';
import { BalanceTable } from './BalanceTable';
import { ErrorState, LoadingState } from './ui';

export function CompanyBalanceSheet({companyId,renderCashFlow,showCashFlow=true}:{companyId:string;showCashFlow?:boolean;renderCashFlow:(cash:CashFlowReport,balance?:BalanceReport)=>ReactNode}){
  const balance=useQuery({queryKey:['balance',companyId],queryFn:()=>api.balanceSheet(companyId)});
  const cash=useQuery({queryKey:['cash-flow',companyId],queryFn:()=>api.cashFlow(companyId),enabled:showCashFlow});
  return <div className="balance-dashboard">
    {balance.data?<BalanceTable report={balance.data}/>:balance.isLoading?<LoadingState/>:<ErrorState message="Impossible de charger le bilan. Réessayez après vérification de la connexion."/>}
    {balance.isError&&balance.data&&<ErrorState message="L’actualisation du bilan a échoué. Les dernières données chargées restent affichées."/>}
    {showCashFlow&&(cash.data?renderCashFlow(cash.data,balance.data):cash.isLoading?<LoadingState/>:<ErrorState message="Le pont de trésorerie est indisponible. Le bilan reste consultable."/>)}
  </div>;
}
