"use client";

const timelineEvents = [
  {
    year: "1881",
    title: "El Origen",
    description:
      "El Dr. Modest Furest Roca constata cientificamente las propiedades mineromedicinales del agua que emerge de un manantial de Caldes de Malavella (Girona) y decide adquirirlo, asi como las tierras adyacentes.",
  },
  {
    year: "1890",
    title: "Registro de la Marca",
    description:
      "Se registra la marca Vichy Catalan, meses despues de inaugurar la primera planta de embotellado.",
  },
  {
    year: "1891",
    title: "El Balneario",
    description:
      "Primera piedra del balneario Vichy Catalan, cuya construccion se finalizo en 1904. Un espacio emblematico de bienestar y salud.",
  },
  {
    year: "1959",
    title: "Innovacion Industrial",
    description:
      'Inauguracion de la "novisima", una innovadora planta embotelladora puntera en el mercado, con capacidad de llenar 6.000 botellas de cuarto de litro por hora.',
  },
  {
    year: "1979",
    title: "Expansion y Diversificacion",
    description:
      "La compania emprende una estrategia de diversificacion adquiriendo nuevos manantiales y marcas: Malavella (1979), Font d'Or y Les Creus (1986), Font del Regas (1988), Mondariz y Fuente del Val (1994), Lambda (1999), Monte Pinos (2004).",
  },
  {
    year: "1992",
    title: "Aguas Olimpicas",
    description:
      "Vichy Catalan y Font d'Or son elegidas 'Aguas Olimpicas' en los JJ.OO. Barcelona'92, un reconocimiento a su calidad excepcional.",
  },
  {
    year: "2012",
    title: "La Primera Lata",
    description:
      "Lanzamiento de la primera agua mineral natural carbonica envasada en lata con tapa biodegradable. Tambien se lanzo la gama de Sabores 0% Azucares.",
  },
  {
    year: "2016",
    title: "Premios Internacionales",
    description:
      "Aguas de Mondariz logra ser la unica marca que ha recibido 2 Diamond Taste Award del International Taste and Quality Institute (ITQi).",
  },
  {
    year: "2018",
    title: "Vichy Catalan Fruit",
    description:
      "Lanzamiento de Vichy Catalan Fruit, una nueva bebida saludable elaborada con Vichy Catalan y zumo de fruta, sin azucares anadidos y con estevia.",
  },
  {
    year: "2020",
    title: "Oasis Thermal Care",
    description:
      "Presentacion de Oasis Thermal Care, linea de cuidado termal con propiedades minero-medicinales. La unica gama formulada con agua con gas Vichy Catalan.",
  },
  {
    year: "2024",
    title: "Monte Pinos 50 Aniversario",
    description:
      'Monte Pinos celebra su 50 aniversario con nuevo packaging. Bajo el lema "el agua que te pide el corazon", consolida su compromiso con la salud cardiovascular.',
  },
  {
    year: "2025",
    title: "Uniaqua Renovada",
    description:
      "Uniaqua estrena nueva identidad para conectar mejor con tu ritmo de vida. Agua de mineralizacion muy debil, pensada para acompanarte cada dia.",
  },
];

export default function History() {
  return (
    <section id="historia" className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Nuestra Historia
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Desde 1881, forjando un legado de calidad, innovacion y bienestar.
            Descubre los hitos que han marcado mas de 140 anos de historia.
          </p>
        </div>

        <div className="relative">
          <div className="timeline-line" />
          <div className="space-y-12">
            {timelineEvents.map((event, index) => (
              <div
                key={event.year}
                className={`relative flex items-center ${
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                } flex-col md:gap-8`}
              >
                <div
                  className={`w-full md:w-1/2 ${
                    index % 2 === 0 ? "md:text-right md:pr-12" : "md:text-left md:pl-12"
                  }`}
                >
                  <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100">
                    <span className="text-vichy-blue font-bold text-lg">
                      {event.year}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 mt-1 mb-2">
                      {event.title}
                    </h3>
                    <p className="text-gray-600 text-sm">{event.description}</p>
                  </div>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-vichy-blue rounded-full border-4 border-white shadow hidden md:block" />
                <div className="absolute left-[20px] w-4 h-4 bg-vichy-blue rounded-full border-4 border-white shadow md:hidden" />

                <div className="hidden md:block w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
