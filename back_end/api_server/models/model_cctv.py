from sqlalchemy import Column, String, Text, DateTime, Float
from datetime import datetime, timezone
from .. import database



class CCTVStreamModel(database.Base):
    __tablename__ = "cctv_streams"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    stream_url = Column(Text, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
