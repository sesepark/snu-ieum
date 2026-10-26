# 실제 캠퍼스 연구지도 실행 계획

2026-10-27 사용자 요청을 IMPLEMENTATION.md에 반영했다. 이 문서의 수량은 목표다. 사람 승인·학생 평가·무료 계정 실응답·공식 목록 전수 대조가 끝났다는 기록이 아니다.

## 데이터원과 채택 기준

| 출발 소스 | 역할·제약 |
| --- | --- |
| [서울대 캠퍼스맵](https://map.snu.ac.kr/web/main.action) · [공식 안내](https://cals.snu.ac.kr/about/campus/map) | 건물번호·명칭·위치 대조. 공개 API·원자료 재배포 허가 별도 확인 |
| [OSM](https://www.openstreetmap.org/copyright) | 윤곽·도로·보행로·녹지. ODbL·출처 표시, 공용 타일 서버에 무제한 이용 의존 금지 |
| [Overture Buildings](https://docs.overturemaps.org/guides/buildings/) | OSM 누락 보완. 원자료별 출처·릴리스·라이선스 보존, 공식 식별 대조 |
| [Copernicus DEM](https://registry.opendata.aws/copernicus-dem/) | 30m급 DSM 큰 지형. 건물/식생 포함, 정밀 지면·실내 모델 금지 |
| [S-MAP](https://smap.seoul.go.kr/) · [서울시 오픈랩](https://openlab.eseoul.go.kr/) · 브이월드 · 국토정보플랫폼 | 관악 제공 범위·외부 이용 조건 확인 후 정밀 보강 후보 |
| [tt-wizard topo](https://github.com/archi142857/tt-wizard/blob/main/docs/topo.md) | 참고만. 배포 가능 자산으로 전제하지 않음 |

2026-10-27 공식 문서에서 OSM의 ODbL·attribution, Overture의 건물/부분 구조와 ODbL, Copernicus의 DSM·30m 설명, OpenAlex 무료 계정 일일 $1 안내를 확인했다. 이는 지역별 파일 확보나 계정 인증을 확인했다는 뜻이 아니다. 원본 HTTP 조회·가공·검수 기록을 별도로 남긴다.

| 학과 | 공식 교수·연구실 출발 URL |
| --- | --- |
| 공대 기준 | https://eng.snu.ac.kr/about/organization/professor?sc=y |
| 건설환경도시 | https://cuee.snu.ac.kr/bbs/board.php?bo_table=sub2_1 |
| 건축 | https://eng.snu.ac.kr/academics/graduate-programs/architecture-and-architectural-engineering 및 공대 교수검색. 기존 건축 호스트 접근 제한 유지 |
| 기계 | https://me.snu.ac.kr/사람들/교수진/교수/ · 사용자 조사에서 timeout, 재확인 |
| 산업 | https://ie.snu.ac.kr/professor/ 및 공식 연구실 메뉴 |
| 에너지 | https://ere.snu.ac.kr/bbs/board.php?bo_table=sub2_1 |
| 원자핵 | https://nucleng.snu.ac.kr/about/people/faculty · https://nucleng.snu.ac.kr/research/lab |
| 재료 | https://mse.snu.ac.kr/snumse-main/people/professors/ |
| 전기정보 | https://ece.snu.ac.kr/research-faculty/faculty/full-time · https://ece.snu.ac.kr/research-faculty/research/lab |
| 조선해양 | https://naoe.snu.ac.kr/about/people/faculty |
| 컴퓨터 | https://cse.snu.ac.kr/en/people/faculty |
| 항공우주 | https://aerospace.snu.ac.kr/about/faculty · https://aerospace.snu.ac.kr/research/laboratories |
| 화학생물 | https://cbe.snu.ac.kr/cbe/pgm/professorMng/list.do?profCate=66&menuNo=300015 |

목록과 공식 연결 Research·Publications·Contact에서 분야·지도교수·논문·주소를 대조한다. 페이지 공개를 자동 수집·HTML 보관 허가로 해석하지 않는다. 기존 source-policies 제한을 유지한다.

| 시설 소스 | 범위·주의 |
| --- | --- |
| https://irf.snu.ac.kr/possessed_device/possessed_device.php | 장비·모델·설치 호실·공식 이용 안내 |
| https://riam.snu.ac.kr/sub.php?code=ZESrM6 | 재료 분석 장비·설치 건물. 서로 다른 사이트 장비 중복 대조 |
| https://isrc.snu.ac.kr/ | 공정·측정 장비·배치·공식 이용 절차 |
| https://cbe.snu.ac.kr/cbe/main/contents.do?menuNo=300033 | 학과 공동기기 |
| https://eng.snu.ac.kr/about/support-facilities/GECE | 화상강의·촬영·편집·세미나 |
| https://eng.snu.ac.kr/about/support-facilities/sinyang-library | 학습·출력·PC. 오래된 사양은 현행으로 단정하지 않음 |
| https://eng.snu.ac.kr/about/support-facilities/engineering-house | 대강당·산학강의실·수용 규모·공식 예약 경로 |
| https://snuecc.mycafe24.com/board/infor.php | 제작·안전교육·장비 안내. 운영 주체·현재 장비 대조 |

장비 설치실과 학생 이용 공간을 구분하며 예약 일정·신청자 정보는 수집하지 않는다.

| 논문 소스 | 채택 범위 |
| --- | --- |
| https://openalex.org/I139264467 | 서울대 I139264467 / ROR 04h9pn542. 현직 공대 신원 확인 전 전체 소속 결과를 공대로 세지 않음 |
| https://www.crossref.org/documentation/retrieve-metadata/rest-api/ | DOI·제목·저자·발행일·정정/철회 대조. 초록 권리 별도 확인 |
| https://info.orcid.org/documentation/api-tutorials/api-tutorial-read-data-on-a-record/ | 공개 식별자·소속·성과의 동명이인 대조 보조 |
| https://eng.snu.ac.kr/research/research-achievements | 최신 주제·교수·논문 연결 |
| https://snu.elsevierpure.com/ | 대량 수집은 데이터 마이닝 권리·허가 확보 이후 |
| https://s-space.snu.ac.kr/ | 허용 메타데이터 제공·반입 경로 확보 이후. 기존 자동 접근 제한 유지 |
| https://help.openalex.org/access/pricing/ | 무료 일일 $1 안내 확인. 실제 계정·한도는 별도 검증, 유료 전환 없음 |

## 단계와 독립 작업

1. 공용 공간 계약: 기존 계약 삭제/rename 없이 Campus·Building·ResourceLocation 추가, 자원 배치 버전 대조. 공유 URL의 건물·시점 검증. 사용자에게 이번 작업 직접 적용 예외 승인받음.
2. 공간 수집: OSM 고정 범위 원자료·출처/라이선스·변환 기록, 공식 목록 교차 대조·누락 사유, DSM 가져오기. 알려지지 않은 건물번호를 추정하지 않음.
3. 지도: 관악 전체 실제 윤곽·도로·지형, 단과대/건물 선택, 건물별 자원 목록, 미확인 위치 배제, 모바일 동일 2D/선택 3D, 시점 복원.
4. 위치 수집: 공식 lab/office/installation/space 주소 종류·출처 구분, 기존 104개 자원 대조. 공식 확인 전 연결하지 않음.
5. 전체 목록과 깊이: 12개 학과 공식 분모·미수록·검수 대기, 상세 90%·연구실 위치 90%, 논문 중복·현직 신원·최근 5년 검수, 장비100·공간20 확장.
6. 품질·공개: 관계 출처·동명이인·이전 위치·개인 연락처 점검, 수록률·갱신 공개, 검색·사용자·성능·장애 검증, 사람 승인 배치.

각 작업은 별도 이슈에서 파일 범위를 잡는다. 전수 자료 확보·승인·평가가 끝나지 않으면 전체 완료로 표시하지 않는다. 현직·휴직·겸임·명예 구분과 공동소속은 공식 목록 근거대로 유지한다. 수집이 어려운 항목도 분모에서 제외하지 않는다.

## 화면 경험 참고

[Concept3D](https://concept3d.com/use-cases/case-studies/usd/) 건물→시설 상세, [S-MAP 가이드](https://smap.seoul.go.kr/point/guide/guide.html) 실제 건물 강조, [VOSviewer](https://app.vosviewer.com/docs/user-interface/main-panel/) 확대 라벨·겹침 억제, [ResearchRabbit](https://www.researchrabbit.ai/features) 맥락을 유지하는 관련 자원 탐색. 자산·데이터 이용 권한을 이 참고 목록으로 주장하지 않는다.
