const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_gbhV9DuMyCm8@ep-misty-rice-acbl3x03-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=verify-full',
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = pool;
    