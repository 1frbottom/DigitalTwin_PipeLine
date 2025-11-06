from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List
import crud, schemas
import database

router = APIRouter(
    prefix="/api/traffic",
    tags=["traffic"]
)

@router.get("/recent", response_model=List[schemas.TrafficDataResponse])
def read_recent_traffic(
    minutes: int = Query(default=10, ge=1, le=60),
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(database.get_db)
):
    """최근 N분간의 교통 데이터 조회"""
    traffic_data = crud.get_recent_traffic_data(
        db, minutes=minutes, skip=skip, limit=limit
    )
    return traffic_data

@router.get("/link/{link_id}", response_model=List[schemas.TrafficDataResponse])
def read_traffic_by_link(
    link_id: str,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(database.get_db)
):
    """특정 링크 ID의 교통 데이터 조회"""
    traffic_data = crud.get_traffic_by_link_id(db, link_id=link_id, limit=limit)
    if not traffic_data:
        raise HTTPException(status_code=404, detail="해당 링크 ID의 데이터가 없습니다")
    return traffic_data

@router.get("/stats", response_model=List[schemas.TrafficStats])
def read_traffic_stats(db: Session = Depends(database.get_db)):
    """링크별 평균 속도 통계"""
    stats = crud.get_traffic_stats(db)
    return [
        schemas.TrafficStats(
            link_id=stat.link_id,
            avg_speed_mean=stat.avg_speed_mean,
            count=stat.count
        )
        for stat in stats
    ]
