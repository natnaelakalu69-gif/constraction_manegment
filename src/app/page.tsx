import Link from "next/link";

export default function Home() {
  return (
    <main style={{maxWidth:1000,margin:"60px auto",padding:24,fontFamily:"Arial"}}>
      <h1>Construction Site Attendance Management System</h1>
      <p>Manage construction workers, sites, check-in/check-out and attendance reports.</p>
      <div style={{display:"flex",gap:16,marginTop:30,flexWrap:"wrap"}}>
        <Link href="/workers">Workers</Link>
        <Link href="/sites">Construction Sites</Link>
        <Link href="/attendance">Attendance</Link>
      </div>
    </main>
  );
}