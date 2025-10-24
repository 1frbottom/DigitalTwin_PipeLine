# DigitalTwin_PipeLine<br><br>

- 프로젝트 프로토타이핑 입니다<br><br>

- 전부 도커 컨테이너 위에서 동작합니다.<br><br>

- 현재 producer_asdf.py(데이터 생성) -> spark(데이터 가공 / processor.py) -> spark(데이터 저장 및 조회 / postgres DB) 순의 기능이 가능합니다.<br><br>

- 추후 프로젝트 구성 목표<br>
	- backEnd 폴더에서 실제 api 여러개 호출 및 저장까지 일련의 테스트<br><br>
	- frotnEnd 폴더에서 backEnd로 데이터 요청하면 db 조회후 frontEnd로 전달<br><br>
	- frontEnd에서 받은 데이터로 대시보드 출력<br><br>

- 사용법<br>
	- 루트에 .env 파일을 만들고 "SEOUL_API_KEY=본인의 서울 열린데이터 api key" 한줄 입력후 저장

	- [docker terminal] docker compose up -d<br><br>

	- [docker app] producer 컨테이너의 로그 정상인지 체크<br><br>
	- [docker app] spark-submit(processor) 컨테이너의 로그 정상인지 체크<br><br>

	- [docker app] db 컨테이너의 exec으로 가서 아래의 명령어 입력<br><br>
		- psql -U user -d traffic_db<br><br>
		- SELECT * FROM traffic_data LIMIT 10;<br><br>
		- \q<br><br>

	- [docker terminal] docker compose down<br><br>
