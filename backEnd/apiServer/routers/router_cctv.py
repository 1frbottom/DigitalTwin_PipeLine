from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session
import logging
from backEnd.apiServer.crud import crud_cctv
from backEnd.apiServer import database

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/cctv",
    tags=["cctv"]
)

class CCTVStream(BaseModel):
    id: str
    name: str
    stream_url: str

    class Config:
        from_attributes = True

class CCTVResponse(BaseModel):
    message: str
    data: List[CCTVStream]

@router.get("/streams", response_model=CCTVResponse)
async def get_cctv_streams_endpoint(db: Session = Depends(database.get_db)):
    """CCTV 스트림 URL 목록 조회"""
    try:
        streams = crud_cctv.get_cctv_streams(db)
        if not streams:
            raise HTTPException(status_code=404, detail="CCTV 스트림 데이터가 없습니다")
        return CCTVResponse(message="CCTV 스트림 목록 조회 성공", data=streams)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CCTV 스트림 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="서버 오류")

@router.get("/stream/{cctv_id}", response_model=CCTVStream)
async def get_cctv_stream_by_id_endpoint(cctv_id: str, db: Session = Depends(database.get_db)):
    """특정 CCTV 스트림 조회"""
    try:
        stream = crud_cctv.get_cctv_stream_by_id(db, cctv_id)
        if not stream:
            raise HTTPException(status_code=404, detail=f"ID '{cctv_id}'의 CCTV를 찾을 수 없습니다")
        return stream
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CCTV 스트림 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail="서버 오류")
