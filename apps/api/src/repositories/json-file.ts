import { mkdir, rename, writeFile, readFile } from 'node:fs/promises'; import { dirname, join } from 'node:path'; import { z } from 'zod';
export class JsonFile<T> {
  constructor(private readonly dir:string, private readonly name:string, private readonly schema:z.ZodType<T[]>, private readonly seed:()=>T[]){ }
  private get path(){ return join(this.dir,this.name); }
  async read():Promise<T[]> { try { const raw=await readFile(this.path,'utf8'); const parsed=this.schema.safeParse(JSON.parse(raw)); if(!parsed.success) throw new Error('invalid'); return parsed.data; } catch(error) { if((error as {code?:string}).code==='ENOENT') { const values=this.seed(); await this.write(values); return values; } throw new Error(`Fichier de données invalide : ${this.name}`); } }
  async write(values:T[]){ await mkdir(dirname(this.path),{recursive:true}); const temporary=`${this.path}.${crypto.randomUUID()}.tmp`; await writeFile(temporary,JSON.stringify(values,null,2),'utf8'); await rename(temporary,this.path); }
}
