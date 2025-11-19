from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional

# (1) subway_arrival_proc 테이블 모델 - 실시간 도착 정보
class SubwayArrivalBase(BaseModel):
    area_nm: str
    station_nm: str
    line_num: str
    train_line_nm: str
    arrival_msg_1: Optional[str] = None
    arrival_msg_2: Optional[str] = None
    ingest_timestamp: datetime

    class Config:
        from_attributes = True

# (2) subway_ppltn_proc 테이블 모델 - 승하차 평균 인원
class SubwayPpltnBase(BaseModel):
    area_nm: str
    data_date: date
    hour_slot: int
    gton_avg: Optional[int] = None
    gtoff_avg: Optional[int] = None
    stn_cnt: Optional[int] = None
    ingest_timestamp: datetime

    class Config:
        from_attributes = True
