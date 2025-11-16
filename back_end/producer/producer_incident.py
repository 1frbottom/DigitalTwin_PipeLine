import requests
import xml.etree.ElementTree as ET
import time
import json
import os
from kafka import KafkaProducer



# Kafka
KAFKA_SERVERS = ['kafka:29092']
KAFKA_TOPIC = 'traffic-incidents'
KAFKA_REQUEST_TIMEOUT = 15000

# API
API_KEY = os.environ.get("SEOUL_API_KEY")
if not API_KEY:
    print("오류: SEOUL_API_KEY 환경 변수가 설정되지 않았습니다.")
    exit()
    
API_URL = f"http://openapi.seoul.go.kr:8088/{API_KEY}/xml/AccInfo/1/1000/"

def connect_kafka_producer():
    """Kafka Producer에 연결을 시도하고, 성공 시 producer 객체를 반환합니다."""
    try:
        producer = KafkaProducer(
            bootstrap_servers=KAFKA_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            request_timeout_ms=KAFKA_REQUEST_TIMEOUT
        )
        print("Incident : Kafka Producer에 연결되었습니다.")
        return producer
    except Exception as e:
        print(f"Kafka 연결 중 심각한 오류 발생: {e}")
        time.sleep(5)
        exit()

def fetch_parse_incident_data():

    incident_list = []
    try:
        response = requests.get(API_URL, timeout=10)

        response.raise_for_status()
        root = ET.fromstring(response.content)

        try:
            raw_xml_response = ET.tostring(root, encoding='unicode')
            #print(f"### DEBUG: API에서 수신한 XML 원본:\n{raw_xml_response}\n", flush=True)
        except Exception as e:
            print(f"### DEBUG: XML 응답 출력 중 오류: {e}")
        
        rows = root.findall('.//row')
        if not rows:
            error_msg = root.findtext('.//MESSAGE', '데이터 없음')
            print(f"  - API 응답 (데이터 없음 또는 오류): {error_msg}")

            return []

        for row in rows:
            acc_id = row.findtext('acc_id')
            if not acc_id:
                continue

            message = {
                'acc_id': acc_id,
                'occr_date': row.findtext('occr_date'),
                'occr_time': row.findtext('occr_time'),
                'exp_clr_date': row.findtext('exp_clr_date'),
                'exp_clr_time': row.findtext('exp_clr_time'),
                'acc_type': row.findtext('acc_type'), 
                'acc_dtype': row.findtext('acc_dtype'),
                'link_id': row.findtext('link_id'),
                'grs80tm_x': row.findtext('grs80tm_x'),
                'grs80tm_y': row.findtext('grs80tm_y'),
                'acc_info': row.findtext('acc_info'),
                'timestamp': time.time()
            }
            incident_list.append(message)
            
        return incident_list

    except requests.exceptions.RequestException as e:
        print(f"  - 네트워크 오류 발생: {e}", flush=True)
    except ET.ParseError as e:
        print(f"  - XML 파싱 오류 발생: {e}", flush=True)
    except Exception as e:
        print(f"  - 처리 중 알 수 없는 오류 발생: {e}", flush=True)
    
    return []

# --- 메인 실행 로직 (Main Execution) ---
def main():
    producer = connect_kafka_producer()
    
    print("incident : 수집을 시작합니다.")
    processed_ids = set()

    while True:
        print(f"incident : 새로운 데이터 수집 주기 시작 (처리된 ID: {len(processed_ids)}개)")
        
        incidents = fetch_parse_incident_data() # 함수 호출 방식 변경
        success_count = 0
        
        if incidents:
            for message in incidents: # API가 반환한 리스트를 순회
                acc_id = message.get('acc_id')
                
                # 중복 체크: 이미 보낸 ID는 건너뜀
                if acc_id and acc_id not in processed_ids:
                    producer.send(KAFKA_TOPIC, value=message)
                    processed_ids.add(acc_id) # 처리된 ID로 추가
                    success_count += 1
                
            producer.flush()
            print(f"incident : 주기 완료: {len(incidents)}개 수신, {success_count}개 신규 전송.")
        else:
            print("주기 완료: 수신된 데이터 없음.")

        print("incident : 60초 후 다시 시작합니다.")
        time.sleep(60)



if __name__ == "__main__":
    main()