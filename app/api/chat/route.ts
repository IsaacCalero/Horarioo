import { createOpenAI } from '@ai-sdk/openai';
import { streamText, createUIMessageStreamResponse } from 'ai';
import { supabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/embeddings';

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Realiza búsqueda vectorial en Supabase para encontrar chunks similares
 */
async function searchRelevantChunks(query: string, studentId: string, limit: number = 5): Promise<string> {
  try {
    const queryEmbedding = await generateEmbedding(query);

    // Búsqueda vectorial: encontrar chunks similares
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.45,
      match_count: limit,
      student_id: studentId,
    });

    if (error) {
      console.error('Error en búsqueda vectorial:', error);
      return '';
    }

    if (!data || data.length === 0) {
      return '';
    }

    // Combinar chunks relevantes
    const relevantText = data
      .map((item: any) => `[Página ${item.page_number}] ${item.chunk_text}`)
      .join('\n\n');

    return relevantText;
  } catch (error) {
    console.error('Error generando embedding para búsqueda:', error);
    return '';
  }
}

export async function POST(req: Request) {
  try {
    const { messages, studentId } = await req.json();

    if (!messages || messages.length === 0) {
      return new Response('No hay mensajes', { status: 400 });
    }

    // Convertir UIMessages (formato @ai-sdk/react con parts) a ModelMessages (content string)
    const modelMessages = messages.map((msg: any) => {
      const text = Array.isArray(msg.parts)
        ? msg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('')
        : (msg.content ?? '');
      return { role: msg.role as 'user' | 'assistant', content: text };
    });

    // Obtener último mensaje del usuario para buscar contexto
    const lastMessage = modelMessages[modelMessages.length - 1];
    const userQuery = lastMessage?.content || '';

    // Buscar chunks relevantes del material del profesor
    let contextText = '';
    if (studentId) {
      contextText = await searchRelevantChunks(userQuery, studentId);
    }

    // Construir system prompt con contexto
    let systemPrompt = `Eres un tutor experto en Medicina. Tu objetivo es ayudar a una estudiante a repasar sus clases. 
             Cuando ella te envíe un resumen, compáralo con el conocimiento médico estándar y con sus notas de clase.
             Sé riguroso con la terminología y resalta lo que le falte aprender.`;

    if (contextText) {
      systemPrompt += `\n\nMaterial de clase disponible:\n${contextText}\n\nUtiliza este material como referencia principal.`;
    }

    const result = await streamText({
      model: groq('llama-3.1-8b-instant'),
      messages: modelMessages,
      system: systemPrompt,
    });

    return createUIMessageStreamResponse({
      stream: result.toUIMessageStream(),
    });
  } catch (error) {
    console.error('Error en chat:', error);
    return new Response('Error procesando mensaje', { status: 500 });
  }
}