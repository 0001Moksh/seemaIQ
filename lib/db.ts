import { MongoClient, type Db } from "mongodb"

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb }
  }

  const mongoUri = process.env.MONGODB_URL
  if (!mongoUri) {
    throw new Error("MONGODB_URL environment variable is not set")
  }

  const client = new MongoClient(mongoUri)
  await client.connect()

  const db = client.db("seeamiq")

  // Create indexes
  await db.collection("users").createIndex({ email: 1 }, { unique: true })
  await db.collection("interviews").createIndex({ userId: 1, createdAt: -1 })
  // TTL indexes must be single-field. Create TTL on `expiresAt` and a
  // separate index on `userId` for lookup performance.
  await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection("sessions").createIndex({ userId: 1 })

  cachedClient = client
  cachedDb = db

  return { client, db }
}

export async function getDatabase() {
  const { db } = await connectToDatabase()
  return db
}
