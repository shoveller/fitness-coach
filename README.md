# 개인 피트니스 코치

Cloudflare Think 기반의 한국어 개인 코치. React 채팅 화면에서 스트리밍 응답,
도구 호출의 입력·결과, 워크스페이스 파일을 확인할 수 있습니다.

## 실행

```bash
pnpm install
pnpm exec wrangler login
pnpm upload:skills
pnpm dev
```

`wrangler.jsonc`의 기존 `hello-skills` R2 버킷을 사용합니다.
개발 중에도 `SKILLS`는 원격 바인딩이므로 Cloudflare 인증이 필요합니다.
사용자 지정에 따라 `CoachAgent.getModel()`은 `worker/createLLM.ts`의 기존 프록시 모델을
사용합니다. Workers AI 바인딩은 사용하지 않습니다. 로컬 `.env`에 `API_SERVER_KEY`를
설정하고, 배포 시 `pnpm upload:secret`으로 기존 비밀 값을 등록하세요.

## 구현 위치

| 요구사항 | 구현 |
| --- | --- |
| Think 상속·모델 | `worker/CoachAgent.ts`의 `CoachAgent` |
| 코치 성격 | `configureSession()`의 읽기 전용 `soul` 블록 |
| 운동 기록·주간 일정 | 내장 워크스페이스 도구로 `logs/YYYY-MM-DD.md`, `plan.md` 관리 |
| 몸 상태·부상·목표 | SQLite에 저장되는 쓰기 가능한 `memory` 블록, `set_context`로 갱신 |
| 온디맨드 가이드 | `skills/`의 3개 파일을 R2 `skills/`에 업로드, `R2SkillProvider` 연결 |
| 스킬 해제 | `unload_context` 지시와 `onChatResponse()`의 잔여 스킬 해제 |
| 런타임 계산기 | `LOADER` + `createExtensionTools`, 모델이 `load_extension`으로 직접 생성 |

1RM 확장은 미리 작성된 계산기를 등록하는 방식이 아닙니다. 아래 생성 요청을 보내면
코치가 JavaScript 소스를 작성·저장하고 샌드박스에 로드합니다. Think가 확장 정보를
영속 저장하고 Durable Object 재시작 시 복구합니다. Epley 추정식에서 80kg × 5회는
93.33kg이며, 1회 반복은 입력 중량을 반환하도록 지시합니다.

날짜가 없으면 한국 시간대를 사용하며, 매 턴 날짜와 메모리 컨텍스트를 새로 읽습니다.
같은 날짜의 추가 운동은 기존 기록을 읽고 덧붙이도록 지시합니다.

### 새 브라우저에서 이어가기

현재 앱은 **한 사람을 위한 데모**로 `CoachAgent/default` 인스턴스를 사용합니다.
같은 서버 주소를 새 브라우저에서 열면 같은 메모리·워크스페이스·대화로 연결됩니다.
브라우저 저장소에 개인 정보를 저장하지 않습니다. 다른 사용자도 같은 주소로 접속하면
같은 코치를 공유하므로, 다중 사용자 서비스로 공개하려면 인증된 사용자별 인스턴스로 연결해야 합니다.
로컬 개발과 배포 서버의 Durable Object 저장소는 별개입니다.

`wrangler.jsonc`의 `v2` 마이그레이션은 기존 `ThinkAgent` 클래스를 `CoachAgent`로
이름 변경하여 배포 시 기존 저장소를 보존합니다.

## 수동 검증

1. **로그:** “오늘 스쿼트 했어. 80kg으로 5회씩 5세트 했어” → 파일 목록에서
   `logs/<오늘 날짜>.md`와 `plan.md`를 열어 확인합니다. 이어서 “이번 주에 무엇을 했지?”라고
   묻고 파일 읽기 도구의 결과와 답변을 비교합니다.
2. **메모리:** “저는 75kg이고 왼쪽 무릎이 안 좋아요. 5km를 30분 안에 뛰고 싶어요” →
   `set_context` 성공을 확인합니다. 새 브라우저에서 내일 계획을 묻고 세 사실 반영을 확인합니다.
3. **스킬:** “스쿼트 자세를 알려줘” → `load_context`의 `squat-form.md` 로드와
   `unload_context`를 확인합니다. 모델이 해제를 생략해도 응답 완료 훅에서 해제합니다.
4. **확장:** “1회 최대 중량(1RM) 계산기를 만들어줘” → `load_extension` 성공을 확인합니다.
   이후 “80kg으로 5회 들면 내 1RM이 얼마야?” → `one_rm_…` 도구 호출과 약 93kg 답변을 확인합니다.

## 자동 검증

```bash
pnpm exec oxlint
pnpm build
# 개발 서버가 실행 중이어야 합니다. 실제 모델을 호출하며 이용량이 발생합니다.
COACH_URL=http://127.0.0.1:5173 pnpm test:coach
```

통합 검사는 무작위 이름의 별도 코치 인스턴스를 사용해 개인 기록과 분리합니다.
실제 채팅 WebSocket으로 위 시나리오를 실행하고, 클라이언트 이력 없이 재접속하여 기억을 확인합니다.
도구 입출력을 출력하고 예상 호출·응답이 없으면 실패합니다.
모델 서비스 연결이나 용량 제한으로 실패하면 검증이 완료되지 않은 것이므로,
프록시 상태를 확인한 뒤 같은 명령을 다시 실행해야 합니다.

```bash
pnpm deploy
```

배포 전 Cloudflare 계정과 바인딩 대상을 확인하세요.
