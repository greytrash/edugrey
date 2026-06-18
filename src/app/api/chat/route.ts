import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function searchWeb(query: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    if (!response.ok) return "";
    const data = await response.json();

    let results = "";
    if (data.AbstractText) {
      results += `Informacion: ${data.AbstractText}\n`;
    }
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      const topics = data.RelatedTopics.slice(0, 3);
      for (const topic of topics) {
        if (topic.Text) {
          results += `- ${topic.Text}\n`;
        }
      }
    }
    return results;
  } catch {
    return "";
  }
}

function generateResponse(
  userMessage: string,
  conversationHistory: ChatMessage[],
  webResults: string
): string {
  const msg = userMessage.toLowerCase();

  if (
    msg.includes("historia") ||
    msg.includes("origen") ||
    msg.includes("fundacion") ||
    msg.includes("furest") ||
    msg.includes("cuando") ||
    msg.includes("1881")
  ) {
    return "Vichy Catalan tiene una rica historia que comienza en 1881, cuando el Dr. Modest Furest Roca constato cientificamente las propiedades mineromedicinales del agua del manantial de Caldes de Malavella (Girona). En 1890 se registro la marca, y en 1891 se puso la primera piedra del balneario. Desde entonces, la compania ha crecido incorporando marcas como Malavella, Font d'Or, Mondariz, Monte Pinos y Lambda, entre otras. En 1992, fue elegida 'Agua Olimpica' en Barcelona'92.";
  }

  if (
    msg.includes("producto") ||
    msg.includes("gama") ||
    msg.includes("sabor") ||
    msg.includes("fruit") ||
    msg.includes("formato")
  ) {
    return "Vichy Catalan ofrece varias gamas de productos:\n\n- **Vichy Catalan Original**: Agua mineral natural carbonica en vidrio (1L, 0.5L), lata (0.33L) y PET (0.5L, 1.2L).\n- **Vichy Catalan Fruit**: Con zumo de fruta natural, sin azucares anadidos y con estevia. Sabores: Limon, Naranja, Lima-Limon y Frutas del Bosque.\n- **Vichy Catalan Sabores 0%**: Lemon, Orange, Lima-Limon, Menta y Premium Tonic Water.\n- **Vichy Catalan ECO**: Botellas retornables de vidrio.\n\nTodos elaborados con nuestra agua mineral unica!";
  }

  if (
    msg.includes("propiedad") ||
    msg.includes("mineral") ||
    msg.includes("beneficio") ||
    msg.includes("salud") ||
    msg.includes("composicion") ||
    msg.includes("bicarbonato")
  ) {
    return "El agua Vichy Catalan emerge a 60°C del manantial de Caldes de Malavella y contiene 27 de los 34 elementos que necesita el organismo.\n\nComposicion principal:\n- Bicarbonato: 2.081 mg/L\n- Sodio: 1.110 mg/L\n- Cloruro: 584 mg/L\n- Silice: 75 mg/L\n- Potasio: 50,1 mg/L\n- Calcio: 35,3 mg/L\n\nBeneficios: salud cardiovascular, fortalecimiento oseo, equilibrio del sistema nervioso, mejora de la digestion e hidratacion superior. Es un agua declarada mineromedicinal.";
  }

  if (
    msg.includes("marca") ||
    msg.includes("grupo") ||
    msg.includes("corporacion") ||
    msg.includes("empresa")
  ) {
    return "Vichy Catalan Corporation agrupa un amplio portfolio de marcas:\n\n- **Vichy Catalan**: Agua mineral natural carbonica (desde 1881)\n- **Font d'Or**: Agua mineral natural\n- **Malavella**: Agua mineral carbonica\n- **Mondariz**: Agua de burbuja fina (2 Diamond Taste Awards del ITQi)\n- **Monte Pinos**: Agua baja en sodio\n- **Lambda**: Zumos y nectares\n- **Font del Regas**: Del Montseny\n- **Les Creus**, **Fuente del Val**, **Uniaqua**\n- **Oasis Thermal Care**: Cuidado termal\n- **1881 Hotels**: Hoteles y balnearios\n\nCon presencia internacional en Nueva York, Dubai, Shanghai, Bangkok y mas!";
  }

  if (
    msg.includes("sostenib") ||
    msg.includes("eco") ||
    msg.includes("medio ambiente") ||
    msg.includes("retornable") ||
    msg.includes("reciclaje")
  ) {
    return "Vichy Catalan tiene un firme compromiso con la sostenibilidad:\n\n- **Envases retornables**: Sistema de botellas de vidrio retornables. Compra las botellas y paga solo por lo que bebas.\n- **Proteccion forestal**: Programas de reforestacion cerca de nuestros manantiales.\n- **Gestion del agua**: Uso responsable y sostenible de recursos hidricos.\n- **Eficiencia energetica**: Plantas con tecnologia de ultima generacion para minimizar el consumo energetico.\n\nLa forma mas (ECO)logica de cuidar el medio ambiente!";
  }

  if (
    msg.includes("contacto") ||
    msg.includes("direccion") ||
    msg.includes("telefono") ||
    msg.includes("ubicacion") ||
    msg.includes("donde")
  ) {
    return "Puedes contactar con Vichy Catalan Corporation:\n\n- Ubicacion: Caldes de Malavella, Girona, Cataluna, Espana\n- Empresa: PREMIUM MIX GROUP, S.L.\n- Web: www.vichycatalan.com\n\nTambien puedes usar el formulario de contacto en nuestra web para dirigir tu consulta al departamento adecuado (atencion al consumidor, marketing, calidad, RRHH, etc.).";
  }

  if (
    msg.includes("mondariz")
  ) {
    return "Mondariz es una de las joyas del grupo Vichy Catalan Corporation. Es un agua de burbuja fina, pura con ligeros angulos minerales. En 2016, logro ser la unica marca que ha recibido 2 Diamond Taste Awards del International Taste and Quality Institute (ITQi), un prestigioso reconocimiento a su calidad excepcional. Disponible en varios formatos: vidrio 0.33L, 0.5L, 0.75L y PET 0.5L, 1.2L.";
  }

  if (
    msg.includes("monte pinos") ||
    msg.includes("montepinos")
  ) {
    return "Monte Pinos es un agua mineral natural baja en sodio, parte del grupo Vichy Catalan desde 2004. En 2024 celebro su 50 aniversario con un nuevo packaging. Bajo el lema 'el agua que te pide el corazon', consolida su compromiso con la salud cardiovascular y la prevencion de la hipertension.";
  }

  if (
    msg.includes("oasis") ||
    msg.includes("thermal") ||
    msg.includes("cuidado")
  ) {
    return "Oasis Thermal Care es una linea de productos de cuidado termal lanzada en 2020. Es la unica gama en el mercado formulada con agua con gas Vichy Catalan, aprovechando sus propiedades minero-medicinales. La coleccion incluye: gel de ducha, champu, crema corporal, crema facial, agua termal y gel hidroalcoholico.";
  }

  if (msg.includes("hola") || msg.includes("buenos") || msg.includes("buenas")) {
    return "Hola! Bienvenido al asistente de Vichy Catalan. Puedo ayudarte con informacion sobre nuestros productos, historia, propiedades del agua, marcas del grupo, sostenibilidad y mucho mas. Que te gustaria saber?";
  }

  if (msg.includes("gracias") || msg.includes("thank")) {
    return "De nada! Ha sido un placer ayudarte. Si tienes mas preguntas sobre Vichy Catalan o cualquier otra cosa, no dudes en preguntar. Estoy aqui para ti!";
  }

  // For general questions, use web search results if available
  if (webResults) {
    return `He buscado informacion sobre tu consulta. Esto es lo que he encontrado:\n\n${webResults}\n\nSi quieres saber algo mas especifico sobre Vichy Catalan o cualquier otro tema, no dudes en preguntar!`;
  }

  return `Gracias por tu pregunta. Aunque mi especialidad es Vichy Catalan y sus productos, intentare ayudarte con lo que necesites. Si buscas informacion sobre nuestros productos, historia, propiedades del agua o marcas del grupo, puedo darte informacion detallada. Para preguntas generales, puedo buscar en internet. Reformula tu pregunta o preguntame sobre Vichy Catalan!`;
}

function needsWebSearch(message: string): boolean {
  const vichyKeywords = [
    "vichy", "catalan", "producto", "historia", "mineral",
    "propiedad", "marca", "mondariz", "monte pinos", "lambda",
    "font d'or", "malavella", "sostenib", "eco", "contacto",
    "hola", "gracias", "salud", "agua", "sabor", "fruit",
    "balneario", "oasis", "thermal", "regas", "uniaqua",
  ];
  const msg = message.toLowerCase();
  return !vichyKeywords.some((kw) => msg.includes(kw));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages: ChatMessage[] = body.messages || [];

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 }
      );
    }

    const lastUserMessage = messages[messages.length - 1];
    if (!lastUserMessage || lastUserMessage.role !== "user") {
      return NextResponse.json(
        { error: "Last message must be from user" },
        { status: 400 }
      );
    }

    let webResults = "";
    if (needsWebSearch(lastUserMessage.content)) {
      webResults = await searchWeb(lastUserMessage.content);
    }

    const reply = generateResponse(
      lastUserMessage.content,
      messages,
      webResults
    );

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
