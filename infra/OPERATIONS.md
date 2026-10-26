# 집 서버·Pages 운영

아직 서버 설정과 공개 배포는 수행하지 않았다. #4의 공용 기반은 사용자의 이번 작업 한정 예외 승인으로 반영했다. 실제 서버 주소·전용 포트·데이터 정책·무료 계정은 배포 전에 확인한다. 이 실행 구성은 **Linux 집 서버** 대상이다. 기존 Compose 프로젝트·Funnel 라우트·볼륨을 덮어쓰지 않는다.

## 실행

1. `infra/.env.example`을 `infra/.env`로 복사하고 전용 DB 비밀번호(예: 64자리 hex), 32자 이상 운영 토큰을 로컬에서 설정한다. `.env`는 커밋하지 않는다.
2. 사용 중인 포트를 확인하고 API 4100, 운영 4101, DB 55431의 빈 전용 localhost 포트를 정한다. `docker compose -f infra/compose.yml --env-file infra/.env config --quiet`로 먼저 검증한다.
3. `docker compose -f infra/compose.yml --env-file infra/.env up -d --build`. DB 초기 SQL은 **새 전용 볼륨에서 한 번** 실행된다. 기존 볼륨에 재실행하거나 `down -v`로 지우지 않는다.
4. 데이터가 승인되기 전 공개 API는 503을 반환한다. 먼저 아래 운영 경로에서 승인·반영한 뒤 `/health`, `/v1/catalog`, `/v1/graph`, `/v1/search`를 확인한다.
5. 운영 UI는 서버 `http://127.0.0.1:4101/ops`이며 SSH `-L 4101:127.0.0.1:4101` 포워딩으로만 연다. 토큰은 UI 메모리에서만 사용한다.

공개 준비가 끝난 서버에서만 `tailscale funnel --bg --https=8443 http://127.0.0.1:4100`을 실행한다. 운영 포트 4101이나 DB 포트를 Funnel에 연결하지 않는다. 먼저 기존 `tailscale funnel status`를 확인한다. 실제 Funnel 8443 URL을 Pages의 `VITE_API_URL` 저장소 변수로 설정한다. CORS origin은 경로를 제외한 정확한 `https://sesepark.github.io`다.

공식 참고: [Funnel](https://tailscale.com/docs/features/tailscale-funnel), [Vite Pages 배포](https://vite.dev/guide/static-deploy), [pgvector](https://github.com/pgvector/pgvector).

## 수집·검수

Node.js 24 작업공간에서 `npm run cli -w @ieum/worker -- <명령>` 또는 `docker compose -f infra/compose.yml --env-file infra/.env exec worker npm run cli -w @ieum/worker -- <명령>`을 사용한다. 컨테이너 경로의 설정 파일은 별도 읽기 전용 마운트로 제공한다. 토큰과 API 키를 명령 인자로 넣지 않는다.

- `official <config.json>`: 소스별 `url`, `kind`, `name`/`summary` CSS selector, 검토한 `policy`가 필요하다. `artifactsAllowed`와 `artifactRoot`가 모두 있을 때만 연락처를 제외한 HTML을 별도 볼륨에 보관한다. PDF 자동 수집은 하지 않는다.
- `openalex <config.json>`: 공식 확인한 `institutionId`, `maxPages`, 계정의 `rpm`, `dailyRequests`, `quotaVerifiedAt`, `policy`가 필요하다. 키는 서버 `OPENALEX_API_KEY`에서만 읽는다. 사용한 한도는 DB에 기록하며 커서와 `runId`를 보관한다. 다른 프로젝트에서도 같은 계정을 사용하면 그 사용량을 반영한 더 낮은 한도를 설정한다.
- `resume <runId> <operator-handle> <reason>`: 계정 한도·오류를 확인한 뒤 실패한 실행만 명시적으로 재개한다. 다음 openalex 설정에 같은 `runId`를 넣으면 DB 커서부터 재개한다.
- `sspace <config.json>`: `policy`, `metadata`를 입력한다. metadata에는 공식 handle URL, 제목, 허용된 초록/키워드/학과/지도교수명, 확인일, `permissionConfirmed: true`, 사용 허용 근거, 검수자가 필요하다. 접근 제한을 우회하지 않는다. 지도교수 이름은 자원 ID로 자동 연결하지 않는다.
- `export-review /app/data/review.jsonl` 또는 `.csv`: Staging 검수 내보내기. 이 파일은 Raw DB를 대체하지 않는다. CSV/JSONL 자체의 `approved` 값으로 공개 승인하지 않는다.
- `import-review /app/data/review.csv` 또는 `.jsonl`: 수정된 draft를 원래 `run_id`/`raw_id`와 연결해 Staging으로 재반입한다. CSV의 따옴표·쉼표·개행을 파싱하고 파일의 승인/검수자 필드는 승인 근거로 사용하지 않는다. 1,000행·2MB 이하로 나눠 반입한다. 운영 API `POST /ops/import-review`에서도 `{text, format}`으로 반입할 수 있다.
- `import <bundle.json>`: 운영자가 명시적으로 정리한 전체 배치 초안 `draft`와 `source`, `externalId`, `sourceUrl`, `policy`를 Raw/Staging에 넣는다. `draft`는 `prototype`이어야 한다. 개별 후보를 공식 근거로 연결해 이 배치 초안을 만드는 작업은 사람이 수행한다.
- 운영 UI에서 출처·선정 사유·동명이인·관계를 검토하고 검수자·사유와 함께 승인한다. 승인된 Staging ID와 새 버전으로 반영한다. 배치는 불변이며 롤백은 이전 버전을 활성화한다.
- `export /app/data/public-snapshot.json`: 활성 승인 배치만 원자적으로 내보낸다. 공개 웹 스냅샷도 이 버전을 사용한다.

`policy`에는 `reviewedBy`, ISO 시각의 `termsCheckedAt`/`robotsCheckedAt`, `allowedHosts`, `allowedPathPrefixes`, `storage`(`sanitized-payload` 또는 `metadata-only`), `parserVersion`, 선택적 `artifactsAllowed`를 넣는다. 자동 생성된 날짜로 정책 확인을 대신하지 않는다. metadata-only는 URL·원본 해시·수집 시각만 Raw에 보관한다. 본문에서 추출한 허용 필드는 사람 검수용 Staging으로 분리한다.

교수·연구실은 월간, 장비·공간은 주간에 소스 설정별 수집을 실행한다. 기존 Raw와 내용이 달라지거나 확인일이 만료되면 재검수 대기에서 처리한다. 실패 실행과 체크포인트는 운영 상태에서 확인한다. 재검수에서 확인일을 임의로 갱신하지 말고 원문을 다시 확인한 새 배치를 승인한다.

## 무료 AI

기본은 비활성이다. 실제 계정에서 두 모델의 무료 접근·JSON·768차원 응답을 확인하고, `AI_FREE_TIER_VERIFIED=true`, `AI_QUOTA_VERIFIED_AT=YYYY-MM-DD`, 모델별 RPM/TPM/RPD를 기록한 뒤 활성화한다. 유료 계정으로 자동 전환하는 코드는 없다.

수집 자원 임베딩은 공개 승인과 무료 서비스 데이터 처리 조건 확인 후 `DATA_EMBEDDING_APPROVED=true`에서만 `embed [limit]`로 실행한다. 기존 임베딩은 건너뛰고 다음 미처리 자원을 처리한다. 수집은 한도의 40%까지만 사용하고 사용자 요청을 포함한 전체는 80% 이하로 제한한다. 모델·배치가 다른 벡터는 함께 검색하지 않는다. Gemini 일일 한도는 공식 규격의 미국 태평양 시간 자정에 맞추고 RPM/TPM은 이전 분도 합산해 경계 시점의 몰림을 보수적으로 제한한다. [공식 한도 규격](https://ai.google.dev/gemini-api/docs/rate-limits).

## 백업·복구·관측

`infra/backup.sh`는 DB custom-format dump와 허용 원문 볼륨을 묶어 검증한 GPG 수신자 키로 암호화하고 다른 파일시스템의 `BACKUP_MIRROR_DIR`에 복사한다. 개인키는 별도 복구 기기에 둔다. Linux `stat -c`로 같은 파일시스템의 폴더를 다른 기기로 오인하지 않게 검사한다. 성공 표시는 암호화와 사본 완료 후에만 기록한다.

운영자의 전용 crontab에서 매일 실행한다(기존 crontab을 덮어쓰지 않고 항목을 추가).

```cron
0 3 * * * cd /srv/snu-ieum && ./infra/backup.sh >> /srv/ieum-logs/backup.log 2>&1
15 * * * * cd /srv/snu-ieum && docker compose -f infra/compose.yml --env-file infra/.env exec -T worker npm run cli -w @ieum/worker -- health >> /srv/ieum-logs/health.log 2>&1
```

cron에는 별도의 권한 제한 환경 파일에서 `BACKUP_RECIPIENT`, `BACKUP_DIR`, `BACKUP_MIRROR_DIR`를 주입한다. `.env`를 무심코 shell source하지 않는다. 파일은 Compose 형식이며 shell 코드가 아니다. 서로 다른 파일시스템도 같은 물리 디스크의 파티션일 수 있으므로 운영자는 사본 대상이 실제 별도 기기인지 확인한다. `health`는 디스크·수집 실패·재검수·한도를 기록한다. 백업 성공 파일을 읽기 전용 마운트하고 `BACKUP_STATUS_FILE`을 지정하면 마지막 백업도 출력한다. 목표 원문은 기록하지 않는다.

복구 기기에서 암호화 파일을 복호화해 `database.dump`, `raw.tar`를 얻는다. 신뢰한 백업만 별도 빈 경로에 추출한다. 새 빈 DB에 `RESTORE_DATABASE_URL=... IEUM_RESTORE_DISPOSABLE=true ./infra/restore.sh database.dump`를 실행한다. 기존 테이블이 있는 목적지는 거부한다. 복구 후 활성 배치·자원 수·출처 해시를 비교하고, raw.tar는 별도 빈 원문 볼륨에 복원해 해시·DB의 artifact 경로를 확인한다. 운영 DB를 직접 덮어쓰지 않는다.

출시 전 실제 서버의 암호화 사본으로 한 번 복원하고, 승인 배치의 이전 버전 롤백도 수행해 기록한다. 로컬 테스트 DB의 복구 검사는 서버 운영 검증을 대체하지 않는다.

## Pages 출시

`npm exec -- tsx infra/release.ts data/public-snapshot.json data/launch-evidence.json`이 성공해야 공개한다. 데이터 최소 수량·사람 승인·동일 배치의 실제 사용자/성능/장애/복구 증거가 없으면 실패한다. 예시 증거 파일은 미완료 값이며 그대로 통과하지 않는다.

Pages workflow는 수동 실행만 지원한다. 승인 스냅샷과 검증 증거를 커밋하고 검사한 후 실행한다. 시제품 빌드 성공을 첫 출시 완료로 표시하지 않는다.

## 실제 캠퍼스 공간·수록률 배치

공간은 `Campus` 별도 계약이며 `resourceVersion`이 연구 스냅샷 버전과 같아야 한다. `IEUM_CAMPUS_PATH`·`IEUM_COVERAGE_PATH`를 운영 API에 명시적으로 주입한다. 운영 API는 미승인 공간 배치를 거부하며 공간 로딩 실패 시 연구 목록·검색은 유지한다. `/v1/campus`, `/v1/coverage`, 자원 상세의 `spatial`에서 위치와 정보별 출처를 확인한다. 동일 정보는 정적 내보내기에도 포함한다.

출시용 연구 파일 옆의 기본 이름은 `public-campus.json`, `public-coverage.json`이다. 다른 경로는 환경변수 또는 출시 게이트 3·4번째 인자로 지정한다. Pages 기존 게이트 호출도 이 파일을 반드시 요구하며, 파일이 없거나 승인·버전·새 수록률 목표가 미완료면 실패한다. 웹 빌드도 승인 연구 배치와 초안 공간 파일을 혼합하지 않는다.

```sh
node --import tsx infra/release.ts data/public-snapshot.json data/launch-evidence.json data/public-campus.json data/public-coverage.json
IEUM_SNAPSHOT_PATH=../../data/public-snapshot.json IEUM_CAMPUS_PATH=../../data/public-campus.json IEUM_COVERAGE_PATH=../../data/public-coverage.json npm run build
```

단위 테스트의 합성 승인·측정 자료나 에이전트의 원문 확인을 사람 검수로 사용하지 않는다. 지도에 쓰는 주소는 연구실·교수실·장비설치·공간을 구별하고 교수실을 연구실 위치로 전파하지 않는다. 7일/30일 재확인 기한이 지난 위치는 지도에서 제외하고 목록에 남긴다. 공식 건물 목록 분모, 윤곽 결합 후보, 설치 위치 미확인, 중복 자산 후보를 그대로 보존한다.

새 출시 기록은 공간 배치 버전, 실제 건물까지 찾은 2분 성공 인원, 거리·같은 주제·확인된 관계를 구별한 인원, 개인정보/동명이인/출처 없는 관계 0건 점검을 포함한다. `coverageReport`의 ready와 실사용자·성능·복구 검증은 별개이며 모두 통과해야 출시다.

공간 검수의 최종 내보내기는 `node --import tsx apps/worker/src/campus-cli.ts export-approved <config.json>`을 사용한다. config는 stagingId, version, **승인된 연구 snapshot 경로**, 새로운 outputDirectory를 요구한다. 해당 Staging의 `campusCandidate`와 `coverageCandidate`는 최종 승인 연구 버전을 가리켜야 한다. 다른 버전의 초안을 조용히 재바인딩하지 않는다. 기존 운영 review API로 사람이 approved를 기록한 뒤에만 내보내며 reviewedBy·reviewedAt·reason을 DB에서 읽는다. 파일은 덮어쓰지 않고 버전별 새 디렉터리에 생성하고 audit를 남긴다. 내보낸 파일 자체는 데이터 목표/학생 평가 통과를 뜻하지 않으며 release 게이트를 별도로 통과해야 한다.
