import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { knowledgeDocuments } from "@/lib/db/schema"
import { DocumentProcessor } from "@/lib/knowledge/document-processor"
import { eq } from "drizzle-orm"

// 특정 문서 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [document] = await db
      .select({
        id: knowledgeDocuments.id,
        title: knowledgeDocuments.title,
        content: knowledgeDocuments.content,
        section: knowledgeDocuments.section,
        documentType: knowledgeDocuments.documentType,
        metadata: knowledgeDocuments.metadata,
        createdAt: knowledgeDocuments.createdAt
      })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, id))

    if (!document) {
      return NextResponse.json(
        { error: '문서를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json(
      { error: '문서 조회 실패' },
      { status: 500 }
    )
  }
}

// 문서 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await request.json()
    const { title, content, section, documentType, metadata } = data

    // 입력 검증
    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용은 필수입니다' },
        { status: 400 }
      )
    }

    // 기존 문서 확인
    const [existingDocument] = await db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, id))

    if (!existingDocument) {
      return NextResponse.json(
        { error: '문서를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 임베딩 재생성이 필요한지 확인 (내용이 변경된 경우)
    const needsEmbeddingUpdate = existingDocument.content !== content

    let embedding = existingDocument.embedding

    if (needsEmbeddingUpdate) {
      const documentProcessor = new DocumentProcessor()

      // 새로운 임베딩 생성
      const processedContent = documentProcessor['embeddingClient'].preprocessText(content)
      const newEmbedding = await documentProcessor['embeddingClient'].generateEmbedding(processedContent)
      embedding = newEmbedding
    }

    // 문서 업데이트
    const [updatedDocument] = await db
      .update(knowledgeDocuments)
      .set({
        title,
        content,
        section,
        documentType: documentType || 'rule',
        embedding,
        metadata: {
          ...existingDocument.metadata,
          ...metadata,
          lastModified: new Date().toISOString(),
          wordCount: content.trim().split(/\s+/).length
        }
      })
      .where(eq(knowledgeDocuments.id, id))
      .returning({
        id: knowledgeDocuments.id,
        title: knowledgeDocuments.title,
        content: knowledgeDocuments.content,
        section: knowledgeDocuments.section,
        documentType: knowledgeDocuments.documentType,
        metadata: knowledgeDocuments.metadata,
        createdAt: knowledgeDocuments.createdAt
      })

    return NextResponse.json(updatedDocument)
  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json(
      { error: '문서 수정 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류') },
      { status: 500 }
    )
  }
}

// 문서 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // 문서 존재 확인
    const [existingDocument] = await db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, id))

    if (!existingDocument) {
      return NextResponse.json(
        { error: '문서를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 문서 삭제
    await db
      .delete(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, id))

    return NextResponse.json(
      { message: '문서가 성공적으로 삭제되었습니다' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json(
      { error: '문서 삭제 실패' },
      { status: 500 }
    )
  }
}