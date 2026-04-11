# STAYPRINT: Make Me Want to Travel

**Impacthon 2026 · Eurostars Hotel Company**

> *"No te conocemos por tu perfil, sino por tu historia."*

STAYPRINT es una herramienta de segmentación de clientes hoteleros basada en embeddings e hiperpersonalización.
Construye un vector de identidad de viaje a partir del comportamiento histórico y realiza matching predictivo con el catálogo de hoteles emparejando viajeros reales con destinos afines.

---

## 🚀 Opciones de Instalación

Puedes arrancar el proyecto de la forma **Manual** (ideal si eres principiante o quieres control total) o de la forma **Rápida** (si estás acostumbrado a usar rutinas Automáticas).

### Opción A: Instalación Manual y Segura (Recomendada)
Esta opción aísla el proyecto en una "caja de arena" (`venv`) para no ensuciar tu ordenador.

1. **Crear y Activar tu Entorno Virtual:**
   ```bash
   python3 -m venv venv
   
   # Activa el entorno en macOS / Linux:
   source venv/bin/activate
   # O actívalo si estás en Windows:
   # venv\Scripts\activate
   ```
   *(Sabrás que funcionó porque a la izquierda de la terminal pondrá `(venv)`)*

2. **Instalar las Librerías:**
   ```bash
   pip install -r requirements.txt
   ```

### Opción B: Instalación Rápida (Usuarios de "Make")
Si tienes instalada la herramienta `make` en tu sistema operativo, puedes omitir la creación de entornos y dejar que nuestros atajos automáticos hagan el trabajo pesado.
*(Nota: `make install` ejecuta internamente `pip install -r requirements.txt`)*

```bash
make install
```

---

## ⚙️ Configuración y Arranque (¡Para ambas Opciones!)

1. **Configurar tu Cerebro IA (Groq)**
   STAYPRINT usa **Groq** (Llama-3) para dotar a los grupos de explicaciones humanas.
   ```bash
   # Duplica el archivo de claves:
   cp .env.example .env
   ```
   Abre el nuevo archivo `.env` en cualquier Bloc de Notas e introduce tu clave real. Debería quedar así: `GROQ_API_KEY=gsk_TuClave123...` (Siempre SIN comillas).

2. **Arrancar el Servidor**
   ```bash
   # Si usaste la Opción A (Modo Manual):
   uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
   
   # Si usaste la Opción B (Modo Rápido / Make):
   make run
   ```
   
🌍 **¡HECHO!** Abre tu navegador y explora nuestra Nube Geodésica en: **http://localhost:8000**

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
