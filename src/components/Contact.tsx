"use client";

import { Mail, Phone, MapPin, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

const departments = [
  "Atencion al consumidor",
  "Marketing / Colaboraciones / Patrocinios",
  "Relaciones publicas",
  "Departamento de calidad",
  "RRHH",
  "Internacional",
  "Otros",
];

const brandOptions = [
  "Vichy Catalan",
  "Font d'Or",
  "Mondariz",
  "Monte Pinos",
  "Lambda",
  "Les Creus",
  "Malavella",
  "Font del Regas",
  "Fuente del Val",
  "Uniaqua",
  "Oasis Thermal Care",
  "Hotel Balneari Vichy Catalan",
];

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <section id="contacto" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Contacta con Nosotros
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Te escuchamos! Estaremos encantados de dar respuesta a tus consultas
            y comentarios.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-vichy-blue/10">
                <MapPin className="h-6 w-6 text-vichy-blue" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Direccion</h3>
                <p className="text-gray-600 text-sm">
                  Caldes de Malavella, Girona
                  <br />
                  Cataluna, Espana
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-vichy-blue/10">
                <Phone className="h-6 w-6 text-vichy-blue" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Telefono</h3>
                <p className="text-gray-600 text-sm">+34 972 470 000</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-vichy-blue/10">
                <Mail className="h-6 w-6 text-vichy-blue" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Email</h3>
                <p className="text-gray-600 text-sm">info@vichycatalan.com</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-2xl shadow-md p-8 space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vichy-blue focus:border-transparent outline-none transition"
                    placeholder="Tu nombre"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vichy-blue focus:border-transparent outline-none transition"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Departamento *
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vichy-blue focus:border-transparent outline-none transition"
                  >
                    <option value="">Selecciona departamento</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marca *
                  </label>
                  <select
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vichy-blue focus:border-transparent outline-none transition"
                  >
                    <option value="">Selecciona marca</option>
                    {brandOptions.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensaje *
                </label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-vichy-blue focus:border-transparent outline-none transition resize-none"
                  placeholder="Escribe tu mensaje..."
                />
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  required
                  className="mt-1 rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">
                  He leido y acepto la politica de privacidad de Vichy Catalan
                  Corporation.
                </span>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-vichy-blue text-white font-semibold rounded-lg hover:bg-vichy-blue-dark transition-colors"
              >
                <Send className="h-4 w-4" />
                {submitted ? "Enviado!" : "Enviar Mensaje"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
