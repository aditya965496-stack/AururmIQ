import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ImportError } from './ingest';
const buckets=new Map<string,{count:number;expires:number}>();
export function localBoundary(req:Request, limit=60) {
  const url=new URL(req.url);
  // Next may canonicalize the request URL to localhost while the browser uses
  // 127.0.0.1. Compare Origin to the validated browser-facing Host header.
  const host=req.headers.get('host')??url.host;
  if(!/^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/.test(host))return NextResponse.json({error:{code:'LOCAL_ONLY',message:'This research workspace is available on this computer only.'}},{status:403});
  const origin=req.headers.get('origin');
  const expectedOrigin=`${url.protocol}//${host}`;
  if((req.method!=='GET'&&origin!==expectedOrigin)||(origin&&origin!==expectedOrigin))return NextResponse.json({error:{code:'ORIGIN_REJECTED',message:'Request origin is not allowed.'}},{status:403});
  const now=Date.now(),key=`${url.pathname}:${req.method}`;
  if(buckets.size>100)for(const [k,v]of buckets)if(v.expires<now)buckets.delete(k);
  let bucket=buckets.get(key);if(!bucket||bucket.expires<now){bucket={count:0,expires:now+60000};buckets.set(key,bucket);}
  if(++bucket.count>limit)return NextResponse.json({error:{code:'RATE_LIMITED',message:'Please wait before trying again.'}},{status:429,headers:{'Retry-After':'60'}});
  return null;
}
export async function boundedBody(req:Request,max=11*1024*1024) {
  if(Number(req.headers.get('content-length')??0)>max)throw new ImportError('FILE_TOO_LARGE','Request exceeds the size limit.');
  const reader=req.body?.getReader();if(!reader)throw new Error('INVALID_PARAMETERS');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new ImportError('FILE_TOO_LARGE','Request exceeds the size limit.');}chunks.push(value);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('INVALID_PARAMETERS');}
}
export function apiError(e:unknown) {
  const requestId=randomUUID();
  if(e instanceof ImportError)return NextResponse.json({error:{code:e.code,message:e.message,row:e.row,requestId}},{status:e.code==='FILE_TOO_LARGE'?413:422});
  const code=e instanceof Error?e.message:'';
  if(code==='NOT_FOUND')return NextResponse.json({error:{code,message:'Dataset not found.',requestId}},{status:404});
  if(code.startsWith('INVALID_'))return NextResponse.json({error:{code,message:'Check the pair and research parameter limits.',requestId}},{status:422});
  console.error(JSON.stringify({event:'request_failed',requestId}));
  return NextResponse.json({error:{code:'REQUEST_FAILED',message:'Unable to complete the request. Please retry.',requestId}},{status:500});
}
