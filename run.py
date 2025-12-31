
import os
import sys
import traceback

print("BOOTSTRAP: Starting application...", flush=True)

try:
    # 1. Test Key Imports
    print("BOOTSTRAP: Testing imports...", flush=True)
    import uvicorn
    import fastapi
    import pydantic
    try:
        from google import genai
        print("BOOTSTRAP: google.genai imported successfully.", flush=True)
    except ImportError:
        print("BOOTSTRAP WARNING: Could not import google.genai. Check requirements.", flush=True)
    
    # 2. Import Main Application
    print("BOOTSTRAP: Importing main app...", flush=True)
    from main import app
    print("BOOTSTRAP: Main app imported successfully.", flush=True)

    # 3. Start Server
    port = int(os.environ.get("PORT", 8080))
    print(f"BOOTSTRAP: Starting Uvicorn on port {port}...", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)

except Exception as e:
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", flush=True)
    print("BOOTSTRAP CRITICAL ERROR: Application failed to start!", flush=True)
    print(f"Error Type: {type(e).__name__}", flush=True)
    print(f"Error Message: {str(e)}", flush=True)
    print("Traceback:", flush=True)
    traceback.print_exc()
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", flush=True)
    sys.exit(1)
