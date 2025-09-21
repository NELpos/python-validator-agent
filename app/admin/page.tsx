"use client"

import React, { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DocumentManager } from "@/components/admin/document-manager"
import { ExampleManager } from "@/components/admin/example-manager"
import { RAGStats } from "@/components/admin/rag-stats"
import { Button } from "@/components/ui/button"
import { FileText, Code, BarChart3, Database } from "lucide-react"

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("documents")

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">RAG 시스템 관리</h1>
              <p className="mt-1 text-sm text-gray-500">
                마크다운 문서와 Python 코드 예제를 관리하여 RAG 시스템을 향상시키세요
              </p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" asChild>
                <a href="/validator" className="flex items-center space-x-2">
                  <Code className="h-4 w-4" />
                  <span>검증 페이지로</span>
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="documents" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>문서 관리</span>
            </TabsTrigger>
            <TabsTrigger value="examples" className="flex items-center space-x-2">
              <Code className="h-4 w-4" />
              <span>코드 예제</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>통계</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Panther 규칙 문서 관리</span>
                </CardTitle>
                <CardDescription>
                  마크다운 형식의 Panther 탐지 규칙 문서를 추가, 수정, 삭제할 수 있습니다.
                  문서는 자동으로 임베딩 처리되어 RAG 검색에 활용됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="examples" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Code className="h-5 w-5" />
                  <span>Python 코드 예제 관리</span>
                </CardTitle>
                <CardDescription>
                  고품질의 Python 탐지 규칙 예제를 관리합니다.
                  품질 점수와 카테고리를 설정하여 Few-shot 학습에 활용됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExampleManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="h-5 w-5" />
                  <span>RAG 시스템 통계</span>
                </CardTitle>
                <CardDescription>
                  현재 저장된 문서와 예제의 통계 정보 및 RAG 시스템 상태를 확인할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RAGStats />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}