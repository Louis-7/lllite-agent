import { execFileSync } from "node:child_process";
import { loadEnvFile } from "node:process";
import * as readline from "node:readline";
import { createModels, createProvider, type Context, type Model, type Message, type Tool } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

// Azure openai api setup

loadEnvFile();

function requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing ${name}. Set it in .env`);
    }
    return value;
}

const BASE_URL = requiredEnv("AZURE_OPENAI_BASE_URL");
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT?.trim() || "gpt-4o";
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION?.trim() || "2024-10-21";

const azureFetch: typeof fetch = (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    url.searchParams.set("api-version", API_VERSION);
    return fetch(url, init);
};

function azureCliToken(): string {
    const json = execFileSync(
        "az",
        ["account", "get-access-token", "--resource", "https://cognitiveservices.azure.com", "-o", "json"],
        { encoding: "utf8" },
    );
    const token = (JSON.parse(json) as { accessToken?: string }).accessToken;
    if (!token) {
        throw new Error("az did not return an accessToken. Run: az login");
    }
    return token;
}

const token = azureCliToken();

const model: Model<"openai-completions"> = {
    id: DEPLOYMENT,
    name: `Azure ${DEPLOYMENT}`,
    api: "openai-completions",
    provider: "azure-apim",
    baseUrl: `${BASE_URL.replace(/\/+$/, "")}/deployments/${DEPLOYMENT}`,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 16384,
};

const models = createModels();
models.setProvider(
    createProvider({
        id: "azure-apim",
        name: "Azure OpenAI via APIM",
        auth: { apiKey: { name: "Azure CLI token", resolve: async () => ({ auth: { apiKey: token } }) } },
        models: [model],
        api: openAICompletionsApi(),
    }),
);


// Major functions

const tools: Tool[] = [{
    name: "get_current_time",
    description: "Get the current date and time in ISO format",
    parameters: { type: "object", properties: {} } as any,
}];

const messages: Message[] = [
    { role: "user", content: "What is the current time?", timestamp: Date.now() },
]

const stream1 = models.streamSimple(model, { systemPrompt: "Replay in Chinese", messages, tools }, {
    fetch: azureFetch,
});

for await (const e of stream1) { }
const reply1 = await stream1.result();
messages.push(reply1);

const toolCalls = reply1.content.filter(c => c.type === "toolCall");

if (toolCalls.length > 0) {
    // 执行工具
    for (const tc of toolCalls) {
        const result = new Date().toISOString(); // 实际执行
        messages.push({
            role: "toolResult",
            toolCallId: tc.id,
            toolName: tc.name,
            content: [{ type: "text", text: result }],
            isError: false,
            timestamp: Date.now(),
        });
    }

    // 第 2 次调用（带工具结果）
    const stream2 = models.streamSimple(model, { systemPrompt: "Reply in Chinese.", messages, tools }, {
        fetch: azureFetch,
    });
    for await (const e of stream2) {
        if (e.type === "text_delta") process.stdout.write(e.delta);
    }
    const reply2 = await stream2.result();
    messages.push(reply2);
}

console.log(messages);