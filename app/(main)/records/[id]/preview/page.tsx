'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { AIPreviewResponse } from '@/types'

interface PreviewPageProps {
  params: Promise<{ id: string }>
}

export default function PreviewPage({ params }: PreviewPageProps) {
  const router = useRouter()
  const [preview, setPreview] = useState<AIPreviewResponse | null>(null)
  const [recordId, setRecordId] = useState<string>('')

  useEffect(() => {
    const init = async () => {
      const resolvedParams = await params
      setRecordId(resolvedParams.id)
    }
    init()
  }, [params])

  useEffect(() => {
    if (recordId) {
      loadPreview()
    }
  }, [recordId])

  const loadPreview = () => {
    try {
      // localStorage에서 미리보기 데이터 가져오기
      const savedPreview = localStorage.getItem('lastPreview')
      if (savedPreview) {
        setPreview(JSON.parse(savedPreview))
        // 사용 후 삭제
        localStorage.removeItem('lastPreview')
      }
    } catch (error) {
      console.error('localStorage 접근 실패:', error)
      // localStorage 접근 불가 시 기본값 설정
      setPreview({
        title: '업무 기록',
        actions: ['기록이 저장되었습니다'],
        thinking: 'AI 분석을 준비 중입니다'
      })
    }
  }

  if (!preview) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">AI가 분석 중입니다...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl mx-auto space-y-6 py-8">
          {/* Success Icon */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <i className="fas fa-check text-green-500 text-3xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              ✅ 기록되었습니다!
            </h1>
            <p className="text-sm text-gray-600">
              💡 이 기록은 이렇게 쓸 수 있어요 👇
            </p>
          </div>

          {/* Preview Card */}
          <Card className="bg-white shadow-lg">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 text-2xl">🗂️</div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-800 mb-3">
                    {preview.title}
                  </h2>

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                        💼 내가 한 일
                      </h3>
                      <ul className="space-y-2">
                        {preview.actions.map((action, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-sm text-gray-700"
                          >
                            <span className="text-primary-500 mt-1">•</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                        🧠 사고 방식
                      </h3>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        "{preview.thinking}"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Info */}
          <Card className="bg-blue-50 border-blue-100">
            <div className="flex items-start gap-3">
              <div className="text-2xl">💬</div>
              <p className="text-sm text-blue-900 flex-1">
                기록 몇 개만 더 쌓이면
                <br />
                <strong>완성된 포트폴리오 카드</strong>를 만들어드릴게요!
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-gray-100 bg-white flex gap-3">
        <Button
          variant="secondary"
          onClick={() => router.push('/home')}
          className="flex-1"
        >
          홈으로
        </Button>
        <Button
          variant="primary"
          onClick={() => router.push('/write')}
          className="flex-[2]"
        >
          계속 기록하기
        </Button>
      </div>
    </div>
  )
}
