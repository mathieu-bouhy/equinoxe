import { z } from 'zod';
import { analysedFiles, toPublicUser, type User } from '@equinoxe/shared';
import type { Store } from '../repositories/store';

// Une liste présente, même vide, remplace l'ancien document d'attributions.
// Les comptes historiques restent lisibles sans migration au démarrage.
export async function companyIdsFor(store:Store,user:User):Promise<string[]> {
  return user.companyIds ?? (await store.access.read()).filter(row=>row.userId===user.id).map(row=>row.companyId);
}
const json=(data:unknown,status=200)=>Response.json({data},{status});
const fail=(message:string,status=422)=>Response.json({error:{code:status===403?'FORBIDDEN':status===404?'NOT_FOUND':status===409?'CONFLICT':'VALIDATION',message}},{status});
const analysisAccess=z.array(z.string().refine(slug=>analysedFiles.some(file=>file.slug===slug))).transform(values=>[...new Set(values)]);
const fields=z.object({
  name:z.string().trim().min(2).max(160),email:z.string().trim().email().transform(value=>value.toLowerCase()),
  role:z.enum(['admin','user','viewer']).transform(role=>role==='admin'?'admin' as const:'user' as const),
  status:z.enum(['active','inactive']),password:z.string().min(8).max(256),
  companyIds:z.array(z.string()).transform(values=>[...new Set(values)]),analysisAccess,equinoxAccess:z.boolean(),
});
const createSchema=fields.extend({companyIds:fields.shape.companyIds.default([]),analysisAccess:analysisAccess.default([]),equinoxAccess:z.boolean().default(false)});

export async function userResponse(request:Request,store:Store,actor:User):Promise<Response|null> {
  const path=new URL(request.url).pathname,match=path.match(/^\/v1\/users(?:\/([^/]+)(?:\/(password|companies|analyses))?)?$/);
  if(!match)return null;
  if(actor.role!=='admin')return fail('Cette action nécessite un accès Administration.',403);
  const [,id,action]=match,method=request.method;
  const publicUser=async(user:User)=>({...toPublicUser(user),companyIds:await companyIdsFor(store,user)});
  if(!id&&method==='GET')return json(await Promise.all((await store.users.read()).map(publicUser)));
  if(id&&action==='companies'&&method==='GET'){
    const user=(await store.users.read()).find(user=>user.id===id);
    return user?json(await companyIdsFor(store,user)):fail('Utilisateur introuvable.',404);
  }
  const creating=!id&&method==='POST';
  const updating=Boolean(id)&&((!action&&method==='PATCH')||(action==='password'&&method==='POST')||(['companies','analyses'].includes(action)&&method==='PUT'));
  if(!creating&&!updating)return fail('Méthode non autorisée.',405);
  let raw:unknown;try{raw=await request.json();}catch{return fail('Informations utilisateur invalides.');}
  const schema=creating?createSchema:action==='password'?fields.pick({password:true}):action==='companies'?fields.pick({companyIds:true}):action==='analyses'?fields.pick({analysisAccess:true}):fields.partial();
  const parsed=schema.safeParse(raw);
  if(!parsed.success)return fail('Informations utilisateur invalides. Vérifiez les champs et le mot de passe (8 caractères minimum).');
  const data:Partial<z.output<typeof fields>>=parsed.data;
  if(data.companyIds){
    const known=new Set((await store.companies.read()).map(company=>company.id));
    if(data.companyIds.some(companyId=>!known.has(companyId)))return fail('Société inconnue.');
  }
  // Le mot de passe saisi ne fait jamais partie du document ni de la réponse.
  const {password,...changes}=data;
  const passwordHash=password?await Bun.password.hash(password,{algorithm:'argon2id'}):undefined;
  const outcome=await store.users.mutate<{user?:User;error?:string;status?:number}>(users=>{
    const target=id?users.find(user=>user.id===id):undefined;
    const refused=(error:string,status=422)=>({values:users,result:{error,status}});
    if(!creating&&!target)return refused('Utilisateur introuvable.',404);
    if(data.email&&users.some(user=>user.id!==id&&user.email.toLowerCase()===data.email))return refused('Cette adresse e-mail existe déjà.',409);
    const role=data.role??target!.role,status=data.status??target!.status;
    if(target?.id===actor.id&&(role!=='admin'||status!=='active'))return refused('Vous ne pouvez pas retirer votre propre accès Administration.');
    if(target?.role==='admin'&&target.status==='active'&&(role!=='admin'||status!=='active')&&users.filter(user=>user.role==='admin'&&user.status==='active').length===1)return refused('Au moins un compte Administration actif doit être conservé.');
    const now=new Date().toISOString();
    const saved:User=creating?{
      id:crypto.randomUUID(),name:data.name!,email:data.email!,role,status,
      companyIds:data.companyIds!,analysisAccess:data.analysisAccess!,equinoxAccess:data.equinoxAccess!,
      passwordHash:passwordHash!,passwordSalt:'embedded-argon2id',createdAt:now,updatedAt:now,lastLoginAt:null,
    }:{...target!,...changes,updatedAt:now,...(passwordHash?{passwordHash,passwordSalt:'embedded-argon2id'}:{})};
    return {values:creating?[...users,saved]:users.map(user=>user.id===id?saved:user),result:{user:saved}};
  });
  return outcome.user?json(await publicUser(outcome.user),creating?201:200):fail(outcome.error!,outcome.status);
}
