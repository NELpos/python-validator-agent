const { Pool } = require('pg')

async function fixVectorDimensions() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  })

  try {
    console.log('Checking current vector dimensions...')

    // Check current dimensions
    const result = await pool.query(`
      SELECT
        table_name,
        column_name,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_name IN ('knowledge_documents', 'code_examples')
      AND column_name = 'embedding'
    `)

    console.log('Current embedding columns:', result.rows)

    // If the tables exist and have wrong dimensions, alter them
    if (result.rows.length > 0) {
      console.log('Altering vector dimensions to 1024...')

      await pool.query('ALTER TABLE knowledge_documents ALTER COLUMN embedding SET DATA TYPE vector(1024)')
      await pool.query('ALTER TABLE code_examples ALTER COLUMN embedding SET DATA TYPE vector(1024)')

      console.log('✅ Successfully updated vector dimensions to 1024')
    } else {
      console.log('No existing embedding columns found')
    }

  } catch (error) {
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('Tables do not exist yet, this is normal for a fresh setup')
    } else {
      console.error('Error:', error.message)

      // If it's a dimension error, it means the columns exist but have wrong dimensions
      if (error.message.includes('expected') && error.message.includes('dimensions')) {
        console.log('Dimension mismatch detected, attempting to fix...')
        try {
          await pool.query('ALTER TABLE knowledge_documents ALTER COLUMN embedding SET DATA TYPE vector(1024)')
          await pool.query('ALTER TABLE code_examples ALTER COLUMN embedding SET DATA TYPE vector(1024)')
          console.log('✅ Fixed vector dimensions')
        } catch (alterError) {
          console.error('Failed to alter dimensions:', alterError.message)
        }
      }
    }
  } finally {
    await pool.end()
  }
}

fixVectorDimensions()