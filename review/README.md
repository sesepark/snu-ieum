# 첫 출시 기반의 반영·검증 기록

2026-10-26 사용자가 **이번 작업에 한해 에이전트의 공용 파일 직접 반영**을 명시적으로 허용했다. 이에 #4의 검증된 `foundation.patch`를 실제 루트 설정·계약·DB 스키마·락파일·디자인 토큰·CI 경로에 반영했다. 기존 협업 규칙은 바꾸지 않았다.

일반 실행은 이제 저장소 루트에서 한다. Node.js 24를 사용한다.

```bash
npm ci
npm run check
npm test
npm run build
npm run dev
```

`shared/`와 `foundation.patch`는 초기 검토 원본이다. **이미 적용했으므로 패치를 다시 적용하지 않는다.** `node review/make-patch.mjs`는 초기 제안 파일을 재생성하는 기록용 도구다. 이후 공용 파일의 단일 기준은 실제 경로다.

격리 검증을 재현할 때는 `node review/workspace.mjs /tmp/ieum-review`로 빈 외부 디렉터리에 앱과 초기 공용 제안을 조립할 수 있다. 실제 계약이 이후 변경되면 초기 제안을 덮어 쓰는 이 도구 대신 현재 checkout을 기준으로 검증한다.

구현·검증 결과와 아직 달성하지 않은 출시 조건은 [VALIDATION.md](VALIDATION.md), 집 서버 운영은 [OPERATIONS.md](../infra/OPERATIONS.md)에 기록했다. 시제품은 사람의 공개 승인이나 공대 전체 데이터 목표 달성을 뜻하지 않는다.
