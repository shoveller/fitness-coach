import {Session, Think, type ThinkModel} from '@cloudflare/think'
import {createLLM} from "./createLLM.ts";
import {tool, type ToolSet} from "ai";
import {z} from "zod";
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

export type ThinkAgentState = {
    files: FileInfo[]
}

export class ThinkAgent extends Think<Env, ThinkAgentState> {
    extensionLoader = this.env.LOADER

    initialState: ThinkAgentState = {
        files: []
    }

    async onStart() {
        await this.refreshFiles()
    }

    async onChatResponse() {
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
            getWheather: tool({
                description: '날씨를 가져온다',
                inputSchema: z.object({
                    city: z.string().meta({ description: '도시의 이름' })
                }),
                execute: ({ city }) => {
                    return `${city} 는 맑은 날씨`
                }
            }),
            ...createExtensionTools({ manager: this.extensionManager! })
        }
    }

    // 외부 메모리 레이어와 통합하는 곳
    configureSession(session: Session) {
        return session.withContext('soul', {
            provider: {
                async get() {
                    return '너는 나를 돕는 피트니스 코치야'
                }
            }
        }).withContext('memory', {
            description: '사용자의 운동 목표, 선호도, 신체적 제약',
            maxTokens: 1100
        }).withContext('skills', {
            description: '요청에 따라 참고하는 스킬들',
            provider: new R2SkillProvider(this.env.SKILLS, { prefix: 'skills' })
        })
            .withCachedPrompt()
            .compactAfter(100_000)
    }
}
