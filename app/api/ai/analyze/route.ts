import { createClient } from '@/lib/supabase/server'
import { generateAnalysis } from '@/lib/gemini/prompts'
import { NextResponse } from 'next/server'

// AI 분석 실행 (3-5개 기록)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 최근 기록 가져오기 (프로젝트에 매핑되지 않은 것만)
    const { data: records, error: recordsError } = await supabase
      .from('records')
      .select('*')
      .eq('user_id', user.id)
      .is('project_id', null)
      .order('date', { ascending: false })
      .limit(5)

    if (recordsError) throw recordsError

    if (!records || records.length < 3) {
      return NextResponse.json(
        { error: '분석을 위해 최소 3개의 기록이 필요합니다' },
        { status: 400 }
      )
    }

    // AI 분석 실행
    const analysisResult = await generateAnalysis(
      records.map(r => ({
        date: r.date,
        contents: r.contents,
      }))
    )

    // 분석 결과 저장
    const { data: analysis, error: analysisError } = await supabase
      .from('ai_analyses')
      .insert({
        user_id: user.id,
        record_ids: records.map(r => r.id),
        pattern: analysisResult.pattern,
        workflow: analysisResult.workflow,
        top_keywords: analysisResult.keywords,
        insight: analysisResult.insight,
      })
      .select()
      .single()

    if (analysisError) throw analysisError

    // 기록에 키워드 업데이트
    for (const record of records) {
      await supabase
        .from('records')
        .update({ keywords: analysisResult.keywords })
        .eq('id', record.id)
    }

    return NextResponse.json({ analysis })
  } catch (error: any) {
    console.error('AI 분석 에러:', error)
    return NextResponse.json(
      { error: 'AI 분석에 실패했습니다' },
      { status: 500 }
    )
  }
}

