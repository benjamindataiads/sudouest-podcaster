import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const client = postgres(process.env.DATABASE_URL, { 
  max: 1,  // Une seule connexion partagée (évite "too many clients")
  idle_timeout: 20,
  max_lifetime: 60 * 30,
})

export const db = drizzle(client, { schema })

export * from './schema'

