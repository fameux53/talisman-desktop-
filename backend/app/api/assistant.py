"""
AI Assistant proxy — routes Claude API calls through the backend so the
API key never touches the browser.

The vendor's API key is stored encrypted in the database. The frontend sends
only the chat message; the backend adds context and forwards to Anthropic.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.api.auth import limiter
from app.api.deps import AuthUser, require_any_role
from app.config import settings

logger = logging.getLogger("talisman.assistant")

router = APIRouter(prefix="/assistant", tags=["assistant"])


class ChatMessage(BaseModel):
    role: str = Field(..., pattern=r"^(user|assistant)$")
    content: str = Field(..., max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    context: str = Field("", max_length=8000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class ChatResponse(BaseModel):
    reply: str


class ApiKeyRequest(BaseModel):
    api_key: str = Field(..., min_length=10, max_length=200)


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("10/minute")
async def assistant_chat(
    request: Request,
    body: ChatRequest,
    user: AuthUser = Depends(require_any_role),
):
    """Proxy chat to Anthropic API. API key comes from server-side config."""
    import httpx

    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI assistant not configured. Set ANTHROPIC_API_KEY on the server.",
        )

    system_prompt = f"""Ou se Asistan Biznis Talisman — yon asistan entèlijan ki ede machann ayisyen jere biznis yo.

RÈG:
- Reponn TOUJOU an Kreyòl Ayisyen (sof si itilizatè a ekri an Fransè oswa Anglè — lè sa reponn nan lang li)
- Baze repons ou sou done biznis reyèl ki anba a — pa envante chif
- Bay konsèy pratik ak aksyonab
- Sèvi ak emoji pou fè repons ou pi klè
- Kenbe repons ou kout ak dirèk (maks 3-4 paragraf)
- Si ou pa gen ase done pou reponn, di sa klèman
- Pa janm bay konsèy finansye legal — jis analiz done biznis
- Ou ka sijere aksyon espesifik: "Ogmante pri sik 15 goud" oswa "Kontakte Madanm Jean pou pèman"

DONE BIZNIS AKTYÈL:
{body.context}"""

    messages = [
        *[{"role": m.role, "content": m.content} for m in body.history[-10:]],
        {"role": "user", "content": body.message},
    ]

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 1000,
                    "system": system_prompt,
                    "messages": messages,
                },
            )

        if resp.status_code == 401:
            raise HTTPException(status_code=502, detail="Invalid API key configured on server")
        if resp.status_code == 429:
            raise HTTPException(status_code=429, detail="AI rate limit reached. Try again shortly.")
        if resp.status_code >= 500:
            raise HTTPException(status_code=502, detail="AI service temporarily unavailable")
        if resp.status_code != 200:
            logger.error("Anthropic API error %d: %s", resp.status_code, resp.text[:200])
            raise HTTPException(status_code=502, detail="AI service error")

        try:
            data = resp.json()
            reply = data["content"][0]["text"]
        except (KeyError, IndexError, ValueError) as exc:
            logger.error("Unexpected Anthropic response structure: %s", exc)
            raise HTTPException(status_code=502, detail="AI service returned an unexpected response")
        return ChatResponse(reply=reply)

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI request timed out")
    except httpx.RequestError as exc:
        logger.error("Anthropic network error: %s", exc)
        raise HTTPException(status_code=502, detail="Cannot reach AI service")
