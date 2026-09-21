export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Nur POST erlaubt'});
 try{
  const raw=String(req.body?.url||'').trim(),u=new URL(raw);
  if(u.protocol!=='https:'||!/(^|\.)rewe\.de$/i.test(u.hostname))return res.status(400).json({error:'Bitte einen gültigen REWE-Link eingeben.'});
  const article=(u.pathname.match(/\/(\d+)\/?$/)||[])[1]||'';
  const slug=(u.pathname.match(/\/p\/([^/]+)/)||[])[1]||'';
  const fromSlug=decodeURIComponent(slug).replace(/-/g,' ').replace(/\b(\d+(?:[.,]\d+)?)(kg|g|ml|l)\b/i,'$1 $2').replace(/\b\w/g,x=>x.toUpperCase());
  const attempts=[
   {headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153 Safari/537.36','accept':'text/html,application/xhtml+xml','accept-language':'de-DE,de;q=0.9,en;q=0.7','cache-control':'no-cache'}},
   {headers:{'user-agent':'Googlebot/2.1 (+http://www.google.com/bot.html)','accept':'text/html','accept-language':'de'}}
  ];
  let html='',last='';
  for(const opt of attempts){try{const r=await fetch(u.toString(),{...opt,redirect:'follow'});last=String(r.status);if(r.ok){html=await r.text();if(html.length>1000)break}}catch(e){last=e.message}}
  if(!html)return res.status(200).json({name:fromSlug,pack:packFrom(fromSlug).pack,unit:packFrom(fromSlug).unit,articleNumber:article,sourceUrl:u.toString(),partial:true,warning:'REWE blockiert derzeit Detaildaten. Name und Packungsgröße wurden aus dem Link übernommen; bitte fehlende Werte manuell ergänzen.'});
  const decode=s=>s.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(?:x27|39);/g,"'").replace(/\s+/g,' ').trim();
  const txt=decode(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' '));
  const title=decode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||fromSlug).replace(/ bei REWE.*$/i,'');
  const pm=packFrom(title); const num=s=>s?parseFloat(s.replace(',','.')):null;
  const grab=(label)=>{const m=txt.match(new RegExp(label+'\\s*(?:\\||:)?\\s*(?:<\\s*)?([0-9]+(?:[.,][0-9]+)?)\\s*g','i'));return m?num(m[1]):null};
  const kcalM=txt.match(/Energie\s*(?:\||:)?\s*([0-9.]+)\s*kcal/i);
  const brand=(txt.match(/(?:###\s*)?Marke:\s*([^]{1,80}?)(?=\s(?:Konkreter Preis|Produktbeschreibung|Kontaktname|Kontaktadresse|$))/i)||[])[1]?.trim()||'';
  return res.status(200).json({name:title,brand,pack:pm.pack,unit:pm.unit,articleNumber:(txt.match(/Artikelnummer\s*([0-9]+)/i)||[])[1]||article,sourceUrl:u.toString(),nutrition:{kcal:kcalM?num(kcalM[1].replace(/\./g,'')):null,fat:grab('Fett(?!,|\\s*davon)'),satfat:grab('Fett, davon gesättigte Fettsäuren'),carbs:grab('Kohlenhydrate(?!,|\\s*davon)'),sugar:grab('Kohlenhydrate, davon Zucker'),fiber:grab('Ballaststoffe'),protein:grab('Eiweiß'),salt:grab('Salz')}});
 }catch(e){return res.status(400).json({error:'Der REWE-Link konnte nicht verarbeitet werden.',detail:String(e.message||e)});}
}
function packFrom(s){const m=String(s).match(/([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|ml|l|Stück)\b/i);let pack=m?parseFloat(m[1].replace(',','.')):null,unit=m?m[2]:'g';if(unit.toLowerCase()==='kg'){pack*=1000;unit='g'}if(unit.toLowerCase()==='l'){pack*=1000;unit='ml'}return{pack,unit}}
