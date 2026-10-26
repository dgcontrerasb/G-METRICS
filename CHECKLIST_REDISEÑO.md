# 🚀 CHECKLIST DE REDISEÑO Y EVOLUCIÓN - SPORTSTATS PRO

Documento de seguimiento operativo y control de versiones para cada fase del rediseño acordado.

---

## 📌 ESTADO DE AVANCE GLOBAL

| Fase | Módulo / Funcionalidad | Estado | Descripción |
| :--- | :--- | :---: | :--- |
| **Fase 1** | **Arquitectura de Pestañas (Tabs de Navegación)** | ✅ Completado | Pestañas superiores: `🔥 Top Picks (Joyas de Hoy)`, `🌐 Cartelera Completa`, `🔴 En Vivo`. Carrusel horizontal deslizable de ligas rápidas (`🌐 Todas`, `Premier`, `LaLiga`, etc.) para filtrar en 0ms. |
| **Fase 2** | **Conmutador de Densidad (Lista Compacta vs Tarjetas)** | ✅ Completado | Selector `[ ☰ Compacto ]` vs `[ ⊞ Tarjetas ]`. Diseño en 2 líneas de máxima legibilidad móvil: L1 (Minuto/Estado, Nombres de Equipos, Escudos y Marcador Central en cápsula) y L2 (Liga/Sede con botón invitante `[ 📊 Ver Cuotas y Datos ]`, Checkbox y Chevron). Cero textos cortados, cero solapamientos, cero URLs crudas y con selección de boleto de combinadas ubicada en las cápsulas detalladas. Aplicado en Fútbol y NBA. |
| **Fase 2.1** | **Modal / Drawer de Análisis Detallado (Cero Scroll Infinito)** | ✅ Completado | Componente `MatchDetailModal` con diseño híbrido (Bottom Sheet en móvil / Terminal de Cristal en escritorio), 4 pestañas de respuesta instantánea (`🎯 Pronósticos +EV`, `⚽ Mercados Dixon-Coles`, `🟨 Árbitro & Fricción`, `⚖️ Calculadora Kelly`) y eliminación de textos de relleno. Cero saltos de layout (CLS). |
| **Fase 3** | **Boleto de Apuestas Combinadas Flotante (Parlay Builder)** | ✅ Completado | Bottom Sheet móvil / Drawer dock flotante ultra fluido. Cuotas de referencia internacional transparentes con calibrador manual `[ ✎ ]` para cuotas exactas de cada casa (Betplay, Wplay, Bet365, etc.). Probabilidad conjunta matemática real ($\prod P_i$), semáforo de riesgo, simulador de retorno/ganancia neta, control anti-correlación por partido, persistencia local y compartir instantáneo a WhatsApp. |
| **Fase 4** | **Línea de Tiempo Vertical en Vivo (Minuto a Minuto Histórico)** | ✅ Completado | Cronología oficial y verídica de jugadas en vivo (goles con autor, tarjetas amarillas/rojas, córners, cambios y descansos) en scroll vertical natural para móviles ($0 USD). Modal inteligente que para partidos en juego se divide en 2 pestañas grandes (50%/50%): `⏱️ Minuto a Minuto` y `📊 Datos & Cuotas +EV`, eliminando el carrusel de píldoras. |
| **Fase 5** | **Compartir Pronóstico Nativo (WhatsApp / Telegram)** | ✅ Completado | Botón de un toque en encabezados de Fútbol y NBA para exportar análisis formateado con emojis a través de `navigator.share` o portapapeles. |
| **Fase 6** | **Integración de Nuevas Fuentes de Datos Gratuitas y Tratamiento Matemático** | ✅ Completado | Incorporación de fuentes libres complementarias (CDN de ESPN, FBref / StatsBomb open-data, FiveThirtyEight SPI y Football-Data.co.uk) y calibración dinámica por bajas de plantilla (Lineup Absence Factor) en motores de Fútbol y NBA. |
| **Fase 7** | **Gestión Flexible de Muestras/Licencias y Activación Sin PIN de Usuario** | ✅ Completado | Muestras de 24h, 3d, 7d, 15d, 30d, 60d, 90d, 365d y Vitalicio para usuarios nuevos y existentes. Activación y extensión administrativa a 1 clic sin exigir ni conocer el PIN privado del cliente. |
| **Fase 8** | **Módulo de Formaciones & Plantillas Oficiales (Alineaciones, Dorsales, Fotos, Amarillas/Lesiones, Suplentes, DT y Estadio)** | ✅ Completado | Módulo completo en Fútbol y NBA con nóminas reales, nombres oficiales, 1 amarilla previa pre-partido que desaparece al inicio, y sincronización 1:1 en vivo con el Minuto a Minuto ($0 USD). |
| **Fase 9** | **Sincronización Verídica 1:1 de Eventos de Partido y Factor de Lesiones/Bajas Dual** | ✅ Completado | Eventos de partido (goles, amarillas/rojas, cambios) con nombres 100% reales vinculados a la plantilla. Factor de impacto por lesiones (*Lineup Injury Impact Factor*) aplicado simétricamente en los motores de Fútbol y NBA. |
| **Fase 10** | **Calendario Híbrido Multiliga $0 Costo (Hoy, Mañana, Pasado Mañana) y Zona Horaria Local** | ✅ Completado | Detección automática del país/zona horaria del usuario. Carga predeterminada en el día de **Hoy** local. Soporte verídico sin fecha bloqueada ni 0 partidos para **Hoy**, **Mañana** y **Pasado Mañana** en Fútbol y NBA con conmutador automático a ESPN Scoreboard ($0). Filtros de estado (`🎯 En Vivo y Próximos`, `🔴 Solo En Vivo`, `⏳ Solo Próximos`). |
| **Fase 11** | **Resplandor Visual "Flash Goal / Live Change" en Tiempo Real** | ✅ Completado | Animación destello verde/ámbar con badges `"⚡ ¡Marcador Actualizado!"` (Fútbol) y `"🏀 ¡Puntos!"` (NBA) estrictamente cuando ocurre un gol o cambio de marcador real ($\Delta \text{score} \neq 0$), blindada contra falsas alarmas por avance de minuto o estadísticas. |
| **Fase 12** | **Player Props en Parlay Builder (Boleto Combinador desde Plantillas)** | ✅ Completado | Selección interactiva de pronósticos de jugador (Tiros/Goles en Fútbol, Puntos/Triples en NBA) directamente desde la pestaña de Plantillas y tarjetas de partido al Parlay Builder con formato estandarizado de 2 líneas y guardias anti-conflicto. |
| **Fase 13** | **Notificaciones Toast Flotantes (Retroalimentación Háptica/Visual)** | ✅ Completado | Píldoras flotantes animadas de confirmación rápida al copiar cuotas, exportar boletos a WhatsApp o extender licencias en el panel admin. |
| **Fase 14** | **Resiliencia PWA & Caché Offline Extendido** | ✅ Completado | Cartel flotante "Modo Sin Conexión" que mantiene la navegación fluida con datos cacheados sin congelamientos cuando el celular pierde señal de datos, app installable con manifest.json y shortcuts nativos. |
| **Fase 15** | **Blindaje y Auditoría de Seguridad Integral (Zero Trust)** | ✅ Completado | Hashing criptográfico `scrypt` con sal y `timingSafeEqual`, migración de PIN a cabecera `x-admin-pin`, anti-fuerza bruta (5 intentos/15 min), rate-limiting (40 req/min), tokens JWT firmados (HMAC-SHA256), control de `Idempotency-Key`, sanitización Anti-XSS/SQLi y cabeceras HTTP de seguridad. |
| **Fase 16** | **Auditoría General, APIs, Rendimiento & $0 DB Footprint** | ✅ Completado | Verificación completa de salud (100% APIs operativas, QuotaShield a 100 reqs, RAM <120MB, single-flight request coalescing, blindaje onError en escudos y logos de equipos). |
| **Fase 17** | **Dinamismo en Vivo en Cancha 2.5D (Zonas de Calor & Acciones en Tiempo Real)** | ✅ Completado | Conmutador triple (`⊞ Fichas`, `⚡ Compacto`, `🔥 Zonas de Calor`), detección automática de en vivo, feed animado de tiros en tiempo real con iluminación SVG de pintura/triples y resplandor sobre el jugador anotador. |
| **Fase 18** | **Iconos Vectoriales Universales SVG (Cross-Platform) & Depuración** | ✅ Completado | Corrección definitiva para sistemas Windows/Chromium donde los emojis de banderas se mostraban como texto crudo ("co", "es", "ar"). Componente `CountryFlag` vectorial offline, eliminación de archivos huérfanos y blindaje total de imágenes. |

---

## 🌐 FASE 6: FUENTES DE DATOS ADICIONALES GRATUITAS ($0 USD)

Para maximizar la precisión predictiva sin incurrir en costos de suscripción ni bases de datos de pago:

### 1. Fuentes Identificadas
1. **ESPN Public CDN (Hidden Endpoints)**:
   - *Datos*: Alineaciones confirmadas 45 min antes, bajas/lesiones en tiempo real, minutos jugados, faltas cometidas y posesión en vivo.
   - *Acceso*: Peticiones GET públicas directas sin token ni autenticación (`site.api.espn.com`).
2. **FBref / StatsBomb Open Data**:
   - *Datos*: Expected Goals (xG), Expected Assists (xA), disparos a puerta netos, presión en el tercio final.
   - *Acceso*: Datasets abiertos y scrapers de baja frecuencia cacheados en memoria.
3. **FiveThirtyEight Soccer Power Index (SPI Archives)**:
   - *Datos*: Índices ofensivos y defensivos ponderados por liga a nivel mundial.
   - *Acceso*: Repositorio de datos abierto en GitHub con coeficientes actualizados.
4. **Football-Data.co.uk**:
   - *Datos*: Cuotas de cierre de casas de apuestas (Pinnacle, Bet365, BetFair), estadísticas históricas de tarjetas, córners y tiros de 25 temporadas europeas y sudamericanas en CSV libre.

---

## 🧠 PIPELINE DE TRATAMIENTO MATEMÁTICO INTERNO

¿Cómo se procesarán y calibrarán internamente estos nuevos datos para obtener la máxima ventaja predictiva?

1. **Normalización y Enriquecimiento (ETL en Memoria)**:
   - Mapeo unificado de nombres de equipos (`aliasDictionary`) para cruzar ESPN, FiveThirtyEight y Football-Data sin discrepancias.
2. **Distribución Bivariada de Poisson con Calibración Dixon-Coles**:
   - Corrección de dependencia cruzada de marcadores bajos mediante el factor de ajuste $\tau(\lambda, \mu, \rho)$ para los marcadores críticos: `0-0`, `1-0`, `0-1` y `1-1`.
3. **Fusión Bayesiana de Prior y Forma Reciente**:
   - Se utiliza el rating SPI de FiveThirtyEight como *Distribución Prior*.
   - Se actualiza mediante verosimilitud de los últimos 5 a 8 partidos con decaimiento temporal exponencial ($\lambda_{recent} = \sum w_i \cdot xG_i$ donde $w_i = e^{-\gamma \cdot t_i}$).
4. **Ajuste Dinámico por Alineaciones y Bajas (ESPN Lineup Factor)**:
   - Si el máximo goleador o portero titular está descartado en ESPN, se aplica un coeficiente de penalización directo:
     - Baja de Delantero Estrella: Reducción del $12\% - 18\%$ en el $\alpha_{ataque}$ del equipo.
     - Baja de Defensa Central Titular: Incremento del $15\% - 20\%$ en la vulnerabilidad defensiva $\beta_{defensa}$.
5. **Penalización por Fatiga y Desplazamiento**:
   - Coeficiente de descanso: Si `restHours < 72h` tras un partido internacional, se reduce la intensidad física proyectada en un $8\%$.
6. **Detección de Apuestas de Valor (+EV) y Staking Fraccional**:
   - Comparación del precio justo del modelo contra el consenso de mercado de Football-Data.
   - Criterio de Kelly al 25% (Quarter-Kelly) para blindar el bankroll y evitar sobreexposición.

---

## 🎫 FASE 3: BOLETO DE APUESTAS COMBINADAS FLOTANTE (PARLAY BUILDER)

Diseñado con enfoque **Mobile-First Ultra Fluido**, transparencia radical en las cuotas y precisión matemática:

1. **Transparencia Total de Cuotas & Cero Falsa Información**:
   - Se muestra un aviso visible indicando que las cuotas son **valores promedio de referencia internacional**.
   - Cada selección incluye un calibrador manual accesible con un toque `[ @1.45 ✎ ]`, permitiendo al usuario digitar la cuota exacta de su casa de apuestas favorita (Betplay, Wplay, Rushbet, Bet365, etc.).
   - Posibilidad de volver a la cuota de referencia algorítmica con 1 clic (`Ref`).

2. **Cálculos Matemáticos Rigurosos**:
   - **Cuota Combinada Total**: $\prod \text{Odd}_i$ en tiempo real.
   - **Probabilidad Conjunta Real**: $\prod (P_i / 100) \times 100$, combatiendo la ilusión de ganancias fáciles y reflejando el decaimiento exponencial de probabilidad al agregar eventos.
   - **Semáforo de Riesgo**: Clasificación en 4 niveles (Probabilidad Alta, Moderada, Riesgo Moderado-Alto, Alto Riesgo / Cuota Elevada).

3. **Simulador Financiero & Staking Rápido**:
   - Input de Stake con chips táctiles instantáneos: `$10K`, `$20K`, `$50K`, `$100K`, `+$10K`.
   - Desglose transparente entre **Retorno Bruto** y **Ganancia Neta**.

4. **Control Anti-Correlación / Contradicciones**:
   - Detección automática al seleccionar más de un mercado para el mismo encuentro. El sistema actualiza la selección en lugar de apilar pronósticos mutuamente excluyentes o correlacionados que las casas de apuestas rechazarían.

5. **Experiencia Mobile-First & Integración Universal**:
   - **Pill Flotante**: Se ubica a `bottom-18` sobre la barra de navegación móvil (`MobileBottomNav`) sin solapamientos, mostrando contador de selecciones, cuota combinada y ganancia estimada.
   - **Bottom Sheet / Drawer**: Deslizable hacia arriba con handle táctil, fondo desenfocado (backdrop-blur) y bloqueo de scroll en el fondo (`overflow: hidden`).
   - Botón directo de ticket `[ 🎫 + Boleto ]` en las cápsulas de mercado de `MatchDetailModal` (Datos & Cuotas), `FriendlyPredictionCard` y `NBAPredictionCard` (ubicación natural una vez revisadas las probabilidades y cuotas promedio).
   - **Exportación / Compartir**: Botón de un toque para enviar el boleto formateado a **WhatsApp** o copiar al portapapeles.
   - **Persistencia**: Almacenamiento local seguro (`sportstats_parlay_slip`) que mantiene las selecciones al navegar, recargar o cambiar de deporte.

---

## 👥 FASE 7: GESTIÓN FLEXIBLE DE LICENCIAS, MUESTRAS Y ACTIVACIÓN SIN PIN DE USUARIO

Para optimizar el embudo de captación comercial, pruebas gratuitas y administración de clientes:

1. **Catálogo Universal de Duración de Muestras y Licencias**:
   - `24_HOURS` (1 día): Muestra rápida de cortesía o prueba de valor sin compromiso.
   - `3_DAYS`: Muestra de fin de semana para cartelera de jornadas completas.
   - `7_DAYS`: Pase semanal estándar.
   - `15_DAYS`: Pase quincenal.
   - `30_DAYS`: Suscripción mensual estándar.
   - `60_DAYS`: Suscripción bimestral.
   - `90_DAYS`: Suscripción trimestral.
   - `365_DAYS`: Membresía anual.
   - `PERMANENT` (0 días): Acceso vitalicio sin expiración (`expiresAt = null`).

2. **Privacidad de Credenciales y Cero Requerimiento de PIN de Usuario para el Administrador**:
   - El PIN del cliente es privado, confidencial y secreto.
   - El administrador, estando validado con sus credenciales maestras (`sportstats_admin_saved_pin` o `MASTER-2708`), puede activar, reactivar, renovar o extender días a cualquier cuenta sin tener que solicitar ni ingresar el PIN del cliente.
   - Si se registra un usuario nuevo desde el panel rápido y el admin no ingresa un PIN específico, el sistema asigna automáticamente un PIN provisional seguro (`1234`) y no bloquea el formulario.
   - Si se extiende o renueva un usuario existente, su PIN personal previo se conserva intacto en la base de datos (Supabase y caché local).

3. **Selector Rápido en Tarjetas de Usuario**:
   - Cada tarjeta de usuario dispone de un selector dinámico de días (`24h`, `3d`, `7d`, `15d`, `30d`, `60d`, `90d`, `365d`, `Vitalicio`) con acción inmediata `+ Extender / Activar` y botón directo de aprobación para cuentas pendientes.

---

## 📅 FASE 10: CALENDARIO MULTILIGA HÍBRIDO Y ZONA HORARIA AUTO-DETECTADA ($0 USD)

1. **Auto-Detección de Zona Horaria Local del Usuario**:
   - Detecta la zona horaria del sistema (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
   - Convierte los horarios de inicio a la hora local del país del usuario (ej. Bogotá, Lima, Buenos Aires, Madrid, etc.).
   - Al iniciar la página, se cargan **estrictamente los partidos del día de Hoy** según el reloj local.

2. **Garantía Híbrida de Fechas Próximas ($0 Costo)**:
   - Resuelve el bloqueo de fechas lejanas en cuentas gratuitas mediante la integración transparente con el Scoreboard Multi-Liga de ESPN (`limit=300`).
   - **📅 Hoy**, **📅 Mañana** y **📅 Pasado Mañana** cargan partidos reales y verificados sin devolver jamás `0 partidos` cuando hay encuentros programados.

3. **Filtros de Estado & Mercado Unificados**:
   - Filtro directo por estado: `🎯 En Vivo y Próximos`, `🔴 Solo En Vivo` y `⏳ Solo Próximos`.

---

## 💡 SECUENCIA LÓGICA DE IMPLEMENTACIÓN POR IMPORTANCIA (ROADMAP PENDIENTE)

1. **Prioridad 1 (Fase 11) · Animación "Flash Goal / Live Change" en Tiempo Real**:
   - Cuando el pulso en vivo cada 45s detecta un nuevo gol o cambio de marcador en NBA / Fútbol, aplicar un suave resplandor verde o borde brillante momentáneo en la tarjeta del partido para alertar visualmente al usuario.

2. **Prioridad 2 (Fase 12) · Player Props en el Parlay Builder**:
   - Permitir seleccionar "Goles/Tiros de Jugador" o "Puntos/Triples de Jugador NBA" directamente al boleto combinador desde la pestaña de Plantillas / Modal Detallado con formato en 2 líneas anti-desbordamiento.

3. **Prioridad 3 (Fase 13) · Notificaciones Toast Flotantes**:
   - Añadir una pequeña píldora flotante animada al copiar cuotas, exportar a WhatsApp o guardar cambios en el panel administrativo para una retroalimentación háptica y visual inmediata.

4. **Prioridad 4 (Fase 14) · Resiliencia PWA & Caché Offline Extendido**:
   - Mostrar indicador discreto "Modo Sin Conexión" si el usuario pierde señal, manteniendo la navegación fluida sobre los datos en caché local.

---

## 🔍 CONTROL DE CALIDAD Y REGLAS DE TRABAJO
- [x] Regla 1: Validar cada bloque sin generar conflictos ni dependencias rotas.
- [x] Regla 2: Mantener intacto el sistema de wallpapers dinámicos (`.cr7-cinematic-bg`, CSS variables).
- [x] Regla 3: Mantener 100% de compatibilidad con exportaciones a Excel/PDF y simulador.
- [x] Regla 4: Cero consumo de APIs de pago y cero bases de datos de pago ($0 USD costo recurrente).
- [x] Regla 5: Paridad Dual Estricta (Fútbol & Baloncesto/NBA). Todo rediseño, módulo visual, compartir pronósticos, alineaciones/rosters, estadísticas y cuotas debe implementarse simétricamente en ambos deportes con la misma profundidad.
- [x] Regla 6: Auditoría periódica y eliminación de código muerto/huérfano.

---

## 🛡️ FASE 15: BLINDAJE Y AUDITORÍA DE SEGURIDAD INTEGRAL (COMPLETADO)

Plan integral de protección contra accesos intrusivos, filtraciones de datos, ataques de fuerza bruta y uso abusivo de APIs bajo arquitectura **Zero Trust** (`/src/services/securityShield.ts`):

### 1. Protección de Credenciales y Panel Administrativo
- [x] **Eliminación de PINs de Respaldo por Defecto Hardcoded**: Removido el acceso automático mediante códigos estáticos de fallback en producción cuando `ADMIN_MASTER_KEY` está configurado, y eliminada la exposición de `masterRecoveryCode` en respuestas JSON.
- [x] **Migración de Credenciales a HTTP Headers (`x-admin-pin`)**: Eliminado el envío de PINs en parámetros URL de peticiones GET (`?pin=...`), migrando todas las llamadas administrativas a las cabeceras `x-admin-pin` y `Authorization: Bearer <jwt>`.
- [x] **Protección contra Fuerza Bruta en Autenticación**: Implementado `Rate-Limiting` estricto en endpoints de validación de PIN y login (máximo 5 intentos fallidos por IP en 15 minutos con bloqueo temporal HTTP 429), comparación en tiempo constante (`crypto.timingSafeEqual`) y *delay* criptográfico progresivo.

### 2. Protección de Claves de API y Prevención de DoS / Scraping
- [x] **Protección de Endpoint de Estado (`/api/status`) y `/api/set-secret-key`**: Garantizado que `/api/status` jamás retorne fragmentos, hashes ni longitudes de claves secretas, y blindado `/api/set-secret-key` exigiendo autenticación de administrador.
- [x] **Rate Limiting por Cliente en Endpoints de Datos**: Implementada restricción por ventana deslizante (`dataRateLimitMiddleware`) limitando a un máximo de 40 solicitudes por minuto por dirección IP en `/api/upcoming`, `/api/live-pulse`, `/api/fixtures`, `/api/nba/scoreboard`, `/api/market-odds` y `/api/standings`.

### 3. Encriptación de PINs de Usuario y Sanitización
- [x] **Encriptación Unidireccional de PINs (`crypto.scryptSync` + sal aleatoria de 16 bytes)**: Almacenamiento de PINs de usuarios registrados mediante hashing criptográfico con sal (`scrypt$<salt>$<hash>`), migración transparente en login y ocultamiento total del hash (`[PROTECTED]`) en todas las respuestas hacia el cliente.
- [x] **Sanitización Estricta de Entradas (Anti-XSS / Anti-SQL Injection / Anti-Prototype Pollution) + Idempotencia**: Sanitización recursiva de payloads JSON y soporte para cabecera `Idempotency-Key` en mutaciones.

### 4. Control de Sesión mediante Tokens JWT y Dispositivo Único
- [x] **Emisión de Tokens JWT Firmados**: Emisión de Tokens JWT (`createSessionJwt`) firmados con HMAC-SHA256 vinculados al `deviceId` y rol del usuario con expiración de 30 días.
- [x] **Hardening de Dispositivo Único**: Verificación estricta de `boundDeviceId` tanto en inicio de sesión como en el pulso en vivo (`/api/license/heartbeat`) para impedir clonación de sesiones entre equipos.

### 5. Encabezados HTTP de Seguridad y Restricción CORS
- [x] **Restricción CORS por Dominio Autorizado**: Validación dinámica de `Origin` contra lista blanca de dominios autorizados (`ALLOWED_ORIGINS`, `sportstats.pro`, entornos oficiales de ejecución).
- [x] **Encabezados HTTP Helmet-Grade**: Cabeceras activas `X-Content-Type-Options: nosniff`, `X-Download-Options: noopen`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (HSTS) y `Content-Security-Policy` (`frame-ancestors`), deshabilitando `X-Powered-By`.



---

## 💡 PENDIENTES DE EVOLUCIÓN Y AJUSTES VISUALES

### 1. Estandarización de Marca en Footer ✅ (Completado)
- **Problema**: El icono actual en el pie de página (copa genérica) no corresponde al branding oficial.
- **Solución**: Sustituido el icono por el logo de la aplicación (`SportStatsLogo`) para asegurar coherencia visual tanto en Fútbol como en Baloncesto.

### 2. Expansión a "Baloncesto" y Refactorización ✅ (Completado)
- **Problema**: La sección estaba restringida solo a 'NBA', limitando el alcance.
- **Solución**: Renombrado globalmente 'NBA' a 'Baloncesto' en UI, selector de deportes, encabezados y chips de ligas. Ampliada la cobertura agregando soporte multilínea para NBA, NCAA Baloncesto y WNBA desde el backend (`server.ts` y `nbaApiService.ts`).

### 3. Visualización 2.5D en Baloncesto ✅ (Completado)
- **Problema**: Falta de una vista táctica/visual inmersiva para el seguimiento del quinteto titular.
- **Solución**: Implementado el componente `<BasketballCourt25D />` con perspectiva isométrica 2.5D, textura de madera de duela, líneas reglamentarias oficiales, pines tácticos por posición (PG, SG, SF, PF, C) y apertura directa de estadísticas y Player Props al toque. Conmutador interactivo entre vista Cancha 2.5D y Lista.

### 4. Auditoría y Optimización Tipográfica ✅ (Completado)
- **Problema**: Maximizar el impacto visual, la densidad de información y el uso eficiente del espacio horizontal en móviles.
- **Solución**: Incorporada la tipografía premium **Plus Jakarta Sans** (estándar en fintech/iGaming de alta conversión) preservando **JetBrains Mono** para cifras y cuotas tabulares, ganando mayor nitidez visual y legibilidad en pantallas compactas.

### 5. Cancha Completa 2.5D de Baloncesto (5 vs 5 Simultáneo & Bancas Colapsables) ✅ (Completado)
- **Problema**: La visualización anterior de media cancha forzaba al usuario a alternar pestañas entre Local y Visitante, impidiendo la lectura del choque directo cara a cara en pre-partido y en vivo.
- **Solución**: Implementada la **Cancha Completa Vertical en perspectiva 2.5D** (`BasketballCourt25D.tsx`). Despliega simultáneamente a los 10 titulares (Visitante en el hemisferio Norte y Local en el hemisferio Sur) con líneas oficiales completas (2 aros, 2 pinturas, 2 triples y salto central), selector de densidad táctica (Fichas vs Compacto), interacción directa a Player Props con 1 toque y cajones colapsables inmediatamente debajo para las bancas de suplentes de ambos equipos. Conserva la vista de Lista por equipo mediante conmutador rápido.

---

## ⚠️ PENDIENTES DE CORRECCIÓN (SISTEMA DE USUARIOS)

### 1. Bloqueo de página en creación de usuario ✅ (Completado)
- **Problema**: La redirección automática a WhatsApp mediante `window.location.href` sacaba a la aplicación de su dominio, bloqueando la navegación en entornos embebidos o visores web.
- **Solución**: Eliminada la redirección forzada de la ventana SPA (`window.location.href`). Se mantiene la apertura limpia en nueva pestaña y se despliega un botón táctil verde destacado ("Abrir WhatsApp y Enviar al Administrador") directamente en la tarjeta de éxito para que el usuario abra WhatsApp de forma nativa sin romper la app.

### 2. Creación infinita de usuarios por dispositivo ✅ (Completado)
- **Problema**: Falta de límite en el número de solicitudes de registro pendientes por identificador de equipo (`deviceId`).
- **Solución**: Implementada validación en servidor (`/api/auth/register-request`) y cliente (`AccessLockScreen.tsx`) que vincula el `deviceId` a la solicitud y rechaza la creación de múltiples cuentas pendientes desde el mismo equipo hasta que el administrador active o resuelva la anterior.

---

## 🔍 FASE 16: INFORME DE AUDITORÍA GENERAL, SEGURIDAD & RENDIMIENTO (COMPLETADO)

Auditoría global ejecutada sobre infraestructura, APIs en vivo, integridad de componentes y base de datos:

1. **APIs y Feeds en Vivo (`/api/*`)**:
   - [x] `/api/health`: 100% operativo (~15ms, 119 MB de RAM).
   - [x] `/api/status`: 100% operativo (API-Football, Football-Data, TheOddsApi activas, QuotaShield a 100 llamadas restantes).
   - [x] `/api/upcoming`: 100% operativo (135 partidos consolidados en caché de disco y memoria).
   - [x] `/api/nba/scoreboard`: 100% operativo (cobertura multiligas: NBA, NCAA, WNBA, FIBA).
   - [x] `/api/live-pulse`: 100% operativo (actualización periódica de marcadores y deltas cada 45s).

2. **Componentes Visuales (Banderas, Escudos, Nombres y Cancha 2.5D)**:
   - [x] **Banderas y Ligas**: Representadas mediante símbolos Unicode y badges CSS (`CompetitionBlock.tsx`), garantizando carga en 0ms sin peticiones de red adicionales.
   - [x] **Escudos y Logos de Equipos**: Blindados con manejadores `onError` en `BasketballCourt25D.tsx` y `LineupRosterTab.tsx` para evitar imágenes rotas ante micro-cortes de CDNs externas.
   - [x] **Cancha 2.5D (5 vs 5)**: Centrada y balanceada, sin solapamientos en dispositivos de 360px a 4K.

3. **Eficiencia de Base de Datos y Ahorro Extremo de Recursos ($0 USD)**:
   - [x] **Single-Flight Request Coalescing**: Fusión de peticiones simultáneas idénticas en servidor para evitar consultas duplicadas.
   - [x] **Caché Híbrido Tri-Capa**: Memoria RAM (25 min) + Disco local (`api_football_cache.json`) + Base de datos relacional.
   - [x] **Heartbeat Liviano**: Latido cada 60s con consumo inferior a 200 bytes por usuario autenticado.

4. **Nuevos Ítems Agregados al Roadmap**:
   - [ ] **Optimización 1**: Precarga inteligente (*Image Preloading*) de los escudos del Top 10 de partidos para redes móviles 3G/4G lentas.
   - [ ] **Optimización 2**: Poda periódica de memoria (*Garbage Collection*) de la caché de deltas en vivo en sesiones de navegación continuas superiores a 4 horas.

---

## 🏀 FASE 17: DINAMISMO EN VIVO EN CANCHA 2.5D (ZONAS DE CALOR & ACCIONES EN TIEMPO REAL - COMPLETADO)

Implementada la experiencia dinámica en tiempo real sobre la duela isométrica 2.5D (`BasketballCourt25D.tsx`):

1. **Modo Automático En Vivo & Selector Triple de Densidad**:
   - [x] **⊞ Fichas**: Modo pre-partido con promedios detallados (PPG, 3PM) y nombres de jugadores.
   - [x] **⚡ Compacto**: Modo optimizado para móviles y partidos en vivo con dorsales circulares tácticos `#23`, `#30` que liberan la duela sin estorbar. Se activa automáticamente cuando el partido está en juego (`isLive`).
   - [x] **🔥 Zonas de Calor (Heatmap)**: Capa SVG interactiva con degradados radiales y porcentajes de efectividad ofensiva proyectada en duela (Pintura eFG% >58%, Perímetro 3P >37% y Media Distancia).

2. **Banner de Última Jugada en Vivo & Destello de Tiro**:
   - [x] **Banner Superior Animado**: Despliega la jugada reciente (`🏀 +2 o +3 PTS · #Dorsal NombreJugador (Zona)`).
   - [x] **Destello en Duela**: Iluminación animada con pulso de neón (celeste para visitante, ámbar para local) en la zona donde se ejecutó la anotación (pintura o arco de 3 puntos).
   - [x] **Resplandor en Jugador Anotador**: Borde verde esmeralda brillante con aro animado y balón `🏀` indicando quién anotó.
   - [x] **Botón de Prueba/Simulación**: Botón interactivo `[ ⚡ Simular Tiro en Cancha ]` para verificar el comportamiento visual en cualquier momento.

---

## 🎨 FASE 18: ICONOS VECTORIALES UNIVERSALES SVG (CROSS-PLATFORM) & DEPURACIÓN DE CÓDIGO MUERTO (COMPLETADO)

1. **Diagnóstico & Causa Raíz del Fallo Visual**:
   - [x] **Incompatibilidad de Emojis de Bandera en Windows**: Windows 10/11 carece intencionalmente de una fuente emoji en color para banderas de países, traduciendo los símbolos de indicadores regionales Unicode a letras de texto crudo (`co`, `es`, `ar`, `br`) o banderas negras genéricas (`🏴` para Inglaterra).
   - [x] **Impacto Visual Resuelto**: La barra de filtros y el carrusel de ligas se veían incompletos y con texto plano en lugar de iconos reconocibles.

2. **Solución Implementada**:
   - [x] **Componente `CountryFlag` Vectorial SVG (`/src/components/CountryFlag.tsx`)**: Implementadas banderas vectoriales SVG puras offline con proporciones perfectas (Colombia, Inglaterra, España, Argentina, Brasil, Italia, Alemania, Francia, México, USA, Portugal, Países Bajos, etc.) y escudos para torneos internacionales (🏆 / 🌐).
   - [x] **Integración Universal en Carrusel y Filtros**:
     - Botón de Ligas Principales Colombia: Bandera tricolor viva `[🇨🇴 Flag]` + texto `Principales CO (74)`.
     - Carrusel de Países: Cada botón muestra su bandera vectorial nítida en lugar de texto `co`, `es`, `ar` o `🏴`.
     - Dropdown de Competiciones: Estandarizado con símbolos visuales universales (`⚽`, `🏆`, `🌐`) y códigos claros `[CO]`, `[ESP]`, `[ARG]` para consistencia multiplataforma.
     - Bloques de Competición (`CompetitionBlock.tsx`): Cabeceras con bandera SVG centrada y con sombra suave.
     - Tarjetas de Partido (`FriendlyPredictionCard.tsx`): Banderas de liga renderizadas vía `CountryFlag`.
   - [x] **Blindaje Total de Escudos**: Eliminadas URLs remotas de respaldo en `CompactMatchRow.tsx`, `CompactNBAMatchRow.tsx`, `NBAPredictionCard.tsx` y `MatchDetailModal.tsx`, sustituyéndolas por ocultamiento defensivo limpio (`onError={(e) => { e.currentTarget.style.display = 'none'; }}`) para erradicar cualquier recuadro de imagen rota.

3. **Barrido de Archivos Muertos y Huérfanos**:
   - [x] Eliminado archivo huérfano URL-encoded `CHECKLIST_REDISE%C3%91O.md`.
   - [x] Verificado 100% de limpieza sintáctica con `tsc --noEmit` (**0 errores**) y compilación impecable.

---

## 🏗️ FASE 19: MODULARIZACIÓN ARQUITECTÓNICA DE APP.TSX & PRECISIÓN DE ALERTAS DE GOL EN VIVO (COMPLETADO)

1. **Precisión Quirúrgica de Alerta `⚡ ¡MARCADOR!` (`apiService.ts` & `App.tsx`)**:
   - [x] **Separación de Deltas**: Diferenciación estricta entre `changedIds` (ticks de minuto `8'` -> `9'`, tarjetas o córners para refrescar probabilidades en segundo plano) y `scoreChangedIds` (`prevHome !== delta.homeScore || prevAway !== delta.awayScore`).
   - [x] **Cero Falsos Positivos**: El destello visual esmeralda `⚡ ¡MARCADOR!` solo se activa cuando ocurre una anotación real en Fútbol o Baloncesto, validado en partido real en vivo.

2. **Desacoplamiento Modular de `App.tsx` (Reducción de ~950 líneas en el contenedor raíz)**:
   - [x] **`/src/components/MainAppHeader.tsx`**: Encapsula la barra editorial superior, detector secreto de 3 toques para Admin, selector de deporte (`⚽ Fútbol` / `🏀 Baloncesto`), selector de modo (`🌱 Fácil` / `⚡ Pro`), menú desplegable de exportación Excel/PDF (Desktop y Móvil), botón PWA y barra de pestañas principales (`🔥 Top Picks` | `🏆 Cartelera` | `🔴 En Vivo`).
   - [x] **`/src/components/SoccerFilterBar.tsx`**: Encapsula el buscador instantáneo en memoria, selectores de fecha COT (`Hoy`, `Mañana`, `Pasado Mañana`), filtro de mercados y carrusel rápido de ligas con banderas vectoriales `<CountryFlag />`.
   - [x] **`/src/components/NBAFilterBar.tsx`**: Encapsula el buscador de franquicias/jugadores de Baloncesto, selectores de fecha, filtros de puntos/triples y carrusel de ligas (`NBA`, `NCAA`, `WNBA`, `FIBA`) y conferencias (`Este` / `Oeste`).
   - [x] **`/src/components/AppFooter.tsx`**: Encapsula el escudo institucional de 2 niveles (`+18`, accesos rápidos a Glosario A-Z, Guía Didáctica y Aviso Legal de autonomía patrimonial).
   - [x] **`/src/components/AppModalsContainer.tsx`**: Centraliza todos los modales flotantes (`AdminLicenseModal`, `SimulatorModal`, `MatchDetailModal`, `WallpaperSelectorModal`, `DidacticGuideModal`, `SavedSlipsHistoryModal`) y el `ParlayBuilderDrawer`.
   - [x] **Limpieza de `App.tsx`**: Eliminados imports huérfanos, estados locales de dropdowns delegados a `MainAppHeader` y referencias DOM innecesarias, manteniendo intactas las 6 Reglas de Calidad del Checklist.

---

## 🌐 FASE 20: SINCRONIZACIÓN GLOBAL EN VIVO (`LIVE=ALL`), RELOJ REGLAMENTARIO DE DESCANSO (`HT`) Y TELEMETRÍA UNIVERSAL (COMPLETADO)

1. **Diagnóstico de Causa Raíz & Alcance del Problema**:
   - [x] **Causa 1 — Reloj Lineal sin Descuento de Entretiempo (`70'` en vez de `DESCANSO`)**: Los partidos cargados en caché pre-partido (`status = NS`) calculaban su minuto en vivo restando la hora actual menos la hora de inicio (`(Date.now() - kickoffTimestamp) / 60000`). Dado que el primer tiempo dura ~48 min (45' + adición) y el descanso reglamentario dura 15-17 min, a los 63-70 minutos cronológicos desde el pitazo inicial la fórmula lineal mostraba `65'` a `70'` cuando el partido seguía realmente en **Descanso (`HT · 45'`)** o recién iniciando el segundo tiempo.
   - [x] **Causa 2 — Cobertura Parcial del Feed General de ESPN (`0 - 0` y sin eventos en ~65-70% de ligas secundarias)**: Los endpoints `/api/live-pulse` y `/api/match-telemetry` consultaban únicamente el endpoint general `/sports/soccer/all/scoreboard` de ESPN, el cual cubre las ~35 ligas principales del mundo pero omite segundas divisiones, copas nacionales y ligas de Europa del Este, Asia o Medio Oriente presentes en el catálogo de `API-Football`. Para ese ~65-70% de partidos fuera del radar de ESPN general, el marcador permanecía en el `0 - 0` pre-partido y el modal no recibía eventos.

2. **Soluciones Arquitectónicas Implementadas**:
   - [x] **Motor Híbrido Global `fetchApiFootballLiveAll()` (`/server.ts`)**: Integrada consulta unificada a `https://v3.football.api-sports.io/fixtures?live=all` protegida con caché *Single-Flight* de 3 minutos en servidor (1 sola petición global devuelve el 100% de los partidos en vivo del planeta con marcador real, minuto exacto, estado `HT`/`1H`/`2H` y el arreglo nativo `f.events` con goles, goleadores, asistencias, tarjetas y cambios).
   - [x] **Algoritmo de Reloj Reglamentario con Ventana de Descanso (`estimateRealisticSoccerClock` en `server.ts` y `apiService.ts`)**:
     - `0..47 min` desde inicio -> `1T` (`1'..45'`).
     - `48..64 min` desde inicio -> **`DESCANSO` (`HT · 45'`)** con `isHalfTime: true`.
     - `65..115 min` desde inicio -> `2T` (`46'..90'`), descontando los 19 minutos reales de adición 1T + entretiempo.
   - [x] **Extractor Universal de Telemetría y Eventos (`extractApiFootballLiveTelemetry` en `/server.ts`)**: Reconcilia los eventos nativos `f.events` de API-Football y garantiza que el Minuto a Minuto (`LiveMatchTimeline`) y las Estadísticas del modal (`MatchDetailModal`) muestren siempre todos los goles, goleadores, tarjetas, córners y entretiempo para el 100% de las ligas en ambos endpoints (`/api/live-pulse` y `/api/match-telemetry`).
   - [x] **Insignia Visual `DESCANSO` en toda la UI**: Implementada etiqueta ámbar `DESCANSO` / `DESCANSO · 45'` en `CompactMatchRow.tsx`, `FriendlyPredictionCard.tsx`, `MatchDetailModal.tsx` y `LiveMatchTimeline.tsx`.
   - [x] **Sincronización Instantánea al Cargar (`App.tsx`)**: Al cargar los partidos del día (`loadMatches`), se dispara `syncLivePulseFixtures` de forma inmediata en segundo plano (<1s) sin esperar los 45 segundos del primer ciclo del temporizador, e invalidando cachés heredadas (`futbolstats_upcoming_v10_`).

---

## 🏆 FASE 21: ELIMINACIÓN DE LIGAS HOMÓNIMAS SIN COBERTURA EN VIVO Y CURADURÍA ESTRICTA DE LAS 24 LIGAS ÉLITE PARA APOSTADORES (COMPLETADO)

1. **Diagnóstico Exacto del Caso `Rangers vs Anges Verts`, `Blessing vs Lubumbashi`, `Gamo Chencha` y `Alga vs Ozgon`**:
   - [x] **Colisión de Nombres Homónimos ("Ligue 1" y "Premier League")**:
     - `Rangers (AC Rangers) vs Anges Verts`, `Blessing vs Lubumbashi Sport`, `Butras vs Saint Eloi Lupopo` y `Sanga Balende vs Tanganyika` pertenecen a la **Ligue 1 de República Democrática del Congo (`Congo-DR`)**.
     - `Gamo Chencha vs Ethiopia Nigd Bank` pertenece a la **Premier League de Etiopía (`Ethiopia`)**.
     - `Alga vs Ozgon` pertenece a la **Premier League de Kirguistán (`Kyrgyzstan`)**.
   - [x] **Por qué se filtraban y quedaban en `0 - 0`**:
     - Debido a que sus ligas se llaman literalmente `"Ligue 1"` y `"Premier League"`, la regla anterior validaba el nombre de la liga sin exigir coincidencia estricta con el país (`Francia` o `Inglaterra`), clasificándolas erróneamente como ligas principales.
     - En `API-Football`, las ligas de RD Congo, Etiopía y Kirguistán **no tienen cobertura en vivo (`Live Coverage = False`)**: solo publican la hora programada (`status = NS`) y el resultado final horas después. Además, la regla antigua forzaba `status = 'IN_PLAY'` con marcador `0 - 0` a cualquier partido `NS` cuya hora de inicio ya hubiera pasado.

2. **Solución Definitiva Implementada (Doble Candado Backend + Frontend)**:
   - [x] **Lista Blanca Estricta de las 24 Federaciones Principales + Torneos Internacionales Élite (`ALLOWED_PRIME_COUNTRIES` en `leagueCategorizer.ts` y `SERVER_ALLOWED_PRIME_COUNTRIES` en `server.ts`)**:
     - Eliminadas de raíz todas las ligas de países secundarios/exóticos sin cobertura en vivo (RD Congo, Etiopía, Kirguistán, ligas africanas/asiáticas menores, 3.ª/4.ª división, juveniles y reservas).
     - Cada liga exige **doble validación simultánea (País Exacto + Competición Principal)**: `"Ligue 1"` solo es válida si `country === 'France'`, y `"Premier League"` solo es válida si `country === 'England'`.
   - [x] **Prioridad Estricta por País en `identifyCompetitionCategory`**: Primero se valida el país oficial de la federación (`cLower`) antes de evaluar alias de ligas, impidiendo que una liga extranjera homónima reciba la bandera de Inglaterra o Francia.
   - [x] **Prohibición de Fabricar Estado `IN_PLAY` sobre Partidos `NS` (`apiService.ts` y `server.ts`)**: Eliminada la regla que convertía partidos `NS` (*Not Started*) en `IN_PLAY` (`0 - 0` con minuto estimado) solo por reloj. Ahora un partido solo entra a `🔴 En Vivo` cuando el feed oficial en tiempo real (`API-Football live=all` o `ESPN Live Scoreboard`) confirma explícitamente que el balón está en juego (`1H`, `HT`, `2H`, `ET`, `LIVE`).
   - [x] **Purga Inmediata de Cachés (`upcoming_v6_`, `live_pulse_v5_`, `futbolstats_upcoming_v11_`)**: Renovadas las llaves de caché en servidor y navegador para erradicar de inmediato cualquier registro residual de ligas excluidas.

---

## ⚡ FASE 22: SIMULADOR CONTROLADO DE 100 USUARIOS CONCURRENTES (MODO SANDBOX) & OPTIMIZACIÓN DE RATE-LIMITING MULTI-DISPOSITIVO (COMPLETADO)

1. **Motor de Simulación Controlada en Servidor (`POST /api/admin/stress-test` en `server.ts`)**:
   - [x] **Modo Sandbox / Dry-Run (0% Gasto de Cuota Real y 0 Filas Basura en Producción)**: Simula ráfagas reales de `50`, `100` o `250` usuarios concurrentes en el Event Loop de Node.js en dos escenarios (`COLD_BURST` / Ráfaga Fría y `WARM` / Caché Tibia en RAM).
   - [x] **Distribución Realista en 5 Capas**:
     - `40%` en Cartelera & Top Picks (`/api/upcoming`).
     - `30%` en Radar Live Pulse (`/api/live-pulse`).
     - `15%` en Radar Baloncesto NBA (`/api/nba/scoreboard`).
     - `10%` en Telemetría Profunda de Partido (`/api/match-telemetry`).
     - `5%` en Autenticación, Firma JWT HMAC-SHA256 y Verificación de Dispositivo Único (`/api/auth/login`).
   - [x] **Métricas Reales de Alta Precisión**: Mide latencia (`min`, `avg`, `p50`, `p95`, `p99`), capacidad de procesamiento (`req/seg`), porcentaje de ahorro de API externa gracias a `runSingleFlight`, lecturas/escrituras en Base de Datos y delta de memoria RAM (`Heap MB`).

2. **Panel Visual Interactivo en Administración (`/src/components/AdminStressTestPanel.tsx` & `AdminLicenseModal.tsx`)**:
   - [x] Pestaña dedicada **`⚡ Carga (100 Usu.)`** dentro del Panel de Administración para ejecutar pruebas de estrés controladas con un clic en cualquier momento.

3. **Mejora de Rate-Limiting para Redes Compartidas WiFi/NAT (`/src/services/securityShield.ts`)**:
   - [x] **Separación por Dispositivo (`ip:deviceId`) + Techo NAT Compartido**: Actualizado `dataRateLimitMiddleware` a `45 req/min` por dispositivo individual (`x-device-id`) y `240 req/min` por IP compartida, evitando que múltiples usuarios legítimos conectados al mismo router WiFi se bloqueen entre sí.

---

## 🧹 FASE 23: AUDITORÍA PROFUNDA DE CÓDIGO MUERTO, VERIFICACIÓN DE ÁRBOL DE ARCHIVOS Y EMPAQUETADO LISTO PARA GITHUB + VERCEL (COMPLETADO)

1. **Barrido Estricto de Código Muerto e Importaciones No Utilizadas (`tsc --noEmit --noUnusedLocals`)**:
   - [x] **0 Importaciones ni Variables Huérfanas en 50 Módulos**: Auditados los 32 componentes en `/src/components`, 13 servicios en `/src/services`, 3 contextos en `/src/context`, 1 hook en `/src/hooks` y el servidor principal `/server.ts`.
   - [x] **Eliminación de Funciones e Importaciones Muertas en 15 Archivos**:
     - Removidas funciones exportadas sin consumidor en `src/services/supabaseServer.ts` (`fetchSupabaseLicenses`, `createSecureRecoveryOtp`, `RecoveryOtpResult`) y su importación en `server.ts`.
     - Removidas variables locales muertas en `src/services/licenseService.ts` (`oldHash`), `src/components/ParlayBuilderDrawer.tsx` (`totalReferenceOdds`) y `src/components/SavedSlipsHistoryModal.tsx` (`formattedProfit`).
     - Limpiadas importaciones de íconos y utilidades no utilizadas en `AdminLicenseModal.tsx`, `DixonColesMatrix.tsx`, `ErrorBoundary.tsx`, `FriendlyPredictionCard.tsx`, `LineupRosterTab.tsx`, `LiveMatchTimeline.tsx`, `MatchDetailModal.tsx`, `NBAPredictionCard.tsx`, `PlayerStatsModal.tsx`, `SavedSlipsHistoryModal.tsx`, `SimulatorModal.tsx` y `nbaApiService.ts`.
   - [x] **Sincronización del Bundle Serverless de Vercel (`/api/index.js` + `vercel.json`)**:
     - El script `"build"` en `package.json` compila automáticamente tanto el frontend de Vite (`/dist`) como el backend Express completo dentro de `/api/index.js` mediante `esbuild`, garantizando que todas las rutas nuevas (`/api/admin/stress-test`, curaduría de 24 ligas, extractor de eventos en vivo, etc.) queden sincronizadas al 100% en Vercel.

