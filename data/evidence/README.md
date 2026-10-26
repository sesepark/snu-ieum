# 논문 메타데이터와 공식 저자 신원 검수

OpenAlex의 서울대 기관 `I139264467` 결과는 공대 검수 완료 논문이 아니다. `openalex-candidates.json`은 2022–2026년 기관 소속 결과의 bibliographic metadata 후보이며, 공식 현직 교수·연구실 신원 대조와 논문 검수 전에는 수록률 1,000건 목표나 최근 교수 근거에 산입하지 않는다. 초록·원문·사진·연락처는 수집하지 않는다. 논문은 독립 탐색 자원이 아니다.

[OpenAlex 인증 안내](https://help.openalex.org/api/authentication/)에서 keyless basic paging 10,000개 이내를 허용하고 cursor paging에 키를 요구하는 것을 2026-10-27 확인했다. 익명 호출의 실제 응답에서 일일 잔여 credit와 사용량을 확인하고 고정된 소규모 페이지 수·예산 안에서 중단했다. 무료 계정 인증·계정의 $1 한도 검증 완료를 뜻하지 않는다. 페이지의 source URL에는 키·사용자 목표·개인정보를 넣지 않는다.

`apps/worker/src/research-evidence-cli.ts collect <config.json>`은 전용 DATABASE_URL, 검토한 Policy, outputDirectory, 최대 10페이지, startPage, maxCredits를 요구한다. 기본 페이지당 100개이며 오류·한도에 도달하면 멈춘다. 각 페이지에서 허용 필드를 고른 뒤 Raw에 보관하고 pending Staging을 생성한다. 원본 전체를 허용하지 않는 출처에서 전체 payload/HTML 저장을 가장하지 않는다. OpenAlex 메타데이터는 CC0이며 출처 URL·확인일을 유지한다.

`author-identities.json`은 아직 빈 장부다. 각 항목은 resourceId, openalexAuthorId, 공식 source ID들, verified/needs-review/rejected, 확인일, 근거를 요구한다. 이름·같은 기관만으로 자동 승인하지 않는다. 병원·과거 소속·동명이인·저자 프로필 분리/병합과 ORCID 공개 식별자를 대조한다. OpenAlex author 하나를 여러 공식 교수로 연결하거나 공식 교수 하나의 여러 author ID를 조용히 합치면 중단한다.

`reconcile` config는 snapshot, candidates, identities, output 경로를 요구한다. 검증된 공식 저자 ID와 논문의 서울대 소속이 모두 맞아도 논문은 needs-review로 내보내며 사람이 제목·DOI·연도·교수 신원·철회/정정 여부를 대조한 뒤 coverage works에 반입한다. 검수되지 않은 저자나 철회 표시는 pending 사유로 남긴다. DOI 정규화로 중복을 제거하고 DOI가 없는 경우 OpenAlex ID를 사용한다. 최근 5년·학과별 교수 분모와 논문 3건 기준은 별도 품질 보고에서 계산한다.

Crossref는 DOI 서지·정정/철회 대조, ORCID는 공개 식별자 대조 보조로 사용하며 원문·초록 권리를 자동 허용하지 않는다. PURE·S-Space·접근 제한 공식 호스트는 허용된 제공 경로 전까지 대량 수집하지 않는다.
