import {Session, Think, type ThinkModel} from '@cloudflare/think'
import {createLLM} from './createLLM.ts'
import {type ToolSet} from "ai";
import {callable} from "agents";
import { R2SkillProvider } from "agents/experimental/memory/session";
import {createExtensionTools} from "@cloudflare/think/tools/extensions";

type FileInfo = {
    path: string;
    name: string;
    type: "file" | "directory" | "symlink";
    mimeType: string;
    size: number;
    createdAt: number;
    updatedAt: number;
    target?: string;
}

export type CoachAgentState = {
    files: FileInfo[]
}

export class CoachAgent extends Think<Env, CoachAgentState> {
    extensionLoader = this.env.LOADER

    initialState: CoachAgentState = {
        files: []
    }

    async onStart() {
        await this.refreshFiles()
    }

    async beforeTurn() {
        await this.session.refreshSystemPrompt()
    }

    async onChatResponse() {
        for (const key of await this.session.getLoadedSkillKeys()) {
            if (key.startsWith('skills:')) {
                await this.session.unloadSkill('skills', key.slice('skills:'.length))
            }
        }

        await this.refreshFiles()
        await this.session.refreshSystemPrompt()
    }

    async refreshFiles() {
        const files = await this.workspace.glob('**/*')
        this.setState({ files })
    }

    @callable()
    async readWorkspaceFile(path: string) {
        return await this.workspace.readFile(path)
    }

    getModel(): ThinkModel {
        return createLLM()
    }

    getTools(): ToolSet {
        return {
            ...createExtensionTools({ manager: this.extensionManager! })
        }
    }

    configureSession(session: Session) {
        return session.withContext('soul', {
            provider: {
                async get() {
                    return `너는 한국어로 대화하는 개인 피트니스 코치다.
노력을 구체적으로 격려하되 미루는 핑계에는 실행 가능한 작은 행동을 제안한다.
통증이나 부상은 핑계로 취급하지 않는다. 아픈 동작을 중단하고 안전한 대안을 제안한다.
매 응답에서 훈련이 어땠는지(체감 강도, 피로, 통증)를 묻고,
마지막 문장은 내일 집중할 운동과 강도로 마무리한다.

훈련 기록과 계획:
- 사용자가 운동을 보고할 때마다 내장 워크스페이스 도구로 logs/YYYY-MM-DD.md에 기록한다.
- 날짜는 사용자가 밝힌 날짜와 시간대를 우선하고, 없으면 아래 한국 날짜를 기준으로 한다.
- 같은 날짜의 파일을 먼저 읽고 기존 내용을 보존하며 추가한다. 운동명, 중량(kg), 반복,
  세트, 시간/거리, 사용자가 보고한 통증과 체감을 기록한다. 없는 수치는 만들지 않는다.
- 매 보고 후 plan.md를 읽고 이번 주 월요일~일요일의 날짜별 일정과 수행/예정/휴식을 갱신한다.
  이미 지난 날의 기록이 없으면 '기록 없음'으로 표시하고 휴식했다고 추측하지 않는다.
  이전 주 계획이 있으면 logs에서 확인할 수 있는 수행 기록을 보존하고 이번 주 계획으로 갱신한다.
- 특정 요일이나 이번 주 운동을 물으면 반드시 해당 날짜의 logs 파일들을 찾아 읽고 답한다.
  예정된 plan.md와 실제 수행 기록을 구분하고, 파일이 없으면 기록이 없다고 말한다.
- 파일 도구 성공을 확인한 뒤에만 저장했다고 말한다.

영속 메모리:
- 신체 정보(체중 등), 부상 부위/상태, 운동 목표, 선호도, 시간대를 알게 되면
  set_context로 memory 블록을 즉시 갱신한다. 기존 사실을 보존하고 바뀐 사실만 수정한다.
- 모든 운동 제안에서 memory를 읽고 체중, 부상, 목표를 함께 반영한다.
  예: 75kg, 왼쪽 무릎 불편, 5km 30분 미만 목표라면 통증 없는 저충격 운동부터 제안한다.
- 메모리 저장 성공 전에는 기억했다고 말하지 않는다.

운동 가이드:
- 스쿼트 자세는 squat-form.md, 달리기 계획은 running-program.md,
  스트레칭은 stretching.md를 skills 블록의 load_context로 필요할 때만 불러온다.
- 불러온 가이드와 memory를 함께 적용하고 사용한 가이드 이름을 답변에 표시한다.
- 사용이 끝나면 unload_context로 해제한다. 읽지 못한 가이드를 읽었다고 말하지 않는다.

런타임 확장 도구:
- 없는 계산기를 요청받으면 list_extensions로 기존 도구를 확인하고,
  직접 JavaScript 소스를 작성해 워크스페이스 extensions/에 저장하고 load_extension으로 불러온다.
- 1RM 계산기는 one_rm 이름으로 만들고 Epley 식 weightKg * (1 + reps / 30)을 사용한다.
  1회 반복은 weightKg 자체를 반환한다. 중량은 유한한 양수, 반복은 1~30의 정수만 허용한다.
  네트워크 권한은 false로 설정하고 계산값은 추정치이며 고반복에서는 오차가 커짐을 알린다.
- 생성 후 실제 도구 호출로 80kg × 5회가 약 93.3kg인지 확인한다.
- 이후 계산 요청에는 저장된 확장 도구를 반드시 호출한다. 암산 결과로 호출을 대신하지 않는다.
  불러온 확장은 다음 대화에서도 쓰도록 유지하고, 도구 실패를 성공으로 표현하지 않는다.`
                }
            }
        }).withContext('today', {
            provider: {
                async get() {
                    return `오늘 날짜(Asia/Seoul): ${new Intl.DateTimeFormat('en-CA', {
                        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
                    }).format(new Date())}`
                }
            }
        }).withContext('memory', {
            description: '사용자의 신체 정보(체중), 부상 부위와 상태, 운동 목표, 선호도, 시간대. 기존 사실을 보존하며 set_context로 갱신한다.',
            maxTokens: 1100
        }).withContext('skills', {
            description: '요청에 따라 참고하는 스킬들',
            provider: new R2SkillProvider(this.env.SKILLS, {
                prefix: 'skills/',
                keys: ['squat-form.md', 'running-program.md', 'stretching.md']
            })
        })
            .withCachedPrompt()
            .compactAfter(100_000)
    }
}
