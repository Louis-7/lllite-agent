import type { Context } from "@earendil-works/pi-ai";
import { azureComplete } from "./azure.ts";

const context: Context = {
    systemPrompt: "You are a helpful assistant. Reply in Chinese",
    messages: [
        { role: "user", content: "用一句话解释什么是 Agent Loop", timestamp: Date.now() },
    ],
};

const response = await azureComplete(context);

const first = response.content[0];

console.log(first?.type === "text" ? first.text : response.errorMessage ?? "No text response");
console.log(`\n[model: ${response.model}, tokens: ${response.usage.input}+${response.usage.output}]`);
