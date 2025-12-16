'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { Record } from '@/types'

interface RecordDetailPageProps {
  params: Promise<{ id: string }>
}

export default function RecordDetailPage({ params }: RecordDetailPageProps) {
  const router = useRouter()
  const [record, setRecord] = useState<Record | null>(null)
  const [loading, setLoading] = useState(true)
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
      loadRecord()
    }
  }, [recordId])

  const loadRecord = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('id', recordId)
        .single()

      if (error) throw error

      setRecord(data)
    } catch (error) {
      console.error('기록 조회 실패:', error)
      alert('기록을 불러오는데 실패했습니다.')
      router.push('/home')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠어요?\n이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('삭제에 실패했습니다')
      }

      alert('삭제되었습니다.')
      router.push('/home')
    } catch (error) {
      console.error('삭제 실패:', error)
      alert('삭제에 실패했습니다. 다시 시도해주세요.')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const weekday = weekdays[date.getDay()]
    return `${year}년 ${month}월 ${day}일 (${weekday})`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!record) {
    return null
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white p-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/home')}
            className="text-gray-500 p-1"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h1 className="text-lg font-bold text-gray-800">기록 상세</h1>
        </div>
        <button
          onClick={handleDelete}
          className="text-red-500 hover:text-red-700 text-sm px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
        >
          <i className="fas fa-trash mr-1"></i> 삭제
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* 날짜 */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <i className="far fa-calendar"></i>
          <span>{formatDate(record.date)}</span>
          {record.project_id && (
            <span className="ml-auto text-xs bg-primary-100 text-primary-700 px-3 py-1 rounded-full">
              카드 생성됨
            </span>
          )}
        </div>

        {/* 업무 항목들 */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <i className="fas fa-list text-primary-500"></i>
            오늘의 업무 ({record.contents.length}개)
          </h3>
          {record.contents.map((item, index) => (
            <Card key={index} className="bg-white">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                <p className="flex-1 text-sm text-gray-700 leading-relaxed pt-0.5">
                  {item}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* 키워드 (있는 경우) */}
        {record.keywords && record.keywords.length > 0 && (
          <Card className="bg-blue-50 border-blue-100">
            <h3 className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
              <i className="fas fa-tag"></i>
              키워드
            </h3>
            <div className="flex flex-wrap gap-2">
              {record.keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                >
                  #{keyword}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* V1.0 기능 안내 (향후 추가 예정) */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div className="flex-1 text-sm">
              <p className="font-bold text-amber-900 mb-1">곧 출시!</p>
              <p className="text-amber-700 text-xs">
                원하는 업무 항목만 체크해서 커스텀 카드를 만들 수 있는 기능이 곧 추가됩니다.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
