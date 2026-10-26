# 공식 분모·상세·논문 검수

`coverage-draft.json`은 기존 3명/3곳 표본을 전체 목록으로 오인하지 않도록 12개 학과·2개 종류의 전체 분모를 **미확정(null)** 으로 남기는 검수 장부다. 초기 entries는 전수 대조 전이므로 needs-review다. 확보가 어려운 대상을 삭제하거나 표본 수를 분모로 쓰지 않는다.

공식 목록을 직접 대조한 뒤 externalId·현직/현행 이름·sourceIds·checkedAt을 기록하고 matched/missing/needs-review로 구분한다. 동일한 자원을 여러 공식 인물에 자동 연결하지 않는다. 분모가 완성된 경우에만 complete=true를 부여한다. 원래 목록의 미수록 항목도 entries에 남긴다.

profiles에는 분야·공식 홈페이지·소속, 장비 모델·용도·운영기관·공식 이용 안내 등 **필드별 값·출처·확인일**을 적는다. 페이지 열람일을 원문 갱신일로 바꾸지 않는다. 단순 URL 존재를 이용 자격 확인으로 해석하지 않는다.

works는 paper/thesis를 구분하고 DOI/OpenAlex ID·연도·저자 신원 확인 source를 기록한다. 저자 이름만 일치하면 verified로 바꾸지 않는다. DOI 중복·정정/철회·과거 소속·병원 소속·최근 5년 여부를 검수한다. 기존 논문 근거 12건도 이 새 전수 신원·연도 검수 전이므로 1,000건 목표에 자동 산입하지 않는다. 최근 5년은 실행 UTC 연도를 포함한 5개 발행연도로 계산한다.

보고서는 다음 명령으로 생성한다. config 필드는 snapshot, campus, coverage, output의 파일 경로다.

```sh
node --import tsx apps/worker/src/campus-cli.ts coverage <config.json>
```

미확정 분모의 비율은 null이며 목표 미달로 남긴다. 필드·주소의 월간/주간 확인 기한이 지난 자원은 최신 상세/위치 충족량에서 제외한다. 보고서 ready는 데이터 목표·사람 승인 조건이며 실제 사용자 평가·계정·운영 복구를 대신하지 않는다.
