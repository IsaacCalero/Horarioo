'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const COLORS = [
  { label: 'Violeta',  bg: 'bg-violet-100',  border: 'border-l-violet-500', text: 'text-violet-900', sub: 'text-violet-500',  dot: 'bg-violet-500'  },
  { label: 'Morado',   bg: 'bg-purple-100',  border: 'border-l-purple-500', text: 'text-purple-900', sub: 'text-purple-500',  dot: 'bg-purple-500'  },
  { label: 'Fucsia',   bg: 'bg-fuchsia-100', border: 'border-l-fuchsia-500',text: 'text-fuchsia-900',sub: 'text-fuchsia-500', dot: 'bg-fuchsia-500' },
  { label: 'Rosa',     bg: 'bg-pink-100',    border: 'border-l-pink-500',   text: 'text-pink-900',   sub: 'text-pink-500',    dot: 'bg-pink-500'    },
  { label: 'Índigo',   bg: 'bg-indigo-100',  border: 'border-l-indigo-500', text: 'text-indigo-900', sub: 'text-indigo-500',  dot: 'bg-indigo-500'  },
  { label: 'Cielo',    bg: 'bg-sky-100',     border: 'border-l-sky-500',    text: 'text-sky-900',    sub: 'text-sky-500',     dot: 'bg-sky-500'     },
];

// Timeline config
const START_HOUR   = 7;
const END_HOUR     = 18;
const PX_PER_MIN   = 1.6;
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * 60 * PX_PER_MIN; // 1056px

function timeToMins(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h - START_HOUR) * 60 + m;
}

const HOUR_LABELS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => ({
  label: `${(START_HOUR + i).toString().padStart(2, '0')}:00`,
  top: i * 60 * PX_PER_MIN,
}));

interface ClassEntry {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  room?: string;
  professor?: string;
  colorIndex: number;
}

interface ModalState {
  open: boolean;
  day: string;
  editing: ClassEntry | null;
}

const STORAGE_KEY = 'tutor-medicina-horario-v2';

const DEFAULT_CLASSES: ClassEntry[] = [
  // Lunes
  { id: '1',  day: 'Lunes',     startTime: '08:05', endTime: '10:10', subject: 'Microbiología I',              room: 'UPO 222',  professor: '', colorIndex: 0 },
  { id: '2',  day: 'Lunes',     startTime: '10:15', endTime: '11:15', subject: 'Patología Estruc y Funcional', room: 'UPE 317',  professor: '', colorIndex: 1 },
  { id: '3',  day: 'Lunes',     startTime: '11:20', endTime: '13:25', subject: 'Patología Estruc y Funcional', room: 'UPE 701',  professor: '', colorIndex: 1 },
  { id: '4',  day: 'Lunes',     startTime: '13:30', endTime: '14:30', subject: 'Biología Celul y Molecular I', room: 'UPO 513',  professor: '', colorIndex: 2 },
  { id: '5',  day: 'Lunes',     startTime: '15:40', endTime: '17:50', subject: 'Lenguaje Cuantitativo',        room: 'UPE 123',  professor: '', colorIndex: 3 },
  // Martes
  { id: '6',  day: 'Martes',    startTime: '11:20', endTime: '13:25', subject: 'Fisio Medic y Laborat Clinic', room: 'UPE 120',  professor: '', colorIndex: 4 },
  { id: '7',  day: 'Martes',    startTime: '13:30', endTime: '14:30', subject: 'Biología Celul y Molecular I', room: 'UPE -306', professor: '', colorIndex: 2 },
  // Miércoles
  { id: '8',  day: 'Miércoles', startTime: '08:05', endTime: '09:05', subject: 'Microbiología I',              room: 'UPE 317',  professor: '', colorIndex: 0 },
  { id: '9',  day: 'Miércoles', startTime: '10:15', endTime: '12:20', subject: 'Patología Estruc y Funcional', room: 'UPE 121',  professor: '', colorIndex: 1 },
  { id: '10', day: 'Miércoles', startTime: '15:40', endTime: '16:40', subject: 'Lenguaje Cuantitativo',        room: 'UPE 318',  professor: '', colorIndex: 3 },
  { id: '11', day: 'Miércoles', startTime: '16:45', endTime: '17:45', subject: 'Biología Celul y Molecular I', room: 'UPO 223',  professor: '', colorIndex: 2 },
  // Jueves
  { id: '12', day: 'Jueves',    startTime: '07:00', endTime: '09:05', subject: 'Bioestadística',               room: 'UPO 016',  professor: '', colorIndex: 5 },
  { id: '13', day: 'Jueves',    startTime: '09:10', endTime: '11:15', subject: 'Fisio Medic y Laborat Clinic', room: 'UPE 121',  professor: '', colorIndex: 4 },
  // Viernes
  { id: '14', day: 'Viernes',   startTime: '09:10', endTime: '10:10', subject: 'Fisio Medic y Laborat Clinic', room: 'UPO 415',  professor: '', colorIndex: 4 },
  { id: '15', day: 'Viernes',   startTime: '10:15', endTime: '11:15', subject: 'Fisio Medic y Laborat Clinic', room: 'UPO 513',  professor: '', colorIndex: 4 },
  { id: '16', day: 'Viernes',   startTime: '12:25', endTime: '13:25', subject: 'Microbiología I',              room: 'UPE -307', professor: '', colorIndex: 0 },
  { id: '17', day: 'Viernes',   startTime: '13:30', endTime: '14:30', subject: 'Biología Celul y Molecular I', room: 'UPE 606',  professor: '', colorIndex: 2 },
  { id: '18', day: 'Viernes',   startTime: '15:40', endTime: '17:50', subject: 'Lenguaje Cuantitativo',        room: 'UPE 120',  professor: '', colorIndex: 3 },
  // Sábado
  { id: '19', day: 'Sábado',    startTime: '08:05', endTime: '12:20', subject: 'Inglés Intermedio I',          room: 'GR 216',   professor: '', colorIndex: 0 },
];

const EMPTY_FORM = { subject: '', room: '', professor: '', startTime: '08:00', endTime: '09:00', colorIndex: 0 };

export default function HorarioPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassEntry[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false, day: '', editing: null });
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setClasses(stored ? JSON.parse(stored) : DEFAULT_CLASSES);
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (initialized) localStorage.setItem(STORAGE_KEY, JSON.stringify(classes));
  }, [classes, initialized]);

  const openModal = (day: string, existing?: ClassEntry) => {
    setForm(existing
      ? { subject: existing.subject, room: existing.room ?? '', professor: existing.professor ?? '', startTime: existing.startTime, endTime: existing.endTime, colorIndex: existing.colorIndex }
      : EMPTY_FORM
    );
    setModal({ open: true, day, editing: existing ?? null });
  };

  const closeModal = () => setModal(m => ({ ...m, open: false, editing: null }));

  const handleSave = () => {
    if (!form.subject.trim()) return;
    if (modal.editing) {
      setClasses(prev => prev.map(c => c.id === modal.editing!.id ? { ...c, ...form } : c));
    } else {
      setClasses(prev => [...prev, { id: `${Date.now()}`, day: modal.day, ...form }]);
    }
    closeModal();
  };

  const handleDelete = (id: string) => {
    setClasses(prev => prev.filter(c => c.id !== id));
    closeModal();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 shadow-sm px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-gray-400 hover:text-purple-600 transition text-sm font-medium flex-shrink-0"
        >
          <ArrowLeft size={16} /> <span className="hidden sm:inline">Inicio</span>
        </button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-purple-900">📅 Mi Horario</h1>
          <p className="text-xs text-gray-400 hidden sm:block">Clic en un bloque para editar · botón + para agregar</p>
        </div>
      </header>

      {/* Leyenda de materias */}
      <div className="px-6 py-2.5 flex flex-wrap gap-2 border-b border-purple-100 bg-white/50 flex-shrink-0">
        {[
          { label: 'Microbiología I',              colorIndex: 0 },
          { label: 'Patología Estruc y Funcional', colorIndex: 1 },
          { label: 'Biología Celul y Molecular I', colorIndex: 2 },
          { label: 'Lenguaje Cuantitativo',        colorIndex: 3 },
          { label: 'Fisio Medic y Laborat Clinic', colorIndex: 4 },
          { label: 'Bioestadística',               colorIndex: 5 },
          { label: 'Inglés Intermedio I',          colorIndex: 0 },
        ].map(({ label, colorIndex }) => (
          <span key={label} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${COLORS[colorIndex].bg} ${COLORS[colorIndex].text}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${COLORS[colorIndex].dot}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-2 sm:p-4">
        <div className="flex gap-1" style={{ minWidth: 700 }}>
          {/* Etiquetas de hora */}
          <div className="w-12 flex-shrink-0" style={{ paddingTop: 36 }}>
            <div className="relative" style={{ height: TOTAL_HEIGHT }}>
              {HOUR_LABELS.map(({ label, top }) => (
                <div key={label} className="absolute right-1 -translate-y-2" style={{ top }}>
                  <span className="text-[10px] text-purple-300 font-semibold whitespace-nowrap">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Columnas por día */}
          {DAYS.map(day => (
            <div key={day} className="flex-1 min-w-0 flex flex-col">
              {/* Encabezado del día */}
              <button
                onClick={() => openModal(day)}
                className="h-8 rounded-xl bg-white/80 border border-purple-100 text-xs font-bold text-purple-800 hover:bg-purple-100 transition flex items-center justify-center gap-1 group shadow-sm mb-1 flex-shrink-0"
              >
                {day}
                <Plus size={11} className="text-purple-300 group-hover:text-purple-600 transition" />
              </button>

              {/* Timeline */}
              <div
                className="relative rounded-2xl overflow-hidden bg-white/40 border border-purple-100"
                style={{ height: TOTAL_HEIGHT }}
              >
                {/* Líneas de hora */}
                {HOUR_LABELS.map(({ label, top }) => (
                  <div key={label} className="absolute w-full border-t border-purple-100/70" style={{ top }} />
                ))}

                {/* Bloques de clase */}
                {classes
                  .filter(c => c.day === day)
                  .map(entry => {
                    const color  = COLORS[entry.colorIndex];
                    const top    = timeToMins(entry.startTime) * PX_PER_MIN;
                    const height = (timeToMins(entry.endTime) - timeToMins(entry.startTime)) * PX_PER_MIN;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => openModal(day, entry)}
                        className={`absolute inset-x-1 rounded-xl border-l-4 px-2 py-1 text-left overflow-hidden shadow-sm hover:brightness-95 transition-all ${color.bg} ${color.border}`}
                        style={{ top, height: Math.max(height, 22) }}
                      >
                        <div className={`text-[11px] font-bold leading-tight truncate ${color.text}`}>
                          {entry.subject}
                        </div>
                        {height > 28 && entry.room && (
                          <div className={`text-[10px] truncate mt-0.5 ${color.sub}`}>{entry.room}</div>
                        )}
                        {height > 44 && (
                          <div className="text-[10px] text-gray-400 mt-0.5">{entry.startTime}–{entry.endTime}</div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800 text-lg">
                {modal.editing ? 'Editar clase' : 'Nueva clase'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition">
                <X size={20} />
              </button>
            </div>

            <div className="text-xs text-purple-400 mb-4 font-semibold">{modal.day}</div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Inicio</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fin</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Materia *</label>
                <input
                  autoFocus
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="Ej: Anatomía, Bioquímica..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Aula / Sala</label>
                <input
                  value={form.room}
                  onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                  placeholder="Ej: UPE 317"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Profesor</label>
                <input
                  value={form.professor}
                  onChange={e => setForm(f => ({ ...f, professor: e.target.value }))}
                  placeholder="Ej: Dr. García"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Color</label>
                <div className="flex gap-2">
                  {COLORS.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setForm(f => ({ ...f, colorIndex: i }))}
                      className={`w-7 h-7 rounded-full ${c.dot} transition-all ${
                        form.colorIndex === i ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              {modal.editing && (
                <button
                  onClick={() => handleDelete(modal.editing!.id)}
                  className="flex-1 py-2 rounded-lg border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition"
                >
                  Eliminar
                </button>
              )}
              <button
                onClick={closeModal}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.subject.trim()}
                className="flex-1 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
