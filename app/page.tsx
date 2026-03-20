'use client';

import { useChat } from '@ai-sdk/react';
import { Calendar, BookOpen, Send, Upload, Trash2 } from 'lucide-react';
import { useState, useRef } from 'react';

export default function TutorPage() {
  const { messages, sendMessage, status } = useChat();
  const [input, setInput] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [studentId] = useState('00000000-0000-0000-0000-000000000001'); // TODO: Reemplazar con auth real
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('studentId', studentId);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setDocuments([...documents, data]);
        alert(`✅ ${data.filename} subido (${data.chunks} chunks, ${data.embeddingsGenerated} embeddings)`);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert(`Error al subir: ${error}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleChatSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const text = input.trim();
    if (!text) return;

    await sendMessage(
      { text },
      {
        body: { studentId },
      }
    );
    setInput('');
  };

  const getMessageText = (message: any) => {
    if (Array.isArray(message.parts)) {
      return message.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
    }

    return message.content ?? '';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Documentos y Horario */}
      <div className="w-80 bg-white shadow-lg flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg text-blue-800 mb-3">📚 Materiales</h2>

          <label className="block">
            <div
              className="flex items-center gap-2 bg-blue-50 border-2 border-dashed border-blue-300 
                         rounded-lg p-3 cursor-pointer hover:bg-blue-100 transition"
            >
              <Upload size={18} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-600">
                {uploading ? 'Subiendo...' : 'Subir PDF'}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        {/* Lista de Documentos */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {documents.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Sin documentos subidos</p>
          ) : (
            documents.map((doc, i) => (
              <div
                key={i}
                className="bg-gray-50 p-2 rounded-lg text-xs border-l-4 border-blue-400 hover:bg-gray-100"
              >
                <div className="font-bold text-gray-800 truncate">{doc.filename}</div>
                <div className="text-gray-500">{doc.pages} páginas • {doc.chunks} chunks</div>
              </div>
            ))
          )}
        </div>

        {/* Sección de Horario */}
        <div className="border-t p-4">
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="w-full flex items-center gap-2 bg-amber-50 border border-amber-200 
                      rounded-lg p-2 hover:bg-amber-100 transition"
          >
            <Calendar size={18} className="text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {showSchedule ? 'Cerrar' : 'Horarios'}
            </span>
          </button>

          {showSchedule && (
            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-gray-700">
              <p className="text-gray-500 italic">Sección de horarios - En desarrollo</p>
            </div>
          )}
        </div>
      </div>

      {/* Principal - Chat */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-blue-800">🏥 Tutor de Medicina IA</h1>
          <p className="text-sm text-gray-600 mt-1">
            Sube tus apuntes y discute con IA basada en tu material
          </p>
        </header>

        {/* Área de Mensajes */}
        <div className="flex-1 overflow-y-auto space-y-4 p-6">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <BookOpen size={48} className="text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Comienza subiendo un PDF de tus notas</p>
                <p className="text-gray-400 text-sm mt-1">Luego haz preguntas basadas en el material</p>
              </div>
            </div>
          ) : (
            messages.map((m: any) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-md rounded-lg p-4 ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white shadow-md border border-gray-200 rounded-bl-none'
                  }`}
                >
                  <div className={`text-xs font-bold mb-1 ${m.role === 'user' ? 'text-blue-100' : 'text-gray-600'}`}>
                    {m.role === 'user' ? 'Tú' : 'Tutor IA'}
                  </div>
                  <div className="text-sm">{getMessageText(m)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleChatSubmit}
          className="bg-white border-t p-4 shadow-lg flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta o resumen..."
            className="flex-1 p-3 outline-none bg-gray-50 rounded-lg border border-gray-200 
                      focus:border-blue-400 focus:bg-white transition"
            disabled={status !== 'ready'}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 
                      transition flex items-center gap-2 font-medium"
            disabled={status !== 'ready'}
          >
            <Send size={18} /> Enviar
          </button>
        </form>
      </div>
    </div>
  );
}