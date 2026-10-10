import {PDFDocument, StandardFonts, rgb} from 'npm:pdf-lib@1.17.1';

export async function pdfBytes(preview: Record<string,any>): Promise<Uint8Array> {
  const document=await PDFDocument.create(), regular=await document.embedFont(StandardFonts.Helvetica), bold=await document.embedFont(StandardFonts.HelveticaBold);
  let page=document.addPage([595,842]), y=792;
  const line=(value: unknown,heading=false)=>{
    // ponytail: standard PDF fonts use Latin text; metric values and IDs remain exact.
    const text=String(value ?? 'Unavailable').replace(/[^\x20-\x7e]/g,'?'),font=heading?bold:regular,size=heading?14:10;
    let remaining=text;
    do {let end=remaining.length;while(end>1 && font.widthOfTextAtSize(remaining.slice(0,end),size)>495)end--;if(y<55){page=document.addPage([595,842]);y=792;}
      page.drawText(remaining.slice(0,end),{x:50,y,size,font,color:rgb(0,0,0)});y-=heading?24:16;remaining=remaining.slice(end);
    }while(remaining);
  };
  line('journalingtrade | Performance report',true);line(preview.period);line('');
  if(preview.analytics){line('Performance analytics',true);for(const [key,value] of Object.entries(preview.analytics.metrics))line(key.replaceAll('_',' ')+': '+String(value ?? 'Unavailable'));
    line('Currency: '+preview.analytics.currency);for(const [key,rows] of Object.entries(preview.analytics.groups)){line('By '+key,true);for(const row of rows as any[])line(row.label+' | Trades '+row.trade_count+' | Net PnL '+row.net_pnl+' | Win % '+row.win_rate);}
    for(const warning of preview.analytics.warnings || [])line(warning);
  }
  if(preview.heatmap){line('Daily trading activity',true);for(const row of preview.heatmap.days.filter((r:any)=>r.trade_count))line(row.date+' | Trades '+row.trade_count+' | Net PnL '+row.pnl);}
  if(preview.risk){line('Risk compliance',true);for(const [key,value] of Object.entries(preview.risk.overview))line(key.replaceAll('_',' ')+': '+String(value ?? 'Unknown'));
    for(const row of preview.risk.violations)line(row.date+' | '+row.kind+' | Observed '+row.observed+' | Limit '+row.threshold+' | Trade '+row.trade_id);
    for(const warning of preview.risk.warnings || [])line(warning);
  }
  if(preview.reviews){line('Saved reviews',true);for(const row of preview.reviews){line(row.period_start+' | '+row.period);for(const [key,value] of Object.entries(row.summary?.performance?.metrics || {}))line(key+': '+String(value ?? 'Unavailable'));}}
  line('');line('Recorded trading results only. No AI analysis allowance was consumed.');
  document.setTitle('journalingtrade Performance Report');document.setCreationDate(new Date());return document.save();
}
