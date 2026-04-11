# STAYPRINT: Make Me Want to Travel

**Impacthon 2026 · Eurostars Hotel Company**

> *"No te conocemos por tu perfil, sino por tu historia."*

STAYPRINT es una herramienta de segmentación de clientes hoteleros basada en embeddings e hiperpersonalización.
Construye un vector de identidad de viaje a partir del comportamiento histórico y realiza matching predictivo con el catálogo de hoteles emparejando viajeros reales con destinos afines.

---

## 🚀 Setup Rápido (Entorno Aislado VENV)

Sigue estos pasos para arrancar el entorno de Inteligencia Artificial (Backend y Frontend SPA incluidos). Recomendamos usar un entorno virtual (`venv`) para aislar el proyecto de tu sistema.

1. **Crear Entorno Virtual e Instalar Dependencias**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # En Linux/Mac
   # venv\Scripts\activate   # En Windows
   
   make install
   ```

2. **Configurar Entorno (Inyectar LLM)**
   Copia el archivo de prueba y añade tu clave de **Groq** para habilitar el motor ultra-rápido de explicabilidad en lenguaje natural (modelo *Llama-3.3-70b-versatile*).
   ```bash
   cp .env.example .env
   # Edita .env con nano o vim para agregar tu GROQ_API_KEY
   ```

3. **Arrancar el Servidor**
   ```bash
   make run
   # Accede a http://localhost:8000
   ```

---

## 🎭 La Demo (El Momento WOW)

Si deseas utilizar los datos autogenerados de muestra y ejecutar el pipeline directamente:

```bash
make demo
```

### Guion de Ensayo (Pitch)
1. Abrir **http://localhost:8000**.
2. Hacer click en **"Procesar Nube Geodésica"**. Se aglutinarán dinámicamente las densidades usando UMAP (70% del panel) y detectará clusters reales vía HDBSCAN explorando las matrices geodésicas.
3. Observar las **Campañas Recomendadas** generadas en la galería inferior. Fíjate en los atractivos títulos creados por Llama-3.3 en vez de meros números fríos.
4. **Momento WOW:** En la sección Izquierda, despliega el dropdown *Matchmaker (Eurostars)* y selecciona un hotel, por ejemplo **Eurostars Torre Sevilla**.
5. Observa cómo el sistema automáticamente proyecta un nuevo vector, inyectando el hotel flotando en 3D (`🏨`) y destacando instantáneamente los nudos exactos que coinciden con la infraestructura del hotel.
6. **Explicabilidad Humana**: Haz clic en el cluster iluminado y verás como el agente LLM de **Groq** narra la historia perfecta del *por qué* ese segmento demográfico de turista encaja en *ese* hotel de Sevilla.
7. Al finalizar, exporta ese subconjunto desde el botón lateral derecho ("Exportar segmento como CSV") y llévatelo directo para lanzarle una campaña de retargeting de email marketing.

---

### Seguridad de Datos Local
Todo el preprocesado estadístico salvo la interjección puntual con el LLM en Groq se procesa localmente (*on-premise*). El export de las campañas sólo extrae identificadores universales limpios (`GUEST_ID` anónimo), listos para integrarlos al entorno IT interno con total seguridad.
