import { NextResponse } from 'next/server';
import * as pdf from 'pdf-parse';
import { supabase } from '@/lib/supabase';
import { generateEmbedding, chunkText } from '@/lib/embeddings';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const studentId = formData.get('studentId') as string;

    if (!file || !studentId) {
      return NextResponse.json(
        { error: 'Falta archivo o ID de estudiante' },
        { status: 400 }
      );
    }

    // 1. Extraer texto del PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await pdf(buffer);
    const fullText = pdfData.text;

    // 2. Guardar documento en Supabase
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        student_id: studentId,
        filename: file.name,
        metadata: { pages: pdfData.numpages },
      })
      .select()
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: 'Error al guardar documento' },
        { status: 500 }
      );
    }

    // 3. Dividir texto en chunks
    const chunks = chunkText(fullText);

    // 4. Generar embeddings y guardar
    const chunkRecords = [];
    const embeddingRecords = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Estimar página (aproximado)
      const pageNumber = Math.floor((i * 500) / (pdfData.numpages * 200)) + 1;

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
      await supabase
        .from('embeddings')
        .insert(embeddingRecords);
    }

    return NextResponse.json({
      success: true,
      documentId: doc.id,
      filename: file.name,
      pages: pdfData.numpages,
      chunks: chunks.length,
      embeddingsGenerated: embeddingRecords.length,
    });
  } catch (error) {
    console.error('Error en upload:', error);
    return NextResponse.json(
      { error: 'Error al procesar PDF' },
      { status: 500 }
    );
  }
}