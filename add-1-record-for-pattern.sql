-- 패턴 분석 카드 확인용: 1개만 추가 (3개 상태로 만들기)
-- 현재 2개 남아있으니 1개 추가하면 총 3개가 되어 파란색 패턴 분석 카드가 나타남

INSERT INTO records (user_id, contents, date, created_at)
VALUES
  -- 6일 전
  ('182b8df2-74dc-416e-aa2c-bd15994a74d2', 
   ARRAY['사용자 인터뷰 진행 및 인사이트 정리', '프로토타입 개선 사항 도출', '팀 내부 리뷰 미팅'],
   CURRENT_DATE - 6,
   NOW() - INTERVAL '6 days')
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

