const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        // Read and execute the production schema
        const schemaSQL = fs.readFileSync(
            path.join(__dirname, 'production-schema.sql'),
            'utf8'
        );
        
        console.log('Applying database schema...');
        await pool.query(schemaSQL);
        console.log('Schema applied successfully');

        // Create initial admin user
        const hashedPassword = process.env.INITIAL_ADMIN_PASSWORD || 'changeme123'; // You should change this
        const createAdminSQL = `
            INSERT INTO users (username, password, email, role)
            VALUES ($1, $2, $3, 'admin')
            ON CONFLICT (username) DO NOTHING
            RETURNING id;
        `;
        
        await pool.query(createAdminSQL, [
            'admin',
            hashedPassword,
            process.env.ADMIN_EMAIL || 'admin@example.com'
        ]);
        
        console.log('Initial admin user created');
        
    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration().catch(console.error);
