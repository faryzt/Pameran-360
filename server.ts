import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, type GenerateContentResponse } from '@google/genai';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import {
  getOrCreateUser,
  listArtworksFromDb,
  upsertArtworkInDb,
  deleteArtworkFromDb,
  createOrderInDb,
} from './src/db/users.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let aiInstance: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '25mb' }));

  // ─── CLOUD SQL DATABASE API ROUTES ───────────────────────────────────────
  app.get('/api/artworks', async (_req, res) => {
    try {
      const rows = await listArtworksFromDb();
      res.json({ artworks: rows });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch artworks';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/artworks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || 'curator@pameranvirtual.id';
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized user' });
      }
      await getOrCreateUser(uid, email, req.user?.name);
      const body = req.body;
      const saved = await upsertArtworkInDb({
        id: String(body.id),
        title: String(body.title),
        creator: String(body.creator),
        level: String(body.level),
        school: String(body.school),
        region: String(body.region),
        category: String(body.category),
        price: Number(body.price),
        yaw: Number(body.yaw),
        pitch: Number(body.pitch),
        room: String(body.room || 'interior'),
        description: String(body.description),
        whatsapp: String(body.whatsapp || '6285111581115'),
        motifType: String(body.motifType || 'batik'),
        palettePrimary: String(body.palettePrimary || '#d97706'),
        paletteSecondary: String(body.paletteSecondary || '#78350f'),
        imageUrl: body.imageUrl ? String(body.imageUrl) : null,
        userUid: uid,
      });
      res.json({ artwork: saved });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to save artwork';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/artworks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await deleteArtworkFromDb(String(req.params.id));
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete artwork';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/orders', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || 'buyer@pameranvirtual.id';
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized user' });
      }
      await getOrCreateUser(uid, email, req.user?.name);
      const { buyerName, items, totalPrice } = req.body;
      const order = await createOrderInDb(
        uid,
        String(buyerName || email),
        JSON.stringify(items || []),
        Number(totalPrice || 0),
      );
      res.json({ order });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create order';
      res.status(500).json({ error: msg });
    }
  });

  // ─── GEMINI AI ROUTES (SERVER-SIDE ONLY) ─────────────────────────────────

  // 1. Google Search Grounding (gemini-4-hydrogen)
  app.post('/api/ai/search-grounding', async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }
      const response: GenerateContentResponse = await getAI().models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Berikan konteks budaya Nusantara terkini, sejarah tradisi, dan apresiasi seni untuk topik/karya berikut dalam Bahasa Indonesia yang ringkas dan informatif: ${query}`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks
        .map((c: any) =>
          c.web ? { uri: c.web.uri, title: c.web.title || c.web.uri } : null,
        )
        .filter(Boolean);

      res.json({
        text: response.text || '',
        sources,
      });
    } catch (error: unknown) {
      console.error('Search grounding error:', error);
      const msg = error instanceof Error ? error.message : 'Gemini Search Grounding error';
      res.status(500).json({ error: msg });
    }
  });

  // 2. Google Maps Grounding (gemini-4-hydrogen)
  app.post('/api/ai/maps-grounding', async (req, res) => {
    try {
      const { region, school, latitude, longitude } = req.body;
      const prompt = `Temukan museum budaya, galeri seni, sanggar kerajinan, atau pusat kebudayaan yang relevan di sekitar ${school || ''} ${region || 'Indonesia'} beserta informasi lokasinya dalam Bahasa Indonesia.`;
      const toolConfig: any = {};
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        toolConfig.retrievalConfig = {
          latLng: { latitude, longitude },
        };
      }

      const response: GenerateContentResponse = await getAI().models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          ...(Object.keys(toolConfig).length > 0 ? { toolConfig } : {}),
        },
      });

      const chunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const places = chunks
        .map((c: any) => {
          if (!c.maps) return null;
          const snippets =
            c.maps.placeAnswerSources?.reviewSnippets?.map(
              (s: any) => s.content || s.text || '',
            ) || [];
          return {
            uri: c.maps.uri,
            title: c.maps.title || 'Lokasi Budaya di Google Maps',
            reviewSnippets: snippets,
          };
        })
        .filter(Boolean);

      res.json({
        text: response.text || '',
        places,
      });
    } catch (error: unknown) {
      console.error('Maps grounding error:', error);
      const msg = error instanceof Error ? error.message : 'Gemini Maps Grounding error';
      res.status(500).json({ error: msg });
    }
  });

  // 3. High-Quality Image Generation (gemini-3-pro-image-preview / gemini-nano-banana-2.1)
  app.post('/api/ai/generate-image', async (req, res) => {
    try {
      const {
        prompt,
        aspectRatio = '1:1',
        imageSize = '1K',
        model = 'gemini-3-pro-image-preview',
      } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const selectedModel =
        model === 'gemini-nano-banana-2.1'
          ? 'gemini-nano-banana-2.1'
          : 'gemini-3-pro-image-preview';

      const response: GenerateContentResponse = await getAI().models.generateContent({
        model: selectedModel,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      });

      let imageUrl: string | null = null;
      let textOutput = '';
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textOutput += part.text;
        }
      }

      if (!imageUrl) {
        return res
          .status(500)
          .json({ error: textOutput || 'No image returned by model' });
      }

      res.json({ imageUrl, text: textOutput });
    } catch (error: unknown) {
      console.error('Image generation error:', error);
      const msg = error instanceof Error ? error.message : 'Gemini Image Generation error';
      res.status(500).json({ error: msg });
    }
  });

  // 4. Analyze Uploaded Artwork Photo (gemini-4-argon)
  app.post('/api/ai/analyze-image', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', prompt } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const stripped = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;

      const response: GenerateContentResponse = await getAI().models.generateContent({
        model: 'gemini-4-argon',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: stripped,
              },
            },
            {
              text:
                prompt ||
                'Analisis karya seni pelajar Nusantara ini secara kuratorial: sebutkan teknik, motif budaya daerah, filosofi visual, dan rekomendasi rentang harga jual (IDR) dalam Bahasa Indonesia.',
            },
          ],
        },
      });

      res.json({ text: response.text || '' });
    } catch (error: unknown) {
      console.error('Image analysis error:', error);
      const msg = error instanceof Error ? error.message : 'Gemini Image Analysis error';
      res.status(500).json({ error: msg });
    }
  });

  // 5. High Thinking Mode Curatorial Synthesis (gemini-4-carbon + ThinkingLevel.HIGH)
  app.post('/api/ai/deep-curatorial', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const response: GenerateContentResponse = await getAI().models.generateContent({
        model: 'gemini-4-carbon',
        contents: prompt,
        config: {
          systemInstruction:
            'Anda adalah Kepala Kurator Galeri Nasional & Pakar Pedagogi Seni Budaya Nusantara. Berikan analisis mendalam, terstruktur, dan aplikatif dalam Bahasa Indonesia.',
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });

      res.json({ text: response.text || '' });
    } catch (error: unknown) {
      console.error('Deep curatorial thinking error:', error);
      const msg = error instanceof Error ? error.message : 'Gemini Deep Thinking error';
      res.status(500).json({ error: msg });
    }
  });

  // 6. Animate Image into Video (gemini-omni-1.2-flash via Interactions API)
  app.post('/api/ai/animate-video', async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType = 'image/png',
        prompt = 'Gerakan sinematik halus menghidupkan karya seni budaya Nusantara dengan pencahayaan galeri hangat.',
        aspectRatio = '16:9',
      } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
      }

      const stripped = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;
      const validRatio = aspectRatio === '9:16' ? '9:16' : '16:9';

      const interaction = await getAI().interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: [
            {
              type: 'image',
              mime_type: mimeType,
              data: stripped,
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: validRatio,
          },
        },
        { timeout: 300000 },
      );

      const videoPart = interaction.output_video;
      if (videoPart?.data) {
        const videoMime = videoPart.mime_type || 'video/mp4';
        return res.json({
          videoUrl: `data:${videoMime};base64,${videoPart.data}`,
        });
      }
      if (videoPart?.uri) {
        return res.json({ videoUrl: videoPart.uri });
      }

      return res
        .status(500)
        .json({ error: 'Model completed without returning video data.' });
    } catch (error: unknown) {
      console.error('Video animation error:', error);
      const msg = error instanceof Error ? error.message : 'Gemini Omni Video error';
      res.status(500).json({ error: msg });
    }
  });

  // ─── VITE MIDDLEWARE / STATIC ASSETS ─────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    let viteInstance: ViteDevServer | null = null;
    const vitePromise = createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    }).then((v) => {
      viteInstance = v;
      return v;
    });

    app.use(async (req, res, next) => {
      try {
        const vite = viteInstance ?? (await vitePromise);
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pameran Virtual server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
