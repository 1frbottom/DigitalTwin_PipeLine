from pydantic import BaseModel
from datetime import datetime
from typing import Dict, Optional


class RealtimeMetric(BaseModel):
    feature: str
    rate: int
    age_sec: Optional[int] = None
    window_sec: int
    timestamp: Optional[datetime] = None

    class Config:
        orm_mode = True


class RealtimeStatus(BaseModel):
    area_nm: str
    metrics: Dict[str, RealtimeMetric]

    class Config:
        orm_mode = True