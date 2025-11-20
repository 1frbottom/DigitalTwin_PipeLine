from sqlalchemy import Column, String, Float, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class TrafficIncident(Base):
    __tablename__ = "traffic_incidents"

    # 복합 PK지만, ORM 매핑을 위해 명시 (실제 쿼리는 Raw SQL로 최적화할 예정)
    acc_id = Column(String, primary_key=True) 
    timestamp = Column(Float, primary_key=True)
    
    occr_date = Column(String)
    occr_time = Column(String)
    exp_clr_date = Column(String)
    exp_clr_time = Column(String)
    acc_type = Column(String)
    acc_dtype = Column(String)
    link_id = Column(String)
    grs80tm_x = Column(Float)
    grs80tm_y = Column(Float)
    acc_info = Column(Text)