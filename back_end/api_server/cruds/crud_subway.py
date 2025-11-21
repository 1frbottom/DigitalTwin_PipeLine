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

# ========== 대중교통 승하차 인원 (지하철 + 버스 통합) ==========

def get_transit_ppltn_by_area(db: Session, area_name: str, transport_type: str = None, limit: int = 24):
    """특정 지역의 승하차 인원 데이터를 시간순으로 조회합니다."""
    query = db.query(schema_subway.TransitPpltn) \
              .filter(schema_subway.TransitPpltn.area_nm == area_name)

    if transport_type:
        query = query.filter(schema_subway.TransitPpltn.transport_type == transport_type)

    return query.order_by(desc(schema_subway.TransitPpltn.data_date),
                          desc(schema_subway.TransitPpltn.hour_slot)) \
                .limit(limit) \
                .all()

def get_latest_transit_ppltn_by_area(db: Session, area_name: str, transport_type: str = None):
    """특정 지역의 가장 최신 승하차 인원 데이터를 조회합니다."""
    query = db.query(schema_subway.TransitPpltn) \
              .filter(schema_subway.TransitPpltn.area_nm == area_name)

    if transport_type:
        query = query.filter(schema_subway.TransitPpltn.transport_type == transport_type)

    return query.order_by(desc(schema_subway.TransitPpltn.data_date),
                          desc(schema_subway.TransitPpltn.hour_slot)) \
                .first()

def get_transit_ppltn_by_hour(db: Session, area_name: str, hour_slot: int, transport_type: str = None):
    """특정 지역의 특정 시간대 승하차 인원 데이터를 조회합니다."""
    from datetime import date
    query = db.query(schema_subway.TransitPpltn) \
              .filter(schema_subway.TransitPpltn.area_nm == area_name,
                      schema_subway.TransitPpltn.data_date == date.today(),
                      schema_subway.TransitPpltn.hour_slot == hour_slot)

    if transport_type:
        query = query.filter(schema_subway.TransitPpltn.transport_type == transport_type)

    return query.first()

def get_transit_ppltn_cumulative(db: Session, area_name: str):
    """특정 지역의 가장 최신 날짜의 모든 시간대 승하차 인원을 조회합니다 (누적 계산용, 지하철+버스 합산)."""
    from sqlalchemy import func

    # 가장 최신 날짜 찾기
    latest_date_subquery = db.query(
        func.max(schema_subway.TransitPpltn.data_date).label('max_date')
    ).filter(
        schema_subway.TransitPpltn.area_nm == area_name
    ).subquery()

    # 해당 날짜의 모든 시간대 데이터 조회 (지하철+버스 합산)
    return db.query(
        schema_subway.TransitPpltn.hour_slot,
        func.sum(schema_subway.TransitPpltn.gton_avg).label('gton_avg'),
        func.sum(schema_subway.TransitPpltn.gtoff_avg).label('gtoff_avg'),
        func.max(schema_subway.TransitPpltn.last_updated).label('last_updated')
    ).join(latest_date_subquery,
           schema_subway.TransitPpltn.data_date == latest_date_subquery.c.max_date) \
     .filter(schema_subway.TransitPpltn.area_nm == area_name) \
     .group_by(schema_subway.TransitPpltn.hour_slot) \
     .order_by(schema_subway.TransitPpltn.hour_slot) \
     .all()

def get_transit_ppltn_cumulative_by_type(db: Session, area_name: str):
    """특정 지역의 가장 최신 날짜의 모든 시간대 승하차 인원을 교통수단별로 분리하여 조회합니다 (꺾은선 그래프용)."""
    from sqlalchemy import func

    # 가장 최신 날짜 찾기
    latest_date_subquery = db.query(
        func.max(schema_subway.TransitPpltn.data_date).label('max_date')
    ).filter(
        schema_subway.TransitPpltn.area_nm == area_name
    ).subquery()

    # 해당 날짜의 모든 시간대 데이터 조회 (교통수단별 분리)
    return db.query(
        schema_subway.TransitPpltn.hour_slot,
        schema_subway.TransitPpltn.transport_type,
        schema_subway.TransitPpltn.gton_avg,
        schema_subway.TransitPpltn.gtoff_avg,
        schema_subway.TransitPpltn.last_updated
    ).join(latest_date_subquery,
           schema_subway.TransitPpltn.data_date == latest_date_subquery.c.max_date) \
     .filter(schema_subway.TransitPpltn.area_nm == area_name) \
     .order_by(schema_subway.TransitPpltn.hour_slot, schema_subway.TransitPpltn.transport_type) \
     .all()
