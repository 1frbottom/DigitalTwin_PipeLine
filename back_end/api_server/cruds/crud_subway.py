from sqlalchemy.orm import Session
from sqlalchemy import desc, func, cast, DateTime
from ..models import model_subway



# ========== 지하철 실시간 도착 정보 ==========

def get_subway_arrivals_by_area(db: Session, area_name: str, limit: int = 50):
    """특정 지역의 최신 지하철 도착 정보를 조회합니다."""
    return (
        db.query(model_subway.SubwayArrival)
        .filter(model_subway.SubwayArrival.area_nm == area_name)
        .order_by(desc(model_subway.SubwayArrival.ingest_timestamp))
        .limit(limit)
        .all()
    )


def get_subway_arrivals_by_station(db: Session, station_name: str, limit: int = 50):
    """특정 역의 최신 지하철 도착 정보를 조회합니다."""
    return (
        db.query(model_subway.SubwayArrival)
        .filter(model_subway.SubwayArrival.station_nm == station_name)
        .order_by(desc(model_subway.SubwayArrival.ingest_timestamp))
        .limit(limit)
        .all()
    )


def get_latest_subway_arrivals_by_area(db: Session, area_name: str):
    """특정 지역의 가장 최신 도착 정보(중복 제거)를 조회합니다."""
    subquery = (
        db.query(
            model_subway.SubwayArrival.station_nm,
            model_subway.SubwayArrival.line_num,
            model_subway.SubwayArrival.train_line_nm,
            func.max(model_subway.SubwayArrival.ingest_timestamp).label("max_ts"),
        )
        .filter(model_subway.SubwayArrival.area_nm == area_name)
        .group_by(
            model_subway.SubwayArrival.station_nm,
            model_subway.SubwayArrival.line_num,
            model_subway.SubwayArrival.train_line_nm,
        )
        .subquery()
    )

    return (
        db.query(model_subway.SubwayArrival)
        .join(
            subquery,
            (
                (model_subway.SubwayArrival.station_nm == subquery.c.station_nm)
                & (model_subway.SubwayArrival.line_num == subquery.c.line_num)
                & (model_subway.SubwayArrival.train_line_nm == subquery.c.train_line_nm)
                & (model_subway.SubwayArrival.ingest_timestamp == subquery.c.max_ts)
            ),
        )
        .filter(model_subway.SubwayArrival.area_nm == area_name)
        .all()
    )


# ========== 대중교통 승하차 집계 (지하철 + 버스) ==========

def get_transit_ppltn_by_area(
    db: Session, area_name: str, transport_type: str = None, limit: int = 576
):
    """특정 지역의 승하차 인원 데이터를 시간순으로 조회합니다."""
    query = db.query(model_subway.TransitPpltn).filter(
        model_subway.TransitPpltn.area_nm == area_name
    )

    if transport_type:
        query = query.filter(model_subway.TransitPpltn.transport_type == transport_type)

    return (
        query.order_by(
            desc(model_subway.TransitPpltn.data_date),
            desc(model_subway.TransitPpltn.hour_slot),
        )
        .limit(limit)
        .all()
    )


def get_latest_transit_ppltn_by_area(
    db: Session, area_name: str, transport_type: str = None
):
    """특정 지역의 가장 최신 승하차 인원 데이터를 조회합니다."""
    query = db.query(model_subway.TransitPpltn).filter(
        model_subway.TransitPpltn.area_nm == area_name
    )

    if transport_type:
        query = query.filter(model_subway.TransitPpltn.transport_type == transport_type)

    return (
        query.order_by(
            desc(model_subway.TransitPpltn.data_date),
            desc(model_subway.TransitPpltn.hour_slot),
        )
        .first()
    )


def get_transit_ppltn_by_hour(
    db: Session, area_name: str, hour_slot: int, transport_type: str = None
):
    """특정 지역의 특정 시간대 승하차 인원 데이터를 조회합니다."""
    from datetime import date

    query = db.query(model_subway.TransitPpltn).filter(
        model_subway.TransitPpltn.area_nm == area_name,
        model_subway.TransitPpltn.data_date == date.today(),
        model_subway.TransitPpltn.hour_slot == hour_slot,
    )

    if transport_type:
        query = query.filter(model_subway.TransitPpltn.transport_type == transport_type)

    return query.first()


def get_transit_ppltn_cumulative(db: Session, area_name: str):
    """
    현재 시각 기준 직전 24시간(버스+지하철 합산) 승하차 집계를 시간대별로 반환합니다.
    """
    # data_date + hour_slot → KST 기준 시각이라고 가정
    # make_interval는 키워드 인자를 허용하지 않아 시간은 5번째 위치 인자로 전달한다.
    bucket_ts = cast(
        model_subway.TransitPpltn.data_date
        + func.make_interval(0, 0, 0, 0, model_subway.TransitPpltn.hour_slot),
        DateTime,
    )

    # DB는 UTC지만, now()를 Asia/Seoul 기준 시각으로 변환
    now_kst = func.timezone("Asia/Seoul", func.now())
    window_start = now_kst - func.make_interval(0, 0, 0, 0, 24)

    return (
        db.query(
            model_subway.TransitPpltn.data_date,
            model_subway.TransitPpltn.hour_slot,
            func.sum(model_subway.TransitPpltn.gton_avg).label("gton_avg"),
            func.sum(model_subway.TransitPpltn.gtoff_avg).label("gtoff_avg"),
            func.max(model_subway.TransitPpltn.last_updated).label("last_updated"),
        )
        .filter(
            model_subway.TransitPpltn.area_nm == area_name,
            bucket_ts >= window_start,
        )
        .group_by(
            model_subway.TransitPpltn.data_date,
            model_subway.TransitPpltn.hour_slot,
        )
        .order_by(
            model_subway.TransitPpltn.data_date,
            model_subway.TransitPpltn.hour_slot,
        )
        .all()
    )


def get_transit_ppltn_cumulative_by_type(db: Session, area_name: str):
    """
    현재 시각 기준 직전 24시간 승하차 집계를 교통수단별로 반환합니다 (차트용, KST 기준).
    """
    bucket_ts = cast(
        model_subway.TransitPpltn.data_date
        + func.make_interval(0, 0, 0, 0, model_subway.TransitPpltn.hour_slot),
        DateTime,
    )

    now_kst = func.timezone("Asia/Seoul", func.now())
    window_start = now_kst - func.make_interval(0, 0, 0, 0, 24)

    return (
        db.query(
            model_subway.TransitPpltn.data_date,
            model_subway.TransitPpltn.hour_slot,
            model_subway.TransitPpltn.transport_type,
            model_subway.TransitPpltn.gton_avg,
            model_subway.TransitPpltn.gtoff_avg,
            model_subway.TransitPpltn.last_updated,
        )
        .filter(
            model_subway.TransitPpltn.area_nm == area_name,
            bucket_ts >= window_start,
            bucket_ts <= now_kst,
        )
        .order_by(
            model_subway.TransitPpltn.data_date,
            model_subway.TransitPpltn.hour_slot,
            model_subway.TransitPpltn.transport_type,
        )
        .all()
    )
