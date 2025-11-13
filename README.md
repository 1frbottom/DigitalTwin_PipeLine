# DigitalTwin_PipeLine<br><br>

- __현재 목표__<br><br>
	- backEnd 폴더에서 실제 api 여러개 호출 및 저장, 프론트엔드까지 일련의 테스트중<br><br>
	- 현재 백>>>프론트까지 가공없이 바로 db에 쌓는식으로 전달은 성공<br><br>
		-> __앞으로__ processor.py는 각 api별로 db테이블을 달리해서 저장<br><br>
		-> 이후 해당 테이블들을 대시보드에 알맞게 가공(조인)해서 또다른 융합db테이블에 저장<br><br>
		-> 프론트엔드의 요청 받은 apiServer가 융합 테이블을 조회 후 전달<br><br>

***

- 프로젝트 프로토타이핑 입니다.<br><br>

- 도커 설치 & 프로젝트 클론 해주시면 됩니다. ( 해당문서는 feature/test 브랜치 사용중 ) <br><br>
	- 전부 도커 컨테이너 위에서 동작합니다.<br><br>

	- producer_asdf.py(데이터 생성, api별로 존재) -><br>
			spark(데이터 가공 / processor.py) -><br>
			spark(데이터 저장 및 조회 / postgres DB)<br><br>

	- producer_roadComm_se_rt : 서울 열린데이터 'https://data.seoul.go.kr/dataList/OA-13291/A/1/datasetView.do'<br><br>

- 도커 사용법<br>
	- 루트에 .env 파일을 만들고 "SEOUL_API_KEY=본인의 서울 열린데이터 api key" 한줄 입력후 저장<br><br>

	- 프로젝트의 루트 디렉토리에서 터미널 실행 & 도커 데스크탑 앱 실행<br><br>

	- [terminal] docker compose up -d<br><br>

	- [docker app] producer 컨테이너의 로그 정상인지 체크<br><br>

	- [docker app] spark-submit(processor) 컨테이너의 로그 정상인지 체크<br><br>

	- [docker app] db 컨테이너의 exec으로 가서 아래의 명령어 입력<br><br>
		- psql -U user -d traffic_db<br><br>
		- SELECT * FROM traffic_data LIMIT 10;<br><br>
		- \q<br><br>

	- [terminal] docker compose down<br><br>

- 발생할만한 에러 및 트러블슈팅<br>
	- 각 컨테이너의 로그에 port 관련 문제가 찍혀있는 경우, 프로젝트 루트의 .yml 파일에서 문제되는 컨테이너의 포트를 바꾸면 해결될 가능성이 높습니다.<br><br>
	- backEnd/startProducers.sh 파일이 윈도우 기반 CRLF로 되어있는 경우 도커가 작동하지 않으니 LF로 바꿔줘야 합니다.<br><br>
