import { execFileSync } from "node:child_process";
import { loadEnvFile } from "node:process";
import { createModels, createProvider, type Context, type Model } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

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

const context: Context = {
    systemPrompt: "You are a helpful assistant. Reply in Chinese",
    messages: [
        { role: "user", content: "用一句话解释什么是 Agent Loop", timestamp: Date.now() },
    ],
};

const response = await models.completeSimple(model, context, {
    // Azure needs the api-version query parameter that the OpenAI SDK does not add.
    fetch: (input, init) => {
        const url = new URL(typeof input === "string" ? input : input.toString());
        url.searchParams.set("api-version", API_VERSION);
        return fetch(url, init);
    },
});

const first = response.content[0];

console.log(first?.type === "text" ? first.text : response.errorMessage ?? "No text response");
console.log(`\n[model: ${response.model}, tokens: ${response.usage.input}+${response.usage.output}]`);
