# DigitalTwin_PipeLine<br><br>

- 프론트 제외 전부 도커 컨테이너 위에서 동작합니다.<br><br>

- producer_asdf.py (데이터 생성, api별로 존재) -><br><br>
		spark (데이터 가공 / processor.py) -><br><br>
		spark (데이터 저장 및 조회 / postgres DB) -><br><br>
		api_server (api called) -><br><br>
		front_end (api caller)<br><br>

- 사용법<br>
	- 프로젝트 클론 후 본인 브랜치로 체크아웃<br><br>

	- 패치(patch)로 커밋목록 최신화 및 확인<br><br>

	- 루트에 .env 파일을 만들고 아래 붙여넣기<br>
		```
		# 서울 열린데이터 광장 (https://data.seoul.go.kr)
		SEOUL_API_KEY=

		# Google Cloud Maps API Key
		GOOGLE_MAPS_API_KEY=

		# 1. API Server
		HOST_PORT_API=58000

		# 2. Kafka External
		HOST_PORT_KAFKA=59092

		# 3. PostgreSQL
		HOST_PORT_DB=54320

		# 4. Spark Master UI
		HOST_PORT_SPARK_UI=58080
		```
		<br>

	- 프로젝트의 루트 디렉토리에서 터미널 실행 & 도커 데스크탑 앱 실행<br><br>

	- [terminal] docker compose up -d<br><br>

	- [docker app] 여러 컨테이너들에 불이 잘 들어와있나 체크 (kafka-setup은 실행 몇초 후 꺼지는게 정상)<br><br>

	- [docker app] (프론트는 바로 html 열어서 봐도 됩니다. 필요한 경우에) db 컨테이너의 exec으로 가서 아래의 명령어 입력<br>
		```
		psql -U user -d traffic_db

		\dt

		SELECT * FROM 테이블명 LIMIT 10;
		
		\q
		```
		<br>

	- [terminal] docker compose down<br><br>

	- .yml이나 .sql 등 코어 소스가 아닌 이상 compose 올려놓고 작업해도 바로바로 반영 됩니다.<br><br>

	- 다만 볼륨( db의 테이블 및 튜플들 등 )같은경우는 자주 지웠다 썼다 하는경우가 많으니 이경우는 docker compose down -v 와 docker compose up --build -d 를 자주 사용합니다.<br><br>

	- 아예 초기화는 docker system prune --all --volumes<br><br>

	- api 지역 바꿀 경우<br>
		```
		1. producer_city_data의 TARGET_AREAS에 원하는 지역 추가
		
		2. js파일의 TARGET_AREA_NAME을 원하는 지역으로 변경

		3. producer 컨테이너 재시작(docker compose restart producer) 후 1~2분 대기

		4. 대시보드 새로고침

		5. 필요시 api 응답 확인(curl "http://localhost:58000/city/events/cultural?area_name=지역명"),
			DB 체크(SELECT COUNT(*) FROM 테이블명 WHERE area_nm='지역명';)
		```
		<br>


- 발생할만한 에러 및 트러블슈팅<br>
	- 각 컨테이너의 로그에 port 관련 문제가 찍혀있는 경우, .env의 포트를 바꿔서 시도해보세요.<br><br>
	- back_end/start_producers.sh 파일이 윈도우 기반 CRLF로 되어있는 경우 도커가 작동하지 않으니 LF로 바꿔줘야 합니다.<br><br>
	- producer에서 api xml 태그 줄때 대소문자 뭐가맞는지 확인 필요, 서울 열린데이터는 소문자.<br><br>
	- producer - spark 간에 레이스컨디션때문에 아예 못받아올 수 있음, 켜진상태로 producer를 재시작해보고 확인.<br><br>
	- API의 response 원문이 깨져서 오는경우도 간혹 있으니 원문 확인 필요.<br><br>