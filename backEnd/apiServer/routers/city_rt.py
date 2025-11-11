from __future__ import annotations
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, Query

from backEnd.apiServer.city_client import get_citydata, CityAPIError

router = APIRouter(prefix="/api/citydata", tags=["citydata"])

@router.get("", summary="서울 실시간 도시데이터 조회")
async def citydata_endpoint(
    area_nm: str | None = Query(
        None,
        description="단일/쉼표 구분 복수 입력 (예: 강남역 일대,신논현·논현역 일대)",
    ),
    areas: List[str] | None = Query(
        None,
        description="복수 장소 반복 파라미터 (예: areas=강남역 일대&areas=신논현·논현역 일대)",
    ),
    start_index: int = Query(1, ge=1, description="페이징 시작"),
    end_index: int = Query(5, ge=1, description="페이징 끝"),
) -> Dict[str, Any]:
    
    # 1) 조회 대상 만들기
    targets: List[str] = []
    if areas:
        targets = [a.strip() for a in areas if a and a.strip()]
    elif area_nm:
        targets = [s.strip() for s in area_nm.split(",") if s.strip()]

    if not targets:
        raise HTTPException(status_code=400, detail="area_nm 또는 areas를 지정하세요.")

    # 2) 각 지역 호출 → 합치기
    merged_rows: List[Dict[str, Any]] = []
    total_count = 0
    raw_by_area: Dict[str, Any] = {}

    try:
        for name in targets:
            raw = await get_citydata(
                area_nm=name,
                start_index=start_index,
                end_index=end_index,
            )
            raw_by_area[name] = raw

            normalized = _normalize_citydata(raw)
            rows = normalized.get("rows", [])
            for r in rows:
                if isinstance(r, dict):
                    # 어떤 키로 조회했는지 표시(프런트 디버깅용)
                    r.setdefault("_AREA_QUERY", name)

            merged_rows.extend(rows)
            total_count += normalized.get("count") or 0

    except CityAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"citydata 호출 실패: {e}")

    return {
        "result": {"code": "INFO-000", "message": "OK"},
        "count": total_count if total_count else len(merged_rows),
        "rows": merged_rows,
        "raw_by_area": raw_by_area,  # 필요 시 원본 접근
    }


# 중첩 dict/list에서 첫 매칭 key값 반환 (대소문자 무시)
def _get(d: Any, key: str):
    if isinstance(d, dict):
        for k, v in d.items():
            if k.lower() == key.lower():
                return v
            got = _get(v, key)
            if got is not None:
                return got
    elif isinstance(d, list):
        for it in d:
            got = _get(it, key)
            if got is not None:
                return got
    return None

# 데이터 구조 단순화
def _normalize_citydata(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    {
      "result": {"code": str|None, "message": str|None},
      "count": int|None,
      "rows": [ {...}, ... ],
      "raw": raw
    }
    """
    result = _get(raw, "RESULT") or {}
    count = _get(raw, "list_total_count")

    # 탐색
    rows = _get(raw, "row")
    if rows is None:
        rows = []
    elif isinstance(rows, dict):
        rows = [rows]

    # 숫자 변환
    try:
        count_val = int(count) if count is not None and str(count).isdigit() else None
    except Exception:
        count_val = None

    return {
        "result": {
            "code": str(result.get("CODE")) if isinstance(result, dict) else None,
            "message": result.get("MESSAGE") if isinstance(result, dict) else None,
        },
        "count": count_val,
        "rows": rows,
        "raw": raw,
    }
