// Reads two settings from Netlify (Site settings > Environment variables):
//   GEMINI_API_KEY  your Google AI Studio key
//   AI_MODEL        the model name, e.g. gemini-3.8-flash
const reply = (statusCode, obj) => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(obj),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { error: "POST only" });

  const key = process.env.GEMINI_API_KEY;
  const model = process.env.AI_MODEL || "gemini-3.8-flash";
  if (!key) return reply(500, { error: "GEMINI_API_KEY is not set in Netlify." });

  let messages;
  try {
    messages = JSON.parse(event.body).messages;
  } catch (e) {
    return reply(400, { error: "Bad request." });
  }
  if (!Array.isArray(messages) || !messages.length || messages.length > 60) {
    return reply(400, { error: "Bad request." });
  }

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content).slice(0, 20000) }],
  }));

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(model) + ":generateContent",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents }),
      }
    );
    const j = await r.json();
    if (!r.ok) return reply(r.status, { error: (j.error && j.error.message) || "Gemini error." });
    const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.map((p) => p.text || "").join("");
    if (!text) return reply(502, { error: "The model returned no text." });
    return reply(200, { text });
  } catch (e) {
    return reply(502, { error: "Couldn’t reach Gemini." });
  }
};
