from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any

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

@router.get("/arrival/board")
def read_subway_arrival_board(
    area_name: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    현황판용 간소화 API: station_nm, line_num, train_line_nm, arrival_msg_1만 반환
    + 갱신 시점 timestamp 별도 반환
    """
    arrivals = crud_subway.get_latest_subway_arrivals_by_area(db, area_name=area_name)
    if not arrivals:
        raise HTTPException(status_code=404, detail=f"{area_name}의 지하철 도착 정보를 찾을 수 없습니다.")

    # 갱신 시점 추출 (가장 최신 timestamp)
    latest_timestamp = max(arrival.ingest_timestamp for arrival in arrivals) if arrivals else None

    # 필요한 필드만 추출
    board_data = [
        {
            "station_nm": arrival.station_nm,
            "line_num": arrival.line_num,
            "train_line_nm": arrival.train_line_nm,
            "arrival_msg_1": arrival.arrival_msg_1
        }
        for arrival in arrivals
    ]

    return {
        "data": board_data,
        "updated_at": latest_timestamp
    }

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

@router.get("/passenger/cumulative")
def read_subway_passenger_cumulative(
    area_name: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    특정 지역의 시간별 승하차 누적 현황을 조회합니다.
    - 0~23시 전체 시간대의 누적 승하차 인원 반환
    - 갱신 시점 포함
    """
    ppltn_list = crud_subway.get_subway_ppltn_cumulative(db, area_name=area_name)
    if not ppltn_list:
        raise HTTPException(status_code=404, detail=f"{area_name}의 승하차 데이터를 찾을 수 없습니다.")

    # 갱신 시점 추출 (가장 최신 timestamp)
    latest_timestamp = max(ppltn.last_updated for ppltn in ppltn_list) if ppltn_list else None

    # 시간별 누적 데이터 생성
    cumulative_data = []
    cumulative_on = 0
    cumulative_off = 0

    for ppltn in ppltn_list:
        cumulative_on += ppltn.gton_avg or 0
        cumulative_off += ppltn.gtoff_avg or 0

        cumulative_data.append({
            "hour": ppltn.hour_slot,
            "get_on_personnel": cumulative_on,
            "get_off_personnel": cumulative_off
        })

    return {
        "data": cumulative_data,
        "updated_at": latest_timestamp
    }
