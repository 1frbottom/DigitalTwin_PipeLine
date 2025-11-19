import requests
import xml.etree.ElementTree as ET
import time
import json
import os
from kafka import KafkaProducer



# Kafka
KAFKA_SERVERS = ['kafka:29092']
KAFKA_TOPIC = 'realtime-traffic'
KAFKA_REQUEST_TIMEOUT = 15000

# API
API_KEY = os.environ.get("SEOUL_API_KEY")
if not API_KEY:
    print("오류: SEOUL_API_KEY 환경 변수가 설정되지 않았습니다.")
    exit()
    
API_URL_TEMPLATE = f"http://openapi.seoul.go.kr:8088/{API_KEY}/xml/TrafficInfo/1/5/{{link_id}}/"

# 파일
NODE_ID_FILE = "link_IDs.txt"

def connect_kafka_producer():
    """Kafka Producer에 연결을 시도하고, 성공 시 producer 객체를 반환합니다."""
    try:
        producer = KafkaProducer(
            bootstrap_servers=KAFKA_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            request_timeout_ms=KAFKA_REQUEST_TIMEOUT
        )
        print("Kafka Producer에 연결되었습니다.")
        return producer
    except Exception as e:
        print(f"Kafka 연결 중 심각한 오류 발생: {e}")
        time.sleep(5)
        exit()

def load_link_ids(filepath):
    """파일에서 링크 ID 목록을 읽어옵니다."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            link_ids = [line.strip() for line in f if line.strip()]
        print(f"'{filepath}' 파일에서 {len(link_ids)}개의 링크 ID를 읽었습니다.")
        return link_ids
    except FileNotFoundError:
        print(f"오류: '{filepath}' 파일을 찾을 수 없습니다. 스크립트를 종료합니다.")
        exit()

def fetch_and_parse_traffic_data(link_id):
    """단일 링크 ID에 대한 교통 정보를 API로 요청하고 파싱합니다."""
    api_url = API_URL_TEMPLATE.format(link_id=link_id)
    try:
        response = requests.get(api_url, timeout=10)
        response.raise_for_status()
        root = ET.fromstring(response.content)
        row = root.find('row')

        if row is None:
            # API가 정상적으로 에러 메시지를 반환한 경우
            error_msg = root.findtext('.//MESSAGE', '알 수 없는 API 오류')
            print(f"  - API 오류 (link_id: {link_id}): {error_msg}")
            return None

        # findtext를 사용하여 None 체크와 기본값 '0' 설정을 한번에 처리
        avg_speed = float(row.findtext('prcs_spd', '0'))
        travel_time = int(row.findtext('prcs_trv_time', '0'))

        if travel_time <= 0:
            return None # 유효하지 않은 데이터는 전송하지 않음

        return {
            'link_id': link_id,
            'avg_speed': avg_speed,
            'travel_time': travel_time,
            'timestamp': time.time()
        }
    except requests.exceptions.RequestException as e:
        print(f"  - 네트워크 오류 발생 (link_id: {link_id}): {e}")
    except ET.ParseError as e:
        print(f"  - XML 파싱 오류 발생 (link_id: {link_id}): {e}")
    except Exception as e:
        print(f"  - 처리 중 알 수 없는 오류 발생 (link_id: {link_id}): {e}")
    
    return None

# --- 메인 실행 로직 (Main Execution) ---

def main():
    producer = connect_kafka_producer()
    link_ids = load_link_ids(NODE_ID_FILE)
    total_links = len(link_ids)

    print("실시간 데이터 수집을 시작합니다.")
    while True:
        success_count = 0
        
        print(f"새로운 데이터 수집 주기 시작 (총 {total_links}개 링크)")
        
        for link_id in link_ids:
            message = fetch_and_parse_traffic_data(link_id)
            
            if message:
                producer.send(KAFKA_TOPIC, value=message)
                success_count += 1

            time.sleep(0.2)  # 부하 방지

        producer.flush()
        print(f"주기 완료: 총 {total_links}개 중 {success_count}개 데이터 전송 성공.")
        print("road_comm : 15초 후 다시 시작합니다.")
        time.sleep(15)

if __name__ == "__main__":
    main()