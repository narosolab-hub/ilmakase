# 테스트 데이터 생성 가이드

프로젝트 카드 확인을 위한 테스트 기록 데이터 생성 방법입니다.

## 방법 1: SQL 스크립트 사용 (추천)

### 단계별 가이드

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard 접속
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 "SQL Editor" 클릭
   - "New query" 클릭

3. **사용자 ID 확인**
   ```sql
   SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;
   ```
   - 실행 후 나오는 `id` 값을 복사하세요

4. **간단한 버전 실행** (추천)
   - `generate-test-records-simple.sql` 파일 열기
   - `YOUR_USER_ID_HERE` 부분을 위에서 복사한 user_id로 교체
   - 전체 쿼리 복사해서 SQL Editor에 붙여넣기
   - 실행 버튼 클릭

5. **또는 자동 버전 실행**
   - `generate-test-records.sql` 파일 내용을 SQL Editor에 붙여넣기
   - 실행 버튼 클릭
   - 가장 최근 사용자에게 자동으로 기록 생성

6. **생성 확인**
   - 앱의 홈 페이지로 이동
   - "기록 5개 쌓였어요!" 알림이 보이면 성공
   - 카드 생성 버튼 클릭하여 프로젝트 카드 확인

## 방법 2: API를 통한 생성 (개발자용)

터미널에서 실행:

```bash
# 환경 변수 설정 필요
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_anon_key"

# 또는 Node.js 스크립트 작성하여 실행
```

## 생성되는 데이터

- **5일치 기록** 생성 (오늘부터 역순)
- 각 날짜마다 **3개씩 업무 항목** 포함
- 날짜: 오늘, 어제, 3일 전, 4일 전, 5일 전

## 주의사항

- 이미 해당 날짜에 기록이 있으면 스킵됩니다
- `ON CONFLICT DO NOTHING`으로 중복 방지
- 생성 후 홈 페이지에서 카드 생성 버튼을 눌러야 프로젝트 카드가 생성됩니다

## 문제 해결

### "사용자를 찾을 수 없습니다" 에러
- 먼저 앱에서 회원가입을 완료하세요
- 또는 `generate-test-records-simple.sql`에서 직접 user_id를 입력하세요

### 기록이 생성되지 않음
- Supabase RLS (Row Level Security) 정책 확인
- `auth.users` 테이블에 사용자가 있는지 확인

