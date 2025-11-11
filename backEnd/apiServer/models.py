from sqlalchemy import Column, String, Double, Integer, Text, DateTime
from datetime import datetime, timezone
import database

class TrafficData(database.Base):
    __tablename__ = "traffic_data"

    link_id = Column(String, primary_key=True, index=True)
    avg_speed = Column(Double)
    travel_time = Column(Integer)
    timestamp = Column(Double, index=True)

class CCTVStreamModel(database.Base):
    __tablename__ = "cctv_streams"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    stream_url = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
