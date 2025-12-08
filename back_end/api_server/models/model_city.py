from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional



# (1) city_live_ppltn_proc 테이블 모델
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

# (2) city_live_ppltn_forecast 테이블 모델
class LivePpltnForecastBase(BaseModel):
    area_nm: str
    base_ppltn_time: datetime
    fcst_time: datetime
    fcst_congest_lvl: str
    fcst_min: int
    fcst_max: int

    class Config:
        orm_mode = True

# (3) city_road_traffic_stts_avg 테이블 모델
class LiveRoadTrafficAvgBase(BaseModel):
    area_nm: str
    road_msg: Optional[str] = None
    road_traffic_idx: Optional[str] = None
    road_traffic_spd: Optional[int] = None
    road_traffic_time: datetime
    
    class Config:
        orm_mode = True

# (4) city_weather_stts_proc 테이블 모델
class CityWeatherProcBase(BaseModel):
    area_nm: str
    weather_time: datetime
    temp: Optional[float] = None
    max_temp: Optional[float] = None
    min_temp: Optional[float] = None
    humidity: Optional[float] = None
    wind_dirct: Optional[str] = None
    wind_spd: Optional[float] = None
    precipitation: Optional[str] = None
    precpt_type: Optional[str] = None
    pcp_msg: Optional[str] = None
    air_idx: Optional[str] = None
    air_idx_main: Optional[str] = None
    ingest_timestamp: float

    class Config:
        orm_mode = True

# (5) city_weather_stts_forecast 테이블 모델
class CityWeatherForecastBase(BaseModel):
    area_nm: str
    fcst_dt: datetime
    temp: Optional[float] = None
    precipitation: Optional[str] = None
    precpt_type: Optional[str] = None
    rain_chance: Optional[int] = None

    class Config:
        orm_mode = True

# (6) 대중교통 승하차 현황 응답 모델
class TransitPassengerData(BaseModel):
    transport_type: str  # 'subway' or 'bus'
    get_on_min: int
    get_on_max: int
    get_off_min: int
    get_off_max: int
    station_count: int

class TransitPassengerResponse(BaseModel):
    area_nm: str
    subway: Optional[TransitPassengerData] = None
    bus: Optional[TransitPassengerData] = None

    class Config:
        orm_mode = True


# (6) 문화행사 모델
class CulturalEventBase(BaseModel):
    area_nm: str
    event_nm: str
    event_period: Optional[str] = None
    event_place: Optional[str] = None
    event_x: Optional[float] = None
    event_y: Optional[float] = None
    thumbnail: Optional[str] = None
    url: Optional[str] = None
    pay_yn: Optional[str] = None
    event_etc_detail: Optional[str] = None
    ingest_timestamp: datetime

    class Config:
        orm_mode = True