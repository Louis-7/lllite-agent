import type { Message, Tool } from "@earendil-works/pi-ai";
import { azureStream } from "./azure.ts";

const tools: Tool[] = [{
    name: "get_current_time",
    description: "Get the current date and time in ISO format",
    parameters: { type: "object", properties: {} } as any,
}];

const messages: Message[] = [
    { role: "user", content: "What is the current time?", timestamp: Date.now() },
];

const stream1 = azureStream({ systemPrompt: "Replay in Chinese", messages, tools });

for await (const e of stream1) { }
const reply1 = await stream1.result();
messages.push(reply1);

const toolCalls = reply1.content.filter((c) => c.type === "toolCall");

if (toolCalls.length > 0) {
    for (const tc of toolCalls) {
        const result = new Date().toISOString();
        messages.push({
            role: "toolResult",
            toolCallId: tc.id,
            toolName: tc.name,
            content: [{ type: "text", text: result }],
            isError: false,
            timestamp: Date.now(),
        });
    }

    const stream2 = azureStream({ systemPrompt: "Reply in Chinese.", messages, tools });
    for await (const e of stream2) {
        if (e.type === "text_delta") process.stdout.write(e.delta);
    }
    const reply2 = await stream2.result();
    messages.push(reply2);
}

console.log(messages);
