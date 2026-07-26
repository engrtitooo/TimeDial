import os
import smtplib
import urllib.request
import urllib.parse
import json
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Tuple

logger = logging.getLogger("TimeDial.Email")

def mask_email(email: str) -> str:
    """
    Masks an email address for UI privacy.
    Example: 'user@example.com' -> 'us***r@example.com'
    """
    if not email or '@' not in email:
        return email or ""
        
    parts = email.split('@', 1)
    name, domain = parts[0], parts[1]
    
    if len(name) <= 2:
        masked_name = name[0] + "*"
    elif len(name) == 3:
        masked_name = name[0] + "*" + name[-1]
    else:
        masked_name = name[:2] + "***" + name[-1]
        
    return f"{masked_name}@{domain}"

def send_2fa_code(recipient_email: str, code: str) -> Tuple[bool, str]:
    """
    Dispatches the 6-digit 2FA verification code via:
    1. Resend API (if RESEND_API_KEY is configured)
    2. SMTP (if SMTP_HOST is configured)
    3. Dev Console Fallback (prominently logs code to console)
    """
    resend_api_key = os.getenv("RESEND_API_KEY", "").strip()
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASS", "").strip()
    smtp_from = os.getenv("SMTP_FROM", "TimeDial Security <noreply@timedial.app>").strip()
    smtp_secure = os.getenv("SMTP_SECURE", "false").lower() in ("true", "1", "yes")
    
    subject = "🔑 TimeDial Security Verification Code"
    html_body = f"""
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #050510; color: #e2e8f0; padding: 40px 20px; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(251, 191, 36, 0.2);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #fbbf24; font-size: 28px; letter-spacing: 4px; margin: 0;">TIMEDIAL</h1>
        <p style="color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Security Authentication</p>
      </div>
      <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
        <p style="font-size: 14px; color: #94a3b8; margin-bottom: 16px;">Your 6-digit verification code is:</p>
        <div style="font-size: 36px; font-weight: bold; color: #fbbf24; letter-spacing: 8px; font-family: monospace; background: #020617; padding: 12px 24px; border-radius: 8px; display: inline-block; border: 1px solid rgba(251, 191, 36, 0.3);">
          {code}
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 16px;">This code will expire in <strong>5 minutes</strong>. If you did not request this code, please secure your server credentials immediately.</p>
      </div>
    </div>
    """
    
    text_body = f"TimeDial 2FA Code: {code}\nThis code expires in 5 minutes."

    # --- 1. Try Resend API ---
    if resend_api_key:
        try:
            req_data = json.dumps({
                "from": smtp_from,
                "to": [recipient_email],
                "subject": subject,
                "html": html_body,
                "text": text_body
            }).encode('utf-8')
            
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=req_data,
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status in (200, 201):
                    print(f"EMAIL [Resend]: 2FA code successfully dispatched to {mask_email(recipient_email)}", flush=True)
                    log_dev_fallback_console(recipient_email, code, "Dispatched via Resend API")
                    return True, "Email sent via Resend API"
        except Exception as e:
            print(f"EMAIL [Resend Error]: Failed to send via Resend API: {e}", flush=True)

    # --- 2. Try Nodemailer / SMTP ---
    if smtp_host:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_from
            msg["To"] = recipient_email
            
            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))
            
            if smtp_secure or smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                server.starttls()
                
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
                
            server.sendmail(smtp_from, [recipient_email], msg.as_string())
            server.quit()
            
            print(f"EMAIL [SMTP]: 2FA code successfully dispatched to {mask_email(recipient_email)}", flush=True)
            log_dev_fallback_console(recipient_email, code, "Dispatched via SMTP")
            return True, "Email sent via SMTP"
        except Exception as e:
            print(f"EMAIL [SMTP Error]: Failed to send via SMTP: {e}", flush=True)

    # --- 3. Dev Console Fallback ---
    log_dev_fallback_console(recipient_email, code, "Dev Console Fallback (No Email Provider Configured)")
    return True, "2FA code logged to Dev Console (Fallback Mode)"

def log_dev_fallback_console(recipient: str, code: str, reason: str):
    """Prominently displays the 2FA code in the server log terminal to prevent developer lockout."""
    box = f"""
+====================================================================+
|                    TIMEDIAL 2FA SECURITY CODE                      |
+====================================================================+
|  REASON: {reason:<53} |
|  RECIPIENT: {mask_email(recipient):<50} |
|                                                                    |
|  >>> VERIFICATION CODE:  {code}  <<<                          |
|                                                                    |
|  EXPIRATION: 5 Minutes                                             |
+====================================================================+
"""
    print(box, flush=True)
