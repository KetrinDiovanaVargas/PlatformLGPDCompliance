import React from "react";

export default function TimelineComoFunciona() {
  const steps = [
    {
      number: "1",
      title: "Responda",
      desc: "Complete o questionário personalizado de acordo com seu setor",
      color: "from-blue-500 to-blue-600",
    },
    {
      number: "2",
      title: "Analise",
      desc: "Aguarde enquanto processamos suas respostas com IA",
      color: "from-purple-500 to-purple-600",
    },
    {
      number: "3",
      title: "Receba",
      desc: "Obtenha um relatório completo com recomendações práticas",
      color: "from-blue-500 to-blue-600",
    },
  ];

  return (
    <div className="w-full px-4 sm:px-6 md:px-10 py-8 md:py-12 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-md shadow-lg">
      <h2 className="text-center text-2xl sm:text-3xl font-bold text-white mb-8 md:mb-10">
        Como Funciona?
      </h2>

      {/* Desktop: Horizontal layout */}
      <div className="hidden md:flex relative items-center justify-between">
        {/* Linha conectando os steps */}
        <div className="absolute top-7 left-0 right-0 w-full h-[2px] bg-white/20"></div>

        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center w-1/3 text-center px-4">
            <div
              className={`relative z-10 h-14 w-14 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-semibold text-xl shadow-md`}
            >
              {step.number}
            </div>
            <h3 className="mt-6 text-white font-semibold text-lg">{step.title}</h3>
            <p className="mt-2 text-gray-300 text-sm leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Mobile: Vertical layout */}
      <div className="flex md:hidden flex-col gap-6">
        {steps.map((step, index) => (
          <div key={index} className="flex gap-4">
            {/* Número + linha vertical */}
            <div className="flex flex-col items-center">
              <div
                className={`h-12 w-12 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-semibold text-lg shadow-md flex-shrink-0`}
              >
                {step.number}
              </div>
              {index < steps.length - 1 && (
                <div className="w-[2px] h-12 bg-white/20 mt-2"></div>
              )}
            </div>

            {/* Conteúdo */}
            <div className="flex-1 pt-1">
              <h3 className="text-white font-semibold text-base">{step.title}</h3>
              <p className="text-gray-300 text-xs sm:text-sm leading-relaxed mt-1">
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
