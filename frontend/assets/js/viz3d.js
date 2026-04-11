/**
 * STAYPRINT - Viz 3D Module
 * Renderea el scatter 3D con Plotly y maneja clicks.
 */

export const viz3d = {
    plotId: 'plot3d',
    currentData: null,
    currentHotel: null,

    initPlot: () => {
        document.getElementById('loader-3d').classList.remove('hidden');
    },

    /**
     * scatterData: array de {x, y, z, cluster, guest_id}
     * numClusters: int
     * projData: opcional {hotels: [{id, name, coords_3d}], affine_clusters}
     */
    render: (scatterData, numClusters, projData = null, onClusterClick = null) => {
        document.getElementById('loader-3d').classList.add('hidden');
        viz3d.currentData = scatterData;
        viz3d.currentHotel = projData; // internally kept as projData

        const container = document.getElementById(viz3d.plotId);
        
        let traces = [];
        const HOTEL_COLORS = ['#1A1D23', '#92400E', '#4C1D95'];
        
        // Group points by cluster
        const grouped = {};
        scatterData.forEach(d => {
            if (!grouped[d.cluster]) grouped[d.cluster] = {x:[], y:[], z:[], text:[], ids:[]};
            let affinePrefix = "";
            let hlMode = false;
            
            if (projData && projData.affine_clusters) {
                const cId = d.cluster;
                const isAffine = projData.affine_clusters.some(c => c.cluster_id === cId);
                if (isAffine) {
                    affinePrefix = "⭐ AFÍN - ";
                    hlMode = true;
                }
            }

            grouped[d.cluster].x.push(d.x);
            grouped[d.cluster].y.push(d.y);
            grouped[d.cluster].z.push(d.z);
            grouped[d.cluster].text.push(`${affinePrefix}Cluster ${d.cluster}`);
            grouped[d.cluster].ids.push(d.guest_id);
        });

        const colors = [
            "#2563EB", "#16A34A", "#DC2626", "#D97706", "#7C3AED", 
            "#0891B2", "#BE185D", "#065F46", "#EAB308", "#06B6D4"
        ];

        Object.keys(grouped).forEach((k) => {
            let opacity = 0.6;
            let size = 3;
            // Highlight logic
            if (projData) {
                const isAffine = projData.affine_clusters.some(c => c.cluster_id === parseInt(k));
                if (isAffine) {
                    opacity = 0.9;
                    size = 5;
                } else {
                    opacity = 0.1;
                }
            }
            
            traces.push({
                x: grouped[k].x, y: grouped[k].y, z: grouped[k].z,
                mode: 'markers',
                type: 'scatter3d',
                name: `Segmento ${k}`,
                text: grouped[k].text,
                hoverinfo: 'text',
                marker: {
                    size: size,
                    color: colors[parseInt(k) % colors.length],
                    opacity: opacity,
                    line: { width: 0 }
                },
                customdata: grouped[k].x.map(() => parseInt(k))
            });
        });

        // Hotels projection markers
        if (projData && projData.hotels) {
            projData.hotels.forEach((hotel, index) => {
                traces.push({
                    x: [hotel.coords_3d[0]],
                    y: [hotel.coords_3d[1]],
                    z: [hotel.coords_3d[2]],
                    mode: 'markers+text',
                    type: 'scatter3d',
                    name: `🏨 ${hotel.name}`,
                    text: [`🏨 ${hotel.name}`],
                    textposition: 'top center',
                    textfont: { color: '#1A1D23', size: 14, weight: 'bold' },
                    hoverinfo: 'text',
                    marker: {
                        size: 15,
                        color: HOTEL_COLORS[index] || '#1A1D23',
                        symbol: 'diamond'
                    }
                });
            });
        }

        const layout = {
            margin: {l: 0, r: 0, b: 0, t: 0},
            paper_bgcolor: '#FFFFFF',
            plot_bgcolor: '#F5F6F8',
            scene: {
                bgcolor: '#F5F6F8',
                xaxis: { showgrid: true, gridcolor: '#E5E7EB', color: '#6B7280', zeroline: false, showline: false },
                yaxis: { showgrid: true, gridcolor: '#E5E7EB', color: '#6B7280', zeroline: false, showline: false },
                zaxis: { showgrid: true, gridcolor: '#E5E7EB', color: '#6B7280', zeroline: false, showline: false },
                camera: { eye: {x: 1.5, y: 1.5, z: 0.5} }
            },
            font: { color: '#1A1D23', family: 'Inter, system-ui, sans-serif' },
            showlegend: false
        };

        Plotly.newPlot(container, traces, layout, {displayModeBar: false});

        if (onClusterClick) {
            container.on('plotly_click', function(data) {
                if(data.points && data.points[0] && data.points[0].customdata !== undefined){
                    const clickedClusterId = data.points[0].customdata;
                    onClusterClick(clickedClusterId);
                }
            });
        }
    }
};
