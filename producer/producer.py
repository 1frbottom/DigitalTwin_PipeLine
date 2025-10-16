import time
import json
import random
from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable

# 카프카 서버 주소
bootstrap_servers = ['kafka:29092']

# 카프카 토픽 이름
topic_name = 'traffic-data'

producer = KafkaProducer(
    bootstrap_servers=bootstrap_servers,
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

print("Kafka Producer connected. Sending messages...")

while True:
    message = {
        'vehicle_count': random.randint(1, 50),
        'timestamp': time.time()
    }
    
    try:
        # 메시지 전송 시도
        producer.send(topic_name, value=message)
        print(f"Sent: {message}")

    except Exception as e:
        print(f"Error sending message: {e}")
        time.sleep(5) 

    time.sleep(1)