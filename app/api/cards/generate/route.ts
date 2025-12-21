import { createClient } from '@/lib/supabase/server'
import { generateProjectCard } from '@/lib/gemini/prompts'
import { NextResponse } from 'next/server'

/**
 * 포트폴리오 카드 생성 API (4개 패턴 분석 = 20일 기록)
 * - project_id가 null인 패턴 분석 4개를 가져와서 1개의 포트폴리오 카드 생성
 * - 생성된 카드와 연결된 분석들의 project_id 업데이트 (ai_analyses에 project_id 필드 필요)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // project_id가 null이고 record_ids가 정확히 5개인 패턴 분석 조회 (날짜 오름차순)
    const { data: allAnalyses, error: analysesError } = await supabase
      .from('ai_analyses')
      .select('*')
      .eq('user_id', user.id)
      .is('project_id', null)
      .order('created_at', { ascending: true })

    if (analysesError) {
      console.error('패턴 분석 조회 실패:', analysesError)
      throw analysesError
    }

    if (!allAnalyses || allAnalyses.length === 0) {
      return NextResponse.json(
        { error: '포트폴리오 카드를 생성하려면 최소 4개의 패턴 분석이 필요합니다 (총 20일의 기록)' },
        { status: 400 }
      )
    }

    // 유효한 패턴 분석만 필터링 (record_ids가 정확히 5개인 것만)
    const validAnalyses = allAnalyses.filter(a => 
      a.record_ids && 
      Array.isArray(a.record_ids) && 
      a.record_ids.length === 5
    )


    if (validAnalyses.length < 4) {
      const invalidCount = allAnalyses.length - validAnalyses.length
      const analysisCounts = allAnalyses.map(a => a.record_ids?.length || 0).join(', ')
      return NextResponse.json(
        { 
          error: `포트폴리오 카드를 생성하려면 최소 4개의 유효한 패턴 분석이 필요합니다 (각 5개 기록)`,
          details: `현재 유효한 패턴 분석: ${validAnalyses.length}개 / 전체: ${allAnalyses.length}개\n각 패턴 분석별 기록 개수: [${analysisCounts}]\n\n⚠️ ${invalidCount}개의 패턴 분석이 5개 기록을 가지고 있지 않습니다.`
        },
        { status: 400 }
      )
    }

    // 유효한 패턴 분석 중 처음 4개만 사용
    const analyses = validAnalyses.slice(0, 4)

    // 중복 생성 방지: 이미 생성된 카드의 analysis_ids와 겹치는지 확인
    const analysisIdsToUse = analyses.map(a => a.id).sort()
    const { data: existingCards } = await supabase
      .from('project_cards')
      .select('analysis_ids')
      .eq('user_id', user.id)

    if (existingCards && existingCards.length > 0) {
      for (const card of existingCards) {
        if (card.analysis_ids && Array.isArray(card.analysis_ids)) {
          const existingAnalysisIds = [...card.analysis_ids].sort()
          // 같은 분석 세트로 이미 카드가 생성되었는지 확인
          if (existingAnalysisIds.length === analysisIdsToUse.length &&
              existingAnalysisIds.every((id: string, idx: number) => id === analysisIdsToUse[idx])) {
            return NextResponse.json(
              { 
                error: '이미 이 패턴 분석들로 포트폴리오 카드가 생성되었습니다',
                details: '같은 패턴 분석 세트로는 한 번만 카드를 생성할 수 있습니다.'
              },
              { status: 400 }
            )
          }
        }
      }
    }

    // 4개 분석의 모든 기록 ID 수집 (중복 제거)
    const allRecordIds: string[] = []
    const recordIdSet = new Set<string>()
    
    analyses.forEach((analysis) => {
      if (analysis.record_ids && Array.isArray(analysis.record_ids)) {
        analysis.record_ids.forEach((id: string) => {
          if (!recordIdSet.has(id)) {
            recordIdSet.add(id)
            allRecordIds.push(id)
          }
        })
      }
    })

    if (allRecordIds.length < 20) {
      const analysisCounts = analyses.map(a => a.record_ids?.length || 0).join(', ')
      
      // 문제 진단
      const invalidAnalyses = analyses.filter(a => !a.record_ids || a.record_ids.length !== 5)
      let diagnosticMsg = `각 패턴 분석별 기록 개수: [${analysisCounts}]`
      if (invalidAnalyses.length > 0) {
        diagnosticMsg += `\n\n⚠️ 문제: ${invalidAnalyses.length}개의 패턴 분석이 5개 기록을 가지고 있지 않습니다.`
        diagnosticMsg += `\n정상적인 패턴 분석은 각각 5개의 기록을 가져야 합니다.`
      }
      
      return NextResponse.json(
        { 
          error: `기록이 부족합니다. 현재 ${allRecordIds.length}개, 필요: 20개`,
          details: diagnosticMsg
        },
        { status: 400 }
      )
    }

    // 모든 기록 조회
    const { data: records, error: recordsError } = await supabase
      .from('records')
      .select('*')
      .in('id', allRecordIds)
      .order('date', { ascending: true })

    if (recordsError) {
      console.error('기록 조회 실패:', recordsError)
      throw recordsError
    }

    if (!records || records.length < 20) {
      console.log(`기록 부족: ${records?.length || 0}개 (필요: 20개)`)
      return NextResponse.json(
        { error: `기록을 불러오는데 실패했습니다. ${records?.length || 0}개만 조회됨` },
        { status: 500 }
      )
    }

    // AI로 포트폴리오 카드 생성 (20일 기록)
    const cardData = await generateProjectCard(records)

    // 기간 계산 (첫 날짜 ~ 마지막 날짜)
    const periodStart = records[0].date
    const periodEnd = records[records.length - 1].date

    // 카드 DB에 저장
    const { data: newCard, error: cardError } = await supabase
      .from('project_cards')
      .insert({
        user_id: user.id,
        analysis_ids: analyses.map((a) => a.id),
        record_ids: allRecordIds,
        title: cardData.title,
        period_start: periodStart,
        period_end: periodEnd,
        tasks: cardData.tasks,
        results: cardData.results || [],
        thinking_summary: cardData.thinking_summary,
      })
      .select()
      .single()

    if (cardError) throw cardError

    // 연결된 분석들의 project_id 업데이트
    const { error: updateAnalysisError } = await supabase
      .from('ai_analyses')
      .update({ project_id: newCard.id })
      .in('id', analyses.map((a) => a.id))

    if (updateAnalysisError) throw updateAnalysisError

    // 연결된 기록들의 project_id도 업데이트
    const { error: updateRecordsError } = await supabase
      .from('records')
      .update({ project_id: newCard.id })
      .in('id', allRecordIds)

    if (updateRecordsError) throw updateRecordsError

    return NextResponse.json({
      card: newCard,
      message: '포트폴리오 카드가 생성되었습니다!',
    })
  } catch (error: any) {
    console.error('카드 생성 실패:', error)
    console.error('에러 상세:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    })
    return NextResponse.json(
      { 
        error: error.message || '카드 생성에 실패했습니다',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
