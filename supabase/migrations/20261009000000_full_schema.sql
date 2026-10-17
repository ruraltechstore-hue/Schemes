-- Government Scheme Finder: complete database setup (reference copy for a fresh project).
-- Already applied to this project's backend; run on a brand-new database only.
-- Order: roles -> profiles + signup trigger -> schemes -> documents -> applications -> file storage -> sample schemes.

-- File storage bucket for private user documents (10 MB, PDF/JPG/PNG)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents','documents', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

create type public.app_role as enum ('admin','user');
create table public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, role app_role not null, unique(user_id, role));
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text, mobile text, state text, district text,
  dob date, gender text, category text, annual_income numeric, occupation text, family_size int,
  is_farmer boolean default false, is_student boolean default false, has_disability boolean default false,
  area text, created_at timestamptz default now(), updated_at timestamptz default now());
grant select, insert, update on public.profiles to authenticated; grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id, full_name, email, mobile, state, district)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'mobile', new.raw_user_meta_data->>'state', new.raw_user_meta_data->>'district');
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.schemes (
  id uuid primary key default gen_random_uuid(),
  name text not null, description text not null default '', ministry text not null default '',
  category text not null default 'Social Welfare', level text not null default 'Central', state text,
  benefits text not null default '', eligibility jsonb not null default '{}'::jsonb,
  eligibility_text text not null default '', required_documents text[] not null default '{}',
  apply_url text not null default '', created_at timestamptz default now());
grant select on public.schemes to anon, authenticated; grant insert, update, delete on public.schemes to authenticated; grant all on public.schemes to service_role;
alter table public.schemes enable row level security;
create policy "schemes public read" on public.schemes for select to anon, authenticated using (true);
create policy "admin insert" on public.schemes for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update" on public.schemes for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin delete" on public.schemes for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.documents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(),
  doc_type text not null, file_name text not null, file_path text not null, mime_type text,
  status text not null default 'Verified', created_at timestamptz default now());
grant select, insert, delete on public.documents to authenticated; grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "own docs" on public.documents for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid(),
  scheme_id uuid not null references public.schemes(id) on delete cascade,
  status text not null default 'Interested', notes text, created_at timestamptz default now(), updated_at timestamptz default now(),
  unique(user_id, scheme_id));
grant select, insert, update, delete on public.applications to authenticated; grant all on public.applications to service_role;
alter table public.applications enable row level security;
create policy "own apps" on public.applications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own files read" on storage.objects for select to authenticated using (bucket_id='documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files insert" on storage.objects for insert to authenticated with check (bucket_id='documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files delete" on storage.objects for delete to authenticated using (bucket_id='documents' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.schemes (name, description, ministry, category, level, benefits, eligibility, eligibility_text, required_documents, apply_url) values
('PM-KISAN Samman Nidhi','Income support to landholding farmer families.','Ministry of Agriculture & Farmers Welfare','Agriculture','Central','₹6,000 per year in three instalments via DBT','{"farmer":true}','Landholding farmer families','{Aadhaar,"Land Documents","Bank Documents"}','https://pmkisan.gov.in'),
('Pradhan Mantri Fasal Bima Yojana','Crop insurance against natural calamities, pests and diseases.','Ministry of Agriculture & Farmers Welfare','Agriculture','Central','Crop insurance at low premium (1.5–5%)','{"farmer":true}','Farmers growing notified crops','{Aadhaar,"Land Documents","Bank Documents"}','https://pmfby.gov.in'),
('Ayushman Bharat PM-JAY','Health cover for secondary and tertiary hospitalisation.','Ministry of Health & Family Welfare','Healthcare','Central','Health cover up to ₹5 lakh per family per year','{"max_income":250000}','Economically vulnerable families','{Aadhaar,"Income Certificate"}','https://pmjay.gov.in'),
('Pradhan Mantri Awas Yojana – Gramin','Pucca house assistance for rural homeless families.','Ministry of Rural Development','Housing','Central','₹1.2–1.3 lakh assistance for house construction','{"area":"Rural","max_income":300000}','Rural households without pucca house','{Aadhaar,"Income Certificate","Residence Certificate","Bank Documents"}','https://pmayg.nic.in'),
('Pradhan Mantri Awas Yojana – Urban','Affordable housing for urban poor.','Ministry of Housing & Urban Affairs','Housing','Central','Interest subsidy and housing assistance','{"area":"Urban","max_income":1800000}','Urban EWS/LIG/MIG households','{Aadhaar,"Income Certificate","Residence Certificate"}','https://pmaymis.gov.in'),
('National Scholarship – Post Matric (SC/ST/OBC)','Scholarship for students from reserved categories.','Ministry of Social Justice & Empowerment','Education','Central','Tuition fee and maintenance allowance','{"student":true,"categories":["SC","ST","OBC"],"max_income":250000}','SC/ST/OBC students, family income ≤ ₹2.5 lakh','{Aadhaar,"Caste Certificate","Income Certificate","Education Certificates","Bank Documents"}','https://scholarships.gov.in'),
('Pradhan Mantri Mudra Yojana','Collateral-free loans for small businesses.','Ministry of Finance','Business','Central','Loans up to ₹10 lakh (Shishu/Kishore/Tarun)','{"min_age":18,"occupations":["Self-employed","Business"]}','Non-farm small/micro entrepreneurs','{Aadhaar,PAN,"Bank Documents"}','https://www.mudra.org.in'),
('Stand-Up India','Bank loans for SC/ST and women entrepreneurs.','Ministry of Finance','Women','Central','Loans ₹10 lakh – ₹1 crore for greenfield enterprises','{"min_age":18,"genders":["Female"],"occupations":["Self-employed","Business"]}','Women or SC/ST entrepreneurs aged 18+','{Aadhaar,PAN,"Bank Documents"}','https://www.standupmitra.in'),
('MGNREGA','Guaranteed wage employment in rural areas.','Ministry of Rural Development','Rural Development','Central','100 days of guaranteed wage employment per year','{"area":"Rural","min_age":18}','Adult members of rural households','{Aadhaar,"Residence Certificate","Bank Documents"}','https://nrega.nic.in'),
('PM Vishwakarma','Support for traditional artisans and craftspeople.','Ministry of MSME','Employment','Central','Skill training, toolkit grant and credit up to ₹3 lakh','{"min_age":18,"occupations":["Artisan","Self-employed"]}','Traditional artisans aged 18+','{Aadhaar,"Bank Documents"}','https://pmvishwakarma.gov.in'),
('Indira Gandhi National Disability Pension','Monthly pension for persons with severe disability.','Ministry of Rural Development','Social Welfare','Central','Monthly pension of ₹300+ (plus state top-up)','{"disability":true,"min_age":18,"max_income":200000}','Persons with 80%+ disability from BPL households','{Aadhaar,"Income Certificate","Other Documents","Bank Documents"}','https://nsap.nic.in'),
('Pradhan Mantri Ujjwala Yojana','Free LPG connections for women from poor households.','Ministry of Petroleum & Natural Gas','Women','Central','Free LPG connection and first refill','{"genders":["Female"],"min_age":18,"max_income":200000}','Adult women from poor households','{Aadhaar,"Residence Certificate","Bank Documents"}','https://www.pmuy.gov.in'),
('Sukanya Samriddhi Yojana','Savings scheme for the girl child.','Ministry of Finance','Women','Central','High-interest tax-free savings for daughters','{"genders":["Female"],"max_age":10}','Girl child below 10 years','{Aadhaar,"Bank Documents"}','https://www.nsiindia.gov.in'),
('PM Kaushal Vikas Yojana','Free skill training and certification for youth.','Ministry of Skill Development','Employment','Central','Free industry-relevant training and certification','{"min_age":15,"max_age":45,"occupations":["Unemployed","Student"]}','Youth aged 15–45','{Aadhaar,"Education Certificates"}','https://www.pmkvyofficial.org'),
('Atal Pension Yojana','Guaranteed pension for unorganised sector workers.','Ministry of Finance','Social Welfare','Central','Pension of ₹1,000–₹5,000 per month after 60','{"min_age":18,"max_age":40}','Citizens aged 18–40 with bank account','{Aadhaar,"Bank Documents"}','https://www.npscra.nsdl.co.in');