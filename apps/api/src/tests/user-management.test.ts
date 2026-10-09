import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toPublicUser } from '@equinoxe/shared';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';
const dirs:string[]=[];
afterEach(async()=>{await Promise.all(dirs.splice(0).map(dir=>rm(dir,{recursive:true,force:true})));});
async function fresh(){
  const dir=await mkdtemp(join(tmpdir(),'equinoxe-users-'));dirs.push(dir);
  const store=new Store(dir),auth=new AuthService(store);await auth.bootstrap();const app=createApp(store,auth);
  const request=(path:string,method='GET',body?:unknown,cookie='')=>app(new Request(`http://api/v1${path}`,{method,headers:{'content-type':'application/json',cookie},...(body?{body:JSON.stringify(body)}:{})}));
  const login=async(email='admin@equinoxe.local',password='change-me-now')=>{const response=await request('/auth/login','POST',{email,password});return {response,cookie:response.headers.get('set-cookie')?.split(';')[0]??''};};
  const admin=await login(),companies=await store.companies.read();
  const create=async(extra:Record<string,unknown>={})=>{const response=await request('/users','POST',{name:'Utilisateur test',email:'user@test.local',role:'user',status:'active',password:'test-password',companyIds:[companies[0].id],analysisAccess:['medipost'],equinoxAccess:true,...extra},admin.cookie);return {response,user:(await response.json()).data};};
  return {dir,store,auth,request,login,admin,companies,create};
}
test('création atomique, tous les accès relus et aucun mot de passe dans la réponse ou le stockage',async()=>{
  const f=await fresh(),{response,user}=await f.create();expect(response.status).toBe(201);
  expect(user).toMatchObject({role:'user',companyIds:[f.companies[0].id],analysisAccess:['medipost'],equinoxAccess:true,lastLoginAt:null});
  expect(user.password).toBeUndefined();expect(user.passwordHash).toBeUndefined();
  const storage=await readFile(join(f.dir,'users.json'),'utf8');expect(storage).not.toContain('test-password');expect(storage).toContain('argon2id');
  const reloaded=new Store(f.dir),saved=(await reloaded.users.read()).find(row=>row.id===user.id)!;expect(saved.companyIds).toEqual(user.companyIds);
  const session=await f.login('user@test.local','test-password');expect(session.response.status).toBe(200);
  expect((await f.request(`/companies/${f.companies[0].id}/dashboards`,'GET',undefined,session.cookie)).status).toBe(200);
  expect((await f.request('/analysed-files/medipost','GET',undefined,session.cookie)).status).toBe(200);
  expect((await f.request('/time-entries','GET',undefined,session.cookie)).status).toBe(200);
  const listed=(await (await f.request('/users','GET',undefined,f.admin.cookie)).json()).data.find((row:{id:string})=>row.id===user.id);
  expect(listed.lastLoginAt).not.toBeNull();expect(listed.lastLoginAt).toBe((await session.response.json()).data.lastLoginAt);
});
test('modification complète et retrait immédiat des trois accès dans une session ouverte',async()=>{
  const f=await fresh(),{user}=await f.create(),session=await f.login('user@test.local','test-password');
  const updated=await f.request(`/users/${user.id}`,'PATCH',{name:'Nouveau nom',companyIds:[],analysisAccess:[],equinoxAccess:false,password:'new-password'},f.admin.cookie);expect(updated.status).toBe(200);
  for(const path of [`/companies/${f.companies[0].id}/dashboards`,'/analysed-files/medipost','/time-entries','/time-entries/settings'])expect((await f.request(path,'GET',undefined,session.cookie)).status).toBe(403);
  for(const [path,method] of [['/time-entries/import','PUT'],['/time-entries/entry','PATCH'],['/users','POST']])expect((await f.request(path,method,{},session.cookie)).status).toBe(403);
  expect((await f.login('user@test.local','test-password')).response.status).toBe(401);expect((await f.login('user@test.local','new-password')).response.status).toBe(200);
  await f.request(`/users/${user.id}`,'PATCH',{status:'inactive'},f.admin.cookie);
  expect((await f.request('/auth/me','POST',{},session.cookie)).status).toBe(401);
});
test('compatibilité des anciens lecteurs et priorité au retrait explicite des sociétés',async()=>{
  const f=await fresh(),base=(await f.store.users.read())[0],legacy={...base,id:'legacy',name:'Ancien lecteur',email:'legacy@test.local',role:'viewer' as const};
  await f.store.users.mutate(users=>({values:[...users,legacy],result:null}));
  await f.store.access.write([{userId:'legacy',companyId:f.companies[0].id,createdAt:base.createdAt}]);
  const session=await f.login('legacy@test.local');expect((await session.response.json()).data.role).toBe('user');
  expect((await f.request(`/companies/${f.companies[0].id}/dashboards`,'GET',undefined,session.cookie)).status).toBe(200);
  expect((await f.request('/time-entries','GET',undefined,session.cookie)).status).toBe(403);
  const list=(await (await f.request('/users','GET',undefined,f.admin.cookie)).json()).data;
  expect(list.find((u:{id:string})=>u.id==='legacy').companyIds).toEqual([f.companies[0].id]);
  expect((await f.request('/users/legacy/companies','PUT',{companyIds:[]},f.admin.cookie)).status).toBe(200);
  expect((await f.request(`/companies/${f.companies[0].id}/dashboards`,'GET',undefined,session.cookie)).status).toBe(403);
});
test('validation ne modifie rien, unicité concurrente et protection de son administration',async()=>{
  const f=await fresh();expect((await f.create({companyIds:['unknown']})).response.status).toBe(422);expect(await f.store.users.read()).toHaveLength(1);
  const results=await Promise.all([f.create(),f.create()]);expect(results.map(result=>result.response.status).sort()).toEqual([201,409]);
  const user=results.find(result=>result.user)?.user;
  const before=(await f.store.users.read()).find(row=>row.id===user.id);
  expect((await f.request(`/users/${user.id}`,'PATCH',{name:'Ne pas enregistrer',password:'short'},f.admin.cookie)).status).toBe(422);
  expect((await f.store.users.read()).find(row=>row.id===user.id)).toEqual(before);
  const admin=(await f.store.users.read()).find(row=>row.role==='admin')!;
  expect((await f.request(`/users/${admin.id}`,'PATCH',{role:'user'},f.admin.cookie)).status).toBe(422);
  expect((await f.request(`/users/${admin.id}`,'PATCH',{status:'inactive'},f.admin.cookie)).status).toBe(422);
  const publicValue=toPublicUser({...admin,password:'old-unsafe-property'} as typeof admin);expect(JSON.stringify(publicValue)).not.toContain('old-unsafe-property');
});
test('connexion concurrente préserve les droits modifiés et un login échoué ne change pas la dernière connexion',async()=>{
  const f=await fresh(),{user}=await f.create();
  await Promise.all([f.login('user@test.local','test-password'),f.request(`/users/${user.id}`,'PATCH',{analysisAccess:['europlantes'],equinoxAccess:false},f.admin.cookie)]);
  const saved=(await f.store.users.read()).find(row=>row.id===user.id)!;expect(saved.analysisAccess).toEqual(['europlantes']);expect(saved.equinoxAccess).toBe(false);expect(saved.lastLoginAt).not.toBeNull();
  await f.login('user@test.local','incorrect');expect((await f.store.users.read()).find(row=>row.id===user.id)!.lastLoginAt).toBe(saved.lastLoginAt);
});
