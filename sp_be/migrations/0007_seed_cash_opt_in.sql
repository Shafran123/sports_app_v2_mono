-- 0007_seed_cash_opt_in.sql
-- Seed venues opt into pay-at-venue (cash) so the demo data exercises the cash flow.
update venues set accepts_cash = true
where id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid
);