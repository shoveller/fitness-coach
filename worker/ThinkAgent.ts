import {Think, type ThinkModel} from '@cloudflare/think'
import {createLLM} from "./createLLM.ts";

export class ThinkAgent extends Think<Env> {
    getModel(): ThinkModel {
        return createLLM()
    }
}