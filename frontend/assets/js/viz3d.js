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
     * projHotel: opcional {name, coords_3d: [x,y,z], affine_clusters}
     */
    render: (scatterData, numClusters, projHotel = null, onClusterClick = null) => {
        document.getElementById('loader-3d').classList.add('hidden');
        viz3d.currentData = scatterData;
        viz3d.currentHotel = projHotel;

        const container = document.getElementById(viz3d.plotId);
        
        let traces = [];
        
        // Group points by cluster
        const grouped = {};
        scatterData.forEach(d => {
            if (!grouped[d.cluster]) grouped[d.cluster] = {x:[], y:[], z:[], text:[], ids:[]};
            let affinePrefix = "";
            let hlMode = false;
            
            if (projHotel && projHotel.affine_clusters) {
                // If hotel projected, check if this point belongs to an affine cluster
                const cId = d.cluster;
                const isAffine = projHotel.affine_clusters.some(c => c.cluster_id === cId);
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

        // Palette generator
        const colors = [
            "#7C3AED", "#10B981", "#DB2777", "#F59E0B", "#3B82F6", 
            "#8B5CF6", "#14B8A6", "#F43F5E", "#EAB308", "#06B6D4",
            "#D946EF", "#6366F1", "#EC4899", "#84CC16", "#22D3EE"
        ];

        // Create a trace per cluster
        Object.keys(grouped).forEach((k) => {
            let opacity = 0.6;
            let size = 3;
            // Highlight logic
            if (projHotel) {
                const isAffine = projHotel.affine_clusters.some(c => c.cluster_id === parseInt(k));
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
                    opacity: opacity
                },
                customdata: grouped[k].x.map(() => parseInt(k)) // Store cluster ID for click events
            });
        });

        // Si hay hotel, dibujar un marcador especial
        if (projHotel) {
            traces.push({
                x: [projHotel.coords_3d[0]],
                y: [projHotel.coords_3d[1]],
                z: [projHotel.coords_3d[2]],
                mode: 'markers+text',
                type: 'scatter3d',
                name: `🏨 ${projHotel.hotel_name}`,
                text: [`🏨 ${projHotel.hotel_name}`],
                textposition: 'top center',
                textfont: { color: '#FFFFFF', size: 14, weight: 'bold' },
                hoverinfo: 'text',
                marker: {
                    size: 15,
                    color: '#FFFFFF',
                    symbol: 'diamond'
                }
            });
        }

        const layout = {
            margin: {l: 0, r: 0, b: 0, t: 0},
            paper_bgcolor: 'rgba(0,0,0,0)',
            scene: {
                xaxis: { showgrid: true, zeroline: false, showline: false, visible: false },
                yaxis: { showgrid: true, zeroline: false, showline: false, visible: false },
                zaxis: { showgrid: true, zeroline: false, showline: false, visible: false },
                camera: { eye: {x: 1.5, y: 1.5, z: 0.5} }
            },
            showlegend: false
        };

        Plotly.newPlot(container, traces, layout, {displayModeBar: false});

        // Bind click event
        if (onClusterClick) {
            container.on('plotly_click', function(data) {
                if(data.points[0].customdata !== undefined){
                    const clickedClusterId = data.points[0].customdata;
                    onClusterClick(clickedClusterId);
                }
            });
        }
    }
};
