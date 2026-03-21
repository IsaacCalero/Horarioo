import { createOpenAI } from '@ai-sdk/openai';
import { streamText, createUIMessageStreamResponse } from 'ai';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { generateEmbedding } from '@/lib/embeddings';

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

type VectorMatchRow = {
  page_number: number | null;
  chunk_text: string;
};

type DocumentRow = {
  id: string;
};

type ChunkRow = {
  chunk_text: string | null;
  page_number: number | null;
  chunk_number: number | null;
};

type ChatPart = {
  type?: string;
  text?: string;
};

type IncomingMessage = {
  role?: string;
  content?: string;
  parts?: ChatPart[];
};

type ModelMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/**
 * Realiza búsqueda vectorial en Supabase para encontrar chunks similares
 */
async function searchRelevantChunks(query: string, studentId: string, limit: number = 5): Promise<string> {
  try {
    const supabase = getSupabaseServerClient();
    const queryEmbedding = await generateEmbedding(query);

    // Búsqueda vectorial: encontrar chunks similares
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.2,
      match_count: limit,
      student_id: studentId,
    });

    if (!error && data && data.length > 0) {
      // Combinar chunks relevantes de búsqueda vectorial
      return (data as VectorMatchRow[])
        .map((item) => `[Página ${item.page_number}] ${item.chunk_text}`)
        .join('\n\n');
    }

    if (error) {
      console.error('Error en búsqueda vectorial (se usa fallback):', error);
    }

    // Fallback léxico: usar chunks del estudiante y rankear por coincidencia de palabras.
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (docsError || !docs || docs.length === 0) {
      return '';
    }

    const docIds = (docs as DocumentRow[]).map((d) => d.id);

    const { data: chunks, error: chunksError } = await supabase
      .from('document_chunks')
      .select('chunk_text,page_number,chunk_number,document_id')
      .in('document_id', docIds)
      .limit(200);

    if (chunksError || !chunks || chunks.length === 0) {
      return '';
    }

    const terms = [...new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length >= 4))].slice(0, 10);
    const scored = (chunks as ChunkRow[])
      .map((c) => {
        const text = String(c.chunk_text ?? '').toLowerCase();
        const score = terms.reduce((acc, t) => acc + (text.includes(t) ? 1 : 0), 0);
        return { ...c, score };
      })
      .sort((a, b) => b.score - a.score || (a.chunk_number ?? 0) - (b.chunk_number ?? 0))
      .slice(0, limit);

    return scored
      .map((item) => `[Página ${item.page_number ?? '?'}] ${item.chunk_text}`)
      .join('\n\n');
  } catch (error) {
    console.error('Error generando embedding para búsqueda:', error);
    return '';
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { messages?: IncomingMessage[]; studentId?: string };
    const messages = body.messages ?? [];
    const studentId = body.studentId;

    if (!messages || messages.length === 0) {
      return new Response('No hay mensajes', { status: 400 });
    }

    // Convertir y sanitizar UIMessages a texto plano para evitar content types no soportados por Groq.
    const modelMessages: ModelMessage[] = messages
      .map((msg) => {
        const text = Array.isArray(msg.parts)
          ? msg.parts
              .filter((p) => p.type === 'text' && typeof p.text === 'string')
              .map((p) => p.text ?? '')
              .join('')
          : (typeof msg.content === 'string' ? msg.content : '');

        if (msg.role !== 'user' && msg.role !== 'assistant') {
          return null;
        }

        return {
          role: msg.role,
          content: text.trim(),
        };
      })
      .filter((msg): msg is ModelMessage => !!msg && msg.content.length > 0);

    if (modelMessages.length === 0) {
      return new Response('No hay contenido de texto en los mensajes', { status: 400 });
    }

    // Obtener último mensaje del usuario para buscar contexto
    const lastMessage = [...modelMessages].reverse().find((m) => m.role === 'user');
    const userQuery = lastMessage?.content || '';

    // Buscar chunks relevantes del material del profesor
    let contextText = '';
    if (studentId) {
      contextText = await searchRelevantChunks(userQuery, studentId);
    }

    // Construir system prompt con contexto
    let systemPrompt = `Eres un tutor experto en Medicina. Tu objetivo es ayudar a una estudiante a repasar sus clases. 
             Cuando ella te envíe un resumen, compáralo con el conocimiento médico estándar y con sus notas de clase.
         Sé riguroso con la terminología y resalta lo que le falte aprender.
         No le pidas que vuelva a pegar un texto: si no hay contexto recuperado, responde con conocimiento médico general y dilo de forma breve.`;

    if (contextText) {
      systemPrompt += `\n\nMaterial de clase disponible:\n${contextText}\n\nUtiliza este material como referencia principal.`;
    }

    const result = await streamText({
      model: groq.chat('llama-3.1-8b-instant'),
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