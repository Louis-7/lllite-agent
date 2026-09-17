import type { Context } from "@earendil-works/pi-ai";
import { azureStream } from "./azure.ts";

const context: Context = {
    systemPrompt: "You are a helpful assistant. Reply in Chinese",
    messages: [
        { role: "user", content: "用三句话解释 TypeScript的系统类型", timestamp: Date.now() },
    ],
};

const stream = azureStream(context);

for await (const event of stream) {
    if (event.type === "text_delta") {
        process.stdout.write(event.delta);
    }
}

const message = await stream.result();

console.log(`\n\n[tokens: ${message.usage.input}+${message.usage.output}]`);
