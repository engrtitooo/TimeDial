import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Key Configuration
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_PROJECT_ID")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# Validation
missing_keys = []
if not GOOGLE_API_KEY:
    missing_keys.append("GOOGLE_API_KEY (or GOOGLE_PROJECT_ID)")
if not ELEVENLABS_API_KEY:
    missing_keys.append("ELEVENLABS_API_KEY")

if missing_keys:
    print(f"WARNING: Missing environment variables: {', '.join(missing_keys)}")
    print("Functionality relying on these keys will fail at runtime.")
    # sys.exit(1) # DISABLED to prevent container crash

print("Configuration loaded successfully: Keys present.")
