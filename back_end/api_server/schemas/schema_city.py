from sqlalchemy import Column, String, Integer, DateTime, Float ,Text
from sqlalchemy.ext.declarative import declarative_base




Base = declarative_base()

# (1) city_live_ppltn_proc 테이블 매핑
class LivePpltnProc(Base):
    __tablename__ = "city_live_ppltn_proc"

    area_nm = Column(String, primary_key=True)
    congest_lvl = Column(String)
    congest_msg = Column(String)
    ppltn_min = Column(Integer)
    ppltn_max = Column(Integer)
    ppltn_time = Column(DateTime, primary_key=True)
    fcst_yn = Column(String)
    ingest_timestamp = Column(Float)

# (2) city_live_ppltn_forecast 테이블 매핑
class LivePpltnForecast(Base):
    __tablename__ = "city_live_ppltn_forecast"

    area_nm = Column(String, primary_key=True)
    base_ppltn_time = Column(DateTime, primary_key=True)
    fcst_time = Column(DateTime, primary_key=True)
    fcst_congest_lvl = Column(String)
    fcst_min = Column(Integer)
    fcst_max = Column(Integer)

# (3) city_road_traffic_stts_avg 테이블 매핑
class LiveRoadTrafficAvg(Base):
    __tablename__ = "city_road_traffic_stts_avg"

    area_nm = Column(String, primary_key=True)
    road_msg = Column(Text)
    road_traffic_idx = Column(String)
    road_traffic_spd = Column(Integer)
    road_traffic_time = Column(DateTime, primary_key=True)
    ingest_timestamp = Column(Float)