exports.handler = async (event, context) => {
  /* --- CORS headers --- */
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: cors };

  if (event.httpMethod !== "POST")
    return { statusCode: 405, headers: cors };

  const { message, thread_id } = JSON.parse(event.body || "{}");
  if (!message)
    return { statusCode: 400, headers: cors, body: '{"error":"No message"}' };

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const assistant_id = process.env.ASSISTANT_ID;

  const thread = thread_id
      ? await client.beta.threads.retrieve(thread_id)
      : await client.beta.threads.create();

  await client.beta.threads.messages.create(thread.id,
        { role: "user", content: message });

  let run = await client.beta.threads.runs.create({
        thread_id: thread.id,
        assistant_id,
        temperature: 0.25
  });

  while (["queued", "in_progress"].includes(run.status)) {
        await new Promise(r => setTimeout(r, 800));
        run = await client.beta.threads.runs.retrieve(
               { thread_id: thread.id, run_id: run.id });
  }
  if (run.status !== "completed")
        return { statusCode: 500, headers: cors, body: '{"error":"run failed"}' };

  const reply = (await client.beta.threads.messages.list(thread.id))
                .data[0].content[0].text.value;

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({ thread_id: thread.id, reply })
  };
};
