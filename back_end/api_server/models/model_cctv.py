from sqlalchemy import Column, String, Text, DateTime
from datetime import datetime, timezone
from backEnd.api_server import database

class CCTVStreamModel(database.Base):
    __tablename__ = "cctv_streams"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    stream_url = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
