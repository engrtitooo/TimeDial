from pydantic import BaseModel
from typing import List, Optional

class MessagePart(BaseModel):
    text: str

class MessageBase(BaseModel):
    role: str
    parts: List[MessagePart]

class ChatRequest(BaseModel):
    prompt: str
    system_instruction: str
    history: List[MessageBase] = []

class GroundingSource(BaseModel):
    title: str
    url: str

class ChatResponse(BaseModel):
    text: str
    sources: List[GroundingSource]

class SpeechRequest(BaseModel):
    text: str
    voice_id: str
