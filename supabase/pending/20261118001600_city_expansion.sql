-- National city expansion: 16 states/UTs, 40 cities and their localities.
-- Pending. Created 14 November 2026. NOT applied to staging or production: each environment needs separate approval.
--
-- Additive reference data only:
--   * inserts into public.states, public.cities and public.localities, in that order;
--   * no update, delete, rename or schema change; no function, trigger, policy or constraint is touched;
--   * the 3 existing states, 5 existing cities and their 67 localities (and their ids) stay exactly as they are.
--     The DL state row keeps the name 'Delhi'; the website shows 'Delhi (NCT)' from its own label.
-- Every new city ends with 'Other' (the fallback locality, as in the five launch cities).
-- Independent of the other pending migrations; apply on its own.
--
-- Atomic: everything is one statement (a single DO block), so a failure at any point leaves nothing behind,
-- whichever tool runs it. Pre-checks stop it before any insert if the database is not in the expected state;
-- post-checks stop it (and undo the inserts) if the result is not exactly as intended.
--
-- Kept in step with lib/geo.ts by tests/unit/geo-sync.test.ts (states, regions, cities, localities, order).
--
-- Rollback principle (manual, never automatic):
--   New reference rows may be removed only after checking that nothing references them:
--     select count(*) from public.members where city_id in (<new city ids>);              -- must be 0
--   and no season result, reign, crown event, declaration or backing names a new city's board.
--   The database refuses to delete a city or locality that a member references (foreign keys).
--   Once anyone has joined a new city, roll forward (hide the city in the app) instead of deleting.
do $$
declare
  v_members bigint; v_seasons bigint; v_ledger bigint; v_results bigint; v_reigns bigint;
  v_bad text;
begin
  -- ---------- Pre-checks: the existing geography is exactly as expected ----------
  if (select count(*) from public.states) <> 3 then raise exception 'city expansion: expected 3 states, found %', (select count(*) from public.states); end if;
  select string_agg(v.code, ', ') into v_bad from (values ('GJ', 'Gujarat'), ('MH', 'Maharashtra'), ('DL', 'Delhi')) v(code, name)
   where not exists (select 1 from public.states s where s.code = v.code and s.name = v.name);
  if v_bad is not null then raise exception 'city expansion: existing state rows differ: %', v_bad; end if;
  if (select count(*) from public.cities) <> 5 then raise exception 'city expansion: expected 5 cities, found %', (select count(*) from public.cities); end if;
  select string_agg(v.id, ', ') into v_bad from (values    ('surat', 'Surat', 'GJ', 'West'),
    ('ahmedabad', 'Ahmedabad', 'GJ', 'West'),
    ('mumbai', 'Mumbai', 'MH', 'West'),
    ('pune', 'Pune', 'MH', 'West'),
    ('delhi', 'Delhi', 'DL', 'North')) v(id, name, state_code, region)
   where not exists (select 1 from public.cities c where c.id = v.id and c.name = v.name and c.state_code = v.state_code and c.region = v.region and c.active);
  if v_bad is not null then raise exception 'city expansion: existing city rows differ: %', v_bad; end if;
  if (select count(*) from public.localities) <> 67 then raise exception 'city expansion: expected 67 localities, found %', (select count(*) from public.localities); end if;
  select string_agg(v.city_id, ', ') into v_bad from (values    ('surat', 'Vesu|Adajan|Pal|Piplod|Athwa|Ghod Dod Road|City Light|Althan|Bhatar|Dumas|Rander|Varachha|Katargam|Udhna|Other'),
    ('ahmedabad', 'SG Highway|Bodakdev|Prahlad Nagar|Satellite|Thaltej|Vastrapur|Bopal|Navrangpura|Science City|Maninagar|Gota|Chandkheda|Other'),
    ('mumbai', 'Bandra|Khar|Juhu|Andheri|Santacruz|Worli|Lower Parel|BKC|Colaba|Malabar Hill|Powai|Goregaon|Borivali|Chembur|Other'),
    ('pune', 'Koregaon Park|Kalyani Nagar|Viman Nagar|Baner|Aundh|Wakad|Hinjewadi|Kothrud|Magarpatta|Camp|Deccan|Shivaji Nagar|Other'),
    ('delhi', 'South Delhi|Vasant Vihar|Defence Colony|Chanakyapuri|Connaught Place|Rajouri Garden|Punjabi Bagh|Dwarka|Pitampura|Lajpat Nagar|Other')) v(city_id, names)
   where v.names is distinct from (select string_agg(l.name, '|' order by l.id) from public.localities l where l.city_id = v.city_id);
  if v_bad is not null then raise exception 'city expansion: existing localities differ for: %', v_bad; end if;
  -- None of the new codes or ids may exist yet (no silent skipping of duplicates).
  select string_agg(code, ', ') into v_bad from public.states where code in ('RJ', 'PB', 'HR', 'UP', 'CH', 'KA', 'TG', 'TN', 'KL', 'WB', 'BR', 'JH', 'OD', 'MP', 'CG', 'AS');
  if v_bad is not null then raise exception 'city expansion: state codes already exist: %', v_bad; end if;
  select string_agg(id, ', ') into v_bad from public.cities where id in ('vadodara', 'gandhinagar', 'rajkot', 'nagpur', 'nashik', 'thane', 'jaipur', 'jodhpur', 'udaipur', 'kota', 'ludhiana', 'amritsar', 'gurugram', 'faridabad', 'hisar', 'panipat', 'lucknow', 'kanpur', 'noida', 'varanasi', 'agra', 'ghaziabad', 'chandigarh', 'bengaluru', 'hyderabad', 'chennai', 'kochi', 'kolkata', 'siliguri', 'patna', 'ranchi', 'bhubaneswar', 'cuttack', 'indore', 'bhopal', 'jabalpur', 'gwalior', 'raipur', 'bhilai', 'guwahati')
     or name in ('Vadodara', 'Gandhinagar', 'Rajkot', 'Nagpur', 'Nashik', 'Thane', 'Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ludhiana', 'Amritsar', 'Gurugram', 'Faridabad', 'Hisar', 'Panipat', 'Lucknow', 'Kanpur', 'Noida', 'Varanasi', 'Agra', 'Ghaziabad', 'Chandigarh', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kochi', 'Kolkata', 'Siliguri', 'Patna', 'Ranchi', 'Bhubaneswar', 'Cuttack', 'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Raipur', 'Bhilai', 'Guwahati');
  if v_bad is not null then raise exception 'city expansion: cities already exist: %', v_bad; end if;
  -- Counts that must not change.
  select count(*) into v_members from public.members;
  select count(*) into v_seasons from public.seasons;
  select count(*) into v_ledger from public.rank_ledger;
  select count(*) into v_results from public.season_results;
  select count(*) into v_reigns from public.throne_reigns;

  -- ---------- 1. States and union territories (16) ----------
  insert into public.states (code, name) values
    ('RJ', 'Rajasthan'),
    ('PB', 'Punjab'),
    ('HR', 'Haryana'),
    ('UP', 'Uttar Pradesh'),
    ('CH', 'Chandigarh'),
    ('KA', 'Karnataka'),
    ('TG', 'Telangana'),
    ('TN', 'Tamil Nadu'),
    ('KL', 'Kerala'),
    ('WB', 'West Bengal'),
    ('BR', 'Bihar'),
    ('JH', 'Jharkhand'),
    ('OD', 'Odisha'),
    ('MP', 'Madhya Pradesh'),
    ('CG', 'Chhattisgarh'),
    ('AS', 'Assam');

  -- ---------- 2. Cities (40) ----------
  insert into public.cities (id, name, state_code, region) values
    ('vadodara', 'Vadodara', 'GJ', 'West'),
    ('gandhinagar', 'Gandhinagar', 'GJ', 'West'),
    ('rajkot', 'Rajkot', 'GJ', 'West'),
    ('nagpur', 'Nagpur', 'MH', 'West'),
    ('nashik', 'Nashik', 'MH', 'West'),
    ('thane', 'Thane', 'MH', 'West'),
    ('jaipur', 'Jaipur', 'RJ', 'West'),
    ('jodhpur', 'Jodhpur', 'RJ', 'West'),
    ('udaipur', 'Udaipur', 'RJ', 'West'),
    ('kota', 'Kota', 'RJ', 'West'),
    ('ludhiana', 'Ludhiana', 'PB', 'North'),
    ('amritsar', 'Amritsar', 'PB', 'North'),
    ('gurugram', 'Gurugram', 'HR', 'North'),
    ('faridabad', 'Faridabad', 'HR', 'North'),
    ('hisar', 'Hisar', 'HR', 'North'),
    ('panipat', 'Panipat', 'HR', 'North'),
    ('lucknow', 'Lucknow', 'UP', 'North'),
    ('kanpur', 'Kanpur', 'UP', 'North'),
    ('noida', 'Noida', 'UP', 'North'),
    ('varanasi', 'Varanasi', 'UP', 'North'),
    ('agra', 'Agra', 'UP', 'North'),
    ('ghaziabad', 'Ghaziabad', 'UP', 'North'),
    ('chandigarh', 'Chandigarh', 'CH', 'North'),
    ('bengaluru', 'Bengaluru', 'KA', 'South'),
    ('hyderabad', 'Hyderabad', 'TG', 'South'),
    ('chennai', 'Chennai', 'TN', 'South'),
    ('kochi', 'Kochi', 'KL', 'South'),
    ('kolkata', 'Kolkata', 'WB', 'East'),
    ('siliguri', 'Siliguri', 'WB', 'East'),
    ('patna', 'Patna', 'BR', 'East'),
    ('ranchi', 'Ranchi', 'JH', 'East'),
    ('bhubaneswar', 'Bhubaneswar', 'OD', 'East'),
    ('cuttack', 'Cuttack', 'OD', 'East'),
    ('indore', 'Indore', 'MP', 'Central'),
    ('bhopal', 'Bhopal', 'MP', 'Central'),
    ('jabalpur', 'Jabalpur', 'MP', 'Central'),
    ('gwalior', 'Gwalior', 'MP', 'Central'),
    ('raipur', 'Raipur', 'CG', 'Central'),
    ('bhilai', 'Bhilai', 'CG', 'Central'),
    ('guwahati', 'Guwahati', 'AS', 'North-East');

  -- ---------- 3. Localities (major areas, then 'Other'), inserted in list order ----------
  insert into public.localities (city_id, name)
  select v.city_id, v.name from (values
    (1, 'vadodara', 'Alkapuri'),
    (2, 'vadodara', 'Akota'),
    (3, 'vadodara', 'Gotri'),
    (4, 'vadodara', 'Manjalpur'),
    (5, 'vadodara', 'Karelibaug'),
    (6, 'vadodara', 'Sama'),
    (7, 'vadodara', 'Other'),
    (8, 'gandhinagar', 'Sectors 1–10'),
    (9, 'gandhinagar', 'Sectors 11–20'),
    (10, 'gandhinagar', 'Sectors 21–30'),
    (11, 'gandhinagar', 'Kudasan'),
    (12, 'gandhinagar', 'Sargasan'),
    (13, 'gandhinagar', 'Other'),
    (14, 'rajkot', 'Kalawad Road'),
    (15, 'rajkot', 'Raiya Road'),
    (16, 'rajkot', 'University Road'),
    (17, 'rajkot', 'Mavdi'),
    (18, 'rajkot', 'Bhaktinagar'),
    (19, 'rajkot', 'Other'),
    (20, 'nagpur', 'Dharampeth'),
    (21, 'nagpur', 'Civil Lines'),
    (22, 'nagpur', 'Sadar'),
    (23, 'nagpur', 'Itwari'),
    (24, 'nagpur', 'Manish Nagar'),
    (25, 'nagpur', 'Pratap Nagar'),
    (26, 'nagpur', 'Other'),
    (27, 'nashik', 'College Road'),
    (28, 'nashik', 'Gangapur Road'),
    (29, 'nashik', 'Indira Nagar'),
    (30, 'nashik', 'Nashik Road'),
    (31, 'nashik', 'Panchavati'),
    (32, 'nashik', 'CIDCO'),
    (33, 'nashik', 'Other'),
    (34, 'thane', 'Ghodbunder Road'),
    (35, 'thane', 'Vasant Vihar'),
    (36, 'thane', 'Naupada'),
    (37, 'thane', 'Majiwada'),
    (38, 'thane', 'Kalwa'),
    (39, 'thane', 'Other'),
    (40, 'jaipur', 'C-Scheme'),
    (41, 'jaipur', 'Malviya Nagar'),
    (42, 'jaipur', 'Vaishali Nagar'),
    (43, 'jaipur', 'Mansarovar'),
    (44, 'jaipur', 'Raja Park'),
    (45, 'jaipur', 'Walled City'),
    (46, 'jaipur', 'Other'),
    (47, 'jodhpur', 'Sardarpura'),
    (48, 'jodhpur', 'Ratanada'),
    (49, 'jodhpur', 'Shastri Nagar'),
    (50, 'jodhpur', 'Paota'),
    (51, 'jodhpur', 'Basni'),
    (52, 'jodhpur', 'Other'),
    (53, 'udaipur', 'Fatehpura'),
    (54, 'udaipur', 'Hiran Magri'),
    (55, 'udaipur', 'Shobhagpura'),
    (56, 'udaipur', 'Bhupalpura'),
    (57, 'udaipur', 'Old City'),
    (58, 'udaipur', 'Other'),
    (59, 'kota', 'Talwandi'),
    (60, 'kota', 'Vigyan Nagar'),
    (61, 'kota', 'Mahaveer Nagar'),
    (62, 'kota', 'Dadabari'),
    (63, 'kota', 'Kunhadi'),
    (64, 'kota', 'Other'),
    (65, 'ludhiana', 'Sarabha Nagar'),
    (66, 'ludhiana', 'Model Town'),
    (67, 'ludhiana', 'Civil Lines'),
    (68, 'ludhiana', 'BRS Nagar'),
    (69, 'ludhiana', 'Dugri'),
    (70, 'ludhiana', 'Haibowal'),
    (71, 'ludhiana', 'Other'),
    (72, 'amritsar', 'Ranjit Avenue'),
    (73, 'amritsar', 'Lawrence Road'),
    (74, 'amritsar', 'Green Avenue'),
    (75, 'amritsar', 'Majitha Road'),
    (76, 'amritsar', 'Walled City'),
    (77, 'amritsar', 'Other'),
    (78, 'gurugram', 'DLF City'),
    (79, 'gurugram', 'Golf Course Road'),
    (80, 'gurugram', 'Golf Course Extension Road'),
    (81, 'gurugram', 'Sohna Road'),
    (82, 'gurugram', 'Sushant Lok'),
    (83, 'gurugram', 'Palam Vihar'),
    (84, 'gurugram', 'Dwarka Expressway'),
    (85, 'gurugram', 'Old Gurugram'),
    (86, 'gurugram', 'Other'),
    (87, 'faridabad', 'NIT'),
    (88, 'faridabad', 'Old Faridabad'),
    (89, 'faridabad', 'Sector 15'),
    (90, 'faridabad', 'Sector 21'),
    (91, 'faridabad', 'Greater Faridabad'),
    (92, 'faridabad', 'Ballabgarh'),
    (93, 'faridabad', 'Other'),
    (94, 'hisar', 'Model Town'),
    (95, 'hisar', 'Urban Estate'),
    (96, 'hisar', 'HUDA Sectors'),
    (97, 'hisar', 'Old City'),
    (98, 'hisar', 'Other'),
    (99, 'panipat', 'Model Town'),
    (100, 'panipat', 'HUDA Sectors'),
    (101, 'panipat', 'Tehsil Camp'),
    (102, 'panipat', 'Old City'),
    (103, 'panipat', 'Other'),
    (104, 'lucknow', 'Gomti Nagar'),
    (105, 'lucknow', 'Hazratganj'),
    (106, 'lucknow', 'Indira Nagar'),
    (107, 'lucknow', 'Aliganj'),
    (108, 'lucknow', 'Alambagh'),
    (109, 'lucknow', 'Aminabad'),
    (110, 'lucknow', 'Chowk'),
    (111, 'lucknow', 'Jankipuram'),
    (112, 'lucknow', 'Other'),
    (113, 'kanpur', 'Civil Lines'),
    (114, 'kanpur', 'Swaroop Nagar'),
    (115, 'kanpur', 'Kakadeo'),
    (116, 'kanpur', 'Kidwai Nagar'),
    (117, 'kanpur', 'Kalyanpur'),
    (118, 'kanpur', 'Govind Nagar'),
    (119, 'kanpur', 'Other'),
    (120, 'noida', 'Sectors 1–39'),
    (121, 'noida', 'Sectors 40–79'),
    (122, 'noida', 'Sectors 80–119'),
    (123, 'noida', 'Sectors 120–168'),
    (124, 'noida', 'Other'),
    (125, 'varanasi', 'Assi'),
    (126, 'varanasi', 'Lanka'),
    (127, 'varanasi', 'Sigra'),
    (128, 'varanasi', 'Bhelupur'),
    (129, 'varanasi', 'Cantonment'),
    (130, 'varanasi', 'Other'),
    (131, 'agra', 'Kamla Nagar'),
    (132, 'agra', 'Dayal Bagh'),
    (133, 'agra', 'Sikandra'),
    (134, 'agra', 'Tajganj'),
    (135, 'agra', 'Shahganj'),
    (136, 'agra', 'Agra Cantt'),
    (137, 'agra', 'Other'),
    (138, 'ghaziabad', 'Indirapuram'),
    (139, 'ghaziabad', 'Vaishali'),
    (140, 'ghaziabad', 'Vasundhara'),
    (141, 'ghaziabad', 'Raj Nagar'),
    (142, 'ghaziabad', 'Raj Nagar Extension'),
    (143, 'ghaziabad', 'Kavi Nagar'),
    (144, 'ghaziabad', 'Other'),
    (145, 'chandigarh', 'Sectors 1–12'),
    (146, 'chandigarh', 'Sectors 14–24'),
    (147, 'chandigarh', 'Sectors 25–35'),
    (148, 'chandigarh', 'Sectors 36–47'),
    (149, 'chandigarh', 'Sectors 48–63'),
    (150, 'chandigarh', 'Manimajra'),
    (151, 'chandigarh', 'Other'),
    (152, 'bengaluru', 'Indiranagar'),
    (153, 'bengaluru', 'Koramangala'),
    (154, 'bengaluru', 'Whitefield'),
    (155, 'bengaluru', 'Jayanagar'),
    (156, 'bengaluru', 'JP Nagar'),
    (157, 'bengaluru', 'Malleshwaram'),
    (158, 'bengaluru', 'Hebbal'),
    (159, 'bengaluru', 'Electronic City'),
    (160, 'bengaluru', 'Other'),
    (161, 'hyderabad', 'Banjara Hills'),
    (162, 'hyderabad', 'Jubilee Hills'),
    (163, 'hyderabad', 'Gachibowli'),
    (164, 'hyderabad', 'Madhapur'),
    (165, 'hyderabad', 'Kukatpally'),
    (166, 'hyderabad', 'Begumpet'),
    (167, 'hyderabad', 'Secunderabad'),
    (168, 'hyderabad', 'Dilsukhnagar'),
    (169, 'hyderabad', 'Other'),
    (170, 'chennai', 'Adyar'),
    (171, 'chennai', 'Anna Nagar'),
    (172, 'chennai', 'T. Nagar'),
    (173, 'chennai', 'Mylapore'),
    (174, 'chennai', 'Velachery'),
    (175, 'chennai', 'Nungambakkam'),
    (176, 'chennai', 'Porur'),
    (177, 'chennai', 'Other'),
    (178, 'kochi', 'Edappally'),
    (179, 'kochi', 'Kakkanad'),
    (180, 'kochi', 'Kadavanthra'),
    (181, 'kochi', 'Vyttila'),
    (182, 'kochi', 'Palarivattom'),
    (183, 'kochi', 'Fort Kochi'),
    (184, 'kochi', 'Other'),
    (185, 'kolkata', 'Ballygunge'),
    (186, 'kolkata', 'Alipore'),
    (187, 'kolkata', 'Park Street'),
    (188, 'kolkata', 'Salt Lake'),
    (189, 'kolkata', 'New Town'),
    (190, 'kolkata', 'Behala'),
    (191, 'kolkata', 'Tollygunge'),
    (192, 'kolkata', 'Shyambazar'),
    (193, 'kolkata', 'Other'),
    (194, 'siliguri', 'Pradhan Nagar'),
    (195, 'siliguri', 'Hakim Para'),
    (196, 'siliguri', 'Ashrampara'),
    (197, 'siliguri', 'Sevoke Road'),
    (198, 'siliguri', 'Other'),
    (199, 'patna', 'Boring Road'),
    (200, 'patna', 'Kankarbagh'),
    (201, 'patna', 'Patliputra Colony'),
    (202, 'patna', 'Rajendra Nagar'),
    (203, 'patna', 'Bailey Road'),
    (204, 'patna', 'Patna City'),
    (205, 'patna', 'Other'),
    (206, 'ranchi', 'Lalpur'),
    (207, 'ranchi', 'Doranda'),
    (208, 'ranchi', 'Harmu'),
    (209, 'ranchi', 'Bariatu'),
    (210, 'ranchi', 'Morabadi'),
    (211, 'ranchi', 'Other'),
    (212, 'bhubaneswar', 'Saheed Nagar'),
    (213, 'bhubaneswar', 'Jaydev Vihar'),
    (214, 'bhubaneswar', 'Nayapalli'),
    (215, 'bhubaneswar', 'Patia'),
    (216, 'bhubaneswar', 'Chandrasekharpur'),
    (217, 'bhubaneswar', 'Old Town'),
    (218, 'bhubaneswar', 'Other'),
    (219, 'cuttack', 'Buxi Bazaar'),
    (220, 'cuttack', 'Badambadi'),
    (221, 'cuttack', 'College Square'),
    (222, 'cuttack', 'Link Road'),
    (223, 'cuttack', 'Tulsipur'),
    (224, 'cuttack', 'Other'),
    (225, 'indore', 'Vijay Nagar'),
    (226, 'indore', 'Palasia'),
    (227, 'indore', 'Rajwada'),
    (228, 'indore', 'Bhawarkua'),
    (229, 'indore', 'Sudama Nagar'),
    (230, 'indore', 'Nipania'),
    (231, 'indore', 'Other'),
    (232, 'bhopal', 'Arera Colony'),
    (233, 'bhopal', 'MP Nagar'),
    (234, 'bhopal', 'Kolar Road'),
    (235, 'bhopal', 'TT Nagar'),
    (236, 'bhopal', 'Bairagarh'),
    (237, 'bhopal', 'Old City'),
    (238, 'bhopal', 'Other'),
    (239, 'jabalpur', 'Napier Town'),
    (240, 'jabalpur', 'Wright Town'),
    (241, 'jabalpur', 'Civil Lines'),
    (242, 'jabalpur', 'Vijay Nagar'),
    (243, 'jabalpur', 'Adhartal'),
    (244, 'jabalpur', 'Other'),
    (245, 'gwalior', 'City Centre'),
    (246, 'gwalior', 'Lashkar'),
    (247, 'gwalior', 'Morar'),
    (248, 'gwalior', 'Thatipur'),
    (249, 'gwalior', 'Gola Ka Mandir'),
    (250, 'gwalior', 'Other'),
    (251, 'raipur', 'Shankar Nagar'),
    (252, 'raipur', 'Civil Lines'),
    (253, 'raipur', 'Telibandha'),
    (254, 'raipur', 'Pandri'),
    (255, 'raipur', 'Devendra Nagar'),
    (256, 'raipur', 'Other'),
    (257, 'bhilai', 'BSP Township'),
    (258, 'bhilai', 'Nehru Nagar'),
    (259, 'bhilai', 'Supela'),
    (260, 'bhilai', 'Smriti Nagar'),
    (261, 'bhilai', 'Other'),
    (262, 'guwahati', 'Dispur'),
    (263, 'guwahati', 'Ganeshguri'),
    (264, 'guwahati', 'Beltola'),
    (265, 'guwahati', 'Chandmari'),
    (266, 'guwahati', 'Paltan Bazaar'),
    (267, 'guwahati', 'Maligaon'),
    (268, 'guwahati', 'Other')
  ) v(ord, city_id, name) order by v.ord;

  -- ---------- Post-checks ----------
  if (select count(*) from public.states) <> 19 then raise exception 'city expansion: expected 19 states after insert'; end if;
  if (select count(*) from public.cities) <> 45 then raise exception 'city expansion: expected 45 cities after insert'; end if;
  if (select count(*) from public.localities) <> 335 then raise exception 'city expansion: expected 335 localities after insert'; end if;
  -- every city has at least two localities and ends with 'Other'
  select string_agg(c.id, ', ') into v_bad from public.cities c
   where (select count(*) from public.localities l where l.city_id = c.id) < 2
      or (select l.name from public.localities l where l.city_id = c.id order by l.id desc limit 1) <> 'Other';
  if v_bad is not null then raise exception 'city expansion: cities without a proper locality list: %', v_bad; end if;
  -- every city belongs to an existing state; every state has at least one city
  if exists (select 1 from public.cities c where not exists (select 1 from public.states s where s.code = c.state_code))
     or exists (select 1 from public.states s where not exists (select 1 from public.cities c where c.state_code = s.code)) then
    raise exception 'city expansion: state/city relationship broken'; end if;
  -- the original five cities and their localities are unchanged
  select string_agg(v.city_id, ', ') into v_bad from (values
    ('surat', 'Vesu|Adajan|Pal|Piplod|Athwa|Ghod Dod Road|City Light|Althan|Bhatar|Dumas|Rander|Varachha|Katargam|Udhna|Other'),
    ('ahmedabad', 'SG Highway|Bodakdev|Prahlad Nagar|Satellite|Thaltej|Vastrapur|Bopal|Navrangpura|Science City|Maninagar|Gota|Chandkheda|Other'),
    ('mumbai', 'Bandra|Khar|Juhu|Andheri|Santacruz|Worli|Lower Parel|BKC|Colaba|Malabar Hill|Powai|Goregaon|Borivali|Chembur|Other'),
    ('pune', 'Koregaon Park|Kalyani Nagar|Viman Nagar|Baner|Aundh|Wakad|Hinjewadi|Kothrud|Magarpatta|Camp|Deccan|Shivaji Nagar|Other'),
    ('delhi', 'South Delhi|Vasant Vihar|Defence Colony|Chanakyapuri|Connaught Place|Rajouri Garden|Punjabi Bagh|Dwarka|Pitampura|Lajpat Nagar|Other')) v(city_id, names)
   where v.names is distinct from (select string_agg(l.name, '|' order by l.id) from public.localities l where l.city_id = v.city_id);
  if v_bad is not null then raise exception 'city expansion: original localities changed for: %', v_bad; end if;
  if (select count(*) from public.states where code in ('GJ', 'MH', 'DL') and name in ('Gujarat', 'Maharashtra', 'Delhi')) <> 3 then
    raise exception 'city expansion: original state rows changed'; end if;
  -- no member, season, ledger, result or reign row was touched
  if (select count(*) from public.members) <> v_members or (select count(*) from public.seasons) <> v_seasons
     or (select count(*) from public.rank_ledger) <> v_ledger or (select count(*) from public.season_results) <> v_results
     or (select count(*) from public.throne_reigns) <> v_reigns then
    raise exception 'city expansion: member, season or ranking data changed'; end if;
  raise notice 'city expansion: 16 states, 40 cities and % localities added; 19 states, 45 cities in total', 268;
end $$;
