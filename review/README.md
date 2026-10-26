# 첫 출시 구현 검토

`shared/`는 **실제 공용 경로에 아직 반영하지 않은 변경안**이다. AGENTS.md §6·§8.4와 사용자 계획에 따라 사람이 decision 이슈 #4에서 합의하고 PR로 반영한다. 앱·수집·운영 코드는 저장소의 실제 경로에 둔다.

검증용으로 공용 변경안과 앱을 빈 외부 디렉터리에 조립한다. 원본 저장소나 기존 파일을 수정하지 않는다.

```bash
node review/workspace.mjs /tmp/ieum-review
cd /tmp/ieum-review
# Node.js 24
npm install
npm run check
npm test
npm run build
npm run dev
```

공용 변경안의 각 파일은 `shared/`를 제거한 경로로 PR 반영한다. 락파일은 격리 공간에서 실제 설치로 생성한 제안본이다. 실제 반영 전 앱 커밋과 함께 검증한다. 공용 파일 승인 전 root에서 npm 명령을 실행하지 않는다.

데이터는 시제품 표본이다. 공개 배치의 승인·공대 전체 최소 수량·실제 무료 계정·집 서버 공개·사용자 8명 비교·복원 실험은 구현 검사와 별도의 출시 조건이다. 완료 여부는 VALIDATION.md에 기록한다.
