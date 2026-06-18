"use client";

import { Heart, Bone, Brain, Shield, Zap, Droplets } from "lucide-react";

const properties = [
  {
    icon: Heart,
    title: "Sistema Cardiovascular",
    description:
      "Rica en bicarbonato y baja en sodio, contribuye a la regulacion de la presion arterial y la salud del corazon.",
  },
  {
    icon: Bone,
    title: "Salud Osea",
    description:
      "Su contenido en calcio, magnesio y silicio contribuye al fortalecimiento de huesos y articulaciones.",
  },
  {
    icon: Brain,
    title: "Sistema Nervioso",
    description:
      "El litio y el magnesio presentes favorecen el equilibrio del sistema nervioso y ayudan a reducir el estres.",
  },
  {
    icon: Shield,
    title: "Sistema Digestivo",
    description:
      "Los bicarbonatos favorecen la digestion y ayudan a neutralizar la acidez estomacal de forma natural.",
  },
  {
    icon: Zap,
    title: "Hidratacion Superior",
    description:
      "Su composicion mineral unica proporciona una hidratacion mas efectiva que las aguas convencionales.",
  },
  {
    icon: Droplets,
    title: "27 Minerales",
    description:
      "Vichy Catalan contiene 27 de los 34 elementos que necesita el organismo, emergiendo a 60 grados del manantial.",
  },
];

const minerals = [
  { name: "Bicarbonato", value: "2.081 mg/L" },
  { name: "Sodio", value: "1.110 mg/L" },
  { name: "Cloruro", value: "584 mg/L" },
  { name: "Fluoruro", value: "7,4 mg/L" },
  { name: "Silice", value: "75 mg/L" },
  { name: "Litio", value: "1,3 mg/L" },
  { name: "Potasio", value: "50,1 mg/L" },
  { name: "Calcio", value: "35,3 mg/L" },
];

export default function Properties() {
  return (
    <section id="propiedades" className="py-24 bg-gradient-to-b from-[#e8f4f8] to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Propiedades Mineromedicinales
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            El agua Vichy Catalan emerge a 60 C del manantial de Caldes de
            Malavella, cargada de minerales beneficiosos para tu salud.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {properties.map((prop) => {
            const Icon = prop.icon;
            return (
              <div
                key={prop.title}
                className="bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-vichy-blue/10 flex items-center justify-center mb-4 group-hover:bg-vichy-blue group-hover:text-white transition-colors">
                  <Icon className="h-6 w-6 text-vichy-blue group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {prop.title}
                </h3>
                <p className="text-gray-600 text-sm">{prop.description}</p>
              </div>
            );
          })}
        </div>

        <div className="bg-vichy-blue rounded-2xl p-8 md:p-12 text-white">
          <h3 className="text-2xl font-bold mb-8 text-center">
            Composicion Mineral
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {minerals.map((mineral) => (
              <div key={mineral.name} className="text-center">
                <div className="text-2xl font-bold text-vichy-gold">
                  {mineral.value}
                </div>
                <div className="text-white/80 text-sm mt-1">{mineral.name}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-white/60 text-sm mt-8">
            * Residuo seco a 180 C: 2.960 mg/L. Agua declarada mineromedicinal.
          </p>
        </div>
      </div>
    </section>
  );
}
