# 📘 STAYPRINT — Documentación Técnica de Arquitectura y Decisiones

**STAYPRINT** ("No te conocemos por tu perfil, sino por tu historia") es una plataforma analítica inteligente diseñada para Eurostars Hotel Company. Su objetivo es la segmentación de clientes empleando Topología de Datos (UMAP + HDBSCAN), proyecciones vectoriales inversas y modelos fundacionales (Groq Llama 3) para la explicabilidad de IA.

---

## 🏗️ 1. Arquitectura del Sistema

El proyecto sigue una arquitectura **monolítica ligera** donde un único motor de ejecución sirve tanto los cálculos pesados matemáticos de Backend como la interfaz dinámica del cliente.

- **Servidor:** [FastAPI](https://fastapi.tiangolo.com/) en Python.
  - *Justificación:* FastAPI proporciona rendimiento asíncrono excepcional, tipado estático con Pydantic y autoregeneración de modelos. Además, la clase `StaticFiles` permite hospedar todo el Frontend desde el mismo puerto `8000`, evitando la sobreingeniería de desplegar servidores node/webpack dedicados.
- **Frontend:** Vanilla JavaScript, HTML5 Semántico y CSS3 puro.
  - *Justificación:* Al eliminar frameworks pesados como React o Angular, se logra un rendimiento instantáneo (Zero-build deployment). Se emplearon técnicas de *Glassmorphism* (diseños translúcidos modernos) para un UX corporativo altamente profesional sin depender de librerías de componentes complejas.
- **Gráficos y Visualización Espacial:** [Plotly.js](https://plotly.com/javascript/).
  - *Justificación:* Las alternativas como D3.js requerían demasiada construcción a bajo nivel, y Chart.js se queda corto para espacios tridimensionales masivos. Plotly soporta WebGL y permite orbitar, hacer zoom e inspeccionar el `scatter3d` de los clústeres sin bloqueo del hilo principal.

---

## 🧬 2. Pipeline Analítico y Machine Learning

STAYPRINT abandona los paradigmas tradicionales rígidos para adentrarse en Machine Learning predictivo tridimensional.

### A. Preprocesado y Feature Engineering (Pandas / Scikit-Learn)
- Todos los datos numéricos (como *Leadtime*, *Stays*, *ADR*, rango de *EDAD*) y categóricos se preprocesan pasándose por transformaciones One-Hot o imputaciones.
- Se ha integrado el escalado y homogeneización de los rangos para evitar que variables como el *Gasto Económico* opaquen otros matices sutiles del viajero.

### B. Mapeo Vectorial Espacial (UMAP)
- **Decisión:** Sustitución radical de PCA o t-SNE por **UMAP** (Uniform Manifold Approximation and Projection).
- **Por qué:** UMAP preserva tanto la estructura global como local de los datos. PCA solo entiende linealidades gruesas, mientras UMAP colapsa el hiperespacio de N dimensiones en 3D entendiendo la vecindad curva de los viajeros que se comportan igual, sin forzar distorsiones matemáticas ruidosas.

### C. Agrupación y Descubrimiento Orgánico (HDBSCAN)
- **Decisión:** Sustitución del rudimentario K-Means por **HDBSCAN** (Hierarchical Density-Based Spatial Clustering of Applications with Noise).
- **Por qué:** K-Means asume erróneamente que todos los grupos de humanos son esferas estadísticas puras y fuerza a que los "outliers" (ruido) pertenezcan a un segmento u otro destrozando la métrica. HDBSCAN navega por el espacio en base a **Densidades**. Si encuentra un grupo apretado de "Mochileros Esporádicos", lo enraíza y nombra independientemente de la forma visual de la ameba, filtrando los "viajeros sin perfil claro" (-1).

### D. Profiler Determinista
- Una pasarela en Python recorre cada Cluster e identifica, puramente por estadística dura, los perfiles mayoritarios (Edad Moda, País de procedencia, ADR real, Predilección geográfica -Montaña, Playa-).

---

## 🎯 3. El Matchmaker — Proyección Inversa de Hoteles

El "Proyector Inverso" es el mayor elemento disruptivo de STAYPRINT.

**El Problema Clásico:** Cuando se abre un hotel, se envían emails a todos los clientes a ciegas.
**La Solución de STAYPRINT:**
- Un hotel del CSV y sus catastrofias geográficas (estrellas, destino, heritage) se transforma matricialmente para "inyectarlo" forzosamente al mismo espacio multidimensional de UMAP donde viven los humanos.
- A través de la técnica de intersección matemática o búsqueda del vecino tridimensional más cercano, sabemos sobre qué densidades de puntos recae el hotel. Es el hotel el que "cae en paracaídas" sobre la nube humana de viajeros identificando a qué Tribu impactará naturalmente.

---

## 🤖 4. Explicabilidad Generativa (Explainable AI - XAI)

Se ha integrado a **Groq (con el LLM Llama-3.3-70b-versatile)** a través de una API proxy compatible con el SDK puro de OpenAI.

- **Generador de Semántica (Módulo Naming):** En lugar de "Cluster #6", el LLM absorbe el CSV de estadísticas frías de ese segmento y computa analíticamente un string poético pero fiero, como "*Viajero Joven de Playa Low-Cost*". Esto se cruza con las restricciones anti-colisión para nombres únicos desarrolladas en Python.
- **Desglose Descriptivo de Campañas:** Al tocar un nodo, en vez de mandar una métrica de Excel a marketing, el sistema envía un Payload a Groq donde "el Rol del Agente" es traducir ese perfil en "Bullets ultra-vendibles para Marketing y Ventas".
- **Por qué Groq / Llama-3.3?:** En iteraciones pasadas se usaba GPT-4o-Mini, pero Llama 3.3 ofrecía respuestas a velocidades inferenciales formidables (Tokens a velocidades ultrarrápidas). Era un requerimiento indispensable que cuando el humano toque una esfera en la interfaz espacial, el resumen de la IA caiga casi instantáneo sin bloquear su imaginación. Cuidando que las llaves API nunca queden expuestas en cliente gracias a un Wrapper asíncrono en `clustering/explainer.py`. 

---

## 💾 5. Gestión del Estado, Caché y Rendimiento

La arquitectura de la aplicación en vivo toma resoluciones que priorizan la fluidez:
1. **Caché en Nivel Backend Asíncrona:** Cuando generamos una abstracción con OpenAI para un segmento o una intersección entre 3 Hoteles + X Cluster, ese llamado HTTP no se vuelve a tirar. FastAPI guarda un diccionario vivo con el `cache_key`.
2. **Descarga de Datos Responsable (Export):** El botón CSV procesa la exportación basándose en cruces de identificadores internos de Pandas desde el vector base original prevencionando corrupciones o manipulación cruzada de PII de GUEST_IDs.

---

## 🚀 ROADMAP Y EXPANSIÓN
La base de STAYPRINT está pensada para la modularidad:
- Es apta para acoplamiento de Bases de Datos Vectoriales nativas (Milvus, Pinecone) de cara a pasar del millón de viajeros.
- Posibilidad de contenerizar toda la aplicación en **Docker** publicando las variables directamente hacia el servidor productivo.
