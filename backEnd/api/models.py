from sqlalchemy import Column, String, Double, Integer
from .database import Base

class TrafficData(Base):
    __tablename__ = "traffic_data"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    link_id = Column(String, index=True)
    avg_speed = Column(Double)
    travel_time = Column(Integer)
    timestamp = Column(Double, index=True)
