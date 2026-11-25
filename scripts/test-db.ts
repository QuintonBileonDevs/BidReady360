import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db/client.js';

async function test() {
  try {
    console.log('Testing DB connection...');
    console.log('Database URL:', process.env.DATABASE_URL ? 'Defined' : 'Undefined');
    const res = await query('SELECT NOW()');
    console.log('Successfully connected to DB:', res.rows[0].now);
  } catch (err: any) {
    console.error('Failed to connect to DB:', err.message);
  } finally {
    process.exit(0);
  }
}

test();
