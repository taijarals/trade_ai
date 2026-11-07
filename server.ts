import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FOXBIT_BASE_URL = 'https://api.foxbit.com.br/rest/v3';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Gemini API client setup
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  // Foxbit Proxy endpoint
  app.get('/api/foxbit/:path(*)', async (req, res) => {
    try {
      const endpointPath = req.params.path;
      const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
      const targetUrl = `${FOXBIT_BASE_URL}/${endpointPath}${queryString ? `?${queryString}` : ''}`;
      
      console.log(`[Foxbit Proxy] Fetching: ${targetUrl}`);
      const response = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RoboTendenciaLaboratorio/1.0'
        }
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({
          error: `Foxbit API error (${response.status})`,
          details: data
        });
      }

      res.json(data);
    } catch (error: any) {
      console.error('[Foxbit Proxy Error]:', error);
      res.status(500).json({ error: error.message || 'Falha ao comunicar com a API da Foxbit' });
    }
  });

  // AI Prediction endpoint
  app.post('/api/ai/predict', async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
      }

      const { candles, modelName = 'gemini-2.5-flash', temperature = 0.2, horizon = 4, anonymized = true } = req.body;

      if (!candles || !Array.isArray(candles) || candles.length === 0) {
        return res.status(400).json({ error: 'Nenhum candle fornecido para análise.' });
      }

      const prompt = `Você é um analista quantitativo especialista em criptomoedas.
Analise a seguinte janela de ${candles.length} candles ${anonymized ? 'anonimizados (preços normalizados onde o primeiro candle é 100)' : 'reais'}.
Preveja a probabilidade do preço estar MAIS ALTO daqui a exatos ${horizon} candles (horizonte H).

Retorne estritamente um JSON com:
- "probabilidadeAlta": número inteiro de 0 a 100 representando a probabilidade (%) de alta.
- "justificativa": texto conciso em português do Brasil com no máximo 2 frases explicando o raciocínio técnico.

Dados dos candles (formato: [abertura, máxima, mínima, fechamento, volume]):
${JSON.stringify(candles)}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: Number(temperature),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              probabilidadeAlta: { type: Type.INTEGER, description: 'Probabilidade de alta de 0 a 100' },
              justificativa: { type: Type.STRING, description: 'Justificativa técnica em até 2 frases' }
            },
            required: ['probabilidadeAlta', 'justificativa']
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error('Resposta vazia do modelo Gemini.');
      }

      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (error: any) {
      console.error('[AI Predict Error]:', error);
      res.status(500).json({ error: error.message || 'Erro ao gerar previsão com a IA.' });
    }
  });

  // Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
