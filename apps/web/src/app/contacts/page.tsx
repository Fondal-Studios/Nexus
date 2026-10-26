"use client";
import { useMemo, useState } from "react";
import { aggregateContacts, categoryCounts, importContactsVCard, importConversationCSV, type ContactCategory, type ContactRecord, type ImportedMessage } from "../../lib/contact-import";
const LABELS: Record<ContactCategory,string>={paciente:"Paciente",familia:"Familia",amistad:"Amistad",colega:"Colega",negocio:"Negocios",ocasional:"Ocasional",sin_clasificar:"Por clasificar"};
export default function ContactsPage(){
 const [contacts,setContacts]=useState<ContactRecord[]>([]),[messages,setMessages]=useState<ImportedMessage[]>([]),[error,setError]=useState(""),[filter,setFilter]=useState(""),[busy,setBusy]=useState(false);
 const counts=useMemo(()=>categoryCounts(contacts),[contacts]);
 const shown=contacts.filter(c=>c.name.toLowerCase().includes(filter.toLowerCase())||c.phone.includes(filter));
 async function upload(file:File | undefined,kind:"chats"|"vcf"){if(!file)return;setBusy(true);setError("");try{if(file.size>50*1024*1024)throw new Error("Archivo demasiado grande para el importador local (máximo 50 MB).");const txt=await file.text();if(kind==="chats"){const parsed=importConversationCSV(txt);setMessages(prev=>{const all=[...prev,...parsed];setContacts(curr=>aggregateContacts(all,curr));return all;});}else{const parsed=importContactsVCard(txt);setContacts(prev=>aggregateContacts(messages,[...prev,...parsed]));}}catch(e){setError(e instanceof Error?e.message:"No se pudo leer el archivo");}finally{setBusy(false);}}
 function tag(id:string,category:ContactCategory){setContacts(prev=>prev.map(c=>c.id===id?{...c,categories:category==="sin_clasificar"?["sin_clasificar"]:c.categories.includes(category)?c.categories.filter(x=>x!==category):[...c.categories.filter(x=>x!=="sin_clasificar"),category],confidence:"manual"}:c));}
 return <main style={{maxWidth:1050,margin:"0 auto",padding:"32px 20px",color:"#172b44"}}>
 <p style={{fontSize:12,letterSpacing:2,color:"#67798d"}}>NEXUS / MEMORIA RELACIONAL</p><h1 style={{fontSize:32,fontWeight:700}}>Contactos inteligentes</h1>
 <p>Importá tu agenda y el CSV de tus conversaciones. Clasificá personas por múltiples categorías y consultá cuántos pacientes tenés identificados.</p>
 <p style={{background:"#eef3f8",padding:13,borderRadius:8}}>Primera versión local: el navegador analiza el archivo, sin enviarlo al servidor. Los resultados de esta pantalla se pierden al recargar. La sincronización permanente y la clasificación por IA aún no están implementadas.</p>
 <div style={{display:"flex",gap:14,flexWrap:"wrap",margin:"24px 0"}}>
 <label style={{padding:14,border:"1px solid #bcc9d6",borderRadius:8,cursor:"pointer"}}>Importar agenda (.vcf)<input aria-label="Importar agenda VCF" type="file" accept=".vcf,text/vcard" style={{display:"block"}} disabled={busy} onChange={e=>void upload(e.target.files?.[0],"vcf")}/></label>
 <label style={{padding:14,border:"1px solid #bcc9d6",borderRadius:8,cursor:"pointer"}}>Importar chats (.csv)<input aria-label="Importar conversaciones CSV" type="file" accept=".csv,text/csv" style={{display:"block"}} disabled={busy} onChange={e=>void upload(e.target.files?.[0],"chats")}/></label>
 </div>
 {error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:26}}>
 {[["Contactos",contacts.length],["Pacientes identificados",counts.paciente],["Por clasificar",counts.sin_clasificar],["Mensajes cargados",messages.length]].map(([name,value])=><div key={name} style={{padding:20,border:"1px solid #dae1ea",borderRadius:11}}><div style={{fontSize:13}}>{name}</div><strong style={{fontSize:30}}>{value}</strong></div>)}
 </div>
 <label>Buscar contacto<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Nombre o teléfono" style={{display:"block",padding:12,width:"100%",border:"1px solid #cad5e0",borderRadius:8,margin:"8px 0 18px"}}/></label>
 {shown.map(c=><article key={c.id} style={{padding:17,borderBottom:"1px solid #e4eaf0"}}>
 <div style={{display:"flex",justifyContent:"space-between",gap:12}}><strong>{c.name}</strong><span style={{fontSize:13}}>{c.messageCount} mensajes</span></div>
 <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10}}>{(Object.keys(LABELS) as ContactCategory[]).filter(x=>x!=="sin_clasificar").map(category=><button key={category} type="button" onClick={()=>tag(c.id,category)} aria-pressed={c.categories.includes(category)} style={{border:"1px solid #b7c5d5",borderRadius:20,padding:"6px 10px",background:c.categories.includes(category)?"#163451":"white",color:c.categories.includes(category)?"white":"#163451",cursor:"pointer"}}>{LABELS[category]}</button>)}</div>
 </article>)}
 {!shown.length&&<p style={{color:"#6e8092"}}>Todavía no hay contactos para mostrar.</p>}
 </main>;
}