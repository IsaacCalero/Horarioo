import { NextResponse } from 'next/server';
import { createRequire } from 'node:module';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { generateEmbedding, chunkText } from '@/lib/embeddings';

const require = createRequire(import.meta.url);

type PdfTextRun = { T?: string };
type PdfTextBlock = { R?: PdfTextRun[] };
type PdfPage = { Texts?: PdfTextBlock[] };
type PdfData = { Pages?: PdfPage[] };
type PdfErrorData = { parserError?: string };
type PdfParserInstance = {
  on: (
    event: 'pdfParser_dataError' | 'pdfParser_dataReady',
    listener: ((errData: PdfErrorData) => void) | ((pdfData: PdfData) => void)
  ) => void;
  parseBuffer: (buffer: Buffer) => void;
};
type PdfParserConstructor = new () => PdfParserInstance;
type PdfParseTextResult = {
  text?: string;
  pages?: unknown[];
  numpages?: number;
};
type PdfParseInstance = {
  getText: () => Promise<PdfParseTextResult>;
  destroy?: () => Promise<void> | void;
};
type PdfParseConstructor = new (options: { data: Buffer }) => PdfParseInstance;
type CanvasPolyfillModule = {
  DOMMatrix?: typeof DOMMatrix;
  ImageData?: typeof ImageData;
  Path2D?: typeof Path2D;
};

function ensureCanvasPolyfills(): { ok: boolean; reason?: string } {
  if (typeof globalThis.DOMMatrix !== 'undefined') {
    return { ok: true };
  }

  try {
    const canvasModule = require('@napi-rs/canvas') as CanvasPolyfillModule;

    if (canvasModule.DOMMatrix) {
      Object.assign(globalThis, { DOMMatrix: canvasModule.DOMMatrix });
    }
    if (canvasModule.ImageData) {
      Object.assign(globalThis, { ImageData: canvasModule.ImageData });
    }
    if (canvasModule.Path2D) {
      Object.assign(globalThis, { Path2D: canvasModule.Path2D });
    }

    if (typeof globalThis.DOMMatrix !== 'undefined') {
      return { ok: true };
    }

    return { ok: false, reason: 'Se cargó @napi-rs/canvas pero no expuso DOMMatrix.' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, reason };
  }
}

async function extractPdfText(buffer: Uint8Array): Promise<{ text: string; totalPages: number }> {
  return await new Promise(async (resolve, reject) => {
    try {
      const pdf2jsonModule: unknown = await import('pdf2json');
      const moduleWithDefault = pdf2jsonModule as { default?: PdfParserConstructor };
      const PDFParser = (moduleWithDefault.default ?? pdf2jsonModule) as PdfParserConstructor;
      const parser = new PDFParser();

      parser.on('pdfParser_dataError', (errData: PdfErrorData) => {
        reject(new Error(errData?.parserError ?? 'Error parseando PDF'));
      });

      parser.on('pdfParser_dataReady', (pdfData: PdfData) => {
        const pages = pdfData?.Pages ?? [];

        const pageTexts = pages.map((page) => {
          const texts = page?.Texts ?? [];
          return texts
            .flatMap((textBlock) => textBlock?.R ?? [])
            .map((run) => {
              try {
                return decodeURIComponent(run?.T ?? '');
              } catch {
                return run?.T ?? '';
              }
            })
            .join(' ')
            .trim();
        });

        resolve({
          text: pageTexts.filter(Boolean).join('\n'),
          totalPages: pages.length,
        });
      });

      parser.parseBuffer(Buffer.from(buffer));
    } catch (error) {
      reject(error);
    }
  });
}

async function extractPdfTextWithPdfParse(buffer: Uint8Array): Promise<{ text: string; totalPages: number }> {
  const polyfills = ensureCanvasPolyfills();
  if (!polyfills.ok) {
    throw new Error(`No hay polyfill de DOMMatrix para ejecutar pdf-parse en servidor. ${polyfills.reason ?? ''}`.trim());
  }

  const pdfParseModule = require('pdf-parse') as { PDFParse?: PdfParseConstructor };
  const moduleObject = pdfParseModule;
  const Parser = moduleObject.PDFParse;

  if (!Parser) {
    throw new Error('No se encontró PDFParse en el módulo pdf-parse.');
  }

  const parser = new Parser({ data: Buffer.from(buffer) });

  try {
    const result = await parser.getText();
    return {
      text: (result.text ?? '').trim(),
      totalPages: result.numpages ?? (Array.isArray(result.pages) ? result.pages.length : 0),
    };
  } finally {
    await parser.destroy?.();
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const studentId = formData.get('studentId') as string;

    if (!file || !studentId) {
      return NextResponse.json(
        { error: 'Falta archivo o ID de estudiante' },
        { status: 400 }
      );
    }

    // 1. Extraer texto del PDF, priorizando pdf2json por compatibilidad server-side.
    const buffer = new Uint8Array(await file.arrayBuffer());
    let fullText = '';
    let totalPages = 0;
    const extractionErrors: string[] = [];

    try {
      const extractedPrimary = await extractPdfText(buffer);
      fullText = extractedPrimary.text;
      totalPages = extractedPrimary.totalPages;
    } catch (primaryError) {
      extractionErrors.push(primaryError instanceof Error ? primaryError.message : String(primaryError));
    }

    // Fallback para PDFs donde pdf2json no detecta texto aunque sí exista capa de texto.
    if (!fullText || fullText.trim().length < 30) {
      try {
        const extractedFallback = await extractPdfTextWithPdfParse(buffer);
        if (extractedFallback.text.trim().length > fullText.trim().length) {
          fullText = extractedFallback.text;
        }
        if (extractedFallback.totalPages > 0) {
          totalPages = extractedFallback.totalPages;
        }
      } catch (fallbackError) {
        extractionErrors.push(fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        console.error('Fallback pdf-parse falló:', fallbackError);
      }
    }

    if (!fullText || fullText.trim().length < 30) {
      return NextResponse.json(
        {
          error:
            'No se pudo extraer texto útil del PDF. Puede ser un PDF escaneado o basado en imagen. Usa un PDF con texto seleccionable.',
          details: extractionErrors.length > 0 ? extractionErrors : undefined,
        },
        { status: 400 }
      );
    }

    // 2. Guardar documento en Supabase
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        student_id: studentId,
        filename: file.name,
        metadata: { pages: totalPages },
      })
      .select()
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: `Error al guardar documento: ${docError?.message ?? 'sin detalle'}` },
        { status: 500 }
      );
    }

    // 3. Dividir texto en chunks
    const chunks = chunkText(fullText);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'No se generaron chunks del PDF. Verifica que el documento tenga texto legible.' },
        { status: 400 }
      );
    }

    // 4. Generar embeddings y guardar
    const chunkRecords = [];
    const embeddingRecords = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Estimar página (aproximado)
      const pageNumber = Math.floor((i * 500) / (Math.max(totalPages, 1) * 200)) + 1;

      const { data: chunkData, error: chunkError } = await supabase
        .from('document_chunks')
        .insert({
          document_id: doc.id,
          chunk_text: chunk,
          chunk_number: i,
          page_number: pageNumber,
        })
        .select()
        .single();

      if (chunkError) {
        console.error('Error guardando chunk:', chunkError);
        continue;
      }

      if (!chunkError && chunkData) {
        chunkRecords.push(chunkData);

        // Generar embedding
        try {
          const embedding = await generateEmbedding(chunk);
          embeddingRecords.push({
            chunk_id: chunkData.id,
            embedding,
          });
        } catch (embError) {
          console.error('Error generando embedding:', embError);
        }
      }
    }

    // 5. Guardar embeddings
    if (embeddingRecords.length > 0) {
      const { error: embInsertError } = await supabase
        .from('embeddings')
        .insert(embeddingRecords);

      if (embInsertError) {
        console.error('Error guardando embeddings:', embInsertError);
      }
    }

    return NextResponse.json({
      success: true,
      documentId: doc.id,
      filename: file.name,
      pages: totalPages,
      chunks: chunks.length,
      embeddingsGenerated: embeddingRecords.length,
    });
  } catch (error) {
    console.error('Error en upload:', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error al procesar PDF: ${message}` },
      { status: 500 }
    );
  }
}