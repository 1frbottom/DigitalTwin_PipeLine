from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..cruds import crud_subway
from ..models import model_subway

router = APIRouter(
    prefix="/subway",
    tags=["Subway - 지하철 데이터"],
)

# ========== 실시간 도착 정보 ==========

@router.get("/arrival/area", response_model=List[model_subway.SubwayArrivalBase])
def read_subway_arrivals_by_area(
    area_name: str,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db)
):
    """
    특정 지역의 지하철 실시간 도착 정보를 조회합니다.
    """
    arrivals = crud_subway.get_subway_arrivals_by_area(db, area_name=area_name, limit=limit)
    if not arrivals:
        raise HTTPException(status_code=404, detail=f"{area_name}의 지하철 도착 정보를 찾을 수 없습니다.")
    return arrivals

@router.get("/arrival/station", response_model=List[model_subway.SubwayArrivalBase])
def read_subway_arrivals_by_station(
    station_name: str,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db)
):
    """
    특정 역의 지하철 실시간 도착 정보를 조회합니다.
    """
    arrivals = crud_subway.get_subway_arrivals_by_station(db, station_name=station_name, limit=limit)
    if not arrivals:
        raise HTTPException(status_code=404, detail=f"{station_name}의 지하철 도착 정보를 찾을 수 없습니다.")
    return arrivals

@router.get("/arrival/latest", response_model=List[model_subway.SubwayArrivalBase])
def read_latest_subway_arrivals(
    area_name: str,
    db: Session = Depends(get_db)
):
    """
    특정 지역의 가장 최신 도착 정보만 조회합니다 (각 노선별 1개).
    """
    arrivals = crud_subway.get_latest_subway_arrivals_by_area(db, area_name=area_name)
    if not arrivals:
        raise HTTPException(status_code=404, detail=f"{area_name}의 지하철 도착 정보를 찾을 수 없습니다.")
    return arrivals

# ========== 승하차 인원 ==========

@router.get("/ppltn/current", response_model=model_subway.SubwayPpltnBase)
def read_current_subway_ppltn(
    area_name: str,
    db: Session = Depends(get_db)
):
    """
    특정 지역의 가장 최신 지하철 승하차 인원 데이터를 조회합니다.
    """
    ppltn = crud_subway.get_latest_subway_ppltn_by_area(db, area_name=area_name)
    if not ppltn:
        raise HTTPException(status_code=404, detail=f"{area_name}의 지하철 승하차 데이터를 찾을 수 없습니다.")
    return ppltn

@router.get("/ppltn/history", response_model=List[model_subway.SubwayPpltnBase])
def read_subway_ppltn_history(
    area_name: str,
    limit: int = Query(default=24, le=48),
    db: Session = Depends(get_db)
):
    """
    특정 지역의 지하철 승하차 인원 이력을 조회합니다 (시간대별).
    """
    ppltn_list = crud_subway.get_subway_ppltn_by_area(db, area_name=area_name, limit=limit)
    if not ppltn_list:
        raise HTTPException(status_code=404, detail=f"{area_name}의 지하철 승하차 데이터를 찾을 수 없습니다.")
    return ppltn_list

@router.get("/ppltn/hour", response_model=model_subway.SubwayPpltnBase)
def read_subway_ppltn_by_hour(
    area_name: str,
    hour_slot: int = Query(ge=0, le=23),
    db: Session = Depends(get_db)
):
    """
    특정 지역의 특정 시간대 승하차 인원을 조회합니다.
    """
    ppltn = crud_subway.get_subway_ppltn_by_hour(db, area_name=area_name, hour_slot=hour_slot)
    if not ppltn:
        raise HTTPException(status_code=404, detail=f"{area_name}의 {hour_slot}시 승하차 데이터를 찾을 수 없습니다.")
    return ppltn
