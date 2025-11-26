from sqlalchemy.orm import Session
from sqlalchemy import desc, func, cast, DateTime
from ..schemas import schema_subway

# ========== 지하철 실시간 도착 정보 ==========

def get_subway_arrivals_by_area(db: Session, area_name: str, limit: int = 50):
    """특정 지역의 최신 지하철 도착 정보를 조회합니다."""
    return (
        db.query(schema_subway.SubwayArrival)
        .filter(schema_subway.SubwayArrival.area_nm == area_name)
        .order_by(desc(schema_subway.SubwayArrival.ingest_timestamp))
        .limit(limit)
        .all()
    )


def get_subway_arrivals_by_station(db: Session, station_name: str, limit: int = 50):
    """특정 역의 최신 지하철 도착 정보를 조회합니다."""
    return (
        db.query(schema_subway.SubwayArrival)
        .filter(schema_subway.SubwayArrival.station_nm == station_name)
        .order_by(desc(schema_subway.SubwayArrival.ingest_timestamp))
        .limit(limit)
        .all()
    )


def get_latest_subway_arrivals_by_area(db: Session, area_name: str):
    """특정 지역의 가장 최신 도착 정보(중복 제거)를 조회합니다."""
    subquery = (
        db.query(
            schema_subway.SubwayArrival.station_nm,
            schema_subway.SubwayArrival.line_num,
            schema_subway.SubwayArrival.train_line_nm,
            func.max(schema_subway.SubwayArrival.ingest_timestamp).label("max_ts"),
        )
        .filter(schema_subway.SubwayArrival.area_nm == area_name)
        .group_by(
            schema_subway.SubwayArrival.station_nm,
            schema_subway.SubwayArrival.line_num,
            schema_subway.SubwayArrival.train_line_nm,
        )
        .subquery()
    )

    return (
        db.query(schema_subway.SubwayArrival)
        .join(
            subquery,
            (
                (schema_subway.SubwayArrival.station_nm == subquery.c.station_nm)
                & (schema_subway.SubwayArrival.line_num == subquery.c.line_num)
                & (schema_subway.SubwayArrival.train_line_nm == subquery.c.train_line_nm)
                & (schema_subway.SubwayArrival.ingest_timestamp == subquery.c.max_ts)
            ),
        )
        .filter(schema_subway.SubwayArrival.area_nm == area_name)
        .all()
    )


# ========== 대중교통 승하차 집계 (지하철 + 버스) ==========

def get_transit_ppltn_by_area(
    db: Session, area_name: str, transport_type: str = None, limit: int = 576
):
    """특정 지역의 승하차 인원 데이터를 시간순으로 조회합니다."""
    query = db.query(schema_subway.TransitPpltn).filter(
        schema_subway.TransitPpltn.area_nm == area_name
    )

    if transport_type:
        query = query.filter(schema_subway.TransitPpltn.transport_type == transport_type)

    return (
        query.order_by(
            desc(schema_subway.TransitPpltn.data_date),
            desc(schema_subway.TransitPpltn.hour_slot),
        )
        .limit(limit)
        .all()
    )


def get_latest_transit_ppltn_by_area(
    db: Session, area_name: str, transport_type: str = None
):
    """특정 지역의 가장 최신 승하차 인원 데이터를 조회합니다."""
    query = db.query(schema_subway.TransitPpltn).filter(
        schema_subway.TransitPpltn.area_nm == area_name
    )

    if transport_type:
        query = query.filter(schema_subway.TransitPpltn.transport_type == transport_type)

    return (
        query.order_by(
            desc(schema_subway.TransitPpltn.data_date),
            desc(schema_subway.TransitPpltn.hour_slot),
        )
        .first()
    )


def get_transit_ppltn_by_hour(
    db: Session, area_name: str, hour_slot: int, transport_type: str = None
):
    """특정 지역의 특정 시간대 승하차 인원 데이터를 조회합니다."""
    from datetime import date

    query = db.query(schema_subway.TransitPpltn).filter(
        schema_subway.TransitPpltn.area_nm == area_name,
        schema_subway.TransitPpltn.data_date == date.today(),
        schema_subway.TransitPpltn.hour_slot == hour_slot,
    )

    if transport_type:
        query = query.filter(schema_subway.TransitPpltn.transport_type == transport_type)

    return query.first()


def get_transit_ppltn_cumulative(db: Session, area_name: str):
    """
    현재 시각 기준 직전 24시간(버스+지하철 합산) 승하차 집계를 시간대별로 반환합니다.
    """
    # data_date + hour_slot → KST 기준 시각이라고 가정
    bucket_ts = cast(
        schema_subway.TransitPpltn.data_date
        + func.make_interval(hours=schema_subway.TransitPpltn.hour_slot),
        DateTime,
    )

    # DB는 UTC지만, now()를 Asia/Seoul 기준 시각으로 변환
    now_kst = func.timezone("Asia/Seoul", func.now())
    window_start = now_kst - func.make_interval(hours=24)

    return (
        db.query(
            schema_subway.TransitPpltn.data_date,
            schema_subway.TransitPpltn.hour_slot,
            func.sum(schema_subway.TransitPpltn.gton_avg).label("gton_avg"),
            func.sum(schema_subway.TransitPpltn.gtoff_avg).label("gtoff_avg"),
            func.max(schema_subway.TransitPpltn.last_updated).label("last_updated"),
        )
        .filter(
            schema_subway.TransitPpltn.area_nm == area_name,
            bucket_ts >= window_start,
        )
        .group_by(
            schema_subway.TransitPpltn.data_date,
            schema_subway.TransitPpltn.hour_slot,
        )
        .order_by(
            schema_subway.TransitPpltn.data_date,
            schema_subway.TransitPpltn.hour_slot,
        )
        .all()
    )


def get_transit_ppltn_cumulative_by_type(db: Session, area_name: str):
    """
    현재 시각 기준 직전 24시간 승하차 집계를 교통수단별로 반환합니다 (차트용, KST 기준).
    """
    bucket_ts = cast(
        schema_subway.TransitPpltn.data_date
        + func.make_interval(hours=schema_subway.TransitPpltn.hour_slot),
        DateTime,
    )

    now_kst = func.timezone("Asia/Seoul", func.now())
    window_start = now_kst - func.make_interval(hours=24)

    return (
        db.query(
            schema_subway.TransitPpltn.data_date,
            schema_subway.TransitPpltn.hour_slot,
            schema_subway.TransitPpltn.transport_type,
            schema_subway.TransitPpltn.gton_avg,
            schema_subway.TransitPpltn.gtoff_avg,
            schema_subway.TransitPpltn.last_updated,
        )
        .filter(
            schema_subway.TransitPpltn.area_nm == area_name,
            bucket_ts >= window_start,
            bucket_ts <= now_kst,
        )
        .order_by(
            schema_subway.TransitPpltn.data_date,
            schema_subway.TransitPpltn.hour_slot,
            schema_subway.TransitPpltn.transport_type,
        )
        .all()
    )