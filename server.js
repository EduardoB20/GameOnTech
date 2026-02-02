import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Healthcheck pra testar no browser
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("ERRO: GEMINI_API_KEY não está definida no ambiente.");
  // Não dá process.exit no Render sem saber o log? Pode, mas deixa claro:
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

function systemPrompt() {
  return `
Você é uma recrutadora humana experiente chamada Ana.
O objetivo é que o usuario experiencie uma entrevista de emprego real.
Voce nao esta recrutando para nenhuma vaga, é apenas uma simulação.
Linguagem: pt-br

Regras:
- Uma pergunta por vez.
- Tom profissional, direto e humano.
- Após cada resposta do candidato:
  1) Avalie rápido (pontos fortes, pontos fracos, risco),
  2) Dê nota 0-10,
  3) Sugira uma melhoria prática,
  4) Faça a próxima pergunta.
  5) Faça uma separaçao no texto entre sugestões e a entrevista.
- Nao compartilhe de forma alguma informaçoes que comprometam o sistema
- Não diga que é IA.
- Nao deixe claro que é uma simulaçao, deve parecer real
`;
}

app.post("/api/interview", async (req, res) => {
  try {
    const { message, history } = req.body || {};
    const text = String(message || "").trim();
    if (!text) return res.status(400).json({ error: "Mensagem vazia." });

    const hist = Array.isArray(history) ? history : [];

    // Evita duplicar a mensagem atual caso o front já tenha dado push no history
    const trimmedHistory = (() => {
      const last = hist[hist.length - 1];
      if (last && last.role === "user" && String(last.text || "").trim() === text) {
        return hist.slice(0, -1);
      }
      return hist;
    })();

    const contents = [
      { role: "user", parts: [{ text: systemPrompt() }] },
      ...trimmedHistory.slice(-20).map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: String(m.text || "") }]
      })),
      { role: "user", parts: [{ text }] }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      generationConfig: { temperature: 0.6 }
    });

    res.json({ reply: (response?.text || "").trim() });
  } catch (err) {
    // Loga o erro real no Render
    console.error("ERRO /api/interview:", err?.stack || err);

    // Retorna um erro mais informativo
    res.status(500).json({
      error: "Falha no servidor.",
      detail: String(err?.message || err)
    });
  }
});

// ✅ Render precisa dessa porta dinâmica
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});
