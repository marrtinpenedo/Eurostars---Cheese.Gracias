/**
 * STAYPRINT - Main Orchestrator
 */

import { stayprintAPI } from './api.js';
import { viz3d } from './viz3d.js';
import { viz2d } from './viz2d.js';
import { dashboard } from './dashboard.js';


window.stayprintState = {
    ...(window.stayprintState || {}),
    numClusters: 0,
    activeHotels: [],
    affineClusters: new Set(),
    selectedCluster: null,
    clusterCards: [] // explicit baseline array
};

// --- SPA VIEW ROUTING ---
function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
}

window.goToCampaigns = function() {
    const cards = window.stayprintState.clusterCards;
    if (cards && cards.length > 0) {
        showView("view-campaigns");
    } else {
        alert("Genera los segmentos primero procesando los datos.");
    }
};

window.goToSegmentation = function() {
    showView("view-segmentation");
};

// Módulo 3 — CTA state management
function updateCTAButton() {
    const btn = document.getElementById('btn-go-campaigns');
    if (!btn) return;
    const cards = window.stayprintState.clusterCards;
    if (cards && cards.length > 0) {
        btn.disabled = false;
        btn.classList.remove('btn-disabled');
    } else {
        btn.disabled = true;
        btn.classList.add('btn-disabled');
    }
}
// ------------------------

window.syncAffinityUI = function() {
    const hasHotels = window.stayprintState.activeHotels.length > 0;
    const affineClusters = window.stayprintState.affineClusters;

    // --- Cards de segmentos ---
    document.querySelectorAll('[data-cluster-id]').forEach(card => {
        const cid = parseInt(card.dataset.clusterId);
        const badge = card.querySelector('.affinity-badge');
        if (!badge) return;

        if (!hasHotels || !affineClusters.has(cid)) {
            badge.style.display = 'none';
            badge.textContent = '';
        } else {
            badge.style.display = 'inline-flex';
            const names = window.stayprintState.activeHotels.map(h => h.name).join(' + ');
            badge.textContent = `Afín a ${names}`;
        }
    });

    // --- Panel lateral ---
    const sideBadge = document.getElementById('side-affinity-badge');
    if (sideBadge) {
        const selCid = window.stayprintState.selectedCluster;
        const isAffine = selCid !== null && hasHotels && affineClusters.has(selCid);
        sideBadge.style.display = isAffine ? 'block' : 'none';
        if (isAffine) {
            const names = window.stayprintState.activeHotels.map(h => h.name).join(' + ');
            sideBadge.textContent = `Afín a ${names}`;
        }
    }
}

function onHotelProjected(responseData) {
    window.stayprintState.affineClusters = new Set(
        (responseData.affine_clusters || []).map(c => c.cluster_id)
    );
    window.syncAffinityUI();
}

function setupViewTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const panels = document.querySelectorAll('.view-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active button
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show selected panel
            const targetId = tab.getAttribute('data-target');
            panels.forEach(panel => {
                if(panel.id === targetId) {
                    panel.style.display = 'block';
                    panel.classList.add('active-view');
                } else {
                    panel.style.display = 'none';
                    panel.classList.remove('active-view');
                }
            });
        });
    });
}

async function init() {
    console.log("Stayprint Init");
    setupViewTabs();
    
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
        dashboard.renderActiveHotels(window.stayprintState.activeHotels);
        
        dashboard.updateGlobalStats(reclusterData);
        
        viz3d.render(reclusterData.scatter_data, reclusterData.n_clusters, null, handleClusterClick);
        
        const summary = await stayprintAPI.getSummary();
        window.stayprintState.clusterCards = summary.clusters || summary;
        dashboard.renderCards(window.stayprintState.clusterCards, handleClusterClick);
        
        // Render 2D View
        viz2d.render(
            window.stayprintState.clusterCards, 
            window.stayprintState.activeHotels, 
            window.stayprintState.affineClusters, 
            handleClusterClick
        );

        // Módulo 3 — activar CTA si hay clusters
        updateCTAButton();

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
            if(window.stayprintState.clusterCards) {
                viz2d.render(window.stayprintState.clusterCards, [], new Set(), handleClusterClick);
            }
        }
        return;
    }
    
    viz3d.initPlot();
    try {
        const hotelIds = window.stayprintState.activeHotels.map(h => h.id);
        const projData = await stayprintAPI.projectHotel(hotelIds);
        onHotelProjected(projData);
        
        if(viz3d.currentData) {
            viz3d.render(viz3d.currentData, window.stayprintState.numClusters, projData, handleClusterClick);
            if(window.stayprintState.clusterCards) {
                viz2d.render(
                    window.stayprintState.clusterCards, 
                    window.stayprintState.activeHotels, 
                    window.stayprintState.affineClusters, 
                    handleClusterClick
                );
            }
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
    window.stayprintState.activeHotels = 
        window.stayprintState.activeHotels.filter(h => h.id !== hotelId);
    
    if (window.stayprintState.activeHotels.length === 0) {
        window.stayprintState.affineClusters = new Set(); // limpiar todo
        // FIX Bug 2: viz3d.clearScatterSelection() no existe — re-renderizamos sin projData
        // lo que limpia los marcadores de hotel y restaura las opacidades normales
        updateHotelProjection();
    } else {
        await updateHotelProjection();
    }
    window.syncAffinityUI();
}

async function handleClusterClick(clusterId) {
    window.stayprintState.selectedCluster = clusterId;
    window.syncAffinityUI();

    // Módulo 4: Vista 1 muestra solo resumen estático — sin llamar a /explain
    dashboard.showClusterSummary(clusterId);
}

// Función de explicabilidad completa — DESCONECTADA de Vista 1.
// Reservada para Vista 2 (Módulo 5). No eliminar.
async function callExplainCluster(clusterId, hotelName) {
    try {
        const result = await stayprintAPI.explainCluster(clusterId, hotelName);
        return result;
    } catch (e) {
        console.error('callExplainCluster error:', e);
        return {
            cluster_id: clusterId,
            cluster_name: `Segmento #${clusterId}`,
            cluster_size: 0,
            bullets: ['No se pudo obtener la explicación del servidor.']
        };
    }
}
// Exportar para uso en Vista 2 (Módulo 5)
window._callExplainCluster = callExplainCluster;

function handleExportCSV(clusterId) {
    if(!clusterId) return;
    window.location.href = `/api/clusters/${clusterId}/export`;
}

document.addEventListener('DOMContentLoaded', init);
