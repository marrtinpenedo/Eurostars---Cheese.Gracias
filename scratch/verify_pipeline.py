import os
import sys

# Change working directory so imports work correctly
project_root = '/home/mrtn/Desktop/Eurostars/stayprint'
os.chdir(project_root)
sys.path.append(project_root)

from fastapi.testclient import TestClient
from src.api.main import app

def run_tests():
    with TestClient(app) as client:
        print("Testing POST /api/pipeline/execute...")
        try:
            resp = client.post("/api/pipeline/execute")
            print("Status:", resp.status_code)
            print("Response:", resp.json())
        except Exception as e:
            print("Exception in execute:", e)
            return

        print("\nTesting POST /api/pipeline/recluster...")
        try:
            resp = client.post("/api/pipeline/recluster", json={"min_cluster_size": 5})
            print("Status:", resp.status_code)
            res_json = resp.json()
            print("N Clusters:", res_json.get("n_clusters"))
        except Exception as e:
            print("Exception in recluster:", e)

        print("\nTesting GET /api/clusters/summary...")
        try:
            resp = client.get("/api/clusters/summary")
            print("Status:", resp.status_code)
            res_json = resp.json()
            print(f"Got {len(res_json)} cluster cards format:", res_json[0] if res_json else "None")
        except Exception as e:
            print("Exception in summary:", e)

        print("\nTesting POST /api/hotels/project...")
        try:
            resp = client.post("/api/hotels/project", json={"hotel_id": "HTL_001"})
            print("Status:", resp.status_code)
            res_json = resp.json()
            print(f"Hotel projection response:", res_json)
        except Exception as e:
            print("Exception in hotel project:", e)


if __name__ == "__main__":
    run_tests()
