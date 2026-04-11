/**
 * STAYPRINT - Main Orchestrator
 */

import { stayprintAPI } from './api.js';
import { viz3d } from './viz3d.js';
import { dashboard } from './dashboard.js';

let appState = {
    numClusters: 0,
    currentHotel: null // the projected hotel data
};

async function init() {
    console.log("Stayprint Init");
    
    // Bind UI actions
    dashboard.init(
        handleSliderChange,
        handleProjectHotel,
        handleExportCSV
    );

    // Cargar hoteles en dropdown
    try {
        const hotels = await stayprintAPI.getHotelsCatalog();
        dashboard.populateHotels(hotels);
    } catch (e) {
        console.error("No se pudo cargar el listado de hoteles", e);
    }

    // Botón de ejecución global
    document.getElementById('btn-upload').addEventListener('click', runPipeline);
}

async function runPipeline() {
    try {
        viz3d.initPlot();
        const execInfo = await stayprintAPI.executePipeline();
        console.log("Pipeline executed", execInfo);
        
        // Use suggested cluster size to initial reclustering
        let initialSize = 5;
        if(execInfo.suggestion && execInfo.suggestion.optimal_min_cluster_size) {
            initialSize = execInfo.suggestion.optimal_min_cluster_size;
            dashboard.els.slider.value = initialSize;
            dashboard.els.sliderVal.textContent = initialSize;
        }

        await runRecluster(initialSize);
    } catch (e) {
        console.error(e);
        alert("Error ejecutando pipeline inicial: " + e.message);
        document.getElementById('loader-3d').classList.add('hidden');
    }
}

async function runRecluster(minSize) {
    viz3d.initPlot();
    try {
        const reclusterData = await stayprintAPI.recluster(minSize);
        appState.numClusters = reclusterData.n_clusters;
        appState.currentHotel = null; // reset projection
        
        dashboard.updateGlobalStats(reclusterData);
        
        // Draw 3D
        viz3d.render(reclusterData.scatter_data, reclusterData.n_clusters, null, handleClusterClick);
        
        // Fetch and draw cards
        const summary = await stayprintAPI.getSummary();
        dashboard.renderCards(summary, handleClusterClick);

    } catch (e) {
        console.error(e);
        alert("Error en clustering: " + e.message);
    } finally {
        document.getElementById('loader-3d').classList.add('hidden');
    }
}

async function handleSliderChange(val) {
    if(appState.numClusters > 0) {
        await runRecluster(parseInt(val));
    }
}

async function handleProjectHotel(hotelId) {
    viz3d.initPlot();
    try {
        const projData = await stayprintAPI.projectHotel(hotelId);
        appState.currentHotel = projData;
        
        // We need to re-render but without fetching scatter again, we just reuse viz3d.currentData
        if(viz3d.currentData) {
            viz3d.render(viz3d.currentData, appState.numClusters, projData, handleClusterClick);
        } else {
            document.getElementById('loader-3d').classList.add('hidden');
        }
    } catch (e) {
        console.error(e);
        alert("Error proyectando hotel: " + e.message);
        document.getElementById('loader-3d').classList.add('hidden');
    }
}

async function handleClusterClick(clusterId) {
    dashboard.showAILoading();
    try {
        const hotelName = appState.currentHotel ? appState.currentHotel.hotel_name : null;
        const result = await stayprintAPI.explainCluster(clusterId, hotelName);
        dashboard.showAIResult(result, hotelName);
    } catch (e) {
        console.error(e);
        dashboard.showAIResult({
            cluster_id: clusterId,
            cluster_name: "Error",
            cluster_size: 0,
            bullets: ["No se pudo obtener la explicación del servidor."]
        });
    }
}

function handleExportCSV(clusterId) {
    if(!clusterId) return;
    window.location.href = `/api/clusters/${clusterId}/export`;
}

// Arranque
document.addEventListener('DOMContentLoaded', init);
