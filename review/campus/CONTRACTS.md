# 공용 변경 제안 · 2026-10-27

`campus.ts`를 `packages/contracts/src/campus.ts`로 추가하고 기존 index.ts 끝에 `export * from './campus';`를 추가한다. 기존 Resource·Source·Relation·Snapshot의 필드 삭제/rename이나 필수 필드 변경은 없다. 공간 스냅샷을 독립 버전으로 보관하되 `resourceVersion`으로 연구 배치와 연결하고 일치하지 않는 위치 연결은 사용하지 않는다. 기존 JSONB 배치 파이프라인과 별도로 검토하며 DB 마이그레이션은 우선 필요하지 않다.

건물은 탐색 자원 4종에 포함하지 않는다. 실제 폴리곤·위치·건물 식별의 출처를 분리하며, 교수실(office)을 연구실(lab)의 위치로 전파하지 않는다. 미확인 위치는 목록에만 남긴다. 모든 도형은 경위도 좌표이고 높이는 미터이며 실내 좌표를 만들지 않는다. DEM은 DSM·해상도와 원자료 출처를 함께 보관한다. 누락 건물도 omissionReason으로 보존한다.

추가 검증: 건물의 공식 식별 source 검토, 자원 존재와 kind별 location purpose 대조, Polygon 유효성, 지도 범위, 중복·겹침, 공식 목록 분모 대조, 공간 원자료 라이선스와 공개 배치 검수는 서비스·수집 단계에서 수행한다. 이 스키마를 통과했다는 사실만으로 사람 승인이나 위치 정확성을 주장하지 않는다.

렌더러는 기존 react-force-graph/Three.js·Canvas 의존성 안에서 고정 좌표·건물 mesh·DSM을 사용한다. 프레임워크·DB·호스팅·모델·락파일은 바꾸지 않는다.
