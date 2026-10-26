# ⚡ SportStats Pro — Plataforma de Inteligencia Cuantitativa y Análisis Deportivo

![Version](https://img.shields.io/badge/version-1.0.0-00ff66?style=flat-square&labelColor=0b0e14)
![React](https://img.shields.io/badge/React_19-TypeScript-161b22?style=flat-square&logo=react&logoColor=00ff66)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS_v4-Cyber--Fintech_Dark-161b22?style=flat-square&logo=tailwindcss&logoColor=00ff66)
![Backend](https://img.shields.io/badge/Express-Serverless_API-161b22?style=flat-square&logo=node.js&logoColor=00ff66)
![Database](https://img.shields.io/badge/Supabase-PostgreSQL_%26_Cache-161b22?style=flat-square&logo=supabase&logoColor=00ff66)
![Deploy](https://img.shields.io/badge/Deploy-Vercel_Ready-161b22?style=flat-square&logo=vercel&logoColor=ffffff)
![PWA](https://img.shields.io/badge/PWA-Installable-161b22?style=flat-square&logoColor=00ff66)

**SportStats Pro** es una plataforma web progresiva (PWA) de alto rendimiento para el análisis estadístico, modelado matemático predictivo y seguimiento de eventos en tiempo real enfocado en **Fútbol Profesional Internacional** y **Baloncesto NBA**.

Diseñada bajo una interfaz financiera de alta fidelidad (**Cyber-Fintech Dark**), combina modelado probabilístico bivariado, simulaciones estocásticas de Monte Carlo, alertas sonoras en vivo, auditoría de valor esperado (+EV) y exportación de reportes ejecutivos en PDF.

---

## 🚀 Capacidades y Módulos Principales

### ⚽ 1. Motor Cuantitativo de Fútbol
* **Modelado Bivariado Poisson & Ajuste Dixon-Coles**: Proyección de goles esperados (**xG**), probabilidades reales de mercados **1X2**, **Doble Oportunidad**, **Over/Under (1.5, 2.5, 3.5)** y **Ambos Marcan (BTTS)**.
* **Simulación de Monte Carlo (10,000 iteraciones)**: Proyección de la distribución probabilística de marcadores exactos más probables.
* **Métricas Tácticas y Fricción**: Estimación estadística de córners, tarjetas amarillas/rojas, impacto arbitral y rachas ponderadas por localía y visita.
* **Clasificaciones y Comparativa H2H**: Tablas de posiciones en vivo (General, Local, Visitante) y desglose de enfrentamientos directos previos.

### 🔴 2. Monitor en Vivo y Notificaciones Inteligentes (Live Tracker)
* **Seguimiento Minuto a Minuto**: Estado de partidos en juego con filtros prioritarios para casas de apuestas principales.
* **Alertas Sonoras y Visuales de Goles**: Sistema de audio sintético generado mediante Web Audio API nativa (sin dependencias externas de archivos de audio) con notificación flotante animada al detectarse cambio de marcador en tiempo real.
* **Respaldo Cruzado de Marcadores**: Sincronización entre fuentes primarias y cuotas de mercado para asegurar consistencia de resultados.

### 🏀 3. Motor Estadístico NBA
* **Métricas Avanzadas de Ritmo y Eficiencia**: Proyección de puntos totales por escuadra según ritmo de juego (**Pace**) y rating ofensivo/defensivo.
* **Proyección de Hándicaps y Totales**: Análisis de margen esperado de victoria (**Spread / Hándicap**), líneas Over/Under y Moneyline ajustadas por factor cancha y descanso.

### 💹 4. Análisis de Valor (+EV) y Gestión de Capital
* **Detector de Valor Esperado (+EV)**: Comparación algorítmica en tiempo real entre la probabilidad estimada por el modelo y las cuotas implícitas ofrecidas por el mercado.
* **Calculadora Didáctica de Retorno**: Simulación de beneficios brutos, utilidad neta y dimensionamiento de postura basado en el **Criterio de Kelly**.
* **Constructor de Combinadas (Parlays)**: Acumulador dinámico de selecciones con cálculo de cuota global y probabilidad conjunta estimada.

### 📄 5. Generación de Reportes PDF
* **Exportación Ejecutiva de Análisis**: Creación de informes detallados en PDF (vía `jspdf` y `jspdf-autotable`) con desglose de probabilidades, xG proyectado, cuotas y métricas tácticas listos para compartir o imprimir.

### 🛡️ 6. Seguridad, Licencias y Optimización de APIs
* **Gestión de Licencias por Dispositivo (`Device ID`)**: Validación criptográfica de accesos (planes Demo, Mensual, Semestral, Anual o Vitalicio).
* **Base de Datos y Caché Compartida con Supabase**: Persistencia en la nube para sincronización de licencias y caché inteligente de cuotas y partidos para reducir llamadas a APIs externas.
* **Escudo contra Fuerza Bruta**: Retardo progresivo (*tarpitting*), límite de intentos por IP y bloqueo temporal en caso de actividad sospechosa.
* **Panel de Control Administrativo**: Interfaz protegida por PIN para generación, revocación y auditoría de licencias en tiempo real.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion, jsPDF |
| **Backend / API** | Node.js, Express, ESBuild (empaquetado a Serverless Bundle) |
| **Persistencia & Caché** | Supabase (PostgreSQL) + Caché de memoria en runtime |
| **Fuentes de Datos Deportivos** | API-Football (v3), The Odds API, Football-Data.org, ESPN Core API |
| **Despliegue** | Vercel (Frontend Estático + Serverless Function `/api/index.js`) |
| **Móvil / PWA** | Web App Manifest, Service Worker y soporte para instalación de pantalla de inicio |

---

## 📂 Estructura del Proyecto

```text
sportstats-pro/
├── api/
│   └── index.js              # Bundle serverless autogenerado para Vercel
├── public/                   # Recursos estáticos, manifiesto PWA e iconos
├── src/
│   ├── components/           # Componentes modulares de interfaz de usuario
│   │   ├── MatchCard.tsx     # Tarjeta de partido y cuotas
│   │   ├── MatchDetailModal/ # Análisis profundo, estadísticas H2H y clasificaciones
│   │   ├── LiveTracker.tsx   # Panel de encuentros en vivo con alertas
│   │   ├── ValueScanner.tsx  # Escáner de oportunidades de valor (+EV)
│   │   ├── NbaDashboard.tsx  # Tablero y proyecciones de baloncesto NBA
│   │   ├── AdminPanel.tsx    # Panel de administración de licencias
│   │   └── ...               # Modales de autenticación, calculadoras y filtros
│   ├── context/              # Proveedores de estado global (deporte activo, cuotas)
│   ├── hooks/                # Hooks personalizados de sonido, PWA y red
│   ├── services/             # Lógica matemática (Poisson, Dixon-Coles, APIs, Supabase)
│   ├── types.ts              # Definiciones de tipos TypeScript globales
│   ├── App.tsx               # Orquestador principal y layout
│   ├── index.css             # Estilos globales y tokens Cyber-Fintech Dark
│   └── main.tsx              # Punto de entrada React
├── server.ts                 # Servidor Express, proxies seguros a APIs y lógica de licencias
├── vercel.json               # Configuración de compilación y rutas serverless en Vercel
├── vite.config.ts            # Configuración de Vite, plugins y empaquetado PWA
├── package.json              # Scripts y dependencias del proyecto
└── .env.example              # Guía de variables de entorno requeridas
```

---

## ⚙️ Variables de Entorno

Para ejecutar el proyecto tanto en desarrollo local como en producción (Vercel), se deben configurar las siguientes variables:

| Variable | Requerida | Propósito |
| :--- | :---: | :--- |
| `API_FOOTBALL_KEY` | **Sí** | Llave de API-Sports para calendario, estadísticas en vivo, H2H y clasificaciones. |
| `ODDS_API_KEY` | **Sí** | Llave de The Odds API para cuotas de mercado y marcadores en tiempo real. |
| `FOOTBALL_DATA_KEY` | **Sí** | Llave de Football-Data.org para cobertura y respaldo de ligas europeas. |
| `SUPABASE_URL` | **Sí** | URL del proyecto Supabase para base de datos y sincronización de caché. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí** | Llave de servicio (Service Role) para operaciones seguras de servidor. |
| `ADMIN_PIN` | **Sí** | PIN numérico maestro para acceder al Panel de Administración. |
| `ADMIN_WHATSAPP` | **Sí** | Número telefónico internacional para soporte o solicitud de licencias. |
| `JWT_SECRET` | *Opcional* | Clave secreta personalizada para firma de sesiones de administración. |
| `ADMIN_MASTER_KEY` | *Opcional* | Código maestro de emergencia para desbloqueo de acceso administrativo. |

---

## 💻 Instalación y Desarrollo Local

### Prerrequisitos
* **Node.js** (versión 18 o superior recomendada)
* **npm** (versión 9 o superior)

### Pasos de Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/sportstats-pro.git
   cd sportstats-pro
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar el entorno:**
   Copia el archivo de ejemplo y añade tus credenciales:
   ```bash
   cp .env.example .env
   ```

4. **Iniciar el entorno de desarrollo:**
   ```bash
   npm run dev
   ```
   El servidor unificado (Express + Vite con HMR) se ejecutará en:  
   `http://localhost:3000`

5. **Verificar tipado y linting:**
   ```bash
   npm run lint
   ```

---

## ☁️ Despliegue en Producción (Vercel)

El proyecto está optimizado con una arquitectura de compilación dual lista para Vercel:

1. **Subir los cambios a GitHub:**
   Asegúrate de que tu repositorio contenga la última versión del código fuente.
2. **Importar el proyecto en Vercel:**
   * Entra a [vercel.com](https://vercel.com/) y haz clic en **Add New Project**.
   * Selecciona tu repositorio de GitHub e impórtalo.
   * **Framework Preset**: Deja la opción por defecto (*Vite*).
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
3. **Cargar las Variables de Entorno:**
   * En la sección **Environment Variables** del proyecto en Vercel, agrega las variables listadas en la sección [Variables de Entorno](#-variables-de-entorno).
4. **Desplegar:**
   * Haz clic en **Deploy**.
   * El script de compilación generará automáticamente tanto el frontend optimizado (`dist/`) como la función serverless empaquetada (`api/index.js`), garantizando que todas las rutas bajo `/api/*` operen sin interrupciones.

---

## 📄 Descargo de Responsabilidad y Uso Ético

SportStats Pro es una herramienta tecnológica destinada exclusivamente al **análisis cuantitativo, educación estadística y consulta informativa deportiva**. Todas las probabilidades, estimaciones de goles esperados y cálculos de valor representan modelos matemáticos basados en datos históricos y no garantizan resultados futuros. Promovemos el análisis responsable de datos y una gestión consciente del capital.
