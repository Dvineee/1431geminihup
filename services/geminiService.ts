
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { Bot } from "../types.ts";

export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const createBotChat = (bot: Bot, history: any[] = [], modelName: string = 'gemini-3-flash-preview'): Chat => {
  const ai = getGeminiClient();
  
  const fullSystemInstruction = `
    Senin adın ${bot.name}. Sen "Premium Engineering & Advanced Intelligence" modunda çalışan, dünya standartlarında bir yapay zeka asistanısın.
    
    UZMANLIK ALANLARIN:
    1. YAZILIM MİMARİSİ: En güncel frameworkler, Clean Code, SOLID prensipleri ve performans optimizasyonu.
    2. HIZLI ANALİZ VE İŞLEM: Karmaşık verileri milisaniyeler içinde işleyip en verimli çözüm yolunu bulursun.
    3. DERİN ARAŞTIRMA: Bilgiye en hızlı ve en doğru kaynaktan ulaşırsın.

    DESTEK VE İLETİŞİM BİLGİLERİ:
    - E-posta: ${bot.contactEmail || 'Belirtilmedi'}
    - Web Sitesi: ${bot.website || 'Belirtilmedi'}
    - Ek Bilgiler: ${bot.otherInfo || 'Yok'}

    KRİTİK TALİMATLAR:
    ${bot.systemInstruction}
    
    BİLGİ TABANI (RAG):
    ${bot.knowledgeBase.map(k => `- ${k.content}`).join('\n')}
    
    PREMIUM ÇALIŞMA KURALLARI:
    - Yanıtların her zaman "Senior Lead Engineer" seviyesinde teknik derinliğe sahip olmalı.
    - Yazılım isteklerinde her zaman ölçeklenebilir ve güvenli kod üret.
    - Her kod bloğunun en başına mutlaka şu formatta dosya adını ekle: // filename: dosyaadi.uzanti
    - ${bot.canPreviewCode ? 'Standalone, modern UI/UX prensiplerine uygun HTML/Tailwind kodları üret ve ```html blokları içine al.' : 'Kod yazma yetkin sınırlı.'}
    - ${bot.hasSearchGrounding ? 'HIZLI ARAMA AKTİF: En güncel teknik dokümantasyonlar ve haberler için Google Search aracını agresif kullan.' : 'Sadece eğitim verine güven.'}
    
    MEDYA YETENEKLERİ:
    - ${bot.hasImageGen ? '[GENERATE_IMAGE: prompt] formatını kullanarak görsel üret.' : 'Görsel üretme.'}
    - ${bot.hasVideoGen ? '[GENERATE_VIDEO: prompt] formatını kullanarak video üret.' : 'Video üretme.'}
  `;

  const tools: any[] = [];
  if (bot.hasSearchGrounding) {
    tools.push({ googleSearch: {} });
  }

  return ai.chats.create({
    model: modelName,
    history: history,
    config: {
      systemInstruction: fullSystemInstruction,
      temperature: bot.temperature,
      topP: bot.topP,
      topK: bot.topK,
      tools: tools.length > 0 ? tools : undefined
    },
  });
};

export const sendMessageWithGrounding = async (
  chat: Chat, 
  message: any, 
  onChunk: (text: string, grounding?: any[]) => void
) => {
  try {
    const streamResponse = await chat.sendMessageStream({ message });
    for await (const chunk of streamResponse) {
      const c = chunk as GenerateContentResponse;
      const text = c.text;
      const grounding = c.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (text || grounding) {
        onChunk(text || '', grounding);
      }
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error?.message?.includes('429')) {
      throw new Error("SYSTEM_BUSY");
    }
    throw error;
  }
};

export const generateImage = async (prompt: string): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { 
      imageConfig: { 
        aspectRatio: "1:1"
      } 
    }
  });
  
  const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (part?.inlineData) {
    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }
  throw new Error("Görsel üretilemedi.");
};

export const generateVideo = async (prompt: string): Promise<string> => {
  const ai = getGeminiClient();
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  const videoResp = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!videoResp.ok) throw new Error("Video indirilemedi.");
  const blob = await videoResp.blob();
  return URL.createObjectURL(blob);
};
