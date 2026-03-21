'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MessageCircle, Calendar } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50 flex flex-col items-center justify-center px-5 py-10">
      {/* Header */}
      <div className="text-center mb-8 sm:mb-14">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Image
              src="/logo-cat.png"
              alt="Logo de tutor medicina"
              width={64}
              height={64}
              className="w-full h-full object-cover rounded-2xl"
              priority
            />
          </div>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold text-purple-900 tracking-tight mb-3">
          Repasos para Milaaa
        </h1>
        <p className="text-gray-500 text-base sm:text-lg max-w-md mx-auto">
          Para que este semestre, no te desanimes y puedas estudiar de forma más fácil :3
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full max-w-2xl">
        {/* Chat Card */}
        <button
          onClick={() => router.push('/chat')}
          className="group bg-white rounded-3xl p-6 sm:p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 text-left border border-purple-100"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-4 sm:mb-5 group-hover:bg-purple-600 transition-colors duration-300">
            <MessageCircle size={24} className="text-purple-600 group-hover:text-white transition-colors duration-300" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">Chat con IA</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Sube tus apuntes en PDF y resuelve dudas sobre tus materias de medicina con IA
          </p>
          <div className="mt-4 sm:mt-5 flex items-center gap-1 text-purple-600 text-sm font-semibold group-hover:gap-2 transition-all">
            Abrir chat <span className="text-lg">→</span>
          </div>
        </button>

        {/* Schedule Card */}
        <button
          onClick={() => router.push('/horario')}
          className="group bg-white rounded-3xl p-6 sm:p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 text-left border border-violet-100"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-violet-100 rounded-2xl flex items-center justify-center mb-4 sm:mb-5 group-hover:bg-violet-600 transition-colors duration-300">
            <Calendar size={24} className="text-violet-600 group-hover:text-white transition-colors duration-300" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">Horario</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Para que te puedas organizar y visualizar tus clases, exámenes y actividades semanales 
          </p>
          <div className="mt-4 sm:mt-5 flex items-center gap-1 text-violet-600 text-sm font-semibold group-hover:gap-2 transition-all">
            Ver horario <span className="text-lg">→</span>
          </div>
        </button>
      </div>

    </div>
  );
}