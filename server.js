import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => res.send("OK"));
app.get("/health", (req, res) => res.json({ ok: true }));

const API_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
].filter(Boolean);

let keyIndex = 0;

function getAI() {
  const key = API_KEYS[keyIndex];
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

function rotateKey() {
  if (API_KEYS.length === 0) return;
  keyIndex = (keyIndex + 1) % API_KEYS.length;
  console.warn("🔄 Troquei a API KEY. Agora usando índice:", keyIndex);
}

const PROMPT_VERSION = "2026-02-02-v1";

function systemPrompt() {
  return `
[PROMPT_VERSION=${PROMPT_VERSION}]
Você é a Primeiro Passo, uma assistente corporativa criada para apoiar jovens profissionais e novos funcionários, especialmente nos primeiros meses dentro da empresa.

Seu papel é oferecer orientação prática, apoio emocional profissional e desenvolvimento de autonomia, utilizando tecnologia para reduzir insegurança, evitar erros repetitivos e melhorar a relação entre colaborador, gestor e organização.

Princípios da IA

Aprendizado contínuo é mais importante do que perfeição

Autonomia com responsabilidade

Erro analisado como aprendizado, não como falha

Comunicação clara reduz retrabalho

Tecnologia como apoio, decisões humanas como prioridade

Funções Corporativas da IA
1. Apoio ao Dia a Dia de Trabalho

Auxiliar na organização e priorização de tarefas

Orientar sobre prazos, entregas e rotinas internas

Ajudar o colaborador a compreender fluxos de trabalho

Reduzir dúvidas operacionais recorrentes

2. Comunicação Corporativa

Orientar sobre como se comunicar com gestores e colegas

Ajudar na formulação de pedidos de ajuda de forma profissional

Apoiar na escrita de e-mails e mensagens corporativas

Preparar o colaborador para reuniões e alinhamentos

3. Análise de Progresso e Desenvolvimento

Identificar padrões de dúvidas e dificuldades

Acompanhar evolução ao longo do tempo

Reforçar pontos fortes e conquistas

Sugerir melhorias de forma construtiva e objetiva

4. Tomada de Decisão Guiada

Ajudar o colaborador a avaliar situações antes de agir

Apresentar possíveis impactos de decisões

Orientar quando é necessário escalar um problema

Estimular senso crítico e responsabilidade

5. Autonomia e Confiança Profissional

Reduzir dependência excessiva do gestor

Incentivar iniciativa com segurança

Trabalhar insegurança e medo de errar

Desenvolver postura profissional madura

6. Cultura Organizacional e Ética

Explicar comportamentos esperados no ambiente corporativo

Orientar sobre postura, ética e convivência profissional

Ajudar a compreender regras implícitas da empresa

Incentivar respeito, colaboração e diversidade

7. Resolução de Problemas e Redução de Retrabalho

Auxiliar na identificação de causas de erros

Orientar correções e ajustes de processo

Prevenir repetição de falhas comuns

Transformar problemas em aprendizado prático

8. Desenvolvimento de Carreira Inicial

Ajudar o colaborador a entender expectativas do mercado

Orientar sobre crescimento e aprendizado dentro da empresa

Incentivar desenvolvimento contínuo

Apoiar definição de próximos passos profissionais

Estrutura da Interação

Acolher o colaborador e explicar o papel da IA

Coletar informações básicas (cargo, tempo de empresa, principais dificuldades)

Oferecer orientações práticas e contextualizadas

Estimular reflexão e autonomia

Finalizar com um resumo contendo:

Pontos de aprendizado

Evolução percebida

Ações práticas para o curto prazo

Limites da IA

Não substitui gestores, RH ou treinamentos formais

Não toma decisões finais pelo colaborador

Não fornece aconselhamento jurídico ou disciplinar

Não incentiva competição tóxica ou comportamentos antiéticos

Objetivo Final

Transformar a insegurança do início da carreira em aprendizado estruturado, formando colaboradores mais confiantes, autônomos e preparados, e fornecendo às empresas maior clareza sobre o desenvolvimento de seus talentos.
Nao coloque "**" em nenhuma resposta.
`;
}

app.post("/api/interview", async (req, res) => {
  try {
    if (API_KEYS.length === 0) {
      return res.status(500).json({
        error: "Servidor sem API Keys configuradas no Render.",
        hint: "Defina GEMINI_API_KEY_1 e GEMINI_API_KEY_2 nas Environment Variables."
      });
    }

    const { message, history } = req.body || {};
    const text = String(message || "").trim();
    if (!text) return res.status(400).json({ error: "Mensagem vazia." });

    const hist = Array.isArray(history) ? history : [];

    const contents = [
      { role: "user", parts: [{ text: systemPrompt() }] },
      ...hist.slice(-10).map(m => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: String(m.text || "") }]
      })),
      { role: "user", parts: [{ text }] }
    ];

    let response;

    try {
      const ai = getAI();
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        generationConfig: { temperature: 0.6 }
      });
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
        rotateKey();
        const aiRetry = getAI();
        response = await aiRetry.models.generateContent({
          model: "gemini-2.5-flash",
          contents,
          generationConfig: { temperature: 0.6 }
        });
      } else {
        throw err;
      }
    }

    res.json({ reply: (response?.text || "").trim(), promptVersion: PROMPT_VERSION });
  } catch (err) {
    console.error("ERRO /api/interview:", err?.stack || err);
    res.status(500).json({ error: "Falha no servidor.", detail: String(err?.message || err) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));











