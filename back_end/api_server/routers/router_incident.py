from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..cruds import crud_incident
from ..models import model_incident

router = APIRouter(
    prefix="/incident",
    tags=["Traffic Incident - 돌발 정보"],
)

@router.get("/active", response_model=List[model_incident.TrafficIncidentBase])
def read_active_incidents(db: Session = Depends(get_db)):
    """
    현재 진행 중인(최근 30분 내 갱신된) 돌발 정보를 조회합니다.
    만료된 정보나 중복된 과거 이력은 제외됩니다.
    """
    return crud_incident.get_active_incidents(db)