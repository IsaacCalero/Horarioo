import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Tipos Supabase
export interface Document {
  id: string;
  student_id: string;
  filename: string;
  upload_date: string;
  metadata: Record<string, unknown> | null;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_text: string;
  chunk_number: number;
  page_number: number;
}

export interface Schedule {
  id: string;
  student_id: string;
  subject: string;
  date: string;
  time: string;
  event_type: string;
  created_at: string;
}
