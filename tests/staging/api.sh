#!/usr/bin/env bash
# Real-stack checks against the STAGING Supabase project (never production): real Auth sign-in, real REST, real roles.
# Usage: tests/staging/api.sh <phase>   phases: auth | social | mechanics
set -uo pipefail
U=https://wxrhwkdymjipaftipbgy.supabase.co; K=sb_publishable_T2yGhTLU0MHEGYLVbkzi2w_rl7lRZYM; PW=${BKP_STAGING_PASSWORD:?Set BKP_STAGING_PASSWORD (staging test accounts only)}
tok() { curl -s --max-time 30 -X POST "$U/auth/v1/token?grant_type=password" -H "apikey: $K" -H "Content-Type: application/json" -d "{\"email\":\"stg-$1@test.invalid\",\"password\":\"${2:-$PW}\"}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token') or 'ERR:'+str(d.get('error_code') or d.get('msg') or d)[:60])"; }
rpc() { # name json [token]  -> "HTTP body"
  local t="${3:-$K}"; curl -s --max-time 30 -w " [%{http_code}]" -X POST "$U/rest/v1/rpc/$1" -H "apikey: $K" -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d "$2" | cut -c1-230; echo; }
tbl() { local t="${4:-$K}"; curl -s --max-time 30 -w " [%{http_code}]" -X "$1" "$U/rest/v1/$2" -H "apikey: $K" -H "Authorization: Bearer $t" -H "Content-Type: application/json" -H "Prefer: return=minimal" ${3:+-d "$3"} | cut -c1-150; echo; }
say() { printf "%-62s " "$1"; }
case "${1:-auth}" in
auth)
  say "sign-in, correct password";             T=$(tok king); echo "${T:0:3}… (${#T} chars)"
  say "sign-in, wrong password";               tok king nope-nope-1
  say "sign-in, unconfirmed email";            tok unconf
  say "sign-up through real Auth (email needed)"; curl -s --max-time 30 -w " [%{http_code}]" -X POST "$U/auth/v1/signup" -H "apikey: $K" -H "Content-Type: application/json" -d '{"email":"stg-newperson@test.invalid","password":"'"$PW"'"}' | cut -c1-160; echo
  say "anon: create_member";                   rpc create_member '{"p_username":"stg.anon","p_display_name":"A","p_date_of_birth":"1990-01-01","p_city":"surat","p_locality":"Vesu"}'
  say "not on allow-list: create_member";      rpc create_member '{"p_username":"stg.outsider","p_display_name":"Out Sider","p_date_of_birth":"1990-01-01","p_city":"surat","p_locality":"Vesu"}' "$(tok outsider)"
  for m in "king surat Vesu false" "ch surat Adajan false" "third surat Vesu true" "fan surat Pal false" "away pune Baner false"; do set -- $m
    say "allow-listed: create_member stg.$1";   rpc create_member "{\"p_username\":\"stg.$1\",\"p_display_name\":\"Stg ${1^}\",\"p_date_of_birth\":\"1990-01-01\",\"p_city\":\"$2\",\"p_locality\":\"$3\",\"p_mystery\":$4}" "$(tok $1)"; done
  say "second profile for the same account";   rpc create_member '{"p_username":"stg.king2","p_display_name":"Twice","p_date_of_birth":"1990-01-01","p_city":"surat","p_locality":"Vesu"}' "$(tok king)"
  say "under 18";                              rpc create_member '{"p_username":"stg.kid","p_display_name":"Kid","p_date_of_birth":"2015-01-01","p_city":"surat","p_locality":"Vesu"}' "$(tok ui)"
  say "signed-in: direct insert into members";  tbl POST members '{"id":"00000000-0000-0000-0000-000000000001","username":"stg.fake","city_id":"surat","locality_id":1}' "$(tok fan)"
  say "signed-in: read others' member rows";    tbl GET "members?select=username" "" "$(tok fan)"
  say "signed-in: read member_private (own only)"; tbl GET "member_private?select=member_id" "" "$(tok fan)" | python3 -c "import sys; s=sys.stdin.read(); print(s.count('member_id'), 'row(s)', s[-6:].strip())"
  say "anon: read registration_allowlist";      tbl GET "registration_allowlist?select=email"
  say "signed-in: add self to allow-list";      tbl POST registration_allowlist '{"email":"x@test.invalid"}' "$(tok outsider)"
  say "signed-in: open the gate";               tbl PATCH "registration_gate?id=eq.true" '{"mode":"open"}' "$(tok outsider)"
  say "signed-in: record_credit";               rpc record_credit '{"p_member":"00000000-0000-0000-0000-000000000001","p_amount_paise":100000,"p_payment_ref":"x","p_captured_at":"2026-01-01T00:00:00Z","p_actor":"x"}' "$(tok fan)"
  say "signed-in: season_clock / schedule_season"; rpc season_clock '{}' "$(tok fan)" | cut -c1-70
  say "signed-in: insert into rank_ledger";     tbl POST rank_ledger '{"member_id":"00000000-0000-0000-0000-000000000001","season_id":1,"kind":"credit","rank_credit_paise":100000,"payment_ref":"x","actor":"x"}' "$(tok fan)"
  say "signed-in: remove_declaration (moderation)"; rpc remove_declaration '{"p_id":1,"p_reason":"x"}' "$(tok fan)" | cut -c1-70
  say "anon: get_me";                           rpc get_me '{}' | cut -c1-70
  say "session: get_me with a valid token";     rpc get_me '{}' "$(tok fan)" | python3 -c "import sys; s=sys.stdin.read(); print('username' in s and 'stg.fan' in s, s[-6:].strip())"
  say "session: get_me with a tampered token";  T=$(tok fan); rpc get_me '{}' "${T%?????}abcde" | cut -c1-70
  ;;
social)
  KING=$(tok king); CH=$(tok ch); FAN=$(tok fan); ANON=$2
  say "follow";            rpc social_action '{"p_action":"follow","p_target":"stg.ch"}' "$FAN"
  say "follow again (no duplicate)"; rpc social_action '{"p_action":"follow","p_target":"stg.ch"}' "$FAN"
  say "Respect";           rpc social_action '{"p_action":"respect","p_target":"stg.ch"}' "$FAN"
  say "Respect again today"; rpc social_action '{"p_action":"respect","p_target":"stg.ch"}' "$FAN"
  say "yourself";          rpc social_action '{"p_action":"follow","p_target":"stg.fan"}' "$FAN"
  say "Mystery member by username"; rpc social_action '{"p_action":"follow","p_target":"stg.third"}' "$FAN"
  say "Mystery member by ANON label"; rpc social_action "{\"p_action\":\"follow\",\"p_target\":\"$ANON\"}" "$FAN"
  say "unknown member";    rpc social_action '{"p_action":"follow","p_target":"stg.nobody"}' "$FAN"
  say "NULL action";       rpc social_action '{"p_action":null,"p_target":"stg.ch"}' "$FAN"
  say "anon";              rpc social_action '{"p_action":"follow","p_target":"stg.ch"}'
  say "direct insert into follows (as self)"; tbl POST follows '{"follower":"00000000-0000-0000-0000-000000000001","followee":"00000000-0000-0000-0000-000000000002"}' "$FAN"
  say "back-dated Respect by direct insert";  tbl POST respects '{"giver":"00000000-0000-0000-0000-000000000001","receiver":"00000000-0000-0000-0000-000000000002","day":"2026-01-01","created_at":"2026-01-01T00:00:00Z"}' "$FAN"
  echo "--- 4 simultaneous rival requests from one member (limit 5; 2 already set)"
  rpc social_action '{"p_action":"rival","p_target":"stg.king"}' "$FAN" >/dev/null; rpc social_action '{"p_action":"rival","p_target":"stg.ch"}' "$FAN" >/dev/null
  for t in stg.away "$ANON" stg.ui2 stg.ui3 stg.ui4 stg.ui5; do ( rpc social_action "{\"p_action\":\"rival\",\"p_target\":\"$t\"}" "$FAN" >/dev/null & ); done; sleep 4
  say "rivals now (public count)"; rpc get_social '{"p_name":"stg.fan"}' | python3 -c "import sys,json; s=sys.stdin.read(); d=json.loads(s[:s.rindex(' [')]); print(len(d[0]['rival_names']), 'rivals;', 'followers of ch =', end=' ')"; rpc get_social '{"p_name":"stg.ch"}' | python3 -c "import sys,json; s=sys.stdin.read(); d=json.loads(s[:s.rindex(' [')]); print(d[0]['followers'], '; Respect =', d[0]['respect_this_season'])"
  say "handles: set (followers only)"; rpc set_my_socials '{"p_instagram":"@stg.ch","p_snapchat":"stg_ch","p_visibility":"followers"}' "$CH"
  say "handles: bad handle";            rpc set_my_socials '{"p_instagram":"bad handle!","p_snapchat":null,"p_visibility":"everyone"}' "$CH"
  say "handles: seen by a follower";    rpc get_socials '{"p_name":"stg.ch"}' "$FAN"
  say "handles: seen by a non-follower"; rpc get_socials '{"p_name":"stg.ch"}' "$KING"
  say "handles: seen signed out";       rpc get_socials '{"p_name":"stg.ch"}'
  ;;
mechanics)
  KING=$(tok king); CH=$(tok ch); FAN=$(tok fan); THIRD=$(tok third); AWAY=$(tok away); ANON=$2
  say "declare: holder for own throne";  rpc declare_for '{"p_level":"city","p_line":0}' "$KING"
  say "declare: vacant throne (Pune)";   rpc declare_for '{"p_level":"city","p_line":0}' "$AWAY"
  say "declare: unknown line";           rpc declare_for '{"p_level":"city","p_line":9}' "$CH"
  say "declare: challenger";             D=$(rpc declare_for '{"p_level":"city","p_line":1}' "$CH"); echo "$D"; DID=${D%% *}
  say "declare: again (already standing)"; rpc declare_for '{"p_level":"city","p_line":0}' "$CH"
  say "declare: anon";                   rpc declare_for '{"p_level":"city","p_line":0}'
  say "declaration, public read";        rpc get_declarations "{\"p_id\":$DID}" | python3 -c "import sys,json; s=sys.stdin.read(); d=json.loads(s[:s.rindex(' [')])[0]; print(d['status'], 'seq', d['seq'], d['c_name'], 'vs', d['h_name'], 'needs', d['required_paise']//100)"
  say "Mystery member declares (label only)"; D2=$(rpc declare_for '{"p_level":"city","p_line":2}' "$THIRD"); rpc get_declarations "{\"p_id\":${D2%% *}}" | python3 -c "import sys,json; s=sys.stdin.read(); d=json.loads(s[:s.rindex(' [')])[0]; print('name shown:', d['c_name'], '| display:', d['c_display'], '| masked:', d['c_masked'])"
  say "holder blocks the Mystery challenger"; rpc block_challenger "{\"p_name\":\"$ANON\"}" "$KING"
  say "public declarations for Surat now";   rpc get_declarations '{"p_city":"surat"}' | python3 -c "import sys,json; s=sys.stdin.read(); print(len(json.loads(s[:s.rindex(' [')])), 'visible')"
  say "holder's block list";                 rpc get_my_blocks '{}' "$KING" | cut -c1-90
  say "back: yourself";                  rpc back_member '{"p_target":"stg.fan"}' "$FAN"
  say "back: not on the board";          rpc back_member '{"p_target":"stg.away"}' "$FAN"
  say "back: contender";                 rpc back_member '{"p_target":"stg.ch"}' "$FAN"
  say "back: a second time (locked)";    rpc back_member '{"p_target":"stg.king"}' "$FAN"
  say "back: direct insert";             tbl POST backings '{"season_id":1,"backer":"00000000-0000-0000-0000-000000000001","target":"00000000-0000-0000-0000-000000000002"}' "$FAN"
  rpc back_member '{"p_target":"stg.ch"}' "$THIRD" >/dev/null; rpc back_member '{"p_target":"stg.king"}' "$AWAY" >/dev/null
  say "backing, public read";            rpc get_most_backed '{"p_city":"surat","p_limit":5}' | python3 -c "import sys,json; s=sys.stdin.read(); print([(r['public_name'], r['backers'], r['rank']) for r in json.loads(s[:s.rindex(' [')])])"
  say "board, public read";              rpc get_board '{"p_level":"city","p_city":"surat","p_locality":null,"p_limit":10,"p_query":null}' | python3 -c "import sys,json; s=sys.stdin.read(); print([(r['rank'], r['public_name'], r['season_score_paise']//100) for r in json.loads(s[:s.rindex(' [')])])"
  ;;
esac
