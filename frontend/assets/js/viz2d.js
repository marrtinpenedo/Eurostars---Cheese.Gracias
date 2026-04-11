/**
 * STAYPRINT - Viz 2D Module (D3 Venn Diagram)
 */

export const viz2d = {
    containerId: 'venn-container',
    
    render: (clusterCards, activeHotels, affineClusters, onClusterClick) => {
        const container = document.getElementById(viz2d.containerId);
        container.innerHTML = ""; // Clear existing SVG
        
        if (!clusterCards || clusterCards.length === 0) return;

        // Utilizamos los mismos colores del espacio 3D para mantener consistencia visual
        const colors = [
            "#2563EB", "#16A34A", "#DC2626", "#D97706", "#7C3AED", 
            "#0891B2", "#BE185D", "#065F46", "#EAB308", "#06B6D4"
        ];
        const HOTEL_COLORS = ['#1A1D23', '#92400E', '#4C1D95'];

        // Dimensiones del contenedor (resolución interna)
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 500;

        const svg = d3.select(container).append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("overflow", "visible");

        // Tooltip global para el document body
        let tooltip = d3.select("body").select(".d3-tooltip");
        if (tooltip.empty()) {
            tooltip = d3.select("body").append("div")
                .attr("class", "d3-tooltip")
                .style("position", "absolute")
                .style("visibility", "hidden")
                .style("background", "rgba(15, 23, 42, 0.9)")
                .style("color", "#fff")
                .style("padding", "8px 12px")
                .style("border-radius", "6px")
                .style("font-family", "Inter, sans-serif")
                .style("font-size", "12px")
                .style("pointer-events", "none")
                .style("z-index", "9999")
                .style("box-shadow", "0 4px 6px rgba(0,0,0,0.1)");
        }

        // Determinar límites de la matemática 2D original
        const xExtent = d3.extent(clusterCards, d => d.centroid_2d ? d.centroid_2d[0] : 0);
        const yExtent = d3.extent(clusterCards, d => d.centroid_2d ? d.centroid_2d[1] : 0);
        const sizeExtent = d3.extent(clusterCards, d => d.size);

        // Agregamos padding para que los círculos grandes no se recorten en los bordes
        const padding = 120;
        
        // Mapeo espacial puro, sin simulaciones cliente
        const xScale = d3.scaleLinear().domain(xExtent).range([padding, width - padding]);
        // Invertimos el eje Y para alinear con la topografía estándar cartesiana de UMAP
        const yScale = d3.scaleLinear().domain(yExtent).range([height - padding, padding]);
        
        // Raíz cuadrada del tamaño (área) mapeado radialmente
        const rScale = d3.scaleSqrt().domain([0, sizeExtent[1]]).range([20, 80]); 
        
        // Set de afinidades
        const hasHotels = activeHotels && activeHotels.length > 0;
        const affineSet = new Set(affineClusters || []);

        // --- RENDER CLUSTERS ---
        const clusters = svg.selectAll(".cluster-group")
            .data(clusterCards)
            .enter()
            .append("g")
            .attr("class", "cluster-group")
            .attr("transform", d => `translate(${xScale(d.centroid_2d ? d.centroid_2d[0] : 0)}, ${yScale(d.centroid_2d ? d.centroid_2d[1] : 0)})`)
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                if (onClusterClick) onClusterClick(d.cluster_id);
            })
            .on("mouseover", (event, d) => {
                // Cálculo de tags principales del cluster
                const m = d.metrics || {};
                let sortedMetrics = [
                    {name: 'Playa', val: m.beach || 0},
                    {name: 'Montaña', val: m.mountain || 0},
                    {name: 'Cultura', val: m.heritage || 0},
                    {name: 'Gastronomía', val: m.gastronomy || 0}
                ].sort((a,b) => b.val - a.val);

                let topMetrics = `${sortedMetrics[0].name} (${(sortedMetrics[0].val*100).toFixed(0)}%)`;
                if(sortedMetrics[1].val > 0.1) topMetrics += `, ${sortedMetrics[1].name} (${(sortedMetrics[1].val*100).toFixed(0)}%)`;

                const html = `
                    <div style="font-weight:bold; margin-bottom:4px;">${d.name || `Segmento #${d.cluster_id}`}</div>
                    <div style="margin-bottom:2px;">Segmento: ${d.size} viajeros</div>
                    <div>Preferencia: ${topMetrics}</div>
                `;
                tooltip.html(html).style("visibility", "visible");
                d3.select(event.currentTarget).select("circle").attr("stroke", "#fff").attr("stroke-width", 2);
            })
            .on("mousemove", (event) => {
                tooltip.style("top", (event.pageY + 15) + "px").style("left", (event.pageX + 15) + "px");
            })
            .on("mouseout", (event) => {
                tooltip.style("visibility", "hidden");
                d3.select(event.currentTarget).select("circle").attr("stroke", "none");
            });

        clusters.append("circle")
            .attr("r", d => rScale(d.size))
            .attr("fill", d => colors[d.cluster_id % colors.length])
            .attr("opacity", d => {
                if (!hasHotels) return 0.75; 
                return affineSet.has(d.cluster_id) ? 0.9 : 0.15;
            })
            .style("mix-blend-mode", "multiply")
            .style("transition", "opacity 0.4s ease");

        clusters.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", ".35em")
            .style("fill", "white")
            .style("font-size", "13px")
            .style("font-weight", "600")
            .style("pointer-events", "none")
            .style("text-shadow", "0px 1px 4px rgba(0,0,0,0.6)")
            .text(d => {
                const parts = (d.name || `C${d.cluster_id}`).split(" ");
                return parts[0]; 
            })
            .attr("opacity", d => (!hasHotels || affineSet.has(d.cluster_id)) ? 1 : 0.3);

        // --- RENDER ACTVE HOTELS ---
        if (hasHotels) {
            const hPoints = activeHotels.map((hotel, idx) => {
                const affinesForHotel = clusterCards.filter(c => affineSet.has(c.cluster_id));
                let hx = width / 2;
                let hy = height / 2;
                
                if (affinesForHotel.length > 0) {
                    const totalSize = d3.sum(affinesForHotel, c => c.size);
                    hx = d3.sum(affinesForHotel, c => xScale(c.centroid_2d[0]) * c.size) / totalSize;
                    hy = d3.sum(affinesForHotel, c => yScale(c.centroid_2d[1]) * c.size) / totalSize;
                }
                return { hotel, idx, hx, hy };
            });

            const groups = [];
            hPoints.forEach(pt => {
                let g = groups.find(g => Math.abs(g.hx - pt.hx) < 0.01 && Math.abs(g.hy - pt.hy) < 0.01);
                if (!g) {
                    g = { hx: pt.hx, hy: pt.hy, items: [] };
                    groups.push(g);
                }
                g.items.push(pt);
            });

            groups.forEach(g => {
                const N = g.items.length;
                g.items.forEach((pt, i) => {
                    let finalX = pt.hx;
                    let finalY = pt.hy;
                    
                    if (N > 1) {
                        const angle = (2 * Math.PI / N) * i;
                        finalX += Math.cos(angle) * 18;
                        finalY += Math.sin(angle) * 18;
                    }

                    const gHotel = svg.append("g")
                        .attr("transform", `translate(${finalX}, ${finalY})`)
                        .style("cursor", "crosshair")
                        .on("mouseover", () => {
                            tooltip.html(`<b>${pt.hotel.name}</b><br>Posición afín ponderada`)
                                .style("visibility", "visible");
                        })
                        .on("mousemove", (event) => {
                            tooltip.style("top", (event.pageY + 15) + "px").style("left", (event.pageX + 15) + "px");
                        })
                        .on("mouseout", () => tooltip.style("visibility", "hidden"));

                    // Símbolo diamante (Eurostars)
                    const symbol = d3.symbol().type(d3.symbolDiamond).size(450);
                    gHotel.append("path")
                        .attr("d", symbol)
                        .attr("fill", HOTEL_COLORS[pt.idx] || '#1A1D23')
                        .attr("stroke", "#ffffff")
                        .attr("stroke-width", 2)
                        .style("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.4))");

                    let textY = -20;
                    if (N > 1) {
                        // Spread vertical armónico centrado en -20px original (20px de salto)
                        const totalSpread = (N - 1) * 20; 
                        const startY = -20 - (totalSpread / 2);
                        textY = startY + (i * 20);
                    }

                    gHotel.append("text")
                        .attr("y", textY)
                        .attr("text-anchor", "middle")
                        .style("font-size", "14px")
                        .style("font-weight", "bold")
                        .style("fill", "#1A1D23")
                        .style("pointer-events", "none")
                        .style("text-shadow", "0px 0px 4px white, 0px 0px 8px white")
                        .text(pt.hotel.name);
                });
            });
        }
    }
};
