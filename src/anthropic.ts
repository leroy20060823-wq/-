import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

// Single shared client for the whole process. The SDK also reads
// ANTHROPIC_API_KEY from the environment automatically; passing it explicitly
// keeps the dependency on config visible.
export const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
