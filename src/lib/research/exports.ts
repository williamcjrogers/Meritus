export function csvCell(value:unknown):string { const raw=value===null||value===undefined?'':String(value);const safe=/^[\s]*[=+@-]/.test(raw)||/^[\t\r\n]/.test(raw)?"'"+raw:raw;return '"'+safe.replaceAll('"','""')+'"'; }
export function escapeHtml(value:unknown):string{return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export function safeLink(value:string):string{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'#';}catch{return '#';}}
