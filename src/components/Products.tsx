"use client";

import { Droplets, Sparkles, Leaf, Wine } from "lucide-react";

const products = [
  {
    name: "Vichy Catalan",
    description:
      "Agua mineral natural carbonica. Un agua unica con mas de 140 anos de historia, rica en minerales y con burbujas naturales.",
    icon: Droplets,
    color: "from-vichy-blue to-[#00a8e8]",
    formats: ["Botella vidrio 1L", "Botella vidrio 0.5L", "Lata 0.33L", "PET 0.5L", "PET 1.2L"],
  },
  {
    name: "Vichy Catalan Fruit",
    description:
      "Bebida saludable elaborada con Vichy Catalan y zumo de fruta, sin azucares anadidos y con estevia. Sabores naturales irresistibles.",
    icon: Sparkles,
    color: "from-orange-400 to-pink-500",
    formats: ["Limon", "Naranja", "Lima-Limon", "Frutas del Bosque"],
  },
  {
    name: "Vichy Catalan Sabores",
    description:
      "Gama de sabores 0% azucares con el caracter unico del agua Vichy Catalan. Refrescante y sin culpa.",
    icon: Wine,
    color: "from-vichy-green to-emerald-400",
    formats: ["Lemon", "Orange", "Lima-Limon", "Menta", "Premium Tonic Water"],
  },
  {
    name: "Vichy Catalan ECO",
    description:
      "La forma mas (ECO)logica de cuidar el medio ambiente. Botellas retornables: compra y paga solo por lo que bebas.",
    icon: Leaf,
    color: "from-green-600 to-lime-400",
    formats: ["Vidrio retornable 1L", "Vidrio retornable 0.5L"],
  },
];

export default function Products() {
  return (
    <section id="productos" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Nuestros Productos
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Descubre la gama completa de productos Vichy Catalan, desde nuestra
            clasica agua mineral hasta las nuevas bebidas con sabores naturales.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {products.map((product) => {
            const Icon = product.icon;
            return (
              <div
                key={product.name}
                className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
              >
                <div className={`h-2 bg-gradient-to-r ${product.color}`} />
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className={`p-3 rounded-xl bg-gradient-to-r ${product.color} text-white`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {product.name}
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-6">{product.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {product.formats.map((format) => (
                      <span
                        key={format}
                        className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                      >
                        {format}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
