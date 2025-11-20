from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

# (1) live_ppltn_proc 테이블 모델
class LivePpltnProcBase(BaseModel):
    area_nm: str
    congest_lvl: str
    congest_msg: str
    ppltn_min: Optional[int] = None
    ppltn_max: Optional[int] = None
    ppltn_time: datetime
    fcst_yn: str
    ingest_timestamp: float # 원본 수집 시각

    class Config:
        orm_mode = True # SQLAlchemy ORM 객체에서 Pydantic 모델로 변환 가능하도록 설정

# (2) live_ppltn_forecast 테이블 모델
class LivePpltnForecastBase(BaseModel):
    area_nm: str
    base_ppltn_time: datetime
    fcst_time: datetime
    fcst_congest_lvl: str
    fcst_min: int
    fcst_max: int

    class Config:
        orm_mode = True