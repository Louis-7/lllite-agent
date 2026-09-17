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

/** Azure OpenAI deployment configured from `.env`. */
export const azureModel: Model<"openai-completions"> = {
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
        models: [azureModel],
        api: openAICompletionsApi(),
    }),
);

type PiCallOptions = NonNullable<Parameters<typeof models.streamSimple>[2]>;
export type AzureCallOptions = Omit<PiCallOptions, "fetch">;

const azureFetch: typeof fetch = (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.toString());
    url.searchParams.set("api-version", API_VERSION);
    return fetch(url, init);
};

function withAzureFetch(options?: AzureCallOptions): PiCallOptions {
    return { ...options, fetch: azureFetch };
}

/** Non-streaming completion against the configured Azure deployment. */
export function azureComplete(context: Context, options?: AzureCallOptions) {
    return models.completeSimple(azureModel, context, withAzureFetch(options));
}

/** Streaming completion against the configured Azure deployment. */
export function azureStream(context: Context, options?: AzureCallOptions) {
    return models.streamSimple(azureModel, context, withAzureFetch(options));
}
