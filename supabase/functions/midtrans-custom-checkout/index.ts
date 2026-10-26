import {handler as checkout} from '../midtrans-create-token/index.ts';
import {sandboxKey} from '../midtrans-create-token/core.ts';
export async function handler(req:Request):Promise<Response> {
  if(req.method==='GET')return Response.json({environment:'sandbox',configured:!!await sandboxKey()},{headers:{'Cache-Control':'no-store'}});
  return checkout(req);
}
if(import.meta.main)Deno.serve(handler);
