from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..schemas import schema_subway

# ========== 지하철 실시간 도착 정보 ==========

def get_subway_arrivals_by_area(db: Session, area_name: str, limit: int = 50):
    """특정 지역의 최신 지하철 도착 정보를 조회합니다."""
    return db.query(schema_subway.SubwayArrival) \
             .filter(schema_subway.SubwayArrival.area_nm == area_name) \
             .order_by(desc(schema_subway.SubwayArrival.ingest_timestamp)) \
             .limit(limit) \
             .all()

def get_subway_arrivals_by_station(db: Session, station_name: str, limit: int = 50):
    """특정 역의 최신 지하철 도착 정보를 조회합니다."""
    return db.query(schema_subway.SubwayArrival) \
             .filter(schema_subway.SubwayArrival.station_nm == station_name) \
             .order_by(desc(schema_subway.SubwayArrival.ingest_timestamp)) \
             .limit(limit) \
             .all()

def get_latest_subway_arrivals_by_area(db: Session, area_name: str):
    """특정 지역의 가장 최신 도착 정보만 조회합니다 (중복 제거)."""
    # 서브쿼리로 최신 timestamp 찾기
    from sqlalchemy import func

    subquery = db.query(
        schema_subway.SubwayArrival.station_nm,
        schema_subway.SubwayArrival.line_num,
        schema_subway.SubwayArrival.train_line_nm,
        func.max(schema_subway.SubwayArrival.ingest_timestamp).label('max_ts')
    ).filter(
        schema_subway.SubwayArrival.area_nm == area_name
    ).group_by(
        schema_subway.SubwayArrival.station_nm,
        schema_subway.SubwayArrival.line_num,
        schema_subway.SubwayArrival.train_line_nm
    ).subquery()

    return db.query(schema_subway.SubwayArrival) \
             .join(subquery,
                   (schema_subway.SubwayArrival.station_nm == subquery.c.station_nm) &
                   (schema_subway.SubwayArrival.line_num == subquery.c.line_num) &
                   (schema_subway.SubwayArrival.train_line_nm == subquery.c.train_line_nm) &
                   (schema_subway.SubwayArrival.ingest_timestamp == subquery.c.max_ts)) \
             .filter(schema_subway.SubwayArrival.area_nm == area_name) \
             .all()

# ========== 지하철 승하차 인원 ==========

def get_subway_ppltn_by_area(db: Session, area_name: str, limit: int = 24):
    """특정 지역의 승하차 인원 데이터를 시간순으로 조회합니다."""
    return db.query(schema_subway.SubwayPpltn) \
             .filter(schema_subway.SubwayPpltn.area_nm == area_name) \
             .order_by(desc(schema_subway.SubwayPpltn.data_date),
                       desc(schema_subway.SubwayPpltn.hour_slot)) \
             .limit(limit) \
             .all()

def get_latest_subway_ppltn_by_area(db: Session, area_name: str):
    """특정 지역의 가장 최신 승하차 인원 데이터를 조회합니다."""
    return db.query(schema_subway.SubwayPpltn) \
             .filter(schema_subway.SubwayPpltn.area_nm == area_name) \
             .order_by(desc(schema_subway.SubwayPpltn.data_date),
                       desc(schema_subway.SubwayPpltn.hour_slot)) \
             .first()

def get_subway_ppltn_by_hour(db: Session, area_name: str, hour_slot: int):
    """특정 지역의 특정 시간대 승하차 인원 데이터를 조회합니다."""
    from datetime import date
    return db.query(schema_subway.SubwayPpltn) \
             .filter(schema_subway.SubwayPpltn.area_nm == area_name,
                     schema_subway.SubwayPpltn.data_date == date.today(),
                     schema_subway.SubwayPpltn.hour_slot == hour_slot) \
             .first()
