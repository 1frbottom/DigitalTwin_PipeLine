# DIgitalTwin_PipeLine

- [docker terminal] docker compose up -d

- [docker app] check producer's log
- [docker app] check spark-submit(processor)'s log

- [docker app] go to db's exec and type
	'psql -U user -d traffic_db'
	'SELECT * FROM traffic_data LIMIT 10;'
	'\q'

- [docker terminal] docker compose down
