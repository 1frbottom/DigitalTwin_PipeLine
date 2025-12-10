import requests
import xmltodict  # XML <-> Dict 변환 라이브러리
import time
import json
import os
from kafka import KafkaProducer



# 구역 설정
TARGET_AREAS = [
    "강남역",
    "신논현역·논현역",
    "역삼역",
    "교대역",
    "양재역",
    ]

# 120구역 테스트
# producer -> Kafka 큐 까지 130초 내외 걸리는듯
# TARGET_AREAS = [
#     "강남 MICE 관광특구",
#     "동대문 관광특구",
#     "명동 관광특구",
#     "이태원 관광특구",
#     "잠실 관광특구",
#     "종로·청계 관광특구",
#     "홍대 관광특구",
#     "경복궁",
#     "광화문·덕수궁",
#     "보신각",
#     "서울 암사동 유적",
#     "창덕궁·종묘",
#     "가산디지털단지역",
#     "강남역",
#     "건대입구역",
#     "고덕역",
#     "고속터미널역",
#     "교대역",
#     "구로디지털단지역",
#     "구로역",
#     "군자역",
#     "대림역",
#     "동대문역",
#     "뚝섬역",
#     "미아사거리역",
#     "발산역",
#     "사당역",
#     "삼각지역",
#     "서울대입구역",
#     "서울식물원·마곡나루역",
#     "서울역",
#     "선릉역",
#     "성신여대입구역",
#     "수유역",
#     "신논현역·논현역",
#     "신도림역",
#     "신림역",
#     "신촌·이대역",
#     "양재역",
#     "역삼역",
#     "연신내역",
#     "오목교역·목동운동장",
#     "왕십리역",
#     "용산역",
#     "이태원역",
#     "장지역",
#     "장한평역",
#     "천호역",
#     "총신대입구(이수)역",
#     "충정로역",
#     "합정역",
#     "혜화역",
#     "홍대입구역(2호선)",
#     "회기역",
#     "가락시장",
#     "가로수길",
#     "광장(전통)시장",
#     "김포공항",
#     "노량진",
#     "덕수궁길·정동길",
#     "북촌한옥마을",
#     "서촌",
#     "성수카페거리",
#     "쌍문역",
#     "압구정로데오거리",
#     "여의도",
#     "연남동",
#     "영등포 타임스퀘어",
#     "용리단길",
#     "이태원 앤틱가구거리",
#     "인사동",
#     "창동 신경제 중심지",
#     "청담동 명품거리",
#     "청량리 제기동 일대 전통시장",
#     "해방촌·경리단길",
#     "DDP(동대문디자인플라자)",
#     "DMC(디지털미디어시티)",
#     "강서한강공원",
#     "고척돔",
#     "광나루한강공원",
#     "광화문광장",
#     "국립중앙박물관·용산가족공원",
#     "난지한강공원",
#     "남산공원",
#     "노들섬",
#     "뚝섬한강공원",
#     "망원한강공원",
#     "반포한강공원",
#     "북서울꿈의숲",
#     "서리풀공원·몽마르뜨공원",
#     "서울광장",
#     "서울대공원",
#     "서울숲공원",
#     "아차산",
#     "양화한강공원",
#     "어린이대공원",
#     "여의도한강공원",
#     "월드컵공원",
#     "응봉산",
#     "이촌한강공원",
#     "잠실종합운동장",
#     "잠실한강공원",
#     "잠원한강공원",
#     "청계산",
#     "청와대",
#     "북창동 먹자골목",
#     "남대문시장",
#     "익선동",
#     "신정네거리역",
#     "잠실새내역",
#     "잠실역",
#     "잠실롯데타워 일대",
#     "송리단길·호수단길",
#     "신촌 스타광장",
#     "보라매공원",
#     "서대문독립공원",
#     "안양천",
#     "여의서로",
#     "올림픽공원",
#     "홍제폭포",
# ]

# Kafka
KAFKA_SERVERS = ['kafka:29092']
KAFKA_TOPIC = 'city-data'
KAFKA_REQUEST_TIMEOUT = 15000

# API
API_KEY = os.environ.get("SEOUL_API_KEY")
if not API_KEY:
    print("[ERROR] city_data : SEOUL_API_KEY 환경 변수가 설정되지 않았습니다.")
    exit()

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
        print(f"[ERROR] city_data :  Kafka 연결 중 심각한 오류 발생: {e}")
        time.sleep(5)
        exit()

def fetch_and_parse_city_data(area_nm):
    """
    도시 데이터를 API로부터 fetch하고 파싱하여 Kafka 메시지 형태로 반환합니다.
    """
    
    API_URL = f"http://openapi.seoul.go.kr:8088/{API_KEY}/xml/citydata/1/5/{area_nm}"

    try:
        response = requests.get(API_URL, timeout=10)
        response.raise_for_status()

        # XML을 OrderedDict로 변환
        data = xmltodict.parse(response.content)
        
        # 데이터가 정상적으로 있는지 확인
        if 'SeoulRtd.citydata' not in data or 'CITYDATA' not in data['SeoulRtd.citydata']:
            error_msg = data.get('RESULT', {}).get('MESSAGE', '알 수 없는 응답')
            print(f"[ERROR] city_data : API 응답 (데이터 없음 또는 오류): {error_msg}")
            return None

        citydata = data['SeoulRtd.citydata']['CITYDATA']
        area_nm = citydata.get('AREA_NM')
        area_cd = citydata.get('AREA_CD')

        if not area_nm or not area_cd:
            print("[ERROR] city_data : 파싱 오류, AREA_NM 또는 AREA_CD를 찾을 수 없습니다.")
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
            'event_stts': json.dumps(citydata.get('EVENT_STTS'), ensure_ascii=False) if citydata.get('EVENT_STTS') else None,
            'live_cmrcl_stts': json.dumps(citydata.get('LIVE_CMRCL_STTS'), ensure_ascii=False) if citydata.get('LIVE_CMRCL_STTS') else None,
            'live_dst_message': json.dumps(citydata.get('LIVE_DST_MESSAGE'), ensure_ascii=False) if citydata.get('LIVE_DST_MESSAGE') else None,
            'live_yna_news': json.dumps(citydata.get('LIVE_YNA_NEWS'), ensure_ascii=False) if citydata.get('LIVE_YNA_NEWS') else None,
        }
        return message

    except requests.exceptions.RequestException as e:
        print(f"[ERROR] city_data :네트워크 오류 발생: {e}", flush=True)
    except Exception as e:
        print(f"[ERROR] city_data : 처리 중 알 수 없는 오류 발생: {e}", flush=True)
    
    return None

# --- 메인 실행 로직 (Main Execution) ---
def main():
    producer = connect_kafka_producer()
    print(f"city_data : 수집 대상 {len(TARGET_AREAS)}곳의 수집을 시작합니다.")
    
    while True:
        start_time = time.time()
        
        for area in TARGET_AREAS:
            print(f"city_data : '{area}' 데이터 수집 시도...")
            message = fetch_and_parse_city_data(area)
            
            if message:
                producer.send(KAFKA_TOPIC, value=message)
                # producer.flush() # 매번 flush하면 느려질 수 있으므로 루프 밖이나 배치 단위 추천 (선택사항)
                print(f"city_data : '{area}' 전송 완료.")
            
            # API 호출 속도 조절 (너무 빠르면 차단될 수 있음)
            time.sleep(1) 

        producer.flush() # 한 바퀴 돌고 일괄 전송
        print("city_data : 모든 지역 수집 완료. 60초 대기...")
        
        # 60초 주기 유지를 위한 로직 (선택사항)
        elapsed = time.time() - start_time
        print(f"--> city_data : producer->Kafka 큐까지의 한 사이클에 걸린 시간 - {elapsed:.2f}초")
        sleep_time = max(0, 60 - elapsed)
        time.sleep(sleep_time)

if __name__ == "__main__":
    main()