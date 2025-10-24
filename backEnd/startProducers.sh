#!/bin/sh

cd /app

echo ">>> Waiting for Kafka to be ready..."
while ! nc -z kafka 29092; do
  sleep 1
done
echo ">>> Kafka is ready!"

echo ">>> Starting Kafka Producer Script..."
python3 /app/producer_roadComm_se_rt.py