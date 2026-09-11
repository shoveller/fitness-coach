import {Think, type ThinkModel} from '@cloudflare/think'
import {createLLM} from "./createLLM.ts";
import {tool, type ToolSet} from "ai";
import {z} from "zod";

export class ThinkAgent extends Think<Env> {
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
            })
        }
    }
}