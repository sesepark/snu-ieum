# 2026년 10월 ChatGPT Edu 공모전 제출 준비

2026-10-27 기준. 제출 자료 준비 기록이며 온라인 접수·출시 승인·학생 평가 완료 기록이 아니다.

## 현재 결과

- 실제 코드: `64eda2f`와 `5f99bd1`. 검색 조건 변경 시 이전 선택을 제거하고, 처음 보기 상태를 정리했으며, 상세 상단에 위치와 공식 주소 근거를 배치했다. 긴 공식 설명은 펼침으로 보존한다.
- Node.js 24에서 타입 검사, 단위/API 96개, Chrome 브라우저 13개, 빌드와 diff 검사 통과.
- 참가자가 서울대 ChatGPT Edu 계정의 Codex를 이음 개발에 사용했다고 확인했다. 인증 자료나 대화 원본은 저장소에 올리지 않는다.
- 실제 최신 화면을 기록해 자막이 있는 64초 MP4를 작성했다. 0.5초 간격 화면 기록이며 사람 사용성 평가 영상이 아니다.
- 공식 문항 순서에 맞춘 신청서 DOCX·PDF 5쪽과 확대 화면·개발 근거 PDF 4쪽을 작성한다. 개인 참가 정보가 포함된 원본·영상·렌더는 저장소 밖 공모전 폴더에만 보관한다.
- 공식 10월 HWPX 서식의 문항을 유지하고 답변을 채웠다. 별도 한글 앱의 열림은 확인했지만 PDF 내보내기 응답 문제가 있어 HWPX 자체의 최종 페이지 검수는 별도 확인 사항이다. DOCX/PDF의 렌더 검수와 구별한다.

## 검증 가능한 근거

`evidence.json`은 코드·데이터 해시, 시각, 자원 수, 검사 결과와 대표 원문 대조 상태를 기록한다. `demo-cases.json`은 시계열 5개, 초저온 3개, 로봇 18개 후보의 실제 ID를 담는다. 후보 수는 관련도나 학생 성공률이 아니다.

`search-candidates.json`은 기존 12개 고정 검색 과제의 실제 상위 후보·출처·위치·관계를 내보낸다. `reviews.pending.json`은 두 독립 검수자의 실제 판정이 없는 빈 양식이다. `search-pending-report.json`의 `evaluationConducted`와 `targetMet`는 false다. 검색·배치가 바뀌면 검수 전에 후보를 다시 내보낸다.

공식 원문 재조회에서 대표 연구실의 연구 분야·주소와 장비의 설치·용도 표현을 대조했다. 원문 HTML은 보관하지 않으며 이 결과를 사람 승인으로 취급하지 않는다. 기존 미승인 공개 상태와 출시 게이트를 유지했다.

## 제출 이야기

관심 분야 검색 → 관련 자원 선택 → 실제 건물·공식 주소 → 원문 확인을 중심으로 설명한다. 실제 캠퍼스는 시각적 진입점이며 학생이 끝낼 수 있는 탐색 행동을 보여준다. 대상과 최우수상 세 건에서 문제의 구체성, 이용 흐름, 실제 결과와 한계의 구분을 참고했다. 심사위원의 신분이나 수상 원인은 추정하지 않는다.

807개는 교수 후보 341명·연구실 237곳·장비 후보 209개·공간 20곳의 사람 승인 전 초안이다. 전체 검수 완료, 논문 1,000건 검수 완료, 이용 허가, 탐색 시간 절감률을 주장하지 않는다. 선택적 Gemini 서비스 연동과 개발에 쓴 ChatGPT Edu를 구분한다.

## 평가 준비와 남은 단계

사용자는 실제 평가가 없으므로 평가 준비까지만 진행하도록 확인했다. 익명 빈 기록표, 평가 진행 안내, 기존 12개 과제와 독립 판정용 CSV를 준비한다. 예정 슬롯은 실제 참여자가 아니다. 출시 평가는 `review/evaluation/PROTOCOL.md`와 승인된 동일 연구·공간 배치를 사용한다. 기존 홈페이지 비교는 별도 B01–B08 참여자와 교차 과제로 수행하며 기존 출시 과제를 대체하지 않는다.

1. 대표 자원·위치의 사람 검수와 공개 범위 확인.
2. #30의 학생 8명 이상 평가와 검색 관련도 독립 판정.
3. 공식 명단·연구실 위치·논문 저자 대조, 데이터 공개 승인.
4. #28 실계정·한도 검증, #29 실제 운영·복구, #33 제한 소스 제공 경로 확인.
5. 실제 결과가 생기면 문서의 수치와 날짜를 갱신하고 온라인 접수.

## 공식 참고

- [10월 모집·공식 HWPX](https://extra.snu.ac.kr/ptfol/imng/icmpNsbjtPgm/findIcmpNsbjtPgmInfo.do?encSddpbSeq=6f5960338073531e2039f3553e2e0a9d): 2026-10-31 23:59 마감, 5쪽 이내 권장, Codex 서비스 개발 사례 가능.
- [공모 요강과 FAQ](https://snu.gov-dooray.com/share/pages/WftnFOTpQRyzX6Sy2EOstQ/4413403222341749414): 시범 적용·개선 경험 제출 가능. 재신청 FAQ의 선정자/주제 관련 표현은 참가자 상황과 함께 확인.
- [학교 이용수칙](https://snu.gov-dooray.com/share/pages/WftnFOTpQRyzX6Sy2EOstQ/4343130318583002173): 입력 자료·결과 검증·공개 범위 확인.
- [학교 Codex 매뉴얼](https://snu.gov-dooray.com/share/pages/WftnFOTpQRyzX6Sy2EOstQ/4346704918454171768): 개발·수정·검증 활용 사례.
- [9월 선정 결과](https://aiplugin.snu.ac.kr/chatgpteducontest/).
- [대상 보고서](https://aiplugin.snu.ac.kr/chatgpteducontest/1-046/1-1-046.pdf), [상세 첨부](https://aiplugin.snu.ac.kr/chatgpteducontest/1-046/1-1-046-1.pdf).
- [최우수 SignMyDoc](https://aiplugin.snu.ac.kr/chatgpteducontest/2-1-002/2-1-002.pdf).
- [최우수 Exchange Atlas](https://aiplugin.snu.ac.kr/chatgpteducontest/2-2-064/2-2-1-064.pdf), [HTML](https://aiplugin.snu.ac.kr/chatgpteducontest/2-2-064/2-2-2-064ExchangeAtlas.html).
- [최우수 Notice Monitor](https://aiplugin.snu.ac.kr/chatgpteducontest/2-3-078/2-3-1-078.pdf), [첨부](https://aiplugin.snu.ac.kr/chatgpteducontest/2-3-078/2-3-2-078.pdf).
