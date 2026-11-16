# G-METRICS

> Plataforma de Analítica Cuantitativa Deportiva, Modelado Probabilístico y Telemetría en Tiempo Real

![React](https://img.shields.io/badge/React_19-TypeScript-161b22?style=flat-square&logo=react&logoColor=00ff66)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS_v4-Cyber--Fintech_Dark-161b22?style=flat-square&logo=tailwindcss&logoColor=00ff66)
![Node.js](https://img.shields.io/badge/Node.js-Express_Serverless-161b22?style=flat-square&logo=node.js&logoColor=00ff66)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-161b22?style=flat-square&logo=supabase&logoColor=00ff66)
![PWA](https://img.shields.io/badge/PWA-Offline--First-161b22?style=flat-square&logoColor=00ff66)
![Vercel](https://img.shields.io/badge/Deployment-Vercel_Ready-161b22?style=flat-square&logo=vercel&logoColor=ffffff)

---

## 1. Descripción General

**G-METRICS** es una plataforma tecnológica orientada al modelado matemático de eventos deportivos profesionales, especializada en **Fútbol Internacional** y **Baloncesto NBA**. 

El sistema implementa modelos estadísticos probabilísticos, telemetría táctica visual en dos dimensiones y motores de cálculo de valor esperado (+EV), ofreciendo una interfaz analítica de grado financiero basada en la paleta **Cyber-Fintech Dark** (`#0b0e14`, `#161b22`, `#30363d`, `#d9b114`, `#00ff66`).

La plataforma opera bajo una arquitectura de **coste cero ($0 USD/mes)**, empleando proxies en memoria compartida, compresión de respuestas y optimización estricta de cuotas en proveedores externos.

---

## 2. Arquitectura del Sistema

```
                      [ Cliente Web / PWA ]
                                │
                      HTTPS / JSON / WSS
                                │
                                ▼
            [ Backend Serverless Proxy (Vercel / Node) ]
            ┌──────────────────────────────────────────┐
            │  • In-Memory Stale-While-Revalidate      │
            │  • Rate Limiting por IP en Memoria       │
            │  • Control Criptográfico de Licencias    │
            └──────┬────────────────────────────┬──────┘
                   │                            │
                   ▼                            ▼
       [ Supabase PostgreSQL ]        [ Proveedores Externos ]
       - Autenticación OAuth          - ESPN Core API
       - RLS & Control de Acceso      - Football-Data.org
       - Licencias & Dispositivos     - Consenso de Mercado
```

### Principios Clave de Infraestructura
- **Protección de Cuotas Upstream**: Las solicitudes a APIs de terceros nunca se originan directamente desde el navegador del cliente. Todo el tráfico es consolidado en el backend (`server.ts` / `/api/index.js`), garantizando que múltiples peticiones concurrentes a un mismo partido consuman exactamente una llamada upstream mediante caché `stale-while-revalidate`.
- **Persistencia Híbrida**: Almacenamiento local seguro (`localStorage`) para hidratación inmediata de licencias, boletos combinados y preferencias del analista, minimizando lecturas al pool de Supabase.
- **Seguridad Zero-Trust & Device Binding**: Vinculación criptográfica por huella digital de hardware (`Device ID`), impidiendo el uso no autorizado de una misma credencial en múltiples terminales de forma simultánea.

---

## 3. Motores Analíticos y Modelado Matemático

### 3.1. Motor de Fútbol
- **Goles Esperados (xG)**: Estimación de la probabilidad de anotación basada en volumen de remates, calidad de posesión y registros históricos de eficacia por club.
- **Modelo Bivariado Dixon-Coles**: Ajuste a distribuciones de Poisson independientes con corrección de dependencia para marcadores de baja frecuencia (0-0, 1-0, 0-1, 1-1).
- **Mercados Derivados**:
  - Probabilidad 1X2 y cálculo de Cuota Justa (*Fair Odds*).
  - Distribución Over/Under (1.5, 2.5, 3.5 goles) y Ambos Equipos Anotan (BTTS).
  - Proyección de saques de esquina mediante balance de presión ofensiva y repliegue defensivo.
  - Modelado disciplinario: proyección de amonestaciones según el índice de rigor del colegiado designado.

### 3.2. Motor NBA
- **Posesiones Ponderadas (Pace)**: Estimación del ritmo conjunto de juego a 48 minutos a partir del cruce de posesiones de ambos quintetos.
- **Eficiencia Ofensiva (ORTG) y Defensiva (DRTG)**: Puntuación esperada normalizada a 100 posesiones con ponderación por descanso (horas libres), fatiga de viaje (km acumulados) y localía.
- **Auditoría de Cuartos**: Proyecciones matemáticas específicas para cada cuarto (1Q, 2Q, 3Q, 4Q) y primera mitad (1H).
- **Historial Directo (H2H)**: Matriz de enfrentamientos cara a cara con cálculo determinista de la **Racha Histórica Directa** (`H2H Streak`), indicando dominancia psicológica reciente.
- **Rendimiento Individual (Player Props)**: Cálculo de líneas de puntos y triples para jugadores clave con cálculo de valor esperado (+EV).

---

## 4. Experiencia de Usuario e Interfaz

- **Terminal Widescreen de 3 Columnas**: Panel lateral de competiciones, cartelera central de partidos y panel inspector (*Match Spotlight*) en tiempo real en pantallas de escritorio.
- **Pizarras Tácticas 2D/2.5D**: Representación interactiva del campo con esquemas tácticos confirmados, entrenadores, estado de juego y ubicación de titulares.
- **Constructor de Boletos (Parlay Engine)**: Cálculo estocástico de probabilidad combinada, cuota compuesta y prueba de estrés ante márgenes de la casa, con exportación directa en formato legible para WhatsApp o PDF.
- **Gestor de Fondos HD**: Selección dinámica de wallpapers oficiales de clubes y franquicias servidos mediante CDN de alto rendimiento con atenuación óptica para legibilidad.
- **Transiciones Cinéticas Suaves**: Animador de carga unificado en fondo oscuro con estados contextuales adaptativos.

---

## 5. Suite de Administración

El panel de administración integrado en `AdminLicenseModal` proporciona control operativo total a través de 6 submódulos protegidos por PIN y rate limiting:

| Módulo | Funcionalidad Principal |
| :--- | :--- |
| **Usuarios** | Gestión de cuentas activas, suspensión, extensión de días y desvinculación de hardware ID. |
| **Códigos VIP** | Generador de códigos dinámicos de un solo uso para activación rápida. |
| **Telemetría / Monitor** | Monitoreo de usuarios en línea, dispositivos conectados y salud de memoria en caché. |
| **Seguridad** | Consola de políticas, verificación de hashes `scrypt` y activación del Modo Acceso Libre. |
| **Auditoría** | Análisis retrospectivo de efectividad de pronósticos con exportación a formato Excel (.csv). |
| **Feedback** | Buzón de retroalimentación privada con sistema de calificación de 1 a 5 estrellas. |

---

## 6. Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons |
| **Backend / API** | Node.js, Express, ESBuild (compilado a bundle serverless) |
| **Base de Datos / Auth** | Supabase (PostgreSQL), Google OAuth, Scrypt / HMAC-SHA256 |
| **Exportación** | jsPDF, html2canvas, xlsx |
| **Móvil / PWA** | Web App Manifest, Service Worker con Workbox precache |
| **Despliegue** | Vercel Serverless Functions + Frontend estático CDN |

---

## 7. Estructura del Código

```text
G-METRICS/
├── api/
│   └── index.js                   # Bundle serverless compilado para producción
├── public/                        # Activos estáticos, manifiesto PWA e iconos
├── src/
│   ├── components/                # Componentes React modulares
│   │   ├── admin/                 # Pestañas de la Suite de Administración
│   │   ├── workspace/             # Vistas de trabajo de Fútbol y NBA
│   │   ├── MatchDetailModal.tsx   # Modal de análisis profundo y H2H
│   │   ├── SoccerPitch2D.tsx       # Cancha táctica 2D de fútbol
│   │   ├── BasketballCourt25D.tsx  # Cancha táctica 2.5D de baloncesto
│   │   ├── ParlayBuilderDrawer.tsx # Constructor de boletos combinados
│   │   ├── SimulatorModal.tsx     # Laboratorio de simulación interactiva
│   │   └── UserFeedbackWidget.tsx # Widget flotante de calificación
│   ├── context/                   # Proveedores de estado global (Parlay, Toast, Auth)
│   ├── services/                  # Motores matemáticos, APIs y seguridad
│   │   ├── mathEngine.ts          # Motor de probabilidades y xG para fútbol
│   │   ├── nbaEngine.ts           # Motor de ratings y ritmo para NBA
│   │   ├── securityShield.ts      # Hashing criptográfico y sanitización
│   │   └── apiService.ts          # Normalización y caché de datos deportivos
│   ├── types.ts                   # Interfaces y contratos de tipos TypeScript
│   ├── App.tsx                    # Orquestador principal de vistas y rutas
│   └── index.css                  # Definición de tokens y variables de diseño
├── server.ts                      # Servidor Express, proxies y endpoints REST
├── vite.config.ts                 # Configuración de empaquetado Vite y PWA
└── package.json                   # Dependencias y scripts de compilación
```

---

## 8. Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto tomando como base `.env.example`:

```env
# Supabase (Autenticación y Base de Datos)
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-privada

# Seguridad del Panel Administrativo
ADMIN_PIN=1234
ADMIN_MASTER_KEY=clave-maestra-auditoria

# Proveedores Opcionales de Respaldo
FOOTBALL_DATA_KEY=tu-api-key-football-data
ODDS_API_KEY=tu-api-key-the-odds-api
```

---

## 9. Instalación y Ejecución Local

### Prerrequisitos
- Node.js 18.0 o superior
- npm o bun

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/G-METRICS.git
cd G-METRICS

# 2. Instalar dependencias
npm install

# 3. Iniciar el entorno de desarrollo (Express + Vite HMR)
npm run dev

# 4. Comprobación estricta de tipos TypeScript
npm run lint

# 5. Compilación de producción
npm run build
```

El servidor local se ejecutará por defecto en `http://localhost:3000`.

---

## 10. Aviso Legal

**G-METRICS** es una plataforma de software estadístico orientada exclusivamente a la modelación matemática y el análisis informativo de eventos deportivos. La plataforma no constituye una casa de apuestas, no capta fondos, no intermedia en apuestas y no promueve juegos de azar. Los análisis y métricas provistas tienen un carácter puramente informativo. Servicio restringido a mayores de edad (+18). Todas las marcas registradas, logotipos y nombres de equipos citados pertenecen a sus respectivos propietarios y se utilizan únicamente con fines descriptivos e identificativos (*Nominative Fair Use*).
