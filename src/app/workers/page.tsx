 "use client";
import { useEffect, useState } from "react";
export default function Workers() {
  const [rows,setRows]=useState<any[]>([]); const [form,setForm]=useState<any>({workerCode:"",fullName:"",position:"",phone:"",department:""});
  async function load(){setRows(await (await fetch("/api/workers")).json())};
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/workers")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setRows(data);
      });
    return () => { cancelled = true; };
  }, []);
  async function add(e:any){e.preventDefault(); await fetch("/api/workers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)}); setForm({workerCode:"",fullName:"",position:"",phone:"",department:""}); load();}
  return <main style={{maxWidth:1000,margin:"40px auto",padding:20,fontFamily:"Arial"}}><h1>Construction Workers</h1>
    <form onSubmit={add} style={{display:"grid",gap:8,maxWidth:500}}>{["workerCode","fullName","position","phone","department"].map(k=><input key={k} placeholder={k} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} required={["workerCode","fullName","position"].includes(k)}/>)}<button>Add Worker</button></form>
    <table style={{marginTop:30,width:"100%"}}><thead><tr><th>ID</th><th>Code</th><th>Name</th><th>Position</th><th>Phone</th><th>Status</th></tr></thead><tbody>{rows.map(w=><tr key={w.id}><td>{w.id}</td><td>{w.workerCode}</td><td>{w.fullName}</td><td>{w.position}</td><td>{w.phone}</td><td>{w.status}</td></tr>)}</tbody></table>
  </main>
}