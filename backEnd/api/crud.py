from sqlalchemy.orm import Session
from sqlalchemy import func, desc
import models
import schemas
from typing import List, Optional

# 최근 교통 데이터 조회 (최근 10분)
def get_recent_traffic_data(
    db: Session, 
    minutes: int = 10,
    skip: int = 0, 
    limit: int = 100
):
    import time
    current_time = time.time()
    time_threshold = current_time - (minutes * 60)
    
    return db.query(models.TrafficData)\
        .filter(models.TrafficData.timestamp >= time_threshold)\
        .order_by(desc(models.TrafficData.timestamp))\
        .offset(skip)\
        .limit(limit)\
        .all()

# 특정 링크 ID의 교통 데이터 조회
def get_traffic_by_link_id(
    db: Session, 
    link_id: str,
    limit: int = 50
):
    return db.query(models.TrafficData)\
        .filter(models.TrafficData.link_id == link_id)\
        .order_by(desc(models.TrafficData.timestamp))\
        .limit(limit)\
        .all()

# 링크별 평균 속도 통계
def get_traffic_stats(db: Session):
    return db.query(
        models.TrafficData.link_id,
        func.avg(models.TrafficData.avg_speed).label('avg_speed_mean'),
        func.count(models.TrafficData.link_id).label('count')
    ).group_by(models.TrafficData.link_id).all()
