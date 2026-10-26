import { describe, it, expect } from "vitest";
import { parseDelimited,importConversationCSV,importContactsVCard,aggregateContacts,categoryCounts } from "./contact-import";
describe("contact import",()=>{
 it("handles quoted fields, separators and multiline messages",()=>{
  const rows=parseDelimited('chat;message\n"Ana";"hola; mundo"\n"Pedro";"línea 1\nlínea 2"');
  expect(rows).toHaveLength(3);expect(rows[1]?.[1]).toBe("hola; mundo");expect(rows[2]?.[1]).toContain("\n");
 });
 it("accepts flexible CSV column labels",()=>{
  const messages=importConversationCSV("Chat,Fecha,Remitente,Mensaje\nAna,2026-10-25,Ana,Hola\nAna,2026-10-26,Yo,Gracias");
  expect(messages).toHaveLength(2);expect(messages[0]?.contact).toBe("Ana");
 });
 it("imports vCards and keeps manual patient classifications",()=>{
  const cards=importContactsVCard("BEGIN:VCARD\nVERSION:3.0\nFN:Ana\nTEL;TYPE=CELL:+54 9 11 1234-5678\nEND:VCARD");
  expect(cards).toHaveLength(1);
  const tagged={...cards[0]!,categories:["paciente" as const],confidence:"manual" as const};
  const merged=aggregateContacts([{contact:"Ana",timestamp:"",sender:"Ana",text:"Hola"}],[tagged]);
  expect(categoryCounts(merged).paciente).toBe(1);expect(merged[0]?.messageCount).toBe(1);
 });
 it("does not automatically infer patients from message text",()=>{
  const c=aggregateContacts([{contact:"Persona",sender:"Persona",timestamp:"",text:"Necesito turno"}]);
  expect(categoryCounts(c).paciente).toBe(0);
 });
});
