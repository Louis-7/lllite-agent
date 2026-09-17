import * as readline from "node:readline";
import type { Context, Message } from "@earendil-works/pi-ai";
import { azureStream } from "./azure.ts";

const messages: Message[] = [];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

console.log("Multiple-round chat (quit with /quit) \n");

while (true) {
    const input = await question("> ");
    if (input.trim() === "/quit") break;
    if (!input.trim()) continue;

    messages.push({ role: "user", content: input, timestamp: Date.now() });

    const context: Context = {
        systemPrompt: "You are a helpful assistant. Reply in Chinese",
        messages,
    };

    const stream = azureStream(context);

    for await (const event of stream) {
        if (event.type === "text_delta") {
            process.stdout.write(event.delta);
        }
    }

    console.log("/n");

    const reply = await stream.result();
    messages.push(reply);
}

rl.close();
