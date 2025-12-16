import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 기록 상세 조회
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { id } = await params

    const { data: record, error } = await supabase
      .from('records')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) throw error

    if (!record) {
      return NextResponse.json({ error: '기록을 찾을 수 없습니다' }, { status: 404 })
    }

    return NextResponse.json({ record })
  } catch (error: any) {
    console.error('기록 조회 에러:', error)
    return NextResponse.json(
      { error: '기록을 불러오는데 실패했습니다' },
      { status: 500 }
    )
  }
}

// 기록 수정
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { contents } = body

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return NextResponse.json(
        { error: '업무 내용을 입력해주세요' },
        { status: 400 }
      )
    }

    const { data: record, error } = await supabase
      .from('records')
      .update({ contents: contents.filter(c => c.trim()).map(c => c.trim()) })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ record })
  } catch (error: any) {
    console.error('기록 수정 에러:', error)
    return NextResponse.json(
      { error: '기록 수정에 실패했습니다' },
      { status: 500 }
    )
  }
}

// 기록 삭제
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { id } = await params

    const { error } = await supabase
      .from('records')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('기록 삭제 에러:', error)
    return NextResponse.json(
      { error: '기록 삭제에 실패했습니다' },
      { status: 500 }
    )
  }
}

