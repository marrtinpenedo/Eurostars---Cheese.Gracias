/**
 * STAYPRINT - Main Orchestrator
 */

import { stayprintAPI } from './api.js';
import { viz3d } from './viz3d.js';
import { dashboard } from './dashboard.js';

// Estado global — única fuente de verdad
window.stayprintState = {
    numClusters: 0,
    activeHotels: [],        // array de { id, name } de hoteles proyectados
    affineClusters: new Set(), // IDs de clusters marcados como afines
    selectedCluster: null,   // cluster actualmente seleccionado
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

    // Cargar hoteles en dropdown si ya están subidos
    await loadHotels();

    // Botón de ejecución global
    document.getElementById('btn-upload').addEventListener('click', runPipeline);
    
    initFileUploads();
}

async function loadHotels() {
    try {
        const hotels = await stayprintAPI.getHotelsCatalog();
        if (!hotels || hotels.length === 0) {
            dashboard.els.hotelDropdown.innerHTML = '<option value="">No hay hoteles disponibles</option>';
            return;
        }
        dashboard.populateHotels(hotels);
    } catch (e) {
        console.error("Error cargando hoteles:", e);
        dashboard.els.hotelDropdown.innerHTML = '<option value="">Error al cargar hoteles</option>';
    }
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
        // FIX 1 Causa C: Recargar hoteles después de procesar el pipeline
        await loadHotels();
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
        window.stayprintState.numClusters = reclusterData.n_clusters;
        window.stayprintState.activeHotels = []; // reset projection
        window.stayprintState.affineClusters = new Set();
        dashboard.renderActiveHotels(window.stayprintState.activeHotels);
        
        dashboard.updateGlobalStats(reclusterData);
        
        viz3d.render(reclusterData.scatter_data, reclusterData.n_clusters, null, handleClusterClick);
        
        const summary = await stayprintAPI.getSummary();
        dashboard.renderCards(summary.clusters || summary, handleClusterClick);
        
        syncAffinityBadges();

    } catch (e) {
        console.error(e);
        alert("Error en clustering: " + e.message);
    } finally {
        document.getElementById('loader-3d').classList.add('hidden');
    }
}

async function handleSliderChange(val) {
    if(window.stayprintState.numClusters > 0) {
        await runRecluster(parseInt(val));
    }
}

async function updateHotelProjection() {
    dashboard.renderActiveHotels(window.stayprintState.activeHotels);
    
    if (window.stayprintState.activeHotels.length === 0) {
        if(viz3d.currentData) {
            viz3d.render(viz3d.currentData, window.stayprintState.numClusters, null, handleClusterClick);
        }
        return;
    }
    
    viz3d.initPlot();
    try {
        const hotelIds = window.stayprintState.activeHotels.map(h => h.id);
        const projData = await stayprintAPI.projectHotel(hotelIds);
        
        // Actualizar estado de afinidades
        window.stayprintState.affineClusters = new Set(
            projData.affine_clusters.map(c => c.cluster_id)
        );
        syncAffinityBadges();
        
        // Renderizar Disclaimer
        if(dashboard.renderHotelSimilarityDisclaimer && projData.hotel_similarity) {
            dashboard.renderHotelSimilarityDisclaimer(projData.hotel_similarity);
        } else if(dashboard.renderHotelSimilarityDisclaimer) {
            dashboard.renderHotelSimilarityDisclaimer({show_disclaimer: false});
        }
        
        if(viz3d.currentData) {
            viz3d.render(viz3d.currentData, window.stayprintState.numClusters, projData, handleClusterClick);
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
    if (window.stayprintState.activeHotels.find(h => h.id === hotelId)) return; // duplicados
    if (window.stayprintState.activeHotels.length >= 3) {
        alert("Máximo 3 hoteles simultáneos");
        return;
    }
    window.stayprintState.activeHotels.push({ id: hotelId, name: hotelName });
    await updateHotelProjection();
}

async function handleRemoveHotel(hotelId) {
    window.stayprintState.activeHotels = window.stayprintState.activeHotels.filter(h => h.id !== hotelId);
    
    if (window.stayprintState.activeHotels.length === 0) {
        // Limpiar todo rastro de afinidad
        window.stayprintState.affineClusters = new Set();
    }
    
    await updateHotelProjection();
    syncAffinityBadges(); // siempre sincronizar al final
}

async function handleClusterClick(clusterId) {
    // 10B: Actualizar estado y efectos visuales
    window.stayprintState.selectedCluster = clusterId;
    
    if(window.viz3d && window.viz3d.selectClusterInScatter) {
        window.viz3d.selectClusterInScatter(clusterId);
    }

    document.querySelectorAll('.segment-card').forEach(card => {
        const id = parseInt(card.dataset.clusterId || card.querySelector('.badge').textContent.replace('#', ''));
        card.classList.toggle('selected', id === clusterId);
        if (id === clusterId) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    });

    dashboard.showAILoading();
    try {
        const hotelName = window.stayprintState.activeHotels.length > 0 ? window.stayprintState.activeHotels.map(h=>h.name).join(' + ') : null;
        const result = await stayprintAPI.explainCluster(clusterId, hotelName);
        dashboard.showAIResult(result, hotelName);
        syncSidePanelAffinity();
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

// 10A: Sincronización de badges de afinidad
function syncAffinityBadges() {
    const hasHotels = window.stayprintState.activeHotels.length > 0;
    const affineClusters = window.stayprintState.affineClusters;

    document.querySelectorAll('.segment-card').forEach(card => {
        const clusterId = parseInt(card.dataset.clusterId || card.querySelector('.badge').textContent.replace('#', ''));
        // inyectar dataset.clusterId si no existe para facilitar futuras rutinas
        if(!card.dataset.clusterId) card.dataset.clusterId = clusterId;
        
        let badge = card.querySelector('.affinity-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'affinity-badge';
            card.appendChild(badge);
        }

        if (!hasHotels) {
            badge.style.display = 'none';
            badge.textContent = '';
        } else if (affineClusters.has(clusterId)) {
            badge.style.display = 'inline-flex';
            const hotelNames = window.stayprintState.activeHotels.map(h => h.name).join(' + ');
            badge.textContent = `Afín a ${hotelNames}`;
        } else {
            badge.style.display = 'none';
            badge.textContent = '';
        }
    });

    syncSidePanelAffinity();
}

function syncSidePanelAffinity() {
    let badge = document.getElementById('side-affinity-badge');
    const panel = document.getElementById('ai-result');
    if (!badge && panel) {
        badge = document.createElement('div');
        badge.id = 'side-affinity-badge';
        badge.className = 'affinity-badge side-badge';
        const aiHeader = panel.querySelector('.ai-header');
        if(aiHeader) aiHeader.appendChild(badge);
    }
    if (!badge) return;

    const hasHotels = window.stayprintState.activeHotels.length > 0;
    const clusterId = window.stayprintState.selectedCluster; // Este vendrá del submódulo 10B
    const isAffine = clusterId !== null && window.stayprintState.affineClusters.has(clusterId);

    if (!hasHotels || !isAffine) {
        badge.style.display = 'none';
        return;
    }

    badge.style.display = 'inline-block';
    const hotelNames = window.stayprintState.activeHotels.map(h => h.name).join(' + ');
    badge.textContent = `Afín a ${hotelNames}`;
}

function handleExportCSV(clusterId) {
    if(!clusterId) return;
    window.location.href = `/api/clusters/${clusterId}/export`;
}

// 10E: Drag and Drop de hoteles
window.initDragAndDrop = function() {
    const scatterContainer = document.getElementById('scatter-container');
    const overlay = document.getElementById('scatter-drop-overlay');

    if(!scatterContainer || !overlay) return;

    // Remove old listeners to avoid duplicates
    const newScatterContainer = scatterContainer.cloneNode(true);
    scatterContainer.parentNode.replaceChild(newScatterContainer, scatterContainer);
    const updatedOverlay = document.getElementById('scatter-drop-overlay');

    document.querySelectorAll('.hotel-draggable').forEach(el => {
        el.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('hotel-id', el.dataset.hotelId);
            e.dataTransfer.setData('hotel-name', el.dataset.hotelName);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });

    newScatterContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        updatedOverlay.style.display = 'flex';
        updatedOverlay.style.pointerEvents = 'auto'; // allow drop events on overlay
    });

    newScatterContainer.addEventListener('dragleave', (e) => {
        if (!newScatterContainer.contains(e.relatedTarget)) {
            updatedOverlay.style.display = 'none';
            updatedOverlay.style.pointerEvents = 'none';
        }
    });

    updatedOverlay.addEventListener('dragleave', (e) => {
        // Just in case overlay catches it
        if (!newScatterContainer.contains(e.relatedTarget)) {
            updatedOverlay.style.display = 'none';
            updatedOverlay.style.pointerEvents = 'none';
        }
    });

    updatedOverlay.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    updatedOverlay.addEventListener('drop', (e) => {
        e.preventDefault();
        updatedOverlay.style.display = 'none';
        updatedOverlay.style.pointerEvents = 'none';

        const hotelId = e.dataTransfer.getData('hotel-id');
        const hotelName = e.dataTransfer.getData('hotel-name');

        if (!hotelId) return;

        showProjectionLoader(hotelName);
        setTimeout(() => {
            handleProjectHotel(hotelId, hotelName);
        }, 500);
    });
};

function showProjectionLoader(hotelName) {
    const toast = document.createElement('div');
    toast.className = 'projection-toast';
    toast.textContent = `Proyectando ${hotelName}...`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1200);
}

// Inyección de selectCluster al global scope
window.selectCluster = function(clusterId) {
    handleClusterClick(clusterId);
};

document.addEventListener('DOMContentLoaded', init);
