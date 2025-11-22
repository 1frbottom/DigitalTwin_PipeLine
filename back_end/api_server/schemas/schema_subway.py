from sqlalchemy import Column, String, Integer, Text, DateTime, Date
from ..database import Base

# (1) subway_arrival_proc 테이블 ORM 모델
class SubwayArrival(Base):
    __tablename__ = "subway_arrival_proc"

    area_nm = Column(String(50), primary_key=True)
    station_nm = Column(String(100), primary_key=True)
    line_num = Column(String(10), primary_key=True)
    train_line_nm = Column(String(100), primary_key=True)
    arrival_msg_1 = Column(Text)
    arrival_msg_2 = Column(Text)
    ingest_timestamp = Column(DateTime, primary_key=True)

# (2) transit_ppltn_proc 테이블 ORM 모델 (대중교통 통합: 지하철 + 버스)
class TransitPpltn(Base):
    __tablename__ = "transit_ppltn_proc"

    area_nm = Column(String(50), primary_key=True)
    transport_type = Column(String(10), primary_key=True)  # 'subway' or 'bus'
    data_date = Column(Date, primary_key=True)
    hour_slot = Column(Integer, primary_key=True)
    gton_avg = Column(Integer)
    gtoff_avg = Column(Integer)
    stn_cnt = Column(Integer)
    last_updated = Column(DateTime)
