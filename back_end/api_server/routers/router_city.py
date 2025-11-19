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
    proc_data = crud_city.get_live_ppltn_proc(db, area_name=area_name, limit=1)
    if not proc_data:
        raise HTTPException(status_code=404, detail=f"{area_name}의 인구 현황 데이터를 찾을 수 없습니다.")
    return proc_data[0]


# (2) 인구 예측 조회 API
@router.get("/population/forecast", response_model=List[model_city.LivePpltnForecastBase])
def read_population_forecast(area_name: str, db: Session = Depends(get_db)):
    """
    특정 지역의 가장 최신 기준 시각에 대한 인구 예측 정보를 조회합니다.
    """
    forecast_data = crud_city.get_live_ppltn_forecast(db, area_name=area_name)
    if not forecast_data:
        # 최신 기준 시각이 없거나 예측 데이터가 없는 경우
        raise HTTPException(status_code=404, detail=f"{area_name}의 인구 예측 데이터를 찾을 수 없습니다.")
    return forecast_data