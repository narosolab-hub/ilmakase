'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import type { Record, ProjectCard, AIAnalysis } from '@/types'

type TabType = 'records' | 'cards' | 'analyses' | 'calendar'

export default function HomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('records')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [records, setRecords] = useState<Record[]>([])
  const [cards, setCards] = useState<ProjectCard[]>([])
  const [analyses, setAnalyses] = useState<AIAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGeneratingCard, setIsGeneratingCard] = useState(false)
  const [userName, setUserName] = useState<string>('')
  const [unusedAnalysesCount, setUnusedAnalysesCount] = useState<number>(0)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  useEffect(() => {
    loadData()
    
    // URL 쿼리 파라미터에서 탭 정보 읽기
    const tab = searchParams.get('tab') as TabType
    if (tab && ['records', 'cards', 'analyses', 'calendar'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // 이메일 도메인에서 닉네임 추출
      const emailUsername = user.email?.split('@')[0] || '익명'
      setUserName(emailUsername)

      // 사용자 정보 (main_work는 유지)
      const { data: userData } = await supabase
        .from('users')
        .select('main_work')
        .eq('id', user.id)
        .single()

      // 기록 목록 (전체)
      const { data: recordsData } = await supabase
        .from('records')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      setRecords(recordsData || [])

      // 패턴 분석 목록 (프로젝트에 연결되지 않은 것만)
      const { data: analysesData } = await supabase
        .from('ai_analyses')
        .select('*')
        .eq('user_id', user.id)
        .is('project_id', null)
        .order('created_at', { ascending: false })

      // 모든 패턴 분석 목록 (표시용)
      const { data: allAnalysesData } = await supabase
        .from('ai_analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // 패턴 분석의 날짜 범위 계산 (record_ids를 사용해서 실제 기록의 날짜 가져오기)
      if (allAnalysesData && allAnalysesData.length > 0) {
        const analysesWithDates = await Promise.all(
          allAnalysesData.map(async (analysis) => {
            if (analysis.record_ids && analysis.record_ids.length > 0) {
              const { data: recordDates } = await supabase
                .from('records')
                .select('date')
                .in('id', analysis.record_ids)
                .order('date', { ascending: true })

              if (recordDates && recordDates.length > 0) {
                const dates = recordDates.map(r => new Date(r.date))
                const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
                const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
                return {
                  ...analysis,
                  dateRange: { start: minDate.toISOString(), end: maxDate.toISOString() }
                }
              }
            }
            return analysis
          })
        )
        setAnalyses(analysesWithDates)
      } else {
        setAnalyses([])
      }

      // 포트폴리오 카드 목록
      const { data: cardsData } = await supabase
        .from('project_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setCards(cardsData || [])
      
      // 패턴 분석 개수 저장 (상태 관리용)
      setUnusedAnalysesCount(analysesData?.length || 0)
    } catch (error) {
      console.error('데이터 로딩 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  // 미사용 기록 수 계산 (패턴 분석에 사용되지 않은 기록)
  const unusedRecordsCount = records.filter((r) => {
    // analysis_id가 null인 기록만 카운트 (패턴 분석에 사용되지 않은 기록)
    return !r.analysis_id
  }).length

  // 다음 패턴 분석까지 남은 기록 수
  const recordsUntilNextAnalysis = 5 - (unusedRecordsCount % 5)

  // 진행률 계산 (5일 단위)
  const progressPercent = ((unusedRecordsCount % 5) / 5) * 100

  // 패턴 분석 가능 여부 (5개 기록)
  const canAnalyze = unusedRecordsCount >= 5

  // 포트폴리오 카드 생성 가능 여부 (4개 패턴 분석 = 20일 기록)
  const canGenerateCard = unusedAnalysesCount >= 4

  const handleAnalyze = async () => {
    if (unusedRecordsCount < 5) {
      alert(`패턴 분석을 위해 최소 5일의 기록이 필요합니다.\n현재 미사용 기록: ${unusedRecordsCount}개`)
      return
    }

    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        alert('패턴 분석이 생성되었습니다!')
        loadData() // 데이터 다시 로드
      } else {
        alert(data.error || '패턴 분석에 실패했습니다')
      }
    } catch (error) {
      console.error('패턴 분석 실패:', error)
      alert('패턴 분석에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerateCard = async () => {
    // 실제로 사용 가능한 패턴 분석과 기록 수 확인
    if (unusedAnalysesCount < 4) {
      alert(`포트폴리오 카드를 생성하려면 최소 4개의 패턴 분석이 필요합니다.\n현재 사용 가능한 패턴 분석: ${unusedAnalysesCount}개`)
      return
    }

    setIsGeneratingCard(true)
    // 실제 기록 수 확인을 위해 API 호출
    try {
      const response = await fetch('/api/cards/generate', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        alert('포트폴리오 카드가 생성되었습니다!')
        loadData() // 데이터 다시 로드
        router.push(`/cards/${data.card.id}?fromTab=${activeTab}`)
      } else {
        // 상세 에러 메시지 표시
        const errorMsg = data.details 
          ? `${data.error}\n\n${data.details}`
          : data.error || '포트폴리오 카드 생성에 실패했습니다'
        alert(errorMsg)
      }
    } catch (error) {
      console.error('포트폴리오 카드 생성 실패:', error)
      alert('포트폴리오 카드 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsGeneratingCard(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const recordDate = new Date(date)
    recordDate.setHours(0, 0, 0, 0)

    if (recordDate.getTime() === today.getTime()) {
      return '오늘'
    } else {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const weekdays = ['일', '월', '화', '수', '목', '금', '토']
      const weekday = weekdays[date.getDay()]
      return `${year}.${month}.${day}(${weekday})`
    }
  }

  const handleLogout = async () => {
    if (!confirm('로그아웃 하시겠어요?')) {
      return
    }

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      
      if (error) throw error
      
      // 로그아웃 성공 시 랜딩 페이지로 이동
      router.push('/')
    } catch (error) {
      console.error('로그아웃 실패:', error)
      alert('로그아웃에 실패했습니다. 다시 시도해주세요.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">일마카세 아카이브</h1>
              <p className="text-sm text-gray-500 mt-1">
                안녕하세요, {userName}! 👋
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600 p-1.5 transition-colors"
              title="로그아웃"
            >
              <i className="fas fa-right-from-bracket text-sm"></i>
            </button>
          </div>
        </div>
      </header>


      {/* Content */}
      <div className="max-w-md mx-auto px-5 py-6 pb-24">
        {/* Tab Content */}
        {activeTab === 'records' && (
          <div className="space-y-4">
            {/* 현재 상태 카드 */}
            <Card className="bg-white">
              <div className="flex items-center gap-2 mb-4">
                <i className="fas fa-chart-line text-primary-500 text-lg"></i>
                <h3 className="font-bold text-gray-800">현재 상태</h3>
              </div>

              <div className="mb-5">
                <h2 className="text-2xl font-extrabold text-gray-900 mb-1">
                  {records.length}일 <span className="text-lg font-normal text-gray-600">동안 기록했어요</span>
                </h2>
              </div>

              <div className="bg-orange-50 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">발견된 프로젝트</p>
                    <p className="text-xl font-bold text-primary-600">{cards.length}개</p>
                  </div>
                  <div className="border-l border-primary-200 pl-4">
                    <p className="text-xs text-gray-500 mb-1">다음 패턴 분석까지</p>
                    <p className="text-base font-bold text-gray-700">기록 {recordsUntilNextAnalysis}개 남음</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-500">{unusedRecordsCount % 5}일 기록 완료</span>
                  <span className="text-xs font-medium text-primary-600">
                    {recordsUntilNextAnalysis}일 더 작성하면 패턴 분석!
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary-400 to-primary-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </Card>

            {/* 알림 카드 */}
            {canGenerateCard && (
              <Card
                className={`bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 transition-all ${
                  isGeneratingCard 
                    ? 'opacity-75 cursor-not-allowed' 
                    : 'cursor-pointer hover:shadow-md'
                }`}
                onClick={isGeneratingCard ? undefined : handleGenerateCard}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-2xl">
                    🎉
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold mb-0.5 text-gray-900">패턴 분석 {unusedAnalysesCount}개 쌓였어요!</h3>
                    <p className="text-sm text-gray-600">
                      {isGeneratingCard ? '포트폴리오 카드를 생성하고 있어요...' : '포트폴리오 카드를 만들 수 있어요 (총 20일 기록)'}
                    </p>
                  </div>
                  {isGeneratingCard ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
                  ) : (
                    <i className="fas fa-chevron-right text-gray-400"></i>
                  )}
                </div>
              </Card>
            )}

            {/* 기록 목록 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <i className="fas fa-pencil-alt text-gray-500"></i>
                  업무 기록
                </h3>
              </div>
              {records.length > 0 && (
                <p className="text-xs text-gray-500 mb-3">
                  최신 30개까지만 표시됩니다. 나머지는 캘린더에서 확인하세요.
                </p>
              )}

              {records.length === 0 ? (
                <Card className="bg-white text-center py-12">
                  <div className="text-gray-300 text-5xl mb-3">📝</div>
                  <p className="text-gray-500 text-sm mb-4">아직 작성한 기록이 없어요</p>
                  <button
                    onClick={() => router.push('/write')}
                    className="bg-primary-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-600 transition"
                  >
                    첫 기록 작성하기
                  </button>
                </Card>
              ) : (
                <>
                  {/* 최신 10개 기록 (바로 표시) */}
                  <div className="space-y-3">
                    {records.slice(0, 10).map((record) => (
                      <Card
                        key={record.id}
                        className="bg-white hover:shadow-md transition-all cursor-pointer border-l-4 border-l-primary-500"
                        onClick={() => router.push(`/records/${record.id}?fromTab=${activeTab}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-bold text-primary-500 bg-primary-50 px-2 py-0.5 rounded">
                                {formatDate(record.date)}
                              </span>
                              {record.project_id && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">
                                  카드 생성됨
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-800 font-medium line-clamp-2">
                              {record.contents && record.contents.length > 0 ? (
                                <>
                                  {record.contents[0]}
                                  {record.contents.length > 1 && (
                                    <span className="text-gray-400 ml-1 font-normal">
                                      외 {record.contents.length - 1}개
                                    </span>
                                  )}
                                </>
                              ) : (
                                '내용 없음'
                              )}
                            </p>
                          </div>
                          <i className="fas fa-chevron-right text-gray-300 text-sm mt-1"></i>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* 나머지 기록 (11-30번째, 스크롤 필요) */}
                  {records.length > 10 && (
                    <div className="mt-4">
                      <div 
                        className="max-h-[600px] overflow-y-auto space-y-3 scrollbar-hide"
                        style={{
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                        }}
                      >
                        {records.slice(10, 30).map((record) => (
                          <Card
                            key={record.id}
                            className="bg-white hover:shadow-md transition-all cursor-pointer border-l-4 border-l-primary-500"
                            onClick={() => router.push(`/records/${record.id}?fromTab=${activeTab}`)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-bold text-primary-500 bg-primary-50 px-2 py-0.5 rounded">
                                    {formatDate(record.date)}
                                  </span>
                                  {record.project_id && (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">
                                      카드 생성됨
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-800 font-medium line-clamp-2">
                                  {record.contents && record.contents.length > 0 ? (
                                    <>
                                      {record.contents[0]}
                                      {record.contents.length > 1 && (
                                        <span className="text-gray-400 ml-1 font-normal">
                                          외 {record.contents.length - 1}개
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    '내용 없음'
                                  )}
                                </p>
                              </div>
                              <i className="fas fa-chevron-right text-gray-300 text-sm mt-1"></i>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 30개 넘어가면 캘린더 안내 */}
                  {records.length > 30 && (
                    <Card className="bg-blue-50 border border-blue-200 mt-4">
                      <div className="flex items-center gap-3">
                        <i className="fas fa-calendar-alt text-blue-500 text-lg"></i>
                        <div className="flex-1">
                          <p className="text-sm text-blue-900 font-medium">
                            기록이 {records.length}개예요!
                          </p>
                          <p className="text-xs text-blue-700 mt-1">
                            최신 30개까지만 여기서 볼 수 있어요. 나머지는 캘린더 탭에서 확인하세요.
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab('calendar')}
                          className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg font-medium hover:bg-blue-600 transition"
                        >
                          캘린더 보기
                        </button>
                      </div>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'cards' && (
          <div className="space-y-4">
            {/* 포트폴리오 카드 생성 버튼 (최상단) */}
            {canGenerateCard && (
              <Card
                className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 cursor-pointer hover:shadow-md transition-all"
                onClick={handleGenerateCard}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-2xl">
                    🎉
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold mb-0.5 text-gray-900">패턴 분석 {unusedAnalysesCount}개 쌓였어요!</h3>
                    <p className="text-sm text-gray-600">포트폴리오 카드를 만들 수 있어요 (총 20일 기록)</p>
                  </div>
                  {isGeneratingCard ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500"></div>
                  ) : (
                    <i className="fas fa-chevron-right text-gray-400"></i>
                  )}
                </div>
              </Card>
            )}

            {cards.length === 0 ? (
              <Card className="bg-white text-center py-12">
                <div className="text-gray-300 text-5xl mb-3">📁</div>
                <p className="text-gray-500 text-sm mb-4">아직 생성된 포트폴리오 카드가 없어요</p>
                {!canGenerateCard && (
                  <p className="text-xs text-gray-400">
                    패턴 분석 4개가 필요해요<br />
                    (현재 {unusedAnalysesCount}개)
                  </p>
                )}
              </Card>
            ) : (
              <div className="space-y-4">
                {cards.map((card) => {
                  const formatPeriod = (start: string, end: string) => {
                    const startDate = new Date(start)
                    const endDate = new Date(end)
                    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                    const weeks = Math.floor(diffDays / 7)
                    return `${start.slice(5).replace('-', '.')} ~ ${end.slice(5).replace('-', '.')} (${weeks > 0 ? `${weeks}주` : `${diffDays}일`})`
                  }

                  return (
                  <Card
                    key={card.id}
                    hoverable
                    onClick={() => router.push(`/cards/${card.id}?fromTab=${activeTab}`)}
                    className="relative overflow-hidden"
                  >
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary-500"></div>
                      <div className="pl-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-gray-900 flex-1">
                            📁 {card.title}
                          </h4>
                          <i className="fas fa-chevron-right text-gray-300 text-sm mt-1"></i>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                          ⏱️ {formatPeriod(card.period_start, card.period_end)}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {card.tasks?.slice(0, 2).map((task: string, idx: number) => (
                            <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              • {task.length > 20 ? task.slice(0, 20) + '...' : task}
                            </span>
                          ))}
                          {card.tasks && card.tasks.length > 2 && (
                            <span className="text-xs text-gray-400">+{card.tasks.length - 2}개</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'analyses' && (
          <div className="space-y-4">
            {/* 패턴 분석 생성 버튼 - 항상 표시 */}
            <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-500">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-2xl">
                  ✨
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-blue-900 mb-0.5">업무 패턴 분석</h3>
                  <p className="text-sm text-gray-600">
                    {canAnalyze 
                      ? `기록 5개가 준비되었어요! 패턴을 분석해볼까요?`
                      : `기록 ${unusedRecordsCount}개 / 5개 필요 (${recordsUntilNextAnalysis}개 더 필요)`}
                  </p>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={!canAnalyze || isAnalyzing}
                  className={`px-3 py-1.5 text-sm rounded-lg font-medium transition flex items-center gap-2 ${
                    canAnalyze && !isAnalyzing
                      ? 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span>분석 중...</span>
                    </>
                  ) : (
                    '분석하기'
                  )}
                </button>
              </div>
            </Card>

            {analyses.length === 0 ? (
              <Card className="bg-white text-center py-12">
                <div className="text-gray-300 text-5xl mb-3">📊</div>
                <p className="text-gray-500 text-sm mb-4">아직 생성된 패턴 분석이 없어요</p>
                <p className="text-xs text-gray-400">
                  5일간의 기록을 쌓으면<br />패턴 분석을 생성할 수 있어요
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {analyses.map((analysis) => (
                  <Card
                    key={analysis.id}
                    className="bg-gradient-to-br from-white to-blue-50/30 hover:shadow-md transition-all cursor-pointer border-l-4 border-l-blue-500"
                    onClick={() => router.push(`/analyses/${analysis.id}?fromTab=${activeTab}`)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {(analysis as any).dateRange ? (
                              <span className="text-xs text-gray-600 bg-blue-50 px-2 py-0.5 rounded font-medium">
                                {formatDate((analysis as any).dateRange.start)} ~ {formatDate((analysis as any).dateRange.end)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                                {formatDate(analysis.created_at)}
                              </span>
                            )}
                            {analysis.project_id && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">
                                카드 생성됨
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-gray-800 text-base mb-2 line-clamp-1">
                            {analysis.pattern}
                          </h3>
                        </div>
                        <i className="fas fa-chevron-right text-gray-300 text-sm mt-1"></i>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {analysis.top_keywords.slice(0, 3).map((keyword: string, idx: number) => (
                          <span
                            key={idx}
                            className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium"
                          >
                            #{keyword}
                          </span>
                        ))}
                        {analysis.top_keywords.length > 3 && (
                          <span className="text-xs text-gray-400 px-2 py-0.5">
                            +{analysis.top_keywords.length - 3}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-700 line-clamp-2">
                        {analysis.insight}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-4">
            {/* 월 네비게이션 */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  const prevMonth = new Date(currentMonth)
                  prevMonth.setMonth(prevMonth.getMonth() - 1)
                  setCurrentMonth(prevMonth)
                }}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              <h3 className="text-lg font-bold text-gray-800">
                {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
              </h3>
              <button
                onClick={() => {
                  const nextMonth = new Date(currentMonth)
                  nextMonth.setMonth(nextMonth.getMonth() + 1)
                  setCurrentMonth(nextMonth)
                }}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>

            {/* 캘린더 */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              {/* 요일 헤더 */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                  <div
                    key={idx}
                    className={`text-center text-xs font-medium py-2 ${
                      idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-600'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 날짜 그리드 */}
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const year = currentMonth.getFullYear()
                  const month = currentMonth.getMonth()
                  const firstDay = new Date(year, month, 1)
                  const lastDay = new Date(year, month + 1, 0)
                  const startDate = new Date(firstDay)
                  startDate.setDate(startDate.getDate() - firstDay.getDay())

                  const dates: Date[] = []
                  const currentDate = new Date(startDate)
                  
                  // 6주치 날짜 생성
                  for (let i = 0; i < 42; i++) {
                    dates.push(new Date(currentDate))
                    currentDate.setDate(currentDate.getDate() + 1)
                  }

                  // 기록이 있는 날짜 목록
                  const recordDates = new Set(
                    records.map(r => {
                      const d = new Date(r.date)
                      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
                    })
                  )

                  const today = new Date()
                  today.setHours(0, 0, 0, 0)

                  return dates.map((date, idx) => {
                    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
                    const hasRecord = recordDates.has(dateKey)
                    const isCurrentMonth = date.getMonth() === month
                    const isToday = date.getTime() === today.getTime()
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6

                    // 해당 날짜의 기록 찾기
                    const dayRecord = records.find(r => {
                      const d = new Date(r.date)
                      return d.getFullYear() === date.getFullYear() &&
                             d.getMonth() === date.getMonth() &&
                             d.getDate() === date.getDate()
                    })

                    const isSelected = selectedDate && 
                      date.getFullYear() === selectedDate.getFullYear() &&
                      date.getMonth() === selectedDate.getMonth() &&
                      date.getDate() === selectedDate.getDate()

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (hasRecord || isCurrentMonth) {
                            setSelectedDate(date)
                          }
                        }}
                        className={`
                          aspect-square rounded-lg text-sm font-medium transition-all
                          ${!isCurrentMonth ? 'text-gray-300' : ''}
                          ${isToday ? 'bg-primary-500 text-white font-bold ring-2 ring-primary-300' : ''}
                          ${isSelected && !isToday ? 'ring-2 ring-primary-400 bg-primary-100' : ''}
                          ${!isToday && isCurrentMonth && hasRecord && !isSelected ? 'bg-primary-100 text-primary-700 hover:bg-primary-200' : ''}
                          ${!isToday && isCurrentMonth && !hasRecord && !isSelected ? 'text-gray-700 hover:bg-gray-100' : ''}
                          ${isWeekend && isCurrentMonth && !isToday && !isSelected ? 'text-blue-500' : ''}
                          ${hasRecord || isCurrentMonth ? 'cursor-pointer' : 'cursor-default'}
                        `}
                      >
                        {date.getDate()}
                        {hasRecord && !isToday && (
                          <div className="w-1 h-1 bg-primary-500 rounded-full mx-auto mt-0.5"></div>
                        )}
                      </button>
                    )
                  })
                })()}
              </div>
            </div>

            {/* 선택된 날짜의 기록 */}
            {(() => {
              // 선택된 날짜가 있으면 해당 날짜의 기록, 없으면 오늘 기록
              const targetDate = selectedDate || new Date()
              targetDate.setHours(0, 0, 0, 0)
              
              const targetRecord = records.find(r => {
                const d = new Date(r.date)
                d.setHours(0, 0, 0, 0)
                return d.getTime() === targetDate.getTime()
              })

              const today = new Date()
              today.setHours(0, 0, 0, 0)
              const isToday = targetDate.getTime() === today.getTime()

              if (targetRecord) {
                return (
                  <Card
                    className="bg-primary-50 border-primary-200 cursor-pointer hover:shadow-md transition-all"
                    onClick={() => router.push(`/records/${targetRecord.id}?fromTab=calendar`)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-primary-600">
                        {isToday ? '오늘' : formatDate(targetRecord.date)}
                      </span>
                      {targetRecord.project_id && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full">
                          카드 생성됨
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {targetRecord.contents && targetRecord.contents.length > 0 ? (
                        <>
                          {targetRecord.contents[0]}
                          {targetRecord.contents.length > 1 && (
                            <span className="text-gray-400 ml-1">
                              외 {targetRecord.contents.length - 1}개
                            </span>
                          )}
                        </>
                      ) : (
                        '내용 없음'
                      )}
                    </p>
                  </Card>
                )
              } else if (selectedDate) {
                // 선택된 날짜에 기록이 없는 경우
                return (
                  <Card className="bg-gray-50 border-gray-200 text-center py-8">
                    <div className="text-gray-400 text-sm">
                      {formatDate(selectedDate.toISOString())}에는 기록이 없어요
                    </div>
                  </Card>
                )
              }
              return null
            })()}
          </div>
        )}
      </div>

      {/* 하단 네비게이션 바 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 safe-area-bottom">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-around py-2">
            <button
              onClick={() => {
                setActiveTab('records')
                router.push('/home?tab=records', { scroll: false })
              }}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 transition-colors ${
                activeTab === 'records'
                  ? 'text-primary-600'
                  : 'text-gray-400'
              }`}
            >
              <i className="fas fa-clipboard-list text-lg"></i>
              <span className="text-xs font-medium">업무 기록</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('analyses')
                router.push('/home?tab=analyses', { scroll: false })
              }}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 transition-colors ${
                activeTab === 'analyses'
                  ? 'text-primary-600'
                  : 'text-gray-400'
              }`}
            >
              <i className="fas fa-chart-bar text-lg"></i>
              <span className="text-xs font-medium">업무 패턴</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('cards')
                router.push('/home?tab=cards', { scroll: false })
              }}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 transition-colors ${
                activeTab === 'cards'
                  ? 'text-primary-600'
                  : 'text-gray-400'
              }`}
            >
              <i className={`fas ${activeTab === 'cards' ? 'fa-folder-open' : 'fa-folder'} text-lg`}></i>
              <span className="text-xs font-medium">포트폴리오</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('calendar')
                router.push('/home?tab=calendar', { scroll: false })
              }}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-3 transition-colors ${
                activeTab === 'calendar'
                  ? 'text-primary-600'
                  : 'text-gray-400'
              }`}
            >
              <i className="fas fa-calendar text-lg"></i>
              <span className="text-xs font-medium">캘린더</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 플로팅 버튼 */}
      <button
        onClick={() => router.push('/write')}
        className="fixed bottom-20 right-6 w-14 h-14 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-2xl flex items-center justify-center text-xl transition active:scale-95 z-10"
      >
        <i className="fas fa-plus"></i>
      </button>
    </div>
  )
}
