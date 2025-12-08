import requests
import xmltodict  # XML <-> Dict 변환 라이브러리
import time
import json
import os
from kafka import KafkaProducer



# Kafka
KAFKA_SERVERS = ['kafka:29092']
KAFKA_TOPIC = 'city-data'
KAFKA_REQUEST_TIMEOUT = 15000

# API
API_KEY = os.environ.get("SEOUL_API_KEY")
if not API_KEY:
    print("오류: SEOUL_API_KEY 환경 변수가 설정되지 않았습니다.")
    exit()

AREA_NM = "POI014"
API_URL = f"http://openapi.seoul.go.kr:8088/{API_KEY}/xml/citydata/1/1000/{AREA_NM}"

def connect_kafka_producer():
    """Kafka Producer에 연결을 시도하고, 성공 시 producer 객체를 반환합니다."""
    try:
        producer = KafkaProducer(
            bootstrap_servers=KAFKA_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            request_timeout_ms=KAFKA_REQUEST_TIMEOUT
        )
        print("city_data : Kafka Producer에 연결되었습니다.")
        return producer
    except Exception as e:
        print(f"city_data : Kafka 연결 중 심각한 오류 발생: {e}")
        time.sleep(5)
        exit()

def fetch_and_parse_city_data():
    """
    도시 데이터를 API로부터 fetch하고 파싱하여 Kafka 메시지 형태로 반환합니다.
    """
    try:
        response = requests.get(API_URL, timeout=10)
        response.raise_for_status()

        # XML을 OrderedDict로 변환
        data = xmltodict.parse(response.content)
        
        # 데이터가 정상적으로 있는지 확인
        if 'SeoulRtd.citydata' not in data or 'CITYDATA' not in data['SeoulRtd.citydata']:
            error_msg = data.get('RESULT', {}).get('MESSAGE', '알 수 없는 응답')
            print(f"  - API 응답 (데이터 없음 또는 오류): {error_msg}")
            return None

        citydata = data['SeoulRtd.citydata']['CITYDATA']
        area_nm = citydata.get('AREA_NM')
        area_cd = citydata.get('AREA_CD')

        if not area_nm or not area_cd:
            print("  - 파싱 오류: AREA_NM 또는 AREA_CD를 찾을 수 없습니다.")
            return None

        # 원본 테이블 스키마에 맞게 각 섹션을 JSON 문자열로 직렬화
        # xmltodict가 하위 노드를 자동으로 dict/list로 변환해줍니다.
        message = {
            'area_nm': area_nm,
            'area_cd': area_cd,
            'timestamp': time.time(),
            'live_ppltn_stts': json.dumps(citydata.get('LIVE_PPLTN_STTS'), ensure_ascii=False) if citydata.get('LIVE_PPLTN_STTS') else None,
            'road_traffic_stts': json.dumps(citydata.get('ROAD_TRAFFIC_STTS'), ensure_ascii=False) if citydata.get('ROAD_TRAFFIC_STTS') else None,
            'prk_stts': json.dumps(citydata.get('PRK_STTS'), ensure_ascii=False) if citydata.get('PRK_STTS') else None,
            'sub_stts': json.dumps(citydata.get('SUB_STTS'), ensure_ascii=False) if citydata.get('SUB_STTS') else None,
            'live_sub_ppltn': json.dumps(citydata.get('LIVE_SUB_PPLTN'), ensure_ascii=False) if citydata.get('LIVE_SUB_PPLTN') else None, # [추가됨]
            'bus_stn_stts': json.dumps(citydata.get('BUS_STN_STTS'), ensure_ascii=False) if citydata.get('BUS_STN_STTS') else None,
            'live_bus_ppltn': json.dumps(citydata.get('LIVE_BUS_PPLTN'), ensure_ascii=False) if citydata.get('LIVE_BUS_PPLTN') else None, # [추가됨]
            'acdnt_cntrl_stts': json.dumps(citydata.get('ACDNT_CNTRL_STTS'), ensure_ascii=False) if citydata.get('ACDNT_CNTRL_STTS') else None,
            'sbike_stts': json.dumps(citydata.get('SBIKE_STTS'), ensure_ascii=False) if citydata.get('SBIKE_STTS') else None,
            'weather_stts': json.dumps(citydata.get('WEATHER_STTS'), ensure_ascii=False) if citydata.get('WEATHER_STTS') else None,
            'charger_stts': json.dumps(citydata.get('CHARGER_STTS'), ensure_ascii=False) if citydata.get('CHARGER_STTS') else None,
            'event_stts': json.dumps(citydata.get('CULTURALEVENTINFO'), ensure_ascii=False) if citydata.get('CULTURALEVENTINFO') else None,
            'live_cmrcl_stts': json.dumps(citydata.get('LIVE_CMRCL_STTS'), ensure_ascii=False) if citydata.get('LIVE_CMRCL_STTS') else None,
            'live_dst_message': json.dumps(citydata.get('LIVE_DST_MESSAGE'), ensure_ascii=False) if citydata.get('LIVE_DST_MESSAGE') else None,
            'live_yna_news': json.dumps(citydata.get('LIVE_YNA_NEWS'), ensure_ascii=False) if citydata.get('LIVE_YNA_NEWS') else None,
        }
        return message

    except requests.exceptions.RequestException as e:
        print(f"  - 네트워크 오류 발생: {e}", flush=True)
    except Exception as e:
        print(f"  - 처리 중 알 수 없는 오류 발생: {e}", flush=True)
    
    return None

# --- 메인 실행 로직 (Main Execution) ---
def main():
    producer = connect_kafka_producer()
    
    print("city_data : 수집을 시작합니다.")
    
    while True:
        print(f"city_data : {AREA_NM} 데이터 수집 주기 시작")
        
        message = fetch_and_parse_city_data()
        
        if message:
            producer.send(KAFKA_TOPIC, value=message)
            producer.flush()
            print(f"city_data : {AREA_NM} 데이터 전송 완료.")
        else:
            print(f"city_data : {AREA_NM} 데이터 수신 실패.")

        # 도시 데이터는 5분(300초) 주기로 수집 (API 정책에 맞게 조절)
        print("city_data : 300초 후 다시 시작합니다.")
        time.sleep(300)

if __name__ == "__main__":
    main()