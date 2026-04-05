import Groq from "groq-sdk";
import { GROQ_API_KEY, GROQ_MODEL } from "../config.js";

const client = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

function mockChatReply(userMessage) {
  const lower = userMessage.toLowerCase();
  if (lower.includes("protein")) {
    return "Today, look for items tagged **high protein** on your menu — often dal, paneer, eggs, or legumes. This is general nutrition guidance, not medical advice.";
  }
  if (lower.includes("muscle")) {
    return "For muscle gain goals, prioritize adequate protein across meals and stay hydrated. Choose grilled or baked options when available and pair carbs with protein. Consult a dietitian for personalized plans.";
  }
  return "I can help with mess menu choices and general nutrition tips. I cannot diagnose conditions. For medical concerns, please speak to a healthcare professional.";
}

async function chatCompletion(systemContent, userContent) {
  if (!client) throw new Error("No API key");
  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
    temperature: 0.6,
    max_tokens: 2048,
  });
  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty Groq response");
  return text;
}

/**
 * Nutrition / mess assistant — returns { text, mock, disclaimer? }
 */
export async function groqChat(systemHint, userMessage) {
  if (!GROQ_API_KEY) {
    return {
      text: mockChatReply(userMessage),
      mock: true,
      disclaimer: "Educational only. Not medical diagnosis. Demo mode (no API key).",
    };
  }
  try {
    const text = await chatCompletion(
      `${systemHint}\n\nReply briefly, friendly, no medical diagnosis, add disclaimer if giving health tips.`,
      userMessage
    );
    return {
      text,
      mock: false,
      disclaimer: "This guidance is educational only and not a substitute for professional medical advice.",
    };
  } catch (e) {
    console.error("Groq chat error:", e.message);
    return {
      text: mockChatReply(userMessage),
      mock: true,
      disclaimer: "Fallback mode: API error. Not medical advice.",
    };
  }
}

export async function groqSummarizeMonthly(contextBlock) {
  if (!GROQ_API_KEY) {
    return {
      text: `Executive summary (demo mode):\n\n${contextBlock.slice(0, 2000)}\n\n[Add GROQ_API_KEY for AI-written summary.]`,
      mock: true,
    };
  }
  try {
    const userContent = `Summarize this mess hall data for a monthly review meeting. Sections: executive summary, top complaints themes, appreciated items, student suggestions, waste insights, 3 action points.\n\nDATA:\n${contextBlock}`;
    const text = await chatCompletion(
      "You write concise executive summaries for university mess hall operations.",
      userContent
    );
    return { text, mock: false };
  } catch (e) {
    console.error("Groq summarize error:", e.message);
    return { text: contextBlock.slice(0, 4000), mock: true };
  }
}

export async function groqMealPlanHint(healthGoal, menuSummary) {
  const userContent = `Student health goal: ${healthGoal}. Today's menu summary:\n${menuSummary}\nSuggest which current items to prefer or limit. Short bullet points. No medical claims.`;
  if (!GROQ_API_KEY) {
    return {
      text: `- Prefer balanced plates: protein + vegetables + moderate carbs.\n- Limit deep-fried items if goal is weight loss.\n- Add GROQ_API_KEY in server/.env for live AI suggestions.\n(Demo mode)`,
      mock: true,
    };
  }
  try {
    const text = await chatCompletion(
      "You are a practical campus dining assistant. No medical diagnosis.",
      userContent
    );
    return { text, mock: false };
  } catch (e) {
    console.error("Groq meal plan error:", e.message);
    return {
      text: `- Prefer dal, eggs, or paneer for protein; pair with rice or roti in moderate portions.\n- Limit fried snacks if your goal is weight loss.\n- (AI fallback — check GROQ_API_KEY and model name in Groq Cloud.)`,
      mock: true,
    };
  }
}
