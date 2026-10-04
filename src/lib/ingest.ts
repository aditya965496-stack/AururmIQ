import { createHash } from 'node:crypto';
import { SPECS, SYMBOLS } from './demo';
import type { Contract, Dataset, Observation, SymbolName } from './types';
export class ImportError extends Error { constructor(public code:string, message:string, public row?:number) {super(message);} }
export function strictDate(s:string):boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
}
export function parseCSV(text:string):string[][] {
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(!quoted&&field.length>0)throw new ImportError('CSV_SYNTAX','Unexpected quote in CSV field.');else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}
    else field+=c;
    if(field.length>1000)throw new ImportError('ROW_TOO_LARGE','A CSV field exceeds the 1,000-character limit.');
    if(rows.length>20000)throw new ImportError('TOO_MANY_ROWS','Import is limited to 20,000 rows.');
  }
  if(quoted)throw new ImportError('CSV_SYNTAX','CSV contains an unclosed quoted field.');
  row.push(field);if(row.some(Boolean))rows.push(row);
  return rows;
}
export function ingestCSV(csv:string, name:string, today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})):Dataset {
  if(Buffer.byteLength(csv,'utf8')>10*1024*1024)throw new ImportError('FILE_TOO_LARGE','CSV must be smaller than 10 MB.');
  if(csv.trimStart().startsWith('<'))throw new ImportError('INVALID_CONTENT','An HTML response is not a data file.');
  const rows=parseCSV(csv.replace(/^\uFEFF/,''));
  const header=rows.shift()?.map(s=>s.trim().toLowerCase())??[];
  const required=['trade_date','requested_date','symbol','expiry','tender_start','open','high','low','close','volume','open_interest'];
  if(required.some(h=>!header.includes(h)) || new Set(header).size!==header.length)throw new ImportError('SCHEMA_MISMATCH',`Required unique columns: ${required.join(', ')}. Optional: settlement.`);
  const contracts=new Map<string,Contract>(),observations:Observation[]=[],keys=new Set<string>();
  for(let i=0;i<rows.length;i++) {
    const r=rows[i];if(r.length!==header.length)throw new ImportError('COLUMN_COUNT','CSV row has the wrong number of columns.',i+2);
    const fields=Object.fromEntries(header.map((h,j)=>[h,r[j].trim()]));
    const bad=(code:string,message:string):never=>{throw new ImportError(code,message,i+2);};
    for(const key of ['trade_date','requested_date','expiry','tender_start'])if(!strictDate(fields[key]))bad('INVALID_DATE',`${key} must be a valid YYYY-MM-DD date.`);
    if(fields.trade_date!==fields.requested_date)bad('DATA_DATE_MISMATCH',`Requested ${fields.requested_date}, received ${fields.trade_date}. No rows were published.`);
    if(fields.trade_date>today)bad('FUTURE_DATE','Future observations cannot be imported.');
    if(fields.trade_date>fields.expiry||fields.tender_start>fields.expiry)bad('CONTRACT_DATE_INVALID','Observation/tender date exceeds contract expiry.');
    const symbol=fields.symbol as SymbolName;
    if(!SYMBOLS.includes(symbol))bad('UNSUPPORTED_SYMBOL','Only GOLDM, GOLDTEN, GOLDGUINEA and GOLDPETAL are supported.');
    const id=`${symbol}-${fields.expiry}`,key=`${id}|${fields.trade_date}`;
    if(keys.has(key))bad('DUPLICATE_OBSERVATION','Duplicate exact contract/date in this file.');keys.add(key);
    if(contracts.has(id)&&contracts.get(id)!.tenderStart!==fields.tender_start)bad('SPEC_CONFLICT','A contract has conflicting tender dates.');
    contracts.set(id,{id,symbol,expiry:fields.expiry,tenderStart:fields.tender_start,...SPECS[symbol],specStatus:'provisional'});
    const numeric=(key:string,integer=false)=>{const raw=fields[key];if(!raw||!/^\d+(\.\d+)?$/.test(raw))return bad('INVALID_NUMBER',`${key} must be a nonnegative finite number.`);const v=Number(raw);if(!Number.isFinite(v)||v>1e10||(integer&&!Number.isInteger(v)))return bad('INVALID_NUMBER',`${key} is outside supported bounds.`);return v;};
    const open=numeric('open'), high=numeric('high'),low=numeric('low'),close=numeric('close'),volume=numeric('volume',true),oi=numeric('open_interest',true);
    if(Math.min(open,high,low,close)<=0)bad('INVALID_PRICE','OHLC prices must be positive; blank/nontrading prices need source-specific handling.');
    if(low>high||high<Math.max(open,close)||low>Math.min(open,close))bad('OHLC_INCONSISTENT','OHLC fields do not describe a consistent traded bar.');
    const settlement=fields.settlement?numeric('settlement'):null;
    if(settlement!==null&&settlement<=0)bad('INVALID_PRICE','Settlement must be positive when supplied.');
    observations.push({contractId:id,date:fields.trade_date,open,high,low,close,volume,oi,settlement});
  }
  if(!observations.length)throw new ImportError('EMPTY_DATASET','The CSV contains no observations.');
  observations.sort((a,b)=>a.date.localeCompare(b.date)||a.contractId.localeCompare(b.contractId));
  const hash=createHash('sha256').update(csv).digest('hex');
  return {id:hash,name:name.trim().slice(0,80)||'Imported research dataset',provenance:'user-import',hash,rawHash:hash,parserVersion:'canonical-csv-v1',createdAt:new Date().toISOString(),contracts:[...contracts.values()],observations,
    warnings:['User-supplied observations; exchange origin and historical publication times are not verified.','Quote/lot/purity/location use the supplied plan’s provisional registry, not verified historical specifications. CSV tender dates are user supplied.','Volume and open interest are assumed to be lots. Verify this against the original source dictionary.','All research uses Close; Settlement is stored separately when provided.','No listing dates or verified exchange calendar are available. Pre-listing and holiday rows cannot yet be independently checked.']};
}
