-- Force dissolve every dual pair and clear links (platform reset)

update public.dual_pairs
set
  status = 'dissolved',
  dissolved_at = coalesce(dissolved_at, now()),
  partner_id = null
where status is distinct from 'dissolved';

update public.profiles
set
  dual_pair_id = null,
  account_type = 'personal';

-- Owner admin account
update public.profiles
set
  role = 'super_admin',
  account_type = 'personal',
  dual_pair_id = null
where lower(trim(email)) = 'officialnexus265@gmail.com';

-- Glory → personal member (adjust email if different)
update public.profiles
set
  role = coalesce(nullif(role, ''), 'member'),
  account_type = 'personal',
  dual_pair_id = null
where lower(email) like '%glory%'
   or lower(full_name) like '%glory%';

-- Verify
select id, email, full_name, role, account_type, dual_pair_id
from public.profiles
order by created_at desc;
