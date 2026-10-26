# 사람 승인 전 검수 초안

이 디렉터리의 JSON은 Raw DB와 Staging에 반입한 수동 메타데이터의 검수용 사본이다. DB를 대체하지 않는다. `publication: prototype`, `verificationRequired: true`를 유지하며, 사람 검수·승인 전에는 운영 API나 Pages 공개 스냅샷으로 배포하지 않는다.

통합 검수 대상은 상위 `college-draft.json`이다. 교수 36·연구실 36·장비 20·공간 12, 관계 36, 논문 근거 12건을 담는다. `compile-draft.ts`가 아래 개별 초안을 결정적으로 합친다. 통합 payload도 Raw ID `76e033a90d85175ff306f06eda582646ab143deade7c5358482ffde78b7e3e8f`, pending Staging ID `639b8119-137c-4d4d-a6c4-707b32e18e5b`로 별도 반입했다. 공개 승인/active 배치는 0이다. 학과별 교수의 분야 대표성·공식 사실·이용 조건을 사람이 검수한 뒤 이 통합 초안을 승인한다.

아래의 최초 반입 ID는 이력이다. 논문 근거 추가 이전 교수·연구실 초안의 현재 상태는 `needs_revision`이며, 최신 검수 대상은 뒤의 “논문 근거 추가 후 현재 검수 대상” 표에 있다.

## 공용 장비·공간

`shared.json`은 기초과학공동기기원 장비 20개, 공대 공용 공간 10곳, 공식 장비 설치실 2곳을 수록한다. 장비명·모델·호실은 각 기기 ID의 공식 상세에서 확인했다. CD의 `407호`, MICADAS의 `152호`처럼 건물이 생략된 호실은 건물을 보충하지 않았다. 설치실은 자유 이용·예약 가능 공간이라는 뜻이 아니다.

전자현미경·시편제조·분광·표면·원소·질량·자기공명·X선·세포·연대 측정의 서로 다른 장비를 골랐다. 같은 PC 여러 대를 별도 장비로 세지 않았다. 장비–공간 관계 3개는 300kV Cryo-EM, Vitrobot, 300MHz NMR의 상세에 명시된 호실만 연결한다. 시설 안내에 있는 오래된 PC 사양은 현재 사양으로 단정하지 않는다. 가격·교육 수료·사용 가능 여부는 별도로 추정하지 않는다.

2026-10-26 공식 보유기기 상세와 공대 지원시설 안내를 확인해 최소 사실을 직접 작성했다. 담당자 이름·개인 이메일·전화·사진·HTML·PDF는 반입하지 않았다. 필드 제외 사실은 이 기록으로 남긴다. `source-policies/manual-facts.json`은 이 직접 작성한 payload 반입 전용이다. `official` 명령이나 원문 HTML 저장에 사용하지 않는다. 원문 복제 허가를 의미하지 않는다.

실제 로컬 PostgreSQL 17 / pgvector에 전체 payload를 불변 Raw로 기록한 다음 Staging으로 반입했다.

| 항목 | 값 |
| --- | --- |
| run ID | `6fc78c43-b61e-463c-8c23-290632861f9d` |
| Raw ID | `001278460985f9342b162ae6b8a3f668b01b99977446bb51a105abea4b050a59` |
| Staging ID | `79d1870d-606a-4352-af1b-8f4128d84534` |
| 상태 | `pending` · 승인 배치 0 · active 배치 0 |

개발용 DB는 `127.0.0.1:55440/ieum_curation`, 클러스터는 `~/.local/share/snu-ieum/curation-pg`다. 테스트 DB와 분리했다. 로컬 dump는 `~/.local/share/snu-ieum/curation-20261026.dump`에 보관했다. 이 로컬 사본은 운영의 암호화·별도 기기 백업 완료를 뜻하지 않는다.

후속 반입은 해당 JSON과 반입 전용 Policy를 worker `import` bundle에 넣어 수행한다. 자세한 명령은 [CONTRIBUTING.md](../../CONTRIBUTING.md) §12와 [운영 문서](../../infra/OPERATIONS.md)를 따른다. 사람은 공식 출처를 다시 확인하고 운영 전용 review/publish로 승인한다. 에이전트 확인을 사람 승인으로 기록하지 않는다.

## 건설환경도시·기계·산업

`cee.json`, `mechanical.json`, `industrial.json`은 각각 교수 3명·연구실 3곳과 공식 지도교수 관계 3개를 수록한다. 분야별 선정 이유는 각 manifest에 있다. CEE는 공식 교수 카드의 전공과 연구실명, 기계는 전임교수 카드의 전공·연구실, 산업은 연구실 소개의 지도교수 항목을 직접 대조했다. 공식 소속·카드·연구실명으로 식별했고 이름만으로 다른 데이터원의 연구자를 병합하지 않았다.

| 초안 | Raw ID | pending Staging ID |
| --- | --- | --- |
| cee | `c156fe78dd748dd2e6afaee1e3d9895fe1f799fb314e986b0332fa1af34ade5b` | `c2d1155c-2e98-4851-885f-69accaa84a69` |
| mechanical | `b6c460a8ef0efc4ce476f197e0393bc1dabda6df9ff0ac3f24cc950c607a3770` | `e5744ee6-4558-41ce-a9ba-5884793d66ad` |
| industrial | `0a6cfdcc1fe5e5b2dae5dc4192b80f70901948ceeb6ee5ce9c35914833f6b797` | `0992e407-aaa4-47ae-bbdc-8c7e5b8da841` |

세 초안 모두 해당 학과 호스트·공식 목록/상세 경로로 한정한 `manual-facts-1` Policy를 DB run에 기록했다. 개인 연락처·전체 원문은 반입하지 않았다. 논문 근거는 후속 검수에서 추가한다.

## 에너지·원자핵·재료

`energy.json`, `nuclear.json`, `materials.json`은 각각 교수 3명·연구실 3곳과 공식 지도교수 관계 3개를 수록한다. 에너지는 전임교수 상세 소개에서 연구실명과 주제를 확인했다. 원자핵은 연구실 카드와 [전임교수 명단](https://nucleng.snu.ac.kr/about/people/faculty)을 대조했다. 재료는 학과의 공식 교수 소개에서 연결한 연구실 홈페이지·Professor/PI 페이지를 대조했다. 학과 페이지에 없는 연구실 고유명이나 동명이인 식별을 추정하지 않았다.

| 초안 | Raw ID | pending Staging ID |
| --- | --- | --- |
| energy | `f664b4668be894db14a70a2835543a346b0e3329b4740910c61b57746ebd83c0` | `a1a9565b-de9f-4bf4-b9ec-68bf668ff970` |
| nuclear | `07a04cdc54a8c69a6294a7c2056361d2db04042d8aa9b87c76548cdf8b21761c` | `bc19349e-87e7-4952-826a-04a8268e4e7b` |
| materials | `1a020697e86a932f847443ce4e386e07b54f98aca72ee62164d488b8b8338467` | `5cbc951f-20ed-4b0c-bce1-0dd89e862d13` |

공식 링크를 통해 확인한 외부 호스트도 원문 보관·재배포 허가로 취급하지 않는다. robots 제한·접근 실패한 연구실은 우회하지 않고 선정에서 제외했으며, 기록은 source-policies에 남겼다. 수동 사실 payload만 Raw/Staging에 반입하고 사람 승인 전 상태를 유지했다.

## 전기정보·조선해양·항공우주

세 파일은 각각 교수 3명·연구실 3곳·명시된 교수 관계 3개를 수록한다. `ece.json`은 개별 labidx 상세의 지도 필드를 사용해 연구그룹과 개별 연구실을 구별했다. `naval.json`은 전임교수 카드의 연구실명, `aerospace.json`은 같은 표 행의 교수와 연구실명을 확인했다. 학과 공식 자료와 다른 데이터원의 같은 이름을 자동 병합하지 않았다.

| 초안 | Raw ID | pending Staging ID |
| --- | --- | --- |
| ece | `44df15bb3a4b70f26a98dd0d2de5b256068f726636c8a0e83a7dd846a9461f82` | `841cbf3a-2fb4-43ad-8f7f-1a45a23a55c6` |
| naval | `41a4fb6ba164ee4d48b923958aef8a07d17ef22f41e5ce8fc269ca1be32ea81a` | `51710656-7bb0-4c23-8bcc-73d081e51287` |
| aerospace | `dbc0a3438a48e8fa4be69a3ed4e8eb064e9e666165c2331b2705289c4e68e336` | `453e2fa1-a65f-4003-83b2-eaf29fb4f95a` |

## 화학생물·컴퓨터

`chemical.json`은 공식 교수 목록에서 연결되는 상세 보기의 교수명·연구실명·연구 분야를 대조한 3쌍이다. 목록의 JavaScript/form에 있는 공개 `updtView.do` GET 경로를 읽었으며, 수정·신청 요청을 하지 않았다. 소프트전자·촉매·재생바이오를 선정했다.

`cse.json`은 처음 확인한 표본을 날짜·공식 상세 ID·출처를 유지해 Raw/Staging으로 반입한 것이다. robots 응답을 확인하지 못해 추가 네트워크 수집은 하지 않았다. 수동 payload 보관은 자동 수집 허가를 의미하지 않는다.

| 초안 | Raw ID | pending Staging ID |
| --- | --- | --- |
| chemical | `e77119aa5213ba86af4418ca4875d0f834372d5cb78398efb3a1e43ed9db4e1e` | `189e86ef-db3c-432d-ba45-367a26e39d6a` |
| cse | `c32d62da34e256d8ab02975b7c583fe36b0179111c9d830fd985490c6076da6a` | `3daf71bf-8e4d-447d-8733-35fc55a94965` |

## 건축학과의 별도 공식 목록

`architecture.json`은 학과 호스트에 접근하지 않고 공대 본부의 별도 공식 교수검색 목록과 건축학과 대학원 안내를 사용했다. 교수 3명과 역사·도시공간·구조공학 연구실 3곳을 수록했다. 교수별 연구 분야·선정의 대표성·지도 연구실은 확인하지 못했으며, 교수와 연구실을 짝짓거나 관계를 만들지 않았다. 따라서 수량 확보가 공개 데이터 검수 완료를 의미하지 않는다. 이 검수는 #33에 남긴다.

Raw ID는 `986ddaa2e6043aa572534eff2fc78f56cb2849cbdce45f7809bb3bdaffc32ad2`, pending Staging ID는 `28de2c38-61d2-4bea-a604-e1fbf5b5fee7`이다. 모든 자원의 verificationRequired는 true이고 사람 승인 배치는 없다.

## 논문 근거 추가 후 현재 검수 대상

12개 학과에 근거 논문을 1건씩 추가했다. 공식 교수/연구실 목록 또는 공식 게재·수상 안내에서 **제목과 해당 연구자 이름이 함께 있는지** 다시 확인했다. 건축학과는 강현구 교수에만 논문을 연결하고 미확인 연구실 관계는 만들지 않았다. 논문 유사도는 사용하지 않았다. 학과별 title·source·resource ID는 각 evidence 필드에 있다. 논문의 출판 연도와 source의 확인일은 다르며 확인일을 출판일로 취급하지 않는다.

이전 교수·연구실 초안 12건은 내용이 보존된 채 `needs_revision`으로 이동했다. 에이전트가 기록한 사유는 논문 근거를 추가한 새 초안으로 교체한다는 운영 기록이다. 사람 승인 기록이 아니다. 이전 Raw는 변경하지 않았다. 현재 검수 대상은 아래 12건과 shared 초안 1건이며, 승인/active 배치는 0이다.

| 학과 | 최신 Raw ID | pending Staging ID |
| --- | --- | --- |
| cee | `22d644accef2113ec88955c285599b4d4978b32ef14b2f8c950a27c3d54bbaee` | `39abc2a6-8385-467b-9d48-e70706ebaf5c` |
| architecture | `bd8093126578036fb3098eb59ba15e41c0b89e5c40380d98b64f3bd4d22ac6af` | `1aadff07-2f8d-431f-a54c-77068492c3ca` |
| mechanical | `ef2464760dfd918451a2045bcbb025753a6dd393587f11bb55b891e2dcc99a55` | `a1530d27-4c7a-4da1-8530-615f23c934dd` |
| industrial | `b532124678ca732bc516de0263c58b78e0174c358818adcbaaa0250e3f268cc2` | `fd4fd48b-2b57-4700-8e99-f908900c9655` |
| energy | `55bd91976a014852c575ef398bf610617315124928f6e9ff3c644aff593ee8e5` | `5f4acaa6-b044-4b53-b4b1-d880b0610655` |
| nuclear | `c5c38524c237cb2f931c1faae6e976a27cd4dd2590881511e51f52f379ad87af` | `84b61c32-e0fa-4658-b4b3-6256f01af477` |
| materials | `23f6d01890f126b8b1b7aed4b77b14ef5f4f42b557ebc798dba51496b93aaa49` | `2c4738d9-797c-41a0-8729-2601d4aa3eca` |
| ece | `4b1ea47cae96074f1da20e8e74721bd8d05e36445bdea0b45716f86c7f53d45b` | `2aa4add9-18e6-48ff-ac4e-110e007a7835` |
| naval | `36c64f7e87f11aef34339951a791f3d29a7ea9012843c7739b8c66928c98065f` | `1ead2e0a-70be-492a-a1b7-a57cce24e572` |
| cse | `1792b93cb385193bb11d9dce90d3818a04b03f05367161960777af0e8f25e0f0` | `c2ad7847-ba59-48ec-9a7f-feb205ed6b04` |
| aerospace | `4bc7be648469d421164584d77bd469079ff444d3298acfb95fb5c8811fc50d1e` | `c832b6d7-7fe5-4c9a-9d80-1a42413de374` |
| chemical | `89e3340703600b25cb6ed938026f67493e9e55163c692e7cf5133593e2d745dd` | `3e95674b-f32c-42b0-82ad-ac9b789287da` |

실제 DB에서 각 최신 Raw payload와 검수 JSON의 모든 필드가 같은지 대조했다. 원문 HTML/PDF/개인 연락처는 보관하지 않았다. CSE robots는 curl의 정상 TLS 검증으로 재확인했고, 공식 연결 Publications URL에서 200 응답과 Chenglin Fan의 논문을 확인했다. 원래 한글 홈 링크는 404로 검수 기록에 남겼다.

## 공식 교수검색 전체 후보 · 2026-10-27

`faculty-inventory.json`은 공대 공식 교수검색 전체 23페이지의 이름·소속·직위 333행 중 대상 12개 학과 319행에서 기존 교수와 일치하는 34건을 제외하고, 영문 신원 미확인 두 건을 자동 병합하지 않아 추가한 283개 후보다. 기존 교수 36명과 합쳐 총 319개이며 현직 전임 319명이 검증됐다는 뜻이 아니다. 같은 학과의 이종호 두 행은 별도 ID로 유지했다. 교수별 분야·홈페이지·주소·논문은 추정하지 않았다.

공식 검색과 학과 목록은 수량 차이가 있어 전체 분모를 미확정으로 유지한다. CSE의 기존 영문 이름 두 건과 한글 명단 연결은 검수 대기다. source별 Raw는 data/coverage/directory-ingestion.json에, 추가 교수 초안 Raw `e4e53ba88d41374dfdf5e28ee072fd0f58e27b7f3b64fde3e24c8989e475b6cf`·pending Staging `0c126c4a-f71b-409d-bc42-4acdd5d28408`은 전용 로컬 DB에 있다. 원문 HTML·개인 연락처·사진·CSRF 값은 보관하지 않았다.

## 원자핵·항공우주 전체 연구실 목록

`nuclear-inventory.json`, `aerospace-inventory.json`은 공식 연구실 목록 각 14곳에서 기존 3곳을 제외한 연구실 11곳씩을 추가했다. 공식 카드의 지도교수 이름과 같은 학과의 유일한 연구자 후보가 일치하는 경우에만 관계를 추가했다. 동명이인이 있거나 일치하지 않으면 관계를 만들지 않았다. `campus-sources.ts`는 연구실별 섹션/행에서 주소를 읽고 전화·이메일을 제외한다. Raw/Staging ID는 data/campus/lab-inventory-ingestion.json에 있다. 원문 전체는 보관하지 않았다. 교수 현재 소속은 여전히 학과 명단과 교차 검수 대상이다.

## 장비 전체 목록과 공간 확장 · 2026-10-27

`irf-inventory.json`은 공식 보유기기 이름순 55개 전부를 대조해 기존 20개와 같은 ID를 유지하고 새 35개만 추가한다. `isrc-inventory.json`은 공개 장비소개 133항목 중 장비가 아닌 의뢰자 호출 1개를 제외한 132개 후보다. 기존 IRF와 ISRC 원자료의 자산 식별자 대조 전에는 물리 장비 187대가 확정됐다고 표시하지 않는다. 원문 명칭·모델·기능·NFEC 번호가 있는 경우 필드 출처로 보존했고 장비 담당자·연락처·사진·회원·예약 정보는 제외했다. ISRC 기관 주소의 104/104-1/104-4동을 개별 장비 설치 위치로 전파하지 않았다.

`cbe-equipment.json`은 공동기기실 22행의 이름·모델·설치장소다. JP/D/MAX-2500H의 37-204와 302-214는 같은 자산의 이전 위치인지 다른 장비인지 확인 전 별도 후보로 보존한다. `gece-spaces.json`은 공대 공식 시설 안내의 개별 명명 공간 8개를 추가했다. 이름 없이 8실/5실로만 알려진 세미나실·강의실은 한 공간군으로 보존해 개별 호실로 쪼개지 않았다.

전체 카탈로그의 장비 209개·공간 20곳은 수록 후보량이며 모든 필수 정보·위치·중복·현재 이용 안내까지 검수한 수량이 아니다. 새 기준 충족량은 data/coverage/report.json에서 별도로 계산한다. Raw/Staging ID는 data/campus의 equipment-ingestion.json, isrc-ingestion.json, cbe-equipment-ingestion.json, space-ingestion.json에 있다. ISRC 첫 페이지네이션 시도는 failed run이며 성공 run과 분리했다.

신소재공동연구소 robots는 전체 Disallow를 확인해 추가 자동 수집을 중단했다. 정책 확인과 같은 루프에서 이미 받은 원문 임시 파일은 삭제했으며 Raw·Staging·저장소에 반입하지 않았다. 이 소스는 허용된 공식 제공·수동 반입 경로 확인 전 목표 수량에 포함하지 않는다.

## 산업·원자핵·항공우주 현직 명단과 정보별 상세

산업 현직 14명과 연구실 15곳을 전체 대조해 분야·공식 홈페이지·소속·확인일과 교수실/연구실 주소를 각각 기록했다. 연구실 12곳과 원자핵 교수 3명·항공우주 교수 1명을 추가했으며 새 교수 4명은 학과 목록과 공대 교수검색의 차이를 확인 대기로 유지했다. 전체 초안은 교수 후보 323명·연구실 70곳·장비 후보 209개·공간 20곳·출처 있는 관계 65개다.

새 공식 분야는 출처와 함께 요약·검색어에 반영했다. 기존 ID가 여러 검수 조각에서 재사용된 경우 내용을 동일하게 갱신했으며 compile-draft는 다른 내용의 중복 ID를 계속 거부한다. 새 원문/연락처를 복제하지 않고 각 공식 페이지의 명단·분야·홈페이지·주소 최소 사실을 Raw로 남겼다. 과거 파서가 제목 셀을 값으로 읽거나 AI 약어를 자른 Staging 5개는 needs_revision으로 표시했고 Raw는 수정하지 않았다. 최신 source별 ID는 data/campus/department-profile-ingestion.json을 따른다.

재수집은 `DATABASE_URL=... node --import tsx apps/worker/src/department-profiles-cli.ts <config.json>`을 사용한다. config는 policies(검토한 호스트/경로·보관 조건)와 outputDirectory를 요구한다. CLI는 Raw→pending Staging과 실행 기록만 만들며 반복 실행해도 canonical 초안이나 승인 배치를 수정하지 않는다. 검수자는 후보를 공식 ID와 대조한 뒤 통합 초안/coverage에 반입한다. CSE/건축 등의 기존 접근 제한을 이 CLI로 우회하지 않는다.
