import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

const CONTRACT_ID = process.env.VITE_CONTRACT_ID

async function seed() {
  console.log('Seeding contract:', CONTRACT_ID)

  // Read jobs JSON
  const jobsPath = resolve(__dirname, '..', 'highfield_jobs.json')
  let rawJobs
  try {
    rawJobs = JSON.parse(readFileSync(jobsPath, 'utf-8'))
  } catch (e) {
    console.error('Could not read highfield_jobs.json from project root')
    console.error(e.message)
    process.exit(1)
  }

  console.log(`Found ${rawJobs.length} jobs in JSON`)

  // Delete existing jobs for this contract
  console.log('Deleting existing jobs...')
  const { error: delErr } = await supabase
    .from('jobs')
    .delete()
    .eq('contract_id', CONTRACT_ID)
  if (delErr) console.error('Delete error:', delErr.message)

  // Insert jobs in batches of 100
  const jobs = rawJobs.map(j => ({ ...j, contract_id: CONTRACT_ID }))
  for (let i = 0; i < jobs.length; i += 100) {
    const batch = jobs.slice(i, i + 100)
    const { error } = await supabase.from('jobs').insert(batch)
    if (error) {
      console.error(`Insert error at batch ${i}:`, error.message)
    } else {
      console.log(`Inserted ${i + batch.length}/${jobs.length}`)
    }
  }

  // Insert default crews (upsert-style: delete then insert)
  const defaultCrews = ['Jade', 'Taine', 'Ben', 'James']
  console.log('Setting up default crews:', defaultCrews.join(', '))

  const { error: delCrewErr } = await supabase
    .from('crews')
    .delete()
    .eq('contract_id', CONTRACT_ID)
  if (delCrewErr) console.error('Delete crews error:', delCrewErr.message)

  const { error: crewErr } = await supabase
    .from('crews')
    .insert(defaultCrews.map(name => ({ contract_id: CONTRACT_ID, name })))
  if (crewErr) console.error('Insert crews error:', crewErr.message)

  console.log('Done!')
}

seed().catch(console.error)
