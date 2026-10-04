import { NextResponse } from 'next/server';
import { apiError, localBoundary } from '@/lib/api';
import { readDataset } from '@/lib/storage';
export const runtime='nodejs';
export async function GET(req:Request) {
  const denied=localBoundary(req);if(denied)return denied;
  try {const d=await readDataset(new URL(req.url).searchParams.get('dataset')??'demo');return NextResponse.json(d,{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}
}
