import 'dotenv/config'; import fs from 'node:fs/promises'; import pg from 'pg';
if(!process.env.DATABASE_URL){console.log('DATABASE_URL is not configured; migration skipped.');process.exit(0)}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false});
await pool.query(await fs.readFile(new URL('./schema.sql',import.meta.url),'utf8')); await pool.end(); console.log('Database migrated.');
