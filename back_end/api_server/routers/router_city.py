from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..cruds import crud_city
from ..models import model_city



# 라우터 객체 생성. 태그와 프리픽스를 지정하여 API 문서화 및 경로 구분을 명확히 합니다.
router = APIRouter(
    prefix="/city",
    tags=["City Data - 실시간 도시 데이터"],
)

# (1) 인구 현황 조회 API
@router.get("/population/current", response_model=model_city.LivePpltnProcBase)
def read_current_population(area_name: str, db: Session = Depends(get_db)):
    """
    특정 지역의 가장 최신 실시간 인구 현황 정보를 조회합니다.
    """
    proc_data = crud_city.get_city_live_ppltn_proc(db, area_name=area_name, limit=1)
    if not proc_data:
        raise HTTPException(status_code=404, detail=f"{area_name}의 인구 현황 데이터를 찾을 수 없습니다.")
    return proc_data[0]


# (2) 인구 예측 조회 API
@router.get("/population/forecast", response_model=List[model_city.LivePpltnForecastBase])
def read_population_forecast(area_name: str, db: Session = Depends(get_db)):
    """
    특정 지역의 가장 최신 기준 시각에 대한 인구 예측 정보를 조회합니다.
    """
    forecast_data = crud_city.get_city_live_ppltn_forecast(db, area_name=area_name)
    if not forecast_data:
        # 최신 기준 시각이 없거나 예측 데이터가 없는 경우
        raise HTTPException(status_code=404, detail=f"{area_name}의 인구 예측 데이터를 찾을 수 없습니다.")
    return forecast_data

# (3) 도로 소통 현황 조회 API
@router.get("/traffic/road", response_model=model_city.LiveRoadTrafficAvgBase)
def read_road_traffic(area_name: str, db: Session = Depends(get_db)):
    """
    특정 지역의 가장 최신 도로 소통 현황(평균) 정보를 조회합니다.
    """
    traffic_data = crud_city.get_city_road_traffic(db, area_name=area_name)
    if not traffic_data:
        raise HTTPException(status_code=404, detail=f"{area_name}의 도로 소통 데이터를 찾을 수 없습니다.")
    return traffic_data

# (4) 기상 현황 조회 API
@router.get("/weather/current", response_model=model_city.CityWeatherProcBase)
def read_current_weather(area_name: str, db: Session = Depends(get_db)):
    """
    특정 지역의 가장 최신 기상 현황을 조회합니다.
    """
    weather_data = crud_city.get_city_weather_proc(db, area_name=area_name)
    if not weather_data:
        raise HTTPException(status_code=404, detail=f"{area_name}의 기상 현황 데이터를 찾을 수 없습니다.")
    return weather_data

# (5) 기상 예측 조회 API
@router.get("/weather/forecast", response_model=List[model_city.CityWeatherForecastBase])
def read_weather_forecast(area_name: str, db: Session = Depends(get_db)):
    """
    특정 지역의 최신 기상 예보 리스트(24시간)를 조회합니다.
    """
    forecast_data = crud_city.get_city_weather_forecast(db, area_name=area_name)
    if not forecast_data:
        raise HTTPException(status_code=404, detail=f"{area_name}의 기상 예보 데이터를 찾을 수 없습니다.")
    return forecast_data

# (6) 문화행사 현황 조회 API
@router.get("/events/cultural", response_model=List[model_city.CulturalEventBase])
def read_cultural_events(area_name: str, limit: int = 10, db: Session = Depends(get_db)):
    """
    특정 지역의 주변 문화행사 정보를 조회합니다.
    city_data_raw 테이블의 event_stts(JSON)에서 직접 파싱하여 반환합니다.
    """
    events_data = crud_city.get_city_cultural_events(db, area_name=area_name, limit=limit)
    if not events_data:
        return []  # 문화행사가 없을 수 있으므로 빈 배열 반환
    return events_data

# (7) 대중교통 승하차 현황 조회 API
@router.get("/transit/passenger", response_model=model_city.TransitPassengerResponse)
def read_transit_passenger(area_name: str, db: Session = Depends(get_db)):
    """
    특정 지역의 최신 대중교통(지하철+버스) 승하차 현황을 조회합니다.
    """
    transit_data = crud_city.get_transit_passenger_data(db, area_name=area_name)
    if not transit_data:
        raise HTTPException(status_code=404, detail=f"{area_name}의 대중교통 승하차 데이터를 찾을 수 없습니다.")
    return transit_data
