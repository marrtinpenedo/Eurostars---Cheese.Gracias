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

    init: (onSliderChange, onProjectBtn, onExportBtn) => {
        dashboard.els.slider.addEventListener('change', (e) => {
            const val = e.target.value;
            dashboard.els.sliderVal.textContent = val;
            onSliderChange(val);
        });

        dashboard.els.projectBtn.addEventListener('click', () => {
            const hid = dashboard.els.hotelDropdown.value;
            if(hid) onProjectBtn(hid);
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
        hotels.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h.id;
            opt.textContent = h.name;
            sel.appendChild(opt);
        });
    },

    renderCards: (cards, onCardClick) => {
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

        cards.forEach(card => {
            const div = document.createElement('div');
            div.className = 'segment-card';
            div.innerHTML = `
                <div class="card-header">
                    <span class="card-color-indicator" style="background:${colors[card.cluster_id % colors.length]}"></span>
                    <span class="badge">#${card.cluster_id}</span>
                </div>
                <h4 class="card-title">${card.name || 'Segmento ' + card.cluster_id}</h4>
                <div class="card-stats">
                    <span>👥 ${card.size}</span>
                    <span>💶 €${parseFloat(card.adr_mean || 0).toFixed(0)}</span>
                </div>
            `;
            div.addEventListener('click', () => onCardClick(card.cluster_id));
            scroller.appendChild(div);
        });
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
        dashboard.els.aiTitle.textContent = resultData.cluster_name;
        dashboard.els.aiSize.textContent = `${resultData.cluster_size} viajeros`;
        
        dashboard.els.btnExport.dataset.clusterId = resultData.cluster_id;

        if (selectedHotelName) {
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
            li.textContent = "No hay explicación disponible (verifica OpenAI API).";
            ul.appendChild(li);
        }
    }
};
