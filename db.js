const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_gbhV9DuMyCm8@ep-misty-rice-acbl3x03-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' || 'postgres://postgres:123@localhost:5432/analisai',
    ssl: 'postgresql://neondb_owner:npg_gbhV9DuMyCm8@ep-misty-rice-acbl3x03-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' ? { rejectUnauthorized: false } : false
});

module.exports = pool;