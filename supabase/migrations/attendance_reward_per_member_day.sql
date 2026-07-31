-- 출석체크 적립: 회원당 하루 1회(어느 매장에서든 참여 가능). store_id는 기록용으로 유지.
-- (직전 '매장별 1일 1회'를 회원당 1일 1회로 복원)
delete from attendance_rewards a using attendance_rewards b
 where a.customer_id = b.customer_id and a.reward_date = b.reward_date and a.id > b.id;

drop index if exists uq_attendance_per_store_day;
create unique index if not exists uq_attendance_per_day
  on public.attendance_rewards (customer_id, reward_date);
