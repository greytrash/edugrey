"use client";

import { ChevronDown } from "lucide-react";
import { useMemo } from "react";

const BUBBLE_COUNT = 12;

export default function Hero() {
  const bubbles = useMemo(() => {
    return Array.from({ length: BUBBLE_COUNT }, (_, i) => {
      const size = 10 + ((i * 17 + 7) % 30);
      const left = ((i * 23 + 11) % 100);
      const delay = ((i * 13 + 3) % 60) / 10;
      const duration = 4 + ((i * 19 + 5) % 40) / 10;
      return { size, left, delay, duration };
    });
  }, []);

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-vichy-blue via-vichy-blue-dark to-[#003d5c]" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {bubbles.map((b, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/10 animate-bubble"
            style={{
              width: `${b.size}px`,
              height: `${b.size}px`,
              left: `${b.left}%`,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 animate-fadeInUp">
          Vichy Catalan
        </h1>
        <p className="text-xl md:text-2xl text-white/90 mb-4 animate-fadeInUp" style={{ animationDelay: "0.2s" }}>
          Agua mineral natural con gas desde 1881
        </p>
        <p className="text-lg text-white/70 mb-10 max-w-2xl mx-auto animate-fadeInUp" style={{ animationDelay: "0.4s" }}>
          Un legado de bienestar y salud que nace del manantial de Caldes de Malavella. 
          Descubre el agua que ha sido referente de calidad durante mas de 140 anos.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fadeInUp" style={{ animationDelay: "0.6s" }}>
          <a
            href="#productos"
            className="px-8 py-3 bg-white text-vichy-blue font-semibold rounded-full hover:bg-vichy-gold hover:text-white transition-all duration-300 shadow-lg"
          >
            Descubre Nuestros Productos
          </a>
          <a
            href="#historia"
            className="px-8 py-3 border-2 border-white text-white font-semibold rounded-full hover:bg-white hover:text-vichy-blue transition-all duration-300"
          >
            Nuestra Historia
          </a>
        </div>
      </div>

      <a
        href="#productos"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 hover:text-white transition-colors animate-float"
      >
        <ChevronDown className="h-8 w-8" />
      </a>
    </section>
  );
}
