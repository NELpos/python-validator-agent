const { Client } = require('pg')

async function fixDimensions() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  })

  try {
    await client.connect()
    console.log('Connected to database')

    console.log('Attempting to fix vector dimensions...')

    // Try to fix the dimensions directly
    await client.query('ALTER TABLE knowledge_documents ALTER COLUMN embedding SET DATA TYPE vector(1024)')
    console.log('✅ Fixed knowledge_documents.embedding to 1024 dimensions')

    await client.query('ALTER TABLE code_examples ALTER COLUMN embedding SET DATA TYPE vector(1024)')
    console.log('✅ Fixed code_examples.embedding to 1024 dimensions')

    console.log('✅ Successfully updated all vector dimensions to 1024')

  } catch (error) {
    console.error('Error:', error.message)

    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('Tables do not exist yet - run the initial migration first')
    }
  } finally {
    await client.end()
  }
}

fixDimensions()