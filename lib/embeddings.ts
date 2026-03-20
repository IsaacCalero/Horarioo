const HF_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';

/**
 * Genera un embedding de 384 dimensiones para un texto
 * usando la API de inferencia gratuita de Hugging Face.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-task': 'feature-extraction',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        inputs: text,
        options: { wait_for_model: true },
      }),
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Hugging Face inference error (${response.status}): ${details}`);
  }

  const data = await response.json();

  // La salida puede ser vector 1D o matriz token x dimension.
  if (Array.isArray(data) && typeof data[0] === 'number') {
    return data as number[];
  }

  if (Array.isArray(data) && Array.isArray(data[0])) {
    const tokenEmbeddings = data as number[][];
    const dim = tokenEmbeddings[0]?.length ?? 0;

    if (dim === 0) {
      throw new Error('Hugging Face devolvio un embedding vacio.');
    }

    const pooled = new Array(dim).fill(0);
    for (const tokenVec of tokenEmbeddings) {
      for (let i = 0; i < dim; i++) {
        pooled[i] += tokenVec[i] ?? 0;
      }
    }

    return pooled.map((v) => v / tokenEmbeddings.length);
  }

  throw new Error('Formato de embedding no reconocido en respuesta de Hugging Face.');
}

/**
 * Divide un texto en chunks de ~500 caracteres
 * Intenta dividir por párrafos para mantener coherencia
 */
export function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Si no es el final, intenta dividir en el próximo punto
    if (end < text.length) {
      // Busca última sentencia completa
      const lastPeriod = text.lastIndexOf('.', end);
      if (lastPeriod > start + chunkSize / 2) {
        end = lastPeriod + 1;
      }
    }

    const chunk = text.substring(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;
  }

  return chunks;
}
