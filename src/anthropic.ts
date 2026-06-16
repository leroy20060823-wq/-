import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

// Single shared client for the whole process. The API key is optional at boot;
// when it's absent we still construct the client with a non-empty placeholder so
// import never throws — the generation routes gate on config.hasApiKey and return
// 401 before this client is ever used.
export const anthropic = new Anthropic({ apiKey: config.anthropicApiKey ?? "not-configured" });
