import {createOpenAICompatible} from "@ai-sdk/openai-compatible";
import {env} from "cloudflare:workers";

export const createLLM = () => {
    const llm = createOpenAICompatible({
        name: 'proxy',
        baseURL: 'https://models.illuwa.click/v1',
        apiKey: env.API_SERVER_KEY
    })

    return llm('gemini-3.8-flash-high')
}