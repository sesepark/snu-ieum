# 개발 참여 가이드

세팅하고, 하루 작업을 돌리고, 문제가 생겼을 때 보는 문서입니다.
**규칙 본문은 [AGENTS.md](AGENTS.md)**, **제품 명세는 [IMPLEMENTATION.md](IMPLEMENTATION.md)** 에 있습니다.

---

## 1. 처음 한 번만 (세팅)

```bash
# 저장소 받기
git clone https://github.com/sesepark/snu-ieum.git
cd snu-ieum

# rebase를 기본으로 — 안 하면 merge 커밋이 계속 쌓입니다
git config pull.rebase true

# GitHub CLI 설치 + 로그인
brew install gh
gh auth login
```

**알림 설정** — 기본값 그대로 두시면 됩니다(`Participating and @mentions`).
이러면 아래 두 경우에만 알림이 옵니다.

- 누가 나를 `@멘션` 했을 때
- 누가 나를 **assignee로 지정**했을 때

대신 **상대가 새로 연 이슈는 알림이 안 옵니다.** 그래서 작업 시작할 때 `gh issue list`를 보는 게 전제입니다.

**모바일 앱**을 깔아두면 멘션이 푸시로 옵니다. 이메일보다 훨씬 빠릅니다.

---

## 2. 하루 루틴

```
┌─ 시작 ────────────────────────────────────┐
│ git pull --rebase                         │
│ git log --oneline -20    상대가 뭘 했나    │
│ gh issue list            누가 뭘 잡고 있나 │
│                                           │
│ → 이어서 할 이슈 or now 라벨에서 하나 집기 │
│ → 잡았으면 assignee + in-progress + 댓글   │
└───────────────────────────────────────────┘
              ↓
┌─ 작업 중 ─────────────────────────────────┐
│ 의미 단위마다 커밋, 메시지 끝에 (#12)      │
│ 막히면 이슈에 @상대 멘션 + blocked 라벨     │
│ 범위가 커지면 → 새 이슈를 연다             │
└───────────────────────────────────────────┘
              ↓
┌─ 끝 / 중단 ───────────────────────────────┐
│ git push               미완이어도 푸시     │
│ 이슈에 마무리 댓글                         │
│ 완료 → close / 미완 → in-progress 유지     │
└───────────────────────────────────────────┘
```

---

## 3. 명령어 모음

### 매일 쓰는 것

```bash
git pull --rebase                    # 시작할 때 항상
gh issue list                        # 지금 뭐가 진행 중인가
gh issue view 7 --comments           # 이슈 하나 자세히 (댓글까지)

# 작업 잡기 — CLI를 쓰는 진짜 이유. 웹에서 하면 클릭 4번
gh issue edit 7 --add-assignee @me --add-label in-progress --remove-label now

git add -A && git commit -m "feat: add search result card (#7)"
git push
```

> 커밋 prefix는 `feat: fix: docs: refactor: chore: test:` 6개만 씁니다. 애매하면 `chore:`.
> 자세한 규칙은 [AGENTS.md §7](AGENTS.md#7-커밋--푸시-규칙).

### 이슈 관리

```bash
gh issue create                                  # 대화형
gh issue create --title "[web] ..." --body-file body.md --label now

gh issue comment 7 --body "잡았습니다. apps/web/search/** 만집니다"

gh issue list --label in-progress                # 진행 중인 것만
gh issue list --assignee @me                     # 내 것만
gh issue list --label now                        # 다음에 할 것

gh issue edit 7 --add-label blocked
gh issue edit 7 --remove-label in-progress
gh issue close 7
```

### 공용 파일 PR (`packages/contracts` 등)

```bash
git switch -c contracts/add-official-url
# ... 수정 ...
git commit -m "feat(contracts): add officialUrl to Resource (#9)"
git push -u origin contracts/add-official-url
gh pr create --fill

# 머지된 뒤 — 둘 다 즉시
git switch main && git pull --rebase
```

### 확인용

```bash
git log --oneline -20                # 최근 커밋
git log --oneline --author=sesepark  # 상대가 뭘 했나
git status
git diff                             # 커밋 전 변경분
```

---

## 4. 이럴 땐 이렇게

### `main`을 깨뜨렸다

되돌리는 게 먼저, 원인 분석은 나중입니다.

```bash
git revert <커밋해시>
git push
```
상대가 이미 그 위에 작업 중일 수 있으니 이슈나 카톡으로 알려주세요.

### `pull --rebase`에서 충돌이 났다

```bash
# 충돌 파일을 열어서 <<<<<<< ======= >>>>>>> 부분 정리
git add <고친파일>
git rebase --continue

# 엉키면 언제든 취소하고 처음부터
git rebase --abort
```

충돌이 자주 난다면 **작업 크기가 너무 크거나 푸시 간격이 너무 길다는 신호**입니다.

### 락파일이 충돌났다

내용을 손으로 풀지 마세요.

```bash
git checkout --theirs <락파일>
# 설치 명령 다시 실행 (스택 확정 후 이 자리에 채웁니다)
git add <락파일>
git rebase --continue
```

### 상대가 잡은 파일을 꼭 건드려야 한다

그 이슈에 멘션해서 먼저 물어봅니다.

```bash
gh issue comment 3 --body "@sesepark #7 하다 보니 apps/api/search.ts를 조금 고쳐야 하는데,
지금 거기 작업 중이시면 제가 기다릴게요. 아니면 제가 고쳐도 될까요?"
```

### 작업이 예상보다 커졌다

원래 이슈를 키우지 말고 쪼갭니다. 점유 시간이 길어지는 게 제일 위험합니다.

```bash
gh issue create --title "[web] 카드 모바일 반응형" --label next
gh issue comment 7 --body "반응형은 #14로 분리했습니다"
```

### 며칠 자리를 비운다

`in-progress`를 들고 나가지 마세요. 상대가 그 영역을 통째로 못 씁니다.

```bash
git push                                        # 돌아가는 상태로 남기고
gh issue comment 7 --body "9/20까지 자리 비웁니다.
- 어디까지: 카드 렌더까지 동작
- 남은 것: 저장 API 연결
급하면 이어받으셔도 됩니다"
gh issue edit 7 --remove-label in-progress --add-label next
```

### 실수로 상대 작업 영역을 고쳤다

되돌릴 수 있으면 되돌리고, 이미 푸시했으면 **바로 알립니다.** 조용히 두면 상대가 rebase에서 만나게 됩니다.

---

## 5. 자주 나오는 질문

**Q. 오타 하나 고치는데도 이슈를 열어야 하나요?**
아니요. 기준은 *"상대가 알아야 하나?"* 입니다. 오타·주석·포매팅, 내가 방금 만든 것 손보기는 그냥 커밋하고 푸시하세요.

**Q. 커밋 메시지에 이슈 번호를 꼭 붙여야 하나요?**
이슈가 있는 작업이면 붙이세요. `#7`만 써두면 그 이슈에 커밋이 자동으로 링크돼서 "어디까지 했는지"가 저절로 기록됩니다.

**Q. 미완성인데 푸시해도 되나요?**
**돌아가면** 푸시하세요. 안 돌아가는 상태(빌드 깨짐, 타입 에러)면 그 부분만 빼고 푸시하거나, 오늘 안에 돌아가게 만들어서 푸시합니다.

**Q. 상대 답을 기다려야 하나요?**
답이 있어야만 진행되는 부분만 멈추고, 나머지는 계속 하세요. 멈춰야 하면 `blocked` 라벨을 답니다.

**Q. 카톡으로 얘기하면 안 되나요?**
됩니다. 오히려 상의는 카톡이 빠릅니다. 다만 **결론 한 줄은 반드시 이슈에 남기세요.** 안 그러면 3주 뒤에 아무도 못 찾습니다.
