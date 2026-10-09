/** Short-lived, bounded, per-connector cache. Never stores rejected requests.
 * Report configuration belongs in the key; authorization stays outside the cache.
 * Clone results so projection/extrapolation cannot mutate a later reader's data.
 */
export class ReportCache {
  private values=new Map<string,{expires:number;value:unknown}>();
  private pending=new Map<string,Promise<unknown>>();
  constructor(private ttlMs=60_000,private maxEntries=24,private now=()=>Date.now()){}
  async get<T>(key:string,load:()=>Promise<T>):Promise<T>{
    const cached=this.values.get(key);
    if(cached&&cached.expires>this.now())return structuredClone(cached.value) as T;
    this.values.delete(key);
    let request=this.pending.get(key);
    if(!request){
      request=Promise.resolve().then(load).then(value=>{
        const time=this.now();
        for(const [id,item] of this.values)if(item.expires<=time)this.values.delete(id);
        while(this.values.size>=this.maxEntries)this.values.delete(this.values.keys().next().value!);
        this.values.set(key,{value,expires:time+this.ttlMs});
        return value;
      }).finally(()=>this.pending.delete(key));
      this.pending.set(key,request);
    }
    return structuredClone(await request) as T;
  }
}
