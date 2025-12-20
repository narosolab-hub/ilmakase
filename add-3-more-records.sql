-- 추가 3개 기록 생성 (패턴 분석 카드 확인용)
-- 현재 2개 남아있으니 3개 추가하면 총 5개가 되어 카드 생성 가능

INSERT INTO records (user_id, contents, date, created_at)
VALUES
  -- 6일 전
  ('182b8df2-74dc-416e-aa2c-bd15994a74d2', 
   ARRAY['사용자 인터뷰 진행 및 인사이트 정리', '프로토타입 개선 사항 도출', '팀 내부 리뷰 미팅'],
   CURRENT_DATE - 6,
   NOW() - INTERVAL '6 days'),
  
  -- 7일 전
  ('182b8df2-74dc-416e-aa2c-bd15994a74d2',
   ARRAY['디자인 시스템 구축 및 가이드라인 작성', '브랜드 아이덴티티 검토', '컬러 팔레트 최종 확정'],
   CURRENT_DATE - 7,
   NOW() - INTERVAL '7 days'),
  
  -- 8일 전
  ('182b8df2-74dc-416e-aa2c-bd15994a74d2',
   ARRAY['마케팅 캠페인 기획 및 예산 산정', '타겟 고객 페르소나 정의', '채널 전략 수립'],
   CURRENT_DATE - 8,
   NOW() - INTERVAL '8 days')
ON CONFLICT (user_id, date) DO NOTHING;

-- 생성 확인
SELECT 
  date,
  array_length(contents, 1) as item_count,
  contents,
  project_id
FROM records
WHERE user_id = '182b8df2-74dc-416e-aa2c-bd15994a74d2'
  AND project_id IS NULL  -- 카드에 묶이지 않은 기록만
ORDER BY date DESC;

