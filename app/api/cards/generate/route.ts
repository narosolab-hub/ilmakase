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

    // project_id가 null인 패턴 분석 4개 조회 (날짜 오름차순)
    const { data: analyses, error: analysesError } = await supabase
      .from('ai_analyses')
      .select('*')
      .eq('user_id', user.id)
      .is('project_id', null)
      .order('created_at', { ascending: true })
      .limit(4)

    if (analysesError) throw analysesError

    if (!analyses || analyses.length < 4) {
      return NextResponse.json(
        { error: '포트폴리오 카드를 생성하려면 최소 4개의 패턴 분석이 필요합니다 (총 20일의 기록)' },
        { status: 400 }
      )
    }

    // 4개 분석의 모든 기록 ID 수집
    const allRecordIds: string[] = []
    analyses.forEach(analysis => {
      allRecordIds.push(...(analysis.record_ids || []))
    })

    // 모든 기록 조회
    const { data: records, error: recordsError } = await supabase
      .from('records')
      .select('*')
      .in('id', allRecordIds)
      .order('date', { ascending: true })

    if (recordsError) throw recordsError

    if (!records || records.length < 20) {
      return NextResponse.json(
        { error: '기록을 불러오는데 실패했습니다' },
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
    return NextResponse.json(
      { error: error.message || '카드 생성에 실패했습니다' },
      { status: 500 }
    )
  }
}
