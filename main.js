import { GoogleGenAI } from '@google/genai';

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
  const placeLabel = document.getElementById('place-label');
  const questionLabel = document.getElementById('question-label');
  const questionHelper = document.getElementById('question-helper');
  const specificQuestion = document.getElementById('specificQuestion');
  const birthDate = document.getElementById('birthDate');
  const birthTime = document.getElementById('birthTime');

  // Load API Key from localStorage if present
  const storedKey = localStorage.getItem('COSMOS_GEMINI_API_KEY');
  if (storedKey) {
    apiInput.value = storedKey;
  }

  // Toggle form layout according to selected system
  systemSelect.addEventListener('change', () => {
    if (systemSelect.value === 'horary') {
      onboardingTitle.innerText = 'Ingresa los datos de tu consulta horaria';
      birthDatetimeContainer.classList.add('hidden');
      horaryNote.classList.remove('hidden');
      placeLabel.innerText = 'Tu ubicación actual (Ciudad, País)';
      questionLabel.innerText = 'Pregunta Específica (Obligatorio)';
      questionHelper.innerText = 'La astrología horaria requiere formular una pregunta concreta y honesta.';
      specificQuestion.required = true;
      birthDate.required = false;
      birthTime.required = false;
    } else {
      onboardingTitle.innerText = 'Ingresa tus datos de nacimiento';
      birthDatetimeContainer.classList.remove('hidden');
      horaryNote.classList.add('hidden');
      placeLabel.innerText = 'Lugar de Nacimiento';
      questionLabel.innerText = 'Pregunta Específica (Opcional)';
      questionHelper.innerText = 'Enfocaremos la lectura en responder a tu duda vital basándonos en tu carta.';
      specificQuestion.required = false;
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
    
    // Get user input
    const system = systemSelect.value;
    const birthPlace = document.getElementById('birthPlace').value;
    const questionText = specificQuestion.value;

    let requestDate = birthDate.value;
    let requestTime = birthTime.value;

    // Horary uses the current date and time
    if (system === 'horary') {
      const now = new Date();
      requestDate = now.toISOString().split('T')[0];
      requestTime = now.toTimeString().split(' ')[0].substring(0, 5);
    }

    // Transition UI
    onboardingPanel.classList.add('hidden');
    resultsPanel.classList.remove('hidden');
    loader.classList.remove('hidden');
    readingContent.classList.add('hidden');

    try {
      // Step 1: Simulate Astronomical Calculation (API Call Mock)
      const calculatedChart = await simulateAstrologyAPI(requestDate, requestTime, birthPlace, system, questionText);
      
      // Render calculated data
      renderChartData(calculatedChart, system);

      // Step 2: Request Interpretation from Gemini AI
      const interpretation = await getAIInterpretation(calculatedChart, system, questionText);
      
      // Render interpretation
      aiInterpretationContainer.innerHTML = formatMarkdownToHTML(interpretation);

      // Hide loader and show content
      loader.classList.add('hidden');
      readingContent.classList.remove('hidden');
    } catch (error) {
      console.error(error);
      alert('Hubo un error al conectar con el oráculo. Por favor, verifica tu API KEY de Gemini o intenta de nuevo.\n\nDetalle: ' + error.message);
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
function pseudoRandom(seedString) {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(Math.sin(hash)) * 1000 % 1;
}

function getRand(seed, index) {
  return pseudoRandom(seed + "_" + index);
}

// SIMULACIÓN DE API ASTROLÓGICA MATEMÁTICA
async function simulateAstrologyAPI(date, time, place, system, question = '') {
  return new Promise((resolve) => {
    setTimeout(() => {
      let data = {};
      if (system === 'hellenistic') {
        data = {
          ascendant: "Escorpio 14°",
          sun: "Leo 22°",
          moon: "Tauro 5°",
          sect: "Diurna",
          timeLord: "Venus (Profección de Casa 10)",
          dignities: "Sol en Domicilio (+5), Luna en Exaltación (+4)"
        };
      } else if (system === 'vedic') {
        data = {
          ascendant: "Libra 20° (Sideral - Lahiri)",
          sun: "Cáncer 28°",
          moon: "Aries 11°",
          nakshatra: "Ashvini",
          shadbala: "Júpiter (1.8) - Más Fuerte",
          currentDasha: "Venus Mahadasha / Júpiter Antardasha"
        };
      } else {
        // Astrología Horaria Dinámica y Coherente
        const seed = date + "_" + time + "_" + question;
        const q = question.toLowerCase();
        
        // 1. Determinar el Ascendente de forma pseudo-aleatoria (12 signos)
        const ascendantIndex = Math.floor(getRand(seed, 1) * 12);
        const ascendantSign = SIGNS[ascendantIndex];
        const ascendantDegrees = Math.floor(getRand(seed, 2) * 30);
        const rulerCasa1 = ascendantSign.ruler;

        // 2. Determinar la Casa de la Pregunta
        let targetHouseNumber = 7; // Default: Casa 7 (Relaciones / El Otro)
        let targetHouseLabel = "Casa 7 (Pareja / El Otro / Relación)";

        if (q.includes('trabajo') || q.includes('carrera') || q.includes('empleo') || q.includes('profesion') || q.includes('puesto') || q.includes('negocio') || q.includes('jefe')) {
          targetHouseNumber = 10;
          targetHouseLabel = "Casa 10 (Carrera / Profesión / Éxito)";
        } else if (q.includes('dinero') || q.includes('financ') || q.includes('comprar') || q.includes('vender') || q.includes('pago') || q.includes('inversion')) {
          targetHouseNumber = 2;
          targetHouseLabel = "Casa 2 (Dinero / Recursos / Posesiones)";
        } else if (q.includes('deseo') || q.includes('esperanza') || q.includes('meta') || q.includes('amigo') || q.includes('desear')) {
          targetHouseNumber = 11;
          targetHouseLabel = "Casa 11 (Deseos / Esperanzas / Amigos)";
        }

        // En Whole Sign Houses, la casa se cuenta directamente:
        // Casa 1 es ascendantIndex
        // Casa 2 es ascendantIndex + 1
        // Casa 7 es ascendantIndex + 6
        // Casa 10 es ascendantIndex + 9
        // Casa 11 es ascendantIndex + 10
        const targetSignIndex = (ascendantIndex + (targetHouseNumber - 1)) % 12;
        const targetSign = SIGNS[targetSignIndex];
        const rulerPregunta = targetSign.ruler;

        // 3. Determinar el Aspecto entre Regentes (con variedad y significado)
        const aspectRoll = getRand(seed, 3);
        let aspect = "Sin aspecto aplicativo (-)";
        
        if (aspectRoll < 0.15) {
          aspect = "Conjunción aplicativa (+)";
        } else if (aspectRoll < 0.35) {
          aspect = "Trígono aplicativo (+)";
        } else if (aspectRoll < 0.55) {
          aspect = "Sextil aplicativo (+)";
        } else if (aspectRoll < 0.70) {
          aspect = "Cuadratura aplicativa (Obstáculos / -)";
        } else if (aspectRoll < 0.85) {
          aspect = "Oposición aplicativa (Dificultades / Separación)";
        }

        // 4. Determinar la Posición de la Luna
        const moonSignIndex = Math.floor(getRand(seed, 4) * 12);
        const moonSign = SIGNS[moonSignIndex].name;
        const moonDegrees = Math.floor(getRand(seed, 5) * 30);

        // 5. Evaluar consideraciones antes del juicio (Lilly)
        let consideration = "Ninguna (Carta Radical)";
        
        if (ascendantDegrees < 3) {
          consideration = `Ascendente muy temprano (${ascendantDegrees}° ${ascendantSign.name}). El asunto es prematuro.`;
        } else if (ascendantDegrees > 27) {
          consideration = `Ascendente muy tardío (${ascendantDegrees}° ${ascendantSign.name}). El asunto ya está decidido o fuera de alcance.`;
        } else if (
          (moonSign === "Libra" && moonDegrees >= 15) || 
          (moonSign === "Escorpio" && moonDegrees <= 15)
        ) {
          consideration = `Luna en Vía Combusta (${moonDegrees}° ${moonSign}). El asunto está plagado de temores e imprevistos.`;
        }

        // Posición del regente de la pregunta
        const targetSignDegrees = Math.floor(getRand(seed, 6) * 30);

        data = {
          pregunta: question,
          momento: `${date} ${time}`,
          ubicacion: place,
          ascendente: `${ascendantSign.name} ${ascendantDegrees}°`,
          regenteCasa1: `${rulerCasa1}`,
          posicionLuna: `${moonSign} ${moonDegrees}°`,
          casaPregunta: targetHouseLabel,
          regentePregunta: `${rulerPregunta} en ${targetSign.name} ${targetSignDegrees}°`,
          aspectoRegentes: aspect,
          consideracionesLilly: consideration
        };
      }
      resolve(data);
    }, 1500);
  });
}

function renderChartData(data, system) {
  const container = document.getElementById('chart-data');
  const title = document.getElementById('reading-title');
  
  title.innerText = system === 'hellenistic' ? 'Carta Helenística' : (system === 'vedic' ? 'Carta Védica (Jyotiṣa)' : 'Carta Horaria');
  
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
