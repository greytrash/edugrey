import { Droplets } from "lucide-react";

const footerLinks = {
  Productos: [
    "Vichy Catalan",
    "Vichy Catalan Fruit",
    "Vichy Catalan Sabores",
    "Vichy Catalan ECO",
  ],
  Marcas: ["Font d'Or", "Malavella", "Mondariz", "Monte Pinos", "Lambda"],
  Corporativo: ["Historia", "Sostenibilidad", "Propiedades", "Contacto"],
  Legal: [
    "Aviso Legal",
    "Politica de Privacidad",
    "Politica de Cookies",
  ],
};

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Droplets className="h-6 w-6 text-vichy-blue" />
              <span className="text-lg font-bold">Vichy Catalan</span>
            </div>
            <p className="text-gray-400 text-sm">
              Agua mineral natural con gas desde 1881. Un legado de bienestar y
              salud que nace del manantial de Caldes de Malavella.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-bold text-white mb-4">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-gray-400 text-sm hover:text-vichy-blue transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Vichy Catalan Corporation. Todos los derechos
            reservados.
          </p>
          <p className="text-gray-600 text-xs">
            PREMIUM MIX GROUP, S.L. - Caldes de Malavella, Girona
          </p>
        </div>
      </div>
    </footer>
  );
}
