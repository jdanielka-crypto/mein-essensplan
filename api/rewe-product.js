export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Nur POST erlaubt'});
  try{
    const raw=String(req.body?.url||'').trim();
    const u=new URL(raw);
    if(u.protocol!=='https:' || !/(^|\.)rewe\.de$/i.test(u.hostname)) return res.status(400).json({error:'Bitte einen gültigen REWE-Link eingeben.'});
    const r=await fetch(u.toString(),{headers:{'user-agent':'Mozilla/5.0 (compatible; MeinEssensplan/1.0)','accept-language':'de-DE,de;q=0.9'}});
    if(!r.ok) throw new Error('REWE-Seite antwortet mit '+r.status);
    const html=await r.text();
    const txt=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&#x27;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
    const title=(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().replace(/ bei REWE.*$/i,'');
    const art=(txt.match(/Artikelnummer\s*([0-9]+)/i)||[])[1]||'';
    const brand=(txt.match(/Marke:\s*([^#]{1,80}?)(?=\s(?:Konkreter Preis|Produktbildhinweis|Eigenschaften:|Kontaktname:|$))/i)||[])[1]?.trim()||'';
    const packMatch=title.match(/([0-9]+(?:[.,][0-9]+)?)\s*(kg|g|ml|l|Stück)\b/i);
    let pack=packMatch?parseFloat(packMatch[1].replace(',','.')):null, unit=packMatch?packMatch[2]:'g';
    if(unit?.toLowerCase()==='kg'){pack*=1000;unit='g'} if(unit?.toLowerCase()==='l'){pack*=1000;unit='ml'}
    const val=(label)=>{const re=new RegExp(label+'\\s*(?:\\||:)?\\s*(?:<\\s*)?([0-9]+(?:[.,][0-9]+)?)\\s*g','i');const m=txt.match(re);return m?parseFloat(m[1].replace(',','.')):null};
    const kcal=(()=>{const m=txt.match(/Energie\s*(?:\||:)?\s*([0-9.]+)\s*kcal/i);return m?parseFloat(m[1].replace(/\./g,'')):null})();
    const fat=val('Fett(?!,|\\s*davon)');
    const satfat=val('Fett, davon gesättigte Fettsäuren');
    const carbs=val('Kohlenhydrate(?!,|\\s*davon)');
    const sugar=val('Kohlenhydrate, davon Zucker');
    const fiber=val('Ballaststoffe');
    const protein=val('Eiweiß');
    const salt=val('Salz');
    return res.status(200).json({name:title,brand,pack,unit,articleNumber:art,sourceUrl:u.toString(),nutrition:{kcal,fat,satfat,carbs,sugar,fiber,protein,salt}});
  }catch(e){return res.status(500).json({error:'Produktdaten konnten nicht automatisch gelesen werden.',detail:String(e.message||e)});}
}