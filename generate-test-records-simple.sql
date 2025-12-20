-- 간단한 버전: 직접 user_id 입력
-- 1. 아래 쿼리로 본인의 user_id 확인
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;

-- 2. 위에서 확인한 user_id를 아래 'YOUR_USER_ID_HERE' 부분에 입력하고 실행

INSERT INTO records (user_id, contents, date, created_at)
VALUES
  -- 5일 전
  ('182b8df2-74dc-416e-aa2c-bd15994a74d2', 
   ARRAY['신규 프로젝트 기획서 작성 완료', '팀원들과 브레인스토밍 미팅 진행', '경쟁사 분석 자료 정리'],
   CURRENT_DATE - 4,
   NOW() - INTERVAL '4 days'),
  
  -- 4일 전
  ('182b8df2-74dc-416e-aa2c-bd15994a74d2',
   ARRAY['프로젝트 일정 수립 및 리소스 배분', '스테이크홀더 미팅에서 제안서 발표', '디자인 시안 리뷰 및 피드백 반영'],
   CURRENT_DATE - 3,
   NOW() - INTERVAL '3 days'),
  
  -- 3일 전
  ('182b8df2-74dc-416e-aa2c-bd15994a74d2',
   ARRAY['개발팀과 기술 스펙 논의', '사용자 테스트 시나리오 작성', '마케팅 전략 수립'],
   CURRENT_DATE - 2,
   NOW() - INTERVAL '2 days'),
  
  -- 2일 전
  ('182b8df2-74dc-416e-aa2c-bd15994a74d2',
   ARRAY['프로토타입 제작 및 검증', '데이터 분석을 통한 인사이트 도출', '고객 피드백 수집 및 분석'],
   CURRENT_DATE - 1,
   NOW() - INTERVAL '1 day'),
  
  -- 1일 전 (어제)
  ('182b8df2-74dc-416e-aa2c-bd15994a74d2',
   ARRAY['최종 제품 런칭 준비', '런칭 이벤트 기획 및 실행', '성과 측정 지표 설정'],
   CURRENT_DATE - 0,
   NOW())
ON CONFLICT (user_id, date) DO NOTHING;

-- 생성 확인
SELECT 
  date,
  array_length(contents, 1) as item_count,
  contents
FROM records
WHERE user_id = '182b8df2-74dc-416e-aa2c-bd15994a74d2'
ORDER BY date DESC;

