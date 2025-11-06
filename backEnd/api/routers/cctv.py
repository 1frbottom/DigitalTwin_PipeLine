from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/cctv",
    tags=["cctv"]
)

CCTV_STREAMS = [
    {
        "id": "1",
        "name": "강남역",
        "stream_url": "https://strm2.spatic.go.kr/live/207.stream/chunklist_w1500799502.m3u8",
    },
    {
        "id": "2", 
        "name": "강남대로",
        "stream_url": "https://kbsapi.loomex.net/v1/api/cctvRequest/9999/oiP/gEh92rRZVvLwEtVUVhWEpulRdMNRw8yIyDdolNtGqJ0IqZJrNK+rIap6arMD",
    },
    {
        "id": "3",
        "name": "신논현역",
        "stream_url": "https://strm3.spatic.go.kr/live/289.stream/playlist.m3u8",
    }
]

class CCTVStream(BaseModel):
    id: str
    name: str
    stream_url: str

class CCTVResponse(BaseModel):
    message: str
    data: List[CCTVStream]

def is_valid_url(url: str) -> bool:
    """URL 유효성 검사"""
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False

def get_invalid_stream_ids(streams: List[dict]) -> List[str]:
    """유효하지 않은 스트림 ID 반환"""
    return [
        s["id"] for s in streams 
        if not is_valid_url(s["stream_url"])
    ]

@router.get("/streams", response_model=CCTVResponse)
async def get_cctv_streams():
    """CCTV 스트림 URL 목록 조회"""
    try:
        invalid_ids = get_invalid_stream_ids(CCTV_STREAMS)
        
        if invalid_ids:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "유효하지 않은 CCTV URL 발견",
                    "invalid_ids": invalid_ids
                }
            )
        
        return CCTVResponse(
            message="CCTV 스트림 목록 조회 성공",
            data=CCTV_STREAMS
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CCTV 스트림 조회 오류: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="서버 오류"
        )
