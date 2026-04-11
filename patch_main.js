const fs = require('fs');

let content = fs.readFileSync('frontend/assets/js/main.js', 'utf8');

// Replace appState with window.stayprintState
content = content.replace(/let appState = \{[\s\S]*?\};/, `
window.stayprintState = {
    ...(window.stayprintState || {}),
    numClusters: 0,
    activeHotels: [],
    affineClusters: new Set(),
    selectedCluster: null
};

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
            badge.textContent = \`Afín a \${names}\`;
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
            sideBadge.textContent = \`Afín a \${names}\`;
        }
    }
}

function onHotelProjected(responseData) {
    window.stayprintState.affineClusters = new Set(
        (responseData.affine_clusters || []).map(c => c.cluster_id)
    );
    window.syncAffinityUI();
}
`);

content = content.replace(/appState/g, 'window.stayprintState');

// Handle updateHotelProjection callback
content = content.replace(/const projData = await stayprintAPI\.projectHotel\(hotelIds\);/g, 
`const projData = await stayprintAPI.projectHotel(hotelIds);
        onHotelProjected(projData);`);

// Handle removeHotel function explicitly according to user guidelines
content = content.replace(/async function handleRemoveHotel[\s\S]*?\}/, 
`async function handleRemoveHotel(hotelId) {
    window.stayprintState.activeHotels = 
        window.stayprintState.activeHotels.filter(h => h.id !== hotelId);
    
    if (window.stayprintState.activeHotels.length === 0) {
        window.stayprintState.affineClusters = new Set(); // limpiar todo
        viz3d.clearScatterSelection(); // As a stand-in for clearHotelMarkersFromScatter
        updateHotelProjection(); // Need to recalculate without hotels to rerender scatter normally
    } else {
        await updateHotelProjection();
    }
    window.syncAffinityUI();
}`);

// Handle Cluster Click to set selectedCluster correctly
content = content.replace(/async function handleClusterClick\(clusterId\) \{/, 
`async function handleClusterClick(clusterId) {
    window.stayprintState.selectedCluster = clusterId;
    window.syncAffinityUI();
`);

fs.writeFileSync('frontend/assets/js/main.js', content);
console.log("main.js patched.");
