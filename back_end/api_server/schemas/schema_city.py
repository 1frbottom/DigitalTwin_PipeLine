from sqlalchemy import Column, String, Integer, DateTime, Float
from sqlalchemy.ext.declarative import declarative_base




Base = declarative_base()

# (1) live_ppltn_proc 테이블 매핑
class LivePpltnProc(Base):
    __tablename__ = "live_ppltn_proc"

    area_nm = Column(String, primary_key=True)
    congest_lvl = Column(String)
    congest_msg = Column(String)
    ppltn_min = Column(Integer)
    ppltn_max = Column(Integer)
    ppltn_time = Column(DateTime, primary_key=True)
    fcst_yn = Column(String)
    ingest_timestamp = Column(Float)

# (2) live_ppltn_forecast 테이블 매핑
class LivePpltnForecast(Base):
    __tablename__ = "live_ppltn_forecast"

    area_nm = Column(String, primary_key=True)
    base_ppltn_time = Column(DateTime, primary_key=True)
    fcst_time = Column(DateTime, primary_key=True)
    fcst_congest_lvl = Column(String)
    fcst_min = Column(Integer)
    fcst_max = Column(Integer)