import { builtinModels, getBuiltinModel } from "@earendil-works/pi-ai/providers";
import type {Context} from "@earendil-works/pi-ai";

const models = builtinModels();

const model = getBuiltinModel("gpt-4o-mini", models);

const context: Context = {
    systemPromot: "You are a helpful assistant. Reply in Chinese",
    messages: [
        {role: "user", content: "用一句话解释什么是 Agent Loop", timestamp: Date.now()},
    ],
};

const response = await models.completeSimple(model, context);

console.log(response.content[0].content.type === "text" ? response.content[0].content.text : "No text response");
console.log(`\n[model: ${response.model}, tokens: ${response.usage.input}+${response.usage.output}]`);