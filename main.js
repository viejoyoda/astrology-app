import { GoogleGenAI } from '@google/genai';
import { MakeTime, EclipticLongitude, SiderealTime, Body, SunPosition } from 'astronomy-engine';


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

// DICCIONARIO DE CASAS ASTROLÓGICAS EN LENGUAJE COTIDIANO
const HOUSE_METADATA = {
  1: { area: "Vitalidad e Identidad", focus: "tu energía personal, presencia y nuevos comienzos" },
  2: { area: "Dinero y Finanzas", focus: "tus ingresos, gastos, posesiones y estabilidad material" },
  3: { area: "Comunicación y Mente", focus: "conversaciones, mensajes, traslados cortos y gestiones" },
  4: { area: "Hogar y Familia", focus: "vida doméstica, raíces emocionales, intimidad y hogar" },
  5: { area: "Romance y Creatividad", focus: "amor, pasión, diversión, proyectos personales y disfrute" },
  6: { area: "Trabajo Diario y Salud", focus: "rutina laboral, tareas pendientes, hábitos y bienestar" },
  7: { area: "Pareja y Vínculos", focus: "relaciones de pareja, acuerdos, socios y el trato cercano" },
  8: { area: "Transformación y Finanzas Compartidas", focus: "acuerdos íntimos, deudas, dinero conjunto y soltar el pasado" },
  9: { area: "Expansión y Perspectiva", focus: "estudios, viajes, visión de futuro y perspectiva mental" },
  10: { area: "Profesión y Éxito", focus: "carrera profesional, reputación pública y metas importantes" },
  11: { area: "Amistades y Metas Futuras", focus: "trabajo en equipo, redes de apoyo y anhelos a futuro" },
  12: { area: "Introspección y Descanso", focus: "mundo interior, intuición, espiritualidad y recarga de energía" }
};

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
  const dateParts = dateStr.split('-');
  const timeParts = timeStr.split(':');
  const y = parseInt(dateParts[0], 10);
  const m = parseInt(dateParts[1], 10) - 1;
  const d = parseInt(dateParts[2], 10);
  const hr = parseInt(timeParts[0], 10);
  const min = parseInt(timeParts[1], 10);

  const localDate = new Date(y, m, d, hr, min, 0);
  const utcDate = new Date(localDate.getTime() - (offset * 60 * 60 * 1000));
  const time = MakeTime(utcDate);

  const sunLon = SunPosition(time).elon;
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
    const housePlacements = [];

    for (const [pName, pData] of Object.entries(planets)) {
      const houseNum = ((pData.index - userSignIndex + 12) % 12) + 1;
      const meta = HOUSE_METADATA[houseNum];
      transitsInHouses[pName] = `${pData.sign} ${pData.degrees}° (Casa ${houseNum}: ${meta.area})`;
      housePlacements.push({
        planet: pName,
        sign: pData.sign,
        degrees: pData.degrees,
        house: houseNum,
        area: meta.area,
        focus: meta.focus
      });
    }

    return {
      tipo: "Horóscopo Diario de Tránsitos",
      signoConsultante: userSignName,
      fechaTránsitos: dateStr,
      ...transitsInHouses,
      _housePlacements: housePlacements
    };
  } else if (system === 'vedic') {
    const siderealAsc = (ascDeg - ayanamsha + 360) % 360;
    const siderealSun = (sunLon - ayanamsha + 360) % 360;
    const siderealMoon = (moonLon - ayanamsha + 360) % 360;
    const siderealMars = (marsLon - ayanamsha + 360) % 360;
    const siderealMercury = (mercuryLon - ayanamsha + 360) % 360;
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
    // Horary - Basado fielmente en William Lilly (Christian Astrology)
    const asc = getZodiacSign(ascDeg);
    const moon = getZodiacSign(moonLon);

    const q = questionText.toLowerCase();
    let targetHouseNumber = 7; 
    let targetHouseLabel = "Casa 7 (Pareja / Vínculos / El Otro)";

    if (q.includes('trabajo') || q.includes('carrera') || q.includes('empleo') || q.includes('profesion') || q.includes('puesto') || q.includes('negocio') || q.includes('jefe') || q.includes('ascenso')) {
      targetHouseNumber = 10;
      targetHouseLabel = "Casa 10 (Profesión / Éxito / Carrera)";
    } else if (q.includes('dinero') || q.includes('financ') || q.includes('comprar') || q.includes('vender') || q.includes('pago') || q.includes('inversion') || q.includes('sueldo')) {
      targetHouseNumber = 2;
      targetHouseLabel = "Casa 2 (Dinero / Recursos / Posesiones)";
    } else if (q.includes('deseo') || q.includes('esperanza') || q.includes('meta') || q.includes('amigo') || q.includes('amiga') || q.includes('desear')) {
      targetHouseNumber = 11;
      targetHouseLabel = "Casa 11 (Deseos / Amistades / Proyectos)";
    } else if (q.includes('viaje') || q.includes('estudio') || q.includes('extranjero') || q.includes('visa')) {
      targetHouseNumber = 9;
      targetHouseLabel = "Casa 9 (Viajes Largos / Estudios / Extranjero)";
    } else if (q.includes('casa') || q.includes('hogar') || q.includes('familia') || q.includes('mudanza')) {
      targetHouseNumber = 4;
      targetHouseLabel = "Casa 4 (Hogar / Familia / Bienes Raíces)";
    } else if (q.includes('salud') || q.includes('enfermedad') || q.includes('medico')) {
      targetHouseNumber = 6;
      targetHouseLabel = "Casa 6 (Salud / Rutina / Esfuerzo)";
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

    // Helper para evaluar aspectos con orbes tradicionales
    function getAspectInfo(degA, degB, maxOrb = 8) {
      let diff = Math.abs(degA - degB) % 360;
      if (diff > 180) diff = 360 - diff;
      
      if (diff <= maxOrb) return { type: "Conjunción", nature: "+", quality: "unión directa y máxima fusión de energías", diff: diff.toFixed(1) };
      if (Math.abs(diff - 60) <= maxOrb) return { type: "Sextil", nature: "+", quality: "oportunidades favorables y cooperación fluida", diff: Math.abs(diff - 60).toFixed(1) };
      if (Math.abs(diff - 90) <= maxOrb) return { type: "Cuadratura", nature: "-", quality: "obstáculos, demoras y esfuerzo considerable", diff: Math.abs(diff - 90).toFixed(1) };
      if (Math.abs(diff - 120) <= maxOrb) return { type: "Trígono", nature: "+", quality: "gran armonía, facilitación y éxito natural", diff: Math.abs(diff - 120).toFixed(1) };
      if (Math.abs(diff - 180) <= maxOrb) return { type: "Oposición", nature: "-", quality: "fuerzas contrarias, polaridad o distanciamiento", diff: Math.abs(diff - 180).toFixed(1) };
      return null;
    }

    // 1. Aspecto directo entre regente 1 y regente 2
    const directAspect = getAspectInfo(degRuler1, degRuler2, 8);

    // 2. Aspecto de la Luna al regente del asunto (regla fundamental de Lilly: la Luna concreta el juicio)
    const moonAspect = getAspectInfo(moonLon, degRuler2, 10);

    // 3. Relación por signos enteros (Whole Sign familiarity)
    const signRuler1 = getZodiacSign(degRuler1);
    const signRuler2 = getZodiacSign(degRuler2);
    const signDist = (signRuler2.index - signRuler1.index + 12) % 12;

    let signHarmonious = false;
    let signTense = false;
    let signRelationText = "en aversión (sin conexión directa por signos)";

    if (signDist === 0) { signRelationText = "en el mismo signo (co-presencia)"; signHarmonious = true; }
    else if (signDist === 4 || signDist === 8) { signRelationText = "en signos de Trígono (afinidad elemental fluida)"; signHarmonious = true; }
    else if (signDist === 2 || signDist === 10) { signRelationText = "en signos de Sextil (afinidad amistosa)"; signHarmonious = true; }
    else if (signDist === 3 || signDist === 9) { signRelationText = "en signos de Cuadratura (tensión elemental)"; signTense = true; }
    else if (signDist === 6) { signRelationText = "en signos Opuestos (polaridad)"; signTense = true; }

    // 4. Recepción mutua o unilateral (buena voluntad entre planetas)
    const r1InR2Sign = signRuler1.ruler === rulerPregunta;
    const r2InR1Sign = signRuler2.ruler === rulerCasa1;
    const hasReception = r1InR2Sign || r2InR1Sign;

    let aspect = "";
    let veredictoBadge = "";
    let veredictoTipo = "";
    let explicacionCorta = "";

    if (directAspect) {
      if (directAspect.nature === '+') {
        aspect = `${directAspect.type} aplicativo directo (+) - ${directAspect.quality}`;
        veredictoBadge = "SÍ — Favorable y Directo";
        veredictoTipo = "SI_DIRECTO";
        explicacionCorta = `Existe un aspecto directo y benéfico (${directAspect.type}) entre tu regente (${rulerCasa1}) y el regente del asunto (${rulerPregunta}), facilitando un desenlace exitoso.`;
      } else if (directAspect.type === 'Cuadratura') {
        aspect = `Cuadratura aplicativa directa (-) - ${directAspect.quality}`;
        veredictoBadge = "SÍ, PERO CON OBSTÁCULOS Y ESFUERZO";
        veredictoTipo = "SI_CON_OBSTACULOS";
        explicacionCorta = `Hay conexión directa pero a través de una Cuadratura. El asunto se resolverá positivamente solo si estás dispuesto a negociar dificultades, demoras y fricciones.`;
      } else {
        aspect = `Oposición aplicativa directa (-) - ${directAspect.quality}`;
        veredictoBadge = "NO — Fuerzas en Conflicto o Ruptura";
        veredictoTipo = "NO_OPOSICION";
        explicacionCorta = `La Oposición directa indica intereses encontrados o separación. Si el asunto llega a concretarse, traerá arrepentimiento o tensiones posteriores.`;
      }
    } else if (moonAspect && moonAspect.nature === '+') {
      aspect = `Perfección por la Luna: ${moonAspect.type} aplicativo a ${rulerPregunta} (+)`;
      veredictoBadge = "SÍ — Concretado a través de la Luna";
      veredictoTipo = "SI_LUNAR";
      explicacionCorta = `Aunque tus regentes principales no forman un ángulo exacto, la Luna (tu co-significadora) aplica en ${moonAspect.type} armónico a ${rulerPregunta}, asegurando la resolución favorable del asunto.`;
    } else if (moonAspect && moonAspect.type === 'Cuadratura') {
      aspect = `Luna en Cuadratura a ${rulerPregunta} (-) - Avance con demoras`;
      veredictoBadge = "SÍ, PERO CON TENSIONES EMOCIONALES";
      veredictoTipo = "SI_CON_OBSTACULOS";
      explicacionCorta = `La Luna conecta con el asunto mediante Cuadratura, prometiendo un desenlace posible pero acompañado de desgaste anímico y negociaciones difíciles.`;
    } else if (hasReception) {
      aspect = `Recepción favorable entre regentes (${signRelationText}) (+)`;
      veredictoBadge = "SÍ — Facilitado por Buena Voluntad Mutua";
      veredictoTipo = "SI_INDIRECTO";
      explicacionCorta = `Existe recepción entre los planetas (uno acoge al otro en su signo). Esto indica disposición, afinidad y simpatía mutua para sacar el asunto adelante.`;
    } else if (signHarmonious) {
      aspect = `Testimonio armónico por signos (${signRelationText}) (+)`;
      veredictoBadge = "FAVORABLE — Progreso Gradual a Medio Plazo";
      veredictoTipo = "FAVORABLE_GRADUAL";
      explicacionCorta = `Ambos regentes habitan signos en sintonía elemental, lo que permite que el asunto prospere de forma natural en las próximas semanas.`;
    } else if (signTense) {
      aspect = `Testimonio tenso por signos (${signRelationText}) (-)`;
      veredictoBadge = "DIFÍCIL — Bloqueos o Desencuentro Actual";
      veredictoTipo = "DIFICIL";
      explicacionCorta = `Los signos de ambos planetas no congenian en este momento, lo que refleja desacuerdos, frialdad o falta de sincronización para avanzar.`;
    } else {
      aspect = `Sin aspecto aplicativo ni conexión lunar (${signRelationText}) (-)`;
      veredictoBadge = "NO — Falta de Impulso o Conexión en este Momento";
      veredictoTipo = "NO_INCONEXION";
      explicacionCorta = `Los significadores están en aversión y la Luna no traslada luz al asunto. Las circunstancias actuales no ofrecen el puente necesario para materializarlo.`;
    }

    let consideration = "Ninguna (Carta Radical y Confiable)";
    if (asc.degrees < 3) {
      consideration = `Ascendente muy temprano (${asc.degrees}° ${asc.sign}). El asunto es prematuro o aún está gestándose; las cosas pueden cambiar.`;
    } else if (asc.degrees > 27) {
      consideration = `Ascendente muy tardío (${asc.degrees}° ${asc.sign}). El asunto ya está en sus etapas finales o escapa a tu control.`;
    } else if (
      (moon.sign === "Libra" && moon.degrees >= 15) || 
      (moon.sign === "Escorpio" && moon.degrees <= 15)
    ) {
      consideration = `Luna en Vía Combusta (${moon.degrees}° ${moon.sign}). Hay ansiedad o temores infundados que nublan la situación objetiva.`;
    }

    return {
      tipo: "Astrología Horaria Tradicional",
      pregunta: questionText,
      veredicto: veredictoBadge,
      ascendente: `${asc.sign} ${asc.degrees}° (Consultante)`,
      regenteCasa1: `${rulerCasa1}`,
      posicionLuna: `${moon.sign} ${moon.degrees}° (Co-significadora)`,
      casaPregunta: targetHouseLabel,
      regentePregunta: `${rulerPregunta} en ${getZodiacSign(degRuler2).sign} ${getZodiacSign(degRuler2).degrees}°`,
      aspectoRegentes: aspect,
      consideracionesLilly: consideration,
      _veredictoTipo: veredictoTipo,
      _explicacionCorta: explicacionCorta
    };
  }
}

function renderChartData(data, system) {
  const container = document.getElementById('chart-data');
  const title = document.getElementById('reading-title');
  
  title.innerText = system === 'hellenistic' ? 'Carta Helenística' : (system === 'vedic' ? 'Carta Védica (Jyotiṣa)' : (system === 'daily' ? 'Horóscopo Diario' : 'Carta Horaria'));
  
  container.innerHTML = '';
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('_') || key === 'pregunta' || key === 'momento' || key === 'ubicacion') continue;
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
    systemPrompt = `Eres un experto astrólogo tradicional y humanista. Tu misión es generar un horóscopo diario de tránsitos útil, claro, enriquecedor y profundamente conectado con la vida real del consultante.
    REGLAS OBLIGATORIAS:
    1. NUNCA menciones un número de casa astrológica de forma aislada sin traducir su significado inmediato a la vida real (ejemplo: si hablas de Casa 10, aclara siempre que es el sector del trabajo, logros y reputación profesional; si hablas de Casa 7, aclara que es la pareja y los acuerdos clave).
    2. NO hagas una lista robótica e inconexa de los 10 planetas uno detrás de otro con frases repetitivas.
    3. Organiza tu respuesta en una narrativa cohesiva y fluida con estas secciones:
       - ✨ **Clima General de tu Día**: el tono vital y emocional marcado por el Sol y la Luna de hoy.
       - 💼 **Trabajo, Metas y Finanzas**: oportunidades, enfoque mental y gestiones prácticas.
       - ❤️ **Amor y Vínculos**: sintonía con pareja, amistades o familia.
       - ⚡ **Energía y Bienestar**: ritmo físico, posibles tensiones o momentos de descanso recomendados.
       - 🔮 **Consejo del Oráculo**: una síntesis clara, motivadora y accionable para tu jornada.`;
    userPrompt = `Aquí tienes los tránsitos planetarios reales de hoy calculados para el signo ${chartData.signoConsultante}: ${JSON.stringify(chartData)}.`;
  } else {
    systemPrompt = `Eres un experto astrólogo tradicional especializado en Astrología Horaria (siguiendo estrictamente las reglas de William Lilly en 'Christian Astrology' y Guido Bonatti).
    Tu objetivo es responder de forma directa, honesta, clara y comprensible la duda del consultante.
    
    REGLAS OBLIGATORIAS:
    1. Inicia con un VEREDICTO CLARO Y DESTACADO en la primera línea (ej: "Veredicto: SÍ", "Veredicto: SÍ, PERO CON DEMORAS Y ESFUERZO", "Veredicto: NO").
    2. Explica en lenguaje cotidiano quién es quién en el mapa celeste: el consultante (${chartData.regenteCasa1}), el asunto (${chartData.regentePregunta}) y la Luna.
    3. Detalla qué significa la conexión astrológica encontrada (aspecto directo o testimonio lunar) y qué desenlace predice en la realidad.
    4. Explica cualquier consideración de radicalidad si aplica.
    5. Cierra con un Consejo Práctico concreto para el consultante sobre los pasos a seguir.`;
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
      const originAngle = aspect.includes('Luna') ? angleMoon : angleH1;
      ctx.moveTo(cx + r * 0.6 * Math.cos(originAngle), cy + r * 0.6 * Math.sin(originAngle));
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
      if (['tipo', 'signoConsultante', 'fechaTránsitos'].includes(pName) || pName.startsWith('_')) continue;
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

// GENERACIÓN DE INTERPRETACIÓN LOCAL (NARRATIVA CLARA, HUMANA Y RIGUROSA)
function generateOfflineInterpretation(chart, system, question) {
  let text = "";
  
  if (system === 'daily') {
    const placements = chart._housePlacements || [];
    const sunInfo = placements.find(p => p.planet === 'Sol');
    const moonInfo = placements.find(p => p.planet === 'Luna');
    const mercuryInfo = placements.find(p => p.planet === 'Mercurio');
    const venusInfo = placements.find(p => p.planet === 'Venus');
    const marsInfo = placements.find(p => p.planet === 'Marte');
    const jupiterInfo = placements.find(p => p.planet === 'Júpiter');
    const saturnInfo = placements.find(p => p.planet === 'Saturno');

    text = `## Horóscopo Diario de Tránsitos para **${chart.signoConsultante}**\n\n`;
    text += `*Cielo astronómico de hoy: ${chart.fechaTránsitos}*\n\n`;

    // 1. Clima General
    text += `### ✨ El Clima General de tu Día\n`;
    if (sunInfo && moonInfo) {
      text += `Hoy tu energía vital está iluminada por el **Sol en ${sunInfo.sign}**, transitando por tu **Casa ${sunInfo.house} (${sunInfo.area})**. Esto significa que tu mayor foco consciente y brillo personal se concentrará en ${sunInfo.focus}.\n\n`;
      text += `Por su parte, el pulso emocional lo marca la **Luna en ${moonInfo.sign}** a través de tu **Casa ${moonInfo.house} (${moonInfo.area})**, influyendo directamente en ${moonInfo.focus}. La combinación de ambos astros te invita a alinear lo que sientes con lo que deseas construir hoy.\n\n`;
    }

    // 2. Trabajo, Dinero y Proyectos
    text += `### 💼 Trabajo, Dinero y Proyectos\n`;
    let workText = "";
    if (mercuryInfo) {
      workText += `En el plano mental y de comunicaciones, **Mercurio en ${mercuryInfo.sign}** activa tu **Casa ${mercuryInfo.house} (${mercuryInfo.area})**, dinamizando ${mercuryInfo.focus}. Es un momento propicio para ordenar ideas, responder mensajes clave o negociar acuerdos. `;
    }
    if (saturnInfo) {
      workText += `A la vez, la presencia de **Saturno en ${saturnInfo.sign}** en tu **Casa ${saturnInfo.house} (${saturnInfo.area})** te pide disciplina, paciencia y estructurar bien tus compromisos laborales. Evita atajos; la constancia será tu mayor aliada. `;
    }
    if (jupiterInfo) {
      workText += `**Júpiter en ${jupiterInfo.sign}** abre puertas en tu **Casa ${jupiterInfo.house} (${jupiterInfo.area})**, aportándote optimismo y oportunidades de crecimiento en ${jupiterInfo.focus}.`;
    }
    text += workText ? workText + "\n\n" : `Las energías laborales y financieras fluyen con estabilidad; enfócate en tus prioridades sin dispersarte.\n\n`;

    // 3. Amor, Relaciones y Vínculos
    text += `### ❤️ Amor y Relaciones\n`;
    let loveText = "";
    if (venusInfo) {
      loveText += `El planeta de los afectos y la armonía, **Venus en ${venusInfo.sign}**, transita tu **Casa ${venusInfo.house} (${venusInfo.area})**. Su influencia aporta simpatía, magnetismo y deseo de compartir en ${venusInfo.focus}. Si tienes pareja o deseas acercarte a alguien, este tránsito facilita el entendimiento y el cariño. `;
    }
    if (marsInfo) {
      loveText += `Por otro lado, **Marte en ${marsInfo.sign}** recorre tu **Casa ${marsInfo.house} (${marsInfo.area})**, lo que inyecta pasión e iniciativa, pero también te advierte contra la impaciencia o los roces innecesarios.`;
    }
    text += loveText ? loveText + "\n\n" : `El clima vincular te invita a escuchar con empatía y cuidar los detalles en tus interacciones más cercanas.\n\n`;

    // 4. Energía, Ánimo y Bienestar
    text += `### ⚡ Energía, Ánimo y Bienestar\n`;
    if (marsInfo && moonInfo) {
      text += `Tu nivel de vitalidad física depende hoy del equilibrio entre la iniciativa activa de Marte (${marsInfo.area}) y la sensibilidad de la Luna (${moonInfo.area}). Si notas tensión acumulada, regálate pausas conscientes para respirar y recuperar tu centro.\n\n`;
    } else {
      text += `Cuida tu ritmo vital y dale a tu cuerpo espacio para recargarse a lo largo del día.\n\n`;
    }

    // 5. Consejo del Oráculo
    text += `### 🔮 Consejo del Oráculo para Hoy\n`;
    text += `Aprovecha el foco del Sol en tu sector de **${sunInfo ? sunInfo.area : 'energía personal'}** para avanzar con paso firme en lo que verdaderamente te importa, pero escuchando con madurez lo que tu intuición te señala a través de la Luna. La clave de tu jornada no es correr, sino actuar con certeza e intención clara.\n\n`;

    // 6. Guía didáctica de las Casas activadas
    text += `---\n\n`;
    text += `#### 📖 Diccionario de Casas Activadas Hoy en tu Carta:\n`;
    text += `*(Para que comprendas qué significa en tu vida cada sector astrológico activado)*\n\n`;
    if (placements.length > 0) {
      placements.forEach(p => {
        text += `- **Casa ${p.house} (${p.area}):** Ocupada hoy por **${p.planet} en ${p.sign}**. *Influye en: ${p.focus}.*\n`;
      });
    }
    text += `\n> [!NOTE]\n`;
    text += `> *Horóscopo generado a partir de las coordenadas astronómicas y efemérides geocéntricas exactas de hoy.*`;
  } 
  else if (system === 'horary') {
    text = `## Dictamen de Astrología Horaria Tradicional\n\n`;
    text += `> ### 🔮 Veredicto del Oráculo: **${chart.veredicto || 'RESOLUCIÓN DETERMINADA'}**\n\n`;
    text += `### Pregunta Formulada: *"${chart.pregunta}"*\n\n`;
    
    text += `### 1. Quién es Quién en el Cielo (Los Actores de tu Consulta)\n`;
    text += `- **Tú (Consultante):** Estás representado por la **Casa 1** y tu planeta regente **${chart.regenteCasa1}** (con el Ascendente en ${chart.ascendente.split(' ')[0]}).\n`;
    text += `- **El Asunto Consultado:** Corresponde a la **${chart.casaPregunta}**, gobernada por su regente **${chart.regentePregunta}**.\n`;
    text += `- **La Luna (El Motor de los Acontecimientos):** Actúa como tu co-significadora y marca cómo fluye el destino, situada hoy en **${chart.posicionLuna}**.\n\n`;
    
    text += `### 2. El Dictamen Astrológico\n`;
    text += `${chart._explicacionCorta || 'Se ha analizado la configuración geométrica y las dignidades celestes para tu pregunta.'}\n\n`;
    text += `* **Aspecto / Conexión:** *${chart.aspectoRegentes}*.\n\n`;

    const vTipo = chart._veredictoTipo || "";
    if (vTipo === 'SI_DIRECTO' || vTipo === 'SI_LUNAR') {
      text += `El cielo abre un canal directo y armónico. Los significadores se buscan y se encuentran favorablemente en el firmamento, lo que augura que tus deseos o intenciones respecto a esta pregunta tienen el viento a favor para materializarse con fluidez.\n\n`;
    } else if (vTipo === 'SI_CON_OBSTACULOS') {
      text += `La respuesta promete ser positiva, pero no vendrá de manera gratuita ni inmediata. Hay tensiones que demandarán paciencia, madurez emocional y resolver trabas previas antes de ver la recompensa.\n\n`;
    } else if (vTipo === 'SI_INDIRECTO' || vTipo === 'FAVORABLE_GRADUAL') {
      text += `Hay buena voluntad, simpatía y afinidad de fondo, aunque los tiempos terrenales requieren paciencia. No fuerces los acontecimientos de golpe; el asunto madurará a tu favor si mantienes la templanza.\n\n`;
    } else if (vTipo === 'NO_OPOSICION') {
      text += `Las partes o circunstancias involucradas tiran en direcciones contrarias. Una oposición tradicional advierte que insistir tercamente en este camino podría generar arrepentimiento, desgaste o distanciamiento.\n\n`;
    } else {
      text += `En este preciso momento, no existe el puente energético necesario en el cielo para que el asunto se resuelva en el sentido que esperas. Las circunstancias no están maduras o las voluntades marchan por senderos desconectados.\n\n`;
    }

    text += `### 3. Consideraciones Previas de Radicalidad (William Lilly)\n`;
    text += `${chart.consideracionesLilly}\n\n`;

    text += `### 4. Consejo Práctico del Oráculo\n`;
    if (vTipo.startsWith('SI')) {
      text += `Da los pasos necesarios con confianza y honestidad. Las energías respaldan tu iniciativa, pero mantén la atención en los acuerdos mutuos y no des nada por sentado hasta que se concrete en el plano real.`;
    } else if (vTipo === 'FAVORABLE_GRADUAL') {
      text += `Siembra con calma y no te precipites pidiendo respuestas inmediatas. Dale tiempo al otro o a las circunstancias para que tomen su curso natural.`;
    } else {
      text += `No desgastes tu energía intentando empujar una puerta que hoy está trabada. Enfócate en tu propia paz mental, en tus proyectos personales y deja que el tiempo aclare las verdaderas intenciones del entorno.`;
    }

    text += `\n\n> [!TIP]\n`;
    text += `> *En la astrología horaria clásica, la carta es una fotografía viva del instante en que la pregunta se volvió urgente. Si la situación cambia sustancialmente en el futuro, se podrá consultar un nuevo ciclo.*`;
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


