from pydantic import BaseModel
from typing import List, Optional



class CCTVStream(BaseModel):
    id: str
    name: str
    stream_url: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    class Config:
        from_attributes = True

class CCTVResponse(BaseModel):
    message: str
    data: List[CCTVStream]
