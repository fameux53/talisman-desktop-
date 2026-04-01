from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.api.auth import limiter
from app.api.deps import AuthUser, require_any_role
from app.services.nlp import IntentResult, parse_intent

router = APIRouter(prefix="/nlp", tags=["nlp"])


class ParseRequest(BaseModel):
    text: str


@router.post("/parse", response_model=IntentResult)
@limiter.limit("30/minute")
async def parse_text(
    request: Request,
    body: ParseRequest,
    user: AuthUser = Depends(require_any_role),
):
    return parse_intent(body.text)
