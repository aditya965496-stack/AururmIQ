'use client';
import { useId, useState } from 'react';
export type ChartSeries = {name:string;color:string;values:number[];dashed?:boolean};
export function Sparkline({values,color='#397665'}:{values:number[];color?:string}) {
  const min=Math.min(...values),max=Math.max(...values),span=max-min||1;
  return <svg viewBox="0 0 100 32" className="sparkline" aria-hidden="true"><path d={values.map((v,i)=>`${i?'L':'M'}${i/(values.length-1||1)*100},${27-(v-min)/span*23}`).join(' ')} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke"/></svg>;
}
export function LineChart({series,dates,unit='',height=240,zero=false,pointLabel='paired observations'}:{series:ChartSeries[];dates:string[];unit?:string;height?:number;zero?:boolean;pointLabel?:string}) {
  const [hover,setHover]=useState<number|null>(null),id=useId().replaceAll(':','');
  const all=series.flatMap(s=>s.values).filter(Number.isFinite);
  if(!all.length)return <div className="chart-empty">No overlapping observations in this range.</div>;
  const minimum=Math.min(...all,...(zero?[0]:[])),maximum=Math.max(...all,...(zero?[0]:[])),padding=Math.max((maximum-minimum)*0.14,0.1);
  const min=minimum-padding,max=maximum+padding,w=760,h=height,left=57,right=19,top=18,bottom=30;
  const x=(i:number)=>left+i/(dates.length-1||1)*(w-left-right),y=(v:number)=>top+(max-v)/(max-min)*(h-top-bottom);
  const axis=(v:number)=>unit==='₹ capital'?`₹${(v/100000).toFixed(2)}L`:unit==='₹'?v.toLocaleString('en-IN',{maximumFractionDigits:0}):v.toFixed(1);
  const path=(s:ChartSeries)=>s.values.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join(' ');
  return <div className="line-chart" onMouseLeave={()=>setHover(null)}>
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${series.map(s=>s.name).join(' and ')} from ${dates[0]} to ${dates.at(-1)}`} onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect();const local=(e.clientX-r.left)/r.width*w;setHover(Math.max(0,Math.min(dates.length-1,Math.round((local-left)/(w-left-right)*(dates.length-1)))));}}>
      <defs><linearGradient id={`fill${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={series[0].color} stopOpacity="0.13"/><stop offset="100%" stopColor={series[0].color} stopOpacity="0"/></linearGradient></defs>
      {[0,1,2,3,4].map(i=>{const v=min+(max-min)*i/4;return <g key={i}><line x1={left} x2={w-right} y1={y(v)} y2={y(v)} stroke="#e9ece7" strokeDasharray="3 4"/><text x={left-10} y={y(v)+4} textAnchor="end" className="chart-label">{axis(v)}</text></g>;})}
      <path d={`${path(series[0])} L${x(dates.length-1)},${h-bottom} L${left},${h-bottom} Z`} fill={`url(#fill${id})`}/>
      {series.map(s=><path key={s.name} d={path(s)} stroke={s.color} strokeWidth="2.3" fill="none" strokeDasharray={s.dashed?'5 5':undefined} strokeLinejoin="round"/>)}
      {dates.length<=5&&series.map(s=>s.values.map((v,i)=><circle key={`${s.name}-${i}`} cx={x(i)} cy={y(v)} r="4" fill={s.color} stroke="white" strokeWidth="2"/>))}
      {[...new Set([0,0.25,0.5,0.75,1].map(f=>Math.round(f*(dates.length-1))))].map(i=><text key={i} x={x(i)} y={h-5} textAnchor="middle" className="chart-label">{new Date(`${dates[i]}T12:00:00Z`).toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'})}</text>)}
      {hover!==null&&<g><line x1={x(hover)} x2={x(hover)} y1={top} y2={h-bottom} stroke="#acbcb3" strokeDasharray="4 4"/>{series.map(s=><circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r="4" fill={s.color} stroke="white" strokeWidth="2"/>)}</g>}
    </svg>
    {hover!==null&&<div className="chart-tooltip"><b>{dates[hover]}</b>{series.map(s=><span key={s.name}><i style={{background:s.color}}/>{s.name}<strong>{unit.startsWith('₹')?'₹':''}{s.values[hover]?.toLocaleString('en-IN',{maximumFractionDigits:2})}{!unit.startsWith('₹')?` ${unit}`:''}</strong></span>)}</div>}
    <div className="chart-summary">{dates.length} {pointLabel} · Hover to inspect · {unit==='₹'?'Rupees per gram of fine gold':unit==='σ'?'Prior-window standard deviations':unit==='bps'?'Basis points; positive means second leg is dearer':unit==='₹ capital'?'Rupees on fixed allocated capital':'Research observations'}</div>
  </div>;
}
