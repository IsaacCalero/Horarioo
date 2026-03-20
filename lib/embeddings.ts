import { HfInference } from '@huggingface/inference';

const HF_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';

/**
 * Genera un embedding de 384 dimensiones para un texto
 * usando el SDK oficial de Hugging Face (featureExtraction).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

  const result = await hf.featureExtraction({
    model: HF_MODEL,
    inputs: text,
  });

  // featureExtraction puede devolver vector 1D o matriz [tokens x dims]
  if (Array.isArray(result) && typeof result[0] === 'number') {
    return result as number[];
  }

  if (Array.isArray(result) && Array.isArray(result[0])) {
    // Mean pooling sobre tokens
    const tokenEmbeddings = result as number[][];
    const dim = tokenEmbeddings[0]?.length ?? 0;
    if (dim === 0) throw new Error('Hugging Face devolvió un embedding vacío.');
    const pooled = new Array(dim).fill(0);
    for (const tokenVec of tokenEmbeddings) {
      for (let i = 0; i < dim; i++) pooled[i] += tokenVec[i] ?? 0;
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
