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
    clusterCards: [],       // explicit baseline array
    explanationCache: {}    // Módulo 5 — caché /explain por cluster_id
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
        renderCampaignsView();         // Módulo 5 — construye el grid antes de mostrar
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
        window.stayprintState.explanationCache = {}; // Invalida caché al recalcular clusters
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

// ═══════════════════════════════════════════════════════════
// MÓDULO 5 — Vista 2: Grid de tarjetas de campañas
// ═══════════════════════════════════════════════════════════

const _CAMPAIGN_COLORS = [
    "#2563EB", "#16A34A", "#DC2626", "#D97706", "#7C3AED",
    "#0891B2", "#BE185D", "#065F46", "#EAB308", "#06B6D4"
];

/**
 * Construye o reconstruye el grid de tarjetas en #campaigns-grid.
 * Solo consume window.stayprintState — no realiza llamadas de red.
 */
function renderCampaignsView() {
    const grid = document.getElementById('campaigns-grid');
    if (!grid) return;

    const allCards = window.stayprintState.clusterCards  || [];
    const affine   = window.stayprintState.affineClusters || new Set();
    const hotels   = window.stayprintState.activeHotels   || [];

    // Filtrar ruido (cluster -1) y ordenar por ADR descendente
    const cards = allCards
        .filter(c => Number(c.cluster_id) !== -1)
        .sort((a, b) => {
            const adrA = a.metrics ? (a.metrics.adr || 0) : (a.adr_mean || 0);
            const adrB = b.metrics ? (b.metrics.adr || 0) : (b.adr_mean || 0);
            return adrB - adrA;
        });

    grid.innerHTML = '';

    if (cards.length === 0) {
        grid.innerHTML = '<p class="campaigns-empty">No hay segmentos disponibles.</p>';
        return;
    }

    const hotelLabel = hotels.map(h => h.name).join(' + ');

    cards.forEach(card => {
        const cid    = Number(card.cluster_id);
        const adrVal = card.metrics ? (card.metrics.adr || 0) : (card.adr_mean || 0);
        const name   = card.name || `Segmento ${cid}`;
        const color  = _CAMPAIGN_COLORS[cid % _CAMPAIGN_COLORS.length];
        const isAffine = hotels.length > 0 && affine.has(cid);

        const div = document.createElement('div');
        div.className = 'campaign-card';
        div.dataset.clusterId = cid;

        div.innerHTML = `
            <div class="cc-header">
                <span class="cc-color-dot" style="background:${color}"></span>
                <span class="cc-badge-id">Segmento #${cid}</span>
            </div>
            <h3 class="cc-name">${name}</h3>
            <div class="cc-meta">
                <span class="cc-meta-item cc-adr">€${parseFloat(adrVal).toFixed(0)}</span>
                <span class="cc-meta-item">👥 ${card.size} clientes</span>
            </div>
            ${isAffine ? `<div class="cc-affinity-badge">⭐ Afín a ${hotelLabel}</div>` : ''}
            <button class="cc-toggle-btn">
                Ver análisis <span class="cc-toggle-arrow">→</span>
            </button>
            <div class="cc-expand-content">
                <div class="cc-divider"></div>
                <div class="cc-spinner-wrap">
                    <div class="cc-spinner"></div>
                    <span class="cc-spinner-label">Generando análisis IA…</span>
                </div>
                <ul class="cc-bullets"></ul>
                <div class="cc-export-wrap" style="display:none;">
                    <p class="cc-export-hint">Descarga la lista de clientes de este segmento.</p>
                    <button class="cc-export-btn" data-cluster-id="${cid}">⬇ Exportar segmento CSV</button>
                </div>
            </div>
        `;

        // Exportar: stopPropagation para no activar el toggle de la tarjeta
        div.querySelector('.cc-export-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            handleExportCSV(cid);
        });

        // Toggle de expansión
        div.addEventListener('click', (e) => {
            if (e.target.closest('.cc-export-btn')) return;
            toggleCampaignCard(div, cid);
        });

        grid.appendChild(div);
    });
}

/**
 * Expande o colapsa una tarjeta.
 * Solo una tarjeta puede estar expandida a la vez.
 * Si el cluster ya tiene resultado cacheado, lo muestra sin red.
 */
async function toggleCampaignCard(cardEl, clusterId) {
    const wasExpanded = cardEl.classList.contains('expanded');

    // Colapsar todas las tarjetas expandidas (distintas a la actual)
    document.querySelectorAll('#campaigns-grid .campaign-card.expanded').forEach(c => {
        if (c !== cardEl) {
            c.classList.remove('expanded');
            const arrow = c.querySelector('.cc-toggle-arrow');
            if (arrow) arrow.textContent = '\u2192';
        }
    });

    // Toggle: si ya estaba expandida, simplemente colapsar
    if (wasExpanded) {
        cardEl.classList.remove('expanded');
        const arrow = cardEl.querySelector('.cc-toggle-arrow');
        if (arrow) arrow.textContent = '\u2192';
        return;
    }

    // Expandir la tarjeta
    cardEl.classList.add('expanded');
    const arrow = cardEl.querySelector('.cc-toggle-arrow');
    if (arrow) arrow.textContent = '\u2191';

    // Resultado ya cacheado — render inmediato sin llamada de red
    const cache = window.stayprintState.explanationCache;
    if (cache[clusterId] !== undefined) {
        _renderCampaignCardResult(cardEl, cache[clusterId]);
        return;
    }

    // Sin caché: mostrar spinner y ocultar export
    const spinnerWrap = cardEl.querySelector('.cc-spinner-wrap');
    const bulletsList  = cardEl.querySelector('.cc-bullets');
    const exportWrap   = cardEl.querySelector('.cc-export-wrap');
    spinnerWrap.style.display = 'flex';
    bulletsList.innerHTML = '';
    exportWrap.style.display = 'none';

    // Llamar a /explain (función preservada de Vista 1, ahora usada en Vista 2)
    const hotelName = (window.stayprintState.activeHotels || [])
        .map(h => h.name).join(', ') || null;
    const result = await window._callExplainCluster(clusterId, hotelName);

    // Guardar en caché
    window.stayprintState.explanationCache[clusterId] = result;

    // Renderizar solo si la tarjeta sigue expandida
    // (el usuario pudo colapsar mientras esperaba la respuesta)
    if (cardEl.classList.contains('expanded')) {
        _renderCampaignCardResult(cardEl, result);
    }
}

/**
 * Rellena el área expandida con bullets de /explain.
 * Llamada tanto desde respuesta API como desde caché.
 */
function _renderCampaignCardResult(cardEl, resultData) {
    const spinnerWrap = cardEl.querySelector('.cc-spinner-wrap');
    const bulletsList  = cardEl.querySelector('.cc-bullets');
    const exportWrap   = cardEl.querySelector('.cc-export-wrap');

    spinnerWrap.style.display = 'none';
    bulletsList.innerHTML = '';

    const bullets = (resultData && resultData.bullets) ? resultData.bullets : [];
    if (bullets.length > 0) {
        bullets.forEach(b => {
            const li = document.createElement('li');
            li.textContent = b;
            bulletsList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'No hay explicación disponible (verifica Vertex AI).';
        bulletsList.appendChild(li);
    }

    exportWrap.style.display = 'block';
}

function handleExportCSV(clusterId) {
    if(!clusterId) return;
    window.location.href = `/api/clusters/${clusterId}/export`;
}

document.addEventListener('DOMContentLoaded', init);
