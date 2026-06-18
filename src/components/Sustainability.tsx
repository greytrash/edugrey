"use client";

import { Recycle, TreePine, Droplets, Factory } from "lucide-react";

const initiatives = [
  {
    icon: Recycle,
    title: "Envases Retornables",
    description:
      "Sistema de botellas retornables de vidrio. Compra las botellas y paga solo por lo que bebas. La forma mas ECOlogica de cuidar el medio ambiente.",
  },
  {
    icon: TreePine,
    title: "Compromiso Forestal",
    description:
      "Programas de reforestacion y proteccion de los ecosistemas cercanos a nuestros manantiales para preservar la calidad del agua.",
  },
  {
    icon: Droplets,
    title: "Gestion del Agua",
    description:
      "Gestion responsable y sostenible de los recursos hidricos, asegurando la proteccion y conservacion de nuestros manantiales.",
  },
  {
    icon: Factory,
    title: "Eficiencia Energetica",
    description:
      "Plantas de produccion con tecnologia de ultima generacion para minimizar el consumo energetico y reducir nuestra huella de carbono.",
  },
];

export default function Sustainability() {
  return (
    <section
      id="sostenibilidad"
      className="py-24 bg-gradient-to-br from-vichy-green/5 to-emerald-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Sostenibilidad
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            La forma mas (ECO)logica de cuidar el medio ambiente. Nuestro
            compromiso con el planeta es tan firme como nuestra agua.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {initiatives.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="flex gap-6 bg-white p-8 rounded-2xl shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="shrink-0 w-14 h-14 rounded-xl bg-vichy-green/10 flex items-center justify-center">
                  <Icon className="h-7 w-7 text-vichy-green" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 bg-vichy-green rounded-2xl p-8 md:p-12 text-white text-center">
          <h3 className="text-2xl font-bold mb-4">
            Mas de 140 anos protegiendo nuestro entorno
          </h3>
          <p className="text-white/80 max-w-2xl mx-auto">
            Desde nuestros origenes, hemos mantenido un compromiso inquebrantable
            con la sostenibilidad y la proteccion del medio ambiente. Cada botella
            que produces refleja nuestro respeto por la naturaleza.
          </p>
        </div>
      </div>
    </section>
  );
}
