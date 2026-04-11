/**
 * STAYPRINT - Main Orchestrator
 */

import { stayprintAPI } from './api.js';
import { viz3d } from './viz3d.js';
import { dashboard } from './dashboard.js';

let appState = {
    numClusters: 0,
    activeHotels: [] // List of {id, name}
};

async function init() {
    console.log("Stayprint Init");
    
    // Bind UI actions
    dashboard.init(
        handleSliderChange,
        handleProjectHotel,
        handleRemoveHotel,
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
    
    initFileUploads();
}

function initFileUploads() {
    const uploads = [
        { input: 'customers_csv', btn: 'btn-customers', label: 'filename-customers', key: 'customers' },
        { input: 'hotels_csv',    btn: 'btn-hotels',    label: 'filename-hotels',    key: 'hotels'    }
    ];
    
    const processBtn = document.getElementById('btn-upload');
    const filesSelected = { customers: false, hotels: false };
    
    uploads.forEach(({ input, btn, label, key }) => {
        const inputEl = document.getElementById(input);
        const btnEl   = document.getElementById(btn);
        const labelEl = document.getElementById(label);
        
        if (inputEl) {
            inputEl.addEventListener('change', function() {
                if (this.files.length > 0) {
                    const name = this.files[0].name;
                    labelEl.textContent = name;
                    btnEl.classList.add('has-file');
                    filesSelected[key] = true;
                } else {
                    labelEl.textContent = 'Sin archivo';
                    btnEl.classList.remove('has-file');
                    filesSelected[key] = false;
                }
                // Habilitar botón solo cuando ambos CSVs están seleccionados
                processBtn.disabled = !(filesSelected.customers && filesSelected.hotels);
            });
        }
    });
}

async function runPipeline() {
    try {
        viz3d.initPlot();
        const execInfo = await stayprintAPI.executePipeline();
        console.log("Pipeline executed", execInfo);
        
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
        appState.activeHotels = []; // reset projection
        dashboard.renderActiveHotels(appState.activeHotels);
        
        dashboard.updateGlobalStats(reclusterData);
        
        viz3d.render(reclusterData.scatter_data, reclusterData.n_clusters, null, handleClusterClick);
        
        const summary = await stayprintAPI.getSummary();
        dashboard.renderCards(summary.clusters || summary, handleClusterClick);

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

async function updateHotelProjection() {
    dashboard.renderActiveHotels(appState.activeHotels);
    
    if (appState.activeHotels.length === 0) {
        if(viz3d.currentData) {
            viz3d.render(viz3d.currentData, appState.numClusters, null, handleClusterClick);
        }
        return;
    }
    
    viz3d.initPlot();
    try {
        const hotelIds = appState.activeHotels.map(h => h.id);
        const projData = await stayprintAPI.projectHotel(hotelIds);
        
        if(viz3d.currentData) {
            viz3d.render(viz3d.currentData, appState.numClusters, projData, handleClusterClick);
        } else {
            document.getElementById('loader-3d').classList.add('hidden');
        }
    } catch (e) {
        console.error(e);
        alert("Error proyectando hoteles: " + e.message);
        document.getElementById('loader-3d').classList.add('hidden');
    }
}

async function handleProjectHotel(hotelId, hotelName) {
    if (appState.activeHotels.find(h => h.id === hotelId)) return; // duplicados
    if (appState.activeHotels.length >= 3) {
        alert("Máximo 3 hoteles simultáneos");
        return;
    }
    appState.activeHotels.push({ id: hotelId, name: hotelName });
    await updateHotelProjection();
}

async function handleRemoveHotel(hotelId) {
    appState.activeHotels = appState.activeHotels.filter(h => h.id !== hotelId);
    await updateHotelProjection();
}

async function handleClusterClick(clusterId) {
    dashboard.showAILoading();
    try {
        const hotelName = appState.activeHotels.length > 0 ? appState.activeHotels.map(h=>h.name).join(' + ') : null;
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

document.addEventListener('DOMContentLoaded', init);
