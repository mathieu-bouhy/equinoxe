import { Navigate, useOutletContext, useParams } from 'react-router-dom';
import { analysedFiles, canAccessEquinox, type Company, type PublicUser } from '@equinoxe/shared';
import { EmptyState, PageHeader } from '../components/ui';
export function Home(){
  const {companies,me}=useOutletContext<{companies:Company[];me:PublicUser}>();
  const last=localStorage.getItem('equinoxe.lastCompany'),company=companies.find(c=>c.slug===last)??companies[0];
  if(company)return <Navigate to={`/societes/${company.slug}/tableaux-de-bord/compte-resultat`} replace/>;
  if(canAccessEquinox(me))return <Navigate to="/suivi-des-heures" replace/>;
  const dossier=analysedFiles.find(file=>me.role==='admin'||me.analysisAccess.includes(file.slug));
  if(dossier)return <Navigate to={`/dossiers-analyses/${dossier.slug}/compte-resultat`} replace/>;
  return <Navigate to="/sans-acces" replace/>;
}
export function NoAccess(){return <EmptyState title="Aucun espace attribué">Votre compte est actif. Contactez une personne disposant d’un accès Administration pour obtenir l’accès à une société, un dossier ou aux applications Equinoxe. Votre profil reste accessible dans « Mon compte ».</EmptyState>}
export function NotFound(){return <main className="state-page"><EmptyState title="Page introuvable">La page demandée n’existe pas.</EmptyState></main>}
export function PendingDossier(){const {dossierSlug}=useParams(),file=analysedFiles.find(file=>file.slug===dossierSlug);return file?<><PageHeader title={file.name}/><EmptyState title="Dossier en préparation">Les rapports de ce dossier ne sont pas encore disponibles dans l’interface.</EmptyState></>:<NotFound/>}
