import { NextResponse } from 'next/server';
import { apiError, boundedBody, localBoundary } from '@/lib/api';
import { listRuns, readDataset, readRun, saveRun } from '@/lib/storage';
import { backtest, validateParams } from '@/lib/research';
export const runtime='nodejs';
export async function GET(req:Request) {
  const denied=localBoundary(req);if(denied)return denied;
  try {const q=new URL(req.url).searchParams;const id=q.get('run');if(id){const r=await readRun(id);await readDataset(r.datasetId);return NextResponse.json(r,{headers:{'Cache-Control':'no-store'}});}const dataset=q.get('dataset')??'demo';await readDataset(dataset);return NextResponse.json(await listRuns(dataset),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}
}
export async function POST(req:Request) {
  const denied=localBoundary(req,6);if(denied)return denied;
  try {const body=await boundedBody(req,10000);if(typeof body.datasetId!=='string')throw new Error('INVALID_PARAMETERS');const d=await readDataset(body.datasetId);const p=validateParams(body.params,d);const result=backtest(d,p);await saveRun(result);return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}
}
