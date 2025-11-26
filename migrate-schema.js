#!/usr/bin/env node

/**
 * Database Schema Migration Script
 * 
 * This script runs the schema.sql file against your Neon PostgreSQL database.
 * 
 * Usage: node migrate-schema.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrate() {
  console.log('🚀 Starting database migration...\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL not found in environment variables');
    console.log('   Please create a .env file with DATABASE_URL=your_neon_url');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Read schema file
    const schemaPath = path.join(__dirname, 'src', 'db', 'schema.sql');
    console.log(`📄 Reading schema from: ${schemaPath}`);
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Execute schema
    console.log('🔨 Executing schema...');
    await client.query(schema);
    console.log('✅ Schema executed successfully\n');

    console.log('🎉 Migration completed!\n');
    console.log('Next steps:');
    console.log('  1. Run: npm run seed (optional - adds sample data)');
    console.log('  2. Run: npm run dev (start the backend server)\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();

