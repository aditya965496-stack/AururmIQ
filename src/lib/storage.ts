import { mkdir, readFile, readdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeDemo } from './demo';
import type { Dataset, ResearchResult } from './types';
const root=path.join(process.cwd(),'.data');
export async function readDataset(id:string):Promise<Dataset> {
  if(id==='demo') {if(process.env.AURUM_DISABLE_DEMO==='true')throw new Error('NOT_FOUND');return makeDemo();}
  if(!/^[a-f0-9]{64}$/.test(id))throw new Error('NOT_FOUND');
  try{return JSON.parse(await readFile(path.join(root,'datasets',`${id}.json`),'utf8'));}catch{throw new Error('NOT_FOUND');}
}
export async function listDatasets() {
  await mkdir(path.join(root,'datasets'),{recursive:true});
  const files=await readdir(path.join(root,'datasets'));
  const datasets:Dataset[]=process.env.AURUM_DISABLE_DEMO==='true'?[]:[makeDemo()];
  for(const f of files.filter(f=>/^[a-f0-9]{64}\.json$/.test(f)))datasets.push(JSON.parse(await readFile(path.join(root,'datasets',f),'utf8')));
  return datasets.map(d=>({id:d.id,name:d.name,provenance:d.provenance,hash:d.hash,createdAt:d.createdAt,rows:d.observations.length,start:d.observations[0]?.date,end:d.observations.at(-1)?.date}));
}
export async function saveDataset(d:Dataset,csv:string) {
  const dir=path.join(root,'datasets');await mkdir(dir,{recursive:true});
  try {await writeFile(path.join(dir,`${d.id}.csv`),csv,{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  try {await readFile(path.join(dir,`${d.id}.json`));return;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const tmp=path.join(dir,`${d.id}-${randomUUID()}.tmp`);
  await writeFile(tmp,JSON.stringify(d));await rename(tmp,path.join(dir,`${d.id}.json`));
}
export async function saveRun(r:ResearchResult) {
  const dir=path.join(root,'runs');await mkdir(dir,{recursive:true});
  const tmp=path.join(dir,`${r.id}.tmp`);await writeFile(tmp,JSON.stringify(r));await rename(tmp,path.join(dir,`${r.id}.json`));
}
export async function listRuns(datasetId:string) {
  const dir=path.join(root,'runs');await mkdir(dir,{recursive:true});
  const files=await readdir(dir);const records:ResearchResult[]=[];
  for(const file of files.filter(f=>/^[a-f0-9-]{36}\.json$/.test(f))) {
    const r:ResearchResult=JSON.parse(await readFile(path.join(dir,file),'utf8'));
    if(r.datasetId===datasetId)records.push(r);
  }
  return records.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,20).map(r=>({id:r.id,createdAt:r.createdAt,a:r.params.a,b:r.params.b,net:r.net,verdict:r.verdict}));
}
export async function readRun(id:string):Promise<ResearchResult> {
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))throw new Error('NOT_FOUND');
  try{return JSON.parse(await readFile(path.join(root,'runs',`${id}.json`),'utf8'));}catch{throw new Error('NOT_FOUND');}
}
