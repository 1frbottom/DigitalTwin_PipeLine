from __future__ import annotations
import os
from typing import Any, Dict, Optional
import httpx
import xmltodict

SEOUL_API_BASE = "http://openapi.seoul.go.kr:8088"
DEFAULT_SERVICE = "citydata"
DEFAULT_TYPE = "xml"

#HTTP/XML 파싱 오류 시
class CityAPIError(RuntimeError):
    pass

# XML 응답을 dict로 반환. RESULT.CODE != 'INFO-000' 이면 예외 발생.
async def get_citydata(
    area_nm: str,
    *,
    start_index: int = 1,
    end_index: int = 5,
    service: str = DEFAULT_SERVICE,
    type_: str = DEFAULT_TYPE,
    api_key: Optional[str] = None,
    timeout: float = 8.0,
) -> Dict[str, Any]:
        
    key = api_key or os.getenv("SEOUL_API_KEY")
    if not key:
        raise CityAPIError("SEOUL_API_KEY 환경변수가 비어 있습니다.")

    path = f"/{key}/{type_}/{service}/{start_index}/{end_index}/{area_nm}"
    url = SEOUL_API_BASE + path

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = xmltodict.parse(r.text)  # XML -> dict
    except httpx.HTTPError as e:
        raise CityAPIError(f"HTTP 오류: {e}") from e
    except Exception as e:
        raise CityAPIError(f"파싱 오류: {e}") from e

    # 에러코드 확인
    result = _dig(data, "RESULT")
    if isinstance(result, dict):
        code = str(result.get("CODE", ""))
        if code and code != "INFO-000":
            msg = result.get("MESSAGE", "API error")
            raise CityAPIError(f"{code}: {msg}")

    return data


def _dig(d: Any, key: str):
    """중첩 구조에서 첫 매칭되는 key(dict 또는 값) 반환 (대소문자 무시)."""
    if isinstance(d, dict):
        for k, v in d.items():
            if k.lower() == key.lower():
                return v
            found = _dig(v, key)
            if found is not None:
                return found
    elif isinstance(d, list):
        for it in d:
            found = _dig(it, key)
            if found is not None:
                return found
    return None