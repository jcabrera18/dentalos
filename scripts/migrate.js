// scripts/migrate.js
// Runs SQL migrations in order against Supabase
// Usage:
//   node scripts/migrate.js          → runs pending migrations
//   node scripts/migrate.js --reset  → drops and recreates everything (DEV ONLY)

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dir = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dir, '..', 'supabase', 'migrations')

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }  // Supabase requires SSL
})

async function main() {
  const isReset = process.argv.includes('--reset')

  await client.connect()
  console.log('✅ Connected to database')

  if (isReset) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ --reset is not allowed in production')
      process.exit(1)
    }
    console.log('⚠️  Resetting database...')
    await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `)
    console.log('✅ Schema reset')
  }

  // Create migrations tracking table
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         SERIAL PRIMARY KEY,
      filename   TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // Get already-applied migrations
  const { rows: applied } = await client.query(
    'SELECT filename FROM _migrations ORDER BY id'
  )
  const appliedSet = new Set(applied.map(r => r.filename))

  // Read migration files sorted alphabetically
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()

  let ran = 0
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`⏭  Skipping ${file} (already applied)`)
      continue
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    console.log(`🔄 Running ${file}...`)

    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        'INSERT INTO _migrations (filename) VALUES ($1)',
        [file]
      )
      await client.query('COMMIT')
      console.log(`✅ ${file} applied`)
      ran++
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`❌ Failed on ${file}:`, err.message)
      process.exit(1)
    }
  }

  if (ran === 0) {
    console.log('✨ All migrations already applied — nothing to do')
  } else {
    console.log(`\n🎉 Applied ${ran} migration(s) successfully`)
  }

  await client.end()
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
