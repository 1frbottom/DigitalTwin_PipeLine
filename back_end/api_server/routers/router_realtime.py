from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import model_realtime
from ..schemas import schema_city, schema_subway


router = APIRouter(
    prefix="/realtime",
    tags=["Realtime - 실시간율"],
)


def _to_dt(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromtimestamp(float(val), tz=timezone.utc)
    except Exception:
        return None


def _build_metric(name: str, ts, window_sec: int, now: datetime) -> model_realtime.RealtimeMetric:
    dt = _to_dt(ts)
    if dt is None:
        return model_realtime.RealtimeMetric(feature=name, rate=0, age_sec=None, window_sec=window_sec, timestamp=None)
    age_sec = int((now - dt).total_seconds())
    rate = 100 if age_sec <= window_sec else 0
    return model_realtime.RealtimeMetric(feature=name, rate=rate, age_sec=age_sec, window_sec=window_sec, timestamp=dt)


@router.get("/status", response_model=model_realtime.RealtimeStatus)
def read_realtime_status(area_name: str, db: Session = Depends(get_db)):
    """
    주요 실시간 피처별 최신 수집 시각을 확인해 실시간 충족 여부(율)를 반환합니다.
    - LIVE_PPLTN_STTS: 5분
    - ROAD_TRAFFIC_STTS: 5분
    - SUB_STTS: 10초
    - LIVE_SUB_PPLTN / LIVE_BUS_PPLTN: 5분
    - WEATHER_STTS: 10분
    - EVENT_STTS: 1일
    CCTV는 제외
    """
    now = datetime.now(timezone.utc)
    metrics: Dict[str, model_realtime.RealtimeMetric] = {}

    # LIVE_PPLTN_STTS (5분)
    live_ppltn_ts = db.query(func.max(schema_city.LivePpltnProc.ppltn_time))\
        .filter(schema_city.LivePpltnProc.area_nm == area_name)\
        .scalar()
    metrics["population"] = _build_metric("LIVE_PPLTN_STTS", live_ppltn_ts, 5 * 60, now)

    # ROAD_TRAFFIC_STTS (5분)
    road_ts = db.query(func.max(schema_city.LiveRoadTrafficAvg.road_traffic_time))\
        .filter(schema_city.LiveRoadTrafficAvg.area_nm == area_name)\
        .scalar()
    metrics["road_traffic"] = _build_metric("ROAD_TRAFFIC_STTS", road_ts, 5 * 60, now)

    # SUB_STTS (10초)
    subway_ts = db.query(func.max(schema_subway.SubwayArrival.ingest_timestamp))\
        .filter(schema_subway.SubwayArrival.area_nm == area_name)\
        .scalar()
    metrics["subway_arrival"] = _build_metric("SUB_STTS", subway_ts, 10, now)

    # LIVE_SUB_PPLTN (5분)
    sub_raw_ts = db.query(func.max(schema_city.CityDataRaw.timestamp))\
        .filter(
            schema_city.CityDataRaw.area_nm == area_name,
            schema_city.CityDataRaw.live_sub_ppltn.isnot(None)
        )\
        .scalar()
    metrics["live_sub_ppltn"] = _build_metric("LIVE_SUB_PPLTN", sub_raw_ts, 5 * 60, now)

    # LIVE_BUS_PPLTN (5분)
    bus_raw_ts = db.query(func.max(schema_city.CityDataRaw.timestamp))\
        .filter(
            schema_city.CityDataRaw.area_nm == area_name,
            schema_city.CityDataRaw.live_bus_ppltn.isnot(None)
        )\
        .scalar()
    metrics["live_bus_ppltn"] = _build_metric("LIVE_BUS_PPLTN", bus_raw_ts, 5 * 60, now)

    # WEATHER_STTS (10분)
    weather_ts = db.query(func.max(schema_city.CityWeatherProc.weather_time))\
        .filter(schema_city.CityWeatherProc.area_nm == area_name)\
        .scalar()
    metrics["weather"] = _build_metric("WEATHER_STTS", weather_ts, 10 * 60, now)

    # EVENT_STTS (1일)
    event_ts = db.query(func.max(schema_city.CulturalEventProc.ingest_timestamp))\
        .filter(schema_city.CulturalEventProc.area_nm == area_name)\
        .scalar()
    metrics["event"] = _build_metric("EVENT_STTS", event_ts, 24 * 60 * 60, now)

    return model_realtime.RealtimeStatus(area_nm=area_name, metrics=metrics)
