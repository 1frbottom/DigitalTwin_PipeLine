#!/bin/sh

cd /app

echo ">>> Waiting for Kafka to be ready..."
while ! nc -z kafka 29092; do
  sleep 1
done

echo ">>> Kafka is ready!"

echo ">>> Starting ALL Kafka Producer Scripts..."

python3 -u /app/producer_road_comm.py &

python3 -u /app/producer_incident.py &

wait -n