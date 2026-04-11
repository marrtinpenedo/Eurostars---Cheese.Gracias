import requests
import time

URL = "http://localhost:8000"

def test_everything():
    print("1. Esperando...")
    time.sleep(2)
    
    print("2. Ejecutando pipeline /api/pipeline/execute")
    r = requests.post(f"{URL}/api/pipeline/execute")
    if r.status_code != 200:
        print(f"Error ejectuando pipeline: {r.text}")
        return
    res = r.json()
    opt = res.get("suggestion", {}).get("optimal_min_cluster_size", 10)
    print(f"Pipeline etapa 1 lista. Optimo min_size: {opt}")

    print("3. Ejecutando Recluster /api/pipeline/recluster")
    r = requests.post(f"{URL}/api/pipeline/recluster", json={"min_cluster_size": opt})
    if r.status_code != 200:
        print(f"Error recluster: {r.text}")
        return
    n_clusters = r.json().get("n_clusters")
    print(f"Recluster ejecutado. Clusters: {n_clusters}")
    
    print("4. Obtieniendo resumen de cluster /api/clusters/summary")
    r = requests.get(f"{URL}/api/clusters/summary")
    if r.status_code != 200:
        print(f"Error summary: {r.text}")
        return
    clusters = r.json()
    print(f"Summary Clusters cargados: {len(clusters)}")
    
    # Test Cluster AI explanation
    first_cluster_id = clusters[0]['cluster_id']
    print(f"5. Testeando Explicador LLM Vertex para Cluster {first_cluster_id}")
    r = requests.post(f"{URL}/api/clusters/{first_cluster_id}/explain", json={"hotel_name": ""})
    if r.status_code != 200:
        print(f"Error LLM explanation: {r.text}")
        return
    print(f"LLM Explicación Recibida: {r.json().get('cluster_name')} -> {r.json().get('bullets')}")
    
    print("✅ Todo el flujo verificado correctamente!")

test_everything()
