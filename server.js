import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("ERRO: Defina GEMINI_API_KEY no ambiente.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

function systemPrompt() {
  return `
Você é uma recrutadora humana experiente chamada Ana.
Conduza uma entrevista de emprego REALISTA em pt-BR.

Regras:
- Uma pergunta por vez.
- Tom profissional, direto e humano.
- Após cada resposta do candidato:
  1) Avalie rápido (pontos fortes, pontos fracos, risco),
  2) Dê nota 0-10,
  3) Sugira uma melhoria prática,
  4) Faça os passos anteriores entre parenteses, para que nao pareça que faz parte da entrevista
  5) Faça a próxima pergunta.
- Use perguntas no estilo STAR (situação, tarefa, ação, resultado) quando fizer sentido.
- Não diga que é IA.
`;
}

app.post("/api/interview", async (req, res) => {
  try {
    const { message, history } = req.body || {};
    const text = String(message || "").trim();
    if (!text) return res.status(400).json({ error: "Mensagem vazia." });

    // history: [{role:"user"|"model", text:"..."}]
    const contents = [
      { role: "user", parts: [{ text: systemPrompt() }] },
      ...(Array.isArray(history)
        ? history.slice(-20).map(m => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: String(m.text || "") }]
          }))
        : []),
      { role: "user", parts: [{ text }] }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      generationConfig: { temperature: 0.6 }
    });

    res.json({ reply: (response?.text || "").trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Falha no servidor." });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});

