import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

let client: ReturnType<typeof postgres> | null = null
let dbInstance: ReturnType<typeof drizzle> | null = null

function getDb() {
  if (!dbInstance) {
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

    client = postgres(process.env.DATABASE_URL, { 
  max: 1,  // Une seule connexion partagée (évite "too many clients")
  idle_timeout: 20,
  max_lifetime: 60 * 30,
})

    dbInstance = drizzle(client, { schema })
  }
  
  return dbInstance
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get: (target, prop) => {
    const dbInstance = getDb()
    return dbInstance[prop as keyof typeof dbInstance]
  }
})

export * from './schema'

