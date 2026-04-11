# STAYPRINT: Make Me Want to Travel

**Impacthon 2026 · Eurostars Hotel Company**

> *"No te conocemos por tu perfil, sino por tu historia."*

STAYPRINT es una herramienta de segmentación de clientes hoteleros basada en embeddings e hiperpersonalización.
Construye un vector de identidad de viaje a partir del comportamiento histórico y realiza matching con el catálogo de hoteles.

---

## 🚀 Setup Rápido (3 Pasos)

Sigue estos pasos para arrancar el entorno de Inteligencia Artificial (Backend y Frontend SPA incluidos).

1. **Instalar Dependencias**
   ```bash
   make install
   ```

2. **Configurar Entorno**
   Copia el archivo de prueba y añade tu clave de OpenAI para habilitar el motor de explicabilidad en lenguaje natural.
   ```bash
   cp .env.example .env
   # Edita .env con nano o vim para agregar OPENAI_API_KEY
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
2. Hacer click en **"Procesar Nube Geodésica"**. Se aglutinarán dinámicamente las densidades usando UMAP (70% del panel) y detectará clusters reales vía HDBSCAN.
3. Observar las **Campañas Recomendadas** generadas en la galería inferior.
4. **Momento WOW:** En la sección Izquierda, despliega el dropdown *Matchmaker (Eurostars)* y selecciona un hotel, por ejemplo **Eurostars Torre Sevilla**.
5. Observa cómo el sistema automáticamente proyecta un nuevo vector, inyectando el hotel flotando en 3D (`🏨`) y destacando instantáneamente los nudos de clusters exactos que coinciden con ese hotel.
6. **Explicabilidad Humana**: Haz clic en el cluster iluminado y verás como OpenAI narra la historia perfecta del *por qué* ese turista encaja en *ese* hotel de Sevilla.
7. Explica a tu interlocutor por qué se recomiendan N campañas segmentadas, leyendo el score automático de Silhouette expuesto en el panel lateral.

---

### Seguridad de Datos Local
Todo salvo la explicabilidad LLM se procesa localmente o *on-premise*. El export de las campañas sólo contiene los IDs universales del cliente (totalmente anónimo), listo para CRM.
