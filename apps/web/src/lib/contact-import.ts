export type ContactCategory = "paciente" | "familia" | "amistad" | "colega" | "negocio" | "ocasional" | "sin_clasificar";
export type ContactRecord = { id: string; name: string; phone: string; categories: ContactCategory[]; messageCount: number; lastMessage?: string; confidence: "manual" | "pendiente" };
export type ImportedMessage = { contact: string; timestamp: string; sender: string; text: string };
const normalize = (text: string) => text.normalize("NFKC").trim();
export function parseDelimited(input: string, delimiter?: string): string[][] {
  const source = input.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const sep = delimiter ?? (firstLine.split("\t").length > firstLine.split(";").length && firstLine.includes("\t") ? "\t" : firstLine.split(";").length > firstLine.split(",").length ? ";" : ",");
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (ch === '"') { if (quoted && source[i+1] === '"') {field += '"'; i++;} else quoted = !quoted; }
    else if (ch === sep && !quoted) {row.push(field);field = "";}
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && source[i+1] === "\n") i++;
      row.push(field); if (row.some(x=>x.trim())) rows.push(row); row=[];field="";
    } else field += ch;
  }
  row.push(field); if (row.some(x=>x.trim())) rows.push(row);
  return rows;
}
const findColumn = (headers:string[], names:string[]) => headers.findIndex(h => names.some(n=>h === n || h.includes(n)));
export function importConversationCSV(csv: string): ImportedMessage[] {
  const [header, ...rows] = parseDelimited(csv);
  if (!header) return [];
  const h=header.map(x=>normalize(x).toLowerCase());
  const contact=findColumn(h,["chat","conversation","conversación","contact","contacto","thread"]);
  const sender=findColumn(h,["sender","from","remitente","author","autor"]);
  const timestamp=findColumn(h,["date","fecha","time","hora"]);
  const body=findColumn(h,["message","mensaje","text","texto","body","content"]);
  if (body<0) throw new Error("No se encontró la columna del mensaje. Revisá el formato CSV exportado.");
  if (contact<0 && sender<0) throw new Error("No se encontró la columna de conversación o remitente.");
  return rows.filter(r => r[body]?.trim()).map(r=>({contact:normalize(r[contact]??r[sender]??"Desconocido"),sender:normalize(r[sender]??""),timestamp:normalize(r[timestamp]??""),text:r[body]??""}));
}
export function importContactsVCard(text: string): ContactRecord[] {
  const blocks=text.replace(/\r\n[ \t]/g,"").split(/BEGIN:VCARD/i).slice(1);const contacts:ContactRecord[]=[];
  for(const block of blocks){const name=/^FN(?:;[^:]*)?:(.+)$/im.exec(block)?.[1]?.trim()??""; const phone=/^TEL(?:;[^:]*)?:(.+)$/im.exec(block)?.[1]?.trim()??"";if(!name&&!phone)continue;
    contacts.push({id:phone.replace(/[^\d+]/g,"")||name.toLocaleLowerCase(),name:name||phone,phone,categories:["sin_clasificar"],messageCount:0,confidence:"pendiente"});}
  return contacts;
}
export function aggregateContacts(messages: ImportedMessage[], contacts: ContactRecord[]=[]): ContactRecord[] {
  const map=new Map<string,ContactRecord>();
  for(const c of contacts) map.set(c.id,{...c});
  for(const m of messages){const key=m.contact.toLocaleLowerCase();let c=[...map.values()].find(x=>x.name.toLocaleLowerCase()===key||x.phone===m.contact);
    if(!c){c={id:key,name:m.contact,phone:"",categories:["sin_clasificar"],messageCount:0,confidence:"pendiente"};map.set(key,c);}
    c.messageCount++;if(m.timestamp&&(!c.lastMessage||m.timestamp>c.lastMessage))c.lastMessage=m.timestamp;
  }return [...map.values()].sort((a,b)=>b.messageCount-a.messageCount);
}
export function categoryCounts(contacts:ContactRecord[]): Record<ContactCategory,number> {
  const counts={paciente:0,familia:0,amistad:0,colega:0,negocio:0,ocasional:0,sin_clasificar:0};
  for(const c of contacts) for(const tag of new Set(c.categories))counts[tag]++;
  return counts;
}
