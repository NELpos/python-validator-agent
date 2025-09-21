import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { knowledgeDocuments } from "@/lib/db/schema"
import { DocumentProcessor } from "@/lib/knowledge/document-processor"
import { desc, eq, ilike, or } from "drizzle-orm"

// 문서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = db.select({
      id: knowledgeDocuments.id,
      title: knowledgeDocuments.title,
      content: knowledgeDocuments.content,
      section: knowledgeDocuments.section,
      documentType: knowledgeDocuments.documentType,
      metadata: knowledgeDocuments.metadata,
      createdAt: knowledgeDocuments.createdAt
    }).from(knowledgeDocuments)

    // 검색 조건 추가
    if (search) {
      query = query.where(
        or(
          ilike(knowledgeDocuments.title, `%${search}%`),
          ilike(knowledgeDocuments.content, `%${search}%`),
          ilike(knowledgeDocuments.section, `%${search}%`)
        )
      )
    }

    // 타입 필터
    if (type && type !== 'all') {
      query = query.where(eq(knowledgeDocuments.documentType, type as any))
    }

    // 정렬 및 페이징
    const documents = await query
      .orderBy(desc(knowledgeDocuments.createdAt))
      .limit(limit)
      .offset(offset)

    return NextResponse.json(documents)
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: '문서 목록 조회 실패' },
      { status: 500 }
    )
  }
}

// 새 문서 추가
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { title, content, section, documentType, metadata } = data

    // 입력 검증
    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용은 필수입니다' },
        { status: 400 }
      )
    }

    // DocumentProcessor를 사용하여 문서 처리 및 저장
    const documentProcessor = new DocumentProcessor()

    // 문서 청크 생성
    const documentChunk = {
      title,
      content,
      section,
      documentType: documentType || 'rule',
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        wordCount: content.trim().split(/\s+/).length
      }
    }

    // 임베딩 생성 및 저장
    const [documentId] = await documentProcessor.storeDocuments([documentChunk])

    // 저장된 문서 조회 (embedding 제외)
    const [savedDocument] = await db
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
      .where(eq(knowledgeDocuments.id, documentId))

    return NextResponse.json(savedDocument, { status: 201 })
  } catch (error) {
    console.error('Error creating document:', error)
    return NextResponse.json(
      { error: '문서 생성 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류') },
      { status: 500 }
    )
  }
}