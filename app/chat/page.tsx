'use client';

import Image from 'next/image';
import { useChat } from '@ai-sdk/react';
import { BookOpen, Send, Upload, ArrowLeft, FileText, Menu, X as XIcon, Download, RotateCcw } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ReportErrorResponse = {
  success: boolean;
  error?: string;
  fallbackMailto?: string;
};

type UploadedDocument = {
  filename: string;
  pages: number;
  chunks: number;
  embeddingsGenerated?: number;
};

type UploadResponse = {
  success: boolean;
  filename?: string;
  pages?: number;
  chunks?: number;
  embeddingsGenerated?: number;
  error?: string;
};

type StoredMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  parts?: Array<{ type?: string; text?: string }>;
};

export default function ChatPage() {
  const studentId = '00000000-0000-0000-0000-000000000001';
  const chatStorageKey = `tutor-medicina-chat-${studentId}`;
  const chatBackupKey = `tutor-medicina-chat-backup-${studentId}`;
  const { messages, sendMessage, status, setMessages } = useChat();
  const typedMessages = messages as unknown as StoredMessage[];
  const [input, setInput] = useState('');
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [recoverableMessages, setRecoverableMessages] = useState<StoredMessage[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [errorDescription, setErrorDescription] = useState('');
  const [errorScreenshot, setErrorScreenshot] = useState<string | null>(null);
  const reportImageInputRef = useRef<HTMLInputElement>(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(chatStorageKey);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecoverableMessages(parsed as StoredMessage[]);
          localStorage.setItem(chatBackupKey, stored);
        }
      }

      // Always start a fresh session when entering the chat page.
      setMessages([]);
      localStorage.removeItem(chatStorageKey);
    } catch {
      // If parsing fails, keep an empty chat and continue.
    } finally {
      setChatHydrated(true);
    }
  }, [chatBackupKey, chatStorageKey, setMessages]);

  useEffect(() => {
    if (!chatHydrated) return;
    localStorage.setItem(chatStorageKey, JSON.stringify(messages));
  }, [chatHydrated, chatStorageKey, messages]);

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

      const data: UploadResponse = await response.json();
      if (data.success) {
        setDocuments((prev) => [
          ...prev,
          {
            filename: data.filename ?? 'archivo.pdf',
            pages: data.pages ?? 0,
            chunks: data.chunks ?? 0,
            embeddingsGenerated: data.embeddingsGenerated,
          },
        ]);
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
    await sendMessage({ text }, { body: { studentId } });
    setInput('');
  };

  const getMessageText = (message: StoredMessage) => {
    const parts = message.parts;
    if (Array.isArray(parts)) {
      return parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text ?? '')
        .join('');
    }

    return message.content ?? '';
  };

  const handleDownloadSummaryPdf = async () => {
    if (typedMessages.length === 0) {
      alert('No hay mensajes para exportar.');
      return;
    }

    const { jsPDF } = await import('jspdf/dist/jspdf.umd.min.js');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    const addLine = (text: string, size = 11, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, maxWidth);
      const required = lines.length * (size + 4);

      if (y + required > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }

      doc.text(lines, margin, y);
      y += required;
    };

    addLine('Resumen de Chat - Tutor de Medicina IA', 16, true);
    addLine(`Generado: ${new Date().toLocaleString()}`, 10);
    y += 8;

    typedMessages.forEach((m, index) => {
      const role = m.role === 'user' ? 'Usuario' : 'Tutor IA';
      const content = getMessageText(m) || '(sin contenido)';
      addLine(`${index + 1}. ${role}`, 11, true);
      addLine(content, 11);
      y += 6;
    });

    doc.save(`resumen-chat-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleRecoverChat = () => {
    if (recoverableMessages.length === 0) return;
    setMessages(recoverableMessages as unknown as typeof messages);
    localStorage.setItem(chatStorageKey, JSON.stringify(recoverableMessages));
  };

  const handleNewChat = () => {
    if (messages.length > 0) {
      localStorage.setItem(chatBackupKey, JSON.stringify(messages));
      setRecoverableMessages(messages as unknown as StoredMessage[]);
    }
    setMessages([]);
    localStorage.removeItem(chatStorageKey);
  };

  const handleScreenshotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imagenes para el adjunto.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setErrorScreenshot(result);
    };
    reader.onerror = () => {
      alert('No se pudo leer la imagen seleccionada.');
    };
    reader.readAsDataURL(file);
  };

  const resetReportForm = () => {
    setErrorDescription('');
    setErrorScreenshot(null);
    if (reportImageInputRef.current) {
      reportImageInputRef.current.value = '';
    }
  };

  const handleReportError = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!errorDescription.trim()) {
      alert('Describe el error antes de enviar el reporte.');
      return;
    }

    setSubmittingReport(true);
    try {
      const response = await fetch('/api/report-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: errorDescription,
          screenshot: errorScreenshot,
          page: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });

      const data: ReportErrorResponse = await response.json();

      if (!response.ok || !data.success) {
        if (data.fallbackMailto) {
          const openMail = confirm('No se pudo enviar automáticamente. ¿Quieres abrir tu correo para enviarlo manualmente?');
          if (openMail) {
            window.location.href = data.fallbackMailto;
          }
        }
        alert(data.error ?? 'No se pudo enviar el reporte.');
        return;
      }

      alert('Reporte enviado. Gracias por ayudar a mejorar la app.');
      resetReportForm();
      setReportOpen(false);
    } catch {
      alert('Error de red al enviar el reporte.');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50">
      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative z-30 md:z-auto
        w-72 h-full bg-white/90 md:bg-white/80 backdrop-blur-sm shadow-lg flex flex-col border-r border-purple-100
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo + back */}
        <div className="p-5 border-b border-purple-100">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-400 hover:text-purple-600 transition text-sm font-medium"
            >
              <ArrowLeft size={15} /> Inicio
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-gray-400 hover:text-gray-600 transition"
            >
              <XIcon size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shadow">
              <Image
                src="/logo-cat.png"
                alt="Logo de tutor medicina"
                width={36}
                height={36}
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <span className="font-bold text-purple-900 text-sm tracking-tight">Dr. Bigotes</span>
          </div>
        </div>

        {/* Upload */}
        <div className="p-5 border-b border-purple-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Materiales</p>
          <label className="block">
            <div className="flex items-center gap-2 bg-purple-50 border-2 border-dashed border-purple-200 rounded-2xl p-3 cursor-pointer hover:bg-purple-100 hover:border-purple-400 transition-all duration-200">
              <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Upload size={15} className="text-purple-600" />
              </div>
              <span className="text-sm font-medium text-purple-600">
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

        {/* Lista de documentos */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={28} className="text-purple-200 mx-auto mb-2" />
              <p className="text-xs text-gray-300 italic">Sin documentos subidos</p>
            </div>
          ) : (
            documents.map((doc, i) => (
              <div
                key={i}
                className="bg-purple-50 p-3 rounded-2xl text-xs border border-purple-100 hover:bg-purple-100 transition"
              >
                <div className="font-bold text-purple-800 truncate">{doc.filename}</div>
                <div className="text-purple-400 mt-0.5">{doc.pages} páginas · {doc.chunks} chunks</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white/70 backdrop-blur-sm border-b border-purple-100 px-4 sm:px-8 py-4 sm:py-5 flex items-center gap-3">
          {/* Botón hamburguesa móvil */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-purple-100 text-purple-600 hover:bg-purple-200 transition flex-shrink-0"
          >
            <Menu size={18} />
          </button>
          <div className="w-9 h-9 sm:w-11 sm:h-11 bg-purple-600 rounded-2xl flex items-center justify-center shadow-md flex-shrink-0">
            <Image
              src="/logo-cat.png"
              alt="Logo de tutor medicina"
              width={44}
              height={44}
              className="w-full h-full object-cover rounded-2xl"
              priority
            />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold text-purple-900 tracking-tight">Chat con IA</h1>
            <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">Resuelve dudas basadas en tus apuntes</p>
          </div>
          <button
            onClick={handleDownloadSummaryPdf}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-100 text-purple-700 hover:bg-purple-200 transition text-xs sm:text-sm font-semibold"
            type="button"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Descargar PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 transition text-xs sm:text-sm font-semibold"
            type="button"
          >
            <RotateCcw size={15} />
            <span className="hidden sm:inline">Nuevo chat</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
          <button
            onClick={() => setReportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition text-xs sm:text-sm font-semibold"
            type="button"
          >
            Reportar error
          </button>
        </header>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 space-y-4">
          {chatHydrated && typedMessages.length === 0 && recoverableMessages.length > 0 && (
            <div className="flex justify-center">
              <button
                onClick={handleRecoverChat}
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-100 text-purple-700 hover:bg-purple-200 transition text-sm font-semibold"
              >
                <RotateCcw size={15} /> Recuperar chat anterior
              </button>
            </div>
          )}

          {typedMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-md mx-auto mb-4 border border-purple-100">
                  <BookOpen size={30} className="text-purple-300" />
                </div>
                <p className="text-gray-500 font-semibold">Comienza subiendo un PDF de tus notas</p>
                <p className="text-gray-400 text-sm mt-1">Luego haz preguntas basadas en el material</p>
              </div>
            </div>
          ) : (
            typedMessages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] sm:max-w-lg rounded-3xl px-4 sm:px-5 py-3 sm:py-4 ${
                    m.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-sm shadow-md'
                      : 'bg-white text-gray-800 rounded-bl-sm shadow-md border border-purple-100'
                  }`}
                >
                  <div className={`text-xs font-bold mb-1.5 ${m.role === 'user' ? 'text-purple-200' : 'text-purple-400'}`}>
                    {m.role === 'user' ? 'Tú' : 'Tutor IA'}
                  </div>
                  <div className={`text-sm leading-relaxed ${m.role === 'user' ? 'text-white whitespace-pre-wrap' : 'text-gray-700'}`}>
                    {m.role === 'assistant' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                          code: ({ children }) => <code className="bg-purple-50 px-1.5 py-0.5 rounded-md text-purple-700 text-xs">{children}</code>,
                        }}
                      >
                        {getMessageText(m)}
                      </ReactMarkdown>
                    ) : (
                      getMessageText(m)
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleChatSubmit}
          className="bg-white/70 backdrop-blur-sm border-t border-purple-100 px-3 sm:px-8 py-3 sm:py-5 flex gap-2 sm:gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta..."
            className="flex-1 p-3.5 outline-none bg-white text-gray-900 placeholder-gray-300 rounded-2xl border border-purple-100 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition shadow-sm"
            disabled={status !== 'ready'}
          />
          <button
            type="submit"
            className="bg-purple-600 text-white px-4 sm:px-5 py-3 rounded-2xl hover:bg-purple-700 transition-all duration-200 flex items-center gap-1 sm:gap-2 font-semibold shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base"
            disabled={status !== 'ready'}
          >
            <Send size={17} /> Enviar
          </button>
        </form>
      </div>

      {reportOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 p-4 sm:p-8 flex items-center justify-center">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-purple-100 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-purple-900">Reportar un error</h2>
                <p className="text-sm text-gray-500 mt-1">Dime que pasó detallando el error que te ocurrió y envíame una captura para ayudarte con el error.</p>
              </div>
              <button
                onClick={() => setReportOpen(false)}
                type="button"
                className="text-gray-400 hover:text-gray-600 transition"
                aria-label="Cerrar reporte"
              >
                <XIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleReportError} className="space-y-3">
              <textarea
                value={errorDescription}
                onChange={(e) => setErrorDescription(e.target.value)}
                placeholder="Descríbeme el error y qué estabas haciendo"
                rows={4}
                className="w-full p-3 rounded-xl border border-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 text-sm text-gray-900 placeholder:text-gray-400 resize-none"
                required
              />

              <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-2 rounded-xl bg-white border border-purple-200 text-purple-700 hover:bg-purple-100 transition text-sm font-semibold cursor-pointer">
                    Adjuntar imagen de captura
                    <input
                      ref={reportImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleScreenshotFileChange}
                    />
                  </label>
                  {errorScreenshot && (
                    <span className="text-xs text-emerald-700 font-semibold">Captura adjunta</span>
                  )}
                </div>
                {errorScreenshot && (
                  <Image
                    src={errorScreenshot}
                    alt="Vista previa de captura de error"
                    width={640}
                    height={240}
                    unoptimized
                    className="mt-3 rounded-xl border border-purple-200 w-full max-h-44 object-cover"
                  />
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    resetReportForm();
                    setReportOpen(false);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 transition text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition text-sm font-semibold disabled:opacity-60"
                >
                  {submittingReport ? 'Enviando...' : 'Enviar reporte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
