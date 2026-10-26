# 관악 공간 검수 초안

`campus-draft.json`은 실제 OSM 윤곽·도로·보행로와 공식 지도 건물 최소 사실, Copernicus DSM의 **미승인 개발용 공간 스냅샷**이다. 연구 배치 `resourceVersion`이 맞을 때만 위치 연결을 사용한다. 공식 건물 128개 식별과 실제 윤곽 259개를 결합했으며 겹치는 식별/윤곽은 합쳐 총 282개 레코드다. 이 수량은 관악 전수 건물 수가 아니다. 공식 강의동 응답 88건에 공식 검색에서 확인한 공동기기원 139동·139-1동·엔지니어하우스 310동을 보완한 뒤 공식 건물 검색의 추가 최소 사실을 반영했다. 위치 사실을 가진 수록 자원은 65개이며 재확인 기한·연구 배치 검증에 따라 지도 표시 수는 달라진다. 공식 목록 전수 여부는 false다.

- OSM: © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). 2026-10-27 고정 범위에서 단발성 원자료를 확보했다. 반복 조회·서비스 운영에 OSM 편집 API를 사용하지 않는다. [정책](https://operations.osmfoundation.org/policies/api/)에 따라 갱신은 허용된 지역 추출본·Overpass 또는 자체 추출로 수행한다. Overpass 최초 시도는 timeout/HTTP 406/502로 실패했고 성공으로 기록하지 않았다. 원자료의 편집 사용자 식별자·연락처는 보관 대상에서 제외했다. 허용 geometry/tag 최소 payload를 Raw에 기록한 뒤 canonical 초안을 만들었다.
- 공식 지도: [서울대 캠퍼스맵](https://map.snu.ac.kr/web/main.action). `/api/getClassLatLon.action` 및 공개 검색 응답에서 건물번호·명칭·경위도 최소 사실만 직접 선정했다. 전화·사진·호실 수업표·주차장·신청 정보와 원문 응답은 보관하지 않았다. robots.txt 404를 수집 허가로 해석하지 않는다. 원자료 재배포·정기 자동 수집 허가는 미확인이다.
- 윤곽 결합: 공식 좌표를 단 하나의 OSM 폴리곤이 포함할 때만 연결하며 `candidate`로 보존한다. 인접 건물로 임의 스냅하지 않는다. 공식 좌표만 있는 건물은 윤곽 미확인 사유를 표시한다. 공식 좌표와 연구 자원 주소의 근거는 별개다.
- 위치: 기존 공식 검수 초안에 건물번호가 명시된 장비·공간과 공대 시설 안내만 연결했다. 교수실을 연구실로 전파하지 않았다. 504동을 500동으로 임의 정규화하지 않고, 건물이 생략된 호실은 미확인으로 남겼다. `verified`는 출처 기반 사실 대조 상태이며 사람의 공개 승인 상태는 manifest가 담당한다.
- 높이: OSM height는 원문 수록값이며 독립 실측 여부 미확인이다. 층수×3m는 개략 환산이다. 높이 미확인 건물은 UI의 개략 형태이며 정확한 층수를 뜻하지 않는다.
- DSM: `terrain-provenance.json`에 타일 URL·해시·crop window·원자료 위치와 Raw ID가 있다. N37E126 GLO-30은 건물·식생을 포함한 표면 자료다. 격자 크기는 97×79이며 native window를 사용한다. 건물 주변 정밀 지면고도·실내 위치로 쓰지 않는다. 원본은 전용 로컬 Raw 볼륨에 남기고 저장소에는 추출 격자만 포함한다. 지형 고도는 해수면 기준 미터, 행은 북→남이다.

`ingestion.json`, `location-ingestion.json`, `terrain-provenance.json`은 실제 전용 로컬 PostgreSQL `127.0.0.1:55440/ieum_curation`의 Raw/Staging 기록이다. 사람 승인·운영 배치·출시 검증이 아니다. 로컬 파일은 검수용 사본이다.

새 수입은 `node --import tsx apps/worker/src/campus-cli.ts build <config.json>`을 쓴다. config는 osmXml, officialFacts, snapshot, output, sourceUrl, 검토한 policy를 요구한다. DATABASE_URL 없이 Raw를 파일로 대체하지 않는다. 빌드는 사람 승인 전 prototype만 만든다. 이 CLI는 공식 지도 API의 정기 자동 수집을 활성화하지 않는다. 지형·추가 위치 등은 별도 Raw와 함께 재검수한다.
