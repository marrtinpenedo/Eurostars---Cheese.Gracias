/**
 * STAYPRINT - Dashboard UI Logic
 */

export const dashboard = {
    // Referencias DOM
    els: {
        slider: document.getElementById('cluster-slider'),
        sliderVal: document.getElementById('slider-val-display'),
        optBadge: document.getElementById('optimal-badge'),
        statClusters: document.getElementById('stat-n-clusters'),
        hotelDropdown: document.getElementById('hotel-dropdown'),
        projectBtn: document.getElementById('btn-project'),
        activeHotelsContainer: document.getElementById('active-hotels-container'),
        
        cardsContainer: document.getElementById('segment-cards-container'),
        cardsScroller: document.getElementById('cards-scroller'),

        aiEmpty: document.getElementById('ai-empty'),
        aiLoading: document.getElementById('ai-loading'),
        aiResult: document.getElementById('ai-result'),
        
        aiTitle: document.getElementById('ai-title'),
        aiBadge: document.getElementById('ai-id-badge'),
        aiSize: document.getElementById('ai-size-chip'),
        aiBullets: document.getElementById('ai-bullets'),
        aiContextBanner: document.getElementById('ai-context-banner'),
        aiContextHotel: document.getElementById('ai-context-hotel'),
        btnExport: document.getElementById('btn-export-csv')
    },

    init: (onSliderChange, onProjectBtn, onRemoveHotelBtn, onExportBtn) => {
        dashboard.els.slider.addEventListener('change', (e) => {
            const val = e.target.value;
            dashboard.els.sliderVal.textContent = val;
            onSliderChange(val);
        });

        dashboard.els.projectBtn.addEventListener('click', () => {
            const hid = dashboard.els.hotelDropdown.value;
            const hname = dashboard.els.hotelDropdown.options[dashboard.els.hotelDropdown.selectedIndex].text;
            if(hid) {
                onProjectBtn(hid, hname);
                // Reset dropdown
                dashboard.els.hotelDropdown.value = "";
                dashboard.els.projectBtn.classList.add('disabled');
                dashboard.els.projectBtn.setAttribute('disabled', 'true');
            }
        });

        dashboard.els.hotelDropdown.addEventListener('change', (e) => {
            if (e.target.value) {
                dashboard.els.projectBtn.classList.remove('disabled');
                dashboard.els.projectBtn.removeAttribute('disabled');
            } else {
                dashboard.els.projectBtn.classList.add('disabled');
                dashboard.els.projectBtn.setAttribute('disabled', 'true');
            }
        });

        dashboard.els.btnExport.addEventListener('click', (e) => {
            const cid = e.target.dataset.clusterId;
            if(cid) onExportBtn(cid);
        });
        
        const toggleNames = document.getElementById('toggle-names');
        if (toggleNames) {
            toggleNames.addEventListener('change', () => {
                if (dashboard.lastCards) {
                    dashboard.renderCards(dashboard.lastCards, dashboard.lastOnCardClick);
                }
            });
        }
        
        dashboard.onRemoveHotelBtn = onRemoveHotelBtn;
    },

    renderActiveHotels: (activeHotels) => {
        const container = dashboard.els.activeHotelsContainer;
        container.innerHTML = '';
        
        const HOTEL_COLORS = ['#1A1D23', '#92400E', '#4C1D95'];
        
        activeHotels.forEach((hotel, index) => {
            const span = document.createElement('span');
            span.className = 'hotel-pill';
            span.style.borderColor = HOTEL_COLORS[index] || '#1A1D23';
            
            span.innerHTML = `
                🏨 ${hotel.name}
                <button class="remove-hotel" data-id="${hotel.id}">×</button>
            `;
            container.appendChild(span);
        });
        
        // Add listeners to buttons
        container.querySelectorAll('.remove-hotel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                if(dashboard.onRemoveHotelBtn) dashboard.onRemoveHotelBtn(id);
            });
        });
    },

    updateGlobalStats: (data) => {
        dashboard.els.statClusters.textContent = data.n_clusters;
        if (data.optimal_suggestion) {
            dashboard.els.optBadge.textContent = `Sugerido: ${data.optimal_suggestion} ⭐`;
        }
    },

    populateHotels: (hotels) => {
        const sel = dashboard.els.hotelDropdown;
        sel.innerHTML = '<option value="">Selecciona un hotel...</option>';
        
        let dragList = document.getElementById('drag-hotels-list');
        if(!dragList) {
            dragList = document.createElement('div');
            dragList.id = 'drag-hotels-list';
            dragList.style.cssText = "max-height: 150px; overflow-y: auto; margin-top: 10px; border-radius:6px; padding:2px;";
            dashboard.els.hotelDropdown.parentNode.insertBefore(dragList, dashboard.els.activeHotelsContainer);
        }
        dragList.innerHTML = '';
        
        hotels.forEach(hotel => {
            const opt = document.createElement('option');
            opt.value = hotel.id;
            
            const stars = '⭐'.repeat(hotel.stars || 0);
            const city = hotel.city || 'Desconocida';
            opt.textContent = `${hotel.name} (${city}, ${stars})`;
            sel.appendChild(opt);

            // Crear elemento arrastrable 10E
            const dragItem = document.createElement('div');
            dragItem.className = 'hotel-draggable';
            dragItem.draggable = true;
            dragItem.dataset.hotelId = hotel.id;
            dragItem.dataset.hotelName = hotel.name;
            dragItem.textContent = `${hotel.name} — ${city}`;
            dragList.appendChild(dragItem);
        });

        // Re-bind drag events (which main.js does globally, but let's be safe)
        if(window.initDragAndDrop) window.initDragAndDrop();
    },

    renderCards: (cards, onCardClick) => {
        dashboard.lastCards = cards;
        dashboard.lastOnCardClick = onCardClick;
        
        if (!cards || cards.length === 0) {
            dashboard.els.cardsContainer.classList.add('hidden');
            return;
        }
        
        dashboard.els.cardsContainer.classList.remove('hidden');
        const scroller = dashboard.els.cardsScroller;
        scroller.innerHTML = '';
        
        const colors = [
            "#7C3AED", "#10B981", "#DB2777", "#F59E0B", "#3B82F6", 
            "#8B5CF6", "#14B8A6", "#F43F5E", "#EAB308", "#06B6D4"
        ];

        const useNaturalNames = document.getElementById('toggle-names')?.checked ?? true;

        // Insert noise cluster at the end
        const regularCards = cards.filter(c => c.cluster_id !== -1);
        const noiseCards = cards.filter(c => c.cluster_id === -1);
        const sortedCards = [...regularCards, ...noiseCards];

        sortedCards.forEach(card => {
            const isNoise = card.cluster_id === -1;
            const div = document.createElement('div');
            div.className = isNoise ? 'segment-card noise-cluster' : 'segment-card';
            div.dataset.clusterId = card.cluster_id;
            
            const titleStr = useNaturalNames ? (card.name || 'Segmento ' + card.cluster_id) : `Segmento #${card.cluster_id}`;
            const adrVal = card.metrics ? card.metrics.adr : (card.adr_mean || 0);
            
            const noiseLabelHTML = isNoise ? `<span class="noise-label">Viajeros que no encajan en ningún segmento estándar</span>` : '';
            
            div.innerHTML = `
                <div class="card-header">
                    <span class="card-color-indicator" style="background:${isNoise ? '#9CA3AF' : colors[card.cluster_id % colors.length]}"></span>
                    <span class="badge">#${card.cluster_id}</span>
                </div>
                <h4 class="card-title" title="${titleStr}">${titleStr}</h4>
                ${noiseLabelHTML}
                <div class="card-stats" style="${isNoise ? 'margin-top: 10px;' : ''}">
                    <span title="Tamaño del segmento">👥 ${card.size}</span>
                    <span title="ADR (Average Daily Rate): Gasto promedio diario estimado">💶 €${parseFloat(adrVal).toFixed(0)}</span>
                </div>
            `;
            div.addEventListener('click', () => onCardClick(card.cluster_id));
            scroller.appendChild(div);
        });
    },

    renderHotelSimilarityDisclaimer: (similarityInfo) => {
        const container = document.getElementById('hotel-disclaimer-container');
        if (!container) return;

        if (!similarityInfo || !similarityInfo.show_disclaimer) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = `
            <div class="disclaimer-box">
                <div class="disclaimer-header">
                    Hoteles con perfiles distintos
                </div>
                <div class="disclaimer-body">
                    Los hoteles seleccionados tienen características muy diferentes entre sí. 
                    Los segmentos mostrados son los más afines al conjunto, pero pueden no ser 
                    igualmente relevantes para cada hotel.
                </div>
                <div class="disclaimer-score">
                    Similitud entre hoteles: 
                    <span class="similarity-badge similarity-${similarityInfo.similarity_label.toLowerCase()}">
                        ${similarityInfo.similarity_label} (${Math.round(similarityInfo.similarity_score * 100)}%)
                    </span>
                </div>
            </div>
        `;
    },

    showAILoading: () => {
        dashboard.els.aiEmpty.classList.add('hidden');
        dashboard.els.aiResult.classList.add('hidden');
        dashboard.els.aiLoading.classList.remove('hidden');
    },

    showAIResult: (resultData, selectedHotelName = null) => {
        dashboard.els.aiLoading.classList.add('hidden');
        dashboard.els.aiResult.classList.remove('hidden');

        dashboard.els.aiBadge.textContent = `Segmento #${resultData.cluster_id}`;
        
        const useNaturalNames = document.getElementById('toggle-names')?.checked ?? true;
        dashboard.els.aiTitle.textContent = useNaturalNames ? resultData.cluster_name : `Segmento #${resultData.cluster_id}`;
        
        dashboard.els.aiSize.textContent = `${resultData.cluster_size} viajeros`;
        
        dashboard.els.btnExport.dataset.clusterId = resultData.cluster_id;

        if (selectedHotelName && selectedHotelName.trim() !== '' && selectedHotelName !== 'null' && selectedHotelName !== 'undefined') {
            dashboard.els.aiContextBanner.classList.remove('hidden');
            dashboard.els.aiContextHotel.textContent = selectedHotelName;
        } else {
            dashboard.els.aiContextBanner.classList.add('hidden');
        }

        const ul = dashboard.els.aiBullets;
        ul.innerHTML = '';
        if (resultData.bullets && resultData.bullets.length > 0) {
            resultData.bullets.forEach(b => {
                const li = document.createElement('li');
                li.textContent = b;
                ul.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = "No hay explicación disponible (verifica Vertex AI).";
            ul.appendChild(li);
        }
    }
};
