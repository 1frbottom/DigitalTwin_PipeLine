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

# (1-1) 현황판용 간소화 모델 - 실시간 도착 정보
class SubwayArrivalDisplay(BaseModel):
    station_nm: str
    line_num: str
    train_line_nm: str
    arrival_msg_1: Optional[str] = None

    class Config:
        from_attributes = True

# (2) transit_ppltn_proc 테이블 모델 - 대중교통 승하차 평균 인원 (지하철 + 버스)
class TransitPpltnBase(BaseModel):
    area_nm: str
    transport_type: str  # 'subway' or 'bus'
    data_date: date
    hour_slot: int
    gton_avg: Optional[int] = None
    gtoff_avg: Optional[int] = None
    stn_cnt: Optional[int] = None
    last_updated: datetime

    class Config:
        from_attributes = True
