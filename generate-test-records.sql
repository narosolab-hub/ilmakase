-- 테스트용 기록 데이터 생성 스크립트
-- Supabase SQL Editor에서 실행하세요
-- 현재 로그인한 사용자에게 최근 5일치 기록을 생성합니다

-- 1단계: 현재 사용자 ID 확인 (실행 후 결과를 확인하세요)
-- SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- 2단계: 위에서 확인한 user_id를 아래 @user_id@ 부분에 입력하고 실행하세요
-- 또는 아래 쿼리를 수정하여 직접 user_id를 입력하세요

-- 사용자 ID를 변수로 설정 (실제 user_id로 변경 필요)
DO $$
DECLARE
  target_user_id UUID;
  record_date DATE;
  i INTEGER;
  sample_contents TEXT[];
BEGIN
  -- 가장 최근에 생성된 사용자 ID 가져오기 (또는 직접 입력)
  SELECT id INTO target_user_id 
  FROM auth.users 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- 사용자가 없으면 에러
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION '사용자를 찾을 수 없습니다. 먼저 회원가입을 해주세요.';
  END IF;
  
  RAISE NOTICE '사용자 ID: %', target_user_id;
  
  -- 오늘부터 역순으로 5일치 기록 생성
  FOR i IN 0..4 LOOP
    record_date := CURRENT_DATE - i;
    
    -- 이미 해당 날짜에 기록이 있으면 스킵
    IF EXISTS (
      SELECT 1 FROM records 
      WHERE user_id = target_user_id AND date = record_date
    ) THEN
      RAISE NOTICE '날짜 % 에는 이미 기록이 있습니다. 스킵합니다.', record_date;
      CONTINUE;
    END IF;
    
    -- 샘플 업무 내용 (매일 다른 내용)
    CASE i
      WHEN 0 THEN
        sample_contents := ARRAY[
          '신규 프로젝트 기획서 작성 완료',
          '팀원들과 브레인스토밍 미팅 진행',
          '경쟁사 분석 자료 정리'
        ];
      WHEN 1 THEN
        sample_contents := ARRAY[
          '프로젝트 일정 수립 및 리소스 배분',
          '스테이크홀더 미팅에서 제안서 발표',
          '디자인 시안 리뷰 및 피드백 반영'
        ];
      WHEN 2 THEN
        sample_contents := ARRAY[
          '개발팀과 기술 스펙 논의',
          '사용자 테스트 시나리오 작성',
          '마케팅 전략 수립'
        ];
      WHEN 3 THEN
        sample_contents := ARRAY[
          '프로토타입 제작 및 검증',
          '데이터 분석을 통한 인사이트 도출',
          '고객 피드백 수집 및 분석'
        ];
      WHEN 4 THEN
        sample_contents := ARRAY[
          '최종 제품 런칭 준비',
          '런칭 이벤트 기획 및 실행',
          '성과 측정 지표 설정'
        ];
    END CASE;
    
    -- 기록 삽입
    INSERT INTO records (user_id, contents, date, created_at)
    VALUES (
      target_user_id,
      sample_contents,
      record_date,
      NOW() - (i || ' days')::INTERVAL
    );
    
    RAISE NOTICE '날짜 % 기록 생성 완료 (%개 항목)', record_date, array_length(sample_contents, 1);
  END LOOP;
  
  RAISE NOTICE '✅ 테스트 기록 생성 완료!';
  RAISE NOTICE '이제 홈 페이지에서 카드 생성 버튼을 눌러보세요.';
END $$;

-- 생성된 기록 확인
SELECT 
  date,
  array_length(contents, 1) as item_count,
  contents
FROM records
WHERE user_id = (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1)
ORDER BY date DESC;

