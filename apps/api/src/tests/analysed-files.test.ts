import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';
import { Store } from '../repositories/store';

const directories:string[]=[];

async function fresh(){
  const directory=await mkdtemp(join(tmpdir(),'equinoxe-analysed-files-'));
  directories.push(directory);
  const store=new Store(directory),auth=new AuthService(store);
  await auth.bootstrap();
  return {store,app:createApp(store,auth)};
}

async function login(app:ReturnType<typeof createApp>,email='admin@equinoxe.local',password='change-me-now'){
  const response=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})}));
  return {response,cookie:response.headers.get('set-cookie')?.split(';')[0]??''};
}

afterEach(async()=>{await Promise.all(directories.splice(0).map(directory=>rm(directory,{recursive:true,force:true})))});

describe('accès aux dossiers analysés',()=>{
  test('autorise un administrateur et uniquement les lecteurs explicitement attribués',async()=>{
    const {store,app}=await fresh(),admin=await login(app),now=new Date().toISOString(),passwordHash=await Bun.password.hash('reader-password',{algorithm:'argon2id'});
    const makeViewer=(name:string,analysisAccess:string[])=>({id:crypto.randomUUID(),name,email:`${name.toLowerCase()}@test.local`,role:'viewer' as const,status:'active' as const,analysisAccess,passwordHash,passwordSalt:'embedded-argon2id',createdAt:now,updatedAt:now,lastLoginAt:null});
    const authorised=makeViewer('Authorised',['europlantes']),denied=makeViewer('Denied',[]);
    await store.users.write([...(await store.users.read()),authorised,denied]);
    const authorisedSession=await login(app,authorised.email,'reader-password'),deniedSession=await login(app,denied.email,'reader-password');
    const request=(cookie:string)=>app(new Request('http://api/v1/analysed-files/europlantes',{headers:{cookie}}));
    expect((await request(admin.cookie)).status).toBe(200);
    expect((await request(authorisedSession.cookie)).status).toBe(200);
    expect((await request(deniedSession.cookie)).status).toBe(403);
    expect((await app(new Request('http://api/v1/analysed-files/dossier-inconnu',{headers:{cookie:admin.cookie}}))).status).toBe(404);
  });
});
