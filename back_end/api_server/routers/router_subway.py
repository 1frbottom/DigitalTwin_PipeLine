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

    # 갱신 시점 추출 (이미 KST로 저장됨)
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

# ========== 대중교통 승하차 인원 (지하철 + 버스 통합) ==========

@router.get("/ppltn/current", response_model=model_subway.TransitPpltnBase)
def read_current_transit_ppltn(
    area_name: str,
    transport_type: str = Query(default=None, description="'subway' 또는 'bus' (미지정시 전체)"),
    db: Session = Depends(get_db)
):
    """
    특정 지역의 가장 최신 대중교통 승하차 인원 데이터를 조회합니다.
    """
    ppltn = crud_subway.get_latest_transit_ppltn_by_area(db, area_name=area_name, transport_type=transport_type)
    if not ppltn:
        raise HTTPException(status_code=404, detail=f"{area_name}의 대중교통 승하차 데이터를 찾을 수 없습니다.")
    return ppltn

@router.get("/ppltn/history", response_model=List[model_subway.TransitPpltnBase])
def read_transit_ppltn_history(
    area_name: str,
    transport_type: str = Query(default=None, description="'subway' 또는 'bus' (미지정시 전체)"),
    limit: int = Query(default=24, le=48),
    db: Session = Depends(get_db)
):
    """
    특정 지역의 대중교통 승하차 인원 이력을 조회합니다 (시간대별).
    """
    ppltn_list = crud_subway.get_transit_ppltn_by_area(db, area_name=area_name, transport_type=transport_type, limit=limit)
    if not ppltn_list:
        raise HTTPException(status_code=404, detail=f"{area_name}의 대중교통 승하차 데이터를 찾을 수 없습니다.")
    return ppltn_list

@router.get("/ppltn/hour", response_model=model_subway.TransitPpltnBase)
def read_transit_ppltn_by_hour(
    area_name: str,
    hour_slot: int = Query(ge=0, le=23),
    transport_type: str = Query(default=None, description="'subway' 또는 'bus' (미지정시 전체)"),
    db: Session = Depends(get_db)
):
    """
    특정 지역의 특정 시간대 대중교통 승하차 인원을 조회합니다.
    """
    ppltn = crud_subway.get_transit_ppltn_by_hour(db, area_name=area_name, hour_slot=hour_slot, transport_type=transport_type)
    if not ppltn:
        raise HTTPException(status_code=404, detail=f"{area_name}의 {hour_slot}시 대중교통 승하차 데이터를 찾을 수 없습니다.")
    return ppltn

@router.get("/passenger/cumulative")
def read_transit_passenger_cumulative(
    area_name: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    특정 지역의 시간별 대중교통 승하차 누적 현황을 조회합니다.
    - 0~23시 전체 시간대의 누적 승하차 인원 반환 (지하철 + 버스 합산)
    - 갱신 시점 포함
    """
    ppltn_list = crud_subway.get_transit_ppltn_cumulative(db, area_name=area_name)
    if not ppltn_list:
        raise HTTPException(status_code=404, detail=f"{area_name}의 대중교통 승하차 데이터를 찾을 수 없습니다.")

    # 갱신 시점 추출 (가장 최신 timestamp, 이미 KST로 저장됨)
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

@router.get("/passenger/cumulative/chart")
def read_transit_passenger_cumulative_chart(
    area_name: str,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    꺾은선 그래프용 API: 버스/지하철 분리된 시간별 승하차 누적 현황
    - subway: 지하철 승하차 누적
    - bus: 버스 승하차 누적
    """
    ppltn_list = crud_subway.get_transit_ppltn_cumulative_by_type(db, area_name=area_name)
    if not ppltn_list:
        raise HTTPException(status_code=404, detail=f"{area_name}의 대중교통 승하차 데이터를 찾을 수 없습니다.")

    # 갱신 시점 추출
    latest_timestamp = max(ppltn.last_updated for ppltn in ppltn_list) if ppltn_list else None

    # 교통수단별 누적 데이터 생성
    subway_data = []
    bus_data = []
    subway_cumulative_on = 0
    subway_cumulative_off = 0
    bus_cumulative_on = 0
    bus_cumulative_off = 0

    # 시간별로 그룹화
    hourly_data = {}
    for ppltn in ppltn_list:
        hour = ppltn.hour_slot
        if hour not in hourly_data:
            hourly_data[hour] = {}
        hourly_data[hour][ppltn.transport_type] = {
            "gton": ppltn.gton_avg or 0,
            "gtoff": ppltn.gtoff_avg or 0
        }

    # 시간순 정렬 후 누적 계산
    for hour in sorted(hourly_data.keys()):
        data = hourly_data[hour]

        # 지하철
        if "subway" in data:
            subway_cumulative_on += data["subway"]["gton"]
            subway_cumulative_off += data["subway"]["gtoff"]
        subway_data.append({
            "hour": hour,
            "get_on_personnel": subway_cumulative_on,
            "get_off_personnel": subway_cumulative_off
        })

        # 버스
        if "bus" in data:
            bus_cumulative_on += data["bus"]["gton"]
            bus_cumulative_off += data["bus"]["gtoff"]
        bus_data.append({
            "hour": hour,
            "get_on_personnel": bus_cumulative_on,
            "get_off_personnel": bus_cumulative_off
        })

    return {
        "subway": subway_data,
        "bus": bus_data,
        "updated_at": latest_timestamp
    }
