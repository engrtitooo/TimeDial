"""
BARE MINIMUM MAIN.PY
====================
This file imports NOTHING except standard FastAPI + uvicorn.
If this doesn't start, the issue is Docker/Cloud Run infrastructure.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

print("BOOT: Starting bare minimum server...", flush=True)

app = FastAPI(title="TimeDial Backend - Minimal Mode")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "mode": "minimal"}

@app.get("/")
def root():
    return {"message": "TimeDial is running in minimal diagnostic mode."}

# Serve Frontend (if build exists)
if os.path.exists("dist"):
    print("BOOT: Found dist folder, mounting static files...", flush=True)
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

print("BOOT: App object created, now starting uvicorn...", flush=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"BOOT: Binding to port {port}...", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)