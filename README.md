# DIgitalTwin_PipeLine

- [docker terminal] docker compose up -d
- [producer terminal] python producer.py
- [processor terminal] docker exec -it db psql -U user -d traffic_db
- [processor terminal] \dt
- [processor terminal] SELECT * FROM traffic_data;
- [processor terminal] \q
- [docker terminal] docker compose down
