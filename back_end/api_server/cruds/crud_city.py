from sqlalchemy.orm import Session
from ..models import model_city
from ..schemas import schema_city
from ..database import engine
from datetime import datetime



# DB에 테이블이 없으면 생성 (init.sql에 이미 있으나, ORM 사용 시 명시)
# model_city.Base.metadata.create_all(bind=engine) 

# (1) 실시간 인구 현황 데이터 조회 함수
def get_city_live_ppltn_proc(db: Session, area_name: str, limit: int = 1):
    """특정 지역의 최신 인구 현황 데이터를 조회합니다."""
    return db.query(schema_city.LivePpltnProc) \
             .filter(schema_city.LivePpltnProc.area_nm == area_name) \
             .order_by(schema_city.LivePpltnProc.ppltn_time.desc()) \
             .limit(limit) \
             .all()

# (2) 인구 예측 데이터 조회 함수
def get_city_live_ppltn_forecast(db: Session, area_name: str, base_time: datetime = None):
    """특정 지역의 예측 데이터를 조회합니다. (base_time이 없으면 최신 기준 시각 데이터)"""
    
    # base_time이 주어지지 않은 경우, 최신 기준 시각을 찾습니다.
    if base_time is None:
        latest_time = db.query(schema_city.LivePpltnForecast.base_ppltn_time) \
                        .filter(schema_city.LivePpltnForecast.area_nm == area_name) \
                        .order_by(schema_city.LivePpltnForecast.base_ppltn_time.desc()) \
                        .limit(1) \
                        .scalar()
        if latest_time is None:
            return []
        base_time = latest_time

    return db.query(schema_city.LivePpltnForecast) \
             .filter(
                 schema_city.LivePpltnForecast.area_nm == area_name,
                 schema_city.LivePpltnForecast.base_ppltn_time == base_time
             ) \
             .order_by(schema_city.LivePpltnForecast.fcst_time.asc()) \
             .all()

# (3) 도로 소통 현황 조회 함수
def get_city_road_traffic(db: Session, area_name: str):
    """특정 지역의 최신 도로 소통 현황 데이터를 조회합니다."""
    return db.query(schema_city.LiveRoadTrafficAvg) \
             .filter(schema_city.LiveRoadTrafficAvg.area_nm == area_name) \
             .order_by(schema_city.LiveRoadTrafficAvg.road_traffic_time.desc()) \
             .limit(1) \
             .first()

