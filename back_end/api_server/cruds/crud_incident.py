from sqlalchemy.orm import Session
from sqlalchemy import text
import time

def get_active_incidents(db: Session):
    """
    최근 30분 이내에 업데이트된 돌발 정보 중,
    각 사고 ID(acc_id)별로 가장 최신(timestamp가 큰) 데이터만 조회합니다.
    """
    
    # 1. 현재 시간(초 단위 timestamp) 구하기
    current_ts = time.time()
    
    # 2. 유효 시간 기준 설정 (현재 시간 - 1800초 = 30분 전)
    # 이 시간보다 이전 데이터는 '종료된 상황'으로 간주하고 API에서 제외합니다.
    limit_ts = current_ts - 1800 
    
    # 3. Raw SQL 작성
    # 서브쿼리(latest): 30분 이내 데이터 중 ID별 Max timestamp 구함
    # 메인쿼리(t): 원본 테이블과 조인하여 나머지 상세 정보 가져옴
    query = text("""
        SELECT t.*
        FROM traffic_incidents t
        INNER JOIN (
            SELECT acc_id, MAX(timestamp) as max_ts
            FROM traffic_incidents
            WHERE timestamp > :limit_ts
            GROUP BY acc_id
        ) latest 
        ON t.acc_id = latest.acc_id AND t.timestamp = latest.max_ts
    """)
    
    # 4. 쿼리 실행 및 결과 매핑
    result = db.execute(query, {"limit_ts": limit_ts}).fetchall()
    
    # SQLAlchemy Row 객체를 딕셔너리 리스트로 변환하여 반환
    # (Pydantic 모델이 이를 받아 JSON으로 변환함)
    return [dict(row._mapping) for row in result]