 "use client";
import {useEffect,useState} from "react";
export default function Attendance(){const [workers,setWorkers]=useState<any[]>([]),[sites,setSites]=useState<any[]>([]),[rows,setRows]=useState<any[]>([]);
const [f,setF]=useState<any>({workerId:"",siteId:"",attendanceDate:new Date().toISOString().slice(0,10),checkIn:"08:00",checkOut:"17:00",status:"PRESENT",notes:""});
async function load(){setWorkers(await (await fetch("/api/workers")).json());setSites(await (await fetch("/api/sites")).json());setRows(await (await fetch("/api/attendance?date="+f.attendanceDate)).json())}
useEffect(() => {
  let cancelled = false;
  const date = f.attendanceDate;
  void Promise.all([
    fetch("/api/workers").then((response) => response.json()),
    fetch("/api/sites").then((response) => response.json()),
    fetch(`/api/attendance?date=${encodeURIComponent(date)}`).then((response) => response.json()),
  ]).then(([workerRows, siteRows, attendanceRows]) => {
    if (cancelled) return;
    setWorkers(workerRows);
    setSites(siteRows);
    setRows(attendanceRows);
  });
  return () => { cancelled = true; };
},[f.attendanceDate]);
async function save(e:any){e.preventDefault();await fetch("/api/attendance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});load()}
return <main style={{maxWidth:1000,margin:"40px auto",padding:20,fontFamily:"Arial"}}><h1>Daily Attendance</h1><form onSubmit={save} style={{display:"grid",gap:8,maxWidth:500}}>
<input type="date" value={f.attendanceDate} onChange={e=>setF({...f,attendanceDate:e.target.value})}/>
<select value={f.workerId} onChange={e=>setF({...f,workerId:e.target.value})}><option value="">Select worker</option>{workers.map(w=><option value={w.id} key={w.id}>{w.workerCode} - {w.fullName}</option>)}</select>
<select value={f.siteId} onChange={e=>setF({...f,siteId:e.target.value})}><option value="">Select site</option>{sites.map(s=><option value={s.id} key={s.id}>{s.siteName}</option>)}</select>
<input type="time" value={f.checkIn} onChange={e=>setF({...f,checkIn:e.target.value})}/><input type="time" value={f.checkOut} onChange={e=>setF({...f,checkOut:e.target.value})}/>
<select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option>PRESENT</option><option>ABSENT</option><option>LATE</option><option>LEAVE</option></select><input placeholder="Notes" value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/><button>Save Attendance</button></form>
<table style={{marginTop:30,width:"100%"}}><thead><tr><th>Worker ID</th><th>Site ID</th><th>Check In</th><th>Check Out</th><th>Status</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.workerId}</td><td>{r.siteId}</td><td>{r.checkIn}</td><td>{r.checkOut}</td><td>{r.status}</td></tr>)}</tbody></table></main>}