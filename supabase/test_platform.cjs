const {readFileSync}=require('node:fs');
const {join}=require('node:path');
async function main(){
 const {PGlite}=await import(process.env.JT_PGLITE_MODULE || '@electric-sql/pglite');
 const db=new PGlite();
 try {
  await db.exec(readFileSync(join(__dirname,'test_platform_base.sql'),'utf8'));
  await db.exec(readFileSync(join(__dirname,'access.sql'),'utf8'));
  await db.exec(readFileSync(join(__dirname,'migrations','20261010003143_pro_platform.sql'),'utf8'));
  await db.exec(readFileSync(join(__dirname,'migrations','20261010115426_kaystrade_intelligence.sql'),'utf8'));
  await db.exec(readFileSync(join(__dirname,'test_platform.sql'),'utf8'));
  await db.exec(readFileSync(join(__dirname,'test_intelligence.sql'),'utf8'));
  console.log('PostgreSQL migration, RLS, shared quota, expiry, webhook and import checks passed.');
 } finally {await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
