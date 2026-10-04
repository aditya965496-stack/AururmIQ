import { NextResponse } from 'next/server';
import { apiError, boundedBody, localBoundary } from '@/lib/api';
import { ingestCSV } from '@/lib/ingest';
import { listDatasets, saveDataset } from '@/lib/storage';
export const runtime='nodejs';
export async function GET(req:Request) {
  const denied=localBoundary(req);if(denied)return denied;
  try{return NextResponse.json(await listDatasets(),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}
}
export async function POST(req:Request) {
  const denied=localBoundary(req,5);if(denied)return denied;
  try {const body=await boundedBody(req);if(typeof body.csv!=='string'||typeof body.name!=='string')throw new Error('INVALID_PARAMETERS');const d=ingestCSV(body.csv,body.name);await saveDataset(d,body.csv);return NextResponse.json({id:d.id,rows:d.observations.length,hash:d.hash},{status:201});}catch(e){return apiError(e);}
}
