"use client";

import { ExternalLink } from "lucide-react";

const brands = [
  {
    name: "Vichy Catalan",
    type: "Agua mineral natural carbonica",
    description: "Agua mineral natural carbonica desde 1881. Con 27 minerales y burbujas naturales.",
    color: "bg-vichy-blue",
  },
  {
    name: "Font d'Or",
    type: "Agua mineral natural",
    description: "Agua mineral natural de baja mineralizacion, ideal para toda la familia.",
    color: "bg-amber-500",
  },
  {
    name: "Malavella",
    type: "Agua mineral natural carbonica",
    description: "Agua mineral natural carbonica del manantial de Caldes de Malavella.",
    color: "bg-emerald-600",
  },
  {
    name: "Mondariz",
    type: "Agua mineral natural",
    description: "Agua de burbuja fina, galardonada con 2 Diamond Taste Awards por el ITQi.",
    color: "bg-sky-600",
  },
  {
    name: "Monte Pinos",
    type: "Agua mineral natural",
    description: "Agua baja en sodio desde 1974. 'El agua que te pide el corazon'.",
    color: "bg-green-700",
  },
  {
    name: "Lambda",
    type: "Zumos y nectares",
    description: "Marca de zumos y nectares de alta calidad, elaborados con fruta seleccionada.",
    color: "bg-orange-500",
  },
  {
    name: "Font del Regas",
    type: "Agua mineral natural",
    description: "Agua mineral natural de las montanas del Montseny, con un equilibrio mineral perfecto.",
    color: "bg-teal-600",
  },
  {
    name: "Les Creus",
    type: "Agua mineral natural",
    description: "Agua mineral natural de calidad premium, con un sabor suave y equilibrado.",
    color: "bg-indigo-600",
  },
  {
    name: "Fuente del Val",
    type: "Agua mineral natural",
    description: "Agua mineral natural de Mondariz, con propiedades beneficiosas para la salud.",
    color: "bg-cyan-600",
  },
  {
    name: "Uniaqua",
    type: "Agua mineral natural",
    description: "Agua de mineralizacion muy debil, pensada para acompanarte cada dia. Tan unica como tu.",
    color: "bg-purple-500",
  },
  {
    name: "Oasis Thermal Care",
    type: "Cuidado termal",
    description: "Linea de productos de cuidado termal formulada con agua con gas Vichy Catalan.",
    color: "bg-rose-500",
  },
  {
    name: "1881 Hotels",
    type: "Hoteles y balnearios",
    description: "Experiencia de bienestar en nuestros hoteles y balnearios historicos.",
    color: "bg-vichy-gold",
  },
];

export default function Brands() {
  return (
    <section id="marcas" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Nuestras Marcas
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Vichy Catalan Corporation agrupa un portfolio de marcas lideres en el
            sector de aguas minerales, zumos y bienestar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {brands.map((brand) => (
            <div
              key={brand.name}
              className="group relative bg-white border border-gray-200 rounded-xl p-6 hover:shadow-xl transition-all duration-300 cursor-pointer"
            >
              <div
                className={`w-10 h-10 rounded-lg ${brand.color} flex items-center justify-center mb-4`}
              >
                <span className="text-white font-bold text-sm">
                  {brand.name.charAt(0)}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-vichy-blue transition-colors">
                {brand.name}
              </h3>
              <p className="text-xs text-vichy-blue font-medium mb-2">
                {brand.type}
              </p>
              <p className="text-gray-600 text-sm">{brand.description}</p>
              <ExternalLink className="absolute top-4 right-4 h-4 w-4 text-gray-300 group-hover:text-vichy-blue transition-colors" />
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-3 bg-vichy-blue/5 rounded-full px-6 py-3">
            <span className="text-vichy-blue font-semibold">Presencia internacional</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600 text-sm">
              Nueva York, Dubai, Shanghai, Bangkok y mas
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
