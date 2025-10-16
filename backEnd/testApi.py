import requests
import xml.etree.ElementTree as ET
import time

# 1. API 정보 설정
API_KEY = "64496f53736974733530424d6b4b4a"
API_TYPE = "xml"
SERVICE_NAME = "TrafficInfo"
START_INDEX = 1
END_INDEX = 5

# 2. 링크 ID 목록을 파일에서 읽어오기
NODE_ID_FILE = "linkIDs.txt"
link_ids = []
try:
    with open(NODE_ID_FILE, 'r', encoding='utf-8') as f:
        link_ids = [line.strip() for line in f if line.strip()]
    print(f"'{NODE_ID_FILE}' 파일에서 {len(link_ids)}개의 링크 ID를 읽었습니다.")
except FileNotFoundError:
    print(f"오류: '{NODE_ID_FILE}' 파일을 찾을 수 없습니다.")
    exit()

# 3. 총 소요 시간을 저장할 변수 초기화
total_travel_time = 0
total_requests = len(link_ids)
success_count = 0

if total_requests < 1:
    print("조회할 링크 ID가 파일에 없습니다.")
else:
    print(f"총 {total_requests}개 링크에 대한 정보 조회를 시작합니다.")

    # 4. 링크 ID 목록을 순회하며 각 링크의 정보 요청
    for i, link_id in enumerate(link_ids):
        api_url = f"http://openapi.seoul.go.kr:8088/{API_KEY}/{API_TYPE}/{SERVICE_NAME}/{START_INDEX}/{END_INDEX}/{link_id}/"
        print(f"[{i+1}/{total_requests}] 링크 조회 중: {link_id}")

        try:
            response = requests.get(api_url)
            response.raise_for_status()
            root = ET.fromstring(response.text)
            row = root.find('row')

            if row is not None:
                def get_safe_text(element, tag_name, default_value):
                    found_tag = element.find(tag_name)
                    if found_tag is not None and found_tag.text is not None:
                        return found_tag.text
                    return default_value

                # params should be small case
                avg_speed = float(get_safe_text(row, 'prcs_spd', '0'))
                travel_time = int(get_safe_text(row, 'prcs_trv_time', '0'))

                if travel_time > 0:
                    total_travel_time += travel_time
                    success_count += 1
                    print(f"  - 성공: 속도 {avg_speed:.2f} km/h, 소요 시간 {travel_time}초")
                else:
                    print("  - 정보 없음: 유효한 데이터가 반환되지 않았습니다.")
            else:
                result_msg_tag = root.find('RESULT/MESSAGE')
                if result_msg_tag is not None:
                    print(f"  - 실패: {result_msg_tag.text}")
                else:
                    print("  - 실패: 알 수 없는 오류 또는 데이터 없음")

        except requests.exceptions.RequestException as e:
            print(f"  - 네트워크 오류 발생: {e}")
        except Exception as e:
            print(f"  - 처리 중 오류 발생: {e}")

        time.sleep(0.1)

    print("\n모든 링크 조회가 완료되었습니다.")

    # 5. 최종 결과 출력
    if success_count > 0:
        total_minutes = total_travel_time // 60
        total_seconds = total_travel_time % 60

        print("\n최종 요약")
        print(f"총 {total_requests}개 링크 중 {success_count}개 조회 성공")
        print(f"총 예상 소요 시간: {total_travel_time} 초  ({total_minutes}분 {total_seconds}초)")
    else:
        print("\n최종 요약")
        print("조회에 성공한 링크가 없어 요약 정보를 표시할 수 없습니다.")