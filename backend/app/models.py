from pydantic import BaseModel


class TextInput(BaseModel):
    text: str  


class RedactOutput(BaseModel):
    redacted_text: str 


class TaskRequest(BaseModel):
    goal: str                    
    reading_level: str = "simple"     
    max_steps: int = 3    
    tone: str = "encouraging"            

class TaskResponse(BaseModel):
    steps: list  # list of {"step": 1, "text": "..."} dicts