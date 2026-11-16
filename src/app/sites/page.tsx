 "use client";
import {useEffect,useState} from "react";
export default function Sites(){const [rows,setRows]=useState<any[]>([]);const [f,setF]=useState<any>({siteCode:"",siteName:"",location:"",managerName:""});
async function load(){setRows(await (await fetch("/api/sites")).json())}
useEffect(() => {
  let cancelled = false;
  void fetch("/api/sites")
    .then((response) => response.json())
    .then((data) => {
      if (!cancelled) setRows(data);
    });
  return () => { cancelled = true; };
}, []);
async function add(e:any){e.preventDefault();await fetch("/api/sites",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});setF({siteCode:"",siteName:"",location:"",managerName:""});load()}
return <main style={{maxWidth:1000,margin:"40px auto",padding:20,fontFamily:"Arial"}}><h1>Construction Sites</h1><form onSubmit={add} style={{display:"grid",gap:8,maxWidth:500}}>{["siteCode","siteName","location","managerName"].map(k=><input key={k} placeholder={k} value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})} required={k!=="managerName"}/>)}<button>Add Site</button></form><table style={{marginTop:30,width:"100%"}}><thead><tr><th>Code</th><th>Site</th><th>Location</th><th>Manager</th><th>Status</th></tr></thead><tbody>{rows.map(s=><tr key={s.id}><td>{s.siteCode}</td><td>{s.siteName}</td><td>{s.location}</td><td>{s.managerName}</td><td>{s.status}</td></tr>)}</tbody></table></main>}