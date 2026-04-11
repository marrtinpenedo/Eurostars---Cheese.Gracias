/**
 * STAYPRINT - API Module
 * Encapsulates all backend interactions.
 */

const API_BASE = '/api';

export const stayprintAPI = {
    // 1. Iniciar pipeline (lee datos que el backend tenga o lo que se deba)
    executePipeline: async () => {
        const response = await fetch(`${API_BASE}/pipeline/execute`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error("Failed to execute pipeline.");
        return response.json();
    },

    // 2. Re-cluster basado en min_cluster_size
    recluster: async (minSize) => {
        const response = await fetch(`${API_BASE}/pipeline/recluster`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ min_cluster_size: minSize })
        });
        if (!response.ok) throw new Error("Failed to recluster.");
        return response.json();
    },

    // 3. Obtener sumario (cards)
    getSummary: async () => {
        const response = await fetch(`${API_BASE}/clusters/summary`);
        if (!response.ok) throw new Error("Failed to get summary");
        return response.json();
    },

    // 4. Proyectar multiples hoteles
    projectHotel: async (hotelIds) => {
        const response = await fetch(`${API_BASE}/hotels/project`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hotel_ids: hotelIds })
        });
        if (!response.ok) throw new Error("Failed to project hotels.");
        return response.json();
    },

    // 5. Explicar Cluster (OpenAI)
    explainCluster: async (clusterId, hotelName = null) => {
        const response = await fetch(`${API_BASE}/clusters/${clusterId}/explain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hotel_name: hotelName })
        });
        if (!response.ok) throw new Error(`Failed to explain cluster ${clusterId}.`);
        return response.json();
    },

    // 6. Configurar endpoint temporal demo para simular que carga catálogo
    getHotelsCatalog: async () => {
        // En una app real, llamaríamos a un GET /api/hotels/catalog.
        // Dado que no implementamos un endpoint que extrae el catálogo crudo completo en Módulos 1-4,
        // esto cargará el archivo CSV y lo parseará localmente o podemos inferir IDs desde el backend si lo hubiéramos expuesto.
        // Simulando listado hardcodeado recuperado por un get. (Alternativa real: la lista provendría de GET de hoteles).
        const csvPath = '/data/raw/hotel_data.csv'; 
        // Note: No exposed static file route for raw data usually.
        // Para la demo o proyector, necesitaremos cargar un dropdown. Retornaremos unos IDs dummy fijos, o los simulados que probamos.
        return [
            { id: "243", name: "Eurostars Torre Sevilla" },
            { id: "281", name: "Aurea Catedral" },
            { id: "247", name: "Aurea Museum" },
            { id: "315", name: "Eurostars Aliados" }
        ];
    }
};
