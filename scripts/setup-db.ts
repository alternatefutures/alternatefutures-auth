/**
 * Database setup script
 * Initializes the SQLite database with required tables
 */

import { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_URL || './dev.db';
const schemaPath = join(__dirname, '../db/schema.sql');

console.log('🗄️  Setting up database...');
console.log(`Database: ${dbPath}`);

try {
  // Create database connection
  const db = new Database(dbPath);

  // Read schema file
  const schema = readFileSync(schemaPath, 'utf-8');

  // Split schema into individual statements
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Execute each statement
  for (const statement of statements) {
    db.exec(statement + ';');
  }

  db.close();

  console.log('✅ Database setup complete!');
  console.log('');
  console.log('Tables created:');
  console.log('  - users');
  console.log('  - auth_methods');
  console.log('  - sessions');
  console.log('  - verification_codes');
  console.log('  - siwe_challenges');
  console.log('  - mfa_settings');
  console.log('  - rate_limits');
  console.log('');
  console.log('You can now start the server with: npm run dev');
} catch (error) {
  console.error('❌ Database setup failed:', error);
  process.exit(1);
}
