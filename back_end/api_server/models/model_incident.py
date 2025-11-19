from pydantic import BaseModel
from typing import Optional

class TrafficIncidentBase(BaseModel):
    acc_id: str
    occr_date: Optional[str] = None
    occr_time: Optional[str] = None
    exp_clr_date: Optional[str] = None
    exp_clr_time: Optional[str] = None
    acc_type: Optional[str] = None
    acc_dtype: Optional[str] = None
    link_id: Optional[str] = None
    grs80tm_x: Optional[float] = None
    grs80tm_y: Optional[float] = None
    acc_info: Optional[str] = None
    timestamp: float

    class Config:
        orm_mode = True