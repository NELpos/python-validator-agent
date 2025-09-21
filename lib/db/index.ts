import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// Connection pool 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // 프로덕션 환경에서는 더 많은 설정 필요
  max: 20, // 최대 연결 수
  idleTimeoutMillis: 30000, // 유휴 연결 타임아웃
  connectionTimeoutMillis: 2000, // 연결 타임아웃
})

// Drizzle ORM 인스턴스 생성
export const db = drizzle(pool, { schema })

// 스키마 재내보내기
export { schema }

// DB 연결 테스트 함수
export async function testConnection() {
  try {
    const client = await pool.connect()
    const result = await client.query('SELECT NOW()')
    client.release()
    console.log('Database connected successfully:', result.rows[0])
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}

// Graceful shutdown을 위한 연결 종료 함수
export async function closeConnection() {
  await pool.end()
}