import { createClient } from '@/lib/supabase/server'
import { generateProjectCard } from '@/lib/gemini/prompts'
import { NextResponse } from 'next/server'

/**
 * 카드 생성 API (5일 단위 자동 생성)
 * - project_id가 null인 기록 5개를 가져와서 1개의 카드 생성
 * - 생성된 카드와 연결된 기록들의 project_id 업데이트
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // project_id가 null인 기록 5개 조회 (날짜 오름차순)
    const { data: records, error: recordsError } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', user.id)
      .is('project_id', null)
      .order('date', { ascending: true })
      .limit(5)

    if (recordsError) throw recordsError

    if (!records || records.length < 5) {
      return NextResponse.json(
        { error: '카드를 생성하려면 최소 5일의 기록이 필요합니다' },
        { status: 400 }
      )
    }

    // AI로 프로젝트 카드 생성
    const cardData = await generateProjectCard(records)

    // 기간 계산 (첫 날짜 ~ 마지막 날짜)
    const periodStart = records[0].date
    const periodEnd = records[records.length - 1].date

    // 카드 DB에 저장
    const { data: newCard, error: cardError } = await supabase
      .from('project_cards')
      .insert({
        user_id: user.id,
        record_ids: records.map((r) => r.id),
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

    // 연결된 기록들의 project_id 업데이트
    const { error: updateError } = await supabase
      .from('records')
      .update({ project_id: newCard.id })
      .in('id', records.map((r) => r.id))

    if (updateError) throw updateError

    return NextResponse.json({
      card: newCard,
      message: '프로젝트 카드가 생성되었습니다!',
    })
  } catch (error: any) {
    console.error('카드 생성 실패:', error)
    return NextResponse.json(
      { error: error.message || '카드 생성에 실패했습니다' },
      { status: 500 }
    )
  }
}
