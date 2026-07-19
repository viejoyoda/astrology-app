import { GoogleGenAI } from '@google/genai';
import { MakeTime, EclipticLongitude, SiderealTime, Body } from 'astronomy-engine';


document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('astrology-form');
  const onboardingPanel = document.getElementById('onboarding-panel');
  const resultsPanel = document.getElementById('results-panel');
  const loader = document.getElementById('loader');
  const readingContent = document.getElementById('reading-content');
  const chartDataContainer = document.getElementById('chart-data');
  const aiInterpretationContainer = document.getElementById('ai-interpretation');
  const btnBack = document.getElementById('btn-back');
  const apiInput = document.getElementById('geminiApiKey');

  const systemSelect = document.getElementById('astrologySystem');
  const onboardingTitle = document.getElementById('onboarding-title');
  const birthDatetimeContainer = document.getElementById('birth-datetime-container');
  const horaryNote = document.getElementById('horary-note');
  const dailyNote = document.getElementById('daily-note');
  const zodiacContainer = document.getElementById('zodiac-selection-container');
  const zodiacSignSelect = document.getElementById('zodiacSign');
  const birthplaceContainer = document.getElementById('birthplace-container');
  const questionContainer = document.getElementById('question-container');
  const placeLabel = document.getElementById('place-label');
  const questionLabel = document.getElementById('question-label');
  const questionHelper = document.getElementById('question-helper');
  const specificQuestion = document.getElementById('specificQuestion');
  const birthDate = document.getElementById('birthDate');
  const birthTime = document.getElementById('birthTime');
  const birthPlace = document.getElementById('birthPlace');

  // Load API Key from localStorage if present
  const storedKey = localStorage.getItem('COSMOS_GEMINI_API_KEY');
  if (storedKey) {
    apiInput.value = storedKey;
  }

  // Toggle form layout according to selected system
  systemSelect.addEventListener('change', () => {
    const val = systemSelect.value;
    if (val === 'horary') {
      onboardingTitle.innerText = 'Ingresa los datos de tu consulta horaria';
      birthDatetimeContainer.classList.add('hidden');
      horaryNote.classList.remove('hidden');
      dailyNote.classList.add('hidden');
      zodiacContainer.classList.add('hidden');
      birthplaceContainer.classList.remove('hidden');
      questionContainer.classList.remove('hidden');
      
      placeLabel.innerText = 'Tu ubicación actual (Ciudad, País)';
      questionLabel.innerText = 'Pregunta Específica (Obligatorio)';
      questionHelper.innerText = 'La astrología horaria requiere formular una pregunta concreta y honesta.';
      
      specificQuestion.required = true;
      birthPlace.required = true;
      birthDate.required = false;
      birthTime.required = false;
    } else if (val === 'daily') {
      onboardingTitle.innerText = 'Configura tu Horóscopo Diario';
      birthDatetimeContainer.classList.add('hidden');
      horaryNote.classList.add('hidden');
      dailyNote.classList.remove('hidden');
      zodiacContainer.classList.remove('hidden');
      birthplaceContainer.classList.add('hidden');
      questionContainer.classList.add('hidden');
      
      specificQuestion.required = false;
      birthPlace.required = false;
      birthDate.required = false;
      birthTime.required = false;
    } else {
      onboardingTitle.innerText = 'Ingresa tus datos de nacimiento';
      birthDatetimeContainer.classList.remove('hidden');
      horaryNote.classList.add('hidden');
      dailyNote.classList.add('hidden');
      zodiacContainer.classList.add('hidden');
      birthplaceContainer.classList.remove('hidden');
      questionContainer.classList.remove('hidden');
      
      placeLabel.innerText = 'Lugar de Nacimiento';
      questionLabel.innerText = 'Pregunta Específica (Opcional)';
      questionHelper.innerText = 'Enfocaremos la lectura en responder a tu duda vital basándonos en tu carta.';
      
      specificQuestion.required = false;
      birthPlace.required = true;
      birthDate.required = true;
      birthTime.required = true;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Save API key to localStorage if entered, otherwise clear
    const enteredKey = apiInput.value.trim();
    if (enteredKey) {
      localStorage.setItem('COSMOS_GEMINI_API_KEY', enteredKey);
    } else {
      localStorage.removeItem('COSMOS_GEMINI_API_KEY');
    }

    const localKey = localStorage.getItem('COSMOS_GEMINI_API_KEY');
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    const activeKey = localKey || envKey;
    
    // Get user input
    const system = systemSelect.value;
    const birthPlace = document.getElementById('birthPlace').value;
    const questionText = specificQuestion.value;
    const zodiacSign = zodiacSignSelect.value;

    let requestDate = birthDate.value;
    let requestTime = birthTime.value;

    // Transition UI
    onboardingPanel.classList.add('hidden');
    resultsPanel.classList.remove('hidden');
    loader.classList.remove('hidden');
    readingContent.classList.add('hidden');

    let lat = -33.4489;
    let lon = -70.6693;
    let offset = -4; // Santiago fallback
    let isOfflineMode = !activeKey;

    try {
      if (system === 'daily') {
        const now = new Date();
        requestDate = now.toISOString().split('T')[0];
        requestTime = now.toTimeString().split(' ')[0].substring(0, 5);
      } else {
        const now = new Date();
        if (system === 'horary') {
          requestDate = now.toISOString().split('T')[0];
          requestTime = now.toTimeString().split(' ')[0].substring(0, 5);
        }
        
        // Only attempt geocoding if we have a key
        if (activeKey) {
          try {
            const coords = await getCoordinatesAndOffset(birthPlace, requestDate, activeKey);
            lat = coords.lat;
            lon = coords.lon;
            offset = coords.offset;
          } catch (geocodeErr) {
            console.warn("Geocoding failed, using fallback coordinates:", geocodeErr);
            isOfflineMode = true;
          }
        } else {
          isOfflineMode = true;
        }
      }

      // Step 1: Real Astronomical Calculation (Calculated locally)
      const calculatedChart = calculateRealAstrology(requestDate, requestTime, lat, lon, offset, system, questionText, zodiacSign);
      
      // Render calculated data
      renderChartData(calculatedChart, system);

      // Step 2: Request Interpretation
      let interpretation = "";
      if (activeKey && !isOfflineMode) {
        try {
          interpretation = await getAIInterpretation(calculatedChart, system, questionText);
        } catch (aiError) {
          console.warn("Gemini API call failed, falling back to local interpretation:", aiError);
          isOfflineMode = true;
          interpretation = generateOfflineInterpretation(calculatedChart, system, questionText);
        }
      } else {
        isOfflineMode = true;
        interpretation = generateOfflineInterpretation(calculatedChart, system, questionText);
      }
      
      // Render interpretation
      let htmlOutput = formatMarkdownToHTML(interpretation);
      if (isOfflineMode) {
        htmlOutput = `
          <div style="background: rgba(212,175,55,0.06); border: 1px solid rgba(212,175,55,0.2); padding: 0.8rem; border-radius: 8px; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; text-align: left;">
            <span style="color: var(--primary-color);">✨</span>
            <span><strong>Modo Local Activo:</strong> Interpretación técnica generada localmente sin requerir conexión con Gemini.</span>
          </div>
          ${htmlOutput}
        `;
      }
      aiInterpretationContainer.innerHTML = htmlOutput;

      // Hide loader and show content
      loader.classList.add('hidden');
      readingContent.classList.remove('hidden');
    } catch (error) {
      console.error(error);
      alert('Hubo un error al procesar tu carta: ' + error.message);
      loader.classList.add('hidden');
      onboardingPanel.classList.remove('hidden');
      resultsPanel.classList.add('hidden');
    }
  });

  btnBack.addEventListener('click', () => {
    resultsPanel.classList.add('hidden');
    onboardingPanel.classList.remove('hidden');
    chartDataContainer.innerHTML = '';
    aiInterpretationContainer.innerHTML = '';
  });

  const btnCopy = document.getElementById('btn-copy');
  btnCopy.addEventListener('click', () => {
    const textToCopy = aiInterpretationContainer.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalText = btnCopy.innerText;
      btnCopy.innerText = '¡Copiado!';
      setTimeout(() => {
        btnCopy.innerText = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Error al copiar: ', err);
      alert('No se pudo copiar el texto.');
    });
  });
});

// SIGNOS Y REGENTES TRADICIONALES
const SIGNS = [
  { name: "Aries", ruler: "Marte" },
  { name: "Tauro", ruler: "Venus" },
  { name: "Géminis", ruler: "Mercurio" },
  { name: "Cáncer", ruler: "Luna" },
  { name: "Leo", ruler: "Sol" },
  { name: "Virgo", ruler: "Mercurio" },
  { name: "Libra", ruler: "Venus" },
  { name: "Escorpio", ruler: "Marte" },
  { name: "Sagitario", ruler: "Júpiter" },
  { name: "Capricornio", ruler: "Saturno" },
  { name: "Acuario", ruler: "Saturno" },
  { name: "Piscis", ruler: "Júpiter" }
];

// Generador de números pseudo-aleatorios basado en una semilla
function getZodiacSign(longitude) {
  const norm = (longitude % 360 + 360) % 360;
  const idx = Math.floor(norm / 30);
  const degrees = Math.floor(norm % 30);
  return {
    sign: SIGNS[idx].name,
    ruler: SIGNS[idx].ruler,
    degrees: degrees,
    index: idx
  };
}

async function getCoordinatesAndOffset(place, dateStr, key) {
  try {
    if (!place) {
      return { lat: -33.4489, lon: -70.6693, offset: -4 };
    }
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `Dada la ubicación "${place}" y la fecha "${dateStr}", responde únicamente en formato JSON con la latitud (número decimal), longitud (número decimal) y la diferencia horaria UTC (diferencia en horas con respecto a UTC, ej: -4 o +2). Formato del JSON exacto sin markdown ni explicaciones:
{"lat": -33.4489, "lon": -70.6693, "offset": -4}` }] }
      ]
    });
    const text = response.text.trim();
    const cleanedJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedJson);
    return {
      lat: Number(result.lat) || 0,
      lon: Number(result.lon) || 0,
      offset: Number(result.offset) || 0
    };
  } catch (err) {
    console.warn("Geocoding failed, falling back to default:", err);
    return { lat: -33.4489, lon: -70.6693, offset: -4 }; // Default Santiago
  }
}

function calculateRealAstrology(dateStr, timeStr, lat, lon, offset, system, questionText = '', zodiacSign = '') {
  const localDate = new Date(`${dateStr}T${timeStr}:00`);
  const utcDate = new Date(localDate.getTime() - (offset * 60 * 60 * 1000));
  const time = MakeTime(utcDate);

  const sunLon = EclipticLongitude(Body.Sun, time);
  const moonLon = EclipticLongitude(Body.Moon, time);
  const mercuryLon = EclipticLongitude(Body.Mercury, time);
  const venusLon = EclipticLongitude(Body.Venus, time);
  const marsLon = EclipticLongitude(Body.Mars, time);
  const jupiterLon = EclipticLongitude(Body.Jupiter, time);
  const saturnLon = EclipticLongitude(Body.Saturn, time);
  const uranusLon = EclipticLongitude(Body.Uranus, time);
  const neptuneLon = EclipticLongitude(Body.Neptune, time);
  const plutoLon = EclipticLongitude(Body.Pluto, time);

  const gast = SiderealTime(time);
  let lst = gast + (lon / 15.0);
  lst = (lst % 24.0 + 24.0) % 24.0;
  
  const obliquity = 23.4392911;
  const eRad = obliquity * Math.PI / 180.0;
  const lstRad = (lst * 15.0) * Math.PI / 180.0;
  const latRad = lat * Math.PI / 180.0;

  const num = Math.cos(lstRad);
  const den = -Math.sin(lstRad) * Math.cos(eRad) - Math.tan(latRad) * Math.sin(eRad);
  let ascRad = Math.atan2(num, den);
  let ascDeg = ascRad * 180.0 / Math.PI;
  ascDeg = (ascDeg % 360.0 + 360.0) % 360.0;

  const year = utcDate.getUTCFullYear();
  const ayanamsha = 23.85 + (year - 2000) * 0.0138;

  if (system === 'daily') {
    const userSignName = zodiacSign;
    const planets = {
      "Sol": getZodiacSign(sunLon),
      "Luna": getZodiacSign(moonLon),
      "Mercurio": getZodiacSign(mercuryLon),
      "Venus": getZodiacSign(venusLon),
      "Marte": getZodiacSign(marsLon),
      "Júpiter": getZodiacSign(jupiterLon),
      "Saturno": getZodiacSign(saturnLon),
      "Urano": getZodiacSign(uranusLon),
      "Neptuno": getZodiacSign(neptuneLon),
      "Plutón": getZodiacSign(plutoLon)
    };

    const userSignIndex = SIGNS.findIndex(s => s.name === userSignName);
    const transitsInHouses = {};
    for (const [pName, pData] of Object.entries(planets)) {
      const houseNum = ((pData.index - userSignIndex + 12) % 12) + 1;
      transitsInHouses[pName] = `${pData.sign} ${pData.degrees}° (Casa ${houseNum})`;
    }

    return {
      tipo: "Horóscopo Diario de Tránsitos",
      signoConsultante: userSignName,
      fechaTránsitos: dateStr,
      ...transitsInHouses
    };
  } else if (system === 'vedic') {
    const siderealAsc = (ascDeg - ayanamsha + 360) % 360;
    const siderealSun = (sunLon - ayanamsha + 360) % 360;
    const siderealMoon = (moonLon - ayanamsha + 360) % 360;
    const siderealMars = (marsLon - ayanamsha + 360) % 360;
    const siderealMercury = (mercurioLon - ayanamsha + 360) % 360;
    const siderealJupiter = (jupiterLon - ayanamsha + 360) % 360;
    const siderealVenus = (venusLon - ayanamsha + 360) % 360;
    const siderealSaturn = (saturnLon - ayanamsha + 360) % 360;

    const asc = getZodiacSign(siderealAsc);
    const sun = getZodiacSign(siderealSun);
    const moon = getZodiacSign(siderealMoon);
    const mars = getZodiacSign(siderealMars);
    const mercury = getZodiacSign(siderealMercury);
    const jupiter = getZodiacSign(siderealJupiter);
    const venus = getZodiacSign(siderealVenus);
    const saturn = getZodiacSign(siderealSaturn);

    const nakshatras = [
      "Ashvini", "Bharani", "Krittika", "Rohini", "Mrigashirsha", "Ardra",
      "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
      "Hasta", "Chitra", "Svati", "Vishakha", "Anuradha", "Jyeshtha", "Mula",
      "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
      "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
    ];
    const nakIdx = Math.floor(siderealMoon / (360 / 27));
    const moonNakshatra = nakshatras[nakIdx];

    const dashaLords = ["Ketu", "Venus", "Sol", "Luna", "Marte", "Rahu", "Júpiter", "Saturno", "Mercurio"];
    const dashaLord = dashaLords[nakIdx % 9];

    return {
      tipo: "Carta Védica Sideral (Lahiri)",
      ascendente: `${asc.sign} ${asc.degrees}°`,
      sol: `${sun.sign} ${sun.degrees}°`,
      luna: `${moon.sign} ${moon.degrees}°`,
      nakshatra: moonNakshatra,
      dashaSeñor: dashaLord,
      planetas: `Mercurio en ${mercury.sign}, Venus en ${venus.sign}, Marte en ${mars.sign}, Júpiter en ${jupiter.sign}, Saturno en ${saturn.sign}`
    };
  } else if (system === 'hellenistic') {
    const asc = getZodiacSign(ascDeg);
    const sun = getZodiacSign(sunLon);
    const moon = getZodiacSign(moonLon);
    
    const sunHouse = ((sun.index - asc.index + 12) % 12) + 1;
    const sect = (sunHouse >= 7 && sunHouse <= 12) ? "Diurna" : "Nocturna";

    const age = 30; 
    const profectionSignIndex = (asc.index + age) % 12;
    const lordOfYear = SIGNS[profectionSignIndex].ruler;

    return {
      tipo: "Carta Tradicional Helenística",
      ascendente: `${asc.sign} ${asc.degrees}°`,
      sol: `${sun.sign} ${sun.degrees}°`,
      luna: `${moon.sign} ${moon.degrees}°`,
      secta: sect,
      señorDelAño: `${lordOfYear} (Profección de Casa ${ (age % 12) + 1 })`,
      planetas: `Mercurio (${getZodiacSign(mercuryLon).sign}), Venus (${getZodiacSign(venusLon).sign}), Marte (${getZodiacSign(marsLon).sign}), Júpiter (${getZodiacSign(jupiterLon).sign}), Saturno (${getZodiacSign(saturnLon).sign})`
    };
  } else {
    // Horary
    const asc = getZodiacSign(ascDeg);
    const moon = getZodiacSign(moonLon);

    const q = questionText.toLowerCase();
    let targetHouseNumber = 7; 
    let targetHouseLabel = "Casa 7 (Pareja / Relación)";

    if (q.includes('trabajo') || q.includes('carrera') || q.includes('empleo') || q.includes('profesion') || q.includes('puesto') || q.includes('negocio') || q.includes('jefe')) {
      targetHouseNumber = 10;
      targetHouseLabel = "Casa 10 (Carrera / Éxito)";
    } else if (q.includes('dinero') || q.includes('financ') || q.includes('comprar') || q.includes('vender') || q.includes('pago') || q.includes('inversion')) {
      targetHouseNumber = 2;
      targetHouseLabel = "Casa 2 (Dinero / Recursos)";
    } else if (q.includes('deseo') || q.includes('esperanza') || q.includes('meta') || q.includes('amigo') || q.includes('desear')) {
      targetHouseNumber = 11;
      targetHouseLabel = "Casa 11 (Deseos / Amigos)";
    }

    const targetSignIndex = (asc.index + (targetHouseNumber - 1)) % 12;
    const targetSign = SIGNS[targetSignIndex];
    const rulerCasa1 = asc.ruler;
    const rulerPregunta = targetSign.ruler;

    const planetPositions = {
      "Sol": sunLon, "Luna": moonLon, "Mercurio": mercuryLon, "Venus": venusLon, 
      "Marte": marsLon, "Júpiter": jupiterLon, "Saturno": saturnLon
    };
    const degRuler1 = planetPositions[rulerCasa1] || sunLon;
    const degRuler2 = planetPositions[rulerPregunta] || venusLon;

    const diff = Math.abs(degRuler1 - degRuler2) % 180;
    let aspect = "Sin aspecto aplicativo (-)";
    if (diff < 6 || diff > 174) {
      aspect = "Conjunción/Oposición aplicativa";
    } else if (Math.abs(diff - 60) < 6) {
      aspect = "Sextil aplicativo (+)";
    } else if (Math.abs(diff - 90) < 6) {
      aspect = "Cuadratura aplicativa (Dificultades)";
    } else if (Math.abs(diff - 120) < 6) {
      aspect = "Trígono aplicativo (+)";
    }

    let consideration = "Ninguna (Carta Radical)";
    if (asc.degrees < 3) {
      consideration = `Ascendente muy temprano (${asc.degrees}° ${asc.sign}). El asunto es prematuro.`;
    } else if (asc.degrees > 27) {
      consideration = `Ascendente muy tardío (${asc.degrees}° ${asc.sign}). El asunto está fuera de alcance.`;
    } else if (
      (moon.sign === "Libra" && moon.degrees >= 15) || 
      (moon.sign === "Escorpio" && moon.degrees <= 15)
    ) {
      consideration = `Luna en Vía Combusta (${moon.degrees}° ${moon.sign}). El asunto está lleno de temores.`;
    }

    return {
      tipo: "Astrología Horaria Real",
      pregunta: questionText,
      ascendente: `${asc.sign} ${asc.degrees}°`,
      regenteCasa1: `${rulerCasa1}`,
      posicionLuna: `${moon.sign} ${moon.degrees}°`,
      casaPregunta: targetHouseLabel,
      regentePregunta: `${rulerPregunta} en ${getZodiacSign(degRuler2).sign} ${getZodiacSign(degRuler2).degrees}°`,
      aspectoRegentes: aspect,
      consideracionesLilly: consideration
    };
  }
}

function renderChartData(data, system) {
  const container = document.getElementById('chart-data');
  const title = document.getElementById('reading-title');
  
  title.innerText = system === 'hellenistic' ? 'Carta Helenística' : (system === 'vedic' ? 'Carta Védica (Jyotiṣa)' : (system === 'daily' ? 'Horóscopo Diario' : 'Carta Horaria'));
  
  container.innerHTML = '';
  for (const [key, value] of Object.entries(data)) {
    if (key === 'pregunta' || key === 'momento' || key === 'ubicacion') continue;
    const el = document.createElement('div');
    el.className = 'data-item';
    el.innerHTML = `
      <span class="data-label">${key.replace(/([A-Z])/g, ' $1').replace(/([a-z])([A-Z])/g, '$1 $2').trim()}</span>
      <span class="data-value">${value}</span>
    `;
    container.appendChild(el);
  }

  // Draw the graphical astrological wheel
  setTimeout(() => {
    drawAstrologyWheel(data, system);
  }, 50);
}

// INTEGRACIÓN CON GEMINI AI
async function getAIInterpretation(chartData, system, specificQuestion) {
  const localKey = localStorage.getItem('COSMOS_GEMINI_API_KEY');
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  const activeKey = localKey || envKey;

  if (!activeKey) {
    throw new Error('No se detectó ninguna API Key de Gemini. Por favor, configúrala en el formulario o en el archivo .env.');
  }

  const ai = new GoogleGenAI({ apiKey: activeKey });

  let systemPrompt = "";
  let userPrompt = "";

  if (system === 'hellenistic') {
    systemPrompt = `Eres un experto astrólogo Helenístico. Analiza la carta natal usando Whole Sign Houses, la Secta (Diurna/Nocturna), Dignidades Esenciales y el estado accidental. Utiliza la técnica de Profecciones Anuales.`;
    userPrompt = `Aquí tienes los datos matemáticos calculados de mi carta: ${JSON.stringify(chartData)}. `;
  } else if (system === 'vedic') {
    systemPrompt = `Eres un erudito en Astrología Védica (Jyotiṣa). Tu análisis debe enfocarse en el zodíaco Sideral, el cálculo de fuerzas Shadbala, las cartas divisionales como la Navamsa (D9) y Dasamsa (D10), y predecir usando el Vimshottari Dasha. Sugiere Upāyas (remedios) al final.`;
    userPrompt = `Aquí tienes los cálculos matemáticos de mi carta sideral: ${JSON.stringify(chartData)}. `;
  } else if (system === 'daily') {
    systemPrompt = `Eres un experto astrólogo tradicional. Tu tarea es generar un horóscopo diario de tránsitos personalizado, dinámico y técnicamente riguroso.
    No uses clichés genéricos. En su lugar, explica en qué casa de la carta del consultante (basado en su signo solar/ascendente) caen los tránsitos planetarios reales de hoy, e interpreta lo que esto significa para su día en áreas como el trabajo, amor, energía y comunicación. Usa una prosa mística pero directa y con base técnica real.`;
    userPrompt = `Aquí tienes los tránsitos planetarios reales de hoy calculados para el signo ${chartData.signoConsultante}: ${JSON.stringify(chartData)}.`;
  } else {
    systemPrompt = `Eres un experto astrólogo tradicional especializado en Astrología Horaria (siguiendo estrictamente las reglas de William Lilly en 'Christian Astrology' y Guido Bonatti).
    Tu objetivo es responder de forma directa, honesta y concisa la pregunta del consultante a partir de los datos de la carta horaria levantada.

    Instrucciones específicas:
    1. Evalúa e informa de las 'Consideraciones previas al juicio' (radicalidad de la carta). Si hay advertencias (como un ascendente muy temprano o tardío), menciónalas con un tono misterioso pero técnico.
    2. Identifica los significadores: el regente de la Casa 1 y la Luna representan al consultante. Indica qué casa representa al asunto consultado y su regente (el consultado/quesited).
    3. Determina el resultado analizando la relación entre los regentes (aspectos aplicativos, traslación de luz o impedimentos como combustión y retrogradación).
    4. Proporciona un veredicto final muy claro al final del análisis (ej: "Sí", "No", "Sí, pero con retrasos y obstáculos").`;
    userPrompt = `Aquí tienes los datos calculados para la consulta de astrología horaria: ${JSON.stringify(chartData)}.
    La pregunta específica es: "${specificQuestion}".`;
  }

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }
        ],
        config: {
            temperature: 0.7,
        }
    });
    return response.text;
  } catch (err) {
    console.error("Gemini API Error:", err);
    throw err;
  }
}

// Helper simple para convertir markdown a HTML en el frontend
function formatMarkdownToHTML(text) {
  let html = text.replace(/^### (.*$)/gim, '<h4>$1</h4>')
                 .replace(/^## (.*$)/gim, '<h3>$1</h3>')
                 .replace(/^# (.*$)/gim, '<h2>$1</h2>')
                 .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
                 .replace(/\*(.*)\*/gim, '<em>$1</em>');
  
  html = html.split('\n').map(para => {
    if (para.trim().startsWith('-')) {
      return `<li>${para.trim().substring(1)}</li>`;
    }
    if (para.trim().startsWith('<h') || para.trim().startsWith('<li') || para.trim() === '') {
      return para;
    }
    return `<p>${para}</p>`;
  }).join('');
  // Wrap list items in ul
  html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
  // Clean up adjacent uls
  html = html.replace(/<\/ul>\n<ul>/gim, '\n');
  
  return html;
}

// DIBUJO DE LA RUEDA ASTROLÓGICA (CANVAS)
function drawAstrologyWheel(data, system) {
  const canvas = document.getElementById('chart-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const r = width / 2 - 20;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Background circle (glassmorphism look)
  ctx.fillStyle = 'rgba(20, 20, 40, 0.4)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw 12 houses (radial lines)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    ctx.stroke();
  }

  // Draw inner circle
  ctx.fillStyle = 'rgba(5, 5, 16, 0.6)';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Outer gold ring
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(212, 175, 55, 0.5)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.shadowBlur = 0; // reset

  // Determine positions of key actors
  if (system === 'horary' && data.ascendente) {
    const ascSignName = data.ascendente.split(' ')[0];
    const ascSignIndex = SIGNS.findIndex(s => s.name === ascSignName);
    
    // Ascendant (House 1) angle (represented at 180 degrees / West horizon for visual chart)
    const angleH1 = Math.PI;

    // Find sign of the question
    const quesitedSignName = data.regentePregunta.split(' en ')[1]?.split(' ')[0] || 'Libra';
    const quesitedSignIndex = SIGNS.findIndex(s => s.name === quesitedSignName);
    
    // Angle distance from Ascendant: each sign is 30 degrees (Math.PI / 6)
    const signDiff = (quesitedSignIndex - ascSignIndex + 12) % 12;
    const anglePregunta = Math.PI + (signDiff * Math.PI / 6);

    // Moon position
    const moonSignName = data.posicionLuna.split(' ')[0];
    const moonSignIndex = SIGNS.findIndex(s => s.name === moonSignName);
    const moonDiff = (moonSignIndex - ascSignIndex + 12) % 12;
    const angleMoon = Math.PI + (moonDiff * Math.PI / 6);

    // Draw planets
    drawPlanetGlyph(ctx, cx, cy, r * 0.75, angleH1, `Asc (${data.ascendente})`, '#fff');
    drawPlanetGlyph(ctx, cx, cy, r * 0.75, anglePregunta, `${data.regentePregunta.split(' en ')[0]}`, '#d4af37');
    drawPlanetGlyph(ctx, cx, cy, r * 0.75, angleMoon, 'Luna ☽', '#a0a0b0');

    // Draw Aspect line in the middle if there is one
    const aspect = data.aspectoRegentes;
    if (aspect && !aspect.includes('Sin aspecto')) {
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      if (aspect.includes('+')) {
        ctx.strokeStyle = '#00ffff'; // Cyan for positive aspects
        ctx.shadowColor = '#00ffff';
      } else {
        ctx.strokeStyle = '#ff3366'; // Red for negative aspects
        ctx.shadowColor = '#ff3366';
      }
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.6 * Math.cos(angleH1), cy + r * 0.6 * Math.sin(angleH1));
      ctx.lineTo(cx + r * 0.6 * Math.cos(anglePregunta), cy + r * 0.6 * Math.sin(anglePregunta));
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  } else if (system === 'daily' && data.signoConsultante) {
    // User sign is at 180 degrees (Ascendant/House 1 position)
    const userSignIndex = SIGNS.findIndex(s => s.name === data.signoConsultante);
    
    // Draw User's sign label at the Ascendant position
    drawPlanetGlyph(ctx, cx, cy, r * 0.75, Math.PI, `Asc (${data.signoConsultante})`, '#fff');

    const planetGlyphs = {
      "Sol": "☉", "Luna": "☽", "Mercurio": "☿", "Venus": "♀", "Mars": "♂", "Marte": "♂",
      "Júpiter": "♃", "Saturno": "♄", "Urano": "♅", "Neptuno": "♆", "Plutón": "♇"
    };

    let i = 0;
    for (const [pName, pValue] of Object.entries(data)) {
      if (['tipo', 'signoConsultante', 'fechaTránsitos'].includes(pName)) continue;
      const signName = pValue.split(' ')[0];
      const planetSignIndex = SIGNS.findIndex(s => s.name === signName);
      if (planetSignIndex === -1) continue;

      const diff = (planetSignIndex - userSignIndex + 12) % 12;
      // Stagger radius slightly to prevent overlapping
      const radiusOffset = (i % 3) * 8 - 8;
      const angle = Math.PI + (diff * Math.PI / 6) + (Math.PI / 24) * ((i % 2) ? 0.4 : -0.4);
      const glyph = planetGlyphs[pName] || '';
      
      drawPlanetGlyph(ctx, cx, cy, r * 0.72 + radiusOffset, angle, `${pName} ${glyph}`, '#d4af37');
      i++;
    }
  } else {
    // Hellenistic/Vedic general representation
    const planets = [
      { name: 'Asc ♈', angle: Math.PI },
      { name: 'Sol ☉', angle: 0.2 * Math.PI },
      { name: 'Luna ☽', angle: 0.8 * Math.PI },
      { name: 'Júpiter ♃', angle: 1.4 * Math.PI },
      { name: 'Saturno ♄', angle: 1.7 * Math.PI }
    ];

    planets.forEach(p => {
      drawPlanetGlyph(ctx, cx, cy, r * 0.75, p.angle, p.name, p.name.includes('Asc') ? '#fff' : '#d4af37');
    });
  }
}

function drawPlanetGlyph(ctx, cx, cy, r, angle, label, color) {
  const px = cx + r * Math.cos(angle);
  const py = cy + r * Math.sin(angle);

  // Small dot
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, 2 * Math.PI);
  ctx.fill();

  // Label text with glow
  ctx.fillStyle = '#fff';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Calculate text offset angle to place outside the dot
  const offsetDistance = 15;
  const tx = px + offsetDistance * Math.cos(angle);
  const ty = py + offsetDistance * Math.sin(angle);
  
  ctx.fillText(label, tx, ty);
}

// GENERACIÓN DE INTERPRETACIÓN LOCAL (FALLBACK SIN GEMINI)
function generateOfflineInterpretation(chart, system, question) {
  let text = "";
  
  if (system === 'daily') {
    text = `## Horóscopo Diario de Tránsitos para **${chart.signoConsultante}**\n\n`;
    text += `*Fecha de Tránsitos: ${chart.fechaTránsitos}*\n\n`;
    text += `Hoy los astros se alinean sobre tu signo con influencias específicas en tus casas astrológicas. Aquí tienes el análisis técnico de las energías en juego:\n\n`;
    
    for (const [planet, position] of Object.entries(chart)) {
      if (['tipo', 'signoConsultante', 'fechaTránsitos'].includes(planet)) continue;
      const parts = position.split(' ');
      const signName = parts[0];
      const houseText = position.match(/Casa \d+/);
      const house = houseText ? houseText[0] : "Casa 1";
      
      text += `### ${planet} en ${signName} (${house})\n`;
      if (planet === 'Sol') {
        text += `El Sol ilumina tu **${house}**, aportando vitalidad, enfoque y claridad de propósito en esta área de tu vida hoy. Es un momento propicio para tomar la iniciativa.\n\n`;
      } else if (planet === 'Luna') {
        text += `La Luna en tu **${house}** influye en tus emociones, fluctuaciones de ánimo y necesidades subconscientes. Presta atención a tu intuición hoy.\n\n`;
      } else if (planet === 'Mercurio') {
        text += `Mercurio en tu **${house}** estimula los procesos mentales, la comunicación, los mensajes y las transacciones hoy. Excelente día para conversaciones y firmas.\n\n`;
      } else if (planet === 'Venus') {
        text += `Venus en tu **${house}** derrama armonía, atracción, placer y favorece los afectos y las finanzas personales en esta área.\n\n`;
      } else if (planet === 'Marte') {
        text += `Marte en tu **${house}** inyecta energía, pasión e impulso, pero también advierte de posibles conflictos o impaciencia. Canaliza esta fuerza de forma constructiva.\n\n`;
      } else if (planet === 'Júpiter') {
        text += `Júpiter en tu **${house}** trae oportunidades de expansión, sabiduría, crecimiento espiritual y buena fortuna en esta área hoy.\n\n`;
      } else if (planet === 'Saturno') {
        text += `Saturno en tu **${house}** estructurará tus responsabilidades, imponiendo disciplina, límites o lecciones necesarias en esta esfera.\n\n`;
      } else {
        text += `Este planeta transita por tu **${house}**, aportando sutiles impulsos de cambio a nivel colectivo y subconsciente.\n\n`;
      }
    }
    
    text += `> [!NOTE]\n`;
    text += `> *Interpretación Local calculada dinámicamente mediante las efemérides astronómicas del día.*`;
  } 
  else if (system === 'horary') {
    text = `## Dictamen de Astrología Horaria\n\n`;
    text += `### Pregunta: *"${chart.pregunta}"*\n\n`;
    text += `**1. Consideraciones de Radicalidad (William Lilly):**\n`;
    text += `${chart.consideracionesLilly}\n\n`;
    
    text += `**2. Los Significadores del Juicio:**\n`;
    text += `- **Consultante (Tú):** Representado por el Ascendente en **${chart.ascendente.split(' ')[0]}** y su regente **${chart.regenteCasa1}**.\n`;
    text += `- **Asunto/Tema:** Corresponde a la **${chart.casaPregunta}** y su regente **${chart.regentePregunta}**.\n`;
    text += `- **La Luna:** Actúa como co-significadora del asunto y de tus emociones, situada hoy en **${chart.posicionLuna}**.\n\n`;
    
    text += `**3. Análisis de Aspectos y Desenlace:**\n`;
    text += `El aspecto aplicativo entre tu regente (${chart.regenteCasa1}) y el regente del asunto (${chart.regentePregunta.split(' en ')[0]}) es: **${chart.aspectoRegentes}**.\n\n`;
    
    const aspect = chart.aspectoRegentes;
    if (aspect.includes('Sin aspecto')) {
      text += `### Veredicto: NO (o con severos impedimentos)\n\n`;
      text += `Dado que no se perfecciona ningún aspecto aplicativo entre los principales significadores, el cosmos sugiere que el asunto consultado carece del impulso o la conexión necesaria para materializarse en este momento. Las circunstancias fluyen en direcciones opuestas.`;
    } else if (aspect.includes('Conjunción') || aspect.includes('Trígono') || aspect.includes('Sextil')) {
      text += `### Veredicto: SÍ (Favorable)\n\n`;
      text += `¡El augurio es propicio! El aspecto armónico (${aspect}) perfecciona una conexión directa y benéfica entre tú y el asunto. Las energías se facilitan para que logres tu propósito de manera fluida y exitosa en el plazo previsto.`;
    } else if (aspect.includes('Cuadratura')) {
      text += `### Veredicto: SÍ, pero con obstáculos y gran esfuerzo\n\n`;
      text += `El veredicto final es afirmativo, pero la Cuadratura indica tensiones severas y bloqueos que requerirán un esfuerzo monumental de tu parte. Habrá demoras y tendrás que negociar con dificultades antes de ver el desenlace positivo.`;
    } else if (aspect.includes('Oposición')) {
      text += `### Veredicto: NO (o separación conflictiva)\n\n`;
      text += `Aunque hay una conexión entre los significadores (Oposición), ésta representa fuerzas en conflicto que tiran en direcciones opuestas. Si el asunto llega a consumarse, traerá arrepentimiento, pérdidas o una ruptura posterior. El oráculo aconseja cautela.`;
    }
    
    text += `\n\n> [!TIP]\n`;
    text += `> *Para un veredicto horario, el aspecto entre regentes es la llave del desenlace.*`;
  }
  else {
    const isVedic = system === 'vedic';
    text = `## Carta Astrológica ${isVedic ? 'Védica Sideral (Jyotiṣa)' : 'Tradicional Helenística'}\n\n`;
    text += `### Posiciones Calculadas:\n`;
    text += `- **Ascendente:** ${chart.ascendente}\n`;
    if (isVedic) {
      text += `- **Luna (Chandra):** ${chart.luna} (Nakshatra: ${chart.nakshatra})\n`;
      text += `- **Sol (Surya):** ${chart.sol}\n`;
      text += `- **Dasha Señor Activo:** ${chart.dashaSeñor}\n`;
      text += `- **Distribución Planetaria:** ${chart.planetas}\n\n`;
      text += `### Interpretación de la Carta Sideral:\n`;
      text += `Tu Ascendente védico en **${chart.ascendente}** define tu temperamento físico e inclinaciones vitales primarias. El transcurso de tu vida está regido actualmente por el ciclo mayor (**${chart.dashaSeñor} Mahadasha**), lo cual activa las promesas natales asociadas a este planeta en tu carta sideral.\n\n`;
      text += `El Nakshatra de tu Luna (**${chart.nakshatra}**) gobierna tu mente y tu bienestar emocional, confiriéndote sus cualidades arquetípicas védicas tradicionales.`;
    } else {
      text += `- **Secta:** Carta ${chart.secta}\n`;
      text += `- **Señor del Año:** ${chart.señorDelAño}\n`;
      text += `- **Luna:** ${chart.luna}\n`;
      text += `- **Sol:** ${chart.sol}\n`;
      text += `- **Distribución Planetaria:** ${chart.planetas}\n\n`;
      text += `### Interpretación de la Carta Helenística:\n`;
      text += `Tu carta es de **Secta ${chart.secta}**, lo cual define al Sol (diurna) o a la Luna (nocturna) como tu lumbrera principal de salud y vitalidad. Tu año actual de vida está regido por **${chart.señorDelAño}**, el cual actúa como el Cronocreador (Señor del Tiempo) de este período, activando sus temáticas natales de forma prioritaria en tu destino actual.`;
    }
  }
  
  return text;
}

