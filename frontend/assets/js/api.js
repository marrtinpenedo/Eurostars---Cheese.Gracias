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

    // 5. Explicar Cluster (Vertex)
    explainCluster: async (clusterId, hotelName = null) => {
        const response = await fetch(`${API_BASE}/clusters/${clusterId}/explain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hotel_name: hotelName })
        });
        if (!response.ok) throw new Error(`Failed to explain cluster ${clusterId}.`);
        return response.json();
    },

    // 6. Endpoint real para obtener todo el catálogo de hoteles
    getHotelsCatalog: async () => {
        const response = await fetch(`${API_BASE}/hotels/hotels`);
        if (!response.ok) throw new Error("Failed to load hotels catalog.");
        const data = await response.json();
        
        // Ordenar por nombre para facilitar búsqueda
        return data.hotels.sort((a, b) => a.name.localeCompare(b.name));
    }
};
