"""
SMS gateway for Talisman PIN recovery.

Supports:
- mock: logs SMS to console (development)
- stub: same as the existing SMS_PROVIDER stub
- twilio: Twilio API (production)

Configure via SMS_PROVIDER env var.
"""
import logging
import os

logger = logging.getLogger("talisman.sms")


class SMSService:
    def __init__(self) -> None:
        self.provider = os.getenv("SMS_PROVIDER", "stub")

    async def send(self, to: str, message: str) -> bool:
        if self.provider in ("stub", "mock"):
            logger.info("[SMS STUB] To: %s | Message: %s", to, message)
            return True

        if self.provider == "twilio":
            return await self._send_twilio(to, message)

        logger.warning("Unknown SMS provider: %s", self.provider)
        return False

    async def _send_twilio(self, to: str, message: str) -> bool:
        try:
            import httpx

            sid = os.getenv("TWILIO_SID", "")
            token = os.getenv("TWILIO_TOKEN", "")
            from_number = os.getenv("TWILIO_FROM_NUMBER", "")
            if not sid or not token or not from_number:
                logger.error("Twilio credentials not configured")
                return False

            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                    auth=(sid, token),
                    data={"To": to, "From": from_number, "Body": message},
                )
                if resp.status_code == 201:
                    logger.info("SMS sent to %s via Twilio", to)
                    return True
                logger.error("Twilio error %d: %s", resp.status_code, resp.text)
                return False
        except Exception as e:
            logger.error("Twilio send failed: %s", e)
            return False


sms_service = SMSService()
