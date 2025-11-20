from pydantic import BaseModel
from typing import Optional

class TrafficDataBase(BaseModel):
    link_id: str
    avg_speed: float
    travel_time: int
    timestamp: float

class TrafficDataResponse(TrafficDataBase):
    
    class Config:
        from_attributes = True  # SQLAlchemy 모델과 호환

class TrafficStats(BaseModel):
    link_id: str
    avg_speed_mean: float
    count: int
