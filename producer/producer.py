import time
import json
import random
from kafka import KafkaProducer




# 카프카 서버 주소
bootstrap_servers = ['localhost:9092']

# 카프카 토픽 이름
topic_name = 'traffic-data'

producer = KafkaProducer(
    bootstrap_servers=bootstrap_servers,
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

print("Sending messages...")

while True:
    # 가상 데이터 생성 (차량 수)
    vehicle_count = random.randint(1, 50)
    message = {'vehicle_count': vehicle_count, 'timestamp': time.time()}

    # 'traffic-data' 토픽으로 메시지 전송
    producer.send(topic_name, value=message)
    print(f"Sent: {message}")

    time.sleep(1)