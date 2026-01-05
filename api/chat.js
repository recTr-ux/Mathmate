export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { system, contents, history } = req.body;

  const messages = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  messages.push({ role: 'user', parts: contents.map(c => c.type === 'image_url' ? c : { text: c.text }) });

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/llama3-70b-8192:generateContent?key=${process.env.GROQ_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    res.status(200).json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
