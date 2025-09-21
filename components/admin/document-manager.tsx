"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { DocumentEditor } from "./document-editor"
import { DocumentList } from "./document-list"
import { Plus, FileText, Eye, Edit, Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Document {
  id: string
  title: string
  content: string
  section?: string
  documentType: 'rule' | 'best-practice' | 'example'
  metadata?: any
  createdAt: string
}

export function DocumentManager() {
  const [activeView, setActiveView] = useState<'list' | 'create' | 'edit'>('list')
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 문서 목록 로드
  const loadDocuments = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/documents')
      if (!response.ok) throw new Error('문서 목록을 불러오는데 실패했습니다')
      const data = await response.json()
      setDocuments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '문서 목록 로드 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 문서 저장
  const handleSaveDocument = async (documentData: {
    title: string
    content: string
    section?: string
    documentType: 'rule' | 'best-practice' | 'example'
    metadata?: any
  }) => {
    setIsLoading(true)
    setError(null)

    try {
      const url = selectedDocument
        ? `/api/admin/documents/${selectedDocument.id}`
        : '/api/admin/documents'
      const method = selectedDocument ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentData)
      })

      if (!response.ok) throw new Error('문서 저장에 실패했습니다')

      const savedDocument = await response.json()

      if (selectedDocument) {
        setDocuments(docs => docs.map(doc =>
          doc.id === savedDocument.id ? savedDocument : doc
        ))
        setSuccess('문서가 성공적으로 수정되었습니다')
      } else {
        setDocuments(docs => [...docs, savedDocument])
        setSuccess('새 문서가 성공적으로 추가되었습니다')
      }

      setActiveView('list')
      setSelectedDocument(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '문서 저장 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 문서 삭제
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('정말로 이 문서를 삭제하시겠습니까?')) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/documents/${documentId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('문서 삭제에 실패했습니다')

      setDocuments(docs => docs.filter(doc => doc.id !== documentId))
      setSuccess('문서가 성공적으로 삭제되었습니다')
    } catch (err) {
      setError(err instanceof Error ? err.message : '문서 삭제 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 문서 편집
  const handleEditDocument = (document: Document) => {
    setSelectedDocument(document)
    setActiveView('edit')
  }

  // 새 문서 생성
  const handleCreateNew = () => {
    setSelectedDocument(null)
    setActiveView('create')
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  // 알림 자동 제거
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [success, error])

  return (
    <div className="space-y-6">
      {/* 알림 메시지 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )}

      {/* 상단 액션 바 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {activeView !== 'list' && (
            <Button
              variant="outline"
              onClick={() => {
                setActiveView('list')
                setSelectedDocument(null)
              }}
            >
              ← 목록으로
            </Button>
          )}

          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              총 {documents.length}개 문서
            </span>
          </div>
        </div>

        {activeView === 'list' && (
          <Button onClick={handleCreateNew} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>새 문서 추가</span>
          </Button>
        )}
      </div>

      {/* 메인 컨텐츠 */}
      {activeView === 'list' && (
        <DocumentList
          documents={documents}
          isLoading={isLoading}
          onEdit={handleEditDocument}
          onDelete={handleDeleteDocument}
          onRefresh={loadDocuments}
        />
      )}

      {(activeView === 'create' || activeView === 'edit') && (
        <DocumentEditor
          document={selectedDocument}
          onSave={handleSaveDocument}
          onCancel={() => {
            setActiveView('list')
            setSelectedDocument(null)
          }}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}