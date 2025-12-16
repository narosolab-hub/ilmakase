-- 기존 프로젝트 카드 삭제
-- 프롬프트 테스트를 위해 카드를 모두 삭제합니다.

-- 1. 먼저 카드와 연결된 기록들의 project_id를 null로 초기화
UPDATE records
SET project_id = NULL
WHERE project_id IS NOT NULL;

-- 2. 모든 프로젝트 카드 삭제
DELETE FROM project_cards;

-- 3. 결과 확인
SELECT 
  (SELECT COUNT(*) FROM project_cards) as total_cards,
  (SELECT COUNT(*) FROM records WHERE project_id IS NULL) as unused_records,
  (SELECT COUNT(*) FROM records) as total_records;

