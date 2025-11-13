from sqlalchemy.orm import Session
from backEnd.apiServer.models import model_cctv

# ========== CCTV 관련 ==========
# CCTV 스트림 목록 조회
def get_cctv_streams(db: Session):
    return db.query(model_cctv.CCTVStreamModel).all()

# 특정 CCTV 스트림 조회
def get_cctv_stream_by_id(db: Session, cctv_id: str):
    return db.query(model_cctv.CCTVStreamModel)\
        .filter(model_cctv.CCTVStreamModel.id == cctv_id)\
        .first()
