from sqlalchemy import Column, String, Double, Integer
from .. import database

class TrafficData(database.Base):
    __tablename__ = "traffic_data"
    
    link_id = Column(String, primary_key=True, index=True)
    avg_speed = Column(Double)
    travel_time = Column(Integer)
    timestamp = Column(Double, index=True)