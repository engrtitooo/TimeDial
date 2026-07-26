import os
import time
import hmac
import hashlib
import json
import base64
import secrets
from typing import Dict, Optional, Tuple
from fastapi import Request, HTTPException, status

# Default configuration from environment
JWT_SECRET = os.getenv("JWT_SECRET", "default_timedial_secure_hmac_secret_key_2026")
APP_PASSWORD = os.getenv("APP_PASSWORD", "YourStrongMasterPasswordHere!2026")

# In-memory storage for active 2FA challenges
# Format: { challenge_token: { "code": "123456", "expires_at": float, "attempts": int } }
_challenges: Dict[str, dict] = {}

# In-memory rate limiting per IP per endpoint
# Format: { "ip:endpoint": [timestamp1, timestamp2, ...] }
_rate_limits: Dict[str, list] = {}

def is_rate_limited(ip: str, endpoint: str, max_requests: int = 5, window_seconds: int = 60) -> bool:
    """Sliding window rate limiter to prevent brute-force attacks."""
    now = time.time()
    key = f"{ip}:{endpoint}"
    
    # Cleanup expired entries
    timestamps = [ts for ts in _rate_limits.get(key, []) if now - ts < window_seconds]
    _rate_limits[key] = timestamps
    
    if len(timestamps) >= max_requests:
        return True
    
    timestamps.append(now)
    _rate_limits[key] = timestamps
    return False

def generate_challenge(code_ttl_seconds: int = 300) -> Tuple[str, str]:
    """Generates a 6-digit OTP code and a cryptographically secure challenge token."""
    # 6-digit verification code
    code = f"{secrets.randbelow(900000) + 100000}"
    challenge_token = secrets.token_urlsafe(32)
    
    # Clean up expired challenges
    now = time.time()
    expired = [k for k, v in _challenges.items() if v["expires_at"] < now]
    for k in expired:
        del _challenges[k]
        
    _challenges[challenge_token] = {
        "code": code,
        "expires_at": now + code_ttl_seconds,
        "attempts": 0
    }
    
    return challenge_token, code

def verify_challenge(challenge_token: str, input_code: str, max_attempts: int = 5) -> Tuple[bool, str]:
    """Verifies a 2FA OTP code against the stored challenge token."""
    now = time.time()
    challenge = _challenges.get(challenge_token)
    
    if not challenge:
        return False, "Invalid or expired challenge token."
        
    if now > challenge["expires_at"]:
        del _challenges[challenge_token]
        return False, "Verification code has expired. Please request a new code."
        
    challenge["attempts"] += 1
    if challenge["attempts"] > max_attempts:
        del _challenges[challenge_token]
        return False, "Maximum verification attempts exceeded. Please try again."
        
    if challenge["code"] != input_code.strip():
        return False, f"Incorrect verification code. Attempts remaining: {max_attempts - challenge['attempts']}."
        
    # Verification successful - invalidate challenge token
    del _challenges[challenge_token]
    return True, "Code verified successfully."

def create_session_token(sub: str = "admin", ttl_seconds: int = 86400) -> str:
    """Creates a signed HMAC-SHA256 session token valid for 24 hours."""
    now = int(time.time())
    payload = {
        "sub": sub,
        "iat": now,
        "exp": now + ttl_seconds
    }
    
    payload_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode('utf-8').rstrip('=')
    
    signature = hmac.new(
        JWT_SECRET.encode('utf-8'),
        payload_b64.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return f"{payload_b64}.{signature}"

def verify_session_token(token: str) -> Optional[dict]:
    """Validates a signed HMAC-SHA256 session token and checks expiration."""
    try:
        parts = token.split('.')
        if len(parts) != 2:
            return None
            
        payload_b64, signature = parts[0], parts[1]
        
        # Verify HMAC signature
        expected_sig = hmac.new(
            JWT_SECRET.encode('utf-8'),
            payload_b64.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_sig):
            return None
            
        # Decode payload
        padding = '=' * (-len(payload_b64) % 4)
        payload_bytes = base64.urlsafe_b64decode(payload_b64 + padding)
        payload = json.loads(payload_bytes.decode('utf-8'))
        
        # Check expiration
        if int(time.time()) > payload.get("exp", 0):
            return None
            
        return payload
    except Exception:
        return None

def get_current_session(request: Request) -> dict:
    """FastAPI dependency to protect routes with HttpOnly session cookie or Bearer token."""
    token = request.cookies.get("session_token")
    
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing session cookie or token."
        )
        
    payload = verify_session_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication session."
        )
        
    return payload
