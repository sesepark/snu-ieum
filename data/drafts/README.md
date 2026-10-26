# 사람 승인 전 검수 초안

이 디렉터리의 JSON은 Raw DB와 Staging에 반입한 수동 메타데이터의 검수용 사본이다. DB를 대체하지 않는다. `publication: prototype`, `verificationRequired: true`를 유지하며, 사람 검수·승인 전에는 운영 API나 Pages 공개 스냅샷으로 배포하지 않는다.

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
