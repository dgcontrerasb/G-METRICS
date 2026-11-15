# ⚡ G-METRICS — La Ciencia Detrás de la Victoria

![Version](https://img.shields.io/badge/version-2.4.0-00ff66?style=flat-square&labelColor=0b0e14)
![React](https://img.shields.io/badge/React_19-TypeScript-161b22?style=flat-square&logo=react&logoColor=00ff66)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS_v4-Cyber--Fintech_Dark-161b22?style=flat-square&logo=tailwindcss&logoColor=00ff66)
![Architecture](https://img.shields.io/badge/Architecture-Zero--Cost_$0_USD-00ff66?style=flat-square&labelColor=0b0e14)
![Backend](https://img.shields.io/badge/Express-Serverless_API-161b22?style=flat-square&logo=node.js&logoColor=00ff66)
![Database](https://img.shields.io/badge/Supabase-PostgreSQL_Free_Tier-161b22?style=flat-square&logo=supabase&logoColor=00ff66)
![Deploy](https://img.shields.io/badge/Deploy-Vercel_Ready-161b22?style=flat-square&logo=vercel&logoColor=ffffff)
![PWA](https://img.shields.io/badge/PWA-Installable-161b22?style=flat-square&logoColor=00ff66)

**G-METRICS** es una plataforma de inteligencia deportiva cuantitativa de alto rendimiento para el análisis estadístico, modelado matemático predictivo y seguimiento de eventos en tiempo real enfocado en **Fútbol Profesional Internacional** y **Baloncesto NBA**.

Diseñada bajo una estética financiera de vanguardia (**Cyber-Fintech Dark**), combina 7 modelos probabilísticos, simulación estocástica, telemetría táctica 2D, escáner de valor esperado (+EV), constructor de boletos inteligentes (Parlays) y acceso instantáneo en 1 clic con Google OAuth.

---

## 🏛️ Arquitectura Zero-Cost ($0 USD/Mes) & Rendimiento

El sistema está diseñado y blindado bajo la premisa inquebrantable de **operar a coste cero absoluto ($0 USD)**:
* **Protección Extrema de Cuotas de APIs**: Trata APIs de terceros como recursos escasos y críticos. Las llamadas nunca se realizan directamente desde los navegadores de los clientes.
* **Proxy Centralizado & Stale-While-Revalidate**: Todo el tráfico fluye por `server.ts` / `/api/index.js` utilizando caché en disco y memoria compartida. Si miles de usuarios consultan un partido al mismo tiempo, todos son atendidos desde la caché, consumiendo exactamente 1 llamada al proveedor.
* **Pool Inteligente de Supabase (Free Tier)**: Agrupamiento de consultas, almacenamiento local (`localStorage`) para licencias, marcadores y slips, y prevención total de polling redundante a la base de datos PostgreSQL.
* **Autenticación Zero-Trust**: Google OAuth sin fricción integrado con licencias criptográficas (`scrypt` / HMAC-SHA256) y validación de hardware fingerprint (`Device ID`).

---

## 🚀 Capacidades y Módulos Principales

### 🌟 1. Landing Page Dinámica (The Quant Terminal + Matchday Live)
* **Cinta Marquesina de Telemetría en Vivo**: Transmisión continua de partidos programados y en juego del día actual con escudos oficiales, marcadores en tiempo real y porcentaje de certeza.
* **Escaparate de Duelos Estelares Rotativos**: Tarjeta interactiva con rotación automática suave entre los principales duelos de la jornada (fútbol y NBA), mostrando fotos de jugadores clave, xG proyectado y el pick estelar (+EV).
* **Auditoría Semanal de Certeza**: Métrica calculada dinámicamente según el ciclo de la semana ISO actual (ej. *Auditoría Semanal Sem. 46: 84.6% Certeza*).
* **Ingreso Inteligente en 1 Clic**: Botón de acceso directo con Google que registra automáticamente a nuevos usuarios y autentica a usuarios existentes sin contraseñas ni formularios engorrosos.
* **Dock Dual-Device**: Indicador de compatibilidad widescreen de 3 columnas en PC y sincronización 100% táctil en dispositivos móviles.

### ⚽ 2. Motor Cuantitativo de Fútbol
* **Modelado de Goles Esperados (xG)**: Proyecciones de poder ofensivo y solidez defensiva para cada equipo.
* **Probabilidad 1X2 & Marcadores Exactos**: Top 3 de marcadores más probables con cuotas justas y cálculo de porcentaje real.
* **Mercados de Goles & Córners**: Over/Under (1.5, 2.5, 3.5), Ambos Equipos Anotan (BTTS) y líneas estimadas de tiros de esquina.
* **Rigor Arbitral & Disciplina**: Análisis del juez principal del encuentro, proyección de tarjetas amarillas esperadas y porcentaje de riesgo de tarjeta roja.
* **Pestaña Unificada "Goles, Córn. & Árbitro"**: Interfaz optimizada que consolida las métricas disciplinarias y de fricción en una única vista ergonómica sin espacio desperdiciado.

### 🏀 3. Motor Estadístico NBA
* **Métricas de Ritmo (Pace) y Ratings**: Choque de eficiencia ofensiva (ORTG), defensiva (DRTG) y total de puntos proyectados.
* **Línea Justa y Spread Estimado**: Margen esperado de victoria ajustado por localía, días de descanso y rachas recientes.
* **Props de Jugadores (+EV)**: Detección de líneas de puntos y triples más favorables con sus respectivas probabilidades de acierto.
* **Desglose por Cuartos**: Proyecciones individuales para 1Q, 2Q, 3Q, 4Q y primera mitad.

### 🏟️ 4. Canchas Tácticas 2D & Alineaciones Oficiales
* **Cancha 2D Horizontal de Fútbol**: Representación gráfica del terreno de juego con esquema táctico (ej. 4-3-3), entrenadores, estadio, árbitro y distribución espacial de los 11 titulares.
* **Cancha 2.5D de Baloncesto**: Pizarra táctica de quintetos titulares, banca y estado de posesión.
* **Vista Lista Alternativa**: Selector para inspeccionar la nómina completa jugador por jugador, con estado de tarjetas, lesiones y acceso a perfiles estadísticos individuales.

### 🖥️ 5. Columna Match Spotlight (Modo Widescreen 3 Columnas)
* **Inspección sin salir de la Cartelera**: Al hacer clic en cualquier encuentro en PC, la tercera columna derecha muestra el análisis profundo, telemetría táctica y marcadores sin recargar ni navegar.
* **Cabecera Degradé Cyber-Fintech**: Fondo en degradé cinematográfico esmeralda con resplandores ambientales cinéticos en fútbol y degradé ámbar en baloncesto.
* **Lenguaje Accesible**: Eliminación de tecnicismos complejos (*Dixon-Coles*, *Poisson Bivariado*) a favor de métricas claras para cualquier aficionado o analista.

### 🎟️ 6. Constructor de Boletos Combinados (Parlays)
* **Cálculo de Probabilidad Conjunta**: Multiplicación de cuotas y cálculo estocástico de la probabilidad matemática real del boleto.
* **Prueba de Estrés & Fair Odds**: Recomendación de cuota mínima aceptable para asegurar ventaja matemática sobre la casa.
* **Historial de Boletos Guardados**: Gestión completa de boletos con filtros de estado (*Pendiente*, *Acertado*, *Fallado*) y exportación en 1 clic para compartir vía WhatsApp.

### 📖 7. Centro de Ayuda, Glosario Didáctico y Modales Glassmorphism
* **Backdrop Blur Translúcido Cristalino**: Todos los modales implementan fondos difuminados suaves (`bg-black/25 backdrop-blur-sm`) que permiten apreciar claramente el contexto de la aplicación.
* **Glosario A-Z**: Diccionario con buscador en tiempo real de términos clave (+EV, Fair Odd, Stake, xG, BTTS, Pace, Spread).
* **Simulador Rápido de Cuota y Retorno**: Calculadora interactiva para proyectar retorno bruto y ganancia neta.
* **Marco Legal y Habeas Data**: Cumplimiento normativo para mayores de edad (+18) y protección de datos (Ley 1581).

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Canvas / Web Audio API |
| **Backend / API** | Node.js, Express, ESBuild (empaquetado a Serverless Bundle) |
| **Autenticación** | Supabase Auth (Google OAuth), tokens seguros HMAC-SHA256 |
| **Persistencia & Caché** | Supabase (PostgreSQL Free Tier) + Caché en disco/memoria en backend |
| **Fuentes Deportivas** | Motor híbrido ESPN Core API + Football-Data.org + Consenso de mercado |
| **Despliegue** | Vercel (Frontend Estático + Serverless Function `/api/index.js`) |
| **Móvil / PWA** | Web App Manifest, Service Worker offline y soporte instalable |

---

## 📂 Estructura del Proyecto

```text
G-METRICS/
├── api/
│   └── index.js              # Bundle serverless unificado para Vercel
├── public/                   # Recursos estáticos, manifiesto PWA e iconos
├── src/
│   ├── components/           # Componentes modulares de interfaz de usuario
│   │   ├── AccessLockScreen.tsx       # Landing page institucional con telemetría en vivo
│   │   ├── MatchSpotlightPanel.tsx    # 3ra columna widescreen con telemetría táctica
│   │   ├── MatchDetailModal.tsx       # Modal bento de análisis profundo (Fútbol & NBA)
│   │   ├── SoccerPitch2D.tsx          # Cancha 2D interactiva con esquemas tácticos
│   │   ├── BasketballCourt25D.tsx     # Cancha 2.5D NBA interactiva
│   │   ├── LineupRosterTab.tsx        # Plantillas oficiales y fichas de jugadores
│   │   ├── LiveMatchTimeline.tsx      # Minuto a minuto y estadísticas en vivo
│   │   ├── ParlayBuilderDrawer.tsx    # Boleto combinado flotante y cálculo conjunto
│   │   ├── SavedSlipsHistoryModal.tsx # Historial de boletos y exportación a WhatsApp
│   │   ├── DidacticGuideModal.tsx     # Centro de ayuda, glosario A-Z y marco legal
│   │   └── ...                        # Cabeceras, filtros, barras de navegación y logos
│   ├── context/              # Proveedores de estado global (Parlay, Toast, Auth)
│   ├── services/             # Motores matemáticos, APIs deportivas y Supabase
│   │   ├── mathEngine.ts     # Goles esperados, Dixon-Coles, córners y tarjetas
│   │   ├── nbaEngine.ts      # Ritmo (Pace), ratings ofensivos/defensivos y props
│   │   ├── apiService.ts     # Consumo y normalización de fútbol con caché local
│   │   ├── nbaApiService.ts  # Consumo y normalización de NBA con caché local
│   │   └── securityShield.ts # Hashing scrypt, validación de PIN y rate limiting
│   ├── types.ts              # Definiciones completas de TypeScript
│   ├── App.tsx               # Orquestador principal y enrutador de vistas
│   └── index.css             # Tokens de diseño Cyber-Fintech Dark
├── server.ts                 # Servidor Express, proxies con caché stale-while-revalidate
├── vercel.json               # Configuración de compilación y rutas serverless
├── vite.config.ts            # Configuración de Vite y empaquetador PWA
└── package.json              # Dependencias y scripts del proyecto
```

---

## ⚙️ Variables de Entorno

Para ejecutar el proyecto en desarrollo o producción, configurar las siguientes variables en `.env`:

| Variable | Requerida | Propósito |
| :--- | :---: | :--- |
| `VITE_SUPABASE_URL` | **Sí** | URL pública de la instancia de Supabase para Google OAuth y base de datos. |
| `VITE_SUPABASE_ANON_KEY` | **Sí** | Llave anónima pública de Supabase para el cliente frontend. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí** | Llave privada de servidor (Service Role) para el backend seguro. |
| `ODDS_API_KEY` | *Opcional* | Llave de The Odds API para consenso de cuotas de mercado. |
| `FOOTBALL_DATA_KEY` | *Opcional* | Llave de Football-Data.org para respaldo de ligas europeas. |
| `ADMIN_PIN` | **Sí** | PIN numérico maestro para acceso al Panel de Administración. |
| `ADMIN_MASTER_KEY` | *Opcional* | Clave maestra para auditoría de licencias y operaciones de emergencia. |

---

## 💻 Instalación y Desarrollo Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/G-METRICS.git
cd G-METRICS

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Iniciar servidor de desarrollo (Express + Vite HMR)
npm run dev

# 5. Compilar para producción y verificar tipos
npm run build
```

El servidor local se iniciará en `http://localhost:3000`.

---

## 📄 Descargo de Responsabilidad y Uso Ético

**G-METRICS** es una herramienta analítica y de software estadístico basada en modelos matemáticos y telemetría de eventos deportivos. **No somos una casa de apuestas, no operamos juegos de azar ni recibimos fondos destinados a apuestas**. La información y métricas presentadas son de carácter exclusivamente informativo y educativo. El usuario es el único responsable de sus decisiones personales. Servicio exclusivo para mayores de edad (+18). Todos los nombres comerciales, escudos y marcas deportivas mostradas pertenecen a sus respectivos titulares y se utilizan con fines meramente identificativos y descriptivos (*Uso Legítimo / Nominative Fair Use*).
