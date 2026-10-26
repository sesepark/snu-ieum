# 구현·검증 기록 — 2026-10-26

## 상태

실행 가능한 첫 출시 기반과 시제품 코드를 구현했다. **첫 출시 완료는 아니다.** 공용 파일은 처음 `review/shared/`와 `foundation.patch`의 검증된 변경안으로 준비했다. 이후 사용자가 이번 작업의 직접 반영 예외를 명시적으로 승인해 실제 경로에 적용했다. 초기 검토본은 기록으로 남긴다. 일반 협업 규칙은 변경하지 않았다.

독립 작업공간 `/tmp/ieum-final-verified`에 앱과 공용 제안을 조립하고, Node.js 24.22.1에서 새 `npm ci`로 검증했다. 사용자 예외 승인으로 반영한 뒤 저장소 루트에서도 설치·타입·단위·DB·빌드를 통과했다. 모바일 지도 결함 수정은 루트의 Playwright 흐름으로 다시 확인했다. 원본 저장소의 `.serena/`는 기존 미추적 파일로 남겨두었다.

## 통과한 검사

| 검사 | 결과 |
| --- | --- |
| 새 작업공간 `npm ci` | 성공, 감사 결과 알려진 취약점 0 |
| `npm run check` | TypeScript 통과 |
| `npm test` | 44개 단위·API 검사 통과 |
| 실제 PostgreSQL `npm run test:db` | 6개 통합 검사 통과 |
| Chrome `npm run test:e2e` | 5개 브라우저 흐름 통과 |
| `npm run build` | Vite production 빌드 성공 |
| `npm run schemas` | Zod에서 JSON Schema 생성 성공 |
| Compose 파일 | 공식 compose-spec JSON Schema 검증 통과 |
| CI·Pages workflow | GitHub verify 성공; 공개 Pages workflow는 미실행 |
| 백업·복구 shell | shellcheck 통과 |
| 개발 API 실기동 | `/health`, `/v1/catalog`, `/v1/graph` 200 |
| 공용 패치 | 반영 전 apply check, 반영 후 reverse check 성공 |
| 출시 게이트 | 미승인·수량 미달·검증 미완료 시 의도대로 실패 |

GitHub Actions의 [verify 실행](https://github.com/sesepark/snu-ieum/actions/runs/40292086102)에서도 타입·단위 39개·PostgreSQL 6개·브라우저 5개·빌드가 성공했다. CI는 headless Chromium shell만 설치하고 설치 8분/전체 20분 제한을 둔다.

브라우저는 설치된 Chrome을 `PLAYWRIGHT_CHANNEL=chrome`으로 사용했다. CI에서는 Playwright Chromium을 설치하도록 준비했다. iab가 제공되지 않아 Chrome으로 화면을 확인했다.

단위·API 검사는 출처 강제, 존재하지 않는 ID, 중복 ID, 추천의 실제 승인 필드 일치, 일반 검색, AI 미동의/한도/비정상 JSON/실패 대체, URL 원문 제외, 노드·연결 한도와 숨겨진 수, 개인정보 제거를 다룬다. 개인정보가 JSON 키인 경우에도 값과 제외 기록에 원문이 남지 않게 수정했다.

실제 DB는 기존 서비스와 분리한 임시 PostgreSQL 17.10 + pgvector 0.8.7이다. Raw 불변·재실행·검수 전 공개 차단·원자적 배치·이전 배치 롤백·운영 토큰·768차원 벡터·모델/배치 격리·사용자 우선 할당량 동시성을 검사했다. Gemini 일일 한도는 미국 태평양 시간 기준이다.

브라우저 흐름은 목록/지도 선택, 공식 링크, 필터, 2D/3D 전환, 2단계 상태 유지, hash URL 복원·뒤로 가기, 390×844 모바일, 키보드·Esc·reduced motion, AI 미동의, WebGL context loss 후 2D 전환과 선택 유지다.

## 로컬 복구 실험

별도 임시 DB에 **테스트용** 승인 배치 2개와 허용 원문 표본을 만들고 다음을 실제 수행했다. 실제 공개 데이터의 사람 승인을 수행한 것이 아니다.

```text
pg_dump custom format → DB+원문 tar → 임시 GPG 키로 암호화
→ 복호화·새 빈 경로 추출 → restore.sh로 새 빈 DB 복원
→ 활성 버전·6개 자원·원문 SHA-256 일치 → 복원 DB에서 이전 배치 롤백
```

실험용 DB는 종료 후 제거했다. 기존 DB·Tailscale·서버 작업은 변경하지 않았다. Homebrew pgvector 0.8.7을 로컬 테스트용으로 설치했으며 기존 PostgreSQL 서비스는 시작·중단하지 않았다.

## 빌드 특성

지도를 2D/3D별로 지연 로딩한다. 이번 빌드는 첫 JS 약 410KB(gzip 127KB), 2D 약 92KB(gzip 31KB), 3D 약 1.29MB(gzip 341KB)다. 이는 빌드 크기이며 실제 사용자 성능 달성을 뜻하지 않는다.

## 남은 출시 조건

- 공식 표본은 컴퓨터공학부 교수 3명·연구실 3곳뿐이다. 다른 11개 학과, 장비 20개·공간 10곳, 모든 학과 논문 근거 목표는 미달이다.
- 소스별 실제 이용약관·robots·원문 보관 정책 확인, 전체 실데이터 수집·대표 선정·동명이인 해소·관계 검수·사람 승인.
- 실제 무료 계정의 모델 접근·JSON/768차원 응답·RPM/TPM/RPD 검증. 현재 AI 기본 비활성이며 외부 AI 호출은 실행하지 않았다.
- Docker가 제공되지 않아 이미지 빌드·Compose 실행은 미검증이다. 집 서버 SSH 대상·전용 경로·포트, Funnel 8443, Pages 배포는 아직 적용하지 않았다.
- 실제 운영 서버의 별도 기기 암호화 백업·복원과 승인 배치 롤백. 로컬 복구 실험으로 이를 대신하지 않는다.
- 학생 8명 이상의 2D/3D 순서 교차 비교, 2분 발견·원문 확인 80%, 학과별 검색 평가 80%, 출시 규모 p95/초기 조작/30fps 측정.

개별 수집 후보는 Staging에 쌓이고, 운영자가 이 후보를 공식 근거로 연결한 전체 배치 초안을 검수·반입한다. 현재 후보 자동 병합이나 자동 관계 추론은 없다. 검수는 CSV/JSONL로 내보내고 수정본을 같은 run/Raw 참조의 Staging으로 다시 반입한다. 따옴표·개행·중첩 JSON round trip과 파일 승인 상태 무시를 검사한다. 전체 배치도 JSON으로 반입하며 CSV 임의 편집을 자동 승인·공개로 연결하지 않는다.

실제 공개에는 `infra/launch-evidence.example.json`을 실제 측정값으로 채운 별도 기록이 필요하다. 예시의 빈 값·false는 출시를 차단한다. 출시 기본 뷰는 실험 결과로 정해 `VITE_DEFAULT_VIEW`에 적용한다.

공용 인프라를 학과 소속으로 추정하지 않는 additive 그룹 계약과 공식 12개 학과 레지스트리를 추가했다. 출시 검사는 학과 누락·미등록 학과를 차단하고, 공용시설을 교수/연구실 최소 수량의 학과 분모에 넣지 않는다.

CSV 반입 파서는 알려진 prototype replacement 문제가 수정된 csv-parse 7.0.3을 사용하며 설치 후 npm audit은 취약점 0건이다.
