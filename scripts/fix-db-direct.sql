-- Fix vector dimensions in database
-- This script changes embedding columns from 1536 to 1024 dimensions

-- Drop indexes first (they depend on the column)
DROP INDEX IF EXISTS knowledge_documents_embedding_idx;
DROP INDEX IF EXISTS code_examples_embedding_idx;

-- Alter the column types
ALTER TABLE knowledge_documents ALTER COLUMN embedding SET DATA TYPE vector(1024);
ALTER TABLE code_examples ALTER COLUMN embedding SET DATA TYPE vector(1024);

-- Recreate the indexes
CREATE INDEX knowledge_documents_embedding_idx ON knowledge_documents USING hnsw (embedding vector_cosine_ops);
CREATE INDEX code_examples_embedding_idx ON code_examples USING hnsw (embedding vector_cosine_ops);