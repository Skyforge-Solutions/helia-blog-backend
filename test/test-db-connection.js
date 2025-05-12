// Test script to verify database connections
require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
    console.log('Testing database connection...');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5, // Use small pool for test
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000
    });

    try {
        // Test basic query
        const result = await pool.query('SELECT NOW() as time');
        console.log(`✅ Database connection successful! Time: ${result.rows[0].time}`);

        // Test admin table
        console.log('\nTesting admin table structure...');
        const adminFields = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'admins'
    `);

        if (adminFields.rows.length > 0) {
            console.log('✅ Admin table exists with fields:');
            adminFields.rows.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type}`);
            });
        } else {
            console.log('❌ Admin table not found or empty!');
        }

        // Check if there are admin users
        const adminCount = await pool.query('SELECT COUNT(*) FROM admins');
        console.log(`\nFound ${adminCount.rows[0].count} admin user(s).`);

        if (parseInt(adminCount.rows[0].count) > 0) {
            console.log('✅ Admin users exist in the database.');
        } else {
            console.log('⚠️ No admin users found! You may need to create one.');
        }

    } catch (error) {
        console.error('❌ Database connection test failed:', error);
    } finally {
        await pool.end();
        console.log('\nConnection pool closed.');
    }
}

testConnection();