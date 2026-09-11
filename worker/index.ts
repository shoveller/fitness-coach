import {routeAgentRequest} from "agents";

export { ThinkAgent } from './ThinkAgent.ts'

export default {
  async fetch(request , env) {
    return await routeAgentRequest(request,env) || new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
