"""
MonCash REST API integration for Talisman.

MonCash is a mobile money payment service by Digicel Haiti. This module implements
the server-side integration with the MonCash Business REST API.

API docs: https://sandbox.moncashbutton.digicelgroup.com/Moncash-business/

=== Authentication ===
MonCash uses OAuth2 client_credentials grant. We exchange our client_id + client_secret
for a short-lived Bearer token via POST /Api/oauth/token.

=== Payment Flow ===
1. Our backend calls POST /Api/v1/CreatePayment with {amount, orderId}.
   MonCash returns a payment token and a redirect URL.
2. We redirect (or instruct the frontend to redirect) the customer to the MonCash
   payment page, where they approve the payment on their phone.
3. MonCash redirects back to our MONCASH_CALLBACK_URL with a transactionId.
4. We call POST /Api/v1/RetrieveTransactionPayment to verify the payment status.
5. On success, we mark the order/payment as completed in our database.

=== Configuration ===
Required environment variables (see .env.example):
  - MONCASH_CLIENT_ID: OAuth2 client ID from MonCash Business dashboard
  - MONCASH_CLIENT_SECRET: OAuth2 client secret
  - MONCASH_IS_SANDBOX: "true" for sandbox, "false" for production
  - MONCASH_CALLBACK_URL: Public URL that MonCash redirects to after payment

When credentials are not configured, the service returns mock responses so the app
can run in development/demo mode without a real MonCash account.
"""

import httpx
from pydantic_settings import BaseSettings


class MonCashNotConfiguredError(Exception):
    """Raised when a MonCash API call is attempted but credentials are not configured.

    This is a soft error — callers can catch it and fall back to manual payment
    confirmation or mock responses. It should NOT be raised during normal operation
    when the service is properly configured.
    """
    pass


class MonCashSettings(BaseSettings):
    """MonCash configuration loaded from environment variables.

    Attributes:
        moncash_client_id: OAuth2 client ID from the MonCash Business dashboard.
        moncash_client_secret: OAuth2 client secret.
        moncash_is_sandbox: When True, uses the sandbox API endpoint.
        moncash_callback_url: The public URL that MonCash will redirect to after
            the customer completes (or cancels) their payment. Must be registered
            in the MonCash Business dashboard.
    """
    moncash_client_id: str = ""
    moncash_client_secret: str = ""
    moncash_is_sandbox: bool = True
    moncash_callback_url: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


class MonCashService:
    """Client for the MonCash Business REST API.

    Usage:
        service = MonCashService()
        if not service.is_configured:
            # Running without MonCash — use manual payment flow
            pass
        else:
            result = await service.create_payment(amount=500.0, order_id="ORD-123")
            # result contains redirect_url for customer

    When credentials are not set (development/demo mode), all methods return
    mock responses instead of raising errors, allowing the app to function
    without a live MonCash account.
    """

    def __init__(self, settings: MonCashSettings | None = None):
        """Initialize the MonCash service.

        Args:
            settings: Optional MonCashSettings instance. If not provided,
                settings are loaded from environment variables / .env file.
        """
        s = settings or MonCashSettings()
        self.base_url = (
            "https://sandbox.moncashbutton.digicelgroup.com"
            if s.moncash_is_sandbox
            else "https://moncashbutton.digicelgroup.com"
        )
        self.client_id = s.moncash_client_id
        self.client_secret = s.moncash_client_secret
        self.callback_url = s.moncash_callback_url
        self._token: str | None = None

    @property
    def is_configured(self) -> bool:
        """Check whether MonCash credentials are set.

        Returns True only if both client_id and client_secret are non-empty.
        This allows callers to decide whether to use MonCash or fall back
        to an alternative payment flow.
        """
        return bool(self.client_id and self.client_secret)

    async def _get_token(self) -> str:
        """Exchange client credentials for an OAuth2 access token.

        Makes a POST request to the MonCash OAuth2 token endpoint using the
        client_credentials grant type. The token is cached for subsequent calls
        within the same service instance.

        Returns:
            The access token string.

        Raises:
            MonCashNotConfiguredError: If credentials are not set.
            httpx.HTTPStatusError: If the token request fails.
        """
        if not self.is_configured:
            raise MonCashNotConfiguredError(
                "MonCash client_id and client_secret must be set. "
                "See .env.example for required environment variables."
            )
        if self._token:
            return self._token
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/Api/oauth/token",
                data={"grant_type": "client_credentials", "scope": "read,write"},
                auth=(self.client_id, self.client_secret),
            )
            resp.raise_for_status()
            self._token = resp.json()["access_token"]
            return self._token

    async def create_payment(self, amount: float, order_id: str) -> dict:
        """Initiate a MonCash payment request.

        Calls POST /Api/v1/CreatePayment to start a new payment. MonCash returns
        a payment token that should be used to redirect the customer to the
        MonCash payment page.

        Args:
            amount: Payment amount in HTG (Haitian Gourdes). Must be positive.
            order_id: A unique identifier for this order/transaction on our side.
                MonCash uses this to link the payment back to our system.

        Returns:
            A dict with payment details. When configured, includes the MonCash
            response with redirect URL. When not configured, returns a mock
            response for development/testing.
        """
        if not self.is_configured:
            return {
                "status": "mock",
                "message": "MonCash API not configured. Using manual confirmation flow.",
                "order_id": order_id,
                "amount": amount,
                "redirect_url": None,
                "mock": True,
            }
        token = await self._get_token()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/Api/v1/CreatePayment",
                json={"amount": amount, "orderId": order_id},
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            data = resp.json()
            # Build the redirect URL for the customer
            payment_token = data.get("payment_token", {}).get("token", "")
            redirect_url = (
                f"{self.base_url}/Moncash-business/Payment/Redirect"
                f"?token={payment_token}"
            ) if payment_token else None
            return {
                "status": "created",
                "order_id": order_id,
                "amount": amount,
                "redirect_url": redirect_url,
                "raw_response": data,
            }

    async def verify_payment(self, transaction_id: str) -> dict:
        """Verify a payment by its MonCash transaction ID.

        After the customer completes payment, MonCash redirects to our callback URL
        with a transactionId parameter. Call this method to confirm the payment
        was successful and retrieve the transaction details.

        Args:
            transaction_id: The transactionId received from MonCash via the
                callback redirect.

        Returns:
            A dict with transaction details. When configured, includes the full
            MonCash verification response. When not configured, returns a mock
            response for development/testing.
        """
        if not self.is_configured:
            return {
                "status": "mock",
                "message": "MonCash API not configured. Cannot verify payment.",
                "transaction_id": transaction_id,
                "mock": True,
            }
        token = await self._get_token()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/Api/v1/RetrieveTransactionPayment",
                json={"transactionId": transaction_id},
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            data = resp.json()
            payment = data.get("payment", {})
            return {
                "status": "verified",
                "transaction_id": transaction_id,
                "amount": payment.get("amount"),
                "payer": payment.get("payer"),
                "raw_response": data,
            }
